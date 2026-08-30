import React, { useState, useEffect, useCallback } from "react";
import { Plus, ArrowLeft, Users, BarChart3, Share2, X, Check, ClipboardList, TrendingUp, Loader2, LogOut, Download, ChevronUp, ChevronDown } from "lucide-react";
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

function isPreviewMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("preview") === "1";
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
function CreateSurvey({ userId, editingSurvey, onCancel, onSave }) {
  const [title, setTitle] = useState(editingSurvey?.title || "");
  const [description, setDescription] = useState(editingSurvey?.description || "");
  const [questions, setQuestions] = useState(
    editingSurvey?.questions?.length
      ? editingSurvey.questions.map(q => ({ ...q, required: q.required !== false }))
      : [{ id: uid("q"), text: "", type: "single", options: ["", ""], required: true }]
  );
  const [quotas, setQuotas] = useState(
    editingSurvey?.quotas?.length ? editingSurvey.quotas.map(q => ({ ...q })) : DEFAULT_QUOTAS.map(q => ({ ...q }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addQuestion = () => setQuestions([...questions, { id: uid("q"), text: "", type: "single", options: ["", ""], required: true }]);
  const removeQuestion = (id) => setQuestions(questions.filter(q => q.id !== id));
  const updateQuestion = (id, patch) => setQuestions(questions.map(q => q.id === id ? { ...q, ...patch } : q));
  const moveQuestion = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    setQuestions(next);
  };
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
    };
    let data, error;
    if (editingSurvey) {
      ({ data, error } = await supabase.from("surveys").update(payload).eq("id", editingSurvey.id).select().single());
    } else {
      ({ data, error } = await supabase.from("surveys").insert({ ...payload, created_by: userId }).select().single());
    }
    setSaving(false);
    if (error) { setError("Erro ao salvar: " + error.message); return; }
    onSave(data);
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 60px" }}>
      <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, cursor: "pointer", marginBottom: 18, padding: 0 }}>
        <ArrowLeft size={15} /> Voltar
      </button>
      <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, margin: "0 0 20px" }}>{editingSurvey ? "Editar pesquisa" : "Nova pesquisa"}</h1>

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
            <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <button onClick={() => moveQuestion(qi, -1)} disabled={qi === 0}
                  style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: "5px 5px 0 0", cursor: qi === 0 ? "not-allowed" : "pointer", color: qi === 0 ? "#C9C2AC" : BLUE_SOFT, padding: "2px 4px", lineHeight: 0 }}
                  title="Mover para cima"><ChevronUp size={14} /></button>
                <button onClick={() => moveQuestion(qi, 1)} disabled={qi === questions.length - 1}
                  style={{ background: "none", border: `1px solid ${LINE}`, borderTop: "none", borderRadius: "0 0 5px 5px", cursor: qi === questions.length - 1 ? "not-allowed" : "pointer", color: qi === questions.length - 1 ? "#C9C2AC" : BLUE_SOFT, padding: "2px 4px", lineHeight: 0 }}
                  title="Mover para baixo"><ChevronDown size={14} /></button>
              </div>
              <input style={{ ...inputStyle, flex: 1 }} value={q.text} onChange={e => updateQuestion(q.id, { text: e.target.value })} placeholder={`Pergunta ${qi + 1}`} />
              {questions.length > 1 && <button onClick={() => removeQuestion(q.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8A3B3B" }}><X size={18} /></button>}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              {[["single", "Escolha única"], ["multi", "Múltipla escolha"], ["text", "Texto livre"]].map(([val, lab]) => (
                <button key={val} onClick={() => updateQuestion(q.id, { type: val })} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, padding: "5px 10px", borderRadius: 20, cursor: "pointer", border: `1px solid ${q.type === val ? BLUE : LINE}`, background: q.type === val ? BLUE : "#fff", color: q.type === val ? "#fff" : BLUE_SOFT }}>{lab}</button>
              ))}
              <button onClick={() => updateQuestion(q.id, { required: q.required === false ? true : false })}
                style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, padding: "5px 10px", borderRadius: 20, cursor: "pointer", border: `1px solid ${q.required === false ? LINE : GOLD}`, background: q.required === false ? "#fff" : "#FBF3E4", color: q.required === false ? BLUE_SOFT : "#8A6416", marginLeft: "auto" }}>
                {q.required === false ? "Opcional" : "Obrigatória"}
              </button>
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
        <div style={{ fontFamily: "'Newsreader', serif", fontSize: 17, color: INK, marginBottom: 4, fontStyle: "italic" }}>Cotas da amostra</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: BLUE_SOFT, marginBottom: 12 }}>
          Preencha "Faixa etária" e, se quiser cruzar com sexo, o segundo campo — o formulário público mostra os dois como perguntas separadas, mas a cota é controlada pela combinação.
        </div>
        {quotas.map(q => {
          const [g1 = "", g2 = ""] = (q.label || "").split(" · ");
          const setG1 = (val) => updateQuota(q.id, { label: g2 ? `${val} · ${g2}` : val });
          const setG2 = (val) => updateQuota(q.id, { label: val ? `${g1} · ${val}` : g1 });
          return (
            <div key={q.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input style={{ ...inputStyle, flex: 2, minWidth: 140 }} value={g1} onChange={e => setG1(e.target.value)} placeholder="Faixa etária" />
              <input style={{ ...inputStyle, flex: 1, minWidth: 110 }} value={g2} onChange={e => setG2(e.target.value)} placeholder="Sexo (opcional)" />
              <input style={{ ...inputStyle, flex: 1, minWidth: 70, fontFamily: "'IBM Plex Mono', monospace" }} type="number" min="0" value={q.target} onChange={e => updateQuota(q.id, { target: e.target.value })} />
              <button onClick={() => removeQuota(q.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8A3B3B" }}><X size={16} /></button>
            </div>
          );
        })}
        <Button variant="ghost" onClick={addQuota} style={{ marginTop: 4 }}><Plus size={15} /> Adicionar faixa</Button>
        <div style={{ marginTop: 12, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: INK }}>Total da amostra-alvo: <strong>{totalTarget}</strong> respostas</div>
      </div>

      {error && <div style={{ color: "#8A3B3B", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, marginTop: 16 }}>{error}</div>}
      <div style={{ marginTop: 28, display: "flex", gap: 10 }}>
        <Button variant="gold" onClick={handleSave} disabled={!canSave || saving}>{saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />} {editingSurvey ? "Salvar alterações" : "Criar pesquisa"}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

// ---------- Public respond view (no login) ----------
function RespondSurvey() {
  const surveyId = getPublicSurveyId();
  const preview = isPreviewMode();
  const [survey, setSurvey] = useState(null);
  const [counts, setCounts] = useState({});
  const [quotaId, setQuotaId] = useState(null);
  const [group1, setGroup1] = useState(null);
  const [group2, setGroup2] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [honeypot, setHoneypot] = useState("");
  const [subscribeData, setSubscribeData] = useState({ name: "", ddd: "", phone: "", email: "", city: "" });
  const [subscribeStatus, setSubscribeStatus] = useState("idle"); // idle | saving | done

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

  // Atualiza a cota escolhida quando faixa etária + sexo (duas dimensões) mudam.
  // Este useEffect precisa ficar ANTES de qualquer retorno condicional (regra dos hooks do React).
  useEffect(() => {
    if (!survey) return;
    const parsed = survey.quotas.map(q => {
      const parts = (q.label || "").split(" · ");
      return { ...q, g1: parts[0] || q.label, g2: parts.length > 1 ? parts[1] : null };
    });
    const twoDim = parsed.length > 0 && parsed.every(q => q.g2);
    if (!twoDim) return;
    if (group1 && group2) {
      const match = parsed.find(q => q.g1 === group1 && q.g2 === group2);
      setQuotaId(match ? match.id : null);
    } else {
      setQuotaId(null);
    }
  }, [group1, group2, survey]);

  if (notFound) return <div style={{ padding: 40, textAlign: "center", fontFamily: "'IBM Plex Sans', sans-serif", color: BLUE_SOFT }}>Pesquisa não encontrada.</div>;
  if (!survey) return <div style={{ padding: 40, textAlign: "center", color: BLUE_SOFT }}><Loader2 className="spin" size={20} /></div>;
  if (survey.status === "encerrada" && !preview) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", padding: "0 20px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Newsreader', serif", fontSize: 20, color: INK }}>Coleta encerrada</h2>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: BLUE_SOFT, fontSize: 14 }}>Esta pesquisa não está mais recebendo respostas. Obrigado pelo interesse.</p>
      </div>
    );
  }

  const chosenQuota = survey.quotas.find(q => q.id === quotaId);
  const quotaFull = chosenQuota && (counts[chosenQuota.id] || 0) >= chosenQuota.target;

  // Detecta se as cotas usam duas dimensões (ex: "13–17 anos · Masculino")
  const parsedQuotas = survey.quotas.map(q => {
    const parts = (q.label || "").split(" · ");
    return { ...q, g1: parts[0] || q.label, g2: parts.length > 1 ? parts[1] : null };
  });
  const isTwoDimensional = parsedQuotas.length > 0 && parsedQuotas.every(q => q.g2);
  const group1Options = isTwoDimensional ? [...new Set(parsedQuotas.map(q => q.g1))] : [];
  const group2Options = isTwoDimensional && group1 ? [...new Set(parsedQuotas.filter(q => q.g1 === group1).map(q => q.g2))] : [];

  const isFullFor = (g1val, g2val) => {
    const q = parsedQuotas.find(x => x.g1 === g1val && (g2val == null || x.g2 === g2val));
    if (!q) return false;
    return (counts[q.id] || 0) >= q.target;
  };

  const setAnswer = (qid, val) => setAnswers(a => ({ ...a, [qid]: val }));
  const toggleMulti = (qid, opt) => setAnswers(a => {
    const cur = a[qid] || [];
    return { ...a, [qid]: cur.includes(opt) ? cur.filter(o => o !== opt) : [...cur, opt] };
  });

  const canSubmit = quotaId && !quotaFull && survey.questions.every(q => {
    if (q.required === false) return true;
    return q.type === "multi" ? (answers[q.id] || []).length > 0 : answers[q.id] && String(answers[q.id]).trim();
  });
  const answeredCount = survey.questions.filter(q => q.type === "multi" ? (answers[q.id] || []).length > 0 : answers[q.id] && String(answers[q.id]).trim()).length;

  const submit = async () => {
    if (!canSubmit || submitting) return;

    // Honeypot: campo invisível que só um robô preencheria.
    // Se vier preenchido, fingimos sucesso mas não gravamos nada.
    if (honeypot.trim() !== "") {
      setSubmitted(true);
      return;
    }

    // Modo de pré-visualização: não grava nada de verdade.
    if (preview) {
      setSubmitting(true);
      setTimeout(() => { setSubmitting(false); setSubmitted(true); }, 400);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/submit-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId: survey.id, quotaId, answers, startedAt, honeypot }),
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
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: BLUE_SOFT, fontSize: 14 }}>
          {preview ? "Isso foi uma pré-visualização — nada foi salvo de verdade." : "Sua resposta foi registrada."}
        </p>
        {!preview && (
          <div style={{ marginTop: 24, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 18, textAlign: "left" }}>
            {subscribeStatus === "done" ? (
              <div style={{ textAlign: "center", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: "#3E7A52" }}>
                <Check size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Inscrição recebida! Boa sorte 🍀
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "'Newsreader', serif", fontSize: 15, color: INK, marginBottom: 4, textAlign: "center" }}>
                  Se inscreva e participe das nossas pesquisas e ganhe prêmios e vouchers
                </div>
                <div style={{ marginTop: 12 }}>
                  <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Nome" value={subscribeData.name} onChange={e => setSubscribeData(d => ({ ...d, name: e.target.value }))} />
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input style={{ ...inputStyle, width: 60 }} placeholder="DDD" maxLength={2} value={subscribeData.ddd} onChange={e => setSubscribeData(d => ({ ...d, ddd: e.target.value.replace(/\D/g, "") }))} />
                    <input style={{ ...inputStyle, flex: 1 }} placeholder="Telefone" value={subscribeData.phone} onChange={e => setSubscribeData(d => ({ ...d, phone: e.target.value }))} />
                  </div>
                  <input style={{ ...inputStyle, marginBottom: 8 }} type="email" placeholder="E-mail" value={subscribeData.email} onChange={e => setSubscribeData(d => ({ ...d, email: e.target.value }))} />
                  <input style={{ ...inputStyle, marginBottom: 12 }} placeholder="Cidade" value={subscribeData.city} onChange={e => setSubscribeData(d => ({ ...d, city: e.target.value }))} />
                  <Button variant="gold" style={{ width: "100%", justifyContent: "center" }} disabled={subscribeStatus === "saving" || !subscribeData.name.trim()}
                    onClick={async () => {
                      setSubscribeStatus("saving");
                      const { error } = await supabase.from("subscribers").insert({
                        survey_id: survey.id,
                        name: subscribeData.name.trim(),
                        ddd: subscribeData.ddd.trim(),
                        phone: subscribeData.phone.trim(),
                        email: subscribeData.email.trim(),
                        city: subscribeData.city.trim(),
                      });
                      setSubscribeStatus(error ? "idle" : "done");
                    }}>
                    {subscribeStatus === "saving" ? <Loader2 size={15} className="spin" /> : "Quero participar"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: GOLD, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Índice ABC</div>
      <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 24, color: INK, margin: "4px 0 6px" }}>{survey.title}</h1>
      {survey.description && <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: BLUE_SOFT, marginBottom: 12 }}>{survey.description}</p>}

      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: BLUE_SOFT, background: "#F1EEE3", border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 10px", marginBottom: 16 }}>
        Suas respostas são anônimas e usadas apenas para fins de pesquisa do Instituto Índice e Desenvolvimento do ABC, conforme a LGPD.
      </div>

      {quotaId && !quotaFull && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: BLUE_SOFT, marginBottom: 4 }}>{answeredCount} de {survey.questions.length} perguntas respondidas</div>
          <div style={{ height: 6, background: "#EDE8DA", borderRadius: 4 }}>
            <div style={{ height: "100%", width: `${(answeredCount / survey.questions.length) * 100}%`, background: GOLD, borderRadius: 4, transition: "width 0.3s ease" }} />
          </div>
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        {isTwoDimensional ? (
          <>
            <Field label="Sua faixa etária">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {group1Options.map(g1 => {
                  const full = parsedQuotas.filter(q => q.g1 === g1).every(q => (counts[q.id] || 0) >= q.target);
                  const active = group1 === g1;
                  return (
                    <button key={g1} disabled={full} onClick={() => { setGroup1(g1); setGroup2(null); }}
                      style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, padding: "7px 12px", borderRadius: 20, cursor: full ? "not-allowed" : "pointer", border: `1px solid ${active ? BLUE : LINE}`, background: active ? BLUE : full ? "#EDE8DA" : "#fff", color: active ? "#fff" : full ? "#A79C7E" : INK, textDecoration: full ? "line-through" : "none" }}>{g1}{full ? " · completa" : ""}</button>
                  );
                })}
              </div>
            </Field>
            {group1 && (
              <Field label="Sexo">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {group2Options.map(g2 => {
                    const full = isFullFor(group1, g2);
                    const active = group2 === g2;
                    return (
                      <button key={g2} disabled={full} onClick={() => setGroup2(g2)}
                        style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, padding: "7px 12px", borderRadius: 20, cursor: full ? "not-allowed" : "pointer", border: `1px solid ${active ? BLUE : LINE}`, background: active ? BLUE : full ? "#EDE8DA" : "#fff", color: active ? "#fff" : full ? "#A79C7E" : INK, textDecoration: full ? "line-through" : "none" }}>{g2}{full ? " · completa" : ""}</button>
                    );
                  })}
                </div>
              </Field>
            )}
          </>
        ) : (
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
        )}
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

      {/* Campo honeypot: invisível para pessoas, só bots costumam preencher */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={e => setHoneypot(e.target.value)}
        autoComplete="off"
        tabIndex={-1}
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        aria-hidden="true"
      />

      {quotaId && !quotaFull && (
        <Button variant="gold" onClick={submit} disabled={!canSubmit || submitting} style={{ marginTop: 6 }}>{submitting ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Enviar resposta</Button>
      )}
    </div>
  );
}

