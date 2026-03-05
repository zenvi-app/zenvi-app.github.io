// ===== 1. Sheety API URL =====
const API_URL = "https://api.sheety.co/e6ca57df3adfe2f877322d0ded669751/marketPricesTemplate/marketPricesTemplate";

let marketData = [];


// ===== 2. Render Cards =====
function renderItems(data){

const grid = document.getElementById("itemsGrid");
grid.innerHTML = "";

if(!data || data.length === 0){

grid.innerHTML =
`<div style="text-align:center;padding:40px;color:#b2bec3;">
Data load ho raha hai... 🔄
</div>`;

return;

}

data.forEach(item=>{

grid.innerHTML += `
<div class="card">

<div class="item-info">
<span class="title">${item.name}</span>
<small style="color:#b2bec3;">${item.category}</small>
</div>

<div class="price-section">
<span class="price-val">₹${item.price}</span>
<small class="unit-text">/${item.unit}</small>
<div class="trend-${item.type || "down"}">
${item.trend || "Stable"}
</div>
</div>

</div>
`;

});


// ===== Update Live Time =====
const now = new Date();

document.getElementById("last-update-time").innerText =
now.toLocaleTimeString();

}



// ===== 3. Fetch Google Sheet Data =====
async function fetchLivePrices(){

try{

const response = await fetch(API_URL);
const json = await response.json();

marketData = json.marketPricesTemplate;

renderItems(marketData);

}

catch(error){

console.error("API Error:",error);

document.getElementById("itemsGrid").innerHTML =
"Mandi data load nahi ho paya ⚠️";

}

}



// ===== 4. Page Setup =====
document.addEventListener("DOMContentLoaded",()=>{

// Load Data
fetchLivePrices();


// ===== Map Setup =====
const map = L.map("mapContainer").setView([26.7914,84.5042],13);

L.tileLayer(
"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
).addTo(map);

L.marker([26.7914,84.5042])
.addTo(map)
.bindPopup("Bettiah Main Mandi")
.openPopup();


// Fix map render bug
setTimeout(()=>{
map.invalidateSize();
},500);


// ===== Search Function =====
document.getElementById("searchInput")
.addEventListener("input",(e)=>{

const term = e.target.value.toLowerCase();

const filtered =
marketData.filter(item =>
item.name.toLowerCase().includes(term)
);

renderItems(filtered);

});


// ===== Category Filter =====
document.getElementById("categoryBar")
.onclick = (e)=>{

if(e.target.classList.contains("chip")){

document.querySelector(".chip.active")
.classList.remove("active");

e.target.classList.add("active");

const cat = e.target.innerText;

const filtered =
cat === "All Items"
? marketData
: marketData.filter(i=>i.category===cat);

renderItems(filtered);

}

};

});


// ===== 5. Auto Refresh (30 sec) =====
setInterval(()=>{

fetchLivePrices();

console.log("Prices synced with Google Sheets...");

},30000);
