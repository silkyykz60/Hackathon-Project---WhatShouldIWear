// STATE
let currentWeather = null;   
let currentOccasion = "college";
let currentOutfits = [];     


const cityInput = document.getElementById("cityInput");
const citySearchBtn = document.getElementById("citySearchBtn");
const geoBtn = document.getElementById("geoBtn");
const statusMsg = document.getElementById("statusMsg");

const weatherDisplay = document.getElementById("weatherDisplay");
const weatherIcon = document.getElementById("weatherIcon");
const weatherTemp = document.getElementById("weatherTemp");
const weatherPlace = document.getElementById("weatherPlace");
const weatherCondition = document.getElementById("weatherCondition");
const weatherFeelsLike = document.getElementById("weatherFeelsLike");
const weatherHumidity = document.getElementById("weatherHumidity");
const weatherWind = document.getElementById("weatherWind");

const essentialsSection = document.getElementById("essentialsSection");
const essentialsList = document.getElementById("essentialsList");

const occasionSection = document.getElementById("occasionSection");
const occasionChips = document.getElementById("occasionChips");

const outfitSection = document.getElementById("outfitSection");
const outfitGrid = document.getElementById("outfitGrid");

const wishlistToggle = document.getElementById("wishlistToggle");
const wishlistCount = document.getElementById("wishlistCount");
const wishlistDrawer = document.getElementById("wishlistDrawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const closeWishlist = document.getElementById("closeWishlist");
const wishlistItems = document.getElementById("wishlistItems");

const toast = document.getElementById("toast");


function mapWeatherCode(code) {
  if (code === 0) return { label: "Clear sky", icon: "☀️", key: "clear" };
  if ([1, 2].includes(code)) return { label: "Partly cloudy", icon: "🌤️", key: "clear" };
  if (code === 3) return { label: "Overcast", icon: "☁️", key: "cloudy" };
  if ([45, 48].includes(code)) return { label: "Foggy", icon: "🌫️", key: "cloudy" };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: "Drizzle", icon: "🌦️", key: "rain" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: "Rainy", icon: "🌧️", key: "rain" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snowy", icon: "❄️", key: "snow" };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", icon: "⛈️", key: "storm" };
  return { label: "Unclear", icon: "🌡️", key: "clear" };
}


//API CALLS 
async function geocodeCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results || data.results.length === 0) throw new Error("City not found");
  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude, place: `${r.name}, ${r.country}` };
}

async function reverseGeocode(lat, lon) {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}`;

    const res = await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });

    if (!res.ok) throw new Error("Reverse geocoding failed");

    const data = await res.json();
    const address = data.address || {};

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county;

    const country = address.country;

    if (city && country) {
      return `${city}, ${country}`;
    }

    if (city) {
      return city;
    }

    return "Your location";
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return "Your location";
  }
}

async function fetchWeather(lat, lon, place) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
  `&current=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,uv_index` +
  `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
  `&forecast_days=7` +
  `&timezone=auto`;
  const res = await fetch(url);
  const data = await res.json();
  const c = data.current;
  const cond = mapWeatherCode(c.weather_code);

  currentWeather = {
    tempC: Math.round(c.temperature_2m),
    apparentTempC: calculateApparentTemp(
      c.temperature_2m,
      c.relative_humidity_2m
    ),
    condition: cond.label,
    conditionKey: cond.key,
    icon: cond.icon,
    humidity: c.relative_humidity_2m,
    windKph: Math.round(c.wind_speed_10m),
    uv: c.uv_index,
    precipProb: c.precipitation_probability ?? 0,
    place: place,
    timezone: data.timezone,
    daily: data.daily,
  };

  renderWeather();
  renderEssentials();
  renderOutfits();
  renderWeatherTrends();
  updateSkyTheme();

  occasionSection.classList.remove("hidden");
  essentialsSection.classList.remove("hidden");
  outfitSection.classList.remove("hidden");
}


function calculateApparentTemp(tempC, humidity) {
  if (tempC < 20) return tempC; // Heat index only impacts warm temps
  const apparent = tempC + (0.33 * (humidity / 100 * 6.105 * Math.exp(17.27 * tempC / (237.7 + tempC)))) - 4;
  return Math.round(apparent);
}

//LOCATION HANDLERS 
geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Geolocation isn't supported on this browser — try searching a city instead.");
    return;
  }
  setStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      const place = await reverseGeocode(latitude, longitude);
      setStatus("");
      await fetchWeather(latitude, longitude, place);
    },
    () => {
      setStatus("Location access denied — search for your city below instead.");
    }
  );
});

citySearchBtn.addEventListener("click", handleCitySearch);
cityInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleCitySearch(); });

