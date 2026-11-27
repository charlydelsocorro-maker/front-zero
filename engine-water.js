/* FRONT ZÉRO [eau] : rendu de l'eau des cartes (Port, Barrage, Marais, Valferrade).
   Branché par maps.js (import() protégé) : s'il manque ou échoue, l'eau d'aujourd'hui reste.
   - Préréglage bas / mobile (ombres coupées) : mêmes programmes qu'aujourd'hui, seulement des teintes plus lisibles (aucun coût).
   - Moyen et au-dessus : MeshStandard patché (même éclairage, ombres, brouillard, coupure des lampes), OPAQUE (la vraie transparence
     coûtait +11 % sur les vues pleines d'eau : fond redessiné puis mélange) :
       deux cartes de normales qui défilent (vagues), Fresnel (le reflet monte en vue rasante, le corps de l'eau baisse d'autant),
       rives : relevés vus de dessus après le chargement (une image chacun) : hauteur du fond et des berges, emprise des nappes,
       et couleur du fond rendue avec les matériaux de la scène → près des bords on « voit le fond » (couleur relevée, décalée par
       les vagues) sans mélange, l'eau s'éclaircit, écume animée là où elle touche le terrain ou un objet.
   - Élevé et au-dessus (ombres moyennes ou hautes) : reflet du paysage par une image cube (5 faces, 128 px), une face par image
     au début, corrigée par une boîte (parallaxe) ; pas au Marais (brumeux : reflet du ciel) ; moyen garde le reflet du ciel.
   - La mer du Port garde sa transparence d'avant (fondu de l'horizon, map-horizon.js) et reçoit le même patch par-dessus.
   Aucun programme n'est compilé en partie : les matériaux d'eau sont dans la scène au chargement (préparés avec le reste),
   le relevé de hauteur utilise trois RawShaderMaterial préparés au chargement (clé sans lumières ni cible), et le fond et l'image
   cube n'utilisent que les programmes de la scène, seulement si la scène est rendue dans une cible (post-traitement actif). */
import * as THREE from 'three';

const TAU = Math.PI * 2, LAY = 5, LAYH = 6, LAYW = 7, LAYX = 8;      // calques des relevés : 5 = décor de la carte, 6 = horizon (image cube seulement), 7 = les nappes (emprise), 8 = matériaux à shader propre (fond et cube seulement)
const lin = h => { const c = new THREE.Color(h); return new THREE.Vector3(c.r, c.g, c.b); };

/* Palettes par genre d'eau. clar : profondeur (m) pour 63 % d'opacité ; virt : profondeur ajoutée loin des rives (l'eau garde du corps) ;
   foam : quantité d'écume ; w1/w2 : [échelle 1/m, dir x, dir z, vitesse] des deux cartes de normales ; k : [force, atténuation/m, reflet, part de l'image cube]. */
const KIND = {
  marsh: { deep: 0x2a3320, shal: 0x6c6c46, foam: 0xa4a088, clar: .25, virt: .7, nearK: .45, foamA: .6, w1: [1 / 7, .8, .6, .07], w2: [1 / 2.6, -.5, .86, .1], k: [.09, .02, .7, 0], rough: .18, envI: .9 },
  cave: { deep: 0x121612, shal: 0x2c2e26, foam: 0x55544a, clar: .3, virt: .6, nearK: .3, foamA: .18, w1: [1 / 6, .7, .7, .03], w2: [1 / 2.2, -.6, .8, .05], k: [.06, .02, .15, 0], rough: .07, envI: .12 },
  lake: { deep: 0x123a4c, shal: 0x3a8484, foam: 0xe2eae8, clar: .7, virt: .85, nearK: 1, foamA: .85, w1: [1 / 6, .7, .71, .2], w2: [1 / 2.1, -.45, .9, .28], k: [.18, .018, 1, 1], rough: .05, envI: 1, flow: [0, 1, .9, 2] },
  trough: { deep: 0x1a2c2e, shal: 0x3c5a58, foam: 0xc8ccc4, clar: .45, virt: .4, nearK: .6, foamA: .3, w1: [1 / 3, .7, .7, .04], w2: [1 / 1.2, -.6, .8, .06], k: [.08, .02, .8, 0], rough: .06, envI: .8 },
  sea: { deep: 0x0a1f28, shal: 0x24484a, foam: 0xd6dcd6, clar: 2.5, virt: 2, nearK: 1, foamA: .8, w1: [1 / 9, .6, .8, .32], w2: [1 / 3, -.7, .7, .42], k: [.3, .012, 1.05, 1], rough: .05, envI: 1.1 },
};
/* Teintes du préréglage bas (mêmes programmes qu'aujourd'hui : couleur, rugosité, métal, intensité du reflet). */
const LOWK = { marsh: { color: 0x34442f, rough: .4, metal: .12, env: 1.3 }, lake: { color: 0x1d3a4a, rough: .06, metal: .32, env: 1.25 }, trough: { color: 0x22363a, rough: .08, metal: .3, env: 1 } };

/* genre d'un lot d'eau selon la carte ; null = pas de l'eau (la Cité se sert de ar_water pour ses vitres) */
function kindOf(mat, env) {
  if (mat === 'ar_water_marsh') return 'marsh';
  if (mat === 'ar_water_cave') return 'cave';
  if (mat === 'ar_water') return env === 'gorge' ? 'lake' : env === 'mineval' ? 'trough' : null;
  return null;
}

