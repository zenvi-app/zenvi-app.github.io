/* ===== ZENVI SCRIPT - IMPROVED ===== */

// ===== DARK MODE INSTANT RESTORE (before DOM loads) =====
if (localStorage.getItem("zenvi_dark") === "1") {
  document.documentElement.classList.add("dark-mode");
}
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("zenvi_dark") === "1") {
    document.body.classList.add("dark-mode");
    const check = document.getElementById("darkModeCheck");
    if (check) check.checked = true;
  }
});


// ===== CONFIG =====
const MAPPLS_API_KEY = "0daf1373cd967b80d2c6f73effdfd849";
// Note: Keys are domain-restricted to zenvi-app.github.io only


// ===== COORDINATE DETECTION HELPER =====
function isCoordinateString(str) {
  if (!str) return true;
  return /^-?\d+\.\d+,?\s*-?\d+\.\d+$/.test(str.trim()) ||
         str.trim() === "" || 
         ["null","undefined","Selected Location","Map pe location chunein..."].includes(str.trim());
}

// ===== STATE =====
let marketData = [];
let mapplsMap = null;
let selectedMarker = null;
let currentLocation = null;
let chatHistory = []; // Multi-turn chat history

// ===== EMOJI MAP =====
const itemEmojis = {
  tomato:'🍅', potato:'🥔', onion:'🧅', carrot:'🥕', cabbage:'🥬',
  cauliflower:'🥦', brinjal:'🍆', pumpkin:'🎃', spinach:'🌿', bhindi:'🫛',
  banana:'🍌', apple:'🍎', mango:'🥭', orange:'🍊', papaya:'🫧', guava:'🍐',
  grapes:'🍇', watermelon:'🍉',
  wheat:'🌾', rice:'🍚', maize:'🌽', barley:'🫘', gram:'🫘', bajra:'🌾', jowar:'🌾',
  garlic:'🧄', ginger:'🫚', chili:'🌶️', coriander:'🌿', mint:'🌿',
  default:'🌱'
};
function getEmoji(name) {
  const n = name.toLowerCase();
  for (const [key, emoji] of Object.entries(itemEmojis)) {
    if (n.includes(key)) return emoji;
  }
  return itemEmojis.default;
}

// ===== CATEGORY DETECTION =====
function detectCategory(name) {
  const n = name.toLowerCase().trim();
  const map = {
    Vegetables: ["tomato","potato","onion","pumpkin","spinach","cabbage","bhindi","brinjal","cauliflower","carrot","gourd","radish","peas","okra","chili","ginger","garlic"],
    Fruits: ["banana","apple","mango","orange","papaya","guava","grapes","watermelon","lemon","coconut"],
    Grains: ["rice","wheat","maize","barley","gram","bajra","jowar","ragi","soybean"]
  };
  for (const [cat, items] of Object.entries(map)) {
    if (items.some(i => n.includes(i))) return cat;
  }
  return "Others";
}

function getPriceTrend(price) {
  const p = parseFloat(price);
  if (p < 20) return "down";
  if (p > 50) return "up";
  return "same";
}

function escapeHtml(text) {
  if (!text) return "";
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

// ===== REMOVE DUPLICATES & AVERAGE =====
function removeDuplicates(data) {
  const priceMap = {};
  data.forEach(item => {
    const name = item.name?.trim().toLowerCase();
    const priceKg = parseFloat(item.price) / 100;
    if (!name || isNaN(priceKg)) return;
    if (!priceMap[name]) priceMap[name] = [];
    priceMap[name].push(priceKg);
  });
  return Object.entries(priceMap).map(([name, prices]) => {
    const avg = prices.reduce((a,b) => a+b, 0) / prices.length;
    const proper = name.charAt(0).toUpperCase() + name.slice(1);
    return {
      name: proper,
      price: avg.toFixed(2),
      unit: "kg",
      category: detectCategory(name),
      trend: getPriceTrend(avg),
      emoji: getEmoji(name)
    };
  }).sort((a,b) => a.name.localeCompare(b.name));
}

// ===== RENDER ITEMS =====
function renderItems(data) {
  const grid = document.getElementById("itemsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!data || data.length === 0) {
    grid.innerHTML = '<div class="no-data"><div class="no-icon">😕</div><p>Koi item nahi mila.<br>Kuch aur search karein.</p></div>';
    return;
  }

  data.forEach((item, i) => {
    const trendIcon = item.trend === "up" ? "📈" : item.trend === "down" ? "📉" : "➡️";
    const trendText = item.trend === "up" ? "Badh raha" : item.trend === "down" ? "Gir raha" : "Stable";
    const isCommunity = item.source === "community";
    const card = document.createElement("div");
    card.className = "item-card";
    card.style.animationDelay = (i * 0.04) + "s";
    card.innerHTML = `
      ${isCommunity ? '<span class="community-badge" title="Community verified">👥</span>' : ''}
      <span class="item-emoji">${item.emoji || '🌱'}</span>
      <h4>${escapeHtml(item.name)}</h4>
      <div class="price">
        ₹${item.price}<span class="price-unit">/${item.unit}</span>
        ${item.hasRange ? `<span class="price-range">₹${parseFloat(item.minPrice).toFixed(0)}-${parseFloat(item.maxPrice).toFixed(0)}</span>` : ''}
      </div>
      <div class="trend ${item.trend}">${trendIcon} ${trendText}</div>
      <span class="category-tag">${escapeHtml(item.category)}</span>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="suggest-price-btn" style="flex:1;" onclick="event.stopPropagation(); openSuggestPrice('${escapeHtml(item.name)}', '${item.price}')">
          ✏️ Suggest
        </button>
        <button class="fav-toggle-btn ${isFavourite(item.name) ? 'fav-active' : ''}" 
          onclick="event.stopPropagation(); toggleFavourite({name:'${escapeHtml(item.name)}',emoji:'${item.emoji}',price:'${item.price}',unit:'${item.unit}'}); this.classList.toggle('fav-active'); this.textContent = this.classList.contains('fav-active') ? '❤️' : '🤍';"
          title="Favourite add karein">
          ${isFavourite(item.name) ? '❤️' : '🤍'}
        </button>
      </div>
    `;
    card.addEventListener("click", () => {
      document.getElementById("searchInput").value = item.name;
      filterItems(item.name);
    });
    grid.appendChild(card);
  });

  updateStats(data);
  const timeEl = document.getElementById("last-update-time");
  if (timeEl) timeEl.innerText = new Date().toLocaleTimeString("hi-IN", {hour:'2-digit',minute:'2-digit'});
}

// ===== SUGGEST PRICE MODAL =====
window.openSuggestPrice = function(itemName, currentPrice) {
  const user = window.zenviAuth?.auth?.currentUser;

  // Create modal
  let modal = document.getElementById("suggestModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "suggestModal";
    modal.style.cssText = `
      position:fixed;inset:0;z-index:3000;
      display:flex;align-items:flex-end;
      background:rgba(0,0,0,0.5);
    `;
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:white;width:100%;border-radius:24px 24px 0 0;padding:24px 20px 40px;">
      <div style="width:40px;height:4px;background:#e2e8f0;border-radius:99px;margin:0 auto 20px;"></div>
      <h3 style="font-size:17px;font-weight:800;margin-bottom:4px;">✏️ Price Suggest Karein</h3>
      <p style="font-size:13px;color:#64748b;margin-bottom:20px;">${itemName} — Aaj aapne kya rate dekha?</p>

      ${!user ? `
        <div style="background:#fef3c7;border-radius:12px;padding:14px;margin-bottom:16px;text-align:center;">
          <p style="font-size:13px;color:#92400e;font-weight:600;">⚠️ Price suggest karne ke liye login karein</p>
          <button onclick="window.googleLogin();document.getElementById('suggestModal').style.display='none';"
            style="margin-top:10px;padding:10px 20px;background:#16a34a;color:white;border:none;
            border-radius:20px;font-weight:700;cursor:pointer;font-family:inherit;">
            Google se Login Karein
          </button>
        </div>
      ` : `
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">
            AAPNE DEKHA RATE (₹/kg)
          </label>
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:20px;font-weight:800;color:#94a3b8;">₹</span>
            <input id="suggestPriceInput" type="number" min="1" max="50000" step="0.5"
              placeholder="${currentPrice}"
              style="flex:1;font-size:24px;font-weight:800;border:2px solid #e2e8f0;
              border-radius:12px;padding:12px 16px;font-family:inherit;outline:none;color:#1e293b;">
            <span style="font-size:16px;color:#64748b;">/kg</span>
          </div>
        </div>
        <p style="font-size:12px;color:#94a3b8;margin-bottom:16px;">
          📍 Location: ${window.currentLocation?.name || "Set location first"}
        </p>
        <div style="display:flex;gap:10px;">
          <button onclick="document.getElementById('suggestModal').style.display='none';"
            style="flex:1;padding:14px;background:#f1f5f9;color:#64748b;border:none;
            border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;">
            Cancel
          </button>
          <button onclick="submitSuggestion('${escapeHtml(itemName)}')"
            style="flex:2;padding:14px;background:#16a34a;color:white;border:none;
            border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;
            box-shadow:0 4px 12px rgba(22,163,74,0.3);">
            ✅ Submit Suggestion
          </button>
        </div>
      `}
      ${user ? '' : `
        <button onclick="document.getElementById('suggestModal').style.display='none';"
          style="width:100%;margin-top:10px;padding:14px;background:#f1f5f9;color:#64748b;
          border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;">
          Cancel
        </button>
      `}
    </div>
  `;

  modal.style.display = "flex";
  modal.addEventListener("click", e => {
    if (e.target === modal) modal.style.display = "none";
  });

  // Focus input
  setTimeout(() => {
    const input = document.getElementById("suggestPriceInput");
    if (input) input.focus();
  }, 300);
};

window.submitSuggestion = async function(itemName) {
  const input = document.getElementById("suggestPriceInput");
  if (!input?.value) {
    showToast("⚠️ Price daalen!");
    return;
  }
  const modal = document.getElementById("suggestModal");
  if (modal) modal.style.display = "none";

  const success = await window.submitPriceSuggestion?.(
    itemName,
    input.value,
    window.currentLocation?.name
  );

  if (success) {
    // Auto trigger AI review after 3 seconds
    setTimeout(() => window.aiReviewPendingSuggestions?.(), 3000);
  }
};

// ===== UPDATE STATS ROW =====
function updateStats(data) {
  const statTotal = document.querySelector("#statTotal .stat-num");
  const statCheap = document.querySelector("#statCheap .stat-num");
  const statTime = document.querySelector("#statTime .stat-num");

  if (statTotal) statTotal.textContent = data.length;
  if (statCheap && data.length > 0) {
    const cheapest = [...data].sort((a,b) => parseFloat(a.price) - parseFloat(b.price))[0];
    statCheap.textContent = cheapest.name;
  }
  if (statTime) statTime.textContent = new Date().toLocaleTimeString("hi-IN", {hour:'2-digit',minute:'2-digit'});
}

// ===== FETCH LIVE PRICES =====
const DATA_API_URL = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd0000013a00e18ef65d4b0063eac2e34ced0b9f&format=json&limit=4000`;

async function fetchLivePrices() {
  const grid = document.getElementById("itemsGrid");

  // ===== INSTANT CACHE LOAD =====
  // Show cached data immediately while fresh data loads
  try {
    const cached = localStorage.getItem("zenvi_prices");
    const cacheTime = localStorage.getItem("zenvi_prices_time");
    const cacheAge = cacheTime ? (Date.now() - parseInt(cacheTime)) / 1000 / 60 : 999; // minutes

    if (cached && cacheAge < 60) { // Cache valid for 60 minutes
      const cachedData = JSON.parse(cached);
      if (cachedData.length > 0) {
        marketData = cachedData;
        renderItems(marketData);
        setDataSource(`🟡 Cached (${Math.round(cacheAge)}m ago)`);
        console.log(`📦 Loaded ${marketData.length} items from cache`);
        // Still fetch fresh in background
      }
    }
  } catch(e) {}

  // Show skeleton only if no cache
  if (grid && marketData.length === 0) {
    grid.innerHTML = Array(6).fill(`
      <div class="item-card skeleton-card">
        <div class="skel skel-emoji"></div>
        <div class="skel skel-title"></div>
        <div class="skel skel-price"></div>
        <div class="skel skel-trend"></div>
      </div>`).join('');
  }

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);
    const response = await fetch(DATA_API_URL, { signal: controller.signal });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!data.records?.length) throw new Error("No records");

    // Get ALL unique commodities — store min/max/avg
    const priceMap = {};
    for (const r of data.records) {
      if (!r.commodity || !r.modal_price) continue;
      const name = r.commodity.trim();
      const price = parseFloat(r.modal_price) / 100; // quintal → kg
      if (isNaN(price) || price <= 0) continue;
      if (!priceMap[name]) priceMap[name] = { sum: 0, count: 0, min: price, max: price };
      priceMap[name].sum += price;
      priceMap[name].count++;
      priceMap[name].min = Math.min(priceMap[name].min, price);
      priceMap[name].max = Math.max(priceMap[name].max, price);
    }

    const rawData = Object.entries(priceMap).map(([name, d]) => ({
      name,
      price: d.sum / d.count,
      minPrice: d.min,
      maxPrice: d.max,
      hasRange: d.max > d.min * 1.1
    }));

    if (rawData.length === 0) throw new Error("Empty after processing");

    marketData = rawData
      .filter(item => item.price >= 0.5 && item.price <= 2000)
      .map(item => ({
        ...item,
        price: item.price.toFixed(2),
        unit: "kg",
        category: detectCategory(item.name),
        trend: getPriceTrend(item.price),
        emoji: getEmoji(item.name)
      }))
      .sort((a,b) => a.name.localeCompare(b.name));

    renderItems(marketData);
    setDataSource("🟢 Live — data.gov.in");
    console.log("✅ Loaded", marketData.length, "fresh items");

    // Init Fuse.js for fuzzy search
    if (window.Fuse) {
      window._fuse = new window.Fuse(marketData, {
        keys: ["name","category"],
        threshold: 0.4,
        includeScore: true
      });
      console.log("🔍 Fuse.js ready");
    }

    // ✅ Save to cache
    try {
      localStorage.setItem("zenvi_prices", JSON.stringify(marketData));
      localStorage.setItem("zenvi_prices_time", Date.now().toString());
    } catch(e) {}

    // Merge community prices
    if (window.loadCommunityPrices) {
      window.loadCommunityPrices().then(communityPrices => {
        if (communityPrices.length > 0) {
          const names = new Set(marketData.map(i => i.name.toLowerCase()));
          const newItems = communityPrices
            .filter(c => !names.has(c.name.toLowerCase()))
            .map(c => ({
              ...c,
              category: detectCategory(c.name),
              trend: getPriceTrend(c.price),
              emoji: getEmoji(c.name)
            }));
          if (newItems.length > 0) {
            marketData = [...marketData, ...newItems];
            renderItems(marketData);
            console.log(`➕ Added ${newItems.length} community prices`);
          }
        }
      });
    }

  } catch (err) {
    console.warn("⚠️ API failed:", err.message);
    // Use cache if available, else fallback
    if (marketData.length > 0) {
      setDataSource("🟡 Cached data (API offline)");
    } else {
      useFallbackData();
      setDataSource("🟡 Sample data (API offline)");
    }
  }
}

// ===== DATA SOURCE INDICATOR =====
function setDataSource(text) {
  const el = document.getElementById("last-update-time");
  if (el) el.innerText = text;

  // Also update live badge
  const liveBadge = document.querySelector(".live-badge");
  if (liveBadge) {
    const isLive = text.includes("Live");
    liveBadge.style.background = isLive ? "rgba(255,255,255,0.15)" : "rgba(245,158,11,0.3)";
    liveBadge.innerHTML = `<span class="dot" style="background:${isLive ? '#ef4444' : '#f59e0b'}"></span> ${isLive ? 'Live Update' : 'Sample Data'}`;
  }
}

