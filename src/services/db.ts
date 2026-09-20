import { OCCharacter, CosmeticItem, Achievement, NPCConfig, SaveSlotData, ApiConfig } from "../types";
import { Affection } from "./affection";

// SVG Data URIs for cute preset pixel OCs
const SHIBA_HERO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <rect x="12" y="10" width="24" height="24" rx="6" fill="%23E28743"/>
  <polygon points="12,12 8,4 18,8" fill="%23C26829"/>
  <polygon points="36,12 40,4 30,8" fill="%23C26829"/>
  <polygon points="12,12 10,6 16,9" fill="%23F7D2B7"/>
  <polygon points="36,12 38,6 32,9" fill="%23F7D2B7"/>
  <ellipse cx="24" cy="24" rx="10" ry="7" fill="%23FFF6EE"/>
  <circle cx="18" cy="20" r="2.5" fill="%231E1E24"/>
  <circle cx="30" cy="20" r="2.5" fill="%231E1E24"/>
  <ellipse cx="24" cy="23" rx="2" ry="1.5" fill="%231E1E24"/>
  <ellipse cx="15" cy="24" rx="2" ry="1" fill="%23FF9EAA"/>
  <ellipse cx="33" cy="24" rx="2" ry="1" fill="%23FF9EAA"/>
  <rect x="16" y="34" width="16" height="10" rx="3" fill="%23E28743"/>
  <rect x="14" y="33" width="20" height="3" rx="1.5" fill="%23E63946"/>
  <circle cx="24" cy="35" r="2" fill="%23FFD166"/>
  <rect x="17" y="42" width="4" height="4" rx="1" fill="%23FFF6EE"/>
  <rect x="27" y="42" width="4" height="4" rx="1" fill="%23FFF6EE"/>
</svg>`;

const CAT_MAGE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <polygon points="10,12 6,4 16,9" fill="%237209B7"/>
  <polygon points="38,12 42,4 32,9" fill="%237209B7"/>
  <rect x="12" y="10" width="24" height="24" rx="6" fill="%233A0CA3"/>
  <polygon points="8,10 24,0 40,10" fill="%234CC9F0"/>
  <ellipse cx="24" cy="22" rx="10" ry="8" fill="%23480CA8"/>
  <ellipse cx="18" cy="20" rx="2.5" ry="3" fill="%234CC9F0"/>
  <ellipse cx="30" cy="20" rx="2.5" ry="3" fill="%234CC9F0"/>
  <circle cx="18" cy="19.5" r="1" fill="%23FFFFFF"/>
  <circle cx="30" cy="19.5" r="1" fill="%23FFFFFF"/>
  <polygon points="24,23 22,25 26,25" fill="%23F72585"/>
  <rect x="16" y="34" width="16" height="10" rx="4" fill="%237209B7"/>
  <circle cx="24" cy="37" r="3" fill="%23F72585"/>
</svg>`;

const STAR_GIRL_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <circle cx="24" cy="20" r="14" fill="%23FDE2E4"/>
  <path d="M10 20 Q24 6 38 20 Q40 32 36 34 Q34 26 24 24 Q14 26 12 34 Z" fill="%23FFB5A7"/>
  <rect x="14" y="14" width="20" height="16" rx="5" fill="%23FFE5D9"/>
  <circle cx="19" cy="21" r="2.5" fill="%234A5568"/>
  <circle cx="29" cy="21" r="2.5" fill="%234A5568"/>
  <circle cx="20" cy="20" r="1" fill="%23FFFFFF"/>
  <circle cx="30" cy="20" r="1" fill="%23FFFFFF"/>
  <ellipse cx="16" cy="24" rx="2" ry="1" fill="%23F38375"/>
  <ellipse cx="32" cy="24" rx="2" ry="1" fill="%23F38375"/>
  <path d="M22 25 Q24 27 26 25" stroke="%23E07A5F" stroke-width="1.5" fill="none"/>
  <polygon points="14,12 18,16 12,18 16,22" fill="%23FEE440"/>
  <rect x="16" y="33" width="16" height="11" rx="4" fill="%239D4EDD"/>
  <polygon points="24,35 25.5,38 29,38 26,40 27.5,43 24,41 20.5,43 22,40 19,38 22.5,38" fill="%23FFD166"/>
