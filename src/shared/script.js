document.addEventListener('DOMContentLoaded', () => {
    const leftSidebar = document.getElementById('col-sinistra');
    const rightSidebar = document.getElementById('sidebar-right-container');
    const resizerLeft = document.getElementById('resizer-left');
    const resizerRight = document.getElementById('resizer-right');
    const main = document.querySelector('.main');

    function disableIframePointerEvents() {
        document.querySelectorAll('iframe').forEach(frame => {
            frame.style.pointerEvents = 'none';
        });
    }

    function enableIframePointerEvents() {
        document.querySelectorAll('iframe').forEach(frame => {
            frame.style.pointerEvents = '';
        });
    }

    // Calcola e applica le larghezze delle colonne limitandole per evitare overflow
    function adjustSidebarWidths() {
        const mainWidth = main.clientWidth;
        if (mainWidth <= 0) return;

        const leftVisible = leftSidebar && leftSidebar.style.display !== 'none';
        const rightVisible = rightSidebar && rightSidebar.style.display !== 'none';
        
        if (!leftVisible && !rightVisible) return;

        const mainStyle = window.getComputedStyle(main);
        const gapVal = parseFloat(mainStyle.columnGap) || 0;
        const visibleItems = 1 + (leftVisible ? 2 : 0) + (rightVisible ? 2 : 0);
        const totalGaps = (visibleItems - 1) * gapVal;
        const resizerWidths = (leftVisible ? 4 : 0) + (rightVisible ? 4 : 0);
        
        const centroMinWidth = 200; // Minimo assoluto della colonna centrale (da CSS)

        // Carica i valori salvati o calcola il valore di default (20% dello schermo)
        let leftWidth = leftVisible ? parseFloat(localStorage.getItem('sidebar-left-width')) : 0;
        let rightWidth = rightVisible ? parseFloat(localStorage.getItem('sidebar-right-width')) : 0;

        if (leftVisible && (isNaN(leftWidth) || leftWidth <= 0)) {
            leftWidth = mainWidth * 0.2;
        }
        if (rightVisible && (isNaN(rightWidth) || rightWidth <= 0)) {
            rightWidth = mainWidth * 0.2;
        }

        // Forza il minimo di 200px per le barre laterali attive
        if (leftVisible) leftWidth = Math.max(200, leftWidth);
        if (rightVisible) rightWidth = Math.max(200, rightWidth);

        // Controlla se la somma supera lo spazio dello schermo e ridimensiona di conseguenza
        const totalNeeded = leftWidth + rightWidth + centroMinWidth + totalGaps + resizerWidths;
        if (totalNeeded > mainWidth) {
            const overflow = totalNeeded - mainWidth;
            // Riduciamo prima la colonna destra fino a un minimo di 200px
            if (rightVisible && rightWidth > 200) {
                const rightAvailableReduction = rightWidth - 200;
                const reduction = Math.min(overflow, rightAvailableReduction);
                rightWidth -= reduction;
                const remainingOverflow = overflow - reduction;
                // Se c'è ancora overflow, riduciamo la sinistra fino a 200px
                if (remainingOverflow > 0 && leftVisible && leftWidth > 200) {
                    leftWidth = Math.max(200, leftWidth - remainingOverflow);
                }
            } else if (leftVisible && leftWidth > 200) {
                leftWidth = Math.max(200, leftWidth - overflow);
            }
        }

        // Applica le larghezze finali calcolate
        if (leftVisible) leftSidebar.style.width = `${leftWidth}px`;
        if (rightVisible) rightSidebar.style.width = `${rightWidth}px`;
    }

    // Applica stati di visibilità dei widget in base alle impostazioni
    // Weather e Chat sono disattivati di default, Spotify rimane attivo di default
    const weatherEnabled = localStorage.getItem('weather_enabled') === 'true';
    const chatEnabled = localStorage.getItem('chat_enabled') === 'true';
    const spotifyEnabled = localStorage.getItem('spotify_enabled') !== 'false';
    const pomodoroEnabled = localStorage.getItem('pomodoro_enabled') === 'true';
    const countdownEnabled = localStorage.getItem('countdown_enabled') === 'true';
    const sysmonitorEnabled = localStorage.getItem('sysmonitor_enabled') === 'true';
    const stocksEnabled = localStorage.getItem('stocks_enabled') === 'true';
    const converterEnabled = localStorage.getItem('converter_enabled') === 'true';
    const widgetsActivatedOnce = localStorage.getItem('widgets_activated_once') === 'true';

    // Se almeno un widget della colonna sinistra è attivo, aggiorna widgets_activated_once a true
    const anyLeftWidgetEnabled = weatherEnabled || chatEnabled || pomodoroEnabled || countdownEnabled || sysmonitorEnabled || stocksEnabled || converterEnabled;
    if (anyLeftWidgetEnabled && !widgetsActivatedOnce) {
        localStorage.setItem('widgets_activated_once', 'true');
    }

    const weatherSection = document.getElementById('weather-section');
    const chatSection = document.getElementById('chat-section');
    const pomodoroSection = document.getElementById('pomodoro-section');
    const countdownSection = document.getElementById('countdown-section');
    const sysmonitorSection = document.getElementById('sysmonitor-section');
    const stocksSection = document.getElementById('stocks-section');
    const converterSection = document.getElementById('converter-section');
    const addWidgetPlaceholder = document.getElementById('add-widget-placeholder');

    if (weatherSection) weatherSection.style.display = weatherEnabled ? 'block' : 'none';
    if (chatSection) chatSection.style.display = chatEnabled ? 'flex' : 'none';
    if (pomodoroSection) pomodoroSection.style.display = pomodoroEnabled ? 'block' : 'none';
    if (countdownSection) countdownSection.style.display = countdownEnabled ? 'block' : 'none';
    if (sysmonitorSection) sysmonitorSection.style.display = sysmonitorEnabled ? 'block' : 'none';
    if (stocksSection) stocksSection.style.display = stocksEnabled ? 'block' : 'none';
    if (converterSection) converterSection.style.display = converterEnabled ? 'block' : 'none';

    if (leftSidebar && resizerLeft) {
        if (!anyLeftWidgetEnabled) {
            if (!widgetsActivatedOnce) {
                // Prima attivazione: mostra il segnaposto nella colonna
                leftSidebar.style.display = '';
                resizerLeft.style.display = 'none';
                if (addWidgetPlaceholder) {
                    addWidgetPlaceholder.style.display = 'flex';
                }
            } else {
                // Già attivato in passato: nascondi completamente la colonna
                leftSidebar.style.display = 'none';
                resizerLeft.style.display = 'none';
                if (addWidgetPlaceholder) {
                    addWidgetPlaceholder.style.display = 'none';
                }
            }
        } else {
            leftSidebar.style.display = '';
            resizerLeft.style.display = '';
            if (addWidgetPlaceholder) {
                addWidgetPlaceholder.style.display = 'none';
            }
            
            // Per evitare conflitti con layout complessi, abilitiamo only-chat o has-both-widgets solo se gli unici abilitati sono meteo e/o chat.
            // Altrimenti, lasciamo che la sidebar si impili naturalmente.
            const otherWidgetsEnabled = pomodoroEnabled || countdownEnabled || sysmonitorEnabled || stocksEnabled || converterEnabled;
            if (!otherWidgetsEnabled) {
                if (chatEnabled && !weatherEnabled) {
                    leftSidebar.classList.add('only-chat');
                } else {
                    leftSidebar.classList.remove('only-chat');
                }
            } else {
                leftSidebar.classList.remove('only-chat');
                leftSidebar.classList.remove('has-both-widgets');
            }
        }
    }

    if (addWidgetPlaceholder) {
        addWidgetPlaceholder.addEventListener('click', () => {
            const settingsBtn = document.getElementById('settings-btn');
            if (settingsBtn) {
                settingsBtn.click();
            }
        });
    }

    if (!spotifyEnabled) {
        document.body.classList.add('spotify-disabled');
    } else {
        document.body.classList.remove('spotify-disabled');
    }

    if (!leftSidebar || !rightSidebar || !resizerLeft || !resizerRight || !main) {
        return;
    }

    // Applica le larghezze corrette all'avvio
    adjustSidebarWidths();

    // Definizioni altezze di default per ciascun widget della barra sinistra
    const defaultHeights = {
        'weather-section': '230px',
        'chat-section': '300px',
        'pomodoro-section': '310px',
        'countdown-section': '220px',
        'sysmonitor-section': '220px',
        'stocks-section': '220px',
        'converter-section': '180px'
    };

    function setupVerticalResizers() {
        if (!leftSidebar) return;

        // 1. Rimuovi tutti i resizer dinamici esistenti per evitare duplicati
        const existingResizers = leftSidebar.querySelectorAll('.dynamic-resizer-v');
        existingResizers.forEach(r => r.remove());

        // 2. Trova tutte le sezioni dei widget visibili nella colonna sinistra
        const sections = Array.from(leftSidebar.querySelectorAll('.sezioni_laterali')).filter(sec => {
            return sec.style.display !== 'none' && sec.id !== 'add-widget-placeholder';
        });

        // Se c'è un solo widget visibile, fallo espandere a tutto lo spazio disponibile
        if (sections.length < 2) {
            leftSidebar.classList.remove('has-both-widgets');
            // Mantieni il grid ma forza la singola riga a occupare tutto lo spazio (1fr)
            leftSidebar.style.gridTemplateRows = '1fr';
            leftSidebar.style.display = '';
            leftSidebar.style.flexDirection = '';
            sections.forEach(sec => {
                sec.style.height = '';
                sec.style.flex = '';
                sec.style.minHeight = '0';
                sec.style.alignSelf = 'stretch';
            });
            return;
        }
        // Più widget: ripristina le righe del grid a auto
        leftSidebar.style.gridTemplateRows = '';
        leftSidebar.style.display = '';
        leftSidebar.style.flexDirection = '';

        leftSidebar.classList.add('has-both-widgets');

        // 3. Inserisci un divisore trascinabile dopo ciascuna sezione (tranne l'ultima)
        for (let i = 0; i < sections.length - 1; i++) {
            const section = sections[i];
            const resizer = document.createElement('div');
            resizer.className = 'resizer-v dynamic-resizer-v';
            
            // Inserisci il divisore subito dopo la sezione
            section.parentNode.insertBefore(resizer, section.nextSibling);

            // Carica l'altezza salvata o usa quella di default
            let savedHeight = localStorage.getItem(`widget-height-${section.id}`);
            if (section.id === 'pomodoro-section' && savedHeight && parseInt(savedHeight) < 310) {
                savedHeight = '310px';
                localStorage.setItem('widget-height-pomodoro-section', '310px');
            }
            const defaultH = defaultHeights[section.id] || '200px';
            section.style.height = savedHeight || defaultH;
            section.style.flex = '0 0 auto';

            // Registra l'evento di trascinamento
            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startHeight = section.getBoundingClientRect().height;
                
                disableIframePointerEvents();
                resizer.classList.add('active');
                document.body.style.cursor = 'row-resize';

                const doDrag = (moveEvent) => {
                    const deltaY = moveEvent.clientY - startY;
                    const newHeight = Math.max(100, Math.min(startHeight + deltaY, window.innerHeight * 0.7));
                    section.style.height = `${newHeight}px`;
                };

                const stopDrag = () => {
                    enableIframePointerEvents();
                    resizer.classList.remove('active');
                    document.body.style.cursor = '';
                    localStorage.setItem(`widget-height-${section.id}`, section.style.height);
                    document.removeEventListener('mousemove', doDrag);
                    document.removeEventListener('mouseup', stopDrag);
                };

                document.addEventListener('mousemove', doDrag);
                document.addEventListener('mouseup', stopDrag);
            });
        }

        // Imposta l'ultimo widget in modo che si comporti correttamente
        const lastSection = sections[sections.length - 1];
        let savedHeightLast = localStorage.getItem(`widget-height-${lastSection.id}`);
        if (lastSection.id === 'pomodoro-section' && savedHeightLast && parseInt(savedHeightLast) < 310) {
            savedHeightLast = '310px';
            localStorage.setItem('widget-height-pomodoro-section', '310px');
        }
        const defaultHLast = defaultHeights[lastSection.id] || '200px';
        
        lastSection.style.height = savedHeightLast || defaultHLast;
        lastSection.style.flex = '0 0 auto';
    }

    // Esegui la configurazione dei resizer verticali all'avvio
    setupVerticalResizers();

    // Gestore per il ridimensionamento sinistro
    resizerLeft.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = leftSidebar.getBoundingClientRect().width;
        
        disableIframePointerEvents();
        resizerLeft.classList.add('active');
        document.body.style.cursor = 'col-resize';

        const doDrag = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const mainWidth = main.clientWidth;
            const rightVisible = rightSidebar && rightSidebar.style.display !== 'none';
            const rightWidth = rightVisible ? rightSidebar.getBoundingClientRect().width : 0;
            
            const mainStyle = window.getComputedStyle(main);
            const gapVal = parseFloat(mainStyle.columnGap) || 0;
            const visibleItems = 1 + (rightVisible ? 2 : 0) + 2;
            const totalGaps = (visibleItems - 1) * gapVal;
            const resizerWidths = 4 + (rightVisible ? 4 : 0);
            
            const centroMinWidth = 200; // Minimo assoluto della colonna centrale
            
            const maxLeftWidth = mainWidth - rightWidth - totalGaps - resizerWidths - centroMinWidth;
            const newWidth = Math.max(200, Math.min(startWidth + deltaX, maxLeftWidth));
            leftSidebar.style.width = `${newWidth}px`;
        };

        const stopDrag = () => {
            enableIframePointerEvents();
            resizerLeft.classList.remove('active');
            document.body.style.cursor = '';
            localStorage.setItem('sidebar-left-width', leftSidebar.style.width);
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        };

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    });

    // Gestore per il ridimensionamento destro
    resizerRight.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = rightSidebar.getBoundingClientRect().width;
        
        disableIframePointerEvents();
        resizerRight.classList.add('active');
        document.body.style.cursor = 'col-resize';

        const doDrag = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const mainWidth = main.clientWidth;
            const leftVisible = leftSidebar && leftSidebar.style.display !== 'none';
            const leftWidth = leftVisible ? leftSidebar.getBoundingClientRect().width : 0;
            
            const mainStyle = window.getComputedStyle(main);
            const gapVal = parseFloat(mainStyle.columnGap) || 0;
            const visibleItems = 1 + (leftVisible ? 2 : 0) + 2;
            const totalGaps = (visibleItems - 1) * gapVal;
            const resizerWidths = 4 + (leftVisible ? 4 : 0);
            
            const centroMinWidth = 200; // Minimo assoluto della colonna centrale
            
            const maxRightWidth = mainWidth - leftWidth - totalGaps - resizerWidths - centroMinWidth;
            const newWidth = Math.max(200, Math.min(startWidth - deltaX, maxRightWidth));
            rightSidebar.style.width = `${newWidth}px`;
        };

        const stopDrag = () => {
            enableIframePointerEvents();
            resizerRight.classList.remove('active');
            document.body.style.cursor = '';
            localStorage.setItem('sidebar-right-width', rightSidebar.style.width);
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        };

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    });

    // Gestore per il ridimensionamento tra To-Do e Calendario
    const todoSidebar = document.getElementById('sidebar');
    const toggleButton = document.getElementById('toggleButton');
    const resizerTodo = document.getElementById('resizer-todo');

    if (todoSidebar && resizerTodo && toggleButton) {
        // Carica la larghezza salvata
        const savedTodoWidth = localStorage.getItem('todo-sidebar-width');
        const isCollapsed = todoSidebar.classList.contains('open'); // in To-do.js, "open" significa chiuso/collassato
        if (savedTodoWidth && !isCollapsed) {
            todoSidebar.style.width = savedTodoWidth;
        }

        resizerTodo.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = todoSidebar.getBoundingClientRect().width;
            
            disableIframePointerEvents();
            resizerTodo.classList.add('active');
            document.body.style.cursor = 'col-resize';

            const doDrag = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;
                const centroWidth = document.querySelector('.centro')?.clientWidth || 600;
                const maxTodoWidth = Math.max(150, Math.min(450, centroWidth - 200));
                const newWidth = Math.max(150, Math.min(startWidth + deltaX, maxTodoWidth));
                todoSidebar.style.width = `${newWidth}px`;
            };

            const stopDrag = () => {
                enableIframePointerEvents();
                resizerTodo.classList.remove('active');
                document.body.style.cursor = '';
                if (!todoSidebar.classList.contains('open')) {
                    localStorage.setItem('todo-sidebar-width', todoSidebar.style.width);
                }
                document.removeEventListener('mousemove', doDrag);
                document.removeEventListener('mouseup', stopDrag);
            };

            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', stopDrag);
        });

        // Pulisce o ripristina la larghezza inline quando si clicca sul pulsante collassa/espandi
        toggleButton.addEventListener('click', () => {
            todoSidebar.classList.toggle('open');
            if (todoSidebar.classList.contains('open')) {
                todoSidebar.style.width = ''; // Rimuove larghezza inline per far funzionare il collasso CSS a 28px
            } else {
                const savedWidth = localStorage.getItem('todo-sidebar-width') || '220px';
                todoSidebar.style.width = savedWidth;
            }
        });
    }

    // Gestore per ridimensionare dinamicamente le colonne in caso di restringimento della finestra
    window.addEventListener('resize', adjustSidebarWidths);
});
