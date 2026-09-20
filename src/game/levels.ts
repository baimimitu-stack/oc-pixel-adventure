import { LevelConfig, PlatformTile, CoinPickup, StarPickup, EnemyEntity } from "../types";
import { GameStorage } from "../services/db";

export function generateWorld1(): LevelConfig {
  const tiles: PlatformTile[] = [];
  const coins: CoinPickup[] = [];
  const stars: StarPickup[] = [];
  const enemies: EnemyEntity[] = [];

  // Ground segments with gentle, easily jumpable gaps and safety clouds underneath
  tiles.push({ x: 0, y: 440, width: 850, height: 160, type: "ground" });
  // Safety cloud in first gap
  tiles.push({ x: 830, y: 460, width: 120, height: 28, type: "cloud" });
  tiles.push({ x: 920, y: 440, width: 950, height: 160, type: "ground" });
  // Safety cloud in second gap
  tiles.push({ x: 1840, y: 460, width: 130, height: 28, type: "cloud" });
  tiles.push({ x: 1940, y: 440, width: 1300, height: 160, type: "ground" });

  // Floating platforms & blocks
  // Segment 1: Fun question blocks with coins
  tiles.push({ x: 240, y: 320, width: 48, height: 48, type: "question", hasItem: "coin" });
  tiles.push({ x: 288, y: 320, width: 48, height: 48, type: "brick" });
  tiles.push({ x: 336, y: 320, width: 48, height: 48, type: "question", hasItem: "coin" });
  tiles.push({ x: 384, y: 320, width: 48, height: 48, type: "brick" });

  // Spring pad (wider & friendly) to reach high star 1
  tiles.push({ x: 520, y: 416, width: 80, height: 24, type: "spring" });
  tiles.push({ x: 460, y: 220, width: 200, height: 32, type: "grass" });
  stars.push({ id: "w1-s1", x: 550, y: 160, collected: false, animFrame: 0 });

  // Low decorative tunnel where player can Crouch / Slide under to grab Star 2!
  tiles.push({ x: 960, y: 330, width: 160, height: 36, type: "brick" });
  stars.push({ id: "w1-s2", x: 1020, y: 385, collected: false, animFrame: 0 }); // Pick up by walking or crouching under!
  tiles.push({ x: 1140, y: 330, width: 48, height: 48, type: "question", hasItem: "coin" });

  // Gentle stairs
  tiles.push({ x: 1350, y: 390, width: 60, height: 50, type: "metal" });
  tiles.push({ x: 1410, y: 340, width: 60, height: 100, type: "metal" });
  tiles.push({ x: 1470, y: 290, width: 80, height: 150, type: "metal" });

  // Wide, friendly moving platform over the gap
  tiles.push({
    x: 1780,
    y: 350,
    width: 140,
    height: 26,
    type: "moving",
    moveRange: { minX: 1740, maxX: 1900, speed: 1.1 },
  });

  // High fluffy clouds with coins & Star 3
  tiles.push({ x: 2150, y: 280, width: 180, height: 32, type: "cloud" });
  tiles.push({ x: 2380, y: 220, width: 180, height: 32, type: "cloud" });
  stars.push({ id: "w1-s3", x: 2450, y: 160, collected: false, animFrame: 0 });

  // Generous lines of coins
  [160, 200, 440, 600, 640, 750, 800, 1000, 1050, 1300, 1550, 1600, 2050, 2100, 2200, 2550, 2600, 2800].forEach((cx, i) => {
    coins.push({ id: `w1-c-${i}`, x: cx, y: 390, collected: false, animFrame: 0 });
  });

  // Soft, slow-moving enemies (friendly speed)
  enemies.push({ id: "e1", x: 400, y: 408, width: 36, height: 32, vx: 0.8, type: "slime", alive: true, minX: 300, maxX: 550 });
  enemies.push({ id: "e2", x: 1200, y: 408, width: 36, height: 32, vx: -0.9, type: "slime", alive: true, minX: 1150, maxX: 1320 });
  enemies.push({ id: "e3", x: 2100, y: 408, width: 36, height: 32, vx: 0.9, type: "slime", alive: true, minX: 2000, maxX: 2300 });
  enemies.push({ id: "e4", x: 2700, y: 408, width: 36, height: 32, vx: -1.0, type: "slime", alive: true, minX: 2600, maxX: 2950 });

  return {
    id: "world-1",
    worldNumber: 1,
    name: "晨曦平原",
    subtitle: "草木蔓发，追寻第一缕星光",
    theme: "grass",
    requiredStars: 0,
    levelLength: 3200,
    skyColor: "#60A5FA",
    skyGradient: ["#38BDF8", "#BAE6FD"],
    groundColor: "#4ADE80",
    tiles,
    coins,
    stars,
    enemies,
    goalX: 3050,
    npc: {
      name: "妖精露米 (Rumi)",
      role: "星之领路人",
      personality: "元气热情、热爱闪光宝物",
      dialogue: "欢迎来到像素大陆！按【下方向键】可以下蹲钻过低矮缝隙，还能空中再次按跳跃进行二段跳哦！",
      avatarEmoji: "🧚",
    },
  };
}

