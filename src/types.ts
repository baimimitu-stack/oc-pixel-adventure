export type PersonalityType = 
  | "傲娇" 
  | "热血勇者" 
  | "温柔治愈" 
  | "高冷机智" 
  | "调皮捣蛋" 
  | "呆萌天然";

export interface CosmeticItem {
  id: string;
  name: string;
  type: "head" | "wings" | "aura" | "cape" | "pet";
  cost: number;
  icon: string;
  description: string;
  color: string;
}

export interface OCCharacter {
  id: string;
  name: string;
  title: string;
  personality: PersonalityType;
  bio: string;
  catchphrase: string;
  avatarUrl: string; // Base64 data URL stored purely in local storage/IndexedDB
  portraitUrl?: string; // Full body or bust character standing artwork / 立绘
  createdAt: number;
  affection: number; // 好感度 0 - 100+
  coinsCollected: number;
  starsCollected: number;
  unlockedAppearances: string[]; // cosmetic IDs
  equippedCosmetics: {
    head?: string;
    wings?: string;
    aura?: string;
    cape?: string;
    pet?: string;
  };
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  target: number;
  current: number;
  unlocked: boolean;
  rewardCoins: number;
}

export interface GameParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape?: "circle" | "sparkle" | "coin" | "heart";
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export interface PlatformTile {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "ground" | "grass" | "brick" | "question" | "metal" | "spring" | "moving" | "cloud";
  hasItem?: "coin" | "star" | "mushroom" | null;
  hitState?: number; // bounce animation timer
  moveRange?: { minX: number; maxX: number; speed: number };
}

export interface CoinPickup {
  id: string;
  x: number;
  y: number;
  collected: boolean;
  animFrame: number;
}

export interface StarPickup {
  id: string;
  x: number;
  y: number;
  collected: boolean;
  animFrame: number;
}

export interface EnemyEntity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  type: "slime" | "spiky" | "mushroom_critter";
  alive: boolean;
  minX: number;
  maxX: number;
  squashTimer?: number;
}

export interface NPCConfig {
  name: string;
  role: string;
  personality: string;
  dialogue: string;
  avatarEmoji: string;
  portraitUrl?: string; // Optional custom portrait art / 立绘
}

export type ApiProvider = "gemini" | "deepseek" | "openai_compatible";

export interface ApiConfig {
  /** 服务商类型：gemini 走 @google/genai SDK；
   *  deepseek / openai_compatible 走 fetch(baseUrl + "/v1/chat/completions") */
  provider: ApiProvider;
  apiKey: string;
  /** OpenAI 兼容端点前缀，如 https://api.deepseek.com、https://api.openai.com/v1、
   *  或第三方中转 https://api.oneapi.com、https://openrouter.ai/api/v1 等。
   *  Gemini 时可留 https://generativelanguage.googleapis.com（实际不使用） */
  baseUrl: string;
  model: string;
  status?: "connected" | "disconnected" | "testing" | "error";
  lastTested?: number;
}

export interface SaveSlotData {
  slotId: number;
  name: string;
  savedAt: number;
  totalCoins: number;
  totalStars: number;
  currentWorld: number;
  activeOCName: string;
  activeOCTitle: string;
  activeOCAvatar: string;
  affection: number;
}

export interface LevelConfig {
  id: string;
  worldNumber: number;
  name: string;
  subtitle: string;
  theme: "grass" | "mushroom" | "star" | "lava";
  requiredStars: number;
  levelLength: number;
  skyColor: string;
  skyGradient: [string, string];
  groundColor: string;
  tiles: PlatformTile[];
  coins: CoinPickup[];
  stars: StarPickup[];
  enemies: EnemyEntity[];
  goalX: number;
  npc?: NPCConfig;
}
