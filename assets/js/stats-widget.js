async function animateCounter(elementId, targetValue, duration = 1200) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = performance.now();
  const from = 0;
  const target = Number(targetValue) || 0;

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const value = Math.floor(from + (target - from) * progress);
    el.textContent = value.toLocaleString();
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function renderStatsWidget(stats, isLastKnown = false) {
  const visitors = document.getElementById("stat-visitors");
  const countries = document.getElementById("stat-countries");
  const articles = document.getElementById("stat-articles");
  const ai = document.getElementById("stat-ai");
  const stars = document.getElementById("stat-stars");
  if (visitors) {
    visitors.textContent = "🌍 ";
    animateCounter("stat-visitors", stats.visitors || 0);
  }
  if (countries) countries.textContent = `📍 ${Number(stats.countries || 0).toLocaleString()} countries`;
  if (articles) {
    if (stats.articles) {
      articles.textContent = `📖 ${Number(stats.articles).toLocaleString()} articles`;
    } else {
      // Populate from local content index
      fetch("/content/index.json")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data && Array.isArray(data.articles)) {
            articles.textContent = `📖 ${data.articles.length} articles`;
          }
        })
        .catch(() => {});
    }
  }
  if (ai) {
    getLocalStats().then((localStats) => {
      ai.textContent = `🤖 ${Number(localStats.ai_questions || 0).toLocaleString()}`;
    });
  }
  if (stars && typeof stats.stars !== "undefined") {
    stars.textContent = `⭐ ${Number(stats.stars || 0).toLocaleString()}`;
    stars.hidden = false;
  }
  const widget = document.getElementById("stats-widget");
  if (widget) {
    const label = widget.querySelector(".last-known-label") || document.createElement("small");
    label.className = "last-known-label";
    label.textContent = isLastKnown ? "(last known)" : "";
    if (!label.parentNode) widget.appendChild(label);
  }
}

async function loadPublicStats() {
  const umamiId = window.CONFIG && window.CONFIG.UMAMI_WEBSITE_ID;
  const umamiKey = window.CONFIG && window.CONFIG.UMAMI_PUBLIC_KEY;
  if (!umamiId || !umamiKey || umamiId.includes("PLACEHOLDER") || umamiId.includes("YOUR_")) {
    const cached = JSON.parse(localStorage.getItem("humanos_last_stats") || "null");
    if (cached) {
      renderStatsWidget(cached, true);
    }
    return;
  }

  try {
    const res = await fetch(`https://api.umami.is/v1/websites/${umamiId}/stats`, {
      headers: {
        "x-umami-api-key": umamiKey
      }
    });
    if (res.ok) {
      const data = await res.json();
      const stats = {
        visitors: data.visitors?.value || 0,
        pageviews: data.pageviews?.value || 0,
        countries: data.countries?.value || 0
      };
      localStorage.setItem("humanos_last_stats", JSON.stringify({
        ...stats,
        cached_at: Date.now()
      }));
      renderStatsWidget(stats, false);
      return;
    }
  } catch (error) {
    // fall through to cache
  }

  const cached = JSON.parse(localStorage.getItem("humanos_last_stats") || "null");
  if (cached) {
    renderStatsWidget(cached, true);
  }
}

async function loadGitHubStars() {
  const repo = (window.CONFIG && window.CONFIG.GITHUB_REPO) || "tejaspatel2255/Human-OS";
  if (!repo || repo.includes("username/")) {
    const stars = document.getElementById("stat-stars");
    if (stars) stars.hidden = true;
    return;
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`);
    if (res.ok) {
      const data = await res.json();
      const stars = document.getElementById("stat-stars");
      if (stars) stars.textContent = `⭐ ${Number(data.stargazers_count || 0).toLocaleString()}`;
      return;
    }
  } catch (error) {
    // hide silently
  }
  const stars = document.getElementById("stat-stars");
  if (stars) stars.hidden = true;
}

setInterval(() => {
  if (navigator.onLine) loadPublicStats();
}, 60000);

window.animateCounter = animateCounter;
window.renderStatsWidget = renderStatsWidget;
window.loadPublicStats = loadPublicStats;
window.loadGitHubStars = loadGitHubStars;