export function generateWorld2(): LevelConfig {
  const tiles: PlatformTile[] = [];
  const coins: CoinPickup[] = [];
  const stars: StarPickup[] = [];
  const enemies: EnemyEntity[] = [];

  // Mushroom theme: continuous friendly terrain + safety nets!
  tiles.push({ x: 0, y: 440, width: 900, height: 160, type: "ground" });
  // Safety mushroom moss in gaps so player NEVER falls into endless void
  tiles.push({ x: 880, y: 470, width: 220, height: 30, type: "cloud" });
  tiles.push({ x: 1050, y: 440, width: 950, height: 160, type: "ground" });
  tiles.push({ x: 1980, y: 470, width: 240, height: 30, type: "cloud" });
  tiles.push({ x: 2180, y: 440, width: 1100, height: 160, type: "ground" });

  // Gentle, wide giant bounce mushrooms (easy to land on, predictable bounce)
  tiles.push({ x: 350, y: 416, width: 90, height: 24, type: "spring" });
  tiles.push({ x: 480, y: 250, width: 180, height: 32, type: "grass" });
  stars.push({ id: "w2-s1", x: 560, y: 190, collected: false, animFrame: 0 });

  // Low mushroom tunnel where crouching picks up Star 2!
  tiles.push({ x: 800, y: 340, width: 160, height: 36, type: "grass" });
  stars.push({ id: "w2-s2", x: 870, y: 390, collected: false, animFrame: 0 }); // Easy crouch & collect!

  // Second bounce pad with safety grass below
  tiles.push({ x: 1250, y: 416, width: 90, height: 24, type: "spring" });
  tiles.push({ x: 1380, y: 280, width: 160, height: 30, type: "grass" });
  tiles.push({ x: 1580, y: 240, width: 160, height: 30, type: "grass" });

  // Gentle moving mushroom platform
  tiles.push({
    x: 1800,
    y: 330,
    width: 140,
    height: 26,
    type: "moving",
    moveRange: { minX: 1750, maxX: 1920, speed: 1.2 },
  });

  // Star 3 on a cozy mushroom cloud
  tiles.push({ x: 2350, y: 270, width: 180, height: 30, type: "cloud" });
  stars.push({ id: "w2-s3", x: 2420, y: 210, collected: false, animFrame: 0 });

  // Coins in lines
  [150, 220, 290, 700, 750, 1100, 1150, 1420, 1480, 1620, 1680, 2250, 2300, 2550, 2600].forEach((cx, i) => {
    coins.push({ id: `w2-c-${i}`, x: cx, y: 390, collected: false, animFrame: 0 });
  });

  // Gentle enemies
  enemies.push({ id: "w2-e1", x: 250, y: 408, width: 36, height: 32, vx: 0.9, type: "mushroom_critter", alive: true, minX: 150, maxX: 320 });
  enemies.push({ id: "w2-e2", x: 1150, y: 408, width: 36, height: 32, vx: -0.9, type: "slime", alive: true, minX: 1080, maxX: 1230 });
  enemies.push({ id: "w2-e3", x: 1650, y: 408, width: 36, height: 32, vx: 1.0, type: "mushroom_critter", alive: true, minX: 1550, maxX: 1800 });
  enemies.push({ id: "w2-e4", x: 2450, y: 408, width: 36, height: 32, vx: -1.0, type: "slime", alive: true, minX: 2350, maxX: 2650 });

  return {
    id: "world-2",
    worldNumber: 2,
    name: "蘑菇幻境",
    subtitle: "跳跃在斑斓菌伞之上",
    theme: "mushroom",
    requiredStars: 3,
    levelLength: 3000,
    skyColor: "#818CF8",
    skyGradient: ["#6366F1", "#C084FC"],
    groundColor: "#A855F7",
    tiles,
    coins,
    stars,
    enemies,
    goalX: 2850,
    npc: {
      name: "蘑菇贤者·古恩",
      role: "古菌守护者",
      personality: "沉稳哲理、说话慢吞吞",
      dialogue: "年轻人，弹跳蘑菇已经为你调整了柔和的弹性。如果感到疲惫，随时在我这里的营地休息吧……",
      avatarEmoji: "🍄",
    },
  };
}

