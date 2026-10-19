// Verifica el token de Cloudflare Access en cada petición a /api/*.
//
// Variables (Cloudflare → tu Worker → Settings → Variables and Secrets):
//   ACCESS_TEAM_DOMAIN  ej. "miequipo.cloudflareaccess.com"
//   ACCESS_AUD          el "Application Audience (AUD) Tag" de tu aplicación de Access
//   ALLOWED_EMAIL       (opcional) tu correo; si se define, solo ese correo entra
//   APP_KEY             (alternativa sin Access) una clave que escribes una vez en cada dispositivo
//   Sin ninguna de estas variables, la API queda abierta (sin inicio de sesión).
//   DEV_BYPASS = "1"    solo para desarrollo local (npm run preview). Nunca en producción.

let certCache = { keys: null, at: 0, team: '' };

const b64urlToBytes = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  let bin;
  try { bin = atob(s); } catch { throw new Error('Token mal formado'); }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const b64urlToJSON = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

async function getKeys(team) {
  const fresh = Date.now() - certCache.at < 60 * 60 * 1000;
  if (certCache.keys && certCache.team === team && fresh) return certCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('No se pudieron obtener los certificados de Access');
  const { keys } = await res.json();
  certCache = { keys, at: Date.now(), team };
  return keys;
}

async function verifyAccessJwt(token, env) {
  const team = env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const [h, p, sig] = token.split('.');
  if (!h || !p || !sig) throw new Error('Token mal formado');
  const header = b64urlToJSON(h);
  const payload = b64urlToJSON(p);

  const keys = await getKeys(team);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Llave desconocida');

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`)
  );
  if (!ok) throw new Error('Firma inválida');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('Token expirado');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) throw new Error('Audiencia incorrecta');
  if (payload.iss && payload.iss !== `https://${team}`) throw new Error('Emisor incorrecto');
  if (env.ALLOWED_EMAIL && (payload.email || '').toLowerCase() !== env.ALLOWED_EMAIL.toLowerCase()) {
    throw new Error('Correo no autorizado');
  }
  return payload;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

// Comparación en tiempo constante (evita adivinar la clave midiendo tiempos)
async function sameText(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Devuelve una Response de error si la petición no está autorizada; null si puede pasar. */
export async function checkAccess(request, env) {
  if (env.DEV_BYPASS === '1') return null;

  // Modo "clave": si APP_KEY está definida, cada dispositivo debe enviar esa clave.
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    if (!env.APP_KEY) return null; // Modo abierto: sin inicio de sesión
    const key = request.headers.get('x-caudal-key') || '';
    if (!(await sameText(key, env.APP_KEY))) {
      return json({ error: 'key', message: key ? 'Clave incorrecta' : 'Falta la clave de la app' }, 401);
    }
    return null;
  }

  // Modo Cloudflare Access
  const cookie = request.headers.get('cookie') || '';
  const fromCookie = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  const token = request.headers.get('cf-access-jwt-assertion') || fromCookie;
  if (!token) return json({ error: 'auth', message: 'Sesión no encontrada' }, 401);
  try {
    await verifyAccessJwt(token, env);
  } catch (e) {
    return json({ error: 'auth', message: e.message }, 401);
  }
  return null;
}
