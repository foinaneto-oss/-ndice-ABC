import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

webpush.setVapidDetails(
  "mailto:institutoindiceabc@gmail.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    // Só o admin logado pode disparar isso.
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Não autenticado" });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) return res.status(401).json({ error: "Sessão inválida" });

    const { title, body, url } = req.body;
    if (!title) return res.status(400).json({ error: "Título é obrigatório" });

    const { data: subs, error: subsError } = await supabaseAdmin.from("push_subscriptions").select("*");
    if (subsError) throw subsError;

    if (!subs || subs.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: "Ninguém ativou notificações ainda." });
    }

    const payload = JSON.stringify({ title, body: body || "", url: url || "/" });

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    );

    let sent = 0;
    const expiredIds = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") sent += 1;
      else if (r.reason?.statusCode === 404 || r.reason?.statusCode === 410) {
        // Inscrição vencida/cancelada pelo navegador — limpa do banco.
        expiredIds.push(subs[i].id);
      }
    });

    if (expiredIds.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", expiredIds);
    }

    return res.status(200).json({ success: true, sent, total: subs.length, removed: expiredIds.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao enviar notificações" });
  }
}
