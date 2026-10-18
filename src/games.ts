import ocPixelAdventureCover from "./assets/covers/oc-pixel-adventure.png";

export interface GameEntry {
  id: string;
  path: string;
  title: string;
  tagline: string;
  cover: string;
  tags: string[];
}

/** 游戏盒子收录的全部游戏，以后加新游戏就往这个数组里追加一项 */
export const GAMES: GameEntry[] = [
  {
    id: "oc-pixel-adventure",
    path: "/games/oc-pixel-adventure",
    title: "像素冒险物语",
    tagline: "自定义原创角色，横版闯关 + AI NPC 对话",
    cover: ocPixelAdventureCover,
    tags: ["横版闯关", "AI对话", "养成"],
  },
];
