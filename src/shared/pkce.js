// AppPkce: helper PKCE condivisi tra i flussi OAuth (Google Calendar, Spotify).
// Evita di duplicare la generazione del verifier e la challenge S256 nei componenti.
(function () {
    function generateRandomString(length) {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const values = crypto.getRandomValues(new Uint8Array(length));
        return Array.from(values).map((x) => possible[x % possible.length]).join('');
    }

    async function generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    window.AppPkce = {
        generateRandomString,
        generateCodeChallenge
    };
})();