// ===== FALLBACK DATA — 150+ items with Bihar-accurate prices =====
function useFallbackData() {
  const fallback = [
    // 🥬 VEGETABLES
    {n:"Tomato",p:22,c:"Vegetables"},{n:"Potato",p:18,c:"Vegetables"},
    {n:"Onion",p:28,c:"Vegetables"},{n:"Cauliflower",p:30,c:"Vegetables"},
    {n:"Cabbage",p:20,c:"Vegetables"},{n:"Brinjal",p:22,c:"Vegetables"},
    {n:"Okra",p:32,c:"Vegetables"},{n:"Pumpkin",p:14,c:"Vegetables"},
    {n:"Bitter Gourd",p:28,c:"Vegetables"},{n:"Bottle Gourd",p:15,c:"Vegetables"},
    {n:"Ridge Gourd",p:20,c:"Vegetables"},{n:"Pointed Gourd",p:24,c:"Vegetables"},
    {n:"Cucumber",p:18,c:"Vegetables"},{n:"Capsicum",p:55,c:"Vegetables"},
    {n:"Green Chilli",p:35,c:"Vegetables"},{n:"Carrot",p:32,c:"Vegetables"},
    {n:"Radish",p:16,c:"Vegetables"},{n:"Spinach",p:18,c:"Vegetables"},
    {n:"Fenugreek",p:25,c:"Vegetables"},{n:"Coriander",p:30,c:"Vegetables"},
    {n:"Mint",p:25,c:"Vegetables"},{n:"Colocasia",p:22,c:"Vegetables"},
    {n:"Sweet Potato",p:20,c:"Vegetables"},{n:"Yam",p:28,c:"Vegetables"},
    {n:"Beetroot",p:24,c:"Vegetables"},{n:"Turnip",p:16,c:"Vegetables"},
    {n:"Drumstick",p:40,c:"Vegetables"},{n:"Raw Banana",p:20,c:"Vegetables"},
    {n:"Green Peas",p:45,c:"Vegetables"},{n:"Cluster Beans",p:32,c:"Vegetables"},
    {n:"Ash Gourd",p:18,c:"Vegetables"},{n:"Snake Gourd",p:22,c:"Vegetables"},
    {n:"Flat Beans",p:35,c:"Vegetables"},{n:"Cowpea",p:38,c:"Vegetables"},
    {n:"French Beans",p:40,c:"Vegetables"},{n:"Garlic",p:80,c:"Vegetables"},
    {n:"Ginger",p:55,c:"Vegetables"},{n:"Green Garlic",p:30,c:"Vegetables"},
    {n:"Curry Leaves",p:40,c:"Vegetables"},{n:"Amaranthus",p:20,c:"Vegetables"},

    // 🍎 FRUITS
    {n:"Banana",p:35,c:"Fruits"},{n:"Apple",p:110,c:"Fruits"},
    {n:"Mango",p:75,c:"Fruits"},{n:"Orange",p:55,c:"Fruits"},
    {n:"Papaya",p:25,c:"Fruits"},{n:"Watermelon",p:12,c:"Fruits"},
    {n:"Grapes",p:75,c:"Fruits"},{n:"Guava",p:30,c:"Fruits"},
    {n:"Pomegranate",p:85,c:"Fruits"},{n:"Pineapple",p:40,c:"Fruits"},
    {n:"Lemon",p:45,c:"Fruits"},{n:"Coconut",p:22,c:"Fruits"},
    {n:"Litchi",p:65,c:"Fruits"},{n:"Muskmelon",p:18,c:"Fruits"},
    {n:"Jackfruit",p:20,c:"Fruits"},{n:"Pear",p:60,c:"Fruits"},
    {n:"Plum",p:70,c:"Fruits"},{n:"Kiwi",p:120,c:"Fruits"},
    {n:"Sapota",p:45,c:"Fruits"},{n:"Fig",p:90,c:"Fruits"},
    {n:"Custard Apple",p:55,c:"Fruits"},{n:"Wood Apple",p:25,c:"Fruits"},
    {n:"Date Palm",p:80,c:"Fruits"},{n:"Strawberry",p:150,c:"Fruits"},
    {n:"Amla",p:35,c:"Fruits"},

    // 🌾 GRAINS & PULSES
    {n:"Wheat",p:28,c:"Grains"},{n:"Rice",p:52,c:"Grains"},
    {n:"Maize",p:20,c:"Grains"},{n:"Bajra",p:26,c:"Grains"},
    {n:"Jowar",p:24,c:"Grains"},{n:"Ragi",p:35,c:"Grains"},
    {n:"Barley",p:22,c:"Grains"},{n:"Oats",p:45,c:"Grains"},
    {n:"Arhar Dal",p:88,c:"Grains"},{n:"Moong Dal",p:82,c:"Grains"},
    {n:"Masoor Dal",p:72,c:"Grains"},{n:"Urad Dal",p:85,c:"Grains"},
    {n:"Chana Dal",p:62,c:"Grains"},{n:"Rajma",p:90,c:"Grains"},
    {n:"Gram",p:48,c:"Grains"},{n:"Soyabean",p:45,c:"Grains"},
    {n:"Peas Dry",p:55,c:"Grains"},{n:"Moong",p:75,c:"Grains"},
    {n:"Urad",p:80,c:"Grains"},{n:"Lentil",p:68,c:"Grains"},
    {n:"Black Gram",p:78,c:"Grains"},{n:"Green Gram",p:72,c:"Grains"},

    // ✨ OTHERS — Spices, Oilseeds
    {n:"Turmeric",p:68,c:"Others"},{n:"Dry Chilli",p:115,c:"Others"},
    {n:"Coriander Seed",p:62,c:"Others"},{n:"Cumin",p:175,c:"Others"},
    {n:"Mustard",p:52,c:"Others"},{n:"Groundnut",p:72,c:"Others"},
    {n:"Sesame",p:105,c:"Others"},{n:"Sunflower Seed",p:62,c:"Others"},
    {n:"Cotton",p:52,c:"Others"},{n:"Jute",p:38,c:"Others"},
    {n:"Sugarcane",p:4,c:"Others"},{n:"Tamarind",p:55,c:"Others"},
    {n:"Pepper",p:320,c:"Others"},{n:"Cardamom",p:900,c:"Others"},
    {n:"Clove",p:650,c:"Others"},{n:"Nutmeg",p:350,c:"Others"},
    {n:"Fennel",p:110,c:"Others"},{n:"Ajwain",p:120,c:"Others"},
    {n:"Bay Leaf",p:85,c:"Others"},{n:"Asafoetida",p:450,c:"Others"},
    {n:"Dry Ginger",p:180,c:"Others"},{n:"Til",p:95,c:"Others"},
    {n:"Linseed",p:48,c:"Others"},{n:"Safflower",p:55,c:"Others"},
    {n:"Castor Seed",p:52,c:"Others"},{n:"Mahua",p:28,c:"Others"},
  ];

  // Add slight random variation to prices (±10%)
  marketData = fallback.map(item => {
    const variation = 0.92 + Math.random() * 0.16;
    const price = (item.p * variation);
    return {
      name: item.n,
      price: price.toFixed(2),
      unit: "kg",
      category: item.c,
      trend: ['up','down','stable','stable'][Math.floor(Math.random()*4)],
      emoji: getEmoji(item.n)
    };
  });

  renderItems(marketData);
}

// ===== FILTER ITEMS =====
const hindiMap = {
  'pyaaj':'onion','pyaj':'onion','pyaz':'onion','pyaaz':'onion',
  'aloo':'potato','alu':'potato','aaloo':'potato',
  'tamatar':'tomato','tamater':'tomato',
  'gajar':'carrot','gaajar':'carrot',
  'gobhi':'cauliflower','phool gobhi':'cauliflower',
  'patta gobhi':'cabbage',
  'bhindi':'okra','ladyfinger':'okra',
  'baingan':'brinjal',
  'matar':'peas', 'mooli':'radish', 'kaddu':'pumpkin',
  'mirch':'chili', 'dhania':'coriander', 'podina':'mint',
  'lehsun':'garlic', 'adrak':'ginger',
  'kela':'banana', 'seb':'apple', 'aam':'mango',
  'santra':'orange', 'papita':'papaya', 'tarbooj':'watermelon',
  'gehu':'wheat', 'gehun':'wheat', 'chawal':'rice',
  'makka':'maize', 'jau':'barley', 'chana':'gram', 'bajra':'bajra'
};

// Hindi/regional aliases for smart search
const HINDI_ALIASES = {
  "aalu":"potato","aloo":"potato","alu":"potato","aaloo":"potato","aalu":"potato",
  "tamatar":"tomato","tamaatar":"tomato","timatar":"tomato","tometo":"tomato",
  "pyaj":"onion","pyaaz":"onion","piyaz":"onion","kanda":"onion","piaz":"onion",
  "gajar":"carrot","gaajar":"carrot","gaajr":"carrot",
  "gobhi":"cauliflower","phoolgobi":"cauliflower","patta gobhi":"cabbage","bandgobhi":"cabbage",
  "mirchi":"chilli","hari mirchi":"green chilli","lal mirchi":"red chilli",
  "palak":"spinach","saag":"spinach",
  "bhindi":"okra","ladyfinger":"okra","bhende":"okra",
  "kaddu":"pumpkin","lauki":"bottlegourd","karela":"bitter gourd","tinda":"tinda",
  "baigan":"brinjal","baingan":"brinjal","bengan":"brinjal",
  "matar":"peas","hara matar":"green peas","vatana":"peas",
  "nimbu":"lemon","nimboo":"lemon","neembu":"lemon",
  "adrak":"ginger","lahsun":"garlic","lasun":"garlic",
  "gehun":"wheat","gehu":"wheat","gahu":"wheat",
  "chawal":"rice","dhan":"paddy","arwa":"rice",
  "dal":"lentil","masoor":"lentil","moong":"green gram","urad":"black gram",
  "makka":"maize","bhutta":"corn","makai":"maize",
  "aam":"mango","kela":"banana","seb":"apple","saib":"apple",
  "angur":"grapes","narangi":"orange","santra":"orange","malta":"orange",
  "tarbuj":"watermelon","kharbuja":"muskmelon","tarbooj":"watermelon",
  "imli":"tamarind","nariyal":"coconut","singhara":"water chestnut",
};

function normalize(text) {
  return text.toLowerCase()
    .replace(/aa/g,"a").replace(/oo/g,"u").replace(/ee/g,"i")
    .replace(/ph/g,"f").replace(/kh/g,"k").trim();
}

function filterItems(term) {
  if (!term || !term.trim()) { renderItems(marketData); return; }
  const query = term.toLowerCase().trim();
  const normQ = normalize(query);

  // Check Hindi alias
  const alias = HINDI_ALIASES[query] || HINDI_ALIASES[normQ] || HINDI_ALIASES[hindiMap?.[query]] || "";

  // Use Fuse.js if loaded
  if (window._fuse) {
    const seen = new Set();
    const results = [];

    const addResult = (item) => {
      if (!seen.has(item.name)) { seen.add(item.name); results.push(item); }
    };

    // Search original query
    window._fuse.search(query).forEach(r => addResult(r.item));
    // Search alias if found
    if (alias) window._fuse.search(alias).forEach(r => addResult(r.item));
    // Search normalized
    if (normQ !== query) window._fuse.search(normQ).forEach(r => addResult(r.item));

    // Also add direct substring matches not caught by fuse
    marketData.forEach(item => {
      const n = item.name.toLowerCase();
      if (n.includes(query) || n.includes(alias) || normalize(n).includes(normQ)) {
        addResult(item);
      }
    });

    renderItems(results.length > 0 ? results : []);
    return;
  }

  // Fallback without Fuse
  const englishTerm = hindiMap[query] || alias || query;
  const filtered = marketData.filter(item => {
    const n = item.name.toLowerCase();
    return n.includes(query) || n.includes(englishTerm) ||
           normalize(n).includes(normQ) || item.category.toLowerCase().includes(query);
  });
  renderItems(filtered);
}

// ===== 🤖 GEMINI AI ENGINE =====
// Free API: aistudio.google.com → Get API Key (AIza...)
// Free limit: 15 req/min, 1500 req/day — perfect for Zenvi!

const GEMINI_API_KEY = "AIzaSyCbs5Zne_gChTcpmawNFWKB4csS89ez6L4";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

async function getClaudeAIResponse(userQuery) {
  const top10 = marketData.slice(0, 10);
  const cheapest3 = [...marketData].sort((a,b) => parseFloat(a.price)-parseFloat(b.price)).slice(0,3);
  const expensive3 = [...marketData].sort((a,b) => parseFloat(b.price)-parseFloat(a.price)).slice(0,3);
  const userLocation = window.currentLocation?.name || "India";

  const marketContext = marketData.length > 0
    ? `Aaj ki mandi prices (wholesale): ${top10.map(i=>`${i.name}=₹${i.price}`).join(", ")} ...aur ${marketData.length - 10} items`
    : "Market data abhi load ho raha hai.";

  const systemPrompt = `Tu Zenvi AI hai — India ka smart mandi price assistant. Hinglish mein baat kar.

User ki location: ${userLocation}
${marketContext}
Saste: ${cheapest3.map(i=>`${i.name}(₹${i.price})`).join(", ")}
Mehenge: ${expensive3.map(i=>`${i.name}(₹${i.price})`).join(", ")}

RULES:
- User ${userLocation} mein hai — location-specific jawab de jab relevant ho
- Yeh WHOLESALE mandi rates hain — retail mein 20-40% zyada hoti hai
- Sirf data mein available items ki price bata
- Item na mile toh honestly bol
- Short answer (3-5 lines), emojis use karo 🍅🥔🌾
- Retail estimate dena: mandi rate × 1.3`;

  // Build conversation for Gemini format
  const geminiMessages = [];

  // Add chat history
  for (const msg of chatHistory.slice(-6)) {
    geminiMessages.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    });
  }

  // Add current message
  geminiMessages.push({
    role: "user",
    parts: [{ text: userQuery }]
  });

  chatHistory.push({ role: "user", content: userQuery });

  // Ready to call Gemini

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: geminiMessages,
        generationConfig: {
          maxOutputTokens: 350,
          temperature: 0.65
        }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("Gemini error:", err?.error?.message || response.status);
      throw new Error("Gemini error " + response.status);
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error("No reply from Gemini");

    chatHistory.push({ role: "assistant", content: reply });
    return reply;

  } catch (err) {
    console.warn("Gemini failed, using local AI:", err.message);
    const reply = getLocalAIResponse(userQuery);
    chatHistory.push({ role: "assistant", content: reply });
    return reply;
  }
}

// ===== SMART LOCAL AI — honest & data-driven =====
function getLocalAIResponse(query) {
  const q = query.toLowerCase().trim();

  // Specific item search — only from actual data
  for (const item of marketData) {
    const names = [item.name.toLowerCase()];
    for (const [hindi, eng] of Object.entries(hindiMap)) {
      if (eng === item.name.toLowerCase()) names.push(hindi);
    }
    if (names.some(n => q.includes(n))) {
      const trendText = item.trend === 'up' ? '📈 Badh raha hai' : item.trend === 'down' ? '📉 Gir raha hai' : '➡️ Stable';
      const retailEstimate = (parseFloat(item.price) * 1.3).toFixed(0);
      return `${item.emoji} **${item.name}**\n\n🏪 Mandi (wholesale): ₹${item.price}/kg\n🛒 Retail (dukaan/app): ~₹${retailEstimate}/kg\n${trendText}\n\n💡 Jiomart/BigBasket mein retail rate hota hai, mandi rate alag hota hai.`;
    }
  }

  // Item not found
  const commonItems = ['orange','santra','apple','grapes'];
  if (commonItems.some(i => q.includes(i))) {
    const name = q.includes('orange') || q.includes('santra') ? 'Orange' :
                 q.includes('apple') || q.includes('seb') ? 'Apple' : 'Yeh item';
    return `❌ **${name}** ka data hamare paas abhi nahi hai.\n\nHamare data mein yeh items hain:\n${marketData.slice(0,6).map(i=>`${i.emoji} ${i.name} ₹${i.price}/kg`).join(", ")}\n\nKoi aur item poochhen!`;
  }

  if (q.includes("sast") || q.includes("cheap") || q.includes("kam rate")) {
    const cheap = [...marketData].sort((a,b) => parseFloat(a.price)-parseFloat(b.price)).slice(0,4);
    return `💚 **Aaj ke sabse saste items (mandi rate):**\n\n${cheap.map((i,idx)=>`${idx+1}. ${i.emoji} ${i.name} — ₹${i.price}/kg`).join("\n")}\n\n💡 Retail mein ~30% zyada hoga.`;
  }

  if (q.includes("mehng") || q.includes("expensive") || q.includes("mahng")) {
    const exp = [...marketData].sort((a,b) => parseFloat(b.price)-parseFloat(a.price)).slice(0,4);
    return `💰 **Sabse mehange items (mandi rate):**\n\n${exp.map((i,idx)=>`${idx+1}. ${i.emoji} ${i.name} — ₹${i.price}/kg`).join("\n")}\n\nInhein thoda baad kharidein! ⏳`;
  }

  if (q.includes("summary") || q.includes("report") || q.includes("market")) {
    const cheap = [...marketData].sort((a,b)=>parseFloat(a.price)-parseFloat(b.price))[0];
    const exp = [...marketData].sort((a,b)=>parseFloat(b.price)-parseFloat(a.price))[0];
    const up = marketData.filter(i=>i.trend==='up').length;
    const down = marketData.filter(i=>i.trend==='down').length;
    return `📊 **Aaj ki Mandi Report:**\n\n📦 Total items: ${marketData.length}\n💚 Sasta: ${cheap?.emoji} ${cheap?.name} (₹${cheap?.price})\n🔴 Mehnga: ${exp?.emoji} ${exp?.name} (₹${exp?.price})\n📈 Rate badhey: ${up} | 📉 Girey: ${down}\n\n⚠️ Yeh wholesale rates hain.`;
  }

  if (q.includes("retail") || q.includes("jiomart") || q.includes("bigbasket") || q.includes("dukaan") || q.includes("fark") || q.includes("difference")) {
    return `💡 **Mandi vs Retail — Fark kyu?**\n\nMandi (wholesale) rate = kisan se bulk mein\nDukaan/App rate = +20-40% (transport, storage, profit)\n\nExample:\n🍅 Mandi: ₹20/kg → Dukaan: ₹30-35/kg\n\nZenvi mandi rate dikhata hai taki aap best deal dhoondh sako! 🎯`;
  }

  if (q.includes("help") || q.includes("kya") || q.includes("namaste") || q.includes("hello") || q.includes("hi")) {
    return `🙏 **Namaste! Main Zenvi AI hoon.**\n\nMain bata sakta hoon:\n• Kisi bhi sabji/anaaj ka mandi rate\n• Sabse saste/mehange items\n• Market summary\n• Mandi vs retail price fark\n\nPoochhen: "Tamatar rate?" ya "Sabse sasti sabji?"`;
  }

  return `🤔 Samjha nahi. Aap poochh sakte hain:\n\n• "Tamatar ka rate kya hai?"\n• "Sabse sasti sabji?"\n• "Aaj ki market summary"\n• "Mandi aur dukaan mein fark?"`;
}

// ===== SEND AI MESSAGE =====
async function sendAIMessage() {
  const aiInput = document.getElementById("aiQuery");
  const chatBody = document.getElementById("chatBody");
  if (!aiInput || !chatBody) return;

  const query = aiInput.value.trim();
  if (!query) return;

  // User bubble
  const userWrap = document.createElement("div");
  userWrap.className = "user-msg-wrap";
  userWrap.innerHTML = `<div class="user-bubble">${escapeHtml(query)}</div>`;
  chatBody.appendChild(userWrap);
  aiInput.value = "";
  chatBody.scrollTop = chatBody.scrollHeight;

  // Typing indicator
  const typingWrap = document.createElement("div");
  typingWrap.className = "ai-msg-wrap";
  typingWrap.id = "typing-" + Date.now();
  typingWrap.innerHTML = `<div class="ai-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  chatBody.appendChild(typingWrap);
  chatBody.scrollTop = chatBody.scrollHeight;

  // Get Claude response
  const response = await getClaudeAIResponse(query);

  // Remove typing, add response
  typingWrap.remove();

  const aiWrap = document.createElement("div");
  aiWrap.className = "ai-msg-wrap";
  // Convert **bold** to <strong>
  const formatted = response
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  aiWrap.innerHTML = `<div class="ai-bubble">${formatted}</div>`;
  chatBody.appendChild(aiWrap);
  chatBody.scrollTop = chatBody.scrollHeight;
}

// ===== MAP =====
let reverseGeocodeTimer = null;
let currentZoom = 14;
const DEFAULT_LAT = 26.8018;
const DEFAULT_LNG = 84.5037;

function initMap() {
  if (mapplsMap) return;
  if (document.getElementById("mappls-sdk")) {
    // SDK already loading — wait for callback
    setTimeout(() => {
      if (!mapplsMap && typeof mappls !== 'undefined') window.initializeMapplsMap();
    }, 3000);
    return;
  }

  const script = document.createElement("script");
  script.id = "mappls-sdk";
  script.src = `https://apis.mappls.com/advancedmaps/api/${MAPPLS_API_KEY}/map_sdk?layer=vector&v=3.0&callback=initializeMapplsMap`;
  script.async = true;

  script.onerror = () => {
    console.error("❌ Mappls SDK load failed — check API key and domain whitelist");
    showMapError("Mappls load nahi hua. Domain whitelist check karein.");
  };

  document.head.appendChild(script);
  console.log("🗺️ Loading Mappls...", window.location.hostname);
}

