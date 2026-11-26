/* FRONT ZÉRO - paramètres persistés et écran de configuration. */
import { createI18n, LANGS } from './i18n.js';
import { WEAPONS } from './data.js';

const STORAGE_KEY = 'frontzero.settings';

/* Codes physiques (KeyboardEvent.code) : KeyW est la touche Z sur AZERTY. */
const DEFAULT_KEYS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', slide: 'ShiftLeft', crouch: 'ControlLeft', sprint: 'KeyV',
  /* Pas de T par défaut : accroupi, Ctrl+T ouvrirait un onglet et le navigateur interdit de l'empêcher. */
  fire: 'Mouse0', aim: 'Mouse2', reload: 'KeyR', grenade: 'KeyG', tactical: 'KeyQ', medical: 'KeyX', flashlight: 'KeyL',
  weapon1: 'Digit1', weapon2: 'Digit2', nextWeapon: 'WheelDown',
  interact: 'KeyE', inspect: 'KeyH', scoreboard: 'Tab', ping: 'Mouse1',       /* ping : signaler un endroit à son équipe (Zone en équipes, zone-squads.js) */
  pause: 'KeyP', toggleMute: 'F8', toggleFps: 'F9',
};
const ACTIONS = Object.keys(DEFAULT_KEYS);
const KEYS_REV = 2;
const PAUSE_SAFE = new Set(['pause', 'scoreboard', 'toggleMute', 'toggleFps']);
/* La touche grenade n’apparaît que si un équipement (emplacement 2) existe dans l’arsenal disponible. */
const HAS_GEAR = WEAPONS.some(w => w.slot === 2);
/* Libellés absents de i18n.js (fr, en, es, de, pt, it) ; la clé i18n l’emporte dès qu’elle existe. */
const LOCAL_T = {
  'action.grenade': ['Équipement létal', 'Lethal equipment', 'Equipo letal', 'Tödliche Ausrüstung', 'Equipamento letal', 'Equipaggiamento letale'],
  'action.tactical': ['Équipement tactique', 'Tactical equipment', 'Equipo táctico', 'Taktische Ausrüstung', 'Equipamento tático', 'Equipaggiamento tattico'],
  'action.medical': ['Soin / médical', 'Medical item', 'Objeto médico', 'Sanitätsobjekt', 'Item médico', 'Oggetto medico'],
  'action.flashlight': ['Lampe torche', 'Flashlight', 'Linterna', 'Taschenlampe', 'Lanterna', 'Torcia'],
  'action.ping': ['Signaler (équipe)', 'Ping (squad)', 'Marcar (equipo)', 'Markieren (Team)', 'Marcar (equipa)', 'Segnala (squadra)'],
  'action.inspect': ['Inspecter l’arme', 'Inspect weapon', 'Inspeccionar arma', 'Waffe prüfen', 'Inspecionar arma', 'Ispeziona arma'],
  'preset.mobile': ['Mobile', 'Mobile', 'Móvil', 'Mobil', 'Telemóvel', 'Mobile'],
  /* meilleur moment (replay-rec.js) */
  'group.replay': ['Meilleur moment', 'Best moment', 'Mejor momento', 'Bester Moment', 'Melhor momento', 'Momento migliore'],
  'set.replay': ['Enregistrer le meilleur moment', 'Record the best moment', 'Grabar el mejor momento', 'Besten Moment aufnehmen', 'Gravar o melhor momento', 'Registra il momento migliore'],
  'set.replayHint': ['Rejouable et partageable en vidéo à la fin de la partie', 'Replay it and share it as a video at the end of the match', 'Repítelo y compártelo en vídeo al final de la partida', 'Am Spielende ansehen und als Video teilen', 'Revê-o e partilha-o em vídeo no fim da partida', 'Rivedilo e condividilo in video a fine partita'],
  'set.replayFormat': ['Format vidéo préféré', 'Preferred video format', 'Formato de vídeo preferido', 'Bevorzugtes Videoformat', 'Formato de vídeo preferido', 'Formato video preferito'],
  'opt.portrait': ['Vertical 9:16 (TikTok, Shorts)', 'Vertical 9:16 (TikTok, Shorts)', 'Vertical 9:16 (TikTok, Shorts)', 'Hochformat 9:16 (TikTok, Shorts)', 'Vertical 9:16 (TikTok, Shorts)', 'Verticale 9:16 (TikTok, Shorts)'],
  'opt.landscape': ['Horizontal 16:9 (YouTube, Discord)', 'Landscape 16:9 (YouTube, Discord)', 'Horizontal 16:9 (YouTube, Discord)', 'Querformat 16:9 (YouTube, Discord)', 'Horizontal 16:9 (YouTube, Discord)', 'Orizzontale 16:9 (YouTube, Discord)'],
};
/* Extra settings rows from other modules (input-hub.js: touch and gamepad), added with settings.addPart(section, fn). */
const EXT_PARTS = [];
const KEY_GROUPS = [
  ['group.movement', ['forward', 'back', 'left', 'right', 'jump', 'slide', 'crouch', 'sprint']],
  ['group.combat', ['fire', 'aim', 'reload', ...(HAS_GEAR ? ['grenade'] : []), 'tactical', 'medical', 'interact', 'ping', 'flashlight', 'inspect']],
  ['group.weapons', ['weapon1', 'weapon2', 'nextWeapon']],
  ['group.interface', ['scoreboard', 'pause', 'toggleMute', 'toggleFps']],
];
const RESERVED = new Set(['Escape', 'F5', 'F11', 'F12', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight', 'ContextMenu']);
const CODE_RE = /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-9]|2[0-4])|Numpad(\d|Add|Subtract|Multiply|Divide|Decimal|Enter)|Arrow(Up|Down|Left|Right)|Mouse[0-4]|Wheel(Up|Down)|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Space|Tab|Enter|Backspace|CapsLock|Delete|Insert|Home|End|PageUp|PageDown|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash|IntlRo|IntlYen)$/;
const validCode = c => typeof c === 'string' && CODE_RE.test(c) && !RESERVED.has(c);
const RIGHT_ALIAS = { ShiftRight: 'ShiftLeft', ControlRight: 'ControlLeft', AltRight: 'AltLeft' };

