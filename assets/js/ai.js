const AI_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const AI_MODELS = [
  "groq/llama-3.3-70b",
  "google/gemini-flash-1.5:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-7b-instruct:free"
];

const SYSTEM_PROMPT = "You are HumanOS, a survival knowledge assistant.\nAnswer ONLY about: medicine, water, food, shelter, energy,\nsanitation, communication, mental health, emergency survival.\nKeep answers factual, cite WHO/Red Cross sources where relevant.\nFormat answers as simple numbered steps. Maximum 300 words.\nIf asked about anything unrelated to survival, politely decline.";

async function askAI(userQuestion, category) {
  if (!window.CONFIG?.OPENROUTER_API_KEY || window.CONFIG.OPENROUTER_API_KEY === "" || window.CONFIG.OPENROUTER_API_KEY.includes("YOUR_")) {
    return { answer: "AI is not configured. Add your OpenRouter key to config.js", model: "none" };
  }
  const apiKey = window.CONFIG.OPENROUTER_API_KEY;
  const useServerProxy = false;

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

  return {
    answer: "You are offline and no cached answer exists. Please browse the static guides below.",
    model: "none",
    fromCache: false
  };
}

function getModelDisplayName(modelString) {
  switch (modelString) {
    case "groq/llama-3.3-70b":
      return "Groq Llama 3.3";
    case "google/gemini-flash-1.5:free":
      return "Gemini Flash";
    case "meta-llama/llama-3.3-70b-instruct:free":
      return "Llama 3.3";
    case "mistralai/mistral-7b-instruct:free":
      return "Mistral 7B";
    case "cache":
      return "Cached Answer";
    default:
      return "AI";
  }
}

window.askAI = askAI;
window.getModelDisplayName = getModelDisplayName;
