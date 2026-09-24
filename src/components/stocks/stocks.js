document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const addBtn = document.getElementById('stocks-add-btn');
    const formPanel = document.getElementById('stocks-form');
    const symbolInput = document.getElementById('stocks-symbol-input');
    const cancelFormBtn = document.getElementById('stocks-cancel-form');
    const saveFormBtn = document.getElementById('stocks-save-form');
    const listContainer = document.getElementById('stocks-list');

    // Default assets: BTC, ETH, AAPL, TSLA
    let assets = JSON.parse(localStorage.getItem('stocks_assets')) || [
        { symbol: 'BTC', name: 'Bitcoin', type: 'crypto', apiId: 'bitcoin' },
        { symbol: 'ETH', name: 'Ethereum', type: 'crypto', apiId: 'ethereum' },
        { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', yahooSymbol: 'AAPL' },
        { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', yahooSymbol: 'TSLA' }
    ];

    // Toggle add form
    if (addBtn && formPanel) {
        addBtn.addEventListener('click', () => {
            const isHidden = formPanel.style.display === 'none';
            formPanel.style.display = isHidden ? 'flex' : 'none';
            if (isHidden && symbolInput) {
                symbolInput.value = '';
                symbolInput.focus();
            }
        });
    }

    // Cancel adding
    if (cancelFormBtn && formPanel) {
        cancelFormBtn.addEventListener('click', () => {
            formPanel.style.display = 'none';
        });
    }

    // Save asset
    if (saveFormBtn && formPanel) {
        saveFormBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const rawSymbol = symbolInput.value.trim().toUpperCase();
            if (!rawSymbol) return;

            // Check duplicate
            if (assets.some(a => a.symbol === rawSymbol)) {
                alert('Questo simbolo è già presente!');
                return;
            }

            // Simple heuristics to check if it's crypto (e.g. BTC, ETH, SOL, DOGE, ADA)
            const cryptoMap = {
                'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana',
                'DOGE': 'dogecoin', 'ADA': 'cardano', 'XRP': 'ripple',
                'DOT': 'polkadot', 'LINK': 'chainlink', 'LTC': 'litecoin'
            };

            let newAsset = {};
            if (cryptoMap[rawSymbol]) {
                newAsset = {
                    symbol: rawSymbol,
                    name: rawSymbol === 'BTC' ? 'Bitcoin' : rawSymbol === 'ETH' ? 'Ethereum' : rawSymbol,
                    type: 'crypto',
                    apiId: cryptoMap[rawSymbol]
                };
                
                assets.push(newAsset);
                localStorage.setItem('stocks_assets', JSON.stringify(assets));
                formPanel.style.display = 'none';
                fetchAndRenderPrices();
            } else {
                // Stock validation via Yahoo Finance v8 chart API
                const originalBtnText = saveFormBtn.textContent;
                saveFormBtn.textContent = 'Verifica...';
                saveFormBtn.disabled = true;
                if (cancelFormBtn) cancelFormBtn.disabled = true;
                if (symbolInput) symbolInput.disabled = true;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                try {
                    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${rawSymbol}?interval=1d&range=1d`, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.chart && data.chart.result && data.chart.result[0]) {
                            const meta = data.chart.result[0].meta;
                            newAsset = {
                                symbol: rawSymbol,
                                name: meta.longName || meta.shortName || rawSymbol,
                                type: 'stock',
                                yahooSymbol: rawSymbol
                            };
                            assets.push(newAsset);
                            localStorage.setItem('stocks_assets', JSON.stringify(assets));
                            formPanel.style.display = 'none';
                            fetchAndRenderPrices();
                        } else {
                            alert(`Il simbolo "${rawSymbol}" non è stato trovato su Yahoo Finance.`);
                        }
                    } else {
                        alert(`Il simbolo "${rawSymbol}" non è stato trovato su Yahoo Finance.`);
                    }
                } catch (err) {
                    console.error('Errore durante la validazione del simbolo:', err);
                    alert(`Impossibile verificare il simbolo "${rawSymbol}" a causa di un errore di rete o CORS.`);
                } finally {
                    saveFormBtn.textContent = originalBtnText;
                    saveFormBtn.disabled = false;
                    if (cancelFormBtn) cancelFormBtn.disabled = false;
                    if (symbolInput) symbolInput.disabled = false;
                }
            }
        });
    }

    // Helper: generate SVG path from real close prices when available,
    // otherwise deterministic trend (no random fake data).
    function generateSparkline(changePercent, closes) {
        const width = 50;
        const height = 20;
        if (Array.isArray(closes) && closes.length >= 2) {
            const min = Math.min(...closes);
            const max = Math.max(...closes);
            const range = (max - min) || 1;
            const stepX = width / (closes.length - 1);
            let d = '';
            closes.forEach((c, i) => {
                const y = height - 2 - ((c - min) / range) * (height - 4);
                d += (i === 0 ? `M 0,${y.toFixed(1)}` : ` L ${(i * stepX).toFixed(1)},${y.toFixed(1)}`);
            });
            return `<path d="${d}" class="sparkline-path" />`;
        }
        // Deterministic fallback: straight trend line, clearly illustrative
        const y2 = changePercent >= 0 ? 4 : height - 4;
        return `<path d="M 0,${height / 2} L ${width},${y2}" class="sparkline-path" opacity="0.5" />`;
    }

    // Fetch live prices and render (with 5-min cache to survive 429/CORS)
    async function fetchAndRenderPrices() {
        if (!listContainer || document.hidden) return;
        
        // Show loading state initially if empty
        if (listContainer.children.length === 0) {
            listContainer.textContent = "";
            const loading = document.createElement('div');
            loading.style.cssText = "font-size:11px;color:rgba(255,255,255,0.4);text-align:center;padding:12px;";
            loading.textContent = "Aggiornamento prezzi...";
            listContainer.appendChild(loading);
        }

        let prices = {};
        let cache = null;
        try {
            cache = JSON.parse(localStorage.getItem('stocks_cache') || 'null');
        } catch (e) { cache = null; }
        const cacheValid = cache && (Date.now() - cache.ts < 5 * 60 * 1000) && cache.prices;

        // 1. Fetch Crypto prices via CoinGecko API (open CORS)
        const cryptoAssets = assets.filter(a => a.type === 'crypto');
        if (cryptoAssets.length > 0) {
            const ids = cryptoAssets.map(a => a.apiId).join(',');
            try {
                const controller = new AbortController();
                const t = setTimeout(() => controller.abort(), 12000);
                const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`, { signal: controller.signal });
                clearTimeout(t);
                if (response.ok) {
                    const data = await response.json();
                    cryptoAssets.forEach(a => {
                        if (data[a.apiId]) {
                            prices[a.symbol] = {
                                price: data[a.apiId].usd,
                                change: data[a.apiId].usd_24h_change || 0
                            };
                        }
                    });
                } else if (response.status === 429 && cacheValid) {
                    console.warn('CoinGecko 429, uso cache');
                }
            } catch (err) {
                console.warn('Errore fetch CoinGecko:', err.message);
            }
        }

        // 2. Fetch Stocks prices via Yahoo Finance API v8 Chart endpoint (individual fetches using Promise.all)
        const stockAssets = assets.filter(a => a.type === 'stock');
        if (stockAssets.length > 0) {
            try {
                await Promise.all(stockAssets.map(async (asset) => {
                    try {
                        const controller = new AbortController();
                        const t = setTimeout(() => controller.abort(), 12000);
                        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.yahooSymbol)}?interval=1h&range=5d`, { signal: controller.signal });
                        clearTimeout(t);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.chart && data.chart.result && data.chart.result[0]) {
                                const meta = data.chart.result[0].meta;
                                const price = meta.regularMarketPrice;
                                const prevClose = meta.chartPreviousClose;
                                const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
                                let closes = null;
                                try {
                                    const q = data.chart.result[0].indicators?.quote?.[0]?.close;
                                    if (Array.isArray(q)) closes = q.filter(v => typeof v === 'number').slice(-30);
                                } catch (e) { closes = null; }
                                prices[asset.symbol] = {
                                    price: price,
                                    change: change,
                                    closes: closes,
                                    name: meta.longName || meta.shortName || asset.name
                                };
                            }
                        }
                    } catch (err) {
                        console.warn(`Errore fetch per ${asset.symbol}:`, err.message);
                    }
                }));
            } catch (err) {
                console.error('Errore globale fetch stock:', err);
            }
        }

        // Merge cache for missing symbols (no fake data: N/D if still missing)
        if (cacheValid) {
            Object.keys(cache.prices).forEach(sym => {
                if (!prices[sym] && assets.some(a => a.symbol === sym)) {
                    prices[sym] = cache.prices[sym];
                    prices[sym]._cached = true;
                }
            });
        }
        // Save fresh prices to cache (strip _cached flag)
        try {
            const toCache = {};
            Object.keys(prices).forEach(k => {
                const { _cached, ...rest } = prices[k];
                if (rest.price) toCache[k] = rest;
            });
            if (Object.keys(toCache).length > 0) {
                localStorage.setItem('stocks_cache', JSON.stringify({ ts: Date.now(), prices: toCache }));
            }
        } catch (e) { /* quota ignore */ }

        // Render assets list
        listContainer.textContent = '';
        if (assets.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = "font-size:11px;color:rgba(255,255,255,0.4);text-align:center;padding:12px;";
            empty.textContent = "Nessun titolo attivo. Clicca su + per aggiungerne.";
            listContainer.appendChild(empty);
            return;
        }

        function esc(s) {
            return window.AppSanitize ? window.AppSanitize.escapeHtml(s) : String(s);
        }

        assets.forEach(asset => {
            let data = prices[asset.symbol];

            // Override name if resolved by API
            if (data && data.name) asset.name = data.name;

            const isNegative = data ? data.change < 0 : false;
            let priceFormatted = 'N/D';
            let changeFormatted = data && data._cached ? 'cache' : 'N/D';
            let sparklineHtml = '';

            if (data) {
                priceFormatted = (data._cached ? '~' : '') + (data.price >= 1000
                    ? '$' + Math.round(data.price).toLocaleString('it-IT')
                    : '$' + data.price.toFixed(2));
                if (!data._cached) {
                    changeFormatted = (data.change >= 0 ? '+' : '') + data.change.toFixed(2) + '%';
                } else {
                    changeFormatted = (data.change >= 0 ? '+' : '') + data.change.toFixed(2) + '% (cache)';
                }
                sparklineHtml = generateSparkline(data.change, data.closes);
            } else {
                sparklineHtml = `<line x1="0" y1="10" x2="50" y2="10" stroke="rgba(255,255,255,0.2)" stroke-dasharray="2,2" />`;
            }

            const itemDiv = document.createElement('div');
            itemDiv.className = `stock-item ${isNegative ? 'negative' : ''}`;

            const left = document.createElement('div');
            left.className = 'stock-left';
            const sym = document.createElement('span');
            sym.className = 'stock-sym';
            sym.textContent = asset.symbol;
            const nm = document.createElement('span');
            nm.className = 'stock-name';
            nm.title = asset.name;
            nm.textContent = asset.name;
            left.appendChild(sym);
            left.appendChild(nm);

            const chartWrap = document.createElement('div');
            chartWrap.innerHTML = `<svg class="stock-chart" viewBox="0 0 50 20">${sparklineHtml}</svg>`;

            const right = document.createElement('div');
            right.className = 'stock-right';
            const pr = document.createElement('span');
            pr.className = 'stock-price';
            pr.textContent = priceFormatted;
            const ch = document.createElement('span');
            ch.className = 'stock-change';
            ch.textContent = changeFormatted;
            right.appendChild(pr);
            right.appendChild(ch);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'stock-delete-btn';
            deleteBtn.title = 'Rimuovi';
            deleteBtn.textContent = '✕';

            itemDiv.appendChild(left);
            itemDiv.appendChild(chartWrap.firstChild);
            itemDiv.appendChild(right);
            itemDiv.appendChild(deleteBtn);

            // Aggiungi click listener in modo programmatico per conformità con MV3 CSP
            deleteBtn.addEventListener('click', () => {
                if (confirm(`Rimuovere ${asset.symbol} dalla lista?`)) {
                    assets = assets.filter(a => a.symbol !== asset.symbol);
                    localStorage.setItem('stocks_assets', JSON.stringify(assets));
                    fetchAndRenderPrices();
                }
            });

            listContainer.appendChild(itemDiv);
        });
    }

    // Refresh prices every 60 seconds (30s hammerava i rate-limit gratuiti)
    fetchAndRenderPrices();
    setInterval(fetchAndRenderPrices, 60000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) fetchAndRenderPrices();
    });
});
