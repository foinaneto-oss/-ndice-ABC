import React, { useState, useEffect, useCallback } from "react";
import { Plus, ArrowLeft, Users, BarChart3, Share2, X, Check, ClipboardList, TrendingUp, Loader2, LogOut, Download, ChevronUp, ChevronDown, Instagram, Facebook, Copy } from "lucide-react";
import { supabase } from "./supabaseClient";

// ---------- design tokens ----------
const INK = "#12233A";
const BLUE = "#0F2E52";
const BLUE_SOFT = "#3B5975";
const GOLD = "#C79A45";
const GOLD_SOFT = "#E7D4A4";
const PAPER = "#F7F5EF";
const LINE = "#DCD6C6";

// Edite aqui os links das redes sociais do instituto
const INSTAGRAM_URL = "https://instagram.com/indiceabc";
const FACEBOOK_URL = "https://facebook.com/indiceabc";

// Troque pela sua chave do Google Maps (console.cloud.google.com, com a
// "Maps JavaScript API" ativada). Sem isso, o mapa de respostas não carrega.
const GOOGLE_MAPS_API_KEY = "AIzaSyDWn_nd7Ch0F3Yiugxm70Ud-2GrAzcMvVE";

// As 7 cidades do Grande ABC Paulista — o instituto cobre a região inteira,
// não só São Caetano do Sul. Cada pesquisa escolhe a sua cidade, e o mapa
// de respostas usa isso pra geocodificar os bairros certos, sem precisar
// de nenhuma lista fixa de bairros no código (funciona pra qualquer cidade,
// inclusive as que ainda não temos pesquisa nenhuma).
const ABC_CITIES = [
  "Santo André", "São Bernardo do Campo", "São Caetano do Sul",
  "Diadema", "Mauá", "Ribeirão Pires", "Rio Grande da Serra",
];

function normalizeText(s) {
  return (s || "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const sectionTitleStyle = { fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 17, color: "#0F2E52", marginTop: 22, marginBottom: 6 };

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

function isPointsPage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("points") === "1";
}

function isPrivacyPage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("privacy") === "1";
}

function isAdminPage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("admin") === "1";
}

function isAboutPage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("about") === "1";
}

function isPartnersPage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("partners") === "1";
}

function pointsPageUrl() {
  return `${window.location.origin}${window.location.pathname}?points=1`;
}

function privacyPageUrl() {
  return `${window.location.origin}${window.location.pathname}?privacy=1`;
}

function homePageUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function adminUrl() {
  return `${window.location.origin}${window.location.pathname}?admin=1`;
}

function aboutPageUrl() {
  return `${window.location.origin}${window.location.pathname}?about=1`;
}

function partnersPageUrl() {
  return `${window.location.origin}${window.location.pathname}?partners=1`;
}

function surveyPublicUrl(id) {
  return `${window.location.origin}${window.location.pathname}?s=${id}`;
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

// Atualiza o título da aba e a descrição (meta tag) conforme a página —
// ajuda o Google a diferenciar as páginas, já que é tudo a mesma "URL raiz" técnica.
function PageMeta({ title, description }) {
  useEffect(() => {
    document.title = title ? `${title} · Índice ABC` : "Índice ABC";
    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", description);
    }
  }, [title, description]);
  return null;
}

function HeaderBanner() {
  return (
    <img
      src="/header.png"
      alt="Instituto Índice e Desenvolvimento do ABC"
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}

function PageFooter() {
  return (
    <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 28, paddingTop: 18, textAlign: "center" }}>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 12 }}>
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" style={{ width: 32, height: 32, borderRadius: "50%", background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          <Instagram size={15} />
        </a>
        <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" style={{ width: 32, height: 32, borderRadius: "50%", background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          <Facebook size={15} />
        </a>
      </div>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: BLUE_SOFT, marginBottom: 12 }}>
        <a href="mailto:institutoindiceabc@gmail.com" style={{ color: BLUE_SOFT }}>institutoindiceabc@gmail.com</a> · Santo André/SP — Grande ABC Paulista
      </div>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
        <a href={homePageUrl()} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: BLUE_SOFT }}>Início</a>
        <a href={aboutPageUrl()} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: BLUE_SOFT }}>Sobre</a>
        <a href={partnersPageUrl()} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: BLUE_SOFT }}>Parceiros</a>
        <a href={pointsPageUrl()} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: BLUE_SOFT }}>Troque seus pontos</a>
        <a href={privacyPageUrl()} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: BLUE_SOFT }}>Política de Privacidade</a>
      </div>
      <div style={{ marginTop: 10 }}>
        <a href={adminUrl()} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10.5, color: "#B7AF98" }}>Área administrativa</a>
      </div>
    </div>
  );
}

