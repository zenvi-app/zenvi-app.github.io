/* ===== 🧠 KNOW MARKET - FINAL SCRIPT ===== */

// 📡 API Configuration
const DATA_API_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd0000013a00e18ef65d4b0063eac2e34ced0b9f&format=json&limit=100";

// 🗃️ Global State
let marketData = [];
let map = null;
let userMarker = null;
let selectedMarker = null;

/* ===== 🔍 CATEGORY DETECTION ===== */
function detectCategory(name) {
  const itemName = name.toLowerCase().trim();
  const categories = {
    vegetables: ["tomato","potato","onion","pumpkin","spinach","cabbage","bhindi","brinjal","cauliflower","carrot"],
    fruits: ["banana","apple","mango","orange","papaya","guava","grapes","watermelon"],
    grains: ["rice","wheat","maize","barley","gram","bajra","jowar","ragi"]
  };
  for (const [category, items] of Object.entries(categories)) {
    if (items.some(item => itemName.includes(item))) {
      return category.charAt(0).toUpperCase() + category.slice(1);
    }
  }
  return "Others";
}

/* ===== 🔄 REMOVE DUPLICATES & CALCULATE AVG PRICE ===== */
function removeDuplicates(data) {
  const priceMap = {};
  data.forEach(item => {
    const name = item.name?.trim();
    const pricePerQuintal = parseFloat(item.price);
    const pricePerKg = pricePerQuintal / 100;
    if (!name || isNaN(pricePerKg)) return;
    if (!priceMap[name]) priceMap[name] = [];
    priceMap[name].push(pricePerKg);
  });
  const result = [];
  for (const [name, prices] of Object.entries(priceMap)) {
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    result.push({
      name,
      price: avg.toFixed(2),
      unit: "kg",
      category: detectCategory(name),
      trend: getPriceTrend(avg)
    });
  }
  return result;}

/* ===== 📊 PRICE TREND HELPER ===== */
function getPriceTrend(price) {
  const num = parseFloat(price);
  if (num < 20) return "down";
  if (num > 50) return "up";
  return "same";
}

