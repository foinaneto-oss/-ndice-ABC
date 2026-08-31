import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    // Só o admin logado pode disparar isso — confere o token de sessão do Supabase.
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Não autenticado" });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) return res.status(401).json({ error: "Sessão inválida" });

    const { surveyId } = req.body;
    if (!surveyId) return res.status(400).json({ error: "Pesquisa não informada" });

    const { data: survey, error: surveyError } = await supabaseAdmin
      .from("surveys")
      .select("id, title, description, points")
      .eq("id", surveyId)
      .single();
    if (surveyError || !survey) return res.status(404).json({ error: "Pesquisa não encontrada" });

    const { data: subscribers, error: subError } = await supabaseAdmin
      .from("subscribers")
      .select("email")
      .not("email", "is", null);
    if (subError) throw subError;

    const uniqueEmails = [...new Set((subscribers || []).map(s => s.email?.trim().toLowerCase()).filter(Boolean))];

    if (uniqueEmails.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: "Nenhum inscrito com e-mail cadastrado." });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return res.status(500).json({ error: "RESEND_API_KEY não configurada" });

    const origin = req.headers.origin || "https://indiceabc.com.br";
    const surveyUrl = `${origin}/?s=${surveyId}`;

    // Um envio por pessoa — ninguém vê o e-mail de outro inscrito.
    const results = await Promise.allSettled(
      uniqueEmails.map(email =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Índice ABC <contato@indiceabc.com.br>",
            reply_to: "institutoindiceabc@gmail.com",
            to: email,
            subject: `Nova pesquisa: ${survey.title}`,
            html: `
              <div style="font-family: sans-serif; color: #12233A;">
                <p>Olá!</p>
                <p>O Instituto Índice ABC acabou de abrir uma nova pesquisa:</p>
                <h2 style="color:#0F2E52;">${survey.title}</h2>
                ${survey.description ? `<p>${survey.description}</p>` : ""}
                <p>Responda e ganhe <strong>${survey.points || 5} pontos</strong>, trocáveis por vouchers e descontos.</p>
                <p><a href="${surveyUrl}" style="background:#C79A45; color:#2A1F0A; padding:10px 18px; border-radius:8px; text-decoration:none; font-weight:bold;">Participar da pesquisa</a></p>
                <p style="font-size:12px; color:#888; margin-top:32px;">
                  Você recebeu este e-mail porque se inscreveu em uma pesquisa do Índice ABC.
                  Para não receber mais avisos, é só responder este e-mail pedindo para ser removido da lista.
                </p>
              </div>
            `,
          }),
        })
      )
    );

    const sent = results.filter(r => r.status === "fulfilled" && r.value.ok).length;
    const failed = uniqueEmails.length - sent;

    await supabaseAdmin.from("surveys").update({ notified_at: new Date().toISOString() }).eq("id", surveyId);

    return res.status(200).json({ success: true, sent, failed, total: uniqueEmails.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao notificar inscritos" });
  }
}
