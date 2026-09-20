export type PersonalityType =
  | "傲娇"
  | "热血勇者"
  | "温柔治愈"
  | "高冷机智"
  | "调皮捣蛋"
  | "呆萌天然";

/** AI 输出的 expression 值集，也是表情立绘的槽位 key。 */
export type ExpressionKey = "smile" | "excited" | "shy" | "surprised" | "cool" | "happy" | "grateful";

export const EXPRESSION_LIST: { key: ExpressionKey; label: string; emoji: string; desc: string }[] = [
  { key: "smile",     label: "微笑", emoji: "🙂", desc: "常态 / 默认情绪" },
  { key: "excited",   label: "兴奋", emoji: "😆", desc: "高兴激动 / 燃起来" },
  { key: "shy",       label: "害羞", emoji: "😳", desc: "不好意思 / 傲娇脸红" },
  { key: "surprised", label: "惊讶", emoji: "😲", desc: "吃惊 / 意外" },
  { key: "cool",      label: "酷酷", emoji: "😎", desc: "高冷 / 从容 / 淡定" },
  { key: "happy",     label: "开心", emoji: "😊", desc: "平静愉悦 / 温柔" },
  { key: "grateful",  label: "感激", emoji: "🙏", desc: "感谢 / 由衷回应" },
];

/** 每种表情对应的立绘（base64 data URL）。缺席的表情走 fallback（smile → 默认 portrait → 头像）。 */
export type ExpressionPortraitMap = Partial<Record<ExpressionKey, string>>;

export interface CosmeticItem {
  id: string;
  name: string;
  type: "head" | "wings" | "aura" | "cape" | "pet";
  cost: number;
  icon: string;
  description: string;
  color: string;
}

export interface CompanionManifestation {
  context: string;
  behavior: string;
}

export interface CompanionPaletteLayer {
  name: string;
  description: string;
  manifestations: CompanionManifestation[];
}

/** memory-core v1.2 `extensions.companion.character` 八个主字段（另可带 bound_worldbooks）。 */
export interface CompanionCharacter {
  basic_info: {
    name: string;
    age: number | null;
    identity: string;
    user_relation: string;
  };
  appearance: {
    height: string;
    body_type: string;
    signature_features: string[];
    clothing_style: string;
    details: Record<string, string>;
  };
  personality_palette: {
    base: CompanionPaletteLayer;
    primary: CompanionPaletteLayer;
    accent: CompanionPaletteLayer;
  };
  backstory_timeline: { age: number | null; event: string }[];
  relationships: { with: string; description: string }[];
  three_faces: {
    public: string;
    under_pressure: string;
    hidden: string;
  };
  notes: string;
  advanced: {
    variables: Record<string, string>;
    context_hints: string;
  };
  bound_worldbooks?: string[];
}

export interface CompanionExtension {
  companion_id: string;
  character: CompanionCharacter;
  media_style?: {
    photo_style_lock?: string;
    negative_prompt?: string;
    seed_range?: number[] | null;
  };
  memory_policy?: Record<string, unknown>;
}

/** Tavern V3 主字段 + extensions.companion */
export interface CompanionCard {
  spec: "chara_card_v3";
  spec_version: string;
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    tags: string[];
    creator: string;
    character_version: string;
    character_book?: unknown;
    assets?: unknown[];
    extensions?: {
      companion?: CompanionExtension;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
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
  companionCard?: CompanionCard;
  /** 按 mood 切换的立绘。AI 返 expression 后自动挑对应槽。 */
  expressionPortraits?: ExpressionPortraitMap;
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
  /** 按 mood 切换的立绘。AI 返 expression 后自动挑对应槽。 */
  expressionPortraits?: ExpressionPortraitMap;
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
