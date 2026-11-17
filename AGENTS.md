# AGENTS.md

## What this is

A client-side browser UI for a shoe store ("CambiaZO") tracking transfers, size exchanges, and
store credit in Bolivianos (Bs.). There is no package manager, build step, test suite, or backend.
Files:

- `index.html` — markup only; loads the rest.
- `styles.css` — custom CSS (glassmorphism, bubbles, buttons).
- `app.js` — all application logic and rendering (classic script, not a module).
- `tailwind.config.js` — sets the `brand` (red) palette and fonts on the Tailwind CDN.

## Run / verify

- Open `index.html` directly in a browser. No dev server needed.
- Requires internet on load: Tailwind, Google Fonts, FontAwesome, jsPDF, and jsPDF-AutoTable
  are all loaded from CDNs. `tailwind.config.js` must load immediately after the Tailwind CDN
  script, before `styles.css`.
- To verify changes, reload and exercise both tabs; there is nothing else to run.

## Persistence (easy to break)

- Data lives in `localStorage` under `calzagestion_traspasos_v1` and `calzagestion_creditos_v1`
  (see `STORAGE_KEYS`). Stored JSON is parsed as-is; there are no formal migrations.
- `normalizarTraspaso()` backfills new optional fields (`tallaNueva`) for old records. Add
  normalization there when introducing optional fields; bump the `_v1` key only for breaking
  shape changes, since a bump discards existing users' data.
- On first load, `cargarDatos()` seeds demo records into those keys if they are absent. To reset
  to demo data, delete both keys and reload.
- State mutation pattern: mutate the `traspasos` / `creditos` arrays, then call
  `guardarTraspasos()` / `guardarCreditos()` (which also refresh the dashboard), then call
  `renderTraspasos()` / `renderCreditos()`. Saving alone does not re-render the lists.

## Backup / import

- `exportarRespaldo()` downloads `cambiazo-respaldo-<fecha>_<hora>.json` containing
  `{ app, schemaVersion, exportedAt, traspasos, creditos }`. Keep this shape stable; it is meant
  for a later Firestore upload (one collection per array).
- `procesarArchivoRespaldo()` → `normalizarRespaldo()` accepts that wrapper, a `{ data: {...} }`
  wrapper, or a plain traspasos array. Records without a string `id` are discarded.
- `abrirModalImportacion()` offers "Combinar" (merge by `id`, imported wins) or "Reemplazar
  todo". Both persist with `guardarTraspasos()` / `guardarCreditos()` and re-render.
- Last export timestamp lives under `cambiazo_ultimo_respaldo_v1`; `actualizarInfoRespaldo()`
  updates the backup card and is called from both save functions.

## Domain literals — do not rename casually

Status values are exact Spanish strings compared in filters, dashboard, badges, and PDF export:

- `estado`: `Dejó a cuenta` | `Pagado` | `Devolvió`
- `horario`: `Urgente` | `Mañana` | `Tarde`
- `tipo`: `Traspaso` | `Cambio` (the `Cambio` value is displayed as "Cambio de talla")
- Size fields: `talla` is the requested/current size; `tallaNueva` holds the replacement size and
  is only populated when `tipo === 'Cambio'`. Render both as `talla → tallaNueva`.
- `llegado` is a separate boolean from `conDocumento`: "Llegó / No llegó" for the shoe itself. It
  defaults to `false` for new records (`normalizarTraspaso()` backfills it) and is toggled only
  from the movement cards via `toggleTraspasoLlegado()`.

Changing any literal requires updating every comparison (`actualizarDashboard`, `render*`,
`getTraspasosFiltrados`, PDF exports). Business rules embedded in code: a `Dejó a cuenta` whose
payment reaches `precioTotal` becomes `Pagado`; `Devolvió` zeroes payment and skips liquidation;
only `Pagado` records count toward the "Sin Liquidar" metric via the `liquidado` flag.

## UI conventions

- Rendering is full-list replacement via `container.innerHTML = list.map(...)` using template
  strings and inline `onclick`/`onchange` handlers calling global functions. Keep `app.js` a
  classic script; converting it to `type="module"` breaks all inline handlers.
- Keep existing element IDs (traspaso form fields are prefixed `t-`, crédito fields `c-`).
  `handleTipoChange()` swaps the size label and shows/hides `#wrap-talla-nueva`; keep those IDs.
- The store is a free-text field (`t-tienda`) and can be edited after creation via
  `abrirModalEditarTienda()` / `guardarTienda()` from each traspaso card. Do not reintroduce a
  `<datalist>` restriction.
- Movement cards are one per row (`#lista-traspasos` is `space-y-2`, not a grid). Use
  `.movimiento-card` for the thin horizontal layout and `.tick-chip` / `.fecha-chip` for the
  compact "Llegó", document, system and date controls defined in `styles.css`.
- `app.js` loads at the end of `<body>` and attaches `submit` listeners immediately, so it relies
  on the DOM already existing. Do not move it to `<head>` without guarding with `DOMContentLoaded`.
- Use the built-in `showToast()` and `openConfirmModal()` helpers; do not introduce native
  `alert`/`confirm`. Use `escapeHtml()` when inserting user text into `innerHTML` or attributes.
- Dates: `getTodayISO()` for storage, `formatFechaLegible()` for display, and custom ISO-week
  helpers (`getCurrentISOWeek`, `getWeekRangeFromISOWeek`) for reporting. Locale is `es-BO`.
