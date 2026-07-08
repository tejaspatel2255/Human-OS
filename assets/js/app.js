let currentViewId = "view-home";
let currentCategoryId = null;
let currentArticleId = null;
let downloadProgressHandler = null;

function $(id) {
  return document.getElementById(id);
}

function trackEvent(name, payload = {}) {
  if (typeof window.queueAnalyticsEvent === "function") {
    window.queueAnalyticsEvent({ event: name, ...payload });
  }
}

function showToast(message, duration = 3000) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.left = "50%";
  toast.style.bottom = "1rem";
  toast.style.transform = "translateX(-50%)";
  toast.style.padding = "0.75rem 1rem";
  toast.style.borderRadius = "999rem";
  toast.style.background = "var(--text)";
  toast.style.color = "var(--bg)";
  toast.style.zIndex = "999";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.register("/service-worker.js");
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    showToast("App updated! Tap to reload", 4000);
  });
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data;
    if (data && typeof data === "object" && "cached" in data && "total" in data) {
      const progress = $("download-progress");
      const bar = $("download-bar");
      const status = $("download-status");
      if (progress && bar && status) {
        progress.hidden = false;
        const percent = data.total ? Math.round((data.cached / data.total) * 100) : 0;
        bar.style.width = `${percent}%`;
        status.textContent = `Downloading ${data.cached} / ${data.total} articles...`;
        if (data.cached === data.total) {
          setTimeout(() => {
            progress.hidden = true;
            showToast("All articles downloaded for offline use");
          }, 600);
        }
      }
    }
  });
  return registration;
}

function detectOfflineStatus() {
  if (navigator.onLine) {
    document.body.classList.remove("offline");
    const badge = $("offline-badge");
    if (badge) badge.hidden = true;
    const fab = $("ai-fab");
    if (fab) { fab.style.background = "var(--accent)"; fab.disabled = false; }
  } else {
    onOffline();
  }
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
}

function onOnline() {
  document.body.classList.remove("offline");
  const badge = $("offline-badge");
  if (badge) badge.hidden = true;
  const fab = $("ai-fab");
  if (fab) {
    fab.style.background = "var(--accent)";
    fab.disabled = false;
  }
  if (typeof flushAnalyticsQueue === "function") {
    flushAnalyticsQueue();
  }
  showToast("Back online", 3000);
}

function onOffline() {
  document.body.classList.add("offline");
  const badge = $("offline-badge");
  if (badge) badge.hidden = false;
  const fab = $("ai-fab");
  if (fab) {
    fab.style.background = "#777";
    fab.disabled = false;
  }
  updateLocalStats("offline_sessions");
}

function showView(viewId) {
  ["view-home", "view-category", "view-article", "view-search"].forEach((id) => {
    const el = $(id);
    if (el) el.hidden = id !== viewId;
  });
  currentViewId = viewId;
  const titles = {
    "view-home": "HumanOS — Survival Knowledge",
    "view-category": "HumanOS — Category",
    "view-article": "HumanOS — Article",
    "view-search": "HumanOS — Search"
  };
  document.title = titles[viewId] || "HumanOS — Survival Knowledge";
}

const categoryMeta = {
  emergency: { title: "Emergency", emoji: "🆘" },
  medicine: { title: "Medicine", emoji: "🩺" },
  water: { title: "Water", emoji: "💧" },
  food: { title: "Food", emoji: "🌾" },
  shelter: { title: "Shelter", emoji: "🏠" },
  energy: { title: "Energy", emoji: "⚡" },
  comms: { title: "Comms", emoji: "📡" },
  communication: { title: "Comms", emoji: "📡" },
  sanitation: { title: "Sanitation", emoji: "🧼" },
  "mental-health": { title: "Mental Health", emoji: "🧠" },
  plants: { title: "Plants", emoji: "🌿" },
  fire: { title: "Fire", emoji: "🔥" },
  tools: { title: "Tools", emoji: "🛠️" }
};

