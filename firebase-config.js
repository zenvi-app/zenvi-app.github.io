/* ===== 🔐 ZENVI - FIREBASE CONFIG ===== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection,
  query, where, getDocs, serverTimestamp, orderBy, limit, updateDoc, increment }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-WhbKSkuAx9S9sDcOZ-zWW84Pew29Z5E",
  authDomain: "knowmarket-bfdf7.firebaseapp.com",
  projectId: "knowmarket-bfdf7",
  storageBucket: "knowmarket-bfdf7.firebasestorage.app",
  messagingSenderId: "68118658961",
  appId: "1:68118658961:web:ea785bdaf3b0caa84da430"
};

let app, auth, db, provider;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db   = getFirestore(app);
  provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  console.log("🔐 Firebase initialized ✅");
} catch (e) { console.error("Firebase init error:", e.message); }

window.firebaseReady = (app !== undefined);
window.zenviAuth = { auth, provider };
window.zenviDB = db;

// ===== DOM HELPER =====
function safeDOMUpdate(cb) {
  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", cb)
    : cb();
}

// ===== USER FIRESTORE =====
async function saveUserToFirestore(user) {
  if (!db || !user) return;
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid, name: user.displayName || "User",
        email: user.email, photo: user.photoURL || "",
        createdAt: serverTimestamp(), lastLogin: serverTimestamp(),
        location: null, suggestionCount: 0, reputation: 0
      });
    } else {
      await setDoc(ref, { lastLogin: serverTimestamp() }, { merge: true });
    }
  } catch(e) { console.warn("Firestore save failed:", e.message); }
}

async function loadUserData(user) {
  if (!db || !user) return;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.location?.name) {
        window.currentLocation = data.location;
        localStorage.setItem("zenvi_location", JSON.stringify(data.location));
        localStorage.setItem("zenvi_location_name", data.location.name);
        const el = document.getElementById("homeAddress");
        if (el) el.innerText = data.location.name;
      }
    }
  } catch(e) { console.warn("Firestore load failed:", e.message); }
}

// ===== 🌟 COMMUNITY PRICE SUGGESTION SYSTEM =====

// User submits a price suggestion
window.submitPriceSuggestion = async function(itemName, suggestedPrice, location, unit = "kg") {
  const user = auth?.currentUser;
  if (!user) {
    if (window.showToast) window.showToast("⚠️ Price suggest karne ke liye login karein!");
    return false;
  }
  if (!db) return false;

  try {
    // Validate price — basic sanity check
    const price = parseFloat(suggestedPrice);
    if (isNaN(price) || price <= 0 || price > 50000) {
      if (window.showToast) window.showToast("❌ Valid price daalen (₹1 - ₹50,000)");
      return false;
    }

    // Add to pending_prices collection
    await addDoc(collection(db, "pending_prices"), {
      itemName: itemName.trim(),
      suggestedPrice: price,
      unit,
      location: location || window.currentLocation?.name || "Unknown",
      submittedBy: user.uid,
      submitterName: user.displayName || "Anonymous",
      status: "pending",   // pending | approved | rejected
      aiScore: null,       // AI will fill this
      submittedAt: serverTimestamp(),
      votes: 0
    });

    // Update user's suggestion count
    await setDoc(doc(db, "users", user.uid),
      { suggestionCount: increment(1) }, { merge: true });

    if (window.showToast) window.showToast(`✅ "${itemName}" ka price suggest hua! Review hoga.`);
    console.log("✅ Price suggestion submitted");
    return true;
  } catch(e) {
    console.error("Suggestion failed:", e);
    if (window.showToast) window.showToast("❌ Submit fail hua. Try again.");
    return false;
  }
};

// AI reviews pending suggestions and approves/rejects
window.aiReviewPendingSuggestions = async function() {
  if (!db) return;
  const user = auth?.currentUser;
  if (!user) return;

  try {
    const q = query(
      collection(db, "pending_prices"),
      where("status", "==", "pending"),
      orderBy("submittedAt"),
      limit(20)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      console.log("No pending suggestions");
      return;
    }

    const pending = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Get current market prices for comparison
    const currentPrices = {};
    if (window.marketData) {
      window.marketData.forEach(item => {
        currentPrices[item.name.toLowerCase()] = parseFloat(item.price);
      });
    }

    // AI review each suggestion
    for (const suggestion of pending) {
      const decision = await aiValidatePrice(suggestion, currentPrices);

      // Update Firestore with AI decision
      await updateDoc(doc(db, "pending_prices", suggestion.id), {
        status: decision.approved ? "approved" : "rejected",
        aiScore: decision.score,
        aiReason: decision.reason,
        reviewedAt: serverTimestamp()
      });

      // If approved — update/add to main prices collection
      if (decision.approved) {
        const priceRef = doc(db, "prices", suggestion.itemName.toLowerCase().replace(/\s+/g, '_'));
        const existing = await getDoc(priceRef);

        if (existing.exists()) {
          // Average with existing community price
          const old = existing.data();
          const avgPrice = ((old.price * old.voteCount) + suggestion.suggestedPrice) / (old.voteCount + 1);
          await setDoc(priceRef, {
            price: avgPrice.toFixed(2),
            voteCount: increment(1),
            lastUpdated: serverTimestamp()
          }, { merge: true });
        } else {
          await setDoc(priceRef, {
            itemName: suggestion.itemName,
            price: suggestion.suggestedPrice,
            unit: suggestion.unit,
            location: suggestion.location,
            voteCount: 1,
            source: "community",
            lastUpdated: serverTimestamp()
          });
        }

        // Reward user with reputation points
        await setDoc(doc(db, "users", suggestion.submittedBy),
          { reputation: increment(10) }, { merge: true });
      }
    }

    console.log(`✅ Reviewed ${pending.length} suggestions`);
    if (window.showToast) window.showToast(`🤖 AI ne ${pending.length} suggestions review kiye!`);

  } catch(e) { console.error("AI review failed:", e); }
};

// AI price validation logic
async function aiValidatePrice(suggestion, currentPrices) {
  const { itemName, suggestedPrice } = suggestion;
  const currentPrice = currentPrices[itemName.toLowerCase()];

  // Rule 1: Price range check (₹0.5 to ₹2000/kg for most items)
  if (suggestedPrice < 0.5 || suggestedPrice > 2000) {
    return { approved: false, score: 0, reason: "Price out of valid range" };
  }

  // Rule 2: Compare with current price (allow ±80% variation)
  if (currentPrice) {
    const ratio = suggestedPrice / currentPrice;
    if (ratio > 3.0) {
      return { approved: false, score: 20, reason: `Too high vs current ₹${currentPrice}` };
    }
    if (ratio < 0.2) {
      return { approved: false, score: 20, reason: `Too low vs current ₹${currentPrice}` };
    }
  }

  // Rule 3: Use Gemini AI for smart validation
  try {
    const GEMINI_KEY = "AIzaSyCbs5Zne_gChTcpmawNFWKB4csS89ez6L4";
    const prompt = `You are a price validator for Indian agricultural markets.
Item: ${itemName}
Suggested price: ₹${suggestedPrice}/kg
Current market price: ₹${currentPrice || 'unknown'}/kg
Location: ${suggestion.location}

Is this price realistic for India? Reply ONLY with JSON: {"valid": true/false, "score": 0-100, "reason": "brief reason"}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 100, temperature: 0.1 }
        })
      }
    );
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);
    return { approved: result.valid, score: result.score, reason: result.reason };
  } catch {
    // Fallback: basic rules passed, approve
    return { approved: true, score: 75, reason: "Basic validation passed" };
  }
}

// Load community-approved prices and merge with API data
window.loadCommunityPrices = async function() {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, "prices"));
    const communityPrices = [];
    snap.forEach(d => {
      const data = d.data();
      communityPrices.push({
        name: data.itemName,
        price: parseFloat(data.price).toFixed(2),
        unit: data.unit || "kg",
        source: "community",
        voteCount: data.voteCount || 1
      });
    });
    console.log(`📊 Loaded ${communityPrices.length} community prices`);
    return communityPrices;
  } catch(e) {
    console.warn("Community prices load failed:", e);
    return [];
  }
};

// Get pending suggestions count for current user
window.getUserSuggestionStats = async function() {
  const user = auth?.currentUser;
  if (!user || !db) return null;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      return {
        total: data.suggestionCount || 0,
        reputation: data.reputation || 0
      };
    }
  } catch(e) {}
  return null;
};

// ===== PROFILE UI =====
function updateProfileUI(user) {
  safeDOMUpdate(() => {
    const nameEl   = document.getElementById("profileDisplayName");
    const emailTop = document.getElementById("profileEmailTop");
    const avatarIcon = document.getElementById("profileAvatarIcon");
    const avatarImg  = document.getElementById("profileAvatarImg");
    const loginCard  = document.getElementById("loginCard");
    const profileDetails = document.getElementById("profileDetails");
    const userEmail = document.getElementById("userEmail");
    const joinDate  = document.getElementById("joinDate");

    if (nameEl)   nameEl.textContent = user.displayName || "User";
    if (emailTop) emailTop.textContent = user.email;

    if (user.photoURL && avatarImg && avatarIcon) {
      avatarImg.src = user.photoURL;
      avatarImg.style.display = "block";
      avatarIcon.style.display = "none";
    }

    if (loginCard)      loginCard.style.display = "none";
    if (profileDetails) profileDetails.classList.remove("hidden");
    if (userEmail)      userEmail.textContent = user.email;
    if (joinDate) {
      const d = user.metadata?.creationTime
        ? new Date(user.metadata.creationTime).toLocaleDateString('hi-IN', { year:'numeric', month:'long' })
        : "Recently joined";
      joinDate.textContent = `Joined: ${d}`;
    }
  });
}

function resetProfileUI() {
  safeDOMUpdate(() => {
    const nameEl   = document.getElementById("profileDisplayName");
    const emailTop = document.getElementById("profileEmailTop");
    const avatarIcon = document.getElementById("profileAvatarIcon");
    const avatarImg  = document.getElementById("profileAvatarImg");
    const loginCard  = document.getElementById("loginCard");
    const profileDetails = document.getElementById("profileDetails");

    if (nameEl)   nameEl.textContent = "Guest User";
    if (emailTop) emailTop.textContent = "Login karein apna account access karne ke liye";
    if (avatarImg)  { avatarImg.style.display = "none"; avatarImg.src = ""; }
    if (avatarIcon) avatarIcon.style.display = "block";
    if (loginCard)  loginCard.style.display = "block";
    if (profileDetails) profileDetails.classList.add("hidden");
  });
}

// ===== GOOGLE LOGIN =====
window.googleLogin = function() {
  if (!auth) { alert("⚠️ Firebase not ready."); return; }
  signInWithPopup(auth, provider)
    .then(async result => {
      updateProfileUI(result.user);
      await saveUserToFirestore(result.user);
      await loadUserData(result.user);
      if (window.showToast) window.showToast(`✅ Welcome, ${result.user.displayName}!`);
    })
    .catch(error => {
      if (error.code === 'auth/popup-closed-by-user') return;
      if (error.code === 'auth/unauthorized-domain')
        alert("❌ Domain authorized nahi hai. Firebase Console mein add karein.");
      else if (error.code === 'auth/popup-blocked')
        alert("⚠️ Popup blocked. Browser settings check karein.");
      else alert("Login failed: " + error.message);
    });
};

window.logout = function() {
  if (!auth) return;
  if (!confirm("Logout karna chahte hain?")) return;
  signOut(auth).then(() => {
    resetProfileUI();
    if (window.showToast) window.showToast("👋 Logged out!");
  }).catch(console.error);
};

window.saveLocationToCloud = async function(locationData) {
  const user = auth?.currentUser;
  if (!db || !user || !locationData) return;
  try {
    await setDoc(doc(db, "users", user.uid), { location: locationData }, { merge: true });
  } catch(e) { console.warn("Cloud location save failed:", e); }
};

if (auth) {
  onAuthStateChanged(auth, async user => {
    if (user) { updateProfileUI(user); await loadUserData(user); }
    else resetProfileUI();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("googleLoginBtn")?.addEventListener("click", window.googleLogin);
  document.getElementById("logoutBtn")?.addEventListener("click", window.logout);
});

console.log("🔐 Firebase config loaded ✅");

// ===== SHOP SAVE/LOAD (Permanent Firebase Storage) =====
import {
  collection as fbCollection,
  addDoc as fbAddDoc,
  getDocs as fbGetDocs,
  query as fbQuery,
  orderBy as fbOrderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Save shop permanently to Firestore
window.saveShopToFirebase = async function(shopData) {
  if (!db) return false;
  try {
    await fbAddDoc(fbCollection(db, "shops"), {
      ...shopData,
      createdAt: serverTimestamp()
    });
    console.log("☁️ Shop saved to Firebase:", shopData.name);
    return true;
  } catch(e) {
    console.warn("Shop Firebase save failed:", e.message);
    return false;
  }
};

// Load all shops from Firestore
window.loadShopsFromFirebase = async function() {
  if (!db) return [];
  try {
    const q = fbQuery(fbCollection(db, "shops"), fbOrderBy("createdAt", "desc"));
    const snap = await fbGetDocs(q);
    const shops = [];
    snap.forEach(doc => shops.push({ id: doc.id, ...doc.data() }));
    console.log(`🏪 Loaded ${shops.length} shops from Firebase`);
    // Also update localStorage cache
    localStorage.setItem("zenvi_shops", JSON.stringify(shops));
    return shops;
  } catch(e) {
    console.warn("Shops Firebase load failed:", e.message);
    // Return localStorage cache as fallback
    return JSON.parse(localStorage.getItem("zenvi_shops") || "[]");
  }
};
