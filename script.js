/* ===== ZENVI SCRIPT - IMPROVED ===== */

// ===== CONFIG =====
const MAPPLS_API_KEY = "0daf1373cd967b80d2c6f73effdfd849";
const DATA_API_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd0000013a00e18ef65d4b0063eac2e34ced0b9f&format=json&limit=100";
const SARVAM_API_KEY = "sk_1mgjxi7g_hvKLJt06v3x4aoFcv1SBI7UD";
const SARVAM_API_URL = "https://api.sarvam.ai/v1/chat/completions";

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
    const card = document.createElement("div");
    card.className = "item-card";
    card.style.animationDelay = (i * 0.04) + "s";
    card.innerHTML = `
      <span class="item-emoji">${item.emoji || '🌱'}</span>
      <h4>${escapeHtml(item.name)}</h4>
      <div class="price">₹${item.price}<span class="price-unit">/${item.unit}</span></div>
      <div class="trend ${item.trend}">${trendIcon} ${trendText}</div>
      <span class="category-tag">${escapeHtml(item.category)}</span>
    `;
    card.addEventListener("click", () => {
      document.getElementById("searchInput").value = item.name;
      filterItems(item.name);
    });
    grid.appendChild(card);
  });

  // Update stats
  updateStats(data);
  const timeEl = document.getElementById("last-update-time");
  if (timeEl) timeEl.innerText = new Date().toLocaleTimeString("hi-IN", {hour:'2-digit',minute:'2-digit'});
}

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
async function fetchLivePrices() {
  // Show loading
  const grid = document.getElementById("itemsGrid");
  if (grid && marketData.length === 0) {
    grid.innerHTML = '<div class="no-data"><div class="no-icon">⏳</div><p>Prices load ho rahi hain...</p></div>';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(DATA_API_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!data.records || !Array.isArray(data.records)) throw new Error("Invalid response");

    const rawData = data.records
      .filter(r => r.commodity && r.modal_price)
      .map(r => ({ name: r.commodity.trim(), price: parseFloat(r.modal_price) }))
      .filter(r => !isNaN(r.price));

    if (rawData.length === 0) throw new Error("No records found");

    marketData = removeDuplicates(rawData);
    renderItems(marketData);
    setDataSource("🟢 Live — data.gov.in");
    console.log("✅ Loaded", marketData.length, "items from API");
  } catch (err) {
    console.warn("⚠️ API failed:", err.message, "— using fallback data");
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

// ===== FALLBACK DATA =====
function useFallbackData() {
  const fallback = [
    {name:"Tomato",price:20},{name:"Potato",price:18},{name:"Onion",price:25},
    {name:"Wheat",price:30},{name:"Rice",price:55},{name:"Banana",price:40},
    {name:"Apple",price:120},{name:"Carrot",price:32},{name:"Cabbage",price:28},
    {name:"Pumpkin",price:15},{name:"Maize",price:22},{name:"Gram",price:45},
    {name:"Bajra",price:28},{name:"Garlic",price:80},{name:"Ginger",price:60},
    {name:"Mango",price:80},{name:"Cauliflower",price:35},{name:"Brinjal",price:24}
  ];
  marketData = fallback.map(item => ({
    ...item, price: item.price.toFixed(2), unit:"kg",
    category: detectCategory(item.name),
    trend: getPriceTrend(item.price),
    emoji: getEmoji(item.name)
  }));
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
  // Compact market context (token save karo)
  const top10 = marketData.slice(0, 10);
  const cheapest3 = [...marketData].sort((a,b) => parseFloat(a.price)-parseFloat(b.price)).slice(0,3);
  const expensive3 = [...marketData].sort((a,b) => parseFloat(b.price)-parseFloat(a.price)).slice(0,3);

  const marketContext = marketData.length > 0
    ? `Aaj ki mandi prices (wholesale, data.gov.in): ${top10.map(i=>`${i.name}=₹${i.price}`).join(", ")} ...aur ${marketData.length - 10} items`
    : "Market data load ho raha hai.";

  const systemPrompt = `Tu Zenvi AI hai — India ka mandi price assistant. Hinglish mein baat kar.

${marketContext}
Saste: ${cheapest3.map(i=>`${i.name}(₹${i.price})`).join(", ")}
Mehenge: ${expensive3.map(i=>`${i.name}(₹${i.price})`).join(", ")}

RULES:
- Yeh WHOLESALE mandi rates hain, retail se 20-40% kam hote hain
- Sirf data mein available items ki price bata
- Item na mile toh honestly bol
- Short answer (3-5 lines), emojis use karo 🍅🥔🌾
- Retail estimate bhi do: mandi rate × 1.3`;

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

function initMap() {
  if (mapplsMap) return;
  if (document.getElementById("mappls-sdk")) return;
  const script = document.createElement("script");
  script.id = "mappls-sdk";
  script.src = `https://apis.mappls.com/advancedmaps/api/${MAPPLS_API_KEY}/map_sdk?layer=vector&v=3.0&callback=initializeMapplsMap`;
  script.async = true; script.defer = true;
  document.head.appendChild(script);
}

window.initializeMapplsMap = function() {
  const mapContainer = document.getElementById("mapContainer");
  if (!mapContainer || typeof mappls === 'undefined') return;
  try {
    mapplsMap = new mappls.Map("mapContainer", {
      center: { lat: 26.8018, lng: 84.5037 },
      zoom: 14, zoomControl: true, attributionControl: false
    });
    setupSwiggyCenterPin();
    console.log("✅ Map initialized");
  } catch (e) { console.error("Map error:", e); }
};

// ===== SWIGGY STYLE CENTER PIN =====
function setupSwiggyCenterPin() {
  if (!mapplsMap) return;
  const pin = document.getElementById("centerPin");
  const zoomHint = document.getElementById("zoomHint");
  const confirmBtn = document.getElementById("confirmBtn");

  // Enable confirm button immediately — don't block on zoom
  if (confirmBtn) confirmBtn.disabled = false;

  mapplsMap.addEventListener("movestart", () => {
    if (pin) pin.classList.add("dragging");
  });

  mapplsMap.addEventListener("moveend", () => {
    if (pin) pin.classList.remove("dragging");
    const center = mapplsMap.getCenter();
    currentZoom = mapplsMap.getZoom();

    // Show zoom warning but DON'T disable confirm button
    const zoomWarning = document.getElementById("zoomWarning");
    if (currentZoom < 14) {
      if (zoomWarning) zoomWarning.style.display = "flex";
    } else {
      if (zoomWarning) zoomWarning.style.display = "none";
    }

    // Hide zoom hint after move
    setTimeout(() => { if (zoomHint) zoomHint.classList.add("hide"); }, 1500);

    clearTimeout(reverseGeocodeTimer);
    reverseGeocodeTimer = setTimeout(() => {
      reverseGeocode(center.lat, center.lng);
    }, 600);
  });

  setupMapSearch();
  // Initial reverse geocode + enable confirm
  reverseGeocode(26.8018, 84.5037);
  if (confirmBtn) confirmBtn.disabled = false;
}

async function reverseGeocode(lat, lng) {
  const nameEl = document.getElementById("selectedLocationName");
  const addrEl = document.getElementById("selectedLocationAddress");
  const confirmBtn = document.getElementById("confirmBtn");

  if (nameEl) nameEl.textContent = "📍 Dhundh raha hai...";

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
      { headers: { 'Accept-Language': 'hi,en' } }
    );
    const data = await res.json();
    const addr = data.address || {};
    const name = addr.road || addr.neighbourhood || addr.suburb ||
                 addr.village || addr.town || addr.city || "Selected Location";
    const fullAddr = [
      addr.suburb || addr.village || addr.neighbourhood,
      addr.city || addr.town || addr.district,
      addr.state
    ].filter(Boolean).join(", ");

    if (nameEl) nameEl.textContent = name;
    if (addrEl) addrEl.textContent = fullAddr || "";
    currentLocation = { lat, lng, name, fullAddr };
    // Always enable confirm after geocode
    if (confirmBtn) confirmBtn.disabled = false;
  } catch {
    if (nameEl) nameEl.textContent = "Location selected";
    if (addrEl) addrEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    currentLocation = { lat, lng, name: "Selected Location", fullAddr: "" };
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

function setupMapSearch() {
  const searchInput = document.getElementById("locationSearchInput");
  if (!searchInput) return;
  let timer;
  searchInput.addEventListener("input", e => {
    clearTimeout(timer);
    const q = e.target.value.trim();
    if (q.length < 3) return;
    timer = setTimeout(() => searchLocation(q), 600);
  });
  searchInput.addEventListener("keypress", e => {
    if (e.key === "Enter") searchLocation(e.target.value.trim());
  });
}

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
  const place = currentLocation?.name || document.getElementById("selectedLocationName")?.textContent || "Location";
  const fullAddr = currentLocation?.fullAddr || "";
  const homeAddr = document.getElementById("homeAddress");
  if (homeAddr) homeAddr.innerText = place + (fullAddr ? `, ${fullAddr.split(",")[0]}` : "");
  showPage("home");
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
  const s = document.getElementById("statSearches");
  const f = document.getElementById("statFavourites");
  const a = document.getElementById("statAlerts");
  const mwItems = document.getElementById("mwItems");
  const mwTime = document.getElementById("mwTime");
  const mwChanges = document.getElementById("mwChanges");

  if (s) s.textContent = searchCount;
  if (f) f.textContent = favourites.length;
  if (a) a.textContent = priceAlerts.length;

  const upCount = marketData.filter(i => i.trend === 'up').length;
  const downCount = marketData.filter(i => i.trend === 'down').length;
  if (mwItems) mwItems.textContent = marketData.length;
  if (mwTime) mwTime.textContent = "Today";
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
  document.getElementById("darkModeCheck")?.addEventListener("change", e => {
    document.body.classList.toggle("dark-mode", e.target.checked);
    const label = e.target.closest(".menu-item")?.querySelector(".menu-text span");
    if (label) label.textContent = e.target.checked ? "On" : "Off";
  });

  document.getElementById("notifCheck")?.addEventListener("change", e => {
    const label = e.target.closest(".menu-item")?.querySelector(".menu-text span");
    if (label) label.textContent = e.target.checked ? "On" : "Off";
  });

  document.getElementById("clearChatBtn")?.addEventListener("click", () => {
    if (confirm("Chat history clear karein?")) {
      chatHistory = [];
      const chatBody = document.getElementById("chatBody");
      if (chatBody) chatBody.innerHTML = `<div class="ai-msg-wrap"><div class="ai-bubble">🙏 <strong>Namaste!</strong> Chat history clear ho gayi. Kuch bhi poochein!</div></div>`;
      alert("✅ Chat history clear ho gayi!");
    }
  });

  document.getElementById("addAlertBtn")?.addEventListener("click", addPriceAlert);
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
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Zenvi starting...");
  hideSplash();
  fetchLivePrices();
  showPage("home");
  setupSearch();
  setupEvents();
  console.log("✅ Zenvi ready!");
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