async function loadArticlesFromIndex() {
  const res = await fetch('/content/index.json');
  if (!res.ok) throw new Error('content/index.json not found');
  const index = await res.json();

  // Load each article and save to IndexedDB
  const loads = index.map(async (meta) => {
    try {
      const r = await fetch(`/content/${meta.category}/${meta.id}.json`);
      if (r.ok) {
        const article = await r.json();
        await saveArticle(article);
      }
    } catch(e) { /* skip missing articles */ }
  });

  await Promise.allSettled(loads);
  window.__articleIndex = index; // store in memory for category views
}

async function navigateToCategory(categoryId) {
  currentCategoryId = categoryId;
  showView("view-category");
  const meta = categoryMeta[categoryId] || { title: categoryId, emoji: "📁" };
  const title = $("category-title");
  const crumb = $("category-breadcrumb");
  if (title) title.textContent = `${meta.emoji} ${meta.title}`;
  if (crumb) crumb.textContent = meta.title;

  const url = new URL(window.location);
  url.searchParams.set("category", categoryId);
  url.searchParams.delete("article");
  window.history.pushState({}, "", url);

  let articles = [];
  let index = window.__articleIndex;
  if (!index) {
    try {
      const res = await fetch("/content/index.json");
      if (res.ok) {
        index = await res.json();
        window.__articleIndex = index;
      }
    } catch(e) {}
  }
  if (!index) index = [];

  if (categoryId === "emergency") {
    articles = index.filter(a => a.priority === "critical" || a.category === "medicine");
  } else {
    articles = index.filter(a => a.category === categoryId || (categoryId === "comms" && a.category === "communication"));
  }

  if (!articles || !articles.length) {
    if (typeof getArticlesByCategory === "function") {
      articles = await getArticlesByCategory(categoryId);
    }
  }

  const list = $("article-list");
  if (!list) return;
  list.innerHTML = "";
  for (const article of articles) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "result-card";
    card.setAttribute("role", "listitem");
    card.textContent = article.title || article.id;
    card.addEventListener("click", () => navigateToArticle(article.id));
    list.appendChild(card);
  }
}

async function navigateToArticle(articleId) {
  currentArticleId = articleId;
  showView("view-article");
  let article = await getArticle(articleId);
  if (!article) {
    let index = window.__articleIndex;
    if (!index) {
      try {
        const res = await fetch("/content/index.json");
        if (res.ok) {
          index = await res.json();
          window.__articleIndex = index;
        }
      } catch(e) {}
    }
    const meta = (index || []).find(a => a.id === articleId);
    const category = meta ? meta.category : (currentCategoryId || "general");
    const response = await fetch(`/content/${category}/${articleId}.json`);
    if (response.ok) {
      article = await response.json();
      await saveArticle(article);
    }
  }
  if (!article) {
    const content = $("article-content");
    if (content) content.textContent = "Article not found.";
    return;
  }

  if (article.category) {
    currentCategoryId = article.category;
  }

  const url = new URL(window.location);
  if (currentCategoryId) {
    url.searchParams.set("category", currentCategoryId);
  }
  url.searchParams.set("article", articleId);
  window.history.pushState({}, "", url);

  const catLink = $("article-category-link");
  if (catLink) {
    const meta = categoryMeta[currentCategoryId] || { title: currentCategoryId, emoji: "📁" };
    catLink.textContent = meta.title;
  }

  renderArticle(article);
  addToHistory(articleId);
  updateLocalStats("articles_read");
  trackEvent("article_read", { id: articleId, title: article.title });
}