async function handleCitySearch() {
  const city = cityInput.value.trim();
  if (!city) { setStatus("Type a city name first."); return; }
  setStatus("Fetching weather…");
  try {
    const { lat, lon, place } = await geocodeCity(city);
    await fetchWeather(lat, lon, place);
    setStatus("");
  } catch (err) {
    setStatus("Couldn't find that city — check the spelling and try again.");
  }
}

function setStatus(msg) { statusMsg.textContent = msg; }

// WEATHER
function renderWeather() {
  const w = currentWeather;
  weatherDisplay.classList.remove("hidden");
  weatherIcon.textContent = w.icon;
  weatherTemp.textContent = `${w.tempC}°C`;
  weatherPlace.textContent = w.place;
  weatherCondition.textContent = w.condition;
  weatherFeelsLike.textContent = `Feels like: ${w.apparentTempC}°C`;
  weatherHumidity.textContent = `Humidity: ${w.humidity}%`;
  weatherWind.textContent = `Wind: ${w.windKph} km/h`;
}

//  ESSENTIALS 
function renderEssentials() {
  const w = currentWeather;
  const tips = [];

  if (w.precipProb >= 40 || ["rain", "storm"].includes(w.conditionKey)) {
    tips.push("☂️ Carry an umbrella — rain's likely");
  }
  if (w.uv >= 6) {
    tips.push("🕶️ Wear sunglasses & sunscreen — high UV");
  }
  if (w.tempC >= 30) {
    tips.push("🥵 Stay hydrated, it's hot outside");
  }
  if (w.tempC <= 10) {
    tips.push("🧣 Bundle up — it's cold out there");
  }
  if (w.windKph >= 25) {
    tips.push("💨 It's windy — a windbreaker helps");
  }
  if (w.humidity >= 80 && w.tempC >= 22) {
    tips.push("💧 Muggy conditions — go breathable, not heavy fabrics");
  }
  if (tips.length === 0) {
    tips.push("✅ Nothing extra needed — conditions look easy today");
  }

  essentialsList.innerHTML = "";
  tips.forEach((t) => {
    const el = document.createElement("span");
    el.className = "essential-chip";
    el.textContent = t;
    essentialsList.appendChild(el);
  });
}

//  OCCASION SELECTOR 
occasionChips.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  btn.classList.add("active");
  currentOccasion = btn.dataset.occasion;
  if (currentWeather) renderOutfits();
});

//  OUTFIT RULE ENGINE 
// Returns a temperature band: "cold" | "cool" | "mild" | "warm" | "hot"
function tempBand(tempC) {
  if (tempC <= 8) return "cold";
  if (tempC <= 16) return "cool";
  if (tempC <= 23) return "mild";
  if (tempC <= 30) return "warm";
  return "hot";
}

// Base outfit "pieces" per temperature band 
const BASE_LAYERS = {
  cold: ["Thermal inner layer", "Heavy jacket or coat", "Full-length trousers", "Closed shoes or boots", "Scarf"],
  cool: ["Light sweater or hoodie", "Full-length trousers or jeans", "Closed shoes"],
  mild: ["Full or half-sleeve shirt", "Jeans or chinos", "Sneakers"],
  warm: ["Cotton short/half-sleeve shirt", "Light trousers or shorts", "Breathable footwear"],
  hot: ["Loose cotton/linen shirt", "Shorts or light trousers", "Sandals or breathable sneakers"],
};

// Occasion styling notes layered on top of the base.
const OCCASION_STYLE = {
  college: { tag: "Casual & comfy", extra: ["Backpack-friendly fit"] },
  workplace: { tag: "Smart casual", extra: ["Collared shirt", "Neutral tones"] },
  presentation: { tag: "Formal", extra: ["Blazer or formal shirt", "Polished shoes"] },
  outing: { tag: "Relaxed", extra: ["Comfortable statement piece"] },
  traveling: { tag: "Practical", extra: ["Layerable jacket", "Comfortable walking shoes"] },
};

// Weather-condition add-ons, independent of temperature.
const CONDITION_ADDONS = {
  rain: ["Waterproof jacket or raincoat", "Water-resistant footwear"],
  storm: ["Waterproof jacket", "Avoid loose umbrellas — use a raincoat"],
  snow: ["Insulated waterproof boots", "Gloves"],
  cloudy: [],
  clear: [],
};

