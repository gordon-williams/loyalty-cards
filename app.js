// Loyalty Cards PWA - Main Application

(function() {
    'use strict';

    // State
    let cards = [];
    let settings = {
        theme: 'auto',
        sortBy: 'name'
    };
    let currentCard = null;
    let scanner = null;
    let currentLocation = null;
    let topCardId = null; // Track which card is shuffled to top

    // DOM Elements
    const elements = {
        cardsContainer: document.getElementById('cardsContainer'),
        emptyState: document.getElementById('emptyState'),
        searchInput: document.getElementById('searchInput'),
        categoryFilter: document.getElementById('categoryFilter'),

        // Modals
        cardModal: document.getElementById('cardModal'),
        detailModal: document.getElementById('detailModal'),
        scannerModal: document.getElementById('scannerModal'),
        settingsModal: document.getElementById('settingsModal'),
        backupModal: document.getElementById('backupModal'),

        // Form elements
        cardForm: document.getElementById('cardForm'),
        cardId: document.getElementById('cardId'),
        cardName: document.getElementById('cardName'),
        cardNumber: document.getElementById('cardNumber'),
        barcodeFormat: document.getElementById('barcodeFormat'),
        cardCategory: document.getElementById('cardCategory'),
        cardColor: document.getElementById('cardColor'),
        cardNotes: document.getElementById('cardNotes'),
        colorPicker: document.getElementById('colorPicker'),
        modalTitle: document.getElementById('modalTitle'),
        deleteCardBtn: document.getElementById('deleteCardBtn'),

        // Detail elements
        detailName: document.getElementById('detailName'),
        barcodeSvg: document.getElementById('barcodeSvg'),
        qrcodeCanvas: document.getElementById('qrcodeCanvas'),
        cardNumberDisplay: document.getElementById('cardNumberDisplay'),
        cardNotesDisplay: document.getElementById('cardNotesDisplay'),

        // Settings
        themeSelect: document.getElementById('themeSelect'),
        sortSelect: document.getElementById('sortSelect'),

        // Scanner
        scannerView: document.getElementById('scannerView'),
        imageInput: document.getElementById('imageInput'),

        // Backup
        importInput: document.getElementById('importInput'),

        // Location
        cardLocationText: document.getElementById('cardLocationText'),
        cardLat: document.getElementById('cardLat'),
        cardLng: document.getElementById('cardLng'),
        addressSearch: document.getElementById('addressSearch'),
        searchResults: document.getElementById('searchResults'),

        // Toast
        toast: document.getElementById('toast')
    };

    // Initialize
    function init() {
        loadData();
        applyTheme();
        renderCards();
        setupEventListeners();
        registerServiceWorker();
        getCurrentLocation();
    }

    // Data Management
    function loadData() {
        try {
            const savedCards = localStorage.getItem('loyaltyCards');
            const savedSettings = localStorage.getItem('loyaltySettings');

            if (savedCards) {
                cards = JSON.parse(savedCards);
            }
            if (savedSettings) {
                settings = { ...settings, ...JSON.parse(savedSettings) };
            }
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }

    function saveCards() {
        try {
            localStorage.setItem('loyaltyCards', JSON.stringify(cards));
        } catch (e) {
            console.error('Error saving cards:', e);
            showToast('Error saving cards');
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem('loyaltySettings', JSON.stringify(settings));
        } catch (e) {
            console.error('Error saving settings:', e);
        }
    }

    // Theme
    function applyTheme() {
        const theme = settings.theme;
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        elements.themeSelect.value = theme;
    }

    // Card Rendering
    function renderCards() {
        // Reset top card when filters change
        topCardId = null;

        const searchTerm = elements.searchInput.value.toLowerCase();
        const activeCategory = document.querySelector('.category-btn.active')?.dataset.category || 'all';

        let filteredCards = cards.filter(card => {
            const matchesSearch = card.name.toLowerCase().includes(searchTerm) ||
                                  card.cardNumber.toLowerCase().includes(searchTerm);

            if (activeCategory === 'nearby') {
                // Only show cards with location that are within 1km
                if (!card.lat || !card.lng || !currentLocation) return false;
                const distance = calculateDistance(
                    currentLocation.lat, currentLocation.lng,
                    card.lat, card.lng
                );
                return matchesSearch && distance <= 1;
            }

            const matchesCategory = activeCategory === 'all' || card.category === activeCategory;
            return matchesSearch && matchesCategory;
        });

        // Sort cards - by distance if nearby, otherwise use settings
        if (activeCategory === 'nearby' && currentLocation) {
            filteredCards = filteredCards.sort((a, b) => {
                const distA = calculateDistance(currentLocation.lat, currentLocation.lng, a.lat, a.lng);
                const distB = calculateDistance(currentLocation.lat, currentLocation.lng, b.lat, b.lng);
                return distA - distB;
            });
        } else {
            filteredCards = sortCards(filteredCards);
        }

        // Clear container
        elements.cardsContainer.innerHTML = '';

        if (filteredCards.length === 0) {
            elements.emptyState.style.display = 'flex';
            elements.cardsContainer.appendChild(elements.emptyState);
        } else {
            elements.emptyState.style.display = 'none';
            filteredCards.forEach(card => {
                elements.cardsContainer.appendChild(createCardElement(card));
            });
        }
    }

    function sortCards(cardsList) {
        switch (settings.sortBy) {
            case 'name':
                return cardsList.sort((a, b) => a.name.localeCompare(b.name));
            case 'recent':
                return cardsList.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
            case 'category':
                return cardsList.sort((a, b) => a.category.localeCompare(b.category));
            default:
                return cardsList;
        }
    }

    function createCardElement(card, animateIn = true) {
        const div = document.createElement('div');
        div.className = animateIn ? 'loyalty-card animate-in' : 'loyalty-card';
        div.dataset.id = card.id;

        // Remove animate-in class after animation completes
        if (animateIn) {
            setTimeout(() => div.classList.remove('animate-in'), 500);
        }

        // Extract suburb from location name
        // Location is stored as "Business Name, Suburb" (first 2 parts of Nominatim result)
        // We want just the suburb (second part)
        let suburb = '';
        if (card.locationName) {
            const parts = card.locationName.split(',').map(p => p.trim());
            // If there are multiple parts, take the second one (suburb)
            // If only one part, use it (might be just a suburb name)
            suburb = parts.length > 1 ? parts[1] : parts[0];
        }
        const locationDisplay = suburb ? `<span class="card-location">${escapeHtml(suburb)}</span>` : '';

        div.innerHTML = `
            <div class="card-header" style="background: ${card.color}">
                <h3>${escapeHtml(card.name)}</h3>
                <div class="card-meta">
                    <span class="card-category">${card.category}</span>
                    ${locationDisplay}
                </div>
                ${card.favorite ? '<svg class="card-favorite active" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' : ''}
            </div>
            <div class="card-body">
                <div class="card-barcode-preview" id="preview-${card.id}"></div>
            </div>
            <p class="card-number-preview">${formatCardNumber(card.cardNumber)}</p>
        `;

        // Generate preview barcode
        setTimeout(() => generatePreviewBarcode(card), 10);

        // Long press to edit (touch devices)
        let pressTimer = null;
        let didLongPress = false;

        div.addEventListener('touchstart', (e) => {
            didLongPress = false;
            pressTimer = setTimeout(() => {
                didLongPress = true;
                currentCard = card;
                openEditCard();
            }, 500);
        });

        div.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });

        div.addEventListener('touchmove', () => {
            clearTimeout(pressTimer);
        });

        // Right-click to edit (desktop/simulator)
        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            currentCard = card;
            openEditCard();
        });

        // Click: select card if not selected, otherwise open fullscreen
        div.addEventListener('click', (e) => {
            if (didLongPress) {
                didLongPress = false;
                return;
            }
            if (topCardId !== card.id) {
                selectCard(card.id);
            } else {
                openFullscreen();
            }
        });

        return div;
    }

    function selectCard(cardId) {
        topCardId = cardId;

        const card = cards.find(c => c.id === cardId);
        if (card) {
            card.lastUsed = Date.now();
            currentCard = card;
            saveCards();
        }

        const allCards = Array.from(document.querySelectorAll('.loyalty-card'));
        const selectedIndex = allCards.findIndex(el => el.dataset.id === cardId);

        // Move selected card to vertical center of container
        const container = document.querySelector('.cards-container');
        const containerRect = container.getBoundingClientRect();
        const containerCenterY = containerRect.top + (containerRect.height / 2);

        allCards.forEach((el, index) => {
            if (el.dataset.id === cardId) {
                el.classList.add('selected-card');
                el.classList.remove('slide-away');

                // Calculate how far to move to center the card vertically
                const cardRect = el.getBoundingClientRect();
                const cardCenterY = cardRect.top + (cardRect.height / 2);
                const moveY = containerCenterY - cardCenterY;

                el.style.transform = `translateY(${moveY}px)`;
            } else {
                // All other cards slide away
                el.classList.add('slide-away');
                el.classList.remove('selected-card');
                el.style.transform = '';
            }
        });
    }

    function deselectCard() {
        topCardId = null;
        currentCard = null;

        document.querySelectorAll('.loyalty-card').forEach(el => {
            el.classList.remove('selected-card', 'slide-away');
            el.style.transform = '';
        });
    }

    function generatePreviewBarcode(card) {
        const container = document.getElementById(`preview-${card.id}`);
        if (!container) return;

        try {
            if (card.barcodeFormat === 'QR') {
                const canvas = document.createElement('canvas');
                container.appendChild(canvas);
                QRCode.toCanvas(canvas, card.cardNumber, {
                    width: 50,
                    margin: 1
                });
            } else {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                container.appendChild(svg);
                JsBarcode(svg, card.cardNumber, {
                    format: card.barcodeFormat,
                    height: 40,
                    displayValue: false,
                    margin: 5
                });
            }
        } catch (e) {
            container.innerHTML = '<span style="font-size:10px;color:#999">Invalid</span>';
        }
    }

    // Card Detail
    function openCardDetail(card) {
        currentCard = card;

        // Update last used
        card.lastUsed = Date.now();
        saveCards();

        elements.detailName.textContent = card.name;
        elements.cardNumberDisplay.textContent = formatCardNumber(card.cardNumber);
        elements.cardNotesDisplay.textContent = card.notes || '';

        // Generate barcode
        generateDetailBarcode(card);

        openModal(elements.detailModal);
    }

    function generateDetailBarcode(card) {
        elements.barcodeSvg.innerHTML = '';
        elements.qrcodeCanvas.style.display = 'none';
        elements.barcodeSvg.style.display = 'none';

        try {
            if (card.barcodeFormat === 'QR') {
                elements.qrcodeCanvas.style.display = 'block';
                QRCode.toCanvas(elements.qrcodeCanvas, card.cardNumber, {
                    width: 250,
                    margin: 2
                });
            } else {
                elements.barcodeSvg.style.display = 'block';
                JsBarcode(elements.barcodeSvg, card.cardNumber, {
                    format: card.barcodeFormat,
                    height: 100,
                    displayValue: false,
                    margin: 10,
                    background: 'transparent'
                });
            }
        } catch (e) {
            console.error('Barcode generation error:', e);
            showToast('Error generating barcode');
        }
    }

    // Fullscreen Mode
    function openFullscreen() {
        if (!currentCard) return;

        const div = document.createElement('div');
        div.className = 'fullscreen-barcode';
        div.innerHTML = `
            <button class="close-fullscreen" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <div id="fullscreen-barcode-container"></div>
            <p class="fullscreen-number">${formatCardNumber(currentCard.cardNumber)}</p>
            <p class="fullscreen-name">${escapeHtml(currentCard.name)}</p>
        `;

        document.body.appendChild(div);

        // Generate large barcode
        const container = div.querySelector('#fullscreen-barcode-container');
        try {
            if (currentCard.barcodeFormat === 'QR') {
                const canvas = document.createElement('canvas');
                container.appendChild(canvas);
                QRCode.toCanvas(canvas, currentCard.cardNumber, {
                    width: Math.min(window.innerWidth * 0.8, 400),
                    margin: 2
                });
            } else {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                container.appendChild(svg);
                JsBarcode(svg, currentCard.cardNumber, {
                    format: currentCard.barcodeFormat,
                    height: 150,
                    width: 3,
                    displayValue: false,
                    margin: 20,
                    background: 'transparent'
                });
            }
        } catch (e) {
            container.innerHTML = '<p>Error generating barcode</p>';
        }

        // Request screen wake lock if available
        if ('wakeLock' in navigator) {
            navigator.wakeLock.request('screen').catch(() => {});
        }

        // Close handler - close fullscreen and show all cards
        div.querySelector('.close-fullscreen').addEventListener('click', (e) => {
            e.stopPropagation();
            div.remove();
            deselectCard();
        });

        div.addEventListener('click', (e) => {
            if (e.target === div) {
                e.stopPropagation();
                div.remove();
                deselectCard();
            }
        });
    }

    // Add/Edit Card
    function openAddCard() {
        currentCard = null;
        elements.modalTitle.textContent = 'Add Card';
        elements.cardForm.reset();
        elements.cardId.value = '';
        elements.cardColor.value = '#6366f1';
        elements.cardLat.value = '';
        elements.cardLng.value = '';
        elements.cardLocationText.textContent = 'No location set';
        elements.addressSearch.value = '';
        elements.searchResults.innerHTML = '';
        elements.deleteCardBtn.style.display = 'none';

        // Reset color picker
        document.querySelectorAll('.color-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === '#6366f1');
        });

        openModal(elements.cardModal);
    }

    function openEditCard() {
        if (!currentCard) return;

        elements.modalTitle.textContent = 'Edit Card';
        elements.cardId.value = currentCard.id;
        elements.cardName.value = currentCard.name;
        elements.cardNumber.value = currentCard.cardNumber;
        elements.barcodeFormat.value = currentCard.barcodeFormat;
        elements.cardCategory.value = currentCard.category;
        elements.cardColor.value = currentCard.color;
        elements.cardNotes.value = currentCard.notes || '';
        elements.cardLat.value = currentCard.lat || '';
        elements.cardLng.value = currentCard.lng || '';
        elements.cardLocationText.textContent = currentCard.lat && currentCard.lng
            ? (currentCard.locationName || `${currentCard.lat.toFixed(5)}, ${currentCard.lng.toFixed(5)}`)
            : 'No location set';
        elements.addressSearch.value = '';
        elements.searchResults.innerHTML = '';
        elements.deleteCardBtn.style.display = 'block';

        // Update color picker
        document.querySelectorAll('.color-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === currentCard.color);
        });

        closeModal(elements.detailModal);
        openModal(elements.cardModal);
    }

    function saveCard(e) {
        e.preventDefault();

        const cardData = {
            id: elements.cardId.value || generateId(),
            name: elements.cardName.value.trim(),
            cardNumber: elements.cardNumber.value.trim(),
            barcodeFormat: elements.barcodeFormat.value,
            category: elements.cardCategory.value,
            color: elements.cardColor.value,
            notes: elements.cardNotes.value.trim(),
            lat: elements.cardLat.value ? parseFloat(elements.cardLat.value) : null,
            lng: elements.cardLng.value ? parseFloat(elements.cardLng.value) : null,
            locationName: elements.cardLat.value ? elements.cardLocationText.textContent : null,
            createdAt: Date.now(),
            lastUsed: Date.now()
        };

        // Validate barcode
        if (!validateBarcode(cardData.cardNumber, cardData.barcodeFormat)) {
            showToast('Invalid barcode format');
            return;
        }

        const existingIndex = cards.findIndex(c => c.id === cardData.id);
        if (existingIndex >= 0) {
            cardData.createdAt = cards[existingIndex].createdAt;
            cards[existingIndex] = cardData;
        } else {
            cards.push(cardData);
        }

        saveCards();
        renderCards();
        closeModal(elements.cardModal);
        showToast(existingIndex >= 0 ? 'Card updated' : 'Card added');
    }

    function deleteCard() {
        if (!currentCard) return;

        if (confirm(`Delete "${currentCard.name}"?`)) {
            cards = cards.filter(c => c.id !== currentCard.id);
            saveCards();
            renderCards();
            closeModal(elements.cardModal);
            showToast('Card deleted');
        }
    }

    // Barcode Validation
    function validateBarcode(value, format) {
        if (!value) return false;

        switch (format) {
            case 'EAN13':
                return /^\d{13}$/.test(value);
            case 'EAN8':
                return /^\d{8}$/.test(value);
            case 'UPC':
                return /^\d{12}$/.test(value);
            case 'CODE39':
                return /^[A-Z0-9\-\.\ \$\/\+\%]+$/i.test(value);
            case 'ITF':
                return /^\d+$/.test(value) && value.length % 2 === 0;
            case 'QR':
            case 'CODE128':
            default:
                return value.length > 0;
        }
    }

    // Scanner
    function openScanner() {
        openModal(elements.scannerModal);

        setTimeout(() => {
            if (scanner) {
                scanner.clear();
            }

            scanner = new Html5Qrcode('scannerView');
            scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 150 }
                },
                onScanSuccess,
                () => {}
            ).catch(err => {
                console.error('Scanner error:', err);
                showToast('Camera access denied');
            });
        }, 300);
    }

    function closeScanner() {
        if (scanner) {
            scanner.stop().then(() => {
                scanner.clear();
            }).catch(() => {});
        }
        closeModal(elements.scannerModal);
    }

    function onScanSuccess(decodedText, decodedResult) {
        // Determine format
        let format = 'CODE128';
        const formatName = decodedResult.result?.format?.formatName;

        if (formatName) {
            if (formatName.includes('QR')) format = 'QR';
            else if (formatName.includes('EAN_13')) format = 'EAN13';
            else if (formatName.includes('EAN_8')) format = 'EAN8';
            else if (formatName.includes('UPC_A')) format = 'UPC';
            else if (formatName.includes('CODE_39')) format = 'CODE39';
            else if (formatName.includes('ITF')) format = 'ITF';
        }

        closeScanner();

        // Pre-fill the add card form
        elements.cardNumber.value = decodedText;
        elements.barcodeFormat.value = format;
        openAddCard();
        elements.cardNumber.value = decodedText;
        elements.barcodeFormat.value = format;

        showToast('Barcode scanned');
    }

    function scanFromImage(file) {
        if (!file) return;

        const html5QrCode = new Html5Qrcode('scannerView');
        html5QrCode.scanFile(file, true)
            .then(result => {
                onScanSuccess(result, { result: {} });
            })
            .catch(err => {
                console.error('Image scan error:', err);
                showToast('No barcode found in image');
            });
    }

    // Backup
    function exportCards() {
        const data = {
            version: 1,
            exportDate: new Date().toISOString(),
            cards: cards,
            settings: settings
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `loyalty-cards-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Backup exported');
        closeModal(elements.backupModal);
    }

    function importCards(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (!data.cards || !Array.isArray(data.cards)) {
                    throw new Error('Invalid backup file');
                }

                // Merge cards
                const importedIds = new Set(data.cards.map(c => c.id));
                const existingCards = cards.filter(c => !importedIds.has(c.id));
                cards = [...existingCards, ...data.cards];

                if (data.settings) {
                    settings = { ...settings, ...data.settings };
                    saveSettings();
                    applyTheme();
                }

                saveCards();
                renderCards();
                showToast(`Imported ${data.cards.length} cards`);
                closeModal(elements.backupModal);
            } catch (err) {
                console.error('Import error:', err);
                showToast('Invalid backup file');
            }
        };
        reader.readAsText(file);
    }

    // Modal Helpers
    function openModal(modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Utility Functions
    function generateId() {
        return 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatCardNumber(number) {
        // Add spaces every 4 characters for readability
        return number.replace(/(.{4})/g, '$1 ').trim();
    }

    function showToast(message) {
        elements.toast.textContent = message;
        elements.toast.classList.add('show');
        setTimeout(() => {
            elements.toast.classList.remove('show');
        }, 3000);
    }

    // Geolocation
    function getCurrentLocation() {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    currentLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    console.log('Location obtained:', currentLocation);
                    // Re-render if on nearby filter
                    const activeCategory = document.querySelector('.category-btn.active')?.dataset.category;
                    if (activeCategory === 'nearby') {
                        renderCards();
                    }
                },
                (error) => {
                    console.log('Location error:', error.message);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
    }

    function captureCardLocation() {
        if (!('geolocation' in navigator)) {
            showToast('Geolocation not supported');
            return;
        }

        showToast('Getting location...');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                setCardLocation(lat, lng, 'Current location');
                showToast('Location captured');
            },
            (error) => {
                showToast('Could not get location');
                console.error('Geolocation error:', error);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    function setCardLocation(lat, lng, displayName) {
        elements.cardLat.value = lat;
        elements.cardLng.value = lng;
        elements.cardLocationText.textContent = displayName || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        elements.searchResults.innerHTML = '';
        elements.addressSearch.value = '';
    }

    function clearCardLocation() {
        elements.cardLat.value = '';
        elements.cardLng.value = '';
        elements.cardLocationText.textContent = 'No location set';
        elements.searchResults.innerHTML = '';
        elements.addressSearch.value = '';
    }

    async function searchAddress() {
        const query = elements.addressSearch.value.trim();
        if (!query) {
            showToast('Enter an address to search');
            return;
        }

        // Auto-append the business name to improve search results
        const storeName = elements.cardName.value.trim();
        const fullQuery = storeName ? `${storeName} ${query}` : query;

        showToast('Searching...');
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=5`,
                { headers: { 'User-Agent': 'LoyaltyCardsApp/1.0' } }
            );
            const results = await response.json();

            elements.searchResults.innerHTML = '';

            if (results.length === 0) {
                showToast('No results found');
                return;
            }

            results.forEach(result => {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.textContent = result.display_name;
                div.addEventListener('click', () => {
                    setCardLocation(
                        parseFloat(result.lat),
                        parseFloat(result.lon),
                        result.display_name.split(',').slice(0, 2).join(',')
                    );
                    showToast('Location set');
                });
                elements.searchResults.appendChild(div);
            });
        } catch (error) {
            console.error('Search error:', error);
            showToast('Search failed');
        }
    }

    function calculateDistance(lat1, lng1, lat2, lng2) {
        // Haversine formula for distance in km
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Service Worker - optional, only register if serving over HTTPS or localhost
    function registerServiceWorker() {
        // Skip service worker registration for simple HTTP servers
        const isSecure = location.protocol === 'https:';
        const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

        if ('serviceWorker' in navigator && (isSecure || isLocalhost)) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => {
                    console.log('Service Worker registered');
                })
                .catch(err => {
                    console.error('Service Worker registration failed:', err);
                });
        } else {
            console.log('Service Worker skipped (HTTP or unsupported)');
        }
    }

    // Event Listeners
    function setupEventListeners() {
        // Navigation
        document.getElementById('addBtn').addEventListener('click', openAddCard);
        document.getElementById('scanBtn').addEventListener('click', openScanner);
        document.getElementById('backupBtn').addEventListener('click', () => openModal(elements.backupModal));
        document.getElementById('settingsBtn').addEventListener('click', () => openModal(elements.settingsModal));

        // Search
        elements.searchInput.addEventListener('input', debounce(renderCards, 200));

        // Category filter
        elements.categoryFilter.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-btn')) {
                document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                renderCards();
            }
        });

        // Click on cards container background to deselect
        elements.cardsContainer.addEventListener('click', (e) => {
            if (e.target === elements.cardsContainer && topCardId) {
                deselectCard();
            }
        });

        // Card form
        elements.cardForm.addEventListener('submit', saveCard);
        elements.deleteCardBtn.addEventListener('click', deleteCard);

        // Location buttons
        document.getElementById('captureLocationBtn').addEventListener('click', captureCardLocation);
        document.getElementById('clearLocationBtn').addEventListener('click', clearCardLocation);
        document.getElementById('searchAddressBtn').addEventListener('click', searchAddress);
        elements.addressSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchAddress();
            }
        });

        // Color picker
        elements.colorPicker.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-option')) {
                document.querySelectorAll('.color-option').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                elements.cardColor.value = e.target.dataset.color;
            }
        });

        // Detail modal
        document.getElementById('editCardBtn').addEventListener('click', openEditCard);
        document.getElementById('fullscreenBtn').addEventListener('click', openFullscreen);

        // Close modals
        document.getElementById('closeModal').addEventListener('click', () => closeModal(elements.cardModal));
        document.getElementById('closeDetail').addEventListener('click', () => closeModal(elements.detailModal));
        document.getElementById('closeScannerModal').addEventListener('click', closeScanner);
        document.getElementById('closeSettings').addEventListener('click', () => closeModal(elements.settingsModal));
        document.getElementById('closeBackup').addEventListener('click', () => closeModal(elements.backupModal));

        // Close on backdrop click
        [elements.cardModal, elements.detailModal, elements.scannerModal, elements.settingsModal, elements.backupModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    if (modal === elements.scannerModal) {
                        closeScanner();
                    } else {
                        closeModal(modal);
                    }
                }
            });
        });

        // Settings
        elements.themeSelect.addEventListener('change', (e) => {
            settings.theme = e.target.value;
            saveSettings();
            applyTheme();
        });

        elements.sortSelect.addEventListener('change', (e) => {
            settings.sortBy = e.target.value;
            saveSettings();
            renderCards();
        });

        // Scanner
        document.getElementById('uploadImageBtn').addEventListener('click', () => {
            elements.imageInput.click();
        });

        elements.imageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                scanFromImage(e.target.files[0]);
            }
        });

        // Backup
        document.getElementById('exportBtn').addEventListener('click', exportCards);
        document.getElementById('importBtn').addEventListener('click', () => {
            elements.importInput.click();
        });

        elements.importInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                importCards(e.target.files[0]);
            }
        });

        // Theme change listener
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (settings.theme === 'auto') {
                applyTheme();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (elements.scannerModal.classList.contains('active')) {
                    closeScanner();
                } else if (elements.cardModal.classList.contains('active')) {
                    closeModal(elements.cardModal);
                } else if (elements.detailModal.classList.contains('active')) {
                    closeModal(elements.detailModal);
                } else if (elements.settingsModal.classList.contains('active')) {
                    closeModal(elements.settingsModal);
                } else if (elements.backupModal.classList.contains('active')) {
                    closeModal(elements.backupModal);
                }
            }
        });
    }

    // Debounce helper
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
