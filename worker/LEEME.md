# Worker T3mPL4ri0s (v3)

## Estructura
```
worker/
├── worker.js            ← la lógica (no se toca)
├── config.json          ← nombre, id y versión del addon
├── package.json         ← comandos: npm run deploy / npm run revisar
├── wrangler.toml        ← configuración de Cloudflare
├── scripts/             ← generar-indice.mjs y revisar.mjs (no se tocan)
└── catalogo/
    ├── peliculas/       ← un .json por categoría de películas
    └── series/          ← un .json por categoría de series
```
`catalogo/_indice.js` se crea solo al publicar. No lo edites.

## Publicar
```
npm run deploy
```
Genera el índice → revisa errores → publica. Si hay errores, no publica y te dice cuáles.
Solo revisar, sin publicar: `npm run revisar`

## Categoría de películas (catalogo/peliculas/terror.json)
```json
{
  "nombre": "Terror",
  "orden": 1,
  "peliculas": [
    { "id": "tt0063350", "nombre": "Night of the Living Dead", "anio": 1968,
      "streams": [
        { "url": "https://…", "calidad": "1080p", "codec": "H.264", "tamano": "3.9 GB",
          "duracion": "1:36:00", "audios": ["Latino", "English"], "subs": ["Español"],
          "servidor": "Pixeldrain" }
      ] }
  ]
}
```

## Categoría de series (catalogo/series/drama.json)
```json
{
  "nombre": "Drama",
  "orden": 1,
  "series": [
    { "id": "tt0000000", "nombre": "Nombre de la serie", "anio": 1960,
      "temporadas": {
        "1": {
          "1": [ { "url": "https://…", "calidad": "720p" } ],
          "2": [ { "url": "https://…" } ]
        },
        "2": {
          "1": [ { "url": "https://…" } ]
        }
      } }
  ]
}
```
Se lee: temporada "1" → episodio "1" → sus enlaces.

## Campos de cada enlace
| Campo | Ejemplo | Obligatorio |
|---|---|---|
| url | "https://pixeldrain.com/api/file/XXXX" | sí |
| calidad | "1080p" | no |
| codec | "H.264" | no |
| formato | "MKV" | no |
| tamano | "3.9 GB" | no |
| duracion | "1:36:00" | no |
| audios | ["Latino", "English"] | no |
| subs | ["Español"] | no |
| servidor | "Pixeldrain" | no |
| nota | cualquier texto extra | no |

## Reglas
- Solo aparecen en Nuvio los títulos con al menos un enlace.
- Una película o serie puede estar en varias categorías (mismo id): sus enlaces se juntan.
- "orden" decide el orden de las filas (1 primero). Si no lo pones, va al final.
- **Categoría nueva o cambio de orden** → sube "version" en config.json y reinstala el addon en Nuvio.
- **Solo agregar o cambiar enlaces** → `npm run deploy` y listo, sin reinstalar.
