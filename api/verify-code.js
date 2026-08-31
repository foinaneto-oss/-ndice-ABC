import { createClient } from "@supabase/supabase-js";
import { createToken } from "./_pointsAuth.js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "Dados incompletos" });
    }
    const cleanEmail = email.trim().toLowerCase();

    const { data: match, error } = await supabaseAdmin
      .from("verification_codes")
      .select("id, expires_at, used")
      .eq("email", cleanEmail)
      .eq("code", String(code).trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !match) {
      return res.status(401).json({ error: "Código incorreto." });
    }
    if (match.used) {
      return res.status(401).json({ error: "Esse código já foi usado. Solicite um novo." });
    }
    if (new Date(match.expires_at) < new Date()) {
      return res.status(401).json({ error: "Código expirado. Solicite um novo." });
    }

    await supabaseAdmin.from("verification_codes").update({ used: true }).eq("id", match.id);

    const token = createToken(cleanEmail);
    return res.status(200).json({ success: true, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao verificar código" });
  }
}
