const DB_NAME = "humanos-db";
const DB_VERSION = 1;
const SEVEN_DAYS_MS = 604800000;

let dbPromise = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("articles")) {
        const articles = db.createObjectStore("articles", { keyPath: "id" });
        articles.createIndex("category", "category", { unique: false });
        articles.createIndex("priority", "priority", { unique: false });
      }

      if (!db.objectStoreNames.contains("ai_cache")) {
        const aiCache = db.createObjectStore("ai_cache", { keyPath: "hash" });
        aiCache.createIndex("timestamp", "timestamp", { unique: false });
      }

      if (!db.objectStoreNames.contains("local_stats")) {
        db.createObjectStore("local_stats", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("analytics_queue")) {
        db.createObjectStore("analytics_queue", { keyPath: "id", autoIncrement: true });
      }

      if (!db.objectStoreNames.contains("bookmarks")) {
        db.createObjectStore("bookmarks", { keyPath: "articleId" });
      }

      if (!db.objectStoreNames.contains("history")) {
        const history = db.createObjectStore("history", { keyPath: "articleId" });
        history.createIndex("visitedAt", "visitedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, handler) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = handler(store, tx);

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getAllFromStore(storeName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function sha256(text) {
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function defaultStats() {
  return {
    id: "stats",
    sessions: 0,
    articles_read: 0,
    ai_questions: 0,
    offline_sessions: 0,
    bookmarks_saved: 0,
    searches_run: 0,
    first_visit: Date.now(),
    last_synced: null
  };
}

async function initDB() {
  if (!dbPromise) {
    dbPromise = openDatabase();
  }
  return dbPromise;
}

async function saveArticle(article) {
  return withStore("articles", "readwrite", (store) => store.put(article));
}

async function getArticle(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("articles", "readonly");
    const store = tx.objectStore("articles");
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function getAllArticles() {
  return getAllFromStore("articles");
}

async function getArticlesByCategory(category) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("articles", "readonly");
    const store = tx.objectStore("articles");
    const index = store.index("category");
    const request = index.getAll(category);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function cacheAIAnswer(question, answer, model, category) {
  const hash = await sha256(question);
  const record = {
    hash,
    question,
    answer,
    model,
    category,
    timestamp: Date.now()
  };
  return withStore("ai_cache", "readwrite", (store) => store.put(record));
}

async function getCachedAnswer(question) {
  const hash = await sha256(question);
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("ai_cache", "readonly");
    const store = tx.objectStore("ai_cache");
    const request = store.get(hash);
    request.onsuccess = () => {
      const record = request.result;
      if (!record || Date.now() - record.timestamp > SEVEN_DAYS_MS) {
        resolve(null);
        return;
      }
      resolve(record);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getLocalStats() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("local_stats", "readonly");
    const store = tx.objectStore("local_stats");
    const request = store.get("stats");
    request.onsuccess = () => resolve(request.result || defaultStats());
    request.onerror = () => reject(request.error);
  });
}

async function updateLocalStats(field) {
  const allowed = new Set([
    "sessions",
    "articles_read",
    "ai_questions",
    "offline_sessions",
    "bookmarks_saved",
    "searches_run"
  ]);
  if (!allowed.has(field)) {
    return getLocalStats();
  }
  const stats = await getLocalStats();
  stats[field] = (stats[field] || 0) + 1;
  return withStore("local_stats", "readwrite", (store) => store.put(stats));
}

async function queueAnalyticsEvent(eventObj) {
  const entry = { ...eventObj, ts: Date.now() };
  return withStore("analytics_queue", "readwrite", (store) => store.add(entry));
}

async function getAllQueuedEvents() {
  return getAllFromStore("analytics_queue");
}

async function clearAnalyticsQueue() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("analytics_queue", "readwrite");
    const store = tx.objectStore("analytics_queue");
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function saveBookmark(articleId) {
  await withStore("bookmarks", "readwrite", (store) => store.put({ articleId, savedAt: Date.now() }));
  return updateLocalStats("bookmarks_saved");
}

async function removeBookmark(articleId) {
  return withStore("bookmarks", "readwrite", (store) => store.delete(articleId));
}

async function isBookmarked(articleId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("bookmarks", "readonly");
    const store = tx.objectStore("bookmarks");
    const request = store.get(articleId);
    request.onsuccess = () => resolve(Boolean(request.result));
    request.onerror = () => reject(request.error);
  });
}

async function getBookmarks() {
  const bookmarks = await getAllFromStore("bookmarks");
  return bookmarks.sort((a, b) => b.savedAt - a.savedAt);
}

async function addToHistory(articleId) {
  await withStore("history", "readwrite", (store) => store.put({ articleId, visitedAt: Date.now() }));
  const history = await getHistory();
  const trimmed = history.slice(0, 50);
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("history", "readwrite");
    const store = tx.objectStore("history");
    const clearRequest = store.clear();
    clearRequest.onerror = () => reject(clearRequest.error);
    clearRequest.onsuccess = () => {
      for (const item of trimmed) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function getHistory() {
  const history = await getAllFromStore("history");
  return history.sort((a, b) => b.visitedAt - a.visitedAt);
}

window.initDB = initDB;
window.saveArticle = saveArticle;
window.getArticle = getArticle;
window.getAllArticles = getAllArticles;
window.getArticlesByCategory = getArticlesByCategory;
window.cacheAIAnswer = cacheAIAnswer;
window.getCachedAnswer = getCachedAnswer;
window.getLocalStats = getLocalStats;
window.updateLocalStats = updateLocalStats;
window.queueAnalyticsEvent = queueAnalyticsEvent;
window.getAllQueuedEvents = getAllQueuedEvents;
window.clearAnalyticsQueue = clearAnalyticsQueue;
window.saveBookmark = saveBookmark;
window.removeBookmark = removeBookmark;
window.isBookmarked = isBookmarked;
window.getBookmarks = getBookmarks;
window.addToHistory = addToHistory;
window.getHistory = getHistory;

initDB();
