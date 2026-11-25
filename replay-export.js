// FRONT ZÉRO — MEILLEUR MOMENT, part 3: the video (loaded the first time the player asks for one).
// The replay plays once in real time while the engine renders it at the video's own size (1280×720 or 1080×1920, the cinematic camera
// re-framed for the phone picture, not cropped); each frame is copied into a 2D canvas with the overlays (logo, player, map, moment
// title, kill feed, multi-kill counter, end card "Joue gratuitement : <site>") and recorded with MediaRecorder at 30 fps: MP4 (H.264)
// where the browser can, WebM otherwise. Sound: the game's own mix, tapped from the master bus (audio.js stream()), if available.
// The file stays on this device: Web Share (files) where available, a download otherwise. No upload, no server, no account.
import { LANGS } from './replay-rec.js';

const XT = {
  making: ['Création de la vidéo…', 'Making the video…', 'Creando el vídeo…', 'Video wird erstellt…', 'A criar o vídeo…', 'Creazione del video…'],
  makingSub: ['Le moment est rejoué en temps réel : gardez cet onglet ouvert.', 'The moment replays in real time: keep this tab open.', 'El momento se reproduce en tiempo real: mantén esta pestaña abierta.', 'Der Moment läuft in Echtzeit: Lass diesen Tab offen.', 'O momento é reproduzido em tempo real: mantém este separador aberto.', 'Il momento viene riprodotto in tempo reale: tieni aperta questa scheda.'],
  cancel: ['Annuler', 'Cancel', 'Cancelar', 'Abbrechen', 'Cancelar', 'Annulla'],
  ready: ['Vidéo prête', 'Video ready', 'Vídeo listo', 'Video fertig', 'Vídeo pronto', 'Video pronto'],
  readySub: ['Partage-la sur TikTok, YouTube Shorts ou Discord.', 'Share it on TikTok, YouTube Shorts or Discord.', 'Compártelo en TikTok, YouTube Shorts o Discord.', 'Teile es auf TikTok, YouTube Shorts oder Discord.', 'Partilha-o no TikTok, YouTube Shorts ou Discord.', 'Condividilo su TikTok, YouTube Shorts o Discord.'],
  share: ['Partager', 'Share', 'Compartir', 'Teilen', 'Partilhar', 'Condividi'],
  download: ['Télécharger', 'Download', 'Descargar', 'Herunterladen', 'Transferir', 'Scarica'],
  back: ['Retour au replay', 'Back to the replay', 'Volver a la repetición', 'Zurück zur Wiederholung', 'Voltar à repetição', 'Torna al replay'],
  other: ['Autre format', 'Other format', 'Otro formato', 'Anderes Format', 'Outro formato', 'Altro formato'],
  saved: ['Vidéo enregistrée dans vos téléchargements', 'Video saved to your downloads', 'Vídeo guardado en tus descargas', 'Video in deinen Downloads gespeichert', 'Vídeo guardado nas tuas transferências', 'Video salvato nei download'],
  noRec: ['Ce navigateur ne sait pas enregistrer de vidéo. Essayez Chrome, Edge ou Firefox récents.', 'This browser cannot record video. Try a recent Chrome, Edge or Firefox.', 'Este navegador no puede grabar vídeo. Prueba Chrome, Edge o Firefox recientes.', 'Dieser Browser kann kein Video aufnehmen. Versuche ein aktuelles Chrome, Edge oder Firefox.', 'Este navegador não consegue gravar vídeo. Experimenta Chrome, Edge ou Firefox recentes.', 'Questo browser non può registrare video. Prova Chrome, Edge o Firefox recenti.'],
  failed: ['La vidéo n’a pas pu être créée.', 'The video could not be made.', 'No se pudo crear el vídeo.', 'Das Video konnte nicht erstellt werden.', 'Não foi possível criar o vídeo.', 'Impossibile creare il video.'],
  stopped: ['Enregistrement interrompu.', 'Recording interrupted.', 'Grabación interrumpida.', 'Aufnahme unterbrochen.', 'Gravação interrompida.', 'Registrazione interrotta.'],
  shareText: ['Mon meilleur moment sur FRONT ZÉRO : {title}. Joue gratuitement : {url}', 'My best moment in FRONT ZÉRO: {title}. Play free: {url}', 'Mi mejor momento en FRONT ZÉRO: {title}. Juega gratis: {url}', 'Mein bester Moment in FRONT ZÉRO: {title}. Kostenlos spielen: {url}', 'O meu melhor momento no FRONT ZÉRO: {title}. Joga grátis: {url}', 'Il mio momento migliore in FRONT ZÉRO: {title}. Gioca gratis: {url}'],
  mb: ['{n} Mo', '{n} MB', '{n} MB', '{n} MB', '{n} MB', '{n} MB'],
};
const FORMATS = {
  landscape: { W: 1280, H: 720, bps: 4000000 },
  portrait: { W: 1080, H: 1920, bps: 5000000 },
};
const END_CARD = 1.5, MAX_CLIP = 10;
const TYPES_AV = ['video/mp4;codecs="avc1.640028,mp4a.40.2"', 'video/mp4;codecs="avc1.4D4028,mp4a.40.2"', 'video/mp4;codecs="avc1.42E028,mp4a.40.2"', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs="avc1,opus"', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const TYPES_V = ['video/mp4;codecs="avc1.640028"', 'video/mp4;codecs="avc1.4D4028"', 'video/mp4;codecs="avc1.42E028"', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

/** The site address friends open: the same helper as the invite links (online-ui.js through menu.ext.siteUrl), with its own fallback. */
export function siteUrl(menu) {
  try { if (menu && menu.ext && typeof menu.ext.siteUrl === 'function') { const u = menu.ext.siteUrl(); if (u) return u; } } catch { /* fallback below */ }
  try {
    const og = document.querySelector('meta[property="og:url"]');
    if (document.querySelector('meta[name="fz-server"]') && og && /^https:\/\/[^\s"<>]+$/.test(og.content)) return og.content;
    return location.origin + location.pathname;
  } catch { return ''; }
}
const shortUrl = u => String(u || '').replace(/^https?:\/\//, '').replace(/\/(index\.html)?$/, '');

export function pickType(withAudio) {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  for (const t of withAudio ? TYPES_AV : TYPES_V) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* next */ } }
  return '';
}

export function createExporter({ engine: E, audio, i18n, settings, menu, core }) {
  const li = () => Math.max(0, LANGS.indexOf(i18n.lang || 'fr'));
  const X = (k, p) => { let s = (XT[k] && (XT[k][li()] || XT[k][0])) || k; if (p) s = s.replace(/\{(\w+)\}/g, (m, x) => (x in p ? String(p[x]) : m)); return s; };
  const el = (tag, cls, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; if (attrs) for (const k of Object.keys(attrs)) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); } return e; };
  const button = (cls, fid, label, fn) => { const b = el('button', 'fzr-b' + (cls ? ' ' + cls : ''), { type: 'button', 'data-fid': fid, text: label }); b.addEventListener('click', e => { e.stopPropagation(); try { if (audio && audio.ui) audio.ui(); } catch { /* optional */ } fn(); }); return b; };
  let job = null, last = null, panel = null;

  function restoreSize() {
    try { core.setAspect(0); } catch { /* optional */ }
    try { dispatchEvent(new Event('resize')); } catch { /* the next resize does it */ }
  }
  function finishJob(j) {
    if (j.done) return; j.done = true;
    clearInterval(j.watch); document.removeEventListener('visibilitychange', j.onVis);
    try { if (audio && audio.stream) audio.stream(false); } catch { /* optional */ }
    restoreSize(); try { core.end(); } catch { /* optional */ }
    for (const t of j.stream ? j.stream.getVideoTracks() : []) { try { t.stop(); } catch { /* gone */ } }       // the sound track is audio.js's tap: it lives on for the next video
    if (job === j) job = null;
  }

  async function run(m, format, host) {
    if (job) return;
    panel = host; const F = FORMATS[format] || FORMATS.portrait, portrait = format === 'portrait';
    host.hidden = false; host.textContent = ''; dispose(true);
    const box = el('div', 'fzr-xp'), stage = el('div', 'fzr-xs'), info = el('div', 'fzr-xi');
    const h = el('h3', '', { text: X('making') }), p = el('p', '', { text: X('makingSub') }), meta = el('div', 'fzr-meta'), bar = el('div', 'fzr-prog'), fill = el('i'); bar.append(fill);
    const acts = el('div', 'fzr-row');
    const canvas = el('canvas'); canvas.width = F.W; canvas.height = F.H; canvas.setAttribute('aria-hidden', 'true');
    stage.append(canvas); info.append(h, p, bar, meta, acts); box.append(stage, info); host.append(box);
    host.style.background = 'rgba(5,6,4,.97)';
    const g = canvas.getContext('2d', { alpha: false }); g.fillStyle = '#000'; g.fillRect(0, 0, F.W, F.H);
    const fail = msg => { h.textContent = msg; p.textContent = ''; bar.hidden = true; acts.textContent = ''; acts.append(button('', 'replay:export:back', X('back'), () => { host.hidden = true; host.textContent = ''; })); };
    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) { fail(X('noRec')); return; }

    // sound: the game's mix, if audio.js offers its tap
    let aStream = null; try { aStream = audio && audio.stream ? audio.stream(true) : null; } catch { aStream = null; }
    const withAudio = !!(aStream && aStream.getAudioTracks().length);
    const type = pickType(withAudio) || pickType(false);
    if (!type) { try { if (audio && audio.stream) audio.stream(false); } catch { /* optional */ } fail(X('noRec')); return; }
    const vStream = canvas.captureStream(0), vt = vStream.getVideoTracks()[0], manual = !!(vt && vt.requestFrame);
    const stream = manual ? vStream : canvas.captureStream(30);
    if (!manual) for (const t of vStream.getTracks()) t.stop();
    if (withAudio && /mp4a|opus|^video\/(mp4|webm)$/.test(type)) for (const t of aStream.getAudioTracks()) stream.addTrack(t);
    let recd;
    try { recd = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: F.bps, audioBitsPerSecond: 128000 }); }
    catch (e) { console.warn('[replay] recorder', e); try { recd = new MediaRecorder(stream); } catch { fail(X('noRec')); for (const t of stream.getVideoTracks()) t.stop(); try { if (audio && audio.stream) audio.stream(false); } catch { /* optional */ } return; } }

    const clip = core.planClip(m, MAX_CLIP), total = clip.real + END_CARD, site = siteUrl(menu), shortSite = shortUrl(site);
    meta.textContent = `${portrait ? '9:16' : '16:9'} · ${F.W}×${F.H} · ${Math.round(total)} s · ${/mp4/.test(recd.mimeType || type) ? 'MP4' : 'WebM'}`;
    const j = job = { done: false, cancelled: false, stream, rec: recd, chunks: [], t0: 0, endAt: 0, frames: 0, lastFrame: performance.now(), watch: 0, onVis: null, type: recd.mimeType || type, format, W: F.W, H: F.H, clip, title: core.title() };
    j.onVis = () => { if (document.hidden && !j.done) cancel(false, X('stopped')); };
    document.addEventListener('visibilitychange', j.onVis);
    const cancelB = button('', 'replay:export:cancel', X('cancel'), () => cancel(false));
    acts.append(cancelB);

    // the engine renders at the video's size (post chain and drawing buffer), the camera takes its aspect
    const post = core.post, scale = portrait && (E.perf ? E.perf.qLevel : 0) >= 2 ? 0.75 : 1;
    if (post && post.setSize) { try { post.setSize(Math.round(F.W * scale), Math.round(F.H * scale), 1); } catch (e) { console.warn('[replay] size', e); } }
    core.setAspect(F.W / F.H);

    recd.ondataavailable = e => { if (e.data && e.data.size) j.chunks.push(e.data); };
    const stopped = new Promise(res => { recd.onstop = res; recd.onerror = res; });
    const onFrame = gl => {
      if (j.done) return;
      const now = performance.now();
      if (!j.t0) { j.t0 = now; try { recd.start(500); } catch (e) { console.warn('[replay] start', e); cancel(false, X('failed')); return; } }
      let endK = 0;
      if (core.done) { if (!j.endAt) j.endAt = now; endK = Math.min(1, (now - j.endAt) / 300); }
      try { g.drawImage(gl, 0, 0, gl.width, gl.height, 0, 0, F.W, F.H); } catch { /* the next frame */ }
      core.drawOverlay(g, F.W, F.H, { video: true, portrait, letterbox: !portrait, site: shortSite, endK });
      if (manual) { try { vt.requestFrame(); } catch { /* auto capture */ } }
      j.frames++; j.lastFrame = now;
      fill.style.width = Math.min(100, (now - j.t0) / 1000 / total * 100).toFixed(1) + '%';
      if (j.endAt && now - j.endAt >= END_CARD * 1000) { j.done = true; setTimeout(() => { try { recd.stop(); } catch { /* already */ } }, 40); }
    };
    j.watch = setInterval(() => { if (!j.done && performance.now() - j.lastFrame > 4000) cancel(false, X('stopped')); }, 1000);       // the engine stopped drawing (a hidden tab, a lost context)
    core.begin(m, format, clip, onFrame);
    await stopped;
    if (j.cancelled) return;       // cancel() already put everything back
    const blob0 = new Blob(j.chunks, { type: (j.type || 'video/webm').split(';')[0] });
    j.done = false; finishJob(j);
    if (!blob0.size) { fail(X('failed')); return; }
    let blob = blob0;
    if (/webm/.test(blob0.type)) { try { blob = await fixWebmDuration(blob0, (performance.now() - j.t0)); } catch { blob = blob0; } }
    showResult(host, { blob, format, W: F.W, H: F.H, dur: (j.endAt - j.t0) / 1000 + END_CARD, frames: j.frames, title: j.title, site, type: blob.type, m });
  }

  function cancel(silent, msg) {
    const j = job; if (!j || j.done) return;
    j.cancelled = true; j.done = true;
    try { if (j.rec.state !== 'inactive') j.rec.stop(); } catch { /* already */ }
    j.done = false; finishJob(j);
    if (panel && !silent) { if (msg) { panel.textContent = ''; const box = el('div', 'fzr-xp'), info = el('div', 'fzr-xi'); info.append(el('h3', '', { text: msg }), button('', 'replay:export:back', X('back'), () => { panel.hidden = true; panel.textContent = ''; })); box.append(info); panel.append(box); } else { panel.hidden = true; panel.textContent = ''; } }
  }

  function showResult(host, r) {
    const ext = /mp4/.test(r.type) ? 'mp4' : 'webm';
    const slug = String(r.title || 'moment').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'moment';
    const name = `front-zero-${slug}-${r.format === 'portrait' ? '9x16' : '16x9'}.${ext}`;
    const url = URL.createObjectURL(r.blob);
    last = { url, blob: r.blob, name, r };
    try { window.__fzReplayLast = { size: r.blob.size, type: r.type, name, W: r.W, H: r.H, dur: r.dur, frames: r.frames }; } catch { /* tests */ }
    host.textContent = ''; host.hidden = false;
    const box = el('div', 'fzr-xp'), stage = el('div', 'fzr-xs'), info = el('div', 'fzr-xi');
    const vid = el('video', '', { controls: '', loop: '', playsinline: '', 'data-fid': 'replay:video' }); vid.src = url; vid.muted = true; vid.autoplay = true; try { vid.play().catch(() => {}); } catch { /* optional */ }
    stage.append(vid);
    const mb = (r.blob.size / 1048576).toLocaleString(i18n.lang, { maximumFractionDigits: 1 });
    const acts = el('div', 'fzr-row');
    let file = null; try { file = new File([r.blob], name, { type: r.blob.type }); } catch { file = null; }
    const canShare = !!(file && navigator.canShare && (() => { try { return navigator.canShare({ files: [file] }); } catch { return false; } })());
    const text = X('shareText', { title: r.title, url: r.site });
    if (canShare) acts.append(button('fzr-b--main', 'replay:share', X('share'), async () => { try { await navigator.share({ files: [file], title: 'FRONT ZÉRO', text }); } catch (e) { if (!e || e.name !== 'AbortError') download(); } }));
    acts.append(button(canShare ? '' : 'fzr-b--main', 'replay:download', X('download'), download));
    acts.append(button('', 'replay:export:other', X('other'), () => { const o = r.format === 'portrait' ? 'landscape' : 'portrait'; dispose(true); run(r.m, o, host); }));
    acts.append(button('', 'replay:export:back', X('back'), () => { host.hidden = true; host.textContent = ''; dispose(true); }));
    info.append(el('h3', '', { text: X('ready') }), el('p', '', { text: X('readySub') }), el('div', 'fzr-meta', { text: `${r.format === 'portrait' ? '9:16' : '16:9'} · ${r.W}×${r.H} · ${r.dur.toFixed(1)} s · ${ext.toUpperCase()} · ${X('mb', { n: mb })}` }), acts);
    box.append(stage, info); host.append(box);
    try { acts.querySelector('button').focus({ preventScroll: true }); } catch { /* optional */ }
    function download() { const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove(); }
  }
  function dispose(keepPanel) {
    if (last) { try { URL.revokeObjectURL(last.url); } catch { /* gone */ } last = null; }
    if (!keepPanel && panel) { panel.textContent = ''; }
  }

  return {
    run, get busy() { return !!job && !job.done; },
    cancel(silent) { cancel(!!silent); },
    dispose() { if (!job) dispose(false); },
    get last() { return last; },
  };
}