const PRESET_IDS = ['mobile', 'bas', 'moyen', 'eleve', 'ultra'];
const CUSTOM = 'personnalise';
const PRESETS = {
  mobile: { renderScale: 0.6, shadows: 'off', antialiasing: 'off', postProcessing: false, filmGrain: false, vignette: false, particles: 0.25, viewDistance: 90 },       // phones and tablets (picked once on a touch device, input-hub.js)
  bas: { renderScale: 0.7, shadows: 'off', antialiasing: 'off', postProcessing: false, filmGrain: false, vignette: false, particles: 0.35, viewDistance: 90 },
  moyen: { renderScale: 0.85, shadows: 'low', antialiasing: 'fxaa', postProcessing: true, filmGrain: false, vignette: true, particles: 0.65, viewDistance: 140 },
  eleve: { renderScale: 1, shadows: 'medium', antialiasing: 'fxaa', postProcessing: true, filmGrain: true, vignette: true, particles: 1, viewDistance: 200 },
  ultra: { renderScale: 1.25, shadows: 'high', antialiasing: 'msaa', postProcessing: true, filmGrain: true, vignette: true, particles: 1.5, viewDistance: 320 },
};
const PRESET_FIELDS = Object.keys(PRESETS.eleve);

const num = (d, min, max, step) => ({ t: 'n', d, min, max, step });
const bool = d => ({ t: 'b', d });
const en = (d, o) => ({ t: 'e', d, o });
const FPS_LIMITS = [0, 30, 60, 90, 120, 144, 165, 240];
const CROSSHAIRS = ['cross', 'dot', 'circle', 'crossdot'];
const SWATCHES = ['#ffffff', '#e8a628', '#8fb35a', '#35d0e0', '#ff4fd8', '#e0492f'];

const SPEC = {
  'mouse.sensitivity': num(1, 0.1, 5, 0.05),
  'mouse.adsMultiplier': num(0.8, 0.1, 2, 0.05),
  'mouse.invertY': bool(false),
  'mouse.rawInput': bool(true),
  'graphics.preset': en('eleve', [...PRESET_IDS, CUSTOM]),
  'graphics.renderScale': num(1, 0.5, 1.5, 0.05),
  'graphics.autoResolution': bool(true),
  'graphics.shadows': en('medium', ['off', 'low', 'medium', 'high']),
  'graphics.antialiasing': en('fxaa', ['off', 'fxaa', 'msaa']),
  'graphics.postProcessing': bool(true),
  'graphics.filmGrain': bool(true),
  'graphics.vignette': bool(true),
  'graphics.particles': num(1, 0, 1.5, 0.05),
  'graphics.viewDistance': num(200, 60, 400, 10),
  'graphics.fov': num(90, 70, 110, 1),
  'graphics.fpsLimit': en(0, FPS_LIMITS),
  'graphics.showFps': bool(false),
  'graphics.showNet': bool(true),
  'audio.master': num(0.8, 0, 1, 0.01),
  'audio.effects': num(1, 0, 1, 0.01),
  'audio.music': num(0.6, 0, 1, 0.01),
  'audio.ui': num(0.7, 0, 1, 0.01),
  'audio.muteUnfocused': bool(true),
  'gameplay.crosshairStyle': en('cross', CROSSHAIRS),
  'gameplay.crosshairSize': num(1, 0.5, 2.5, 0.05),
  'gameplay.crosshairColor': { t: 'c', d: '#ffffff' },
  'gameplay.hitMarkers': bool(true),
  'gameplay.damageNumbers': bool(false),
  'gameplay.minimap': bool(true),
  'gameplay.minimapRotate': bool(true),
  'gameplay.compass': bool(true),
  'gameplay.reducedMotion': bool(false),
  'gameplay.replay': bool(true),
  'gameplay.replayFormat': en('portrait', ['portrait', 'landscape']),
  language: en('fr', LANGS),
};
const SECTIONS = ['keys', 'mouse', 'graphics', 'audio', 'gameplay', 'language'];
const SECTION_ALIASES = { commandes: 'keys', souris: 'mouse', graphismes: 'graphics', jouabilite: 'gameplay', 'jouabilité': 'gameplay', langue: 'language' };

function normalize(spec, v) {
  if (spec.t === 'b') return typeof v === 'boolean' ? v : undefined;
  if (spec.t === 'e') return spec.o.includes(v) ? v : undefined;
  if (spec.t === 'c') return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const clamped = Math.min(spec.max, Math.max(spec.min, v));
  const snapped = spec.min + Math.round((clamped - spec.min) / spec.step) * spec.step;
  return Number(Math.min(spec.max, snapped).toFixed(4));
}

function detectLanguage() {
  try {
    const list = [...(navigator.languages || []), navigator.language];
    for (const l of list) {
      const code = String(l || '').slice(0, 2).toLowerCase();
      if (LANGS.includes(code)) return code;
    }
  } catch { /* hors navigateur */ }
  return 'fr';
}

function guessLayout() {
  try {
    const l = String(navigator.language || '').toLowerCase();
    if (l === 'fr' || l === 'fr-fr' || l === 'fr-be' || l === 'nl-be') return 'azerty';
    if (l.startsWith('de') || l === 'fr-ch') return 'qwertz';
  } catch { /* hors navigateur */ }
  return 'qwerty';
}
const LAYOUT_LABELS = {
  azerty: { KeyQ: 'A', KeyW: 'Z', KeyA: 'Q', KeyZ: 'W', Semicolon: 'M', KeyM: ',', Comma: ';', Period: ':', Slash: '!', BracketLeft: '^', BracketRight: '$', Quote: 'Ù', Backquote: '²', Minus: ')' },
  qwertz: { KeyY: 'Z', KeyZ: 'Y', Semicolon: 'Ö', Quote: 'Ä', BracketLeft: 'Ü', Minus: 'ß' },
  qwerty: {},
};
const PUNCT = { Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: '\'', Comma: ',', Period: '.', Slash: '/', IntlBackslash: '<', IntlRo: 'Ro', IntlYen: '¥' };
const ARROWS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
const NUMPAD_OPS = { Add: '+', Subtract: '-', Multiply: '*', Divide: '/', Decimal: '.', Enter: '↵' };

