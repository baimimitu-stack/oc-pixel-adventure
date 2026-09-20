import React, { useState } from "react";
import { SaveSlotData, ApiConfig, ApiProvider } from "../types";
import { GameStorage } from "../services/db";
import { sound } from "../services/sound";
import { callAIVerbose } from "../services/aiClient";
import { MemoryLibrary } from "./MemoryLibrary";
import { 
  Play, 
  RotateCcw, 
  Save, 
  Trash2, 
  Settings, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  X, 
  ArrowRight,
  Shield,
  Star,
  Coins,
  MessageSquare,
  Key,
  Server,
  Zap,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Send,
  RefreshCw,
  Unlock,
  Lock,
  Download,
  Share2,
  FolderArchive,
  Image as ImageIcon
} from "lucide-react";

interface MainMenuModalProps {
  currentSlot: number;
  totalStars: number;
  totalCoins: number;
  currentWorld: number;
  activeOCName?: string;
  onStartGame: () => void;
  onNewGame: () => void;
  onLoadSlot: (slotId: number) => void;
  onOpenNPCCustomizer: () => void;
  onOpenWorldSelect?: () => void;
  onClose: () => void;
  isInitialScreen?: boolean;
}

/** 每种服务商的候选模型建议列表（openai_compatible 完全自由填） */
const MODEL_PRESETS_BY_PROVIDER: Record<ApiProvider, { id: string; name: string; desc: string }[]> = {
  gemini: [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (推荐)", desc: "综合能力最强的当前 Flash 主力模型" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (稳定)", desc: "覆盖广、响应稳，适合大部分对话" },
    { id: "gemini-1.5-flash-8b", name: "Gemini 1.5 Flash-8B (轻量)", desc: "更小的推理成本，高频闲聊 NPC 首选" },
  ],
  deepseek: [
    { id: "deepseek-chat", name: "deepseek-chat (推荐·V3)", desc: "官方对话主力模型，性价比极高，中文表现出色" },
    { id: "deepseek-reasoner", name: "deepseek-reasoner (R1)", desc: "带推理链的强模型，NPC 回复更有深度，但更贵更慢" },
  ],
  openai_compatible: [
    // 空列表 —— 让用户自己填 model 名，兼容一切 OneAPI/NewAPI/OpenRouter/硅基流动/自建中转
  ],
};

/** 每种服务商的默认 baseUrl / 提示文案 */
const PROVIDER_META: Record<ApiProvider, {
  label: string; icon: string; defaultBaseUrl: string; baseUrlEditable: boolean;
  keyPlaceholder: string; keyLabel: string; baseUrlHint: string;
}> = {
  gemini: {
    label: "Google Gemini",
    icon: "✨",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    baseUrlEditable: false,
    keyPlaceholder: "粘贴你的 Gemini API Key (如 AIzaSy...)",
    keyLabel: "Gemini API Key",
    baseUrlHint: "Gemini 走官方 SDK，不需要额外 baseUrl",
  },
  deepseek: {
    label: "DeepSeek (国内直连)",
    icon: "🐬",
    defaultBaseUrl: "https://api.deepseek.com",
    baseUrlEditable: true,
    keyPlaceholder: "粘贴你的 DeepSeek API Key (如 sk-...)",
    keyLabel: "DeepSeek API Key",
    baseUrlHint: "官方地址是 https://api.deepseek.com（内部自动追加 /chat/completions）",
  },
  openai_compatible: {
    label: "OpenAI 兼容 (任何中转)",
    icon: "🔌",
    defaultBaseUrl: "https://api.openai.com/v1",
    baseUrlEditable: true,
    keyPlaceholder: "粘贴 API Key (sk-... / 中转站的 token)",
    keyLabel: "API Key",
    baseUrlHint: "填到 /v1 结尾的 baseUrl，例如 https://api.openai.com/v1、https://openrouter.ai/api/v1、你的 OneAPI/NewAPI 地址等",
  },
};

