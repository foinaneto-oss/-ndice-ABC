import React, { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import { Plus, ArrowLeft, Users, BarChart3, Share2, X, Check, ClipboardList, TrendingUp, Loader2, LogOut, Download, ChevronUp, ChevronDown, Instagram, Facebook, Copy, Bell, QrCode } from "lucide-react";
import { supabase } from "./supabaseClient";

// ---------- design tokens ----------
const INK = "#12233A";
const BLUE = "#0F2E52";
const BLUE_SOFT = "#3B5975";
const GOLD = "#C79A45";
const GOLD_SOFT = "#E7D4A4";
const PAPER = "#F7F5EF";
const PAPER_DARK = "#EFEBE0";
const LINE = "#DCD6C6";
const LINE_SOFT = "#E8E3D6";
const NAVY_DARK = "#0A2140";
const RED = "#B8453D";
const MUTED = "#6B7A8C";

// Edite aqui os links das redes sociais do instituto
const INSTAGRAM_URL = "https://instagram.com/indiceabc";
const FACEBOOK_URL = "https://facebook.com/indiceabc";

// Troque pela sua chave do Google Maps (console.cloud.google.com, com a
// "Maps JavaScript API" ativada). Sem isso, o mapa de respostas não carrega.
const GOOGLE_MAPS_API_KEY = "AIzaSyDWn_nd7Ch0F3Yiugxm70Ud-2GrAzcMvVE";

// Chave pública das notificações push (gerada uma única vez pro projeto).
// A chave privada correspondente fica só no servidor (Vercel), nunca aqui.
const VAPID_PUBLIC_KEY = "BE9TIyQHEGIL4W5bYfzqqDO_bfSihPdh37l5Q8gRcAdhbSpyfZtJvzQxbxQuvtKrvCUU3gPmg8Y4vcN4eo7FRmo";

// As 7 cidades do Grande ABC Paulista — o instituto cobre a região inteira,
// não só São Caetano do Sul. Cada pesquisa escolhe a sua cidade, e o mapa
// de respostas usa isso pra geocodificar os bairros certos, sem precisar
// de nenhuma lista fixa de bairros no código (funciona pra qualquer cidade,
// inclusive as que ainda não temos pesquisa nenhuma).
const ABC_CITIES = [
  "Santo André", "São Bernardo do Campo", "São Caetano do Sul",
  "Diadema", "Mauá", "Ribeirão Pires", "Rio Grande da Serra",
];

// População de cada cidade (IBGE, Censo 2022) — usada no painel da Início
// e na página de Contas Públicas pra calcular receita por habitante.
const ABC_POPULATION = {
  "Santo André": 748919,
  "São Bernardo do Campo": 810729,
  "São Caetano do Sul": 165655,
  "Diadema": 393237,
  "Mauá": 418261,
  "Ribeirão Pires": 115559,
  "Rio Grande da Serra": 44170,
};

// Nome curto e posição de cada cidade no "mapa" em blocos da Início
// (grade de 5 colunas × 3 linhas, aproximando a geografia da região).
const ABC_MAP_TILES = {
  "Diadema": { short: "Diadema", area: "1 / 1 / 2 / 2" },
  "São Caetano do Sul": { short: "São Caetano", area: "1 / 2 / 2 / 3" },
  "Santo André": { short: "Santo André", area: "1 / 3 / 3 / 4" },
  "Mauá": { short: "Mauá", area: "1 / 4 / 2 / 5" },
  "São Bernardo do Campo": { short: "São Bernardo", area: "2 / 1 / 4 / 3" },
  "Ribeirão Pires": { short: "Ribeirão Pires", area: "2 / 4 / 3 / 5" },
  "Rio Grande da Serra": { short: "Rio Gde. da Serra", area: "2 / 5 / 4 / 6" },
};

// Os valores do TCE-SP "andam" entre uma atualização oficial e outra:
// projeta o ritmo médio (valor ÷ tempo desde o início do período) até agora.
function accountLiveValue(acc, field) {
  const base = Number(acc[field]);
  const periodStart = new Date(acc.period_start + "T00:00:00").getTime();
  const asOf = new Date(acc.as_of + "T00:00:00").getTime();
  const secondsElapsedAtBase = Math.max(1, (asOf - periodStart) / 1000);
  const ratePerSecond = base / secondsElapsedAtBase;
  const secondsSinceBase = (Date.now() - asOf) / 1000;
  return base + ratePerSecond * secondsSinceBase;
}

const fmtBRL = (v) => "R$ " + Math.round(Number(v) || 0).toLocaleString("pt-BR");
const fmtBi = (v) => "R$ " + (Number(v) / 1e9).toFixed(2).replace(".", ",") + " bi";
const fmtShort = (v) => Math.abs(v) >= 1e9 ? fmtBi(v) : "R$ " + Math.round(Number(v) / 1e6).toLocaleString("pt-BR") + " mi";
const fmtPct = (v) => (v * 100).toFixed(1).replace(".", ",") + "%";

function normalizeText(s) {
  return (s || "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// O navegador exige a chave pública VAPID nesse formato específico (array de bytes)
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Seu navegador não é compatível com notificações. No iPhone, primeiro adicione o site à Tela de Início.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificação não concedida.");
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const raw = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").insert({
    endpoint: raw.endpoint,
    p256dh: raw.keys.p256dh,
    auth: raw.keys.auth,
  });
  if (error && !String(error.message).includes("duplicate")) throw error;
}

const sectionTitleStyle = { fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 17, color: "#0F2E52", marginTop: 22, marginBottom: 6 };

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');`;

// Classes do layout público e do painel — ficam em CSS (e não inline)
// porque precisam de hover e de regras diferentes pra celular.
const LAYOUT_CSS = `
  .ix-wrap { max-width: 1280px; margin: 0 auto; padding-left: 32px; padding-right: 32px; }
  .ix-grid-bg { position: relative; overflow: hidden; }
  .ix-grid-bg::before { content: ""; position: absolute; inset: 0; pointer-events: none;
    background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
    background-size: 44px 44px; }
  .ix-grid-bg > * { position: relative; }
  .ix-nav a { font-family: 'IBM Plex Sans', sans-serif; font-size: 13.5px; font-weight: 500; color: #B7C6D8; padding: 13px 16px; border-bottom: 2px solid transparent; white-space: nowrap; text-decoration: none; }
  .ix-nav a:hover { color: #fff; }
  .ix-nav a.on { color: #fff; border-bottom-color: ${GOLD}; }
  .ix-footlink { color: #B7C6D8; text-decoration: none; }
  .ix-footlink:hover { color: #fff; }
  .ix-footcols { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 32px; }
  .ix-live-dot { width: 7px; height: 7px; border-radius: 50%; background: #58C48C; display: inline-block; animation: ixPulse 2s infinite; }
  @keyframes ixPulse { 0% { box-shadow: 0 0 0 0 rgba(88,196,140,.6); } 70% { box-shadow: 0 0 0 7px rgba(88,196,140,0); } 100% { box-shadow: 0 0 0 0 rgba(88,196,140,0); } }
  .ix-link { color: ${BLUE}; font-weight: 600; font-size: 13.5px; text-decoration: none; }
  .ix-link:hover { text-decoration: underline; text-underline-offset: 3px; }

  /* Início: faixa + painel */
  .ix-hero { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: end; }
  .ix-facts { grid-column: 1 / -1; display: flex; flex-wrap: wrap; border-top: 1px solid rgba(255,255,255,.14); }
  .ix-facts > div { flex: 1; min-width: 150px; padding: 14px 18px 0 0; }
  .ix-facts > div + div { padding-left: 18px; border-left: 1px solid rgba(255,255,255,.1); }
  .ix-panel > *, .ix-hero > *, .ix-city > *, .ix-two > *, .ix-three > * { min-width: 0; }
  .ix-panel { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 14px; margin-top: -50px; position: relative; }
  .ix-s4 { grid-column: span 4; } .ix-s5 { grid-column: span 5; } .ix-s6 { grid-column: span 6; } .ix-s7 { grid-column: span 7; }
  .ix-tile { background: #fff; border: 1px solid ${LINE}; border-radius: 14px; padding: 18px; }
  .ix-tile-top { box-shadow: 0 10px 30px rgba(15,46,82,.10); }
  .ix-tmap { display: grid; grid-template-columns: repeat(5, 1fr); grid-template-rows: repeat(3, 58px); gap: 6px; margin-top: 14px; }
  .ix-cell { border: 0; border-radius: 8px; padding: 8px 9px; font: 600 11px 'IBM Plex Sans', sans-serif; line-height: 1.2; text-align: left; display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; color: #fff; outline: 2px solid transparent; outline-offset: 1px; transition: transform .15s; }
  .ix-cell:hover, .ix-cell.on { outline-color: ${GOLD}; transform: scale(1.02); }
  .ix-cbar { display: grid; grid-template-columns: 118px 1fr 92px; gap: 10px; align-items: center; padding: 6px 0; width: 100%; background: none; border: 0; cursor: pointer; text-align: left; font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; color: ${INK}; }
  .ix-cbar:hover .ix-cbar-name, .ix-cbar.on .ix-cbar-name { color: ${GOLD}; font-weight: 600; }
  .ix-city { display: grid; grid-template-columns: 1.1fr 1fr 1fr; overflow: hidden; }
  .ix-city > div { padding: 24px; }
  .ix-city > div + div { border-left: 1px solid ${LINE_SOFT}; }
  .ix-two { display: grid; grid-template-columns: 1.35fr 1fr; gap: 20px; }
  .ix-sv { display: grid; grid-template-columns: 1fr 190px 90px; gap: 20px; align-items: center; padding: 18px 22px; border-top: 1px solid ${LINE_SOFT}; text-decoration: none; color: inherit; }
  .ix-sv:hover { background: #FBFAF6; }
  .ix-ixs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .ix-meth { display: grid; grid-template-columns: 1fr 1fr 1fr 1.1fr; overflow: hidden; }
  .ix-meth > div { padding: 22px; }
  .ix-meth > div + div { border-left: 1px solid ${LINE_SOFT}; }
  .ix-three { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 20px; }
  .ix-chip { font: 500 13px 'IBM Plex Sans', sans-serif; padding: 8px 14px; border-radius: 999px; border: 1px solid ${LINE}; background: #fff; color: ${BLUE_SOFT}; cursor: pointer; }
  .ix-chip.on { background: ${BLUE}; border-color: ${BLUE}; color: #fff; }
  .ix-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }

  /* Tabela de dados */
  .ix-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .ix-table th { text-align: right; font: 600 11px 'IBM Plex Sans', sans-serif; text-transform: uppercase; letter-spacing: .05em; color: ${BLUE_SOFT}; padding: 12px 16px; border-bottom: 1px solid ${LINE}; background: #FBFAF6; white-space: nowrap; }
  .ix-table th:first-child, .ix-table td:first-child { text-align: left; }
  .ix-table td { padding: 13px 16px; border-bottom: 1px solid ${LINE_SOFT}; text-align: right; font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: ${INK}; white-space: nowrap; }
  .ix-table td:first-child { font-family: 'IBM Plex Sans', sans-serif; font-weight: 600; font-size: 14px; }
  .ix-table tr:hover td { background: #FBFAF6; }
  .ix-table tr.total td { background: #FBFAF6; font-weight: 600; }

  /* Painel administrativo */
  .ix-adm { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
  .ix-aside { background: ${BLUE}; color: #B7C6D8; padding: 22px 14px; }
  .ix-aside-group { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: ${GOLD}; margin: 22px 10px 8px; }
  .ix-aside button { display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; padding: 8px 10px; border-radius: 8px; border: 0; background: none; color: #B7C6D8; font: 400 13.5px 'IBM Plex Sans', sans-serif; cursor: pointer; }
  .ix-aside button:hover { background: rgba(255,255,255,.06); color: #fff; }
  .ix-aside button.on { background: rgba(255,255,255,.1); color: #fff; font-weight: 600; }

  @media (max-width: 1080px) {
    .ix-hero { grid-template-columns: minmax(0, 1fr); gap: 24px; }
    .ix-ixs { grid-template-columns: 1fr 1fr; }
    .ix-kpis { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 860px) {
    .ix-wrap { padding-left: 18px; padding-right: 18px; }
    .ix-hide-sm { display: none !important; }
    .ix-logo svg { width: 48px; height: 48px; }
    .ix-logo div div:nth-child(2) { font-size: 16px !important; }
    .ix-panel { grid-template-columns: minmax(0, 1fr); }
    .ix-panel > * { grid-column: auto; }
    .ix-cbar { grid-template-columns: 96px minmax(0, 1fr) 80px; }
    .ix-city, .ix-two, .ix-meth, .ix-three { grid-template-columns: 1fr; }
    .ix-city > div + div, .ix-meth > div + div { border-left: 0; border-top: 1px solid ${LINE_SOFT}; }
    .ix-sv { grid-template-columns: 1fr auto; }
    .ix-sv > :nth-child(2) { display: none; }
    .ix-footcols { grid-template-columns: 1fr 1fr; }
    .ix-facts > div { min-width: 45%; border-left: 0 !important; padding-left: 0 !important; }
    .ix-adm { grid-template-columns: 1fr; }
    .ix-aside { padding: 12px; display: flex; gap: 4px; overflow-x: auto; }
    .ix-aside-group, .ix-aside .ix-aside-brand { display: none; }
    .ix-aside button { white-space: nowrap; width: auto; }
  }
  @media (max-width: 520px) {
    .ix-ixs, .ix-kpis { grid-template-columns: 1fr; }
    .ix-footcols { grid-template-columns: 1fr; }
  }
`;

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

