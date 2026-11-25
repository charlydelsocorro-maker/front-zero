// FRONT ZÉRO — HUD and weapon motion. Wraps the HUD's own methods (engine-hud.js is not edited), so every existing call site gets the feedback.
// One-shot effects restart by swapping between two identical keyframe names: no forced reflow, no allocation per event. Transforms and opacity only.

const CSS = `
html.fzh-on #hud [data-h="feed"] div{animation:fzh-feed .17s cubic-bezier(.2,.8,.3,1) both}
@keyframes fzh-feed{from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:none}}
html.fzh-on #hud [data-h="hit"].p0{animation:fzh-hit0 .13s cubic-bezier(.2,.8,.3,1)}
html.fzh-on #hud [data-h="hit"].p1{animation:fzh-hit1 .13s cubic-bezier(.2,.8,.3,1)}
@keyframes fzh-hit0{from{transform:scale(1.45)}to{transform:none}}
@keyframes fzh-hit1{from{transform:scale(1.45)}to{transform:none}}
#fzh{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#fzh .kc{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0}
#fzh .kc i{position:absolute;width:13px;height:13px;border:solid #e0492f;border-width:0;filter:drop-shadow(0 0 1px #000)}
#fzh .kc i:nth-child(1){left:-21px;top:-21px;border-left-width:3px;border-top-width:3px}
#fzh .kc i:nth-child(2){left:8px;top:-21px;border-right-width:3px;border-top-width:3px}
#fzh .kc i:nth-child(3){left:-21px;top:8px;border-left-width:3px;border-bottom-width:3px}
#fzh .kc i:nth-child(4){left:8px;top:8px;border-right-width:3px;border-bottom-width:3px}
#fzh .kc.head i{border-color:#e8a628}
#fzh .kc.p0{animation:fzh-kill0 .34s cubic-bezier(.16,.8,.3,1)}
#fzh .kc.p1{animation:fzh-kill1 .34s cubic-bezier(.16,.8,.3,1)}
@keyframes fzh-kill0{0%{opacity:1;transform:scale(.55) rotate(-8deg)}30%{opacity:1;transform:scale(1.14)}70%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.06)}}
@keyframes fzh-kill1{0%{opacity:1;transform:scale(.55) rotate(-8deg)}30%{opacity:1;transform:scale(1.14)}70%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.06)}}
html.fzh-on #hud [data-h="dmg"] i:before{top:-4px;width:190px;height:30px;margin-left:-95px;background:radial-gradient(ellipse at 50% 150%,transparent 56%,rgba(232,60,30,.92) 60%,rgba(232,60,30,.5) 68%,transparent 74%);clip-path:none}
html.fzh-on #hud [data-h="dmg"] i.p0:before{animation:fzh-arc0 .2s ease-out}
html.fzh-on #hud [data-h="dmg"] i.p1:before{animation:fzh-arc1 .2s ease-out}
@keyframes fzh-arc0{from{transform:translateY(-9px) scaleX(.82)}to{transform:none}}
@keyframes fzh-arc1{from{transform:translateY(-9px) scaleX(.82)}to{transform:none}}
#hud [data-h="am"],#hud [data-h="vit"] .n{display:inline-block;transform-origin:50% 70%}
html.fzh-on #hud [data-h="am"].p0{animation:fzh-tick0 .09s ease-out}
html.fzh-on #hud [data-h="am"].p1{animation:fzh-tick1 .09s ease-out}
@keyframes fzh-tick0{from{transform:translateY(3px) scale(.95)}to{transform:none}}
@keyframes fzh-tick1{from{transform:translateY(3px) scale(.95)}to{transform:none}}
html.fzh-on #hud [data-h="am"].low{animation:fzh-low .7s ease-in-out infinite alternate}
@keyframes fzh-low{from{opacity:1}to{opacity:.55}}
html.fzh-on #hud [data-h="vit"] .n.p0{animation:fzh-hurt0 .2s ease-out}
html.fzh-on #hud [data-h="vit"] .n.p1{animation:fzh-hurt1 .2s ease-out}
@keyframes fzh-hurt0{0%{transform:translateX(-3px) scale(1.09)}45%{transform:translateX(2px)}100%{transform:none}}
@keyframes fzh-hurt1{0%{transform:translateX(-3px) scale(1.09)}45%{transform:translateX(2px)}100%{transform:none}}
#hud [data-h="vit"] [data-h].meter{position:relative;overflow:hidden}
#hud .meter u{position:relative;z-index:1}
#hud .meter s{position:absolute;left:0;top:0;width:100%;height:100%;background:#e0492f;transform-origin:0 50%;transform:scaleX(0);text-decoration:none}
#hud .meter s.go{transition:transform .34s cubic-bezier(.3,.6,.3,1) .24s}
#hud [data-h="arm"] s{background:#bcd6f2}
html.fzh-on #hud :is([data-h="sL"],[data-h="sR"]) b{display:inline-block}
html.fzh-on #hud :is([data-h="sL"],[data-h="sR"]) b.p0{animation:fzh-pop0 .22s cubic-bezier(.2,.8,.3,1)}
html.fzh-on #hud :is([data-h="sL"],[data-h="sR"]) b.p1{animation:fzh-pop1 .22s cubic-bezier(.2,.8,.3,1)}
@keyframes fzh-pop0{from{transform:scale(1.34)}to{transform:none}}
@keyframes fzh-pop1{from{transform:scale(1.34)}to{transform:none}}
html.fzh-on #hud [data-h="timer"]{display:inline-block}
html.fzh-on #hud [data-h="timer"].p0{animation:fzh-pop0 .2s ease-out}
html.fzh-on #hud [data-h="timer"].p1{animation:fzh-pop1 .2s ease-out}
html.fzh-on #hud [data-h="earn"] b{display:inline-block;transform-origin:100% 50%}
html.fzh-on #hud [data-h="earn"] b.p0{animation:fzh-pop0 .2s ease-out}
html.fzh-on #hud [data-h="earn"] b.p1{animation:fzh-pop1 .2s ease-out}
html.fzh-on #hud [data-h="msg"].p0{animation:fzh-msg0 .24s cubic-bezier(.16,.8,.24,1)}
html.fzh-on #hud [data-h="msg"].p1{animation:fzh-msg1 .24s cubic-bezier(.16,.8,.24,1)}
@keyframes fzh-msg0{from{opacity:0;transform:translateX(-50%) translateY(-8px) scale(1.09)}to{opacity:1;transform:translateX(-50%)}}
@keyframes fzh-msg1{from{opacity:0;transform:translateX(-50%) translateY(-8px) scale(1.09)}to{opacity:1;transform:translateX(-50%)}}
html.fzh-on #hud [data-h="obj"].p0{animation:fzh-obj0 .22s ease-out}
html.fzh-on #hud [data-h="obj"].p1{animation:fzh-obj1 .22s ease-out}
@keyframes fzh-obj0{from{opacity:0;transform:translateX(-50%) translateY(-6px)}to{opacity:1;transform:translateX(-50%)}}
@keyframes fzh-obj1{from{opacity:0;transform:translateX(-50%) translateY(-6px)}to{opacity:1;transform:translateX(-50%)}}
html.fzh-on #hud [data-h="prompt"]{animation:fzh-obj0 .14s ease-out}
html.fzh-on #hud [data-h="pmain"]>*{animation:fzh-pause .15s cubic-bezier(.2,.75,.25,1) both}
html.fzh-on #hud [data-h="pmain"]>:nth-child(2){animation-delay:.02s}html.fzh-on #hud [data-h="pmain"]>:nth-child(3){animation-delay:.04s}html.fzh-on #hud [data-h="pmain"]>:nth-child(4){animation-delay:.06s}
@keyframes fzh-pause{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
html.fzh-on #hud [data-h="pmain"] button{transition:transform .09s cubic-bezier(.2,.7,.3,1)}
html.fzh-on #hud [data-h="pmain"] button:hover{transform:translateY(-1px)}
html.fzh-on #hud [data-h="pmain"] button:active{transform:translateY(1px) scale(.985)}
/* reload ring: two half discs turned by the compositor */
#fzh .rr{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px;opacity:0;transition:opacity .1s}
#fzh .rr.on{opacity:.9}
#fzh .rr b{position:absolute;top:0;width:50%;height:100%;overflow:hidden}
#fzh .rr b:nth-child(1){left:0}#fzh .rr b:nth-child(2){right:0}
#fzh .rr em{position:absolute;top:0;width:200%;height:100%;box-sizing:border-box;border-radius:50%;border:3px solid transparent}
#fzh .rr b:nth-child(1) em{left:0;border-left-color:#e8a628;border-bottom-color:#e8a628;transform:rotate(-135deg)}
#fzh .rr b:nth-child(2) em{right:0;border-right-color:#e8a628;border-top-color:#e8a628;transform:rotate(-135deg)}
#fzh .rr.on b:nth-child(2) em{animation:fzh-r1 calc(var(--d)*.5) linear both}
#fzh .rr.on b:nth-child(1) em{animation:fzh-r2 calc(var(--d)*.5) linear calc(var(--d)*.5) both}
@keyframes fzh-r1{from{transform:rotate(-135deg)}to{transform:rotate(45deg)}}
@keyframes fzh-r2{from{transform:rotate(-135deg)}to{transform:rotate(45deg)}}
`;

