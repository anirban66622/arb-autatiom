// Arb-automation.js

// MutationObserver to detect text content changes
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
            // Logic to handle changes in price detection
            updatePrice();
        }
    });
});

// Set observer options
const observerOptions = {
    childList: true,
    characterData: true,
    subtree: true
};

// Start observing the target node
const targetNode = document.getElementById('price-element-id'); // Replace with actual id
observer.observe(targetNode, observerOptions);

// Reduce polling interval
setInterval(() => {
    updatePrice();
}, 50); // Reduced from 150ms to 50ms

// Improved price extraction logic
function updatePrice() {
    const priceElement = document.getElementById('price-element-id'); // Replace with actual id
    if (priceElement) {
        const price = parseFloat(priceElement.textContent.replace(/[^0-9.-]+/g, ''));
        if (!isNaN(price)) {
            console.log(`Current price: ${price}`);
            // Additional logic for price update
        }
    }
}