function isResultsPage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("results") === "1";
}

function resultsPageUrl() {
  return `${window.location.origin}${window.location.pathname}?results=1`;
}

function resultsSurveyUrl(id) {
  return `${window.location.origin}${window.location.pathname}?results=1&survey=${id}`;
}

function isAccountsPage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("contas") === "1";
}

function accountsPageUrl() {
  return `${window.location.origin}${window.location.pathname}?contas=1`;
}

function isIndicesPage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("indices") === "1";
}

function indicesPageUrl() {
  return `${window.location.origin}${window.location.pathname}?indices=1`;
}

// Categorias fixas pra manter consistência ao filtrar os índices
const INDEX_CATEGORIES = ["Segurança", "Economia", "Educação", "Saúde", "Mobilidade", "Meio Ambiente", "Outro"];

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

// Símbolo do instituto (círculo + barras + linha de tendência), desenhado em SVG
// pra ficar nítido em qualquer tamanho. "color" é a cor do traço principal.
function LogoMark({ size = 56, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <circle cx="100" cy="100" r="88" fill="none" stroke={color} strokeWidth="7" />
      <rect x="63" y="105" width="18" height="40" rx="3" fill="#8FB8DE" />
      <rect x="91" y="85" width="18" height="60" rx="3" fill="#3E7CB1" />
      <rect x="119" y="63" width="18" height="82" rx="3" fill={color} />
      <line x1="72" y1="98" x2="100" y2="78" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <line x1="100" y1="78" x2="128" y2="56" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <circle cx="72" cy="98" r="4.5" fill={color} />
      <circle cx="100" cy="78" r="4.5" fill={color} />
      <circle cx="128" cy="56" r="6" fill={color} />
    </svg>
  );
}

// Logo completo: símbolo + "INSTITUTO / ÍNDICE E DESENVOLVIMENTO DO ABC" com o sublinhado azul.
function LogoLockup({ size = 64, textSize = 22 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <LogoMark size={size} />
      <div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: Math.round(textSize * 0.55), letterSpacing: "0.28em", color: "#C6D3E2" }}>INSTITUTO</div>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700, fontSize: textSize, lineHeight: 1.12, color: "#fff", letterSpacing: "0.01em" }}>
          ÍNDICE E DESENVOLVIMENTO<br />DO ABC
        </div>
        <div style={{ height: 3, background: "#3E7CB1", marginTop: 6, width: "92%" }} />
      </div>
    </div>
  );
}

// Qual item do menu está ativo, a partir da URL atual.
function currentNavKey() {
  const p = new URLSearchParams(window.location.search);
  if (p.get("about") === "1") return "about";
  if (p.get("results") === "1" || p.get("s")) return "results";
  if (p.get("contas") === "1") return "contas";
  if (p.get("indices") === "1") return "indices";
  if (p.get("partners") === "1") return "partners";
  if (p.get("privacy") === "1") return "privacy";
  if (p.get("points") === "1") return "points";
  return "home";
}

function useNotifications() {
  const [status, setStatus] = useState("idle"); // idle | asking | done | error
  const [error, setError] = useState("");
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") setStatus("done");
  }, []);
  const enable = async () => {
    setStatus("asking"); setError("");
    try {
      await subscribeToPush();
      setStatus("done");
    } catch (e) {
      setError(e.message || "Não foi possível ativar as notificações.");
      setStatus("error");
    }
  };
  return { status, error, enable };
}

function SiteHeader() {
  const active = currentNavKey();
  const notif = useNotifications();
  const [asOf, setAsOf] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("public_accounts").select("as_of").order("as_of", { ascending: false }).limit(1);
      if (data && data[0]) setAsOf(data[0].as_of);
    })();
  }, []);

  const links = [
    { key: "home", label: "Início", href: homePageUrl() },
    { key: "about", label: "Sobre", href: aboutPageUrl() },
    { key: "results", label: "Pesquisas", href: resultsPageUrl() },
    { key: "contas", label: "Contas Públicas", href: accountsPageUrl() },
    { key: "indices", label: "Índices", href: indicesPageUrl() },
    { key: "partners", label: "Parceiros", href: partnersPageUrl() },
    { key: "privacy", label: "Política de Privacidade", href: privacyPageUrl() },
  ];

  return (
    <header>
      <div style={{ background: BLUE, color: "#fff" }}>
        <div className="ix-wrap" style={{ display: "flex", alignItems: "center", gap: 24, paddingTop: 18, paddingBottom: 18 }}>
          <a href={homePageUrl()} style={{ textDecoration: "none" }} className="ix-logo">
            <LogoLockup />
          </a>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 22 }}>
            {asOf && (
              <span className="ix-hide-sm" style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: "#C6D3E2" }}>
                <span className="ix-live-dot" /> Dados atualizados · TCE-SP {new Date(asOf + "T00:00:00").toLocaleDateString("pt-BR")}
              </span>
            )}
            {notif.status === "done" ? (
              <span className="ix-hide-sm" style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: GOLD_SOFT, display: "flex", alignItems: "center", gap: 6 }}><Check size={14} /> Notificações ativas</span>
            ) : (
              <Button variant="gold" onClick={notif.enable} disabled={notif.status === "asking"} style={{ padding: "8px 14px", fontSize: 13 }}>
                {notif.status === "asking" ? <Loader2 size={14} className="spin" /> : <Bell size={14} />}
                <span className="ix-hide-sm">Ativar notificações</span>
              </Button>
            )}
          </div>
        </div>
        {notif.error && (
          <div className="ix-wrap" style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#F0A49D", paddingBottom: 10, textAlign: "right" }}>{notif.error}</div>
        )}
      </div>
      <nav className="ix-nav" style={{ background: NAVY_DARK, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="ix-wrap" style={{ display: "flex", alignItems: "center", overflowX: "auto" }}>
          {links.map((l, i) => (
            <a key={l.key} href={l.href} className={active === l.key ? "on" : ""} style={i === 0 ? { paddingLeft: 0 } : undefined}>{l.label}</a>
          ))}
          <a href={pointsPageUrl()} className={active === "points" ? "on" : ""} style={{ marginLeft: "auto", color: GOLD_SOFT }}>★ Troque seus pontos</a>
        </div>
      </nav>
    </header>
  );
}

function SiteFooter() {
  const col = (title, items) => (
    <div>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: "#fff", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>{title}</div>
      {items.map(([label, href, style]) => (
        <a key={label} href={href} className="ix-footlink" style={{ display: "block", marginBottom: 8, ...style }}>{label}</a>
      ))}
    </div>
  );
  return (
    <footer style={{ background: NAVY_DARK, color: "#B7C6D8", marginTop: 64, padding: "44px 0 90px", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5 }}>
      <div className="ix-wrap">
        <div className="ix-footcols">
          <div>
            <LogoLockup size={48} textSize={16} />
            <p style={{ marginTop: 14, lineHeight: 1.6 }}>
              <a href="mailto:institutoindiceabc@gmail.com" className="ix-footlink">institutoindiceabc@gmail.com</a><br />
              Santo André/SP — Grande ABC Paulista
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram" style={{ width: 32, height: 32, borderRadius: "50%", background: "#16395F", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Instagram size={15} /></a>
              <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" aria-label="Facebook" style={{ width: 32, height: 32, borderRadius: "50%", background: "#16395F", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Facebook size={15} /></a>
            </div>
          </div>
          {col("Dados", [["Pesquisas", resultsPageUrl()], ["Contas Públicas", accountsPageUrl()], ["Índices", indicesPageUrl()]])}
          {col("Instituto", [["Início", homePageUrl()], ["Sobre", aboutPageUrl()], ["Parceiros", partnersPageUrl()], ["Política de Privacidade", privacyPageUrl()]])}
          {col("Participe", [["Troque seus pontos", pointsPageUrl()], ["Fale conosco", "mailto:institutoindiceabc@gmail.com"], ["Área administrativa", adminUrl(), { opacity: 0.6 }]])}
        </div>
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7F93AB", flexWrap: "wrap", gap: 10 }}>
          <span>© {new Date().getFullYear()} Instituto Índice e Desenvolvimento do ABC</span>
          <span>Fontes: TCE-SP · IBGE Censo 2022</span>
        </div>
      </div>
    </footer>
  );
}

// O rodapé agora é desenhado uma vez só pelo PublicLayout (SiteFooter).
// Mantido vazio porque as páginas ainda o chamam no fim do conteúdo.
function PageFooter() {
  return null;
}

// Ticker fixo no rodapé com as contas públicas do Grande ABC — aparece em
// toda página pública, buscando os dados uma vez e "andando" visualmente
// entre uma atualização oficial e outra (mesma lógica do Impostômetro).
function FixedAccountsTicker() {
  const [accounts, setAccounts] = useState(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("public_accounts").select("*").order("receita", { ascending: false });
      setAccounts(data || []);
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => forceTick(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!accounts || accounts.length === 0) return null;

  const items = accounts.map(a => (
    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 20px", borderRight: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap" }}>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 11, color: GOLD_SOFT, textTransform: "uppercase", letterSpacing: "0.03em" }}>{a.city}</div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 8.5, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Receita</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: "#fff", fontWeight: 600 }}>{fmtBRL(accountLiveValue(a, "receita"))}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 8.5, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Despesa</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: "#fff", fontWeight: 600 }}>{fmtBRL(accountLiveValue(a, "despesa"))}</span>
      </div>
    </div>
  ));

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, background: BLUE, display: "flex", alignItems: "stretch", boxShadow: "0 -2px 10px rgba(0,0,0,0.15)" }}>
      <a href={accountsPageUrl()} style={{ flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "10px 14px", background: NAVY_DARK, borderRight: "1px solid rgba(255,255,255,0.12)", textDecoration: "none" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: GOLD, letterSpacing: "0.04em" }}>GRANDE ABC</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 11, color: "#fff" }}>Contas Públicas</div>
      </a>
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div className="ticker-track" style={{ display: "flex", width: "max-content" }}>
          {items}{items}
        </div>
      </div>
    </div>
  );
}

function PublicLayout({ children }) {
  return (
    <div>
      <SiteHeader />
      <main style={{ minHeight: "50vh" }}>{children}</main>
      <SiteFooter />
      <FixedAccountsTicker />
    </div>
  );
}

// Faixa azul-marinho (com a grade sutil) que abre cada página pública.
function PageBand({ children }) {
  return (
    <div className="ix-grid-bg" style={{ background: BLUE, padding: "40px 0 44px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px", position: "relative" }}>
        {children}
      </div>
    </div>
  );
}