function renderArticle(article) {
  const content = $("article-content");
  const bookmarkBtn = $("bookmark-btn");
  if (!content) return;
  const sections = Array.isArray(article.sections) ? article.sections : [];
  const priority = article.priority || "useful";
  const html = [];
  html.push(`<span class="priority-badge priority-badge--${priority}">${priority}</span>`);
  html.push(`<h1>${article.title || ""}</h1>`);
  if (article.summary) html.push(`<p class="lead">${article.summary}</p>`);
  if (article.difficulty) html.push(`<div class="priority-badge priority-badge--useful">Difficulty: ${article.difficulty}</div>`);
  for (const section of sections) {
    html.push(`<h2>${section.heading || section.title || ""}</h2>`);
    html.push(`<p>${section.body || section.text || ""}</p>`);
    if (section.warning) {
      html.push(`<div class="warning-box">${section.warning}</div>`);
    }
  }
  const whenToUse = article.when_to_use || article.whenToUse;
  if (whenToUse) {
    html.push(`<h2>When to use</h2><p>${whenToUse}</p>`);
  }
  if (Array.isArray(article.do_not) && article.do_not.length) {
    html.push(`<h2>Do NOT</h2><ul class="do-not-list">${article.do_not.map((item) => `<li>❌ ${item}</li>`).join("")}</ul>`);
  }
  if (Array.isArray(article.sources) && article.sources.length) {
    html.push(`<h2>Sources</h2><ul class="sources-list">${article.sources.map((item) => `<li>${item}</li>`).join("")}</ul>`);
  }
  content.innerHTML = html.join("");
  if (bookmarkBtn) {
    isBookmarked(article.id).then((bookmarked) => {
      bookmarkBtn.textContent = bookmarked ? "✅ Bookmarked" : "🔖 Bookmark";
      bookmarkBtn.onclick = () => toggleBookmark(article.id);
    });
  }
}

async function toggleBookmark(articleId) {
  const bookmarked = await isBookmarked(articleId);
  if (bookmarked) {
    await removeBookmark(articleId);
    const btn = $("bookmark-btn");
    if (btn) btn.textContent = "🔖 Bookmark";
  } else {
    await saveBookmark(articleId);
    const btn = $("bookmark-btn");
    if (btn) btn.textContent = "✅ Bookmarked";
    updateLocalStats("bookmarks_saved");
  }
}

async function renderPersonalStats() {
  const stats = await getLocalStats();
  const el = $("personal-stats");
  if (!el) return;
  if ((stats.sessions || 0) <= 1) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = `📊 Your stats: Read ${stats.articles_read} articles · Asked ${stats.ai_questions} AI questions · Used offline ${stats.offline_sessions} times · ${stats.bookmarks_saved} bookmarks saved`;
}

function closeAllPanels() {
  const overlay = $("modal-overlay");
  if (overlay) overlay.hidden = true;

  const settings = $("settings-panel");
  if (settings) {
    settings.hidden = true;
    settings.classList.remove("is-open");
  }

  const ai = $("ai-panel");
  if (ai) {
    ai.hidden = true;
    ai.classList.remove("is-open");
  }

  const lang = $("lang-picker");
  if (lang) lang.hidden = true;
}

function initAIChat() {
  const fab = $("ai-fab");
  const panel = $("ai-panel");
  const input = $("ai-input");
  const send = $("ai-send");
  const closeBtn = $("ai-close-btn");
  if (!fab || !panel) return;

  const toggle = () => {
    if (!navigator.onLine) {
      showToast("AI unavailable offline");
      return;
    }
    const isNowOpen = panel.hidden;
    closeAllPanels();
    if (isNowOpen) {
      panel.hidden = false;
      panel.classList.add("is-open");
      const overlay = $("modal-overlay");
      if (overlay) overlay.hidden = false;
    }
  };

  fab.addEventListener("click", toggle);
  if (closeBtn) closeBtn.addEventListener("click", closeAllPanels);
  if (send) send.addEventListener("click", handleAIMessage);
  if (input) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        handleAIMessage();
      }
    });
  }
}

