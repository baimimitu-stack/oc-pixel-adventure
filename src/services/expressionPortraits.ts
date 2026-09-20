// AI 返回 expression 后，用它挑一张立绘。
// 命中优先级：exact mood → smile 兜底 → 显式 default portrait → avatar
// 目的：让 UI 显示时永远拿到"最合适的一张图"，从不空白。

import type { ExpressionKey, ExpressionPortraitMap } from "../types";

const EXPRESSION_KEYS: ExpressionKey[] = [
  "smile", "excited", "shy", "surprised", "cool", "happy", "grateful",
];

export function isExpressionKey(value: unknown): value is ExpressionKey {
  return typeof value === "string" && (EXPRESSION_KEYS as string[]).includes(value);
}

/**
 * 挑立绘。参数都可选，找不到就 fallback 到 defaultPortrait，再退到 avatarFallback。
 * @param portraits 表情立绘 map（OC.expressionPortraits 或 NPC.expressionPortraits）
 * @param mood      当前情绪（一般来自 latestMessage.mood；AI 输出）
 * @param defaultPortrait 用户上传的默认立绘（无表情绑定时用这个）
 * @param avatarFallback  再兜底（如 OC 头像）
 */
export function pickPortrait(
  portraits: ExpressionPortraitMap | undefined,
  mood: string | undefined,
  defaultPortrait: string | undefined,
  avatarFallback?: string,
): string | undefined {
  if (portraits && isExpressionKey(mood)) {
    const hit = portraits[mood];
    if (hit) return hit;
  }
  if (portraits?.smile) return portraits.smile;
  if (defaultPortrait) return defaultPortrait;
  return avatarFallback;
}

/** 数一下已经上传了几个表情。用于 UI 显示"已配置 3/7"。 */
export function countExpressionPortraits(portraits: ExpressionPortraitMap | undefined): number {
  if (!portraits) return 0;
  let n = 0;
  for (const key of EXPRESSION_KEYS) if (portraits[key]) n++;
  return n;
}
