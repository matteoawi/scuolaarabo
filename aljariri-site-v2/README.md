# Al Jariri Commerce — redesign completo

Sito multipagina + ecommerce custom per Al Jariri Language & Culture. Non è un mockup: include catalogo, carrello, checkout server-side, ordini e integrazioni predisposte per Stripe, PayPal, Klarna e Scalapay.

## Avvio locale

Richiede Node.js 18+ e non usa dipendenze npm esterne.

```bash
cp .env.example .env
# esporta le variabili del file .env nel tuo ambiente, oppure configurale nel provider hosting
npm start
```

Apri `http://localhost:3000`.

> Il server Node non carica automaticamente `.env`: su hosting configura le variabili nel pannello del servizio. In locale puoi usare il tuo normale loader/shell oppure avviare con le variabili esportate.

## Cosa c'è dentro

- Home responsive
- Pagine Corsi, Traduzioni, Chi siamo, Recensioni e Contatti
- Shop con ricerca e filtri
- Scheda prodotto dinamica
- Carrello persistente via localStorage
- Checkout con ricalcolo prezzi lato server
- Ordini JSON server-side per prototipo/deploy iniziale
- Redirect e verifica/capture provider al ritorno dal checkout
- Stripe Checkout
- PayPal Orders v2
- Klarna Payments + Hosted Payment Page
- Scalapay Orders + capture
- Google Business Profile Reviews API con paginazione e filtro 4–5 stelle
- WhatsApp, telefono ed email

## Catalogo

I prezzi iniziali sono quelli riportati dal sito Al Jariri al momento della ricostruzione:

- Lezione individuale di arabo — 1 ora: €20
- Corso individuale di arabo — 15 ore: €240
- Corso individuale di arabo — 30 ore: €300
- Traduzione arabo/italiano — cartella da 250 parole: €15

Aggiorna `catalog.mjs` e `assets/catalog.js` insieme quando cambia un prezzo. Il checkout considera autorevole il catalogo server-side (`catalog.mjs`), non gli importi del browser.

## Pagamenti

### Stripe
Imposta `STRIPE_SECRET_KEY`. Il sito crea una Checkout Session sul server e verifica la sessione al ritorno.

### PayPal
Imposta `PAYPAL_CLIENT_ID` e `PAYPAL_CLIENT_SECRET`. In test usa il sandbox; in produzione cambia `PAYPAL_BASE_URL` all'endpoint live del tuo account.

### Scalapay
Imposta `SCALAPAY_API_KEY`. Il default usa l'ambiente integration. Prima del live verifica con Scalapay prodotto rateale abilitato, URL/credenziali production e campi fiscali richiesti dal contratto merchant.

### Klarna
Imposta `KLARNA_USERNAME` e `KLARNA_PASSWORD`. Il default usa playground. Prima del live sostituisci endpoint/credenziali con quelli merchant di produzione e configura il trattamento fiscale corretto delle righe ordine.

**Nota:** il codice integra i flussi tecnici, ma l'attivazione effettiva di Klarna/Scalapay/PayPal/Stripe dipende dagli account merchant e dalla loro abilitazione. Non inserire mai chiavi segrete nel frontend.

## Recensioni Google

Imposta:

- `GBP_ACCESS_TOKEN`: access token OAuth con permesso Business Profile
- `GBP_LOCATION_NAME`: risorsa location nel formato `accounts/.../locations/...`

Il backend legge tutte le pagine (`pageSize=50` + `nextPageToken`) e restituisce sul sito soltanto recensioni con rating >= 4. Senza credenziali, la UI mostra solo il riepilogo pubblico già noto e non inventa testi/autori.

Per produzione conviene sostituire un access token manuale con un flusso OAuth + refresh token sicuro, così il collegamento non scade.

## Ordini e produzione

`data/orders.json` va bene per demo/staging e piccoli test. Per produzione sostituiscilo con un database (PostgreSQL/MySQL/SQLite gestito), aggiungi webhook firmati dei provider, email di conferma, pannello ordini e logging.

Prima del go-live completa `termini.html` con condizioni di vendita, recesso/rimborsi, fatturazione, erogazione corsi/traduzioni e privacy approvati dal titolare/consulente.

## Deploy

Il progetto può essere ospitato su un servizio Node (es. VPS/container/PaaS) con HTTPS e `PUBLIC_BASE_URL=https://tuodominio.it`. Il semplice hosting statico non basta per i pagamenti perché le chiavi e le chiamate provider devono restare server-side.

### Avvio rapido con `.env`
Su macOS/Linux puoi usare anche:

```bash
cp .env.example .env
# inserisci le credenziali test nel file .env
./start-local.sh
```

## GitHub Pages frontend

The repository includes `.github/workflows/pages.yml`. On every push to `main`, the workflow builds a static `_site` artifact containing only the HTML frontend and `assets/`, then deploys it to GitHub Pages using the official Pages actions.

GitHub Pages cannot execute `server.mjs`. For live Stripe / PayPal / Klarna / Scalapay transactions and Google Business Profile reviews, deploy the Node backend to a HTTPS Node/serverless host and set its public origin in `assets/config.js` as `window.ALJ_API_BASE`.

The Pages version intentionally refuses to pretend a payment succeeded when no secure backend is configured.