/* ---------- carte de normales partagée (somme d'ondes à nombres d'onde entiers : raccord de tuile exact) + bruit d'écume (B) ---------- */
let NT = null;
function normalTex() {
  if (NT) return NT;
  const N = 256, d = new Uint8Array(N * N * 4), gx = new Float32Array(N * N), gy = new Float32Array(N * N);
  let s = 918273; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cu = new Float32Array(N), su = new Float32Array(N), cv = new Float32Array(N), sv = new Float32Array(N);
  for (let w = 0; w < 24; w++) {
    let kx = 0, ky = 0; while (!kx && !ky) { const k = 2 + Math.floor(rnd() * rnd() * 15), a = rnd() * TAU; kx = Math.round(Math.cos(a) * k); ky = Math.round(Math.sin(a) * k); }
    const km = Math.hypot(kx, ky), A = 1 / Math.pow(km, 1.3), ph = rnd() * TAU;
    for (let i = 0; i < N; i++) { const a = TAU * kx * i / N + ph, b = TAU * ky * i / N; cu[i] = Math.cos(a); su[i] = Math.sin(a); cv[i] = Math.cos(b); sv[i] = Math.sin(b); }
    const ax = A * TAU * kx, ay = A * TAU * ky;
    for (let j = 0; j < N; j++) { const cb = cv[j], sb = sv[j], r = j * N; for (let i = 0; i < N; i++) { const c = cu[i] * cb - su[i] * sb; gx[r + i] += ax * c; gy[r + i] += ay * c; } }
  }
  let m = 0; for (let i = 0; i < N * N; i++) m = Math.max(m, Math.abs(gx[i]), Math.abs(gy[i]));
  const P = 16, g = new Float32Array(P * P); for (let i = 0; i < P * P; i++) g[i] = rnd();
  const vn = (u, v, p) => { const X = u * p, Y = v * p, a = Math.floor(X), b = Math.floor(Y), f = X - a, h = Y - b, q = f * f * (3 - 2 * f), r = h * h * (3 - 2 * h), i0 = a % p, j0 = b % p, i1 = (i0 + 1) % p, j1 = (j0 + 1) % p, k = P / p;
    const G = (i, j) => g[(j * k % P) * P + (i * k % P)]; return (G(i0, j0) * (1 - q) + G(i1, j0) * q) * (1 - r) + (G(i0, j1) * (1 - q) + G(i1, j1) * q) * r; };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, o = k * 4, u = i / N, v = j / N;
    d[o] = Math.round((gx[k] / m * .5 + .5) * 255); d[o + 1] = Math.round((gy[k] / m * .5 + .5) * 255);
    d[o + 2] = Math.round(Math.min(1, Math.max(0, vn(u, v, 4) * .5 + vn(u, v, 8) * .33 + vn(u, v, 16) * .17)) * 255); d[o + 3] = 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 1; t.needsUpdate = true;      // sans filtrage anisotrope : au loin les vagues s'aplatissent (moins de scintillement, moins cher)
  return (NT = t);
}

