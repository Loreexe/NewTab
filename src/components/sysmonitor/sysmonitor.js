document.addEventListener('DOMContentLoaded', () => {
    const gearBtn = document.getElementById('sysmonitor-gear-btn');
    const configPanel = document.getElementById('sysmonitor-config');
    const saveConfigBtn = document.getElementById('sysmonitor-save-config-btn');
    const metricsContainer = document.getElementById('sysmonitor-metrics');

    // Config checkboxes
    const showCpuCb = document.getElementById('sys-show-cpu');
    const showRamCb = document.getElementById('sys-show-ram');
    const showBatteryCb = document.getElementById('sys-show-battery');

    // Load configurations (default: CPU, RAM, Battery are true)
    let config = {
        cpu: localStorage.getItem('sys_show_cpu') !== 'false',
        ram: localStorage.getItem('sys_show_ram') !== 'false',
        battery: localStorage.getItem('sys_show_battery') !== 'false'
    };

    // Set checkboxes initial state
    if (showCpuCb) showCpuCb.checked = config.cpu;
    if (showRamCb) showRamCb.checked = config.ram;
    if (showBatteryCb) showBatteryCb.checked = config.battery;

    // Toggle settings panel
    if (gearBtn && configPanel) {
        gearBtn.addEventListener('click', () => {
            const isHidden = configPanel.style.display === 'none';
            configPanel.style.display = isHidden ? 'block' : 'none';
        });
    }

    // Save configuration
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', () => {
            config.cpu = showCpuCb ? showCpuCb.checked : true;
            config.ram = showRamCb ? showRamCb.checked : true;
            config.battery = showBatteryCb ? showBatteryCb.checked : true;

            localStorage.setItem('sys_show_cpu', config.cpu);
            localStorage.setItem('sys_show_ram', config.ram);
            localStorage.setItem('sys_show_battery', config.battery);

            configPanel.style.display = 'none';
            buildMetricsUI();
            updateMetrics();
        });
    }

    // CPU calculations snapshot
    let lastCpuInfo = null;

    // Simulated values for fallback
    let simulatedCpu = 22;
    let simulatedRamPercent = 45;

    const RING_CIRCUMFERENCE = 151; // 2 * PI * 24

    // Build circular gauges layout
    function buildMetricsUI() {
        if (!metricsContainer) return;
        metricsContainer.innerHTML = '';

        const activeMetrics = Object.keys(config).filter(key => config[key]);

        if (activeMetrics.length === 0) {
            metricsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; padding: 12px;">
                    Nessun indicatore selezionato. Clicca su ⚙️ per configurare.
                </div>
            `;
            return;
        }

        // Adjust grid layout depending on the number of active metrics
        // If there are 3 metrics, let's keep grid or adapt styling.
        // The grid has grid-template-columns: repeat(2, 1fr) in CSS, which is fine!
        activeMetrics.forEach(metric => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'metric-circle-item';
            itemDiv.id = `metric-item-${metric}`;

            let icon = '';
            let name = 'Indicatore';

            switch (metric) {
                case 'cpu':
                    icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="15" x2="23" y2="15"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="15" x2="4" y2="15"></line></svg>`;
                    name = 'CPU';
                    break;
                case 'ram':
                    icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="9" width="20" height="6" rx="1"></rect><path d="M5 15v2M9 15v2M13 15v2M17 15v2M21 15v2M3 15v2"></path><rect x="4" y="11" width="3" height="3" rx="0.5"></rect><rect x="8" y="11" width="3" height="3" rx="0.5"></rect><rect x="12" y="11" width="3" height="3" rx="0.5"></rect><rect x="16" y="11" width="3" height="3" rx="0.5"></rect></svg>`;
                    name = 'RAM';
                    break;
                case 'battery':
                    icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="18" height="12" rx="2" ry="2"></rect><line x1="23" y1="11" x2="23" y2="13"></line></svg>`;
                    name = 'Batt';
                    break;
            }

            itemDiv.innerHTML = `
                <div class="metric-circle-gauge">
                    <svg class="metric-circle-ring" viewBox="0 0 60 60">
                        <circle class="ring-bg" cx="30" cy="30" r="24"></circle>
                        <circle id="metric-ring-${metric}" class="ring-progress" cx="30" cy="30" r="24"></circle>
                    </svg>
                    <div class="metric-circle-icon">${icon}</div>
                </div>
                <div class="metric-circle-name">${name}</div>
                <div class="metric-circle-val" id="metric-val-${metric}">...</div>
            `;

            metricsContainer.appendChild(itemDiv);
        });
    }

    // Update circular progress and color accents
    function setProgress(metric, percentage, text) {
        const ring = document.getElementById(`metric-ring-${metric}`);
        const valText = document.getElementById(`metric-val-${metric}`);

        if (valText) valText.textContent = text;
        if (ring) {
            const offset = RING_CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, percentage)) / 100);
            ring.style.strokeDashoffset = offset;
            
            // Adjust color accents
            ring.classList.remove('warning', 'critical');
            if (metric === 'battery') {
                if (percentage <= 15) {
                    ring.classList.add('critical');
                } else if (percentage <= 30) {
                    ring.classList.add('warning');
                }
            } else {
                if (percentage >= 85) {
                    ring.classList.add('critical');
                } else if (percentage >= 70) {
                    ring.classList.add('warning');
                }
            }
        }
    }

    // Refresh monitoring stats
    let cachedBattery = null;
    let batteryInitialized = false;

    function updateBatteryDisplay(b) {
        if (!config.battery) return;
        if (!b) {
            setProgress('battery', 0, 'N/D');
            return;
        }
        const rawLevel = b.level;
        if (typeof rawLevel !== 'number' || isNaN(rawLevel)) {
            setProgress('battery', 0, 'N/D');
            return;
        }
        const percent = Math.max(0, Math.min(100, Math.round(rawLevel * 100)));
        const isCharging = Boolean(b.charging);
        const statusText = isCharging ? `⚡${percent}%` : `${percent}%`;
        setProgress('battery', percent, statusText);
    }

    function initBattery() {
        if (batteryInitialized) return;
        if (!navigator.getBattery) {
            setProgress('battery', 0, 'N/D');
            return;
        }
        batteryInitialized = true;
        navigator.getBattery().then((b) => {
            cachedBattery = b;
            b.addEventListener('levelchange', () => updateBatteryDisplay(b));
            b.addEventListener('chargingchange', () => updateBatteryDisplay(b));
            updateBatteryDisplay(b);
        }).catch((err) => {
            console.warn('[SysMonitor] Battery API error:', err);
            cachedBattery = null;
            setProgress('battery', 0, 'N/D');
        });
    }

    function updateMetrics() {
        if (document.hidden) return;
        // 1. CPU
        if (config.cpu) {
            if (typeof chrome !== 'undefined' && chrome.system && chrome.system.cpu) {
                try {
                    chrome.system.cpu.getInfo((info) => {
                        // If extension context was invalidated, lastError will be set
                        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                            console.warn('SysMonitor CPU: contesto estensione non valido, polling interrotto.');
                            clearInterval(metricsInterval);
                            return;
                        }
                        if (!info || !info.processors) return;
                        if (!lastCpuInfo) {
                            lastCpuInfo = info;
                            setProgress('cpu', 0, '...');
                            return;
                        }

                        let activeDiff = 0;
                        let totalDiff = 0;

                        for (let i = 0; i < info.processors.length; i++) {
                            const currentUsage = info.processors[i].usage;
                            const lastUsage = lastCpuInfo.processors[i].usage;

                            const currentActive = currentUsage.user + currentUsage.kernel;
                            const lastActive = lastUsage.user + lastUsage.kernel;

                            activeDiff += (currentActive - lastActive);
                            totalDiff += (currentUsage.total - lastUsage.total);
                        }

                        lastCpuInfo = info;
                        const percent = totalDiff === 0 ? 0 : Math.round((activeDiff / totalDiff) * 100);
                        setProgress('cpu', percent, `${percent}%`);
                    });
                } catch (e) {
                    if (e.message && e.message.includes('Extension context invalidated')) {
                        clearInterval(metricsInterval);
                    }
                }
            } else {
                simulatedCpu += (Math.random() - 0.5) * 8;
                simulatedCpu = Math.max(5, Math.min(95, Math.round(simulatedCpu)));
                setProgress('cpu', simulatedCpu, `${simulatedCpu}%`);
            }
        }

        // 2. RAM
        if (config.ram) {
            if (typeof chrome !== 'undefined' && chrome.system && chrome.system.memory) {
                try {
                    chrome.system.memory.getInfo((info) => {
                        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                            console.warn('SysMonitor RAM: contesto estensione non valido, polling interrotto.');
                            clearInterval(metricsInterval);
                            return;
                        }
                        if (!info) return;
                        const total = info.capacity;
                        const available = info.availableCapacity;
                        const used = total - available;
                        const percent = Math.round((used / total) * 100);
                        const usedGB = (used / (1024*1024*1024)).toFixed(1);
                        setProgress('ram', percent, `${percent}% (${usedGB}G)`);
                    });
                } catch (e) {
                    if (e.message && e.message.includes('Extension context invalidated')) {
                        clearInterval(metricsInterval);
                    }
                }
            } else {
                simulatedRamPercent += (Math.random() - 0.5) * 0.8;
                simulatedRamPercent = Math.max(30, Math.min(85, parseFloat(simulatedRamPercent.toFixed(1))));
                const used = (16 * (simulatedRamPercent / 100)).toFixed(1);
                setProgress('ram', Math.round(simulatedRamPercent), `${Math.round(simulatedRamPercent)}% (${used}G)`);
            }
        }

        // 3. Battery
        if (config.battery) {
            if (cachedBattery) {
                updateBatteryDisplay(cachedBattery);
            } else {
                initBattery();
            }
        }
    }

    // Build the grid and initialize
    buildMetricsUI();
    initBattery();
    updateMetrics();

    // Poll ogni 2s (500ms era eccessivo e intasava chrome.system.* + battery)
    const metricsInterval = setInterval(updateMetrics, 2000);

    // Detect extension context invalidation and stop polling cleanly
    window.addEventListener('unload', () => clearInterval(metricsInterval));
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateMetrics();
    });
});
