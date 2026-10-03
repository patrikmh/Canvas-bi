# Canvas BI

En statisk svensk försäljningsdemo för Tlön: en ledningsöversikt på en flyttbar canvas, verifierbara DuckDB-beräkningar och en AI-analytiker med synliga verktygssteg. DemoCo AB är syntetiska, deterministiskt genererade data. Det finns ingen backend, inloggning eller verklig notifiering.

## Kör och verifiera

Projektet använder Node.js >=20.19 och npm. `.nvmrc` väljer Node 22.

```sh
npm ci
npm run dev
```

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Hela acceptanskontrollen:

```sh
npx playwright install chromium
npm run gate
```

Gaten kör typecheck, Vitest, produktionsbygge, Playwright mot `dist/` och screenshotkontroller. Ett godkänt resultat slutar med `GATE: PASS`. Screenshots finns i `e2e-screens/`; obligatoriska namn finns i `e2e/screens.json`. Ingen API-nyckel behövs. `/?fast=1` tar bort väntetiderna mellan agentstegen för automatiserade tester.

## Egna data

Klicka **Ladda upp data** längst ned i sidomenyn eller på en tom canvas. Välj eller släpp en CSV- eller XLSX-fil. För Excel läses första kalkylbladet. Kontrollera de automatiska förslagen, förhandsvisningen och säkerheten och ändra valen innan **Bekräfta och analysera**.

Datum och antingen omsättning eller styckpris behövs. Antal är valfritt (ett per rad om det saknas). Omsättning = mappat belopp eller antal × styckpris; kostnad = mappad kostnad eller antal × inköpspris. Totalsummor har företräde. Datum i ISO-format och dag/månad/år samt decimal komma stöds. Ogiltiga rader hoppas över med en synlig varning. En misslyckad inläsning behåller tidigare data.

Utan kostnad stoppar agenten marginalanalysen. Mappa kostnad eller välj uttryckligen **Anta 50 % bruttomarginal**. Alla marginalvyer märks då **ANTAGANDE**; kostnadsorsaker analyseras inte. Saknade kund-, order- eller produktkolumner ger förklarande tomma kort. Ett litet underlag märks **Låg säkerhet**. Periodväljaren följer filens månader och visar **pågående** för en ofullständig senaste månad. **Återställ demon** laddar DemoCo igen.

Data behandlas bara i webbläsaren och skickas inte till en server. Uppladdade filer sparas inte i localStorage; omladdning återgår till DemoCo. Layouten sparas lokalt. Exempelfiler finns i `e2e/fixtures/`, och `node scripts/make-fixtures.mjs` återskapar dem med fast seed.

## Statisk publicering

Kör `npm run build` och publicera hela katalogen `dist/` på en statisk webbserver, exempelvis en statisk site på Cloudflare Pages eller Render. Build-kommando: `npm ci && npm run build`; publiceringskatalog: `dist`. Webbservern måste servera JavaScript och `.wasm` med rätt MIME-typer (WASM: `application/wasm`). DuckDB-worker och WASM-filer ingår i bygget och hämtas från samma värd, utan CDN eller backend. Behåll `assets/` och tillåt vanliga web workers. Exemplet utgår från publicering vid domänens rot.

Appen fungerar utan externa nätverksanrop efter att dess statiska resurser laddats. Den har ingen service worker; för offlinebruk måste resurserna redan vara tillgängliga eller sajten serveras lokalt.

## Frivilligt LLM-läge

Offline-assistenten är standard och använder deterministisk intentmatchning. I **Inställningar** kan användaren själv slå på OpenAI, Anthropic eller OpenRouter, välja modell och skriva en egen API-nyckel. Nyckeln ligger bara i användarens localStorage och kan rensas därifrån. Läget får göra externa API-anrop när användaren ställer en fritextfråga; misslyckade anrop faller tillbaka till offline-läget. LLM:en väljer verktyg och ord, medan affärstalen alltid kommer från DuckDB. Använd det lokala standardläget om egna data inte ska lämna webbläsaren.

Inga hemligheter, nycklar eller `.env`-filer ska läggas i repot eller byggas in i `dist/`. Bevakningar och larm är simulerade och kräver godkännande i UI:t; ingen e-post skickas.

Se [specifikationen](docs/SPEC.md), [besluten](docs/brief.md) och [den tre minuter långa kunddemon](docs/demo-script.md).
