# DocMorph — Landing Page Creative & Technical Brief

## 1. Obiettivo

Creare una landing page premium per **DocMorph**, progetto open-source di DarCas.

DocMorph è un microservizio HTTP stateless che converte documenti `.docx` in `.pdf` tramite LibreOffice headless. È progettato con una filosofia molto precisa: **una singola responsabilità, un'API minimale, esecuzione container-first e comportamento prevedibile anche sotto concorrenza**.

La landing page non deve sembrare una generica SaaS landing page generata da AI.

Il design deve comunicare:

- trasformazione di un documento;
- precisione e affidabilità;
- pipeline tecnica;
- semplicità dell'API;
- self-hosting;
- robustezza operativa;
- natura developer-oriented del progetto.

### Idea creativa centrale

Il concetto visivo da sviluppare è:

> **A document enters. A PDF comes out. Nothing else gets in the way.**

La pagina dovrebbe rappresentare DocMorph come una **macchina di trasformazione documentale**: il documento `.docx` entra in un percorso controllato, viene elaborato e ne esce un PDF.

Non usare il cliché della "AI SaaS": niente gradienti viola/blu, blob astratti, dashboard fittizie, card flottanti ovunque, stock photos di persone al computer.

---

# 2. Analisi del progetto

Repository:
https://github.com/DarCas/docmorph

DocMorph è descritto come:

> Stateless HTTP microservice that converts `.docx` documents to PDF using headless LibreOffice.

La repository attuale contiene:

- `src/`
- `website/`
- `.opencode/commands/`
- GitHub Actions
- Dockerfile
- `docker-compose.dist.yml`
- TypeScript configuration
- README
- MIT license

Il README documenta un servizio HTTP con endpoint principale `POST /convert` e `GET /health`.

## Funzione principale

```text
DOCX
  ↓
POST /convert
  ↓
LibreOffice headless
  ↓
PDF
```

La semplicità di questa pipeline deve diventare uno degli elementi principali dell'identità visuale della landing.

---

# 3. Feature da comunicare

## 3.1 One endpoint, one job

`POST /convert` accetta un file `.docx` e restituisce direttamente un PDF.

Questo è uno dei messaggi più forti del prodotto.

Copy suggerita:

> **One endpoint. One job. One PDF.**

Oppure:

> **DOCX in. PDF out.**

La seconda è particolarmente adatta all'hero.

---

## 3.2 Stateless

Il servizio non richiede un database né una sessione applicativa.

Ogni conversione è un job indipendente.

Questo permette di comunicare:

- semplice da scalare;
- semplice da containerizzare;
- semplice da integrare;
- nessuna gestione dello stato applicativo.

Visualmente, evitare rappresentazioni architetturali troppo complesse.

Meglio una pipeline lineare:

```text
[file.docx] → [DocMorph] → [file.pdf]
```

---

## 3.3 LibreOffice headless

La conversione reale viene effettuata tramite LibreOffice in modalità headless.

Il valore da comunicare non è "LibreOffice è fantastico", ma:

> DocMorph usa un motore documentale reale e lo espone come servizio HTTP minimale.

Questo distingue il progetto da soluzioni che simulano o ricostruiscono il contenuto del documento.

---

## 3.4 Concurrency-safe

Ogni conversione viene eseguita in una directory temporanea isolata con un profilo LibreOffice dedicato.

La repository specifica che questo evita interferenze tra conversioni concorrenti.

Inoltre esiste un semaphore/concurrency pool per limitare il numero di conversioni simultanee.

Questo è un ottimo elemento per una sezione tecnica visuale.

Possibile visualizzazione:

```text
DOCX A ──→ [Profile A] ──→ PDF A
DOCX B ──→ [Profile B] ──→ PDF B
DOCX C ──→ [Profile C] ──→ PDF C

          concurrency pool
```

Non trasformarlo però in una classica diagram card.

---

# 4. Security / hardening

