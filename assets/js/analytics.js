const STAT_FIELD_MAP = {
  article_read: "articles_read",
  ai_question: "ai_questions",
  offline_use: "offline_sessions",
  bookmark_add: "bookmarks_saved",
  search: "searches_run"
};

function queueGoatCounterEvent(eventName) {
  if (navigator.onLine) {
    const code = (window.CONFIG && window.CONFIG.GOATCOUNTER_CODE) || "";
    if (code) {
      const img = new Image();
      img.src = `https://${code}.goatcounter.com/count?p=/` + encodeURIComponent(eventName);
    }
    return;
  }
  if (typeof queueAnalyticsEvent === "function") {
    queueAnalyticsEvent({ type: "goatcounter", event: eventName });
  }
}

function trackEvent(name, data = {}) {
  if (typeof window.umami !== "undefined" && window.umami && typeof window.umami.track === "function") {
    window.umami.track(name, data);
  }
  const field = STAT_FIELD_MAP[name];
  if (field && typeof updateLocalStats === "function") {
    updateLocalStats(field);
  }
  queueGoatCounterEvent(name);
}

async function flushAnalyticsQueue() {
  if (typeof getAllQueuedEvents !== "function") return;
  const queued = await getAllQueuedEvents();
  if (!queued.length) return;
  for (const event of queued) {
    if (event.type === "goatcounter") {
      if (navigator.onLine) {
        const code = (window.CONFIG && window.CONFIG.GOATCOUNTER_CODE) || "";
        if (code) {
          const img = new Image();
          img.src = `https://${code}.goatcounter.com/count?p=/` + encodeURIComponent(event.event);
        }
      }
    }
    if (event.type === "umami" && window.umami && typeof window.umami.track === "function") {
      window.umami.track(event.name, event.data);
    }
  }
  await clearAnalyticsQueue();
}

window.trackEvent = trackEvent;
window.queueGoatCounterEvent = queueGoatCounterEvent;
window.flushAnalyticsQueue = flushAnalyticsQueue;

window.addEventListener("online", flushAnalyticsQueue);
