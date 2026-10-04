# Canvas BI interface contract (U0)

Each interface owns only `src/ui/uis/NN-slug/**`. Do not edit App, the shared session, data/analysis logic, other UI folders, existing tests or gate scripts. UI 99 is a hidden contract reference, not a candidate. UIs 01–10 must implement different interaction paradigms, not theme skins.

## Registration and mounting

Create `src/ui/uis/NN-slug/index.tsx`, import its own scoped CSS if needed, and default-export a definition satisfying `UiDefinition` from `src/ui/types`. The eager glob in `src/ui/index.ts` discovers it automatically. Folder prefix and definition id must match; duplicate ids fail. `?ui=NN` accepts exactly 01–99. Missing, malformed or unregistered ids mount the original App. `hidden` excludes an interface from default design captures, but not direct access or smoke tests.

```tsx
import type { UiDefinition } from '../../types'
import { useAnalystSession } from '../../session'
import { ApprovalControl } from '../../blocks'

function Interface() {
  const session = useAnalystSession()
  return <main>{session.result?.title}<ApprovalControl /></main>
}
export default {
  id: '01', name: 'Your Swedish UI name', paradigm: 'Narrative scrollytelling essay',
  defaultTheme: '02', // optional, registered theme id
  Component: Interface,
  shots: { interaction: [{ click: 'your-control' }, { wait: 'your-result' }] },
  smoke: { openApproval: [] },
} satisfies UiDefinition
```

```ts
type UiId = `${number}${number}` // runtime validation restricts UI ids to 01–99
type Step =
  | { click: string }                 // data-testid
  | { fill: [string, string] }         // data-testid, text
  | { press: string }                 // Playwright keyboard key/chord
  | { drag: [string, number, number] } // testid, relative dx, dy from center
  | { wait: string }                  // testid becomes visible
interface UiDefinition {
  id: UiId
  name: string
  paradigm: string
  defaultTheme?: UiId
  hidden?: boolean
  Component: React.ComponentType
  shots: { interaction: Step[] }
  smoke: { openApproval: Step[] }
}
```

`UiRoot` owns the provider, loading/error presentation, `UiChrome`, and `data-testid="ui-root"`. It sets `data-ui` and `data-ready="true"` only after SQL loading and analysis finish. Component mounts once its dashboard exists, so it must handle analysis still running and `result === null`. Do not mount another provider or another chrome. `uiManifest` exports definitions without Components; its exact JSON appears on root `data-ui-registry` for browser harnesses. Node harnesses discover registered folders and then read actual definition metadata from this registry.

`?theme` overrides `defaultTheme`, including ordinary theme fallback for invalid values. No explicit theme and no default use the existing default. The default is resolved through the existing theme initializer without changing the page URL/history state. The overview link removes only `ui`, preserving explicit theme and other parameters.

## Shared session API

Import `useAnalystSession` and the exported `AnalystSession` type from `src/ui/session`. The hook requires `AnalystSessionProvider`, which UiRoot already supplies. It creates the existing browser DuckDB worker, loads `generateDemoData()` with its fixed seed, chooses `latestCompleteMonth`, and closes the engine on unmount. It never reads an API key or calls an LLM. `fast=1` removes the existing agent's presentation delays. The provider's optional stable `createEngine: () => Promise<SqlEngine>` dependency is a fixture seam for Node-engine session tests; candidate UIs use the existing UiRoot provider and its browser default.