// Menu lateral no computador (acima de 900px de largura) + navegação
// compacta no celular. Usa apenas CSS (classes .pl-*) para alternar,
// sem precisar de JavaScript pra detectar o tamanho da tela.
function PublicLayout({ children }) {
  const links = [
    { label: "Início", href: homePageUrl() },
    { label: "Sobre", href: aboutPageUrl() },
    { label: "Parceiros", href: partnersPageUrl() },
    { label: "Troque seus pontos", href: pointsPageUrl() },
    { label: "Política de Privacidade", href: privacyPageUrl() },
  ];
  return (
    <div>
      <HeaderBanner />
      <div className="pl-mobile-nav" style={{ background: "#fff", borderBottom: `1px solid ${LINE}`, padding: "10px 16px", display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
        {links.slice(0, 4).map(l => (
          <a key={l.href} href={l.href} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT, fontWeight: 600 }}>{l.label}</a>
        ))}
      </div>
      <div className="pl-shell">
        <aside className="pl-sidebar" style={{ flexDirection: "column", width: 230, flexShrink: 0, padding: "28px 20px", borderRight: `1px solid ${LINE}`, minHeight: "70vh", background: "#fff" }}>
          <nav style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
            {links.map(l => (
              <a key={l.href} href={l.href} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: BLUE_SOFT, fontWeight: 600 }}>{l.label}</a>
            ))}
          </nav>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "#B7AF98", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Contato</div>
          <a href="mailto:institutoindiceabc@gmail.com" style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT, display: "block", marginBottom: 14, wordBreak: "break-word" }}>institutoindiceabc@gmail.com</a>
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" style={{ width: 30, height: 30, borderRadius: "50%", background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Instagram size={14} />
            </a>
            <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" style={{ width: 30, height: 30, borderRadius: "50%", background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Facebook size={14} />
            </a>
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: "#B7AF98", lineHeight: 1.6 }}>
            Instituto Índice e Desenvolvimento do ABC<br />Santo André/SP — Grande ABC Paulista
          </div>
        </aside>
        <div className="pl-content">
          {children}
        </div>
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
    <div>
      <HeaderBanner />
      <div style={{ maxWidth: 360, margin: "40px auto 0", padding: "0 20px" }}>
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
  const [points, setPoints] = useState(editingSurvey?.points ?? 5);
  const [city, setCity] = useState(editingSurvey?.city || "São Caetano do Sul");
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
      points: Number(points) || 5,
      city,
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

      <Field label="Cidade do Grande ABC">
        <select value={city} onChange={e => setCity(e.target.value)} style={{ ...inputStyle, maxWidth: 260 }}>
          {ABC_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      <Field label="Pontos ao completar a pesquisa">
        <input style={{ ...inputStyle, maxWidth: 100, fontFamily: "'IBM Plex Mono', monospace" }} type="number" min="0" value={points} onChange={e => setPoints(e.target.value)} />
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: BLUE_SOFT, marginTop: 4 }}>Sugestão: entre 5 e 10 pontos.</div>
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
  const [responseId, setResponseId] = useState(null);
  const [honeypot, setHoneypot] = useState("");
  const [subscribeData, setSubscribeData] = useState({ name: "", ddd: "", phone: "", email: "", city: "" });
  const [subscribeStatus, setSubscribeStatus] = useState("idle"); // idle | saving | done
  const [pointsEmail, setPointsEmail] = useState("");
  const [pointsStatus, setPointsStatus] = useState("idle"); // idle | saving | done | error
  const [pointsError, setPointsError] = useState("");
  const [pointsEarned, setPointsEarned] = useState(0);
  const [step, setStep] = useState(0);

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

  // Sempre que a cota (faixa etária/sexo) muda, volta pra primeira pergunta.
  useEffect(() => {
    setStep(0);
  }, [quotaId]);

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
        setResponseId(data.responseId || null);
        setSubmitted(true);
      }
    } catch (e) {
      setSubmitError("Erro de conexão. Tente novamente.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <PublicLayout>
        <div style={{ maxWidth: 480, margin: "40px auto 0", padding: "0 20px 60px", textAlign: "center" }}>
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

        {!preview && (
          <div style={{ marginTop: 16, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 18, textAlign: "left" }}>
            {pointsStatus === "done" ? (
              <div style={{ textAlign: "center", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: "#3E7A52" }}>
                <Check size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
                +{pointsEarned} pontos creditados! Acesse{" "}
                <a href={pointsPageUrl()} style={{ color: "#3E7A52", textDecoration: "underline", fontWeight: 600 }}>Troque seus pontos</a>{" "}
                pra ver seu saldo.
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "'Newsreader', serif", fontSize: 15, color: INK, marginBottom: 4, textAlign: "center" }}>
                  Ganhe {survey.points || 5} pontos por responder essa pesquisa
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: BLUE_SOFT, marginBottom: 10, textAlign: "center" }}>
                  Troque pontos por vouchers e descontos dos nossos parceiros
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...inputStyle, flex: 1 }} type="email" placeholder="Seu e-mail" value={pointsEmail} onChange={e => setPointsEmail(e.target.value)} />
                  <Button
                    variant="gold"
                    disabled={pointsStatus === "saving" || !pointsEmail.trim() || !responseId}
                    onClick={async () => {
                      setPointsStatus("saving"); setPointsError("");
                      try {
                        const res = await fetch("/api/earn-points", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ surveyId: survey.id, responseId, email: pointsEmail.trim() }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setPointsError(data.error || "Não foi possível creditar os pontos.");
                          setPointsStatus("error");
                        } else {
                          setPointsEarned(data.points);
                          setPointsStatus("done");
                        }
                      } catch {
                        setPointsError("Erro de conexão. Tente novamente.");
                        setPointsStatus("error");
                      }
                    }}
                  >
                    {pointsStatus === "saving" ? <Loader2 size={15} className="spin" /> : "Ganhar pontos"}
                  </Button>
                </div>
                {pointsStatus === "error" && (
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#8A3B3B", marginTop: 8 }}>{pointsError}</div>
                )}
              </>
            )}
          </div>
        )}

        {!preview && (
          <>
            <div style={{ marginTop: 16, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 18, textAlign: "center" }}>
              <div style={{ fontFamily: "'Newsreader', serif", fontSize: 15, color: INK, marginBottom: 12 }}>
                Compartilhe essa pesquisa com seus amigos
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <Button
                  variant="gold"
                  onClick={() => {
                    const shareUrl = window.location.href;
                    const text = `Participe da pesquisa "${survey.title}" do Índice ABC:`;
                    if (navigator.share) {
                      navigator.share({ title: survey.title, text, url: shareUrl }).catch(() => {});
                    } else {
                      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`, "_blank");
                    }
                  }}
                >
                  <Share2 size={14} /> Compartilhar
                </Button>
                <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(window.location.href)}>
                  <Copy size={14} /> Copiar link
                </Button>
              </div>
            </div>

            <div style={{ marginTop: 16, textAlign: "center" }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT, marginBottom: 10 }}>
                Siga o Instituto Índice ABC nas redes sociais
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
                  style={{ width: 38, height: 38, borderRadius: "50%", background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                  <Instagram size={18} />
                </a>
                <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer"
                  style={{ width: 38, height: 38, borderRadius: "50%", background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                  <Facebook size={18} />
                </a>
              </div>
            </div>
          </>
        )}
        <PageFooter />
      </div>
      </PublicLayout>
    );
  }

  const currentQuestion = quotaId ? survey.questions[step] : null;
  const isLastStep = currentQuestion ? step === survey.questions.length - 1 : false;
  const currentAnswered = currentQuestion
    ? (currentQuestion.type === "multi" ? (answers[currentQuestion.id] || []).length > 0 : answers[currentQuestion.id] && String(answers[currentQuestion.id]).trim())
    : false;
  const canProceed = currentQuestion ? (currentQuestion.required === false || currentAnswered) : false;

  const goNext = () => {
    if (!canProceed) return;
    if (isLastStep) submit();
    else setStep(s => s + 1);
  };
  const goBack = () => {
    if (step === 0) { setQuotaId(null); setGroup1(null); setGroup2(null); }
    else setStep(s => s - 1);
  };

  return (
    <PublicLayout>
      <PageMeta title={survey.title} description={survey.description || `Participe da pesquisa "${survey.title}" do Índice ABC.`} />
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 60px" }}>
      <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 24, color: INK, margin: "4px 0 6px" }}>{survey.title}</h1>
      {survey.description && <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: BLUE_SOFT, marginBottom: 12 }}>{survey.description}</p>}

      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: BLUE_SOFT, background: "#F1EEE3", border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 10px", marginBottom: 16 }}>
        Suas respostas são anônimas e usadas apenas para fins de pesquisa do Instituto Índice e Desenvolvimento do ABC, conforme nossa{" "}
        <a href={privacyPageUrl()} style={{ color: BLUE, fontWeight: 600 }}>Política de Privacidade</a>.
      </div>

      {quotaId && !quotaFull && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: BLUE_SOFT, marginBottom: 4 }}>Pergunta {step + 1} de {survey.questions.length}</div>
          <div style={{ height: 6, background: "#EDE8DA", borderRadius: 4 }}>
            <div style={{ height: "100%", width: `${((step + 1) / survey.questions.length) * 100}%`, background: GOLD, borderRadius: 4, transition: "width 0.3s ease" }} />
          </div>
        </div>
      )}

      {!quotaId && (
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
                        style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, padding: "10px 16px", borderRadius: 22, cursor: full ? "not-allowed" : "pointer", border: `1px solid ${active ? BLUE : LINE}`, background: active ? BLUE : full ? "#EDE8DA" : "#fff", color: active ? "#fff" : full ? "#A79C7E" : INK, textDecoration: full ? "line-through" : "none" }}>{g1}{full ? " · completa" : ""}</button>
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
                          style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, padding: "10px 16px", borderRadius: 22, cursor: full ? "not-allowed" : "pointer", border: `1px solid ${active ? BLUE : LINE}`, background: active ? BLUE : full ? "#EDE8DA" : "#fff", color: active ? "#fff" : full ? "#A79C7E" : INK, textDecoration: full ? "line-through" : "none" }}>{g2}{full ? " · completa" : ""}</button>
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
                    <button key={q.id} disabled={full} onClick={() => setQuotaId(q.id)} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, padding: "10px 16px", borderRadius: 22, cursor: full ? "not-allowed" : "pointer", border: `1px solid ${active ? BLUE : LINE}`, background: active ? BLUE : full ? "#EDE8DA" : "#fff", color: active ? "#fff" : full ? "#A79C7E" : INK, textDecoration: full ? "line-through" : "none" }}>{q.label}{full ? " · completa" : ""}</button>
                  );
                })}
              </div>
            </Field>
          )}
        </div>
      )}

      {quotaId && !quotaFull && currentQuestion && (
        <div key={currentQuestion.id} className="step-fade" style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 18, marginBottom: 16 }}>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 15.5, color: INK, marginBottom: 14 }}>
            {currentQuestion.text}
            {currentQuestion.required === false && <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 400, fontSize: 11.5, color: BLUE_SOFT }}> (opcional)</span>}
          </div>
          {currentQuestion.type === "text" && (
            <textarea style={{ ...inputStyle, minHeight: 80 }} value={answers[currentQuestion.id] || ""} onChange={e => setAnswer(currentQuestion.id, e.target.value)} autoFocus />
          )}
          {currentQuestion.type === "single" && currentQuestion.options.map(opt => (
            <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", marginBottom: 8, borderRadius: 10, border: `1px solid ${answers[currentQuestion.id] === opt ? BLUE : LINE}`, background: answers[currentQuestion.id] === opt ? "#EEF2F6" : "#fff", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: INK, cursor: "pointer" }}
              onClick={() => setAnswer(currentQuestion.id, opt)}>
              <input type="radio" name={currentQuestion.id} checked={answers[currentQuestion.id] === opt} onChange={() => setAnswer(currentQuestion.id, opt)} />{opt}
            </label>
          ))}
          {currentQuestion.type === "multi" && currentQuestion.options.map(opt => (
            <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", marginBottom: 8, borderRadius: 10, border: `1px solid ${(answers[currentQuestion.id] || []).includes(opt) ? BLUE : LINE}`, background: (answers[currentQuestion.id] || []).includes(opt) ? "#EEF2F6" : "#fff", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: INK, cursor: "pointer" }}
              onClick={() => toggleMulti(currentQuestion.id, opt)}>
              <input type="checkbox" checked={(answers[currentQuestion.id] || []).includes(opt)} onChange={() => toggleMulti(currentQuestion.id, opt)} />{opt}
            </label>
          ))}
        </div>
      )}

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

      {quotaId && !quotaFull && currentQuestion && (
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="ghost" onClick={goBack}><ArrowLeft size={14} /> Voltar</Button>
          <Button variant="gold" onClick={goNext} disabled={!canProceed || submitting} style={{ flex: 1, justifyContent: "center" }}>
            {submitting ? <Loader2 size={15} className="spin" /> : isLastStep ? <Check size={15} /> : null}
            {submitting ? "" : isLastStep ? "Enviar resposta" : "Próxima"}
          </Button>
        </div>
      )}
      <PageFooter />
      </div>
    </PublicLayout>
  );
}

// ---------- Points exchange (public, standalone page) ----------
function PointsExchange() {
  const [step, setStep] = useState("email"); // email | code | balance
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState(null);
  const [rewards, setRewards] = useState(null);
  const [redeemingId, setRedeemingId] = useState(null);
  const [redeemMessage, setRedeemMessage] = useState("");

  const loadRewards = useCallback(async () => {
    const { data } = await supabase.from("rewards").select("*").eq("active", true).order("points_cost", { ascending: true });
    setRewards(data || []);
  }, []);

  const loadBalance = useCallback(async (tk) => {
    const res = await fetch("/api/points-balance", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tk }),
    });
    const data = await res.json();
    if (res.ok) setBalance(data.balance);
    return res.ok;
  }, []);

  const sendCode = async () => {
    if (!email.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/send-verification-code", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Não foi possível enviar o código.");
      else setStep("code");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  };

  const confirmCode = async () => {
    if (!code.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/verify-code", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Código incorreto.");
      } else {
        setToken(data.token);
        await Promise.all([loadBalance(data.token), loadRewards()]);
        setStep("balance");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  };

  const redeem = async (rewardId) => {
    setRedeemingId(rewardId); setRedeemMessage(""); setError("");
    try {
      const res = await fetch("/api/redeem-reward", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, rewardId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRedeemMessage(data.error || "Não foi possível resgatar.");
      } else {
        setBalance(data.newBalance);
        setRedeemMessage(`Resgatado: ${data.rewardName}! Nossa equipe vai entrar em contato com as instruções.`);
        await loadRewards();
      }
    } catch {
      setRedeemMessage("Erro de conexão. Tente novamente.");
    }
    setRedeemingId(null);
  };

  return (
    <PublicLayout>
      <PageMeta title="Troque seus pontos" description="Confira seu saldo de pontos e troque por vouchers dos parceiros do Índice ABC." />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 60px" }}>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 24, color: INK, margin: "4px 0 6px" }}>Troque seus pontos</h1>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: BLUE_SOFT, marginBottom: 20 }}>
          Confira seu saldo de pontos ganhos ao responder nossas pesquisas, e troque por vouchers dos nossos parceiros.
        </p>

        {step === "email" && (
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 18 }}>
            <Field label="Seu e-mail">
              <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seuemail@exemplo.com" />
            </Field>
            {error && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: "#8A3B3B", marginBottom: 12 }}>{error}</div>}
            <Button variant="gold" onClick={sendCode} disabled={loading || !email.trim()}>
              {loading ? <Loader2 size={15} className="spin" /> : "Enviar código"}
            </Button>
          </div>
        )}

        {step === "code" && (
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 18 }}>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT, marginBottom: 12 }}>
              Enviamos um código de 6 dígitos para <strong>{email}</strong>. Ele vale por 10 minutos.
            </div>
            <Field label="Código de verificação">
              <input style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 4, fontSize: 18, textAlign: "center" }} maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" />
            </Field>
            {error && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: "#8A3B3B", marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="gold" onClick={confirmCode} disabled={loading || code.length < 6}>
                {loading ? <Loader2 size={15} className="spin" /> : "Confirmar"}
              </Button>
              <Button variant="ghost" onClick={() => { setStep("email"); setCode(""); setError(""); }}>Trocar e-mail</Button>
            </div>
          </div>
        )}

        {step === "balance" && (
          <>
            <div style={{ background: BLUE, borderRadius: 10, padding: 20, textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: GOLD_SOFT, textTransform: "uppercase", letterSpacing: "0.06em" }}>Seu saldo</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 36, color: "#fff", fontWeight: 600 }}>{balance ?? "…"}</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: GOLD_SOFT }}>pontos disponíveis</div>
            </div>

            {redeemMessage && (
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: redeemMessage.startsWith("Resgatado") ? "#3E7A52" : "#8A3B3B", background: redeemMessage.startsWith("Resgatado") ? "#E5F1E9" : "#FBF0EE", border: `1px solid ${redeemMessage.startsWith("Resgatado") ? "#B9DBC4" : "#E3CBCB"}`, borderRadius: 8, padding: 12, marginBottom: 14 }}>
                {redeemMessage}
              </div>
            )}

            <div style={{ fontFamily: "'Newsreader', serif", fontSize: 17, color: INK, marginBottom: 10, fontStyle: "italic" }}>Recompensas disponíveis</div>

            {rewards === null ? <Loader2 className="spin" size={18} color={BLUE_SOFT} /> : rewards.length === 0 ? (
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT, textAlign: "center", padding: 20 }}>Nenhuma recompensa disponível no momento.</div>
            ) : rewards.map(r => {
              const canRedeem = balance !== null && balance >= r.points_cost && (r.quantity_available == null || r.quantity_available > 0);
              return (
                <div key={r.id} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 14, color: INK }}>{r.name}</div>
                    {r.partner_name && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: GOLD }}>{r.partner_name}</div>}
                    {r.description && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: BLUE_SOFT, marginTop: 3 }}>{r.description}</div>}
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: BLUE_SOFT, marginTop: 4 }}>{r.points_cost} pontos</div>
                  </div>
                  <Button variant={canRedeem ? "gold" : "ghost"} disabled={!canRedeem || redeemingId === r.id} onClick={() => redeem(r.id)} style={{ flexShrink: 0 }}>
                    {redeemingId === r.id ? <Loader2 size={14} className="spin" /> : canRedeem ? "Resgatar" : "Saldo insuficiente"}
                  </Button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </PublicLayout>
  );
}

// ---------- Home page (public, standalone) ----------
function HomePage() {
  const [surveys, setSurveys] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("surveys")
        .select("id, title, description, points")
        .eq("status", "ativa")
        .order("created_at", { ascending: false });
      setSurveys(data || []);
    })();
  }, []);

  return (
    <PublicLayout>
      <PageMeta title="Início" description="Instituto Índice e Desenvolvimento do ABC — pesquisas e índices estatisticamente rigorosos sobre o Grande ABC Paulista." />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 16px 60px" }}>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, marginBottom: 10 }}>
          Instituto Índice e Desenvolvimento do ABC
        </h1>
        <p style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 16, color: BLUE_SOFT, lineHeight: 1.6, marginBottom: 28 }}>
          Gerar conhecimento estatisticamente rigoroso sobre a realidade do Grande ABC, para orientar decisões
          públicas, privadas e comunitárias com dados confiáveis.
        </p>

        <h3 style={sectionTitleStyle}>Pesquisas ativas</h3>
        {surveys === null ? (
          <Loader2 className="spin" size={18} color={BLUE_SOFT} />
        ) : surveys.length === 0 ? (
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: BLUE_SOFT, padding: "16px 0" }}>
            Nenhuma pesquisa aberta para participação no momento. Volte em breve!
          </div>
        ) : (
          surveys.map(s => (
            <a key={s.id} href={surveyPublicUrl(s.id)} style={{ display: "block", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 10, textDecoration: "none" }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 14.5, color: INK }}>{s.title}</div>
              {s.description && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT, marginTop: 3 }}>{s.description}</div>}
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: GOLD, marginTop: 6 }}>Ganhe {s.points || 5} pontos ao responder →</div>
            </a>
          ))
        )}

        <PageFooter />
      </div>
    </PublicLayout>
  );
}

// ---------- About page (public, standalone) ----------
function AboutPage() {
  return (
    <PublicLayout>
      <PageMeta title="Sobre" description="Conheça a missão, a metodologia e a natureza jurídica do Instituto Índice e Desenvolvimento do ABC." />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 16px 60px" }}>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, marginBottom: 20 }}>Sobre o Instituto</h1>

        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: INK, lineHeight: 1.7 }}>
          <p>
            O <strong>Instituto Índice e Desenvolvimento do ABC (IIDABC)</strong> é uma associação civil sem fins
            econômicos dedicada à produção de índices, pesquisas e diagnósticos estatísticos sobre os municípios
            do Grande ABC Paulista, com atuação inicial concentrada em São Caetano do Sul.
          </p>
          <p>
            Nossa missão é preencher uma lacuna real: decisões sobre segurança, mobilidade, comércio local e
            qualidade de vida na região frequentemente carecem de dados primários, atualizados e
            metodologicamente sólidos. O IIDABC nasce para produzir esse conhecimento com rigor científico —
            amostragem estatisticamente representativa, baseada em dados do Censo IBGE, com margens de erro e
            níveis de confiança declarados em cada pesquisa publicada.
          </p>
          <p>
            Acreditamos que dados confiáveis fortalecem o debate público. Por isso, os resultados das pesquisas
            do Instituto são disponibilizados à imprensa, ao poder público, a empresas e à sociedade civil,
            contribuindo para decisões mais informadas em toda a região do ABC.
          </p>

          <h3 style={sectionTitleStyle}>Dados institucionais</h3>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: BLUE_SOFT, lineHeight: 1.9 }}>
            Natureza jurídica: Associação civil de direito privado, sem fins econômicos<br />
            Sede: Santo André/SP — Grande ABC Paulista<br />
            Contato: institutoindiceabc@gmail.com
          </p>
        </div>

        <PageFooter />
      </div>
    </PublicLayout>
  );
}

// ---------- Partners page (public, standalone) ----------
function PartnersPage() {
  const [partners, setPartners] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("rewards")
        .select("partner_name, name")
        .eq("active", true)
        .not("partner_name", "is", null);

      const grouped = {};
      (data || []).forEach(r => {
        const key = r.partner_name.trim();
        if (!key) return;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r.name);
      });
      setPartners(grouped);
    })();
  }, []);

  const partnerNames = partners ? Object.keys(partners) : [];

  return (
    <PublicLayout>
      <PageMeta title="Parceiros" description="Empresas e comércios parceiros do programa de pontos do Índice ABC." />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 16px 60px" }}>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, marginBottom: 6 }}>Nossos Parceiros</h1>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: BLUE_SOFT, marginBottom: 24 }}>
          Empresas e comércios que oferecem vouchers e descontos pelo programa de pontos do Índice ABC.
        </p>

        {partners === null ? (
          <Loader2 className="spin" size={18} color={BLUE_SOFT} />
        ) : partnerNames.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", border: `1px dashed ${LINE}`, borderRadius: 12, color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5 }}>
            Em breve, novos parceiros por aqui.
          </div>
        ) : (
          partnerNames.map(name => (
            <div key={name} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 10 }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 15, color: INK }}>{name}</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: GOLD, marginTop: 4 }}>{partners[name].join(" · ")}</div>
            </div>
          ))
        )}

        <PageFooter />
      </div>
    </PublicLayout>
  );
}

function PrivacyPolicy() {
  return (
    <PublicLayout>
      <PageMeta title="Política de Privacidade" description="Como o Instituto Índice e Desenvolvimento do ABC trata os dados pessoais coletados em pesquisas e cadastros." />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 60px" }}>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, marginBottom: 4 }}>Política de Privacidade</h1>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: BLUE_SOFT, marginBottom: 24 }}>Instituto Índice e Desenvolvimento do ABC</p>

        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: INK, lineHeight: 1.7 }}>
          <h3 style={sectionTitleStyle}>1. Quem somos</h3>
          <p>
            O Instituto Índice e Desenvolvimento do ABC (IIDABC), associação civil sem fins econômicos com sede
            na Rua Aguapeí, 339, Santa Maria, Santo André/SP, é o responsável pelo tratamento dos dados pessoais
            coletados através deste site e de suas pesquisas, nos termos da Lei Geral de Proteção de Dados (Lei
            13.709/2018 — LGPD).
          </p>

          <h3 style={sectionTitleStyle}>2. Quais dados coletamos</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>Respostas de pesquisa:</strong> coletadas de forma anônima. Não pedimos nome, CPF ou qualquer identificação pessoal para responder. Registramos apenas faixa etária, sexo, bairro (quando perguntado) e as respostas em si.</li>
            <li><strong>Endereço IP:</strong> usado apenas para impedir múltiplas respostas da mesma conexão em uma mesma pesquisa, e para estimar a região de origem. Armazenamos uma versão criptografada (hash) do IP, não o IP em texto puro.</li>
            <li><strong>Dados de inscrição voluntária:</strong> se você optar por se inscrever para sorteios de prêmios ou pelo programa de pontos, coletamos nome, telefone, e-mail e cidade — apenas quando você mesmo os fornece.</li>
            <li><strong>Dados do programa de pontos:</strong> e-mail, usado para verificar sua identidade por código e manter seu saldo de pontos.</li>
          </ul>

          <h3 style={sectionTitleStyle}>3. Para que usamos esses dados</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li>Produzir os índices e relatórios estatísticos do Instituto</li>
            <li>Viabilizar sorteios de prêmios e o programa de pontos por participação</li>
            <li>Prevenir respostas duplicadas e fraudes</li>
            <li>Cumprir obrigações legais, quando aplicável</li>
          </ul>

          <h3 style={sectionTitleStyle}>4. Com quem compartilhamos</h3>
          <p>
            Não vendemos nem compartilhamos seus dados pessoais com terceiros para fins comerciais. Utilizamos
            provedores de infraestrutura técnica (hospedagem e banco de dados) para operar o site, que têm acesso
            aos dados apenas na medida necessária para prestar esse serviço, sob obrigação de confidencialidade.
          </p>

          <h3 style={sectionTitleStyle}>5. Por quanto tempo guardamos</h3>
          <p>
            Respostas de pesquisa são mantidas indefinidamente para fins de pesquisa histórica e comparativa,
            sempre de forma anônima. Dados de inscrição e do programa de pontos são mantidos enquanto sua
            participação estiver ativa; pontos não resgatados expiram em 180 dias.
          </p>

          <h3 style={sectionTitleStyle}>6. Seus direitos</h3>
          <p>
            Conforme a LGPD, você pode solicitar a qualquer momento: confirmação de que tratamos seus dados,
            acesso a eles, correção de dados incompletos ou desatualizados, exclusão de dados fornecidos
            voluntariamente, e informações sobre o compartilhamento deles. Para exercer esses direitos, entre em
            contato pelo e-mail{" "}
            <a href="mailto:institutoindiceabc@gmail.com" style={{ color: BLUE, fontWeight: 600 }}>institutoindiceabc@gmail.com</a>.
          </p>

          <h3 style={sectionTitleStyle}>7. Segurança</h3>
          <p>
            Adotamos medidas técnicas para proteger seus dados, incluindo controle de acesso restrito,
            criptografia de dados sensíveis e infraestrutura com práticas de segurança reconhecidas no mercado.
          </p>

          <h3 style={sectionTitleStyle}>8. Alterações nesta política</h3>
          <p>
            Esta política pode ser atualizada periodicamente. A data da última atualização estará sempre
            indicada no topo desta página.
          </p>
        </div>

        <PageFooter />
      </div>
    </PublicLayout>
  );
}

// ---------- Survey dashboard (admin) ----------
function SurveyDashboard({ survey, session, onBack, onEdit, onDuplicated, onDeleted, onViewMap }) {
  const [responses, setResponses] = useState(null);
  const [surveyStatus, setSurveyStatus] = useState(survey.status || "ativa");
  const [statusSaving, setStatusSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(null);
  const [confirmingNotify, setConfirmingNotify] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifiedAt, setNotifiedAt] = useState(survey.notified_at || null);
  const [notifyResult, setNotifyResult] = useState("");
  const publicUrl = `${window.location.origin}${window.location.pathname}?s=${survey.id}`;
  const previewUrl = `${publicUrl}&preview=1`;

  useEffect(() => {
    (async () => {
      const { count } = await supabase.from("subscribers").select("id", { count: "exact", head: true });
      setSubscriberCount(count || 0);
    })();
  }, []);

  const notifySubscribers = async () => {
    setNotifying(true);
    setNotifyResult("");
    try {
      const res = await fetch("/api/notify-subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ surveyId: survey.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotifyResult(data.error || "Não foi possível notificar os inscritos.");
      } else {
        setNotifiedAt(new Date().toISOString());
        setNotifyResult(`E-mail enviado para ${data.sent} de ${data.total ?? data.sent} inscritos.`);
        setConfirmingNotify(false);
      }
    } catch {
      setNotifyResult("Erro de conexão. Tente novamente.");
    }
    setNotifying(false);
  };

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
      points: survey.points,
      city: survey.city,
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
          <Button variant="ghost" onClick={() => setConfirmingNotify(true)}>Notificar inscritos</Button>
          <Button variant="ghost" onClick={onViewMap}>Ver no mapa</Button>
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}><X size={14} /> Excluir</Button>
        </div>
      </div>

      {confirmingNotify && (
        <div style={{ background: "#FBF3E4", border: `1px solid ${GOLD_SOFT}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13.5, color: "#8A6416", marginBottom: 6 }}>
            Enviar e-mail sobre "{survey.title}" para {subscriberCount ?? "…"} inscritos?
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: "#8A6416", marginBottom: 12 }}>
            {notifiedAt ? `Essa pesquisa já foi notificada em ${new Date(notifiedAt).toLocaleString("pt-BR")}. Enviar de novo?` : "Cada inscrito recebe um e-mail individual, com o link da pesquisa."}
          </div>
          {notifyResult && (
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: INK, marginBottom: 10 }}>{notifyResult}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="gold" onClick={notifySubscribers} disabled={notifying || !subscriberCount}>{notifying ? <Loader2 size={14} className="spin" /> : null} Sim, enviar agora</Button>
            <Button variant="ghost" onClick={() => setConfirmingNotify(false)}>Fechar</Button>
          </div>
        </div>
      )}

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
function SurveyList({ onCreate, onOpen, onViewSubscribers, onViewRewards, onViewOverview, onViewPointsReport }) {
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={onViewOverview}>Visão Geral</Button>
          <Button variant="ghost" onClick={onViewPointsReport}>Relatório de Pontos</Button>
          <Button variant="ghost" onClick={onViewSubscribers}>Inscritos</Button>
          <Button variant="ghost" onClick={onViewRewards}>Recompensas</Button>
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

// ---------- Rewards catalog (admin) ----------
function RewardsAdmin({ onBack }) {
  const [rewards, setRewards] = useState(null);
  const [form, setForm] = useState(null); // null = fechado; {} = criando; {...} = editando
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("rewards").select("*").order("created_at", { ascending: false });
    setRewards(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const startCreate = () => setForm({ name: "", description: "", partner_name: "", points_cost: 50, quantity_available: "", active: true });
  const startEdit = (r) => setForm({ ...r, quantity_available: r.quantity_available ?? "" });

  const save = async () => {
    if (!form.name.trim() || !form.points_cost) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description?.trim() || null,
      partner_name: form.partner_name?.trim() || null,
      points_cost: Number(form.points_cost),
      quantity_available: form.quantity_available === "" ? null : Number(form.quantity_available),
      active: form.active !== false,
    };
    if (form.id) {
      await supabase.from("rewards").update(payload).eq("id", form.id);
    } else {
      await supabase.from("rewards").insert(payload);
    }
    setSaving(false);
    setForm(null);
    load();
  };

  const toggleActive = async (r) => {
    await supabase.from("rewards").update({ active: !r.active }).eq("id", r.id);
    load();
  };

  const remove = async (r) => {
    await supabase.from("rewards").delete().eq("id", r.id);
    load();
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 60px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ArrowLeft size={15} /> Todas as pesquisas
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, margin: 0 }}>Recompensas</h1>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT }}>Catálogo de vouchers trocáveis por pontos</div>
        </div>
        <Button variant="gold" onClick={startCreate}><Plus size={15} /> Nova recompensa</Button>
      </div>

      {form && (
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
          <Field label="Nome da recompensa">
            <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Voucher R$20 na Cafeteria X" />
          </Field>
          <Field label="Parceiro (opcional)">
            <input style={inputStyle} value={form.partner_name || ""} onChange={e => setForm({ ...form, partner_name: e.target.value })} />
          </Field>
          <Field label="Descrição (opcional)">
            <textarea style={{ ...inputStyle, minHeight: 50 }} value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Custo em pontos">
              <input style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }} type="number" min="1" value={form.points_cost} onChange={e => setForm({ ...form, points_cost: e.target.value })} />
            </Field>
            <Field label="Quantidade (vazio = sem limite)">
              <input style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }} type="number" min="0" value={form.quantity_available} onChange={e => setForm({ ...form, quantity_available: e.target.value })} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <Button variant="gold" onClick={save} disabled={saving || !form.name.trim()}>{saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Salvar</Button>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {rewards === null ? <Loader2 className="spin" size={18} color={BLUE_SOFT} /> : rewards.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", border: `1px dashed ${LINE}`, borderRadius: 12, color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5 }}>
          Nenhuma recompensa cadastrada ainda.
        </div>
      ) : rewards.map(r => (
        <div key={r.id} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, opacity: r.active ? 1 : 0.55 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 14, color: INK }}>{r.name}</div>
              {!r.active && <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 10.5, padding: "2px 7px", borderRadius: 10, background: "#F1EEE3", color: BLUE_SOFT }}>inativa</span>}
            </div>
            {r.partner_name && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: GOLD }}>{r.partner_name}</div>}
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: BLUE_SOFT, marginTop: 4 }}>
              {r.points_cost} pontos {r.quantity_available != null ? `· ${r.quantity_available} disponíveis` : "· sem limite"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <Button variant="ghost" onClick={() => startEdit(r)}>Editar</Button>
            <Button variant="ghost" onClick={() => toggleActive(r)}>{r.active ? "Desativar" : "Ativar"}</Button>
            <Button variant="danger" onClick={() => remove(r)}><X size={14} /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Overview panel (admin) ----------
function OverviewPanel({ onBack, onOpenSurvey }) {
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState([]);
  const [responseCounts, setResponseCounts] = useState({});
  const [totalResponses, setTotalResponses] = useState(0);
  const [responsesThisMonth, setResponsesThisMonth] = useState(0);
  const [subscriberCount, setSubscriberCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: surveysData }, { data: responsesData }, { count: subCount }] = await Promise.all([
        supabase.from("surveys").select("id, title, status, points, quotas, created_at").order("created_at", { ascending: false }),
        supabase.from("responses").select("survey_id, submitted_at"),
        supabase.from("subscribers").select("id", { count: "exact", head: true }),
      ]);

      const counts = {};
      let thisMonth = 0;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      (responsesData || []).forEach(r => {
        counts[r.survey_id] = (counts[r.survey_id] || 0) + 1;
        if (r.submitted_at && new Date(r.submitted_at) >= monthStart) thisMonth += 1;
      });

      setSurveys(surveysData || []);
      setResponseCounts(counts);
      setTotalResponses((responsesData || []).length);
      setResponsesThisMonth(thisMonth);
      setSubscriberCount(subCount || 0);
      setLoading(false);
    })();
  }, []);

  const mostActive = surveys.reduce((best, s) => {
    const c = responseCounts[s.id] || 0;
    return !best || c > (responseCounts[best.id] || 0) ? s : best;
  }, null);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 60px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ArrowLeft size={15} /> Todas as pesquisas
      </button>

      <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, marginBottom: 18 }}>Visão Geral</h1>

      {loading ? <Loader2 className="spin" size={18} color={BLUE_SOFT} /> : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            {[
              ["Pesquisas ativas", surveys.filter(s => s.status !== "encerrada").length],
              ["Respostas no total", totalResponses],
              ["Respostas este mês", responsesThisMonth],
              ["Inscritos", subscriberCount],
            ].map(([label, value]) => (
              <div key={label} style={{ flex: "1 1 130px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, color: BLUE, fontWeight: 600 }}>{value}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: BLUE_SOFT }}>{label}</div>
              </div>
            ))}
          </div>

          {mostActive && (
            <div style={{ background: "#FBF3E4", border: `1px solid ${GOLD_SOFT}`, borderRadius: 10, padding: 14, marginBottom: 24, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "#8A6416" }}>
              🏆 Pesquisa mais ativa: <strong>{mostActive.title}</strong> ({responseCounts[mostActive.id] || 0} respostas)
            </div>
          )}

          <div style={{ fontFamily: "'Newsreader', serif", fontSize: 17, color: INK, marginBottom: 10, fontStyle: "italic" }}>Todas as pesquisas</div>
          {surveys.length === 0 ? (
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT }}>Nenhuma pesquisa criada ainda.</div>
          ) : surveys.map(s => {
            const target = (s.quotas || []).reduce((sum, q) => sum + (q.target || 0), 0);
            const count = responseCounts[s.id] || 0;
            const pct = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0;
            return (
              <button key={s.id} onClick={() => onOpenSurvey(s)} style={{ display: "block", width: "100%", textAlign: "left", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 14, marginBottom: 8, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, fontWeight: 600, color: INK }}>
                  <span>{s.title}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: BLUE_SOFT, fontWeight: 400 }}>{count}/{target || "—"}</span>
                </div>
                <div style={{ height: 6, background: "#EDE8DA", borderRadius: 4, marginTop: 6 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "#3E7A52" : GOLD, borderRadius: 4 }} />
                </div>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}

// ---------- Points program report (admin) ----------
function PointsReport({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalRedeemed, setTotalRedeemed] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [popularRewards, setPopularRewards] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("points_transactions")
        .select("type, points, expires_at, reward_id, rewards(name)");

      const now = new Date();
      let earned = 0, redeemed = 0, activeEarned = 0;
      const rewardCounts = {};

      (data || []).forEach(tx => {
        if (tx.type === "earn") {
          earned += tx.points;
          if (!tx.expires_at || new Date(tx.expires_at) > now) activeEarned += tx.points;
        } else if (tx.type === "redeem") {
          redeemed += tx.points;
          const name = tx.rewards?.name || "Recompensa removida";
          rewardCounts[name] = (rewardCounts[name] || 0) + 1;
        }
      });

      setTotalEarned(earned);
      setTotalRedeemed(redeemed);
      setOutstanding(activeEarned - redeemed);
      setPopularRewards(Object.entries(rewardCounts).sort((a, b) => b[1] - a[1]));
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 60px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ArrowLeft size={15} /> Todas as pesquisas
      </button>

      <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, marginBottom: 18 }}>Relatório de Pontos</h1>

      {loading ? <Loader2 className="spin" size={18} color={BLUE_SOFT} /> : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            {[
              ["Total distribuído", totalEarned],
              ["Total resgatado", totalRedeemed],
              ["Saldo em aberto", outstanding],
            ].map(([label, value]) => (
              <div key={label} style={{ flex: "1 1 150px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, color: BLUE, fontWeight: 600 }}>{value}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: BLUE_SOFT }}>{label} pts</div>
              </div>
            ))}
          </div>

          <div style={{ fontFamily: "'Newsreader', serif", fontSize: 17, color: INK, marginBottom: 10, fontStyle: "italic" }}>Recompensas mais resgatadas</div>
          {popularRewards.length === 0 ? (
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT }}>Nenhum resgate registrado ainda.</div>
          ) : (
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
              {popularRewards.map(([name, count], i) => {
                const max = popularRewards[0][1];
                return (
                  <div key={name} style={{ padding: "12px 16px", borderTop: i > 0 ? `1px solid ${LINE}` : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: INK }}>
                      <span>{name}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: BLUE_SOFT }}>{count}x</span>
                    </div>
                    <div style={{ height: 6, background: "#EDE8DA", borderRadius: 4, marginTop: 6 }}>
                      <div style={{ height: "100%", width: `${(count / max) * 100}%`, background: GOLD, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Mapa de respostas por bairro (admin) ----------
let googleMapsLoadPromise = null;
function loadGoogleMapsScript() {
  if (googleMapsLoadPromise) return googleMapsLoadPromise;
  googleMapsLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Falha ao carregar o Google Maps"));
    document.head.appendChild(script);
  });
  return googleMapsLoadPromise;
}

function SurveyMapView({ survey, onBack }) {
  const mapRef = React.useRef(null);
  const mapInstance = React.useRef(null);
  const [responses, setResponses] = useState(null);
  const [questionId, setQuestionId] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [notFound, setNotFound] = useState(0);

  const candidateQuestions = (survey.questions || []).filter(q => q.type === "text" || q.type === "single");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("responses").select("answers").eq("survey_id", survey.id);
      setResponses(data || []);
    })();
    // Pré-seleciona automaticamente uma pergunta cujo texto contenha "bairro"
    const guess = (survey.questions || []).find(q => (q.text || "").toLowerCase().includes("bairro"));
    if (guess) setQuestionId(guess.id);
    else if (candidateQuestions[0]) setQuestionId(candidateQuestions[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey.id]);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setMapReady(true))
      .catch(() => setMapError("Não foi possível carregar o Google Maps. Confira se a chave de API está configurada."));
  }, []);

  const counts = {};
  if (responses && questionId) {
    responses.forEach(r => {
      const raw = (r.answers?.[questionId] || "").toString().trim();
      if (!raw) return;
      const key = normalizeText(raw);
      if (!key) return;
      if (!counts[key]) counts[key] = { label: raw, count: 0 };
      counts[key].count += 1;
    });
  }
  const sortedNeighborhoods = Object.values(counts).sort((a, b) => b.count - a.count);
  const maxCount = sortedNeighborhoods.length ? sortedNeighborhoods[0].count : 1;
  const surveyCity = survey.city || "São Caetano do Sul";

  // Desenha o mapa e os círculos por bairro sempre que os dados ou a pergunta mudam
  useEffect(() => {
    if (!mapReady || !mapRef.current || sortedNeighborhoods.length === 0) return;
    let cancelled = false;
    let notFoundCount = 0;

    (async () => {
      setGeocoding(true);
      const google = window.google;
      if (!mapInstance.current) {
        mapInstance.current = new google.maps.Map(mapRef.current, {
          center: { lat: -23.66, lng: -46.53 }, // centro aproximado do Grande ABC — o mapa ajusta o zoom sozinho depois
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
        });
      }
      const map = mapInstance.current;
      const geocoder = new google.maps.Geocoder();
      const bounds = new google.maps.LatLngBounds();

      for (const { label, count } of sortedNeighborhoods) {
        if (cancelled) return;
        try {
          const result = await new Promise((resolve, reject) => {
            geocoder.geocode({ address: `${label}, ${surveyCity}, SP, Brasil` }, (res, status) => {
              if (status === "OK" && res[0]) resolve(res[0]);
              else reject(status);
            });
          });
          const position = result.geometry.location;
          const radius = 60 + (count / maxCount) * 220;
          new google.maps.Circle({
            strokeColor: "#0F2E52",
            strokeOpacity: 0.7,
            strokeWeight: 1,
            fillColor: "#C79A45",
            fillOpacity: 0.45,
            map,
            center: position,
            radius,
          });
          new google.maps.Marker({
            position,
            map,
            label: { text: String(count), color: "#0F2E52", fontWeight: "700", fontSize: "12px" },
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0, },
          });
          bounds.extend(position);
        } catch {
          // Se o Google não conseguir localizar esse texto como bairro real
          // (erro de digitação, resposta em branco disfarçada, etc.), só pula.
          notFoundCount += 1;
        }
      }
      if (!cancelled && !bounds.isEmpty()) map.fitBounds(bounds);
      if (!cancelled) setNotFound(notFoundCount);
      setGeocoding(false);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, questionId, responses]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 60px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ArrowLeft size={15} /> Voltar
      </button>

      <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 25, color: INK, marginBottom: 4 }}>Mapa de respostas — {survey.title}</h1>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: GOLD, marginBottom: 16 }}>{surveyCity}</div>

      {candidateQuestions.length === 0 ? (
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: BLUE_SOFT, marginTop: 16 }}>
          Essa pesquisa não tem nenhuma pergunta de texto ou escolha única que possa representar um bairro.
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Field label="Qual pergunta representa o bairro?">
              <select
                value={questionId || ""}
                onChange={e => setQuestionId(e.target.value)}
                style={{ ...inputStyle, maxWidth: 380 }}
              >
                {candidateQuestions.map(q => <option key={q.id} value={q.id}>{q.text}</option>)}
              </select>
            </Field>
          </div>

          {mapError && (
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "#8A3B3B", background: "#FBF0EE", border: "1px solid #E3CBCB", borderRadius: 8, padding: 12, marginBottom: 16 }}>{mapError}</div>
          )}

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div ref={mapRef} style={{ flex: "2 1 420px", minHeight: 420, borderRadius: 10, border: `1px solid ${LINE}`, background: "#EDE8DA" }}>
              {!mapReady && !mapError && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 420, color: BLUE_SOFT }}><Loader2 className="spin" size={20} /></div>
              )}
            </div>

            <div style={{ flex: "1 1 220px" }}>
              <div style={{ fontFamily: "'Newsreader', serif", fontSize: 15, fontStyle: "italic", color: INK, marginBottom: 10 }}>
                Respostas por bairro {geocoding && <Loader2 className="spin" size={12} style={{ marginLeft: 6, verticalAlign: "middle" }} />}
              </div>
              {responses === null ? (
                <Loader2 className="spin" size={16} color={BLUE_SOFT} />
              ) : sortedNeighborhoods.length === 0 ? (
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT }}>Nenhuma resposta reconhecida como bairro ainda.</div>
              ) : (
                sortedNeighborhoods.map(({ label, count }) => (
                  <div key={label} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: INK }}>
                      <span>{label}</span><span style={{ fontFamily: "'IBM Plex Mono', monospace", color: BLUE_SOFT }}>{count}</span>
                    </div>
                    <div style={{ height: 6, background: "#EDE8DA", borderRadius: 4 }}>
                      <div style={{ height: "100%", width: `${(count / maxCount) * 100}%`, background: GOLD, borderRadius: 4 }} />
                    </div>
                  </div>
                ))
              )}
              {notFound > 0 && (
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: "#A79C7E", marginTop: 10 }}>
                  {notFound} resposta(s) que o Google não conseguiu localizar em {surveyCity} (erro de digitação, resposta fora do padrão, etc.) — continuam contadas na lista, só não aparecem no mapa.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- App ----------
