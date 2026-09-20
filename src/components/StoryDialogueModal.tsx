import React, { useState, useEffect, useRef } from "react";
import { OCCharacter, LevelConfig, NPCConfig } from "../types";
import { GameStorage } from "../services/db";
import { sound } from "../services/sound";
import { callAI } from "../services/aiClient";
import {
  getProceduralNPCReply,
  getProceduralRandomEvent,
  cleanJsonResponse,
} from "../services/proceduralEngine";
import { 
  Heart, 
  Sparkles, 
  Send, 
  Dices, 
  X, 
  MessageSquare, 
  Edit3,
  Home,
  User,
  ScrollText,
  RotateCcw,
  Sparkle,
  Volume2,
  Smile,
  ShieldAlert,
  Flame,
  Coffee,
  HelpCircle,
  ChevronRight
} from "lucide-react";

interface StoryDialogueModalProps {
  activeOC: OCCharacter;
  npc?: LevelConfig["npc"];
  worldName: string;
  onRefreshData: () => void;
  onOpenCustomizer?: () => void;
  onBackToMainMenu?: () => void;
  onClose: () => void;
}

export const StoryDialogueModal: React.FC<StoryDialogueModalProps> = ({
  activeOC,
  npc,
  worldName,
  onRefreshData,
  onOpenCustomizer,
  onBackToMainMenu,
  onClose,
}) => {
  const currentNPC: NPCConfig = npc || {
    name: "旅行妖精·露米",
    role: "星之向导",
    personality: "元气热情、热爱闪光宝物",
    dialogue: "你好呀！愿星光照亮你与你的伙伴！在这片神秘的原野，隐藏着许多闪耀的古代星石呢~",
    avatarEmoji: "🧚",
  };

  // Dialogue History
  const [dialogueHistory, setDialogueHistory] = useState<
    { sender: "npc" | "player"; speakerName: string; text: string; mood?: string; timestamp: string }[]
  >([
    {
      sender: "npc",
      speakerName: currentNPC.name,
      text: currentNPC.dialogue,
      mood: "smile",
      timestamp: "初始对话",
    },
  ]);

  // Current display text & typewriter effect state
  const latestMessage = dialogueHistory[dialogueHistory.length - 1];
  const [displayedText, setDisplayedText] = useState<string>(latestMessage ? latestMessage.text : "");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Interaction Mode: "choices" (发表言论选项) vs "typing" (手动打字)
  const [interactionMode, setInteractionMode] = useState<"choices" | "typing">("choices");

  // Standing Portrait View: "npc" vs "oc"
  const [portraitTarget, setPortraitTarget] = useState<"npc" | "oc">("npc");

  // User input & UI states
  const [playerInput, setPlayerInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [suggestionBatch, setSuggestionBatch] = useState<number>(0);

  // Dynamic Adventure Random Event
  const [randomEvent, setRandomEvent] = useState<{
    title: string;
    description: string;
    choices: { text: string; outcome: string; coins: number; stars: number }[];
  } | null>(null);

  // ESC 键 / Q 键随时可关闭对话（避免用户找不到关闭键）
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.code === "KeyQ") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Typewriter animation when latest message changes
  useEffect(() => {
    if (!latestMessage) return;

    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
    }

    const fullText = latestMessage.text;
    let currIndex = 0;
    setDisplayedText("");
    setIsTyping(true);

    typingTimerRef.current = setInterval(() => {
      currIndex++;
      if (currIndex <= fullText.length) {
        setDisplayedText(fullText.slice(0, currIndex));
        // Soft blip sound every few chars
        if (currIndex % 4 === 0) {
          sound.playBlip();
        }
      } else {
        if (typingTimerRef.current) clearInterval(typingTimerRef.current);
        setIsTyping(false);
      }
    }, 28);

    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [dialogueHistory.length]);

  // Skip typewriter to instant full text on click
  const handleSkipTyping = () => {
    if (isTyping && latestMessage) {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      setDisplayedText(latestMessage.text);
      setIsTyping(false);
      sound.playClick();
    }
  };

  // Generate 4 rich branching dialogue choices based on OC personality & current world
  const getDialogueChoices = () => {
    const choicesMap: Record<string, string[][]> = {
      "傲娇": [
        [
          "哼，我只是刚好路过这里，才不是特意来找你搭话的！",
          "这片区域的机关和怪物看起来马马虎虎，有什么值得注意的秘密吗？",
          "诺，这块从宝箱翻出来的闪光石头借你看看……可别弄丢了！",
          "前面不管有多险峻，凭本大人的身手也绝对轻而易举！",
        ],
        [
          "你看什么看？我脸上有星屑吗……笨蛋，别靠那么近！",
          "快告诉我隐藏的宝藏藏在哪里，我才不需要你的向导呢！",
          "刚才那场战斗我还算满意，勉强夸奖你一句好了。",
          "休息够了就赶紧出发，本大人的日程可是很满的！",
        ],
      ],
      "热血勇者": [
        [
          "我的利刃与信念永不动摇！无论前路有什么险阻，一起冲吧！",
          "请告诉我这片大陆的最强挑战和被封印的远古星石在何处！",
          "别担心，只要有我们在，这片土地的生灵都会平安无事的！",
          "来一场男子汉/勇者之间的较量吧，让我们在冒险中燃起来！",
        ],
        [
          "听到了吗？那是来自深渊之风的战吼，正合我意！",
          "同伴的羁绊就是最强的力量，让我们全力奔跑向终点！",
          "如果受伤了就告诉我，我来负责冲锋陷阵！",
          "向着晨曦与星光，今天的冒险目标是打破记录！",
        ],
      ],
      "温柔治愈": [
        [
          "一路旅途辛苦了，请在微风与篝火旁喝杯花草茶歇息片刻吧~",
          "这里的风景真宁静呢，不知这片土地有着怎样的美丽传说？",
          "愿天上的星辰眷顾着每一个善良的旅人，你也要保重自己呀。",
          "如果遇到困扰或感到疲倦，随时都可以跟我倾诉哦。",
        ],
        [
          "尝尝我烘焙的星形小饼干吧，据说能恢复满满的活力呢。",
          "这片森林里的花朵都在悄悄为你祝福呢，真是个好兆头。",
          "只要我们心意相通，再漆黑的夜晚也不会感到害怕。",
          "微风拂过脸颊的感觉很温柔呢，愿今天的你也有好心情。",
        ],
      ],
      "高冷机智": [
        [
          "多余的寒暄到此为止，分析地形与机关规律才是最高效的选择。",
          "从刚才的重力参数与地貌来看，前方八成隐藏着古代密室。",
          "你的身手与决断力不错，作为冒险同行者符合及格标准。",
          "保持警惕，不要被表面的平静所蒙蔽，核心星石就在附近。",
        ],
        [
          "按照概率模型计算，探索这里的报酬期望值高于一般区域。",
          "收敛你的轻浮举止，专注目标才能降低伤亡风险。",
          "这是我绘制的地脉简图，拿去参考，不必言谢。",
          "最优路线已经计算完毕，跟紧步伐，不要掉队。",
        ],
      ],
      "调皮捣蛋": [
        [
          "嘿！猜猜我刚才把怪物的宝箱悄悄藏到了哪里？嘻嘻！",
          "我们来比比看谁能用最怪异的姿势跳上那边的悬崖尖顶！",
          "别老是一副严肃的样子嘛，笑一个我就把金币分你一半！",
          "哇！你身后有一只会飞的超级大烤鱼！……哈哈，被骗了吧！",
        ],
        [
          "今天又是充满恶作剧和惊喜的一天，快跟我一起搞事情！",
          "刚才那只小怪兽被我踩成了弹簧，蹦得可高啦！",
          "如果你答应给我讲个秘密，我就把这颗七彩宝石送给你！",
          "略略略~抓不到我吧！冒险就是要快快乐乐才对！",
        ],
      ],
      "呆萌天然": [
        [
          "唔？刚才好像有一只长着翅膀的胡萝卜从我眼前飞过去了……",
          "请问……这里的金币吃起来是甜甜的草莓味还是巧克力味呀？",
          "啊咧，我好像不小心把地图拿倒了，不过迷路也挺好玩的呢！",
          "这颗闪闪发光的星星好温暖，想要把它挂在床头当小夜灯~",
        ],
        [
          "好香的味道……是你在烤松饼吗？可以分我一个小角角吗？",
          "星星在一闪一闪地眨眼睛呢，它们是不是也觉得有点困了？",
          "虽然不知道接下来要去哪，但只要跟着大家就很开心啦！",
          "踩在云朵跳板上的感觉软绵绵的，像棉花糖一样耶！",
        ],
      ],
    };

    const personalityBatches = choicesMap[activeOC.personality] || [
      [
        `很高兴在这片神秘的【${worldName}】与你相遇！`,
        `能跟我讲讲这片区域的远古传说与隐藏星石的线索吗？`,
        `我们是一路追逐星光而来的旅人，愿与你分享旅途的欢歌！`,
        `让我们携手同行，击败前方盘踞的怪兽守护这片乐园吧！`,
      ],
      [
        `这里的微风与天色真是令人心旷神怡，你一直守护在这里吗？`,
        `我收集了许多闪耀的古代金币，送你一枚作为友谊的见证！`,
        `前方据说是充满挑战的关卡，有什么建议可以提醒我们吗？`,
        `无论前路多险峻，心中的希望都如星火般永不熄灭！`,
      ],
    ];

    const currentBatch = personalityBatches[suggestionBatch % personalityBatches.length];
    return currentBatch;
  };

  // Submit speech / handle sending message
  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || loading) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Append player's spoken line to history
    setDialogueHistory((prev) => [
      ...prev,
      {
        sender: "player",
        speakerName: activeOC.name,
        text: userText,
        timestamp: timeStr,
      },
    ]);

    setPlayerInput("");
    setLoading(true);
    sound.playClick();

    const apiConfig = GameStorage.getApiConfig();

    // 构造 prompt（同后端原逻辑，仅搬到前端）
    const prompt = `你是一个充满复古像素RPG游戏风格的NPC。
NPC设定：
- 名字: ${currentNPC.name}
- 身份: ${currentNPC.role}
- 性格特点: ${currentNPC.personality}

玩家的原创角色(OC)设定：
- 名字: ${activeOC.name}
- 称号: ${activeOC.title || "初出茅庐的探险家"}
- OC性格设定: ${activeOC.personality}
- 当前所在冒险世界: ${worldName}
- 当前与NPC的好感度: ${activeOC.affection || 0} / 100

玩家对话输入: "${userText}"

请按照NPC的性格和与玩家OC的关系，进行一段生动、带感、符合日系像素RPG风格的对话回应，并给予好感度增减判定。
请严格输出JSON格式，包含以下字段：
- "reply": NPC的台词（50-100字，幽默、亲切或符合性格）
- "expression": NPC此时的表情标签（可选值: "smile", "excited", "shy", "surprised", "cool"）
- "affectionChange": 好感度变化整数（通常为 1 至 4）
- "giftItem": 若好感度较高或对话契合，可赠送小礼物（如"幸运金币"、"星之浆果"或 null）

请直接输出合法JSON，不要包裹Markdown代码块。`;

    const procedural = getProceduralNPCReply({
      npcName: currentNPC.name,
      npcRole: currentNPC.role,
      npcPersonality: currentNPC.personality,
      ocName: activeOC.name,
      ocTitle: activeOC.title,
      ocPersonality: activeOC.personality,
      worldName,
      affection: activeOC.affection || 10,
      userMessage: userText,
    });

    let replyText = procedural.reply;
    let expression = procedural.expression;
    let affectionDelta = procedural.affectionChange;
    let giftItem = procedural.giftItem;

    try {
      const rawText = await callAI({
        prompt,
        isJson: true,
        provider: apiConfig.provider || "gemini",
        apiKey: apiConfig.apiKey,
        baseUrl: apiConfig.baseUrl,
        model: apiConfig.model,
      });

      if (rawText) {
        const parsed = cleanJsonResponse<{
          reply?: string;
          expression?: string;
          affectionChange?: number;
          giftItem?: string | null;
        }>(rawText);
        if (parsed && typeof parsed.reply === "string" && parsed.reply.trim()) {
          replyText = parsed.reply.trim();
          expression = parsed.expression || "smile";
          affectionDelta = typeof parsed.affectionChange === "number" ? parsed.affectionChange : 2;
          giftItem = parsed.giftItem ?? null;
        }
      }
    } catch {
      // 保持 procedural fallback
    }

    setDialogueHistory((prev) => [
      ...prev,
      {
        sender: "npc",
        speakerName: currentNPC.name,
        text: replyText,
        mood: expression,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    GameStorage.updateActiveOC((oc) => ({
      ...oc,
      affection: Math.min(100, (oc.affection || 0) + affectionDelta),
    }));
    GameStorage.updateAchievement("affection_30", affectionDelta);
    if (giftItem) {
      GameStorage.addCoins(10);
    }

    sound.playStar();
    onRefreshData();
    setLoading(false);
  };

  // Trigger dynamic random adventure event
  const triggerRandomEvent = async () => {
    setLoading(true);
    sound.playClick();
    const apiConfig = GameStorage.getApiConfig();

    const prompt = `为横版像素过关冒险游戏生成一个趣味动态随机突发事件。
玩家OC角色名：${activeOC.name}，性格：${activeOC.personality}。
所在区域：${worldName}。

请生成 JSON：
- "title": 事件标题（10字内）
- "description": 事件描述（30-60字，营造冒险临场感）
- "choices": 两个选项数组，每个包含：
  - "text": 选项文字
  - "outcome": 结果描述
  - "coins": 获得的金币数值 (5-20)
  - "stars": 获得的星星数 (0 或 1)

只返回标准JSON，不要代码块。`;

    let event = getProceduralRandomEvent(activeOC.name, worldName);
    try {
      const rawText = await callAI({
        prompt,
        isJson: true,
        provider: apiConfig.provider || "gemini",
        apiKey: apiConfig.apiKey,
        baseUrl: apiConfig.baseUrl,
        model: apiConfig.model,
      });
      if (rawText) {
        const parsed = cleanJsonResponse<typeof event>(rawText);
        if (parsed && typeof parsed.title === "string" && Array.isArray(parsed.choices) && parsed.choices.length > 0) {
          event = parsed;
        }
      }
    } catch {
      // 保留 procedural fallback
    }

    setRandomEvent(event);
    setLoading(false);
  };

  const handleResolveEventChoice = (choice: { outcome: string; coins: number; stars: number }) => {
    if (choice.coins > 0) GameStorage.addCoins(choice.coins);
    if (choice.stars > 0) GameStorage.addStars(choice.stars);
    sound.playStar();
    setDialogueHistory((prev) => [
      ...prev,
      {
        sender: "npc",
        speakerName: currentNPC.name,
        text: `【奇遇揭晓】${choice.outcome}`,
        mood: "excited",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setRandomEvent(null);
    onRefreshData();
  };

  // Quick emotion prepend chips for manual typing
  const toneChips = [
    { label: "微笑", prefix: "（微笑着）" },
    { label: "认真", prefix: "（目光坚定）" },
    { label: "好奇", prefix: "（歪头打量）" },
    { label: "调皮", prefix: "（坏笑嘻嘻）" },
    { label: "关切", prefix: "（温柔关怀）" },
    { label: "抱胸", prefix: "（双手抱胸）" },
  ];

  // Standing portrait character selection
  const isViewingNPC = portraitTarget === "npc";
  const displayedPortraitUrl = isViewingNPC
    ? currentNPC.portraitUrl
    : (activeOC.portraitUrl || activeOC.avatarUrl);
  const displayedCharacterName = isViewingNPC ? currentNPC.name : activeOC.name;
  const displayedCharacterRole = isViewingNPC ? currentNPC.role : (activeOC.title || "冒险勇者");
  const displayedCharacterPersonality = isViewingNPC ? currentNPC.personality : activeOC.personality;

  return (
    <div className="story-vn-scope fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      {/* Visual Novel Full Stage Window */}
      <div className="relative w-full max-w-5xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100 flex flex-col min-h-[600px] max-h-[92vh] pixel-panel pixel-border-gold shadow-2xl overflow-hidden">
        
        {/* Top Scenic Bar / Navigation Controls */}
        <div className="flex flex-wrap items-center justify-between px-3 sm:px-5 py-2.5 bg-slate-950/80 border-b-2 border-amber-900/60 z-10 shrink-0 gap-2">
          {/* Left: Location & Bond indicator */}
          <div className="flex items-center flex-wrap gap-2.5">
            <div className="flex items-center gap-1.5 bg-indigo-950/90 px-3 py-1 border border-indigo-500/50 text-[11px] font-pixel text-indigo-200">
              <span className="text-amber-400">🗺️</span>
              <span>场景：【{worldName}】</span>
            </div>

            <div className="flex items-center gap-1.5 bg-rose-950/80 px-3 py-1 border border-rose-600/50 text-[11px] font-pixel text-rose-200">
              <Heart size={13} className="text-rose-400 fill-rose-400 animate-pulse" />
              <span>好感度：{activeOC.affection || 10}/100</span>
            </div>
          </div>

          {/* Right: Functional Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLogModal(true)}
              className="pixel-btn-slate px-2.5 py-1 text-[11px] font-pixel flex items-center gap-1 text-slate-300 hover:text-white"
              title="查看历史对话记录"
            >
              <ScrollText size={12} className="text-amber-400" />
              <span className="hidden sm:inline">历史回顾</span> LOG
            </button>

            <button
              onClick={triggerRandomEvent}
              disabled={loading}
              className="pixel-btn-amber px-2.5 py-1 text-[11px] font-pixel flex items-center gap-1 text-slate-950 font-bold"
              title="触发随机冒险剧情奇遇"
            >
              <Dices size={12} />
              <span className="hidden sm:inline">随机奇遇</span>
            </button>

            {onBackToMainMenu && (
              <button
                onClick={() => {
                  onClose();
                  onBackToMainMenu();
                }}
                className="pixel-btn-slate px-2.5 py-1 text-[11px] font-pixel text-slate-300 hover:text-white"
                title="返回大标题"
              >
                <Home size={12} />
                <span className="hidden sm:inline">大标题</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="pixel-btn-amber px-3 py-1.5 text-[11px] font-pixel flex items-center gap-1.5 font-bold shadow-md"
              title="关闭对话 (ESC)"
              style={{ color: "#3a2410" }}
            >
              <X size={14} />
              <span>结束对话 (ESC)</span>
            </button>
          </div>
        </div>

        {/* Dynamic Random Event Overlay (if triggered) */}
        {randomEvent && (
          <div className="mx-3 sm:mx-6 mt-3 bg-gradient-to-r from-amber-950 via-yellow-950 to-amber-950 p-4 border-2 border-amber-400 pixel-border-gold shadow-2xl animate-fade-in z-20 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs sm:text-sm font-pixel">
                <Sparkles size={16} className="text-amber-300 animate-spin" />
                <span>★ 突发剧情奇遇：{randomEvent.title}</span>
              </div>
              <button
                onClick={() => setRandomEvent(null)}
                className="text-amber-400 hover:text-white text-xs font-pixel"
              >
                ✕ 暂缓
              </button>
            </div>
            <p className="text-xs sm:text-sm text-amber-100 leading-relaxed mb-3 font-sans">
              {randomEvent.description}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {randomEvent.choices.map((c, i) => (
                <button
                  key={i}
                  onClick={() => handleResolveEventChoice(c)}
                  className="pixel-btn-amber font-bold px-3 py-2 text-xs text-left font-pixel flex items-center justify-between group shadow-md"
                >
                  <span>▶ {c.text}</span>
                  <ChevronRight size={13} className="text-amber-900 group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Visual Novel Core Stage: Left Main VN Dialog & Right Standing Portrait Frame */}
        <div className="flex-1 flex flex-col md:flex-row p-3 sm:p-5 gap-4 overflow-hidden relative">
          
          {/* ============================================================ */}
          {/* LEFT: Classic Visual Novel Dialogue Area + Dual Speech Modes */}
          {/* ============================================================ */}
          <div className="flex-1 flex flex-col justify-between overflow-hidden gap-3 order-2 md:order-1">
            
            {/* Visual Novel Story Dialogue Box */}
            <div 
              onClick={handleSkipTyping}
              className="relative flex-1 bg-gradient-to-b from-slate-900/95 to-slate-950/95 border-2 border-amber-600/60 p-4 sm:p-6 shadow-2xl flex flex-col justify-between cursor-pointer group min-h-[200px] sm:min-h-[240px]"
              style={{
                boxShadow: "inset 0 0 30px rgba(0,0,0,0.8), 0 0 15px rgba(245, 158, 11, 0.15)",
              }}
              title={isTyping ? "点击直接跳过打字动画" : undefined}
            >
              {/* Ornate VN Box Gold Corners */}
              <div className="absolute top-1 left-1 text-amber-500/50 text-[10px] select-none">◤</div>
              <div className="absolute top-1 right-1 text-amber-500/50 text-[10px] select-none">◥</div>
              <div className="absolute bottom-1 left-1 text-amber-500/50 text-[10px] select-none">◣</div>
              <div className="absolute bottom-1 right-1 text-amber-500/50 text-[10px] select-none">◢</div>

              {/* Speaker Floating Nameplate */}
              <div className="flex items-center justify-between border-b border-amber-800/40 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-amber-950/90 border border-amber-400/80 flex items-center justify-center text-sm shadow">
                    {latestMessage?.sender === "npc" ? currentNPC.avatarEmoji : "⚔️"}
                  </div>
                  <div>
                    <span className="text-sm sm:text-base font-bold font-pixel text-amber-300 drop-shadow-md">
                      【{latestMessage?.speakerName || currentNPC.name}】
                    </span>
                    <span className="ml-2 text-[10px] bg-amber-950/80 text-amber-200/90 px-1.5 py-0.5 border border-amber-500/40 font-pixel">
                      {latestMessage?.sender === "npc" ? currentNPC.role : (activeOC.title || "主角")}
                    </span>
                  </div>
                </div>

                {latestMessage?.mood && (
                  <span className="text-[10px] text-amber-400 font-pixel bg-slate-950/80 px-2 py-0.5 border border-amber-500/30">
                    状态: [{latestMessage.mood === "smile" ? "微笑" : latestMessage.mood === "excited" ? "兴奋" : latestMessage.mood}]
                  </span>
                )}
              </div>

              {/* VN Dialogue Content Area with Japanese Quotes */}
              <div className="flex-1 py-1 sm:py-2 flex flex-col justify-center">
                <p className="text-sm sm:text-base text-amber-50/95 leading-relaxed tracking-wide font-sans select-text">
                  <span className="text-amber-400 font-serif text-lg mr-1">「</span>
                  {displayedText}
                  <span className="text-amber-400 font-serif text-lg ml-1">」</span>
                </p>

                {loading && (
                  <div className="flex items-center gap-2 text-xs text-amber-300 mt-2 font-pixel animate-pulse">
                    <Sparkle size={14} className="animate-spin text-amber-400" />
                    <span>【{currentNPC.name}】正在根据性格构思回话中...</span>
                  </div>
                )}
              </div>

              {/* Typing indicator / Next cursor prompt */}
              <div className="flex items-center justify-between pt-2 border-t border-amber-900/30 text-[10px] text-slate-400 font-pixel select-none">
                <span className="opacity-70">
                  {isTyping ? "▶ 点击屏幕可快速显示全文" : "▼ 等待发表言论或输入"}
                </span>

                <div className="flex items-center gap-1 text-amber-400">
                  {!isTyping && !loading && (
                    <span className="inline-block animate-bounce font-bold text-amber-300">
                      ▼
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Interaction System: Tab Switcher (发表言论 VS 手动打字) */}
            <div className="bg-slate-950/85 border-2 border-slate-700/80 p-3 pixel-border-slate flex flex-col gap-2.5">
              
              {/* Mode Tabs */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setInteractionMode("choices");
                      sound.playClick();
                    }}
                    className={`px-3 py-1 text-xs font-pixel flex items-center gap-1.5 transition-all ${
                      interactionMode === "choices"
                        ? "pixel-btn-amber text-slate-950 font-bold"
                        : "pixel-btn-slate text-slate-400 hover:text-white"
                    }`}
                  >
                    <Sparkles size={12} />
                    <span>发表言论 (剧情选项)</span>
                  </button>

                  <button
                    onClick={() => {
                      setInteractionMode("typing");
                      sound.playClick();
                    }}
                    className={`px-3 py-1 text-xs font-pixel flex items-center gap-1.5 transition-all ${
                      interactionMode === "typing"
                        ? "pixel-btn-amber text-slate-950 font-bold"
                        : "pixel-btn-slate text-slate-400 hover:text-white"
                    }`}
                  >
                    <Edit3 size={12} />
                    <span>手动打字 (自由对话)</span>
                  </button>
                </div>

                {/* Batch Refresh for choices */}
                {interactionMode === "choices" && (
                  <button
                    onClick={() => {
                      setSuggestionBatch((prev) => prev + 1);
                      sound.playClick();
                    }}
                    className="text-[10px] font-pixel text-amber-300 hover:text-amber-200 flex items-center gap-1 px-2 py-0.5 bg-amber-950/60 border border-amber-500/40"
                    title="刷新一批言论选项"
                  >
                    <RotateCcw size={10} />
                    <span>换一批</span>
                  </button>
                )}
              </div>

              {/* MODE 1: Branching Speech Choices */}
              {interactionMode === "choices" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fade-in">
                  {getDialogueChoices().map((choiceText, index) => {
                    const letters = ["A", "B", "C", "D"];
                    return (
                      <button
                        key={`${suggestionBatch}-${index}`}
                        onClick={() => handleSendMessage(choiceText)}
                        disabled={loading}
                        className="group flex items-start gap-2 text-left p-2.5 bg-slate-900/90 border border-slate-700 hover:border-amber-400 hover:bg-amber-950/40 text-slate-200 hover:text-amber-100 transition-all shadow-sm active:scale-[0.98]"
                      >
                        <span className="w-5 h-5 bg-amber-950 border border-amber-500 text-amber-300 font-pixel text-[10px] flex items-center justify-center shrink-0 group-hover:bg-amber-400 group-hover:text-slate-950 transition-colors">
                          {letters[index]}
                        </span>
                        <span className="text-xs leading-snug line-clamp-2">
                          {choiceText}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* MODE 2: Manual Typewriter / Text Input */}
              {interactionMode === "typing" && (
                <div className="flex flex-col gap-2 animate-fade-in">
                  {/* Quick Emotion Tag Prefix Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-pixel">情绪前缀:</span>
                    {toneChips.map((chip, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setPlayerInput((prev) => (prev ? `${chip.prefix} ${prev}` : `${chip.prefix} `));
                          sound.playClick();
                        }}
                        className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-amber-950/80 text-slate-300 hover:text-amber-200 border border-slate-700 font-pixel"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {/* Typing input bar */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`以【${activeOC.name}】(${activeOC.personality}) 的身份发表言论... (按 Enter 发送)`}
                      value={playerInput}
                      onChange={(e) => setPlayerInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendMessage(playerInput);
                      }}
                      disabled={loading}
                      className="flex-1 bg-slate-900 border-2 border-slate-700 focus:border-amber-400 px-3 py-2 text-xs text-white outline-none pixel-border-slate placeholder-slate-500"
                    />
                    <button
                      onClick={() => handleSendMessage(playerInput)}
                      disabled={loading || !playerInput.trim()}
                      className="pixel-btn-amber font-bold px-4 py-2 text-xs flex items-center gap-1.5 shadow font-pixel text-slate-950 shrink-0"
                    >
                      <Send size={13} />
                      <span>发言</span>
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* ============================================================ */}
          {/* RIGHT: Dedicated Character Standing Portrait UI Frame        */}
          {/* ============================================================ */}
          <div className="w-full md:w-72 lg:w-80 flex flex-col bg-slate-950/90 border-2 border-amber-600/70 p-3 pixel-panel pixel-border-gold shrink-0 order-1 md:order-2">
            
            {/* Portrait Box Header / Target Switcher */}
            <div className="flex items-center justify-between border-b-2 border-amber-800/60 pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 text-xs">◈</span>
                <span className="text-xs font-bold font-pixel text-amber-300">角色立绘 · STAGE</span>
              </div>

              {/* Toggle to view NPC vs Player OC Standing Portrait */}
              <div className="flex items-center bg-slate-900 p-0.5 border border-slate-700">
                <button
                  onClick={() => {
                    setPortraitTarget("npc");
                    sound.playClick();
                  }}
                  className={`px-1.5 py-0.5 text-[10px] font-pixel ${
                    isViewingNPC ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                  title="展示当前关卡 NPC 立绘"
                >
                  NPC
                </button>
                <button
                  onClick={() => {
                    setPortraitTarget("oc");
                    sound.playClick();
                  }}
                  className={`px-1.5 py-0.5 text-[10px] font-pixel ${
                    !isViewingNPC ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                  }`}
                  title="展示我方主角 OC 立绘"
                >
                  我方
                </button>
              </div>
            </div>

            {/* Standing Portrait Visual Showcase Area */}
            <div className="relative flex-1 min-h-[300px] max-h-[360px] md:max-h-none bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-slate-800 flex flex-col items-center justify-end overflow-hidden shadow-inner group">
              
              {/* Backlight Ambient Glow Effect */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.12),transparent_70%)] pointer-events-none" />

              {/* Floor spotlight oval */}
              <div className="absolute bottom-2 w-3/4 h-8 bg-amber-500/10 rounded-full blur-md pointer-events-none" />

              {/* The Standing Portrait Artwork */}
              {displayedPortraitUrl ? (
                <div className="relative w-full h-full flex items-end justify-center p-2 z-10">
                  <img
                    src={displayedPortraitUrl}
                    alt={displayedCharacterName}
                    className="max-h-full max-w-full object-contain object-bottom drop-shadow-[0_10px_20px_rgba(0,0,0,0.85)] filter brightness-105 transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              ) : (
                /* Thematic Placeholder when no custom portrait has been uploaded */
                <div className="flex flex-col items-center justify-center h-full p-4 text-center z-10">
                  <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-amber-400/80 flex items-center justify-center text-4xl mb-3 shadow-lg animate-pulse">
                    {isViewingNPC ? currentNPC.avatarEmoji : "⚔️"}
                  </div>
                  <span className="text-xs font-pixel font-bold text-amber-300 mb-1">
                    {displayedCharacterName}
                  </span>
                  <span className="text-[10px] text-slate-400 mb-3 font-sans">
                    暂未配置高清全身立绘
                  </span>
                  {onOpenCustomizer && isViewingNPC && (
                    <button
                      onClick={onOpenCustomizer}
                      className="pixel-btn-amber px-2.5 py-1 text-[10px] font-pixel text-slate-950 font-bold flex items-center gap-1"
                    >
                      <Edit3 size={11} /> 上传/换立绘
                    </button>
                  )}
                </div>
              )}

              {/* Character Identity & Status Plaque (Floating at Bottom of Portrait) */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent p-3 z-20 flex flex-col items-center text-center">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs sm:text-sm font-bold font-pixel text-amber-300 drop-shadow">
                    {displayedCharacterName}
                  </span>
                  <span className="text-[9px] bg-indigo-950 text-indigo-200 px-1.5 py-0.2 border border-indigo-500/50 font-pixel">
                    {displayedCharacterRole}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate max-w-full">
                  性格: {displayedCharacterPersonality}
                </p>
              </div>
            </div>

            {/* Bond Affection Gauge (好感度与羁绊槽) */}
            <div className="mt-2.5 bg-slate-900 border border-slate-800 p-2">
              <div className="flex items-center justify-between text-[10px] font-pixel mb-1">
                <span className="text-rose-300 flex items-center gap-1">
                  <Heart size={11} className="fill-rose-400 text-rose-400" />
                  羁绊度
                </span>
                <span className="text-amber-300 font-bold">
                  {activeOC.affection || 10} / 100
                </span>
              </div>
              <div className="w-full bg-slate-950 h-2 border border-slate-700 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-rose-500 via-amber-400 to-amber-300 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, activeOC.affection || 10)}%` }}
                />
              </div>
            </div>

            {/* Quick Action Footer in Portrait Box */}
            <div className="mt-2 flex items-center gap-2">
              {onOpenCustomizer && (
                <button
                  onClick={onOpenCustomizer}
                  className="flex-1 pixel-btn-amber py-1.5 text-[10px] font-pixel flex items-center justify-center gap-1 text-slate-950 font-bold"
                  title="修改 NPC 名字、性格与立绘"
                >
                  <Edit3 size={12} />
                  <span>定制该NPC/立绘</span>
                </button>
              )}

              <button
                onClick={() => {
                  setPortraitTarget(prev => prev === "npc" ? "oc" : "npc");
                  sound.playClick();
                }}
                className="pixel-btn-slate px-2.5 py-1.5 text-[10px] font-pixel text-slate-300 hover:text-white"
                title="切换展示我方/对方立绘"
              >
                🔄 切换
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* ============================================================ */}
      {/* Backlog (LOG) History Modal Drawer                            */}
      {/* ============================================================ */}
      {showLogModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-amber-500 p-5 pixel-panel pixel-border-gold shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b-2 border-slate-700 pb-3 mb-3">
              <div className="flex items-center gap-2 font-pixel text-sm text-amber-300 font-bold">
                <ScrollText size={16} />
                <span>历史对话记录 (BACKLOG)</span>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="pixel-btn-slate p-1 text-slate-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 my-2">
              {dialogueHistory.map((item, idx) => {
                const isNPC = item.sender === "npc";
                return (
                  <div
                    key={idx}
                    className={`p-3 border-l-4 ${
                      isNPC
                        ? "bg-slate-800/80 border-amber-400 text-amber-100"
                        : "bg-indigo-950/80 border-indigo-400 text-indigo-100"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-pixel mb-1 opacity-80">
                      <span className="font-bold text-amber-300">
                        【{item.speakerName}】
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {item.timestamp}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed select-text font-sans">
                      {item.text}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowLogModal(false)}
                className="pixel-btn-slate px-4 py-1.5 text-xs font-pixel text-slate-200 hover:text-white"
              >
                返回当前剧情
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