/* ===== 🎨 RENDER ITEMS TO GRID ===== */
function renderItems(data) {
  const grid = document.getElementById("itemsGrid");
  if (!grid) { console.error("❌ itemsGrid not found!"); return; }
  grid.innerHTML = "";
  if (!data || data.length === 0) {
    grid.innerHTML = `<p class="no-data">😕 No items found. Try searching something else.</p>`;
    return;
  }
  data.forEach(item => {
    const trendClass = item.trend || "same";
    const trendIcon = trendClass === "up" ? "📈" : trendClass === "down" ? "📉" : "➡️";
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <h4>${escapeHtml(item.name)}</h4>
      <p class="price">₹${item.price}/${escapeHtml(item.unit)}</p>
      <small class="change ${trendClass}">${trendIcon} ${escapeHtml(item.category)}</small>
    `;
    card.onclick = () => {
      const searchInput = document.getElementById("searchInput");
      if (searchInput) { searchInput.value = item.name; filterItems(item.name); }
    };
    grid.appendChild(card);
  });
  const timeEl = document.getElementById("last-update-time");
  if (timeEl) {
    timeEl.innerText = new Date().toLocaleTimeString("hi-IN", { hour: '2-digit', minute: '2-digit' });
  }
  console.log(`✅ Rendered ${data.length} items`);
}

/* ===== 🌐 FETCH LIVE MANDI PRICES ===== */
async function fetchLivePrices() {
  const timeEl = document.getElementById("last-update-time");
  try {
    console.log("🔄 Fetching data from API...");
    const response = await fetch(DATA_API_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();    if (!data.records || !Array.isArray(data.records)) throw new Error("Invalid API response");
    const rawData = data.records
      .filter(item => item.commodity && item.modal_price)
      .map(item => ({ name: item.commodity.trim(), price: parseFloat(item.modal_price) }))
      .filter(item => !isNaN(item.price) && item.name);
    marketData = removeDuplicates(rawData);
    renderItems(marketData);
    if (timeEl) timeEl.innerText = "Just now ✓";
    console.log(`✅ Loaded ${marketData.length} items from API`);
  } catch (error) {
    console.warn("⚠️ API failed, using fallback:", error.message);
    if (timeEl) timeEl.innerText = "Offline data";
    useFallbackData();
  }
}

/* ===== 🪂 FALLBACK DATA ===== */
function useFallbackData() {
  console.log("📦 Loading fallback data...");
  const fallback = [
    { name: "Tomato", price: 20 }, { name: "Potato", price: 18 },
    { name: "Onion", price: 25 }, { name: "Banana", price: 40 },
    { name: "Apple", price: 120 }, { name: "Rice", price: 55 },
    { name: "Wheat", price: 30 }, { name: "Carrot", price: 32 },
    { name: "Pumpkin", price: 15 }, { name: "Cabbage", price: 28 }
  ];
  marketData = fallback.map(item => ({
    ...item, unit: "kg",
    category: detectCategory(item.name),
    trend: getPriceTrend(item.price)
  }));
  renderItems(marketData);
  console.log("✅ Fallback data loaded");
}

/* ===== 🔐 ESCAPE HTML (XSS Protection) ===== */
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/* ===== 🤖 SMART AI RESPONSE ENGINE ===== */
function getAIResponse(query) {
  const q = query.toLowerCase().trim();
  
  function getCheapestItems(limit = 3) {
    if (!marketData || marketData.length === 0) return [];
    return [...marketData].sort((a, b) => parseFloat(a.price) - parseFloat(b.price)).slice(0, limit);  }
  
  function getExpensiveItems(limit = 3) {
    if (!marketData || marketData.length === 0) return [];
    return [...marketData].sort((a, b) => parseFloat(b.price) - parseFloat(a.price)).slice(0, limit);
  }
  
  function getItemPrice(itemName) {
    const item = marketData.find(i => i.name.toLowerCase().includes(itemName.toLowerCase()));
    return item ? `₹${item.price}/${item.unit}` : null;
  }
  
  if (q.includes("tomato") || q.includes("tamatar")) {
    const price = getItemPrice("tomato");
    return price ? `🍅 <b>Tomato Rate:</b><br>• Current: ${price}<br>• Trend: 📉 Slightly down` : "🍅 Loading...";
  }
  if (q.includes("potato") || q.includes("aloo")) {
    const price = getItemPrice("potato");
    return price ? `🥔 <b>Potato Rate:</b><br>• Current: ${price}<br>• Trend: ➡️ Stable` : "🥔 Loading...";
  }
  if (q.includes("onion") || q.includes("pyaaz") || q.includes("pyaj")) {
    const price = getItemPrice("onion");
    return price ? `🧅 <b>Onion Rate:</b><br>• Current: ${price}<br>• Trend: 📈 Rising` : "🧅 Loading...";
  }
  if (q.includes("sasta") || q.includes("cheap") || q.includes("sabse kam")) {
    const cheap = getCheapestItems(3);
    if (cheap.length > 0) {
      const list = cheap.map((item, i) => `${i+1}. ${item.name}: ₹${item.price}/${item.unit}`).join("<br>");
      return `💡 <b>Best Deals:</b><br>${list}`;
    }
    return "💡 Loading deals...";
  }
  if (q.includes("mehnga") || q.includes("expensive")) {
    const expensive = getExpensiveItems(3);
    if (expensive.length > 0) {
      const list = expensive.map((item, i) => `${i+1}. ${item.name}: ₹${item.price}/${item.unit}`).join("<br>");
      return `💰 <b>Mehange Items:</b><br>${list}`;
    }
    return "💰 Loading...";
  }
  if (q.includes("mandi") || q.includes("location") || q.includes("kahan")) {
    return "📍 <b>Nearby Mandis:</b><br>• Bettiah Main Mandi - 1.2 km<br>• Narkatiaganj - 18 km";
  }
  if (q.includes("summary") || q.includes("aaj ka")) {
    const cheap = getCheapestItems(1);
    const expensive = getExpensiveItems(1);
    return `📊 <b>Market Summary:</b><br>• Sasta: ${cheap[0]?.name} (₹${cheap[0]?.price})<br>• Mehnga: ${expensive[0]?.name} (₹${expensive[0]?.price})<br>• Total: ${marketData.length}`;
  }
  if (q.includes("hello") || q.includes("hi") || q.includes("namaste")) {
    return `🙏 Namaste! Try:<br>• 'Sabse sasti sabji?'<br>• 'Tamatar ka rate?'`;  }
  return "🤖 Try:<br>• 'Sabse sasta kya hai?'<br>• 'Tomato price?'<br>• 'Market summary?'";
}

/* ===== 💬 SEND AI MESSAGE ===== */
function sendAIMessage() {
  const input = document.getElementById("aiQuery");
  const chatBody = document.getElementById("chatBody");
  const query = input?.value.trim();
  if (!query || !chatBody) return;
  chatBody.innerHTML += `<div class="user-msg">${escapeHtml(query)}</div>`;
  input.value = "";
  chatBody.scrollTop = chatBody.scrollHeight;
  const typingId = `typing-${Date.now()}`;
  chatBody.innerHTML += `<div class="ai-msg" id="${typingId}">🤔 Soch raha hoon...</div>`;
  chatBody.scrollTop = chatBody.scrollHeight;
  setTimeout(() => {
    document.getElementById(typingId)?.remove();
    const response = getAIResponse(query);
    chatBody.innerHTML += `<div class="ai-msg">${response}</div>`;
    chatBody.scrollTop = chatBody.scrollHeight;
  }, 1000);
}

/* ===== 🗺️ INITIALIZE MAP ===== */
function initMap() {
  if (map) return;
  const mapContainer = document.getElementById("mapContainer");
  if (!mapContainer) { console.error("❌ mapContainer not found!"); return; }
  console.log("🗺️ Initializing map...");
  
  map = L.map("mapContainer", { zoomControl: false }).setView([26.8018, 84.5037], 15);
  
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);
  
  const mandiIcon = L.divIcon({
    html: `<div class="custom-mandi-marker">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" fill="#2ecc71"/>
        <path d="M16 8C13 8 12 11 12 14C12 17 13 20 16 24C19 20 20 17 20 14C20 11 19 8 16 8Z" fill="white"/>
        <circle cx="16" cy="14" r="3" fill="#27ae60"/>
      </svg>
    </div>`,
    className: "custom-marker",
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  });  
  L.marker([26.8018, 84.5037], { icon: mandiIcon })
    .addTo(map)
    .bindPopup(`<div style="text-align:center; min-width:180px;">
      <h3 style="margin:0 0 8px 0; color:#333; font-size:15px;">🥦 Bettiah Main Mandi</h3>
      <p style="margin:4px 0; color:#666; font-size:13px;">📍 1.2 km away</p>
      <p style="margin:4px 0; color:#27ae60; font-weight:600; font-size:13px;">✅ Open now</p>
      <hr style="margin:12px 0; border:none; border-top:1px solid #eee;">
      <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
        <span style="background:#f8f9fa; padding:4px 8px; border-radius:4px; font-size:11px;">🍅 ₹20/kg</span>
        <span style="background:#f8f9fa; padding:4px 8px; border-radius:4px; font-size:11px;">🧅 ₹25/kg</span>
        <span style="background:#f8f9fa; padding:4px 8px; border-radius:4px; font-size:11px;">🥔 ₹18/kg</span>
      </div>
    </div>`);
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        userMarker = L.marker([latitude, longitude], {
          icon: L.divIcon({
            className: "user-location-marker",
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })
        }).addTo(map).bindPopup("📍 You are here");
        
        const locText = document.getElementById("loc-text");
        if (locText) {
          locText.innerText = "Detecting...";
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then(res => res.json())
            .then(data => {
              const place = data.address?.village || data.address?.town || data.address?.city || data.address?.suburb || "Current Location";
              locText.innerText = place;
            })
            .catch(() => { locText.innerText = `Lat: ${latitude.toFixed(3)}`; });
        }
      },
      (error) => { console.warn("⚠️ Location error:", error.message); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }
  
  map.on("click", (e) => {
    if (selectedMarker) map.removeLayer(selectedMarker);
    selectedMarker = L.marker(e.latlng, {
      icon: L.divIcon({
        html: "📍",
        className: "selected-location-marker",        iconSize: [40, 40],
        iconAnchor: [20, 40]
      })
    }).addTo(map).bindPopup("📌 Selected Location").openPopup();
    
    // Show location card when map is clicked
    confirmLocation();
  });
  
  console.log("✅ Map initialized");
}

/* ===== 🔍 FILTER ITEMS (WITH HINDI SUPPORT) ===== */
function filterItems(term) {
  if (!term) { renderItems(marketData); return; }
  const searchTerm = term.toLowerCase().trim();
  const hindiMap = {
    'pyaaj':'onion','pyaj':'onion','pyaz':'onion',
    'aloo':'potato','alu':'potato',
    'tamatar':'tomato',
    'gajar':'carrot','gaajar':'carrot',
    'gobhi':'cauliflower','phool gobhi':'cauliflower',
    'patta gobhi':'cabbage',
    'bhindi':'okra','ladyfinger':'okra',
    'baingan':'brinjal',
    'matar':'peas',
    'mooli':'radish',
    'kaddu':'pumpkin',
    'mirch':'chili',
    'dhania':'coriander',
    'podina':'mint',
    'lehsun':'garlic',
    'adrak':'ginger',
    'kela':'banana',
    'seb':'apple',
    'aam':'mango',
    'santra':'orange',
    'papita':'papaya',
    'tarbooj':'watermelon',
    'gehu':'wheat',
    'chawal':'rice',
    'makka':'maize',
    'jau':'barley',
    'chana':'gram',
    'bajra':'millet'
  };
  const englishTerm = hindiMap[searchTerm] || searchTerm;
  const filtered = marketData.filter(item => {
    const itemName = item.name.toLowerCase();
    const itemCategory = item.category.toLowerCase();    return itemName.includes(searchTerm) || itemName.includes(englishTerm) || itemCategory.includes(searchTerm);
  });
  renderItems(filtered);
}

/* ===== 🧭 PAGE NAVIGATION (FIXED) ===== */
function setupNavigation() {
  const pages = {
    home: document.getElementById("homePage"),
    explore: document.getElementById("explorePage"),
    shops: document.getElementById("shopsPage"),
    profile: document.getElementById("profilePage")
  };
  
  const searchBox = document.getElementById("searchBox");
  const searchInput = document.getElementById("searchInput");
  const searchIcon = document.getElementById("searchIcon");
  
  const searchConfigs = {
    home: { placeholder: "Search mandi items...", icon: "search", type: "items", show: true },
    shops: { placeholder: "Search shops...", icon: "store", type: "shops", show: true },
    explore: { placeholder: "", icon: "place", type: "locations", show: false },
    profile: { placeholder: "Search settings...", icon: "settings", type: "settings", show: false }
  };
  
  function showPage(pageName) {
    document.querySelectorAll(".page").forEach(page => {
      page.classList.remove("active");
    });
    
    if (pages[pageName]) {
      pages[pageName].classList.add("active");
    }
    
    const config = searchConfigs[pageName];
    if (config) {
      if (searchInput) {
        searchInput.placeholder = config.placeholder;
        searchInput.value = "";
      }
      if (searchIcon) searchIcon.textContent = config.icon;
      if (searchBox) searchBox.style.display = config.show ? "flex" : "none";
    }
    
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.remove("active");
    });
    const activeBtn = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (activeBtn) activeBtn.classList.add("active");
        if (pageName === "explore") {
      setTimeout(() => {
        if (!map) {
          console.log("🗺️ First time - initializing map");
          initMap();
        } else {
          console.log("🗺️ Map exists - invalidating size");
          map.invalidateSize();
        }
      }, 300);
    }
    
    if (pageName === "home" && marketData.length > 0) {
      renderItems(marketData);
    }
  }
  
  document.querySelectorAll(".nav-item[data-page]").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const pageName = item.dataset.page;
      showPage(pageName);
    });
  });
  
  showPage("home");
}

/* ===== 🔍 UNIVERSAL SEARCH HANDLER ===== */
function setupUniversalSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;
  let searchTimeout;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    const activePage = document.querySelector(".page.active");
    const pageId = activePage ? activePage.id : "homePage";
    searchTimeout = setTimeout(() => {
      if (pageId === "homePage") filterItems(query);
      else if (pageId === "shopsPage") filterShops(query);
      else if (pageId === "explorePage") return;
    }, 300);
  });
}

/* ===== 🏪 SHOP SEARCH ===== */
function filterShops(query) {
  console.log("🔍 Searching shops:", query);
  const shopsPage = document.getElementById("shopsPage");  if (!shopsPage) return;
  if (!query) {
    shopsPage.innerHTML = `<h2 class="page-title">Nearby Shops</h2><p class="coming-soon">Shops feature coming soon.<br><br><a href="javascript:void(0)" id="registerShopLink">Register your shop</a></p>`;
    document.getElementById("registerShopLink")?.addEventListener("click", (e) => { e.preventDefault(); alert("🚀 Coming soon!"); });
    return;
  }
  shopsPage.innerHTML = `<h2 class="page-title">Searching...</h2><p class="coming-soon">Looking for: "${query}"<br><br>Feature coming soon! 🚀</p>`;
}

/* ===== 🗺️ LOCATION SEARCH ===== */
function searchLocation(query) {
  console.log("🗺️ Searching location:", query);
  if (!query || !map) return;
  const searchInput = document.getElementById("locationSearchInput") || document.getElementById("searchInput");
  if (searchInput) searchInput.placeholder = "Searching...";
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`)
    .then(res => res.json())
    .then(data => {
      if (data.length > 0) {
        const location = data[0];
        const lat = parseFloat(location.lat);
        const lon = parseFloat(location.lon);
        map.flyTo([lat, lon], 16, { duration: 1.5, easeLinearity: 0.25 });
        if (selectedMarker) map.removeLayer(selectedMarker);
        selectedMarker = L.marker([lat, lon], {
          icon: L.divIcon({
            html: "<div style='font-size:40px'>📍</div>",
            className: "selected-location-marker",
            iconSize: [40, 40],
            iconAnchor: [20, 40]
          })
        }).addTo(map).bindPopup(`<b>${location.display_name}</b>`).openPopup();
        const locText = document.getElementById("loc-text");
        if (locText) locText.innerText = location.display_name.split(',')[0];
        if (searchInput) searchInput.placeholder = "Search for area, street name...";
        console.log("✅ Location found:", location.display_name);
        // Show location card
        confirmLocation();
      } else {
        alert("❌ Location not found. Try: 'Bettiah', 'Patna', 'Delhi'");
        if (searchInput) searchInput.placeholder = "Search for area, street name...";
      }
    })
    .catch(error => {
      console.error("❌ Location search error:", error);
      alert("⚠️ Could not search location.");
      if (searchInput) searchInput.placeholder = "Search for area, street name...";
    });
}
/* ===== 📍 GET CURRENT LOCATION ===== */
function getCurrentLocation() {
  if (!navigator.geolocation) { alert("❌ Geolocation not supported"); return; }
  const locText = document.getElementById("loc-text");
  if (locText) locText.innerText = "Detecting...";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      if (map) map.flyTo([latitude, longitude], 16, { duration: 1.5 });
      if (userMarker) {
        userMarker.setLatLng([latitude, longitude]);
      } else {
        userMarker = L.marker([latitude, longitude], {
          icon: L.divIcon({
            className: "user-location-marker",
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })
        }).addTo(map).bindPopup("📍 You are here").openPopup();
      }
      if (locText) {
        locText.innerText = "Detecting area...";
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          .then(res => res.json())
          .then(data => {
            const place = data.address?.village || data.address?.town || data.address?.city || data.address?.suburb;
            if (place) locText.innerText = place;
            else locText.innerText = `Lat: ${latitude.toFixed(3)}`;
          })
          .catch(() => { locText.innerText = `Lat: ${latitude.toFixed(3)}`; });
      }
      console.log("✅ Current location found");
      // Show location card
      confirmLocation();
    },
    (error) => {
      console.warn("⚠️ Location error:", error.message);
      if (locText) locText.innerText = "GPS Off ✗";
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
  );
}