Questa parte è importante perché dà sostanza al progetto.

DocMorph implementa:

- controllo dell'estensione;
- validazione OOXML/ZIP tramite magic bytes;
- limite configurabile della dimensione dei file;
- verifica `%PDF` sull'output;
- API key opzionale;
- autenticazione tramite `x-api-key`;
- autenticazione tramite `Authorization: Bearer`;
- rate limiting per IP;
- endpoint `/health` escluso dal rate limiting;
- timeout per conversione.

La pagina dovrebbe presentare questi elementi come **guardrails intorno alla pipeline**, non come una checklist generica.

Concept visuale:

```text
        ┌──────────────────────────────┐
        │          DOCMORPH            │
        │                              │
DOCX →  │  validate → queue → convert │ → PDF
        │                              │
        │  auth · limits · timeout     │
        └──────────────────────────────┘
```

Titolo possibile:

> **Small API. Serious guardrails.**

Sottotitolo:

> Validate the input, control concurrency, authenticate requests and keep conversion failures contained.

---

# 5. Health endpoint

`GET /health` è pubblico e pensato per healthcheck Docker e load balancer.

Restituisce informazioni tra cui:

- status;
- autenticazione abilitata;
- conversioni attive;
- job in coda;
- concurrency massima;
- max file size;
- rate limit;
- timeout.

Questo permette una piccola sezione "Built to be operated".

Copy:

> **Know what the service is doing.**

La landing dovrebbe mostrare un JSON reale/stilizzato, non una dashboard inventata.

Esempio:

```json
{
  "status": "ok",
  "concurrency": {
    "active": 1,
    "queued": 0,
    "max": 3
  }
}
```

---

# 6. Developer experience

La repository documenta esempi con:

- cURL;
- TypeScript / native `fetch`;
- Python / `requests`;
- Docker;
- Docker Compose.

Questa è una caratteristica commerciale importante.

Il messaggio:

> **If you can POST a file, you can use DocMorph.**

La pagina dovrebbe avere una sezione interattiva o almeno visivamente forte con codice.

La priorità visiva dovrebbe essere:

1. cURL;
2. TypeScript;
3. Python.

Non mostrare enormi blocchi di codice.

Meglio un terminale compatto con tab.

---

# 7. Docker / self-hosting

DocMorph è container-first.

Il README include direttamente un esempio:

```bash
docker run -d \
  --name docmorph \
  -p 8080:8080 \
  -e API_KEYS="your-secret-key" \
  ghcr.io/darcas/docmorph:latest
```

La landing dovrebbe rendere evidente che non è necessario adottare una piattaforma SaaS esterna.

Concetto:

> **Your infrastructure. Your documents. Your API.**

Questa frase è molto adatta al progetto, ma va usata senza trasformare la pagina in una landing "privacy-first" generica.

---

# 8. Configurabilità

Le variabili principali sono:

| Variable | Default |
|---|---:|
| `PORT` | `8080` |
| `MAX_FILE_SIZE` | `10 MiB` |
| `CONVERT_TIMEOUT_MS` | `60000` |
| `MAX_CONCURRENT` | `3` |
| `API_KEYS` | unset |
| `RATE_LIMIT_WINDOW_MS` | `60000` |
| `RATE_LIMIT_MAX` | `60` |

La landing non deve mostrare necessariamente tutta questa tabella.

Meglio selezionare 3-4 valori per raccontare la filosofia:

```text
10 MiB        max input
60s           conversion timeout
3             concurrent jobs
60/min        requests per IP
```

Questi numeri possono diventare una fascia "specification strip" molto tecnica.

---

# 9. API

## POST /convert

Input:

- multipart/form-data;
- campo `file`;
- file `.docx`.

Output:

- `200`;
- `application/pdf`;
- `Content-Disposition` con filename derivato e sanitizzato.

Errori documentati:

- `401` authentication;
- `412` missing/unsupported input;
- `415` invalid DOCX;
- `429` rate limit;
- `500` conversion failure.

