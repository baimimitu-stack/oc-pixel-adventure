import React, { useState } from "react";
import { LevelConfig } from "../types";
import { getLevelByWorld } from "../game/levels";
import { sound } from "../services/sound";
import { GameStorage } from "../services/db";
import { Star, Lock, Unlock, Play, X, MapPin, Edit3, CheckCircle2 } from "lucide-react";

interface WorldSelectModalProps {
  totalStars: number;
  currentWorld: number;
  onSelectWorld: (worldNum: number) => void;
  onOpenNPCCustomizer?: () => void;
  onBackToMainMenu?: () => void;
  onClose: () => void;
}

const WORLDS = [
  {
    num: 1,
    name: "晨曦平原",
    subtitle: "青草与微风，初涉冒险之路",
    theme: "grass",
    requiredStars: 0,
    gradient: "from-emerald-800 to-teal-950",
    border: "border-emerald-500",
    badge: "初阶平原",
    emoji: "🌲",
  },
  {
    num: 2,
    name: "蘑菇幻境",
    subtitle: "弹跳斑斓菌盖，穿越幽深林地",
    theme: "mushroom",
    requiredStars: 3,
    gradient: "from-purple-900 to-indigo-950",
    border: "border-purple-500",
    badge: "菌丝秘境",
    emoji: "🍄",
  },
  {
    num: 3,
    name: "星夜城堡",
    subtitle: "夜幕与晶石，高精度浮空跃迁",
    theme: "star",
    requiredStars: 7,
    gradient: "from-sky-950 to-slate-950",
    border: "border-sky-500",
    badge: "星核要塞",
    emoji: "🌌",
  },
  {
    num: 4,
    name: "熔岩核心",
    subtitle: "烈火重铸，勇者无畏的终焉考验",
    theme: "lava",
    requiredStars: 12,
    gradient: "from-red-950 to-stone-950",
    border: "border-red-500",
    badge: "烈焰终极",
    emoji: "🌋",
  },
];

export const WorldSelectModal: React.FC<WorldSelectModalProps> = ({
  totalStars,
  currentWorld,
  onSelectWorld,
  onOpenNPCCustomizer,
  onBackToMainMenu,
  onClose,
}) => {
  const [unlockAll, setUnlockAll] = useState<boolean>(() => GameStorage.isAllWorldsUnlocked());

  const handleToggleUnlockAll = () => {
    const next = !unlockAll;
    setUnlockAll(next);
    GameStorage.setAllWorldsUnlocked(next);
    sound.playStar();
  };

  const handleChooseWorld = (wNum: number) => {
    GameStorage.setCurrentWorld(wNum);
    onSelectWorld(wNum);
    sound.playStar();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 shadow-2xl p-6 text-slate-100 flex flex-col max-h-[90vh] pixel-panel pixel-border-blue">
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🗺️</div>
            <div>
              <h2 className="text-lg font-bold font-pixel text-sky-300">冒险大地图与关卡切换</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                点击任意世界卡片即可即时切换探险地图，体验专属地貌与机关！
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleUnlockAll}
              className={`pixel-btn-slate flex items-center gap-1.5 px-3 py-1.5 text-xs font-pixel ${
                unlockAll ? "text-amber-300 border-amber-400" : "text-slate-300"
              }`}
              title="自由体验所有关卡"
            >
              {unlockAll ? <Unlock size={14} className="text-amber-400" /> : <Lock size={14} />}
              <span>{unlockAll ? "全部地图已解锁" : "一键解锁全部地图"}</span>
            </button>

            <div className="flex items-center gap-1.5 bg-sky-950/80 px-3 py-1.5 text-sky-300 font-bold text-xs pixel-border-blue">
              <Star size={14} className="fill-sky-400" />
              <span className="font-pixel text-xs">探索星石: {totalStars}</span>
            </div>
            <button onClick={onClose} className="pixel-btn-slate p-1.5 text-slate-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Worlds Grid */}
        <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {WORLDS.map((w) => {
            const isUnlocked = unlockAll || totalStars >= w.requiredStars;
            const isCurrent = currentWorld === w.num;

            return (
              <div
                key={w.num}
                onClick={() => handleChooseWorld(w.num)}
                className={`relative p-5 transition-all flex flex-col justify-between overflow-hidden cursor-pointer group ${
                  isCurrent
                    ? "bg-slate-900 pixel-border-gold shadow-2xl ring-2 ring-amber-400/40"
                    : isUnlocked
                    ? "bg-slate-900 pixel-border-slate hover:border-sky-400 shadow-xl"
                    : "bg-slate-950/80 border-2 border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Status Pill */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs bg-slate-800 px-2.5 py-1 border border-slate-700 font-bold text-slate-200 font-pixel text-[10px]">
                    WORLD {w.num} · {w.badge}
                  </span>

                  {isCurrent && (
                    <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 font-pixel flex items-center gap-1">
                      <CheckCircle2 size={12} /> 当前探险中
                    </span>
                  )}

                  {!isCurrent && !isUnlocked && (
                    <span className="text-[10px] bg-red-950/80 text-red-300 px-2 py-0.5 border border-red-500/40 flex items-center gap-1 font-pixel">
                      <Lock size={12} /> 需 {w.requiredStars} 星 (可直接点击体验)
                    </span>
                  )}

                  {!isCurrent && isUnlocked && (
                    <span className="text-[10px] bg-sky-950 text-sky-300 px-2 py-0.5 border border-sky-600/40 font-pixel">
                      可探索
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 my-2">
                  <div className="text-4xl bg-slate-950 p-3 border-2 border-slate-700 shrink-0 pixel-border-slate group-hover:scale-105 transition-transform">
                    {w.emoji}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-amber-300 font-pixel group-hover:text-amber-200 transition-colors">
                      {w.name}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">{w.subtitle}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t-2 border-slate-800 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 font-pixel">
                    世界编号: #{w.num}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChooseWorld(w.num);
                    }}
                    className={`flex items-center gap-1.5 font-bold px-4 py-2 text-xs font-pixel ${
                      isCurrent
                        ? "pixel-btn-amber text-slate-950"
                        : "pixel-btn-blue text-white"
                    }`}
                  >
                    <Play size={13} className="fill-current" />
                    {isCurrent ? "继续本关探险" : "点击切换至该地图"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t-2 border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onBackToMainMenu && (
              <button
                onClick={() => {
                  onClose();
                  onBackToMainMenu();
                }}
                className="pixel-btn-slate px-3 py-2 text-xs font-pixel text-slate-300 hover:text-white"
              >
                🏠 返回大标题
              </button>
            )}

            {onOpenNPCCustomizer && (
              <button
                onClick={() => {
                  onClose();
                  onOpenNPCCustomizer();
                }}
                className="pixel-btn-amber px-4 py-2 text-xs font-pixel flex items-center gap-1.5 text-slate-950 font-bold"
              >
                <Edit3 size={14} /> 自定义各关卡 NPC 与台词
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="pixel-btn-slate text-slate-200 px-6 py-2 text-xs font-bold font-pixel"
          >
            返回游戏
          </button>
        </div>
      </div>
    </div>
  );
};
