document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const gearBtn = document.getElementById('pomodoro-gear-btn');
    const configPanel = document.getElementById('pomodoro-config');
    const saveConfigBtn = document.getElementById('pomodoro-save-config-btn');
    
    const workInput = document.getElementById('pomodoro-work-input');
    const shortInput = document.getElementById('pomodoro-short-input');
    const longInput = document.getElementById('pomodoro-long-input');
    
    const timeDisplay = document.getElementById('pomodoro-time');
    const progressRing = document.getElementById('pomodoro-ring-progress');
    const modeLabel = document.getElementById('pomodoro-label');
    const modeIcon = document.getElementById('pomodoro-mode-icon');
    
    const startBtn = document.getElementById('pomodoro-start');
    const resetBtn = document.getElementById('pomodoro-reset');
    
    // Configurations & Initial state
    let workTime = parseInt(localStorage.getItem('pomodoro_work_time')) || 25;
    let shortBreakTime = parseInt(localStorage.getItem('pomodoro_short_time')) || 5;
    let longBreakTime = parseInt(localStorage.getItem('pomodoro_long_time')) || 15;
    
    // Set inputs value
    if (workInput) workInput.value = workTime;
    if (shortInput) shortInput.value = shortBreakTime;
    if (longInput) longInput.value = longBreakTime;
    
    let timeLeft = workTime * 60;
    let totalTime = workTime * 60;
    let timerInterval = null;
    let endTime = null;
    let isRunning = false;
    let currentMode = 'work'; // 'work', 'short', 'long'
    let sessionCount = 0; // numero sessioni completate (0-3)
    
    // r=62 → circonferenza = 2 * PI * 62 ≈ 389.6 ≈ 390
    const RING_CIRCUMFERENCE = 390;
    
    // ── Aggiorna puntini sessione ──────────────────────────
    function updateDots() {
        const dots = document.querySelectorAll('.pomodoro-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i < (sessionCount % 4) + (currentMode !== 'work' ? 1 : 0));
        });
    }

    // ── Aggiorna icona modalità – SVG minimalista ─────────
    const svgBook = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>`;
    const svgCup = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
        <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>`;
    const svgMoon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>`;

    function updateModeIcon() {
        if (!modeIcon) return;
        if (currentMode === 'work')       modeIcon.innerHTML = svgBook;
        else if (currentMode === 'short') modeIcon.innerHTML = svgCup;
        else                              modeIcon.innerHTML = svgMoon;
    }

    let sharedAudioCtx = null;
    function getAudioContext() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
            sharedAudioCtx = new AudioContextClass();
        }
        if (sharedAudioCtx.state === 'suspended') {
            sharedAudioCtx.resume().catch(() => {});
        }
        return sharedAudioCtx;
    }

    function playNotificationSound() {
        try {
            const audioCtx = getAudioContext();
            if (!audioCtx) return;
            
            const beeps = [0, 0.3];
            beeps.forEach((delay) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, audioCtx.currentTime + delay);
                
                gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
                gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + delay + 0.05);
                gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + delay + 0.25);
                
                osc.start(audioCtx.currentTime + delay);
                osc.stop(audioCtx.currentTime + delay + 0.25);
            });
        } catch (e) {
            console.error("Errore di riproduzione audio Pomodoro:", e);
        }
    }

    // Toggle configuration drawer
    if (gearBtn && configPanel) {
        gearBtn.addEventListener('click', () => {
            const isHidden = configPanel.style.display === 'none';
            configPanel.style.display = isHidden ? 'flex' : 'none';
        });
    }
    
    // Save configuration
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', () => {
            const newWork = Math.max(1, parseInt(workInput.value) || 25);
            const newShort = Math.max(1, parseInt(shortInput.value) || 5);
            const newLong = Math.max(1, parseInt(longInput.value) || 15);
            
            localStorage.setItem('pomodoro_work_time', newWork);
            localStorage.setItem('pomodoro_short_time', newShort);
            localStorage.setItem('pomodoro_long_time', newLong);
            
            workTime = newWork;
            shortBreakTime = newShort;
            longBreakTime = newLong;
            
            configPanel.style.display = 'none';
            
            // If timer isn't running, reset it to apply the new times immediately
            if (!isRunning) {
                resetTimer();
            }
        });
    }
    
    // Format minutes/seconds
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Update progress ring offset
    function updateProgressRing() {
        if (!progressRing) return;
        const progressFraction = totalTime > 0 ? (timeLeft / totalTime) : 0;
        const offset = RING_CIRCUMFERENCE * (1 - progressFraction);
        progressRing.style.strokeDashoffset = offset;
    }
    
    // Refresh display
    function updateDisplay() {
        if (timeDisplay) timeDisplay.textContent = formatTime(timeLeft);
        updateProgressRing();
    }

    // Apply mode classes to the ring
    function applyModeClass() {
        if (!progressRing) return;
        progressRing.classList.remove('mode-work', 'mode-short', 'mode-long');
        if (currentMode === 'work')       progressRing.classList.add('mode-work');
        else if (currentMode === 'short') progressRing.classList.add('mode-short');
        else                              progressRing.classList.add('mode-long');
    }
    
    // Reset timer
    function resetTimer() {
        clearInterval(timerInterval);
        isRunning = false;
        endTime = null;
        if (startBtn) startBtn.textContent = 'Play';
        
        if (currentMode === 'work') {
            timeLeft = workTime * 60;
            if (modeLabel) modeLabel.textContent = 'Focus';
        } else if (currentMode === 'short') {
            timeLeft = shortBreakTime * 60;
            if (modeLabel) modeLabel.textContent = 'Short Break';
        } else {
            timeLeft = longBreakTime * 60;
            if (modeLabel) modeLabel.textContent = 'Long Break';
        }
        
        applyModeClass();
        updateModeIcon();
        updateDots();
        
        totalTime = timeLeft;
        updateDisplay();
    }
    
    // Switch to next mode automatically
    function handleSessionEnd() {
        playNotificationSound();
        
        if (currentMode === 'work') {
            sessionCount++;
            if (sessionCount % 4 === 0) {
                currentMode = 'long';
            } else {
                currentMode = 'short';
            }
        } else {
            currentMode = 'work';
        }
        
        resetTimer();
    }
    
    // Core tick function using system clock comparison
    function tick() {
        if (!isRunning || !endTime) return;
        
        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        timeLeft = remaining;
        updateDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            isRunning = false;
            endTime = null;
            handleSessionEnd();
        }
    }

    // Toggle start/pause
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (isRunning) {
                // Pause
                clearInterval(timerInterval);
                isRunning = false;
                endTime = null;
                startBtn.textContent = 'Play';
            } else {
                // Start
                getAudioContext();
                isRunning = true;
                startBtn.textContent = 'Pausa';
                endTime = Date.now() + (timeLeft * 1000);
                
                tick();
                timerInterval = setInterval(tick, 200);
            }
        });
    }
    
    // Reset button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            // If they click reset, it resets the current session, but if clicked twice or on break, it switches back to work mode
            if (timeLeft === totalTime && currentMode !== 'work') {
                currentMode = 'work';
            }
            resetTimer();
        });
    }
    
    // Recalculate time instantly when coming back from background tab/other apps
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isRunning && endTime) {
            tick();
        }
    });
    
    window.addEventListener('focus', () => {
        if (isRunning && endTime) {
            tick();
        }
    });
    
    // Initial paint
    resetTimer();
});
