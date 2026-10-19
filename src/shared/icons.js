// AppIcons: modulo condiviso per la gestione e il riutilizzo delle icone SVG nel progetto.
// Espone icone standard con parametri configurabili (dimensioni, classi, stili inline).
(function () {
    const ICONS = {
        edit: (opts) => {
            const w = opts.width || 14;
            const h = opts.height || 14;
            const cls = opts.className ? ` class="${opts.className}"` : '';
            const sty = opts.style ? ` style="${opts.style}"` : '';
            return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${cls}${sty}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
        },
        trash: (opts) => {
            const w = opts.width || 14;
            const h = opts.height || 14;
            const cls = opts.className ? ` class="${opts.className}"` : '';
            const sty = opts.style ? ` style="${opts.style}"` : '';
            return `<svg viewBox="0 0 20 20" width="${w}" height="${h}" fill="none" xmlns="http://www.w3.org/2000/svg"${cls}${sty}><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M8.78842 5.03866C8.86656 4.96052 8.97254 4.91663 9.08305 4.91663H11.4164C11.5269 4.91663 11.6329 4.96052 11.711 5.03866C11.7892 5.11681 11.833 5.22279 11.833 5.33329V5.74939H8.66638V5.33329C8.66638 5.22279 8.71028 5.11681 8.78842 5.03866ZM7.16638 5.74939V5.33329C7.16638 4.82496 7.36832 4.33745 7.72776 3.978C8.08721 3.61856 8.57472 3.41663 9.08305 3.41663H11.4164C11.9247 3.41663 12.4122 3.61856 12.7717 3.978C13.1311 4.33745 13.333 4.82496 13.333 5.33329V5.74939H15.5C15.9142 5.74939 16.25 6.08518 16.25 6.49939C16.25 6.9136 15.9142 7.24939 15.5 7.24939H15.0105L14.2492 14.7095C14.2382 15.2023 14.0377 15.6726 13.6883 16.0219C13.3289 16.3814 12.8414 16.5833 12.333 16.5833H8.16638C7.65805 16.5833 7.17054 16.3814 6.81109 16.0219C6.46176 15.6726 6.2612 15.2023 6.25019 14.7095L5.48896 7.24939H5C4.58579 7.24939 4.25 6.9136 4.25 6.49939C4.25 6.08518 4.58579 5.74939 5 5.74939H6.16667H7.16638ZM7.91638 7.24996H12.583H13.5026L12.7536 14.5905C12.751 14.6158 12.7497 14.6412 12.7497 14.6666C12.7497 14.7771 12.7058 14.8831 12.6277 14.9613C12.5495 15.0394 12.4436 15.0833 12.333 15.0833H8.16638C8.05588 15.0833 7.94989 15.0394 7.87175 14.9613C7.79361 14.8831 7.74972 14.7771 7.74972 14.6666C7.74972 14.6412 7.74842 14.6158 7.74584 14.5905L6.99681 7.24996H7.91638Z"></path></svg>`;
        },
        drag: (opts) => {
            const w = opts.width || 14;
            const h = opts.height || 14;
            const cls = opts.className ? ` class="${opts.className}"` : '';
            const sty = opts.style ? ` style="${opts.style}"` : ' style="opacity: 0.5; vertical-align: middle;"';
            return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="2.5"${cls}${sty}><circle cx="9" cy="5" r="1.5" fill="currentColor"></circle><circle cx="9" cy="12" r="1.5" fill="currentColor"></circle><circle cx="9" cy="19" r="1.5" fill="currentColor"></circle><circle cx="15" cy="5" r="1.5" fill="currentColor"></circle><circle cx="15" cy="12" r="1.5" fill="currentColor"></circle><circle cx="15" cy="19" r="1.5" fill="currentColor"></circle></svg>`;
        },
        check: (opts) => {
            const w = opts.width || 14;
            const h = opts.height || 14;
            const cls = opts.className ? ` class="${opts.className}"` : '';
            const sty = opts.style ? ` style="${opts.style}"` : '';
            return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"${cls}${sty}><polyline points="20 6 9 17 4 12"/></svg>`;
        },
        editMode: (opts) => {
            const w = opts.width || 14;
            const h = opts.height || 14;
            const cls = opts.className ? ` class="${opts.className}"` : '';
            const sty = opts.style ? ` style="${opts.style}"` : '';
            return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"${cls}${sty}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
        },
        plus: (opts) => {
            const w = opts.width || 16;
            const h = opts.height || 16;
            const cls = opts.className ? ` class="${opts.className}"` : '';
            const sty = opts.style ? ` style="${opts.style}"` : '';
            const sw = opts.strokeWidth || 3;
            return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${cls}${sty}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
        },
        upload: (opts) => {
            const w = opts.width || 16;
            const h = opts.height || 16;
            const cls = opts.className ? ` class="${opts.className}"` : '';
            const sty = opts.style ? ` style="${opts.style}"` : '';
            return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${cls}${sty}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>`;
        },
        spinner: (opts) => {
            const w = opts.width || 16;
            const h = opts.height || 16;
            const cls = opts.className ? ` class="${opts.className}"` : ' class="spin-icon"';
            const sty = opts.style ? ` style="${opts.style}"` : '';
            return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="2"${cls}${sty}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`;
        },
        aiAvatar: (opts) => {
            const w = opts.width || 14;
            const h = opts.height || 14;
            const cls = opts.className ? ` class="${opts.className}"` : '';
            const sty = opts.style ? ` style="${opts.style}"` : '';
            return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="currentColor"${cls}${sty}><path d="M12 2L14.7 8.3L21 9.6L16.2 14L17.7 20.5L12 17L6.3 20.5L7.8 14L3 9.6L9.3 8.3L12 2Z"></path></svg>`;
        },
        cpu: (opts) => {
            const w = opts.width || 24;
            const h = opts.height || 24;
            const cls = opts.className ? ` class="${opts.className}"` : '';
            const sty = opts.style ? ` style="${opts.style}"` : '';
            return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${cls}${sty}><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="15" x2="23" y2="15"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="15" x2="4" y2="15"></line></svg>`;
        },
        ram: (opts) => {
            const w = opts.width || 24;
            const h = opts.height || 24;
            const cls = opts.className ? ` class="${opts.className}"` : '';
            const sty = opts.style ? ` style="${opts.style}"` : '';
            return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${cls}${sty}><rect x="2" y="9" width="20" height="6" rx="1"></rect><path d="M5 15v2M9 15v2M13 15v2M17 15v2M21 15v2M3 15v2"></path><rect x="4" y="11" width="3" height="3" rx="0.5"></rect><rect x="8" y="11" width="3" height="3" rx="0.5"></rect><rect x="12" y="11" width="3" height="3" rx="0.5"></rect><rect x="16" y="11" width="3" height="3" rx="0.5"></rect></svg>`;
        },
        battery: (opts) => {
            const w = opts.width || 24;
            const h = opts.height || 24;
            const cls = opts.className ? ` class="${opts.className}"` : '';
            const sty = opts.style ? ` style="${opts.style}"` : '';
            return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${cls}${sty}><rect x="1" y="6" width="18" height="12" rx="2" ry="2"></rect><line x1="23" y1="11" x2="23" y2="13"></line></svg>`;
        }
    };

    function getSvg(name, options = {}) {
        const fn = ICONS[name];
        if (!fn) {
            console.warn(`[AppIcons] Icona non trovata: ${name}`);
            return '';
        }
        return fn(options);
    }

    function createIconElement(name, options = {}) {
        const svgStr = getSvg(name, options);
        if (!svgStr) return null;
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgStr, 'image/svg+xml');
        return doc.documentElement;
    }

    window.AppIcons = {
        getSvg,
        createIconElement
    };
})();