## GET /health

Endpoint pubblico.

Pensato per:

- Docker healthchecks;
- load balancer;
- monitoring.

---

# 10. Posizionamento

DocMorph non va presentato come:

- "document management platform";
- "AI document converter";
- "enterprise document suite";
- "SaaS document automation platform".

È più preciso definirlo come:

> **A small, self-hosted document conversion service.**

Oppure:

> **A containerized HTTP service for reliable DOCX → PDF conversion.**

Il valore è la sua semplicità.

---

# 11. Target

Target principale:

### Backend developers

Devono convertire DOCX in PDF da un'applicazione senza incorporare direttamente LibreOffice nella propria applicazione.

### DevOps / platform engineers

Vogliono un componente containerizzato facilmente deployabile e monitorabile.

### Self-hosters

Vogliono mantenere il controllo dell'infrastruttura.

### Automation developers

Devono inserire la conversione DOCX → PDF dentro pipeline automatiche.

---

# 12. Direzione visuale

## Concept: Document Transformation Engine

La pagina dovrebbe sembrare più vicina a:

- uno strumento tecnico;
- una macchina tipografica moderna;
- una console di infrastruttura;
- un sistema industriale di trasformazione;

e meno a:

- SaaS marketing;
- startup AI;
- dashboard B2B.

### Metafora visiva

**Un foglio attraversa una macchina.**

Input:

```text
DOCUMENT.DOCX
```

Processo:

```text
VALIDATE
QUEUE
CONVERT
VERIFY
```

Output:

```text
DOCUMENT.PDF
```

Questa metafora può diventare il motivo grafico ricorrente dell'intera pagina.

---

# 13. Hero section

La hero deve essere estremamente forte.

## Headline

Possibili direzioni:

### Opzione A

> **DOCX in. PDF out.**

### Opzione B

> **Document conversion, without the machinery.**

### Opzione C

> **Turn DOCX into PDF with one HTTP request.**

La direzione preferibile è A perché è breve, memorabile e visualizzabile.

Subheadline:

> **DocMorph is a stateless, Docker-ready HTTP service that turns DOCX documents into PDFs using headless LibreOffice.**

CTA:

- `View on GitHub`
- `Run with Docker`

Secondaria:

- `Read the API`

---

# 14. Hero visual

Non usare un'illustrazione stock.

Creare un oggetto grafico proprietario:

```text
┌──────────────┐
│  DOCX        │
│              │
│  Heading     │
│  ─────────   │
│  paragraph   │
│              │
└──────┬───────┘
       │
       ▼
 ╭──────────────╮
 │   DOCMORPH   │
 │              │
 │  converting  │
 ╰──────┬───────╯
        │
        ▼
┌──────────────┐
│  PDF         │
│              │
│  Heading     │
│  ─────────   │
│  paragraph   │
│              │
└──────────────┘
```

Ma in forma sofisticata, con:

- linee;
- micro-tipografia;
- griglia;
- indicatori di stato;
- dettagli tecnici;
- movimento sottile.

Il risultato dovrebbe sembrare una **macchina digitale di conversione documentale**.

---

# 15. Visual language

## Colori

Evitare il classico:

- purple gradient;
- blue gradient;
- neon cyan;
- dark SaaS template.

Direzione consigliata:

- fondo quasi nero / graphite;
- bianco carta;
- grigi caldi;
- un singolo colore di accento molto riconoscibile.

L'accento potrebbe essere un **rosso caldo / vermiglio documentale**, richiamando il concetto PDF/documento senza usare il rosso come semplice colore decorativo.

Alternativa: arancio industriale.

Importante: usare un solo accento dominante.

---

# 16. Tipografia

La tipografia deve distinguere:

### Marketing

Una grotesk contemporanea, compatta e molto leggibile.

### Technical layer

Monospace per:

- endpoint;
- variabili;
- file names;
- HTTP methods;
- CLI;
- status.