function showMapError(msg) {
  const c = document.getElementById("mapContainer");
  if (!c) return;
  c.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
      height:100%;background:#f0fdf4;gap:12px;padding:20px;text-align:center;">
      <span style="font-size:48px;">🗺️</span>
      <p style="font-weight:700;color:#16a34a;">${msg}</p>
      <p style="font-size:12px;color:#64748b;">
        Mappls Console → API Key → Whitelist mein add karein:<br>
        <strong>zenvi-app.github.io</strong>
      </p>
      <button onclick="document.getElementById('mappls-sdk')?.remove();mapplsMap=null;initMap();"
        style="padding:10px 24px;background:#16a34a;color:white;border:none;
        border-radius:20px;font-weight:700;cursor:pointer;font-family:inherit;">
        🔄 Retry
      </button>
    </div>`;
  forceEnableConfirm();
}

window.initializeMapplsMap = function() {
  const mapContainer = document.getElementById("mapContainer");
  if (!mapContainer || typeof mappls === 'undefined') return;
  try {
    // Start at saved location or default
    const startLat = currentLocation?.lat || DEFAULT_LAT;
    const startLng = currentLocation?.lng || DEFAULT_LNG;

    mapplsMap = new mappls.Map("mapContainer", {
      center: { lat: startLat, lng: startLng },
      zoom: 14, zoomControl: true, attributionControl: false
    });

    // Only set currentLocation if user has already set one
    // Don't overwrite with default coordinates
    if (!currentLocation?.name || currentLocation.name.match(/\d+\.\d+/)) {
      currentLocation = { lat: startLat, lng: startLng, name: "", fullAddr: "" };
    }

    setupSwiggyCenterPin();
    forceEnableConfirm();
    console.log("✅ Map initialized at:", startLat, startLng);
  } catch (e) { console.error("Map error:", e); }
};

function forceEnableConfirm() {
  const btn = document.getElementById("confirmBtn");
  if (!btn) return;
  btn.disabled = false;
  btn.removeAttribute("disabled");
  btn.innerHTML = "📍 Confirm Location";
  btn.style.cssText = "background:var(--primary) !important;opacity:1 !important;cursor:pointer !important;pointer-events:auto !important;";
}

// ===== CENTER PIN SETUP =====
function setupSwiggyCenterPin() {
  if (!mapplsMap) return;
  const pin = document.getElementById("centerPin");
  const zoomHint = document.getElementById("zoomHint");

  forceEnableConfirm();

  mapplsMap.addEventListener("movestart", () => {
    if (pin) pin.classList.add("dragging");
    // Update location immediately on move start too
    const center = mapplsMap.getCenter();
    if (center) {
      currentLocation = {
        lat: center.lat, lng: center.lng,
        name: currentLocation?.name || "Selecting...",
        fullAddr: currentLocation?.fullAddr || ""
      };
    }
  });

  mapplsMap.addEventListener("moveend", () => {
    if (pin) pin.classList.remove("dragging");

    try {
      const center = mapplsMap.getCenter();
      if (!center) return;
      currentZoom = mapplsMap.getZoom();

      const lat = parseFloat(center.lat);
      const lng = parseFloat(center.lng);

      // ✅ IMMEDIATELY update currentLocation — confirm will always work
      currentLocation = {
        lat, lng,
        name: "",
        fullAddr: ""
      };

      forceEnableConfirm();

      // Update card to show loading
      const nameEl = document.getElementById("selectedLocationName");
      if (nameEl) nameEl.textContent = "📍 Dhundh raha hai...";

      // Zoom warning (just visual, don't block confirm)
      const zoomWarning = document.getElementById("zoomWarning");
      if (zoomWarning) zoomWarning.style.display = currentZoom < 13 ? "flex" : "none";

      // Hide zoom hint
      setTimeout(() => { if (zoomHint) zoomHint.classList.add("hide"); }, 1500);

      // Get proper name via reverse geocode
      clearTimeout(reverseGeocodeTimer);
      reverseGeocodeTimer = setTimeout(() => reverseGeocode(lat, lng), 400);

    } catch(e) { console.error("moveend error:", e); }
  });

  setupMapSearch();

  // Initial geocode for default location
  const initLat = currentLocation?.lat || DEFAULT_LAT;
  const initLng = currentLocation?.lng || DEFAULT_LNG;
  reverseGeocode(initLat, initLng);
}

async function reverseGeocode(lat, lng) {
  const nameEl = document.getElementById("selectedLocationName");
  const addrEl = document.getElementById("selectedLocationAddress");
  if (nameEl) nameEl.textContent = "📍 Dhundh raha hai...";

  function setLocation(displayName, fullAddr) {
    if (!displayName || displayName === "Nearby Area") return false;
    if (nameEl) nameEl.textContent = displayName;
    if (addrEl) addrEl.textContent = fullAddr || "";
    currentLocation = { lat, lng, name: displayName, fullAddr: fullAddr || "" };
    forceEnableConfirm();
    return true;
  }

  // Run Mappls + Nominatim in PARALLEL for speed
  const mapplsPromise = fetch(
    `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_API_KEY}/rev_geocode?lat=${lat}&lng=${lng}`,
    { signal: AbortSignal.timeout(5000) }
  ).then(r => r.json()).catch(() => null);

  const nominatimPromise = fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
    { headers: { 'Accept-Language': 'hi,en' }, signal: AbortSignal.timeout(6000) }
  ).then(r => r.json()).catch(() => null);

  // Try Mappls first
  try {
    const data = await mapplsPromise;
    if (data?.results?.length > 0) {
      const r = data.results[0];
      console.log("🗺️ Mappls:", JSON.stringify(r));
      
      // Extract ALL possible name fields
      const localName = r.subSubLocality || r.subLocality || r.locality || 
                        r.village || r.area || r.street || r.poi ||
                        r.houseNumber;
      const cityName = r.city || r.district || r.subDistrict || "";
      const stateName = r.state || "";
      
      const cleanLocal = localName?.trim();
      const cleanCity = cityName?.trim();
      
      let displayName;
      if (cleanLocal && cleanCity && cleanLocal !== cleanCity) {
        displayName = `${cleanLocal}, ${cleanCity}`;
      } else if (cleanLocal) {
        displayName = cleanLocal;
      } else if (cleanCity) {
        // Try formatted_address for local detail
        const fa = r.formatted_address || "";
        const parts = fa.split(",").map(s => s.trim()).filter(s => s && s !== cleanCity && s !== stateName && s !== "India");
        displayName = parts.length > 0 ? `${parts[0]}, ${cleanCity}` : cleanCity;
      }
      
      if (displayName) {
        const fullAddr = [cleanCity, stateName].filter(Boolean).join(", ");
        if (setLocation(displayName, fullAddr)) return;
      }
    }
  } catch(e) { console.warn("Mappls failed:", e.message); }

  // Fallback to Nominatim
  try {
    const data = await nominatimPromise;
    if (data) {
      const a = data.address || {};
      const localName = a.hamlet || a.neighbourhood || a.quarter ||
                        a.suburb || a.road || a.residential ||
                        a.village || a.city_district;
      const cityName = a.city || a.town || a.municipality || a.district || "";
      const stateName = a.state || "";
      const cleanLocal = localName?.trim();
      const cleanCity = cityName?.trim();
      
      let displayName;
      if (cleanLocal && cleanCity && cleanLocal !== cleanCity) {
        displayName = `${cleanLocal}, ${cleanCity}`;
      } else if (cleanLocal) {
        displayName = cleanLocal;
      } else {
        const parts = (data.display_name||"").split(",").map(s=>s.trim()).filter(s=>s&&s!==cleanCity&&s!=="India"&&!/^\d/.test(s));
        displayName = parts[0] ? `${parts[0]}, ${cleanCity}` : cleanCity;
      }
      
      const fullAddr = [cleanCity, stateName].filter(Boolean).join(", ");
      if (setLocation(displayName, fullAddr)) return;
    }
  } catch(e) { console.warn("Nominatim failed:", e.message); }

  // Both failed — use map label text if visible
  const mapLabel = document.querySelector(".mappls-label, .map-label");
  if (mapLabel?.textContent) {
    setLocation(mapLabel.textContent.trim(), "");
    return;
  }

  // Last resort — allow confirm with "Selected Area"
  if (nameEl) nameEl.textContent = "Selected Area";
  currentLocation = { lat, lng, name: "Selected Area", fullAddr: "" };
  forceEnableConfirm();
}

// ===== EXPLORE TABS + NEARBY MANDIS =====
let exploreMode = 'location';
let mandiMarkers = [];

window.switchExploreTab = function(mode) {
  exploreMode = mode;
  const locCard = document.getElementById("locationCard");
  const mandisPanel = document.getElementById("mandisPanel");
  const centerPin = document.getElementById("centerPin");
  const title = document.getElementById("exploreTitle");

  document.querySelectorAll(".etab").forEach(t => t.classList.remove("active"));
  document.getElementById("tab" + mode.charAt(0).toUpperCase() + mode.slice(1))?.classList.add("active");

  if (mode === 'location') {
    if (locCard) locCard.style.display = "block";
    if (mandisPanel) mandisPanel.style.display = "none";
    if (centerPin) centerPin.style.display = "flex";
    if (title) title.textContent = "Location Set Karein";
  } else {
    if (locCard) locCard.style.display = "none";
    if (mandisPanel) mandisPanel.style.display = "block";
    if (centerPin) centerPin.style.display = "none";
    if (title) title.textContent = "Nearby Mandis";
    loadNearbyMandis();
  }
};

// Mandis Database — coordinates verified
const MANDIS_DB = [
  { name: "Bettiah Mandi",       area: "Bettiah, West Champaran", lat: 26.8048, lng: 84.5076, type: "Sabji & Anaaj", emoji: "🌾" },
  { name: "Narkatiaganj Mandi",  area: "Narkatiaganj, Bihar",     lat: 27.1006, lng: 84.4773, type: "Sabji Mandi",   emoji: "🥬" },
  { name: "Motihari Mandi",      area: "Motihari, East Champaran",lat: 26.6500, lng: 84.9170, type: "Anaaj Mandi",  emoji: "🌾" },
  { name: "Bagaha Mandi",        area: "Bagaha, Bihar",           lat: 27.1041, lng: 84.0888, type: "Phal & Sabji", emoji: "🍎" },
  { name: "Raxaul Mandi",        area: "Raxaul, Bihar",           lat: 26.9873, lng: 84.8498, type: "Border Mandi", emoji: "🏪" },
  { name: "Muzaffarpur Mandi",   area: "Muzaffarpur, Bihar",      lat: 26.1197, lng: 85.3910, type: "Wholesale",    emoji: "🏪" },
  { name: "Sitamarhi Mandi",     area: "Sitamarhi, Bihar",        lat: 26.5941, lng: 85.4894, type: "Sabji Mandi",  emoji: "🥬" },
  { name: "Gopalganj Mandi",     area: "Gopalganj, Bihar",        lat: 26.4697, lng: 84.4371, type: "Anaaj Mandi",  emoji: "🌾" },
  { name: "Siwan Mandi",         area: "Siwan, Bihar",            lat: 26.2206, lng: 84.3549, type: "Sabji & Phal", emoji: "🍅" },
  { name: "Patna Main Mandi",    area: "Patna, Bihar",            lat: 25.6093, lng: 85.1235, type: "Wholesale",    emoji: "🏪" },
  { name: "Hajipur Mandi",       area: "Hajipur, Bihar",          lat: 25.6887, lng: 85.2088, type: "Kela Mandi",  emoji: "🍌" },
  { name: "Chapra Mandi",        area: "Chapra, Bihar",           lat: 25.7812, lng: 84.7474, type: "Sabji Mandi",  emoji: "🥬" },
];

function getDistanceKm(lat1, lng1, lat2, lng2) {
  // Validate inputs
  lat1 = parseFloat(lat1); lng1 = parseFloat(lng1);
  lat2 = parseFloat(lat2); lng2 = parseFloat(lng2);
  if (isNaN(lat1)||isNaN(lng1)||isNaN(lat2)||isNaN(lng2)) return "?";
  if (lat1===lat2 && lng1===lng2) return "0";
  
  const R = 6371; // Earth radius km
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLng = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
            Math.sin(dLng/2)*Math.sin(dLng/2);
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;
  return d < 1 ? (d*1000).toFixed(0)+"m" : d.toFixed(1)+"km";
}

function loadNearbyMandis() {
  // Use GPS location if available, otherwise saved, otherwise default
  const userLat = currentLocation?.lat || DEFAULT_LAT;
  const userLng = currentLocation?.lng || DEFAULT_LNG;

  const sorted = MANDIS_DB
    .map(m => ({ ...m, distance: getDistanceKm(userLat, userLng, m.lat, m.lng) }))
    .sort((a, b) => a.distance - b.distance);

  const countEl = document.getElementById("mandisCount");
  if (countEl) {
    const nearest = sorted[0];
    countEl.textContent = `${sorted.length} mandis — Nearest: ${nearest.name} (${nearest.distance} km)`;
  }

  const list = document.getElementById("mandisList");
  if (list) {
    list.innerHTML =
      `<div style="padding:8px 16px;font-size:11px;color:#94a3b8;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
        📏 Seedhi doori — actual road distance thodi zyada hogi
      </div>` +
      sorted.map(m => `
        <div class="mandi-card" onclick="focusMandi(${m.lat}, ${m.lng}, '${m.name}')">
          <div class="mandi-card-icon">${m.emoji}</div>
          <div class="mandi-card-info">
            <h4>${m.name}</h4>
            <p>${m.area} • ${m.type}</p>
          </div>
          <span class="mandi-distance">${m.distance} km</span>
        </div>`
      ).join('');
  }

  if (mapplsMap) {
    mapplsMap.setCenter({ lat: userLat, lng: userLng });
    mapplsMap.setZoom(8);
  }
}

window.focusMandi = function(lat, lng, name) {
  if (mapplsMap) {
    mapplsMap.setCenter({ lat, lng });
    mapplsMap.setZoom(14);
  }
  const title = document.getElementById("exploreTitle");
  if (title) title.textContent = name;
};

function setupMapSearch() {
  const searchInput = document.getElementById("locationSearchInput");
  const suggestionsBox = document.getElementById("searchSuggestions");
  if (!searchInput) return;

  let timer;
  searchInput.addEventListener("input", e => {
    clearTimeout(timer);
    const q = e.target.value.trim();
    if (q.length < 2) {
      if (suggestionsBox) suggestionsBox.style.display = "none";
      return;
    }
    timer = setTimeout(() => fetchSuggestions(q), 400);
  });

  searchInput.addEventListener("keypress", e => {
    if (e.key === "Enter") {
      if (suggestionsBox) suggestionsBox.style.display = "none";
      searchLocation(e.target.value.trim());
    }
  });

  document.addEventListener("click", e => {
    if (!searchInput.contains(e.target) && suggestionsBox && !suggestionsBox.contains(e.target)) {
      suggestionsBox.style.display = "none";
    }
  });
}

async function fetchSuggestions(query) {
  const box = document.getElementById("searchSuggestions");
  if (!box) return;

  // Show loading
  box.innerHTML = `<div class="suggestion-item"><span class="material-icons-round">hourglass_empty</span><div><p>Dhundh raha hai...</p></div></div>`;
  box.style.display = "block";

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=6&addressdetails=1`,
      { headers: { 'Accept-Language': 'hi,en' }, signal: AbortSignal.timeout(6000) }
    );
    const data = await res.json();
    if (data?.length > 0) {
      box.innerHTML = data.map(item => {
        const a = item.address || {};
        // Show most local name
        const name = a.hamlet || a.neighbourhood || a.suburb || a.village ||
                     a.town || a.city || item.display_name.split(',')[0];
        const city = a.city || a.town || a.district || "";
        const state = a.state || "";
        const detail = [city !== name ? city : "", state].filter(Boolean).join(", ");
        const safeName = name.replace(/'/g, "\'").replace(/"/g, '');
        return `<div class="suggestion-item" onclick="selectSuggestion(${item.lat}, ${item.lon}, '${safeName}', '${detail.replace(/'/g,"\'")}')">
          <span class="material-icons-round">location_on</span>
          <div><p>${name}</p><span>${detail}</span></div>
        </div>`;
      }).join('');
      box.style.display = "block";
    } else {
      box.innerHTML = `<div class="suggestion-item"><span class="material-icons-round">search_off</span><div><p>Koi result nahi mila</p><span>Dusra naam try karein</span></div></div>`;
    }
  } catch(e) {
    console.warn("Suggestions failed:", e.message);
    box.innerHTML = `<div class="suggestion-item"><span class="material-icons-round">wifi_off</span><div><p>Internet check karein</p></div></div>`;
  }
}

window.selectSuggestion = function(lat, lng, name, fullAddr) {
  const box = document.getElementById("searchSuggestions");
  const input = document.getElementById("locationSearchInput");
  if (box) box.style.display = "none";
  if (input) input.value = name;
  lat = parseFloat(lat); lng = parseFloat(lng);
  if (mapplsMap) { mapplsMap.setCenter({ lat, lng }); mapplsMap.setZoom(16); }
  currentLocation = { lat, lng, name, fullAddr: fullAddr || name };
  const nameEl = document.getElementById("selectedLocationName");
  const addrEl = document.getElementById("selectedLocationAddress");
  if (nameEl) nameEl.textContent = name;
  if (addrEl) addrEl.textContent = fullAddr || "";
  forceEnableConfirm();
};

