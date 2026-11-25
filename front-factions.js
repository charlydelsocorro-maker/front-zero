// FRONT ZÉRO — the two factions of the living front ("Front vivant"): names, mottos, colours and emblems (inline SVG).
// Client data only (front-ui.js reads it). The server only knows the sides 'A' and 'B'; which pair of names they wear is chosen here.
// All names, mottos and emblems are original: no real-world army, unit or insignia, no faction or logo of an existing game.
// Side A holds the west of the theatre (coast, marsh, north-west mines), side B the east (refinery, dry hills, south-east valley).

export const LANGS = ['fr', 'en', 'es', 'de', 'pt', 'it'];

/* ---------- emblems: 64×64 SVG, a plate (shape + rim) and a glyph; drawn from geometry, no font ---------- */
const HEX = '32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5', HEXF = '17,6 47,6 61,32 47,58 17,58 3,32', OCT = '22,4 42,4 60,22 60,42 42,60 22,60 4,42 4,22';
const plate = (shape, f) => shape === 'circle'
  ? `<circle cx="32" cy="32" r="28.5" fill="${f.dark}" stroke="${f.main}" stroke-width="3"/><circle cx="32" cy="32" r="24" fill="none" stroke="${f.main}" stroke-opacity=".28" stroke-width="1"/>`
  : `<polygon points="${shape}" fill="${f.dark}" stroke="${f.main}" stroke-width="3" stroke-linejoin="round"/>`;
const GLYPH = {
  /* a watch beacon over a sea wall, two beams */
  vigie: f => `<polygon points="35,20.5 53,14.5 53,26.5" fill="${f.main}" opacity=".42"/><polygon points="29,20.5 11,14.5 11,26.5" fill="${f.main}" opacity=".42"/>`
    + `<polygon points="28,47 36,47 34.4,25 29.6,25" fill="${f.main}"/><rect x="28.6" y="17.5" width="6.8" height="7" fill="${f.light}"/><polygon points="27.5,17.8 36.5,17.8 32,12" fill="${f.main}"/>`
    + `<rect x="15" y="47" width="34" height="4.5" fill="${f.main}"/><path d="M17 55.5 q3.75 -3 7.5 0 t7.5 0 t7.5 0 t7.5 0" fill="none" stroke="${f.main}" stroke-width="2" opacity=".7"/>`,
  /* a furnace flame over a grate */
  fournaise: f => `<path d="M32 11 C38.5 19 45 25 43 35 C42 41.5 37.5 46 32 47 C26.5 46 22 41.5 21 35.5 C20 29 24.5 25.5 26.8 20 C28 25.5 30 27.5 32.2 28 C30.8 22 30.8 16.5 32 11 Z" fill="${f.main}"/>`
    + `<path d="M32 30.5 C35.2 34.5 37.4 37.5 36.6 40.6 C35.9 43.2 34 44.4 32 44.4 C30 44.4 28.1 43.2 27.4 40.6 C26.8 37.5 29 34.5 32 30.5 Z" fill="${f.light}"/>`
    + `<rect x="17" y="49" width="30" height="4" fill="${f.main}"/><rect x="21" y="53" width="3" height="4" fill="${f.main}"/><rect x="30.5" y="53" width="3" height="4" fill="${f.main}"/><rect x="40" y="53" width="3" height="4" fill="${f.main}"/>`,
  /* three slanted slate slabs */
  ardoise: f => `<polygon points="16,21 45,16.5 48,23 19,27.5" fill="${f.light}"/><polygon points="16,31.5 45,27 48,33.5 19,38" fill="${f.main}"/><polygon points="16,42 45,37.5 48,44 19,48.5" fill="${f.main}" opacity=".8"/>`,
  /* a flat-topped butte with its strata */
  ocre: f => `<polygon points="11,47 21,31 25.5,31 29,22.5 39.5,22.5 43,31 53,47" fill="${f.main}"/><path d="M17.5 37.5 H47 M14 43 H50.5" stroke="${f.dark}" stroke-width="2.2"/><path d="M27 27 H41.5" stroke="${f.light}" stroke-width="2"/>`,
  /* the zero meridian: a globe ring, one meridian, the axis */
  meridiens: f => `<circle cx="32" cy="32" r="16.5" fill="none" stroke="${f.main}" stroke-width="3"/><ellipse cx="32" cy="32" rx="7.5" ry="16.5" fill="none" stroke="${f.main}" stroke-width="2.2" opacity=".75"/><rect x="30" y="15.5" width="4" height="33" fill="${f.light}"/><polygon points="32,6.5 35.5,11.5 28.5,11.5" fill="${f.light}"/><polygon points="32,57.5 35.5,52.5 28.5,52.5" fill="${f.light}"/>`,
  /* the parallels: a globe ring, two parallels, the line */
  paralleles: f => `<circle cx="32" cy="32" r="16.5" fill="none" stroke="${f.main}" stroke-width="3"/><path d="M18.5 22.5 H45.5 M18.5 41.5 H45.5" stroke="${f.main}" stroke-width="2.2" opacity=".75"/><rect x="15.5" y="30" width="33" height="4" fill="${f.light}"/><polygon points="6.5,32 11.5,28.5 11.5,35.5" fill="${f.light}"/><polygon points="57.5,32 52.5,28.5 52.5,35.5" fill="${f.light}"/>`,
};