| Property/action | Contract |
| --- | --- |
| `dataset`, `month`, `months` | Demo dataset info, selected YYYY-MM month, every available month. |
| `selectMonth(month)` | Only accepts available months; cancels stale runs/citations, clears memo review/sign-off, loads fresh SQL results and reruns the agent. |
| `ready`, `busy`, `error` | Loading/analysis state; disable decision controls until ready. |
| `dashboard` | Existing `loadDashboard` output, including bounded display history, comparison products, economics and SQL metadata. |
| `snapshot` | `MetricResult<KpiSnapshot>`; each metric contains `current`, `lastYear`, `previousMonth`, `deltaYoY`, `deltaMoM`. Nu/FG/Δ are these SQL values. |
| `series` | `MetricResult<MonthlyMetrics[]>` for all months, independent of the selected month. Bound it explicitly for historical displays. |
| `productSeries` | Record keyed by product name, each an all-month `MetricResult<MonthlyMetrics[]>`. It scopes the canonical monthly SQL to the product, including unique order/customer counts and pooled margin. |
| `products` | Existing per-product current/previous-year query result. Other metric-specific rows are in dashboard. |
| `waterfall`, `period` | Query result for the actual agent contribution step and its `before`/`after` month arrays. It can be null during analysis. Use this rather than dashboard's static comparison window for analyst findings. |
| `runAnalysis(question?)` | Offline `AgentRunController` with the existing `runAgent`. Optional question selects a metric via existing intent matching; omission scans KPIs. Returns `AgentResult \| undefined`. Starts a new memo run and clears review/sign-off. |
| `result`, `trace` | Existing `AgentResult \| null` and observable `TraceStep[]`. Treat trace as executed tools/results, not a thought process. |
| `findings` | Numbered `MemoFinding[]` from existing `deriveFindings`; every citation retains its actual tool input, SQL and summary. |
| `reviews` | Record by finding number: `{status: 'pending'\|'accepted'\|'edited'\|'rejected', reason?, noteKind?: 'edit'\|'reject'}`. Original findings remain immutable. Notes survive subsequent acceptance within the run. |
| `reviewFinding(number, status, reason?)` | Accept/edit/reject one finding; edits and rejections require a nonempty reason. Logs the action. Never replace a computed number with reviewer text; display an annotated proposal alongside the original. |
| `memoStatus` | Existing `memoStatus`: Utkast while incomplete/unreviewed; Granskas after partial review; Godkänd after all acceptances or an approved watch in this run; Returnerad if any finding is rejected. A watch cannot override rejection. Edited findings still require acceptance. |
| `signoff`, `signOff(name)` | Prepared-by role, run identity/time, reviewer/time. Explicit named sign-off is available only when memo is Godkänd; logs the reviewer. Returning a memo removes the displayed sign-off. |
| `watch`, `proposeWatch()` | Existing `Watch` shape or null. Proposal uses existing demo policy (threshold 46%, drop 2 p.e., E-post, daily). These are policy settings, not computed metrics. Proposal never activates itself. |
| `updateWatch(watch)`, `approveWatch()`, `rejectWatch()` | Only an existing proposal can be edited/approved/rejected. Activation uses existing `watchTriggers` against SQL snapshot values and may create a simulated alert. Nothing is sent externally. Terminal watches can be followed by a new proposal. Active watches persist during month changes; they do not approve a new memo run. |
| `activities` | Existing `Activity[]` with id, Swedish timestamp, action, detail; includes data loading, actual tool completion, reviews, proposals, decisions, sign-off and simulated alerts. |
| `openCitation(ref, findingNumber?)` | Accepts a `TraceStep` or existing `Calculation`. Opens existing CalculationDrawer immediately with exact SQL/input/summary, then adds actual locally queried row previews (up to 12 rows per statement). Uses existing `sqlStatements` to preserve quoted semicolons. Closing/changing period/new analysis cancels stale drawer updates. |
| `ask(text)` | Returns `Promise<{intent: Intent, text: string}>`. Existing `matchIntent`, `comparisonAnswer` and `monthAnswer` provide deterministic offline replies. Explain runs the existing analyst; watch proposes; formula opens SQL. Product intents include query-backed KPI context and their structured intent so each paradigm can navigate its own product presentation. Canvas add/remove/rebuild intents have no shared layout side effects. |

