import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const WELCOME_BONUS = 5;
const EXPIRY_MS = 180 * 24 * 60 * 60 * 1000; // 180 dias

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { surveyId, responseId, email, name, ddd, phone, city } = req.body;

    if (!surveyId || !responseId || !email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Dados inválidos" });
    }
    const cleanEmail = email.trim().toLowerCase();

    // Confere se essa resposta existe e ainda não gerou pontos
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

    // O servidor decide, com base no banco, se é cadastro novo ou não —
    // nunca confia só no que o navegador diz que é.
    const { data: existing } = await supabaseAdmin
      .from("subscribers")
      .select("id")
      .ilike("email", cleanEmail)
      .limit(1)
      .maybeSingle();

    const isNew = !existing;
    let bonus = 0;

    if (isNew) {
      if (!name?.trim() || !ddd?.trim() || !phone?.trim() || !city?.trim()) {
        return res.status(400).json({ error: "Nome, telefone e cidade são obrigatórios para novo cadastro." });
      }

      const { error: subError } = await supabaseAdmin.from("subscribers").insert({
        email: cleanEmail,
        name: name.trim(),
        ddd: ddd.trim(),
        phone: phone.trim(),
        city: city.trim(),
        survey_id: surveyId,
      });
      if (subError) throw subError;

      bonus = WELCOME_BONUS;
      await supabaseAdmin.from("points_transactions").insert({
        email: cleanEmail,
        type: "earn",
        points: bonus,
        survey_id: null,
        expires_at: new Date(Date.now() + EXPIRY_MS).toISOString(),
      });
    }

    const surveyPoints = survey.points || 5;
    const { error: txError } = await supabaseAdmin.from("points_transactions").insert({
      email: cleanEmail,
      type: "earn",
      points: surveyPoints,
      survey_id: surveyId,
      expires_at: new Date(Date.now() + EXPIRY_MS).toISOString(),
    });
    if (txError) throw txError;

    await supabaseAdmin.from("responses").update({ points_claimed: true }).eq("id", responseId);

    return res.status(200).json({
      success: true,
      surveyPoints,
      bonus,
      totalPoints: surveyPoints + bonus,
      isNew,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao creditar pontos" });
  }
}
