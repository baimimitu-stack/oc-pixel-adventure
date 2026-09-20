import React, { useState, useEffect, useCallback, useMemo } from "react";
import { OCCharacter, LevelConfig, Achievement } from "./types";
import { GameStorage } from "./services/db";
import { getLevelByWorld } from "./game/levels";
import { sound } from "./services/sound";
import { GameCanvas } from "./game/GameCanvas";
import { OCStudio } from "./components/OCStudio";
import { AppearanceShop } from "./components/AppearanceShop";
import { StoryDialogueModal } from "./components/StoryDialogueModal";
import { AchievementModal } from "./components/AchievementModal";
import { WorldSelectModal } from "./components/WorldSelectModal";
import { MainMenuModal } from "./components/MainMenuModal";
import { NPCCustomizerModal } from "./components/NPCCustomizerModal";
import { 
  Sparkles, 
  Trophy, 
  Map, 
  MessageSquare, 
  Users, 
  Coins, 
  Star, 
  ShieldCheck, 
  HelpCircle,
  RotateCcw,
  Menu,
  Download
} from "lucide-react";

export default function App() {
  const [ocs, setOcs] = useState<OCCharacter[]>([]);
  const [activeOC, setActiveOC] = useState<OCCharacter | null>(null);
  const [currentWorld, setCurrentWorld] = useState<number>(1);
  const [totalCoins, setTotalCoins] = useState<number>(25);
  const [totalStars, setTotalStars] = useState<number>(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  // Main menu gates initial view as requested by user
  const [inGame, setInGame] = useState<boolean>(false);
  const [showMainMenu, setShowMainMenu] = useState<boolean>(true);
  const [showNPCCustomizer, setShowNPCCustomizer] = useState<boolean>(false);

  // Modals
  const [showOCStudio, setShowOCStudio] = useState<boolean>(false);
  const [showShop, setShowShop] = useState<boolean>(false);
  const [showStory, setShowStory] = useState<boolean>(false);
  const [showAchievements, setShowAchievements] = useState<boolean>(false);
  const [showWorldSelect, setShowWorldSelect] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);

  // Floating unlock toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Sync data from local storage
  const refreshData = useCallback(() => {
    const loadedOcs = GameStorage.getOCs();
    const currentActive = GameStorage.getActiveOC();
    const coins = GameStorage.getTotalCoins();
    const stars = GameStorage.getTotalStars();
    const achs = GameStorage.getAchievements();

    setOcs(loadedOcs);
    setActiveOC(currentActive);
    setTotalCoins(coins);
    setTotalStars(stars);
    setAchievements(achs);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Memoize level configuration so it only updates when currentWorld changes
  const currentLevelConfig = useMemo(() => getLevelByWorld(currentWorld), [currentWorld]);

  const isModalOpen = !inGame || showMainMenu || showNPCCustomizer || showOCStudio || showShop || showStory || showAchievements || showWorldSelect;

  const handleLevelComplete = (stats: { coins: number; stars: number; score: number }) => {
    refreshData();
    showToast(`🎉 关卡通关！吃得 ${stats.coins} 金币，收获 ${stats.stars} 颗探险之星！`);
  };

  if (!activeOC) {
    return (
      <div className="flex h-screen items-center justify-center bg-sunny ink font-pixel">
        Loading Adventure...
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen flex flex-col bg-sunny ink overflow-hidden font-sans">

      {/* Top Application Navigation Bar with Retro Pixel Borders */}
      <header className="h-14 border-b-4 border-amber-700/70 px-4 flex items-center justify-between z-30 shrink-0 select-none pixel-border-slate" style={{ background: "linear-gradient(180deg, #ffe4b5 0%, #ffd58a 100%)" }}>
        
        {/* Brand & Active OC Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <h1 className="font-pixel text-xs sm:text-sm font-bold text-amber-400">
              OC ADVENTURE
            </h1>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          {/* Active OC Display & Switch Button */}
          <button
            onClick={() => {
              setShowOCStudio(true);
              sound.playClick();
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 transition-all shadow-sm active:scale-95 pixel-border-slate"
            title="更换或管理本地OC角色"
          >
            <img
              src={activeOC.avatarUrl}
              alt={activeOC.name}
              className="w-6 h-6 object-contain bg-slate-900 border border-amber-400/60"
            />
            <span className="text-xs font-bold text-amber-300 max-w-[90px] truncate font-pixel">
              {activeOC.name}
            </span>
            <span className="text-[10px] bg-slate-900 text-slate-400 px-1 py-0.2 hidden md:inline">
              切换
            </span>
          </button>
        </div>

        {/* Action Controls & Resource Counters */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Total Coins */}
          <div
            onClick={() => setShowShop(true)}
            className="flex items-center gap-1.5 bg-amber-950/70 text-amber-300 px-2.5 py-1 text-xs font-bold cursor-pointer transition-all shadow-sm pixel-border-gold"
            title="点击前往吃金币外观升级"
          >
            <Coins size={14} className="text-amber-400" />
            <span className="font-pixel text-xs">{totalCoins}</span>
          </div>

          {/* Total Stars */}
          <div
            onClick={() => setShowWorldSelect(true)}
            className="flex items-center gap-1.5 bg-sky-950/70 text-sky-300 px-2.5 py-1 text-xs font-bold cursor-pointer transition-all shadow-sm pixel-border-blue"
            title="点击前往大地图解锁关卡"
          >
            <Star size={14} className="fill-sky-400 text-sky-400" />
            <span className="font-pixel text-xs">{totalStars}</span>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setShowOCStudio(true);
                sound.playClick();
              }}
              className="pixel-btn-slate flex items-center gap-1 text-slate-200 px-2.5 py-1.5 text-xs"
              title="本地OC角色库"
            >
              <Users size={14} className="text-amber-400" />
              <span className="hidden sm:inline font-pixel text-[11px]">角色库</span>
            </button>

            <button
              onClick={() => {
                setShowShop(true);
                sound.playClick();
              }}
              className="pixel-btn-amber flex items-center gap-1 px-2.5 py-1.5 text-xs"
              title="吃金币升级外观"
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline font-pixel text-[11px]">外观装扮</span>
            </button>

            <button
              onClick={() => {
                setShowWorldSelect(true);
                sound.playClick();
              }}
              className="pixel-btn-blue flex items-center gap-1 text-white px-2.5 py-1.5 text-xs"
              title="大地图与关卡选择"
            >
              <Map size={14} />
              <span className="hidden sm:inline font-pixel text-[11px]">大地图</span>
            </button>

            <button
              onClick={() => {
                setShowAchievements(true);
                sound.playClick();
              }}
              className="pixel-btn-slate flex items-center gap-1 text-slate-200 px-2.5 py-1.5 text-xs"
              title="成就殿堂"
            >
              <Trophy size={14} className="text-amber-400" />
              <span className="hidden md:inline font-pixel text-[11px]">成就</span>
            </button>

            <button
              onClick={() => {
                setShowStory(true);
                sound.playClick();
              }}
              className="pixel-btn-slate flex items-center gap-1 text-slate-200 px-2.5 py-1.5 text-xs"
              title="篝火剧情对话"
            >
              <MessageSquare size={14} className="text-indigo-400" />
              <span className="hidden md:inline font-pixel text-[11px]">剧情</span>
            </button>

            <button
              onClick={() => {
                setShowNPCCustomizer(true);
                sound.playClick();
              }}
              className="pixel-btn-slate flex items-center gap-1 text-slate-200 px-2.5 py-1.5 text-xs"
              title="自定义各关卡 NPC 与台词"
            >
              <span className="text-xs">🎭</span>
              <span className="hidden lg:inline font-pixel text-[11px]">改NPC</span>
            </button>

            <a
              href="/pixel-adventure-project.zip"
              download="pixel-adventure-project.zip"
              onClick={() => {
                sound.playStar();
                showToast("📦 完整代码包已开始下载！包含全部源码与运行指南");
              }}
              className="pixel-btn-green flex items-center gap-1 text-slate-950 font-bold px-2.5 py-1.5 text-xs hover:brightness-110 shadow-sm"
              title="一键下载完整工程代码包 (直接改代码/分享给好友)"
            >
              <Download size={14} />
              <span className="hidden sm:inline font-pixel text-[11px]">下载源码包</span>
            </a>

            <button
              onClick={() => {
                setShowMainMenu(true);
                sound.playClick();
              }}
              className="pixel-btn-amber flex items-center gap-1 text-slate-950 font-bold px-2.5 py-1.5 text-xs"
              title="打开主菜单 / 存档设置"
            >
              <Menu size={14} />
              <span className="font-pixel text-[11px]">主菜单</span>
            </button>

            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="pixel-btn-slate p-1.5 text-slate-300"
              title="游戏玩法提示"
            >
              <HelpCircle size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Instructions Dropdown */}
      {showInstructions && (
        <div className="bg-slate-900 border-b-2 border-slate-700 px-4 py-3 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3 animate-fade-in z-20 pixel-panel">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-amber-300 font-bold font-pixel">🎮 操作说明:</span>
            <span>方向键 <strong>◀ ▶</strong> 或 <strong>A/D</strong> 移动</span>
            <span>⬇ 或 <strong>S</strong> 下蹲 / 窄缝滑行</span>
            <span><strong>空格键 / W / ⬆</strong> 跳跃 / 二段跳</span>
            <span>靠近篝火/NPC 按 <strong>[E]</strong> 剧情互动</span>
            <span>支持屏幕底部触屏与点击虚拟摇杆</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400 text-[11px]">
            <ShieldCheck size={14} /> 纯本地 IndexedDB 存储，图片绝不上云
          </div>
        </div>
      )}

      {/* Main Canvas Gameplay Area */}
      <main className="flex-1 relative w-full h-full overflow-hidden flex flex-col items-center justify-center">
        <GameCanvas
          level={currentLevelConfig}
          activeOC={activeOC}
          isPaused={isModalOpen}
          onLevelComplete={handleLevelComplete}
          onOpenShop={() => setShowShop(true)}
          onOpenStory={() => setShowStory(true)}
          onBackToMap={() => setShowWorldSelect(true)}
        />
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-bold font-pixel text-xs px-4 py-2.5 rounded-2xl shadow-2xl border-2 border-amber-300 animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Modals */}
      {showOCStudio && (
        <OCStudio
          ocs={ocs}
          activeOC={activeOC}
          onSelectOC={(newOC) => {
            setActiveOC(newOC);
            GameStorage.setActiveOCId(newOC.id);
            refreshData();
          }}
          onRefreshOCs={refreshData}
          onBackToMainMenu={() => {
            setShowOCStudio(false);
            setShowMainMenu(true);
          }}
          onClose={() => setShowOCStudio(false)}
        />
      )}

      {showShop && (
        <AppearanceShop
          activeOC={activeOC}
          totalCoins={totalCoins}
          onRefreshData={refreshData}
          onClose={() => setShowShop(false)}
        />
      )}

      {showStory && (
        <StoryDialogueModal
          activeOC={activeOC}
          npc={currentLevelConfig.npc}
          worldName={currentLevelConfig.name}
          onRefreshData={refreshData}
          onOpenCustomizer={() => setShowNPCCustomizer(true)}
          onBackToMainMenu={() => {
            setShowStory(false);
            setShowMainMenu(true);
          }}
          onClose={() => setShowStory(false)}
        />
      )}

      {showAchievements && (
        <AchievementModal
          achievements={achievements}
          totalStars={totalStars}
          totalCoins={totalCoins}
          onClose={() => setShowAchievements(false)}
        />
      )}

      {showWorldSelect && (
        <WorldSelectModal
          totalStars={totalStars}
          currentWorld={currentWorld}
          onSelectWorld={(wNum) => {
            setCurrentWorld(wNum);
            refreshData();
          }}
          onOpenNPCCustomizer={() => setShowNPCCustomizer(true)}
          onBackToMainMenu={() => {
            setShowWorldSelect(false);
            setShowMainMenu(true);
          }}
          onClose={() => setShowWorldSelect(false)}
        />
      )}

      {/* Main Menu & Save Slots Modal (Gates start screen as requested) */}
      {showMainMenu && (
        <MainMenuModal
          currentSlot={0}
          totalStars={totalStars}
          totalCoins={totalCoins}
          currentWorld={currentWorld}
          activeOCName={activeOC?.name}
          onStartGame={() => {
            setInGame(true);
            setShowMainMenu(false);
          }}
          onNewGame={() => {
            setCurrentWorld(1);
            refreshData();
          }}
          onLoadSlot={(slotId) => {
            const curWorld = GameStorage.getCurrentWorld();
            setCurrentWorld(curWorld);
            refreshData();
          }}
          onOpenNPCCustomizer={() => setShowNPCCustomizer(true)}
          onOpenWorldSelect={() => setShowWorldSelect(true)}
          onClose={() => setShowMainMenu(false)}
          isInitialScreen={!inGame}
        />
      )}

      {/* NPC Customizer Modal */}
      {showNPCCustomizer && (
        <NPCCustomizerModal
          currentWorld={currentWorld}
          onRefreshData={refreshData}
          onBackToMainMenu={() => {
            setShowNPCCustomizer(false);
            setShowMainMenu(true);
          }}
          onClose={() => setShowNPCCustomizer(false)}
        />
      )}
    </div>
  );
}
