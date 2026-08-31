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
    const { token, rewardId } = req.body;
    const email = verifyToken(token);
    if (!email) {
      return res.status(401).json({ error: "Sessão inválida ou expirada. Verifique seu e-mail de novo." });
    }
    if (!rewardId) {
      return res.status(400).json({ error: "Recompensa não informada" });
    }

    const { data, error } = await supabaseAdmin.rpc("redeem_reward", {
      p_email: email,
      p_reward_id: rewardId,
    });

    if (error) throw error;
    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }

    return res.status(200).json({ success: true, newBalance: data.new_balance, rewardName: data.reward_name });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao resgatar recompensa" });
  }
}
