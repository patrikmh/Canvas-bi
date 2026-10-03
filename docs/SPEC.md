# Canvas BI: Tlön sales demo (spec v1, 2026-10-03)
Source: Patrik's Claude artifact https://claude.ai/artifact/WbHESFQ55hFnWoSjBGr4st ("Ledningsöversikt – DemoCo AB").
Screenshots in this folder: 01-dashboard, 02-marginal-explanation, 03-revenue-detail, 04-revenue-per-product, 05-margin-per-product. Match that design closely.
Purpose: a polished **sales demo for Tlön** (Patrik's AI consultancy). "AAA" quality: it should feel like a real product. Not production; no multi-tenancy, payments or auth.

## The concept (from the artifact)
Swedish executive BI. An analyst agent reads sales.csv, builds a management view on a canvas and points out what needs attention ("Marginalen är det enda som behöver din uppmärksamhet": gross margin 51.1% -> 44.7% from July 2026, ~95% from Ullfilt and Linnepläd, whose unit cost rose 28% while price stayed flat). Three columns: left "Canvas BI" + component palette (Nyckeltal, Trend, Staplar, Förklaring/waterfall, Tabell, Insikt, Text; drag or click to add); center a draggable card canvas on a dotted grid (period selector, Ångra, Töm ytan, Återställ demon); right the "Assistent" panel with suggestion chips (Utforska marginalen, Varför ändrades marginalen?, Jämför omsättningen med förra året, Visa marginal per produkt, Bevaka marginalen, Bygg en ledningsvy) and a text field. Click a number or double-click a card to drill down (per product -> orders); "Hur räknas detta?" shows the formula. Style: pale mint/grey, white rounded cards, dark teal, serif headings, green/red deltas, minimal Scandinavian.

## Must have in v1
1. **Built-in demo data**: synthetic DemoCo AB (home textiles/interior), 24+ months of order lines (date, order_id, customer_id, product, qty, unit_price, unit_cost, channel, region), ~12 products as in the artifact, seasonality, and the margin drop in July 2026 (Ullfilt/Linnepläd costs +28%) so the story above is reproduced exactly. Generate deterministically (seed).
2. **Your own CSV upload** (also xlsx if cheap): column mapping with auto-detection (date/revenue/cost/product/customer/order) plus a manual mapping step; works on arbitrary sales data. Data stays in the browser.
3. **The numbers are always computed in code** (DuckDB-wasm SQL), never by the LLM. Every figure has "Hur räknas detta?" showing the SQL/formula.
4. **The analysis agent with a visible trace**: run it automatically after loading. Observable steps (as the checklist in 02: confirm the change -> find when it started -> split by product -> test cost vs price -> verify the numbers) with the tool calls and results shown, never hidden reasoning. It finds the biggest anomalies itself (KPI changes vs last year/month, decomposed with a waterfall per dimension) and writes the insight card.
5. **Assistant**: the chips + free text. Works WITHOUT an API key via deterministic intent matching against the analysis functions (the demo must never break in front of a customer). Optional LLM mode (OpenAI/Anthropic/OpenRouter key in settings, stored in localStorage, the LLM only picks tools/writes text; the numbers come from tools).
6. **Canvas**: drag/drop, resize, add/remove cards, undo, reset the demo, drill-down views, back to the canvas. Smooth animations.
7. **Human control (Tlön standard)**: "Bevaka marginalen" creates a watch that is APPROVAL REQUIRED (show the policy, Approve/Reject/Modify) and then appears in a "Bevakningar" list with a simulated alert. Activity log of what the agent did.
8. **Failure path**: e.g. a CSV with a missing cost column -> the agent stops, explains that margin can't be computed, suggests mapping or a margin assumption, and doesn't make anything up. Also low confidence on few data points.
9. Always-visible banner: "KONCEPTDEMO – syntetisk demonstrationsdata" (only for the demo data).
10. Swedish UI (sv-SE number formats: "503 tkr", "44,7 %", "−6,5 p.e."), English toggle if cheap. Export of the view to PDF/PNG is a nice-to-have.

## Tech (suggestion, the conductor may adjust it but must flag big deviations)
Vite + React + TypeScript, DuckDB-wasm, ECharts or Recharts, dnd-kit or react-grid-layout, Tailwind, Vitest + Playwright e2e. A static site (no backend) so it can be deployed for free (Render static site / Cloudflare Pages). A new private GitHub repo, e.g. `canvas-bi-demo`.

## Definition of done (report each point as DONE/NOT DONE with evidence)
- `npm run build` gives a static dist; `npm test` + e2e pass.
- The demo data reproduces exactly: revenue Aug 2026 ~503 tkr (+9.7% vs last year), gross margin 51.1 -> 44.7, Ullfilt/Linnepläd ~95% of the drop, the waterfall sums correctly (unit test).
- Uploading a test CSV with different column names works via the mapping; uploading a CSV without cost triggers the failure path.
- Works with no API key at all.
- Screenshots of the dashboard, the trace, the approval and the failure path delivered to /home/box/agent-data/projects/chiefen/canvas-bi/out/ (or the path reported).
- A short demo-script.md: a 3-minute customer demo click by click.