/* ===== ✅ CONFIRM LOCATION (SWIGGY STYLE) ===== */
function confirmLocation() {
  const locationCard = document.getElementById("locationCard");
  const locationName = document.getElementById("selectedLocationName");
  const locationAddress = document.getElementById("selectedLocationAddress");
  
  if (!locationCard || !locationName || !locationAddress) return;  
  let currentLat = 26.792;
  let currentLng = 84.5037;
  
  if (map) {
    const center = map.getCenter();
    currentLat = center.lat;
    currentLng = center.lng;
  }
  
  locationName.innerHTML = "📍 Detecting location...";
  locationAddress.innerText = "Please wait";
  
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentLat}&lon=${currentLng}`)
    .then(res => res.json())
    .then(data => {
      const area = data.address?.suburb || data.address?.neighbourhood || "";
      const city = data.address?.city || data.address?.town || data.address?.village || "";
      const state = data.address?.state || "";
      const country = data.address?.country || "India";
      
      const displayName = city || area || "Selected Location";
      const fullAddress = [area, city, state, country].filter(Boolean).join(", ");
      
      locationName.innerHTML = `📍 ${displayName}`;
      locationAddress.innerText = fullAddress;
      
      locationCard.style.display = "block";
      locationCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    })
    .catch(error => {
      console.error("❌ Location fetch error:", error);
      locationName.innerHTML = "⚠️ Could not detect location";
      locationAddress.innerText = "Please try again";
      locationCard.style.display = "block";
    });
}

/* ===== 🎯 CONFIRM & PROCEED ===== */
function confirmAndProceed() {
  const locationName = document.getElementById("selectedLocationName");
  const locationAddress = document.getElementById("selectedLocationAddress");
  const locationCard = document.getElementById("locationCard");
  
  if (!locationName || !locationAddress) return;
  
  const selectedLocation = locationName.innerText.replace("📍 ", "");
  const fullAddress = locationAddress.innerText;
  
  const locText = document.getElementById("loc-text");  if (locText) {
    locText.innerText = selectedLocation;
  }
  
  locationCard.style.display = "none";
  
  alert(`✅ Location confirmed!\n\n📍 ${selectedLocation}\n🏠 ${fullAddress}\n\nYou can now browse mandi prices for this area.`);
  
  document.querySelector('[data-page="home"]').click();
}

/* ===== 🎯 SETUP LOCATION SEARCH LISTENER ===== */
function setupLocationSearch() {
  const searchInput = document.getElementById("locationSearchInput");
  if (!searchInput) return;
  let searchTimeout;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    if (query.length < 3) return;
    searchTimeout = setTimeout(() => { searchLocation(query); }, 800);
  });
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const query = searchInput.value.trim();
      if (query) searchLocation(query);
    }
  });
}

/* ===== 🎯 SETUP EVENT LISTENERS ===== */
function setupEventListeners() {
  document.querySelectorAll(".cat").forEach(cat => {
    cat.addEventListener("click", () => {
      const categoryName = cat.querySelector("p")?.innerText.trim();
      if (!categoryName) return;
      const searchInput = document.getElementById("searchInput");
      if (searchInput) searchInput.value = "";
      const filtered = marketData.filter(item => item.category.toLowerCase() === categoryName.toLowerCase());
      renderItems(filtered);
      document.querySelectorAll(".cat").forEach(c => c.style.borderColor = "transparent");
      cat.style.borderColor = "var(--primary)";
    });
  });
  
  const updateLocBtn = document.getElementById("update-loc");
  if (updateLocBtn) {
    updateLocBtn.addEventListener("click", () => {
      if (!navigator.geolocation) { alert("❌ Location not supported"); return; }
      const locText = document.getElementById("loc-text");      if (locText) locText.innerText = "Detecting...";
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (map && userMarker) { map.setView([latitude, longitude], 14); userMarker.setLatLng([latitude, longitude]); }
          if (locText) { locText.innerText = "Updated ✓"; setTimeout(() => { locText.innerText = `Lat: ${latitude.toFixed(3)}`; }, 2000); }
        },
        (error) => { console.warn("⚠️ Location error:", error.message); if (locText) locText.innerText = "Failed ✗"; },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
  
  const modal = document.getElementById("aiModal");
  const aiTrigger = document.getElementById("aiTrigger");
  const closeBtn = document.getElementById("closeAiModal") || document.querySelector(".close-modal");
  const sendBtn = document.getElementById("sendQuery");
  const aiInput = document.getElementById("aiQuery");
  if (aiTrigger && modal) aiTrigger.addEventListener("click", () => { modal.style.display = "flex"; if (aiInput) aiInput.focus(); });
  if (closeBtn && modal) closeBtn.addEventListener("click", () => { modal.style.display = "none"; });
  if (modal) window.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
  if (sendBtn) sendBtn.addEventListener("click", sendAIMessage);
  if (aiInput) aiInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendAIMessage(); });
  
  const loginBtn = document.getElementById("googleLoginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      if (typeof window.googleLogin === "function") window.googleLogin();
      else alert("⚠️ Firebase loading... Wait 2 seconds.");
    });
  }
  
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", () => { if (typeof window.logout === "function") window.logout(); });
  
  const registerLink = document.getElementById("registerShopLink");
  if (registerLink) registerLink.addEventListener("click", (e) => { e.preventDefault(); alert("🚀 Coming soon!"); });
}

/* ===== 🚀 INITIALIZE APP ===== */
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Know Market Starting...");
  fetchLivePrices();
  setupNavigation();
  setupUniversalSearch();
  setupEventListeners();
  setupLocationSearch();
  
  const locationSearch = document.getElementById("locationSearchInput");
  if (locationSearch) {    locationSearch.addEventListener("keypress", function(e) {
      if (e.key === "Enter") searchLocation(this.value);
    });
  }
  
  const timeEl = document.getElementById("last-update-time");
  if (timeEl) timeEl.innerText = new Date().toLocaleTimeString("hi-IN", { hour: '2-digit', minute: '2-digit' });
  console.log("✅ App initialized");
});

/* ===== 🔄 AUTO REFRESH (5 min) ===== */
setInterval(() => {
  if (document.visibilityState === "visible") {
    console.log("🔄 Auto-refreshing...");
    fetchLivePrices();
  }
}, 300000);

/* ===== 🌍 GLOBAL FUNCTIONS ===== */
window.sendAIMessage = sendAIMessage;
window.initMap = initMap;
window.filterItems = filterItems;
window.getCurrentLocation = getCurrentLocation;
window.searchLocation = searchLocation;
window.confirmLocation = confirmLocation;
window.confirmAndProceed = confirmAndProceed;
