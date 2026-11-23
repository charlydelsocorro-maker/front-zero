// FRONT ZÉRO — engine helper: pooled tracers / impact particles and the post-processing chain.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export function createFx(scene) {
  const TR = 64, PF = 192, LIFE = 0.075, PLIFE = 0.36;
  const trP = new Float32Array(TR * 6), trC = new Float32Array(TR * 8), trL = new Float32Array(TR), trO = new Float32Array(TR), cT = new THREE.Color();
  let trI = 0, pfI = 0, density = 1, trLive = false, pfLive = false;
  const trG = new THREE.BufferGeometry();
  trG.setAttribute('position', new THREE.BufferAttribute(trP, 3).setUsage(THREE.DynamicDrawUsage));
  trG.setAttribute('color', new THREE.BufferAttribute(trC, 4).setUsage(THREE.DynamicDrawUsage));
  const trM = new THREE.LineSegments(trG, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false }));
  trM.frustumCulled = false; trM.renderOrder = 4; scene.add(trM);
  const pfP = new Float32Array(PF * 3), pfC = new Float32Array(PF * 4), pfV = new Float32Array(PF * 3), pfL = new Float32Array(PF);
  for (let i = 0; i < PF; i++) pfP[i * 3 + 1] = -60;
  const pfG = new THREE.BufferGeometry();
  pfG.setAttribute('position', new THREE.BufferAttribute(pfP, 3).setUsage(THREE.DynamicDrawUsage));
  pfG.setAttribute('color', new THREE.BufferAttribute(pfC, 4).setUsage(THREE.DynamicDrawUsage));
  const dot = document.createElement('canvas'); dot.width = dot.height = 32;
  { const x = dot.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, '#fff'); g.addColorStop(0.6, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); }
  const pfM = new THREE.Points(pfG, new THREE.PointsMaterial({ size: 0.22, map: new THREE.CanvasTexture(dot), vertexColors: true, transparent: true, depthWrite: false }));
  pfM.frustumCulled = false; pfM.renderOrder = 4; scene.add(pfM);
  return {
    setDensity(k) { density = Math.max(0, k); },
    tracer(ax, ay, az, bx, by, bz, col = 0xffdf9e, o = 0.7) {
      const i = trI, k = i * 6, c = i * 8; trI = (trI + 1) % TR;
      trP[k] = ax; trP[k + 1] = ay; trP[k + 2] = az; trP[k + 3] = bx; trP[k + 4] = by; trP[k + 5] = bz;
      cT.set(col); trC[c] = trC[c + 4] = cT.r; trC[c + 1] = trC[c + 5] = cT.g; trC[c + 2] = trC[c + 6] = cT.b; trC[c + 3] = o * 0.25; trC[c + 7] = o;
      trL[i] = LIFE; trO[i] = o; trLive = true; trG.attributes.position.needsUpdate = true; trG.attributes.color.needsUpdate = true;
    },
    puff(x, y, z, col, count = 4, speed = 1) {
      const n = Math.max(density > 0 ? 1 : 0, Math.round(count * density)); cT.set(col);
      for (let q = 0; q < n; q++) {
        const i = pfI, k = i * 3, c = i * 4; pfI = (pfI + 1) % PF;
        pfP[k] = x; pfP[k + 1] = y; pfP[k + 2] = z; pfV[k] = rnd(-1.6, 1.6) * speed; pfV[k + 1] = rnd(0.4, 2.7) * speed; pfV[k + 2] = rnd(-1.6, 1.6) * speed;
        pfC[c] = cT.r; pfC[c + 1] = cT.g; pfC[c + 2] = cT.b; pfC[c + 3] = 0.75; pfL[i] = PLIFE;
      }
      if (n) pfLive = true;
    },
    update(dt) {
      if (trLive) {
        let any = false;
        for (let i = 0; i < TR; i++) { if (trL[i] <= 0) continue; trL[i] -= dt; const a = trL[i] > 0 ? trO[i] * trL[i] / LIFE : 0, c = i * 8; trC[c + 3] = a * 0.25; trC[c + 7] = a; any = true; }
        trG.attributes.color.needsUpdate = true; trLive = any;
      }
      if (pfLive) {
        let any = false;
        for (let i = 0; i < PF; i++) {
          if (pfL[i] <= 0) continue; pfL[i] -= dt; const k = i * 3;
          pfP[k] += pfV[k] * dt; pfP[k + 1] += pfV[k + 1] * dt; pfP[k + 2] += pfV[k + 2] * dt; pfV[k + 1] -= 7 * dt;
          pfC[i * 4 + 3] = pfL[i] > 0 ? pfL[i] / PLIFE * 0.75 : 0; any = true;
        }
        pfG.attributes.position.needsUpdate = true; pfG.attributes.color.needsUpdate = true; pfLive = any;
      }
    },
    clear() { trL.fill(0); pfL.fill(0); for (let i = 0; i < TR; i++) trC[i * 8 + 3] = trC[i * 8 + 7] = 0; for (let i = 0; i < PF; i++) pfC[i * 4 + 3] = 0; trG.attributes.color.needsUpdate = true; pfG.attributes.color.needsUpdate = true; },
  };
}

