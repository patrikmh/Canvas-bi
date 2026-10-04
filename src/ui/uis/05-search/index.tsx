import { useState } from 'react'
import { useAnalystSession } from '../../session'
import type { UiDefinition } from '../../types'
import { comparisonAnswer } from '../../../analysis/answers'
import { metricInfo } from '../../../components/charts/options'
import { fmtMonth } from '../../../data/format'
import { parseQuestion, visibleMonths } from './query'
import type { SearchQuery } from './query'
import { Figure } from './Figure'
import { Review } from './Review'
import './review.css'
import './style.css'

const suggestions = ['Visa marginal per produkt senaste 3 månaderna', 'Visa omsättning senaste 6 månaderna', 'Vad är marginalen i juli?', 'Visa omsättning per produkt']
function Search() {
  const session = useAnalystSession()
  const [text, setText] = useState(''), [query, setQuery] = useState<SearchQuery | null>(null)
  const [unknown, setUnknown] = useState(''), [explained, setExplained] = useState(false)
  function search(question: string) {
    setText(question); setExplained(false)
    const parsed = parseQuestion(question)
    if (!parsed) { setUnknown(question); setQuery(null); return }
    if (parsed.monthNumber) {
      const month = session.months.filter(month => month <= session.month && Number(month.slice(5)) === parsed.monthNumber).at(-1)
      if (!month) { setUnknown(question); setQuery(null); return }
      session.selectMonth(month)
    }
    setQuery(parsed); setUnknown('')
  }
  function change(next: SearchQuery) { setQuery(next); setExplained(false) }
  const months = query ? visibleMonths(session.months, session.month, query.period) : []
  const answer = query && session.snapshot ? query.compare === 'year' ? comparisonAnswer(query.metric, session.month, session.snapshot.data)
    : `${metricInfo[query.metric].label} för ${fmtMonth(session.month)} är ${metricInfo[query.metric].format(session.snapshot.data[query.metric].current)}.` : ''
  return <main className={`ui-search ${query ? 'has-answer' : ''}`}>
    <header><h1>Vad behöver du veta?</h1><p>Fråga om marginal eller omsättning. Rätta tolkningen direkt i svaret.</p></header>
    <form className="search-form" onSubmit={event => { event.preventDefault(); search(text) }}><label htmlFor="search-question">Din fråga</label><div><input id="search-question" data-testid="search-question" value={text} onChange={event => setText(event.target.value)} placeholder="Till exempel: marginal per produkt" required /><button data-testid="search-submit" className="primary" disabled={!session.ready || !text.trim()}>Sök</button></div></form>
    <div className="search-suggestions" aria-label="Förslag på frågor">{suggestions.map((question, index) => <button data-testid={`search-suggestion-${index}`} key={question} onClick={() => search(question)} disabled={!session.ready}>{question}</button>)}</div>
    {unknown && <p data-testid="search-unknown" role="status">Kan inte tolka ”{unknown}”. Prova ”Visa marginal per produkt” eller ”Visa omsättning senaste 6 månaderna”. Frågor om lager, budget och prognoser saknar underlag här.</p>}
    {query && <section className="search-answer" data-testid="search-answer">
      <fieldset className="search-sentence" disabled={!session.ready} aria-label="Rätta frågans tolkning">
        <label><span>Nyckeltal</span><select data-testid="search-metric" value={query.metric} onChange={event => change({ ...query, metric: event.target.value as SearchQuery['metric'] })}><option value="margin">Bruttomarginal</option><option value="revenue">Omsättning</option></select></label>
        <span className="sentence-dot" aria-hidden="true">·</span>
        <label><span>Uppdelning</span><select data-testid="search-group" value={query.group} onChange={event => change({ ...query, group: event.target.value as SearchQuery['group'] })}><option value="products">per produkt</option><option value="total">hela butiken</option></select></label>
        <span className="sentence-dot" aria-hidden="true">·</span>
        <label><span>Period</span><select data-testid="search-period" value={query.period} onChange={event => change({ ...query, period: Number(event.target.value) as SearchQuery['period'] })}><option value="1">senaste månaden</option><option value="3">senaste 3 månaderna</option><option value="6">senaste 6 månaderna</option></select></label>
        <span className="sentence-dot" aria-hidden="true">·</span>
        <label><span>Jämförelse</span><select data-testid="search-compare" value={query.compare} onChange={event => change({ ...query, compare: event.target.value as SearchQuery['compare'] })}><option value="year">mot samma period i fjol</option><option value="none">utan jämförelse</option></select></label>
      </fieldset>
      <p className="search-current">Perioden slutar i {fmtMonth(session.month)}. <button data-testid="search-latest" disabled={!session.ready} onClick={() => { session.selectMonth(session.months.at(-1)!); setExplained(false) }}>Visa senaste</button></p>
      <h2 data-testid="search-conclusion">{answer}</h2>
      {query.period === 6 && <span data-testid="search-six-months">Visar sex månadsvärden när underlaget räcker.</span>}
      {months.length > 0 && <Figure query={query} months={months} />}
      <div className="search-explain"><button className="primary" data-testid="search-explain" disabled={!session.ready} onClick={() => { void session.runAnalysis(`Varför ändrades ${query.metric === 'margin' ? 'marginalen' : 'omsättningen'}?`).then(result => { if (result) setExplained(true) }) }}>Förklara</button><p>Analysen söker den senaste tydliga förändringen fram till {fmtMonth(session.month)}. Dess före- och efterperioder anges i fynden.</p></div>
      {explained && <div data-testid="search-explanation"><p className="byline">Analysagent, körning #{session.signoff.run.number} · {session.signoff.run.time}</p><Review /></div>}
    </section>}
  </main>
}
export default { id: '05', name: 'Sök först', paradigm: 'Frågan som en redigerbar mening', defaultTheme: '01', Component: Search,
  shots: { interaction: [{ click: 'search-suggestion-0' }, { click: 'search-period' }, { press: 'End' }, { press: 'Enter' }, { wait: 'search-six-months' }] },
  smoke: { openApproval: [{ fill: ['search-question', suggestions[0]] }, { click: 'search-submit' }, { click: 'search-explain' }, { wait: 'search-explanation' }] },
} satisfies UiDefinition
