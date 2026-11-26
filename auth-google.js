'use strict';
/* FRONT ZÉRO — Google sign-in, server side: checks a Google ID token (the "credential" that Google Identity Services hands to the page)
   with no package, only node:crypto.
     const v = createVerifier({ clientId, source });   await v.verify(idToken) -> { sub, iat, exp, jti }   (throws AuthError with .code)
   Checks, in order: compact JWT shape and size; header alg exactly RS256 (so "none", HS256 and every other alg are refused before any
   key is looked at); a kid; the key with that kid in the key set (RSA, at least 2048 bits); the RS256 signature; iss is accounts.google.com
   or https://accounts.google.com; aud is exactly our client ID (azp too when present); exp and iat (and nbf when present) with 60 s of skew;
   sub is a short opaque string.
   Key set: Google's JWKS (https://www.googleapis.com/oauth2/v3/certs), kept for the max-age its Cache-Control gives (1 min to 24 h),
   fetched again early when a token names a kid we do not know (Google rotates its keys), at most once a minute.

   ---------- TEST MODE (local tests only) ----------
   FZ_AUTH_TEST_JWKS = path of a JSON file holding a key set {"keys":[{kty,n,e,kid,...}]} (or that JSON inline). When it is set, the
   server checks tokens against THESE keys only and never contacts Google: tests sign their own tokens with a locally generated RSA key.
   Every other check (alg, iss, aud, exp, iat) stays the same. It is refused, with an error in the log, when the process looks like a
   production host: RENDER is set (Render sets it on every service) or NODE_ENV=production. Without the variable the code path that
   reads test keys is never reached, so a production start (no such variable) cannot enable it. */

const crypto = require('crypto'), fs = require('fs');

const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const SKEW_S = 60, MAX_TOKEN = 4096, MIN_REFETCH_MS = 60e3, FAIL_RETRY_MS = 30e3, FETCH_TIMEOUT_MS = 6000;
const PART = /^[A-Za-z0-9_-]+$/, SUB = /^[A-Za-z0-9_-]{1,255}$/, KID = /^[\x21-\x7e]{1,128}$/;
const CLIENT_ID = /^[A-Za-z0-9._-]{1,200}\.apps\.googleusercontent\.com$/;

class AuthError extends Error { constructor(code) { super(code); this.code = code; } }
const fail = code => { throw new AuthError(code); };
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

function decodePart(s) {
  try { const o = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')); return isObj(o) ? o : null; } catch { return null; }
}

/** Splits and decodes a compact JWT. Nothing here is trusted yet. */
function parseJwt(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > MAX_TOKEN) fail('malformed');
  const parts = token.split('.');
  if (parts.length !== 3 || !parts.every(p => PART.test(p))) fail('malformed');       // an empty signature ("alg":"none" style) fails here too
  const header = decodePart(parts[0]), payload = decodePart(parts[1]);
  if (!header || !payload) fail('malformed');
  return { header, payload, signed: Buffer.from(parts[0] + '.' + parts[1], 'ascii'), sig: Buffer.from(parts[2], 'base64url') };
}

/** A key set -> Map(kid -> public KeyObject). Keys that are not usable RSA signing keys of at least 2048 bits are left out. */
function importJwks(jwks) {
  const out = new Map();
  for (const k of isObj(jwks) && Array.isArray(jwks.keys) ? jwks.keys.slice(0, 50) : []) {
    if (!isObj(k) || k.kty !== 'RSA' || typeof k.kid !== 'string' || !KID.test(k.kid) || typeof k.n !== 'string' || typeof k.e !== 'string') continue;
    if (k.alg !== undefined && k.alg !== 'RS256') continue;
    if (k.use !== undefined && k.use !== 'sig') continue;
    try {
      const key = crypto.createPublicKey({ key: { kty: 'RSA', n: k.n, e: k.e }, format: 'jwk' });
      const bits = key.asymmetricKeyDetails && key.asymmetricKeyDetails.modulusLength;
      if (bits >= 2048 && bits <= 8192) out.set(k.kid, key);
    } catch { /* malformed key: skipped */ }
  }
  return out;
}
const maxAgeOf = cc => { const m = /(?:^|,)\s*max-age=(\d{1,9})/i.exec(String(cc || '')); return m ? Number(m[1]) * 1000 : 3600e3; };