function generateOutfits(weather, occasion) {
  const band = tempBand(weather.apparentTempC);
  const base = BASE_LAYERS[band];
  const style = OCCASION_STYLE[occasion];
  const addons = CONDITION_ADDONS[weather.conditionKey] || [];

  // Build 3 variants: "Recommended", "Alternative", "Minimal" — gives users real choice.
  const variants = [
  {
    id: `${occasion}-${band}-a`,
    name: "I'd wear this",
    emoji: pickEmoji(band, occasion, 0, weather),
    advice: getHumanAdvice(weather, occasion, 0),
    items: [...base, ...style.extra, ...addons],
  },
  {
    id: `${occasion}-${band}-b`,
    name: "A little more put-together",
    emoji: pickEmoji(band, occasion, 1, weather),
    advice: getHumanAdvice(weather, occasion, 1),
    items: [...swapOne(base), ...style.extra.slice(0, 1), ...addons],
  },
  {
    id: `${occasion}-${band}-c`,
    name: "Keep it simple",
    emoji: pickEmoji(band, occasion, 2, weather),
    advice: getHumanAdvice(weather, occasion, 2),
    items: [...base.slice(0, 3), ...addons],
  },
];
  return variants;
}

function swapOne(base) {
  
  const copy = [...base];
  if (copy.length > 1) { const tmp = copy[0]; copy[0] = copy[1]; copy[1] = tmp; }
  return copy;
}
function getHumanAdvice(weather, occasion, variant = 0) {
  const temp = weather.apparentTempC ?? weather.tempC;

  if (weather.conditionKey === "rain") {
    if (variant === 0) return "Rain's around, so I'd keep this practical.";
    if (variant === 1) return "A little more relaxed, but still ready for the rain.";
    return "If you want zero fuss, this one's easy.";
  }

  if (weather.conditionKey === "storm") {
    return "It's rough outside — I'd keep things covered and practical.";
  }

  if (temp > 32) {
    if (variant === 0) return "It's seriously warm. I'd keep things light and breathable.";
    if (variant === 1) return "Keep the fabrics loose — you'll thank yourself later.";
    return "Honestly, on a day like this, less is more.";
  }

  if (temp > 27) {
    if (variant === 0) return "Warm day ahead. Light fabrics are your friend.";
    if (variant === 1) return "Easy, breathable, and still put-together.";
    return "The no-brainer option for a warm day.";
  }

  if (temp > 20) {
    if (variant === 0) return "Pretty comfortable outside. You don't need to overthink it.";
    if (variant === 1) return "A little more personality without giving up comfort.";
    return "Simple, comfortable, done.";
  }

  if (temp > 12) {
    if (variant === 0) return "There's a bit of a chill — I'd bring a light layer.";
    if (variant === 1) return "Layer up a little, but nothing too heavy.";
    return "Keep a layer handy and you're good to go.";
  }

  return "It's cold out. I'd rather be slightly overdressed than freezing.";
}
//  OUTFIT ICONS 

function pickEmoji(band, occasion, variant = 0, weather = null) {

  // Rain / storm takes priority because the weather affects the outfit directly.
  if (weather && ["rain", "storm"].includes(weather.conditionKey)) {
    const weatherIcons = {
      college: ["🎒", "🧥", "👟"],
      workplace: ["🧥", "👔", "👞"],
      presentation: ["🧥", "👔", "👞"],
      outing: ["🧥", "👚", "👟"],
      traveling: ["🎒", "🧥", "🥾"],
    };

    const icons = weatherIcons[occasion] || ["🧥", "👕", "👟"];
    return icons[variant % icons.length];
  }

  // Snow / very cold weather.
  if (weather && weather.conditionKey === "snow") {
    const snowIcons = {
      college: ["🧥", "🧣", "🥾"],
      workplace: ["🧥", "🧣", "👞"],
      presentation: ["🧥", "👔", "👞"],
      outing: ["🧥", "🧣", "🥾"],
      traveling: ["🎒", "🧥", "🥾"],
    };

    const icons = snowIcons[occasion] || ["🧥", "🧣", "🥾"];
    return icons[variant % icons.length];
  }

  // Occasion-specific icons for normal weather.
  const occasionIcons = {
    college: {
      cold: ["🧥", "🧣", "🥾"],
      cool: ["🎒", "🧶", "👟"],
      mild: ["🎒", "👕", "👟"],
      warm: ["🎒", "👕", "👟"],
      hot: ["🎒", "👕", "👟"],
    },

    workplace: {
      cold: ["🧥", "🧣", "👞"],
      cool: ["🧥", "👔", "👞"],
      mild: ["👔", "🧥", "👞"],
      warm: ["👔", "👕", "👞"],
      hot: ["👔", "👕", "👞"],
    },

    presentation: {
      cold: ["🧥", "👔", "👞"],
      cool: ["🧥", "👔", "👞"],
      mild: ["👔", "🧥", "👞"],
      warm: ["👔", "👕", "👞"],
      hot: ["👔", "👕", "👞"],
    },

    outing: {
      cold: ["🧥", "🧣", "🥾"],
      cool: ["🧥", "👚", "👟"],
      mild: ["👚", "👖", "👟"],
      warm: ["👚", "👖", "👟"],
      hot: ["👕", "🩳", "👟"],
    },

    traveling: {
      cold: ["🎒", "🧥", "🥾"],
      cool: ["🎒", "🧥", "👟"],
      mild: ["🎒", "👕", "👟"],
      warm: ["🎒", "👕", "👟"],
      hot: ["🎒", "👕", "👟"],
    },
  };

  const occasionMap = occasionIcons[occasion] || occasionIcons.college;
  const icons = occasionMap[band] || occasionMap.mild;

  return icons[variant % icons.length];
}

