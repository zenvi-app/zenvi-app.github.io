/* ===== ZENVI SCRIPT - IMPROVED ===== */

// ===== CONFIG =====
const MAPPLS_API_KEY = "0daf1373cd967b80d2c6f73effdfd849";
// Note: Keys are domain-restricted to zenvi-app.github.io only

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
      <button class="suggest-price-btn" onclick="event.stopPropagation(); openSuggestPrice('${escapeHtml(item.name)}', '${item.price}')">
        ✏️ Suggest Price
      </button>
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
  if (grid && marketData.length === 0) {
    // Skeleton loader — shimmer cards
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
      price: d.sum / d.count,  // average
      minPrice: d.min,
      maxPrice: d.max,
      hasRange: d.max > d.min * 1.1  // show range if >10% difference
    }));

    if (rawData.length === 0) throw new Error("Empty after processing");

    marketData = rawData
      .filter(item => item.price >= 0.5 && item.price <= 2000) // Remove crazy values
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
    console.log("✅ Loaded", marketData.length, "unique items");

    // Merge community prices from Firestore
    if (window.loadCommunityPrices) {
      window.loadCommunityPrices().then(communityPrices => {
        if (communityPrices.length > 0) {
          // Override API prices with community-verified prices
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
    useFallbackData();
    setDataSource("🟡 Sample data (API offline)");
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

function filterItems(term) {
  if (!term || !term.trim()) { renderItems(marketData); return; }
  const searchTerm = term.toLowerCase().trim();
  const englishTerm = hindiMap[searchTerm] || searchTerm;
  const filtered = marketData.filter(item => {
    const name = item.name.toLowerCase();
    const cat = item.category.toLowerCase();
    return name.includes(searchTerm) || name.includes(englishTerm) || cat.includes(searchTerm);
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

    // Set currentLocation immediately from map center
    currentLocation = {
      lat: startLat, lng: startLng,
      name: currentLocation?.name || "",
      fullAddr: currentLocation?.fullAddr || ""
    };

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
  btn.style.cssText = "background:var(--primary);opacity:1;cursor:pointer;pointer-events:auto;";
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
        name: "Selected Location",
        fullAddr: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
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
      reverseGeocodeTimer = setTimeout(() => reverseGeocode(lat, lng), 800);

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

  // ===== TRY MAPPLS FIRST (India-specific, knows local Bihar areas) =====
  try {
    const res = await fetch(
      `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_API_KEY}/rev_geocode?lat=${lat}&lng=${lng}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();

    console.log("🗺️ Mappls geocode:", JSON.stringify(data?.results?.[0]));

    if (data?.results?.length > 0) {
      const r = data.results[0];

      // Mappls fields — most local first
      const localName =
        r.locality ||        // "Uttarwari Pokhra" — exact locality!
        r.subLocality ||     // sub-locality
        r.subSubLocality ||  // even smaller area
        r.village ||         // village name
        r.area ||            // area name
        r.street;            // street name

      const cityName = r.city || r.district || "";
      const stateName = r.state || "";

      // Clean display: "Uttarwari Pokhra, Bettiah"
      const cleanLocal = localName?.trim();
      const cleanCity = cityName?.trim();

      let displayName;
      if (cleanLocal && cleanCity && cleanLocal.toLowerCase() !== cleanCity.toLowerCase()) {
        displayName = `${cleanLocal}, ${cleanCity}`;
      } else if (cleanLocal) {
        displayName = cleanLocal;
      } else {
        displayName = cleanCity || r.formatted_address?.split(",")[0] || "Selected Location";
      }

      const fullAddr = [cleanCity, stateName].filter(Boolean).join(", ");

      if (nameEl) nameEl.textContent = displayName;
      if (addrEl) addrEl.textContent = fullAddr;
      currentLocation = { lat, lng, name: displayName, fullAddr };
      forceEnableConfirm();
      return; // ✅ Mappls succeeded
    }
  } catch(e) {
    console.warn("Mappls geocode failed:", e.message, "— trying Nominatim");
  }

  // ===== FALLBACK: NOMINATIM =====
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'hi,en' }, signal: AbortSignal.timeout(6000) }
    );
    const data = await res.json();
    const a = data.address || {};

    console.log("📍 Nominatim fields:", JSON.stringify(a));

    const localName =
      a.hamlet || a.neighbourhood || a.quarter ||
      a.suburb || a.road || a.residential ||
      a.village || a.city_district || a.district;

    const cityName = a.city || a.town || a.municipality || "";
    const stateName = a.state || "";

    const cleanLocal = localName?.trim();
    const cleanCity = cityName?.trim();

    let displayName;
    if (cleanLocal && cleanCity && cleanLocal.toLowerCase() !== cleanCity.toLowerCase()) {
      displayName = `${cleanLocal}, ${cleanCity}`;
    } else if (cleanLocal) {
      displayName = cleanLocal;
    } else {
      const parts = (data.display_name || "").split(",").map(s => s.trim()).filter(Boolean);
      const filtered = parts.filter(p => p !== cleanCity && p !== stateName && p !== "India" && !/^\d/.test(p));
      displayName = filtered.length > 0 ? `${filtered[0]}, ${cleanCity}` : (cleanCity || "Selected Location");
    }

    const fullAddr = [cleanCity, stateName].filter(Boolean).join(", ");

    if (nameEl) nameEl.textContent = displayName;
    if (addrEl) addrEl.textContent = fullAddr || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    currentLocation = { lat, lng, name: displayName, fullAddr };
    forceEnableConfirm();

  } catch(e) {
    console.warn("Both geocodes failed:", e.message);
    const coordName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    if (nameEl) nameEl.textContent = "Location selected ✓";
    if (addrEl) addrEl.textContent = coordName;
    currentLocation = { lat, lng, name: coordName, fullAddr: "" };
    forceEnableConfirm();
  }
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
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(dist); // Round to whole number
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
  // ❌ Don't save if truly no location
  if (!currentLocation?.lat || !currentLocation?.lng) {
    showToast("⚠️ Pehle map pe location select karein!");
    return;
  }

  // Use proper name or fallback to coordinates
  const place = (currentLocation.name && currentLocation.name !== "Selected Location")
    ? currentLocation.name
    : `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`;
  const fullAddr = currentLocation?.fullAddr || "";

  // 🔐 Login check — bina login ke bhi allow karo (localStorage mein save)
  const isLoggedIn = window.zenviAuth?.auth?.currentUser;
  if (!isLoggedIn) {
    // Still save locally but show login nudge
    showToast("📍 Location saved! Login karein cloud sync ke liye 🔐");
  } else {
    showToast(`📍 Location saved: ${place}`);
    // Save to Firebase cloud
    if (window.saveLocationToCloud) window.saveLocationToCloud(currentLocation);
  }

  // ✅ Always save to localStorage
  localStorage.setItem("zenvi_location", JSON.stringify(currentLocation));
  localStorage.setItem("zenvi_location_name", place);
  localStorage.setItem("zenvi_location_addr", fullAddr);

  // Update home header
  const homeAddr = document.getElementById("homeAddress");
  if (homeAddr) homeAddr.innerText = place + (fullAddr ? `, ${fullAddr.split(",")[0]}` : "");

  showPage("home");
}

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
    if (!saved || !savedName || invalidNames.includes(savedName)) {
      localStorage.removeItem("zenvi_location");
      localStorage.removeItem("zenvi_location_name");
      localStorage.removeItem("zenvi_location_addr");
      return;
    }

    currentLocation = JSON.parse(saved);
    const addr = localStorage.getItem("zenvi_location_addr") || "";
    const homeAddr = document.getElementById("homeAddress");
    if (homeAddr) homeAddr.innerText = savedName + (addr ? `, ${addr.split(",")[0]}` : "");

    const locSection = document.getElementById("locationSection");
    if (locSection) locSection.classList.add("location-set");
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
  currentPage = pageName;
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
  document.getElementById("locationSection")?.addEventListener("click", () => showPage("explore"));
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
  const items = marketData.map(i => i.name).slice(0, 10).join(', ');
  const itemName = prompt(`Kaunsi item ka alert chahiye?\n(${items})`);
  if (!itemName) return;
  const item = marketData.find(i => i.name.toLowerCase() === itemName.toLowerCase().trim());
  if (!item) { alert(`"${itemName}" hamare data mein nahi hai.`); return; }
  const price = prompt(`${item.emoji} ${item.name} abhi ₹${item.price}/kg hai.\nKitne price pe alert chahiye? (₹)`);
  if (!price || isNaN(price)) return;
  priceAlerts.push({ name: item.name, emoji: item.emoji, targetPrice: parseInt(price), currentPrice: item.price });
  localStorage.setItem('zenvi_alerts', JSON.stringify(priceAlerts));
  renderAlerts();
  updateProfileStats();
  alert(`✅ Alert set! Jab ${item.name} ₹${price} se kam ho, aapko pata chalega.`);
}

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
function setupProfileSettings() {
  // Dropdown toggle
  document.getElementById("profileMenuBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const dd = document.getElementById("profileDropdown");
    if (dd) dd.style.display = dd.style.display === "none" ? "block" : "none";
  });
  document.addEventListener("click", () => {
    const dd = document.getElementById("profileDropdown");
    if (dd) dd.style.display = "none";
  });

  document.getElementById("darkModeCheck")?.addEventListener("change", e => {
    document.body.classList.toggle("dark-mode", e.target.checked);
  });

  document.getElementById("clearChatBtn")?.addEventListener("click", () => {
    const dd = document.getElementById("profileDropdown");
    if (dd) dd.style.display = "none";
    if (confirm("Chat history clear karein?")) {
      chatHistory = [];
      const chatBody = document.getElementById("chatBody");
      if (chatBody) chatBody.innerHTML = `<div class="ai-msg-wrap"><div class="ai-bubble">🙏 <strong>Namaste!</strong> Chat history clear ho gayi. Kuch bhi poochein!</div></div>`;
      showToast("✅ Chat history cleared!");
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
  if (splashHidden) return; // Double splash fix
  splashHidden = true;
  setTimeout(() => {
    const splash = document.getElementById("splashScreen");
    if (splash) {
      splash.classList.add("hide");
      setTimeout(() => splash.remove(), 500);
    }
  }, 2000);
}

// ===== INIT =====
// ===== SAVE/RESTORE APP STATE (refresh fix) =====
function saveAppState() {
  try {
    const state = {
      page: currentPage || "home",
      ts: Date.now()
    };
    sessionStorage.setItem("zenvi_state", JSON.stringify(state));
  } catch(e) {}
}

function restoreAppState() {
  try {
    const raw = sessionStorage.getItem("zenvi_state");
    if (!raw) return "home";
    const state = JSON.parse(raw);
    // Only restore if refreshed within 30 seconds
    if (Date.now() - state.ts < 30000 && state.page) {
      return state.page;
    }
  } catch(e) {}
  return "home";
}

// Save state before page unload
window.addEventListener("beforeunload", saveAppState);
window.addEventListener("pagehide", saveAppState);

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Zenvi starting...");

  // Clear old bad location data (Bettiah,Bettiah fix)
  const badNames = ["Bettiah, Bettiah", "Bettiah,Bettiah", "Bettiah"];
  const savedName = localStorage.getItem("zenvi_location_name");
  if (savedName && badNames.includes(savedName.trim())) {
    localStorage.removeItem("zenvi_location");
    localStorage.removeItem("zenvi_location_name");
    localStorage.removeItem("zenvi_location_addr");
    console.log("🧹 Cleared bad location data");
  }

  hideSplash();
  restoreSavedLocation();
  fetchLivePrices();
  
  const lastPage = restoreAppState();
  showPage(lastPage);
  
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
