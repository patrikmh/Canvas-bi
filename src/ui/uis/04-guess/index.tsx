import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { useAnalystSession } from '../../session'
import type { UiDefinition } from '../../types'
import { fmtMonth, fmtMonthShort, fmtPct } from '../../../data/format'
import { drawThrough, gapBands, lineSegments, pointerSample } from './drawing'
import type { Sample } from './drawing'
import { Review } from './Review'
import './review.css'
import './style.css'

function Guess() {
  const session = useAnalystSession()
  const rows = session.series?.data.filter(row => row.month <= session.month).slice(-6) ?? []
  const [guesses, setGuesses] = useState<(number | null)[]>(Array(rows.length).fill(null))
  const [revealed, setRevealed] = useState(false)
  const drawing = useRef<Sample | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [narrow, setNarrow] = useState(window.innerWidth <= 600)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 600px)'), update = () => setNarrow(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const left = narrow ? 44 : 66, top = 20, width = narrow ? 300 : 700, height = narrow ? 180 : 200
  const viewWidth = narrow ? 390 : 830, viewHeight = narrow ? 250 : 270
  const complete = guesses.length === rows.length && guesses.every(value => value != null)
  const actual = rows.map(row => row.gross_margin_pct)
  const x = (index: number) => left + index / Math.max(1, rows.length - 1) * width
  const y = (value: number) => top + height * (1 - value / 100)
  const points = (samples: Sample[]) => samples.map(point => `${x(point.index)},${y(point.value)}`).join(' ')
  function sample(event: PointerEvent<SVGSVGElement>) {
    const bounds = svg.current!.getBoundingClientRect()
    return pointerSample((event.clientX - bounds.left) * viewWidth / bounds.width - left, (event.clientY - bounds.top) * viewHeight / bounds.height - top, width, height, rows.length)
  }
  function start(event: PointerEvent<SVGSVGElement>) {
    if (revealed) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = sample(event); drawing.current = next
    setGuesses(values => drawThrough(values, next, next))
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (!drawing.current || revealed) return
    const previous = drawing.current, next = sample(event); drawing.current = next
    setGuesses(values => drawThrough(values, previous, next))
  }
  return <main className="ui-guess">
    <header className="guess-heading"><h1>Gissa först, se sedan.</h1><p>DemoCo · måndagsgenomgång</p></header>
    <h2>Hur tror du bruttomarginalen har utvecklats de senaste {rows.length} månaderna?</h2>
    <p className="guess-intro">Ta en minut. Rita din förväntan över månaderna, eller fyll i rutorna. Sedan får du se utfallet och vad som förklarar det.</p>
    <figure aria-label="Din förväntan jämförd med bruttomarginalens utfall">
      <div className="guess-legend"><span className="guess-pencil">Din förväntan</span>{revealed && <><span className="guess-actual">Utfall från orderrader</span><span className="guess-gap">Skillnaden</span></>}</div>
      <svg ref={svg} data-testid="guess-drawing" viewBox={`0 0 ${viewWidth} ${viewHeight}`} role="img" aria-label="Rityta för bruttomarginal. Använd månadsrutorna nedanför för tangentbord." onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = null }} onPointerCancel={() => { drawing.current = null }} className={revealed ? 'revealed' : ''}>
        {(narrow ? [0, 50, 100] : [0, 25, 50, 75, 100]).map(value => <g key={value}><text x={left - 8} y={y(value) + 5} textAnchor="end">{fmtPct(value, 0)}</text><line x1={left} x2={left + width} y1={y(value)} y2={y(value)} className={value === 0 ? 'baseline' : 'guide'} /></g>)}
        {rows.map((row, index) => <g key={row.month}><line className="column" x1={x(index)} x2={x(index)} y1={top} y2={top + height} /><text x={x(index)} y={viewHeight - 20} textAnchor="middle">{fmtMonthShort(row.month)}</text></g>)}
        {revealed && gapBands(guesses, actual).map((band, index) => <polygon key={index} points={points(band)} className="gap-band" />)}
        {lineSegments(guesses).map((segment, index) => <polyline key={index} points={points(segment)} className="pencil-line" />)}
        {guesses.map((value, index) => value == null ? null : <circle key={index} cx={x(index)} cy={y(value)} r="3" className="pencil-dot" />)}
        {revealed && lineSegments(actual).map((segment, index) => <polyline key={index} points={points(segment)} className="actual-line" />)}
        {revealed && actual.map((value, index) => value == null ? null : <circle key={index} cx={x(index)} cy={y(value)} r="3" className="actual-dot" />)}
      </svg>
      <fieldset disabled={revealed}><legend>Din förväntan i procent, månad för månad</legend><div className="guess-inputs">{rows.map((row, index) => <label key={row.month}>{fmtMonthShort(row.month)}<input data-testid={`guess-month-${index}`} type="number" min="0" max="100" step="1" inputMode="decimal" aria-label={`Din förväntan för ${fmtMonth(row.month)}, procent`} value={guesses[index] ?? ''} placeholder="%" onChange={event => {
        const value = event.target.value === '' ? null : Math.max(0, Math.min(100, Number(event.target.value)))
        setGuesses(values => values.map((old, position) => position === index ? value : old))
      }} /></label>)}</div></fieldset>
      <div className="guess-controls"><button className="primary" data-testid="guess-reveal" disabled={!complete || revealed} onClick={() => setRevealed(true)}>Visa utfallet</button><button data-testid="guess-reset" onClick={() => { setGuesses(Array(rows.length).fill(null)); setRevealed(false) }}>Börja om</button>{!complete && <span>Rita eller ange en förväntan för varje månad.</span>}</div>
      {revealed && <figcaption data-testid="guess-outcome"><strong>Du väntade dig ungefär {fmtPct(guesses.at(-1), 0)}; det blev {fmtPct(actual.at(-1))}.</strong><br />{fmtMonth(session.month)}. Bandet visar skillnaden.</figcaption>}
    </figure>
    {revealed && <div data-testid="guess-causes"><p className="byline">Analysagent, körning #{session.signoff.run.number} · {session.signoff.run.time}</p><h2>Vad förklarar skillnaden?</h2><p>{session.result?.text ?? 'Analysunderlaget inväntas.'}</p><Review /></div>}
  </main>
}

export default { id: '04', name: 'Gissa först, se sedan', paradigm: 'Veckoritual: rita en förväntan och avslöja utfallet', defaultTheme: '02', Component: Guess,
  shots: { interaction: [{ drag: ['guess-drawing', -340, -20] }, { drag: ['guess-drawing', 340, -15] }, { click: 'guess-reveal' }, { wait: 'guess-outcome' }] },
  smoke: { openApproval: [...[0, 1, 2, 3, 4, 5].map(index => ({ fill: [`guess-month-${index}`, '50'] as [string, string] })), { click: 'guess-reveal' }] },
} satisfies UiDefinition