const clone = o => JSON.parse(JSON.stringify(o));
const setLeaf = (obj, path, value) => {
  const parts = path.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]] ||= {};
  node[parts[parts.length - 1]] = value;
};
const getLeaf = (obj, path) => {
  let node = obj;
  for (const part of String(path).split('.')) {
    if (node === null || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, part)) return undefined;
    node = node[part];
  }
  return node;
};

function buildDefaults() {
  const out = { keys: { ...DEFAULT_KEYS }, keysRev: KEYS_REV };
  for (const [path, spec] of Object.entries(SPEC)) setLeaf(out, path, spec.d);
  out.language = detectLanguage();
  return out;
}

/* Une sauvegarde d'avant la révision 2 passe aux nouvelles touches, sauf si le joueur les avait changées ou si elles sont déjà prises. */
function migrateKeys(raw, rev) {
  if ((rev | 0) >= KEYS_REV || !raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const keys = { ...raw }, taken = c => Object.values(keys).includes(c);
  if (keys.crouch === 'KeyC' && !taken('ControlLeft')) keys.crouch = 'ControlLeft';
  if (keys.flashlight === 'KeyT' && !taken('KeyL')) keys.flashlight = 'KeyL';
  return keys;
}

function sanitizeKeys(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const keys = {};
  const used = new Set();
  for (const a of ACTIONS) {
    const code = Object.prototype.hasOwnProperty.call(source, a) ? source[a] : undefined;
    if (validCode(code) && !used.has(code)) { keys[a] = code; used.add(code); }
    else if (code === null) keys[a] = null;
  }
  for (const a of ACTIONS) {
    if (a in keys) continue;
    const d = DEFAULT_KEYS[a];
    if (used.has(d)) keys[a] = null;
    else { keys[a] = d; used.add(d); }
  }
  return keys;
}

const matchesPreset = (g, id) => PRESET_FIELDS.every(f => g[f] === PRESETS[id][f]);
const detectPreset = g => PRESET_IDS.find(id => matchesPreset(g, id)) || CUSTOM;

function sanitize(raw) {
  const defaults = buildDefaults();
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = clone(defaults);
  for (const [path, spec] of Object.entries(SPEC)) {
    const v = normalize(spec, getLeaf(src, path));
    if (v !== undefined) setLeaf(out, path, v);
  }
  out.keys = sanitizeKeys(migrateKeys(src.keys, src.keysRev));
  out.keysRev = KEYS_REV;
  if (out.graphics.preset !== CUSTOM && !matchesPreset(out.graphics, out.graphics.preset)) {
    out.graphics.preset = detectPreset(out.graphics);
  }
  return out;
}

export function createSettings() {
  let stored = null;
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text) stored = JSON.parse(text);
  } catch { stored = null; }

  const values = sanitize(stored);
  const listeners = new Set();
  let byCode = new Map();
  let layoutMap = null;
  let layoutKind = guessLayout();
  const layoutListeners = new Set();

  const rebuild = () => {
    byCode = new Map();
    for (const a of ACTIONS) if (values.keys[a]) byCode.set(values.keys[a], a);
  };
  rebuild();

  const persist = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(values)); } catch { /* stockage indisponible */ }
  };
  const emit = changes => {
    for (const [path, value] of changes) {
      for (const fn of [...listeners]) {
        try { fn(path, value); } catch (err) { console.error('[settings] listener', err); }
      }
    }
  };

  function setKey(action, code) {
    if (!ACTIONS.includes(action)) return false;
    if (code !== null && !validCode(code)) return false;
    const old = values.keys[action];
    if (old === code) return true;
    const changes = [];
    if (code !== null) {
      const other = byCode.get(code);
      if (other && other !== action) { values.keys[other] = old ?? null; changes.push([`keys.${other}`, old ?? null]); }
    }
    values.keys[action] = code;
    changes.unshift([`keys.${action}`, code]);
    rebuild();
    persist();
    emit(changes);
    return true;
  }

  function set(path, value) {
    if (typeof path !== 'string') return false;
    if (path.startsWith('keys.')) return setKey(path.slice(5), value);
    const spec = Object.prototype.hasOwnProperty.call(SPEC, path) ? SPEC[path] : null;
    if (!spec) return false;
    const v = normalize(spec, value);
    if (v === undefined) return false;
    if (getLeaf(values, path) === v) return true;
    setLeaf(values, path, v);
    const changes = [[path, v]];
    if (path === 'graphics.preset' && v !== CUSTOM) {
      for (const f of PRESET_FIELDS) {
        if (values.graphics[f] !== PRESETS[v][f]) {
          values.graphics[f] = PRESETS[v][f];
          changes.push([`graphics.${f}`, PRESETS[v][f]]);
        }
      }
    } else if (path.startsWith('graphics.') && PRESET_FIELDS.includes(path.slice(9))) {
      const next = detectPreset(values.graphics);
      if (next !== values.graphics.preset) {
        values.graphics.preset = next;
        changes.push(['graphics.preset', next]);
      }
    }
    persist();
    emit(changes);
    return true;
  }

  function reset(section) {
    const name = section === undefined ? null : (SECTION_ALIASES[section] || section);
    if (name !== null && !SECTIONS.includes(name)) return false;
    const defaults = buildDefaults();
    const changes = [];
    if (name === null || name === 'keys') {
      for (const a of ACTIONS) {
        if (values.keys[a] !== defaults.keys[a]) {
          values.keys[a] = defaults.keys[a];
          changes.push([`keys.${a}`, defaults.keys[a]]);
        }
      }
      rebuild();
    }
    for (const path of Object.keys(SPEC)) {
      if (name !== null && path !== name && !path.startsWith(`${name}.`)) continue;
      const d = getLeaf(defaults, path);
      if (getLeaf(values, path) !== d) { setLeaf(values, path, d); changes.push([path, d]); }
    }
    persist();
    emit(changes);
    return true;
  }

  function action(code) {
    if (typeof code !== 'string' || code === 'Escape') return null;
    return byCode.get(code) || (RIGHT_ALIAS[code] && byCode.get(RIGHT_ALIAS[code])) || null;
  }

  const i18n = () => createI18n(s);

  function keyLabel(code) {
    if (!code) return i18n().t('bind.unbound');
    if (code === 'Escape') return 'Esc';
    const t = i18n().t;
    if (code.startsWith('Numpad')) {
      const k = code.slice(6);
      return t('keyname.Numpad', { k: NUMPAD_OPS[k] || k });
    }
    if (ARROWS[code]) return ARROWS[code];
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^F\d+$/.test(code)) return code;
    const named = `keyname.${code}`;
    const label = t(named);
    if (label !== named) return label;
    if (layoutMap) {
      try {
        const v = layoutMap.get(code);
        if (v) return v.toUpperCase();
      } catch { /* repli ci-dessous */ }
    }
    const byLayout = LAYOUT_LABELS[layoutKind][code];
    if (byLayout) return byLayout;
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    return PUNCT[code] || code;
  }

  function loadLayout() {
    try {
      const kb = typeof navigator !== 'undefined' ? navigator.keyboard : null;
      if (!kb || !kb.getLayoutMap) return;
      kb.getLayoutMap().then(map => {
        layoutMap = map;
        const q = String(map.get('KeyQ') || '').toLowerCase();
        const y = String(map.get('KeyY') || '').toLowerCase();
        layoutKind = q === 'a' ? 'azerty' : y === 'z' ? 'qwertz' : 'qwerty';
        for (const fn of [...layoutListeners]) fn();
      }).catch(() => {});
    } catch { /* API absente */ }
  }

  const s = {
    values,
    get(path) { return getLeaf(values, path); },
    set,
    reset,
    on(event, fn) {
      if (event !== 'change' || typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    action,
    /* Ajouts compatibles avec l’API demandée */
    keyLabel,
    conflict(actionName, code) {
      const other = byCode.get(code);
      return other && other !== actionName ? other : null;
    },
    isPauseSafe: name => PAUSE_SAFE.has(name),
    /** Extra rows from another module: fn({ t, lang, h }) returns nodes, drawn in `section` ('keys:top', 'keys') each time the screen draws it. */
    addPart(section, fn) { const p = { section, fn }; EXT_PARTS.push(p); return () => { const i = EXT_PARTS.indexOf(p); if (i >= 0) EXT_PARTS.splice(i, 1); }; },
    get keyboardLayout() { return layoutKind; },
    mount(container) { return mountScreen(s, container, i18n(), layoutListeners); },
  };
  createI18n(s);
  loadLayout();
  return s;
}

/* ---------- Écran ---------- */

const CSS = `
.fzs{--fzs-bg:#0d0f0b;--fzs-panel:rgba(22,25,18,.86);--fzs-line:rgba(201,185,143,.2);--fzs-sand:#d8c9a3;--fzs-dim:#a5a18a;--fzs-amber:#e8a628;--fzs-red:#e0492f;--fzs-white:#f4ecd8;position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;max-height:100dvh;color:var(--fzs-sand);background:var(--fzs-bg);font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-size:18px;line-height:1.2;text-align:left;box-sizing:border-box}
.fzs *,.fzs *::before,.fzs *::after{box-sizing:border-box;margin:0;padding:0}
.fzs :where(button,select,input){font:inherit;color:inherit}
.fzs :where(button){background:none;border:0;cursor:pointer}
.fzs :focus-visible{outline:2px solid var(--fzs-amber);outline-offset:2px}
.fzs-head{flex:none;padding:18px 28px 12px;border-bottom:1px solid var(--fzs-line)}
.fzs-title{font-size:32px;font-weight:800;letter-spacing:.08em;color:var(--fzs-white)}
.fzs-body{flex:1;min-height:0;display:flex}
.fzs-tabs{flex:none;width:200px;display:flex;flex-direction:column;gap:2px;padding:14px 0;border-right:1px solid var(--fzs-line);overflow:auto}
.fzs-tab{min-height:44px;padding:8px 24px;text-align:left;font-size:20px;font-weight:600;letter-spacing:.06em;color:var(--fzs-dim);border-left:3px solid transparent;white-space:nowrap}
.fzs-tab:hover{color:var(--fzs-sand)}
.fzs-tab[aria-selected="true"]{color:#fff;border-left-color:var(--fzs-amber);background:rgba(232,166,40,.08)}
.fzs-panel{flex:1;min-width:0;overflow:auto;padding:18px 28px 28px;overscroll-behavior:contain}
.fzs-inner{max-width:760px}
.fzs-h{font-size:17px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--fzs-amber);margin:20px 0 6px}
.fzs-h:first-child{margin-top:0}
.fzs-group{background:var(--fzs-panel);border:1px solid var(--fzs-line)}
.fzs-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,300px);align-items:center;gap:16px;min-height:48px;padding:6px 14px;border-top:1px solid var(--fzs-line)}
.fzs-row:first-child{border-top:0}
.fzs-label{font-size:19px;font-weight:500;color:var(--fzs-white)}
.fzs-hint{display:block;margin-top:1px;font-size:15px;font-weight:400;color:var(--fzs-dim)}
.fzs-ctl{display:flex;align-items:center;justify-content:flex-end;gap:10px;min-width:0}
.fzs-ctl input[type=range]{flex:1;min-width:0;height:32px;accent-color:var(--fzs-amber);cursor:pointer;background:transparent}
.fzs-out{flex:none;min-width:58px;text-align:right;font-weight:700;color:#fff;font-variant-numeric:tabular-nums}
.fzs-ctl select{width:100%;min-height:38px;padding:4px 10px;background:#14170f;border:1px solid var(--fzs-line);color:var(--fzs-white);color-scheme:dark;cursor:pointer}
.fzs-switch{position:relative;display:inline-flex;align-items:center;gap:10px;min-height:38px;cursor:pointer}
.fzs-switch input{position:absolute;opacity:0;width:100%;height:100%;inset:0;cursor:pointer}
.fzs-switch i{position:relative;display:block;width:46px;height:24px;background:rgba(255,255,255,.12);border:1px solid var(--fzs-line);transition:background .12s}
.fzs-switch i::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;background:var(--fzs-sand);transition:transform .12s}
.fzs-switch input:checked+i{background:var(--fzs-amber);border-color:var(--fzs-amber)}
.fzs-switch input:checked+i::after{transform:translateX(22px);background:#181407}
.fzs-switch input:focus-visible+i{outline:2px solid var(--fzs-amber);outline-offset:2px}
.fzs-switch span{min-width:76px;text-align:right;font-size:16px;color:var(--fzs-dim)}
.fzs-bind{display:flex;width:100%;gap:6px}
.fzs-key{flex:1;min-width:0;min-height:38px;padding:4px 10px;font-weight:700;letter-spacing:.03em;color:#fff;background:rgba(0,0,0,.3);border:1px solid var(--fzs-line);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fzs-key:hover{border-color:var(--fzs-amber)}
.fzs-key.is-empty{color:var(--fzs-dim);font-weight:500}
.fzs-key.is-capture{background:var(--fzs-amber);border-color:var(--fzs-amber);color:#181407}
.fzs-mini{flex:none;min-height:38px;padding:4px 10px;font-size:16px;font-weight:600;border:1px solid var(--fzs-line)}
.fzs-mini:hover{border-color:var(--fzs-amber);color:#fff}
.fzs-radios{display:flex;flex-wrap:wrap;gap:6px}
.fzs-radio{position:relative;cursor:pointer}
.fzs-radio input{position:absolute;opacity:0;inset:0;width:100%;height:100%;cursor:pointer}
.fzs-radio span{display:flex;align-items:center;min-height:40px;padding:6px 14px;font-weight:600;letter-spacing:.04em;background:var(--fzs-panel);border:1px solid var(--fzs-line)}
.fzs-radio:hover span{border-color:var(--fzs-amber)}
.fzs-radio input:checked+span{background:var(--fzs-amber);border-color:var(--fzs-amber);color:#181407}
.fzs-radio input:focus-visible+span{outline:2px solid var(--fzs-amber);outline-offset:2px}
.fzs-swatches{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:6px}
.fzs-swatch{width:30px;height:30px;border:2px solid var(--fzs-line)!important}
.fzs-swatch[aria-pressed="true"]{border-color:#fff!important;box-shadow:0 0 0 1px #000 inset}
.fzs-swatches input[type=color]{width:34px;height:30px;background:none;border:1px solid var(--fzs-line);cursor:pointer}
.fzs-preview{position:relative;height:96px;border-top:1px solid var(--fzs-line);background:linear-gradient(120deg,#3b3f30,#20231a 55%,#55503d)}
.fzs-xh{position:absolute;left:50%;top:50%;width:0;height:0}
.fzs-xh i{position:absolute;display:block;box-shadow:0 0 1px #000}
.fzs-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-top:18px}
.fzs-note{flex:1 1 240px;font-size:16px;color:var(--fzs-dim)}
.fzs-reset{min-height:42px;padding:6px 16px;font-weight:700;letter-spacing:.06em;border:1px solid var(--fzs-line)}
.fzs-reset:hover{background:var(--fzs-amber);border-color:var(--fzs-amber);color:#181407}
.fzs-status{flex:none;min-height:28px;padding:4px 28px;font-size:17px;color:var(--fzs-amber);border-top:1px solid var(--fzs-line);background:rgba(0,0,0,.25)}
.fzs-ov{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,9,6,.8)}
.fzs-dialog{width:100%;max-width:440px;padding:20px;background:#171a12;border:1px solid var(--fzs-amber)}
.fzs-dialog p{font-size:21px;font-weight:500;color:var(--fzs-white);margin-bottom:16px}
.fzs-dialog div{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
.fzs-dialog button{min-height:42px;padding:6px 20px;font-weight:700;letter-spacing:.06em;border:1px solid var(--fzs-line)}
.fzs-dialog .is-primary{background:var(--fzs-amber);border-color:var(--fzs-amber);color:#181407}
@media(max-width:720px){
.fzs-head{padding:12px 16px 8px}.fzs-title{font-size:26px}
.fzs-body{flex-direction:column}
.fzs-tabs{width:100%;flex-direction:row;padding:0 8px;border-right:0;border-bottom:1px solid var(--fzs-line);overflow-x:auto;overflow-y:hidden}
.fzs-tab{padding:8px 12px;font-size:18px;border-left:0;border-bottom:3px solid transparent}
.fzs-tab[aria-selected="true"]{border-bottom-color:var(--fzs-amber)}
.fzs-panel{padding:14px 16px 20px}
.fzs-row{grid-template-columns:minmax(0,1fr);gap:4px;padding:8px 12px}
.fzs-ctl{justify-content:flex-start}.fzs-swatches{justify-content:flex-start}
.fzs-status{padding:4px 16px}
}
@media(prefers-reduced-motion:reduce){.fzs *{transition:none!important}}
`;

function injectCss() {
  try {
    if (document.getElementById('fzs-style')) return;
    const style = document.createElement('style');
    style.id = 'fzs-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  } catch { /* sans document */ }
}

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'value' || k === 'checked' || k === 'type' || k === 'name') el[k] = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  }
  return el;
}

