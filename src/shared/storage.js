// AppStorage: livello di storage unificato basato su chrome.storage.local.
//
// Espone la stessa API sincrona di localStorage (getItem/setItem/removeItem/clear/key/length)
// grazie a una cache in memoria precaricata all'avvio. Le scritture aggiornano subito la cache
// e vengono persistite in background (raggruppate in un unico batch per tick).
//
// Avvio dei componenti: usare AppStorage.ready(cb) al posto di
// document.addEventListener('DOMContentLoaded', cb). La callback parte quando il DOM è pronto
// E la cache è caricata; l'ordine di registrazione viene rispettato.
//
// Migrazione: al primo avvio copia tutte le chiavi da localStorage in chrome.storage.local,
// verifica la copia e solo allora rimuove le chiavi migrate da localStorage.
//
// Fallback: se chrome.storage non è disponibile (es. index.html aperto come file), delega
// direttamente a window.localStorage.
(function () {
    const INTERNAL_PREFIX = '__appstorage_';
    const MIGRATION_FLAG = INTERNAL_PREFIX + 'migrated_v1';

    const hasChromeStorage = typeof chrome !== 'undefined'
        && chrome.storage && chrome.storage.local
        && typeof chrome.storage.local.get === 'function';

    const cache = new Map();          // chiave -> stringa
    let useLegacy = !hasChromeStorage; // true = delega a window.localStorage

    // Coda di scrittura: le modifiche dello stesso tick vengono raggruppate in un batch,
    // e i batch vengono eseguiti in sequenza per preservare l'ordine (es. clear() poi set()).
    let pendingSets = {};
    let pendingRemoves = new Set();
    let flushScheduled = false;
    let writeChain = Promise.resolve();
    const inFlight = new Map();       // chiave -> numero di scritture in corso

    function isInternal(key) {
        return typeof key === 'string' && key.startsWith(INTERNAL_PREFIX);
    }

    function markInFlight(keys, delta) {
        keys.forEach((k) => {
            const n = (inFlight.get(k) || 0) + delta;
            if (n <= 0) inFlight.delete(k); else inFlight.set(k, n);
        });
    }

    function enqueue(op) {
        writeChain = writeChain.then(op).catch((err) => {
            console.error('[AppStorage] Errore di scrittura:', err);
        });
        return writeChain;
    }

    function scheduleFlush() {
        if (flushScheduled) return;
        flushScheduled = true;
        queueMicrotask(flushPending);
    }

    function flushPending() {
        flushScheduled = false;
        const sets = pendingSets;
        const removes = Array.from(pendingRemoves);
        pendingSets = {};
        pendingRemoves = new Set();

        const setKeys = Object.keys(sets);
        if (setKeys.length === 0 && removes.length === 0) return writeChain;

        const touched = setKeys.concat(removes);
        markInFlight(touched, +1);
        return enqueue(async () => {
            try {
                if (removes.length) await chrome.storage.local.remove(removes);
                if (setKeys.length) await chrome.storage.local.set(sets);
            } finally {
                markInFlight(touched, -1);
            }
        });
    }

    // ── API pubblica (compatibile con localStorage) ──────────────────────────

    function getItem(key) {
        if (useLegacy) return window.localStorage.getItem(key);
        key = String(key);
        return cache.has(key) ? cache.get(key) : null;
    }

    function setItem(key, value) {
        if (useLegacy) return window.localStorage.setItem(key, value);
        key = String(key);
        const str = String(value);
        cache.set(key, str);
        pendingRemoves.delete(key);
        pendingSets[key] = str;
        scheduleFlush();
    }

    function removeItem(key) {
        if (useLegacy) return window.localStorage.removeItem(key);
        key = String(key);
        cache.delete(key);
        delete pendingSets[key];
        pendingRemoves.add(key);
        scheduleFlush();
    }

    function clear() {
        if (useLegacy) return window.localStorage.clear();
        cache.clear();
        pendingSets = {};
        pendingRemoves = new Set();
        enqueue(async () => {
            await chrome.storage.local.clear();
            // Mantiene il flag: evita di ri-migrare un localStorage ormai vuoto/obsoleto.
            await chrome.storage.local.set({ [MIGRATION_FLAG]: true });
        });
    }

    function keys() {
        if (useLegacy) {
            const out = [];
            for (let i = 0; i < window.localStorage.length; i++) out.push(window.localStorage.key(i));
            return out;
        }
        return Array.from(cache.keys());
    }

    function key(index) {
        const k = keys()[index];
        return k === undefined ? null : k;
    }

    // Restituisce una Promise risolta quando tutte le scritture pendenti sono persistite.
    // Da usare prima di window.location.reload() o di una navigazione.
    function flush() {
        if (useLegacy) return Promise.resolve();
        flushPending();
        return writeChain;
    }

    // ── Avvio: migrazione + caricamento cache ────────────────────────────────

    function readLegacyLocalStorage() {
        const out = {};
        try {
            for (let i = 0; i < window.localStorage.length; i++) {
                const k = window.localStorage.key(i);
                if (k === null || isInternal(k)) continue;
                const v = window.localStorage.getItem(k);
                if (v !== null) out[k] = v;
            }
        } catch (e) {
            console.warn('[AppStorage] localStorage non leggibile:', e);
        }
        return out;
    }

    async function migrateIfNeeded(stored) {
        if (stored[MIGRATION_FLAG]) return stored;

        const legacy = readLegacyLocalStorage();
        // In caso di conflitto prevalgono i valori già presenti in chrome.storage.
        const toWrite = {};
        Object.keys(legacy).forEach((k) => {
            if (!(k in stored)) toWrite[k] = legacy[k];
        });

        await chrome.storage.local.set(Object.assign({}, toWrite, { [MIGRATION_FLAG]: true }));

        // Verifica la copia prima di rimuovere i dati originali.
        const migratedKeys = Object.keys(toWrite);
        const check = migratedKeys.length ? await chrome.storage.local.get(migratedKeys) : {};
        const verified = migratedKeys.every((k) => check[k] === toWrite[k]);
        if (verified) {
            migratedKeys.forEach((k) => {
                try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ }
            });
            if (migratedKeys.length) {
                console.info(`[AppStorage] Migrate ${migratedKeys.length} chiavi da localStorage a chrome.storage.local.`);
            }
        } else {
            console.warn('[AppStorage] Verifica migrazione fallita: localStorage conservato come copia di sicurezza.');
        }

        return Object.assign({}, stored, toWrite, { [MIGRATION_FLAG]: true });
    }

    async function init() {
        if (useLegacy) return;
        try {
            let stored = await chrome.storage.local.get(null);
            stored = await migrateIfNeeded(stored || {});
            Object.keys(stored).forEach((k) => {
                if (isInternal(k)) return;
                const v = stored[k];
                if (v === null || v === undefined) return;
                cache.set(k, typeof v === 'string' ? v : JSON.stringify(v));
            });

            // Sincronizzazione tra più schede aperte: applica le modifiche fatte altrove,
            // ignorando le chiavi con scritture locali ancora pendenti o in corso.
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area !== 'local') return;
                Object.keys(changes).forEach((k) => {
                    if (isInternal(k) || k in pendingSets || pendingRemoves.has(k) || inFlight.has(k)) return;
                    const { newValue } = changes[k];
                    if (newValue === undefined || newValue === null) cache.delete(k);
                    else cache.set(k, typeof newValue === 'string' ? newValue : JSON.stringify(newValue));
                });
            });
        } catch (err) {
            console.error('[AppStorage] chrome.storage non utilizzabile, uso localStorage:', err);
            cache.clear();
            useLegacy = true;
        }
    }

    // ── ready(): sostituto di DOMContentLoaded che attende anche lo storage ──

    const readyQueue = [];
    let isReady = false;

    function runCallback(cb) {
        try { cb(); } catch (err) { console.error('[AppStorage] Errore in una callback ready():', err); }
    }

    function ready(cb) {
        if (isReady) { queueMicrotask(() => runCallback(cb)); return; }
        readyQueue.push(cb);
    }

    const domReady = new Promise((resolve) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        } else {
            resolve();
        }
    });

    Promise.all([init(), domReady]).then(() => {
        isReady = true;
        // Esecuzione in ordine di registrazione, come i listener DOMContentLoaded.
        while (readyQueue.length) runCallback(readyQueue.shift());
    });

    const api = { getItem, setItem, removeItem, clear, key, keys, flush, ready };
    Object.defineProperty(api, 'length', { get: () => keys().length });
    window.AppStorage = api;
})();