//  OUTFITS 
function renderOutfits() {
  if (!currentWeather) return;
  currentOutfits = generateOutfits(currentWeather, currentOccasion);
  outfitGrid.innerHTML = "";

  currentOutfits.forEach((outfit) => {
    const card = document.createElement("div");
    card.className = "outfit-card";
    card.style.opacity = "0";
card.style.transform = "translateY(20px)";

setTimeout(() => {
  card.style.transition = "opacity 0.5s ease, transform 0.5s ease";
  card.style.opacity = "1";
  card.style.transform = "translateY(0)";
}, 100);
    card.style.setProperty("--outfit-delay", `${currentOutfits.indexOf(outfit) * 120}ms`);

    const feedback = getFeedback(outfit.id);
    const inWishlist = isWishlisted(outfit.id);

    card.innerHTML = `
      <div class="outfit-name">${outfit.name}</div>
      <div class="outfit-advice">${outfit.advice}</div>
      <ul class="outfit-items">

<ul class="outfit-items">
        ${outfit.items.map((i) => `<li>• ${i}</li>`).join("")}
      </ul>
      <div class="outfit-actions">
        <div class="action-btns">
          <button class="mini-btn like-btn ${feedback === "liked" ? "liked" : ""}" title="Like">👍</button>
          <button class="mini-btn dislike-btn ${feedback === "disliked" ? "disliked" : ""}" title="Dislike">👎</button>
        </div>
        <button class="mini-btn wish-btn ${inWishlist ? "wished" : ""}" title="Save to wishlist">${inWishlist ? "❤️" : "🤍"}</button>
      </div>
    `;

    card.querySelector(".like-btn").addEventListener("click", () => handleFeedback(outfit, "liked", card));
    card.querySelector(".dislike-btn").addEventListener("click", () => handleFeedback(outfit, "disliked", card));
    card.querySelector(".wish-btn").addEventListener("click", () => handleWishlistToggle(outfit, card));

    outfitGrid.appendChild(card);
  });
}

// FEEDBACK 
function getFeedbackStore() {
  return JSON.parse(localStorage.getItem("wearcast_feedback") || "{}");
}
function getFeedback(outfitId) {
  return getFeedbackStore()[outfitId] || null;
}
function handleFeedback(outfit, type, card) {
  const store = getFeedbackStore();
  store[outfit.id] = store[outfit.id] === type ? null : type; 
  localStorage.setItem("wearcast_feedback", JSON.stringify(store));

  card.querySelector(".like-btn").classList.toggle("liked", store[outfit.id] === "liked");
  card.querySelector(".dislike-btn").classList.toggle("disliked", store[outfit.id] === "disliked");

  showToast(store[outfit.id] === "liked" ? "Glad you like it! 🎉" :
            store[outfit.id] === "disliked" ? "Thanks — we'll use this to improve suggestions" :
            "Feedback cleared");
}

// WISHLIST 
function getWishlist() {
  return JSON.parse(localStorage.getItem("wearcast_wishlist") || "[]");
}
function isWishlisted(outfitId) {
  return getWishlist().some((o) => o.id === outfitId);
}
function handleWishlistToggle(outfit, card) {
  let list = getWishlist();
  const exists = list.some((o) => o.id === outfit.id);

  if (exists) {
    list = list.filter((o) => o.id !== outfit.id);
    showToast("Removed from wishlist");
  } else {
    list.push({ ...outfit, occasion: currentOccasion, savedAt: Date.now() });
    showToast("Saved to wishlist ❤️");
  }
  localStorage.setItem("wearcast_wishlist", JSON.stringify(list));
  card.querySelector(".wish-btn").classList.toggle("wished", !exists);
  card.querySelector(".wish-btn").textContent = !exists ? "❤️" : "🤍";
  renderWishlistCount();
}

function renderWishlistCount() {
  wishlistCount.textContent = getWishlist().length;
}

