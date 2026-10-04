import { useEffect, useState } from 'react'
import { Chart } from '../../../components/charts/Chart'
import { waterfallOption } from '../../../components/charts/options'
import type { WaterfallStep } from '../../../data/metrics'

/** Local adaptation: the shared Waterfall does not expose category wrapping. */
export function CompactWaterfall({ steps }: { steps: WaterfallStep[] }) {
  const [narrow, setNarrow] = useState(window.innerWidth <= 760)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)'), update = () => setNarrow(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const option = waterfallOption(steps)
  return <div style={{ height: narrow ? 210 : 340 }}><Chart label="Produktbidrag till marginalförändringen, skala från noll" option={{ ...option,
    grid: { ...option.grid as object, bottom: narrow ? 40 : 32, left: narrow ? 44 : 52, right: 12 },
    yAxis: { ...option.yAxis as object, min: 0, interval: undefined, splitNumber: 5 },
    xAxis: { ...option.xAxis as object, axisLabel: { ...(option.xAxis as { axisLabel: object }).axisLabel, interval: 0, ...(narrow ? { fontSize: 11, width: 55, overflow: 'break' } : {}) } },
  }} /></div>
}