export function generateWorld3(): LevelConfig {
  const tiles: PlatformTile[] = [];
  const coins: CoinPickup[] = [];
  const stars: StarPickup[] = [];
  const enemies: EnemyEntity[] = [];

  tiles.push({ x: 0, y: 440, width: 800, height: 160, type: "ground" });
  tiles.push({ x: 780, y: 460, width: 140, height: 28, type: "cloud" });
  tiles.push({ x: 880, y: 440, width: 900, height: 160, type: "ground" });
  tiles.push({ x: 1750, y: 460, width: 150, height: 28, type: "cloud" });
  tiles.push({ x: 1860, y: 440, width: 1200, height: 160, type: "ground" });

  // Floating Starlight stone pillars
  tiles.push({ x: 240, y: 320, width: 120, height: 32, type: "metal" });
  tiles.push({ x: 420, y: 240, width: 120, height: 32, type: "metal" });
  stars.push({ id: "w3-s1", x: 470, y: 180, collected: false, animFrame: 0 });

  // Friendly bounce star pad
  tiles.push({ x: 620, y: 416, width: 80, height: 24, type: "spring" });

  // Low starlight arch for sliding & Star 2
  tiles.push({ x: 980, y: 340, width: 150, height: 32, type: "metal" });
  stars.push({ id: "w3-s2", x: 1040, y: 390, collected: false, animFrame: 0 });

  // Castle battlements
  tiles.push({ x: 1350, y: 320, width: 160, height: 32, type: "metal" });
  tiles.push({ x: 1580, y: 240, width: 160, height: 32, type: "cloud" });
  stars.push({ id: "w3-s3", x: 1640, y: 180, collected: false, animFrame: 0 });

  // Coins
  [120, 180, 240, 720, 760, 920, 960, 1260, 1300, 1400, 2050, 2100, 2200, 2300, 2400].forEach((cx, i) => {
    coins.push({ id: `w3-c-${i}`, x: cx, y: 390, collected: false, animFrame: 0 });
  });

  // Enemies
  enemies.push({ id: "w3-e1", x: 300, y: 408, width: 36, height: 32, vx: 1.0, type: "slime", alive: true, minX: 180, maxX: 450 });
  enemies.push({ id: "w3-e2", x: 1100, y: 408, width: 36, height: 32, vx: -1.0, type: "slime", alive: true, minX: 1000, maxX: 1250 });
  enemies.push({ id: "w3-e3", x: 2100, y: 408, width: 36, height: 32, vx: 1.1, type: "slime", alive: true, minX: 1950, maxX: 2350 });

  return {
    id: "world-3",
    worldNumber: 3,
    name: "星夜城堡",
    subtitle: "静谧夜幕下的璀璨星石堡垒",
    theme: "star",
    requiredStars: 6,
    levelLength: 2900,
    skyColor: "#0F172A",
    skyGradient: ["#020617", "#1E1B4B"],
    groundColor: "#38BDF8",
    tiles,
    coins,
    stars,
    enemies,
    goalX: 2750,
    npc: {
      name: "星之星使·艾斯特尔",
      role: "星宫守门人",
      personality: "高冷优雅、内心温柔",
      dialogue: "能登上这片星夜王座的人少之又少。放轻松，深呼吸，你的OC散发着令人安心的微光呢。",
      avatarEmoji: "✨",
    },
  };
}