Nullable query results must remain unknown, formatted as `—`; do not substitute zero. Format numeric copy using `src/data/format` or existing `metricInfo`, with sv-SE/U+2212 minus. No UI arithmetic for business metrics; only DuckDB query results. SQL derived from existing metrics remains executable and available with each result.

## Shared blocks

Import from `src/ui/blocks`:

- `ApprovalControl`: existing WatchCard with local testid adaptation for its approval buttons; exposes `ui-propose-watch`, `ui-approve-watch`, `ui-reject-watch`, `ui-watch-status`. It states that approval is required and alerts/channels are simulated. Reuse this to keep identical approval semantics.
- `MemoStatus`: `ui-memo-status`, fixed Swedish vocabulary.
- `Citation`: `<Citation ref={finding.citations[0]} number={finding.number} />`. React 19 treats this ref as the citation prop, not a forwarded DOM ref. Superscript adjacent to a claim opens the shared drawer. Accessible labels name the actual tool/source.
- `SignOff`: prepared-by/reviewed-by block and named signing form (`ui-signoff`, `ui-reviewer`, `ui-signoff-submit`).
- `UiChrome`: already mounted by UiRoot; demo-honesty line `Konceptdemo – syntetiska data`, UI name, plain `Till översikten` link. No AI iconography.
- `Sparkline`, `Line`: `{rows: MonthlyMetrics[], metric, label?, height?, max?}`.
- `Bars`: `{rows: ProductChartRow[], metric, month, compareMonth, label?, height?, max?, onProduct?}`.
- `Waterfall`: `{steps: WaterfallStep[], label?, height?, max?}`. Use margin contribution steps; other agent metrics have different units and need appropriately labeled charts.
- `BulletGraph`: `{current: number|null, previous: number|null, metric, label?}`; previous-year marker, neutral grayscale intervals, explicit zero baseline. Intervals are scale guides, not approved targets.

Charts reuse existing Chart/options/kpi helpers and theme tokens, with zero-based value axes. Equal-unit small multiples must share identical scales (the owning UI passes the same `max` to each primitive rather than stretching each plot). CSS is scoped under `.ui-root`; candidate CSS must be scoped further to its own root class. Use tokens for typography/surfaces/semantic color. No gradients, sparkle/robot avatars, fake confidence percentages, traffic-light decoration, emoji nav, all-caps eyebrows or ornamental borders. Follow `.herdr/report.md` §4: message-first memo, numbered adjacent citations, named prepared/reviewed responsibility, original plus annotated edits, plain audit log, categorical confidence with an action, factual method notes, and visible limits. Never narrate fabricated reasoning.

## Harness requirements

Every candidate must render an activity entry as `data-testid="ui-activity-entry"` whose text includes each activity's action. Put decision UI within reach of `smoke.openApproval`; use that sequence to open a drawer/tab/palette when needed. The shared smoke waits for root ready, runs these steps, proposes a watch if the proposal control is visible, approves, and checks Aktiv plus a `Bevakning godkänd` activity entry. Keep shared approval/status testids unique in the visible UI. Citation testids are per finding; when a finding has multiple citations, locate the source-specific accessible label.

`shots.interaction` describes a meaningful paradigm-specific interaction and must end in a stable visible state. `click`/`fill`/`drag` locate data-testids; `press` uses keyboard focus; `wait` waits for visible elements. There are no arbitrary sleeps. Screenshot harness waits for root ready and local fonts, disables capture animations, and records 1440×900 PNGs.

```sh
npm run gate
npm run build
UIS=99 npm run design:ui-shots
UIS=01,02 E2E_PORT=4332 npm run design:ui-shots
```

Without `UIS`, capture all non-hidden definitions. Outputs: `design-shots/out/uNN-main.png` and `uNN-interaction.png`. `E2E_PORT` selects the built-dist preview port (design default 4330, gate default 4317). Optional design shots remain separate from the unchanged gate screenshot manifest. U0 smoke adds no gate screenshots; the existing 16 required screenshots stay in `e2e-screens` and their manifest stays untouched.
