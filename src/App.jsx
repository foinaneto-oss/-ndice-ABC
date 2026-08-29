import React, { useState, useEffect, useCallback } from "react";
import { Plus, ArrowLeft, Users, BarChart3, Share2, X, Check, ClipboardList, TrendingUp, Loader2, LogOut, Download } from "lucide-react";
import { supabase } from "./supabaseClient";

// ---------- design tokens ----------
const INK = "#12233A";
const BLUE = "#0F2E52";
const BLUE_SOFT = "#3B5975";
const GOLD = "#C79A45";
const GOLD_SOFT = "#E7D4A4";
const PAPER = "#F7F5EF";
const LINE = "#DCD6C6";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');`;

const DEFAULT_QUOTAS = [
  { id: "q13-17-m", label: "13–17 anos · Masculino", target: 12 },
  { id: "q13-17-f", label: "13–17 anos · Feminino", target: 12 },
  { id: "q18-24-m", label: "18–24 anos · Masculino", target: 17 },
  { id: "q18-24-f", label: "18–24 anos · Feminino", target: 17 },
  { id: "q25-34-m", label: "25–34 anos · Masculino", target: 27 },
  { id: "q25-34-f", label: "25–34 anos · Feminino", target: 25 },
  { id: "q35-44-m", label: "35–44 anos · Masculino", target: 40 },
  { id: "q35-44-f", label: "35–44 anos · Feminino", target: 35 },
  { id: "q45-59-m", label: "45–59 anos · Masculino", target: 51 },
  { id: "q45-59-f", label: "45–59 anos · Feminino", target: 42 },
  { id: "q60p-m", label: "60+ anos · Masculino", target: 46 },
  { id: "q60p-f", label: "60+ anos · Feminino", target: 61 },
];

const uid = (p = "id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// URL pública de resposta: ?s=<surveyId> — não exige login
function getPublicSurveyId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("s");
}

// ---------- shared bits ----------
function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <TrendingUp size={16} color={GOLD_SOFT} strokeWidth={2.5} />
      </div>
      <div style={{ lineHeight: 1.05 }}>
        <div style={{ fontFamily: "'Newsreader', serif", fontWeight: 600, fontSize: 17, color: INK }}>Índice ABC</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10, letterSpacing: "0.06em", color: BLUE_SOFT, textTransform: "uppercase" }}>Instituto Índice e Desenvolvimento do ABC</div>
      </div>
    </div>
  );
}

