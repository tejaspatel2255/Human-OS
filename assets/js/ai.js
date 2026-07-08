const AI_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const AI_MODELS = [
  "openrouter/free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "google/gemma-4-31b-it:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
  "qwen/qwen3-coder:free"
];

const SYSTEM_PROMPT = "You are HumanOS, a survival knowledge assistant.\nAnswer ONLY about: medicine, water, food, shelter, energy,\nsanitation, communication, mental health, emergency survival.\nKeep answers factual, cite WHO/Red Cross sources where relevant.\nFormat answers as simple numbered steps. Maximum 300 words.\nIf asked about anything unrelated to survival, politely decline.";

async function askAI(userQuestion, category) {
  if (!window.CONFIG?.OPENROUTER_API_KEY || window.CONFIG.OPENROUTER_API_KEY === "" || window.CONFIG.OPENROUTER_API_KEY.includes("YOUR_")) {
    return { answer: "AI is not configured. Add your OpenRouter key to config.js", model: "none" };
  }
  const apiKey = window.CONFIG.OPENROUTER_API_KEY;
  const useServerProxy = false;
  let hadRateLimit = false;

  for (const model of AI_MODELS) {
    try {
      const controller = AbortSignal.timeout(10000);
      let res;
      if (useServerProxy) {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `[Category: ${category}] ${userQuestion}` }
            ]
          }),
          signal: controller
        });
      } else {
        res = await fetch(AI_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://humanos.earth",
            "X-Title": "HumanOS",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `[Category: ${category}] ${userQuestion}` }
            ],
            max_tokens: 500,
            temperature: 0.3
          }),
          signal: controller
        });
      }

      if (res.ok) {
        const data = await res.json();
        const answer = data?.choices?.[0]?.message?.content || "";
        await cacheAIAnswer(userQuestion, answer, model, category);
        await updateLocalStats("ai_questions");
        console.log("[HumanOS AI] Responded: " + model);
        return { answer, model, fromCache: false };
      }

      if (res.status === 429 || res.status === 503) {
        hadRateLimit = true;
        continue;
      }

      break;
    } catch (error) {
      continue;
    }
  }

  const cached = await getCachedAnswer(userQuestion);
  if (cached) {
    return {
      answer: cached.answer,
      model: cached.model,
      fromCache: true
    };
  }

  const isOnline = typeof navigator !== "undefined" && navigator.onLine;
  const fallbackKey = (hadRateLimit || isOnline) ? "ai_busy" : "ai_offline_fallback";
  const defaultFallback = (hadRateLimit || isOnline)
    ? "AI service is temporarily busy or rate-limited. Please wait a few seconds and try again."
    : "You are offline and no cached answer exists. Please browse the static guides below.";

  const answer = typeof t === "function" ? t(fallbackKey) : defaultFallback;

  return {
    answer,
    model: "none",
    fromCache: false
  };
}

function getModelDisplayName(modelString) {
  switch (modelString) {
    case "openrouter/free":
      return "OpenRouter Auto";
    case "meta-llama/llama-3.3-70b-instruct:free":
      return "Llama 3.3";
    case "meta-llama/llama-3.2-3b-instruct:free":
      return "Llama 3.2";
    case "google/gemma-4-31b-it:free":
      return "Gemma 4";
    case "nousresearch/hermes-3-llama-3.1-405b:free":
      return "Hermes 3";
    case "liquid/lfm-2.5-1.2b-thinking:free":
      return "LFM Thinking";
    case "qwen/qwen3-coder:free":
      return "Qwen 3 Coder";
    case "cache":
      return "Cached Answer";
    default:
      return "AI";
  }
}

window.askAI = askAI;
window.getModelDisplayName = getModelDisplayName;