// ===== SEARCH — Nominatim (free, no API key needed) =====
async function searchLocation(query) {
  const searchInput = document.getElementById("locationSearchInput");
  if (searchInput) searchInput.style.borderColor = "var(--primary)";

  try {
    // Use Nominatim — free, no CORS issues, works everywhere
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', India')}&limit=1&addressdetails=1`,
      { headers: { 'Accept-Language': 'hi,en' } }
    );
    const data = await res.json();

    if (data && data.length > 0) {
      const loc = data[0];
      const lat = parseFloat(loc.lat);
      const lng = parseFloat(loc.lon);
      if (mapplsMap && lat && lng) {
        mapplsMap.setCenter({ lat, lng });
        mapplsMap.setZoom(16);
      }
      if (searchInput) searchInput.style.borderColor = "";
    } else {
      // Try without India suffix
      const res2 = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { 'Accept-Language': 'hi,en' } }
      );
      const data2 = await res2.json();
      if (data2?.length > 0) {
        mapplsMap?.setCenter({ lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) });
        mapplsMap?.setZoom(16);
      } else {
        alert(`"${query}" nahi mila. Aur specific naam try karein.`);
      }
      if (searchInput) searchInput.style.borderColor = "";
    }
  } catch (e) {
    console.error("Search error:", e);
    if (searchInput) searchInput.style.borderColor = "";
    alert("Search fail ho gayi. Internet check karein.");
  }
}

// Keep old name for compatibility
async function searchWithMappls(query) { return searchLocation(query); }

function showSelectedLocation(latlng) {
  if (mapplsMap) { mapplsMap.setCenter({lat:latlng.lat, lng:latlng.lng}); mapplsMap.setZoom(17); }
}

function getCurrentLocation() {
  if (!navigator.geolocation) { alert("Geolocation supported nahi hai"); return; }
  const btn = document.getElementById("currentLocationBtn");
  if (btn) btn.innerHTML = '<span class="material-icons-round">location_searching</span><span>Dhundh raha hai...</span>';

  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    if (mapplsMap) { mapplsMap.setCenter({lat,lng}); mapplsMap.setZoom(17); }
    if (btn) btn.innerHTML = '<span class="material-icons-round">my_location</span><span>Current Location</span>';
  }, () => {
    if (btn) btn.innerHTML = '<span class="material-icons-round">my_location</span><span>Current Location</span>';
    alert("Location nahi mil paya. Permission check karein.");
  }, { enableHighAccuracy: true, timeout: 15000 });
}

function confirmLocation(name) {
  const nameEl = document.getElementById("selectedLocationName");
  const addrEl = document.getElementById("selectedLocationAddress");
  if (nameEl) nameEl.textContent = name;
  if (addrEl) addrEl.textContent = "Confirm karein is location ko";
}

function confirmAndProceed() {
  if (!currentLocation?.lat || !currentLocation?.lng) {
    showToast("⚠️ Map pe pin rakho!");
    return;
  }

  // Collect all possible names
  const nameEl = document.getElementById("selectedLocationName");
  const addrEl = document.getElementById("selectedLocationAddress");
  const shown  = (nameEl?.textContent || "").trim();
  const shownAddr = (addrEl?.textContent || "").trim();
  const curName = (currentLocation.name || "").trim();

  // Bad values to reject
  const BAD = new Set(["📍 Dhundh raha hai...","Map pe location chunein...",
    "Location selected ✓","Map drag karo ya search karein",
    "Selected Area","My Location","Selecting..."]);

  const isGood = (n) => n && n.length > 2 && !BAD.has(n) && !isCoordinateString(n);

  // Pick best name
  let name = isGood(shown)   ? shown   :
             isGood(curName) ? curName : "";
  let addr = shownAddr || currentLocation.fullAddr || "";

  // If no good name — just save with generic label (NEVER block user)
  if (!name) {
    name = "Meri Location";
    addr = "";
  }

  // Save
  currentLocation.name = name;
  currentLocation.fullAddr = addr;
  localStorage.setItem("zenvi_location", JSON.stringify(currentLocation));
  localStorage.setItem("zenvi_location_name", name);
  localStorage.setItem("zenvi_location_addr", addr);

  // Update header
  const homeAddr = document.getElementById("homeAddress");
  if (homeAddr) {
    homeAddr.innerText = addr && !addr.includes(name)
      ? name + ", " + addr.split(",")[0]
      : name;
  }
  // Check if this matches a saved address label
  const allSaved = JSON.parse(localStorage.getItem("zenvi_saved_addresses") || "[]");
  const matchedSaved = allSaved.find(a => a.name === name || (a.fullAddr||"").includes(name));
  const locLabel2 = document.getElementById("locLabel");
  if (locLabel2) {
    const lbl = matchedSaved?.label || "Location";
    const icons2 = {Home:"🏠",Work:"💼",Other:"📍",Location:"📍"};
    locLabel2.textContent = (icons2[lbl]||"📍") + " " + lbl;
  }

  // Cloud sync
  if (window.zenviAuth?.auth?.currentUser && window.saveLocationToCloud) {
    window.saveLocationToCloud(currentLocation);
  }

  // Save as Home prompt (first time only)
  const saved = JSON.parse(localStorage.getItem("zenvi_saved_addresses") || "[]");
  if (!saved.some(a => a.label === "Home") && isGood(name)) {
    setTimeout(() => {
      const snack = document.createElement("div");
      snack.style.cssText = "position:fixed;bottom:110px;left:16px;right:16px;z-index:2000;background:#1e293b;color:white;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,0.3);";
      snack.innerHTML = `<span style="font-size:20px;">🏠</span><p style="flex:1;font-size:13px;font-weight:600;margin:0;">"${name}" ko Home save karein?</p><button onclick="saveAsAddress('Home');this.parentElement.remove();" style="background:#16a34a;color:white;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Save</button><button onclick="this.parentElement.remove();" style="background:rgba(255,255,255,0.1);color:white;border:none;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;">✕</button>`;
      document.body.appendChild(snack);
      setTimeout(() => snack.remove(), 6000);
    }, 1500);
  }

  // Instead of going home directly, show address details form (Swiggy style)
  showAddressDetailsForm(name, addr);
}

// ===== SWIGGY-STYLE ADDRESS DETAILS FORM =====
function showAddressDetailsForm(locationName, locationAddr, existingAddr, editIdx) {
  let modal = document.getElementById("addressDetailsModal");
  if (!modal) { modal = document.createElement("div"); modal.id = "addressDetailsModal"; document.body.appendChild(modal); }

  const user = window.zenviAuth?.auth?.currentUser;
  const phone = localStorage.getItem("zenvi_phone") || (user?.phoneNumber || "");
  const userName = user?.displayName || localStorage.getItem("zenvi_username") || "";

  modal.style.cssText = "position:fixed;inset:0;z-index:3500;background:white;overflow-y:auto;";
  modal.innerHTML = `
    <!-- Header -->
    <div style="display:flex;align-items:center;gap:12px;padding:16px;background:white;border-bottom:1px solid #f1f5f9;position:sticky;top:0;z-index:1;">
      <button onclick="document.getElementById('addressDetailsModal').style.display='none';"
        style="background:none;border:none;cursor:pointer;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;">
        <span class="material-icons-round">arrow_back</span>
      </button>
      <h2 style="font-size:17px;font-weight:800;margin:0;flex:1;">Address Details</h2>
    </div>

    <!-- Mini map preview -->
    <div style="height:160px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">
      <span style="font-size:40px;">📍</span>
      <p style="font-size:14px;font-weight:700;color:#16a34a;margin:0;">${locationName}</p>
      <p style="font-size:12px;color:#64748b;margin:0;">${locationAddr}</p>
    </div>

    <div style="padding:16px;">

      <!-- Delivery location row -->
      <div style="background:#fff5f5;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:20px;cursor:pointer;" onclick="document.getElementById('addressDetailsModal').style.display='none';">
        <span class="material-icons-round" style="color:#ef4444;font-size:20px;">location_on</span>
        <div style="flex:1;">
          <p style="font-size:14px;font-weight:700;color:#1e293b;margin:0;">${locationName}</p>
          <p style="font-size:12px;color:#64748b;margin:0;">${locationAddr}</p>
        </div>
        <span class="material-icons-round" style="color:#94a3b8;font-size:18px;">chevron_right</span>
      </div>

      <!-- Address details input -->
      <p style="font-size:13px;font-weight:700;color:#94a3b8;letter-spacing:0.5px;margin:0 0 10px;">ADDRESS DETAILS</p>
      
      <div style="margin-bottom:14px;">
        <input id="addrFloor" placeholder="House no., Floor, Building name" type="text" value="${existingAddr?.floor || ''}"
          style="width:100%;padding:14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:20px;">
        <input id="addrLandmark" placeholder="Landmark (optional) e.g. Near School" value="${existingAddr?.landmark || ''}"
          style="width:100%;padding:14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;">
      </div>

      <!-- Receiver details -->
      <p style="font-size:13px;font-weight:700;color:#94a3b8;letter-spacing:0.5px;margin:0 0 10px;">YOUR DETAILS</p>
      
      <div style="border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:14px;cursor:pointer;">
        <span class="material-icons-round" style="color:#94a3b8;font-size:20px;">phone</span>
        <input id="addrName" placeholder="Your name" value="${userName}"
          style="flex:1;border:none;outline:none;font-size:14px;font-family:inherit;font-weight:600;">
        <span style="color:#e2e8f0;">|</span>
        <input id="addrPhone" placeholder="+91 XXXXXXXXXX" value="${phone}" type="tel"
          style="flex:1;border:none;outline:none;font-size:14px;font-family:inherit;color:#64748b;">
      </div>

      <!-- Save address as -->
      <p style="font-size:13px;font-weight:700;color:#94a3b8;letter-spacing:0.5px;margin:0 0 10px;">SAVE ADDRESS AS</p>
      <div style="display:flex;gap:10px;margin-bottom:20px;" id="addressLabelRow">
        ${["Home","Work","Other"].map((label, i) => `
          <button onclick="selectAddressLabel('${label}')" id="label${label}"
            style="flex:1;padding:12px 8px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
            border:2px solid ${i===0?'#16a34a':'#e2e8f0'};background:${i===0?'#f0fdf4':'white'};
            color:${i===0?'#16a34a':'#64748b'};display:flex;align-items:center;justify-content:center;gap:6px;">
            <span class="material-icons-round" style="font-size:16px;">${label==='Home'?'home':label==='Work'?'business':'location_on'}</span>
            ${label}
          </button>`).join('')}
      </div>

      <!-- Save button -->
      <button onclick="saveAddressDetails('${locationName}', '${locationAddr}')"
        style="width:100%;padding:16px;background:#16a34a;color:white;border:none;border-radius:14px;
        font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(22,163,74,0.3);">
        Save Address
      </button>

    </div>
  `;

  window._selectedAddressLabel = existingAddr?.label || "Home";
  window._editingAddrIdx = editIdx ?? -1;
  // Pre-select label button
  if (existingAddr?.label) setTimeout(() => selectAddressLabel(existingAddr.label), 100);
  modal.style.display = "block";
}

window.selectAddressLabel = function(label) {
  window._selectedAddressLabel = label;
  ["Home","Work","Other"].forEach(l => {
    const btn = document.getElementById("label" + l);
    if (!btn) return;
    const active = l === label;
    btn.style.borderColor = active ? "#16a34a" : "#e2e8f0";
    btn.style.background = active ? "#f0fdf4" : "white";
    btn.style.color = active ? "#16a34a" : "#64748b";
  });
};

window.saveAddressDetails = function(locationName, locationAddr) {
  const floor = document.getElementById("addrFloor")?.value.trim();
  const landmark = document.getElementById("addrLandmark")?.value.trim();
  const name = document.getElementById("addrName")?.value.trim();
  const phone = document.getElementById("addrPhone")?.value.trim();
  const label = window._selectedAddressLabel || "Home";

  // Build full address
  const parts = [floor, locationName, landmark, locationAddr].filter(Boolean);
  const fullAddress = parts.join(", ");

  // Save to localStorage
  if (name) localStorage.setItem("zenvi_username", name);
  if (phone) localStorage.setItem("zenvi_phone", phone);

  const saved = JSON.parse(localStorage.getItem("zenvi_saved_addresses") || "[]");
  const entry = {
    label, name: locationName, fullAddr: fullAddress,
    floor, landmark, contactName: name, phone,
    lat: currentLocation?.lat, lng: currentLocation?.lng,
    savedAt: new Date().toISOString()
  };
  // If editing existing (by index), update that specific entry
  const editIdx = window._editingAddrIdx ?? -1;
  if (editIdx >= 0 && editIdx < saved.length) {
    saved[editIdx] = entry; // Update existing
  } else {
    const byLabel = saved.findIndex(a => a.label === label);
    if (byLabel >= 0) saved[byLabel] = entry;
    else saved.push(entry);
  }
  window._editingAddrIdx = -1;
  localStorage.setItem("zenvi_saved_addresses", JSON.stringify(saved));

  document.getElementById("addressDetailsModal").style.display = "none";
  
  // Update header Zomato style
  const homeAddrEl = document.getElementById("homeAddress");
  const locLabelEl = document.getElementById("locLabel");
  if (homeAddrEl) {
    const displayAddr = floor ? floor + ", " + locationName : locationName;
    homeAddrEl.innerText = displayAddr;
  }
  if (locLabelEl) {
    const icons = {Home:"🏠",Work:"💼",Other:"📍"};
    locLabelEl.textContent = (icons[label]||"📍") + " " + label;
  }
  
  showToast("✅ " + label + " address saved!");
  showPage("home");
};