const LOW = 0.2;

export function install({ engine: E, settings, hudRoot }) {
  if (document.getElementById('fzh-style')) return null;
  const I = E.internals, hud = I && I.hud; if (!hud || !hud.el) return null;
  const st = document.createElement('style'); st.id = 'fzh-style'; st.textContent = CSS; document.head.append(st);
  const html = document.documentElement, el = hud.el, mq = matchMedia('(prefers-reduced-motion: reduce)');
  let on = true, rm = false;
  const refresh = () => { rm = !!settings.get('gameplay.reducedMotion') || mq.matches; let q = 0; try { q = E.perf.qLevel; } catch { /* keep */ } on = !rm && !/^(bas|mobile)$/.test(settings.get('graphics.preset')) && q < 4; html.classList.toggle('fzh-on', on); };
  refresh(); settings.on('change', p => { if (typeof p === 'string' && (p === 'gameplay.reducedMotion' || p.startsWith('graphics.'))) refresh(); });
  if (mq.addEventListener) mq.addEventListener('change', refresh);

  /* one-shot restart without a reflow */
  const punch = e => { if (!on) return; if (e._p) { e.classList.remove('p1'); e.classList.add('p0'); } else { e.classList.remove('p0'); e.classList.add('p1'); } e._p = !e._p; };
  const guard = (obj, key, after) => { const f = obj[key]; if (typeof f !== 'function') return; obj[key] = function (a, b, c, d, e, g) { const r = f.call(this, a, b, c, d, e, g); try { after(a, b, c, d, e, g); } catch (x) { console.warn('[motion] hud', key, x); } return r; }; };

  const box = document.createElement('div'); box.id = 'fzh'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = '<div class="kc"><i></i><i></i><i></i><i></i></div><div class="rr"><b><em></em></b><b><em></em></b></div>';
  hudRoot.append(box);
  const kc = box.querySelector('.kc'), rr = box.querySelector('.rr');
  const trailH = document.createElement('s'), trailA = document.createElement('s'); el.hp.prepend(trailH); el.arm.prepend(trailA);
  const sLv = el.sL.querySelector('b'), sRv = el.sR.querySelector('b'), earnB = el.earn.querySelector('b'), dmgI = [...el.dmg.children];

  /* ---------- hits ---------- */
  guard(hud, 'hitMarker', () => punch(el.hit));
  E.on('kill', e => { if (!on || !e || e.killer !== E.player || e.victim === E.player) return; const h = !!e.head; if (kc._h !== h) { kc._h = h; kc.classList.toggle('head', h); } punch(kc); });
  let dmgN = 0;
  guard(hud, 'hurt', rel => { if (rel === null || rel === undefined || !isFinite(rel)) return; const i = dmgN; dmgN = (dmgN + 1) % 4; punch(dmgI[i]); });

  /* ---------- ammo and reload ---------- */
  let ammoV = -1, lowV = false, relV = false;
  guard(hud, 'weapon', (ammo, mag, name, reloading) => {
    const n = typeof ammo === 'number' ? ammo : -1;
    if (n !== ammoV) { if (n >= 0 && n < ammoV) { if (!lowV) punch(el.am); } ammoV = n; }
    const low = n >= 0 && mag > 1 && n <= mag * LOW && !reloading;
    if (low !== lowV) { lowV = low; el.am.classList.toggle('low', low && on); if (low) el.am.classList.remove('p0', 'p1'); }
    const r = !!reloading;
    if (r !== relV) {
      relV = r;
      if (r && on) { const left = I.P && I.P.reload > 0 ? I.P.reload : 1; rr.style.setProperty('--d', Math.max(.2, left).toFixed(2) + 's'); rr.classList.remove('on'); void rr.offsetWidth; rr.classList.add('on'); }
      else rr.classList.remove('on');
    }
  });

  /* ---------- vitals: a trail shows what was just lost ---------- */
  let hpV = -1, arV = -1;
  const setTrail = (s, f, old) => { if (f < old) { if (!s.classList.contains('go')) { s.style.transform = 'scaleX(' + old.toFixed(3) + ')'; void s.offsetWidth; s.classList.add('go'); } s.style.transform = 'scaleX(' + f.toFixed(3) + ')'; } else { s.classList.remove('go'); s.style.transform = 'scaleX(' + f.toFixed(3) + ')'; } };
  guard(hud, 'vitals', (hp, maxHp, armor, maxArmor) => {
    const f = Math.max(0, Math.min(1, hp / (maxHp || 1))), a = Math.max(0, Math.min(1, armor / Math.max(maxArmor || 1, 1)));
    if (Math.abs(f - hpV) > .004) { if (hpV >= 0 && on) { if (f < hpV) punch(el.hpN); setTrail(trailH, f, hpV); } else { trailH.classList.remove('go'); trailH.style.transform = 'scaleX(' + f.toFixed(3) + ')'; } hpV = f; }
    if (Math.abs(a - arV) > .004) { if (arV >= 0 && on) setTrail(trailA, a, arV); else { trailA.classList.remove('go'); trailA.style.transform = 'scaleX(' + a.toFixed(3) + ')'; } arV = a; }
  });

  /* ---------- score, timer, messages, objective ---------- */
  let sl = '', sr = '', ob = '', tm = -1;
  guard(hud.api, 'set', o => {
    if (!o) return;
    if ('left' in o) { const v = sLv.textContent; if (v !== sl) { if (sl) punch(sLv); sl = v; } }
    if ('right' in o) { const v = sRv.textContent; if (v !== sr) { if (sr) punch(sRv); sr = v; } }
    if ('objective' in o) { const v = o.objective || ''; if (v !== ob) { ob = v; if (v) punch(el.obj); } }
    if ('timer' in o && typeof o.timer === 'number') { const c = Math.ceil(o.timer); if (c !== tm) { tm = c; if (c <= 10 && c > 0) punch(el.timer); } }
  });
  guard(hud.api, 'message', () => punch(el.msg));
  let earnV = '';
  guard(hud, 'earn', () => { const v = earnB.textContent; if (v !== earnV) { if (earnV) punch(earnB); earnV = v; } });
  guard(hud, 'reset', () => { sl = sr = ob = earnV = ''; tm = -1; hpV = arV = -1; ammoV = -1; relV = false; lowV = false; el.am.classList.remove('low', 'p0', 'p1'); rr.classList.remove('on'); kc.classList.remove('p0', 'p1'); });

  /* ---------- weapon: inspect on its own key, and a slow breath at rest. Writes a pose guns.js adds to the rig; never touches a clip. ---------- */
  const vm = I.vm, P = I.P, pose = new Float32Array(6), DUR = 3.1;
  const K = [ // t, x, y, z, rx, ry, rz
    [0, 0, 0, 0, 0, 0, 0], [.16, .012, .018, -.012, .1, .5, .46], [.42, .016, .022, -.016, .13, .56, .52],
    [.52, .008, .03, -.024, .3, .12, .1], [.68, .006, .014, -.012, .1, -.27, -.25], [.86, .008, .012, -.01, .07, -.3, -.28], [1, 0, 0, 0, 0, 0, 0],
  ];
  const smooth = k => k * k * (3 - 2 * k);
  let insT = -1, insW = 0, breath = 0, wId = '', q = 0, qT = 0;
  const cancel = () => { insT = -1; };
  const busy = () => { const w = I.wNow && I.wNow(); return !E.player.alive || vm.scoped || (P.ads || 0) > .05 || P.reload > 0 || vm.reloading || vm.grenadeBusy || P.slide > 0 || !w; };
  addEventListener('keydown', e => {
    if (e.repeat || !E.running || E.paused || E.loading) return;
    if (settings.action(e.code) !== 'inspect' || rm) return;
    if (busy()) return;
    const w = I.wNow(); if (w.def.kind === 'thrown') return;
    wId = w.def.id; insT = insT >= 0 && insT < .9 ? insT : 0;
  });
  E.on('tick', dt => {
    if ((qT -= dt) <= 0) { qT = 1; refresh(); }
    if (insT >= 0) {
      const w = I.wNow && I.wNow();
      if (busy() || !w || w.def.id !== wId || E.input.held('fire') || E.input.held('aim') || Math.hypot(P.v.x, P.v.z) > 8.2) cancel();
      else { insT += dt / DUR; if (insT >= 1) cancel(); }
    }
    const want = insT >= 0 ? 1 : 0, rate = want ? 16 : 11; insW += (want - insW) * (1 - Math.exp(-rate * dt)); if (insW < .002 && !want) insW = 0;
    breath += dt;
    const still = rm || !on ? 0 : Math.max(0, 1 - Math.hypot(P.v.x, P.v.z) / 1.4) * (1 - (P.ads || 0));
    if (!insW && !still) { if (vm.pose) vm.pose = null; return; }
    let x = 0, y = 0, z = 0, a = 0, b = 0, c = 0;
    if (insW) {
      const t = Math.max(insT, 0); let i = 0; while (i < K.length - 2 && t >= K[i + 1][0]) i++;
      const A = K[i], B = K[i + 1], m = smooth(Math.min(1, (t - A[0]) / (B[0] - A[0] || 1)));
      x = (A[1] + (B[1] - A[1]) * m) * insW; y = (A[2] + (B[2] - A[2]) * m) * insW; z = (A[3] + (B[3] - A[3]) * m) * insW;
      a = (A[4] + (B[4] - A[4]) * m) * insW; b = (A[5] + (B[5] - A[5]) * m) * insW; c = (A[6] + (B[6] - A[6]) * m) * insW;
    }
    if (still) { const s = Math.sin(breath * 1.05), u = Math.sin(breath * .41 + 1.3); y += s * .0011 * still; a += s * .0026 * still; x += u * .0009 * still; c += u * .0028 * still; }
    pose[0] = x; pose[1] = y; pose[2] = z; pose[3] = a; pose[4] = b; pose[5] = c; if (vm.pose !== pose) vm.pose = pose;
  });
  const clear = () => { cancel(); insW = 0; vm.pose = null; };
  E.on('matchEnd', clear); E.on('quit', clear); E.on('matchStart', clear);
  return { get inspecting() { return insT >= 0; } };
}
