// 浏览器直调 AI —— 三家 provider 通吃，纯前端零后端
// 玩家 API Key 只在本机 localStorage，请求从玩家浏览器直发到 AI 厂商，中间没有你的服务器
//
// 三家的 CORS 情况：
//   Gemini (generativelanguage.googleapis.com) —— 官方支持浏览器直调
//   DeepSeek (api.deepseek.com)                —— 官方支持 CORS
//   一切 OpenAI 兼容中转                        —— 大多数中转允许 CORS；少数不允许时会浏览器报错

import type { ApiProvider } from "../types";

interface RouteParams {
  prompt: string;
  isJson?: boolean;
  provider: ApiProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/** Gemini 系列候选模型 —— 用户没指定时的 fallback 顺序 */
const GEMINI_CANDIDATES = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"];
const DEEPSEEK_DEFAULT_BASE = "https://api.deepseek.com";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";

/** 调用 Gemini —— 走 REST API：POST /v1beta/models/{model}:generateContent?key={apiKey} */
async function callGemini(prompt: string, isJson: boolean, apiKey: string, customModel?: string): Promise<string | null> {
  const modelsToTry = customModel ? [customModel, ...GEMINI_CANDIDATES] : GEMINI_CANDIDATES;
  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const body: Record<string, unknown> = {
        contents: [{ parts: [{ text: prompt }] }],
      };
      if (isJson) {
        body.generationConfig = { responseMimeType: "application/json" };
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === "string" && text.trim()) return text;
    } catch {
      continue;
    }
  }
  return null;
}

/** 调用一切 OpenAI 兼容端点：DeepSeek / OpenAI / OneAPI / NewAPI / OpenRouter / 硅基流动 ... */
async function callOpenAICompatible(
  prompt: string,
  isJson: boolean,
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<string | null> {
  const cleanedBase = (baseUrl || "").replace(/\/+$/, "");
  if (!cleanedBase) return null;
  const url = `${cleanedBase}/chat/completions`;

  const bodyPayload: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.9,
    max_tokens: 800,
  };
  if (isJson) {
    bodyPayload.response_format = { type: "json_object" };
  }

  try {
    let res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    // 若中转不支持 response_format，去掉重试
    if (!res.ok && isJson) {
      delete bodyPayload.response_format;
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyPayload),
      });
    }
    if (!res.ok) return null;

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
}

/** 统一入口：根据 provider 分发；返回原始文本（可能是被包裹的 JSON） */
export async function callAI(params: RouteParams): Promise<string | null> {
  const { prompt, isJson = true, provider, apiKey, baseUrl, model } = params;
  if (!apiKey || !apiKey.trim()) return null;

  if (provider === "gemini") {
    return callGemini(prompt, isJson, apiKey.trim(), model);
  }
  if (provider === "deepseek") {
    return callOpenAICompatible(
      prompt,
      isJson,
      apiKey.trim(),
      baseUrl && baseUrl.trim() ? baseUrl.trim() : DEEPSEEK_DEFAULT_BASE,
      model || DEEPSEEK_DEFAULT_MODEL,
    );
  }
  // openai_compatible
  if (!baseUrl || !baseUrl.trim() || !model) return null;
  return callOpenAICompatible(prompt, isJson, apiKey.trim(), baseUrl.trim(), model);
}