</svg>`;

const PIXEL_KNIGHT_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <rect x="12" y="10" width="24" height="22" rx="4" fill="%2394A3B8"/>
  <rect x="10" y="8" width="28" height="6" rx="2" fill="%2364748B"/>
  <polygon points="24,2 20,8 28,8" fill="%23EF4444"/>
  <rect x="14" y="18" width="20" height="6" rx="2" fill="%230F172A"/>
  <circle cx="18" cy="21" r="1.5" fill="%2338BDF8"/>
  <circle cx="30" cy="21" r="1.5" fill="%2338BDF8"/>
  <rect x="14" y="32" width="20" height="12" rx="3" fill="%23475569"/>
  <circle cx="24" cy="38" r="3" fill="%23F59E0B"/>
  <rect x="34" y="24" width="4" height="18" rx="1" fill="%23CBD5E1"/>
  <rect x="32" y="36" width="8" height="3" rx="1" fill="%23B45309"/>
</svg>`;

export const COSMETIC_ITEMS: CosmeticItem[] = [
  {
    id: "crown",
    name: "👑 黄金探险王冠",
    type: "head",
    cost: 15,
    icon: "👑",
    description: "闪耀纯金打造的微型王冠，头上自带尊贵金芒！",
    color: "#FBBF24",
  },
  {
    id: "wings",
    name: "🪽 天使星光羽翼",
    type: "wings",
    cost: 35,
    icon: "🪽",
    description: "在角色背部轻柔扇动的梦幻羽翼，带来轻盈跃动感！",
    color: "#67E8F9",
  },
  {
    id: "aura",
    name: "✨ 极光星尘光环",
    type: "aura",
    cost: 50,
    icon: "✨",
    description: "环绕身体不断回旋的璀璨星光与神秘符文粒子！",
    color: "#C084FC",
  },
  {
    id: "cape",
    name: "🧣 勇者烈焰披风",
    type: "cape",
    cost: 70,
    icon: "🧣",
    description: "奔跑与跳跃时迎风摆动的烈焰红披风，帅气逼人！",
    color: "#EF4444",
  },
  {
    id: "rainbow_trail",
    name: "🌈 彩虹彗星光轨",
    type: "aura",
    cost: 100,
    icon: "🌈",
    description: "身后拖出一条梦幻七彩粒子彗尾，奔跑如流星！",
    color: "#EC4899",
  },
  {
    id: "drone_pet",
    name: "⚡ 赛博星灵浮游宠",
    type: "pet",
    cost: 130,
    icon: "⚡",
    description: "时刻悬浮在头顶的小萌宠，随时给OC加油打气！",
    color: "#38BDF8",
  },
];