const pct = v => `${Math.round(v * 100)} %`;
const multi = v => `×${Number(v).toFixed(2)}`;

let mountSeq = 0;

function mountScreen(s, container, i18n, layoutListeners) {
  if (container.__fzsDestroy) container.__fzsDestroy();
  injectCss();
  const t = (key, params) => { const v = i18n.t(key, params); if (v !== key || !LOCAL_T[key]) return v; return LOCAL_T[key][Math.max(0, LANGS.indexOf(i18n.lang))] || LOCAL_T[key][0]; };
  const uid = `fzs${++mountSeq}`;
  const root = h('div', { class: 'fzs' });
  let active = 'keys';
  let updaters = new Map();
  let focusable = new Map();
  let statusEl = null;
  let capture = null;
  let dialog = null;
  let guardOff = null;

  const say = msg => { if (statusEl) statusEl.textContent = msg; };
  const track = (id, el) => { focusable.set(id, el); el.setAttribute('data-fid', id); return el; };
  const onUpdate = (path, fn) => {
    const list = updaters.get(path) || [];
    list.push(fn);
    updaters.set(path, list);
  };

  /* Empêche le relâchement de la touche ou du bouton capturé d’agir sur l’interface. */
  function guardRelease() {
    if (guardOff) guardOff();
    let timer = null;
    const block = e => { e.preventDefault(); e.stopImmediatePropagation(); };
    const release = e => {
      if (e.type === 'mouseup') e.preventDefault();
      if (timer === null) timer = setTimeout(off, 120);
    };
    const off = () => {
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener('keyup', release, true);
      window.removeEventListener('mouseup', release, true);
      window.removeEventListener('blur', off);
      for (const type of ['click', 'auxclick', 'contextmenu']) window.removeEventListener(type, block, true);
      guardOff = null;
    };
    window.addEventListener('keyup', release, true);
    window.addEventListener('mouseup', release, true);
    window.addEventListener('blur', off);
    for (const type of ['click', 'auxclick', 'contextmenu']) window.addEventListener(type, block, true);
    guardOff = off;
  }

  function endCapture() {
    if (!capture) return;
    const c = capture;
    capture = null;
    window.removeEventListener('keydown', c.onKey, true);
    window.removeEventListener('mousedown', c.onMouse, true);
    window.removeEventListener('wheel', c.onWheel, true);
    window.removeEventListener('contextmenu', c.onMenu, true);
    window.removeEventListener('blur', c.onBlur);
    c.paint();
  }

  function commitCapture(code) {
    const { action, btn } = capture;
    const name = t(`action.${action}`);
    if (!validCode(code)) { say(t('bind.reserved', { key: s.keyLabel(code) })); return; }
    endCapture();
    if (!code.startsWith('Wheel')) guardRelease();
    const other = s.conflict(action, code);
    if (other) {
      openDialog({
        text: t('bind.conflict', { key: s.keyLabel(code), other: t(`action.${other}`), action: name }),
        confirm: t('bind.swap'),
        returnTo: btn,
        onConfirm: () => {
          s.set(`keys.${action}`, code);
          say(t('bind.done', { action: name, key: s.keyLabel(code) }));
        },
      });
      return;
    }
    s.set(`keys.${action}`, code);
    say(t('bind.done', { action: name, key: s.keyLabel(code) }));
    btn.focus?.();
  }

  function startCapture(action, btn, paint) {
    endCapture();
    const stop = e => { e.preventDefault(); e.stopImmediatePropagation(); };
    const cancel = () => { endCapture(); say(''); btn.focus?.(); };
    const onKey = e => {
      stop(e);
      if (e.repeat) return;
      if (e.code === 'Escape') { cancel(); guardRelease(); return; }
      commitCapture(e.code);
    };
    const onMouse = e => {
      if (e.target?.closest?.('[data-fzs-cancel]')) return;
      stop(e);
      if (e.button >= 0 && e.button <= 4) commitCapture(`Mouse${e.button}`);
    };
    const onWheel = e => {
      stop(e);
      if (e.deltaY) commitCapture(e.deltaY < 0 ? 'WheelUp' : 'WheelDown');
    };
    capture = { action, btn, onKey, onMouse, onWheel, onMenu: stop, onBlur: cancel, cancel, paint };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onMouse, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    window.addEventListener('contextmenu', stop, true);
    window.addEventListener('blur', cancel);
    paint();
    say(t('bind.instructions', { action: t(`action.${action}`) }));
  }

  function closeDialog(refocus = true) {
    if (!dialog) return;
    const d = dialog;
    dialog = null;
    window.removeEventListener('keydown', d.onKey, true);
    d.el.remove();
    if (refocus) d.returnTo?.focus?.();
  }

  function openDialog({ text, confirm, onConfirm, returnTo }) {
    closeDialog(false);
    const msgId = `${uid}-dialog`;
    const cancelBtn = h('button', { type: 'button', text: t('common.cancel'), onclick: () => closeDialog() });
    const okBtn = h('button', {
      type: 'button', class: 'is-primary', text: confirm,
      onclick: () => { closeDialog(); onConfirm(); },
    });
    const el = h('div', { class: 'fzs-ov' },
      h('div', { class: 'fzs-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': msgId },
        h('p', { id: msgId, text }), h('div', null, cancelBtn, okBtn)));
    const onKey = e => {
      if (e.repeat) { e.preventDefault(); return; }
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeDialog();
      } else if (e.key === 'Tab' || e.code === 'Tab') {
        e.preventDefault();
        (document.activeElement === okBtn ? cancelBtn : okBtn).focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    dialog = { el, onKey, returnTo, okBtn, cancelBtn };
    root.append(el);
    okBtn.focus?.();
  }

  /* ---------- Contrôles ---------- */
  const row = (labelKey, control, opts = {}) => {
    const labelId = `${uid}-l-${labelKey.replace(/\W/g, '-')}`;
    if (control.setLabel) control.setLabel(labelId);
    return h('div', { class: 'fzs-row' },
      h('div', { class: 'fzs-label', id: labelId }, t(labelKey),
        opts.hint ? h('small', { class: 'fzs-hint', text: t(opts.hint) }) : null),
      control.el || control);
  };

  function slider(path, fmt) {
    const spec = SPEC[path];
    const out = h('output', { class: 'fzs-out', text: fmt(s.get(path)) });
    const input = track(path, h('input', { type: 'range', min: spec.min, max: spec.max, step: spec.step }));
    input.value = String(s.get(path));
    input.setAttribute('aria-valuetext', fmt(s.get(path)));
    input.addEventListener('input', () => s.set(path, Number(input.value)));
    onUpdate(path, v => {
      if (Number(input.value) !== v) input.value = String(v);
      out.textContent = fmt(v);
      input.setAttribute('aria-valuetext', fmt(v));
    });
    return { el: h('div', { class: 'fzs-ctl' }, input, out), setLabel: id => input.setAttribute('aria-labelledby', id) };
  }

  function toggle(path) {
    const state = h('span', { text: t(s.get(path) ? 'common.on' : 'common.off') });
    const input = track(path, h('input', { type: 'checkbox', role: 'switch' }));
    input.checked = !!s.get(path);
    input.addEventListener('change', () => s.set(path, !!input.checked));
    onUpdate(path, v => { input.checked = !!v; state.textContent = t(v ? 'common.on' : 'common.off'); });
    return {
      el: h('div', { class: 'fzs-ctl' }, h('label', { class: 'fzs-switch' }, state, input, h('i', { 'aria-hidden': 'true' }))),
      setLabel: id => input.setAttribute('aria-labelledby', id),
    };
  }

  function select(path, options) {
    const el = track(path, h('select', null, options.map(([v, label]) => h('option', { value: String(v), text: label }))));
    el.value = String(s.get(path));
    el.addEventListener('change', () => {
      const hit = options.find(([v]) => String(v) === el.value);
      if (hit) s.set(path, hit[0]);
    });
    onUpdate(path, v => { el.value = String(v); });
    return { el: h('div', { class: 'fzs-ctl' }, el), setLabel: id => el.setAttribute('aria-labelledby', id) };
  }

  function radios(path, options, labelKey) {
    const name = `${uid}-${path}`;
    const inputs = [];
    const group = h('div', { class: 'fzs-radios', role: 'radiogroup', 'aria-label': t(labelKey) },
      options.map(([v, label]) => {
        const input = track(`${path}:${v}`, h('input', { type: 'radio', name }));
        input.checked = s.get(path) === v;
        input.addEventListener('change', () => { if (input.checked) s.set(path, v); });
        inputs.push([v, input]);
        return h('label', { class: 'fzs-radio' }, input, h('span', { text: label }));
      }));
    onUpdate(path, val => inputs.forEach(([v, input]) => { input.checked = v === val; }));
    return group;
  }

  function bindRow(action) {
    const btn = track(`keys.${action}`, h('button', { type: 'button', class: 'fzs-key' }));
    const cancelBtn = h('button', {
      type: 'button', class: 'fzs-mini', 'data-fzs-cancel': '', text: t('common.cancel'), hidden: true,
      onclick: () => capture?.cancel(),
    });
    const paint = () => {
      const on = capture && capture.action === action;
      const code = s.get(`keys.${action}`);
      btn.textContent = on ? t('bind.press') : s.keyLabel(code);
      btn.className = `fzs-key${on ? ' is-capture' : ''}${!on && !code ? ' is-empty' : ''}`;
      btn.setAttribute('aria-label', `${t(`action.${action}`)} : ${on ? t('bind.press') : s.keyLabel(code)}`);
      if (on) cancelBtn.removeAttribute('hidden');
      else cancelBtn.setAttribute('hidden', '');
    };
    btn.addEventListener('click', () => {
      if (capture && capture.action === action) return;
      startCapture(action, btn, paint);
    });
    onUpdate(`keys.${action}`, paint);
    paint();
    const labelId = `${uid}-a-${action}`;
    return h('div', { class: 'fzs-row' },
      h('div', { class: 'fzs-label', id: labelId, text: t(`action.${action}`) }),
      h('div', { class: 'fzs-ctl' }, h('div', { class: 'fzs-bind' }, btn, cancelBtn)));
  }

  function crosshairPreview() {
    const box = h('div', { class: 'fzs-xh' });
    const wrap = h('div', { class: 'fzs-preview', role: 'img', 'aria-label': t('set.crosshairPreview') }, box);
    const paint = () => {
      box.textContent = '';
      const style = s.get('gameplay.crosshairStyle');
      const size = s.get('gameplay.crosshairSize');
      const color = s.get('gameplay.crosshairColor');
      const add = css => {
        const i = document.createElement('i');
        i.style.cssText = css;
        box.append(i);
      };
      const len = Math.round(8 * size), gap = Math.round(4 * size), w = Math.max(2, Math.round(2 * size));
      if (style === 'cross' || style === 'crossdot') {
        add(`left:${-w / 2}px;top:${-gap - len}px;width:${w}px;height:${len}px;background:${color}`);
        add(`left:${-w / 2}px;top:${gap}px;width:${w}px;height:${len}px;background:${color}`);
        add(`left:${-gap - len}px;top:${-w / 2}px;width:${len}px;height:${w}px;background:${color}`);
        add(`left:${gap}px;top:${-w / 2}px;width:${len}px;height:${w}px;background:${color}`);
      }
      if (style === 'dot' || style === 'crossdot') {
        const d = Math.max(3, Math.round(3 * size));
        add(`left:${-d / 2}px;top:${-d / 2}px;width:${d}px;height:${d}px;border-radius:50%;background:${color}`);
      }
      if (style === 'circle') {
        const d = Math.round(18 * size);
        add(`left:${-d / 2}px;top:${-d / 2}px;width:${d}px;height:${d}px;border-radius:50%;border:${w}px solid ${color}`);
      }
    };
    ['gameplay.crosshairStyle', 'gameplay.crosshairSize', 'gameplay.crosshairColor'].forEach(p => onUpdate(p, paint));
    paint();
    return wrap;
  }

  function colorControl() {
    const path = 'gameplay.crosshairColor';
    const buttons = SWATCHES.map(c => {
      const b = track(`${path}:${c}`, h('button', {
        type: 'button', class: 'fzs-swatch', 'aria-label': c, 'aria-pressed': String(s.get(path) === c),
        onclick: () => s.set(path, c),
      }));
      b.style.background = c;
      return [c, b];
    });
    const input = track(path, h('input', { type: 'color', 'aria-label': t('set.crosshairColor') }));
    input.value = s.get(path);
    input.addEventListener('input', () => s.set(path, input.value));
    onUpdate(path, v => {
      input.value = v;
      buttons.forEach(([c, b]) => b.setAttribute('aria-pressed', String(c === v)));
    });
    return h('div', { class: 'fzs-ctl' }, h('div', { class: 'fzs-swatches' }, buttons.map(([, b]) => b), input));
  }

  const group = (titleKey, ...rows) => [h('h3', { class: 'fzs-h', text: t(titleKey) }), h('div', { class: 'fzs-group' }, rows)];
  const quality = [['off', t('opt.off')], ['low', t('opt.low')], ['medium', t('opt.medium')], ['high', t('opt.high')]];
  const extParts = section => EXT_PARTS.filter(p => p.section === section).flatMap(p => { try { return [].concat(p.fn({ t, lang: i18n.lang, h }) || []); } catch (e) { console.warn('[settings] extra rows', e); return []; } });

  const builders = {
    keys: () => [...extParts('keys:top'), ...KEY_GROUPS.flatMap(([title, list]) => group(title, list.map(bindRow))), ...extParts('keys')],
    mouse: () => group('section.mouse',
      row('set.sensitivity', slider('mouse.sensitivity', v => v.toFixed(2))),
      row('set.adsMultiplier', slider('mouse.adsMultiplier', multi)),
      row('set.invertY', toggle('mouse.invertY')),
      row('set.rawInput', toggle('mouse.rawInput'), { hint: 'set.rawInputHint' })),
    graphics: () => [
      ...group('set.preset', h('div', { class: 'fzs-row', style: 'grid-template-columns:minmax(0,1fr)' },
        radios('graphics.preset', [...PRESET_IDS, CUSTOM].map(id => [id, t(`preset.${id}`)]), 'set.preset'))),
      ...group('group.quality',
        row('set.renderScale', slider('graphics.renderScale', pct)),
        row('set.autoResolution', toggle('graphics.autoResolution'), { hint: 'set.autoResolutionHint' }),
        row('set.shadows', select('graphics.shadows', quality)),
        row('set.antialiasing', select('graphics.antialiasing', [['off', t('opt.off')], ['fxaa', t('opt.fxaa')], ['msaa', t('opt.msaa')]])),
        row('set.viewDistance', slider('graphics.viewDistance', v => `${v} m`))),
      ...group('group.effects',
        row('set.postProcessing', toggle('graphics.postProcessing')),
        row('set.filmGrain', toggle('graphics.filmGrain')),
        row('set.vignette', toggle('graphics.vignette')),
        row('set.particles', slider('graphics.particles', pct))),
      ...group('group.display',
        row('set.fov', slider('graphics.fov', v => `${v}°`)),
        row('set.fpsLimit', select('graphics.fpsLimit', FPS_LIMITS.map(v => [v, v === 0 ? t('opt.unlimited') : String(v)]))),
        row('set.showFps', toggle('graphics.showFps')),
        row('set.showNet', toggle('graphics.showNet'))),
    ],
    audio: () => group('section.audio',
      row('set.master', slider('audio.master', pct)),
      row('set.effects', slider('audio.effects', pct)),
      row('set.music', slider('audio.music', pct)),
      row('set.ui', slider('audio.ui', pct)),
      row('set.muteUnfocused', toggle('audio.muteUnfocused'))),
    gameplay: () => [
      ...group('group.crosshair',
        row('set.crosshairStyle', select('gameplay.crosshairStyle', CROSSHAIRS.map(id => [id, t(`crosshair.${id}`)]))),
        row('set.crosshairSize', slider('gameplay.crosshairSize', multi)),
        row('set.crosshairColor', colorControl()),
        crosshairPreview()),
      ...group('group.feedback',
        row('set.hitMarkers', toggle('gameplay.hitMarkers')),
        row('set.damageNumbers', toggle('gameplay.damageNumbers')),
        row('set.minimap', toggle('gameplay.minimap')),
        row('set.minimapRotate', toggle('gameplay.minimapRotate')),
        row('set.compass', toggle('gameplay.compass'))),
      ...group('group.accessibility',
        row('set.reducedMotion', toggle('gameplay.reducedMotion'), { hint: 'set.reducedMotionHint' })),
      ...group('group.replay',
        row('set.replay', toggle('gameplay.replay'), { hint: 'set.replayHint' }),
        row('set.replayFormat', select('gameplay.replayFormat', [['portrait', t('opt.portrait')], ['landscape', t('opt.landscape')]]))),
    ],
    language: () => group('section.language', h('div', { class: 'fzs-row', style: 'grid-template-columns:minmax(0,1fr)' },
      radios('language', LANGS.map(code => [code, t(`lang.${code}`)]), 'section.language'))),
  };

  function selectTab(id, focus) {
    if (id === active) { if (focus) focusable.get(`tab:${id}`)?.focus?.(); return; }
    endCapture();
    closeDialog(false);
    active = id;
    say('');
    render(focus ? `tab:${id}` : null);
  }

  function onTabKey(e) {
    const i = SECTIONS.indexOf(active);
    const moves = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: SECTIONS.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    selectTab(SECTIONS[(moves[e.key] + SECTIONS.length) % SECTIONS.length], true);
  }

  function render(focusId) {
    let wanted = focusId;
    if (wanted === undefined) {
      try { wanted = document.activeElement?.getAttribute?.('data-fid') || null; } catch { wanted = null; }
    }
    endCapture();
    closeDialog(false);
    updaters = new Map();
    focusable = new Map();
    const tabs = h('div', { class: 'fzs-tabs', role: 'tablist', 'aria-label': t('settings.title'), onkeydown: onTabKey },
      SECTIONS.map(id => track(`tab:${id}`, h('button', {
        type: 'button', class: 'fzs-tab', role: 'tab', id: `${uid}-tab-${id}`,
        'aria-selected': String(id === active), 'aria-controls': `${uid}-panel`,
        tabindex: id === active ? '0' : '-1', text: t(`section.${id}`),
        onclick: () => selectTab(id, true),
      }))));
    const resetBtn = h('button', {
      type: 'button', class: 'fzs-reset', text: t('common.reset'),
      onclick: () => openDialog({
        text: t('common.resetConfirm', { section: t(`section.${active}`) }),
        confirm: t('common.confirm'),
        returnTo: resetBtn,
        onConfirm: () => { s.reset(active); say(t('common.reset')); },
      }),
    });
    const panel = h('div', {
      class: 'fzs-panel', id: `${uid}-panel`, role: 'tabpanel', tabindex: '0',
      'aria-labelledby': `${uid}-tab-${active}`,
    }, h('div', { class: 'fzs-inner' }, builders[active](),
      h('div', { class: 'fzs-foot' },
        active === 'keys' ? h('p', { class: 'fzs-note', text: t('bind.escapeNote') }) : h('span'),
        resetBtn)));
    statusEl = h('div', { class: 'fzs-status', role: 'status', 'aria-live': 'polite' });
    root.textContent = '';
    root.append(
      h('div', { class: 'fzs-head' }, h('h2', { class: 'fzs-title', text: t('settings.title') })),
      h('div', { class: 'fzs-body' }, tabs, panel),
      statusEl);
    if (wanted && focusable.has(wanted)) focusable.get(wanted).focus?.();
  }

  const offChange = s.on('change', (path, value) => {
    (updaters.get(path) || []).forEach(fn => fn(value));
  });
  const offLang = i18n.on('change', () => render());
  const onLayout = () => render();
  layoutListeners.add(onLayout);

  const destroy = () => {
    endCapture();
    closeDialog(false);
    if (guardOff) guardOff();
    offChange();
    offLang();
    layoutListeners.delete(onLayout);
    root.remove();
    delete container.__fzsDestroy;
  };
  container.__fzsDestroy = destroy;
  container.textContent = '';
  container.append(root);
  render(null);
  return destroy;
}
