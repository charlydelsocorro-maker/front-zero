/* [fluid] FRONT ZÉRO : lumières ponctuelles, projecteurs et soleil évalués seulement là où ils éclairent.
   three.js calcule l'éclairage complet (GGX) de CHAQUE lampe visible pour CHAQUE pixel éclairé, même quand la lampe est hors de portée
   (couleur nulle au-delà de sa distance), éteinte (lueur d'explosion, flamme de bouche, lampe torche à 0) ou cachée par l'ombre du soleil.
   On saute ce calcul quand la couleur incidente est exactement nulle : sa contribution est nulle, l'image est la même.
   Appliqué une fois, à l'import, avant toute compilation de shader : même nombre de programmes, aucun programme en plus. */
import * as THREE from 'three';

const CALL = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
const GUARDED = 'if ( any( notEqual( directLight.color, vec3( 0.0 ) ) ) ) ' + CALL;

export const lightCull = (() => {
  try {
    const src = THREE.ShaderChunk.lights_fragment_begin;
    if (typeof src !== 'string' || src.indexOf(CALL) < 0 || src.indexOf(GUARDED) >= 0) return false;       // three changed, or already done: leave it as it is
    THREE.ShaderChunk.lights_fragment_begin = src.split(CALL).join(GUARDED);
    return true;
  } catch (e) { console.warn('[lightcull]', e); return false; }
})();
