import { LevelConfig } from "../types";

export interface ThemePalette {
  /** 4-stop vertical sky gradient, top → bottom */
  sky: [string, string, string, string];
  sun: { core: string; halo: string };
  silhouette: {
    color: string;
    style: "towers" | "hills" | "mushrooms" | "peaks";
  };
  /** 远景漂浮装饰（原本的像素云），按主题换皮当成氛围层用 */
  skyDecor: { style: "cloud" | "spore" | "twinkle" | "ember"; color: string; colorSoft: string };
  ground: {
    top: string;
    topShadow: string;
    teeth: string;
    body: string;
    patch: string;
  };
  /** "cloud" 类型的安全平台（真的能站上去的那种），按主题换色 */
  platform: { top: string; shadow: string; outline: string };
}

export const THEME_PALETTES: Record<LevelConfig["theme"], ThemePalette> = {
  grass: {
    sky: ["#ffd6e0", "#ffe8c2", "#bfe8ff", "#8fd3ff"],
    sun: { core: "rgba(255, 224, 130, 0.9)", halo: "rgba(255, 250, 200, 0.55)" },
    silhouette: { color: "rgba(147, 165, 210, 0.45)", style: "towers" },
    skyDecor: { style: "cloud", color: "#FFFFFF", colorSoft: "#CBD5E1" },
    ground: { top: "#84CC16", topShadow: "#15803D", teeth: "#65A30D", body: "#78350F", patch: "#451A03" },
    platform: { top: "#FFFFFF", shadow: "#CBD5E1", outline: "#94A3B8" },
  },
  mushroom: {
    sky: ["#f4c9ff", "#e0aaff", "#c77dff", "#9d4edd"],
    sun: { core: "rgba(240, 171, 252, 0.85)", halo: "rgba(250, 232, 255, 0.5)" },
    silhouette: { color: "rgba(157, 78, 221, 0.4)", style: "mushrooms" },
    skyDecor: { style: "spore", color: "#f0abfc", colorSoft: "#e9d5ff" },
    ground: { top: "#f0abfc", topShadow: "#86198f", teeth: "#d946ef", body: "#581c87", patch: "#3b0764" },
    platform: { top: "#f0abfc", shadow: "#c77dff", outline: "#86198f" },
  },
  star: {
    sky: ["#020617", "#0b1330", "#151042", "#1e1b4b"],
    sun: { core: "rgba(224, 231, 255, 0.85)", halo: "rgba(165, 180, 252, 0.4)" },
    silhouette: { color: "rgba(99, 102, 241, 0.45)", style: "towers" },
    skyDecor: { style: "twinkle", color: "#e0e7ff", colorSoft: "#818cf8" },
    ground: { top: "#4338ca", topShadow: "#1e1b4b", teeth: "#6366f1", body: "#1e1b4b", patch: "#0f0c29" },
    platform: { top: "#c7d2fe", shadow: "#818cf8", outline: "#4338ca" },
  },
  lava: {
    sky: ["#450a0a", "#7f1d1d", "#991b1b", "#ea580c"],
    sun: { core: "rgba(253, 224, 71, 0.85)", halo: "rgba(249, 115, 22, 0.5)" },
    silhouette: { color: "rgba(127, 29, 29, 0.5)", style: "peaks" },
    skyDecor: { style: "ember", color: "#fb923c", colorSoft: "#f97316" },
    ground: { top: "#1c1917", topShadow: "#000000", teeth: "#ea580c", body: "#44403c", patch: "#1c1917" },
    platform: { top: "#44403c", shadow: "#1c1917", outline: "#ea580c" },
  },
};

export function getThemePalette(theme: LevelConfig["theme"]): ThemePalette {
  return THEME_PALETTES[theme] ?? THEME_PALETTES.grass;
}
