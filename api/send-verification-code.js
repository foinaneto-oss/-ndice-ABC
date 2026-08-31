import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "E-mail inválido" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress || "unknown";

    const { data: emailOk } = await supabaseAdmin.rpc("check_rate_limit", {
      p_key: `code:email:${cleanEmail}`, p_max: 5, p_window_minutes: 60,
    });
    const { data: ipOk } = await supabaseAdmin.rpc("check_rate_limit", {
      p_key: `code:ip:${ip}`, p_max: 8, p_window_minutes: 60,
    });
    if (!emailOk || !ipOk) {
      return res.status(429).json({ error: "Muitas tentativas. Aguarde um pouco antes de tentar de novo." });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos

    const { error: insertError } = await supabaseAdmin.from("verification_codes").insert({
      email: cleanEmail,
      code,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    // Envia o e-mail via Resend
    const resendKey = process.env.RESEND_API_KEY;
    let emailSent = false;
    if (resendKey) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Índice ABC <verificacao@indiceabc.com.br>",
          to: cleanEmail,
          subject: "Seu código de verificação — Índice ABC",
          html: `<p>Seu código de verificação é:</p><h2 style="letter-spacing:4px;">${code}</h2><p>Ele vale por 10 minutos.</p>`,
        }),
      });

      if (emailRes.ok) {
        emailSent = true;
      } else {
        const errBody = await emailRes.text();
        // Isso aparece nos "Logs" do projeto no Vercel — útil pra diagnosticar
        console.error("Resend recusou o envio:", emailRes.status, errBody);
      }
    } else {
      console.warn("RESEND_API_KEY não configurada — código não foi enviado por e-mail.");
    }

    return res.status(200).json({ success: true, emailSent });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao enviar código" });
  }
}