/** Google's key set over HTTPS, cached by its Cache-Control max-age. fetchImpl and now are for the unit tests. */
function googleSource({ url = GOOGLE_JWKS, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let keys = new Map(), until = 0, fetchedAt = -Infinity, failedAt = -Infinity, running = null;
  async function refresh() {
    if (running) return running;
    running = (async () => {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
      try {
        const r = await fetchImpl(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
        if (!r || !r.ok) throw new Error('JWKS HTTP ' + (r && r.status));
        const fresh = importJwks(await r.json());
        if (!fresh.size) throw new Error('JWKS without usable keys');
        const t = now(); keys = fresh; fetchedAt = t;
        const h = r.headers && typeof r.headers.get === 'function' ? r.headers.get('cache-control') : '';
        until = t + Math.min(24 * 3600e3, Math.max(60e3, maxAgeOf(h)));
      } catch (e) { failedAt = now(); console.error('[accounts] Google key set unavailable:', e && e.message); }
      finally { clearTimeout(to); running = null; }
    })();
    return running;
  }
  return {
    name: 'google',
    async key(kid) {
      const t = now();
      if (t >= until && t - failedAt > FAIL_RETRY_MS) await refresh();
      if (!keys.has(kid) && t - fetchedAt > MIN_REFETCH_MS && t - failedAt > FAIL_RETRY_MS) await refresh();       // key rotation, at most once a minute
      return keys.get(kid) || null;
    },
    get cached() { return { kids: [...keys.keys()], until }; },
  };
}

/** Local test keys (FZ_AUTH_TEST_JWKS): a file path or inline JSON. The file is read again when a token names an unknown kid. */
function testSource(spec) {
  const load = () => { const text = String(spec).trim().startsWith('{') ? String(spec) : fs.readFileSync(String(spec), 'utf8'); return importJwks(JSON.parse(text)); };
  let keys = load();
  return { name: 'test', async key(kid) { if (!keys.has(kid)) { try { keys = load(); } catch { /* keep the old set */ } } return keys.get(kid) || null; } };
}

function createVerifier({ clientId, source, now = Date.now }) {
  if (typeof clientId !== 'string' || !clientId) throw new Error('createVerifier: clientId required');
  if (!source || typeof source.key !== 'function') throw new Error('createVerifier: key source required');
  async function verify(token) {
    const { header, payload, signed, sig } = parseJwt(token);
    if (header.alg !== 'RS256') fail('alg');       // "none", HS256 (public key used as an HMAC secret), ES256, PS256...: refused outright
    if (header.typ !== undefined && header.typ !== 'JWT') fail('typ');
    if (header.crit !== undefined || header.jku !== undefined || header.x5u !== undefined || header.jwk !== undefined) fail('header');       // never follow a key the token brings along
    if (typeof header.kid !== 'string' || !KID.test(header.kid)) fail('kid');
    const key = await source.key(header.kid);
    if (!key) fail('unknown_kid');
    const bytes = key.asymmetricKeyDetails.modulusLength / 8;
    if (sig.length !== bytes) fail('signature');
    let ok = false; try { ok = crypto.verify('RSA-SHA256', signed, { key, padding: crypto.constants.RSA_PKCS1_PADDING }, sig); } catch { ok = false; }
    if (!ok) fail('signature');
    // claims (only now, after the signature)
    if (!ISSUERS.has(payload.iss)) fail('iss');
    if (payload.aud !== clientId) fail('aud');       // a string, exactly ours (an array is refused)
    if (payload.azp !== undefined && payload.azp !== clientId) fail('azp');
    const t = Math.floor(now() / 1000);
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) fail('exp');
    if (t > payload.exp + SKEW_S) fail('expired');
    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat) || payload.iat > t + SKEW_S) fail('iat');
    if (payload.exp <= payload.iat || payload.exp - payload.iat > 24 * 3600) fail('exp');
    if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || payload.nbf > t + SKEW_S)) fail('nbf');
    if (typeof payload.sub !== 'string' || !SUB.test(payload.sub)) fail('sub');
    return { sub: payload.sub, iat: payload.iat, exp: payload.exp, jti: typeof payload.jti === 'string' && payload.jti.length <= 128 ? payload.jti : null };
  }
  return { verify, clientId, source: source.name || 'custom' };
}

/** From the environment: { mode: 'off' | 'google' | 'test', verifier, clientId }. 'off' when FZ_GOOGLE_CLIENT_ID is missing or malformed. */
function fromEnv(env = process.env) {
  const clientId = String(env.FZ_GOOGLE_CLIENT_ID || '').trim();
  if (!clientId) return { mode: 'off', verifier: null, clientId: '' };
  if (!CLIENT_ID.test(clientId)) { console.error('[accounts] FZ_GOOGLE_CLIENT_ID does not look like a Google web client ID (…apps.googleusercontent.com): sign-in is off'); return { mode: 'off', verifier: null, clientId: '' }; }
  if (env.FZ_AUTH_TEST_JWKS) {
    if (env.RENDER || String(env.NODE_ENV).toLowerCase() === 'production') {
      console.error('[accounts] FZ_AUTH_TEST_JWKS is set on what looks like a production host (RENDER or NODE_ENV=production): IGNORED, Google keys only.');
    } else {
      try {
        const v = createVerifier({ clientId, source: testSource(env.FZ_AUTH_TEST_JWKS) });
        console.warn('[accounts] TEST MODE: tokens signed by the local test keys of FZ_AUTH_TEST_JWKS are accepted, Google is never contacted. Never set this on a public server.');
        return { mode: 'test', verifier: v, clientId };
      } catch (e) { console.error('[accounts] FZ_AUTH_TEST_JWKS unreadable, sign-in is off:', e.message); return { mode: 'off', verifier: null, clientId: '' }; }
    }
  }
  return { mode: 'google', verifier: createVerifier({ clientId, source: googleSource() }), clientId };
}

module.exports = { createVerifier, googleSource, testSource, importJwks, parseJwt, fromEnv, AuthError, ISSUERS, GOOGLE_JWKS, CLIENT_ID };
