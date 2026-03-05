// 1. Aapka Sheety API URL
const API_URL = 'https://api.sheety.co/e6ca57df3adfe2f877322d0ded669751/marketPricesTemplate/marketPricesTemplate';

let marketData = []; // Khali array jo API se bharega

// 2. Render Function (Cards banane ke liye)
function renderItems(data) {
    const grid = document.getElementById('itemsGrid');
    grid.innerHTML = "";

    if (!data || data.length === 0) {
        grid.innerHTML = `<div style="text-align:center; padding:40px; color:#b2bec3;">Data load ho raha hai... 🔄</div>`;
        return;
    }

    data.forEach(item => {
        grid.innerHTML += `
            <div class="card">
                <div class="item-info">
                    <span class="title">${item.name}</span>
                    <small style="color: #b2bec3;">${item.category}</small>
                </div>
                <div class="price-section">
                    <span class="price-val">₹${item.price}</span>
                    <small class="unit-text">/${item.unit}</small>
                    <div class="trend-${item.type || 'down'}">${item.trend || 'Stable'}</div>
                </div>
            </div>
        `;
    });
}

// 3. API se Data khinchne wala Function
async function fetchLivePrices() {
    try {
        const response = await fetch(API_URL);
        const json = await response.json();
        
        // Sheety hamesha sheet ke naam ka object deta hai (e.g., json.marketPricesTemplate)
        marketData = json.marketPricesTemplate; 
        renderItems(marketData);
    } catch (error) {
        console.error("Error fetching data:", error);
        document.getElementById('itemsGrid').innerHTML = "Mandi data load nahi ho paya. ⚠️";
    }
}

// 4. Sab kuch setup karna jab page load ho
document.addEventListener("DOMContentLoaded", () => {
    fetchLivePrices();

    // Map Setup
    const map = L.map('mapContainer').setView([26.7914, 84.5042], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    L.marker([26.7914, 84.5042]).addTo(map).bindPopup('Bettiah Main Mandi').openPopup();

    // Search Filter
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = marketData.filter(item => item.name.toLowerCase().includes(term));
        renderItems(filtered);
    });

    // Category Filter
    document.getElementById('categoryBar').onclick = (e) => {
        if(e.target.classList.contains('chip')) {
            document.querySelector('.chip.active').classList.remove('active');
            e.target.classList.add('active');
            const cat = e.target.innerText;
            const filtered = cat === "All Items" ? marketData : marketData.filter(i => i.category === cat);
            renderItems(filtered);
        }
    };
});