/* ---------- relevé vu de dessus : hauteur du décor (R, ±4 m autour du niveau de l'eau) et « solide au ras de l'eau » (G) ---------- */
let capM = null, capMI = null, capMW = null;
function capMats() {
  if (capM) return;
  const vs = `precision highp float;
uniform mat4 modelMatrix; uniform mat4 viewMatrix; uniform mat4 projectionMatrix;
attribute vec3 position;
#ifdef FZ_INST
attribute mat4 instanceMatrix;
#endif
varying float vY;
void main() { vec4 p = vec4(position, 1.0);
#ifdef FZ_INST
p = instanceMatrix * p;
#endif
vec4 w = modelMatrix * p; vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const fs = `precision highp float;
uniform float uLv; varying float vY;
void main() { float r = vY - uLv; gl_FragColor = vec4(clamp(r * .125 + .5, 0.0, 1.0), step(-.02, r) * step(r, 1.5), 0.0, 1.0); }`;
  const mk = inst => { const m = new THREE.RawShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms: { uLv: { value: 0 } }, side: THREE.DoubleSide, defines: inst ? { FZ_INST: 1 } : {} }); m.name = 'fz-water-cap' + (inst ? '-i' : ''); return m; };
  capM = mk(false); capMI = mk(true); capMI.uniforms = capM.uniforms;
  /* B : emprise des nappes elles-mêmes (ajoutée par-dessus, sans test de profondeur) : leurs bords coupés net deviennent un fondu */
  capMW = new THREE.RawShaderMaterial({ vertexShader: vs, fragmentShader: 'precision highp float;\nvoid main() { gl_FragColor = vec4(0.0, 0.0, 1.0, 0.0); }', side: THREE.DoubleSide, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor }); capMW.name = 'fz-water-cap-w';
}
/* les trois programmes du relevé, préparés au chargement (et après une perte de contexte) : RawShaderMaterial, clé sans lumières ni cible */
function prepCap(renderer) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3));
  const grp = new THREE.Group(), im = new THREE.InstancedMesh(g, capMI, 1); grp.add(new THREE.Mesh(g, capM), im, new THREE.Mesh(g, capMW));
  try { renderer.compile(grp, new THREE.PerspectiveCamera()); } finally { im.dispose(); g.dispose(); }
}
const RT = [null, null], BED = [null, null]; let CUBE = [null, null];
/* couleur du fond vu de dessus (rendu avec les matériaux de la scène) : la « transparence » de l'eau sans mélange ni fond redessiné */
function bedRT(i, w, h, half) {
  let r = BED[i];
  if (!r) { r = BED[i] = new THREE.WebGLRenderTarget(w, h, { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: true }); r.texture.name = 'fz-water-bed' + i; }
  else if (r.width !== w || r.height !== h) r.setSize(w, h);
  return r;
}
function capRT(i, w, h) {
  let r = RT[i];
  if (!r) { r = RT[i] = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: true }); r.texture.name = 'fz-water-cap' + i; }
  else if (r.width !== w || r.height !== h) r.setSize(w, h);
  return r;
}
function cubeRT(i, size, half) {
  let c = CUBE[i];
  if (!c || c.rt.width !== size) { if (c) c.rt.dispose(); const rt = new THREE.WebGLCubeRenderTarget(size, { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true }); rt.texture.name = 'fz-water-cube' + i; c = CUBE[i] = { rt, cam: new THREE.CubeCamera(4, 900, rt) }; }
  return c;
}

/* ---------- uniformes partagés par toutes les eaux de la carte ---------- */
const U = {
  fzT: { value: 0 }, fzN: { value: null },
  fzDA: { value: null }, fzDB: { value: null }, fzRA: { value: new THREE.Vector4() }, fzRB: { value: new THREE.Vector4() },
  fzQA: { value: new THREE.Vector4() }, fzQB: { value: new THREE.Vector4() },
  fzCA: { value: null }, fzCB: { value: null }, fzBA: { value: null }, fzBB: { value: null }, fzCpA: { value: new THREE.Vector4() }, fzCpB: { value: new THREE.Vector4() }, fzBox: { value: new THREE.Vector2(100, 60) },
};
const SHARED = Object.keys(U);

const VERT_DECL = '\nvarying vec3 fzW;';
const VERT_MAIN = '\nfzW = (modelMatrix * vec4(transformed, 1.0)).xyz;';
const FRAG_DECL = `
varying vec3 fzW;
uniform float fzT; uniform sampler2D fzN;
uniform vec4 fzW1; uniform vec4 fzW2; uniform vec4 fzK; uniform vec4 fzFl; uniform vec4 fzP;
uniform vec3 fzDeep; uniform vec3 fzShal; uniform vec3 fzFoamC; uniform float fzSR;
uniform sampler2D fzDA; uniform sampler2D fzDB; uniform vec4 fzRA; uniform vec4 fzRB; uniform vec4 fzQA; uniform vec4 fzQB;
uniform samplerCube fzCA; uniform samplerCube fzCB; uniform sampler2D fzBA; uniform sampler2D fzBB; uniform vec4 fzCpA; uniform vec4 fzCpB; uniform vec2 fzBox;
float fzAB = 1.0; float fzFoam = 0.0; float fzEd = 1.0; float fzTr = 0.0; vec3 fzBed = vec3(0.0); float fzFr = 0.02; float fzDist = 0.0; float fzSel = 0.0;
vec3 fzNw = vec3(0.0, 1.0, 0.0); vec3 fzVw = vec3(0.0, 1.0, 0.0);`;
/* après color_fragment : vagues, profondeur, rives, écume, couleur du corps de l'eau */
const FRAG_COLOR = `
{
  fzVw = cameraPosition - fzW; fzDist = length(fzVw); fzVw /= max(fzDist, 1e-4);
  vec2 fzQ = fzW.xz - fzFl.xy * (fzFl.z * fzT * step(fzW.y, fzFl.w));
  vec4 fzA1 = texture2D(fzN, fzQ * fzW1.x + fzW1.yz * (fzT * fzW1.w));
  vec4 fzA2 = texture2D(fzN, mat2(0.8, 0.6, -0.6, 0.8) * fzQ * fzW2.x + fzW2.yz * (fzT * fzW2.w));
  vec2 fzG = (fzA1.xy * 2.0 - 1.0) + (fzA2.xy * 2.0 - 1.0) * 0.5;
  float fzSt = fzK.x / (1.0 + fzDist * fzK.y);
  fzNw = normalize(vec3(-fzG.x * fzSt, 1.0, -fzG.y * fzSt));
  float fzDep = 50.0, fzNear = 0.0;
  vec4 fzR = fzRA, fzQq = fzQA;
  if (fzQB.z > 0.5 && abs(fzW.y - fzQB.x) < abs(fzW.y - fzQA.x)) { fzR = fzRB; fzQq = fzQB; fzSel = 1.0; }
  vec2 fzUv = vec2((fzW.x - fzR.x) * fzR.z, 1.0 - (fzW.z - fzR.y) * fzR.w);
  if (fzQq.z > 0.5 && fzDist < 90.0 && fzUv.x > 0.002 && fzUv.x < 0.998 && fzUv.y > 0.002 && fzUv.y < 0.998) {
    vec4 fzC0, fzC2;
    if (fzSel > 0.5) { fzC0 = textureLod(fzDB, fzUv, 0.0); fzC2 = textureLod(fzDB, fzUv, fzQq.y); }
    else { fzC0 = textureLod(fzDA, fzUv, 0.0); fzC2 = textureLod(fzDA, fzUv, fzQq.y); }
    float fzH = fzQq.x + (fzC0.r - 0.5) * 8.0;
    bool fzBot = fzC0.r > 0.01;
    if (fzBot && fzH < fzW.y + 0.02) fzDep = max(fzW.y - fzH, 0.0);      // sinon : couvert (plancher, pont, toit) : fond inconnu, eau profonde
    fzEd = fzBot ? smoothstep(0.5, 0.95, fzC2.b) : 1.0;
    fzNear = max(smoothstep(0.02, 0.45, fzC2.g), 1.0 - fzEd);
    if (fzQq.w > 0.5 && fzDep < 8.0) {      /* fond vu à travers l'eau : relevé de couleur décalé par les vagues (réfraction) */
      vec2 fzOf = fzNw.xz * (0.3 * min(fzDep, 1.0)) * vec2(fzR.z, -fzR.w);
      fzBed = (fzSel > 0.5 ? textureLod(fzBB, fzUv + fzOf, 0.0) : textureLod(fzBA, fzUv + fzOf, 0.0)).rgb; fzTr = 1.0;
    }
    float fzNz = fzA1.b * 0.6 + fzA2.b * 0.4;
    float fzLap = 0.72 + 0.28 * sin(fzNear * 9.0 - fzT * 2.1 + fzNz * 7.0);
    fzFoam = smoothstep(0.42, 0.82, fzNear * fzLap * (0.5 + 0.9 * fzNz)) * (1.0 - fzC0.g * 0.6) * fzP.z;
    fzFoam *= 1.0 - smoothstep(40.0, 85.0, fzDist);
  }
  float fzDe = fzDep + fzP.y * (1.0 - fzNear * fzP.w);
  fzAB = max(1.0 - exp(-fzDe / fzP.x), fzFoam);
  fzTr *= 1.0 - fzAB;
  fzBed *= mix(vec3(1.0), fzShal / max(max(fzShal.r, fzShal.g), max(fzShal.b, 1e-3)), 0.55);
  vec3 fzBody = mix(fzShal, fzDeep, smoothstep(0.0, 1.0, 1.0 - exp(-fzDe / (fzP.x * 2.2))));
  float fzSh = 1.0;
#ifdef USE_COLOR
  fzSh = clamp(dot(vColor.rgb, vec3(0.3, 0.59, 0.11)) / fzSR, 0.25, 1.4);
#endif
  diffuseColor.rgb = mix(fzBody * fzSh, fzFoamC, fzFoam);
  fzFr = 0.02 + 0.98 * pow(1.0 - clamp(dot(fzNw, fzVw), 0.0, 1.0), 5.0);
}`;
const FRAG_ROUGH = '\nroughnessFactor = mix(roughnessFactor, 0.8, fzFoam);';
const FRAG_METAL = '\nmetalnessFactor = 0.0;';
const FRAG_NORMAL = '\nnormal = normalize((viewMatrix * vec4(fzNw, 0.0)).xyz);';
/* après lights_fragment_maps : reflet du paysage (image cube corrigée par une boîte) à la place du ciel seul */
const FRAG_REFL = `
#if defined( RE_IndirectSpecular )
{
  vec4 fzCp = fzSel > 0.5 ? fzCpB : fzCpA;
  if (fzCp.w > 0.5 && fzK.w > 0.0) {
    vec3 fzRr = reflect(-fzVw, fzNw); fzRr.y = max(fzRr.y, 0.03); fzRr = normalize(fzRr);
    fzRr.xz = sign(fzRr.xz + 1e-6) * max(abs(fzRr.xz), vec2(1e-4));
    vec3 fzB0 = vec3(-fzBox.x, fzCp.y - 1.5, -fzBox.x), fzB1 = vec3(fzBox.x, fzCp.y + fzBox.y, fzBox.x);
    vec3 fzTf = max((fzB1 - fzW) / fzRr, (fzB0 - fzW) / fzRr);
    float fzTb = max(min(min(fzTf.x, fzTf.y), fzTf.z), 0.0);
    vec3 fzDv = fzW + fzRr * fzTb - fzCp.xyz; fzDv.y = max(fzDv.y, 0.04 * length(fzDv.xz));
    float fzLod = clamp(fzDist * 0.015 + 0.4, 0.0, 5.0);
    vec3 fzRc = fzSel > 0.5 ? textureLod(fzCB, fzDv, fzLod).rgb : textureLod(fzCA, fzDv, fzLod).rgb;
    radiance = mix(radiance, fzRc * fzK.z, fzK.w);
  }
}
#endif`;
/* avant opaque_fragment : le corps de l'eau garde son opacité (profondeur, écume), le reflet garde sa force (Fresnel) même là où l'eau est transparente */
const FRAG_OUT = `
{
#ifdef OPAQUE
  outgoingLight = (totalDiffuse * (1.0 - fzTr) + fzBed * fzTr) * (1.0 - fzFr) + totalSpecular + totalEmissiveRadiance;
#else
  float fzAl = clamp(fzAB + (1.0 - fzAB) * fzFr, 0.03, 1.0);
  outgoingLight = (totalDiffuse * (fzAB * (1.0 - fzFr)) + totalSpecular + totalEmissiveRadiance) / fzAl;
  diffuseColor.a *= fzAl * fzEd;
#endif
}`;

const rep = (src, key, add, after = true) => { if (src.indexOf(key) < 0) throw new Error('[eau] chunk absent: ' + key); return src.replace(key, after ? key + add : add + '\n' + key); };
function patchShader(s, kU) {
  for (const k of SHARED) s.uniforms[k] = U[k];
  for (const k in kU) s.uniforms[k] = kU[k];
  let v = s.vertexShader, f = s.fragmentShader;
  v = rep(v, '#include <common>', VERT_DECL); v = rep(v, '#include <project_vertex>', VERT_MAIN);
  f = rep(f, '#include <common>', FRAG_DECL); f = rep(f, '#include <color_fragment>', FRAG_COLOR); f = rep(f, '#include <roughnessmap_fragment>', FRAG_ROUGH);
  f = rep(f, '#include <metalnessmap_fragment>', FRAG_METAL); f = rep(f, '#include <normal_fragment_maps>', FRAG_NORMAL); f = rep(f, '#include <lights_fragment_maps>', FRAG_REFL);
  f = rep(f, '#include <opaque_fragment>', FRAG_OUT, false);
  s.vertexShader = v; s.fragmentShader = f;
}
function kindUniforms(K, sr) {
  return { fzW1: { value: new THREE.Vector4(...K.w1) }, fzW2: { value: new THREE.Vector4(...K.w2) }, fzK: { value: new THREE.Vector4(...K.k) }, fzFl: { value: new THREE.Vector4(...(K.flow || [0, 0, 0, -1e6])) },
    fzP: { value: new THREE.Vector4(K.clar, K.virt, K.foamA, K.nearK) }, fzDeep: { value: lin(K.deep) }, fzShal: { value: lin(K.shal) }, fzFoamC: { value: lin(K.foam) }, fzSR: { value: sr || 1 } };
}
function waterMat(K, E, sr) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: K.rough, metalness: 0, vertexColors: true });
  const kU = kindUniforms(K, sr); m.userData.perMap = true; m.userData.fzKind = kU; m.name = 'fz-water';
  m.envMapIntensity = K.envI * ((E && E.envI) || 1);
  m.onBeforeCompile = s => patchShader(s, kU); m.customProgramCacheKey = () => 'fz-water-1';
  return m;
}
/* mer du Port : waterM (partagé, patché par map-horizon.js) est enveloppé ; au préréglage bas il retrouve son programme d'origine */
function wrapSea(m, on, E) {
  const ud = m.userData;
  if (!on) { if (ud.fzOrig) { m.onBeforeCompile = ud.fzOrig[0]; m.customProgramCacheKey = ud.fzOrig[1]; ud.fzOrig = null; m.needsUpdate = true; } return; }
  if (ud.fzOrig) return;
  const prev = m.onBeforeCompile, pk = m.customProgramCacheKey, k0 = pk.call(m), kU = kindUniforms(KIND.sea, 1);
  ud.fzOrig = [prev, pk]; ud.fzKind = kU;
  m.onBeforeCompile = function (s, r) { prev.call(this, s, r); patchShader(s, kU); };
  m.customProgramCacheKey = () => k0 + '|fz-water-1'; m.needsUpdate = true;
}