export const INITIAL_OCS: OCCharacter[] = [
  {
    id: "preset-shiba",
    name: "茶茶 (Chacha)",
    title: "元气柴柴剑客",
    personality: "热血勇者",
    bio: "来自微风村的见习柴犬剑客，梦想是收集全宇宙闪闪发光的星星！",
    catchphrase: "汪！今日的冒险也绝不退缩！",
    avatarUrl: SHIBA_HERO_SVG,
    createdAt: Date.now() - 3600000 * 3,
    affection: 35,
    coinsCollected: 12,
    starsCollected: 3,
    unlockedAppearances: ["crown"],
    equippedCosmetics: {
      head: "crown",
    },
  },
  {
    id: "preset-cat",
    name: "维克 (Vic)",
    title: "傲娇暗夜猫法师",
    personality: "傲娇",
    bio: "表面上对探险不屑一顾，其实每天都在悄悄练习跳跃法术。",
    catchphrase: "哼，别误会，本喵只是顺路来帮你过关的！",
    avatarUrl: CAT_MAGE_SVG,
    createdAt: Date.now() - 3600000 * 2,
    affection: 22,
    coinsCollected: 8,
    starsCollected: 2,
    unlockedAppearances: [],
    equippedCosmetics: {},
  },
  {
    id: "preset-star",
    name: "塞拉 (Seraphina)",
    title: "星咏治愈少女",
    personality: "温柔治愈",
    bio: "能够倾听星尘心跳的神秘旅者，微笑着守护前行的每一位同伴。",
    catchphrase: "愿微风拂去疲惫，星辰照亮你的旅途~",
    avatarUrl: STAR_GIRL_SVG,
    createdAt: Date.now() - 3600000,
    affection: 45,
    coinsCollected: 18,
    starsCollected: 4,
    unlockedAppearances: ["wings"],
    equippedCosmetics: {
      wings: "wings",
    },
  },
  {
    id: "preset-knight",
    name: "零号 (Zero-Knight)",
    title: "守望者铁壁机兵",
    personality: "高冷机智",
    bio: "搭载星核动力的全能机械守卫，无论遭遇什么障碍都能精准越过。",
    catchphrase: "检测到目标星晶，启动最优通行算法。",
    avatarUrl: PIXEL_KNIGHT_SVG,
    createdAt: Date.now(),
    affection: 18,
    coinsCollected: 5,
    starsCollected: 1,
    unlockedAppearances: [],
    equippedCosmetics: {},
  },
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_jump",
    title: "初入冒险界",
    desc: "完成第一次跳跃与探索",
    icon: "👟",
    target: 1,
    current: 0,
    unlocked: false,
    rewardCoins: 5,
  },
  {
    id: "coins_30",
    title: "吃金币好手",
    desc: "累计收集 30 枚金币",
    icon: "🪙",
    target: 30,
    current: 0,
    unlocked: false,
    rewardCoins: 15,
  },
  {
    id: "coins_100",
    title: "黄金大亨",
    desc: "累计收集 100 枚金币",
    icon: "💰",
    target: 100,
    current: 0,
    unlocked: false,
    rewardCoins: 30,
  },
  {
    id: "stars_3",
    title: "寻星旅者",
    desc: "在冒险地图中收集 3 颗星星",
    icon: "⭐",
    target: 3,
    current: 0,
    unlocked: false,
    rewardCoins: 20,
  },
  {
    id: "stars_8",
    title: "星穹漫游者",
    desc: "累计收集 8 颗星星，解锁高级世界",
    icon: "🌟",
    target: 8,
    current: 0,
    unlocked: false,
    rewardCoins: 40,
  },
  {
    id: "cosmetics_2",
    title: "百变造型师",
    desc: "为OC解锁并装扮至少 2 件吃金币外观",
    icon: "🪞",
    target: 2,
    current: 0,
    unlocked: false,
    rewardCoins: 25,
  },
  {
    id: "affection_30",
    title: "心之羁绊",
    desc: "与NPC或OC的好感度达到 30 点",
    icon: "💖",
    target: 30,
    current: 0,
    unlocked: false,
    rewardCoins: 20,
  },
  {
    id: "world_1_clear",
    title: "晨曦之星",
    desc: "顺利通关世界 1：晨曦平原",
    icon: "🚩",
    target: 1,
    current: 0,
    unlocked: false,
    rewardCoins: 15,
  },
  {
    id: "world_2_clear",
    title: "蘑菇秘境破除者",
    desc: "顺利通关世界 2：蘑菇幻境",
    icon: "🍄",
    target: 1,
    current: 0,
    unlocked: false,
    rewardCoins: 25,
  },
];

