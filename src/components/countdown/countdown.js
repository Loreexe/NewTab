document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const addBtn = document.getElementById('countdown-add-btn');
    const formPanel = document.getElementById('countdown-form');
    const titleInput = document.getElementById('countdown-title-input');
    const dateInput = document.getElementById('countdown-date-input');
    const cancelFormBtn = document.getElementById('countdown-cancel-form');
    const saveFormBtn = document.getElementById('countdown-save-form');
    const listContainer = document.getElementById('countdown-list');

    let countdowns = JSON.parse(localStorage.getItem('countdowns')) || [];

    // Setup input min date to today
    if (dateInput) {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = new Date(now - offset).toISOString().slice(0, 16);
        dateInput.min = localISOTime;
    }

    // Toggle add form
    if (addBtn && formPanel) {
        addBtn.addEventListener('click', () => {
            const isHidden = formPanel.style.display === 'none';
            formPanel.style.display = isHidden ? 'flex' : 'none';
            if (isHidden && titleInput) {
                titleInput.value = '';
                dateInput.value = '';
                titleInput.focus();
            }
        });
    }

    // Cancel adding
    if (cancelFormBtn && formPanel) {
        cancelFormBtn.addEventListener('click', () => {
            formPanel.style.display = 'none';
        });
    }

    // Save countdown
    if (saveFormBtn && formPanel) {
        saveFormBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const title = titleInput.value.trim();
            const dateStr = dateInput.value;

            if (!title || !dateStr) {
                alert('Inserisci sia un titolo che una data/ora valida!');
                return;
            }

            const deadline = new Date(dateStr).getTime();
            if (isNaN(deadline) || deadline <= Date.now()) {
                alert('Scegli una data e ora futura!');
                return;
            }

            const newCountdown = {
                id: 'cd_' + Date.now(),
                title: title,
                deadline: deadline,
                dateStr: dateStr
            };

            countdowns.push(newCountdown);
            localStorage.setItem('countdowns', JSON.stringify(countdowns));

            formPanel.style.display = 'none';
            renderCountdowns();
        });
    }

    // Calculate time differences and render items
    function renderCountdowns() {
        if (!listContainer) return;
        listContainer.innerHTML = '';

        if (countdowns.length === 0) {
            listContainer.innerHTML = `
                <div style="font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; padding: 12px;">
                    Nessun countdown attivo. Clicca su + per aggiungerne uno.
                </div>
            `;
            return;
        }

        countdowns.sort((a, b) => a.deadline - b.deadline);

        const now = Date.now();

        countdowns.forEach(cd => {
            const diff = cd.deadline - now;

            if (diff <= 0) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'countdown-item expired';
                itemDiv.dataset.id = cd.id;
                const deleteBtn0 = document.createElement('button');
                deleteBtn0.className = 'countdown-delete-btn';
                deleteBtn0.title = 'Elimina';
                deleteBtn0.textContent = '✕';
                const title0 = document.createElement('div');
                title0.className = 'countdown-title';
                title0.textContent = cd.title;
                const val0 = document.createElement('div');
                val0.className = 'countdown-val';
                val0.style.cssText = 'color:#ff4444;font-size:12px;margin-top:4px;font-weight:600;';
                val0.textContent = 'Tempo scaduto! 🎉';
                itemDiv.appendChild(deleteBtn0);
                itemDiv.appendChild(title0);
                itemDiv.appendChild(val0);
                deleteBtn0.addEventListener('click', () => {
                    if (confirm(`Sei sicuro di voler eliminare il countdown "${cd.title}"?`)) {
                        countdowns = countdowns.filter(item => item.id !== cd.id);
                        localStorage.setItem('countdowns', JSON.stringify(countdowns));
                        renderCountdowns();
                    }
                });
                listContainer.appendChild(itemDiv);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const isImminent = diff < (1000 * 60 * 60 * 24);

            const itemDiv = document.createElement('div');
            itemDiv.className = `countdown-item ${isImminent ? 'imminent' : ''}`;
            itemDiv.dataset.id = cd.id;
            
            const dateObj = new Date(cd.deadline);
            const dateFormatted = dateObj.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'countdown-delete-btn';
            delBtn.title = 'Elimina';
            delBtn.textContent = '✕';
            const titleDiv = document.createElement('div');
            titleDiv.className = 'countdown-title';
            titleDiv.textContent = cd.title;
            const ticker = document.createElement('div');
            ticker.className = 'countdown-ticker';
            [[days, 'G'], [hours, 'O'], [minutes, 'M'], [seconds, 'S']].forEach(([val, lbl]) => {
                const unit = document.createElement('div');
                unit.className = 'countdown-unit';
                const v = document.createElement('span');
                v.className = 'countdown-val';
                v.textContent = val;
                const l = document.createElement('span');
                l.className = 'countdown-unit-lbl';
                l.textContent = lbl;
                unit.appendChild(v);
                unit.appendChild(l);
                ticker.appendChild(unit);
            });
            const dateDiv = document.createElement('div');
            dateDiv.className = 'countdown-date-str';
            dateDiv.textContent = dateFormatted;
            itemDiv.appendChild(delBtn);
            itemDiv.appendChild(titleDiv);
            itemDiv.appendChild(ticker);
            itemDiv.appendChild(dateDiv);

            delBtn.addEventListener('click', () => {
                if (confirm(`Sei sicuro di voler eliminare il countdown "${cd.title}"?`)) {
                    countdowns = countdowns.filter(item => item.id !== cd.id);
                    localStorage.setItem('countdowns', JSON.stringify(countdowns));
                    renderCountdowns();
                }
            });

            listContainer.appendChild(itemDiv);
        });
    }

    function updateCountdownTickers() {
        if (document.hidden) return;
        const now = Date.now();
        let needsRebuild = false;

        countdowns.forEach(cd => {
            const itemDiv = listContainer.querySelector(`[data-id="${cd.id}"]`);
            if (!itemDiv) {
                needsRebuild = true;
                return;
            }
            const diff = cd.deadline - now;
            if (diff <= 0) {
                if (!itemDiv.classList.contains('expired')) {
                    needsRebuild = true;
                }
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const isImminent = diff < (1000 * 60 * 60 * 24);
            itemDiv.classList.toggle('imminent', isImminent);

            const vals = itemDiv.querySelectorAll('.countdown-val');
            if (vals.length === 4) {
                if (vals[0].textContent !== String(days)) vals[0].textContent = days;
                if (vals[1].textContent !== String(hours)) vals[1].textContent = hours;
                if (vals[2].textContent !== String(minutes)) vals[2].textContent = minutes;
                if (vals[3].textContent !== String(seconds)) vals[3].textContent = seconds;
            }
        });

        if (needsRebuild) {
            renderCountdowns();
        }
    }

    setInterval(updateCountdownTickers, 1000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateCountdownTickers();
    });

    renderCountdowns();
});
