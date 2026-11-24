// Revisa catalogo/peliculas y catalogo/series y escribe catalogo/_indice.js
// (la lista de archivos que Wrangler debe incluir). Corre solo con "npm run deploy".
import { readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "catalogo");
const lista = (sub) => existsSync(join(raiz, sub))
  ? readdirSync(join(raiz, sub)).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort()
  : [];

const lineas = ["// ARCHIVO GENERADO AUTOMÁTICAMENTE por scripts/generar-indice.mjs — no lo edites.", ""];
const grupos = {};
let n = 0;
for (const sub of ["peliculas", "series"]) {
  grupos[sub] = [];
  for (const f of lista(sub)) {
    const v = `c${n++}`;
    lineas.push(`import ${v} from "./${sub}/${f}";`);
    grupos[sub].push(v);
  }
}
lineas.push("", `export default { peliculas: [${grupos.peliculas.join(", ")}], series: [${grupos.series.join(", ")}] };`, "");
writeFileSync(join(raiz, "_indice.js"), lineas.join("\n"), "utf8");
console.log(`✔ Índice generado: ${grupos.peliculas.length} categorías de películas, ${grupos.series.length} de series.`);
