const SUPPORTED_LANGS = ["en", "es", "fr", "hi", "ar", "zh", "pt", "sw"];

let currentLang = "en";

async function loadLocale(lang) {
  const response = await fetch(`/locales/${lang}.json`);
  if (!response.ok) {
    return {};
  }
  return response.json();
}

function t(key) {
  return (window.__i18n && window.__i18n[key]) || (window.__en && window.__en[key]) || key;
}

function applyI18nToDOM() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
  });
}

async function initI18n() {
  const stored = localStorage.getItem("humanos_lang");
  const navLang = (navigator.language || "en").slice(0, 2);
  const lang = SUPPORTED_LANGS.includes(stored) ? stored : SUPPORTED_LANGS.includes(navLang) ? navLang : "en";
  currentLang = lang;
  window.__en = await loadLocale("en");
  window.__i18n = lang === "en" ? window.__en : await loadLocale(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  localStorage.setItem("humanos_lang", lang);
  applyI18nToDOM();
}

async function switchLanguage(lang) {
  const nextLang = SUPPORTED_LANGS.includes(lang) ? lang : "en";
  currentLang = nextLang;
  localStorage.setItem("humanos_lang", nextLang);
  window.__i18n = nextLang === "en" ? window.__en : await loadLocale(nextLang);
  document.documentElement.lang = nextLang;
  document.documentElement.dir = nextLang === "ar" ? "rtl" : "ltr";
  applyI18nToDOM();
  if (typeof trackEvent === "function") {
    trackEvent("language_change", { lang: nextLang });
  }
  const picker = document.getElementById("lang-picker");
  if (picker) picker.hidden = true;

  // Refresh dynamic view if open
  if (window.currentViewId === "view-category" && typeof window.navigateToCategory === "function" && window.currentCategoryId) {
    window.navigateToCategory(window.currentCategoryId);
  } else if (window.currentViewId === "view-article" && typeof window.navigateToArticle === "function" && window.currentArticleId) {
    window.navigateToArticle(window.currentArticleId);
  }
}

window.initI18n = initI18n;
window.t = t;
window.switchLanguage = switchLanguage;
window.applyI18nToDOM = applyI18nToDOM;
