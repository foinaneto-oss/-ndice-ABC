import crypto from "crypto";

const SECRET = process.env.POINTS_TOKEN_SECRET || "";

// Gera um token assinado (e-mail + validade) sem precisar guardar sessão no banco.
export function createToken(email, ttlMs = 30 * 60 * 1000) {
  const payload = JSON.stringify({ email, exp: Date.now() + ttlMs });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

// Confere o token e devolve o e-mail se for válido, ou null se inválido/expirado/adulterado.
export function verifyToken(token) {
  try {
    const [payloadB64, signature] = String(token).split(".");
    if (!payloadB64 || !signature) return null;

    const expectedSignature = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
    // Comparação segura, evita ataques de timing
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSignature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (!payload.exp || Date.now() > payload.exp) return null;

    return payload.email;
  } catch {
    return null;
  }
}
