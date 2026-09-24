// Sanitizer minimale senza dipendenze esterne (CSP-friendly).
// Uso: window.AppSanitize.escapeHtml(str), window.AppSanitize.sanitizeMarkdownHtml(html)
(function () {
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Allowlist ridotta per l'output di marked: no script/style/iframe/object/embed,
    // no event-handler on*, no javascript:/data:text/html.
    const ALLOWED_TAGS = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'U', 'DEL', 'S', 'CODE', 'PRE', 'P', 'BR', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'HR', 'SPAN', 'DIV', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'IMG']);
    const ALLOWED_ATTRS = {
        'A': ['href', 'title', 'target', 'rel'],
        'CODE': ['class'],
        'PRE': ['class'],
        'SPAN': ['class'],
        'DIV': ['class'],
        'P': ['class'],
        'TABLE': ['class'],
        'TH': ['align'],
        'TD': ['align'],
        'IMG': ['src', 'alt', 'title', 'loading', 'width', 'height']
    };

    function isSafeUrl(url) {
        if (!url) return false;
        const u = url.trim().toLowerCase();
        return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('mailto:') || u.startsWith('#');
    }

    const DANGEROUS_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'SVG']);

    function sanitizeMarkdownHtml(dirtyHtml) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(dirtyHtml || '', 'text/html');
            const container = doc.body;

            const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, null);
            const toRemove = [];
            while (walker.nextNode()) toRemove.push(walker.currentNode);

            toRemove.forEach((el) => {
                if (!el.parentNode || el === container || el.tagName === 'BODY' || el.tagName === 'HTML' || el.tagName === 'HEAD') {
                    return;
                }
                const tag = el.tagName;
                if (!ALLOWED_TAGS.has(tag)) {
                    if (DANGEROUS_TAGS.has(tag)) {
                        el.remove();
                    } else if (el.childNodes.length > 0) {
                        el.replaceWith(...el.childNodes);
                    } else {
                        const text = document.createTextNode(el.textContent || '');
                        el.replaceWith(text);
                    }
                    return;
                }

                Array.from(el.attributes).forEach((attr) => {
                    const name = attr.name.toLowerCase();
                    if (name.startsWith('on')) {
                        el.removeAttribute(attr.name);
                        return;
                    }
                    const allowed = (ALLOWED_ATTRS[tag] || []);
                    if (!allowed.includes(name)) {
                        el.removeAttribute(attr.name);
                        return;
                    }
                    if ((name === 'href' || name === 'src') && !isSafeUrl(attr.value)) {
                        el.removeAttribute(attr.name);
                    }
                });

                if (tag === 'A') {
                    el.setAttribute('target', '_blank');
                    el.setAttribute('rel', 'noopener noreferrer');
                }
            });

            return container.innerHTML;
        } catch (e) {
            return escapeHtml(dirtyHtml);
        }
    }

    window.AppSanitize = { escapeHtml, sanitizeMarkdownHtml };
})();
