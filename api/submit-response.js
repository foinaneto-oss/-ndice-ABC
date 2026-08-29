import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function hashIp(ip, surveyId) {
  const salt = process.env.IP_HASH_SALT || "indice-abc-salt";
  return crypto.createHash("sha256").update(`${salt}:${surveyId}:${ip}`).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { surveyId, quotaId, answers, startedAt } = req.body;

    if (!surveyId || !quotaId || !answers) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress || "unknown";

    const region = req.headers["x-vercel-ip-city"] || req.headers["x-vercel-ip-country-region"] || null;
    const country = req.headers["x-vercel-ip-country"] || null;

    const ipHash = hashIp(ip, surveyId);

    const { data: existing } = await supabaseAdmin
      .from("response_ips")
      .select("id")
      .eq("survey_id", surveyId)
      .eq("ip_hash", ipHash)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: "Já existe uma resposta registrada para esta pesquisa a partir desta conexão." });
    }

    const durationSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : null;

    const { error: insertError } = await supabaseAdmin.from("responses").insert({
      survey_id: surveyId,
      quota_id: quotaId,
      answers,
      started_at: startedAt ? new Date(startedAt).toISOString() : null,
      duration_seconds: durationSeconds,
      region,
      country,
    });

    if (insertError) throw insertError;

    await supabaseAdmin.from("response_ips").insert({ survey_id: surveyId, ip_hash: ipHash });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao registrar resposta" });
  }
}