// Cabeçalho simples (só o logo) — usado no login do painel.
function HeaderBanner() {
  return (
    <div style={{ background: BLUE }}>
      <div className="ix-wrap" style={{ paddingTop: 18, paddingBottom: 18 }}>
        <a href={homePageUrl()} style={{ textDecoration: "none", display: "inline-block" }}><LogoLockup /></a>
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
  const [highlightStat, setHighlightStat] = useState(editingSurvey?.highlight_stat || "");
  const [highlightLabel, setHighlightLabel] = useState(editingSurvey?.highlight_label || "");
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
      highlight_stat: highlightStat.trim() || null,
      highlight_label: highlightLabel.trim() || null,
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

      <Field label="Destaque na Início (opcional)">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input style={{ ...inputStyle, width: 100, fontFamily: "'IBM Plex Mono', monospace" }} placeholder="Ex: 68%" value={highlightStat} onChange={e => setHighlightStat(e.target.value)} />
          <input style={{ ...inputStyle, flex: 1, minWidth: 220 }} placeholder="Ex: dos jovens usam Instagram diariamente" value={highlightLabel} onChange={e => setHighlightLabel(e.target.value)} />
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: BLUE_SOFT, marginTop: 4 }}>
          Só aparece na Início depois que essa pesquisa for publicada. Preencha com o achado mais interessante.
        </div>
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
  const [claimStep, setClaimStep] = useState("email"); // email | newUser | done
  const [claimEmail, setClaimEmail] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [existingName, setExistingName] = useState(null);
  const [newUserData, setNewUserData] = useState({ name: "", ddd: "", phone: "", city: "" });
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimResult, setClaimResult] = useState(null); // { surveyPoints, bonus, totalPoints, isNew }
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
            {claimStep === "done" ? (
              <div style={{ textAlign: "center", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: "#3E7A52" }}>
                <Check size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
                {claimResult?.bonus > 0
                  ? <>+{claimResult.totalPoints} pontos ({claimResult.bonus} de boas-vindas + {claimResult.surveyPoints} desta pesquisa)!</>
                  : <>+{claimResult?.totalPoints} pontos creditados!</>
                }{" "}
                Acesse <a href={pointsPageUrl()} style={{ color: "#3E7A52", textDecoration: "underline", fontWeight: 600 }}>Troque seus pontos</a> pra ver seu saldo.
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "'Newsreader', serif", fontSize: 15, color: INK, marginBottom: 4, textAlign: "center" }}>
                  Cadastre-se e acumule pontos
                </div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: BLUE_SOFT, marginBottom: 12, textAlign: "center" }}>
                  Ganhe {survey.points || 5} pontos por essa pesquisa, trocáveis por vouchers e descontos.
                  {claimStep === "email" && " Novo por aqui? Ganhe +5 pontos de boas-vindas."}
                </div>

                {claimStep === "email" && (
                  <div>
                    <input style={{ ...inputStyle, marginBottom: 10 }} type="email" placeholder="Já é cadastrado? Coloque seu e-mail" value={claimEmail} onChange={e => setClaimEmail(e.target.value)} />
                    {claimError && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#8A3B3B", marginBottom: 8 }}>{claimError}</div>}
                    <Button variant="gold" style={{ width: "100%", justifyContent: "center" }} disabled={checkingEmail || !claimEmail.trim() || !responseId}
                      onClick={async () => {
                        setCheckingEmail(true); setClaimError("");
                        try {
                          const res = await fetch("/api/check-subscriber", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: claimEmail.trim() }),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            setClaimError(data.error || "Não foi possível conferir o e-mail.");
                          } else if (data.exists) {
                            setExistingName(data.name);
                            setClaimStep("existing");
                          } else {
                            setClaimStep("newUser");
                          }
                        } catch {
                          setClaimError("Erro de conexão. Tente novamente.");
                        }
                        setCheckingEmail(false);
                      }}>
                      {checkingEmail ? <Loader2 size={15} className="spin" /> : "Continuar"}
                    </Button>
                  </div>
                )}

                {claimStep === "existing" && (
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: INK, marginBottom: 10, textAlign: "center" }}>
                      Bem-vindo de volta{existingName ? `, ${existingName}` : ""}!
                    </div>
                    {claimError && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#8A3B3B", marginBottom: 8 }}>{claimError}</div>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button variant="gold" style={{ flex: 1, justifyContent: "center" }} disabled={claimSubmitting}
                        onClick={async () => {
                          setClaimSubmitting(true); setClaimError("");
                          try {
                            const res = await fetch("/api/earn-points", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ surveyId: survey.id, responseId, email: claimEmail.trim() }),
                            });
                            const data = await res.json();
                            if (!res.ok) setClaimError(data.error || "Não foi possível creditar os pontos.");
                            else { setClaimResult(data); setClaimStep("done"); }
                          } catch {
                            setClaimError("Erro de conexão. Tente novamente.");
                          }
                          setClaimSubmitting(false);
                        }}>
                        {claimSubmitting ? <Loader2 size={15} className="spin" /> : "Confirmar e ganhar pontos"}
                      </Button>
                      <Button variant="ghost" onClick={() => { setClaimStep("email"); setClaimError(""); }}>Trocar e-mail</Button>
                    </div>
                  </div>
                )}

                {claimStep === "newUser" && (
                  <div>
                    <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Nome" value={newUserData.name} onChange={e => setNewUserData(d => ({ ...d, name: e.target.value }))} />
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input style={{ ...inputStyle, width: 60 }} placeholder="DDD" maxLength={2} value={newUserData.ddd} onChange={e => setNewUserData(d => ({ ...d, ddd: e.target.value.replace(/\D/g, "") }))} />
                      <input style={{ ...inputStyle, flex: 1 }} placeholder="Telefone" value={newUserData.phone} onChange={e => setNewUserData(d => ({ ...d, phone: e.target.value }))} />
                    </div>
                    <input style={{ ...inputStyle, marginBottom: 12 }} placeholder="Cidade" value={newUserData.city} onChange={e => setNewUserData(d => ({ ...d, city: e.target.value }))} />
                    {claimError && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "#8A3B3B", marginBottom: 8 }}>{claimError}</div>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button variant="gold" style={{ flex: 1, justifyContent: "center" }}
                        disabled={claimSubmitting || !newUserData.name.trim() || !newUserData.ddd.trim() || !newUserData.phone.trim() || !newUserData.city.trim()}
                        onClick={async () => {
                          setClaimSubmitting(true); setClaimError("");
                          try {
                            const res = await fetch("/api/earn-points", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ surveyId: survey.id, responseId, email: claimEmail.trim(), ...newUserData }),
                            });
                            const data = await res.json();
                            if (!res.ok) setClaimError(data.error || "Não foi possível concluir o cadastro.");
                            else { setClaimResult(data); setClaimStep("done"); }
                          } catch {
                            setClaimError("Erro de conexão. Tente novamente.");
                          }
                          setClaimSubmitting(false);
                        }}>
                        {claimSubmitting ? <Loader2 size={15} className="spin" /> : "Cadastrar e ganhar pontos"}
                      </Button>
                      <Button variant="ghost" onClick={() => { setClaimStep("email"); setClaimError(""); }}>Voltar</Button>
                    </div>
                  </div>
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
  const [totalResponses, setTotalResponses] = useState(null);
  const [activeSurveys, setActiveSurveys] = useState(null);
  const [surveyCounts, setSurveyCounts] = useState({});
  const [upcoming, setUpcoming] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [exampleReward, setExampleReward] = useState(null);
  const [surveysByCity, setSurveysByCity] = useState({});
  const [activeCount, setActiveCount] = useState(null);
  const [publishedByCity, setPublishedByCity] = useState({});
  const [accounts, setAccounts] = useState(null);
  const [indices, setIndices] = useState([]);
  const [indicesByCity, setIndicesByCity] = useState({});
  const [selectedCity, setSelectedCity] = useState("São Caetano do Sul");
  const [openFaq, setOpenFaq] = useState(0);
  const [, forceTick] = useState(0);
  const notif = useNotifications();

  useEffect(() => {
    (async () => {
      const [
        { count: respCount },
        { data: activeData },
        { data: upcomingData },
        { data: highlightData },
        { data: rewardData },
        { data: allSurveys },
        { data: accountsData },
        { data: indicesData },
      ] = await Promise.all([
        supabase.from("responses").select("id", { count: "exact", head: true }),
        supabase.from("surveys").select("id, title, city, points, quotas, questions").eq("status", "ativa").order("created_at", { ascending: false }).limit(4),
        supabase.from("upcoming_surveys").select("*").order("created_at", { ascending: false }).limit(2),
        supabase.from("surveys").select("id, title, highlight_stat, highlight_label").eq("published", true).not("highlight_stat", "is", null).order("created_at", { ascending: false }).limit(1),
        supabase.from("rewards").select("name, partner_name, points_cost").eq("active", true).order("points_cost", { ascending: true }).limit(1),
        supabase.from("surveys").select("city, status, published"),
        supabase.from("public_accounts").select("*").order("receita", { ascending: false }),
        supabase.from("indices").select("*").order("created_at", { ascending: false }),
      ]);
      setTotalResponses(respCount || 0);
      setActiveSurveys(activeData || []);
      setUpcoming(upcomingData || []);
      setHighlight(highlightData && highlightData[0] ? highlightData[0] : null);
      setExampleReward(rewardData && rewardData[0] ? rewardData[0] : null);
      const inField = {}, published = {};
      (allSurveys || []).forEach(s => {
        if (s.status === "ativa") inField[s.city] = (inField[s.city] || 0) + 1;
        if (s.published) published[s.city] = (published[s.city] || 0) + 1;
      });
      setSurveysByCity(inField);
      setActiveCount((allSurveys || []).filter(x => x.status === "ativa").length);
      setPublishedByCity(published);
      setAccounts(accountsData || []);
      setIndices((indicesData || []).slice(0, 4));
      const idxCity = {};
      (indicesData || []).forEach(i => { idxCity[i.city] = (idxCity[i.city] || 0) + 1; });
      setIndicesByCity(idxCity);

      // Quantas respostas cada pesquisa aberta já tem, pra barra de cotas
      const counts = {};
      await Promise.all((activeData || []).map(async s => {
        const { data } = await supabase.rpc("get_quota_counts", { p_survey_id: s.id });
        counts[s.id] = (data || []).reduce((sum, r) => sum + Number(r.response_count), 0);
      }));
      setSurveyCounts(counts);
    })();
  }, []);

  // Faz os números "ao vivo" andarem a cada segundo
  useEffect(() => {
    const interval = setInterval(() => forceTick(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const FAQ = [
    { q: "Minhas respostas são anônimas?", a: "Sim. Não pedimos nome nem e-mail para responder — só se você quiser participar do programa de pontos depois." },
    { q: "Como funcionam os pontos?", a: "Cada pesquisa vale alguns pontos. Você troca por vouchers e descontos de comércios parceiros do Grande ABC." },
    { q: "Quem pode responder?", a: "Qualquer morador do Grande ABC. Cada pesquisa tem cotas por idade, sexo e cidade, definidas pelo Censo IBGE." },
    { q: "Como sei que os dados são confiáveis?", a: "Seguimos amostragem estatística real, com coleta em dobro e exclusão de respostas suspeitas antes de qualquer publicação." },
  ];

  // ---- números derivados das contas públicas ----
  const acc = accounts || [];
  const rows = acc.map(a => {
    const receita = Number(a.receita), despesa = Number(a.despesa);
    const pop = ABC_POPULATION[a.city] || null;
    return { ...a, receita, despesa, pop, gap: receita > 0 ? (despesa - receita) / receita : 0, perCapita: pop ? receita / pop : null };
  });
  const totalReceita = rows.reduce((s, r) => s + r.receita, 0);
  const totalDespesa = rows.reduce((s, r) => s + r.despesa, 0);
  const liveReceita = acc.reduce((s, a) => s + accountLiveValue(a, "receita"), 0);
  const liveDespesa = acc.reduce((s, a) => s + accountLiveValue(a, "despesa"), 0);
  const totalPop = Object.values(ABC_POPULATION).reduce((s, n) => s + n, 0);
  const avgPerCapita = totalPop ? totalReceita / totalPop : 0;
  const maxDespesa = Math.max(1, ...rows.map(r => r.despesa));
  const gaps = rows.map(r => r.gap);
  const gapMin = Math.min(...gaps), gapMax = Math.max(...gaps);
  const regionGap = totalReceita > 0 ? (totalDespesa - totalReceita) / totalReceita : 0;
  const ranking = rows.filter(r => r.perCapita).sort((a, b) => b.perCapita - a.perCapita);
  const maxPerCapita = ranking.length ? ranking[0].perCapita : 1;
  const mostRecentAsOf = acc.reduce((m, a) => (!m || a.as_of > m ? a.as_of : m), null);

  // Cor do "mapa": azul (despesa pouco acima da receita) → vermelho (muito acima)
  const tileColor = (gap) => {
    const t = gapMax > gapMin ? (gap - gapMin) / (gapMax - gapMin) : 0.5;
    const mix = (a, b, k) => a.map((x, i) => Math.round(x + (b[i] - x) * k));
    const c = t < 0.5 ? mix([62, 94, 134], [156, 90, 90], t * 2) : mix([156, 90, 90], [216, 115, 106], (t - 0.5) * 2);
    return `rgb(${c.join(",")})`;
  };

  const city = rows.find(r => r.city === selectedCity);
  const cityRank = city ? ranking.findIndex(r => r.city === city.city) + 1 : 0;

  const kick = (text, color = GOLD) => (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color }}>{text}</div>
  );
  const tileHead = (title, tag) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, fontWeight: 600, color: BLUE_SOFT }}>
      <span>{title}</span>
      {tag && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: GOLD, letterSpacing: "0.04em", fontWeight: 500 }}>{tag}</span>}
    </div>
  );
  const sectionHead = (kicker, title, right) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, marginBottom: 22, flexWrap: "wrap" }}>
      <div>
        {kick(kicker)}
        <h2 style={{ fontFamily: "'Newsreader', serif", fontWeight: 500, fontSize: 32, color: INK, margin: "6px 0 0", letterSpacing: "-0.01em" }}>{title}</h2>
      </div>
      {right}
    </div>
  );
  const spark = (color, points) => (
    <svg viewBox="0 0 200 34" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 34, marginTop: 12 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
  const kv = (label, value, color) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderBottom: `1px dashed ${LINE_SOFT}`, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: BLUE_SOFT }}>
      {label}<b style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500, color: color || INK, fontSize: 14.5 }}>{value}</b>
    </div>
  );
  const bigNumber = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 21, fontWeight: 500, color: BLUE, marginTop: 10, whiteSpace: "nowrap", letterSpacing: "-0.02em" };
  const small = { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: MUTED, marginTop: 4 };

  return (
    <PublicLayout>
      <PageMeta title="Início" description="Instituto Índice e Desenvolvimento do ABC — pesquisas, contas públicas e índices estatisticamente rigorosos sobre o Grande ABC Paulista." />

      {/* ---------- faixa de abertura ---------- */}
      <div className="ix-grid-bg" style={{ background: BLUE, color: "#fff", padding: "40px 0 86px" }}>
        <div className="ix-wrap ix-hero">
          <div>
            {kick("Painel do Grande ABC")}
            <h1 style={{ fontFamily: "'Newsreader', serif", fontWeight: 500, fontSize: 42, lineHeight: 1.04, letterSpacing: "-0.015em", margin: "14px 0 16px" }}>
              O Grande ABC <em style={{ color: GOLD_SOFT }}>em números</em>.
            </h1>
            <p style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 17, lineHeight: 1.55, color: GOLD_SOFT, maxWidth: "54ch", margin: 0 }}>
              Gerar conhecimento estatisticamente rigoroso sobre a realidade do Grande ABC, para orientar decisões públicas, privadas e comunitárias com dados confiáveis.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={resultsPageUrl()} style={{ textDecoration: "none" }}><Button variant="gold" style={{ padding: "12px 18px", fontSize: 14 }}>Participar de uma pesquisa →</Button></a>
            <a href={accountsPageUrl()} style={{ textDecoration: "none" }}><Button variant="ghost" style={{ padding: "12px 18px", fontSize: 14, color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>Explorar contas públicas</Button></a>
          </div>
          <div className="ix-facts">
            {[
              ["7", "Municípios cobertos"],
              [(totalPop / 1e6).toFixed(2).replace(".", ",") + " mi", "População da região"],
              [activeCount === null ? "…" : activeCount, "Pesquisas em campo"],
              [totalResponses === null ? "…" : totalResponses.toLocaleString("pt-BR"), "Respostas coletadas"],
              [activeSurveys && activeSurveys[0] ? (activeSurveys[0].points || 5) : 5, "Pontos por pesquisa"],
            ].map(([v, l]) => (
              <div key={l}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, color: GOLD_SOFT }}>{v}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "#B7C6D8" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- painel de dados ---------- */}
      <div className="ix-wrap">
        {accounts === null ? (
          <div className="ix-panel"><div className="ix-tile ix-tile-top" style={{ gridColumn: "span 12", textAlign: "center", padding: 40 }}><Loader2 className="spin" size={20} color={BLUE_SOFT} /></div></div>
        ) : (
          <div className="ix-panel">
            <div className="ix-tile ix-tile-top ix-s4">
              {tileHead("Receita do Grande ABC", "AO VIVO")}
              <div style={bigNumber}>{fmtBRL(liveReceita)}</div>
              <div style={small}>projeção a partir do TCE-SP</div>
              {spark(BLUE, "0,30 30,27 60,25 90,20 120,17 150,12 200,4")}
            </div>
            <div className="ix-tile ix-tile-top ix-s4">
              {tileHead("Despesa do Grande ABC", "AO VIVO")}
              <div style={bigNumber}>{fmtBRL(liveDespesa)}</div>
              <div style={small}>projeção a partir do TCE-SP</div>
              {spark(GOLD, "0,31 30,27 60,23 90,19 120,14 150,9 200,2")}
            </div>
            <div className="ix-tile ix-tile-top ix-s4">
              {tileHead("Diferença", "DESPESA − RECEITA")}
              <div style={{ ...bigNumber, color: liveDespesa > liveReceita ? RED : "#2F7A55" }}>{liveDespesa > liveReceita ? "−" : "+"}{fmtBRL(Math.abs(liveDespesa - liveReceita))}</div>
              <div style={small}>despesa {fmtPct(Math.abs(regionGap))} {regionGap >= 0 ? "acima" : "abaixo"} da receita</div>
              {spark(RED, "0,20 30,21 60,22 90,23 120,24 150,26 200,28")}
            </div>

            <div className="ix-tile ix-s5">
              {tileHead("Mapa do Grande ABC", "DESPESA ACIMA DA RECEITA")}
              <div className="ix-tmap">
                {rows.filter(r => ABC_MAP_TILES[r.city]).map(r => (
                  <button key={r.city} className={`ix-cell ${selectedCity === r.city ? "on" : ""}`} onClick={() => setSelectedCity(r.city)}
                    style={{ gridArea: ABC_MAP_TILES[r.city].area, background: tileColor(r.gap) }}>
                    <span>{ABC_MAP_TILES[r.city].short}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 400, opacity: 0.9 }}>{r.gap >= 0 ? "+" : ""}{fmtPct(r.gap)}</span>
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: MUTED }}>
                menor <span style={{ flex: 1, maxWidth: 160, height: 6, borderRadius: 3, background: "linear-gradient(90deg, #3E5E86, #9C5A5A, #D8736A)" }} /> maior · clique numa cidade
              </div>
            </div>

            <div className="ix-tile ix-s7">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {tileHead("Receita × despesa por município")}
                <span style={{ display: "flex", gap: 14, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: MUTED }}>
                  <span><i style={{ display: "inline-block", width: 10, height: 4, borderRadius: 2, background: BLUE, marginRight: 5, verticalAlign: 2 }} />Receita</span>
                  <span><i style={{ display: "inline-block", width: 10, height: 4, borderRadius: 2, background: GOLD, marginRight: 5, verticalAlign: 2 }} />Despesa</span>
                </span>
              </div>
              <div style={{ marginTop: 10 }}>
                {rows.map(r => (
                  <button key={r.city} className={`ix-cbar ${selectedCity === r.city ? "on" : ""}`} onClick={() => setSelectedCity(r.city)}>
                    <span className="ix-cbar-name" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ABC_MAP_TILES[r.city]?.short || r.city}</span>
                    <span style={{ position: "relative", height: 16 }}>
                      <i style={{ position: "absolute", left: 0, top: 1, height: 6, borderRadius: 3, background: BLUE, width: `${(r.receita / maxDespesa) * 100}%` }} />
                      <i style={{ position: "absolute", left: 0, top: 9, height: 6, borderRadius: 3, background: GOLD, width: `${(r.despesa / maxDespesa) * 100}%` }} />
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, textAlign: "right", whiteSpace: "nowrap", color: r.despesa > r.receita ? RED : "#2F7A55" }}>
                      {r.despesa > r.receita ? "−" : "+"}{fmtShort(Math.abs(r.despesa - r.receita))}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ix-tile ix-s6">
              {tileHead("Receita por habitante", "R$ / HAB.")}
              <div style={{ marginTop: 8 }}>
                {ranking.map((r, i) => (
                  <div key={r.city} style={{ display: "grid", gridTemplateColumns: "18px 1fr auto", gap: 10, alignItems: "center", padding: "7px 0", borderBottom: i === ranking.length - 1 ? "none" : `1px solid ${LINE_SOFT}`, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5 }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: MUTED }}>{i + 1}</span>
                    <span>
                      {ABC_MAP_TILES[r.city]?.short || r.city}
                      <div style={{ height: 3, background: PAPER_DARK, borderRadius: 2, marginTop: 4 }}>
                        <div style={{ height: "100%", width: `${(r.perCapita / maxPerCapita) * 100}%`, background: i === 0 ? GOLD : "#3E7CB1", borderRadius: 2 }} />
                      </div>
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{fmtBRL(r.perCapita)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ix-tile ix-s6" style={{ display: "flex", flexDirection: "column" }}>
              {tileHead("Pesquisas em campo", "AGORA")}
              <div style={{ marginTop: 6 }}>
                {(activeSurveys || []).length === 0 && (
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: MUTED, padding: "14px 0" }}>Nenhuma pesquisa aberta no momento.</div>
                )}
                {(activeSurveys || []).map(s => (
                  <a key={s.id} href={surveyPublicUrl(s.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${LINE_SOFT}`, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: INK, textDecoration: "none" }}>
                    <span><b style={{ fontWeight: 600 }}>{s.title}</b><span style={{ color: MUTED, fontSize: 12 }}> · {s.city}</span></span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: "#8A6412", background: "#FBF3E2", border: "1px solid #F0E0BA", padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>+{s.points || 5} pts</span>
                  </a>
                ))}
              </div>
              {(activeSurveys || []).length > 0 && (
                <a href={surveyPublicUrl(activeSurveys[0].id)} style={{ marginTop: "auto", paddingTop: 14, textDecoration: "none", alignSelf: "flex-start" }}>
                  <Button variant="gold" style={{ padding: "8px 14px", fontSize: 13 }}>Responder e ganhar {activeSurveys[0].points || 5} pontos →</Button>
                </a>
              )}
            </div>
          </div>
        )}

        {/* ---------- painel por cidade ---------- */}
        {city && (
          <section style={{ paddingTop: 56 }}>
            {sectionHead("Raio-X municipal", "Painel por cidade",
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: BLUE_SOFT, fontSize: 14, maxWidth: "48ch", margin: 0 }}>Escolha um município para ver contas públicas, população, pesquisas e índices num só lugar.</p>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {rows.map(r => (
                <button key={r.city} className={`ix-chip ${selectedCity === r.city ? "on" : ""}`} onClick={() => setSelectedCity(r.city)}>{r.city}</button>
              ))}
            </div>
            <div className="ix-city" style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14 }}>
              <div>
                {kick("Município")}
                <div style={{ fontFamily: "'Newsreader', serif", fontSize: 30, fontWeight: 500, lineHeight: 1.1, color: INK, marginTop: 4 }}>{city.city}</div>
                {city.pop && (
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT, marginTop: 6 }}>
                    {city.pop.toLocaleString("pt-BR")} habitantes · {fmtPct(city.pop / totalPop)} da população do ABC
                  </div>
                )}
                {city.perCapita && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT, margin: "18px 0 5px" }}>
                      <span>Receita por habitante</span><b style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500, color: INK }}>{fmtBRL(city.perCapita)}</b>
                    </div>
                    <div style={{ height: 8, background: PAPER_DARK, borderRadius: 4, position: "relative" }}>
                      <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(city.perCapita / maxPerCapita) * 100}%`, background: BLUE, borderRadius: 4 }} />
                      <u style={{ position: "absolute", top: -4, bottom: -4, width: 2, background: GOLD, left: `${(avgPerCapita / maxPerCapita) * 100}%` }} />
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: MUTED, marginTop: 6 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, background: GOLD, marginRight: 5 }} />média do Grande ABC: {fmtBRL(avgPerCapita)}
                    </div>
                  </>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT, margin: "16px 0 5px" }}>
                  <span>Despesa {city.gap >= 0 ? "acima" : "abaixo"} da receita</span><b style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500, color: city.gap >= 0 ? RED : "#2F7A55" }}>{city.gap >= 0 ? "+" : ""}{fmtPct(city.gap)}</b>
                </div>
                <div style={{ height: 8, background: PAPER_DARK, borderRadius: 4, position: "relative" }}>
                  <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${gapMax > 0 ? Math.max(0, city.gap / gapMax) * 100 : 0}%`, background: RED, borderRadius: 4 }} />
                  {gapMax > 0 && <u style={{ position: "absolute", top: -4, bottom: -4, width: 2, background: GOLD, left: `${Math.max(0, regionGap / gapMax) * 100}%` }} />}
                </div>
              </div>
              <div>
                {kick("Contas públicas · TCE-SP")}
                <div style={{ marginTop: 8 }}>
                  {kv("Receita", fmtBRL(city.receita))}
                  {kv("Despesa", fmtBRL(city.despesa))}
                  {kv("Diferença", `${city.despesa > city.receita ? "−" : "+"}${fmtBRL(Math.abs(city.despesa - city.receita))}`, city.despesa > city.receita ? RED : "#2F7A55")}
                  {kv("Participação na receita do ABC", fmtPct(totalReceita ? city.receita / totalReceita : 0))}
                  {cityRank > 0 && kv("Posição em receita/hab.", `${cityRank}º de ${ranking.length}`)}
                </div>
                {city.as_of && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: MUTED, marginTop: 10 }}>Consolidado de {new Date(city.as_of + "T00:00:00").toLocaleDateString("pt-BR")}</div>}
              </div>
              <div>
                {kick("Instituto Índice ABC")}
                <div style={{ marginTop: 8 }}>
                  {kv("Pesquisas em campo", surveysByCity[city.city] || 0)}
                  {kv("Resultados publicados", publishedByCity[city.city] || 0)}
                  {kv("Índices compilados", indicesByCity[city.city] || 0)}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                  {surveysByCity[city.city] ? (
                    <a href={resultsPageUrl()} style={{ textDecoration: "none" }}><Button variant="gold" style={{ padding: "8px 14px", fontSize: 13 }}>Responder pesquisa desta cidade →</Button></a>
                  ) : notif.status === "done" ? (
                    <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: "#2F7A55" }}><Check size={13} style={{ verticalAlign: -2 }} /> Você será avisado quando abrir pesquisa.</span>
                  ) : (
                    <Button variant="ghost" onClick={notif.enable} disabled={notif.status === "asking"} style={{ padding: "8px 14px", fontSize: 13 }}><Bell size={13} /> Avise-me quando abrir pesquisa</Button>
                  )}
                  {indicesByCity[city.city] > 0 && <a href={indicesPageUrl()} className="ix-link" style={{ alignSelf: "center" }}>Ver índices →</a>}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ---------- pesquisas + achado ---------- */}
        <section style={{ paddingTop: 56 }}>
          <div className={highlight ? "ix-two" : ""}>
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: INK }}>Pesquisas abertas e em breve</b>
                <a href={resultsPageUrl()} className="ix-link">Ver todas →</a>
              </div>
              {activeSurveys === null ? (
                <div style={{ padding: 22 }}><Loader2 className="spin" size={16} color={BLUE_SOFT} /></div>
              ) : (
                <>
                  {activeSurveys.map(s => {
                    const target = (s.quotas || []).reduce((sum, q) => sum + (Number(q.target) || 0), 0);
                    const got = surveyCounts[s.id] || 0;
                    const pct = target > 0 ? Math.min(100, Math.round((got / target) * 100)) : 0;
                    return (
                      <a key={s.id} href={surveyPublicUrl(s.id)} className="ix-sv">
                        <div>
                          <div style={{ fontFamily: "'Newsreader', serif", fontSize: 19, fontWeight: 500, color: INK }}>{s.title}</div>
                          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT, marginTop: 2 }}>{s.city} · {(s.questions || []).length} {(s.questions || []).length === 1 ? "pergunta" : "perguntas"} · anônima</div>
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: MUTED }}>
                          Cotas preenchidas · {pct}%
                          <div style={{ height: 6, background: PAPER_DARK, borderRadius: 3, marginTop: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(2, pct)}%`, background: "#3E7CB1" }} /></div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: "#8A6412", background: "#FBF3E2", border: "1px solid #F0E0BA", padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>+{s.points || 5} pts</span>
                        </div>
                      </a>
                    );
                  })}
                  {(upcoming || []).map(u => (
                    <div key={u.id} className="ix-sv" style={{ opacity: 0.6 }}>
                      <div>
                        <div style={{ fontFamily: "'Newsreader', serif", fontSize: 19, fontWeight: 500, color: INK }}>{u.title}</div>
                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT, marginTop: 2 }}>{u.city}</div>
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: MUTED }}>Em breve</div>
                      <div />
                    </div>
                  ))}
                  {activeSurveys.length === 0 && (!upcoming || upcoming.length === 0) && (
                    <div style={{ padding: "18px 22px", borderTop: `1px solid ${LINE_SOFT}`, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT }}>Nenhuma pesquisa disponível no momento.</div>
                  )}
                </>
              )}
              {notif.status !== "done" && (
                <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 22px", background: PAPER, borderTop: `1px solid ${LINE_SOFT}`, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT, flexWrap: "wrap" }}>
                  <Bell size={16} color={GOLD} />
                  <span style={{ flex: 1, minWidth: 180 }}>
                    Saiba na hora quando abrir uma pesquisa nova.
                    {notif.error && <span style={{ color: "#8A3B3B" }}> {notif.error}</span>}
                  </span>
                  <Button variant="primary" onClick={notif.enable} disabled={notif.status === "asking"} style={{ padding: "7px 13px", fontSize: 13 }}>
                    {notif.status === "asking" ? <Loader2 size={14} className="spin" /> : "Ativar"}
                  </Button>
                </div>
              )}
            </div>

            {highlight && (
              <a href={resultsSurveyUrl(highlight.id)} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden", textDecoration: "none", display: "block" }}>
                <div style={{ padding: "16px 22px", borderBottom: `1px solid ${LINE_SOFT}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: INK }}>Achado recente</b>
                  {kick("Resultado publicado")}
                </div>
                <div style={{ padding: 22 }}>
                  <div style={{ fontFamily: "'Newsreader', serif", fontSize: 64, lineHeight: 0.95, color: BLUE, letterSpacing: "-0.02em" }}>{highlight.highlight_stat}</div>
                  <p style={{ fontFamily: "'Newsreader', serif", fontSize: 18, lineHeight: 1.4, color: INK, margin: "10px 0 14px" }}>{highlight.highlight_label}</p>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: MUTED, borderTop: `1px dashed ${LINE_SOFT}`, paddingTop: 12 }}>
                    {highlight.title} · <span className="ix-link">Ver pesquisa completa →</span>
                  </div>
                </div>
              </a>
            )}
          </div>
        </section>

        {/* ---------- índices ---------- */}
        {indices.length > 0 && (
          <section style={{ paddingTop: 56 }}>
            {sectionHead("Curadoria", "Índices em destaque", <a href={indicesPageUrl()} className="ix-link">Todos os índices →</a>)}
            <div className="ix-ixs">
              {indices.map(idx => (
                <a key={idx.id} href={indicesPageUrl()} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", textDecoration: "none", color: INK }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: MUTED }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: GOLD }}>{idx.category}</span>
                    <span>{ABC_MAP_TILES[idx.city]?.short || idx.city}</span>
                  </div>
                  <div style={{ fontFamily: "'Newsreader', serif", fontSize: 36, color: BLUE, lineHeight: 1, margin: "14px 0 6px" }}>{idx.value}</div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, fontWeight: 600 }}>{idx.title}</div>
                  <div style={{ marginTop: "auto", paddingTop: 12, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: MUTED }}>
                    {idx.source_name}{idx.reference_period ? ` · ${idx.reference_period}` : ""}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ---------- metodologia ---------- */}
        <section style={{ paddingTop: 56 }}>
          {sectionHead("Metodologia", "Como fazemos pesquisa")}
          <div className="ix-meth" style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14 }}>
            {[
              { n: "01", t: "Amostra representativa", d: "Cotas por idade e sexo, baseadas no Censo IBGE de cada cidade." },
              { n: "02", t: "Coleta em dobro", d: "Coletamos cerca de 2× a amostra necessária, prevendo exclusões." },
              { n: "03", t: "Tratamento antes de publicar", d: "Excluímos respostas suspeitas (muito rápidas, IPs duplicados, fora da cidade)." },
            ].map(s => (
              <div key={s.n}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: GOLD }}>{s.n}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 15, color: INK, margin: "8px 0 6px" }}>{s.t}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT, lineHeight: 1.5 }}>{s.d}</div>
              </div>
            ))}
            <div style={{ background: BLUE }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: GOLD }}>Garantias</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 15, color: "#fff", margin: "8px 0 6px" }}>Anônimo e transparente</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "#C6D3E2", lineHeight: 1.5 }}>Não pedimos nome nem e-mail para responder. Toda publicação traz fonte e período.</div>
            </div>
          </div>
        </section>

        {/* ---------- pontos, empresas, dúvidas ---------- */}
        <section style={{ paddingTop: 56 }} className="ix-three">
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 24, display: "flex", flexDirection: "column" }}>
            {kick("Programa de pontos")}
            <div style={{ fontFamily: "'Newsreader', serif", fontSize: 22, fontWeight: 500, color: INK, margin: "8px 0" }}>Responda e ganhe pontos</div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: BLUE_SOFT, marginBottom: 14 }}>Troque por vouchers e descontos de comércios parceiros do Grande ABC.</div>
            {exampleReward && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: GOLD, marginBottom: 16 }}>
                Ex: {exampleReward.name}{exampleReward.partner_name ? ` · ${exampleReward.partner_name}` : ""} · {exampleReward.points_cost} pontos
              </div>
            )}
            <a href={pointsPageUrl()} style={{ marginTop: "auto", textDecoration: "none", alignSelf: "flex-start" }}><Button variant="ghost" style={{ padding: "8px 14px", fontSize: 13 }}>Troque seus pontos</Button></a>
          </div>
          <div style={{ background: BLUE, borderRadius: 14, padding: 24, display: "flex", flexDirection: "column" }}>
            {kick("Para empresas")}
            <div style={{ fontFamily: "'Newsreader', serif", fontSize: 22, fontWeight: 500, color: "#fff", margin: "8px 0" }}>Sua empresa quer apoiar uma pesquisa?</div>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: GOLD_SOFT, marginBottom: 16 }}>Empresas do Grande ABC podem patrocinar ou colaborar com estudos específicos do Instituto.</div>
            <a href="mailto:institutoindiceabc@gmail.com" style={{ marginTop: "auto", textDecoration: "none", alignSelf: "flex-start" }}><Button variant="gold" style={{ padding: "8px 14px", fontSize: 13 }}>Fale conosco</Button></a>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 24 }}>
            {kick("Dúvidas")}
            <div style={{ fontFamily: "'Newsreader', serif", fontSize: 22, fontWeight: 500, color: INK, margin: "8px 0" }}>Perguntas frequentes</div>
            {FAQ.map((item, i) => (
              <div key={i} style={{ borderTop: `1px solid ${LINE_SOFT}`, padding: "12px 0" }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ display: "flex", justifyContent: "space-between", width: "100%", background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13.5, color: INK }}>
                  {item.q}<span style={{ fontFamily: "'IBM Plex Mono', monospace", color: GOLD }}>{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT, marginTop: 6, lineHeight: 1.55 }}>{item.a}</div>}
              </div>
            ))}
          </div>
        </section>

        {mostRecentAsOf && (
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: MUTED, marginTop: 28 }}>
            Contas públicas: consolidado oficial do TCE-SP de {new Date(mostRecentAsOf + "T00:00:00").toLocaleDateString("pt-BR")}; os valores “ao vivo” são uma projeção a partir dele. População: IBGE, Censo 2022.
          </p>
        )}
      </div>
    </PublicLayout>
  );
}

// ---------- About page (public, standalone) ----------
function AboutPage() {
  return (
    <PublicLayout>
      <PageMeta title="Sobre" description="Conheça a missão, a metodologia e a natureza jurídica do Instituto Índice e Desenvolvimento do ABC." />

      <PageBand>
        <div style={{ fontFamily: "'Newsreader', serif", fontWeight: 500, fontSize: 28, color: "#fff", margin: "0 0 8px" }}>Sobre o Instituto</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: GOLD_SOFT, maxWidth: "56ch" }}>Missão, natureza jurídica e metodologia do IIDABC</div>
      </PageBand>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 16px 60px" }}>
        <div style={{ fontFamily: "'Newsreader', serif", fontSize: 17, color: INK, lineHeight: 1.75 }}>
          <p style={{ marginTop: 0 }}>
            O Instituto Índice e Desenvolvimento do ABC (IIDABC) é uma associação civil sem fins
            econômicos dedicada à produção de índices, pesquisas e diagnósticos estatísticos sobre os municípios
            do Grande ABC Paulista.
          </p>

          <div style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 21, lineHeight: 1.5, color: BLUE, maxWidth: "56ch", margin: "34px 0", paddingLeft: 20, borderLeft: `2px solid ${GOLD}` }}>
            "Decisões sobre segurança, mobilidade, comércio local e qualidade de vida frequentemente carecem de dados primários, atualizados e metodologicamente sólidos."
          </div>

          <p>
            O IIDABC nasce para produzir esse conhecimento com rigor científico — amostragem estatisticamente
            representativa, baseada em dados do Censo IBGE, com margens de erro e níveis de confiança declarados
            em cada pesquisa publicada.
          </p>
          <p>
            Os resultados são disponibilizados à imprensa, ao poder público, a empresas e à sociedade civil,
            contribuindo para decisões mais informadas em toda a região do ABC.
          </p>
        </div>

        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: BLUE_SOFT, lineHeight: 2, marginTop: 30 }}>
          Natureza jurídica — Associação civil de direito privado, sem fins econômicos<br />
          Sede — Santo André/SP — Grande ABC Paulista<br />
          Contato — institutoindiceabc@gmail.com
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

      <PageBand>
        <div style={{ fontFamily: "'Newsreader', serif", fontWeight: 500, fontSize: 28, color: "#fff", margin: "0 0 8px" }}>Nossos Parceiros</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: GOLD_SOFT, maxWidth: "56ch" }}>Empresas e comércios que oferecem vouchers e descontos pelo programa de pontos</div>
      </PageBand>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 16px 60px" }}>
        {partners === null ? (
          <Loader2 className="spin" size={18} color={BLUE_SOFT} />
        ) : partnerNames.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", border: `1px dashed ${LINE}`, borderRadius: 12, color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5 }}>
            Em breve, novos parceiros por aqui.
          </div>
        ) : (
          partnerNames.map((name, i) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderTop: `1px solid ${LINE}`, borderBottom: i === partnerNames.length - 1 ? `1px solid ${LINE}` : "none" }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 16, color: INK }}>{name}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: GOLD, textAlign: "right" }}>{partners[name].join(" · ")}</div>
            </div>
          ))
        )}

        <PageFooter />
      </div>
    </PublicLayout>
  );
}

// ---------- Published results (public, standalone page) ----------
function PublishedResultsList() {
  const [surveys, setSurveys] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("surveys")
        .select("id, title, description, city, points, status, published, created_at")
        .or("status.eq.ativa,published.eq.true")
        .order("created_at", { ascending: false });
      setSurveys(data || []);
    })();
  }, []);

  return (
    <PublicLayout>
      <PageMeta title="Pesquisas" description="Pesquisas em andamento e resultados já publicados pelo Instituto Índice e Desenvolvimento do ABC." />

      <PageBand>
        <div style={{ fontFamily: "'Newsreader', serif", fontWeight: 500, fontSize: 28, color: "#fff", margin: "0 0 8px" }}>Pesquisas</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: GOLD_SOFT, maxWidth: "56ch" }}>Em andamento e já publicadas pelo Instituto</div>
      </PageBand>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 16px 60px" }}>
        {surveys === null ? (
          <Loader2 className="spin" size={18} color={BLUE_SOFT} />
        ) : surveys.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", border: `1px dashed ${LINE}`, borderRadius: 12, color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5 }}>
            Nenhuma pesquisa disponível no momento. Volte em breve!
          </div>
        ) : (
          surveys.map((s, i) => {
            const isPublished = s.published;
            const href = isPublished ? resultsSurveyUrl(s.id) : surveyPublicUrl(s.id);
            return (
              <a key={s.id} href={href} style={{ display: "block", padding: "24px 0", borderTop: `1px solid ${LINE}`, borderBottom: i === surveys.length - 1 ? `1px solid ${LINE}` : "none", textDecoration: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: GOLD, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.city}</div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap", background: isPublished ? "#EEF2F6" : "#EFE3C6", color: isPublished ? BLUE : "#8A6416" }}>
                    {isPublished ? "Publicada" : "Em andamento"}
                  </span>
                </div>
                <div style={{ fontFamily: "'Newsreader', serif", fontSize: 20, fontWeight: 500, color: INK, margin: "6px 0 6px" }}>{s.title}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT, maxWidth: "56ch" }}>
                  {isPublished ? (s.description || "Resultados já tratados e analisados.") : `${s.description ? s.description + " " : ""}Ganhe ${s.points || 5} pontos ao participar.`}
                </div>
              </a>
            );
          })
        )}
        <PageFooter />
      </div>
    </PublicLayout>
  );
}

function PublishedResultsDetail({ surveyId }) {
  const [survey, setSurvey] = useState(null);
  const [responses, setResponses] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: surveyData, error } = await supabase
        .from("surveys")
        .select("id, title, description, city, questions, quotas, published")
        .eq("id", surveyId)
        .single();

      if (error || !surveyData || !surveyData.published) { setNotFound(true); return; }
      setSurvey(surveyData);

      const { data: respData } = await supabase.rpc("get_published_survey_responses", { p_survey_id: surveyId });
      setResponses(respData || []);
    })();
  }, [surveyId]);

  if (notFound) {
    return (
      <PublicLayout>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 16px 60px", textAlign: "center" }}>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: BLUE_SOFT }}>Esse resultado não está disponível.</p>
          <a href={resultsPageUrl()} style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: BLUE, fontWeight: 600 }}>← Ver todas as publicadas</a>
        </div>
      </PublicLayout>
    );
  }

  if (!survey || responses === null) {
    return <PublicLayout><div style={{ padding: 60, textAlign: "center" }}><Loader2 className="spin" size={20} color={BLUE_SOFT} /></div></PublicLayout>;
  }

  const tally = (q) => {
    const t = {};
    (q.options || []).forEach(o => t[o] = 0);
    responses.forEach(r => {
      const a = r.answers?.[q.id];
      if (q.type === "multi" && Array.isArray(a)) a.forEach(o => { t[o] = (t[o] || 0) + 1; });
      else if (a) t[a] = (t[a] || 0) + 1;
    });
    return t;
  };

  return (
    <PublicLayout>
      <PageMeta title={survey.title} description={survey.description || `Resultados da pesquisa "${survey.title}" do Índice ABC.`} />

      <PageBand>
        <a href={resultsPageUrl()} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: GOLD_SOFT, display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 14, textDecoration: "none" }}>
          <ArrowLeft size={13} /> Todas as publicadas
        </a>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: GOLD, textTransform: "uppercase", letterSpacing: "0.06em" }}>{survey.city}</div>
        <div style={{ fontFamily: "'Newsreader', serif", fontWeight: 500, fontSize: 26, color: "#fff", margin: "6px 0 8px" }}>{survey.title}</div>
        {survey.description && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: GOLD_SOFT, maxWidth: "56ch" }}>{survey.description}</div>}
      </PageBand>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 16px 60px" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: BLUE_SOFT, marginBottom: 24 }}>{responses.length} respostas válidas</div>

        {survey.questions.map(q => {
          if (q.type === "text") return null; // texto livre não vira gráfico público
          const t = tally(q);
          const max = Math.max(1, ...Object.values(t));
          return (
            <div key={q.id} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13.5, color: INK, marginBottom: 10 }}>{q.text}</div>
              {Object.entries(t).map(([opt, n]) => (
                <div key={opt} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: INK, marginBottom: 3 }}>
                    <span>{opt}</span><span style={{ fontFamily: "'IBM Plex Mono', monospace", color: BLUE_SOFT }}>{n}</span>
                  </div>
                  <div style={{ height: 7, background: "#EDE8DA", borderRadius: 4 }}>
                    <div style={{ height: "100%", width: `${(n / max) * 100}%`, background: GOLD, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        <PageFooter />
      </div>
    </PublicLayout>
  );
}

function PublishedResults() {
  const params = new URLSearchParams(window.location.search);
  const surveyId = params.get("survey");
  return surveyId ? <PublishedResultsDetail surveyId={surveyId} /> : <PublishedResultsList />;
}

// ---------- Public accounts page (public, standalone) ----------
// ---------- Índices (public, standalone) — curadoria de dados de terceiros ----------
function PublicIndicesPage() {
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [indices, setIndices] = useState(null);

  useEffect(() => {
    if (!selectedCity) { setIndices(null); return; }
    (async () => {
      const { data } = await supabase.from("indices").select("*").eq("city", selectedCity).order("created_at", { ascending: false });
      setIndices(data || []);
    })();
  }, [selectedCity]);

  const filtered = indices && selectedCategory ? indices.filter(i => i.category === selectedCategory) : indices;
  const categoriesPresent = indices ? [...new Set(indices.map(i => i.category))] : [];

  return (
    <PublicLayout>
      <PageMeta title="Índices" description="Compilação de índices e pesquisas de outras instituições sobre as cidades do Grande ABC." />

      <PageBand>
        <div style={{ fontFamily: "'Newsreader', serif", fontWeight: 500, fontSize: 28, color: "#fff", margin: "0 0 8px" }}>Índices</div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: GOLD_SOFT, maxWidth: "56ch" }}>
          Uma compilação de índices e pesquisas produzidos por outras instituições sobre as cidades do Grande ABC.
        </div>
      </PageBand>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 16px 60px" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: GOLD, marginBottom: 10 }}>Escolha uma cidade</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
          {ABC_CITIES.map(c => (
            <button key={c} onClick={() => { setSelectedCity(c); setSelectedCategory(null); }} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: 20, border: selectedCity === c ? "none" : `1px solid ${LINE}`, background: selectedCity === c ? BLUE : "#fff", color: selectedCity === c ? "#fff" : INK, cursor: "pointer" }}>
              {c}
            </button>
          ))}
        </div>

        {selectedCity === null ? (
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: BLUE_SOFT, padding: "20px 0" }}>
            Escolha uma cidade acima pra ver os índices compilados.
          </div>
        ) : indices === null ? (
          <Loader2 className="spin" size={18} color={BLUE_SOFT} />
        ) : (
          <>
            {categoriesPresent.length > 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
                <button onClick={() => setSelectedCategory(null)} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, padding: "4px 10px", borderRadius: 12, border: "none", background: !selectedCategory ? GOLD_SOFT : "transparent", color: !selectedCategory ? "#5C4419" : BLUE_SOFT, cursor: "pointer" }}>Todos</button>
                {categoriesPresent.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, padding: "4px 10px", borderRadius: 12, border: "none", background: selectedCategory === cat ? GOLD_SOFT : "transparent", color: selectedCategory === cat ? "#5C4419" : BLUE_SOFT, cursor: "pointer" }}>{cat}</button>
                ))}
              </div>
            )}

            {filtered.length === 0 ? (
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13.5, color: BLUE_SOFT, padding: "16px 0" }}>
                Ainda não compilamos nenhum índice pra {selectedCity}.
              </div>
            ) : (
              filtered.map((idx, i) => (
                <div key={idx.id} style={{ padding: "22px 0", borderTop: `1px solid ${LINE}`, borderBottom: i === filtered.length - 1 ? `1px solid ${LINE}` : "none" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: GOLD, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{idx.category}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: "'Newsreader', serif", fontSize: 17, fontWeight: 500, color: INK }}>{idx.title}</div>
                    <div style={{ fontFamily: "'Newsreader', serif", fontSize: 22, fontWeight: 500, color: BLUE, whiteSpace: "nowrap" }}>{idx.value}</div>
                  </div>
                  {idx.context && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: INK, marginTop: 6, lineHeight: 1.5 }}>{idx.context}</div>}
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: BLUE_SOFT, marginTop: 8 }}>
                    Fonte: {idx.source_url ? <a href={idx.source_url} target="_blank" rel="noopener noreferrer" style={{ color: BLUE_SOFT, textDecoration: "underline" }}>{idx.source_name}</a> : idx.source_name}
                    {idx.reference_period && ` · ${idx.reference_period}`}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: BLUE_SOFT, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8, padding: "12px 14px", lineHeight: 1.6, marginTop: 28 }}>
          Os índices desta página são produzidos por outras instituições, não pelo Índice ABC — reunimos aqui como curadoria, sempre com a fonte original indicada.
        </div>

        <PageFooter />
      </div>
    </PublicLayout>
  );
}

function PublicAccountsPage() {
  const [accounts, setAccounts] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("public_accounts").select("*").order("receita", { ascending: false });
      setAccounts(data || []);
    })();
  }, []);

  const rows = (accounts || []).map(a => {
    const receita = Number(a.receita), despesa = Number(a.despesa);
    const pop = ABC_POPULATION[a.city] || null;
    return { ...a, receita, despesa, pop, gap: receita > 0 ? (despesa - receita) / receita : 0, perCapita: pop ? receita / pop : null };
  });
  const totalReceita = rows.reduce((s, r) => s + r.receita, 0);
  const totalDespesa = rows.reduce((s, r) => s + r.despesa, 0);
  const totalPop = rows.reduce((s, r) => s + (r.pop || 0), 0);
  const regionGap = totalReceita > 0 ? (totalDespesa - totalReceita) / totalReceita : 0;
  const gapMax = Math.max(0.0001, ...rows.map(r => Math.abs(r.gap)));
  const mostRecentAsOf = rows.reduce((m, a) => (!m || a.as_of > m ? a.as_of : m), null);
  const asOfLabel = mostRecentAsOf ? new Date(mostRecentAsOf + "T00:00:00").toLocaleDateString("pt-BR") : "—";
  const signed = (v) => `${v > 0 ? "−" : "+"}${fmtBRL(Math.abs(v))}`;

  const kpi = (label, value, note, color) => (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "18px 20px", boxShadow: "0 10px 30px rgba(15,46,82,.08)" }}>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT }}>{label}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 500, color: color || BLUE, marginTop: 6, whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: MUTED, marginTop: 2 }}>{note}</div>
    </div>
  );

  return (
    <PublicLayout>
      <PageMeta title="Contas Públicas" description="Receita e despesa das 7 cidades do Grande ABC, com base em dados do TCE-SP." />

      <div className="ix-grid-bg" style={{ background: BLUE, color: "#fff", padding: "40px 0 84px" }}>
        <div className="ix-wrap">
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: GOLD }}>Transparência · TCE-SP</div>
          <h1 style={{ fontFamily: "'Newsreader', serif", fontWeight: 500, fontSize: 42, margin: "10px 0 8px" }}>Contas Públicas</h1>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, color: GOLD_SOFT, maxWidth: "60ch" }}>Receita e despesa das 7 cidades do Grande ABC, com base no TCE-SP.</div>
        </div>
      </div>

      <div className="ix-wrap" style={{ marginTop: -44, position: "relative" }}>
        {accounts === null ? (
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 40, textAlign: "center" }}><Loader2 className="spin" size={18} color={BLUE_SOFT} /></div>
        ) : (
          <>
            <div className="ix-kpis">
              {kpi("Receita total", fmtBi(totalReceita), `consolidado ${asOfLabel}`)}
              {kpi("Despesa total", fmtBi(totalDespesa), `consolidado ${asOfLabel}`)}
              {kpi("Diferença", `${totalDespesa > totalReceita ? "−" : "+"}${fmtBi(Math.abs(totalDespesa - totalReceita))}`, `despesa ${fmtPct(Math.abs(regionGap))} ${regionGap >= 0 ? "acima" : "abaixo"} da receita`, totalDespesa > totalReceita ? RED : "#2F7A55")}
              {kpi("Receita por habitante", totalPop ? fmtBRL(totalReceita / totalPop) : "—", "média do Grande ABC")}
            </div>

            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, marginTop: 20, overflowX: "auto" }}>
              <table className="ix-table">
                <thead>
                  <tr><th>Município</th><th>População</th><th>Receita</th><th>Despesa</th><th>Diferença</th><th>Despesa × receita</th><th>Receita/hab.</th></tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td>{r.city}</td>
                      <td>{r.pop ? r.pop.toLocaleString("pt-BR") : "—"}</td>
                      <td>{fmtBRL(r.receita)}</td>
                      <td>{fmtBRL(r.despesa)}</td>
                      <td style={{ color: r.despesa > r.receita ? RED : "#2F7A55" }}>{signed(r.despesa - r.receita)}</td>
                      <td style={{ color: r.gap >= 0 ? RED : "#2F7A55" }}>
                        {r.gap >= 0 ? "+" : ""}{fmtPct(r.gap)}
                        <span style={{ display: "inline-block", width: 70, height: 6, background: PAPER_DARK, borderRadius: 3, verticalAlign: "middle", marginLeft: 8, overflow: "hidden" }}>
                          <i style={{ display: "block", height: "100%", width: `${(Math.abs(r.gap) / gapMax) * 100}%`, background: r.gap >= 0 ? RED : "#2F7A55" }} />
                        </span>
                      </td>
                      <td>{r.perCapita ? fmtBRL(r.perCapita) : "—"}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Grande ABC</td>
                    <td>{totalPop.toLocaleString("pt-BR")}</td>
                    <td>{fmtBRL(totalReceita)}</td>
                    <td>{fmtBRL(totalDespesa)}</td>
                    <td style={{ color: totalDespesa > totalReceita ? RED : "#2F7A55" }}>{signed(totalDespesa - totalReceita)}</td>
                    <td style={{ color: regionGap >= 0 ? RED : "#2F7A55" }}>{regionGap >= 0 ? "+" : ""}{fmtPct(regionGap)}</td>
                    <td>{totalPop ? fmtBRL(totalReceita / totalPop) : "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: BLUE_SOFT, background: "#fff", border: `1px solid ${LINE}`, borderLeft: `3px solid ${GOLD}`, borderRadius: 8, padding: "12px 16px", lineHeight: 1.6, marginTop: 16, maxWidth: 900 }}>
              A tabela mostra o <b>consolidado oficial</b> mais recente, de {asOfLabel}. A faixa fixa no rodapé do site mostra uma <b>projeção ao vivo</b> estimada a partir desses valores — por isso os números são diferentes. Fontes:{" "}
              <a href="https://transparencia.tce.sp.gov.br" target="_blank" rel="noopener noreferrer" style={{ color: BLUE, fontWeight: 600 }}>transparencia.tce.sp.gov.br</a> · População: IBGE, Censo 2022.
            </div>
          </>
        )}
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
  const [published, setPublished] = useState(survey.published || false);
  const [publishSaving, setPublishSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(null);
  const [confirmingNotify, setConfirmingNotify] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifiedAt, setNotifiedAt] = useState(survey.notified_at || null);
  const [notifyResult, setNotifyResult] = useState("");
  const [confirmingPush, setConfirmingPush] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState("");
  const publicUrl = `${window.location.origin}${window.location.pathname}?s=${survey.id}`;
  const previewUrl = `${publicUrl}&preview=1`;

  useEffect(() => {
    (async () => {
      const { count } = await supabase.from("subscribers").select("id", { count: "exact", head: true });
      setSubscriberCount(count || 0);
    })();
  }, []);

  const toggleQr = async () => {
    if (showQr) { setShowQr(false); return; }
    if (!qrDataUrl) {
      try {
        const url = await QRCode.toDataURL(publicUrl, { width: 480, margin: 2, color: { dark: BLUE, light: "#FFFFFF" } });
        setQrDataUrl(url);
      } catch {
        // se falhar, o painel abre sem imagem — o link continua disponível pra copiar
      }
    }
    setShowQr(true);
  };

  const sendPushNotification = async () => {
    setPushSending(true);
    setPushResult("");
    try {
      const res = await fetch("/api/send-push", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          title: "Nova pesquisa: " + survey.title,
          body: `Responda e ganhe ${survey.points || 5} pontos.`,
          url: publicUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPushResult(data.error || "Não foi possível enviar a notificação.");
      } else if (data.sent === 0 && data.message) {
        setPushResult(data.message);
      } else {
        setPushResult(`Notificação enviada para ${data.sent} de ${data.total} pessoas.`);
        setConfirmingPush(false);
      }
    } catch {
      setPushResult("Erro de conexão. Tente novamente.");
    }
    setPushSending(false);
  };

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

  const togglePublished = async () => {
    setPublishSaving(true);
    const next = !published;
    const { error } = await supabase.from("surveys").update({ published: next }).eq("id", survey.id);
    if (!error) setPublished(next);
    setPublishSaving(false);
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
          <Button variant="ghost" onClick={toggleQr}><QrCode size={14} /> QR Code</Button>
          <Button variant="primary" onClick={exportCSV}><Download size={14} /> Exportar CSV</Button>
          <Button variant="ghost" onClick={() => setConfirmingNotify(true)}>Notificar inscritos</Button>
          <Button variant="ghost" onClick={() => setConfirmingPush(true)}><Bell size={14} /> Notificação push</Button>
          <Button variant="ghost" onClick={onViewMap}>Ver no mapa</Button>
          <Button variant="danger" onClick={() => setConfirmingDelete(true)}><X size={14} /> Excluir</Button>
        </div>
      </div>

      {showQr && (
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 18, marginBottom: 18, textAlign: "center" }}>
          {qrDataUrl ? (
            <>
              <img src={qrDataUrl} alt={`QR code da pesquisa ${survey.title}`} style={{ width: 220, height: 220, borderRadius: 8 }} />
              <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
                <a href={qrDataUrl} download={`qrcode-${survey.title.replace(/\s+/g, "-").toLowerCase()}.png`}>
                  <Button variant="gold"><Download size={14} /> Baixar PNG</Button>
                </a>
                <Button variant="ghost" onClick={() => setShowQr(false)}>Fechar</Button>
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: BLUE_SOFT, marginTop: 10 }}>
                Pronto pra imprimir e colar em comércios, cartazes e eventos.
              </div>
            </>
          ) : (
            <Loader2 className="spin" size={20} color={BLUE_SOFT} />
          )}
        </div>
      )}

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

      {confirmingPush && (
        <div style={{ background: "#FBF3E4", border: `1px solid ${GOLD_SOFT}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 13.5, color: "#8A6416", marginBottom: 6 }}>
            Enviar notificação push sobre "{survey.title}"?
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: "#8A6416", marginBottom: 12 }}>
            Vai pra todo mundo que ativou notificações no site (independente de ter se inscrito por e-mail ou não).
          </div>
          {pushResult && (
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12.5, color: INK, marginBottom: 10 }}>{pushResult}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="gold" onClick={sendPushNotification} disabled={pushSending}>{pushSending ? <Loader2 size={14} className="spin" /> : null} Sim, enviar agora</Button>
            <Button variant="ghost" onClick={() => setConfirmingPush(false)}>Fechar</Button>
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, padding: "2px 8px", borderRadius: 12, background: surveyStatus === "ativa" ? "#E5F1E9" : "#F1EEE3", color: surveyStatus === "ativa" ? "#3E7A52" : BLUE_SOFT }}>
          {surveyStatus === "ativa" ? "Coletando respostas" : "Coleta encerrada"}
        </span>
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, padding: "2px 8px", borderRadius: 12, background: published ? "#EEF2F6" : "#F1EEE3", color: published ? BLUE : BLUE_SOFT }}>
          {published ? "Publicada em Publicadas" : "Não publicada"}
        </span>
        <Button variant={published ? "ghost" : "gold"} onClick={togglePublished} disabled={publishSaving} style={{ padding: "4px 10px", fontSize: 11.5 }}>
          {publishSaving ? <Loader2 size={12} className="spin" /> : null} {published ? "Despublicar" : "Publicar resultados"}
        </Button>
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
function SurveyList({ onCreate, onOpen, onViewSubscribers, onViewRewards, onViewOverview, onViewPointsReport, onViewAccounts, onViewUpcoming, onViewIndices }) {
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
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: GOLD, marginTop: 8 }}>{s.questions.length} {s.questions.length === 1 ? "pergunta" : "perguntas"} · meta de {s.quotas.reduce((sum, q) => sum + q.target, 0)} respostas</div>
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
// ---------- Contas Públicas (admin) ----------
// ---------- Pesquisas "em breve" (admin) ----------
function UpcomingSurveysAdmin({ onBack }) {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ title: "", city: "São Caetano do Sul", description: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("upcoming_surveys").select("*").order("created_at", { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await supabase.from("upcoming_surveys").insert({ title: form.title.trim(), city: form.city, description: form.description.trim() || null });
    setForm({ title: "", city: "São Caetano do Sul", description: "" });
    await load();
    setSaving(false);
  };

  const remove = async (id) => {
    await supabase.from("upcoming_surveys").delete().eq("id", id);
    load();
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "28px 16px 60px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ArrowLeft size={15} /> Voltar
      </button>
      <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, marginBottom: 4 }}>Pesquisas "em breve"</h1>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT, marginBottom: 24 }}>
        Anuncie uma pesquisa futura na Início, sem precisar montar o formulário inteiro ainda.
      </p>

      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <Field label="Título">
          <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </Field>
        <Field label="Cidade do Grande ABC">
          <select style={{ ...inputStyle, maxWidth: 260 }} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}>
            {ABC_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Descrição (opcional)">
          <input style={inputStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </Field>
        <Button variant="gold" onClick={add} disabled={saving || !form.title.trim()}>{saving ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Anunciar</Button>
      </div>

      {items === null ? (
        <Loader2 className="spin" size={18} color={BLUE_SOFT} />
      ) : items.length === 0 ? (
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT }}>Nenhuma pesquisa anunciada ainda.</div>
      ) : (
        items.map(it => (
          <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: `1px solid ${LINE}` }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 14, color: INK }}>{it.title}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: GOLD }}>{it.city}</div>
            </div>
            <Button variant="danger" onClick={() => remove(it.id)}><X size={13} /></Button>
          </div>
        ))
      )}
    </div>
  );
}