La combinazione tipografica deve contribuire alla sensazione di "strumento tecnico".

---

# 17. Layout

Evitare il layout standard:

```text
Hero
↓
3 cards
↓
Features
↓
Testimonials
↓
Pricing
↓
CTA
```

Non c'è un prodotto SaaS da vendere con pricing/testimonial.

Proporre invece una narrazione:

```text
HERO
  ↓
THE TRANSFORMATION
  ↓
WHY DOCMORPH IS SMALL BY DESIGN
  ↓
GUARDED PIPELINE
  ↓
API IN ACTION
  ↓
OPERABILITY
  ↓
SELF-HOST IT
  ↓
GITHUB / FINAL CTA
```

---

# 18. Sezione "The transformation"

Mostrare fisicamente il passaggio:

```text
.docx
  ↓
validate
  ↓
isolate
  ↓
convert
  ↓
verify
  ↓
.pdf
```

Ogni passaggio deve apparire come una fase della stessa macchina.

Non usare sei card.

Usare una timeline verticale/orizzontale animata.

---

# 19. Sezione "Small by design"

Concetto:

> **DocMorph does less. On purpose.**

Spiegazione:

DocMorph non prova a diventare un document management system.

Fa una cosa:

```text
DOCX → PDF
```

e la espone come HTTP API.

Questo deve essere uno dei messaggi filosofici della pagina.

---

# 20. Sezione "Serious guardrails"

Qui mostrare:

- validation;
- auth;
- rate limiting;
- concurrency;
- timeout;
- output verification.

Possibile layout:

Al centro:

```text
DOCX
 ↓
┌──────────────────────┐
│      DOCMORPH        │
│                      │
│ validate             │
│ authenticate         │
│ limit                │
│ isolate              │
│ convert              │
│ verify               │
└──────────────────────┘
 ↓
PDF
```

Ai lati piccoli indicatori tecnici.

---

# 21. Sezione API

Titolo:

> **The API is intentionally boring.**

Questo è un ottimo messaggio per sviluppatori.

Mostrare:

```bash
curl -o output.pdf \
  -H "x-api-key: $DOCMORPH_API_KEY" \
  -F "file=@document.docx" \
  http://localhost:8080/convert
```

Poi mostrare la risposta come file PDF generato.

La sensazione deve essere:

> "Tutto qui."

---

# 22. Sezione operativa

Titolo:

> **Built to be operated.**

Mostrare il JSON di `/health`.

A fianco:

- Docker;
- healthcheck;
- bounded concurrency;
- timeout;
- logs.

Il messaggio non è "enterprise-grade" — evitare claim non dimostrati.

Il messaggio è:

> **You can see what it is doing and control how much work it accepts.**

---

# 23. Sezione deployment

Titolo:

> **One container. Your infrastructure.**

Visualizzare:

```text
YOUR APP
   │
   │ HTTP
   ▼
┌───────────────┐
│   DocMorph    │
│   Docker      │
│               │
│ LibreOffice   │
└───────────────┘
```

CTA:

> Run it yourself

Con comando Docker.

---

# 24. Animazioni

Le animazioni devono essere funzionali al concetto.

Usare:

- file che attraversano la pipeline;
- piccoli indicatori di stato;
- progress line;
- subtle terminal cursor;
- PDF che si "materializza" dal DOCX;
- micro movement sui diagrammi.

Evitare:

- parallax pesante;
- elementi che galleggiano senza significato;
- effetti glassmorphism;
- animazioni infinite aggressive.

Il movimento deve far capire **conversione e pipeline**.

---

# 25. Responsive

Mobile-first.

Su mobile la metafora della macchina deve diventare verticale:

```text
DOCX
 ↓
VALIDATE
 ↓
CONVERT
 ↓
VERIFY
 ↓
PDF
```

La hero non deve dipendere da un'immagine enorme.

---

# 26. Accessibilità

Richiedere:

- contrasto WCAG adeguato;
- focus states;
- keyboard navigation;
- reduced-motion support;
- semantic HTML;
- aria-label solo dove necessario;
- codice leggibile;
- CTA chiaramente distinguibili.

Le animazioni devono disattivarsi/ridursi con:

```css
@media (prefers-reduced-motion: reduce)
```

---

# 27. SEO

Title:

> DocMorph — DOCX to PDF HTTP Microservice

Meta description:

> Stateless, Docker-ready HTTP service for converting DOCX documents to PDF with headless LibreOffice.

Keyword concettuali:

- DOCX to PDF API
- DOCX PDF converter API
- self-hosted DOCX to PDF
- Docker DOCX PDF converter
- LibreOffice headless API
- document conversion microservice
- Node.js DOCX PDF service
- TypeScript DOCX PDF API

Non fare keyword stuffing.

---

# 28. AI/LLM discoverability

La pagina deve essere facilmente interpretabile anche da sistemi AI.

Usare testo esplicito e factual:

> DocMorph is an open-source Node.js/TypeScript HTTP microservice for converting Microsoft Word `.docx` documents to PDF using headless LibreOffice.

Esplicitare:

- input;
- output;
- API;
- Docker;
- authentication;
- rate limiting;
- concurrency;
- health endpoint;
- license.

Aggiungere eventualmente JSON-LD `SoftwareApplication` / `WebSite` dove appropriato.

---

# 29. CTA finale

La CTA finale non deve sembrare commerciale.

Titolo:

> **Give your backend a DOCX → PDF endpoint.**

Testo:

> Run DocMorph locally, in Docker, or wherever your infrastructure lives.

CTA:

> **View DocMorph on GitHub**

Secondaria:

> **Read the API**

---

# 30. Footer

Minimal.

Contenuto:

```text
DocMorph
DOCX → PDF, over HTTP.

MIT License
GitHub
DarCas
```

Niente footer gigante.

---

# 31. Stack frontend

La landing deve essere implementata con:

- React;
- Vite;
- TypeScript;
- CSS moderno;
- responsive;
- componentizzazione ragionevole.

Non introdurre una UI library solo per costruire card e button.

Preferire CSS custom per mantenere il design originale.

Per le animazioni è possibile usare una libreria solo se porta un reale vantaggio; evitare dipendenze inutili.

---

# 32. Architettura componenti suggerita

```text
App
├── Header
├── Hero
│   ├── TransformationVisual
│   └── HeroActions
├── TransformationSection
│   └── ConversionPipeline
├── SmallByDesign
├── Guardrails
│   └── GuardrailPipeline
├── ApiSection
│   └── CodeTabs
├── OperationsSection
│   └── HealthJson
├── DeploymentSection
├── FinalCTA
└── Footer
```

Non frammentare ulteriormente senza necessità.

---

# 33. Principi di design

## DO

- design editoriale;
- visualizzazione della trasformazione;
- tipografia forte;
- uso intenzionale del monospace;
- molto spazio negativo;
- dettagli tecnici;
- animazioni funzionali;
- diagrammi proprietari;
- codice reale;
- tono asciutto.

## DON'T

- gradient background generico;
- glass cards;
- floating blobs;
- fake dashboards;
- testimonial inventati;
- metriche inventate;
- "AI-powered";
- claim enterprise non dimostrati;
- pricing;
- stock photography;
- icone casuali;
- 20 feature cards;
- linguaggio da startup generica.

---

# 34. Copy tone

Il tono deve essere:

- tecnico;
- sicuro;
- asciutto;
- intelligente;
- leggermente ironico quando utile;
- mai corporate.

Esempi:

> **DOCX in. PDF out.**

> **Small by design.**

> **The API is intentionally boring.**

> **Serious guardrails.**

> **One container. Your infrastructure.**

Queste frasi possono diventare veri elementi grafici della pagina.

---

# 35. Hero copy finale consigliata

## Eyebrow