// ---------- Survey dashboard (admin) ----------
function SurveyDashboard({ survey, onBack, onEdit, onDuplicated, onDeleted }) {
  const [responses, setResponses] = useState(null);
  const [surveyStatus, setSurveyStatus] = useState(survey.status || "ativa");
  const [statusSaving, setStatusSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const publicUrl = `${window.location.origin}${window.location.pathname}?s=${survey.id}`;
  const previewUrl = `${publicUrl}&preview=1`;

  const toggleStatus = async () => {
    setStatusSaving(true);
    const next = surveyStatus === "ativa" ? "encerrada" : "ativa";
    const { error } = await supabase.from("surveys").update({ status: next }).eq("id", survey.id);
    if (!error) setSurveyStatus(next);
    setStatusSaving(false);
  };

  const duplicateSurvey = async () => {
    setDuplicating(true);
    const { data, error } = await supabase.from("surveys").insert({
      title: `${survey.title} (cópia)`,
      description: survey.description,
      questions: survey.questions,
      quotas: survey.quotas,
      created_by: survey.created_by,
      status: "ativa",
    }).select().single();
    setDuplicating(false);
    if (!error && data) onDuplicated(data);
  };

  const deleteSurvey = async () => {
    setDeleting(true);
    const { error } = await supabase.from("surveys").delete().eq("id", survey.id);
    setDeleting(false);
    if (!error) onDeleted();
  };

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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={onEdit}>Editar</Button>
          <Button variant="ghost" onClick={duplicateSurvey} disabled={duplicating}>{duplicating ? <Loader2 size={14} className="spin" /> : null} Duplicar</Button>
          <Button variant="ghost" onClick={() => window.open(previewUrl, "_blank")}>Pré-visualizar</Button>
          <Button variant={surveyStatus === "ativa" ? "danger" : "primary"} onClick={toggleStatus} disabled={statusSaving}>
            {statusSaving ? <Loader2 size={14} className="spin" /> : null}
            {surveyStatus === "ativa" ? "Encerrar coleta" : "Reabrir coleta"}
          </Button>
          <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(publicUrl)}><Share2 size={14} /> Copiar link</Button>
          <Button variant="primary" onClick={exportCSV}><Download size={14} /> Exportar CSV</Button>
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}><X size={14} /> Excluir</Button>
        </div>
      </div>

      {confirmingDelete && (
        <div style={{ background: "#FBF0EE", border: "1px solid #E3CBCB", borderRadius: 10, padding: 16, marginBottom: 18 }}>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13.5, color: "#8A3B3B", marginBottom: 6 }}>
            Excluir "{survey.title}" permanentemente?
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: "#8A3B3B", marginBottom: 12 }}>
            Isso apaga a pesquisa e as {responses?.length ?? 0} respostas coletadas. Não é possível desfazer.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="danger" onClick={deleteSurvey} disabled={deleting}>{deleting ? <Loader2 size={14} className="spin" /> : null} Sim, excluir de vez</Button>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>Cancelar</Button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, padding: "2px 8px", borderRadius: 12, background: surveyStatus === "ativa" ? "#E5F1E9" : "#F1EEE3", color: surveyStatus === "ativa" ? "#3E7A52" : BLUE_SOFT }}>
          {surveyStatus === "ativa" ? "Coletando respostas" : "Coleta encerrada"}
        </span>
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
function SurveyList({ onCreate, onOpen, onViewSubscribers }) {
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, margin: 0 }}>Pesquisas</h1>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT }}>{surveys.length} {surveys.length === 1 ? "pesquisa criada" : "pesquisas criadas"}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" onClick={onViewSubscribers}>Inscritos</Button>
          <Button variant="gold" onClick={onCreate}><Plus size={15} /> Nova pesquisa</Button>
        </div>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontFamily: "'Newsreader', serif", fontSize: 17, color: INK }}>{s.title}</div>
            {s.status === "encerrada" && (
              <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10.5, padding: "2px 7px", borderRadius: 10, background: "#F1EEE3", color: BLUE_SOFT }}>encerrada</span>
            )}
          </div>
          {s.description && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT, marginTop: 3 }}>{s.description}</div>}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: GOLD, marginTop: 8 }}>{s.questions.length} perguntas · meta de {s.quotas.reduce((sum, q) => sum + q.target, 0)} respostas</div>
        </button>
      ))}
    </div>
  );
}