// ---------- Índices (admin) — cadastro da curadoria ----------
function IndicesAdmin({ onBack }) {
  const emptyForm = { city: "São Caetano do Sul", category: "Segurança", title: "", value: "", source_name: "", source_url: "", reference_period: "", context: "" };
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterCity, setFilterCity] = useState("Todas");

  const load = async () => {
    const { data } = await supabase.from("indices").select("*").order("created_at", { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.title.trim() || !form.value.trim() || !form.source_name.trim()) return;
    setSaving(true);
    await supabase.from("indices").insert({
      city: form.city,
      category: form.category,
      title: form.title.trim(),
      value: form.value.trim(),
      source_name: form.source_name.trim(),
      source_url: form.source_url.trim() || null,
      reference_period: form.reference_period.trim() || null,
      context: form.context.trim() || null,
    });
    setForm(emptyForm);
    await load();
    setSaving(false);
  };

  const remove = async (id) => {
    await supabase.from("indices").delete().eq("id", id);
    load();
  };

  const shown = filterCity === "Todas" ? items : (items || []).filter(i => i.city === filterCity);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 60px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ArrowLeft size={15} /> Voltar
      </button>
      <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, marginBottom: 4 }}>Índices</h1>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT, marginBottom: 24 }}>
        Cadastre índices e pesquisas de outras instituições sobre as cidades do Grande ABC. Sempre indique a fonte.
      </p>

      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <Field label="Cidade">
            <select style={{ ...inputStyle, width: 220 }} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}>
              {ABC_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Categoria">
            <select style={{ ...inputStyle, width: 180 }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {INDEX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Título do índice">
          <input style={inputStyle} placeholder="Ex: Índice de Segurança Pública" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </Field>
        <Field label="Valor / resultado">
          <input style={inputStyle} placeholder="Ex: 72/100, ou 3º lugar no ranking estadual" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
        </Field>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Field label="Quem produziu">
            <input style={{ ...inputStyle, width: 260 }} placeholder="Ex: Fórum Brasileiro de Segurança Pública" value={form.source_name} onChange={e => setForm(f => ({ ...f, source_name: e.target.value }))} />
          </Field>
          <Field label="Período de referência">
            <input style={{ ...inputStyle, width: 160 }} placeholder="Ex: 2026" value={form.reference_period} onChange={e => setForm(f => ({ ...f, reference_period: e.target.value }))} />
          </Field>
        </div>
        <Field label="Link da fonte (opcional)">
          <input style={inputStyle} placeholder="https://..." value={form.source_url} onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))} />
        </Field>
        <Field label="Contexto (opcional)">
          <textarea style={{ ...inputStyle, minHeight: 50 }} value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} />
        </Field>
        <Button variant="gold" onClick={add} disabled={saving || !form.title.trim() || !form.value.trim() || !form.source_name.trim()}>
          {saving ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Adicionar
        </Button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <select style={{ ...inputStyle, width: 220 }} value={filterCity} onChange={e => setFilterCity(e.target.value)}>
          <option value="Todas">Todas as cidades</option>
          {ABC_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {items === null ? (
        <Loader2 className="spin" size={18} color={BLUE_SOFT} />
      ) : shown.length === 0 ? (
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT }}>Nenhum índice cadastrado ainda.</div>
      ) : (
        shown.map(idx => (
          <div key={idx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: `1px solid ${LINE}`, gap: 12 }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 14, color: INK }}>{idx.title} — {idx.value}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: GOLD }}>{idx.city} · {idx.category} · {idx.source_name}</div>
            </div>
            <Button variant="danger" onClick={() => remove(idx.id)}><X size={13} /></Button>
          </div>
        ))
      )}
    </div>
  );
}