const STORAGE_KEYS = {
  OCS: "oc_game_characters_v2",
  ACTIVE_OC: "oc_game_active_oc_id_v2",
  ACHIEVEMENTS: "oc_game_achievements_v2",
  TOTAL_COINS: "oc_game_total_coins_v2",
  TOTAL_STARS: "oc_game_total_stars_v2",
  HIGHEST_WORLD: "oc_game_highest_world_v2",
  CURRENT_WORLD: "oc_game_current_world_v2",
  CUSTOM_NPCS: "oc_game_custom_npcs_v2",
  SAVE_SLOTS: "oc_game_save_slots_v2",
  API_CONFIG: "oc_game_api_config_v2",
  UNLOCKED_ALL_WORLDS: "oc_game_unlocked_all_worlds_v2",
};

export class GameStorage {
  // 100% Local Storage - No cloud upload guarantee
  public static isPrivacySafe(): boolean {
    return true;
  }

  public static getOCs(): OCCharacter[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OCS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to load OCs:", e);
    }
    // Initialize presets
    localStorage.setItem(STORAGE_KEYS.OCS, JSON.stringify(INITIAL_OCS));
    return INITIAL_OCS;
  }

  public static saveOCs(ocs: OCCharacter[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.OCS, JSON.stringify(ocs));
    } catch (e) {
      console.error("Failed to save OCs:", e);
    }
  }

  public static getActiveOCId(): string {
    const active = localStorage.getItem(STORAGE_KEYS.ACTIVE_OC);
    if (active) return active;
    const ocs = this.getOCs();
    const id = ocs[0]?.id || "preset-shiba";
    localStorage.setItem(STORAGE_KEYS.ACTIVE_OC, id);
    return id;
  }

  public static setActiveOCId(id: string) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_OC, id);
  }

  public static getActiveOC(): OCCharacter {
    const ocs = this.getOCs();
    const activeId = this.getActiveOCId();
    return ocs.find((c) => c.id === activeId) || ocs[0];
  }

  public static updateActiveOC(updater: (oc: OCCharacter) => OCCharacter): OCCharacter {
    const ocs = this.getOCs();
    const activeId = this.getActiveOCId();
    const index = ocs.findIndex((c) => c.id === activeId);
    if (index === -1) return ocs[0];

    const updated = updater({ ...ocs[index] });
    ocs[index] = updated;
    this.saveOCs(ocs);
    return updated;
  }

  public static addOC(oc: OCCharacter) {
    const ocs = this.getOCs();
    ocs.unshift(oc);
    this.saveOCs(ocs);
    this.setActiveOCId(oc.id);
  }

  public static saveOC(oc: OCCharacter) {
    this.addOC(oc);
  }

  public static upsertOC(oc: OCCharacter) {
    const ocs = this.getOCs();
    const index = ocs.findIndex((item) => item.id === oc.id);
    if (index === -1) ocs.unshift(oc);
    else ocs[index] = oc;
    this.saveOCs(ocs);
  }

  public static setActiveOC(id: string) {
    this.setActiveOCId(id);
  }

  public static deleteOC(id: string) {
    let ocs = this.getOCs();
    if (ocs.length <= 1) return; // keep at least 1
    ocs = ocs.filter((c) => c.id !== id);
    this.saveOCs(ocs);
    if (this.getActiveOCId() === id) {
      this.setActiveOCId(ocs[0].id);
    }
  }

  public static getTotalCoins(): number {
    const val = localStorage.getItem(STORAGE_KEYS.TOTAL_COINS);
    return val ? parseInt(val, 10) || 0 : 25; // start with small welcoming purse
  }

  public static addCoins(amount: number): number {
    const current = this.getTotalCoins();
    const next = Math.max(0, current + amount);
    localStorage.setItem(STORAGE_KEYS.TOTAL_COINS, next.toString());

    // Also update active OC collected
    this.updateActiveOC((oc) => ({
      ...oc,
      coinsCollected: (oc.coinsCollected || 0) + amount,
    }));

    return next;
  }

  public static getTotalStars(): number {
    const val = localStorage.getItem(STORAGE_KEYS.TOTAL_STARS);
    return val ? parseInt(val, 10) || 0 : 0;
  }

  public static addStars(amount: number): number {
    const current = this.getTotalStars();
    const next = current + amount;
    localStorage.setItem(STORAGE_KEYS.TOTAL_STARS, next.toString());

    this.updateActiveOC((oc) => ({
      ...oc,
      starsCollected: (oc.starsCollected || 0) + amount,
    }));

    return next;
  }

  public static getAchievements(): Achievement[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(INITIAL_ACHIEVEMENTS));
    return INITIAL_ACHIEVEMENTS;
  }

  public static updateAchievement(id: string, progressDelta: number = 1): { unlockedNow: boolean; achievement: Achievement | null } {
    const achievements = this.getAchievements();
    const item = achievements.find((a) => a.id === id);
    if (!item) return { unlockedNow: false, achievement: null };

    if (item.unlocked) return { unlockedNow: false, achievement: item };

    item.current = Math.min(item.target, item.current + progressDelta);
    let unlockedNow = false;
    if (item.current >= item.target && !item.unlocked) {
      item.unlocked = true;
      unlockedNow = true;
      this.addCoins(item.rewardCoins);
    }

    localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(achievements));
    return { unlockedNow, achievement: item };
  }

  // World persistence
  public static getCurrentWorld(): number {
    const val = localStorage.getItem(STORAGE_KEYS.CURRENT_WORLD);
    return val ? parseInt(val, 10) || 1 : 1;
  }

  public static setCurrentWorld(worldNum: number) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_WORLD, worldNum.toString());
  }

  // Custom NPC configs per world
  public static getCustomNPCs(): Record<number, NPCConfig> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_NPCS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {};
  }

  public static getNPCForWorld(worldNum: number, defaultNPC?: NPCConfig): NPCConfig | undefined {
    const customMap = this.getCustomNPCs();
    if (customMap[worldNum]) {
      return customMap[worldNum];
    }
    return defaultNPC;
  }

  public static saveNPCForWorld(worldNum: number, npc: NPCConfig) {
    const customMap = this.getCustomNPCs();
    customMap[worldNum] = npc;
    localStorage.setItem(STORAGE_KEYS.CUSTOM_NPCS, JSON.stringify(customMap));
  }

  public static resetNPCForWorld(worldNum: number) {
    const customMap = this.getCustomNPCs();
    delete customMap[worldNum];
    localStorage.setItem(STORAGE_KEYS.CUSTOM_NPCS, JSON.stringify(customMap));
  }

  // Save Slots management (3 slots)
  public static getSaveSlots(): (SaveSlotData | null)[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SAVE_SLOTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === 3) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [null, null, null];
  }

  public static saveToSlot(slotId: number, slotName?: string): SaveSlotData {
    const slots = this.getSaveSlots();
    const activeOC = this.getActiveOC();
    const currentWorld = this.getCurrentWorld();
    const totalCoins = this.getTotalCoins();
    const totalStars = this.getTotalStars();

    const slotData: SaveSlotData = {
      slotId,
      name: slotName || `冒险记录 ${slotId + 1}`,
      savedAt: Date.now(),
      totalCoins,
      totalStars,
      currentWorld,
      activeOCName: activeOC.name,
      activeOCTitle: activeOC.title,
      activeOCAvatar: activeOC.avatarUrl,
      affection: activeOC.affection || 10,
    };

    // Also snapshot current full state inside the slot for deep restores
    const fullSnapshot = {
      slotData,
      ocs: this.getOCs(),
      activeOCId: this.getActiveOCId(),
      achievements: this.getAchievements(),
      totalCoins,
      totalStars,
      currentWorld,
      customNPCs: this.getCustomNPCs(),
      npcAffection: Affection.getAll(),
    };

    localStorage.setItem(`oc_game_save_slot_snapshot_${slotId}`, JSON.stringify(fullSnapshot));

    slots[slotId] = slotData;
    localStorage.setItem(STORAGE_KEYS.SAVE_SLOTS, JSON.stringify(slots));
    return slotData;
  }

  public static loadFromSlot(slotId: number): boolean {
    try {
      const raw = localStorage.getItem(`oc_game_save_slot_snapshot_${slotId}`);
      if (!raw) return false;
      const snapshot = JSON.parse(raw);
      if (snapshot.ocs) localStorage.setItem(STORAGE_KEYS.OCS, JSON.stringify(snapshot.ocs));
      if (snapshot.activeOCId) localStorage.setItem(STORAGE_KEYS.ACTIVE_OC, snapshot.activeOCId);
      if (snapshot.achievements) localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(snapshot.achievements));
      if (typeof snapshot.totalCoins === "number") localStorage.setItem(STORAGE_KEYS.TOTAL_COINS, snapshot.totalCoins.toString());
      if (typeof snapshot.totalStars === "number") localStorage.setItem(STORAGE_KEYS.TOTAL_STARS, snapshot.totalStars.toString());
      if (typeof snapshot.currentWorld === "number") localStorage.setItem(STORAGE_KEYS.CURRENT_WORLD, snapshot.currentWorld.toString());
      if (snapshot.customNPCs) localStorage.setItem(STORAGE_KEYS.CUSTOM_NPCS, JSON.stringify(snapshot.customNPCs));
      if (snapshot.npcAffection) Affection.replaceAll(snapshot.npcAffection);
      return true;
    } catch (e) {
      console.error("Failed to load save slot:", e);
      return false;
    }
  }

  public static deleteSaveSlot(slotId: number) {
    const slots = this.getSaveSlots();
    slots[slotId] = null;
    localStorage.setItem(STORAGE_KEYS.SAVE_SLOTS, JSON.stringify(slots));
    localStorage.removeItem(`oc_game_save_slot_snapshot_${slotId}`);
  }

  public static resetNewGame() {
    // Reset coins, stars, current world, achievements to clean state
    localStorage.setItem(STORAGE_KEYS.TOTAL_COINS, "25");
    localStorage.setItem(STORAGE_KEYS.TOTAL_STARS, "0");
    localStorage.setItem(STORAGE_KEYS.CURRENT_WORLD, "1");
    localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(INITIAL_ACHIEVEMENTS));
    // Reset per-NPC affection (independent of OC) and OC stats
    Affection.clear();
    const ocs = this.getOCs();
    if (ocs.length > 0) {
      ocs[0].affection = 10; // legacy field, no longer used by dialogue
      ocs[0].coinsCollected = 0;
      ocs[0].starsCollected = 0;
      this.saveOCs(ocs);
      this.setActiveOCId(ocs[0].id);
    }
  }

  // API Configuration (支持 Gemini / DeepSeek / OpenAI 兼容第三方)
  public static getApiConfig(): ApiConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.API_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ApiConfig>;
        // 兼容旧版本存档（没有 provider 字段的老数据默认认作 gemini）
        return {
          provider: parsed.provider || "gemini",
          apiKey: parsed.apiKey || "",
          baseUrl: parsed.baseUrl || "https://generativelanguage.googleapis.com",
          model: parsed.model || "gemini-2.0-flash",
          status: parsed.status || "disconnected",
          lastTested: parsed.lastTested,
        };
      }
    } catch {
      // ignore
    }
    return {
      provider: "gemini",
      apiKey: "",
      baseUrl: "https://generativelanguage.googleapis.com",
      model: "gemini-2.0-flash",
      status: "disconnected",
    };
  }

  public static saveApiConfig(config: ApiConfig) {
    localStorage.setItem(STORAGE_KEYS.API_CONFIG, JSON.stringify(config));
  }

  // Unlock all worlds toggle/preference
  public static isAllWorldsUnlocked(): boolean {
    return localStorage.getItem(STORAGE_KEYS.UNLOCKED_ALL_WORLDS) === "true";
  }

  public static setAllWorldsUnlocked(unlocked: boolean) {
    localStorage.setItem(STORAGE_KEYS.UNLOCKED_ALL_WORLDS, unlocked ? "true" : "false");
  }

  // Update OC portrait artwork
  public static updateOCPortrait(ocId: string, portraitUrl: string) {
    const ocs = this.getOCs();
    const target = ocs.find((o) => o.id === ocId);
    if (target) {
      target.portraitUrl = portraitUrl;
      this.saveOCs(ocs);
    }
  }

  // ============================================================
  // 隐私工具 —— 一键抹除本地上传数据 / API Key / 全部本地数据
  // 上传的图片 (base64) 只在本机 localStorage，代码里的 fetch()
  // 从不把 avatarUrl / portraitUrl 塞进请求体，所以真正的物理隐私
  // 边界就是"本机 localStorage"这一个入口。
  // ============================================================

  /** 抹除所有玩家自己上传的图片 (OC 头像/立绘 + NPC 立绘)，
   *  内置预设 SVG 与其他文字数据保留。 */
  public static wipeAllUploadedImages(): { ocPortraits: number; ocAvatars: number; npcPortraits: number } {
    const stats = { ocPortraits: 0, ocAvatars: 0, npcPortraits: 0 };

    // OC 头像/立绘：base64 data URL 视为"上传"，SVG data URL 是预设
    const ocs = this.getOCs();
    for (const oc of ocs) {
      if (oc.portraitUrl && oc.portraitUrl.startsWith("data:image/") && !oc.portraitUrl.includes("svg")) {
        oc.portraitUrl = undefined;
        stats.ocPortraits++;
      }
      if (oc.avatarUrl && oc.avatarUrl.startsWith("data:image/") && !oc.avatarUrl.includes("svg")) {
        // 用户上传的头像被抹除后，回退到第一个预设 SVG
        oc.avatarUrl = INITIAL_OCS[0].avatarUrl;
        stats.ocAvatars++;
      }
    }
    this.saveOCs(ocs);

    // NPC 立绘
    const npcMap = this.getCustomNPCs();
    for (const key of Object.keys(npcMap)) {
      const npc = npcMap[Number(key)];
      if (npc.portraitUrl && npc.portraitUrl.startsWith("data:image/")) {
        delete npc.portraitUrl;
        stats.npcPortraits++;
      }
    }
    localStorage.setItem(STORAGE_KEYS.CUSTOM_NPCS, JSON.stringify(npcMap));

    return stats;
  }

  /** 抹除保存的 Gemini API Key */
  public static wipeApiKey() {
    const cfg = this.getApiConfig();
    cfg.apiKey = "";
    cfg.status = "disconnected";
    this.saveApiConfig(cfg);
  }

  /** 抹除整个游戏在本机的所有数据（存档 / OC / NPC / API Key / 进度 / 上传图）。
   *  刷新后回到"第一次进入游戏"的状态。 */
  public static wipeEverything() {
    localStorage.removeItem("oc_game_memory_v1");
    localStorage.removeItem("oc_game_volume");
    Affection.clear();
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
    // 清掉每个 slot 的深度快照
    for (let i = 0; i < 3; i++) {
      localStorage.removeItem(`oc_game_save_slot_snapshot_${i}`);
    }
  }

  /** 粗略估算 localStorage 里图片总占用（字节），给"隐私中心"展示 */
  public static estimateUploadedBytes(): number {
    let total = 0;
    const ocs = this.getOCs();
    for (const oc of ocs) {
      if (oc.avatarUrl?.startsWith("data:image/") && !oc.avatarUrl.includes("svg")) total += oc.avatarUrl.length;
      if (oc.portraitUrl?.startsWith("data:image/") && !oc.portraitUrl.includes("svg")) total += oc.portraitUrl.length;
    }
    const npcMap = this.getCustomNPCs();
    for (const npc of Object.values(npcMap)) {
      if (npc.portraitUrl?.startsWith("data:image/")) total += npc.portraitUrl.length;
    }
    return total;
  }
}
