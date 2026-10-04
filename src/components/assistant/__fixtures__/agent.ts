import type { AgentResult } from '../../../analysis/agent'

export const memoResult: AgentResult = {
  metric: 'margin', title: 'Marginalen behöver din uppmärksamhet.',
  text: 'Bruttomarginalen sjönk från 52,3 % till 43,2 %. Förändringen började i juli 2026. Ungefär 90 % av nedgången kommer från Ullfilt och Linnepläd.',
  confidence: 'Hög säkerhet',
  steps: [
    { label: 'Bekräftar förändringen', tool: 'scanKpis', input: { month: '2026-08' }, summary: 'Bruttomarginal: år −17,4 %.', sql: 'SELECT 43.2 AS margin', status: 'done', duration: 2 },
    { label: 'Söker brytpunkt', tool: 'findLatestChange', input: { through: '2026-08' }, summary: 'Senaste tydliga brytpunkt: juli 2026.', sql: "SELECT '2026-07' AS month", status: 'done', duration: 3 },
    { label: 'Produktbidrag', tool: 'marginWaterfall', input: { before: ['2026-04', '2026-05', '2026-06'], after: ['2026-07', '2026-08'] }, summary: 'Ullfilt: −4,0 p.e. · Linnepläd: −4,2 p.e.', sql: 'SELECT -4.0 AS value', status: 'done', duration: 4 },
    { label: 'Styckekonomi', tool: 'unitEconomics', input: { products: ['Ullfilt', 'Linnepläd'] }, summary: 'Ullfilt: styckkostnad +31,0 %, pris 0,0 %.', sql: 'SELECT 31.0 AS costChangePct', status: 'done', duration: 5 },
    { label: 'Verifiering', tool: 'reconcileWaterfall', input: { month: '2026-08', metric: 'margin' }, summary: 'Kontrollerat: 52,3 % → 43,2 %; avvikelse 0,0 %.', sql: 'SELECT 0.0 AS residual', status: 'done', duration: 6 },
  ],
}
