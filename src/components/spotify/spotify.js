document.addEventListener('DOMContentLoaded', () => {
    // Spotify Config Constants
    function getSpotifyRedirectUri() {
        try {
            if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getRedirectURL) {
                return chrome.identity.getRedirectURL();
            }
        } catch (e) { /* ignore */ }
        return "";
    }
    const REDIRECT_URI = getSpotifyRedirectUri();
    const SCOPES = "user-read-playback-state user-modify-playback-state";

    // State variables
    let localProgressMs = 0;
    let durationMs = 0;
    let progressInterval = null;
    let syncInterval = null;
    let isPlaying = false;
    let lastVolumePercent = 50;
    let isMuted = false;
    let lastActionTime = 0; // Timestamp of the last user interaction
    let lastFetchTime = 0;  // Timestamp of the last API fetch to prevent spamming

    // UI elements
    const spotifyLoginContainer = document.getElementById("spotify-login-container");
    const spotifyPlayerContent = document.getElementById("spotify-player-content");
    const spotifyConnectBtn = document.getElementById("spotify-connect-btn");
    
    const albumArt = document.getElementById("albumArt");
    const nomeCanzone = document.getElementById("nomecanzone");
    const cantante = document.getElementById("cantante");
    
    const playBtn = document.getElementById("pulsanteplay");
    const prevBtn = document.getElementById("canzoneprecedente");
    const nextBtn = document.getElementById("prossimacanzone");
    
    const progressEl = document.getElementById("progress");
    const currentTimeEl = document.getElementById("currentTime");
    const durationEl = document.getElementById("duration");
    const progressBarClickable = document.getElementById("progress-bar-clickable");
    
    const volumeSlider = document.getElementById("volume-slider");
    const volumeIcon = document.getElementById("volume-icon");
    const musicPlayerContainer = document.querySelector(".music-player");

    // PKCE Helper: Generate cryptographic random string
    function generateRandomString(length) {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const values = crypto.getRandomValues(new Uint8Array(length));
        return Array.from(values).map((x) => possible[x % possible.length]).join('');
    }

    // PKCE Helper: Generate challenge from verifier using SHA-256
    async function generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    // Toggle UI display
    function showConnectedUI() {
        if (spotifyLoginContainer) spotifyLoginContainer.style.display = "none";
        if (spotifyPlayerContent) spotifyPlayerContent.style.display = "flex";
    }

    // Display the login button
    function showDisconnectedUI() {
        if (spotifyLoginContainer) spotifyLoginContainer.style.display = "flex";
        if (spotifyPlayerContent) spotifyPlayerContent.style.display = "none";
    }

    // Launch Spotify Web Authorization PKCE Flow
    async function loginToSpotify() {
        const clientId = (localStorage.getItem("spotify_client_id") || "").trim();
        if (!clientId) {
            alert("Configura il tuo Spotify Client ID nelle Impostazioni (icona ⚙️ in alto a destra).");
            return;
        }
        if (!REDIRECT_URI) {
            alert("L'API chrome.identity non è disponibile: impossibile avviare il login Spotify.");
            return;
        }

        const codeVerifier = generateRandomString(64);
        localStorage.setItem("spotify_code_verifier", codeVerifier);

        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const authUrl = `https://accounts.spotify.com/authorize?` + new URLSearchParams({
            client_id: clientId,
            response_type: 'code',
            redirect_uri: REDIRECT_URI,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge,
            scope: SCOPES
        }).toString();

        if (typeof chrome === 'undefined' || !chrome.identity) {
            alert("L'API chrome.identity non è disponibile.");
            return;
        }

        chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        }, async (redirectUrl) => {
            const lastErr = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError)
                ? chrome.runtime.lastError.message
                : null;
            if (lastErr || !redirectUrl) {
                const errorMsg = lastErr || "Nessun URL di reindirizzamento restituito.";
                const lower = errorMsg.toLowerCase();
                const isUserCancel = lower.includes("did not approve")
                    || lower.includes("access_denied") || lower.includes("access denied")
                    || lower.includes("user cancel") || lower.includes("cancelled")
                    || lower.includes("canceled") || lower.includes("window closed");
                if (isUserCancel) {
                    console.warn("Spotify auth annullato dall'utente, nessun alert.");
                    return;
                }
                console.error("Auth flow error:", errorMsg);

                // "Authorization page could not be loaded" typically means the Redirect URI
                // in the Spotify Developer Dashboard doesn't match chrome.identity.getRedirectURL().
                const redirectUri = (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getRedirectURL) ? chrome.identity.getRedirectURL() : "(non disponibile)";
                const isUriMismatch = errorMsg.toLowerCase().includes("could not be loaded") ||
                                      errorMsg.toLowerCase().includes("not be loaded");
                if (isUriMismatch) {
                    alert(
                        "Errore Spotify: la pagina di autorizzazione non può essere caricata.\n\n" +
                        "Causa più comune: il Redirect URI non è registrato nella Spotify Developer Dashboard.\n\n" +
                        "🔧 Soluzione:\n" +
                        "1. Vai su https://developer.spotify.com/dashboard\n" +
                        "2. Apri la tua app → Edit Settings\n" +
                        "3. Aggiungi esattamente questo Redirect URI:\n\n" +
                        redirectUri + "\n\n" +
                        "4. Salva e riprova."
                    );
                } else {
                    alert("Errore nel collegamento Spotify: " + errorMsg);
                }
                return;
            }

            const url = new URL(redirectUrl);
            if (url.searchParams.get("error")) {
                console.warn("Spotify auth rifiutato:", url.searchParams.get("error"));
                return;
            }
            const code = url.searchParams.get("code");
            if (code) {
                await exchangeCodeForToken(code, codeVerifier);
            }
        });
    }

    // Exchange authorization code for token
    async function exchangeCodeForToken(code, codeVerifier) {
        const clientId = localStorage.getItem("spotify_client_id") || "";
        try {
            const response = await fetch("https://accounts.spotify.com/api/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    client_id: clientId,
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: REDIRECT_URI,
                    code_verifier: codeVerifier
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error_description || "Errore di scambio");
            }

            const data = await response.json();
            saveTokens(data);
            initPlayer();
        } catch (error) {
            console.error("Errore scambio codice per token:", error);
            alert("Errore nel collegamento Spotify: " + error.message);
        }
    }

    // Save tokens to localStorage
    function saveTokens(data) {
        localStorage.setItem("spotify_access_token", data.access_token);
        if (data.refresh_token) {
            localStorage.setItem("spotify_refresh_token", data.refresh_token);
        }
        const expiresAt = Date.now() + (data.expires_in * 1000);
        localStorage.setItem("spotify_expires_at", expiresAt.toString());
    }

    // Refresh accessToken using refreshToken
    async function refreshAccessToken() {
        const clientId = localStorage.getItem("spotify_client_id") || "";
        const refreshToken = localStorage.getItem("spotify_refresh_token");
        if (!refreshToken || !clientId) return null;

        try {
            const response = await fetch("https://accounts.spotify.com/api/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    client_id: clientId,
                    grant_type: "refresh_token",
                    refresh_token: refreshToken
                })
            });

            if (!response.ok) {
                logoutSpotify();
                return null;
            }

            const data = await response.json();
            saveTokens(data);
            return data.access_token;
        } catch (error) {
            console.error("Error refreshing token:", error);
            return null;
        }
    }

    // Get a valid cached access token or refresh it
    async function getValidAccessToken() {
        const token = localStorage.getItem("spotify_access_token");
        const expiresAt = localStorage.getItem("spotify_expires_at");

        if (!token || !expiresAt) return null;

        // If expires in less than 5 minutes, refresh
        if (Date.now() > (parseInt(expiresAt, 10) - 5 * 60 * 1000)) {
            return await refreshAccessToken();
        }

        return token;
    }

    // Logout function
    function logoutSpotify() {
        localStorage.removeItem("spotify_access_token");
        localStorage.removeItem("spotify_refresh_token");
        localStorage.removeItem("spotify_expires_at");
        localStorage.removeItem("spotify_code_verifier");
        
        clearInterval(progressInterval);
        clearInterval(syncInterval);
        
        showDisconnectedUI();
        
        // Hide disconnect button in settings if modal is open
        const disconnectContainer = document.getElementById("settings-spotify-disconnect-container");
        if (disconnectContainer) disconnectContainer.style.display = "none";
    }

    // Format millisecond time to mm:ss
    function formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // Update Progress Bar UI
    function updateProgressBarUI() {
        if (durationMs > 0) {
            const percentage = Math.min((localProgressMs / durationMs) * 100, 100);
            if (progressEl) progressEl.style.width = `${percentage}%`;
            if (currentTimeEl) currentTimeEl.textContent = formatTime(localProgressMs);
            if (durationEl) durationEl.textContent = formatTime(durationMs);
        } else {
            if (progressEl) progressEl.style.width = "0%";
            if (currentTimeEl) currentTimeEl.textContent = "0:00";
            if (durationEl) durationEl.textContent = "0:00";
        }
    }

    // Update speaker icon based on volume level
    function updateVolumeIcon(volume) {
        if (!volumeIcon) return;
        if (volume === 0) {
            volumeIcon.textContent = "🔇";
        } else if (volume < 30) {
            volumeIcon.textContent = "🔈";
        } else if (volume < 70) {
            volumeIcon.textContent = "🔉";
        } else {
            volumeIcon.textContent = "🔊";
        }
    }

    // Helper: start local progress increment
    function startLocalProgress() {
        clearInterval(progressInterval);
        progressInterval = setInterval(() => {
            localProgressMs = Math.min(localProgressMs + 1000, durationMs);
            updateProgressBarUI();
            if (localProgressMs >= durationMs) {
                clearInterval(progressInterval);
                // After song finishes, sync with server after a short delay
                setTimeout(() => updatePlayer(true), 1500);
            }
        }, 1000);
    }

    // Update player contents (with throttle control)
    async function updatePlayer(force = false) {
        // Prevent spamming the API: limit fetches to once every 3 seconds unless forced
        if (!force && (Date.now() - lastFetchTime < 3000)) {
            return;
        }
        lastFetchTime = Date.now();

        const token = await getValidAccessToken();
        if (!token) {
            showDisconnectedUI();
            return;
        }

        try {
            const response = await fetch("https://api.spotify.com/v1/me/player", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.status === 204 || response.status === 404) {
                // No active playback
                const isControlCooldown = (Date.now() - lastActionTime < 3500);
                if (!isControlCooldown) {
                    if (nomeCanzone) nomeCanzone.textContent = "Nessuna riproduzione";
                    if (cantante) cantante.textContent = "Avvia Spotify";
                    if (albumArt) albumArt.src = "images/spotify-logo.svg";
                    
                    isPlaying = false;
                    localProgressMs = 0;
                    durationMs = 0;
                    updateProgressBarUI();
                    
                    if (playBtn) playBtn.textContent = "▶";
                    clearInterval(progressInterval);
                }
                return;
            }

            if (!response.ok) {
                if (response.status === 401) {
                    const newToken = await refreshAccessToken();
                    if (newToken) updatePlayer(true);
                }
                return;
            }

            const data = await response.json();
            
            showConnectedUI();

            if (data && data.item) {
                // Always update track metadata (art, name, artists)
                if (albumArt) albumArt.src = data.item.album.images[0]?.url || "images/spotify-logo.svg";
                if (nomeCanzone) nomeCanzone.textContent = data.item.name;
                if (cantante) cantante.textContent = data.item.artists.map(artist => artist.name).join(', ');
                
                durationMs = data.item.duration_ms || 0;

                // Update volume slider and icon based on device state
                if (data.device && volumeSlider) {
                    if (document.activeElement !== volumeSlider) {
                        volumeSlider.value = data.device.volume_percent;
                    }
                    lastVolumePercent = data.device.volume_percent || 50;
                    updateVolumeIcon(data.device.volume_percent);
                }

                // Optimistic UI check: only update play/pause state and progress if not in cooldown
                const isControlCooldown = (Date.now() - lastActionTime < 3500);
                if (!isControlCooldown) {
                    localProgressMs = data.progress_ms || 0;
                    updateProgressBarUI();

                    isPlaying = data.is_playing;
                    if (playBtn) playBtn.textContent = isPlaying ? "⏸" : "▶";

                    clearInterval(progressInterval);
                    if (isPlaying) {
                        startLocalProgress();
                    }
                }
            }
        } catch (error) {
            console.error("Error updating Spotify player:", error);
        }
    }

    // Play / Resume helper with fallback to available devices
    async function playOrResume() {
        const token = await getValidAccessToken();
        if (!token) return;

        try {
            lastActionTime = Date.now(); // Start cooldown
            
            // 1. Try direct play/resume
            let response = await fetch("https://api.spotify.com/v1/me/player/play", {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            if (response.ok) {
                isPlaying = true;
                if (playBtn) playBtn.textContent = "⏸";
                startLocalProgress();
                return;
            }

            // 2. If it fails (usually 404 NO_ACTIVE_DEVICE), query available devices
            const devicesResponse = await fetch("https://api.spotify.com/v1/me/player/devices", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!devicesResponse.ok) {
                alert("Impossibile controllare Spotify. Assicurati che l'app Spotify sia attiva.");
                return;
            }

            const devicesData = await devicesResponse.json();
            const devices = devicesData.devices || [];

            if (devices.length > 0) {
                const targetDevice = devices.find(d => d.is_active) || devices[0];
                
                // Transfer playback to targeted device and force play: true (much more reliable)
                response = await fetch("https://api.spotify.com/v1/me/player", {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        device_ids: [targetDevice.id],
                        play: true
                    })
                });

                if (response.ok) {
                    isPlaying = true;
                    if (playBtn) playBtn.textContent = "⏸";
                    startLocalProgress();
                } else {
                    alert("Impossibile avviare Spotify. Apri l'app sul tuo dispositivo ed avvia un brano.");
                }
            } else {
                alert("Nessun dispositivo Spotify rilevato. Assicurati che l'app Spotify sia aperta sul tuo cellulare o computer.");
            }
        } catch (error) {
            console.error("Error resuming playback:", error);
            alert("Errore durante la riproduzione di Spotify.");
        }
    }

    // Control Event Listeners
    if (playBtn) {
        playBtn.addEventListener("click", async () => {
            const token = await getValidAccessToken();
            if (!token) return;

            lastActionTime = Date.now(); // Start cooldown

            if (isPlaying) {
                // Optimistic Pause
                isPlaying = false;
                playBtn.textContent = "▶";
                clearInterval(progressInterval);

                try {
                    await fetch("https://api.spotify.com/v1/me/player/pause", {
                        method: "PUT",
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json"
                        }
                    });
                } catch (error) {
                    console.error("Error in pause:", error);
                }
            } else {
                // Optimistic Play / Resume (smart resume)
                await playOrResume();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", async () => {
            const token = await getValidAccessToken();
            if (!token) return;

            lastActionTime = Date.now(); // Start cooldown
            
            try {
                const response = await fetch("https://api.spotify.com/v1/me/player/next", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    // Wait 1.5 seconds for Spotify backend to switch tracks before forcing metadata sync
                    setTimeout(() => updatePlayer(true), 1500);
                }
            } catch (error) {
                console.error("Error skipping to next:", error);
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", async () => {
            const token = await getValidAccessToken();
            if (!token) return;

            lastActionTime = Date.now(); // Start cooldown

            try {
                const response = await fetch("https://api.spotify.com/v1/me/player/previous", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    // Wait 1.5 seconds for Spotify backend to switch tracks before forcing metadata sync
                    setTimeout(() => updatePlayer(true), 1500);
                }
            } catch (error) {
                console.error("Error skipping to previous:", error);
            }
        });
    }

    // Seeking on progress bar click
    if (progressBarClickable) {
        progressBarClickable.addEventListener("click", async (e) => {
            const token = await getValidAccessToken();
            if (!token || durationMs === 0) return;

            lastActionTime = Date.now(); // Start cooldown

            const rect = progressBarClickable.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const percentage = clickX / width;
            const seekPositionMs = Math.round(percentage * durationMs);

            try {
                // Optimistically seek locally
                localProgressMs = seekPositionMs;
                updateProgressBarUI();

                await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${seekPositionMs}`, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
            } catch (error) {
                console.error("Error seeking:", error);
            }
        });
    }

    // Volume Slider Event Listeners
    if (volumeSlider) {
        volumeSlider.addEventListener("input", (e) => {
            const volume = parseInt(e.target.value);
            updateVolumeIcon(volume);
            isMuted = (volume === 0);
        });

        volumeSlider.addEventListener("change", async (e) => {
            const token = await getValidAccessToken();
            if (!token) return;
            const volume = parseInt(e.target.value);
            lastVolumePercent = volume;
            try {
                await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volume}`, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
            } catch (error) {
                console.error("Error setting Spotify volume:", error);
            }
        });
    }

    // Volume Icon Click (Mute / Unmute Toggle)
    if (volumeIcon) {
        volumeIcon.addEventListener("click", async () => {
            const token = await getValidAccessToken();
            if (!token) return;

            isMuted = !isMuted;
            const targetVolume = isMuted ? 0 : (lastVolumePercent > 0 ? lastVolumePercent : 50);

            try {
                const response = await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${targetVolume}`, {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    if (volumeSlider) volumeSlider.value = targetVolume;
                    updateVolumeIcon(targetVolume);
                }
            } catch (error) {
                console.error("Error toggling Spotify mute:", error);
            }
        });
    }

    // Real-time State Sync on Mouse Enter / Hover (Throttled to once every 3s)
    if (musicPlayerContainer) {
        musicPlayerContainer.addEventListener("mouseenter", () => {
            updatePlayer();
        });
    }

    if (spotifyConnectBtn) {
        spotifyConnectBtn.addEventListener("click", loginToSpotify);
    }

    // Initialize player on load
    async function initPlayer() {
        if (localStorage.getItem('spotify_enabled') === 'false') {
            return;
        }
        const token = await getValidAccessToken();
        if (token) {
            showConnectedUI();
            updatePlayer(true);
            // Start polling every 10 seconds to keep in sync
            clearInterval(syncInterval);
            syncInterval = setInterval(() => updatePlayer(true), 10000);
        } else {
            showDisconnectedUI();
        }
    }

    // Expose logout function globally so settings modal can invoke it
    window.logoutSpotify = logoutSpotify;

    // Run initialization
    initPlayer();
});
