import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
    const { data: ipOk } = await supabaseAdmin.rpc("check_rate_limit", {
      p_key: `checksub:ip:${ip}`, p_max: 20, p_window_minutes: 60,
    });
    if (!ipOk) {
      return res.status(429).json({ error: "Muitas tentativas. Aguarde um pouco antes de tentar de novo." });
    }

    const { data, error } = await supabaseAdmin
      .from("subscribers")
      .select("name")
      .ilike("email", cleanEmail)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return res.status(200).json({ exists: !!data, name: data?.name || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao consultar cadastro" });
  }
}