function renderWishlistDrawer() {
  const list = getWishlist();
  wishlistItems.innerHTML = "";
  if (list.length === 0) {
    wishlistItems.innerHTML = `<p class="empty-msg">No outfits saved yet. Tap 🤍 on any outfit to save it here.</p>`;
    return;
  }
  list.forEach((outfit) => {
    const row = document.createElement("div");
    row.className = "wishlist-item";
    row.innerHTML = `
      <div>
        <div class="outfit-name">${outfit.emoji} ${outfit.name}</div>
        <div style="font-size:0.8rem;color:var(--color-text-soft)">For: ${outfit.occasion}</div>
      </div>
      <button class="mini-btn" title="Remove">🗑️</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      const updated = getWishlist().filter((o) => o.id !== outfit.id);
      localStorage.setItem("wearcast_wishlist", JSON.stringify(updated));
      renderWishlistDrawer();
      renderWishlistCount();
      renderOutfits();
    });
    wishlistItems.appendChild(row);
  });
}

//  DRAWER OPEN/CLOSE
wishlistToggle.addEventListener("click", () => {
  renderWishlistDrawer();
  wishlistDrawer.classList.add("open");
  drawerOverlay.classList.add("open");
});
closeWishlist.addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);
function closeDrawer() {
  wishlistDrawer.classList.remove("open");
  drawerOverlay.classList.remove("open");
}

// TOAST 
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

// INIT 
// SKY THEME 
function updateSkyTheme() {
  let hour;

  if (currentWeather && currentWeather.timezone) {
    const localTime = new Intl.DateTimeFormat("en-US", {
      timeZone: currentWeather.timezone,
      hour: "numeric",
      hour12: false
    }).format(new Date());

    hour = Number(localTime);
  } else {
    hour = new Date().getHours();
  }

  document.body.classList.remove(
    "sky-morning",
    "sky-day",
    "sky-evening",
    "sky-night"
  );

  if (hour >= 5 && hour < 8) {
    document.body.classList.add("sky-morning");
  } else if (hour >= 8 && hour < 17) {
    document.body.classList.add("sky-day");
  } else if (hour >= 17 && hour < 20) {
    document.body.classList.add("sky-evening");
  } else {
    document.body.classList.add("sky-night");
  }
}

//INIT 
renderWishlistCount();
updateSkyTheme();

setInterval(updateSkyTheme, 60000);

//WEARCAST CHATBOT 

const chatToggle = document.getElementById("chatToggle");
const chatbot = document.getElementById("chatbot");
const closeChat = document.getElementById("closeChat");
const chatInput = document.getElementById("chatInput");
const sendChat = document.getElementById("sendChat");
const chatMessages = document.getElementById("chatMessages");

// Open chatbot
chatToggle.addEventListener("click", () => {
  chatbot.classList.add("open");
  chatInput.focus();
});

// Close chatbot
closeChat.addEventListener("click", () => {
  chatbot.classList.remove("open");
});

// Send message
function sendMessage() {
  const message = chatInput.value.trim();

  if (!message) return;

  // Add user's message
  addChatMessage(message, "user");

  chatInput.value = "";

  // Generate WearCast response
  const response = getWearCastResponse(message);

  setTimeout(() => {
    addChatMessage(response, "bot");
  }, 400);
}

// Add message to chat
function addChatMessage(message, type) {
  const messageDiv = document.createElement("div");

  messageDiv.className = `chat-message ${type}`;
  messageDiv.textContent = message;

  chatMessages.appendChild(messageDiv);

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send button
sendChat.addEventListener("click", sendMessage);

// Enter key
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

// Quick prompts
document.querySelectorAll(".quick-prompt").forEach((button) => {
  button.addEventListener("click", () => {
    const message = button.textContent;

    addChatMessage(message, "user");

    const response = getWearCastResponse(message);

    setTimeout(() => {
      addChatMessage(response, "bot");
    }, 400);
  });
});

// Add message to chat
function addChatMessage(message, type) {
  const messageDiv = document.createElement("div");

  messageDiv.className = `chat-message ${type}`;
  messageDiv.textContent = message;

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send button
sendChat.addEventListener("click", sendMessage);

// Enter key
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

// WEARCAST CHATBOT RESPONSE ENGINE 

function getWearCastResponse(message) {
  const text = message.toLowerCase().trim();

  // No weather loaded yet
  if (!currentWeather) {
    return "First, tell me your city or use your location so I can check the weather and give you a proper recommendation! 🌤️";
  }

  const w = currentWeather;

  // GREETINGS

  if (
    /^(hi|hello|hey|hii|heyy|yo|hola|good morning|good afternoon|good evening)[!. ]*$/.test(text)
  ) {
   return `Hey 👋 It's ${w.tempC}°C in ${w.place} right now. Tell me what you're doing today and I'll tell you what I'd actually wear.`;
  }

  // WEATHER / TEMPERATURE

  if (
    text.includes("weather") ||
    text.includes("temperature") ||
    text.includes("outside") ||
    text.includes("forecast") ||
    text.includes("degrees") ||
    text.includes("how hot") ||
    text.includes("how cold") ||
    text.includes("current condition")
  ) {
    return `Right now in ${w.place}: ${w.tempC}°C, ${w.condition.toLowerCase()}, and it feels like ${w.apparentTempC}°C. Humidity's at ${w.humidity}% and wind is ${w.windKph} km/h. Basically, here's what you need to know — not a weather lecture.`;
  }

  // APPARENT TEMPERATURE / FEELS LIKE

  if (
    text.includes("feels like") ||
    text.includes("real feel") ||
    text.includes("apparent temperature")
  ) {
    return `It feels like ${w.apparentTempC}°C right now, even though the actual temperature is ${w.tempC}°C. 🌡️`;
  }

  // UMBRELLA / RAIN

  if (
    text.includes("umbrella") ||
    text.includes("rain") ||
    text.includes("raining") ||
    text.includes("wet") ||
    text.includes("precipitation")
  ) {
    if (
      w.precipProb >= 40 ||
      w.conditionKey === "rain" ||
      w.conditionKey === "storm"
    ) {
      return `Yep — I'd take the umbrella. ☂️ There's a ${w.precipProb}% chance of rain and it's ${w.condition.toLowerCase()} right now. Future-you will be glad you did.`;
    }

    return `I'd leave the umbrella at home. ☀️ Only ${w.precipProb}% chance of rain — you've got better things to carry around.`;
  }

  // WIND
  if (
    text.includes("wind") ||
    text.includes("windy") ||
    text.includes("windbreaker")
  ) {
    if (w.windKph >= 25) {
      return `${w.windKph} km/h winds? 💨 Yeah, I'd bring a light jacket. Especially if you're going to be outside for a while — messy hair is optional.`;
    }

   return `${w.windKph} km/h winds? 💨 Yeah, I'd bring a light jacket. Especially if you're going to be outside for a while — messy hair is optional.`;
  }

  // HUMIDITY

  if (
    text.includes("humidity") ||
    text.includes("humid") ||
    text.includes("muggy") ||
    text.includes("sticky")
  ) {
    if (w.humidity >= 80) {
      return `${w.humidity}% humidity. 💧 That's the kind of weather where your clothes start feeling personal. Go loose, light and breathable — cotton or linen wins today.`;
    }

    if (w.humidity >= 60) {
      return `${w.humidity}% humidity — noticeable, but nothing dramatic. I'd still keep the outfit breathable.`;
    }

    return `${w.humidity}% humidity. Pretty comfortable. Your outfit doesn't need a special weather strategy today.`;
  }

  // UV / SUN

  if (
    text.includes("uv") ||
    text.includes("sun") ||
    text.includes("sunscreen") ||
    text.includes("sunglasses")
  ) {
    if (w.uv >= 6) {
      return `The UV index is ${w.uv}, which is high. 🕶️ I'd recommend sunscreen, sunglasses, and some protection from direct sunlight.`;
    }

    if (w.uv >= 3) {
      return `The UV index is ${w.uv}, so some sun protection would be a good idea if you're outside for long. ☀️`;
    }

    return `The UV index is ${w.uv}, so UV exposure isn't a major concern right now.`;
  }

  // VERY HOT / VERY COLD

  if (
    text.includes("too hot") ||
    text.includes("very hot") ||
    text.includes("hot outside") ||
    text.includes("heat")
  ) {
    if (w.apparentTempC >= 30) {
     return `Oh, it's warm. 🥵 Feels like ${w.apparentTempC}°C — I'd keep it loose, light and breathable. This is not a hoodie day.`;
    }

    return `It's warm, but manageable. Feels like ${w.apparentTempC}°C — normal lightweight clothes should do the job.`;
  }

  if (
    text.includes("too cold") ||
    text.includes("very cold") ||
    text.includes("cold outside") ||
    text.includes("freezing")
  ) {
    if (w.apparentTempC <= 10) {
      return `Yes, it's quite cold at a feels-like temperature of ${w.apparentTempC}°C. 🧣 I'd recommend warm layers, full-length trousers and closed shoes.`;
    }

    return `It isn't particularly cold right now. The feels-like temperature is ${w.apparentTempC}°C, so you probably won't need heavy winter clothing.`;
  }

  // OCCASION DETECTION

  let requestedOccasion = null;

  if (
    text.includes("college") ||
    text.includes("university") ||
    text.includes("class") ||
    text.includes("campus")
  ) {
    requestedOccasion = "college";
  }

  if (
    text.includes("work") ||
    text.includes("office") ||
    text.includes("workplace") ||
    text.includes("job")
  ) {
    requestedOccasion = "workplace";
  }

  if (
    text.includes("presentation") ||
    text.includes("presenting") ||
    text.includes("presentation day") ||
    text.includes("meeting")
  ) {
    requestedOccasion = "presentation";
  }

  if (
    text.includes("outing") ||
    text.includes("hangout") ||
    text.includes("hanging out") ||
    text.includes("going out") ||
    text.includes("date")
  ) {
    requestedOccasion = "outing";
  }

  if (
    text.includes("travel") ||
    text.includes("travelling") ||
    text.includes("traveling") ||
    text.includes("trip") ||
    text.includes("journey")
  ) {
    requestedOccasion = "traveling";
  }

  // OUTFIT REQUEST

  if (
    text.includes("wear") ||
    text.includes("outfit") ||
    text.includes("dress") ||
    text.includes("clothes") ||
    text.includes("clothing") ||
    text.includes("look") ||
    text.includes("what should i") ||
    text.includes("what can i")
  ) {

    const occasion = requestedOccasion || currentOccasion;
    const outfits = generateOutfits(w, occasion);

    const outfit = outfits[0];

    const occasionName = {
      college: "college",
      workplace: "work",
      presentation: "presentation",
      outing: "outing",
      traveling: "travel"
    };

    let response =
    `For ${occasionName[occasion] || "today"}, I'd wear: ` +
  ` ${outfit.items.join(", ")}. 👕`;

    if (w.precipProb >= 40 || w.conditionKey === "rain") {
      response += " Since rain is possible, make sure you have rain protection too. ☂️";
    }

    if (w.windKph >= 25) {
      response += " It's also windy, so a light outer layer would help. 💨";
    }

    if (w.humidity >= 80) {
      response += " Humidity's high, so breathable fabric is definitely the move.";
    }

    return response;
  }

  // SPECIFIC CLOTHING QUESTIONS

  if (text.includes("jeans")) {
    if (w.apparentTempC >= 30) {
      return `Jeans might feel a little warm today at ${w.apparentTempC}°C feels-like. I'd choose lighter trousers or breathable pants instead. 👖`;
    }

    if (w.apparentTempC <= 12) {
      return `Yes! Jeans are actually a good choice today because it's relatively cool at ${w.apparentTempC}°C. 👖`;
    }

    return `Yes, jeans should be comfortable in ${w.apparentTempC}°C conditions. 👖`;
  }


  if (
    text.includes("hoodie") ||
    text.includes("sweater") ||
    text.includes("sweatshirt")
  ) {
    if (w.apparentTempC >= 28) {
      return `I'd skip the hoodie today. 😅 At ${w.apparentTempC}°C feels-like, it could get uncomfortable.`;
    }

    if (w.apparentTempC <= 20) {
      return `A hoodie or light sweater sounds like a good choice today. 🧥 The feels-like temperature is ${w.apparentTempC}°C.`;
    }

    return `A hoodie could work, but you may want something lightweight because it feels like ${w.apparentTempC}°C.`;
  }


  if (
    text.includes("shorts") ||
    text.includes("short")
  ) {
    if (w.apparentTempC >= 25 && w.conditionKey !== "rain") {
      return `Shorts should be comfortable today. 🩳 It's ${w.apparentTempC}°C feels-like, so lightweight clothing makes sense.`;
    }

    return `I'd probably choose full-length trousers today. The feels-like temperature is ${w.apparentTempC}°C, so shorts may not be the most comfortable option.`;
  }

  // FORMAL / PROFESSIONAL

  if (
    text.includes("formal") ||
    text.includes("professional") ||
    text.includes("business") ||
    text.includes("smart")
  ) {
    const outfits = generateOutfits(w, "presentation");
    const outfit = outfits[0];

    return `For a professional look, I'd suggest: ${outfit.items.join(", ")}. 👔 Keep the colours neutral and the fit polished.`;
  }

  // COLLEGE LOOK

  if (
    text.includes("casual") ||
    text.includes("college look") ||
    text.includes("student look")
  ) {
    const outfits = generateOutfits(w, "college");
    const outfit = outfits[0];

    return `For a casual college look, I'd go with: ${outfit.items.join(", ")}. 🎒`;
  }

  // TRAVEL

  if (
    text.includes("travel") ||
    text.includes("trip") ||
    text.includes("journey")
  ) {
    const outfits = generateOutfits(w, "traveling");
    const outfit = outfits[0];

    return `For travelling, comfort is the priority. I'd suggest: ${outfit.items.join(", ")}. 🎒`;

  }

  // WEATHER + OCCASION COMBINATION

  if (requestedOccasion) {
    const outfits = generateOutfits(w, requestedOccasion);
    const outfit = outfits[0];

    return `For your ${requestedOccasion} plans, I'd recommend: ${outfit.items.join(", ")}. 👕`;
  }

  // GENERAL COMFORT QUESTION

  if (
    text.includes("comfortable") ||
    text.includes("comfort") ||
    text.includes("okay") ||
    text.includes("fine")
  ) {
    if (w.apparentTempC >= 30) {
      return `It may feel quite warm today at ${w.apparentTempC}°C. Stay with loose, breathable clothing and keep hydrated. 💧`;
    }

    if (w.apparentTempC <= 10) {
      return `It's fairly cold at ${w.apparentTempC}°C feels-like. Warm layers and closed footwear would keep you comfortable. 🧣`;
    }

    if (w.humidity >= 80) {
      return `Temperature-wise you're okay, but humidity is high at ${w.humidity}%. I'd stick to lightweight, breathable fabrics.`;
    }

    return `The conditions look fairly comfortable right now: ${w.apparentTempC}°C feels-like, ${w.humidity}% humidity and ${w.windKph} km/h wind. 😊`;
  }

  // HELP / CAPABILITIES

  if (
    text.includes("help") ||
    text.includes("what can you do") ||
    text.includes("how can you help")
  ) {
    return `Give me a situation and I'll help you figure it out. 👀

Try:
“What should I wear today?”
“Is a hoodie a bad idea?”
“Do I need an umbrella?”
“I've got a presentation — what should I wear?”
“Can I get away with jeans?”

Basically: tell me the plan. I'll handle the weather part.`;
  }




  return `I'm your weather + outfit buddy! 🌤️ I can understand questions about the weather, outfits, rain, temperature, humidity, wind, UV, and occasions like college, work, presentations, outings and travel. Try asking me what you should wear or describe your plans!`;
}
let forecastChart = null;