export const MainMenuModal: React.FC<MainMenuModalProps> = ({
  currentSlot,
  totalStars,
  totalCoins,
  currentWorld,
  activeOCName,
  onStartGame,
  onNewGame,
  onLoadSlot,
  onOpenNPCCustomizer,
  onOpenWorldSelect,
  onClose,
  isInitialScreen = false,
}) => {
  const [activeTab, setActiveTab] = useState<"menu" | "slots" | "settings" | "api" | "download" | "privacy" | "memory">("menu");
  const [slots, setSlots] = useState<(SaveSlotData | null)[]>(GameStorage.getSaveSlots());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(sound.enabled);
  const [volume, setVolume] = useState<number>(sound.volume);
  const [allWorldsUnlocked, setAllWorldsUnlocked] = useState<boolean>(() => GameStorage.isAllWorldsUnlocked());
  const [messageToast, setMessageToast] = useState<string | null>(null);

  // API Config State
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => GameStorage.getApiConfig());
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isTestingApi, setIsTestingApi] = useState<boolean>(false);
  const [apiTestResult, setApiTestResult] = useState<{
    success: boolean;
    message: string;
    sample?: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setMessageToast(msg);
    setTimeout(() => setMessageToast(null), 2500);
  };

  const handleSaveToSlot = (slotId: number) => {
    GameStorage.saveToSlot(slotId);
    setSlots(GameStorage.getSaveSlots());
    sound.playStar();
    showToast(`成功保存至存档槽位 ${slotId + 1}！`);
  };

  const handleLoadSlot = (slotId: number) => {
    const success = GameStorage.loadFromSlot(slotId);
    if (success) {
      sound.playStar();
      onLoadSlot(slotId);
      showToast(`已成功读取存档 ${slotId + 1}！`);
      setTimeout(() => {
        onStartGame();
      }, 300);
    } else {
      showToast("读取存档失败！");
    }
  };

  const handleDeleteSlot = (slotId: number) => {
    if (window.confirm(`确定要清空存档槽位 ${slotId + 1} 吗？`)) {
      GameStorage.deleteSaveSlot(slotId);
      setSlots(GameStorage.getSaveSlots());
      sound.playClick();
      showToast(`存档槽位 ${slotId + 1} 已清空`);
    }
  };

  const handleNewGameConfirm = () => {
    if (window.confirm("确定开始新游戏吗？这将会重置当前关卡与探险数据（原有已保存的存档槽位不受影响）。")) {
      GameStorage.resetNewGame();
      sound.playStar();
      onNewGame();
      showToast("新游戏已准备就绪！");
      setTimeout(() => {
        onStartGame();
      }, 300);
    }
  };

  const toggleSound = () => {
    const next = sound.toggle();
    setSoundEnabled(next);
    if (next) sound.playClick();
  };

  const handleToggleUnlockWorlds = () => {
    const next = !allWorldsUnlocked;
    setAllWorldsUnlocked(next);
    GameStorage.setAllWorldsUnlocked(next);
    sound.playStar();
    showToast(next ? "已解锁全部地图关卡！" : "已恢复标准星石解锁规则");
  };

  const handleSaveApiConfig = () => {
    GameStorage.saveApiConfig(apiConfig);
    sound.playStar();
    showToast("API 接口配置已保存！");
  };

  const handleTestApiConnection = async () => {
    setIsTestingApi(true);
    setApiTestResult(null);

    // 从浏览器直接发一句"你好"测通，不经过任何后端
    const provider = apiConfig.provider || "gemini";
    if (!apiConfig.apiKey || !apiConfig.apiKey.trim()) {
      sound.playHit();
      setApiTestResult({
        success: false,
        message: "请先填入 API Key。",
      });
      setIsTestingApi(false);
      return;
    }
    if (provider !== "gemini" && (!apiConfig.baseUrl || !apiConfig.baseUrl.trim())) {
      sound.playHit();
      setApiTestResult({
        success: false,
        message: "请填入 baseUrl（例如 https://api.deepseek.com）。",
      });
      setIsTestingApi(false);
      return;
    }
    if (provider === "openai_compatible" && (!apiConfig.model || !apiConfig.model.trim())) {
      sound.playHit();
      setApiTestResult({
        success: false,
        message: "请填入要用的模型名。",
      });
      setIsTestingApi(false);
      return;
    }

    try {
      const result = await callAIVerbose({
        prompt: "请回复一句简短的像素冒险欢迎语（15字以内）。",
        isJson: false,
        provider,
        apiKey: apiConfig.apiKey,
        baseUrl: apiConfig.baseUrl,
        model: apiConfig.model,
      });

      if (result.text && result.text.trim()) {
        sound.playStar();
        const updated: ApiConfig = { ...apiConfig, status: "connected" };
        setApiConfig(updated);
        GameStorage.saveApiConfig(updated);
        setApiTestResult({
          success: true,
          message: `握手成功（HTTP ${result.status ?? 200}）。`,
          sample: result.text.trim().slice(0, 60),
        });
      } else {
        sound.playHit();
        const updated: ApiConfig = { ...apiConfig, status: "error" };
        setApiConfig(updated);
        GameStorage.saveApiConfig(updated);
        const parts = [
          result.error || "AI 没有返回内容。",
          result.url ? `请求 URL：${result.url}` : "",
          result.snippet ? `返回体片段：${result.snippet}` : "",
        ].filter(Boolean);
        setApiTestResult({
          success: false,
          message: parts.join(" · "),
        });
      }
    } catch (err: any) {
      sound.playHit();
      setApiTestResult({
        success: false,
        message: err?.message || "请求出错。若浏览器控制台报 CORS 错误，该中转可能不支持浏览器直调。",
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 shadow-2xl p-6 text-slate-100 flex flex-col max-h-[90vh] pixel-panel pixel-border-gold">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl bg-slate-800 p-2 border-2 border-slate-700 pixel-border-slate">
              👑
            </div>
            <div>
              <h2 className="text-xl font-bold font-pixel text-amber-300 tracking-wider">
                像素冒险物语 · 主标题与设置
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                支持 100% 浏览器本地存储、API 接口设定与多槽位持久化
              </p>
            </div>
          </div>

          {!isInitialScreen && (
            <button
              onClick={onClose}
              className="pixel-btn-slate p-1.5 text-slate-400 hover:text-white"
              title="关闭菜单"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-slate-800">
          <button
            onClick={() => {
              setActiveTab("menu");
              sound.playClick();
            }}
            className={`flex-1 py-2 font-pixel text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "menu"
                ? "bg-amber-500 text-slate-950 font-bold pixel-btn-amber"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 pixel-btn-slate"
            }`}
          >
            <Play size={13} /> 主菜单
          </button>

          <button
            onClick={() => {
              setActiveTab("settings");
              sound.playClick();
            }}
            className={`flex-1 py-2 font-pixel text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "settings"
                ? "bg-purple-600 text-white font-bold pixel-btn-slate"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 pixel-btn-slate"
            }`}
          >
            <Settings size={13} /> 首页设置
          </button>

          <button
            onClick={() => {
              setActiveTab("api");
              sound.playClick();
            }}
            className={`flex-1 py-2 font-pixel text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "api"
                ? "bg-sky-500 text-slate-950 font-bold pixel-btn-blue text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 pixel-btn-slate"
            }`}
          >
            <Key size={13} /> API 接口
          </button>

          <button
            onClick={() => {
              setActiveTab("slots");
              sound.playClick();
            }}
            className={`flex-1 py-2 font-pixel text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "slots"
                ? "bg-emerald-600 text-white font-bold pixel-btn-green"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 pixel-btn-slate"
            }`}
          >
            <Save size={13} /> 存档管理
          </button>

          <button
            onClick={() => {
              setActiveTab("download");
              sound.playClick();
            }}
            className={`flex-1 py-2 font-pixel text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "download"
                ? "bg-amber-400 text-slate-950 font-bold pixel-btn-amber"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 pixel-btn-slate"
            }`}
          >
            <Download size={13} /> 源码下载
          </button>

          <button
            onClick={() => {
              setActiveTab("privacy");
              sound.playClick();
            }}
            className={`flex-1 py-2 font-pixel text-xs transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "privacy"
                ? "bg-emerald-500 text-slate-950 font-bold pixel-btn-green"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 pixel-btn-slate"
            }`}
          >
            <Shield size={13} /> 隐私中心
          </button>
        </div>

        <button onClick={() => setActiveTab("memory")} className={`shrink-0 py-2 mt-2 text-xs font-pixel ${activeTab === "memory" ? "pixel-btn-amber" : "pixel-btn-slate"}`}>
          📖 记忆库 · 对话与永久记忆
        </button>
        {activeTab === "memory" && <MemoryLibrary currentWorld={currentWorld} />}

        {/* 1. Main Menu Tab */}
        {activeTab === "menu" && (
          <div className="flex-1 overflow-y-auto py-5 space-y-4">
            {/* Current Game Status Pill */}
            <div className="bg-slate-950/80 p-4 border-2 border-slate-800 pixel-border-slate flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-pixel uppercase">当前探险状态</span>
                <h3 className="text-sm font-bold text-amber-300 font-pixel mt-0.5">
                  世界 {currentWorld} · 角色: {activeOCName || "冒险者"}
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs font-pixel">
                <span className="text-amber-400 flex items-center gap-1">🪙 {totalCoins}</span>
                <span className="text-sky-400 flex items-center gap-1">⭐ {totalStars}</span>
              </div>
            </div>

            {/* Menu Buttons */}
            <div className="flex flex-col gap-3 pt-1">
              {/* Continue */}
              <button
                onClick={() => {
                  sound.playStar();
                  onStartGame();
                }}
                className="w-full py-3.5 px-6 pixel-btn-green font-pixel text-sm font-bold flex items-center justify-between group shadow-lg hover:brightness-110"
              >
                <div className="flex items-center gap-3">
                  <Play size={18} className="fill-current" />
                  <span>继续探险 (CONTINUE)</span>
                </div>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              {/* New Game */}
              <button
                onClick={handleNewGameConfirm}
                className="w-full py-3.5 px-6 pixel-btn-blue font-pixel text-sm font-bold flex items-center justify-between group shadow-lg hover:brightness-110 text-white"
              >
                <div className="flex items-center gap-3">
                  <RotateCcw size={18} />
                  <span>新游戏 (NEW GAME)</span>
                </div>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Quick Jump to API Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => {
                    setActiveTab("settings");
                    sound.playClick();
                  }}
                  className="py-3 px-4 pixel-btn-slate font-pixel text-xs text-amber-300 flex items-center justify-center gap-2 hover:bg-slate-800"
                >
                  <Settings size={15} className="text-amber-400" />
                  <span>首页设置 (API / NPC / 规则)</span>
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    onOpenNPCCustomizer();
                  }}
                  className="py-3 px-4 pixel-btn-amber font-pixel text-xs text-slate-950 font-bold flex items-center justify-center gap-2"
                >
                  <MessageSquare size={15} />
                  <span>NPC 改变与立绘定制</span>
                </button>
              </div>

              {onOpenWorldSelect && (
                <button
                  onClick={() => {
                    sound.playClick();
                    onOpenWorldSelect();
                  }}
                  className="py-2.5 px-4 pixel-btn-slate font-pixel text-xs text-sky-300 flex items-center justify-center gap-2 hover:bg-slate-800"
                >
                  <span>🗺️ 切换冒险世界地图 (关卡选择)</span>
                </button>
              )}

              {/* Direct Code Package Quick Download Button */}
              <button
                onClick={() => {
                  setActiveTab("download");
                  sound.playClick();
                }}
                className="py-2.5 px-4 bg-amber-950/40 border border-amber-500/40 hover:bg-amber-900/40 font-pixel text-xs text-amber-300 flex items-center justify-center gap-2"
              >
                <FolderArchive size={14} className="text-amber-400" />
                <span>📦 源码总和包与分享链接 (直接下载修改/发给好友)</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Settings Tab (Requested by user: API & NPC inside Settings!) */}
        {activeTab === "settings" && (
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            
            {/* NPC Setting Entry in Settings */}
            <div className="p-4 bg-slate-950/80 border-2 border-slate-800 pixel-border-slate flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-amber-300 font-pixel">NPC 改变与立绘设定</h4>
                  <span className="text-[10px] bg-amber-950 text-amber-300 px-2 py-0.5 border border-amber-500/40 font-pixel">
                    支持立绘上传
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  更改驻场 NPC 名字、身份头衔、登场初始台词，并上传专属全身立绘！
                </p>
              </div>
              <button
                onClick={() => {
                  sound.playClick();
                  onOpenNPCCustomizer();
                }}
                className="pixel-btn-amber px-4 py-2 font-pixel text-xs flex items-center gap-1.5 text-slate-950 font-bold shrink-0"
              >
                <MessageSquare size={13} />
                <span>进入 NPC 定制</span>
              </button>
            </div>

            {/* API Quick Access Card in Settings */}
            <div className="p-4 bg-slate-950/80 border-2 border-slate-800 pixel-border-blue flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-sky-300 font-pixel">API 接口与智能模型</h4>
                  <span className={`text-[10px] font-pixel px-2 py-0.5 border ${
                    apiConfig.status === "connected"
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}>
                    {apiConfig.status === "connected" ? "● API 已就绪" : "○ 未连接/使用环境配置"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  配置 Gemini API Key，激活 NPC 智能多轮对话、情感波动与动态随机剧情
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveTab("api");
                  sound.playClick();
                }}
                className="pixel-btn-blue px-4 py-2 font-pixel text-xs flex items-center gap-1.5 text-white font-bold shrink-0"
              >
                <Key size={13} />
                <span>配置 API 接口</span>
              </button>
            </div>

            {/* All Worlds Unlock Toggle */}
            <div className="p-4 bg-slate-950/80 border-2 border-slate-800 pixel-border-slate flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-amber-300 font-pixel">地图关卡解锁权限</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  开启后可直接畅玩世界 1~4 全部关卡，无需收集前置星星
                </p>
              </div>
              <button
                onClick={handleToggleUnlockWorlds}
                className={`px-3 py-1.5 font-pixel text-xs flex items-center gap-1.5 ${
                  allWorldsUnlocked ? "pixel-btn-amber text-slate-950 font-bold" : "pixel-btn-slate text-slate-300"
                }`}
              >
                {allWorldsUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
                <span>{allWorldsUnlocked ? "全部地图已解锁" : "按星星逐步解锁"}</span>
              </button>
            </div>

            {/* Sound Toggle */}
            <div className="p-4 bg-slate-950/80 border-2 border-slate-800 pixel-border-slate flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-amber-300 font-pixel">游戏音效</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  开启或关闭跳跃、金币、踩扁怪物等 8-bit 复古像素音效
                </p>
              </div>
              <button
                onClick={toggleSound}
                className={`px-3 py-1.5 font-pixel text-xs flex items-center gap-1.5 ${
                  soundEnabled ? "pixel-btn-green" : "pixel-btn-slate text-red-400"
                }`}
              >
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span>{soundEnabled ? "已开启" : "已静音"}</span>
              </button>
            </div>

            <div className="p-4 pixel-border-slate space-y-3" style={{ background: "#fff1d6", color: "#3a2410" }}>
              <div className="flex items-center justify-between text-xs font-pixel">
                <label htmlFor="game-volume">音效音量</label>
                <output htmlFor="game-volume">{Math.round(volume * 100)}%</output>
              </div>
              <input
                id="game-volume"
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(volume * 100)}
                aria-valuetext={`${Math.round(volume * 100)}%`}
                onChange={(event) => {
                  const next = Number(event.target.value) / 100;
                  sound.setVolume(next);
                  setVolume(next);
                }}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <p className="text-[11px]" style={{ color: "#6b4a2b" }}>
                {!soundEnabled ? "音效已关闭，开启后使用此音量。" : volume === 0 ? "当前音量为 0，游戏无声。" : "立即生效，自动记住你的音量。"}
              </p>
            </div>

            {/* Privacy & Safe */}
            <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs flex items-center gap-2">
              <Shield size={16} className="text-indigo-400 shrink-0" />
              <span>纯本地浏览器存储，无外部云端追踪，随时可导出备份。</span>
            </div>
          </div>
        )}

        {/* 3. API Tab —— 支持 Gemini / DeepSeek / OpenAI 兼容三种服务商 */}
        {activeTab === "api" && (() => {
          const currentProvider: ApiProvider = apiConfig.provider || "gemini";
          const meta = PROVIDER_META[currentProvider];
          const presetModels = MODEL_PRESETS_BY_PROVIDER[currentProvider];
          return (
          <div className="flex-1 overflow-y-auto py-4 space-y-4">

            {/* 服务商切换：三个大按钮 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold font-pixel flex items-center gap-1.5" style={{ color: "#b45309" }}>
                <Server size={13} />
                <span>选择 AI 服务商</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(Object.keys(PROVIDER_META) as ApiProvider[]).map((p) => {
                  const m = PROVIDER_META[p];
                  const active = p === currentProvider;
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        const newMeta = PROVIDER_META[p];
                        const newPresets = MODEL_PRESETS_BY_PROVIDER[p];
                        setApiConfig({
                          ...apiConfig,
                          provider: p,
                          baseUrl: newMeta.baseUrlEditable ? (apiConfig.baseUrl && apiConfig.provider === p ? apiConfig.baseUrl : newMeta.defaultBaseUrl) : newMeta.defaultBaseUrl,
                          model: newPresets[0]?.id || "",
                        });
                        setApiTestResult(null);
                        sound.playClick();
                      }}
                      className={`p-3 border-2 text-left transition-all font-pixel ${
                        active ? "pixel-border-gold" : "pixel-border-slate hover:brightness-105"
                      }`}
                      style={{
                        background: active ? "#fef3c7" : "#fff1d6",
                        color: "#3a2410",
                      }}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <span className="text-base">{m.icon}</span>
                        <span>{m.label}</span>
                      </div>
                      {active && (
                        <div className="text-[10px] mt-1" style={{ color: "#b45309" }}>● 当前选用</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* baseUrl 输入（Gemini 隐藏） */}
            {meta.baseUrlEditable && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold font-pixel flex items-center gap-1.5" style={{ color: "#b45309" }}>
                  <Server size={13} />
                  <span>接口 baseUrl</span>
                </label>
                <input
                  type="text"
                  value={apiConfig.baseUrl}
                  onChange={(e) => {
                    setApiConfig({ ...apiConfig, baseUrl: e.target.value });
                    setApiTestResult(null);
                  }}
                  placeholder={meta.defaultBaseUrl}
                  className="w-full py-2.5 px-3 text-xs outline-none font-mono pixel-border-slate"
                  style={{ background: "#fff", color: "#3a2410" }}
                />
                <p className="text-[11px]" style={{ color: "#6b4a2b" }}>
                  💡 {meta.baseUrlHint}
                </p>
              </div>
            )}

            {/* API Key 输入 */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold font-pixel flex items-center gap-1.5" style={{ color: "#b45309" }}>
                <Key size={13} />
                <span>{meta.keyLabel}</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiConfig.apiKey}
                  onChange={(e) => {
                    setApiConfig({ ...apiConfig, apiKey: e.target.value });
                    setApiTestResult(null);
                  }}
                  placeholder={meta.keyPlaceholder}
                  className="w-full py-2.5 pl-3 pr-20 text-xs outline-none font-mono pixel-border-slate"
                  style={{ background: "#fff", color: "#3a2410" }}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 px-2 py-1 text-xs flex items-center gap-1"
                  style={{ color: "#6b4a2b" }}
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span className="text-[10px]">{showApiKey ? "隐藏" : "查看"}</span>
                </button>
              </div>
              {currentProvider === "gemini" && (
                <p className="text-[11px]" style={{ color: "#6b4a2b" }}>
                  * 若留空，游戏将自动使用后台环境变量中的 GEMINI_API_KEY。
                </p>
              )}
            </div>

            {/* 模型选择：有预设的用按钮，openai_compatible 用输入框 */}
            <div className="space-y-2">
              <label className="block text-xs font-bold font-pixel flex items-center gap-1.5" style={{ color: "#b45309" }}>
                <Zap size={13} />
                <span>{currentProvider === "openai_compatible" ? "模型名（手动填写）" : "推理模型"}</span>
              </label>

              {currentProvider === "openai_compatible" ? (
                <>
                  <input
                    type="text"
                    value={apiConfig.model || ""}
                    onChange={(e) => setApiConfig({ ...apiConfig, model: e.target.value })}
                    placeholder="例如 gpt-4o-mini / claude-3-5-sonnet / Qwen/Qwen2.5-72B-Instruct"
                    className="w-full py-2.5 px-3 text-xs outline-none font-mono pixel-border-slate"
                    style={{ background: "#fff", color: "#3a2410" }}
                  />
                  <p className="text-[11px]" style={{ color: "#6b4a2b" }}>
                    💡 填你在中转站/OpenRouter 上能访问到的模型 ID，大小写要一致
                  </p>
                </>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {presetModels.map((m) => {
                    const isSelected = (apiConfig.model || presetModels[0]?.id) === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setApiConfig({ ...apiConfig, model: m.id })}
                        className={`p-3 border-2 cursor-pointer transition-all flex items-start justify-between pixel-border-slate ${
                          isSelected ? "ring-2 ring-amber-500" : ""
                        }`}
                        style={{ background: isSelected ? "#fef3c7" : "#fff1d6", color: "#3a2410" }}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs font-pixel">{m.name}</span>
                            {isSelected && (
                              <span className="text-[10px] px-1.5 py-0.5 font-pixel" style={{ background: "#b45309", color: "#fff" }}>
                                当前选用
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] mt-1" style={{ color: "#6b4a2b" }}>{m.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Test Connection */}
            <div className="p-3.5 border-2 pixel-border-slate space-y-3" style={{ background: "#fff1d6" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold font-pixel" style={{ color: "#3a2410" }}>接口联通测试</h4>
                  <p className="text-[11px] mt-0.5" style={{ color: "#6b4a2b" }}>
                    向 {meta.label} 发起即时连通测试（发一句"你好"看能否收到回复）
                  </p>
                </div>
                <button
                  onClick={handleTestApiConnection}
                  disabled={isTestingApi}
                  className="pixel-btn-amber px-4 py-2 text-xs font-pixel flex items-center gap-1.5 font-bold disabled:opacity-50"
                  style={{ color: "#3a2410" }}
                >
                  {isTestingApi ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>{isTestingApi ? "测试中..." : "测试连接"}</span>
                </button>
              </div>

              {apiTestResult && (
                <div
                  className="p-3 border text-xs"
                  style={{
                    background: apiTestResult.success ? "#dcfce7" : "#fee2e2",
                    borderColor: apiTestResult.success ? "#15803d" : "#b91c1c",
                    color: apiTestResult.success ? "#052e16" : "#7f1d1d",
                  }}
                >
                  <div className="flex items-center gap-1.5 font-bold font-pixel">
                    {apiTestResult.success ? (
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle size={15} className="text-red-600 shrink-0" />
                    )}
                    <span>{apiTestResult.message}</span>
                  </div>
                  {apiTestResult.sample && (
                    <p className="mt-1 text-[11px] font-mono p-2 border" style={{ background: "#fff", borderColor: "#15803d", color: "#052e16" }}>
                      回复采样: "{apiTestResult.sample}"
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleSaveApiConfig}
                className="pixel-btn-green px-5 py-2 font-pixel text-xs font-bold flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} /> 保存 API 配置
              </button>
            </div>
          </div>
          );
        })()}

        {/* 4. Save Slots Tab */}
        {activeTab === "slots" && (
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            <p className="text-xs text-slate-400 font-pixel">
              提供 3 个独立持久化存档槽位，随时备份你的探险进度与角色数据：
            </p>

            <div className="space-y-3">
              {[0, 1, 2].map((slotIdx) => {
                const slot = slots[slotIdx];
                return (
                  <div
                    key={slotIdx}
                    className="p-3.5 bg-slate-950/80 border-2 border-slate-800 pixel-border-slate flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-pixel text-xs font-bold text-sky-400">
                          槽位 {slotIdx + 1}
                        </span>
                        {slot ? (
                          <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 border border-emerald-500/40 font-pixel">
                            {slot.name}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 font-pixel">
                            空存档槽位
                          </span>
                        )}
                      </div>

                      {slot ? (
                        <div className="mt-1 text-xs text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
                          <span>角色: <strong>{slot.activeOCName}</strong></span>
                          <span>世界: <strong>{slot.currentWorld}</strong></span>
                          <span>🪙 {slot.totalCoins}</span>
                          <span>⭐ {slot.totalStars}</span>
                          <span className="text-slate-400 text-[10px]">
                            {new Date(slot.savedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-1">
                          暂无存储记录，可将当前游戏进度保存至此
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => handleSaveToSlot(slotIdx)}
                        className="pixel-btn-amber px-2.5 py-1.5 text-xs flex items-center gap-1 font-pixel text-[11px]"
                        title="将当前进度保存至该槽位"
                      >
                        <Save size={12} /> 覆盖保存
                      </button>

                      {slot && (
                        <>
                          <button
                            onClick={() => handleLoadSlot(slotIdx)}
                            className="pixel-btn-green px-2.5 py-1.5 text-xs flex items-center gap-1 font-pixel text-[11px]"
                            title="从该槽位载入游戏"
                          >
                            <Play size={12} /> 读取
                          </button>
                          <button
                            onClick={() => handleDeleteSlot(slotIdx)}
                            className="pixel-btn-slate p-1.5 text-red-400 hover:text-red-300"
                            title="删除此存档"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Share Tab —— 纯静态部署，分享 URL 即可 */}
        {activeTab === "download" && (
          <div className="flex-1 overflow-y-auto py-4 space-y-4">

            <div className="p-4 border-2 pixel-border-gold space-y-2" style={{ background: "#fef3c7" }}>
              <div className="flex items-center gap-2" style={{ color: "#b45309" }}>
                <Share2 size={20} className="shrink-0" />
                <h3 className="font-pixel text-sm font-bold">分享给朋友一起玩</h3>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#3a2410" }}>
                本站是纯静态 SPA，无需安装环境，把这个链接发给朋友，点开就能玩：
              </p>
            </div>

            <div className="p-3 border-2 pixel-border-slate flex items-center gap-2" style={{ background: "#fff1d6" }}>
              <input
                type="text"
                readOnly
                value={typeof window !== "undefined" ? window.location.href.split("?")[0].split("#")[0] : ""}
                className="flex-1 py-2 px-3 text-xs font-mono outline-none"
                style={{ background: "#fff", color: "#3a2410", border: "2px solid #d1a86c" }}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                onClick={() => {
                  const url = window.location.href.split("?")[0].split("#")[0];
                  navigator.clipboard.writeText(url);
                  sound.playClick();
                  showToast("链接已复制！");
                }}
                className="pixel-btn-blue px-3 py-2 text-xs font-pixel shrink-0"
              >
                复制链接
              </button>
            </div>

            <div className="p-3 text-[11px] leading-relaxed pixel-border-slate" style={{ background: "#f0fdf4", color: "#052e16" }}>
              💡 想让 AI 对话变智能？让朋友在"API 接口" tab 里填自己的 <strong>DeepSeek</strong> 或 <strong>Gemini</strong> API Key。<br/>
              没有 Key 也能玩，NPC 会用内置的离线台词模板。
            </div>

            <div className="p-3 text-[11px] leading-relaxed pixel-border-slate" style={{ background: "#fff1d6", color: "#3a2410" }}>
              📦 想本地跑源码？git clone 后 <code>npm install && npm run dev</code>。构建部署：<code>npm run build</code> 生成 <code>dist/</code> 静态目录，扔到任何静态服务器即可。
            </div>
          </div>
        )}

        {/* 6. 隐私中心 Tab —— 上传的图片仅在本机 */}
        {activeTab === "privacy" && (
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            <div className="p-4 border-2 pixel-border-green" style={{ background: "#f0fdf4", borderColor: "#15803d" }}>
              <div className="flex items-center gap-2 mb-2">
                <Shield size={18} className="text-emerald-600" />
                <h3 className="font-pixel text-sm font-bold" style={{ color: "#14532d" }}>
                  你上传的图片、API Key 只存在这台设备
                </h3>
              </div>
              <ul className="text-xs leading-relaxed space-y-1.5 list-disc list-inside" style={{ color: "#052e16" }}>
                <li>OC 头像、OC 立绘、NPC 立绘全部作为 <strong>base64</strong> 存进浏览器 <strong>localStorage</strong>。</li>
                <li>本站是 <strong>纯静态 SPA，没有后端服务器</strong>。AI 请求由你的浏览器<strong>直接发到 Google / DeepSeek / OpenAI 兼容端点</strong>，站长这边看不到你的对白也看不到你的 Key。</li>
                <li>AI 请求体<strong>只含文字</strong>（角色设定、你输入的对白、当前关系的永久记忆和最近 6 条记录），<strong>从不发送你上传的图片</strong>。记忆随对话发到你配置的 AI 服务商。</li>
                <li>API Key 只在本机 localStorage 里；下面按钮可一键抹除。</li>
              </ul>
            </div>

            {/* 当前本地占用统计 */}
            <div className="p-3 pixel-border-slate" style={{ background: "#fff1d6" }}>
              <div className="flex items-center justify-between text-xs font-pixel">
                <span style={{ color: "#3a2410" }}>当前本机上传图片占用</span>
                <span style={{ color: "#b45309" }} className="font-bold">
                  ≈ {(GameStorage.estimateUploadedBytes() / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>

            {/* 三个抹除按钮 */}
            <div className="space-y-2.5">
              <button
                onClick={() => {
                  if (window.confirm("确认清除所有你上传过的头像和立绘图片吗？\n（角色和文字设定会保留，只删图片；无法撤销）")) {
                    const stats = GameStorage.wipeAllUploadedImages();
                    sound.playStar();
                    showToast(`已抹除 ${stats.ocAvatars} 张头像、${stats.ocPortraits} 张 OC 立绘、${stats.npcPortraits} 张 NPC 立绘`);
                  }
                }}
                className="w-full pixel-btn-amber py-2.5 px-4 font-pixel text-xs flex items-center justify-between gap-2 font-bold"
                style={{ color: "#3a2410" }}
              >
                <span className="flex items-center gap-2">
                  <ImageIcon size={14} />
                  一键抹除所有上传图片
                </span>
                <span className="text-[10px] opacity-80">不可恢复</span>
              </button>

              <button
                onClick={() => {
                  if (window.confirm("确认清除保存的 Gemini API Key？\n（NPC AI 对话会自动回退到离线模板引擎）")) {
                    GameStorage.wipeApiKey();
                    setApiConfig(GameStorage.getApiConfig());
                    sound.playStar();
                    showToast("已抹除本机保存的 API Key");
                  }
                }}
                className="w-full pixel-btn-slate py-2.5 px-4 font-pixel text-xs flex items-center justify-between gap-2"
                style={{ color: "#3a2410" }}
              >
                <span className="flex items-center gap-2">
                  <Key size={14} />
                  抹除保存的 API Key
                </span>
                <span className="text-[10px] opacity-80">不可恢复</span>
              </button>

              <button
                onClick={() => {
                  if (window.confirm("⚠️ 危险操作 ⚠️\n\n这会清空本机所有游戏数据：\n- 全部 OC 角色和上传的头像/立绘\n- 全部 NPC 定制\n- 3 个存档槽位\n- 成就 / 金币 / 星星 / 进度\n- API Key\n\n刷新后回到全新状态，无法撤销。\n\n确认继续？")) {
                    GameStorage.wipeEverything();
                    sound.playHit();
                    showToast("本机所有数据已清空，请刷新页面");
                    setTimeout(() => window.location.reload(), 1200);
                  }
                }}
                className="w-full py-2.5 px-4 font-pixel text-xs flex items-center justify-between gap-2 font-bold pixel-border-slate"
                style={{ background: "#fecaca", color: "#7f1d1d" }}
              >
                <span className="flex items-center gap-2">
                  <Trash2 size={14} />
                  一键清空本机全部游戏数据
                </span>
                <span className="text-[10px] opacity-80">刷新即回全新状态</span>
              </button>
            </div>

            <div className="p-3 text-[11px] leading-relaxed pixel-border-slate" style={{ background: "#fffbeb", color: "#78350f" }}>
              💡 想更彻底：直接在浏览器"清除本站数据"里清 <code>localStorage</code> 即可。或者用无痕模式玩，关掉窗口就自动清光。
            </div>
          </div>
        )}

        {/* Message Toast */}
        {messageToast && (
          <div className="bg-amber-500 text-slate-950 font-pixel text-xs px-3 py-2 text-center border-2 border-amber-300 shadow-xl my-2 animate-bounce">
            {messageToast}
          </div>
        )}

        {/* Bottom Footer Action */}
        <div className="border-t-2 border-slate-800 pt-4 flex items-center justify-between mt-auto">
          <span className="text-[10px] text-slate-400 font-pixel">
            VER 2.5 · RETRO PLATFORMER ENGINE
          </span>
          <button
            onClick={() => {
              sound.playStar();
              onStartGame();
            }}
            className="pixel-btn-blue font-pixel text-xs px-5 py-2 text-white font-bold flex items-center gap-1.5"
          >
            <Play size={13} className="fill-white" /> 进入游戏
          </button>
        </div>

      </div>
    </div>
  );
};