function PyramidBar({ label, target, count }) {
  const pct = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0;
  const full = count >= target && target > 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: INK, marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: full ? "#3E7A52" : BLUE_SOFT }}>{count} / {target} {full && "· completa"}</span>
      </div>
      <div style={{ height: 10, background: "#EDE8DA", borderRadius: 5, overflow: "hidden", border: `1px solid ${LINE}` }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 5, background: full ? "linear-gradient(90deg,#3E7A52,#5A9A6E)" : `linear-gradient(90deg, ${BLUE}, ${BLUE_SOFT})`, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function Button({ children, onClick, variant = "primary", style, disabled, type = "button" }) {
  const base = { fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13.5, padding: "10px 16px", borderRadius: 8, border: "none", cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6, opacity: disabled ? 0.5 : 1 };
  const variants = {
    primary: { background: BLUE, color: "#fff" },
    gold: { background: GOLD, color: "#2A1F0A" },
    ghost: { background: "transparent", color: BLUE, border: `1px solid ${LINE}` },
    danger: { background: "transparent", color: "#8A3B3B", border: `1px solid #E3CBCB` },
  };
  return <button type={type} disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, fontWeight: 600, color: BLUE_SOFT, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = { width: "100%", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, padding: "10px 12px", borderRadius: 7, border: `1px solid ${LINE}`, background: "#fff", color: INK, boxSizing: "border-box" };

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ---------- Login ----------
function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("E-mail ou senha incorretos.");
    else onLoggedIn(data.session);
  };

  return (
    <div style={{ maxWidth: 360, margin: "60px auto", padding: "0 20px" }}>
      <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 22, color: INK, marginBottom: 4 }}>Painel do Índice ABC</h1>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT, marginBottom: 20 }}>Acesso restrito ao administrador do instituto.</p>
      <form onSubmit={submit}>
        <Field label="E-mail">
          <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </Field>
        <Field label="Senha">
          <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </Field>
        {error && <div style={{ color: "#8A3B3B", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
        <Button type="submit" variant="gold" disabled={loading}>{loading ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Entrar</Button>
      </form>
    </div>
  );
}

// ---------- Create Survey ----------
function CreateSurvey({ userId, onCancel, onSave }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState([{ id: uid("q"), text: "", type: "single", options: ["", ""] }]);
  const [quotas, setQuotas] = useState(DEFAULT_QUOTAS.map(q => ({ ...q })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addQuestion = () => setQuestions([...questions, { id: uid("q"), text: "", type: "single", options: ["", ""] }]);
  const removeQuestion = (id) => setQuestions(questions.filter(q => q.id !== id));
  const updateQuestion = (id, patch) => setQuestions(questions.map(q => q.id === id ? { ...q, ...patch } : q));
  const updateOption = (qid, idx, val) => setQuestions(questions.map(q => q.id === qid ? { ...q, options: q.options.map((o, i) => i === idx ? val : o) } : q));
  const addOption = (qid) => setQuestions(questions.map(q => q.id === qid ? { ...q, options: [...q.options, ""] } : q));
  const removeOption = (qid, idx) => setQuestions(questions.map(q => q.id === qid ? { ...q, options: q.options.filter((_, i) => i !== idx) } : q));
  const updateQuota = (id, patch) => setQuotas(quotas.map(q => q.id === id ? { ...q, ...patch } : q));
  const removeQuota = (id) => setQuotas(quotas.filter(q => q.id !== id));
  const addQuota = () => setQuotas([...quotas, { id: uid("faixa"), label: "", target: 0 }]);

  const totalTarget = quotas.reduce((s, q) => s + (Number(q.target) || 0), 0);
  const canSave = title.trim() && questions.every(q => q.text.trim()) && quotas.every(q => q.label.trim());

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true); setError("");
    const payload = {
      title: title.trim(),
      description: description.trim(),
      questions: questions.map(q => ({ ...q, options: q.type === "text" ? [] : q.options.filter(o => o.trim()) })),
      quotas: quotas.map(q => ({ ...q, target: Number(q.target) || 0 })),
      created_by: userId,
    };
    const { data, error } = await supabase.from("surveys").insert(payload).select().single();
    setSaving(false);
    if (error) { setError("Erro ao salvar: " + error.message); return; }
    onSave(data);
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 60px" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, cursor: "pointer", marginBottom: 18, padding: 0 }}>
        <ArrowLeft size={15} /> Voltar
      </button>
      <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, margin: "0 0 20px" }}>Nova pesquisa</h1>

      <Field label="Título da pesquisa">
        <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Hábitos de Redes Sociais — São Caetano" />
      </Field>
      <Field label="Descrição (opcional)">
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={description} onChange={e => setDescription(e.target.value)} />
      </Field>

      <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 18, marginTop: 6 }}>
        <div style={{ fontFamily: "'Newsreader', serif", fontSize: 17, color: INK, marginBottom: 10, fontStyle: "italic" }}>Perguntas</div>
        {questions.map((q, qi) => (
          <div key={q.id} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={q.text} onChange={e => updateQuestion(q.id, { text: e.target.value })} placeholder={`Pergunta ${qi + 1}`} />
              {questions.length > 1 && <button onClick={() => removeQuestion(q.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8A3B3B" }}><X size={18} /></button>}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {[["single", "Escolha única"], ["multi", "Múltipla escolha"], ["text", "Texto livre"]].map(([val, lab]) => (
                <button key={val} onClick={() => updateQuestion(q.id, { type: val })} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, padding: "5px 10px", borderRadius: 20, cursor: "pointer", border: `1px solid ${q.type === val ? BLUE : LINE}`, background: q.type === val ? BLUE : "#fff", color: q.type === val ? "#fff" : BLUE_SOFT }}>{lab}</button>
              ))}
            </div>
            {q.type !== "text" && (
              <div>
                {q.options.map((opt, oi) => (
                  <div key={oi} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input style={{ ...inputStyle, fontSize: 13, padding: "7px 10px" }} value={opt} onChange={e => updateOption(q.id, oi, e.target.value)} placeholder={`Opção ${oi + 1}`} />
                    {q.options.length > 2 && <button onClick={() => removeOption(q.id, oi)} style={{ background: "none", border: "none", cursor: "pointer", color: BLUE_SOFT }}><X size={15} /></button>}
                  </div>
                ))}
                <button onClick={() => addOption(q.id)} style={{ background: "none", border: "none", color: BLUE, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, cursor: "pointer", padding: 0, fontWeight: 600 }}>+ adicionar opção</button>
              </div>
            )}
          </div>
        ))}
        <Button variant="ghost" onClick={addQuestion} style={{ marginBottom: 24 }}><Plus size={15} /> Adicionar pergunta</Button>
      </div>

      <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 18 }}>
        <div style={{ fontFamily: "'Newsreader', serif", fontSize: 17, color: INK, marginBottom: 4, fontStyle: "italic" }}>Cotas por faixa etária</div>
        {quotas.map(q => (
          <div key={q.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input style={{ ...inputStyle, flex: 2 }} value={q.label} onChange={e => updateQuota(q.id, { label: e.target.value })} />
            <input style={{ ...inputStyle, flex: 1, fontFamily: "'IBM Plex Mono', monospace" }} type="number" min="0" value={q.target} onChange={e => updateQuota(q.id, { target: e.target.value })} />
            <button onClick={() => removeQuota(q.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8A3B3B" }}><X size={16} /></button>
          </div>
        ))}
        <Button variant="ghost" onClick={addQuota} style={{ marginTop: 4 }}><Plus size={15} /> Adicionar faixa</Button>
        <div style={{ marginTop: 12, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: INK }}>Total da amostra-alvo: <strong>{totalTarget}</strong> respostas</div>
      </div>

      {error && <div style={{ color: "#8A3B3B", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, marginTop: 16 }}>{error}</div>}
      <div style={{ marginTop: 28, display: "flex", gap: 10 }}>
        <Button variant="gold" onClick={handleSave} disabled={!canSave || saving}>{saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Criar pesquisa</Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

// ---------- Public respond view (no login) ----------
function RespondSurvey() {
  const surveyId = getPublicSurveyId();
  const [survey, setSurvey] = useState(null);
  const [counts, setCounts] = useState({});
  const [quotaId, setQuotaId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("surveys").select("*").eq("id", surveyId).single();
      if (error || !data) { setNotFound(true); return; }
      setSurvey(data);
      const { data: rpcData } = await supabase.rpc("get_quota_counts", { p_survey_id: surveyId });
      const c = {};
      (rpcData || []).forEach(r => { c[r.quota_id] = Number(r.response_count); });
      setCounts(c);
    })();
  }, [surveyId]);

  if (notFound) return <div style={{ padding: 40, textAlign: "center", fontFamily: "'IBM Plex Sans', sans-serif", color: BLUE_SOFT }}>Pesquisa não encontrada.</div>;
  if (!survey) return <div style={{ padding: 40, textAlign: "center", color: BLUE_SOFT }}><Loader2 className="spin" size={20} /></div>;

  const chosenQuota = survey.quotas.find(q => q.id === quotaId);
  const quotaFull = chosenQuota && (counts[chosenQuota.id] || 0) >= chosenQuota.target;

  const setAnswer = (qid, val) => setAnswers(a => ({ ...a, [qid]: val }));
  const toggleMulti = (qid, opt) => setAnswers(a => {
    const cur = a[qid] || [];
    return { ...a, [qid]: cur.includes(opt) ? cur.filter(o => o !== opt) : [...cur, opt] };
  });

  const canSubmit = quotaId && !quotaFull && survey.questions.every(q => q.type === "multi" ? (answers[q.id] || []).length > 0 : answers[q.id] && String(answers[q.id]).trim());

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/submit-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId: survey.id, quotaId, answers, startedAt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Não foi possível enviar sua resposta.");
      } else {
        setSubmitted(true);
      }
    } catch (e) {
      setSubmitError("Erro de conexão. Tente novamente.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", padding: "0 20px", textAlign: "center" }}>
        <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#3E7A52", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Check color="#fff" size={24} /></div>
        <h2 style={{ fontFamily: "'Newsreader', serif", fontSize: 22, color: INK }}>Obrigado pela participação</h2>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: BLUE_SOFT, fontSize: 14 }}>Sua resposta foi registrada.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: GOLD, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Índice ABC</div>
      <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 24, color: INK, margin: "4px 0 6px" }}>{survey.title}</h1>
      {survey.description && <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: BLUE_SOFT, marginBottom: 20 }}>{survey.description}</p>}

      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <Field label="Sua faixa etária">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {survey.quotas.map(q => {
              const full = (counts[q.id] || 0) >= q.target;
              const active = quotaId === q.id;
              return (
                <button key={q.id} disabled={full} onClick={() => setQuotaId(q.id)} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, padding: "7px 12px", borderRadius: 20, cursor: full ? "not-allowed" : "pointer", border: `1px solid ${active ? BLUE : LINE}`, background: active ? BLUE : full ? "#EDE8DA" : "#fff", color: active ? "#fff" : full ? "#A79C7E" : INK, textDecoration: full ? "line-through" : "none" }}>{q.label}{full ? " · completa" : ""}</button>
              );
            })}
          </div>
        </Field>
      </div>

      {quotaId && !quotaFull && survey.questions.map((q, qi) => (
        <div key={q.id} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 14.5, color: INK, marginBottom: 10 }}>{qi + 1}. {q.text}</div>
          {q.type === "text" && <textarea style={{ ...inputStyle, minHeight: 60 }} value={answers[q.id] || ""} onChange={e => setAnswer(q.id, e.target.value)} />}
          {q.type === "single" && q.options.map(opt => (
            <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: INK, cursor: "pointer" }}>
              <input type="radio" name={q.id} checked={answers[q.id] === opt} onChange={() => setAnswer(q.id, opt)} />{opt}
            </label>
          ))}
          {q.type === "multi" && q.options.map(opt => (
            <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: INK, cursor: "pointer" }}>
              <input type="checkbox" checked={(answers[q.id] || []).includes(opt)} onChange={() => toggleMulti(q.id, opt)} />{opt}
            </label>
          ))}
        </div>
      ))}

      {quotaId && quotaFull && (
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: "#8A3B3B", background: "#FBF0EE", border: "1px solid #E3CBCB", borderRadius: 8, padding: 12 }}>
          A cota dessa faixa etária já foi preenchida. Obrigado pelo interesse.
        </div>
      )}
      {submitError && (
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "#8A3B3B", background: "#FBF0EE", border: "1px solid #E3CBCB", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          {submitError}
        </div>
      )}
      {quotaId && !quotaFull && (
        <Button variant="gold" onClick={submit} disabled={!canSubmit || submitting} style={{ marginTop: 6 }}>{submitting ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Enviar resposta</Button>
      )}
    </div>
  );
}

