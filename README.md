# HumanOS 🌍

Survival knowledge for every human on Earth

## What is HumanOS?

HumanOS is a free, offline-first Progressive Web App that puts critical survival knowledge in anyone’s pocket. It is designed for medicine, water, food, shelter, communication, sanitation, and mental health guidance, and it keeps working after the first load even on low-cost phones and unreliable connections.

This project exists for people who may need life-saving information when the internet is unavailable, expensive, censored, slow, or dangerous to rely on. HumanOS is built to be free forever: static hosting, free public services, no accounts, no cookies, and no backend required.

## Live Demo

🔗 [humanos.earth](https://humanos.earth)

## App Preview

```text
┌──────────────────────────────────────┐
│ 🌍 HumanOS      ● Offline    ⚙️ 🌓 Aa │
├──────────────────────────────────────┤
│ 🆘 EMERGENCY FIRST AID               │
├──────────────────────────────────────┤
│ 📊  people helped  countries  AI      │
│ 🔎 Search survival guides...         │
│ [Emergency] [Medicine] [Water] ...   │
│                                      │
│ 🧠 Your stats...                     │
│                                      │
│ [📥 Download All for Offline]        │
└──────────────────────────────────────┘
                    🤖
```

## Features

- Works 100% offline after first load.
- Uses static files only, with no backend server.
- Supports eight languages with local JSON translations.
- Caches survival articles in IndexedDB for fast offline reading.
- Includes full-text search with Lunr.js.
- Offers an OpenRouter-powered AI helper with offline cached answers.
- Shows cookieless analytics with Umami and GoatCounter.
- Supports bookmarks, reading history, and personal stats.
- Includes accessibility features like skip links and keyboard-friendly controls.
- Ships as a PWA with installability, shortcuts, manifest, and service worker.

## Zero-Cost Stack

| Tool | Purpose | Cost |
|---|---|---|
| GitHub Pages | Static hosting | Free |
| GitHub Actions | CI/CD and Lighthouse checks | Free |
| Cloudflare Free Tier | Optional CDN / DNS | Free |
| OpenRouter | Free AI models | Free |
| Umami Cloud | Cookieless analytics | Free |
| GoatCounter | Privacy-first analytics | Free |
| IndexedDB | Offline content, cache, and stats | Free |
| Lunr.js CDN | Offline search library | Free |

## Setup in 5 Steps

1. Fork this repo on GitHub.
2. Copy `config.example.js` to `config.js` locally.
3. Get a free OpenRouter key at [openrouter.ai](https://openrouter.ai), a Umami website ID/public key at [umami.is](https://umami.is), and a GoatCounter code at [goatcounter.com](https://goatcounter.com).
4. Edit `config.js` with your keys (your `config.js` is automatically ignored by git and won't leak your keys).
5. Push to your repo and enable GitHub Pages on `main` to go live instantly.

## config.js Keys

| Key | Where to get it | What it does |
|---|---|---|
| `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai) | Authenticates AI requests to the free AI models. |
| `UMAMI_WEBSITE_ID` | [umami.is](https://umami.is) | Identifies your website for public stats. |
| `UMAMI_PUBLIC_KEY` | [umami.is](https://umami.is) | Read-only key for fetching public Umami stats. |
| `GOATCOUNTER_CODE` | [goatcounter.com](https://goatcounter.com) | Your GoatCounter subdomain code for analytics. |
| `GITHUB_REPO` | Your repo name | Used to fetch GitHub star counts (e.g., `yourusername/humanos`). |

## AI Model Fallback Chain

HumanOS tries four free OpenRouter models in this exact order:

`groq/llama-3.3-70b` → `google/gemini-flash-1.5:free` → `meta-llama/llama-3.3-70b-instruct:free` → `mistralai/mistral-7b-instruct:free`

The app uses the first model that responds successfully. If a model returns `429` or `503`, HumanOS moves to the next model. If a request times out or the network fails, it also continues to the next model. If every model fails, HumanOS falls back to a cached answer when available, and otherwise shows an offline guidance message.

## Adding Content

HumanOS articles follow this schema:

```json
{
  "id": "example-id",
  "category": "medicine",
  "title": "Example Title",
  "priority": "critical",
  "offline": true,
  "last_updated": "2026-06-11",
  "tags": ["tag-one", "tag-two"],
  "summary": "One sentence summary.",
  "sections": [
    {
      "heading": "Step 1 — Heading",
      "body": "At least three sentences of factual content.",
      "warning": "Optional warning text.",
      "image_description": "Text description of a diagram."
    }
  ],
  "when_to_use": "Situation description",
  "do_not": ["Avoid this", "Avoid that"],
  "sources": ["WHO source, year"],
  "difficulty": "beginner"
}
```

To add a new article, create a new JSON file in the correct content folder, add it to `content/index.json`, and submit a pull request. Keep the language factual, concise, and aligned with WHO or Red Cross guidance.

## Adding a Language

1. Copy `locales/en.json`.
2. Translate all values into the new language.
3. Save it as a new locale file.
4. Submit a pull request.

Supported languages:

- English
- Español
- Français
- हिंदी
- العربية
- 中文
- Português
- Kiswahili

## Analytics & Privacy

HumanOS tracks only anonymous usage signals such as page views, article reads, and AI questions. It does not track identity, location, personal profiles, or cookies.

The analytics stack uses Umami for cookieless stats and GoatCounter for privacy-first event counting. All queues are stored locally when offline and flushed later when the device comes back online.

## Contributing

Fork the repository, create a branch, make your changes, and open a pull request. Keep commits small and descriptive, prefer plain JavaScript and static assets, and match the existing offline-first structure.

## License

MIT — free to use, modify, distribute.

## Disclaimer

This app provides general survival information for educational purposes only. Always seek professional medical or emergency services when available. The authors are not liable for outcomes resulting from use of this information.
