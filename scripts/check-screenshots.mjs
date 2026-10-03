// Gate: every screenshot listed in e2e/screens.json must exist in e2e-screens/ and not be blank.
import { readFileSync, existsSync, statSync } from 'node:fs'
const required = JSON.parse(readFileSync('e2e/screens.json', 'utf8'))
let bad = 0
for (const name of required) {
  const p = `e2e-screens/${name}.png`
  if (!existsSync(p)) { console.error(`MISSING screenshot ${p}`); bad++; continue }
  const size = statSync(p).size
  // A blank/uniform 1440x900 PNG compresses to a few KB; a real UI is far larger.
  if (size < 25_000) { console.error(`BLANK? screenshot ${p} is only ${size} bytes`); bad++; continue }
  console.log(`ok ${p} ${size} bytes`)
}
if (bad) { console.error(`check-screenshots: ${bad} problem(s)`); process.exit(1) }
console.log(`check-screenshots: ${required.length} screenshot(s) ok`)