// ---------- Survey dashboard (admin) ----------
function SurveyDashboard({ survey, onBack }) {
  const [responses, setResponses] = useState(null);
  const publicUrl = `${window.location.origin}${window.location.pathname}?s=${survey.id}`;

  const load = useCallback(async () => {
    const { data } = await supabase.from("responses").select("*").eq("survey_id", survey.id);
    setResponses(data || []);
  }, [survey.id]);

  useEffect(() => { load(); }, [load]);

  const counts = {};
  (responses || []).forEach(r => { counts[r.quota_id] = (counts[r.quota_id] || 0) + 1; });
  const totalTarget = survey.quotas.reduce((s, q) => s + q.target, 0);

  const tally = (q) => {
    const t = {}; (q.options || []).forEach(o => t[o] = 0);
    (responses || []).forEach(r => {
      const a = r.answers[q.id];
      if (q.type === "multi" && Array.isArray(a)) a.forEach(o => { t[o] = (t[o] || 0) + 1; });
      else if (a) t[a] = (t[a] || 0) + 1;
    });
    return t;
  };

  const exportCSV = () => {
    const header = ["id", "faixa_etaria_sexo", "enviado_em", "tempo_resposta_segundos", "regiao", "pais", ...survey.questions.map(q => q.text)];
    const rows = (responses || []).map(r => [
      r.id,
      survey.quotas.find(q => q.id === r.quota_id)?.label || r.quota_id,
      r.submitted_at,
      r.duration_seconds ?? "",
      r.region ?? "",
      r.country ?? "",
      ...survey.questions.map(q => {
        const a = r.answers[q.id];
        return Array.isArray(a) ? a.join(" | ") : (a || "");
      }),
    ]);
    downloadCSV(`${survey.title.replace(/\s+/g, "_")}.csv`, [header, ...rows]);
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 60px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ArrowLeft size={15} /> Todas as pesquisas
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 25, color: INK, margin: 0 }}>{survey.title}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(publicUrl)}><Share2 size={14} /> Copiar link</Button>
          <Button variant="primary" onClick={exportCSV}><Download size={14} /> Exportar CSV</Button>
        </div>
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: BLUE_SOFT, marginBottom: 18, wordBreak: "break-all" }}>{publicUrl}</div>

      {responses === null ? <Loader2 className="spin" size={18} color={BLUE_SOFT} /> : (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 22, fontFamily: "'IBM Plex Mono', monospace" }}>
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 18px" }}>
              <div style={{ fontSize: 22, color: BLUE, fontWeight: 600 }}>{responses.length}</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: BLUE_SOFT }}>respostas coletadas</div>
            </div>
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 18px" }}>
              <div style={{ fontSize: 22, color: GOLD, fontWeight: 600 }}>{totalTarget}</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: BLUE_SOFT }}>meta da amostra</div>
            </div>
          </div>

          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 18, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 16, color: INK, marginBottom: 12 }}><Users size={16} /> Cotas por faixa etária</div>
            {survey.quotas.map(q => <PyramidBar key={q.id} label={q.label} target={q.target} count={counts[q.id] || 0} />)}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 16, color: INK, marginBottom: 10 }}><BarChart3 size={16} /> Resultados por pergunta</div>
          {survey.questions.map(q => {
            if (q.type === "text") {
              const texts = (responses || []).map(r => r.answers[q.id]).filter(Boolean);
              return (
                <div key={q.id} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13.5, color: INK, marginBottom: 8 }}>{q.text}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: BLUE_SOFT }}>{texts.length} respostas de texto livre (exporte o CSV para ler todas)</div>
                </div>
              );
            }
            const t = tally(q); const max = Math.max(1, ...Object.values(t));
            return (
              <div key={q.id} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13.5, color: INK, marginBottom: 10 }}>{q.text}</div>
                {Object.entries(t).map(([opt, n]) => (
                  <div key={opt} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: INK, marginBottom: 3 }}><span>{opt}</span><span style={{ fontFamily: "'IBM Plex Mono', monospace", color: BLUE_SOFT }}>{n}</span></div>
                    <div style={{ height: 7, background: "#EDE8DA", borderRadius: 4 }}><div style={{ height: "100%", width: `${(n / max) * 100}%`, background: GOLD, borderRadius: 4 }} /></div>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ---------- List view (admin) ----------
function SurveyList({ onCreate, onOpen }) {
  const [surveys, setSurveys] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("surveys").select("*").order("created_at", { ascending: false });
      setSurveys(data || []);
    })();
  }, []);

  if (surveys === null) return <div style={{ padding: 60, textAlign: "center", color: BLUE_SOFT }}><Loader2 className="spin" size={20} /></div>;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, margin: 0 }}>Pesquisas</h1>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT }}>{surveys.length} {surveys.length === 1 ? "pesquisa criada" : "pesquisas criadas"}</div>
        </div>
        <Button variant="gold" onClick={onCreate}><Plus size={15} /> Nova pesquisa</Button>
      </div>

      {surveys.length === 0 && (
        <div style={{ textAlign: "center", padding: "50px 20px", border: `1px dashed ${LINE}`, borderRadius: 12 }}>
          <ClipboardList size={30} color={BLUE_SOFT} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: "'Newsreader', serif", fontSize: 17, color: INK, marginBottom: 4 }}>Nenhuma pesquisa ainda</div>
          <Button variant="primary" onClick={onCreate}><Plus size={15} /> Criar pesquisa</Button>
        </div>
      )}

      {surveys.map(s => (
        <button key={s.id} onClick={() => onOpen(s)} style={{ display: "block", width: "100%", textAlign: "left", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 10, cursor: "pointer" }}>
          <div style={{ fontFamily: "'Newsreader', serif", fontSize: 17, color: INK }}>{s.title}</div>
          {s.description && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT, marginTop: 3 }}>{s.description}</div>}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: GOLD, marginTop: 8 }}>{s.questions.length} perguntas · meta de {s.quotas.reduce((sum, q) => sum + q.target, 0)} respostas</div>
        </button>
      ))}
    </div>
  );
}