const F = (id, name, plateShape, main, light, dark, motto) => ({ id, name, plate: plateShape, main, light, dark, motto });
/** Three candidate pairs. [A (west), B (east)]. Mottos in fr, en, es, de, pt, it. */
export const CANDIDATES = [
  { id: 'vf', concept: ['Guet et fournaise', 'Watch and furnace', 'Vigía y horno', 'Wache und Glut', 'Vigia e fornalha', 'Vedetta e fornace'], sides: [
    F('vigie', 'VIGIE', HEX, '#3cc9a6', '#c8f2e6', '#0c2520', ['Rien ne franchit la ligne.', 'Nothing crosses the line.', 'Nada cruza la línea.', 'Nichts überquert die Linie.', 'Nada atravessa a linha.', 'Niente supera la linea.']),
    F('fournaise', 'FOURNAISE', OCT, '#e57a3a', '#ffd6b5', '#2a1409', ['Ce qui brûle avance.', 'What burns moves forward.', 'Lo que arde avanza.', 'Was brennt, rückt vor.', 'O que arde avança.', 'Ciò che brucia avanza.']),
  ] },
  { id: 'ao', concept: ['Pierre et poussière', 'Stone and dust', 'Piedra y polvo', 'Stein und Staub', 'Pedra e poeira', 'Pietra e polvere'], sides: [
    F('ardoise', 'ARDOISE', HEXF, '#8f97e0', '#e0e3ff', '#15182f', ['Dure, froide, debout.', 'Hard, cold, standing.', 'Dura, fría, en pie.', 'Hart, kalt, aufrecht.', 'Dura, fria, de pé.', 'Dura, fredda, in piedi.']),
    F('ocre', 'OCRE', 'circle', '#cc6e3e', '#ffd9bd', '#2b140b', ['La poussière ne nous arrête pas.', 'Dust does not stop us.', 'El polvo no nos detiene.', 'Staub hält uns nicht auf.', 'A poeira não nos trava.', 'La polvere non ci ferma.']),
  ] },
  { id: 'mp', concept: ['Les lignes de la carte', 'The lines of the map', 'Las líneas del mapa', 'Die Linien der Karte', 'As linhas do mapa', 'Le linee della mappa'], sides: [
    F('meridiens', 'MÉRIDIENS', 'circle', '#6fd6e8', '#ddf8fd', '#0b2228', ['Tout part de la ligne zéro.', 'Everything starts at line zero.', 'Todo parte de la línea cero.', 'Alles beginnt an der Linie null.', 'Tudo parte da linha zero.', 'Tutto parte dalla linea zero.']),
    F('paralleles', 'PARALLÈLES', 'circle', '#e2649f', '#ffd8ea', '#290e1b', ['Côte à côte, jusqu’au bout.', 'Side by side, to the end.', 'Codo con codo, hasta el final.', 'Seite an Seite, bis zum Ende.', 'Lado a lado, até ao fim.', 'Fianco a fianco, fino in fondo.']),
  ] },
];

/** The pair in use. PROVISIONAL until the player picks (candidate 0 meanwhile): change only this index. */
export const ACTIVE = 0;
export const FACTIONS = { A: CANDIDATES[ACTIVE].sides[0], B: CANDIDATES[ACTIVE].sides[1] };

/** Inline SVG of an emblem (decorative: aria-hidden). size in px; glow adds a soft outer halo (menus only, never in a match). */
export function emblem(f, size = 64, glow = false) {
  const g = GLYPH[f.id] ? GLYPH[f.id](f) : '';
  const halo = glow ? ` style="filter:drop-shadow(0 0 ${Math.round(size / 9)}px ${f.main}66)"` : '';
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" focusable="false"${halo}>${plate(f.plate, f)}${g}</svg>`;
}
export const motto = (f, lang) => { const i = LANGS.indexOf(lang); return f.motto[i < 0 ? 0 : i] || f.motto[0]; };