/* Final pass: optional FXAA (compact, no LOD bias), colour grade, 4-tap glow on bright pixels (top quality levels only, no extra pass), vignette, grain, slight chromatic aberration. */
const FinalShader = {
  uniforms: { tDiffuse: { value: null }, t: { value: 0 }, uVig: { value: 1 }, uGrain: { value: 1 }, uCa: { value: 1 }, uGrade: { value: 1 }, uFx: { value: 0 }, uGlow: { value: 0 }, uPx: { value: new THREE.Vector2(1 / 1280, 1 / 720) } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader: `uniform sampler2D tDiffuse;uniform float t,uVig,uGrain,uCa,uGrade,uFx,uGlow;uniform vec2 uPx;varying vec2 vUv;
  vec3 hot(vec2 o){return max(texture2D(tDiffuse,vUv+o*uPx).rgb-.8,0.);}
  // per-pixel hash without sin(): the old fract(sin(dot(uv))) grain drew fine rings and a woven mesh over flat areas such as the sky
  float n(vec2 p){p+=floor(t*60.)*vec2(17.,59.);vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
  vec3 fxaa(vec3 m){
   const vec3 L=vec3(.299,.587,.114);
   float nw=dot(texture2D(tDiffuse,vUv+vec2(-1.,-1.)*uPx).rgb,L),ne=dot(texture2D(tDiffuse,vUv+vec2(1.,-1.)*uPx).rgb,L),sw=dot(texture2D(tDiffuse,vUv+vec2(-1.,1.)*uPx).rgb,L),se=dot(texture2D(tDiffuse,vUv+vec2(1.,1.)*uPx).rgb,L),lm=dot(m,L);
   float lo=min(lm,min(min(nw,ne),min(sw,se))),hi=max(lm,max(max(nw,ne),max(sw,se)));
   if(hi-lo<max(.03,hi*.1))return m;
   vec2 d=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));
   float r=1./(min(abs(d.x),abs(d.y))+max((nw+ne+sw+se)*.03125,.0078125));
   d=clamp(d*r,-8.,8.)*uPx;
   vec3 a=.5*(texture2D(tDiffuse,vUv+d*(1./3.-.5)).rgb+texture2D(tDiffuse,vUv+d*(2./3.-.5)).rgb);
   vec3 b=a*.5+.25*(texture2D(tDiffuse,vUv-d*.5).rgb+texture2D(tDiffuse,vUv+d*.5).rgb);
   float lb=dot(b,L);return(lb<lo||lb>hi)?a:b;}
  void main(){vec2 c=vUv-.5;float r=dot(c,c);
  vec3 col=texture2D(tDiffuse,vUv).rgb;
  if(uFx>.5)col=fxaa(col);
  if(uGrade>.5){
   if(uCa>.5){vec2 o=c*r*.006;vec3 m=texture2D(tDiffuse,vUv).rgb;col.r+=texture2D(tDiffuse,vUv+o).r-m.r;col.b+=texture2D(tDiffuse,vUv-o).b-m.b;}
   if(uGlow>.5)col+=(hot(vec2(7.,3.))+hot(vec2(-7.,-3.))+hot(vec2(-3.,7.))+hot(vec2(3.,-7.)))*.16;
   float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l),col,.95);
   // cool shade, warm light; then a toe that opens the shadows without greying the blacks or touching the highlights (the old contrast S-curve crushed everything under 16/255)
   col*=mix(vec3(.95,.99,1.06),vec3(1.04,1.,.94),smoothstep(.1,.7,l));
   col=clamp(col,0.,1.);col+=.42*col*(1.-col)*(1.-col);col=col*.975+.02;
   col*=1.-smoothstep(.2,.8,r)*.24*uVig;col+=(n(gl_FragCoord.xy)-.5)*(.022*uGrain+.005);}
  gl_FragColor=vec4(col,1.);}`,
};

/** Post chain: scene -> (MSAA target) -> output (tone map + sRGB) -> one final pass (FXAA and/or grade). */
export function createPost(renderer, scene, camera) {
  // Half-float colour buffers are an extension: without it the target would be incomplete and the screen blank, so fall back to 8 bits.
  const gl2 = renderer.capabilities.isWebGL2, xt = renderer.extensions;
  const hdr = gl2 ? (xt.has('EXT_color_buffer_float') || xt.has('EXT_color_buffer_half_float')) : (xt.has('OES_texture_half_float') && xt.has('EXT_color_buffer_half_float'));
  if (!hdr) console.warn('[post] half-float render targets unavailable: 8-bit colour buffer');
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 0 }));
  composer.addPass(new RenderPass(scene, camera)); composer.addPass(new OutputPass());
  const fin = new ShaderPass(FinalShader); composer.addPass(fin);
  let samples = 0, direct = false, sW = 0, sH = 0, sR = 0;
  const p = {
    composer, final: fin,
    /** Target the scene pass draws into (null = straight to the canvas). Program variants depend on it: the loader compiles against it. */
    get target() { return direct ? null : composer.readBuffer; },
    /** Loading: create the pass programs now, without blocking (they link in the background), instead of on the first frame. */
    prewarm() {
      if (direct) return;
      const out = composer.passes[1], fake = { outputColorSpace: renderer.outputColorSpace, toneMapping: renderer.toneMapping, toneMappingExposure: renderer.toneMappingExposure, setRenderTarget() {}, clear() {}, render() {} };
      try { out.render(fake, null, composer.readBuffer); } catch { /* pass internals changed: it compiles on first use instead */ }   // lets the pass set its own defines
      for (const ps of [out, fin]) { if (!ps.enabled || !ps.fsQuad || !ps.fsQuad._mesh) continue; renderer.setRenderTarget(ps === fin || !fin.enabled ? null : composer.readBuffer); renderer.compile(ps.fsQuad._mesh, camera); }
      renderer.setRenderTarget(null);
    },
    configure({ post, grain, vignette, fxaa: fx, msaa, reduced, q = 0 }) {
      const u = fin.uniforms; fin.enabled = !!post || !!fx;
      u.uGrade.value = post ? 1 : 0; u.uFx.value = fx ? 1 : 0; u.uGrain.value = grain ? 1 : 0; u.uVig.value = vignette ? 1 : 0; u.uCa.value = reduced ? 0 : 1;
      u.uGlow.value = post && q < 2 ? 1 : 0;       // ladder levels 0-1 only
      // surface weathering and baked contact shadow (maps.js): a uniform, so switching never recompiles a program
      const look = q < 3 ? 1 : 0; scene.userData.fzLook = look; if (scene.userData.fzLookU) scene.userData.fzLookU.value = look;
      const s = msaa && gl2 ? 4 : 0;       // multisampled targets need WebGL 2
      if (s !== samples) { samples = s; for (const rt of [composer.renderTarget1, composer.renderTarget2]) { rt.samples = s; rt.dispose(); } }
      direct = !post && !fx && !s;
    },
    setSize(W, H, ratio) {
      if (W !== sW || H !== sH || ratio !== sR) {   // one drawing-buffer and one target reallocation, and only when something changed (a resize is a visible hitch)
        sW = W; sH = H; sR = ratio; renderer.setDrawingBufferSize(W, H, ratio); composer._width = W; composer._height = H; composer.setPixelRatio(ratio);
      }
      fin.uniforms.uPx.value.set(1 / Math.max(1, W * ratio), 1 / Math.max(1, H * ratio));
    },
    render(dt, time) {
      if (direct) { renderer.render(scene, camera); return; }
      fin.uniforms.t.value = time % 10; composer.render(dt);
    },
  };
  return p;
}