// ---------- App ----------
export default function App() {
  const isPublic = !!getPublicSurveyId();
  const [session, setSession] = useState(undefined); // undefined = carregando
  const [view, setView] = useState("list");
  const [activeSurvey, setActiveSurvey] = useState(null);

  useEffect(() => {
    if (isPublic) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [isPublic]);

  const globalStyle = (
    <style>{`
      ${FONT_IMPORT}
      * { box-sizing: border-box; }
      input:focus, textarea:focus, button:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 1px; }
      .spin { animation: spin 0.8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      body { margin: 0; }
    `}</style>
  );

  // Formulário público — sem login
  if (isPublic) {
    return <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif" }}>{globalStyle}<RespondSurvey /></div>;
  }

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", background: PAPER }}>{globalStyle}<div style={{ padding: 60, textAlign: "center", color: BLUE_SOFT }}><Loader2 className="spin" size={22} /></div></div>;
  }

  if (!session) {
    return <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif" }}>{globalStyle}<Login onLoggedIn={setSession} /></div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {globalStyle}
      <div style={{ borderBottom: `1px solid ${LINE}`, background: "#fff", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Brand />
        <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", cursor: "pointer", color: BLUE_SOFT, display: "flex", alignItems: "center", gap: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5 }}>
          <LogOut size={14} /> Sair
        </button>
      </div>

      {view === "list" && <SurveyList onCreate={() => setView("create")} onOpen={(s) => { setActiveSurvey(s); setView("dashboard"); }} />}
      {view === "create" && <CreateSurvey userId={session.user.id} onCancel={() => setView("list")} onSave={(s) => { setActiveSurvey(s); setView("dashboard"); }} />}
      {view === "dashboard" && activeSurvey && <SurveyDashboard survey={activeSurvey} onBack={() => setView("list")} />}
    </div>
  );
}