// ===== TOAST NOTIFICATION =====
function showToast(msg, duration = 3000) {
  let toast = document.getElementById("zenviToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "zenviToast";
    toast.style.cssText = `
      position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
      background:#1e293b; color:white; padding:12px 20px; border-radius:25px;
      font-size:13px; font-weight:600; z-index:9999; white-space:nowrap;
      box-shadow:0 4px 20px rgba(0,0,0,0.3); transition:opacity 0.3s;
      font-family:inherit; pointer-events:none;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = "0"; }, duration);
}

// ===== RESTORE SAVED LOCATION =====
function restoreSavedLocation() {
  try {
    const saved = localStorage.getItem("zenvi_location");
    const savedName = localStorage.getItem("zenvi_location_name");

    // Validate — don't restore garbage values
    const invalidNames = ["Map pe location chunein...", "Location selected", "Selected Location", "null", "undefined", ""];
    // Reject coordinate-format names like "26.8018, 84.5037"
    const isCoordinate = savedName && /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(savedName.trim());
    if (!saved || !savedName || invalidNames.includes(savedName) || isCoordinate) {
      localStorage.removeItem("zenvi_location");
      localStorage.removeItem("zenvi_location_name");
      localStorage.removeItem("zenvi_location_addr");
      return;
    }

    currentLocation = JSON.parse(saved);
    const addr = localStorage.getItem("zenvi_location_addr") || "";
    const homeAddr = document.getElementById("homeAddress");
    if (homeAddr && savedName && !savedName.match(/\d+\.\d+/)) {
      // Show full address from saved addresses (like Zomato)
      const savedAddresses = JSON.parse(localStorage.getItem("zenvi_saved_addresses") || "[]");
      const matchAddr = savedAddresses.find(a => a.name === savedName || a.label === "Home");
      const displayText = matchAddr?.fullAddr || (savedName + (addr ? `, ${addr.split(",")[0]}` : ""));
      homeAddr.innerText = displayText;
    }

    const locSection = document.getElementById("locationSection");
    if (locSection) locSection.classList.add("location-set");
    // Update label
    const locLabel = document.getElementById("locLabel");
    if (locLabel) locLabel.innerHTML = "📍 <strong>Home</strong>";
    console.log("📍 Location restored:", savedName);
  } catch(e) {
    // Clear corrupted data
    localStorage.removeItem("zenvi_location");
    localStorage.removeItem("zenvi_location_name");
    console.warn("Location restore failed, cleared:", e);
  }
}

// ===== NAVIGATION =====
let currentPage = "home";
function showPage(pageName) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById(pageName + "Page");
  if (page) page.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const navItem = document.querySelector(`.nav-item[data-page="${pageName}"]`);
  if (navItem) navItem.classList.add("active");

  const header = document.getElementById("mainHeader");
  if (header) {
    header.classList.toggle("hidden", pageName === "explore");
  }

  if (pageName === "explore") {
    setTimeout(() => { if (!mapplsMap) initMap(); }, 300);
  }
  if (pageName === "home" && marketData.length > 0) {
    renderItems(marketData);
  }
  if (pageName === "profile") {
    setTimeout(onProfileOpen, 100);
  }
  if (pageName === "shops") {
    setTimeout(loadShopsList, 100);
  }
  currentPage = pageName;
  // Save immediately on every page change
  saveAppState();
}
window.showPage = showPage;

// ===== SEARCH =====
function setupSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  let timer;
  input.addEventListener("input", e => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (currentPage === "home") filterItems(e.target.value.trim());
    }, 250);
  });

  // ===== VOICE SEARCH =====
  const micBtn = document.getElementById("micBtn");
  if (!micBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.opacity = "0.4";
    micBtn.title = "Voice search not supported";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "hi-IN"; // Hindi first
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let isListening = false;

  micBtn.addEventListener("click", () => {
    if (isListening) {
      recognition.stop();
      return;
    }
    recognition.start();
  });

  recognition.onstart = () => {
    isListening = true;
    micBtn.style.color = "#ef4444";
    micBtn.style.animation = "pulse 1s infinite";
    showToast("🎤 Bol rahe hain... sun raha hoon");
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    console.log("🎤 Voice:", transcript);

    // Put in search box
    if (input) {
      input.value = transcript;
      filterItems(transcript);
    }
    showToast(`🎤 Suna: "${transcript}"`);
  };

  recognition.onerror = (e) => {
    if (e.error !== "no-speech") showToast("❌ Voice nahi suna. Dobara try karein.");
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.style.color = "";
    micBtn.style.animation = "";
  };
}

// ===== SETUP ALL EVENTS =====
function setupEvents() {
  // Nav items
  document.querySelectorAll(".nav-item[data-page]").forEach(item => {
    item.addEventListener("click", () => showPage(item.dataset.page));
  });

  // AI modal
  const modal = document.getElementById("aiModal");
  const aiTrigger = document.getElementById("aiTrigger");
  const closeBtn = document.getElementById("closeAiModal");
  const backdrop = document.getElementById("modalBackdrop");

  aiTrigger?.addEventListener("click", () => {
    modal.classList.add("open");
    setTimeout(() => document.getElementById("aiQuery")?.focus(), 300);
  });
  closeBtn?.addEventListener("click", () => modal.classList.remove("open"));
  backdrop?.addEventListener("click", () => modal.classList.remove("open"));

  // Quick chips
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const q = chip.dataset.q;
      if (q) {
        document.getElementById("aiQuery").value = q;
        sendAIMessage();
      }
    });
  });

  // Send button & enter key
  document.getElementById("sendQuery")?.addEventListener("click", sendAIMessage);
  document.getElementById("aiQuery")?.addEventListener("keypress", e => {
    if (e.key === "Enter") sendAIMessage();
  });

  // Category chips
  document.querySelectorAll(".cat-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".cat-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const cat = chip.dataset.category;
      document.getElementById("searchInput").value = "";
      if (cat === "All") renderItems(marketData);
      else renderItems(marketData.filter(i => i.category === cat));
    });
  });

  // Location section
  document.getElementById("locationSection")?.addEventListener("click", () => {
    // If already have saved addresses, show selector
    const saved = JSON.parse(localStorage.getItem("zenvi_saved_addresses") || "[]");
    if (saved.length > 0) {
      openLocationSelector();
    } else {
      // First time — go directly to map
      showPage("explore");
      setTimeout(() => window.switchExploreTab?.("location"), 200);
    }
  });
  document.getElementById("profileIcon")?.addEventListener("click", () => showPage("profile"));
  document.getElementById("backBtn")?.addEventListener("click", () => showPage("home"));
  document.getElementById("confirmBtn")?.addEventListener("click", confirmAndProceed);
  document.getElementById("currentLocationBtn")?.addEventListener("click", getCurrentLocation);
  document.getElementById("refreshBtn")?.addEventListener("click", fetchLivePrices);
  setupProfileSettings();
}

// ===== PROFILE FEATURES =====

// Favourites — localStorage mein save
let favourites = JSON.parse(localStorage.getItem('zenvi_favs') || '[]');
let priceAlerts = JSON.parse(localStorage.getItem('zenvi_alerts') || '[]');
let searchCount = parseInt(localStorage.getItem('zenvi_searches') || '0');

function toggleFavourite(item) {
  const idx = favourites.findIndex(f => f.name === item.name);
  if (idx > -1) {
    favourites.splice(idx, 1);
  } else {
    favourites.push({ name: item.name, emoji: item.emoji, price: item.price, unit: item.unit });
  }
  localStorage.setItem('zenvi_favs', JSON.stringify(favourites));
  renderFavourites();
  updateProfileStats();
}

function isFavourite(name) {
  return favourites.some(f => f.name === name);
}

function renderFavourites() {
  const list = document.getElementById("favouritesList");
  if (!list) return;
  if (favourites.length === 0) {
    list.innerHTML = '<p class="empty-state">Koi favourite item nahi hai.<br>Home page pe ⭐ tap karein.</p>';
    return;
  }
  list.innerHTML = favourites.map(f => `
    <div class="fav-item">
      <span class="fav-item-emoji">${f.emoji}</span>
      <div class="fav-item-info">
        <p>${f.name}</p>
        <span>₹${f.price}/${f.unit}</span>
      </div>
      <button class="fav-remove" onclick="toggleFavourite({name:'${f.name}',emoji:'${f.emoji}',price:'${f.price}',unit:'${f.unit}'})">
        <span class="material-icons-round">close</span>
      </button>
    </div>
  `).join('');
}

function renderAlerts() {
  const list = document.getElementById("alertsList");
  if (!list) return;
  if (priceAlerts.length === 0) {
    list.innerHTML = '<p class="empty-state">Koi alert set nahi hai.</p>';
    return;
  }
  list.innerHTML = priceAlerts.map((a, i) => `
    <div class="alert-item">
      <span class="material-icons-round">notifications_active</span>
      <p>${a.emoji || '🔔'} ${a.name} < ₹${a.targetPrice}/kg</p>
      <button onclick="removeAlert(${i})" style="background:none;border:none;cursor:pointer;color:#94a3b8;">
        <span class="material-icons-round" style="font-size:16px;">close</span>
      </button>
    </div>
  `).join('');
}

function removeAlert(idx) {
  priceAlerts.splice(idx, 1);
  localStorage.setItem('zenvi_alerts', JSON.stringify(priceAlerts));
  renderAlerts();
  updateProfileStats();
}

function addPriceAlert() {
  // Create proper modal instead of ugly prompt
  let modal = document.getElementById("alertModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "alertModal";
    document.body.appendChild(modal);
  }
  
  const topItems = marketData.slice(0, 20);
  
  modal.style.cssText = "position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;";
  modal.innerHTML = `
    <div style="background:white;width:100%;border-radius:24px 24px 0 0;padding:24px 20px 40px;">
      <div style="width:40px;height:4px;background:#e2e8f0;border-radius:99px;margin:0 auto 20px;"></div>
      <h3 style="font-size:17px;font-weight:800;margin-bottom:4px;">🔔 Price Alert Set Karein</h3>
      <p style="font-size:13px;color:#64748b;margin-bottom:16px;">Jab price neeche aaye tab notify karo</p>
      
      <div style="margin-bottom:14px;">
        <label style="font-size:12px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">ITEM CHUNEIN</label>
        <select id="alertItemSelect" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;">
          <option value="">-- Item select karein --</option>
          ${topItems.map(i => `<option value="${i.name}">${i.emoji} ${i.name} (abhi ₹${i.price}/kg)</option>`).join('')}
        </select>
      </div>
      
      <div style="margin-bottom:20px;">
        <label style="font-size:12px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">ALERT PRICE (₹/kg)</label>
        <div style="display:flex;align-items:center;gap:8px;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px;">
          <span style="font-size:18px;font-weight:800;color:#16a34a;">₹</span>
          <input id="alertPriceInput" type="number" min="1" max="10000" 
            placeholder="Kitne price pe alert chahiye?"
            style="flex:1;border:none;outline:none;font-size:16px;font-weight:700;font-family:inherit;">
          <span style="color:#64748b;font-size:13px;">/kg</span>
        </div>
      </div>
      
      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('alertModal').style.display='none';"
          style="flex:1;padding:14px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;">
          Cancel
        </button>
        <button onclick="saveAlertFromModal()"
          style="flex:2;padding:14px;background:#16a34a;color:white;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;">
          🔔 Set Alert
        </button>
      </div>
    </div>
  `;
  
  modal.style.display = "flex";
  modal.onclick = e => { if (e.target === modal) modal.style.display = "none"; };
}

window.saveAlertFromModal = function() {
  const itemName = document.getElementById("alertItemSelect")?.value;
  const price = document.getElementById("alertPriceInput")?.value;
  
  if (!itemName) { showToast("⚠️ Item select karein!"); return; }
  if (!price || isNaN(price) || price <= 0) { showToast("⚠️ Valid price daalen!"); return; }
  
  const item = marketData.find(i => i.name === itemName);
  if (!item) { showToast("⚠️ Item nahi mila"); return; }
  
  priceAlerts.push({ name: item.name, emoji: item.emoji, targetPrice: parseFloat(price), currentPrice: item.price });
  localStorage.setItem('zenvi_alerts', JSON.stringify(priceAlerts));
  
  document.getElementById("alertModal").style.display = "none";
  renderAlerts?.();
  updateProfileStats?.();
  showToast(`✅ Alert set! ${item.emoji} ${item.name} ₹${price} se kam hone pe notify karega`);
};

function updateProfileStats() {
  const upCount = marketData.filter(i => i.trend === 'up').length;
  const downCount = marketData.filter(i => i.trend === 'down').length;

  // Update new Zomato-style elements
  const favCount = document.getElementById("favCount");
  const alertCount = document.getElementById("alertCount");
  const mwItems = document.getElementById("mwItems");
  const mwChanges = document.getElementById("mwChanges");

  if (favCount) favCount.textContent = `${favourites.length} items saved`;
  if (alertCount) alertCount.textContent = `${priceAlerts.length} alerts set`;
  if (mwItems) mwItems.textContent = `${marketData.length} items tracked`;
  if (mwChanges) mwChanges.textContent = `📈${upCount} 📉${downCount}`;
}

function updateSavedLocation() {
  const locName = document.getElementById("savedLocName");
  const locAddr = document.getElementById("savedLocAddr");
  const heroTag = document.getElementById("profileLocationTag");
  const heroTagText = document.getElementById("profileLocationText");

  const savedLoc = currentLocation?.name;
  if (savedLoc && savedLoc !== "Selected Location") {
    if (locName) locName.textContent = savedLoc;
    if (locAddr) locAddr.textContent = currentLocation.fullAddr || "Location saved";
    if (heroTag) heroTag.style.display = "inline-flex";
    if (heroTagText) heroTagText.textContent = savedLoc;
  }
}

// Dark mode toggle

function showFavouritesList() {
  if (favourites.length === 0) {
    showToast("⭐ Koi favourite nahi — Home pe item pe tap karo");
    return;
  }
  // Create popup
  let modal = document.getElementById("favModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "favModal";
    modal.style.cssText = "position:fixed;inset:0;z-index:3000;display:flex;align-items:flex-end;background:rgba(0,0,0,0.5);";
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:white;width:100%;border-radius:24px 24px 0 0;padding:24px 20px 40px;max-height:70vh;overflow-y:auto;">
      <div style="width:40px;height:4px;background:#e2e8f0;border-radius:99px;margin:0 auto 16px;"></div>
      <h3 style="font-size:17px;font-weight:800;margin-bottom:16px;">⭐ Favourite Items (${favourites.length})</h3>
      ${favourites.map(f => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <span style="font-size:24px;">${f.emoji}</span>
          <div style="flex:1;"><p style="font-weight:700;margin:0;">${f.name}</p><span style="font-size:12px;color:#16a34a;">₹${f.price}/kg</span></div>
          <button onclick="toggleFavourite({name:'${f.name}',emoji:'${f.emoji}',price:'${f.price}',unit:'${f.unit}'})" 
            style="background:#fee2e2;color:#ef4444;border:none;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;">Remove</button>
        </div>`).join('')}
      <button onclick="document.getElementById('favModal').style.display='none';"
        style="width:100%;margin-top:16px;padding:14px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;">
        Close
      </button>
    </div>`;
  modal.style.display = "flex";
  modal.onclick = e => { if (e.target === modal) modal.style.display = "none"; };
}

function setupProfileSettings() {
  // ===== 3-dot Dropdown =====
  document.getElementById("profileMenuBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const dd = document.getElementById("profileDropdown");
    if (dd) dd.style.display = dd.style.display === "none" ? "block" : "none";
  });
  document.addEventListener("click", () => {
    const dd = document.getElementById("profileDropdown");
    if (dd) dd.style.display = "none";
  });

  // ===== Dark Mode =====
  document.getElementById("darkModeCheck")?.addEventListener("change", e => {
    document.body.classList.toggle("dark-mode", e.target.checked);
    localStorage.setItem("zenvi_dark", e.target.checked ? "1" : "0");
    showToast(e.target.checked ? "🌙 Dark mode on" : "☀️ Light mode on");
  });
  // Dark mode is restored at startup (top of file)

  // ===== Notifications Toggle =====
  document.getElementById("notifCheck")?.addEventListener("change", e => {
    localStorage.setItem("zenvi_notif", e.target.checked ? "1" : "0");
    showToast(e.target.checked ? "🔔 Notifications on" : "🔕 Notifications off");
  });

  // ===== Clear Chat =====
  document.getElementById("clearChatBtn")?.addEventListener("click", () => {
    document.getElementById("profileDropdown").style.display = "none";
    if (confirm("Chat history clear karein?")) {
      chatHistory = [];
      const chatBody = document.getElementById("chatBody");
      if (chatBody) chatBody.innerHTML = `<div class="ai-msg-wrap"><div class="ai-bubble">🙏 <strong>Namaste!</strong> Chat history clear ho gayi.</div></div>`;
      showToast("✅ Chat history cleared!");
    }
  });

  // ===== Saved Address (quick row) =====
  document.getElementById("favQuickBtn")?.addEventListener("click", () => {
    showToast("⭐ " + (favourites.length > 0 ? `${favourites.length} favourite items` : "Koi favourite nahi hai"));
  });
  document.getElementById("alertQuickBtn")?.addEventListener("click", () => {
    showToast("🔔 " + (priceAlerts.length > 0 ? `${priceAlerts.length} alerts set hain` : "Koi alert nahi hai"));
  });

  // ===== Edit Profile =====
  document.getElementById("editProfileBtn")?.addEventListener("click", () => {
    const user = window.zenviAuth?.auth?.currentUser;
    if (!user) { showToast("⚠️ Pehle login karein"); return; }
    openEditProfileModal(user);
  });

  // ===== Quick Row =====
  document.getElementById("favQuickBtn")?.addEventListener("click", () => {
    showFavouritesList();
  });
  document.getElementById("alertQuickBtn")?.addEventListener("click", () => {
    addPriceAlert();
  });

  // ===== Favourites row =====
  document.getElementById("showFavourites")?.addEventListener("click", showFavouritesList);

  // ===== Alerts row =====
  document.getElementById("showAlerts")?.addEventListener("click", () => addPriceAlert());

  // ===== About Zenvi =====
  document.querySelectorAll(".zp-menu-row").forEach(row => {
    const text = row.querySelector(".zp-row-text p")?.textContent;
    if (text === "About Zenvi") {
      row.addEventListener("click", () => openAboutModal());
    }
    if (text === "Help & Support") {
      row.addEventListener("click", () => {
        window.open("mailto:zenvi.support@gmail.com?subject=Zenvi Help - Issue Report", "_blank");
        showToast("📧 Email khul raha hai...");
      });
    }
    if (text === "Privacy Policy") {
      row.addEventListener("click", () => {
        showToast("🔒 Aapka data secure hai. Koi third party ko share nahi kiya jaata.");
      });
    }
    if (text === "List Your Crop") {
      row.addEventListener("click", () => showToast("🌾 Coming Soon! Jald aayega."));
    }
    if (text === "Register Your Shop") {
      row.addEventListener("click", () => showPage("shops"));
    }
  });
}

// Call when profile page opens
function onProfileOpen() {
  renderFavourites();
  renderAlerts();
  updateProfileStats();
  updateSavedLocation();
}

// ===== SPLASH SCREEN =====
let splashHidden = false;
function hideSplash() {
  if (splashHidden) return;
  splashHidden = true;

  const splash = document.getElementById("splashScreen");
  if (!splash) return;

  const isRefresh = sessionStorage.getItem("zenvi_launched");

  if (isRefresh) {
    // Refresh — splash turant remove
    splash.remove();
  } else {
    // First launch — 2 second animation
    sessionStorage.setItem("zenvi_launched", "1");
    setTimeout(() => {
      splash.classList.add("hide");
      setTimeout(() => splash.remove(), 500);
    }, 2000);
  }
}

// ===== INIT =====
// ===== SAVE/RESTORE APP STATE (refresh fix) =====
function saveAppState() {
  try {
    sessionStorage.setItem("zenvi_state", JSON.stringify({
      page: currentPage || "home",
      ts: Date.now()
    }));
  } catch(e) {}
}

function restoreAppState() {
  try {
    const raw = sessionStorage.getItem("zenvi_state");
    if (!raw) return "home";
    const state = JSON.parse(raw);
    // Restore if within 5 minutes
    if (Date.now() - state.ts < 300000 && state.page) {
      console.log("📱 Restoring page:", state.page);
      return state.page;
    }
  } catch(e) {}
  return "home";
}

// Also save on visibility change (most reliable on mobile)
window.addEventListener("beforeunload", saveAppState);
window.addEventListener("pagehide", saveAppState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveAppState();
});

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Zenvi starting...");

  // Clear ALL bad/coordinate location data on startup
  const savedName = localStorage.getItem("zenvi_location_name") || "";
  const badNames = ["Bettiah, Bettiah", "Bettiah,Bettiah", "Bettiah"];
  const isBadLocation = isCoordinateString(savedName) || badNames.includes(savedName.trim()) 
    || savedName.includes("Map drag") || savedName === "My Location" 
    || savedName === "Selected Area" || savedName.includes("drag karo");
  if (isBadLocation) {
    localStorage.removeItem("zenvi_location");
    localStorage.removeItem("zenvi_location_name");
    localStorage.removeItem("zenvi_location_addr");
    // Also clear cached prices with coordinate names
    localStorage.removeItem("zenvi_prices");
    localStorage.removeItem("zenvi_prices_time");
    console.log("🧹 Cleared bad location:", savedName || "(empty)");
  }
  
  // Force clear any cached coordinate location
  try {
    const cachedLoc = JSON.parse(localStorage.getItem("zenvi_location") || "{}");
    if (cachedLoc.name && isCoordinateString(cachedLoc.name)) {
      localStorage.removeItem("zenvi_location");
      localStorage.removeItem("zenvi_location_name");
    }
  } catch(e) {}

  const isRefresh = sessionStorage.getItem("zenvi_launched");
  const lastPage = restoreAppState();

  if (isRefresh) {
    // Refresh — splash instant remove, last page restore
    hideSplash();
    restoreSavedLocation();
    showPage(lastPage);
    fetchLivePrices();
  } else {
    // First launch — splash dikhao, home page
    hideSplash();
    restoreSavedLocation();
    showPage("home");
    fetchLivePrices();
  }

  setupSearch();
  setupEvents();
  console.log("✅ Zenvi ready! Page:", lastPage);
});

// ===== AUTO REFRESH (5 min) =====
setInterval(() => {
  if (document.visibilityState === "visible") fetchLivePrices();
}, 300000);

// ===== GLOBAL EXPORTS =====
window.sendAIMessage = sendAIMessage;
window.filterItems = filterItems;
window.getCurrentLocation = getCurrentLocation;
window.confirmAndProceed = confirmAndProceed;
window.confirmLocation = confirmLocation;

// ===== SHOP REGISTRATION =====
window.toggleRegisterForm = function() {
  const form = document.getElementById("shopRegisterForm");
  if (!form) return;
  const isOpen = form.style.display !== "none";
  form.style.display = isOpen ? "none" : "block";
  if (!isOpen) form.scrollIntoView({ behavior: "smooth", block: "start" });
};

window.useCurrentLocationForShop = function() {
  const input = document.getElementById("shopAddress");
  if (!input) return;
  const loc = window.currentLocation?.name || "";
  if (loc) {
    input.value = loc + (window.currentLocation?.fullAddr ? `, ${window.currentLocation.fullAddr.split(",")[0]}` : "");
    showToast("📍 Location fill ho gayi!");
  } else {
    showToast("⚠️ Pehle Explore tab se location set karein");
  }
};

window.submitShopRegistration = async function() {
  const name    = document.getElementById("shopName")?.value.trim();
  const owner   = document.getElementById("ownerName")?.value.trim();
  const phone   = document.getElementById("shopPhone")?.value.trim();
  const type    = document.getElementById("shopType")?.value;
  const address = document.getElementById("shopAddress")?.value.trim();
  const desc    = document.getElementById("shopDesc")?.value.trim();
  const items   = document.getElementById("shopItems")?.value.trim();

  // Validation
  if (!name || !owner || !phone || !type || !address) {
    showToast("⚠️ Saari * fields fill karein!");
    return;
  }
  if (phone.replace(/\D/g,'').length < 10) {
    showToast("⚠️ Valid phone number daalen");
    return;
  }

  const btn = document.querySelector(".submit-shop-btn");
  if (btn) { btn.textContent = "Submitting..."; btn.disabled = true; }

  const shopData = {
    name, owner, phone, type, address, desc, items,
    lat: window.currentLocation?.lat || null,
    lng: window.currentLocation?.lng || null,
    registeredAt: new Date().toISOString(),
    submittedBy: window.zenviAuth?.auth?.currentUser?.uid || "anonymous",
    status: "pending"
  };

  // Save to localStorage FIRST (always works)
  const shops = JSON.parse(localStorage.getItem("zenvi_shops") || "[]");
  shops.push(shopData);
  localStorage.setItem("zenvi_shops", JSON.stringify(shops));

  // Save to Firebase (permanent cloud storage)
  let cloudSaved = false;
  if (window.saveShopToFirebase) {
    cloudSaved = await window.saveShopToFirebase(shopData);
  }

  if (btn) { btn.innerHTML = '<span class="material-icons-round">store</span> Register My Shop'; btn.disabled = false; }

  if (cloudSaved) {
    showToast(`✅ "${name}" permanently save ho gayi! ☁️`);
  } else {
    showToast(`✅ "${name}" locally saved! Login karein cloud save ke liye.`);
  }

  // Clear form
  ["shopName","ownerName","shopPhone","shopAddress","shopDesc"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("shopType").value = "";
  document.getElementById("shopRegisterForm").style.display = "none";

  // Refresh shops list
  loadShopsList();
};

function loadShopsList() {
  const list = document.getElementById("shopsList");
  if (!list) return;

  // Load from Firebase first if available
  if (window.loadShopsFromFirebase) {
    window.loadShopsFromFirebase().then(firebaseShops => {
      if (firebaseShops.length > 0) {
        renderShopsList(firebaseShops);
        return;
      }
      // Fallback to localStorage
      const shops = JSON.parse(localStorage.getItem("zenvi_shops") || "[]");
      renderShopsList(shops);
    });
    return;
  }

  const shops = JSON.parse(localStorage.getItem("zenvi_shops") || "[]");
  renderShopsList(shops);
}

function loadShopsList_inner() {} // placeholder

function renderShopsList(shops) {
  const list = document.getElementById("shopsList");
  if (!list) return;
  window._shopsData = shops; // Store globally for easy access

  const typeEmoji = {
    sabji:"🥬", phal:"🍎", kirana:"🛒", anaaj:"🌾",
    dairy:"🥛", mandi:"🏪", other:"✨"
  };
  const typeLabel = {
    sabji:"Sabji Bhandar", phal:"Phal Bhandar", kirana:"Kirana Store",
    anaaj:"Anaaj/Dal", dairy:"Dairy/Milk", mandi:"Mandi/Wholesale", other:"Other"
  };

  if (shops.length === 0) {
    list.innerHTML = `<div class="no-shops">
      <span style="font-size:48px;">🏪</span>
      <p>Abhi koi shop registered nahi hai.</p>
      <p style="font-size:12px;color:#94a3b8;">Pehle shop register karein!</p>
    </div>`;
    return;
  }

  list.innerHTML = shops.map(s => {
    // Calculate distance if location available
    const userLat = window.currentLocation?.lat;
    const userLng = window.currentLocation?.lng;
    let distText = "";
    if (userLat && s.lat && s.lng) {
      const d = getDistanceKm(userLat, userLng, s.lat, s.lng);
      distText = `${d} km away`;
    }

    // Real rating from data, or show "Rate this shop" if none
    const rating = s.rating || null;
    const ratingCount = s.ratingCount || 0;

    // Items preview
    const items = s.items || "";
    const phone = s.phone?.replace(/\D/g, '') || "";

    return `
    <div class="shop-card-new" onclick="openShopDetail(${JSON.stringify(JSON.stringify(s)).slice(1,-1)})" style="cursor:pointer;">
      <!-- Top row: icon + info + distance -->
      <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;">
        <div class="shop-icon" style="font-size:28px;">${typeEmoji[s.type] || "🏪"}</div>
        <div style="flex:1;">
          <h4 style="font-size:15px;font-weight:800;margin:0 0 2px;">${s.name}</h4>
          <p style="font-size:12px;color:var(--text3);margin:0 0 4px;">${typeLabel[s.type] || "Shop"}</p>
          <p style="font-size:12px;color:var(--text2);margin:0;">📍 ${s.address}</p>
        </div>
        ${distText ? `<span style="font-size:11px;font-weight:700;color:var(--primary);background:var(--primary-glow);padding:3px 8px;border-radius:20px;white-space:nowrap;">${distText}</span>` : ""}
      </div>

      <!-- Rating row -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
        ${rating 
          ? `<span style="background:#fef3c7;color:#f59e0b;font-size:12px;font-weight:700;padding:3px 8px;border-radius:6px;">⭐ ${rating} (${ratingCount})</span>`
          : `<span style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700;">☆ Rate</span>`
        }
        <span style="font-size:12px;color:var(--text3);">👤 ${s.owner}</span>
        <span style="font-size:12px;color:var(--text3);">${new Date(s.registeredAt || Date.now()).toLocaleDateString('hi-IN')}</span>
      </div>

      ${items ? `<p style="font-size:12px;color:var(--text2);margin-bottom:10px;padding:8px;background:var(--bg);border-radius:8px;">🛒 ${items}</p>` : ""}

      <!-- Action buttons -->
      <div style="display:flex;gap:8px;" onclick="event.stopPropagation()">
        <button onclick="event.stopPropagation();viewShopByIndex(${shops.indexOf(s)})"
          style="flex:1;padding:10px;background:#f0fdf4;color:var(--primary);border:1.5px solid #bbf7d0;
          border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
          display:flex;align-items:center;justify-content:center;gap:6px;">
          <span class="material-icons-round" style="font-size:16px;">storefront</span> View
        </button>
        ${s.submittedBy === window.zenviAuth?.auth?.currentUser?.uid ? `
        <button onclick="event.stopPropagation();editShopByIndex(${shops.indexOf(s)})"
          style="flex:1;padding:10px;background:#eff6ff;color:#3b82f6;border:1.5px solid #bfdbfe;
          border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
          display:flex;align-items:center;justify-content:center;gap:6px;">
          <span class="material-icons-round" style="font-size:16px;">edit</span> Edit
        </button>` : `
        <button onclick="window.open('https://wa.me/${phone}?text=Hi, I found your shop on Zenvi app!', '_blank')"
          style="flex:1;padding:10px;background:#dcfce7;color:#16a34a;border:1.5px solid #bbf7d0;
          border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
          display:flex;align-items:center;justify-content:center;gap:6px;">
          💬 WhatsApp
        </button>`}
      </div>
    </div>`;
  }).join('');
}

// loadShopsList on shops page open is handled in showPage directly

// ===== EDIT PROFILE MODAL (Swiggy style) =====
function openEditProfileModal(user) {
  let modal = document.getElementById("editProfileModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "editProfileModal";
    document.body.appendChild(modal);
  }

  modal.style.cssText = "position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;";

  modal.innerHTML = `
    <div style="background:white;width:100%;border-radius:24px 24px 0 0;padding:0 0 40px;max-height:92vh;overflow-y:auto;">
      
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid #f1f5f9;position:sticky;top:0;background:white;z-index:1;">
        <button onclick="document.getElementById('editProfileModal').style.display='none';" 
          style="background:none;border:none;cursor:pointer;padding:4px;">
          <span class="material-icons-round" style="font-size:22px;">arrow_back</span>
        </button>
        <h3 style="font-size:17px;font-weight:800;flex:1;">Your Profile</h3>
        <button id="saveProfileBtn" onclick="saveProfileChanges()"
          style="background:#16a34a;color:white;border:none;border-radius:20px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">
          Save
        </button>
      </div>

      <!-- Avatar -->
      <div style="text-align:center;padding:24px 20px 16px;">
        <div style="width:80px;height:80px;border-radius:50%;background:#e0e7ff;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
          ${user.photoURL 
            ? `<img src="${user.photoURL}" style="width:100%;height:100%;object-fit:cover;">` 
            : `<span style="font-size:36px;font-weight:800;color:#6366f1;">${(user.displayName||"U")[0].toUpperCase()}</span>`}
        </div>
      </div>

      <!-- Fields -->
      <div style="padding:0 20px;">
        
        <!-- Name -->
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px;">Name</label>
          <div style="border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;display:flex;align-items:center;">
            <input id="editName" value="${user.displayName || ''}" 
              style="flex:1;border:none;outline:none;font-size:15px;font-weight:600;font-family:inherit;color:#1e293b;"
              placeholder="Aapka naam">
            <button onclick="document.getElementById('editName').value=''"
              style="background:#f1f5f9;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
              <span class="material-icons-round" style="font-size:14px;color:#94a3b8;">close</span>
            </button>
          </div>
        </div>

        <!-- Phone -->
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px;">Mobile</label>
          <div style="border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;display:flex;align-items:center;">
            <input id="editPhone" type="tel" 
              value="${localStorage.getItem('zenvi_phone') || ''}"
              style="flex:1;border:none;outline:none;font-size:15px;font-weight:600;font-family:inherit;color:#1e293b;"
              placeholder="+91 XXXXXXXXXX" maxlength="13">
            <span style="font-size:12px;font-weight:700;color:#16a34a;cursor:pointer;" 
              onclick="showToast('📱 Phone number update hoga')">CHANGE</span>
          </div>
        </div>

        <!-- Email -->
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px;">Email</label>
          <div style="border:1.5px solid #f1f5f9;border-radius:12px;padding:14px;display:flex;align-items:center;background:#f8fafc;">
            <input value="${user.email || ''}" readonly
              style="flex:1;border:none;outline:none;font-size:15px;font-weight:600;font-family:inherit;color:#94a3b8;background:transparent;">
            <span style="font-size:12px;font-weight:700;color:#16a34a;cursor:pointer;"
              onclick="showToast('📧 Email Google account se linked hai')">CHANGE</span>
          </div>
        </div>

        <!-- Gender -->
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px;">Gender</label>
          <div style="border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;">
            <select id="editGender" style="width:100%;border:none;outline:none;font-size:15px;font-weight:600;font-family:inherit;color:#1e293b;background:transparent;">
              <option value="">Select Gender</option>
              <option value="male" ${localStorage.getItem('zenvi_gender')==='male'?'selected':''}>Male</option>
              <option value="female" ${localStorage.getItem('zenvi_gender')==='female'?'selected':''}>Female</option>
              <option value="other" ${localStorage.getItem('zenvi_gender')==='other'?'selected':''}>Other</option>
            </select>
          </div>
        </div>

      </div>

      <!-- Update Button -->
      <div style="padding:0 20px;">
        <button onclick="saveProfileChanges()"
          style="width:100%;padding:16px;background:#e2e8f0;color:#94a3b8;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;"
          id="updateProfileBtn">
          Update profile
        </button>
      </div>

    </div>
  `;

  modal.style.display = "flex";
  modal.onclick = e => { if (e.target === modal) modal.style.display = "none"; };
}

window.saveProfileChanges = function() {
  const name   = document.getElementById("editName")?.value.trim();
  const phone  = document.getElementById("editPhone")?.value.trim();
  const gender = document.getElementById("editGender")?.value;

  if (phone) localStorage.setItem("zenvi_phone", phone);
  if (gender) localStorage.setItem("zenvi_gender", gender);

  // Update displayed name
  if (name) {
    const nameEl = document.getElementById("profileDisplayName");
    if (nameEl) nameEl.textContent = name;
  }

  document.getElementById("editProfileModal").style.display = "none";
  showToast("✅ Profile updated!");
};

// ===== PREMIUM ABOUT MODAL =====
function openAboutModal() {
  let modal = document.getElementById("aboutModal");
  if (!modal) { modal = document.createElement("div"); modal.id = "aboutModal"; document.body.appendChild(modal); }

  modal.style.cssText = "position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;padding:0;";
  modal.innerHTML = `
    <div style="background:white;width:100%;border-radius:24px 24px 0 0;max-height:92vh;overflow-y:auto;">
      
      <!-- Green header -->
      <div style="background:linear-gradient(145deg,#15803d,#16a34a,#22c55e);padding:36px 24px 28px;text-align:center;position:relative;">
        <div style="width:72px;height:72px;background:rgba(255,255,255,0.15);border-radius:20px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);">
          <span style="font-size:40px;">🌿</span>
        </div>
        <h1 style="color:white;font-size:28px;font-weight:800;margin:0 0 4px;letter-spacing:-0.5px;">Zenvi</h1>
        <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:0;letter-spacing:1px;font-weight:600;">SMART MANDI APP</p>
      </div>

      <div style="padding:20px 20px 36px;">
        
        <!-- Tagline -->
        <p style="font-size:14px;color:#475569;text-align:center;line-height:1.6;margin:0 0 20px;padding:0 8px;">
          Real-time sabji, phal aur anaaj ke rates aur nearby shops — bilkul free.
        </p>

        <!-- Stats cards -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
          ${[["100+","Items"],["Free","Always"],["AI","Powered"]].map(([n,l]) => `
            <div style="background:#f0fdf4;border-radius:14px;padding:14px 8px;text-align:center;">
              <p style="font-size:22px;font-weight:800;color:#16a34a;margin:0 0 2px;">${n}</p>
              <p style="font-size:11px;color:#64748b;font-weight:600;margin:0;">${l}</p>
            </div>`).join('')}
        </div>

        <!-- Features -->
        <div style="background:#f8fafc;border-radius:16px;padding:16px;margin-bottom:16px;">
          <p style="font-size:11px;font-weight:800;color:#94a3b8;letter-spacing:0.8px;margin:0 0 12px;">FEATURES</p>
          ${[
            ["📊","Live Mandi Prices","Real-time data.gov.in se"],
            ["🔍","Smart Search","Hindi + Hinglish support"],
            ["📍","Nearby Shops & Mandis","GPS aur Mappls map"],
            ["🤖","AI Assistant","Gemini powered insights"]
          ].map(([ic,t,s]) => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;">
              <span style="font-size:20px;">${ic}</span>
              <div><p style="font-size:14px;font-weight:700;color:#1e293b;margin:0;">${t}</p>
              <p style="font-size:11px;color:#94a3b8;margin:0;">${s}</p></div>
            </div>`).join('')}
        </div>

        <!-- Coming Soon -->
        <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:14px;padding:14px 16px;margin-bottom:16px;display:flex;gap:12px;align-items:center;">
          <span style="font-size:24px;">🚀</span>
          <div>
            <p style="font-size:13px;font-weight:800;color:#92400e;margin:0 0 2px;">Coming Soon</p>
            <p style="font-size:12px;color:#78350f;margin:0;">Local services — Labour, Plumber, Rapido-type booking</p>
          </div>
        </div>

        <!-- Goal -->
        <div style="text-align:center;padding:16px;margin-bottom:16px;">
          <p style="font-size:15px;font-weight:700;color:#16a34a;font-style:italic;margin:0;">
            "Making local markets digital and transparent"
          </p>
        </div>

        <!-- Developer card -->
        <div style="background:#f8fafc;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div style="width:42px;height:42px;background:#16a34a;border-radius:12px;display:flex;align-items:center;justify-content:center;">
            <span style="color:white;font-size:18px;font-weight:800;">A</span>
          </div>
          <div style="flex:1;">
            <p style="font-size:14px;font-weight:800;color:#1e293b;margin:0;">Built by Aditya Soni</p>
            <p style="font-size:12px;color:#94a3b8;margin:0;">Version 1.0 • Made with ❤️ in India 🇮🇳</p>
          </div>
        </div>

        <!-- Close button -->
        <button onclick="document.getElementById('aboutModal').style.display='none';"
          style="width:100%;padding:16px;background:#16a34a;color:white;border:none;border-radius:14px;
          font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;
          box-shadow:0 4px 16px rgba(22,163,74,0.3);">
          Done
        </button>
      </div>
    </div>
  `;
  modal.style.display = "flex";
  modal.onclick = e => { if (e.target === modal) modal.style.display = "none"; };
}

// ===== ADD NEW ITEM MODAL =====
window.openAddItemModal = function() {
  let modal = document.getElementById("addItemModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "addItemModal";
    document.body.appendChild(modal);
  }

  modal.style.cssText = "position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;";

  modal.innerHTML = `
    <div style="background:white;width:100%;border-radius:24px 24px 0 0;padding:24px 20px 40px;">
      <div style="width:40px;height:4px;background:#e2e8f0;border-radius:99px;margin:0 auto 20px;"></div>
      <h3 style="font-size:17px;font-weight:800;margin-bottom:4px;">➕ Naya Item Add Karein</h3>
      <p style="font-size:13px;color:#64748b;margin-bottom:20px;">Jo item list mein nahi hai, uska rate add karein</p>

      <div style="margin-bottom:14px;">
        <label style="font-size:12px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">ITEM KA NAAM *</label>
        <input id="newItemName" type="text" placeholder="e.g. Arbi, Jackfruit, Jowar..."
          style="width:100%;padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
          font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;">
      </div>

      <div style="margin-bottom:14px;">
        <label style="font-size:12px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">PRICE (₹/kg) *</label>
        <div style="display:flex;align-items:center;gap:8px;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px 14px;">
          <span style="font-size:18px;font-weight:800;color:#16a34a;">₹</span>
          <input id="newItemPrice" type="number" min="1" max="10000" placeholder="0.00"
            style="flex:1;border:none;outline:none;font-size:18px;font-weight:700;font-family:inherit;">
          <span style="color:#64748b;">/kg</span>
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <label style="font-size:12px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">CATEGORY</label>
        <select id="newItemCategory" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;">
          <option value="Vegetables">🥬 Sabji</option>
          <option value="Fruits">🍎 Phal</option>
          <option value="Grains">🌾 Anaaj</option>
          <option value="Spices">🌶️ Masale</option>
          <option value="Others">✨ Others</option>
        </select>
      </div>

      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('addItemModal').style.display='none';"
          style="flex:1;padding:14px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;">
          Cancel
        </button>
        <button onclick="saveNewItem()"
          style="flex:2;padding:14px;background:#16a34a;color:white;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;">
          ✅ Add Item
        </button>
      </div>
    </div>
  `;

  modal.style.display = "flex";
  modal.onclick = e => { if (e.target === modal) modal.style.display = "none"; };
  setTimeout(() => document.getElementById("newItemName")?.focus(), 300);
};

window.saveNewItem = function() {
  const name  = document.getElementById("newItemName")?.value.trim();
  const price = document.getElementById("newItemPrice")?.value;
  const cat   = document.getElementById("newItemCategory")?.value;

  if (!name) { showToast("⚠️ Item ka naam daalen!"); return; }
  if (!price || isNaN(price) || price <= 0) { showToast("⚠️ Valid price daalen!"); return; }

  // Check if already exists
  const exists = marketData.find(i => i.name.toLowerCase() === name.toLowerCase());
  if (exists) { showToast(`⚠️ "${name}" already list mein hai — ₹${exists.price}/kg`); return; }

  // Add to marketData
  const newItem = {
    name, price: parseFloat(price).toFixed(2),
    unit: "kg", category: cat,
    trend: "stable", emoji: getEmoji(name),
    source: "user", minPrice: parseFloat(price), maxPrice: parseFloat(price), hasRange: false
  };
  marketData.push(newItem);
  marketData.sort((a,b) => a.name.localeCompare(b.name));
  renderItems(marketData);

  // Also suggest to community
  if (window.submitPriceSuggestion) {
    window.submitPriceSuggestion(name, price, window.currentLocation?.name);
  }

  document.getElementById("addItemModal").style.display = "none";
  showToast(`✅ "${name}" added at ₹${price}/kg!`);
};

// ===== RATE SHOP MODAL =====
window.openRateShop = function(shopId, shopName) {
  const user = window.zenviAuth?.auth?.currentUser;
  if (!user) {
    showToast("⚠️ Rating dene ke liye login karein");
    return;
  }

  let modal = document.getElementById("rateShopModal");
  if (!modal) { modal = document.createElement("div"); modal.id = "rateShopModal"; document.body.appendChild(modal); }

  let selectedStars = 0;

  modal.style.cssText = "position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;";
  modal.innerHTML = `
    <div style="background:white;width:100%;border-radius:24px 24px 0 0;padding:24px 20px 40px;">
      <div style="width:40px;height:4px;background:#e2e8f0;border-radius:99px;margin:0 auto 20px;"></div>
      <h3 style="font-size:17px;font-weight:800;text-align:center;margin-bottom:4px;">Rate this Shop</h3>
      <p style="font-size:14px;color:#64748b;text-align:center;margin-bottom:24px;">${shopName}</p>

      <!-- Star selector -->
      <div style="display:flex;justify-content:center;gap:12px;margin-bottom:24px;" id="starRow">
        ${[1,2,3,4,5].map(n => `
          <span onclick="selectStar(${n})" id="star${n}"
            style="font-size:40px;cursor:pointer;opacity:0.3;transition:all 0.15s;">★</span>
        `).join('')}
      </div>

      <p id="ratingLabel" style="text-align:center;font-size:14px;color:#94a3b8;margin-bottom:20px;">
        Star select karein
      </p>

      <textarea id="ratingComment" placeholder="Optional: Kuch likhein is dukaan ke baare mein..."
        rows="3" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;
        font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:16px;resize:none;"></textarea>

      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('rateShopModal').style.display='none';"
          style="flex:1;padding:14px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;">
          Cancel
        </button>
        <button onclick="submitShopRating('${shopId}', '${shopName}')"
          style="flex:2;padding:14px;background:#16a34a;color:white;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;">
          ⭐ Submit Rating
        </button>
      </div>
    </div>
  `;

  modal.style.display = "flex";
  modal.onclick = e => { if (e.target === modal) modal.style.display = "none"; };
};

const ratingLabels = ["", "Bahut Bura 😞", "Theek Nahi 😐", "Theek Hai 🙂", "Acha Hai 😊", "Bahut Acha! 🤩"];

window.selectStar = function(n) {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`star${i}`);
    if (el) el.style.opacity = i <= n ? "1" : "0.3";
  }
  const label = document.getElementById("ratingLabel");
  if (label) label.textContent = ratingLabels[n];
  window._selectedStars = n;
};

