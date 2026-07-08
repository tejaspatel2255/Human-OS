let searchIndex = null;
let searchArticlesById = new Map();
let searchTagSuggestions = [];
let searchInitPromise = null;

function stripHtml(text) {
  return String(text || "").replace(/<[^>]*>/g, " ");
}

function normalizeArticleForIndex(article) {
  const sections = Array.isArray(article.sections) ? article.sections : [];
  const body = sections
    .map((section) => stripHtml(section.body || section.text || ""))
    .join(" ");
  return {
    id: article.id,
    title: article.title || "",
    tags: Array.isArray(article.tags) ? article.tags.join(" ") : "",
    summary: article.summary || "",
    body,
    category: article.category || "",
    difficulty: article.difficulty || "",
    priority: article.priority || ""
  };
}

async function loadArticlesForSearch() {
  const cached = await getAllArticles();
  if (cached && cached.length) return cached;
  const response = await fetch("/content/index.json");
  if (!response.ok) return [];
  const data = await response.json();
  const articles = Array.isArray(data.articles) ? data.articles : Array.isArray(data) ? data : [];
  for (const article of articles) {
    await saveArticle(article);
  }
  return articles;
}

function buildSearchSuggestions(articles) {
  const counts = new Map();
  for (const article of articles) {
    for (const tag of article.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  searchTagSuggestions = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);
}

async function initSearch() {
  if (searchInitPromise) return searchInitPromise;
  searchInitPromise = (async () => {
    const articles = await loadArticlesForSearch();
    searchArticlesById = new Map(articles.map((article) => [article.id, article]));
    buildSearchSuggestions(articles);

    if (typeof lunr === "undefined") {
      return;
    }

    searchIndex = lunr(function () {
      this.ref("id");
      this.field("title", { boost: 10 });
      this.field("tags", { boost: 5 });
      this.field("summary", { boost: 3 });
      this.field("body", { boost: 1 });

      for (const article of articles) {
        this.add(normalizeArticleForIndex(article));
      }
    });

    try {
      localStorage.setItem("humanos_search_idx", JSON.stringify(searchIndex));
    } catch (error) {
      // Ignore storage failures.
    }

    initSearchInput();
  })();
  return searchInitPromise;
}

function doSearch(query, filters = {}) {
  const searchQuery = String(query || "").trim();
  if (!searchQuery || !searchIndex) return [];

  let rawResults = [];
  try {
    const terms = searchQuery.split(/\s+/).filter(Boolean);
    const queryOptions = searchQuery.length > 5 ? { editDistance: 1 } : {};
    rawResults = searchIndex.search(
      terms.map((term) => `${term}${queryOptions.editDistance ? "~1" : ""}`).join(" ")
    );
  } catch (error) {
    rawResults = [];
  }

  const mapped = rawResults
    .map((result) => {
      const article = searchArticlesById.get(result.ref);
      if (!article) return null;
      return { article, score: result.score };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const priorityRank = { critical: 0, important: 1, useful: 2 };
      const aRank = priorityRank[a.article.priority] ?? 99;
      const bRank = priorityRank[b.article.priority] ?? 99;
      if (aRank !== bRank) return aRank - bRank;
      return b.score - a.score;
    })
    .map((entry) => entry.article);

  return mapped.filter((article) => {
    if (filters.category && article.category !== filters.category) return false;
    if (filters.difficulty && article.difficulty !== filters.difficulty) return false;
    if (filters.priority && article.priority !== filters.priority) return false;
    return true;
  });
}

function renderSearchResults(articles) {
  const container = document.getElementById("search-results");
  if (!container) return;
  container.innerHTML = "";

  if (!articles || !articles.length) {
    const noResultsText = typeof t === "function" ? t("no_results") : "No results found";
    container.innerHTML = `<p>${noResultsText}</p>`;
    return;
  }

  for (const article of articles) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "result-card";
    card.setAttribute("role", "listitem");
    card.addEventListener("click", () => navigateToArticle(article.id));

    const summary = String(article.summary || "").slice(0, 120);
    const tags = (article.tags || []).slice(0, 3);
    const categoryBadge = document.createElement("div");
    categoryBadge.className = "result-card__badge";
    categoryBadge.textContent = article.category || "general";

    const priorityBadge = document.createElement("div");
    priorityBadge.className = `priority-badge priority-badge--${article.priority || "useful"}`;
    priorityBadge.textContent = article.priority || "useful";

    const title = document.createElement("div");
    title.className = "result-card__title";
    title.textContent = article.title || "";

    const summaryEl = document.createElement("div");
    summaryEl.className = "result-card__summary";
    summaryEl.textContent = summary;

    const tagsRow = document.createElement("div");
    tagsRow.style.display = "flex";
    tagsRow.style.flexWrap = "wrap";
    tagsRow.style.gap = "0.375rem";
    tagsRow.style.marginTop = "0.625rem";
    for (const tag of tags) {
      const pill = document.createElement("span");
      pill.className = "result-card__badge";
      pill.textContent = tag;
      tagsRow.appendChild(pill);
    }

    card.appendChild(categoryBadge);
    card.appendChild(priorityBadge);
    card.appendChild(title);
    card.appendChild(summaryEl);
    card.appendChild(tagsRow);
    container.appendChild(card);
  }
}

function saveSearchHistory(query) {
  const entry = String(query || "").trim();
  if (!entry) return;
  const history = JSON.parse(localStorage.getItem("humanos_history") || "[]");
  const next = [entry, ...history.filter((item) => item !== entry)].slice(0, 10);
  localStorage.setItem("humanos_history", JSON.stringify(next));
}

function getSearchSuggestions() {
  return searchTagSuggestions.slice(0, 10);
}

function renderSearchHistory() {
  const container = document.getElementById("search-history");
  if (!container) return;
  const history = JSON.parse(localStorage.getItem("humanos_history") || "[]").slice(0, 5);
  container.innerHTML = "";
  if (!history.length) return;
  history.forEach((item) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "filter-chip";
    pill.textContent = item;
    pill.addEventListener("click", () => {
      const input = document.getElementById("search-input");
      if (input) {
        input.value = item;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    container.appendChild(pill);
  });
}

function renderSuggestions() {
  const container = document.getElementById("search-suggestions");
  if (!container) return;
  const suggestions = getSearchSuggestions();
  container.innerHTML = "";
  suggestions.forEach((suggestion) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "filter-chip";
    pill.textContent = suggestion;
    pill.addEventListener("click", () => {
      const input = document.getElementById("search-input");
      if (input) {
        input.value = suggestion;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    container.appendChild(pill);
  });
}

function initSearchInput() {
  const input = document.getElementById("search-input");
  if (!input || input.dataset.bound === "true") return;
  input.dataset.bound = "true";

  let debounceTimer = null;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const query = input.value.trim();
      if (query.length >= 2) {
        saveSearchHistory(query);
        const results = doSearch(query);
        showView("view-search");
        renderSearchResults(results);
        if (typeof trackEvent === "function") {
          trackEvent("search", { query });
        }
      } else if (!query) {
        showView("view-home");
      }
    }, 300);
  });

  input.addEventListener("focus", () => {
    renderSearchHistory();
    renderSuggestions();
  });
}

window.initSearch = initSearch;
window.doSearch = doSearch;
window.renderSearchResults = renderSearchResults;
window.initSearchInput = initSearchInput;
window.getSearchSuggestions = getSearchSuggestions;
