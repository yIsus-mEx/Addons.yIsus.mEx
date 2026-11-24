// Revisa el catálogo antes de publicar. Si hay ERRORES, detiene el deploy.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const base = join(dirname(fileURLToPath(import.meta.url)), "..");
const errores = [], avisos = [];
const err = (f, m) => errores.push(`✖ ${f}: ${m}`);
const avi = (f, m) => avisos.push(`⚠ ${f}: ${m}`);
const ID = /^tt\d{7,}$/;
const CAMPOS_STREAM = ["url", "calidad", "codec", "formato", "tamano", "duracion", "audios", "subs", "servidor", "nota"];

function leer(ruta, nombre) {
  try { return JSON.parse(readFileSync(ruta, "utf8")); }
  catch (e) { err(nombre, "JSON inválido → " + e.message); return null; }
}
function revisarStreams(f, donde, streams) {
  if (!Array.isArray(streams)) { err(f, `${donde}: "streams" debe ser una lista [ ]`); return 0; }
  streams.forEach((s, i) => {
    const d = `${donde}, enlace ${i + 1}`;
    if (!s || typeof s !== "object") return err(f, `${d}: no es un objeto { }`);
    if (!s.url) err(f, `${d}: falta "url"`);
    else if (!/^https?:\/\//.test(s.url)) err(f, `${d}: "url" debe empezar con http:// o https://`);
    for (const k of Object.keys(s)) if (!CAMPOS_STREAM.includes(k)) avi(f, `${d}: campo desconocido "${k}" (¿error de escritura?)`);
    for (const k of ["audios", "subs"]) if (s[k] !== undefined && !Array.isArray(s[k])) err(f, `${d}: "${k}" debe ser una lista, ej. ["Latino", "English"]`);
  });
  return streams.length;
}

const cfg = leer(join(base, "config.json"), "config.json");
if (cfg) for (const k of ["id", "version", "name"]) if (!cfg[k]) err("config.json", `falta "${k}"`);

const nombresPorId = new Map();
const vistoNombreCat = new Set();
let pelis = 0, conVideo = 0, eps = 0;

for (const sub of ["peliculas", "series"]) {
  const dir = join(base, "catalogo", sub);
  if (!existsSync(dir)) continue;
  for (const archivo of readdirSync(dir).filter((x) => x.endsWith(".json") && !x.startsWith("_"))) {
    const f = `${sub}/${archivo}`;
    const c = leer(join(dir, archivo), f);
    if (!c) continue;
    if (!c.nombre) err(f, 'falta "nombre" de la categoría');
    const clave = `${sub}:${String(c.nombre).toLowerCase()}`;
    if (vistoNombreCat.has(clave)) err(f, `ya hay otra categoría de ${sub} llamada "${c.nombre}"`);
    vistoNombreCat.add(clave);
    const campo = sub === "peliculas" ? "peliculas" : "series";
    const items = c[campo];
    if (!Array.isArray(items)) { err(f, `falta la lista "${campo}": [ ]`); continue; }
    const idsEnArchivo = new Set();
    items.forEach((x, i) => {
      const d = `${x?.nombre || "elemento " + (i + 1)}`;
      if (!x?.id) return err(f, `${d}: falta "id"`);
      if (!ID.test(x.id)) err(f, `${d}: id "${x.id}" no parece de IMDb (tt + 7 o más números)`);
      if (!x.nombre) err(f, `${x.id}: falta "nombre"`);
      if (idsEnArchivo.has(x.id)) err(f, `${d}: está repetido en este archivo`);
      idsEnArchivo.add(x.id);
      const prev = nombresPorId.get(x.id);
      if (prev && prev !== x.nombre) avi(f, `${x.id} se llama "${x.nombre}" aquí y "${prev}" en otro archivo`);
      nombresPorId.set(x.id, x.nombre);
      if (sub === "peliculas") {
        pelis++;
        if (revisarStreams(f, d, x.streams ?? [])) conVideo++;
      } else {
        if (!x.temporadas || typeof x.temporadas !== "object") return err(f, `${d}: falta "temporadas": { }`);
        for (const [t, epis] of Object.entries(x.temporadas)) {
          if (!/^\d+$/.test(t)) err(f, `${d}: temporada "${t}" debe ser un número`);
          for (const [e, st] of Object.entries(epis || {})) {
            if (!/^\d+$/.test(e)) err(f, `${d} T${t}: episodio "${e}" debe ser un número`);
            if (revisarStreams(f, `${d} T${t}E${e}`, st)) eps++;
          }
        }
      }
    });
  }
}

for (const a of avisos) console.log(a);
for (const e of errores) console.log(e);
console.log(`\nResumen: ${pelis} películas (${conVideo} con enlace) · ${eps} episodios con enlace · ${errores.length} errores · ${avisos.length} avisos`);
if (errores.length) { console.log("✖ Corrige los errores antes de publicar."); process.exit(1); }
console.log("✔ Catálogo correcto.");