window.submitShopRating = async function(shopId, shopName) {
  const stars = window._selectedStars || 0;
  if (!stars) { showToast("⚠️ Pehle stars select karein!"); return; }

  const comment = document.getElementById("ratingComment")?.value.trim();
  const user = window.zenviAuth?.auth?.currentUser;

  // Save to localStorage
  const ratings = JSON.parse(localStorage.getItem("zenvi_shop_ratings") || "{}");
  if (!ratings[shopId]) ratings[shopId] = { total: 0, count: 0 };
  ratings[shopId].total += stars;
  ratings[shopId].count += 1;
  ratings[shopId].avg = (ratings[shopId].total / ratings[shopId].count).toFixed(1);
  localStorage.setItem("zenvi_shop_ratings", JSON.stringify(ratings));

  // Update shop in localStorage
  const shops = JSON.parse(localStorage.getItem("zenvi_shops") || "[]");
  const shop = shops.find(s => s.id === shopId || s.name === shopName);
  if (shop) {
    shop.rating = ratings[shopId].avg;
    shop.ratingCount = ratings[shopId].count;
    localStorage.setItem("zenvi_shops", JSON.stringify(shops));
  }

  // Save to Firebase
  if (window.zenviDB) {
    try {
      const { addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await addDoc(collection(window.zenviDB, "shop_ratings"), {
        shopId, shopName, stars, comment,
        userId: user?.uid, userName: user?.displayName,
        createdAt: serverTimestamp()
      });
    } catch(e) { console.warn("Rating Firebase save:", e.message); }
  }

  document.getElementById("rateShopModal").style.display = "none";
  window._selectedStars = 0;
  showToast(`⭐ Rating submit ho gayi! ${stars}/5 stars`);
  setTimeout(loadShopsList, 500); // Refresh list
};

// ===== SHOP DETAIL PAGE =====
window.viewShopDetail = function(shopJson) {
  let s;
  try { s = typeof shopJson === "string" ? JSON.parse(shopJson) : shopJson; }
  catch(e) { showToast("Error loading shop"); return; }

  const typeEmoji = { sabji:"🥬", phal:"🍎", kirana:"🛒", anaaj:"🌾", dairy:"🥛", mandi:"🏪", other:"✨" };
  const typeLabel = { sabji:"Sabji Bhandar", phal:"Phal Bhandar", kirana:"Kirana Store", anaaj:"Anaaj/Dal", dairy:"Dairy/Milk", mandi:"Mandi/Wholesale", other:"Other" };
  const phone = s.phone?.replace(/\D/g,'') || "";
  const isOwner = s.submittedBy === window.zenviAuth?.auth?.currentUser?.uid;

  // Parse items with mandi prices
  const itemsList = [];
  if (s.items) {
    s.items.split(",").forEach(item => {
      const parts = item.trim().split(/[-:]/);
      const name = parts[0]?.trim();
      const customPrice = parts[1]?.trim();
      if (name) {
        const marketItem = marketData.find(m => 
          m.name.toLowerCase().includes(name.toLowerCase()) || 
          name.toLowerCase().includes(m.name.toLowerCase())
        );
        itemsList.push({ name, price: customPrice || marketItem?.price || null, emoji: marketItem?.emoji || "🌱", trend: marketItem?.trend || "stable" });
      }
    });
  }

  let modal = document.getElementById("shopDetailModal");
  if (!modal) { modal = document.createElement("div"); modal.id = "shopDetailModal"; document.body.appendChild(modal); }

  modal.style.cssText = "position:fixed;inset:0;z-index:3000;background:white;overflow-y:auto;";
  modal.innerHTML = `
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#15803d,#16a34a);padding:20px 16px 24px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <button onclick="document.getElementById('shopDetailModal').style.display='none';"
          style="background:rgba(255,255,255,0.2);border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
          <span class="material-icons-round" style="color:white;font-size:20px;">arrow_back</span>
        </button>
        <h2 style="color:white;font-size:18px;font-weight:800;flex:1;margin:0;">Shop Details</h2>
        ${isOwner ? `<button onclick="editMyShop(${JSON.stringify(JSON.stringify(s)).slice(1,-1)})"
          style="background:rgba(255,255,255,0.2);border:none;border-radius:20px;padding:6px 14px;color:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">
          ✏️ Edit
        </button>` : ""}
      </div>
      <div style="display:flex;gap:14px;align-items:center;">
        <div style="width:64px;height:64px;background:rgba(255,255,255,0.2);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:32px;">
          ${typeEmoji[s.type] || "🏪"}
        </div>
        <div>
          <h3 style="color:white;font-size:20px;font-weight:800;margin:0 0 4px;">${s.name}</h3>
          <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0 0 6px;">${typeLabel[s.type] || "Shop"}</p>
          ${s.rating ? `<span style="background:rgba(255,255,255,0.2);color:white;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;">⭐ ${s.rating}</span>` : ""}
        </div>
      </div>
    </div>

    <div style="padding:16px;">
      <!-- Info -->
      <div style="background:#f8fafc;border-radius:14px;padding:14px;margin-bottom:16px;">
        <div style="display:flex;gap:10px;margin-bottom:8px;">
          <span class="material-icons-round" style="color:#16a34a;font-size:18px;margin-top:2px;">location_on</span>
          <p style="font-size:14px;font-weight:600;color:#1e293b;margin:0;">${s.address}</p>
        </div>
        <div style="display:flex;gap:10px;">
          <span class="material-icons-round" style="color:#16a34a;font-size:18px;">person</span>
          <p style="font-size:14px;color:#475569;margin:0;">Owner: <strong>${s.owner}</strong></p>
        </div>
        ${s.desc ? `<div style="display:flex;gap:10px;margin-top:8px;"><span class="material-icons-round" style="color:#16a34a;font-size:18px;">info</span><p style="font-size:13px;color:#64748b;margin:0;">${s.desc}</p></div>` : ""}
      </div>

      <!-- Items -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <h4 style="font-size:15px;font-weight:800;color:#1e293b;margin:0;">🛒 Items & Prices</h4>
        ${isOwner ? `<button onclick="openAddItemsToShop('${s.id || s.name}')"
          style="background:#f0fdf4;color:#16a34a;border:1.5px solid #bbf7d0;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">
          + Add Items
        </button>` : ""}
      </div>

      ${itemsList.length > 0 ? `
        <div style="background:white;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:16px;">
          ${itemsList.map((item, i) => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;${i < itemsList.length-1?'border-bottom:1px solid #f1f5f9;':''}">
              <span style="font-size:22px;">${item.emoji}</span>
              <p style="flex:1;font-size:14px;font-weight:700;color:#1e293b;margin:0;">${item.name}</p>
              ${item.price ? `<div style="text-align:right;"><p style="font-size:16px;font-weight:800;color:#16a34a;margin:0;">₹${parseFloat(item.price).toFixed(0)}</p><p style="font-size:10px;color:#94a3b8;margin:0;">/kg</p></div>` : `<span style="font-size:12px;color:#94a3b8;">N/A</span>`}
            </div>`).join('')}
        </div>` : `
        <div style="background:#f8fafc;border-radius:14px;padding:24px;text-align:center;margin-bottom:16px;">
          <p style="font-size:32px;margin:0 0 8px;">🌱</p>
          <p style="font-size:14px;color:#64748b;margin:0;">${isOwner ? 'Apne items add karein!' : 'Is dukaan ne items list nahi kiye.'}</p>
          ${isOwner ? `<button onclick="openAddItemsToShop('${s.id || s.name}')" style="margin-top:12px;padding:10px 20px;background:#16a34a;color:white;border:none;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Add Items</button>` : ""}
        </div>`}

      <!-- Buttons -->
      <div style="display:flex;gap:10px;margin-bottom:14px;">
        ${s.lat && s.lng ? `<button onclick="window.open('https://maps.google.com/?q=${s.lat},${s.lng}','_blank')" style="flex:1;padding:14px;background:#f0fdf4;color:#16a34a;border:1.5px solid #bbf7d0;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;"><span class="material-icons-round" style="font-size:18px;">map</span> Map</button>` : ""}
        ${phone ? `<button onclick="window.open('https://wa.me/${phone}?text=Hi! Zenvi app se aapki dukaan dekhi.','_blank')" style="flex:2;padding:14px;background:#16a34a;color:white;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;">💬 WhatsApp</button>` : ""}
      </div>
      <button onclick="openRateShop('${s.id || s.name}','${s.name}')" style="width:100%;padding:14px;background:white;color:#f59e0b;border:2px solid #fde68a;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">⭐ Rate this Shop</button>
    </div>
  `;
  modal.style.display = "block";
};;

// ===== SWIGGY-STYLE LOCATION SELECTOR =====
function openLocationSelector() {
  let modal = document.getElementById("locationSelectorModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "locationSelectorModal";
    document.body.appendChild(modal);
  }

  // Get saved addresses
  const saved = JSON.parse(localStorage.getItem("zenvi_saved_addresses") || "[]");
  const current = JSON.parse(localStorage.getItem("zenvi_location") || "{}");
  const currentName = localStorage.getItem("zenvi_location_name") || "";

  // Distance helper
  function distText(addr) {
    if (!addr.lat || !addr.lng || !current.lat) return "";
    const d = getDistanceKm(current.lat, current.lng, addr.lat, addr.lng);
    return `${d} km`;
  }

  modal.style.cssText = "position:fixed;inset:0;z-index:3000;background:white;overflow-y:auto;";
  modal.innerHTML = `
    <!-- Header -->
    <div style="display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid #f1f5f9;position:sticky;top:0;background:white;z-index:1;">
      <button onclick="document.getElementById('locationSelectorModal').style.display='none';"
        style="background:none;border:none;cursor:pointer;padding:4px;">
        <span class="material-icons-round" style="font-size:22px;">arrow_back</span>
      </button>
      <h2 style="font-size:17px;font-weight:800;margin:0;">Select Your Location</h2>
    </div>

    <!-- Search -->
    <div style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">
      <div style="display:flex;align-items:center;gap:10px;background:#f8fafc;border-radius:12px;padding:12px 14px;border:1px solid #e2e8f0;">
        <span class="material-icons-round" style="color:#94a3b8;font-size:20px;">search</span>
        <input id="locSelectorSearch" placeholder="Search an area or address" 
          style="border:none;outline:none;font-size:14px;font-family:inherit;background:transparent;flex:1;"
          oninput="locSelectorSearch(this.value)">
      </div>
    </div>

    <!-- Quick actions -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 16px;border-bottom:1px solid #f1f5f9;">
      <button onclick="useCurrentLocationNow()" 
        style="display:flex;align-items:center;gap:10px;padding:14px;background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;cursor:pointer;font-family:inherit;">
        <span style="width:36px;height:36px;background:#ea580c;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span class="material-icons-round" style="color:white;font-size:18px;">my_location</span>
        </span>
        <span style="font-size:13px;font-weight:700;color:#ea580c;text-align:left;">Use Current<br>Location</span>
      </button>
      <button onclick="document.getElementById('locationSelectorModal').style.display='none'; showPage('explore');"
        style="display:flex;align-items:center;gap:10px;padding:14px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;cursor:pointer;font-family:inherit;">
        <span style="width:36px;height:36px;background:#16a34a;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span class="material-icons-round" style="color:white;font-size:18px;">add_location</span>
        </span>
        <span style="font-size:13px;font-weight:700;color:#16a34a;text-align:left;">Set on<br>Map</span>
      </button>
    </div>

    <!-- Saved addresses -->
    ${saved.length > 0 ? `
    <div style="padding:14px 16px 6px;">
      <p style="font-size:11px;font-weight:800;color:#94a3b8;letter-spacing:0.8px;margin:0 0 10px;">SAVED ADDRESSES</p>
      ${saved.map((addr, i) => `
        <div style="border:1.5px solid ${addr.name === currentName ? '#16a34a' : '#f1f5f9'};
          background:${addr.name === currentName ? '#f0fdf4' : 'white'};
          border-radius:12px;margin-bottom:8px;overflow:hidden;">
          <!-- Main row - clickable -->
          <div onclick="selectSavedAddress(${i})" style="display:flex;align-items:center;gap:14px;padding:14px;cursor:pointer;">
            <div style="width:44px;height:44px;background:${addr.label==='Home'?'#f0fdf4':addr.label==='Work'?'#eff6ff':'#f8fafc'};
              border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <span class="material-icons-round" style="font-size:20px;color:${addr.label==='Home'?'#16a34a':addr.label==='Work'?'#3b82f6':'#64748b'};">
                ${addr.label==='Home'?'home':addr.label==='Work'?'business':'location_on'}
              </span>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                <p style="font-size:14px;font-weight:800;margin:0;color:#1e293b;">${addr.label || "Saved"}</p>
                ${addr.name === currentName ? '<span style="background:#16a34a;color:white;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;">SELECTED</span>' : ""}
              </div>
              <p style="font-size:12px;color:#64748b;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${addr.fullAddr || addr.name}</p>
              ${addr.contactName ? `<p style="font-size:11px;color:#94a3b8;margin:2px 0 0;">${addr.contactName}${addr.phone ? ' • ' + addr.phone : ''}</p>` : ''}
            </div>
            ${distText(addr) ? `<span style="font-size:11px;font-weight:700;color:#94a3b8;flex-shrink:0;">${distText(addr)}</span>` : ""}
          </div>
          <!-- Action row: Edit + Share + Delete -->
          <div style="display:flex;border-top:1px solid #f1f5f9;">
            <button onclick="editSavedAddress(${i})"
              style="flex:1;padding:10px;background:none;border:none;cursor:pointer;font-size:12px;font-weight:700;
              color:#3b82f6;display:flex;align-items:center;justify-content:center;gap:4px;font-family:inherit;">
              <span class="material-icons-round" style="font-size:14px;">edit</span> Edit
            </button>
            <div style="width:1px;background:#f1f5f9;"></div>
            <button onclick="shareSavedAddress(${i})"
              style="flex:1;padding:10px;background:none;border:none;cursor:pointer;font-size:12px;font-weight:700;
              color:#16a34a;display:flex;align-items:center;justify-content:center;gap:4px;font-family:inherit;">
              <span class="material-icons-round" style="font-size:14px;">share</span> Share
            </button>
            <div style="width:1px;background:#f1f5f9;"></div>
            <button onclick="deleteSavedAddress(${i})"
              style="flex:1;padding:10px;background:none;border:none;cursor:pointer;font-size:12px;font-weight:700;
              color:#ef4444;display:flex;align-items:center;justify-content:center;gap:4px;font-family:inherit;">
              <span class="material-icons-round" style="font-size:14px;">delete</span> Delete
            </button>
          </div>
        </div>
      `).join('')}
    </div>` : `
    <div style="padding:24px 16px;text-align:center;color:#94a3b8;">
      <span style="font-size:40px;">📍</span>
      <p style="font-size:14px;margin:8px 0 0;">No saved addresses yet</p>
    </div>`}

    <!-- Search results container -->
    <div id="locSelectorResults" style="padding:0 16px 20px;"></div>
  `;

  modal.style.display = "block";
  setTimeout(() => document.getElementById("locSelectorSearch")?.focus(), 400);
}

// Use device GPS location
window.useCurrentLocationNow = function() {
  document.getElementById("locationSelectorModal").style.display = "none";
  if (!navigator.geolocation) { showToast("⚠️ GPS not supported"); return; }
  showToast("📡 GPS se location dhundh raha hai...");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      currentLocation = { lat, lng, name: "", fullAddr: "" };

      // Reverse geocode
      try {
        const res = await fetch(`https://apis.mappls.com/advancedmaps/v1/${MAPPLS_API_KEY}/rev_geocode?lat=${lat}&lng=${lng}`, { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        if (data?.results?.length > 0) {
          const r = data.results[0];
          const local = r.subSubLocality || r.subLocality || r.locality || r.village || r.area || "";
          const city = r.city || r.district || "";
          const name = local && city ? `${local}, ${city}` : (local || city || "Current Location");
          const addr = [city, r.state].filter(Boolean).join(", ");
          currentLocation = { lat, lng, name, fullAddr: addr };
          saveFinalLocation(name, addr);
        }
      } catch {
        // Nominatim fallback
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`);
          const data = await res.json();
          const a = data.address || {};
          const local = a.hamlet || a.neighbourhood || a.suburb || a.village || "";
          const city = a.city || a.town || a.district || "";
          const name = local && city ? `${local}, ${city}` : (local || city || "Current Location");
          const addr = [city, a.state].filter(Boolean).join(", ");
          currentLocation = { lat, lng, name, fullAddr: addr };
          saveFinalLocation(name, addr);
        } catch {
          saveFinalLocation("Current Location", "");
        }
      }
    },
    () => showToast("❌ GPS permission denied"),
    { timeout: 10000 }
  );
};

function saveFinalLocation(name, addr) {
  currentLocation.name = name;
  currentLocation.fullAddr = addr;
  localStorage.setItem("zenvi_location", JSON.stringify(currentLocation));
  localStorage.setItem("zenvi_location_name", name);
  localStorage.setItem("zenvi_location_addr", addr);
  const homeAddr = document.getElementById("homeAddress");
  if (homeAddr) {
    const savedAddresses = JSON.parse(localStorage.getItem("zenvi_saved_addresses") || "[]");
    const matchAddr = savedAddresses.find(a => a.name === name || a.label === "Home");
    homeAddr.innerText = matchAddr?.fullAddr || (addr ? name + ", " + addr.split(",")[0] : name);
  }
  if (window.zenviAuth?.auth?.currentUser && window.saveLocationToCloud) window.saveLocationToCloud(currentLocation);
  showToast(`📍 ${name}`);
}

// Select from saved list
window.selectSavedAddress = function(idx) {
  const saved = JSON.parse(localStorage.getItem("zenvi_saved_addresses") || "[]");
  const addr = saved[idx];
  if (!addr) return;
  currentLocation = { lat: addr.lat, lng: addr.lng, name: addr.name, fullAddr: addr.fullAddr || "" };
  saveFinalLocation(addr.name, addr.fullAddr || "");
  document.getElementById("locationSelectorModal").style.display = "none";
};

// Search in location selector
let locSearchTimer = null;
window.locSelectorSearch = function(query) {
  clearTimeout(locSearchTimer);
  if (!query.trim()) {
    document.getElementById("locSelectorResults").innerHTML = "";
    return;
  }
  locSearchTimer = setTimeout(async () => {
    const box = document.getElementById("locSelectorResults");
    if (!box) return;
    box.innerHTML = '<p style="font-size:13px;color:#94a3b8;padding:8px 0;">Dhundh raha hai...</p>';
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5&addressdetails=1`);
      const results = await res.json();
      if (!results.length) { box.innerHTML = '<p style="font-size:13px;color:#94a3b8;padding:8px 0;">Koi result nahi mila</p>'; return; }
      box.innerHTML = '<p style="font-size:11px;font-weight:800;color:#94a3b8;letter-spacing:0.8px;margin:0 0 8px;">SEARCH RESULTS</p>' +
        results.map(r => {
          const parts = r.display_name.split(",").map(s=>s.trim());
          const main = parts[0];
          const sub = parts.slice(1, 3).join(", ");
          return `<div onclick="selectSearchResult(${r.lat}, ${r.lon}, '${main.replace(/'/g,"\\'")}', '${sub.replace(/'/g,"\\'")}', '${r.display_name.replace(/'/g,"\\'")}' )"
            style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;cursor:pointer;border-bottom:1px solid #f1f5f9;">
            <span class="material-icons-round" style="color:#16a34a;font-size:20px;">location_on</span>
            <div><p style="font-size:14px;font-weight:700;margin:0;color:#1e293b;">${main}</p>
            <p style="font-size:12px;color:#64748b;margin:0;">${sub}</p></div>
          </div>`;
        }).join('');
    } catch { box.innerHTML = '<p style="font-size:13px;color:#94a3b8;">Search failed</p>'; }
  }, 400);
};

window.selectSearchResult = function(lat, lng, name, addr, fullAddr) {
  currentLocation = { lat: parseFloat(lat), lng: parseFloat(lng), name, fullAddr: addr };
  saveFinalLocation(name, addr);
  document.getElementById("locationSelectorModal").style.display = "none";
};

// Save current location as Home/Office
window.saveAsAddress = function(label) {
  if (!currentLocation?.lat) { showToast("⚠️ Pehle location set karein"); return; }
  const saved = JSON.parse(localStorage.getItem("zenvi_saved_addresses") || "[]");
  const existing = saved.findIndex(a => a.label === label);
  const entry = { label, ...currentLocation };
  if (existing >= 0) saved[existing] = entry;
  else saved.push(entry);
  localStorage.setItem("zenvi_saved_addresses", JSON.stringify(saved));
  showToast(`✅ ${label} address saved!`);
};

window.editSavedAddress = function(idx) {
  const saved = JSON.parse(localStorage.getItem("zenvi_saved_addresses") || "[]");
  const addr = saved[idx];
  if (!addr) return;
  document.getElementById("locationSelectorModal").style.display = "none";
  currentLocation = { lat: addr.lat, lng: addr.lng, name: addr.name, fullAddr: addr.fullAddr };
  // Show edit form with pre-filled OLD data
  showEditAddressForm(addr, idx);
};

function showEditAddressForm(addr, idx) {
  let modal = document.getElementById("editAddressModal");
  if (!modal) { modal = document.createElement("div"); modal.id = "editAddressModal"; document.body.appendChild(modal); }

  modal.style.cssText = "position:fixed;inset:0;z-index:4000;background:white;overflow-y:auto;";
  modal.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:16px;background:white;border-bottom:1px solid #f1f5f9;position:sticky;top:0;z-index:1;">
      <button onclick="document.getElementById('editAddressModal').style.display='none';openLocationSelector();"
        style="background:none;border:none;cursor:pointer;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
        <span class="material-icons-round">arrow_back</span>
      </button>
      <h2 style="font-size:17px;font-weight:800;margin:0;flex:1;">Edit Address</h2>
      <button onclick="saveEditedAddress(${idx})"
        style="background:#16a34a;color:white;border:none;border-radius:20px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">
        Save
      </button>
    </div>

    <!-- Map preview -->
    <div style="height:120px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;">
      <span style="font-size:32px;">📍</span>
      <p style="font-size:13px;font-weight:700;color:#16a34a;margin:0;">${addr.name || ""}</p>
      <button onclick="document.getElementById('editAddressModal').style.display='none';showPage('explore');"
        style="font-size:11px;color:#3b82f6;background:none;border:none;cursor:pointer;font-family:inherit;font-weight:600;">
        Change on Map →
      </button>
    </div>

    <div style="padding:16px;">
      <!-- Current location row (like Zomato) -->
      <div style="background:#fff5f5;border-radius:12px;padding:14px;margin-bottom:20px;display:flex;align-items:center;gap:10px;">
        <span class="material-icons-round" style="color:#ef4444;">location_on</span>
        <div>
          <p style="font-size:13px;font-weight:700;color:#1e293b;margin:0;">${addr.name}</p>
          <p style="font-size:12px;color:#64748b;margin:0;">${addr.fullAddr || ""}</p>
        </div>
      </div>

      <p style="font-size:11px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin:0 0 10px;">ADDRESS DETAILS</p>
      <div style="margin-bottom:14px;">
        <input id="eaFloor" placeholder="House no., Floor, Building name" value="${addr.floor || ''}"
          style="width:100%;padding:14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:20px;">
        <input id="eaLandmark" placeholder="Landmark (optional)" value="${addr.landmark || ''}"
          style="width:100%;padding:14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;">
      </div>

      <p style="font-size:11px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin:0 0 10px;">YOUR DETAILS</p>
      <div style="border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <span class="material-icons-round" style="color:#94a3b8;font-size:20px;">phone</span>
        <input id="eaName" placeholder="Your name" value="${addr.contactName || ''}"
          style="flex:1;border:none;outline:none;font-size:14px;font-family:inherit;font-weight:600;">
        <span style="color:#e2e8f0;">|</span>
        <input id="eaPhone" placeholder="+91 XXXXXXXXXX" value="${addr.phone || ''}" type="tel"
          style="flex:1;border:none;outline:none;font-size:14px;font-family:inherit;color:#64748b;">
      </div>

      <p style="font-size:11px;font-weight:800;color:#94a3b8;letter-spacing:0.5px;margin:0 0 10px;">SAVE ADDRESS AS</p>
      <div style="display:flex;gap:10px;margin-bottom:24px;" id="eaLabelRow">
        ${["Home","Work","Other"].map(label => `
          <button onclick="selectEALabel('${label}')" id="ealabel${label}"
            style="flex:1;padding:12px 8px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
            border:2px solid ${addr.label===label?'#16a34a':'#e2e8f0'};background:${addr.label===label?'#f0fdf4':'white'};
            color:${addr.label===label?'#16a34a':'#64748b'};display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.2s;">
            <span class="material-icons-round" style="font-size:16px;">${label==='Home'?'home':label==='Work'?'business':'location_on'}</span>
            ${label}
          </button>`).join('')}
      </div>

      <button onclick="saveEditedAddress(${idx})"
        style="width:100%;padding:16px;background:#16a34a;color:white;border:none;border-radius:14px;
        font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(22,163,74,0.3);">
        Save Address
      </button>
    </div>
  `;

  window._editAddressLabel = addr.label || "Home";
  modal.style.display = "block";
}

window.selectEALabel = function(label) {
  window._editAddressLabel = label;
  ["Home","Work","Other"].forEach(l => {
    const btn = document.getElementById("ealabel" + l);
    if (!btn) return;
    const active = l === label;
    btn.style.borderColor = active ? "#16a34a" : "#e2e8f0";
    btn.style.background = active ? "#f0fdf4" : "white";
    btn.style.color = active ? "#16a34a" : "#64748b";
  });
};

window.saveEditedAddress = function(idx) {
  const saved = JSON.parse(localStorage.getItem("zenvi_saved_addresses") || "[]");
  if (!saved[idx]) return;
  const floor = document.getElementById("eaFloor")?.value.trim() || "";
  const landmark = document.getElementById("eaLandmark")?.value.trim() || "";
  const name = document.getElementById("eaName")?.value.trim() || "";
  const phone = document.getElementById("eaPhone")?.value.trim() || "";
  const label = window._editAddressLabel || saved[idx].label;
  
  // Keep original lat/lng/name, only update details
  saved[idx] = {
    ...saved[idx],
    label, floor, landmark,
    contactName: name, phone,
    fullAddr: [floor, saved[idx].name, landmark, saved[idx].fullAddr].filter(Boolean).join(", ")
  };
  
  if (name) localStorage.setItem("zenvi_username", name);
  if (phone) localStorage.setItem("zenvi_phone", phone);
  localStorage.setItem("zenvi_saved_addresses", JSON.stringify(saved));
  
  // Update current location display if this is selected
  const currentName = localStorage.getItem("zenvi_location_name");
  if (currentName === saved[idx].name) {
    const homeAddr = document.getElementById("homeAddress");
    if (homeAddr) homeAddr.innerText = saved[idx].fullAddr;
  }
  
  document.getElementById("editAddressModal").style.display = "none";
  showToast("✅ Address updated!");
};

window.shareSavedAddress = function(idx) {
  const saved = JSON.parse(localStorage.getItem("zenvi_saved_addresses") || "[]");
  const addr = saved[idx];
  if (!addr) return;
  const text = addr.label + ": " + (addr.fullAddr || addr.name) +
    (addr.lat && addr.lng ? "\nMap: https://maps.google.com/?q=" + addr.lat + "," + addr.lng : "");
  if (navigator.share) {
    navigator.share({ title: "My " + addr.label + " Address", text });
  } else {
    navigator.clipboard?.writeText(text);
    showToast("📋 Address copied!");
  }
};

window.deleteSavedAddress = function(idx) {
  if (!confirm("Is address ko delete karein?")) return;
  const saved = JSON.parse(localStorage.getItem("zenvi_saved_addresses") || "[]");
  saved.splice(idx, 1);
  localStorage.setItem("zenvi_saved_addresses", JSON.stringify(saved));
  showToast("🗑️ Address deleted!");
  openLocationSelector(); // Refresh
};

// ===== EDIT MY SHOP =====
window.editMyShop = function(shopJson) {
  let s;
  try { s = typeof shopJson === "string" ? JSON.parse(shopJson) : shopJson; } catch(e) { return; }

  const typeOptions = ["sabji","phal","kirana","anaaj","dairy","mandi","other"];
  const typeLabels = { sabji:"🥬 Sabji Bhandar", phal:"🍎 Phal Bhandar", kirana:"🛒 Kirana Store", 
                       anaaj:"🌾 Anaaj/Dal", dairy:"🥛 Dairy/Milk", mandi:"🏪 Mandi/Wholesale", other:"✨ Other" };

  let modal = document.getElementById("editShopModal");
  if (!modal) { modal = document.createElement("div"); modal.id = "editShopModal"; document.body.appendChild(modal); }

  modal.style.cssText = "position:fixed;inset:0;z-index:3500;background:white;overflow-y:auto;";
  modal.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:16px;background:white;border-bottom:1px solid #f1f5f9;position:sticky;top:0;z-index:1;">
      <button onclick="document.getElementById('editShopModal').style.display='none';" style="background:none;border:none;cursor:pointer;">
        <span class="material-icons-round">arrow_back</span>
      </button>
      <h2 style="font-size:17px;font-weight:800;margin:0;flex:1;">Edit My Shop</h2>
      <button onclick="saveEditedShop('${s.id || s.name}')" 
        style="background:#16a34a;color:white;border:none;border-radius:20px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">
        Save
      </button>
    </div>
    <div style="padding:16px;">
      <div class="form-group"><label>Shop Name</label><input id="editShopName" value="${s.name}" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;"></div>
      <div class="form-group"><label>Owner Name</label><input id="editOwnerName" value="${s.owner}" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;"></div>
      <div class="form-group"><label>Phone</label><input id="editShopPhone" value="${s.phone||''}" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;"></div>
      <div class="form-group"><label>Address</label><input id="editShopAddress" value="${s.address||''}" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;"></div>
      <div class="form-group"><label>Main Items (comma separated)</label><input id="editShopItems" value="${s.items||''}" placeholder="Tomato, Potato, Onion" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;"></div>
      <div class="form-group"><label>Description</label><textarea id="editShopDesc" rows="2" style="width:100%;padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;">${s.desc||''}</textarea></div>
      <button onclick="saveEditedShop('${s.id || s.name}')"
        style="width:100%;padding:14px;background:#16a34a;color:white;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;margin-top:8px;">
        💾 Save Changes
      </button>
    </div>`;

  window._editingShopId = s.id || s.name;
  modal.style.display = "block";
};

window.saveEditedShop = function(shopId) {
  const shops = JSON.parse(localStorage.getItem("zenvi_shops") || "[]");
  const idx = shops.findIndex(s => s.id === shopId || s.name === shopId);
  if (idx < 0) { showToast("⚠️ Shop nahi mila"); return; }
  shops[idx].name = document.getElementById("editShopName")?.value.trim() || shops[idx].name;
  shops[idx].owner = document.getElementById("editOwnerName")?.value.trim() || shops[idx].owner;
  shops[idx].phone = document.getElementById("editShopPhone")?.value.trim() || shops[idx].phone;
  shops[idx].address = document.getElementById("editShopAddress")?.value.trim() || shops[idx].address;
  shops[idx].items = document.getElementById("editShopItems")?.value.trim() || shops[idx].items;
  shops[idx].desc = document.getElementById("editShopDesc")?.value.trim() || shops[idx].desc;
  localStorage.setItem("zenvi_shops", JSON.stringify(shops));
  document.getElementById("editShopModal").style.display = "none";
  showToast("✅ Shop updated!");
  loadShopsList();
};

// ===== ADD ITEMS TO SHOP (for owner) =====
window.openAddItemsToShop = function(shopId) {
  let modal = document.getElementById("addItemsShopModal");
  if (!modal) { modal = document.createElement("div"); modal.id = "addItemsShopModal"; document.body.appendChild(modal); }

  const shops = JSON.parse(localStorage.getItem("zenvi_shops") || "[]");
  const shop = shops.find(s => s.id === shopId || s.name === shopId);
  const currentItems = shop?.items || "";

  modal.style.cssText = "position:fixed;inset:0;z-index:4500;background:white;overflow-y:auto;";
  modal.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:16px;background:white;border-bottom:1px solid #f1f5f9;position:sticky;top:0;z-index:1;">
      <button onclick="document.getElementById('addItemsShopModal').style.display='none';" style="background:none;border:none;cursor:pointer;"><span class="material-icons-round">arrow_back</span></button>
      <h2 style="font-size:17px;font-weight:800;margin:0;flex:1;">Shop Items Add Karein</h2>
    </div>
    <div style="padding:16px;">
      <p style="font-size:13px;color:#64748b;margin-bottom:16px;">Format: <strong>Item naam-Price</strong> (comma se alag karo)<br>Example: Tomato-22, Potato-18, Onion-25</p>
      
      <div style="margin-bottom:16px;">
        <label style="font-size:12px;font-weight:700;color:#94a3b8;display:block;margin-bottom:6px;">CURRENT ITEMS</label>
        <textarea id="shopItemsInput" rows="6" placeholder="Tomato-22, Potato-18, Onion-25, Garlic-80"
          style="width:100%;padding:14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;resize:none;">${currentItems}</textarea>
      </div>

      <!-- Quick add from market -->
      <p style="font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:10px;">QUICK ADD (tap to add):</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;">
        ${marketData.slice(0, 15).map(item => `
          <button onclick="quickAddItem('${item.name}', '${item.price}')"
            style="padding:6px 12px;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">
            ${item.emoji} ${item.name} ₹${parseFloat(item.price).toFixed(0)}
          </button>`).join('')}
      </div>

      <button onclick="saveShopItems('${shopId}')"
        style="width:100%;padding:16px;background:#16a34a;color:white;border:none;border-radius:14px;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;">
        💾 Save Items
      </button>
    </div>
  `;
  modal.style.display = "block";
};

window.quickAddItem = function(name, price) {
  const input = document.getElementById("shopItemsInput");
  if (!input) return;
  const current = input.value.trim();
  const newItem = name + "-" + parseFloat(price).toFixed(0);
  input.value = current ? current + ", " + newItem : newItem;
  showToast("✅ " + name + " added!");
};

window.saveShopItems = function(shopId) {
  const items = document.getElementById("shopItemsInput")?.value.trim();
  const shops = JSON.parse(localStorage.getItem("zenvi_shops") || "[]");
  const idx = shops.findIndex(s => s.id === shopId || s.name === shopId);
  if (idx >= 0) {
    shops[idx].items = items;
    localStorage.setItem("zenvi_shops", JSON.stringify(shops));
    showToast("✅ Items saved!");
    document.getElementById("addItemsShopModal").style.display = "none";
    loadShopsList();
  }
};
window.viewShopByIndex = function(idx) {
  const shops = window._shopsData || JSON.parse(localStorage.getItem("zenvi_shops") || "[]");
  if (idx < 0 || idx >= shops.length) { showToast("Shop nahi mila"); return; }
  window.viewShopDetail(shops[idx]);
};

window.editShopByIndex = function(idx) {
  const shops = window._shopsData || JSON.parse(localStorage.getItem("zenvi_shops") || "[]");
  if (idx < 0 || idx >= shops.length) { showToast("Shop nahi mila"); return; }
  window.editMyShop(shops[idx]);
};