export function generateWorld4(): LevelConfig {
  const tiles: PlatformTile[] = [];
  const coins: CoinPickup[] = [];
  const stars: StarPickup[] = [];
  const enemies: EnemyEntity[] = [];

  tiles.push({ x: 0, y: 440, width: 750, height: 160, type: "ground" });
  tiles.push({ x: 720, y: 460, width: 140, height: 28, type: "cloud" });
  tiles.push({ x: 820, y: 440, width: 850, height: 160, type: "ground" });
  tiles.push({ x: 1640, y: 460, width: 140, height: 28, type: "cloud" });
  tiles.push({ x: 1750, y: 440, width: 1200, height: 160, type: "ground" });

  // Floating magma stones
  tiles.push({ x: 260, y: 310, width: 120, height: 32, type: "metal" });
  tiles.push({ x: 440, y: 230, width: 120, height: 32, type: "metal" });
  stars.push({ id: "w4-s1", x: 490, y: 170, collected: false, animFrame: 0 });

  // Low magma cave tunnel for slide & Star 2
  tiles.push({ x: 960, y: 340, width: 150, height: 32, type: "metal" });
  stars.push({ id: "w4-s2", x: 1020, y: 390, collected: false, animFrame: 0 });

  // Fire crystal clouds
  tiles.push({ x: 1400, y: 280, width: 150, height: 30, type: "cloud" });
  tiles.push({ x: 1650, y: 210, width: 150, height: 30, type: "cloud" });
  stars.push({ id: "w4-s3", x: 1710, y: 150, collected: false, animFrame: 0 });

  // Coins
  [100, 160, 220, 600, 650, 1100, 1160, 1350, 1450, 1900, 2000, 2100, 2200, 2300].forEach((cx, i) => {
    coins.push({ id: `w4-c-${i}`, x: cx, y: 390, collected: false, animFrame: 0 });
  });

  // Enemies
  enemies.push({ id: "w4-e1", x: 300, y: 408, width: 36, height: 32, vx: 1.1, type: "slime", alive: true, minX: 150, maxX: 450 });
  enemies.push({ id: "w4-e2", x: 1100, y: 408, width: 36, height: 32, vx: -1.1, type: "mushroom_critter", alive: true, minX: 950, maxX: 1250 });
  enemies.push({ id: "w4-e3", x: 2050, y: 408, width: 36, height: 32, vx: 1.2, type: "slime", alive: true, minX: 1900, maxX: 2300 });

  return {
    id: "world-4",
    worldNumber: 4,
    name: "熔岩核心",
    subtitle: "勇者最终考验，烈火重铸荣耀",
    theme: "lava",
    requiredStars: 9,
    levelLength: 2900,
    skyColor: "#7F1D1D",
    skyGradient: ["#450A0A", "#991B1B"],
    groundColor: "#EF4444",
    tiles,
    coins,
    stars,
    enemies,
    goalX: 2750,
    npc: {
      name: "炽炎凤凰·伊格尼斯",
      role: "试炼尊者",
      personality: "威严霸气、惜才如金",
      dialogue: "跨越试炼到达此地的勇者！你与你的OC已经展现了真正的冒险精神！",
      avatarEmoji: "🔥",
    },
  };
}

export function getLevelByWorld(worldNum: number): LevelConfig {
  let config: LevelConfig;
  switch (worldNum) {
    case 1:
      config = generateWorld1();
      break;
    case 2:
      config = generateWorld2();
      break;
    case 3:
      config = generateWorld3();
      break;
    case 4:
      config = generateWorld4();
      break;
    default:
      config = generateWorld1();
      break;
  }

  // Check if player has customized this world's NPC
  if (config.npc) {
    config.npc = GameStorage.getNPCForWorld(config.worldNumber, config.npc);
  }
  return config;
}

