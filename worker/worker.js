// ════════════════════════════════════════════════════════════════════
//  WORKER T3mPL4ri0s — la lógica. No necesitas tocar este archivo.
//  Los datos viven en config.json y en catalogo/peliculas/*.json y catalogo/series/*.json.
//  El índice (catalogo/_indice.js) lo genera solo "npm run deploy".
// ════════════════════════════════════════════════════════════════════
import ADDON from "./config.json";
import INDICE from "./catalogo/_indice.js";

const slug = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ordenar = (lista) => [...lista].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || String(a.nombre).localeCompare(String(b.nombre)));
const juntar = (destino, nuevos = []) => { for (const s of nuevos) if (!destino.some((x) => x.url === s.url)) destino.push(s); };

// ── Películas: índice por ID (si está en varias categorías, se juntan sus enlaces)
const PELIS = new Map();
for (const cat of INDICE.peliculas) for (const p of cat.peliculas || []) {
  if (!PELIS.has(p.id)) PELIS.set(p.id, { ...p, streams: [] });
  juntar(PELIS.get(p.id).streams, p.streams);
}
// ── Series: índice por ID y por "id:temporada:episodio"
const SERIES = new Map();
const EPISODIOS = new Map();
for (const cat of INDICE.series) for (const s of cat.series || []) {
  if (!SERIES.has(s.id)) SERIES.set(s.id, { ...s, total: 0 });
  for (const [t, eps] of Object.entries(s.temporadas || {})) for (const [e, streams] of Object.entries(eps || {})) {
    const key = `${s.id}:${Number(t)}:${Number(e)}`;
    if (!EPISODIOS.has(key)) { EPISODIOS.set(key, { serie: s, t: Number(t), e: Number(e), streams: [] }); SERIES.get(s.id).total++; }
    juntar(EPISODIOS.get(key).streams, streams);
  }
}
const pelisConVideo = (lista) => (lista || []).filter((p) => PELIS.get(p.id)?.streams.length);
const seriesConVideo = (lista) => (lista || []).filter((s) => SERIES.get(s.id)?.total);

const CATS = [
  ...ordenar(INDICE.peliculas).map((c) => ({ tipo: "movie", id: "t3-p-" + slug(c.nombre), nombre: c.nombre, items: pelisConVideo(c.peliculas) })),
  ...ordenar(INDICE.series).map((c) => ({ tipo: "series", id: "t3-s-" + slug(c.nombre), nombre: c.nombre, items: seriesConVideo(c.series) })),
].filter((c) => c.items.length);
const TODAS = {
  movie: [...PELIS.values()].filter((p) => p.streams.length),
  series: [...SERIES.values()].filter((s) => s.total),
};

function manifest() {
  const catalogs = [];
  if (TODAS.movie.length) catalogs.push({ type: "movie", id: "t3-peliculas", name: ADDON.name });
  if (TODAS.series.length) catalogs.push({ type: "series", id: "t3-series", name: ADDON.name });
  for (const c of CATS) catalogs.push({ type: c.tipo, id: c.id, name: `${ADDON.name} · ${c.nombre}` });
  return {
    ...ADDON,
    resources: ["catalog", { name: "stream", types: ["movie", "series"], idPrefixes: ["tt"] }],
    types: ["movie", "series"],
    catalogs,
  };
}

const preview = (x, type) => ({
  id: x.id, type, name: x.nombre, releaseInfo: x.anio ? String(x.anio) : undefined,
  poster: `https://images.metahub.space/poster/medium/${x.id}/img`,
});

function catalog(type, id) {
  if (id === "t3-peliculas" && type === "movie") return { metas: TODAS.movie.map((p) => preview(p, "movie")) };
  if (id === "t3-series" && type === "series") return { metas: TODAS.series.map((s) => preview(s, "series")) };
  const c = CATS.find((x) => x.id === id && x.tipo === type);
  return { metas: c ? c.items.map((x) => preview(x, type)) : [] };
}

// ── Arma el texto que Nuvio muestra en la fuente, siempre con el mismo formato
function texto(titulo, s) {
  const lineas = [titulo];
  const video = [s.calidad, s.codec, s.formato].filter(Boolean).join(" · ");
  if (video) lineas.push("📺 " + video);
  const info = [s.tamano && "💾 " + s.tamano, s.servidor && "⚙ " + s.servidor, s.duracion && "⏱ " + s.duracion].filter(Boolean).join("  ");
  if (info) lineas.push(info);
  if (s.audios?.length) lineas.push("🔊 " + s.audios.join(" / "));
  if (s.subs?.length) lineas.push("💬 " + s.subs.join(" / "));
  if (s.nota) lineas.push(s.nota);
  return lineas.join("\n");
}
const fuente = (titulo, s) => ({ name: `${ADDON.name}${s.calidad ? "\n" + s.calidad : ""}`, title: texto(titulo, s), url: s.url });
const dos = (n) => String(n).padStart(2, "0");

function stream(type, id) {
  if (type === "movie") {
    const p = PELIS.get(id);
    return { streams: p ? p.streams.map((s) => fuente(`${p.nombre}${p.anio ? ` (${p.anio})` : ""}`, s)) : [] };
  }
  if (type === "series") {
    const ep = EPISODIOS.get(id);
    return { streams: ep ? ep.streams.map((s) => fuente(`${ep.serie.nombre} · T${dos(ep.t)}E${dos(ep.e)}`, s)) : [] };
  }
  return { streams: [] };
}

// ── El "servidor"
const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "max-age=300",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: HEADERS });

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: HEADERS });
    const path = decodeURIComponent(new URL(request.url).pathname);
    if (path === "/" || path === "/manifest.json") return json(manifest());
    let m = path.match(/^\/catalog\/(movie|series)\/([^/]+?)(?:\/[^/]*)?\.json$/);
    if (m) return json(catalog(m[1], m[2]));
    m = path.match(/^\/stream\/(movie|series)\/([^/]+)\.json$/);
    if (m) return json(stream(m[1], m[2]));
    return json({ error: "no encontrado" }, 404);
  },
};
