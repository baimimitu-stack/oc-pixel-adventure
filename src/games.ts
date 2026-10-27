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
    id: "merch-studio",
    path: "/games/merch-studio/index.html",
    title: "周边制作台",
    tagline: "选吧唧、立牌、明信片，摆图层、直接画，看 3D，导出刀线和生产文件",
    cover: "/games/merch-studio/cover.svg",
    tags: ["周边设计", "3D预览", "生产文件"],
  },
  {
    id: "nunu-studio",
    path: "/games/nunu-studio/index.html",
    title: "努努制作台",
    tagline: "微调体型、画上表情、设计刘海，导出自己的布偶参考纸样",
    cover: "/games/nunu-studio/cover.svg",
    tags: ["布偶设计", "自由画脸", "纸样导出"],
  },
  {
    id: "canteen",
    path: "/games/canteen/index.html",
    title: "今日食堂",
    tagline: "排队点菜、装盘交餐，菜品图片和名字由你定义",
    cover: "/games/canteen/cover.svg",
    tags: ["打饭试玩", "自定义菜品", "美术待定"],
  },
  {
    id: "maid-cafe",
    path: "/games/maid-cafe/index.html",
    title: "女仆咖啡厅",
    tagline: "搭配米饭与滑蛋，用番茄酱写下专属的美味咒语",
    cover: "/games/maid-cafe/cover.svg",
    tags: ["料理制作", "3D互动", "自由涂鸦"],
  },
  {
    id: "ice-cream-latte",
    path: "/games/ice-cream-latte/index.html",
    title: "冰淇淋拉花工坊",
    tagline: "放上各色冰淇淋球，拉花、捏尖、摆装饰，还能在杯子上画画",
    cover: "/games/ice-cream-latte/cover.svg",
    tags: ["甜品制作", "3D互动", "自由涂鸦"],
  },
  {
    id: "oc-pixel-adventure",
    path: "/games/oc-pixel-adventure",
    title: "像素冒险物语",
    tagline: "自定义原创角色，横版闯关 + AI NPC 对话",
    cover: ocPixelAdventureCover,
    tags: ["横版闯关", "AI对话", "养成"],
  },
];
