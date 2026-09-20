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

/** 详细结果：既能返正文，也能带排错信息（供"测试连接"和调试用） */
export interface AIResult {
  text: string | null;
  /** 失败时的人话解释；成功时空 */
  error?: string;
  /** HTTP 状态；网络/CORS 失败时为 0 */
  status?: number;
  /** 实际请求的 URL —— 帮助定位是不是拼错了 */
  url?: string;
  /** 响应体前 400 字（供看厂商返回的详细报错） */
  snippet?: string;
}

/** Gemini 系列候选模型 —— 用户没指定时的 fallback 顺序 */
const GEMINI_CANDIDATES = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"];
const DEEPSEEK_DEFAULT_BASE = "https://api.deepseek.com";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";

function briefBody(body: string, limit = 400): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  return cleaned.length > limit ? cleaned.slice(0, limit) + "…" : cleaned;
}

async function extractSnippet(res: Response): Promise<string> {
  try { return briefBody(await res.text()); } catch { return ""; }
}

/** 调用 Gemini —— 走 REST API：POST /v1beta/models/{model}:generateContent?key={apiKey} */
async function callGeminiVerbose(prompt: string, isJson: boolean, apiKey: string, customModel?: string): Promise<AIResult> {
  const modelsToTry = customModel ? [customModel, ...GEMINI_CANDIDATES] : GEMINI_CANDIDATES;
  let last: AIResult = { text: null };
  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const body: Record<string, unknown> = { contents: [{ parts: [{ text: prompt }] }] };
      if (isJson) body.generationConfig = { responseMimeType: "application/json" };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const snippet = await extractSnippet(res);
        last = {
          text: null,
          status: res.status,
          url,
          snippet,
          error: `Gemini ${model} → HTTP ${res.status}`,
        };
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === "string" && text.trim()) {
        return { text, status: 200, url };
      }
      last = {
        text: null,
        status: 200,
        url,
        snippet: briefBody(JSON.stringify(data)),
        error: `Gemini ${model} 返回 200 但 candidates[0].content.parts[0].text 为空`,
      };
    } catch (err) {
      last = {
        text: null,
        status: 0,
        url,
        error: `Gemini ${model} 网络/CORS 失败：${err instanceof Error ? err.message : String(err)}（国内可能需要代理）`,
      };
    }
  }
  return last;
}

/** 调用一切 OpenAI 兼容端点 —— 返回详细结果 */
async function callOpenAICompatibleVerbose(
  prompt: string,
  isJson: boolean,
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<AIResult> {
  const cleanedBase = (baseUrl || "").replace(/\/+$/, "");
  if (!cleanedBase) return { text: null, error: "baseUrl 为空。" };
  // 用户填 `.../v1` 会拼成 `.../v1/chat/completions`；用户填 `.../v1/` 也 OK。
  // 但如果用户已经把 `/chat/completions` 手动带上，避免重复。
  const url = /\/chat\/completions\/?$/.test(cleanedBase)
    ? cleanedBase.replace(/\/+$/, "")
    : `${cleanedBase}/chat/completions`;

  const bodyPayload: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.9,
    max_tokens: 800,
  };
  if (isJson) bodyPayload.response_format = { type: "json_object" };

  const doFetch = async () => await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(bodyPayload),
  });

  try {
    let res = await doFetch();

    // 若中转不支持 response_format，去掉重试一次
    if (!res.ok && isJson) {
      delete bodyPayload.response_format;
      res = await doFetch();
    }

    if (!res.ok) {
      const snippet = await extractSnippet(res);
      return {
        text: null,
        status: res.status,
        url,
        snippet,
        error: res.status === 401 ? `API Key 无效或格式不对（HTTP 401）。`
             : res.status === 402 ? `账户余额不足或未开通（HTTP 402）。`
             : res.status === 403 ? `无访问权限（HTTP 403）——可能模型未开通或 IP 被拒。`
             : res.status === 404 ? `URL 不存在（HTTP 404）——baseUrl 或 model 拼写错了。目标：${url}`
             : res.status === 429 ? `触发速率限制（HTTP 429）——短时间请求太多或超出额度。`
             : `HTTP ${res.status}`,
      };
    }

    let data: unknown;
    let rawText = "";
    try {
      rawText = await res.text();
      data = JSON.parse(rawText);
    } catch {
      return { text: null, status: res.status, url, snippet: briefBody(rawText), error: "返回不是合法 JSON。" };
    }
    const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim()) {
      return { text: content, status: res.status, url };
    }
    return {
      text: null,
      status: res.status,
      url,
      snippet: briefBody(rawText),
      error: "返回 200 但 choices[0].message.content 为空。请确认模型名是否正确，或换个模型。",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // 浏览器 fetch 网络失败 / CORS 拦截通常会给 "Failed to fetch" / TypeError
    const isCors = /fetch|cors|network|failed/i.test(message);
    return {
      text: null,
      status: 0,
      url,
      error: isCors
        ? `无法连接（很可能是 CORS 被拦或 baseUrl 无法访问）。目标 URL：${url}。原始错误：${message}`
        : `请求出错：${message}`,
    };
  }
}

/** 详细版：给"测试连接"和排错用 */
export async function callAIVerbose(params: RouteParams): Promise<AIResult> {
  const { prompt, isJson = true, provider, apiKey, baseUrl, model } = params;
  if (!apiKey || !apiKey.trim()) {
    return { text: null, error: "没有填 API Key。" };
  }

  if (provider === "gemini") {
    return callGeminiVerbose(prompt, isJson, apiKey.trim(), model);
  }
  if (provider === "deepseek") {
    return callOpenAICompatibleVerbose(
      prompt,
      isJson,
      apiKey.trim(),
      baseUrl && baseUrl.trim() ? baseUrl.trim() : DEEPSEEK_DEFAULT_BASE,
      model || DEEPSEEK_DEFAULT_MODEL,
    );
  }
  // openai_compatible
  if (!baseUrl || !baseUrl.trim()) return { text: null, error: "OpenAI 兼容模式需要填 baseUrl（如 https://api.openai.com/v1）。" };
  if (!model) return { text: null, error: "OpenAI 兼容模式需要填模型名（如 gpt-4o-mini）。" };
  return callOpenAICompatibleVerbose(prompt, isJson, apiKey.trim(), baseUrl.trim(), model);
}

/** 兼容旧签名：只要正文文本；调用点太多不改。 */
export async function callAI(params: RouteParams): Promise<string | null> {
  const result = await callAIVerbose(params);
  return result.text;
}
