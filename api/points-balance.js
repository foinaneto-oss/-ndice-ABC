import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "./_pointsAuth.js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { token } = req.body;
    const email = verifyToken(token);
    if (!email) {
      return res.status(401).json({ error: "Sessão inválida ou expirada. Verifique seu e-mail de novo." });
    }

    const { data: transactions, error } = await supabaseAdmin
      .from("points_transactions")
      .select("type, points, expires_at, created_at")
      .eq("email", email)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const now = new Date();
    let balance = 0;
    for (const tx of transactions || []) {
      if (tx.type === "earn") {
        if (!tx.expires_at || new Date(tx.expires_at) > now) balance += tx.points;
      } else if (tx.type === "redeem") {
        balance -= tx.points;
      }
    }

    return res.status(200).json({ success: true, balance, transactions: transactions || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao consultar saldo" });
  }
}