function renderWeatherTrends() {
  const daily = currentWeather?.daily;

  if (!daily || !daily.time || daily.time.length === 0) {
    return;
  }

  const forecastSection = document.getElementById("forecastSection");
  const forecastDays = document.getElementById("forecastDays");
  const forecastSummary = document.getElementById("forecastSummary");
  const canvas = document.getElementById("forecastChart");

  if (!forecastSection || !forecastDays || !forecastSummary || !canvas) {
    return;
  }

  forecastSection.classList.remove("hidden");

  const dates = daily.time;
  const highs = daily.temperature_2m_max;
  const lows = daily.temperature_2m_min;
  const rain = daily.precipitation_probability_max;

  // Human summary

  const warmestIndex = highs.indexOf(Math.max(...highs));
  const coolestIndex = lows.indexOf(Math.min(...lows));
  const rainiestIndex = rain.indexOf(Math.max(...rain));

  const formatDay = (dateString) => {
    const date = new Date(`${dateString}T12:00:00`);

    return date.toLocaleDateString("en-US", {
      weekday: "short"
    });
  };

  const warmestDay = formatDay(dates[warmestIndex]);
  const coolestDay = formatDay(dates[coolestIndex]);
  const rainiestDay = formatDay(dates[rainiestIndex]);

  forecastSummary.textContent =
    `${warmestDay} looks like the warmest day. ` +
    `${rainiestDay} has the highest rain chance, so that's the day I'd keep flexible.`;

  // Graph

  if (forecastChart) {
    forecastChart.destroy();
  }

  forecastChart = new Chart(canvas, {
    type: "line",

    data: {
      labels: dates.map(formatDay),

      datasets: [
        {
          label: "High",
          data: highs,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4,
        },
        {
          label: "Low",
          data: lows,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4,
        }
      ]
    },

    options: {
      responsive: true,

      maintainAspectRatio: false,

      interaction: {
        intersect: false,
        mode: "index",
      },

      plugins: {
        legend: {
          position: "top",
        },

        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y}°C`;
            }
          }
        }
      },

      scales: {
        y: {
          title: {
            display: true,
            text: "Temperature"
          },

          ticks: {
            callback: function(value) {
              return `${value}°`;
            }
          }
        }
      }
    }
  });

  // Daily cards
  
  forecastDays.innerHTML = dates.map((date, index) => {
    const dayName = index === 0
      ? "Today"
      : formatDay(date);

    const rainChance = rain[index] ?? 0;

    return `
      <div class="forecast-day">
        <div class="forecast-day-name">${dayName}</div>

        <div class="forecast-temp">
          ${Math.round(highs[index])}°
          <span>${Math.round(lows[index])}°</span>
        </div>

        <div class="forecast-rain">
          ${rainChance}% rain
        </div>
      </div>
    `;
  }).join("");
}