function PublicAccountsAdmin({ onBack }) {
  const [accounts, setAccounts] = useState(null);
  const [editing, setEditing] = useState({}); // id -> { receita, despesa, period_start, as_of, source_url }
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  const load = async () => {
    const { data } = await supabase.from("public_accounts").select("*").order("city");
    setAccounts(data || []);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (a) => {
    setEditing(e => ({ ...e, [a.id]: { receita: a.receita, despesa: a.despesa, period_start: a.period_start, as_of: a.as_of, source_url: a.source_url || "" } }));
  };

  const updateField = (id, field, value) => {
    setEditing(e => ({ ...e, [id]: { ...e[id], [field]: value } }));
  };

  const save = async (id) => {
    setSavingId(id);
    const vals = editing[id];
    const { error } = await supabase.from("public_accounts").update({
      receita: Number(vals.receita) || 0,
      despesa: Number(vals.despesa) || 0,
      period_start: vals.period_start,
      as_of: vals.as_of,
      source_url: vals.source_url,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (!error) {
      setSavedId(id);
      setTimeout(() => setSavedId(null), 2000);
      setEditing(e => { const n = { ...e }; delete n[id]; return n; });
      load();
    }
    setSavingId(null);
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 16px 60px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: BLUE_SOFT, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ArrowLeft size={15} /> Voltar
      </button>
      <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 26, color: INK, marginBottom: 4 }}>Contas Públicas</h1>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: BLUE_SOFT, marginBottom: 24 }}>
        Atualize aqui sempre que o TCE-SP soltar um consolidado novo. Esses valores alimentam o ticker fixo e a aba "Contas Públicas" do site.
      </p>

      {accounts === null ? (
        <Loader2 className="spin" size={18} color={BLUE_SOFT} />
      ) : (
        accounts.map(a => {
          const isEditing = !!editing[a.id];
          const vals = editing[a.id] || {};
          return (
            <div key={a.id} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isEditing ? 12 : 0 }}>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 600, fontSize: 15, color: INK }}>{a.city}</div>
                {!isEditing && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {savedId === a.id && <Check size={15} color="#3E7A52" />}
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: BLUE_SOFT }}>
                      Receita {Number(a.receita).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} · Despesa {Number(a.despesa).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} · atualizado em {new Date(a.as_of + "T00:00:00").toLocaleDateString("pt-BR")}
                    </div>
                    <Button variant="ghost" onClick={() => startEdit(a)}>Editar</Button>
                  </div>
                )}
              </div>

              {isEditing && (
                <div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <Field label="Receita (R$)">
                      <input style={{ ...inputStyle, width: 170, fontFamily: "'IBM Plex Mono', monospace" }} type="number" step="0.01" value={vals.receita} onChange={e => updateField(a.id, "receita", e.target.value)} />
                    </Field>
                    <Field label="Despesa (R$)">
                      <input style={{ ...inputStyle, width: 170, fontFamily: "'IBM Plex Mono', monospace" }} type="number" step="0.01" value={vals.despesa} onChange={e => updateField(a.id, "despesa", e.target.value)} />
                    </Field>
                    <Field label="Início do período">
                      <input style={{ ...inputStyle, width: 150 }} type="date" value={vals.period_start} onChange={e => updateField(a.id, "period_start", e.target.value)} />
                    </Field>
                    <Field label="Consolidado em (fonte)">
                      <input style={{ ...inputStyle, width: 150 }} type="date" value={vals.as_of} onChange={e => updateField(a.id, "as_of", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Link da fonte (TCE-SP)">
                    <input style={{ ...inputStyle, marginBottom: 10 }} value={vals.source_url} onChange={e => updateField(a.id, "source_url", e.target.value)} />
                  </Field>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="gold" onClick={() => save(a.id)} disabled={savingId === a.id}>
                      {savingId === a.id ? <Loader2 size={14} className="spin" /> : null} Salvar
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(e => { const n = { ...e }; delete n[a.id]; return n; })}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

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

// Menu lateral do painel administrativo: [grupo, [[view, rótulo], ...]]
const ADMIN_NAV = [
  ["Pesquisas", [["list", "Todas as pesquisas"], ["overview", "Visão geral"], ["upcoming", "Próximas pesquisas"]]],
  ["Participantes", [["subscribers", "Inscritos"], ["rewards", "Recompensas"], ["pointsreport", "Relatório de pontos"]]],
  ["Conteúdo do site", [["indices", "Índices"], ["accounts", "Contas Públicas (TCE)"]]],
];

// ---------- App ----------
export default function App() {
  const isPublic = !!getPublicSurveyId();
  const isPoints = isPointsPage();
  const isPrivacy = isPrivacyPage();
  const isAbout = isAboutPage();
  const isPartners = isPartnersPage();
  const isResults = isResultsPage();
  const isAccounts = isAccountsPage();
  const isIndices = isIndicesPage();
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

  // Criar/editar, painel da pesquisa e mapa pertencem à seção "Pesquisas" do menu
  const adminSection = ["create", "dashboard", "map"].includes(view) ? "list" : view;

  const globalStyle = (
    <style>{`
      ${FONT_IMPORT}
      * { box-sizing: border-box; }
      input:focus, textarea:focus, button:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 1px; }
      .spin { animation: spin 0.8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      body { margin: 0; }

      ${LAYOUT_CSS}

      .step-fade { animation: stepFadeIn 0.25s ease; }
      @keyframes stepFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

      @media (min-width: 640px) {
        .hero-grid-inline { grid-template-columns: 200px 1fr !important; align-items: end; }
        .steps-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 24px !important; }
        .two-col-grid { grid-template-columns: 1fr 1fr !important; }
      }

      .ticker-track { animation: ticker-scroll 55s linear infinite; }
      .ticker-track:hover { animation-play-state: paused; }
      @keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
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

  // Resultados publicados — sem login
  if (isResults) {
    return <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif" }}>{globalStyle}<PublishedResults /></div>;
  }

  // Contas públicas do Grande ABC — sem login
  if (isAccounts) {
    return <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif" }}>{globalStyle}<PublicAccountsPage /></div>;
  }

  // Índices — curadoria de dados de terceiros, sem login
  if (isIndices) {
    return <div style={{ minHeight: "100vh", background: PAPER, fontFamily: "'IBM Plex Sans', sans-serif" }}>{globalStyle}<PublicIndicesPage /></div>;
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
      <div className="ix-adm">
        <aside className="ix-aside">
          <div className="ix-aside-brand" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px" }}>
            <LogoMark size={36} />
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, letterSpacing: "0.2em", color: GOLD_SOFT }}>PAINEL</div>
              <div style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>ÍNDICE ABC</div>
            </div>
          </div>
          {ADMIN_NAV.map(([group, items]) => (
            <React.Fragment key={group}>
              <div className="ix-aside-group">{group}</div>
              {items.map(([key, label]) => (
                <button key={key} className={adminSection === key ? "on" : ""} onClick={() => { setActiveSurvey(null); setView(key); }}>{label}</button>
              ))}
            </React.Fragment>
          ))}
          <div className="ix-aside-group">Conta</div>
          <button onClick={() => { window.location.href = homePageUrl(); }}>↗ Ver site</button>
          <button onClick={() => supabase.auth.signOut()}><span style={{ display: "flex", alignItems: "center", gap: 6 }}><LogOut size={14} /> Sair</span></button>
        </aside>
        <main style={{ minWidth: 0 }}>
      {view === "list" && <SurveyList onCreate={() => { setActiveSurvey(null); setView("create"); }} onOpen={(s) => { setActiveSurvey(s); setView("dashboard"); }} onViewSubscribers={() => setView("subscribers")} onViewRewards={() => setView("rewards")} onViewOverview={() => setView("overview")} onViewPointsReport={() => setView("pointsreport")} onViewAccounts={() => setView("accounts")} onViewUpcoming={() => setView("upcoming")} onViewIndices={() => setView("indices")} />}
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
      {view === "accounts" && <PublicAccountsAdmin onBack={() => setView("list")} />}
      {view === "upcoming" && <UpcomingSurveysAdmin onBack={() => setView("list")} />}
      {view === "indices" && <IndicesAdmin onBack={() => setView("list")} />}
      {view === "map" && activeSurvey && <SurveyMapView survey={activeSurvey} onBack={() => setView("dashboard")} />}
        </main>
      </div>
    </div>
  );
}