/* ---------- WebM from MediaRecorder has no duration in its header (players then show no length): write it in. ---------- */
async function fixWebmDuration(blob, ms) {
  const headLen = Math.min(blob.size, 65536), buf = new Uint8Array(await blob.slice(0, headLen).arrayBuffer());
  const vint = (p, keepMarker) => { const b = buf[p]; let n = 1, m = 0x80; while (n <= 8 && !(b & m)) { n++; m >>= 1; } if (n > 8) return null; let v = keepMarker ? b : b & (m - 1); for (let i = 1; i < n; i++) v = v * 256 + buf[p + i]; return { v, n }; };
  let p = 0; const id0 = vint(p, true); if (!id0 || id0.v !== 0x1A45DFA3) return blob;
  const s0 = vint(p + id0.n); p += id0.n + s0.n + s0.v;
  const seg = vint(p, true); if (!seg || seg.v !== 0x18538067) return blob;
  const ss = vint(p + seg.n); p += seg.n + ss.n;
  while (p < headLen - 8) {
    const id = vint(p, true), sz = vint(p + id.n); if (!id || !sz) return blob;
    const start = p, body = p + id.n + sz.n, end = body + sz.v;
    if (id.v === 0x1549A966) {       // Info
      let q = body, scale = 1000000;
      while (q < end) { const cid = vint(q, true), cs = vint(q + cid.n); if (!cid || !cs) return blob; if (cid.v === 0x4489) return blob; if (cid.v === 0x2AD7B1) { let v = 0; for (let i = 0; i < cs.v; i++) v = v * 256 + buf[q + cid.n + cs.n + i]; scale = v || scale; } q += cid.n + cs.n + cs.v; }
      if (end > headLen) return blob;
      const dur = new Uint8Array(11); dur[0] = 0x44; dur[1] = 0x89; dur[2] = 0x88; new DataView(dur.buffer).setFloat64(3, ms * 1e6 / scale);
      const size = sz.v + 11, hdr = new Uint8Array(4 + 8); hdr.set(buf.subarray(start, start + 4), 0);
      hdr[4] = 0x01; let v = size; for (let i = 11; i >= 5; i--) { hdr[i] = v & 255; v = Math.floor(v / 256); }
      return new Blob([buf.subarray(0, start), hdr, buf.subarray(body, end), dur, blob.slice(end)], { type: blob.type });
    }
    if (sz.v < 0 || !isFinite(sz.v) || id.v === 0x1F43B675) return blob;       // a cluster before the info: leave it
    p = end;
  }
  return blob;
}