/* statistiques lisibles par les tests */
export const debug = { tier: -1, kinds: {}, clusters: [], jobs: 0, done: [], skipped: '', ms: [] };
/* tests seulement (mesure du coût dans la même page) : ab(false) remet les matériaux d'avant sur les eaux de la carte, ab(true) les nouveaux */
const AB = [];
debug.tweak = (k, v) => { for (const q of AB) { if (k === 'shadow') q[0].receiveShadow = v; if (k === 'opaque' && q[2].transparent === v) { q[2].transparent = !v; q[2].needsUpdate = true; } } };
debug.ab = on => { for (const q of AB) { if (!q[1]) { const m = q[2], o = m.userData.fzOrig; if (!o) continue; const c = m.clone(); c.onBeforeCompile = o[0]; c.customProgramCacheKey = o[1]; c.userData = { perMap: true }; q[1] = c; } q[0].material = on ? q[2] : q[1]; } return AB.length; };
Object.defineProperties(debug, { rts: { get: () => RT }, cubes: { get: () => CUBE }, U: { value: U }, KIND: { value: KIND } });      // non énumérables : JSON.stringify(debug) reste simple

/** Construit l'eau de la carte. o = { root, L, E, renderer, scene, sea, seaMat, low, hi, probe }. Retourne { update, restore, dispose } ou null. */
export function build(o) {
  const { root, L, E, renderer, scene, sea, seaMat } = o, env = L.env, S = L.size || 60;
  const gl2 = !!(renderer.capabilities && renderer.capabilities.isWebGL2);
  const tier = o.low || !gl2 ? 0 : o.hi ? 2 : 1;
  debug.tier = tier; debug.kinds = {}; debug.clusters = []; debug.jobs = 0; debug.done = []; debug.skipped = ''; debug.ms = []; AB.length = 0;
  /* les lots d'eau de la carte */
  const list = [];
  root.traverse(m => {
    if (!m.isMesh || m.isInstancedMesh || !m.material || Array.isArray(m.material)) return;
    const nm = m.name || ''; if (!nm.startsWith('batch-ar_water')) return;
    const kind = kindOf(nm.slice(6), env); if (!kind) return;
    const g = m.geometry, n = g.attributes.normal; if (!n || !g.attributes.position) return;
    let ny = 0; for (let i = 0; i < n.count; i++) ny += n.getY(i); if (ny / n.count < .9) return;      // de l'eau est à plat, face en haut
    list.push({ m, kind });
  });
  if (sea) list.push({ m: sea, kind: 'sea' });
  if (!list.length) { wrapSea(seaMat, false); return null; }
  for (const w of list) { w.m.castShadow = false; debug.kinds[w.kind] = (debug.kinds[w.kind] || 0) + 1; }

  if (tier === 0) {      /* bas : même programme, teinte plus lisible */
    wrapSea(seaMat, false); const done = new Map();
    /* eau sous couvert au niveau d'une nappe (sous les maisons du Marais) : couleurs de sommets proches de la nappe et même matériau (plus de carré noir net), aucun programme de plus */
    { const yOf = m => { const p = m.geometry.attributes.position; m.updateMatrixWorld(true); let s = 0; const v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) s += v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).y; return s / p.count; };
      const open = list.filter(w => w.kind !== 'cave' && w.kind !== 'sea' && w.m.geometry.attributes.color).map(w => ({ w, y: yOf(w.m) }));
      for (const w of list) { if (w.kind !== 'cave') continue; const y = yOf(w.m), o2 = open.find(q => Math.abs(q.y - y) < .1); if (!o2) continue;
        const src = o2.w.m.geometry.attributes.color, dst = w.m.geometry.attributes.color; if (!dst || dst.itemSize !== src.itemSize) continue; const avg = [0, 0, 0];
        for (let i = 0; i < src.count; i++) { avg[0] += src.getX(i); avg[1] += src.getY(i); avg[2] += src.getZ(i); } const k = .72 / src.count; for (let i = 0; i < dst.count; i++) dst.setXYZ(i, avg[0] * k, avg[1] * k, avg[2] * k);      // un peu plus sombre que l'eau libre (pas d'ombre portée en bas), sans le noir d'avant
        dst.needsUpdate = true; w.m.material = o2.w.m.material; w.kind = o2.w.kind; } }
    for (const w of list) { const K = LOWK[w.kind]; if (!K || w.kind === 'sea') continue; let c = done.get(w.m.material); if (!c) { const src = w.m.material; c = src.clone(); c.onBeforeCompile = src.onBeforeCompile; c.customProgramCacheKey = src.customProgramCacheKey; c.color.setHex(K.color); c.roughness = K.rough; c.metalness = K.metal; c.envMapIntensity = (w.m.material.envMapIntensity || 1) * K.env; c.userData = { ...c.userData, perMap: true }; done.set(w.m.material, c); } AB.push([w.m, w.m.material, c, 0]); w.m.material = c; }
    return null;
  }

  /* moyen et au-dessus */
  U.fzN.value = normalTex();
  const lum = (r, g, b) => .3 * r + .59 * g + .11 * b, sr = {}, cnt = {};
  for (const w of list) { const c = w.m.geometry.attributes.color; if (!c) continue; let s = 0; for (let i = 0; i < c.count; i++) s += lum(c.getX(i), c.getY(i), c.getZ(i)); sr[w.kind] = (sr[w.kind] || 0) + s; cnt[w.kind] = (cnt[w.kind] || 0) + c.count; }
  /* nappes (niveaux) pour les relevés : 2 au plus, les plus grandes ; l'eau « sous couvert » (cave) n'en forme pas */
  const B = S + 6, lev = [], v3 = new THREE.Vector3();
  for (const w of list) {
    const g = w.m.geometry, p = g.attributes.position; w.m.updateMatrixWorld(true); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, ys = 0;
    for (let i = 0; i < p.count; i++) { v3.fromBufferAttribute(p, i).applyMatrix4(w.m.matrixWorld); x0 = Math.min(x0, v3.x); x1 = Math.max(x1, v3.x); z0 = Math.min(z0, v3.z); z1 = Math.max(z1, v3.z); ys += v3.y; }
    const y = w.y = ys / p.count; if (w.kind === 'cave') continue;
    x0 = Math.max(x0, -B); x1 = Math.min(x1, B); z0 = Math.max(z0, -B); z1 = Math.min(z1, B); if (x1 <= x0 || z1 <= z0) continue;
    const a = (x1 - x0) * (z1 - z0); let c = lev.find(q => Math.abs(q.y - y) < .6);
    if (!c) lev.push(c = { y: 0, a: 0, x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, cube: false, ka: {} });
    if (KIND[w.kind].k[3] > 0) c.cube = true; c.ka[w.kind] = (c.ka[w.kind] || 0) + a;
    c.y = (c.y * c.a + y * a) / (c.a + a); c.a += a; c.x0 = Math.min(c.x0, x0); c.x1 = Math.max(c.x1, x1); c.z0 = Math.min(c.z0, z0); c.z1 = Math.max(c.z1, z1);
  }
  /* l'eau sous couvert au même niveau qu'une nappe (sous les maisons du Marais) devient l'eau de la nappe : plus de carré sombre net, l'ombre portée fait le reste */
  for (const w of list) { if (w.kind !== 'cave') continue; const c = lev.find(q => Math.abs(q.y - w.y) < .1); if (c) { w.kind = Object.keys(c.ka).sort((x, y) => c.ka[y] - c.ka[x])[0]; w.own = true; } }
  const mats = {}; for (const w of list) { if (w.kind === 'sea') continue; const ck = (w.own ? 'cave>' : '') + w.kind, k = w.own ? 'cave' : w.kind;
    if (!mats[ck]) mats[ck] = waterMat(KIND[w.kind], E, cnt[k] ? sr[k] / cnt[k] : 1); w.mk = ck; }
  lev.sort((a, b) => b.a - a.a); const cl = lev.filter(c => c.a >= 30).slice(0, 2);
  for (const c of cl) { c.x0 = Math.max(-B, c.x0 - 2); c.x1 = Math.min(B, c.x1 + 2); c.z0 = Math.max(-B, c.z0 - 2); c.z1 = Math.min(B, c.z1 + 2); const dx = c.x1 - c.x0, dz = c.z1 - c.z0, tx = Math.max(Math.max(dx, dz) / 512, .12); c.w = Math.max(8, Math.ceil(dx / tx)); c.h = Math.max(8, Math.ceil(dz / tx)); c.tx = tx; c.lod = Math.min(5, Math.max(1, Math.log2(1.3 / tx))); }
  debug.clusters = cl.map(c => ({ y: +c.y.toFixed(2), a: Math.round(c.a), box: [c.x0, c.x1, c.z0, c.z1].map(v => +v.toFixed(1)), px: [c.w, c.h], tx: +c.tx.toFixed(3), lod: +c.lod.toFixed(2), cube: c.cube }));
  /* relevé : programmes préparés maintenant (en parallèle du chargement), utilisés après */
  if (cl.length) { capMats(); prepCap(renderer); }
  /* pose des matériaux (tout est prêt : rien n'est changé si une étape plus haut a échoué) */
  for (const w of list) { if (w.kind === 'sea') continue; AB.push([w.m, w.m.material, mats[w.mk], w.m.renderOrder]); w.m.material = mats[w.mk]; w.m.renderOrder = -1; }
  wrapSea(seaMat, !!sea, E); if (sea) AB.push([sea, null, seaMat, sea.renderOrder]);
  for (const k of ['A', 'B']) { U['fzQ' + k].value.set(0, 1, 0, 0); U['fzCp' + k].value.set(0, 0, 0, 0); U['fzD' + k].value = null; U['fzC' + k].value = null; U['fzB' + k].value = null; }
  U.fzBox.value.set(S * 1.25, S);

  /* relevés après le chargement, un par image : nappe A, nappe B, puis (élevé) 5 faces de l'image cube par nappe */
  const half = !!(renderer.extensions && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float')));
  let jobs = [], frame = 0, objs = null, horizon = null;
  const plan = () => { jobs = []; frame = 0; objs = null; cl.forEach((c, i) => jobs.push(['d', i])); cl.forEach((c, i) => jobs.push(['b', i])); if (tier >= 2) cl.forEach((c, i) => { if (c.cube) for (const f of [0, 1, 2, 4, 5]) jobs.push(['c', i, f]); }); debug.jobs = jobs.length; };
  plan();
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 60); ortho.layers.set(LAY);
  const clr = new THREE.Color();
  function collect() {
    objs = []; root.traverse(m => {
      if (m.name === 'horizon') { m.layers.enable(LAYH); horizon = m; return; }
      if (!m.isMesh || !m.material || list.some(w => w.m === m)) return;
      if (m.material.isShaderMaterial) m.layers.enable(LAYX); else { m.layers.enable(LAY); objs.push(m); }
    });
  }
  function withState(fn) {
    const sm = renderer.shadowMap, au = sm.autoUpdate, nu = sm.needsUpdate, prt = renderer.getRenderTarget(), pf = renderer.getActiveCubeFace(), pm = renderer.getActiveMipmapLevel(), ac = renderer.autoClear, ca = renderer.getClearAlpha(); renderer.getClearColor(clr);
    sm.autoUpdate = false; sm.needsUpdate = false; renderer.autoClear = true;
    scene.traverse(l => { if (l.isLight) { l.layers.enable(LAY); l.layers.enable(LAYH); l.layers.enable(LAYW); l.layers.enable(LAYX); } });
    const hid = []; for (const a of o.vis || []) for (const m of a) if (!m.visible) { m.visible = true; hid.push(m); }      // détails proches, sous-sols et étages cachés selon la caméra : tous visibles pour les relevés      // mêmes lumières que la vue du joueur : l'état des lumières (donc les programmes) ne change pas
    try { fn(); } finally { for (const m of hid) m.visible = false; renderer.setRenderTarget(prt, pf, pm); renderer.autoClear = ac; renderer.setClearColor(clr, ca); sm.autoUpdate = au; sm.needsUpdate = nu; }
  }
  function depthJob(i) {
    const c = cl[i], rt = capRT(i, c.w, c.h), cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2, hx = (c.x1 - c.x0) / 2, hz = (c.z1 - c.z0) / 2;
    Object.assign(ortho, { left: -hx, right: hx, top: hz, bottom: -hz, near: .1, far: 48 }); ortho.position.set(cx, c.y + 40, cz); ortho.rotation.set(-Math.PI / 2, 0, 0); ortho.updateProjectionMatrix(); ortho.updateMatrixWorld(true);
    capM.uniforms.uLv.value = c.y; const saved = objs.map(m => m.material);
    withState(() => {
      const bg = scene.background, wm = list.filter(w => w.kind !== 'cave').map(w => [w.m, w.m.material]);
      try {
        for (const m of objs) m.material = m.isInstancedMesh ? capMI : capM; scene.background = null; renderer.setClearColor(0x000000, 1); renderer.setRenderTarget(rt); rt.texture.generateMipmaps = false; renderer.render(scene, ortho);
        for (const [m] of wm) { m.material = capMW; m.layers.enable(LAYW); } ortho.layers.set(LAYW); renderer.autoClear = false; rt.texture.generateMipmaps = true; renderer.render(scene, ortho);
      } finally { objs.forEach((m, k) => { m.material = saved[k]; }); for (const [m, mm] of wm) m.material = mm; scene.background = bg; ortho.layers.set(LAY); }
    });
    const k = i ? 'B' : 'A'; U['fzD' + k].value = rt.texture; U['fzR' + k].value.set(c.x0, c.z0, 1 / (c.x1 - c.x0), 1 / (c.z1 - c.z0)); U['fzQ' + k].value.set(c.y, c.lod, 1, 0);
  }
  function cubeOk() {      /* la scène est-elle rendue dans une cible ? sinon ses programmes sont ceux de l'écran : l'image cube en compilerait d'autres */
    const p = o.probe && renderer.properties.get(o.probe);
    if (!p || !p.currentProgram) return null;
    return p.outputColorSpace === THREE.LinearSRGBColorSpace && p.toneMapping === THREE.NoToneMapping;
  }
  function bedJob(i) {      /* fond vu de dessus, avec les matériaux et la lumière de la scène, caméra 2,5 m au-dessus de l'eau (brouillard négligeable, ce qui dépasse est coupé) */
    const c = cl[i], rt = bedRT(i, c.w, c.h, half), cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2, hx = (c.x1 - c.x0) / 2, hz = (c.z1 - c.z0) / 2;
    Object.assign(ortho, { left: -hx, right: hx, top: hz, bottom: -hz, near: .05, far: 12 }); ortho.position.set(cx, c.y + 2.5, cz); ortho.rotation.set(-Math.PI / 2, 0, 0); ortho.updateProjectionMatrix(); ortho.updateMatrixWorld(true);
    withState(() => { const bg = scene.background; try { scene.background = null; ortho.layers.mask = (1 << LAY) | (1 << LAYX); renderer.setClearColor(0x000000, 1); renderer.setRenderTarget(rt); renderer.render(scene, ortho); } finally { scene.background = bg; ortho.layers.set(LAY); } });
    const k = i ? 'B' : 'A'; U['fzB' + k].value = rt.texture; U['fzQ' + k].value.w = 1;
  }
  function cubeJob(i, f) {
    const c = cl[i], q = cubeRT(i, 128, half), cam = q.cam;
    if (cam.coordinateSystem !== renderer.coordinateSystem) { cam.coordinateSystem = renderer.coordinateSystem; cam.updateCoordinateSystem(); }
    cam.layers.mask = (1 << LAY) | (1 << LAYH) | (1 << LAYX); cam.position.set(Math.min(Math.max((c.x0 + c.x1) / 2, -S), S), c.y + .6, Math.min(Math.max((c.z0 + c.z1) / 2, -S), S)); cam.updateMatrixWorld(true);
    const last = f === 5; q.rt.texture.generateMipmaps = last;
    withState(() => { renderer.setRenderTarget(q.rt, f); renderer.render(scene, cam.children[f]); });
    if (last) { const k = i ? 'B' : 'A'; U['fzC' + k].value = q.rt.texture; U['fzCp' + k].value.set(cam.position.x, cam.position.y, cam.position.z, 1); }
  }
  return {
    tier,
    update(dt, time) {
      U.fzT.value = time % 3600;
      if (!jobs.length || ++frame < 4) return;
      const j = jobs[0];
      if (j[0] === 'd') { for (const cm of [capM, capMI, capMW]) { const p = renderer.properties.get(cm).currentProgram; if (p && !p.isReady()) return; } }
      else { const ok = cubeOk(); if (ok === null) return; if (!ok) { debug.skipped = 'fond et cube : scène rendue à l\'écran'; jobs = jobs.filter(q => q[0] === 'd'); return; } }
      jobs.shift(); const t0 = performance.now();
      if (!objs) collect();
      if (j[0] === 'd') depthJob(j[1]); else if (j[0] === 'b') bedJob(j[1]); else cubeJob(j[1], j[2]);
      debug.done.push(j.join('')); debug.ms.push(+(performance.now() - t0).toFixed(2));
    },
    restore() { try { if (cl.length) prepCap(renderer); } catch { /* compilés à la première utilisation */ } plan(); for (const k of ['A', 'B']) { U['fzQ' + k].value.z = 0; U['fzQ' + k].value.w = 0; U['fzCp' + k].value.w = 0; } },
    dispose() { jobs = []; objs = null; for (const k of ['A', 'B']) { U['fzQ' + k].value.z = 0; U['fzCp' + k].value.w = 0; U['fzD' + k].value = null; U['fzC' + k].value = null; U['fzB' + k].value = null; U['fzQ' + k].value.w = 0; } },
  };
}
