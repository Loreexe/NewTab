/**
 * Chrome Dino Runner Game Component - Custom Designed for Newtab Extension
 * Visuals: Sleek Dark Neon / Glassmorphism with Spotify Green (#1DB954) accents.
 */

window.DinoGame = (function () {
    let canvas, ctx;
    let container;
    let animationReqId = null;
    let isRunning = false;
    let isGameOver = false;
    let isPaused = false;
    let hasStarted = false;

    // Game Speed & Physics
    let speed = 4.8;
    const INITIAL_SPEED = 4.8;
    const MAX_SPEED = 10.5;
    const SPEED_ACCEL = 0.001;
    let frameCount = 0;
    let score = 0;
    let highScore = 0;
    let distance = 0;

    // Polyfill for Canvas roundRect if missing
    if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
            let r = typeof radii === 'number' ? radii : 4;
            if (w < 2 * r) r = w / 2;
            if (h < 2 * r) r = h / 2;
            this.beginPath();
            this.moveTo(x + r, y);
            this.arcTo(x + w, y, x + w, y + h, r);
            this.arcTo(x + w, y + h, x, y + h, r);
            this.arcTo(x, y + h, x, y, r);
            this.arcTo(x, y, x + w, y, r);
            this.closePath();
            return this;
        };
    }

    // Canvas Virtual Coordinates
    const VIRTUAL_WIDTH = 600;
    const VIRTUAL_HEIGHT = 200;
    const GROUND_Y = 160;

    // Audio Context (Web Audio API Synthesizer)
    let audioCtx = null;

    function playSound(type) {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            const now = audioCtx.currentTime;

            if (type === 'jump') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(160, now);
                osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'score') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(587.33, now); // D5
                osc.frequency.setValueAtTime(880, now + 0.08); // A5
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            } else if (type === 'hit') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(70, now + 0.25);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            }
        } catch (e) {
            // Audio not supported or blocked
        }
    }

    // Game Entities
    const dino = {
        x: 40,
        y: GROUND_Y - 44,
        normalWidth: 40,
        normalHeight: 44,
        duckWidth: 52,
        duckHeight: 26,
        width: 40,
        height: 44,
        vy: 0,
        gravity: 0.65,
        jumpForce: -11.5,
        isJumping: false,
        isDucking: false,
        legFrame: 0,

        reset() {
            this.x = 40;
            this.width = this.normalWidth;
            this.height = this.normalHeight;
            this.y = GROUND_Y - this.height;
            this.vy = 0;
            this.isJumping = false;
            this.isDucking = false;
            this.legFrame = 0;
        },

        jump() {
            if (!this.isJumping && !this.isDucking) {
                this.vy = this.jumpForce;
                this.isJumping = true;
                playSound('jump');
            }
        },

        setDuck(ducking) {
            if (this.isJumping) return;
            if (ducking && !this.isDucking) {
                this.isDucking = true;
                this.width = this.duckWidth;
                this.height = this.duckHeight;
                this.y = GROUND_Y - this.height;
            } else if (!ducking && this.isDucking) {
                this.isDucking = false;
                this.width = this.normalWidth;
                this.height = this.normalHeight;
                this.y = GROUND_Y - this.height;
            }
        },

        update() {
            // Physics
            if (this.isJumping) {
                this.vy += this.gravity;
                this.y += this.vy;

                if (this.y >= GROUND_Y - this.height) {
                    this.y = GROUND_Y - this.height;
                    this.vy = 0;
                    this.isJumping = false;
                }
            } else if (this.isDucking) {
                this.y = GROUND_Y - this.duckHeight;
            } else {
                this.y = GROUND_Y - this.normalHeight;
            }

            // Animate legs
            if (frameCount % 6 === 0) {
                this.legFrame = (this.legFrame + 1) % 2;
            }
        },

        draw(ctx) {
            ctx.save();
            ctx.fillStyle = '#1DB954';
            ctx.shadowColor = 'rgba(29, 185, 84, 0.4)';
            ctx.shadowBlur = 8;

            if (this.isDucking) {
                // Ducking Dino Vector
                const x = this.x;
                const y = this.y;

                // Main body
                ctx.beginPath();
                ctx.roundRect(x, y + 8, 48, 16, 4);
                ctx.fill();

                // Head extended forward
                ctx.beginPath();
                ctx.roundRect(x + 36, y + 2, 16, 12, 3);
                ctx.fill();

                // Eye
                ctx.fillStyle = '#121212';
                ctx.beginPath();
                ctx.arc(x + 46, y + 5, 1.8, 0, Math.PI * 2);
                ctx.fill();

                // Tail
                ctx.fillStyle = '#1DB954';
                ctx.beginPath();
                ctx.moveTo(x, y + 10);
                ctx.lineTo(x - 8, y + 14);
                ctx.lineTo(x, y + 18);
                ctx.fill();

                // Running Legs
                ctx.strokeStyle = '#1DB954';
                ctx.lineWidth = 3;
                ctx.beginPath();
                if (this.isJumping) {
                    ctx.moveTo(x + 14, y + 22); ctx.lineTo(x + 10, y + 26);
                    ctx.moveTo(x + 32, y + 22); ctx.lineTo(x + 28, y + 26);
                } else if (this.legFrame === 0) {
                    ctx.moveTo(x + 14, y + 22); ctx.lineTo(x + 8, y + 26);
                    ctx.moveTo(x + 32, y + 22); ctx.lineTo(x + 36, y + 26);
                } else {
                    ctx.moveTo(x + 14, y + 22); ctx.lineTo(x + 18, y + 26);
                    ctx.moveTo(x + 32, y + 22); ctx.lineTo(x + 26, y + 26);
                }
                ctx.stroke();

            } else {
                // Standing / Running Dino Vector
                const x = this.x;
                const y = this.y;

                // Head & Snout
                ctx.beginPath();
                ctx.roundRect(x + 16, y, 22, 18, 4);
                ctx.fill();

                // Eye
                ctx.fillStyle = '#121212';
                ctx.beginPath();
                ctx.arc(x + 31, y + 5, 2, 0, Math.PI * 2);
                ctx.fill();

                // Mouth line
                ctx.strokeStyle = '#121212';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x + 38, y + 11);
                ctx.lineTo(x + 28, y + 11);
                ctx.stroke();

                // Body
                ctx.fillStyle = '#1DB954';
                ctx.beginPath();
                ctx.roundRect(x + 6, y + 14, 26, 22, 5);
                ctx.fill();

                // Tiny Arm
                ctx.beginPath();
                ctx.roundRect(x + 24, y + 20, 7, 4, 1.5);
                ctx.fill();

                // Tail
                ctx.beginPath();
                ctx.moveTo(x + 8, y + 18);
                ctx.lineTo(x - 10, y + 22);
                ctx.lineTo(x + 8, y + 28);
                ctx.fill();

                // Running Legs
                ctx.strokeStyle = '#1DB954';
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                if (this.isJumping) {
                    // Both legs bent slightly
                    ctx.moveTo(x + 12, y + 34); ctx.lineTo(x + 6, y + 42);
                    ctx.moveTo(x + 22, y + 34); ctx.lineTo(x + 28, y + 42);
                } else if (this.legFrame === 0) {
                    // Left leg forward, right back
                    ctx.moveTo(x + 12, y + 34); ctx.lineTo(x + 6, y + 44);
                    ctx.moveTo(x + 22, y + 34); ctx.lineTo(x + 28, y + 44);
                } else {
                    // Left leg back, right forward
                    ctx.moveTo(x + 12, y + 34); ctx.lineTo(x + 18, y + 44);
                    ctx.moveTo(x + 22, y + 34); ctx.lineTo(x + 16, y + 44);
                }
                ctx.stroke();
            }

            ctx.restore();
        }
    };

    // Obstacles Array & Factory
    let obstacles = [];
    let nextSpawnDistance = 0;

    class Cactus {
        constructor(x, type) {
            this.x = x;
            this.type = type; // 0: single small, 1: double small, 2: tall
            this.isBird = false;

            if (type === 0) {
                this.width = 18;
                this.height = 36;
            } else if (type === 1) {
                this.width = 34;
                this.height = 36;
            } else {
                this.width = 24;
                this.height = 48;
            }

            this.y = GROUND_Y - this.height;
        }

        update() {
            this.x -= speed;
        }

        draw(ctx) {
            ctx.save();
            ctx.fillStyle = '#1DB954';
            ctx.shadowColor = 'rgba(29, 185, 84, 0.3)';
            ctx.shadowBlur = 6;

            if (this.type === 0) {
                this.drawSingleCactus(ctx, this.x, this.y, this.height);
            } else if (this.type === 1) {
                this.drawSingleCactus(ctx, this.x, this.y, this.height);
                this.drawSingleCactus(ctx, this.x + 16, this.y + 4, this.height - 4);
            } else {
                this.drawSingleCactus(ctx, this.x, this.y, this.height);
            }

            ctx.restore();
        }

        drawSingleCactus(ctx, x, y, h) {
            // Main stem
            ctx.beginPath();
            ctx.roundRect(x + 5, y, 8, h, 3);
            ctx.fill();

            // Left arm
            ctx.beginPath();
            ctx.roundRect(x, y + h * 0.3, 7, 4, 1.5);
            ctx.roundRect(x, y + h * 0.15, 4, h * 0.2, 1.5);
            ctx.fill();

            // Right arm
            ctx.beginPath();
            ctx.roundRect(x + 11, y + h * 0.4, 7, 4, 1.5);
            ctx.roundRect(x + 14, y + h * 0.25, 4, h * 0.2, 1.5);
            ctx.fill();
        }
    }

    class Pterodactyl {
        constructor(x, heightType) {
            this.x = x;
            this.isBird = true;
            this.width = 38;
            this.height = 28;

            // Height types: 0: Low (requires ducking), 1: Mid (requires jump), 2: High (pass under)
            if (heightType === 0) {
                this.y = GROUND_Y - 32;
            } else if (heightType === 1) {
                this.y = GROUND_Y - 58;
            } else {
                this.y = GROUND_Y - 88;
            }

            this.wingFrame = 0;
        }

        update() {
            this.x -= speed * 1.1; // Slightly faster than ground objects
            if (frameCount % 10 === 0) {
                this.wingFrame = (this.wingFrame + 1) % 2;
            }
        }

        draw(ctx) {
            ctx.save();
            ctx.fillStyle = '#A77DFF'; // Stylized cyan/purple accent for Pterodactyl
            ctx.shadowColor = 'rgba(167, 125, 255, 0.4)';
            ctx.shadowBlur = 8;

            const x = this.x;
            const y = this.y;

            // Body
            ctx.beginPath();
            ctx.ellipse(x + 20, y + 14, 14, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head & Beak
            ctx.beginPath();
            ctx.moveTo(x + 8, y + 14);
            ctx.lineTo(x - 4, y + 12);
            ctx.lineTo(x + 8, y + 17);
            ctx.fill();

            // Tail
            ctx.beginPath();
            ctx.moveTo(x + 32, y + 14);
            ctx.lineTo(x + 38, y + 10);
            ctx.lineTo(x + 34, y + 16);
            ctx.fill();

            // Wings flapping
            ctx.beginPath();
            if (this.wingFrame === 0) {
                // Wings Up
                ctx.moveTo(x + 18, y + 12);
                ctx.lineTo(x + 12, y - 6);
                ctx.lineTo(x + 24, y + 10);
            } else {
                // Wings Down
                ctx.moveTo(x + 18, y + 14);
                ctx.lineTo(x + 14, y + 28);
                ctx.lineTo(x + 24, y + 16);
            }
            ctx.fill();

            ctx.restore();
        }
    }

    // Ground & Background Stars
    let groundOffset = 0;
    const stars = [];
    for (let i = 0; i < 20; i++) {
        stars.push({
            x: Math.random() * VIRTUAL_WIDTH,
            y: Math.random() * (GROUND_Y - 40),
            size: Math.random() * 1.5 + 0.5,
            alpha: Math.random() * 0.7 + 0.3
        });
    }

    function spawnObstacle() {
        if (distance < nextSpawnDistance) return;

        const minGap = Math.max(160, 280 - speed * 10);
        const maxGap = minGap + 180;
        nextSpawnDistance = distance + minGap + Math.random() * (maxGap - minGap);

        // Decide type: Pterodactyl appears after score > 200
        const allowBirds = score > 200;
        const rand = Math.random();

        if (allowBirds && rand > 0.65) {
            const hType = Math.floor(Math.random() * 3);
            obstacles.push(new Pterodactyl(VIRTUAL_WIDTH + 20, hType));
        } else {
            const cType = Math.floor(Math.random() * 3);
            obstacles.push(new Cactus(VIRTUAL_WIDTH + 20, cType));
        }
    }

    // Collision Detection (Bounding Box with padded inset for forgiveness)
    function checkCollision(dino, obstacle) {
        const paddingX = 6;
        const paddingY = 4;

        const dLeft = dino.x + paddingX;
        const dRight = dino.x + dino.width - paddingX;
        const dTop = dino.y + paddingY;
        const dBottom = dino.y + dino.height - paddingY;

        const oLeft = obstacle.x + paddingX;
        const oRight = obstacle.x + obstacle.width - paddingX;
        const oTop = obstacle.y + paddingY;
        const oBottom = obstacle.y + obstacle.height - paddingY;

        return !(dRight < oLeft || dLeft > oRight || dBottom < oTop || dTop > oBottom);
    }

    // Render Function
    function render() {
        ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

        // 1. Background Stars
        ctx.save();
        stars.forEach(star => {
            ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();

        // 2. Ground Track Line
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y);
        ctx.lineTo(VIRTUAL_WIDTH, GROUND_Y);
        ctx.stroke();

        // Moving Ground Bumps/Dots
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        for (let i = 0; i < VIRTUAL_WIDTH + 40; i += 20) {
            const gx = (i - (groundOffset % 20));
            if ((i / 20) % 3 === 0) {
                ctx.fillRect(gx, GROUND_Y + 4, 4, 1.5);
            } else if ((i / 20) % 5 === 0) {
                ctx.fillRect(gx, GROUND_Y + 8, 2, 2);
            }
        }
        ctx.restore();

        // 3. Draw Obstacles
        obstacles.forEach(ob => ob.draw(ctx));

        // 4. Draw Dino
        dino.draw(ctx);
    }

    // Main Game Loop
    function gameLoop() {
        if (!isRunning || isPaused) return;

        frameCount++;
        distance += speed;
        groundOffset += speed;

        // Accelerate speed
        if (speed < MAX_SPEED) {
            speed += SPEED_ACCEL;
        }

        // Update Score
        const newScore = Math.floor(distance / 8);
        if (newScore > score) {
            score = newScore;
            if (score > 0 && score % 100 === 0) {
                playSound('score');
            }
            updateScoreUI();
        }

        // Update Dino physics
        dino.update();

        // Spawn & Update Obstacles
        spawnObstacle();

        for (let i = obstacles.length - 1; i >= 0; i--) {
            const ob = obstacles[i];
            ob.update();

            // Collision check
            if (checkCollision(dino, ob)) {
                gameOver();
                return;
            }

            // Remove off-screen obstacles
            if (ob.x + ob.width < -30) {
                obstacles.splice(i, 1);
            }
        }

        // Render Frame
        render();

        animationReqId = requestAnimationFrame(gameLoop);
    }

    function updateScoreUI() {
        const scoreEl = document.getElementById('dino-score');
        const highscoreEl = document.getElementById('dino-highscore');

        if (scoreEl) {
            scoreEl.textContent = String(score).padStart(5, '0');
        }
        if (highscoreEl) {
            highscoreEl.textContent = String(highScore).padStart(5, '0');
        }
    }

    function startNewGame() {
        // Reset state
        score = 0;
        distance = 0;
        speed = INITIAL_SPEED;
        frameCount = 0;
        obstacles = [];
        nextSpawnDistance = 150;
        isGameOver = false;
        hasStarted = true;
        isPaused = false;
        dino.reset();

        updateScoreUI();

        // Hide overlay
        const overlay = document.getElementById('dino-overlay');
        if (overlay) overlay.style.display = 'none';

        isRunning = true;
        if (animationReqId) cancelAnimationFrame(animationReqId);
        animationReqId = requestAnimationFrame(gameLoop);
    }

    function gameOver() {
        isRunning = false;
        isGameOver = true;
        playSound('hit');

        if (score > highScore) {
            highScore = score;
            try {
                localStorage.setItem('dino_high_score', highScore);
            } catch (e) {}
        }
        updateScoreUI();

        // Show Game Over Overlay
        const overlay = document.getElementById('dino-overlay');
        const startMsg = document.getElementById('dino-start-msg');
        if (overlay && startMsg) {
            startMsg.innerHTML = `
                <div class="dino-big-icon">💥</div>
                <h3>GAME OVER</h3>
                <p>Punteggio Finale: <strong>${score}</strong> | Record: <strong>${highScore}</strong></p>
                <button class="dino-btn" id="dino-restart-btn">Gioca Ancora</button>
            `;
            overlay.style.display = 'flex';

            const restartBtn = document.getElementById('dino-restart-btn');
            if (restartBtn) {
                restartBtn.addEventListener('click', startNewGame);
            }
        }
    }

    function handleResize() {
        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        canvas.width = rect.width || VIRTUAL_WIDTH;
        canvas.height = rect.height || VIRTUAL_HEIGHT;

        // Set scaling context for fixed virtual coords (600x200)
        const scaleX = canvas.width / VIRTUAL_WIDTH;
        const scaleY = canvas.height / VIRTUAL_HEIGHT;

        ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

        if (!isRunning) {
            render();
        }
    }

    let isInitialized = false;

    function isInputFocused() {
        const el = document.activeElement;
        if (!el) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    function setupControls() {
        // Keyboard Listeners
        window.addEventListener('keydown', (e) => {
            // Check if Dino panel is active/visible
            const panel = document.getElementById('tab-panel-game');
            if (!panel || !panel.classList.contains('active')) return;

            // Non intercettare tasti se l'utente sta digitando in un input
            if (isInputFocused()) return;

            if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                e.preventDefault();
                if (!hasStarted || isGameOver) {
                    startNewGame();
                } else {
                    dino.jump();
                }
            } else if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                e.preventDefault();
                if (hasStarted && !isGameOver) {
                    dino.setDuck(true);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            const panel = document.getElementById('tab-panel-game');
            if (!panel || !panel.classList.contains('active')) return;
            if (isInputFocused()) return;

            if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                dino.setDuck(false);
            }
        });

        // Touch & Click Listeners on Canvas Container
        if (container) {
            container.addEventListener('pointerdown', (e) => {
                const panel = document.getElementById('tab-panel-game');
                if (!panel || !panel.classList.contains('active')) return;

                if (!hasStarted || isGameOver) {
                    startNewGame();
                } else {
                    dino.jump();
                }
            });
        }
    }

    function init() {
        container = document.getElementById('dino-canvas-container');
        canvas = document.getElementById('dino-canvas');

        if (!container || !canvas) return;

        ctx = canvas.getContext('2d');

        // Load High Score from localStorage
        try {
            const savedScore = localStorage.getItem('dino_high_score');
            if (savedScore) highScore = parseInt(savedScore, 10) || 0;
        } catch (e) {}

        updateScoreUI();

        if (isInitialized) {
            handleResize();
            render();
            return;
        }
        isInitialized = true;

        // Initial setup & event handlers
        setupControls();
        handleResize();

        window.addEventListener('resize', handleResize);

        // Attach Start Button click listener
        const startBtn = document.getElementById('dino-start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', startNewGame);
        }

        // Render initial static view
        render();
    }

    function pause() {
        isPaused = true;
        if (animationReqId) {
            cancelAnimationFrame(animationReqId);
            animationReqId = null;
        }
    }

    function resume() {
        isPaused = false;
        handleResize();
        if (!isRunning) {
            render();
        }
        setTimeout(() => {
            handleResize();
            if (!isRunning) render();
        }, 100);

        if (isRunning && !isGameOver) {
            if (animationReqId) cancelAnimationFrame(animationReqId);
            animationReqId = requestAnimationFrame(gameLoop);
        }
    }

    return {
        init: init,
        start: startNewGame,
        pause: pause,
        resume: resume
    };
})();
