// arb-automation.js – Floating GUI + high-speed DOM observer
(function() {
    // ----- CONFIGURATION (editable via GUI or directly below) -----
    const DEFAULT_SELECTORS = {
        parentContainer: '.orders-list',     // element that contains all order items
        itemSelector:    '.order-card',      // each individual order container
        priceSelector:   '.price-value',     // element inside item that holds the price
        buttonSelector:  '.buy-button'       // buy button inside item
    };

    // ----- Global State -----
    let observer = null;
    let pollingInterval = null;
    let isRunning = false;
    let clickedSet = new WeakSet();          // prevent double‑clicking the same DOM node
    let currentAmount = null;                // target price (number)
    let selectors = { ...DEFAULT_SELECTORS };

    // ----- Helper: extract numeric price from text -----
    function extractPrice(priceElement) {
        if (!priceElement) return null;
        const text = priceElement.textContent.trim();
        // Remove any non-numeric characters except dot and minus (but keep digits, dot)
        const match = text.match(/[\d]+\.?[\d]*/);
        if (match) return parseFloat(match[0]);
        return null;
    }

    // ----- Check a single order container for a match -----
    function checkContainer(container) {
        if (!isRunning) return false;
        // Skip if container already triggered a click (WeakSet)
        if (clickedSet.has(container)) return false;

        const priceElem = container.querySelector(selectors.priceSelector);
        const buyButton = container.querySelector(selectors.buttonSelector);
        if (!priceElem || !buyButton) return false;

        const price = extractPrice(priceElem);
        if (price !== null && price === currentAmount) {
            // Mark as clicked to avoid duplicate processing
            clickedSet.add(container);
            // Random delay 50-100ms before clicking
            const delay = 50 + Math.random() * 50;
            setTimeout(() => {
                if (buyButton && isRunning) {
                    buyButton.click();
                    console.log(`[Auto] Clicked Buy at price ${price}`);
                }
            }, delay);
            return true;
        }
        return false;
    }

    // ----- Scan all existing containers (initial or periodic) -----
    function scanAllContainers() {
        if (!isRunning || !selectors.parentContainer) return;
        const parent = document.querySelector(selectors.parentContainer);
        if (!parent) return;
        const containers = parent.querySelectorAll(selectors.itemSelector);
        for (let container of containers) {
            checkContainer(container);
        }
    }

    // ----- MutationObserver callback – process only added nodes -----
    function onMutations(mutations) {
        if (!isRunning) return;
        for (let mutation of mutations) {
            if (mutation.type === 'childList') {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // If the added node itself is an order container
                        if (node.matches && node.matches(selectors.itemSelector)) {
                            checkContainer(node);
                        }
                        // Otherwise look for containers inside the added subtree
                        const containers = node.querySelectorAll ? node.querySelectorAll(selectors.itemSelector) : [];
                        for (let container of containers) {
                            checkContainer(container);
                        }
                    }
                }
            }
        }
    }

    // ----- Start monitoring -----
    function startMonitoring(amount, customSelectors = null) {
        if (isRunning) stopMonitoring();
        if (customSelectors) {
            selectors = { ...DEFAULT_SELECTORS, ...customSelectors };
        }
        currentAmount = amount;
        isRunning = true;

        // Find parent container to observe
        const parent = document.querySelector(selectors.parentContainer);
        if (!parent) {
            console.warn('[Auto] Parent container not found. Retrying in 1s...');
            setTimeout(() => {
                if (isRunning) startMonitoring(amount, selectors);
            }, 1000);
            return;
        }

        // Set up MutationObserver
        observer = new MutationObserver(onMutations);
        observer.observe(parent, { childList: true, subtree: true });

        // Also run a fast polling interval as a fallback (every 150ms)
        pollingInterval = setInterval(() => {
            scanAllContainers();
        }, 150);

        // Initial scan for already existing orders
        scanAllContainers();

        console.log('[Auto] Monitoring started, target amount:', amount);
    }

    // ----- Stop all processes -----
    function stopMonitoring() {
        isRunning = false;
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        console.log('[Auto] Monitoring stopped');
    }

    // ----- Build Floating GUI -----
    function createGUI() {
        // Remove existing GUI if any
        const existingGui = document.getElementById('arb-auto-gui');
        if (existingGui) existingGui.remove();

        const gui = document.createElement('div');
        gui.id = 'arb-auto-gui';
        gui.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 280px;
            background: #1e1e2f;
            color: #f0f0f0;
            border-radius: 12px;
            padding: 12px;
            font-family: 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border: 1px solid #444;
            backdrop-filter: blur(4px);
        `;

        gui.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 10px; display: flex; justify-content: space-between;">
                <span>🤖 ARB AutoBuy</span>
                <span id="auto-status" style="color:#ffaa66;">Idle</span>
            </div>
            <label style="display: block; margin-bottom: 6px;">🎯 Target Amount</label>
            <input type="number" id="auto-amount" placeholder="e.g. 100" step="any" style="width:100%; padding:6px; border-radius:6px; border:none; margin-bottom:12px; background:#2c2c3a; color:white;">
            
            <details style="margin-bottom:12px;">
                <summary style="cursor:pointer; font-size:12px; color:#aaa;">Advanced Selectors</summary>
                <div style="margin-top:8px;">
                    <label>Parent container:</label>
                    <input type="text" id="sel-parent" placeholder="${DEFAULT_SELECTORS.parentContainer}" style="width:100%; margin-bottom:6px; background:#2c2c3a; color:white; border:none; padding:4px;">
                    <label>Order item selector:</label>
                    <input type="text" id="sel-item" placeholder="${DEFAULT_SELECTORS.itemSelector}" style="width:100%; margin-bottom:6px; background:#2c2c3a; color:white; border:none; padding:4px;">
                    <label>Price element selector:</label>
                    <input type="text" id="sel-price" placeholder="${DEFAULT_SELECTORS.priceSelector}" style="width:100%; margin-bottom:6px; background:#2c2c3a; color:white; border:none; padding:4px;">
                    <label>Buy button selector:</label>
                    <input type="text" id="sel-button" placeholder="${DEFAULT_SELECTORS.buttonSelector}" style="width:100%; background:#2c2c3a; color:white; border:none; padding:4px;">
                </div>
            </details>
            
            <div style="display: flex; gap: 8px;">
                <button id="auto-start" style="flex:1; background:#2e7d32; border:none; padding:8px; border-radius:6px; color:white; font-weight:bold; cursor:pointer;">▶ Start</button>
                <button id="auto-stop" style="flex:1; background:#9a2e2e; border:none; padding:8px; border-radius:6px; color:white; font-weight:bold; cursor:pointer;">⏹ Stop</button>
            </div>
            <div style="font-size:11px; margin-top:8px; text-align:center; color:#aaa;">⚠️ Use correct selectors (Inspect element)</div>
        `;

        document.body.appendChild(gui);

        // DOM elements
        const amountInput = gui.querySelector('#auto-amount');
        const startBtn = gui.querySelector('#auto-start');
        const stopBtn = gui.querySelector('#auto-stop');
        const statusSpan = gui.querySelector('#auto-status');

        // Selector inputs
        const parentInput = gui.querySelector('#sel-parent');
        const itemInput = gui.querySelector('#sel-item');
        const priceInput = gui.querySelector('#sel-price');
        const buttonInput = gui.querySelector('#sel-button');

        // Helper: update status display
        function setStatus(text, isRunningFlag) {
            statusSpan.textContent = text;
            statusSpan.style.color = isRunningFlag ? '#8bc34a' : '#ffaa66';
        }

        // Start button handler
        startBtn.onclick = () => {
            const amount = parseFloat(amountInput.value);
            if (isNaN(amount)) {
                alert('Please enter a valid numeric target amount');
                return;
            }
            // Gather custom selectors (fallback to defaults if empty)
            const custom = {
                parentContainer: parentInput.value.trim() || DEFAULT_SELECTORS.parentContainer,
                itemSelector:    itemInput.value.trim()    || DEFAULT_SELECTORS.itemSelector,
                priceSelector:   priceInput.value.trim()   || DEFAULT_SELECTORS.priceSelector,
                buttonSelector:  buttonInput.value.trim()  || DEFAULT_SELECTORS.buttonSelector
            };
            startMonitoring(amount, custom);
            setStatus('Running', true);
        };

        // Stop button handler
        stopBtn.onclick = () => {
            stopMonitoring();
            setStatus('Idle', false);
        };
    }

    // ----- Initialize GUI after page loads -----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createGUI);
    } else {
        createGUI();
    }
})();