export default function App() {
  const isPublic = !!getPublicSurveyId();
  const isPoints = isPointsPage();
  const isPrivacy = isPrivacyPage();
  const isAbout = isAboutPage();
  const isPartners = isPartnersPage();
  const isAdmin = isAdminPage();
  const [session, setSession] = useState(undefined); // undefined = carregando
  const [view, setView] = useState("list");
  const [activeSurvey, setActiveSurvey] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [isAdmin]);

  const globalStyle = (
    <style>{`
      ${FONT_IMPORT}
      * { box-sizing: border-box; }
      input:focus, textarea:focus, button:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 1px; }
      .spin { animation: spin 0.8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      body { margin: 0; }

      .pl-shell { display: block; }
      .pl-sidebar { display: none; }
      .pl-mobile-nav { display: block; }
      .pl-content { min-width: 0; }
      @media (min-width: 900px) {
        .pl-shell { display: flex; align-items: flex-start; }
        .pl-sidebar { display: flex; }
        .pl-mobile-nav { display: none; }
        .pl-content { flex: 1; }
      }

      .step-fade { animation: stepFadeIn 0.25s ease; }
      @keyframes stepFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
  );

  // Formulário público — sem login
  if (isPublic) {
    return <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif" }}>{globalStyle}<RespondSurvey /></div>;
  }

  // Página pública de troca de pontos — sem login
  if (isPoints) {
    return <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif" }}>{globalStyle}<PointsExchange /></div>;
  }

  // Política de Privacidade — sem login
  if (isPrivacy) {
    return <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif" }}>{globalStyle}<PrivacyPolicy /></div>;
  }

  // Sobre o instituto — sem login
  if (isAbout) {
    return <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif" }}>{globalStyle}<AboutPage /></div>;
  }

  // Nossos parceiros — sem login
  if (isPartners) {
    return <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif" }}>{globalStyle}<PartnersPage /></div>;
  }

  // Qualquer endereço que não seja uma rota conhecida nem o admin
  // cai na página inicial institucional — inclusive a raiz do site.
  if (!isAdmin) {
    return <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif" }}>{globalStyle}<HomePage /></div>;
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
      <HeaderBanner />
      <div style={{ borderBottom: `1px solid ${LINE}`, background: "#fff", padding: "8px 16px", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
        <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", cursor: "pointer", color: BLUE_SOFT, display: "flex", alignItems: "center", gap: 4, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5 }}>
          <LogOut size={14} /> Sair
        </button>
      </div>

      {view === "list" && <SurveyList onCreate={() => { setActiveSurvey(null); setView("create"); }} onOpen={(s) => { setActiveSurvey(s); setView("dashboard"); }} onViewSubscribers={() => setView("subscribers")} onViewRewards={() => setView("rewards")} onViewOverview={() => setView("overview")} onViewPointsReport={() => setView("pointsreport")} />}
      {view === "create" && <CreateSurvey userId={session.user.id} editingSurvey={activeSurvey} onCancel={() => setView(activeSurvey ? "dashboard" : "list")} onSave={(s) => { setActiveSurvey(s); setView("dashboard"); }} />}
      {view === "dashboard" && activeSurvey && (
        <SurveyDashboard
          survey={activeSurvey}
          session={session}
          onBack={() => setView("list")}
          onEdit={() => setView("create")}
          onDuplicated={(s) => { setActiveSurvey(s); setView("dashboard"); }}
          onDeleted={() => { setActiveSurvey(null); setView("list"); }}
          onViewMap={() => setView("map")}
        />
      )}
      {view === "subscribers" && <SubscribersView onBack={() => setView("list")} />}
      {view === "rewards" && <RewardsAdmin onBack={() => setView("list")} />}
      {view === "overview" && <OverviewPanel onBack={() => setView("list")} onOpenSurvey={(s) => { setActiveSurvey(s); setView("dashboard"); }} />}
      {view === "pointsreport" && <PointsReport onBack={() => setView("list")} />}
      {view === "map" && activeSurvey && <SurveyMapView survey={activeSurvey} onBack={() => setView("dashboard")} />}
    </div>
  );
}
