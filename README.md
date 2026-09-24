# Custom New Tab - Estensione Chrome

Una dashboard personale e altamente personalizzabile per la pagina "Nuova Scheda" (New Tab) del tuo browser. Questa estensione trasforma la schermata iniziale in un centro di controllo produttivo, unendo strumenti di lavoro, monitoraggio e intelligenza artificiale.

---

## 🚀 Funzionalità Principali

*   **💬 Chat AI Integrata:** Interagisci con qualsiasi modello compatibile con OpenAI (OpenAI, Google Gemini, DeepSeek, OpenRouter, Groq, Ollama) o con un endpoint personalizzato (es. LM Studio) direttamente dalla nuova scheda (nome profilo configurabile, cronologia limitata a 40 turni, output Markdown sanificato).
*   **🎵 Riproduttore Spotify:** Controlla la musica via PKCE + `chrome.identity` (richiede Client ID + Redirect URI).
*   **📅 Google Calendar:** Viste giorno/settimana/mese, tooltip, creazione eventi, multi-calendario.
*   **☀️ Widget Meteo:** Previsioni OpenWeatherMap con cache 30 minuti, fallback offline fino a 24h e gestione errori/timeout.
*   **📈 Mercati Finanziari:** Azioni (Yahoo Finance, sparkline reali) e crypto (CoinGecko), cache 5min, mai dati inventati (N/D + badge cache).
*   **🍅 Timer Pomodoro:** Focus/pause configurabili con anello progressivo e beep sintetizzato.
*   **⏳ Conti alla Rovescia:** Countdown multipli con ticker live.
*   **✅ To-do:** Lista attività con riordino drag&drop e sidebar ridimensionabile.
*   **🖥️ Monitor di Sistema:** CPU/RAM via `chrome.system` + batteria via Battery API cachata (poll 2s).
*   **📐 Convertitore Unità:** Lunghezza, peso, temperatura, volume.
*   **🔗 Link Rapidi:** Categorie drag&drop, icone automatiche via favicon o caricate localmente (ottimizzate a 96px).
*   **🔍 Barra di Ricerca:** Google/Bing/DuckDuckGo/Brave/Ecosia/Yahoo + toggle Perplexity AI.
*   **📰 Notizie RSS:** Feed personalizzabili via rss2json con timeout 15s e cache 24h.
*   **🦖 Dino Game + Tab IFrame:** Colonna centrale a carosello con tab personalizzate (sandboxed, senza bypass CSP).
*   **💾 Backup:** Export/import JSON con opzione includi/escludi segreti.

---

## 🛠️ Come Installare l'Estensione (Developer Mode)

Poiché l'estensione non è ancora pubblicata sul Chrome Web Store, puoi installarla come estensione locale (unpacked) in modalità sviluppatore:

1.  **Scarica il codice:** Clona questo repository sul tuo computer o scarica il file ZIP ed estrailo.
2.  **Apri la gestione estensioni di Chrome:**
    *   Nel browser Chrome, visita l'indirizzo: `chrome://extensions/`
    *   In alternativa, clicca sui tre puntini in alto a destra ➔ **Altri strumenti** ➔ **Estensioni**.
3.  **Abilita la Modalità Sviluppatore:**
    *   Attiva lo switch **Modalità sviluppatore** (Developer mode) situato in alto a destra.
4.  **Carica l'estensione:**
    *   Clicca sul pulsante **Carica estensione non pacchettizzata** (Load unpacked) in alto a sinistra.
    *   Seleziona la cartella **`src`** all'interno della directory del progetto (quella che contiene il file `manifest.json`).
5.  **Pronto!** Apri una nuova scheda nel browser per iniziare a usare la tua dashboard.

---

## ⚙️ Configurazione delle API Key

Per abilitare tutte le funzionalità avanzate, clicca sull'icona dell'ingranaggio (**Impostazioni**) in basso a sinistra nella dashboard ed inserisci le tue credenziali personali:

*   **Chat AI (OpenAI Compatibile):** Endpoint API personalizzabile (default: `https://api.openai.com/v1`) e API key per OpenAI o qualsiasi provider compatibile (DeepSeek, OpenRouter, Groq, Ollama locale, ecc.).
*   **OpenWeatherMap API Key:** Richiesta per le previsioni meteo. Registrati su [OpenWeatherMap](https://openweathermap.org/) per ottenere una chiave gratuita.
*   **Spotify Client ID:** Necessario per il widget Spotify. Registra un'applicazione sul [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) e inserisci il Client ID (assicurati di impostare l'URI di reindirizzamento corretto indicato nelle istruzioni di Spotify).
*   **Google Client ID:** Richiesto per Google Calendar. Vedi sezione sotto per `redirect_uri_mismatch`.

*Nota: Le chiavi vengono usate solo per le chiamate ai rispettivi servizi e non vengono mai memorizzate online: tutti i dati rimangono salvati localmente sul tuo browser tramite `localStorage`. L'export backup chiede se includere segreti (default consigliato: esclusi).*

---

## 🛟 Fix errore 400 redirect_uri_mismatch (Google Calendar / Spotify)

Se vedi `Errore 400: redirect_uri_mismatch ... redirect_uri=https://<ID>.chromiumapp.org/`:

1. Copia l'URI esatto da Impostazioni -> Google Calendar / Spotify -> campo Redirect URI (click per copiare) oppure dalla schermata login calendario.
2. Vai su [Google Cloud Console](https://console.cloud.google.com/) -> API e servizi -> **Abilita Google Calendar API**.
3. **OAuth consent screen** -> External -> aggiungi la tua Gmail in **Test users**.
4. **Credenziali** -> Crea ID client OAuth -> Tipo **Estensione Chrome** (Item ID = ID in `chrome://extensions`, es. `chppcaaaclfmlicbdfbpmjeaojhhkncc`). Se usi tipo Web, aggiungi manualmente l'URI del punto 1 in **URI di reindirizzamento autorizzati**.
5. Incolla il Client ID `xxx.apps.googleusercontent.com` nelle Impostazioni e riprova.
6. Nota unpacked: senza `key` nel manifest l'ID cambia per ogni PC/installazione — ripeti la registrazione o pinna una `key` stabile. Per Spotify fai lo stesso in [Spotify Dashboard](https://developer.spotify.com/dashboard) -> Edit Settings -> Redirect URIs.

---
