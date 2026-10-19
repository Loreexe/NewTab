AppStorage.ready(() => {
    // UI elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('settings-close');
    const saveBtn = document.getElementById('save-settings-btn');

    // Vertical Tab buttons and contents
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // API & Weather inputs
    const chatKeyInput = document.getElementById('settings-chat-key') || document.getElementById('settings-gemini-key');
    const chatEndpointInput = document.getElementById('settings-chat-endpoint');
    const chatModelInput = document.getElementById('settings-chat-model');
    const chatProviderSelect = document.getElementById('settings-chat-provider');
    const weatherInput = document.getElementById('settings-weather-key');
    const latInput = document.getElementById('settings-weather-lat');
    const lonInput = document.getElementById('settings-weather-lon');

    const PROVIDER_DEFAULTS = {
        openai: { endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
        gemini: { endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-1.5-flash' },
        deepseek: { endpoint: 'https://api.deepseek.com', model: 'deepseek-chat' },
        openrouter: { endpoint: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-r1:free' },
        groq: { endpoint: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
        ollama: { endpoint: 'http://localhost:11434/v1', model: 'llama3' }
    };

    if (chatProviderSelect) {
        chatProviderSelect.addEventListener('change', () => {
            const preset = PROVIDER_DEFAULTS[chatProviderSelect.value];
            if (preset) {
                if (chatEndpointInput) chatEndpointInput.value = preset.endpoint;
                if (chatModelInput) chatModelInput.value = preset.model;
            }
            showSaveButton();
        });
    }

    // Toggles and containers
    const weatherEnabledToggle = document.getElementById('settings-weather-enabled');
    const weatherDetails = document.getElementById('settings-weather-details');
    const chatEnabledToggle = document.getElementById('settings-chat-enabled');
    const chatDetails = document.getElementById('settings-chat-details');
    const spotifyEnabledToggle = document.getElementById('settings-spotify-enabled');
    const spotifyDetails = document.getElementById('settings-spotify-details');
    const pomodoroEnabledToggle = document.getElementById('settings-pomodoro-enabled');
    const countdownEnabledToggle = document.getElementById('settings-countdown-enabled');
    const sysmonitorEnabledToggle = document.getElementById('settings-sysmonitor-enabled');
    const stocksEnabledToggle = document.getElementById('settings-stocks-enabled');
    const converterEnabledToggle = document.getElementById('settings-converter-enabled');
    const aiSearchEnabledToggle = document.getElementById('settings-ai-search-enabled');
    const defaultSearchEngineSelect = document.getElementById('settings-default-search-engine');
    const saveSettingsContainer = document.getElementById('save-settings-container');

    function showSaveButton() {
        if (saveSettingsContainer) {
            saveSettingsContainer.classList.add('visible');
        }
    }

    function hideSaveButton() {
        if (saveSettingsContainer) {
            saveSettingsContainer.classList.remove('visible');
        }
    }

    function getExtensionRedirectUri() {
        try {
            if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getRedirectURL) {
                return chrome.identity.getRedirectURL();
            }
        } catch (e) { /* ignore */ }
        return 'chrome.identity non disponibile';
    }

    function setupRedirectCopy(inputId) {
        const el = document.getElementById(inputId);
        if (!el || el.dataset.copyBound === 'true') return;
        el.dataset.copyBound = 'true';
        el.title = 'Clicca per copiare il Redirect URI';
        el.addEventListener('click', () => {
            try { el.select(); } catch (e) { /* ignore */ }
            const val = el.value || '';
            if (navigator.clipboard && val && val.indexOf('http') === 0) {
                navigator.clipboard.writeText(val).catch(() => {});
            }
        });
    }
    setupRedirectCopy('settings-spotify-redirect-uri');
    setupRedirectCopy('settings-google-redirect-uri');

    const settingsContentArea = document.querySelector('.settings-content-area');
    if (settingsContentArea) {
        settingsContentArea.addEventListener('input', showSaveButton);
        settingsContentArea.addEventListener('change', showSaveButton);
    }

    function setupToggleDetails(toggle, details) {
        if (toggle && details) {
            const updateDetailsVisibility = () => {
                if (toggle.checked) {
                    details.classList.remove('hidden');
                } else {
                    details.classList.add('hidden');
                }
            };
            toggle.addEventListener('change', updateDetailsVisibility);
            updateDetailsVisibility();
        }
    }
    setupToggleDetails(weatherEnabledToggle, weatherDetails);
    setupToggleDetails(chatEnabledToggle, chatDetails);
    setupToggleDetails(spotifyEnabledToggle, spotifyDetails);

    // Default coordinates
    const DEFAULT_LAT = "38.100470";
    const DEFAULT_LON = "13.353646";

    // Edit states & Dialog Elements for Right Column Edit Mode
    let isEditMode = false;
    const editDialogModal = document.getElementById('edit-dialog-modal');
    const editDialogClose = document.getElementById('edit-dialog-close');
    const editDialogCancel = document.getElementById('edit-dialog-cancel');
    const editDialogSave = document.getElementById('edit-dialog-save');
    const editDialogTitle = document.getElementById('edit-dialog-title');
    const editDialogFields = document.getElementById('edit-dialog-fields');
    let dialogCallback = null;

    let draggedLinkIndex = null;
    let draggedLinkCatId = null;
    let draggedCatIndex = null;

    // Helper condiviso: evita una seconda implementazione dell'escaping HTML.
    const escapeHtml = window.AppSanitize.escapeHtml;
    // Helper: dopo la rimozione di <all_urls> dal manifest, gli endpoint chat personalizzati
    // (non presenti in host_permissions) richiedono un permesso opzionale concesso dall'utente.
    function requestChatEndpointPermission(endpoint) {
        try {
            if (typeof chrome === 'undefined' || !chrome.permissions || !chrome.permissions.request) return;
            const url = new URL(endpoint);
            if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
            const origins = [`${url.protocol}//${url.hostname}/*`];
            chrome.permissions.request({ origins }, (granted) => {
                if (chrome.runtime.lastError) {
                    console.warn("Richiesta permesso endpoint chat fallita:", chrome.runtime.lastError.message);
                } else if (!granted) {
                    console.warn("Permesso per l'endpoint chat non concesso:", origins[0]);
                }
            });
        } catch (e) {
            console.warn("Endpoint chat non valido, permesso non richiesto:", e);
        }
    }


    // 1. Data Loading & Migration (supports old key-value object to categories array migration)
    function loadCategoriesData() {
        if (!AppStorage.getItem('custom_links')) {
            AppStorage.setItem('custom_links', JSON.stringify(window.DEFAULT_CATEGORIES));
            return window.DEFAULT_CATEGORIES;
        }

        let loaded = null;
        try {
            loaded = JSON.parse(AppStorage.getItem('custom_links'));
        } catch (e) {
            console.error("Errore nel parsing dei link salvati, ripristino di default", e);
            loaded = window.DEFAULT_CATEGORIES;
            AppStorage.setItem('custom_links', JSON.stringify(loaded));
            return loaded;
        }

        // Migration from old flat object format {apps: [], ai: [], others: []} to array of categories [{id, title, links}]
        if (!loaded) {
            loaded = window.DEFAULT_CATEGORIES;
            AppStorage.setItem('custom_links', JSON.stringify(loaded));
            return loaded;
        }

        if (!Array.isArray(loaded)) {
            console.log("Rilevato vecchio formato dati link: migrazione all'array di categorie dinamico...");
            const migrated = [
                { id: "apps", title: "Applicazioni Generali", links: loaded.apps || [] },
                { id: "ai", title: "Strumenti AI", links: loaded.ai || [] },
                { id: "others", title: "Altre Applicazioni", links: loaded.others || [] }
            ];
            AppStorage.setItem('custom_links', JSON.stringify(migrated));
            return migrated;
        }

        return loaded;
    }

    let currentCategories = loadCategoriesData();

    // Helper: get resolved icon URL (local path or fallback to Google Favicon Service)
    function getIconUrl(link) {
        if (link.icon && link.icon.trim() !== '') {
            return link.icon;
        }
        try {
            const urlObj = new URL(link.url);
            return `https://www.google.com/s2/favicons?sz=64&domain=${urlObj.hostname}`;
        } catch (e) {
            return 'images/icon128.png';
        }
    }

    // Custom dialog helper
    function showEditDialog(title, fieldsHtml, onSave) {
        if (!editDialogModal) return;
        editDialogTitle.textContent = title;
        editDialogFields.innerHTML = fieldsHtml;
        dialogCallback = onSave;
        editDialogModal.style.display = 'flex';
    }

    function optimizeImage(file, callback) {
        // Limite 5MB input per evitare OOM; output max ~100KB per non saturare localStorage
        if (file && file.size > 5 * 1024 * 1024) {
            alert('Immagine troppo grande (max 5MB). Scegli un file più piccolo.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 96;
                let width = img.width;
                let height = img.height;
                
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                let out = canvas.toDataURL('image/png');
                // Se PNG >100KB, ricomprimi in JPEG 0.8 (sfondo bianco per trasparenze)
                if (out.length > 100 * 1024) {
                    const bg = document.createElement('canvas');
                    bg.width = width;
                    bg.height = height;
                    const bctx = bg.getContext('2d');
                    bctx.fillStyle = '#ffffff';
                    bctx.fillRect(0, 0, width, height);
                    bctx.drawImage(canvas, 0, 0);
                    out = bg.toDataURL('image/jpeg', 0.8);
                }
                if (out.length > 150 * 1024) {
                    alert('Immagine ancora troppo pesante dopo ottimizzazione, usa un URL esterno.');
                    return;
                }
                callback(out);
            };
            img.onerror = () => alert('File immagine non valido.');
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function setupFileDialogListeners() {
        const fileInput = document.getElementById('dialog-link-file');
        const fileBtn = document.getElementById('dialog-link-file-btn');
        const iconInput = document.getElementById('dialog-link-icon');
        
        if (fileInput && fileBtn && iconInput) {
            fileBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                fileBtn.innerHTML = window.AppIcons.getSvg('spinner', { width: 16, height: 16 });
                fileBtn.style.pointerEvents = 'none';
                
                optimizeImage(file, (optimizedBase64) => {
                    iconInput.value = optimizedBase64;
                    fileBtn.innerHTML = window.AppIcons.getSvg('upload', { width: 16, height: 16 });
                    fileBtn.style.pointerEvents = 'auto';
                });
            });
        }
    }

    if (editDialogClose) {
        editDialogClose.addEventListener('click', () => {
            editDialogModal.style.display = 'none';
        });
    }
    if (editDialogCancel) {
        editDialogCancel.addEventListener('click', () => {
            editDialogModal.style.display = 'none';
        });
    }
    if (editDialogSave) {
        editDialogSave.addEventListener('click', () => {
            if (dialogCallback) {
                dialogCallback();
            }
        });
    }
    window.addEventListener('click', (event) => {
        if (event.target === editDialogModal) {
            editDialogModal.style.display = 'none';
        }
    });

    function toggleEditModeHandler(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        isEditMode = !isEditMode;
        renderSidebar();
    }

    function saveCategoriesAndRender() {
        AppStorage.setItem('custom_links', JSON.stringify(currentCategories));
        renderSidebar();
    }

    function animateFLIP(element, oldRect) {
        const newRect = element.getBoundingClientRect();
        const deltaX = oldRect.left - newRect.left;
        const deltaY = oldRect.top - newRect.top;
        
        if (deltaX !== 0 || deltaY !== 0) {
            element.style.transition = 'none';
            element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            
            // Force repaint
            element.offsetHeight;
            
            element.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)';
            element.style.transform = 'translate(0, 0)';
            
            const onTransitionEnd = (e) => {
                if (e.propertyName === 'transform') {
                    element.style.transition = '';
                    element.style.transform = '';
                    element.removeEventListener('transitionend', onTransitionEnd);
                }
            };
            element.addEventListener('transitionend', onTransitionEnd);
        }
    }

    function saveCategoriesFromDOM() {
        const newCategories = [];
        const categoryWrappers = document.querySelectorAll('.sidebar-right-category-wrapper');
        
        categoryWrappers.forEach(wrapper => {
            const catId = wrapper.dataset.catId;
            const originalCat = currentCategories.find(c => c.id === catId);
            if (!originalCat) return;
            
            const appNodes = wrapper.querySelectorAll('.app:not(.add-link-trigger)');
            const newLinks = [];
            appNodes.forEach(node => {
                newLinks.push({
                    name: node.dataset.linkName,
                    url: node.dataset.linkUrl,
                    icon: node.dataset.linkIcon || ''
                });
            });
            
            newCategories.push({
                id: originalCat.id,
                title: originalCat.title,
                links: newLinks
            });
        });
        
        currentCategories = newCategories;
        AppStorage.setItem('custom_links', JSON.stringify(currentCategories));
        renderSidebar();
    }

    // 2. Render sidebar links in the page (Dynamically building categories and links)
    function renderSidebar() {
        const container = document.getElementById('sidebar-right-container');
        if (!container) return;
        container.innerHTML = '';

        if (currentCategories.length === 0) {
            // Render just the edit toggle button on the right so the user can start adding categories
            const emptyHeader = document.createElement('div');
            emptyHeader.className = 'category-header-non-edit';
            emptyHeader.style.justifyContent = 'flex-end';
            emptyHeader.style.width = '100%';
            emptyHeader.style.display = 'flex';

            const editToggleBtn = document.createElement('button');
            editToggleBtn.className = isEditMode ? 'edit-mode-btn active' : 'edit-mode-btn';
            editToggleBtn.innerHTML = isEditMode ? (window.AppIcons ? window.AppIcons.getSvg('check', { width: 14, height: 14 }) : '') : (window.AppIcons ? window.AppIcons.getSvg('editMode', { width: 14, height: 14 }) : '');
            editToggleBtn.title = isEditMode ? 'Esci dalla modifica' : 'Modifica collegamenti';
            editToggleBtn.addEventListener('click', toggleEditModeHandler);
            emptyHeader.appendChild(editToggleBtn);
            container.appendChild(emptyHeader);

            if (!isEditMode) {
                const emptyMsg = document.createElement('div');
                emptyMsg.style.padding = '20px';
                emptyMsg.style.color = '#888';
                emptyMsg.style.textAlign = 'center';
                emptyMsg.style.fontSize = '13px';
                emptyMsg.textContent = 'Nessun collegamento configurato.';
                container.appendChild(emptyMsg);
                return;
            }
        }

        // Create a single main wrapper block for all categories
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'sidebar-right-content';

        currentCategories.forEach((category, catIndex) => {
            const categoryWrapper = document.createElement('div');
            categoryWrapper.className = 'sidebar-right-category-wrapper';
            categoryWrapper.dataset.catId = category.id;

            // Drag and Drop for Categories
            if (isEditMode) {
                categoryWrapper.draggable = true;
                categoryWrapper.addEventListener('dragstart', (e) => {
                    if (e.target.closest('.app')) {
                        e.stopPropagation();
                        return;
                    }
                    draggedCatIndex = catIndex;
                    categoryWrapper.classList.add('dragging-cat');
                    e.dataTransfer.effectAllowed = 'move';
                });
                categoryWrapper.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedLinkIndex !== null) return;
                    
                    const draggingCat = document.querySelector('.sidebar-right-category-wrapper.dragging-cat');
                    if (!draggingCat || draggingCat === categoryWrapper) return;
                    
                    const parent = categoryWrapper.parentNode;
                    const rect = categoryWrapper.getBoundingClientRect();
                    const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
                    
                    const allCats = Array.from(document.querySelectorAll('.sidebar-right-category-wrapper:not(.dragging-cat)'));
                    const oldRects = allCats.map(el => ({ element: el, rect: el.getBoundingClientRect() }));
                    
                    if (next) {
                        parent.insertBefore(draggingCat, categoryWrapper.nextSibling);
                    } else {
                        parent.insertBefore(draggingCat, categoryWrapper);
                    }
                    
                    oldRects.forEach(({ element, rect }) => {
                        animateFLIP(element, rect);
                    });
                });
                categoryWrapper.addEventListener('dragend', () => {
                    categoryWrapper.classList.remove('dragging-cat');
                    draggedCatIndex = null;
                    saveCategoriesFromDOM();
                });
            }

            // Category Header
            const headerDiv = document.createElement('div');
            if (isEditMode) {
                headerDiv.className = 'category-header edit-state';
                
                const dragHandle = document.createElement('span');
                dragHandle.className = 'category-drag-handle';
                dragHandle.innerHTML = window.AppIcons.getSvg('drag', { width: 14, height: 14 });
                headerDiv.appendChild(dragHandle);

                const titleSpan = document.createElement('span');
                titleSpan.className = 'category-title-edit';
                titleSpan.textContent = category.title || '(Senza Titolo)';
                headerDiv.appendChild(titleSpan);

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'category-header-actions';

                // Edit Category
                const editCatBtn = document.createElement('button');
                editCatBtn.className = 'category-action-btn edit tooltip';
                editCatBtn.innerHTML = window.AppIcons.getSvg('edit', { width: 14, height: 14 }) + '<span class="tooltiptext">Rinomina</span>';
                editCatBtn.title = '';
                editCatBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showEditDialog(
                        "Modifica Categoria",
                        `
                        <div class="dialog-field">
                            <label>Titolo Categoria</label>
                            <input type="text" id="dialog-category-title" class="dialog-input" value="${escapeHtml(category.title)}" />
                        </div>
                        `,
                        () => {
                            const newTitle = document.getElementById('dialog-category-title').value.trim();
                            if (!newTitle) {
                                alert('Inserisci un nome per la categoria!');
                                return;
                            }
                            category.title = newTitle;
                            saveCategoriesAndRender();
                            editDialogModal.style.display = 'none';
                        }
                    );
                });
                actionsDiv.appendChild(editCatBtn);

                // Delete Category
                const deleteCatBtn = document.createElement('button');
                deleteCatBtn.className = 'category-action-btn delete tooltip';
                deleteCatBtn.innerHTML = window.AppIcons.getSvg('trash', { width: 14, height: 14 }) + '<span class="tooltiptext">Elimina Categoria</span>';
                deleteCatBtn.title = '';
                deleteCatBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const count = category.links ? category.links.length : 0;
                    let message = `Sei sicuro di voler eliminare la categoria "${category.title}"?`;
                    if (count > 0) {
                        message = `Attenzione: tutti i ${count} link all'interno saranno eliminati insieme alla categoria "${category.title}". Vuoi procedere?`;
                    }
                    if (confirm(message)) {
                        currentCategories.splice(catIndex, 1);
                        saveCategoriesAndRender();
                    }
                });
                actionsDiv.appendChild(deleteCatBtn);

                headerDiv.appendChild(actionsDiv);

                // If first category, also append toggle edit mode button (as checkmark) next to the other actions
                if (catIndex === 0) {
                    const editToggleBtn = document.createElement('button');
                    editToggleBtn.className = 'edit-mode-btn active';
                    editToggleBtn.innerHTML = window.AppIcons.getSvg('check', { width: 14, height: 14 });
                    editToggleBtn.title = 'Esci dalla modifica';
                    editToggleBtn.style.marginLeft = '8px';
                    editToggleBtn.addEventListener('click', toggleEditModeHandler);
                    headerDiv.appendChild(editToggleBtn);
                }
            } else {
                if ((category.title && category.title.trim() !== '') || catIndex === 0) {
                    headerDiv.className = 'category-header-non-edit';
                    headerDiv.style.marginTop = catIndex > 0 ? '20px' : '0px';
                    
                    if (category.title && category.title.trim() !== '') {
                        const h2 = document.createElement('h2');
                        h2.textContent = category.title;
                        h2.style.margin = '0';
                        h2.style.flexGrow = '1';
                        h2.style.fontSize = '14px';
                        headerDiv.appendChild(h2);
                    } else {
                        const spacer = document.createElement('div');
                        spacer.style.flexGrow = '1';
                        headerDiv.appendChild(spacer);
                    }

                    // If first category, append toggle edit mode button (pencil icon)
                    if (catIndex === 0) {
                        const editToggleBtn = document.createElement('button');
                        editToggleBtn.className = 'edit-mode-btn';
                        editToggleBtn.innerHTML = window.AppIcons.getSvg('editMode', { width: 14, height: 14 });
                        editToggleBtn.title = 'Modifica collegamenti';
                        editToggleBtn.style.marginLeft = '8px';
                        editToggleBtn.addEventListener('click', toggleEditModeHandler);
                        headerDiv.appendChild(editToggleBtn);
                    }
                }
            }
            categoryWrapper.appendChild(headerDiv);

            // Create grid container for links
            const appsGrid = document.createElement('div');
            appsGrid.className = 'apps';

            if (isEditMode) {
                appsGrid.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedCatIndex !== null) return;
                    
                    const draggingNode = document.querySelector('.app.dragging');
                    if (!draggingNode) return;
                    
                    if (e.target === appsGrid || e.target.classList.contains('apps')) {
                        const allLinks = Array.from(document.querySelectorAll('.app:not(.dragging)'));
                        const oldRects = allLinks.map(el => ({ element: el, rect: el.getBoundingClientRect() }));
                        
                        const addLinkTrigger = appsGrid.querySelector('.add-link-trigger');
                        if (addLinkTrigger) {
                            appsGrid.insertBefore(draggingNode, addLinkTrigger);
                        } else {
                            appsGrid.appendChild(draggingNode);
                        }
                        
                        oldRects.forEach(({ element, rect }) => {
                            animateFLIP(element, rect);
                        });
                    }
                });
            }
            const links = category.links || [];
            links.forEach((link, linkIndex) => {
                const appDiv = document.createElement('div');
                appDiv.className = 'app';
                appDiv.dataset.linkName = link.name;
                appDiv.dataset.linkUrl = link.url;
                appDiv.dataset.linkIcon = link.icon || '';
                if (isEditMode) {
                    appDiv.classList.add('edit-state');
                    appDiv.draggable = true;

                    appDiv.addEventListener('dragstart', (e) => {
                        draggedLinkIndex = linkIndex;
                        draggedLinkCatId = category.id;
                        appDiv.classList.add('dragging');
                        e.dataTransfer.effectAllowed = 'move';
                    });
                    appDiv.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        if (draggedCatIndex !== null) return;
                        
                        const draggingNode = document.querySelector('.app.dragging');
                        if (!draggingNode || draggingNode === appDiv) return;
                        
                        const parent = appDiv.parentNode;
                        const rect = appDiv.getBoundingClientRect();
                        const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
                        
                        const allLinks = Array.from(document.querySelectorAll('.app:not(.dragging)'));
                        const oldRects = allLinks.map(el => ({ element: el, rect: el.getBoundingClientRect() }));
                        
                        if (next) {
                            parent.insertBefore(draggingNode, appDiv.nextSibling);
                        } else {
                            parent.insertBefore(draggingNode, appDiv);
                        }
                        
                        oldRects.forEach(({ element, rect }) => {
                            animateFLIP(element, rect);
                        });
                    });
                    appDiv.addEventListener('dragend', () => {
                        appDiv.classList.remove('dragging');
                        draggedLinkIndex = null;
                        draggedLinkCatId = null;
                        saveCategoriesFromDOM();
                    });

                    // Edit button on link overlay (three dots)
                    const editBtn = document.createElement('button');
                    editBtn.className = 'app-action-btn edit tooltip';
                    editBtn.innerHTML = window.AppIcons.getSvg('edit', { width: 14, height: 14 }) + '<span class="tooltiptext">Modifica</span>';
                    editBtn.title = '';
                    editBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showEditDialog(
                            "Modifica Collegamento",
                            `
                            <div class="dialog-field">
                                <label>Nome Collegamento</label>
                                <input type="text" id="dialog-link-name" class="dialog-input" value="${escapeHtml(link.name)}" />
                            </div>
                            <div class="dialog-field">
                                <label>URL</label>
                                <input type="text" id="dialog-link-url" class="dialog-input" value="${escapeHtml(link.url)}" />
                            </div>
                            <div class="dialog-field">
                                <label>Icona Collegamento (URL o Carica File)</label>
                                <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                                    <input type="text" id="dialog-link-icon" class="dialog-input" style="flex-grow: 1;" value="${escapeHtml(link.icon || '')}" placeholder="Inserisci URL o carica file" />
                                    <input type="file" id="dialog-link-file" style="display: none;" accept="image/*" />
                                    <button type="button" id="dialog-link-file-btn" class="dialog-cancel-btn" style="margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 6px; box-sizing: border-box; flex-shrink: 0;" title="Carica file locale">
                                        ${window.AppIcons.getSvg('upload', { width: 16, height: 16 })}
                                    </button>
                                </div>
                            </div>
                            `,
                            () => {
                                const newName = document.getElementById('dialog-link-name').value.trim();
                                let newUrl = document.getElementById('dialog-link-url').value.trim();
                                const newIcon = document.getElementById('dialog-link-icon').value.trim();

                                if (!newName || !newUrl) {
                                    alert('Inserisci sia il nome che l\'URL del collegamento!');
                                    return;
                                }

                                if (!/^https?:\/\//i.test(newUrl)) {
                                    newUrl = 'https://' + newUrl;
                                }

                                category.links[linkIndex] = {
                                    name: newName,
                                    url: newUrl,
                                    icon: newIcon
                                };
                                saveCategoriesAndRender();
                                editDialogModal.style.display = 'none';
                            }
                        );
                        setupFileDialogListeners();
                    });
                    appDiv.appendChild(editBtn);

                    // Delete button on link overlay (red X)
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'app-action-btn delete tooltip';
                    deleteBtn.innerHTML = (window.AppIcons ? window.AppIcons.getSvg('trash', { width: 14, height: 14 }) : '') + '<span class="tooltiptext">Elimina Link</span>';
                    deleteBtn.title = '';
                    deleteBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirm(`Sei sicuro di voler eliminare il collegamento "${link.name}"?`)) {
                            category.links.splice(linkIndex, 1);
                            saveCategoriesAndRender();
                        }
                    });
                    appDiv.appendChild(deleteBtn);
                }

                const a = document.createElement('a');
                a.href = link.url;
                a.rel = 'nofollow';
                a.target = '_blank';
                a.addEventListener('click', (e) => {
                    if (isEditMode) {
                        e.preventDefault(); // Prevention of navigation in edit mode
                    }
                });

                const img = document.createElement('img');
                img.src = getIconUrl(link);
                img.alt = link.name;
                img.style.width = '35%';

                a.appendChild(img);
                appDiv.appendChild(a);
                appsGrid.appendChild(appDiv);
            });

            // In edit mode: Add placeholder '+' at the end of the category grid
            if (isEditMode) {
                const addLinkDiv = document.createElement('div');
                addLinkDiv.className = 'app add-link-trigger';
                
                addLinkDiv.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedCatIndex !== null) return;
                    
                    const draggingNode = document.querySelector('.app.dragging');
                    if (!draggingNode || draggingNode === addLinkDiv) return;
                    
                    const parent = addLinkDiv.parentNode;
                    const allLinks = Array.from(document.querySelectorAll('.app:not(.dragging)'));
                    const oldRects = allLinks.map(el => ({ element: el, rect: el.getBoundingClientRect() }));
                    
                    parent.insertBefore(draggingNode, addLinkDiv);
                    
                    oldRects.forEach(({ element, rect }) => {
                        animateFLIP(element, rect);
                    });
                });
                
                const plusBtn = document.createElement('div');
                plusBtn.className = 'add-link-btn-sidebar';
                plusBtn.innerHTML = window.AppIcons ? window.AppIcons.getSvg('plus', { width: 16, height: 16, strokeWidth: 3 }) : '';
                plusBtn.title = 'Aggiungi Link';
                plusBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showEditDialog(
                        "Aggiungi Collegamento",
                        `
                        <div class="dialog-field">
                            <label>Nome Collegamento</label>
                            <input type="text" id="dialog-link-name" class="dialog-input" placeholder="es. Wikipedia" />
                        </div>
                        <div class="dialog-field">
                            <label>URL</label>
                            <input type="text" id="dialog-link-url" class="dialog-input" placeholder="es. https://it.wikipedia.org" />
                        </div>
                        <div class="dialog-field">
                            <label>Icona Collegamento (URL o Carica File)</label>
                            <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                                <input type="text" id="dialog-link-icon" class="dialog-input" style="flex-grow: 1;" placeholder="es. images/wikipedia.svg" />
                                <input type="file" id="dialog-link-file" style="display: none;" accept="image/*" />
                                <button type="button" id="dialog-link-file-btn" class="dialog-cancel-btn" style="margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 6px; box-sizing: border-box; flex-shrink: 0;" title="Carica file locale">
                                    ${window.AppIcons.getSvg('upload', { width: 16, height: 16 })}
                                </button>
                            </div>
                        </div>
                        `,
                        () => {
                            const newName = document.getElementById('dialog-link-name').value.trim();
                            let newUrl = document.getElementById('dialog-link-url').value.trim();
                            const newIcon = document.getElementById('dialog-link-icon').value.trim();

                            if (!newName || !newUrl) {
                                alert('Inserisci sia il nome che l\'URL del collegamento!');
                                return;
                            }

                            if (!/^https?:\/\//i.test(newUrl)) {
                                newUrl = 'https://' + newUrl;
                            }

                            if (!category.links) category.links = [];
                            category.links.push({
                                name: newName,
                                url: newUrl,
                                icon: newIcon
                            });
                            saveCategoriesAndRender();
                            editDialogModal.style.display = 'none';
                        }
                    );
                    setupFileDialogListeners();
                });

                addLinkDiv.appendChild(plusBtn);
                appsGrid.appendChild(addLinkDiv);
            }

            categoryWrapper.appendChild(appsGrid);
            sectionDiv.appendChild(categoryWrapper);
        });

        // In edit mode: Add placeholder '+ Aggiungi Categoria' at the bottom of the categories list
        if (isEditMode) {
            const addCatWrapper = document.createElement('div');
            addCatWrapper.className = 'add-category-container';
            if (currentCategories.length === 0) {
                addCatWrapper.style.marginTop = '10px';
            }

            const addCatBtn = document.createElement('button');
            addCatBtn.className = 'add-category-btn-sidebar';
            addCatBtn.innerHTML = (window.AppIcons ? window.AppIcons.getSvg('plus', { width: 14, height: 14, strokeWidth: 3, style: 'vertical-align: middle; margin-right: 4px;' }) : '') + ' Aggiungi Categoria';
            addCatBtn.addEventListener('click', () => {
                showEditDialog(
                    "Aggiungi Categoria",
                    `
                    <div class="dialog-field">
                        <label>Nome Categoria</label>
                        <input type="text" id="dialog-category-title" class="dialog-input" placeholder="es. Studio" />
                    </div>
                    `,
                    () => {
                        const newTitle = document.getElementById('dialog-category-title').value.trim();
                        if (!newTitle) {
                            alert('Inserisci un nome per la categoria!');
                            return;
                        }
                        const id = 'cat_' + Date.now();
                        currentCategories.push({
                            id: id,
                            title: newTitle,
                            links: []
                        });
                        saveCategoriesAndRender();
                        editDialogModal.style.display = 'none';
                    }
                );
            });

            addCatWrapper.appendChild(addCatBtn);
            sectionDiv.appendChild(addCatWrapper);
        }

        container.appendChild(sectionDiv);
    }

    // Render right sidebar immediately on page load
    renderSidebar();

    // 3. Tab switching logic (Vertical layout)
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // Toggle active classes
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const content = document.getElementById(targetTab);
            if (content) content.classList.add('active');
        });
    });

    // 4. Open Settings Modal logic
    settingsBtn.addEventListener('click', () => {
        // Load Widget toggles state
        if (weatherEnabledToggle) {
            weatherEnabledToggle.checked = AppStorage.getItem('weather_enabled') === 'true';
            weatherEnabledToggle.dispatchEvent(new Event('change'));
        }
        if (chatEnabledToggle) {
            chatEnabledToggle.checked = AppStorage.getItem('chat_enabled') === 'true';
            chatEnabledToggle.dispatchEvent(new Event('change'));
        }
        if (spotifyEnabledToggle) {
            spotifyEnabledToggle.checked = AppStorage.getItem('spotify_enabled') !== 'false';
            spotifyEnabledToggle.dispatchEvent(new Event('change'));
        }
        if (pomodoroEnabledToggle) {
            pomodoroEnabledToggle.checked = AppStorage.getItem('pomodoro_enabled') === 'true';
            pomodoroEnabledToggle.dispatchEvent(new Event('change'));
        }
        if (countdownEnabledToggle) {
            countdownEnabledToggle.checked = AppStorage.getItem('countdown_enabled') === 'true';
            countdownEnabledToggle.dispatchEvent(new Event('change'));
        }
        if (sysmonitorEnabledToggle) {
            sysmonitorEnabledToggle.checked = AppStorage.getItem('sysmonitor_enabled') === 'true';
            sysmonitorEnabledToggle.dispatchEvent(new Event('change'));
        }
        if (stocksEnabledToggle) {
            stocksEnabledToggle.checked = AppStorage.getItem('stocks_enabled') === 'true';
            stocksEnabledToggle.dispatchEvent(new Event('change'));
        }
        if (converterEnabledToggle) {
            converterEnabledToggle.checked = AppStorage.getItem('converter_enabled') === 'true';
            converterEnabledToggle.dispatchEvent(new Event('change'));
        }

        if (chatProviderSelect) {
            chatProviderSelect.value = AppStorage.getItem('chat_provider') || 'openai';
        }

        if (chatModelInput) {
            chatModelInput.value = AppStorage.getItem('chat_model') || 'gpt-4o-mini';
        }

        if (chatEndpointInput) {
            chatEndpointInput.value = AppStorage.getItem('chat_endpoint') || 'https://api.openai.com/v1';
        }

        const profileNameInput = document.getElementById('settings-profile-name');
        if (profileNameInput) {
            profileNameInput.value = AppStorage.getItem('profile_name') || '';
            profileNameInput.placeholder = 'es. Mario';
        }

        if (chatKeyInput) {
            chatKeyInput.value = AppStorage.getItem('chat_api_key') || AppStorage.getItem('gemini_api_key') || '';
        }
        weatherInput.value = AppStorage.getItem('weather_api_key') || '';
        latInput.value = AppStorage.getItem('weather_lat') || DEFAULT_LAT;
        lonInput.value = AppStorage.getItem('weather_lon') || DEFAULT_LON;

        // Load Spotify fields
        const spotifyClientIdInput = document.getElementById('settings-spotify-client-id');
        if (spotifyClientIdInput) {
            spotifyClientIdInput.value = AppStorage.getItem('spotify_client_id') || '';
        }

        const spotifyRedirectUriInput = document.getElementById('settings-spotify-redirect-uri');
        if (spotifyRedirectUriInput) {
            spotifyRedirectUriInput.value = getExtensionRedirectUri();
        }

        const spotifyDisconnectContainer = document.getElementById('settings-spotify-disconnect-container');
        if (spotifyDisconnectContainer) {
            const hasRefreshToken = AppStorage.getItem('spotify_refresh_token');
            spotifyDisconnectContainer.style.display = hasRefreshToken ? 'block' : 'none';
        }


        // Load Google Calendar fields
        const googleClientIdInput = document.getElementById('settings-google-client-id');
        if (googleClientIdInput) {
            googleClientIdInput.value = AppStorage.getItem('google_client_id') || '';
        }

        const googleClientSecretInput = document.getElementById('settings-google-client-secret');
        if (googleClientSecretInput) {
            googleClientSecretInput.value = AppStorage.getItem('google_client_secret') || '';
        }

        const googleRedirectUriInput = document.getElementById('settings-google-redirect-uri');
        if (googleRedirectUriInput) {
            googleRedirectUriInput.value = getExtensionRedirectUri();
        }

        const googleDisconnectContainer = document.getElementById('settings-google-disconnect-container');
        if (googleDisconnectContainer) {
            // Usa l'helper esposto dal calendario per non disallinearsi dalla sidebar
            const connected = (typeof window.isGoogleCalendarConnected === 'function')
                ? window.isGoogleCalendarConnected()
                : Boolean(AppStorage.getItem('google_calendar_access_token'));
            googleDisconnectContainer.style.display = connected ? 'block' : 'none';
        }

        // Array vuoto = utente ha disattivato tutto: deve restare vuoto, niente fallback.
        let enabledCentralTabs = [];
        try {
            const storedCentralTabs = JSON.parse(AppStorage.getItem('central_tabs_enabled'));
            enabledCentralTabs = Array.isArray(storedCentralTabs) ? storedCentralTabs : ['calendar', 'rss', 'game'];
        } catch (e) {
            enabledCentralTabs = ['calendar', 'rss', 'game'];
        }
        
        const tabCalendarCheckbox = document.getElementById('settings-tab-calendar-enabled');
        if (tabCalendarCheckbox) tabCalendarCheckbox.checked = enabledCentralTabs.includes('calendar');
        
        const tabRssCheckbox = document.getElementById('settings-tab-rss-enabled');
        if (tabRssCheckbox) tabRssCheckbox.checked = enabledCentralTabs.includes('rss');

        // Riallineato come Calendar e RSS: senza questo lo switch ripartiva da "attivo"
        // (checked hardcoded in HTML) e il salvataggio successivo riaccendeva il Giochino.
        const tabGameCheckboxLoad = document.getElementById('settings-tab-game-enabled');
        if (tabGameCheckboxLoad) tabGameCheckboxLoad.checked = enabledCentralTabs.includes('game');
        
        if (defaultSearchEngineSelect) {
            defaultSearchEngineSelect.value = AppStorage.getItem('defaultSearchEngine') || 'google';
        }
        if (aiSearchEnabledToggle) {
            aiSearchEnabledToggle.checked = AppStorage.getItem('aiSearchEnabled') !== 'false';
        }

        renderIframeSitesList();
        renderRssFeedsList();

        hideSaveButton();
        settingsModal.style.display = 'flex';
    });

    // Close settings modal
    closeBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });



    // 8. Save Settings globally (both API keys and Categories/Links structure)
    saveBtn.addEventListener('click', () => {
        // Save Widget states
        if (weatherEnabledToggle) {
            AppStorage.setItem('weather_enabled', weatherEnabledToggle.checked ? 'true' : 'false');
        }
        if (chatEnabledToggle) {
            AppStorage.setItem('chat_enabled', chatEnabledToggle.checked ? 'true' : 'false');
        }
        if (spotifyEnabledToggle) {
            AppStorage.setItem('spotify_enabled', spotifyEnabledToggle.checked ? 'true' : 'false');
        }
        if (pomodoroEnabledToggle) {
            AppStorage.setItem('pomodoro_enabled', pomodoroEnabledToggle.checked ? 'true' : 'false');
        }
        if (countdownEnabledToggle) {
            AppStorage.setItem('countdown_enabled', countdownEnabledToggle.checked ? 'true' : 'false');
        }
        if (sysmonitorEnabledToggle) {
            AppStorage.setItem('sysmonitor_enabled', sysmonitorEnabledToggle.checked ? 'true' : 'false');
        }
        if (stocksEnabledToggle) {
            AppStorage.setItem('stocks_enabled', stocksEnabledToggle.checked ? 'true' : 'false');
        }
        if (converterEnabledToggle) {
            AppStorage.setItem('converter_enabled', converterEnabledToggle.checked ? 'true' : 'false');
        }

        // Save Central Column tab selections
        const enabledCentralTabs = [];
        const tabCalendarCheckbox = document.getElementById('settings-tab-calendar-enabled');
        const tabRssCheckbox = document.getElementById('settings-tab-rss-enabled');
        const tabGameCheckbox = document.getElementById('settings-tab-game-enabled');
        
        if (tabCalendarCheckbox && tabCalendarCheckbox.checked) enabledCentralTabs.push('calendar');
        if (tabRssCheckbox && tabRssCheckbox.checked) enabledCentralTabs.push('rss');
        if (tabGameCheckbox && tabGameCheckbox.checked) enabledCentralTabs.push('game');

        // Avvisa prima di salvare: senza tab (neanche iframe) la colonna centrale sparisce.
        // I link personalizzati non contano: sono tab a sé e vengono mostrati anche da sole.
        if (enabledCentralTabs.length === 0) {
            let hasIframeTabs = false;
            try {
                hasIframeTabs = Array.isArray(JSON.parse(AppStorage.getItem('central_tabs_iframes')))
                    && JSON.parse(AppStorage.getItem('central_tabs_iframes')).length > 0;
            } catch (e) {
                hasIframeTabs = false;
            }

            if (!hasIframeTabs) {
                const proceed = confirm(
                    'Attenzione: hai disattivato tutte le tab della Colonna Centrale.\n\n' +
                    'La colonna centrale (Calendario, Notizie e Giochino) verrà rimossa dalla pagina ' +
                    'e le altre due colonne si espanderanno per occupare lo spazio.\n\n' +
                    'Puoi sempre riattivarle da Impostazioni > Colonna Centrale.\n\n' +
                    'Vuoi continuare?'
                );
                if (!proceed) {
                    return;
                }
            }
        }

        AppStorage.setItem('central_tabs_enabled', JSON.stringify(enabledCentralTabs));

        // Se l'utente attiva almeno uno dei widget della colonna sinistra, salva widgets_activated_once
        const weatherActive = weatherEnabledToggle ? weatherEnabledToggle.checked : false;
        const chatActive = chatEnabledToggle ? chatEnabledToggle.checked : false;
        const pomodoroActive = pomodoroEnabledToggle ? pomodoroEnabledToggle.checked : false;
        const countdownActive = countdownEnabledToggle ? countdownEnabledToggle.checked : false;
        const sysmonitorActive = sysmonitorEnabledToggle ? sysmonitorEnabledToggle.checked : false;
        const stocksActive = stocksEnabledToggle ? stocksEnabledToggle.checked : false;
        const converterActive = converterEnabledToggle ? converterEnabledToggle.checked : false;

        if (weatherActive || chatActive || pomodoroActive || countdownActive || sysmonitorActive || stocksActive || converterActive) {
            AppStorage.setItem('widgets_activated_once', 'true');
        }

        if (chatProviderSelect) {
            AppStorage.setItem('chat_provider', chatProviderSelect.value);
        }
        if (chatModelInput) {
            AppStorage.setItem('chat_model', chatModelInput.value.trim() || 'gpt-4o-mini');
        }

        if (chatEndpointInput) {
            const savedChatEndpoint = chatEndpointInput.value.trim() || 'https://api.openai.com/v1';
            AppStorage.setItem('chat_endpoint', savedChatEndpoint);
            requestChatEndpointPermission(savedChatEndpoint);
        }

        const profileNameInputSave = document.getElementById('settings-profile-name');
        if (profileNameInputSave) {
            AppStorage.setItem('profile_name', profileNameInputSave.value.trim().slice(0, 30));
        }

        // Save API Keys
        const chatKey = chatKeyInput ? chatKeyInput.value.trim() : '';
        const weatherKey = weatherInput.value.trim();
        let lat = latInput.value.trim();
        let lon = lonInput.value.trim();

        if (!lat) lat = DEFAULT_LAT;
        if (!lon) lon = DEFAULT_LON;

        AppStorage.setItem('chat_api_key', chatKey);
        AppStorage.setItem('gemini_api_key', chatKey);
        AppStorage.setItem('weather_api_key', weatherKey);
        AppStorage.setItem('weather_lat', lat);
        AppStorage.setItem('weather_lon', lon);

        // Save Spotify Client ID
        const spotifyClientIdInput = document.getElementById('settings-spotify-client-id');
        if (spotifyClientIdInput) {
            AppStorage.setItem('spotify_client_id', spotifyClientIdInput.value.trim());
        }

        // Save Google Client ID (with format validation to catch redirect_uri_mismatch early)
        const googleClientIdInput = document.getElementById('settings-google-client-id');
        if (googleClientIdInput) {
            const gid = googleClientIdInput.value.trim();
            if (gid && !/^.*\.apps\.googleusercontent\.com$/.test(gid)) {
                alert('Attenzione: il Google Client ID non sembra valido (deve terminare con .apps.googleusercontent.com). Salvato comunque, ma il login fallirà con redirect_uri_mismatch se sbagliato.');
            }
            AppStorage.setItem('google_client_id', gid);
        }

        const googleClientSecretInput = document.getElementById('settings-google-client-secret');
        if (googleClientSecretInput) {
            AppStorage.setItem('google_client_secret', googleClientSecretInput.value.trim());
        }

        // Save Searchbar settings
        if (defaultSearchEngineSelect) {
            AppStorage.setItem('defaultSearchEngine', defaultSearchEngineSelect.value);
        }
        if (aiSearchEnabledToggle) {
            AppStorage.setItem('aiSearchEnabled', aiSearchEnabledToggle.checked ? 'true' : 'false');
        }



        settingsModal.style.display = 'none';

        // Applica le modifiche. La colonna centrale si aggiorna senza reload tramite
        // CentralTabs.refresh(); il reload resta per il resto dei moduli che non
        // espongono un refresh (widget sinistra, footer Spotify, ricerca).
        if (typeof window.CentralTabs?.refresh === 'function') {
            window.CentralTabs.refresh();
        }
        AppStorage.flush().finally(() => window.location.reload());
    });

    // Handle Disconnect Spotify Click
    const disconnectSpotifyBtn = document.getElementById('disconnect-spotify-btn');
    if (disconnectSpotifyBtn) {
        disconnectSpotifyBtn.addEventListener('click', () => {
            if (confirm('Sei sicuro di voler scollegare il tuo account Spotify?')) {
                if (window.logoutSpotify) {
                    window.logoutSpotify();
                    alert('Account Spotify scollegato con successo.');
                }
            }
        });
    }

    // Handle Disconnect Google Click
    const disconnectGoogleBtn = document.getElementById('disconnect-google-btn');
    if (disconnectGoogleBtn) {
        disconnectGoogleBtn.addEventListener('click', () => {
            if (confirm('Sei sicuro di voler scollegare il tuo account Google Calendar?')) {
                if (window.logoutGoogleCalendar) {
                    window.logoutGoogleCalendar();
                    // Il bottone non deve restare visibile dopo lo scollegamento
                    const container = document.getElementById('settings-google-disconnect-container');
                    if (container) container.style.display = 'none';
                    alert('Account Google Calendar scollegato con successo.');
                }
            }
        });
    }
    // Render and manage custom iframe sites in settings
    function renderIframeSitesList() {
        const listContainer = document.getElementById('iframe-sites-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        
        let iframes = [];
        try {
            iframes = JSON.parse(AppStorage.getItem('central_tabs_iframes')) || [];
        } catch (e) {
            iframes = [];
        }

        if (iframes.length === 0) {
            listContainer.innerHTML = '<div style="padding: 10px; color: #888; font-size: 12px; text-align: center;">Nessun sito configurato.</div>';
            return;
        }

        iframes.forEach((site, index) => {
            const item = document.createElement('div');
            item.className = 'link-manager-item';
            item.innerHTML = `
                <div class="link-item-info">
                    <div class="link-item-details">
                        <span class="link-item-name" style="font-size: 13px; font-weight: 500;">${escapeHtml(site.name)}</span>
                        <span class="link-item-url" style="font-size: 11px; color: #888;">${escapeHtml(site.url)}</span>
                    </div>
                </div>
                <div class="link-actions">
                    <button class="link-action-btn delete" style="font-size: 16px; font-weight: bold; background: none; border: none; color: #ff4444; cursor: pointer;">&times;</button>
                </div>
            `;
            
            item.querySelector('.delete').addEventListener('click', () => {
                iframes.splice(index, 1);
                AppStorage.setItem('central_tabs_iframes', JSON.stringify(iframes));
                renderIframeSitesList();
                if (typeof window.CentralTabs?.refresh === 'function') {
                    window.CentralTabs.refresh();
                }
            });
            
            listContainer.appendChild(item);
        });
    }

    // Legge i feed configurati o, se non esiste ancora la chiave, i default condivisi.
    // Restituisce sempre una copia per non mutare la lista globale.
    function getStoredRssFeeds() {
        try {
            const parsed = JSON.parse(AppStorage.getItem('rss_feeds'));
            if (Array.isArray(parsed)) return parsed;
        } catch (e) { /* fallback ai default */ }
        return (window.DEFAULT_RSS_FEEDS || []).map(feed => ({ ...feed }));
    }

    // Render and manage RSS feeds in settings
    function renderRssFeedsList() {
        const listContainer = document.getElementById('rss-feeds-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        const feeds = getStoredRssFeeds();

        if (feeds.length === 0) {
            listContainer.innerHTML = '<div style="padding: 10px; color: #888; font-size: 12px; text-align: center;">Nessun feed RSS configurato.</div>';
            return;
        }

        feeds.forEach((feed, index) => {
            const item = document.createElement('div');
            item.className = 'link-manager-item';
            item.innerHTML = `
                <div class="link-item-info">
                    <div class="link-item-details">
                        <span class="link-item-name" style="font-size: 13px; font-weight: 500;">${escapeHtml(feed.name)}</span>
                        <span class="link-item-url" style="font-size: 11px; color: #888;">${escapeHtml(feed.url)}</span>
                    </div>
                </div>
                <div class="link-actions">
                    <button class="link-action-btn delete" style="font-size: 16px; font-weight: bold; background: none; border: none; color: #ff4444; cursor: pointer;">&times;</button>
                </div>
            `;
            
            item.querySelector('.delete').addEventListener('click', () => {
                feeds.splice(index, 1);
                AppStorage.setItem('rss_feeds', JSON.stringify(feeds));
                renderRssFeedsList();
                if (typeof window.CentralTabs?.refresh === 'function') {
                    window.CentralTabs.refresh();
                }
            });
            
            listContainer.appendChild(item);
        });
    }

    // Add iframe site button handler
    const addIframeBtn = document.getElementById('add-iframe-btn');
    if (addIframeBtn) {
        addIframeBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('new-iframe-name');
            const urlInput = document.getElementById('new-iframe-url');
            const name = nameInput.value.trim();
            let url = urlInput.value.trim();

            if (!name || !url) {
                alert('Per favore inserisci sia il nome che l\'URL.');
                return;
            }

            if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }

            let iframes = [];
            try {
                iframes = JSON.parse(AppStorage.getItem('central_tabs_iframes')) || [];
            } catch (e) {
                iframes = [];
            }

            iframes.push({
                id: 'site_' + Date.now(),
                name: name,
                url: url
            });

            AppStorage.setItem('central_tabs_iframes', JSON.stringify(iframes));
            nameInput.value = '';
            urlInput.value = '';
            renderIframeSitesList();
            if (typeof window.CentralTabs?.refresh === 'function') {
                window.CentralTabs.refresh();
            }
        });
    }

    // Add RSS feed button handler
    const addRssBtn = document.getElementById('add-rss-btn');
    if (addRssBtn) {
        addRssBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('new-rss-name');
            const urlInput = document.getElementById('new-rss-url');
            const name = nameInput.value.trim();
            let url = urlInput.value.trim();

            if (!name || !url) {
                alert('Per favore inserisci sia il nome che l\'URL.');
                return;
            }

            if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }

            const feeds = getStoredRssFeeds();

            feeds.push({
                name: name,
                url: url
            });

            AppStorage.setItem('rss_feeds', JSON.stringify(feeds));
            nameInput.value = '';
            urlInput.value = '';
            renderRssFeedsList();
            if (typeof window.CentralTabs?.refresh === 'function') {
                window.CentralTabs.refresh();
            }
        });
    }

    // Backup (Import / Export) logic
    const exportBtn = document.getElementById('export-settings-btn');
    const importFile = document.getElementById('import-settings-file');
    const importBtnTrigger = document.getElementById('import-settings-btn-trigger');
    const importFilenameDisplay = document.getElementById('import-filename-display');
    const importBtn = document.getElementById('import-settings-btn');

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            try {
                const SENSITIVE_KEYS = new Set([
                    'chat_api_key', 'gemini_api_key', 'weather_api_key',
                    'spotify_client_id', 'google_client_id', 'google_client_secret',
                    'spotify_access_token', 'spotify_refresh_token', 'spotify_expires_at', 'spotify_code_verifier',
                    'google_calendar_access_token', 'google_calendar_expires_at',
                    'google_calendar_refresh_token', 'google_code_verifier'
                ]);
                const includeSecrets = confirm(
                    'Esportare anche le API key e i token OAuth?\n\n' +
                    'OK = includi tutto (comodo ma il file conterrà segreti in chiaro, non condividerlo).\n' +
                    'Annulla = escludi chiavi e token (consigliato per condivisioni/backup sicuri).'
                );
                const backup = { _meta: { app: 'custom-new-tab', version: 1, exportedAt: new Date().toISOString(), secretsIncluded: includeSecrets } };
                for (let i = 0; i < AppStorage.length; i++) {
                    const key = AppStorage.key(i);
                    if (!includeSecrets && SENSITIVE_KEYS.has(key)) continue;
                    const rawVal = AppStorage.getItem(key);
                    if (rawVal === null || rawVal === undefined) continue;

                    const trimmed = rawVal.trim();
                    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                        try {
                            backup[key] = JSON.parse(rawVal);
                        } catch (e) {
                            backup[key] = rawVal;
                        }
                    } else {
                        backup[key] = rawVal;
                    }
                }
                
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `newtab-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error("Errore durante l'esportazione delle impostazioni:", error);
                alert("Si è verificato un errore durante l'esportazione.");
            }
        });
    }

    function processImportFile(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!data || typeof data !== 'object' || Array.isArray(data)) {
                    throw new Error('Il file selezionato non contiene un JSON valido.');
                }

                const keys = Object.keys(data).filter(k => k !== '_meta');
                if (keys.length === 0) {
                    throw new Error('Il file di backup è vuoto.');
                }
                const meta = data._meta || {};
                const secretsNote = meta.secretsIncluded === false
                    ? '\nNota: questo backup NON contiene API key/token (dovrai reinserirli).'
                    : '\nAttenzione: questo backup contiene segreti in chiaro, non condividerlo.';

                const confirmImport = confirm(
                    `File di backup caricato: "${file.name}" (${keys.length} configurazioni trovate).${secretsNote}\n\n` +
                    "Sei sicuro di voler importare queste impostazioni? " +
                    "Tutti i dati e i link correnti verranno sovrascritti permanentemente.\n\n" +
                    "La pagina verrà ricaricata immediatamente al termine."
                );

                if (confirmImport) {
                    if (data.custom_links && Array.isArray(data.custom_links)) {
                        data.custom_links.forEach(cat => {
                            if (cat && Array.isArray(cat.links)) {
                                cat.links = cat.links.filter(l => l && typeof l.url === 'string' && /^https?:\/\//i.test(l.url.trim()));
                            }
                        });
                    }
                    if (data.central_tabs_iframes && Array.isArray(data.central_tabs_iframes)) {
                        data.central_tabs_iframes = data.central_tabs_iframes.filter(s => s && typeof s.url === 'string' && /^https?:\/\//i.test(s.url.trim()));
                    }
                    if (data.rss_feeds && Array.isArray(data.rss_feeds)) {
                        data.rss_feeds = data.rss_feeds.filter(f => f && typeof f.url === 'string' && /^https?:\/\//i.test(f.url.trim()));
                    }

                    AppStorage.clear();
                    keys.forEach(key => {
                        const val = data[key];
                        if (val === null || val === undefined) return;

                        if (typeof val === 'object') {
                            AppStorage.setItem(key, JSON.stringify(val));
                        } else {
                            AppStorage.setItem(key, String(val));
                        }
                    });

                    AppStorage.flush().finally(() => {
                        alert("Impostazioni importate con successo! Ricaricamento in corso...");
                        window.location.reload();
                    });
                }
            } catch (error) {
                console.error("Errore durante l'importazione delle impostazioni:", error);
                alert("Errore nell'importazione: " + error.message);
            }
        };
        reader.readAsText(file);
    }

    if (importBtnTrigger && importFile) {
        importBtnTrigger.addEventListener('click', () => {
            importFile.value = ''; // Reset input to allow selecting the same file again
            importFile.click();
        });

        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (importFilenameDisplay) importFilenameDisplay.textContent = file.name;
                if (importBtn) importBtn.style.display = 'block';
            } else {
                if (importFilenameDisplay) importFilenameDisplay.textContent = 'Nessun file selezionato';
                if (importBtn) importBtn.style.display = 'none';
            }
        });
    }

    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => {
            const file = importFile.files[0];
            if (file) {
                processImportFile(file);
            } else {
                alert("Seleziona prima un file JSON da importare.");
            }
        });
    }
});