async function handleAIMessage() {
  const input = $("ai-input");
  const messages = $("ai-messages");
  if (!input || !messages) return;
  const question = input.value.trim();
  if (!question) return;
  input.value = "";

  const userBubble = document.createElement("div");
  userBubble.className = "message message--user";
  userBubble.textContent = question;
  messages.appendChild(userBubble);

  const typing = document.createElement("div");
  typing.className = "message message--ai";
  typing.textContent = "•••";
  messages.appendChild(typing);

  const result = await askAI(question, currentCategoryId || "general");
  typing.remove();

  const aiBubble = document.createElement("div");
  aiBubble.className = "message message--ai";
  aiBubble.innerHTML = `${result.answer}<div class="message__model">${getModelDisplayName(result.model)}${result.fromCache ? " · Cached" : ""}</div><div class="ai-disclaimer">AI answers are informational only. Always seek professional help.</div>`;
  messages.appendChild(aiBubble);
  trackEvent("ai_question", { category: currentCategoryId || "general", model: result.model });
}

async function initDownloadAll() {
  const btn = $("download-all-btn");
  const progress = $("download-progress");
  const bar = $("download-bar");
  const status = $("download-status");
  if (!btn || !progress || !bar || !status) return;

  btn.addEventListener("click", async () => {
    let index = window.__articleIndex;
    if (!index) {
      const res = await fetch("/content/index.json");
      if (res.ok) {
        index = await res.json();
        window.__articleIndex = index;
      }
    }
    if (!index || !Array.isArray(index)) return;
    const urls = index.map(meta => `/content/${meta.category}/${meta.id}.json`);
    urls.push('/content/index.json');
    progress.hidden = false;
    bar.style.width = "0%";
    status.textContent = `Downloading 0 / ${urls.length} articles...`;
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "DOWNLOAD_ALL", urls });
    }
  });
}

function applyFontSize(value) {
  const html = document.documentElement;
  html.classList.remove("font-sm", "font-md", "font-lg", "font-xl");
  html.classList.add(value);
  localStorage.setItem("humanos_font", value);
}

function initFontSizeControls() {
  const saved = localStorage.getItem("humanos_font") || "font-md";
  applyFontSize(saved);
}

function applyTheme(value) {
  document.documentElement.setAttribute("data-theme", value);
  localStorage.setItem("humanos_theme", value);
}

function initThemeControls() {
  const saved = localStorage.getItem("humanos_theme") || "light";
  applyTheme(saved);
}

function routeFromURL() {
  const params = new URLSearchParams(location.search);
  const articleId = params.get("article");
  const categoryId = params.get("category");
  
  if (articleId) {
    if (categoryId) {
      currentCategoryId = categoryId;
    }
    navigateToArticle(articleId);
    return;
  }
  if (categoryId) {
    navigateToCategory(categoryId);
    return;
  }
  if (params.get("search")) {
    showView("view-search");
    return;
  }
  if (params.get("download")) {
    return;
  }
  showView("view-home");
}

function initSettings() {
  const settingsBtn = $("settings-btn");
  const panel = $("settings-panel");
  const closeBtn = $("settings-close-btn");
  if (settingsBtn && panel) {
    settingsBtn.addEventListener("click", () => {
      const isNowOpen = panel.hidden;
      closeAllPanels();
      if (isNowOpen) {
        panel.hidden = false;
        panel.classList.add("is-open");
        const overlay = $("modal-overlay");
        if (overlay) overlay.hidden = false;
      }
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", closeAllPanels);
  }
  const clearBtn = $("clear-cache-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "CLEAR_CACHE" });
      }
      showToast("Cache cleared");
    });
  }

  // Wire up Theme buttons (Light / Dark / High Contrast)
  const themeMap = { "theme-light-btn": "light", "theme-dark-btn": "dark", "theme-contrast-btn": "contrast" };
  Object.entries(themeMap).forEach(([id, value]) => {
    const btn = $(id);
    if (btn) btn.addEventListener("click", () => applyTheme(value));
  });

  // Wire up Font Size buttons (S / M / L / XL)
  const fontMap = { "font-sm-btn": "font-sm", "font-md-btn": "font-md", "font-lg-btn": "font-lg", "font-xl-btn": "font-xl" };
  Object.entries(fontMap).forEach(([id, value]) => {
    const btn = $(id);
    if (btn) btn.addEventListener("click", () => applyFontSize(value));
  });

  // Wire up globe button to show/hide language picker overlay
  const globeBtn = $("language-btn");
  const langPicker = $("lang-picker");
  const langCloseBtn = $("lang-close-btn");
  if (globeBtn && langPicker) {
    globeBtn.addEventListener("click", () => {
      const isNowOpen = langPicker.hidden;
      closeAllPanels();
      if (isNowOpen) {
        langPicker.hidden = false;
        const overlay = $("modal-overlay");
        if (overlay) overlay.hidden = false;
      }
    });
    langPicker.querySelectorAll("button[data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (typeof switchLanguage === "function") switchLanguage(btn.dataset.lang);
        closeAllPanels();
      });
    });
  }
  if (langCloseBtn) {
    langCloseBtn.addEventListener("click", closeAllPanels);
  }

  // Wire up settings panel language <select>
  const langSelect = $("language-select");
  if (langSelect) {
    langSelect.addEventListener("change", () => {
      if (typeof switchLanguage === "function") switchLanguage(langSelect.value);
    });
  }

  // Wire up overlay click to close all modals/panels
  const overlay = $("modal-overlay");
  if (overlay) {
    overlay.addEventListener("click", closeAllPanels);
  }
}

