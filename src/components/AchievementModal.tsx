import React from "react";
import { Achievement } from "../types";
import { sound } from "../services/sound";
import { Trophy, Star, Coins, CheckCircle, Lock, X } from "lucide-react";

interface AchievementModalProps {
  achievements: Achievement[];
  totalStars: number;
  totalCoins: number;
  onClose: () => void;
}

export const AchievementModal: React.FC<AchievementModalProps> = ({
  achievements,
  totalStars,
  totalCoins,
  onClose,
}) => {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 shadow-2xl p-6 text-slate-100 flex flex-col max-h-[90vh] pixel-panel pixel-border-gold">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-950/80 border-2 border-amber-400 flex items-center justify-center text-amber-400 pixel-border-gold">
              <Trophy size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold font-pixel text-amber-300">冒险成就殿堂</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                记录你的寻星探险足迹，达成目标领取丰厚金币！
              </p>
            </div>
          </div>

          <button onClick={onClose} className="pixel-btn-slate p-1.5 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="bg-slate-950/80 p-3 text-center pixel-border-slate">
            <p className="text-[11px] text-slate-400">总成就解锁</p>
            <p className="text-base font-bold text-amber-300 mt-0.5 font-pixel">
              {unlockedCount}/{achievements.length}
            </p>
          </div>
          <div className="bg-slate-950/80 p-3 text-center pixel-border-slate">
            <p className="text-[11px] text-slate-400">收集星星</p>
            <p className="text-base font-bold text-sky-400 mt-0.5 flex items-center justify-center gap-1 font-pixel">
              <Star size={14} className="fill-sky-400" /> {totalStars}
            </p>
          </div>
          <div className="bg-slate-950/80 p-3 text-center pixel-border-slate">
            <p className="text-[11px] text-slate-400">持有金币</p>
            <p className="text-base font-bold text-amber-400 mt-0.5 flex items-center justify-center gap-1 font-pixel">
              <Coins size={14} /> {totalCoins}
            </p>
          </div>
        </div>

        {/* Achievements List */}
        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          {achievements.map((item) => {
            const pct = Math.min(100, Math.round((item.current / item.target) * 100));

            return (
              <div
                key={item.id}
                className={`p-4 transition-all flex items-center justify-between gap-4 ${
                  item.unlocked
                    ? "bg-slate-800/90 pixel-border-gold shadow-sm"
                    : "bg-slate-950/70 pixel-border-slate opacity-80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl shrink-0 pixel-border-slate">
                    {item.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white font-pixel text-xs">{item.title}</h4>
                      {item.unlocked && (
                        <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 border border-emerald-500/30 flex items-center gap-0.5 font-pixel text-[9px]">
                          <CheckCircle size={10} /> 已达成
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>

                    {/* Progress Bar */}
                    <div className="flex items-center gap-2 mt-2 w-48">
                      <div className="flex-1 h-2.5 bg-slate-950 border border-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.current}/{item.target}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1 justify-end font-pixel">
                    <Coins size={12} /> +{item.rewardCoins} 金币
                  </span>
                  <div className="text-[11px] mt-1 text-slate-500 font-pixel text-[10px]">
                    {item.unlocked ? "奖励已到账" : "未完成"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t-2 border-slate-800 pt-4 flex justify-end">
          <button
            onClick={onClose}
            className="pixel-btn-slate text-slate-200 px-6 py-2 text-xs font-bold"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
