const GEMINI_MODEL = "gemini-2.0-flash";
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash-lite";

function geminiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "placeholder") return null;
  return key;
}

function openRouterKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key === "placeholder") return null;
  return key;
}

async function geminiGenerate(parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }>): Promise<string | null> {
  const apiKey = geminiKey();
  if (!apiKey) return null;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function openRouterGenerate(
  messages: Array<{
    role: "user";
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }>
): Promise<string | null> {
  const apiKey = openRouterKey();
  if (!apiKey) return null;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_REFERRER ?? "http://localhost:3000",
      "X-Title": "voxly-v2-local",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}${errText ? `: ${errText.slice(0, 120)}` : ""}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

/** Text completion: Gemini first, OpenRouter fallback. */
export async function completeText(
  prompt: string
): Promise<{ text: string; provider: "gemini" | "openrouter" } | null> {
  if (geminiKey()) {
    try {
      const text = await geminiGenerate([{ text: prompt }]);
      if (text) {
        console.log("[LLM] Text via Gemini");
        return { text, provider: "gemini" };
      }
    } catch (err) {
      console.warn("[LLM] Gemini text failed, trying OpenRouter:", err);
    }
  }

  if (openRouterKey()) {
    try {
      const text = await openRouterGenerate([{ role: "user", content: prompt }]);
      if (text) {
        console.log("[LLM] Text via OpenRouter");
        return { text, provider: "openrouter" };
      }
    } catch (err) {
      console.warn("[LLM] OpenRouter text failed:", err);
    }
  }

  return null;
}

/** Vision completion: Gemini first, OpenRouter fallback. */
export async function completeVision(
  prompt: string,
  imageBase64: string,
  mimeType = "image/jpeg"
): Promise<{ text: string; provider: "gemini" | "openrouter" } | null> {
  if (geminiKey()) {
    try {
      const text = await geminiGenerate([
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
      ]);
      if (text) {
        console.log("[LLM] Vision via Gemini");
        return { text, provider: "gemini" };
      }
    } catch (err) {
      console.warn("[LLM] Gemini vision failed, trying OpenRouter:", err);
    }
  }

  if (openRouterKey()) {
    try {
      const text = await openRouterGenerate([
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ]);
      if (text) {
        console.log("[LLM] Vision via OpenRouter");
        return { text, provider: "openrouter" };
      }
    } catch (err) {
      console.warn("[LLM] OpenRouter vision failed:", err);
    }
  }

  return null;
}

export function hasLlmProvider(): boolean {
  return Boolean(geminiKey() || openRouterKey());
}
