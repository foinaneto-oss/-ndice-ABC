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
    const { surveyId, responseId, email } = req.body;

    if (!surveyId || !responseId || !email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    // Confere se a resposta existe, pertence a essa pesquisa,
    // e ainda não foi usada pra creditar pontos.
    const { data: response, error: respError } = await supabaseAdmin
      .from("responses")
      .select("id, survey_id, points_claimed")
      .eq("id", responseId)
      .eq("survey_id", surveyId)
      .maybeSingle();

    if (respError || !response) {
      return res.status(404).json({ error: "Resposta não encontrada" });
    }
    if (response.points_claimed) {
      return res.status(409).json({ error: "Os pontos dessa resposta já foram creditados." });
    }

    const { data: survey, error: surveyError } = await supabaseAdmin
      .from("surveys")
      .select("points")
      .eq("id", surveyId)
      .single();

    if (surveyError || !survey) {
      return res.status(404).json({ error: "Pesquisa não encontrada" });
    }

    const points = survey.points || 5;
    const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(); // 180 dias

    const { error: txError } = await supabaseAdmin.from("points_transactions").insert({
      email: email.trim().toLowerCase(),
      type: "earn",
      points,
      survey_id: surveyId,
      expires_at: expiresAt,
    });

    if (txError) throw txError;

    await supabaseAdmin.from("responses").update({ points_claimed: true }).eq("id", responseId);

    return res.status(200).json({ success: true, points });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao creditar pontos" });
  }
}