`OPEN SOURCE · SELF-HOSTED · DOCX → PDF`

## Heading

# DOCX in. PDF out.

## Description

> DocMorph is a stateless HTTP microservice that converts DOCX documents to PDF using headless LibreOffice. Docker-ready, concurrency-safe and built to do one thing well.

## Actions

`View on GitHub`

`Run with Docker`

---

# 36. Distinctive visual motif

Il dettaglio che può rendere la landing riconoscibile:

### "Document rails"

Una linea sottile attraversa verticalmente/orizzontalmente la pagina.

Su questa linea viaggiano piccoli "document fragments":

```text
┌───────┐
│ .DOCX │
└───┬───┘
    │
════●════════════════
    │
    ▼
 [ MORPH ]
    │
════●════════════════
    │
    ▼
┌───────┐
│ .PDF  │
└───────┘
```

La stessa linea può riapparire in:

- hero;
- transformation section;
- guardrails;
- final CTA.

Questo crea una vera identità grafica invece di una serie di sezioni indipendenti.

---

# 37. Possibile direzione cromatica

Base:

```text
Background: near-black graphite
Surface: warm charcoal
Text: off-white / paper
Muted text: cool/warm gray
Accent: document red / vermillion
```

L'accento deve essere usato principalmente per:

- stato attivo;
- linea di conversione;
- CTA primaria;
- marker;
- piccoli dettagli.

Non colorare intere sezioni.

---

# 38. Texture

Una texture quasi impercettibile può richiamare:

- carta;
- stampa;
- griglia tipografica;
- micro-dot technical paper.

Deve essere estremamente sottile.

Non usare noise texture evidente da template AI.

---

# 39. Performance

La landing deve essere molto veloce.

Preferire:

- CSS;
- SVG;
- animazioni CSS;
- asset locali ottimizzati.

Evitare video hero.

Se viene usato un SVG animato, deve essere leggero.

Obiettivo concettuale:

> La landing di un microservizio piccolo e veloce non dovrebbe caricarsi come una web app enterprise.

---

# 40. Open Graph

Creare un OG image coerente con il visual della landing:

```text
DOCMORPH

DOCX  →  PDF

A tiny HTTP service
for document conversion.
```

Sfondo graphite, documento bianco, linea vermiglio.

Niente screenshot della pagina.

---

# 41. Risultato desiderato

Quando un developer arriva sulla pagina nei primi 5 secondi deve capire:

1. cosa fa DocMorph;
2. che è un servizio HTTP;
3. che converte DOCX in PDF;
4. che può essere eseguito con Docker;
5. che è self-hosted/open-source;
6. che non è un prodotto SaaS enorme;
7. che dietro la semplicità ci sono controlli seri.

La sensazione finale dovrebbe essere:

> **"È una piccola macchina che fa esattamente quello che dice, e lo fa bene."**

Questo deve essere il principio guida dell'intero design.

---

# 42. Prompt operativo per OpenCode

Usare questo documento come specifica creativa e tecnica.

OpenCode deve:

1. analizzare nuovamente repository e codice prima di implementare;
2. mantenere i claim della landing coerenti con il comportamento reale del progetto;
3. non inventare feature, metriche, clienti o performance;
4. implementare il design come esperienza visuale proprietaria;
5. evitare qualsiasi estetica da template AI/SaaS;
6. privilegiare la metafora della trasformazione documentale;
7. mantenere il codice semplice e manutenibile;
8. usare componenti React coerenti;
9. mantenere accessibilità e responsive design;
10. ottimizzare performance e SEO;
11. usare codice reale del progetto negli esempi;
12. verificare build, typecheck e lint prima della conclusione.

### Regola fondamentale

**Non trasformare DocMorph in qualcosa che non è.**

La forza del progetto è proprio la sua riduzione:

```text
DOCX → HTTP → PDF
```

La landing deve rendere questa semplicità desiderabile, non nasconderla dietro complessità visuale.