// ---------- Subscribers view (admin) ----------
function SubscribersView({ onBack }) {
  const [subscribers, setSubscribers] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("subscribers").select("*, surveys(title)").order("created_at", { ascending: false });
      setSubscribers(data || []);
    })();
  }, []);

  const exportCSV = () => {
    const header = ["nome", "ddd", "telefone", "email", "cidade", "pesquisa_origem", "inscrito_em"];
    const rows = (subscribers || []).map(s => [
      s.name, s.ddd || "", s.phone || "", s.email || "", s.city || "", s.surveys?.title || "", s.created_at,
    ]);
    downloadCSV("inscritos_indice_abc.csv", [header, ...rows]);
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 60px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ArrowLeft size={15} /> Todas as pesquisas
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, margin: 0 }}>Inscritos</h1>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT }}>Cadastros para sorteios de prêmios e vouchers</div>
        </div>
        <Button variant="primary" onClick={exportCSV} disabled={!subscribers?.length}><Download size={14} /> Exportar CSV</Button>
      </div>

      {subscribers === null ? <Loader2 className="spin" size={18} color={BLUE_SOFT} /> : subscribers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", border: `1px dashed ${LINE}`, borderRadius: 12, color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5 }}>
          Ninguém se inscreveu ainda.
        </div>
      ) : (
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
          {subscribers.map((s, i) => (
            <div key={s.id} style={{ padding: "12px 16px", borderTop: i > 0 ? `1px solid ${LINE}` : "none" }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 14, color: INK }}>{s.name}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: BLUE_SOFT, marginTop: 2 }}>
                {s.ddd && s.phone ? `(${s.ddd}) ${s.phone}` : ""} {s.email ? `· ${s.email}` : ""} {s.city ? `· ${s.city}` : ""}
              </div>
              {s.surveys?.title && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: GOLD, marginTop: 2 }}>via {s.surveys.title}</div>}
            </div>
          ))}
        </div>
      )}
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

      {view === "list" && <SurveyList onCreate={() => { setActiveSurvey(null); setView("create"); }} onOpen={(s) => { setActiveSurvey(s); setView("dashboard"); }} onViewSubscribers={() => setView("subscribers")} />}
      {view === "create" && <CreateSurvey userId={session.user.id} editingSurvey={activeSurvey} onCancel={() => setView(activeSurvey ? "dashboard" : "list")} onSave={(s) => { setActiveSurvey(s); setView("dashboard"); }} />}
      {view === "dashboard" && activeSurvey && (
        <SurveyDashboard
          survey={activeSurvey}
          onBack={() => setView("list")}
          onEdit={() => setView("create")}
          onDuplicated={(s) => { setActiveSurvey(s); setView("dashboard"); }}
          onDeleted={() => { setActiveSurvey(null); setView("list"); }}
        />
      )}
      {view === "subscribers" && <SubscribersView onBack={() => setView("list")} />}
    </div>
  );
}
