// Controllo aggiornamenti: confronta la versione installata (manifest) con quella
// presente su GitHub (manifest del branch main) e propone il download dello ZIP.
document.addEventListener('DOMContentLoaded', () => {
    const REPO_OWNER = 'Loreexe';
    const REPO_NAME = 'NewTab';
    const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
    const RAW_MANIFEST_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/src/manifest.json`;
    const ZIP_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/refs/heads/main.zip`;
    const ISSUES_URL = `${REPO_URL}/issues`;

    const CACHE_KEY = 'version_check_cache';
    const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 ore
    const REQUEST_TIMEOUT_MS = 10000;

    // UI elements
    const currentVersionEl = document.getElementById('version-current');
    const statusBadgeEl = document.getElementById('version-status');
    const statusDetailEl = document.getElementById('version-status-detail');
    const checkBtn = document.getElementById('check-updates-btn');
    const downloadBtn = document.getElementById('download-zip-btn');
    const repoLinkBtn = document.getElementById('github-repo-btn');
    const issuesLinkBtn = document.getElementById('github-issues-btn');

    if (!currentVersionEl || !statusBadgeEl) return;

    function getLocalVersion() {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
                return chrome.runtime.getManifest().version || '?';
            }
        } catch (e) { /* ignore */ }
        return '?';
    }

    // Confronta due versioni semver-ish (x.y.z). Ritorna 1 se a > b, -1 se a < b, 0 se uguali.
    function compareVersions(a, b) {
        const parse = (v) => String(v || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
        const pa = parse(a);
        const pb = parse(b);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
            const na = pa[i] || 0;
            const nb = pb[i] || 0;
            if (na > nb) return 1;
            if (na < nb) return -1;
        }
        return 0;
    }

    function openExternal(url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    function formatAgo(ts) {
        const mins = Math.max(1, Math.round((Date.now() - ts) / 60000));
        if (mins < 60) return `${mins} min fa`;
        const hours = Math.round(mins / 60);
        if (hours < 24) return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;
        const days = Math.round(hours / 24);
        return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`;
    }

    function readCache() {
        try {
            const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            if (parsed && typeof parsed.ts === 'number' && typeof parsed.remoteVersion === 'string') {
                return parsed;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function writeCache(remoteVersion) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), remoteVersion }));
        } catch (e) { /* ignore */ }
    }

    function setBadge(text, variant) {
        statusBadgeEl.textContent = text;
        statusBadgeEl.className = 'version-badge' + (variant ? ` version-badge-${variant}` : '');
    }

    // stale = informazione proveniente dalla cache perché la rete non ha risposto
    function renderState(localVersion, remoteVersion, options) {
        const opts = options || {};
        const stale = Boolean(opts.stale);

        if (!remoteVersion) {
            setBadge('Non verificabile', 'err');
            if (statusDetailEl) {
                statusDetailEl.textContent = opts.errorMessage
                    ? opts.errorMessage
                    : 'Impossibile contattare GitHub in questo momento.';
            }
            if (downloadBtn) downloadBtn.style.display = 'none';
            return;
        }

        if (stale) {
            setBadge('Dalla cache', 'stale');
            if (statusDetailEl) {
                statusDetailEl.textContent = `Ultimo controllo riuscito ${formatAgo(opts.checkedAt)}.`;
            }
        }

        const cmp = compareVersions(remoteVersion, localVersion);

        if (cmp > 0) {
            if (!stale) {
                setBadge('Nuova versione disponibile', 'new');
                if (statusDetailEl) {
                    statusDetailEl.textContent = `Ultima su GitHub: v${remoteVersion}.`;
                }
            }
            if (downloadBtn) downloadBtn.style.display = 'inline-block';
        } else {
            if (!stale) {
                setBadge('Sei aggiornato', 'ok');
                if (statusDetailEl) {
                    statusDetailEl.textContent = `Ultima versione su GitHub: v${remoteVersion}.`;
                }
            }
            if (downloadBtn) downloadBtn.style.display = 'none';
        }
    }

    function setLoading(isLoading) {
        if (!checkBtn) return;
        checkBtn.disabled = isLoading;
        checkBtn.textContent = isLoading ? 'Controllo in corso...' : 'Verifica ora';
    }

    async function fetchRemoteVersion() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(RAW_MANIFEST_URL, { signal: controller.signal, cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            if (!data || typeof data.version !== 'string' || !data.version) {
                throw new Error('Manifest remoto non valido');
            }
            return data.version;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function checkForUpdate(force) {
        const localVersion = getLocalVersion();
        currentVersionEl.textContent = `v${localVersion}`;

        const cached = readCache();
        const isCacheFresh = cached && (Date.now() - cached.ts < CHECK_INTERVAL_MS);

        if (!force && isCacheFresh) {
            renderState(localVersion, cached.remoteVersion, { checkedAt: cached.ts });
            return;
        }

        setLoading(true);
        try {
            const remoteVersion = await fetchRemoteVersion();
            writeCache(remoteVersion);
            renderState(localVersion, remoteVersion, {});
        } catch (err) {
            console.error('Errore nel controllo degli aggiornamenti:', err);
            const reason = err.name === 'AbortError' ? 'timeout della richiesta' : err.message;
            if (cached) {
                // Meglio un dato vecchio che una scheda vuota: lo etichettiamo per onestà.
                renderState(localVersion, cached.remoteVersion, { stale: true, checkedAt: cached.ts });
                if (statusDetailEl) {
                    statusDetailEl.textContent = `Controllo non riuscito (${reason}). Ultimo controllo riuscito ${formatAgo(cached.ts)}.`;
                }
            } else {
                renderState(localVersion, null, { errorMessage: `Controllo non riuscito (${reason}).` });
            }
        } finally {
            setLoading(false);
        }
    }

    if (checkBtn) {
        checkBtn.addEventListener('click', () => checkForUpdate(true));
    }
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => openExternal(ZIP_URL));
    }
    if (repoLinkBtn) {
        repoLinkBtn.addEventListener('click', () => openExternal(REPO_URL));
    }
    if (issuesLinkBtn) {
        issuesLinkBtn.addEventListener('click', () => openExternal(ISSUES_URL));
    }

    // Ricalcola la versione locale e riusa la cache valida a ogni apertura del modale.
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => checkForUpdate(false));
    }

    // Stato iniziale immediato (cache o "verifica ora"), senza bloccare il rendering.
    currentVersionEl.textContent = `v${getLocalVersion()}`;
    setBadge('In verifica...', 'stale');
    if (statusDetailEl) {
        statusDetailEl.textContent = 'Contattando GitHub...';
    }
    checkForUpdate(false);
});
