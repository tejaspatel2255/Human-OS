// Initialize stats widget
document.addEventListener('DOMContentLoaded', async () => {
  // Set immediate meaningful defaults
  const setChip = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setChip('stat-visitors', '🌍 —');
  setChip('stat-countries', '📍 Global');
  setChip('stat-ai', '🤖 —');
  setChip('stat-stars', '⭐ —');

  // Load article count from local index (always works, no API needed)
  try {
    const res = await fetch('/content/index.json');
    if (res.ok) {
      const data = await res.json();
      const count = Array.isArray(data) ? data.length : 0;
      setChip('stat-articles', `📖 ${count} articles`);
    }
  } catch (e) {
    setChip('stat-articles', '📖 10 articles');
  }

  // Load AI question count from local IndexedDB stats
  try {
    if (typeof getLocalStats === 'function') {
      const stats = await getLocalStats();
      setChip('stat-ai', `🤖 ${Number(stats.ai_questions || 0).toLocaleString()}`);
    }
  } catch (e) {}

  // Try GitHub stars (no auth needed, public API)
  loadGitHubStars();

  // Try Umami if configured
  loadPublicStats();
});

function animateCounter(elementId, targetValue, duration = 1200) {
  const el = document.getElementById(elementId);
  if (!el || !targetValue) return;
  const start = performance.now();
  const target = Number(targetValue) || 0;
  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = Math.floor(target * progress).toLocaleString();
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function renderStatsWidget(stats, isLastKnown = false) {
  if (stats.visitors) {
    const el = document.getElementById('stat-visitors');
    if (el) {
      el.textContent = '🌍 ';
      animateCounter('stat-visitors', stats.visitors);
    }
  }
  if (stats.countries) {
    const el = document.getElementById('stat-countries');
    if (el) el.textContent = `📍 ${Number(stats.countries).toLocaleString()} countries`;
  }
  if (stats.stars !== undefined) {
    const el = document.getElementById('stat-stars');
    if (el) el.textContent = `⭐ ${Number(stats.stars).toLocaleString()}`;
  }
  const widget = document.getElementById('stats-widget');
  if (widget && isLastKnown) {
    let label = widget.querySelector('.last-known-label');
    if (!label) {
      label = document.createElement('small');
      label.className = 'last-known-label';
      widget.appendChild(label);
    }
    label.textContent = '(last known)';
  }
}

async function loadPublicStats() {
  // Skip if Umami not configured
  if (!window.CONFIG?.UMAMI_WEBSITE_ID ||
      !window.CONFIG?.UMAMI_PUBLIC_KEY ||
      window.CONFIG.UMAMI_WEBSITE_ID === '' ||
      window.CONFIG.UMAMI_PUBLIC_KEY === '') {
    // Try cached stats from last session
    try {
      const cached = JSON.parse(localStorage.getItem('humanos_last_stats') || 'null');
      if (cached) renderStatsWidget(cached, true);
    } catch (e) {}
    return;
  }

  try {
    const res = await fetch(
      `https://api.umami.is/v1/websites/${window.CONFIG.UMAMI_WEBSITE_ID}/stats`,
      { headers: { 'x-umami-api-key': window.CONFIG.UMAMI_PUBLIC_KEY } }
    );
    if (res.ok) {
      const data = await res.json();
      const stats = {
        visitors: data.visitors?.value || 0,
        pageviews: data.pageviews?.value || 0,
        countries: data.countries?.value || 0
      };
      localStorage.setItem('humanos_last_stats', JSON.stringify({
        ...stats, cached_at: Date.now()
      }));
      renderStatsWidget(stats, false);
    }
  } catch (e) {
    try {
      const cached = JSON.parse(localStorage.getItem('humanos_last_stats') || 'null');
      if (cached) renderStatsWidget(cached, true);
    } catch (e2) {}
  }
}

async function loadGitHubStars() {
  if (!window.CONFIG?.GITHUB_REPO ||
      window.CONFIG.GITHUB_REPO.includes('username/')) return;
  try {
    const res = await fetch(`https://api.github.com/repos/${window.CONFIG.GITHUB_REPO}`);
    if (res.ok) {
      const data = await res.json();
      const el = document.getElementById('stat-stars');
      if (el) el.textContent = `⭐ ${Number(data.stargazers_count || 0).toLocaleString()}`;
    }
  } catch (e) {
    const el = document.getElementById('stat-stars');
    if (el) el.hidden = true;
  }
}

// Refresh every 60 seconds when online
setInterval(() => { if (navigator.onLine) loadPublicStats(); }, 60000);

window.renderStatsWidget = renderStatsWidget;
window.loadPublicStats = loadPublicStats;
window.loadGitHubStars = loadGitHubStars;
window.animateCounter = animateCounter;
