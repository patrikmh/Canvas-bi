# AGENTS.md: canvas-bi-demo standards

Canvas BI is a static (no backend) sales demo for Tlön: Swedish executive BI with an AI analyst. Spec: `docs/SPEC.md`, design references `docs/design/*.png`, decisions `docs/brief.md`.

## Hard rules
- The gate is `npm run gate` (typecheck, vitest, build, Playwright e2e against the built dist, screenshot checks). A ticket is done only when it is green. Never weaken, skip or delete a test or a gate step to get green.
- Numbers are ALWAYS computed in code with DuckDB SQL (`src/data/`), never by an LLM and never hard-coded in UI copy. UI text that quotes numbers formats them from query results.
- No secrets in the repo. No network calls at runtime except the optional, user-initiated LLM mode (key typed by the user, kept in localStorage). The app must work fully offline/without a key.
- Swedish UI by default, sv-SE formats: `503 tkr`, `44,7 %`, `−6,5 p.e.` (U+2212 minus), thin spaces as thousands separators where the formatter uses them.
- Deterministic: demo data is generated from a fixed seed; the offline assistant is deterministic intent matching.
- Agents never push. Stay inside the ticket's write-set. Simple, non-chained git/test commands.
- Keep `data-testid` hooks stable; e2e depends on them.
- Write the screenshots the e2e takes to `e2e-screens/<name>.png` and list required ones in `e2e/screens.json`.

## Layout
- `src/data/`: seeded generator, DuckDB engine wrapper (browser worker build in app, node-blocking build in tests), SQL metric functions, formatters.
- `src/analysis/`: analysis agent (observable trace steps), assistant intent matching, optional LLM adapter.
- `src/components/`, `src/canvas/`, `src/views/`: UI.
- `e2e/`: Playwright specs. `scripts/`: gate scripts.
