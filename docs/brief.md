# canvas-bi: Canvas BI – Tlön sales demo (static Vite/React + DuckDB-wasm)
Requester: Chiefen (for Patrik). Spec: docs/SPEC.md (copied from /home/box/agent-data/projects/chiefen/canvas-bi/, also on serafim ~/herdr-conductor/tasks/canvas-bi/spec/).
Classification: feature (greenfield).

Goal: an "AAA" Swedish executive-BI sales demo matching the 5 design screenshots: 3 columns (palette / draggable card canvas / Assistent), DuckDB-computed numbers with "Hur räknas detta?", an analysis agent with a visible observable trace, deterministic offline assistant, approval-gated watch, CSV/xlsx upload with mapping + failure path, demo banner.
Non-goals: backend, auth, multi-tenancy, payments, real deploy (Chiefen deploys), real LLM calls in tests, pixel-perfect copy of Claude.ai chrome (the top bar "Translate/Share/Sign in" is the artifact host's, not the app's).

Acceptance (all via `npm run gate` = typecheck + vitest + build + Playwright e2e on built dist + screenshot checks):
- [ ] `npm run build` -> static dist; `npm test` + e2e green  (cmd: npm run gate)
- [ ] demo data reproduces: Aug 2026 revenue "503 tkr" (+9,7 % vs Aug 2025), margin 51,1 % (Apr–Jun 2026) -> 44,7 % (Jul–Aug 2026 and Aug 2026), Ullfilt+Linnepläd ≈95 % of drop, waterfall sums (unit test in src/data/*.test.ts)
- [ ] CSV with other column names works via mapping; CSV without cost -> failure path (e2e upload specs)
- [ ] no API key needed (e2e runs with empty localStorage, network to LLM hosts blocked)
- [ ] screenshots: dashboard, trace, approval, failure path (+ drilldown, mobile) -> e2e-screens/, copied to /home/box/agent-data/projects/chiefen/canvas-bi/out/
- [ ] docs/demo-script.md (3-min click-by-click)

Door: two-way (new private repo, static site; revert = git revert). Blast radius: none outside the new repo.
Premortem:
- Numbers drift from the story (generator noise) -> exact sv-SE display strings asserted in unit tests from the real SQL.
- DuckDB-wasm bundling/worker breaks in preview/static hosting -> e2e runs against `vite preview` of dist, not dev server; self-hosted wasm assets (no CDN).
- The demo "breaks in front of a customer" (LLM/network) -> offline mode is the default and the only one exercised by tests; LLM mode is opt-in and falls back to offline on any error.
Track: M (brief + tickets; greenfield, no leverage points in an existing system).   Leverage points: data model of the in-app store (defined in ticket 01, consumed by 02-04).

## Assumptions (made without asking Patrik, per instructions)
1. Period semantics: "Augusti 2026" is the selected (latest complete) month. KPI cards compare to the same month last year. The margin story compares Apr–Jun 2026 (51,1 %) vs Jul–Aug 2026 (44,7 %); Aug 2025 margin = 51,2 % so the card shows −6,5 p.e.
2. Other design numbers are reproduced too where visible: orders 793 (+10,0 %), customers 627 (+9,8 %), Jul 2026 revenue so Aug is −4,0 % m/m, waterfall Ullfilt −3,4 / Linnepläd −2,7 / Övriga −0,3, Bordsduk +57,0 % and Tvålpump −11,9 % revenue y/y, Linnepläd −14,3 / Ullfilt −14,2 p.e. margin y/y.
3. Waterfall decomposition: total margin = Σ revenue-share_i × margin_i; contribution_i = s1_i·m1_i − s0_i·m0_i (sums exactly; mix+rate combined). Documented in "Hur räknas detta?".
4. Data window: Sep 2023 – Aug 2026 (36 months; charts show last 24) – ≥24 months as required.
5. Tech per spec suggestion: Vite + React + TS, Tailwind 3, DuckDB-wasm (self-hosted EH/MVP bundles, node-blocking build in tests), ECharts, react-grid-layout, papaparse + read-excel-file (xlsx is cheap, so included). No deviations.
6. LLM mode: included because the spec asks for it (OpenAI/Anthropic/OpenRouter, key in localStorage, LLM only chooses tools + writes text; any error -> offline answer). Not exercised against a real provider (no key; unverified).
7. English toggle and PNG export: done only if cheap (nice-to-have); Swedish is the default and tested.
8. Size budget: the merge-gate guideline of ~400 lines/ticket is relaxed for this greenfield demo (tickets are vertical slices of ~600–1500 lines); noted as a deviation.
9. Repo is `patrikmh/canvas-bi-demo`, private. Authoring on the box (more RAM: ~3.7 GB vs 2.5 GB on serafim where the bahby job runs) with Codex gpt-6.1-sol; Claude reviews on serafim (1 agent max).
10. Chiefen confirmation of brief: not requested (instructed not to ask; requester = Chiefen, brief stands as the agreed brief).
