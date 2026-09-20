// 离线程序化台词与随机事件引擎
// 当用户没配 API Key、AI 请求失败、或选择离线模式时，用这套模板兜底
// —— 从原 server.ts 迁移到前端，纯静态部署时也能用

export interface ProceduralNPCReply {
  reply: string;
  expression: string;
  affectionChange: number;
  giftItem: string | null;
}

export interface ProceduralRandomEvent {
  title: string;
  description: string;
  choices: { text: string; outcome: string; coins: number; stars: number }[];
}

export function getProceduralNPCReply(params: {
  npcName?: string;
  npcRole?: string;
  npcPersonality?: string;
  ocName?: string;
  ocTitle?: string;
  ocPersonality?: string;
  worldName?: string;
  affection?: number;
  userMessage?: string;
}): ProceduralNPCReply {
  const {
    ocName = "冒险者",
    ocTitle = "像素勇士",
    ocPersonality = "热血勇者",
    worldName = "晨曦平原",
    userMessage = "",
  } = params;

  type DialogueTemplate = ProceduralNPCReply;

  const templatesByPersonality: Record<string, DialogueTemplate[]> = {
    "傲娇": [
      {
        reply: `哼……听${ocTitle}${ocName}你这么一说，本向导勉强承认你还挺有眼光的！不过在${worldName}可别掉以轻心，我才不是特意提醒你呢！`,
        expression: "shy",
        affectionChange: 3,
        giftItem: "傲娇的备用金币 (+10 金币)",
      },
      {
        reply: `切，别以为随便聊两句我就会夸你！不过看在你一路这么卖力的份上，这个顺手给你的，收好啦！`,
        expression: "shy",
        affectionChange: 2,
        giftItem: "星光糖果 (+10 金币)",
      },
    ],
    "热血勇者": [
      {
        reply: `太有干劲了，${ocName}！听得我热血沸腾！无论${worldName}前方藏着多少机关怪物，我们一起冲过去，把所有星星都拿下来！🔥`,
        expression: "excited",
        affectionChange: 3,
        giftItem: "勇者能量糖 (+10 金币)",
      },
      {
        reply: `哈哈哈哈！就是这股毫不退缩的气魄！在${worldName}这片大地上，你的英姿必将被星空见证！出发！`,
        expression: "excited",
        affectionChange: 3,
        giftItem: null,
      },
    ],
    "温柔治愈": [
      {
        reply: `听到${ocName}温柔的话语，感觉吹过${worldName}的微风都变得甘甜了呢。冒险固然重要，但累了随时在我身旁歇歇脚吧～ 🌸`,
        expression: "smile",
        affectionChange: 4,
        giftItem: "治愈花茶 (+10 金币)",
      },
      {
        reply: `愿星光化作最温柔的屏障，永远守护着纯粹而善良的你。无论前路多远，我都为你祈祷。`,
        expression: "grateful",
        affectionChange: 3,
        giftItem: null,
      },
    ],
    "高冷机智": [
      {
        reply: `分析了你的发言，逻辑清晰且目标明确。${worldName}的晶石磁场有异动，你的提议值得采纳，行动吧。❄️`,
        expression: "cool",
        affectionChange: 2,
        giftItem: "精密星核碎片 (+10 金币)",
      },
      {
        reply: `不拖泥带水，我喜欢这种效率。既然${ocName}已经做好了准备，那就按照预定路线突破防御吧。`,
        expression: "cool",
        affectionChange: 2,
        giftItem: null,
      },
    ],
    "调皮捣蛋": [
      {
        reply: `哇咔咔！${ocName}你可真逗！看我一个华丽的空中翻滚～嘿！抓到你了！作为奖励，这个闪亮亮的小东西送给你啦！⚡`,
        expression: "excited",
        affectionChange: 3,
        giftItem: "恶作剧金币 (+10 金币)",
      },
      {
        reply: `嘻嘻，被你猜中心思了！走走走，我们去${worldName}最顶端跳一曲胜利之舞，让小怪们看傻眼！`,
        expression: "excited",
        affectionChange: 3,
        giftItem: null,
      },
    ],
    "呆萌天然": [
      {
        reply: `咦……？刚才好像有一只发光的像素蝴蝶落在${ocName}的头发上了！好神奇呀……我们一起在${worldName}慢慢散步吧～ 🍃`,
        expression: "smile",
        affectionChange: 3,
        giftItem: "圆滚滚橡果 (+10 金币)",
      },
    ],
  };

  const list = templatesByPersonality[ocPersonality] || templatesByPersonality["热血勇者"];
  const idx = Math.abs(userMessage.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)) % list.length;
  return list[idx];
}

export function getProceduralRandomEvent(
  ocName: string = "主角",
  worldName: string = "晨曦平原",
): ProceduralRandomEvent {
  const events: ProceduralRandomEvent[] = [
    {
      title: "神秘的金光问号方块",
      description: `在${worldName}的悬崖边缘，一个不断上下弹跳的金色问号砖块正散发着诱人的金币光泽……${ocName}驻足凝视！`,
      choices: [
        { text: "奋力跃起，头槌顶撞！", outcome: "咚的一声！金币如暴雨般喷涌而出！获得 15 金币与 1 颗冒险之星！", coins: 15, stars: 1 },
        { text: "小心翼翼地轻碰机关", outcome: "机关稳稳启动，弹出一枚闪闪发光的幸运金币！", coins: 8, stars: 0 },
      ],
    },
    {
      title: "星光迷雾中的许愿泉",
      description: `微风吹散雾气，眼前出现了一座由纯净晶石雕琢的喷泉，几只发光的像素妖精正绕着${ocName}欢快飞舞。`,
      choices: [
        { text: "投入一枚金币诚心许愿", outcome: "泉水中升起璀璨的星芒！获得 1 颗探险之星！", coins: -1, stars: 1 },
        { text: "用手鞠起清泉洗脸提神", outcome: "疲劳尽消，精神百倍！妖精赠予了你 10 枚金币！", coins: 10, stars: 0 },
      ],
    },
    {
      title: "迷路的像素小果冻怪",
      description: `草丛中一只瑟瑟发抖的软萌粉色小史莱姆紧紧拉住了${ocName}的衣角，眼角还闪着泪花。`,
      choices: [
        { text: "轻抚安慰并指引归途", outcome: "小家伙开心地蹦跳起来，吐出了一串私藏的金币！获得 12 金币！", coins: 12, stars: 0 },
        { text: "分享你的探险干粮", outcome: "小史莱姆被深深感动，化作一颗晶莹的守护之星跟随你！", coins: 5, stars: 1 },
      ],
    },
  ];

  return events[Math.floor(Math.random() * events.length)];
}

/** 从 AI 原始文本抠出 JSON —— 兼容代码块包裹 */
export function cleanJsonResponse<T = unknown>(text: string): T | null {
  try {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    // 兼容 AI 在 JSON 前后带闲聊
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
    }
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