function initNavigation() {
  document.addEventListener("click", (e) => {
    const navLink = e.target.closest("a[data-nav]");
    if (navLink) {
      e.preventDefault();
      const navTarget = navLink.dataset.nav;
      if (navTarget === "home") {
        const url = new URL(window.location);
        url.search = "";
        window.history.pushState({}, "", url);
        showView("view-home");
      } else if (navTarget === "category" && currentCategoryId) {
        const url = new URL(window.location);
        url.searchParams.set("category", currentCategoryId);
        url.searchParams.delete("article");
        window.history.pushState({}, "", url);
        navigateToCategory(currentCategoryId);
      }
    }
  });
}

function initCategoryButtons() {
  document.querySelectorAll(".cat-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigateToCategory(btn.dataset.category);
    });
  });

  const emergencyBar = $("emergency-btn");
  if (emergencyBar) {
    emergencyBar.addEventListener("click", () => {
      navigateToCategory("medicine");
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try { await initDB(); } catch(e) { console.error('DB init failed', e); }
  try { await initI18n(); } catch(e) { console.error('i18n failed', e); }
  try { registerServiceWorker(); } catch(e) {}
  try { detectOfflineStatus(); } catch(e) {}
  try { await loadArticlesFromIndex(); } catch(e) { console.error('Content load failed', e); }
  try { initCategoryButtons(); } catch(e) {}
  try { initSearch(); } catch(e) {}
  try { initAIChat(); } catch(e) {}
  try { initDownloadAll(); } catch(e) {}
  try { initThemeControls(); } catch(e) {}
  try { initFontSizeControls(); } catch(e) {}
  try { initSettings(); } catch(e) {}
  try { await renderPersonalStats(); } catch(e) {}
  try { loadPublicStats(); } catch(e) {}
  try { loadGitHubStars(); } catch(e) {}
  try { initNavigation(); } catch(e) {}
  try { routeFromURL(); } catch(e) {}
  try { await updateLocalStats("sessions"); } catch(e) {}
});

window.registerServiceWorker = registerServiceWorker;
window.detectOfflineStatus = detectOfflineStatus;
window.onOnline = onOnline;
window.onOffline = onOffline;
window.showView = showView;
window.navigateToCategory = navigateToCategory;
window.navigateToArticle = navigateToArticle;
window.renderArticle = renderArticle;
window.toggleBookmark = toggleBookmark;
window.renderPersonalStats = renderPersonalStats;
window.initAIChat = initAIChat;
window.handleAIMessage = handleAIMessage;
window.initDownloadAll = initDownloadAll;
window.initFontSizeControls = initFontSizeControls;
window.initThemeControls = initThemeControls;
window.showToast = showToast;
window.initSettings = initSettings;
window.initSettingsControls = initSettings;
window.initCategoryButtons = initCategoryButtons;
window.initCategoryCards = initCategoryButtons;
