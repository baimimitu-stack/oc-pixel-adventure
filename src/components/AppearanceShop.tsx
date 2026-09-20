import React from "react";
import { OCCharacter, CosmeticItem } from "../types";
import { COSMETIC_ITEMS, GameStorage } from "../services/db";
import { sound } from "../services/sound";
import { Sparkles, Coins, Check, Lock, ShoppingBag, X } from "lucide-react";

interface AppearanceShopProps {
  activeOC: OCCharacter;
  totalCoins: number;
  onRefreshData: () => void;
  onClose: () => void;
}

export const AppearanceShop: React.FC<AppearanceShopProps> = ({
  activeOC,
  totalCoins,
  onRefreshData,
  onClose,
}) => {
  const isUnlocked = (id: string) => activeOC.unlockedAppearances?.includes(id);

  const handlePurchase = (item: CosmeticItem) => {
    if (totalCoins < item.cost) {
      alert("金币不足！去关卡里多吃点金币再来吧~ 🪙");
      return;
    }

    GameStorage.addCoins(-item.cost);
    GameStorage.updateActiveOC((oc) => ({
      ...oc,
      unlockedAppearances: [...(oc.unlockedAppearances || []), item.id],
    }));

    sound.playStar();
    GameStorage.updateAchievement("cosmetics_2", 1);
    onRefreshData();
  };

  const handleToggleEquip = (item: CosmeticItem) => {
    GameStorage.updateActiveOC((oc) => {
      const currentList = oc.unlockedAppearances || [];
      const hasIt = currentList.includes(item.id);
      let updatedList = [...currentList];

      if (hasIt) {
        // Toggle unequip (or keep unlocked list, equip status is just being part of unlocked)
        // Let's toggle between active equipment
        updatedList = currentList.filter((x) => x !== item.id);
      } else {
        updatedList.push(item.id);
      }
      return {
        ...oc,
        unlockedAppearances: updatedList,
      };
    });
    sound.playClick();
    onRefreshData();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 shadow-2xl p-6 text-slate-100 flex flex-col max-h-[90vh] pixel-panel pixel-border-gold">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🪞</span>
            <div>
              <h2 className="text-lg font-bold font-pixel text-amber-300">吃金币外观升级工坊</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                用探险吃到的金币强化你的 OC 造型，特效将在关卡中实时展现！
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-amber-950/90 text-amber-300 font-bold text-xs px-3 py-1.5 pixel-border-gold">
              <Coins size={16} className="text-amber-400" />
              <span className="font-pixel text-xs">{totalCoins} 金币</span>
            </div>
            <button
              onClick={onClose}
              className="pixel-btn-slate p-1.5 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* OC Live Model View */}
        <div className="flex items-center justify-between bg-slate-950/80 p-4 my-4 pixel-border-slate">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={activeOC.avatarUrl}
                alt={activeOC.name}
                className="w-16 h-16 object-contain bg-slate-800 border-2 border-amber-400 p-1 shadow-lg pixel-border-gold"
              />
              {activeOC.unlockedAppearances.includes("crown") && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg animate-bounce">
                  👑
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-amber-300 font-pixel">{activeOC.name}</h3>
                <span className="text-xs text-amber-300 bg-amber-500/20 px-2 py-0.5 border border-amber-400/40">
                  {activeOC.title}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                已装扮特效: {activeOC.unlockedAppearances?.length || 0} 件
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-amber-300 font-pixel">
            <p>关卡实时渲染已生效 ✨</p>
          </div>
        </div>

        {/* Upgrades Grid */}
        <div className="flex-1 overflow-y-auto py-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {COSMETIC_ITEMS.map((item) => {
            const unlocked = isUnlocked(item.id);
            const canAfford = totalCoins >= item.cost;

            return (
              <div
                key={item.id}
                className={`p-4 transition-all flex flex-col justify-between ${
                  unlocked
                    ? "bg-slate-800/90 pixel-border-gold"
                    : "bg-slate-950/70 pixel-border-slate"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl shrink-0 pixel-border-slate">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-white font-pixel text-xs">{item.name}</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t-2 border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1 font-pixel">
                    <Coins size={14} /> {item.cost} 金币
                  </span>

                  {unlocked ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-bold bg-emerald-950/80 px-2.5 py-1 pixel-border-slate font-pixel text-[10px]">
                      <Check size={14} /> 已装备
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePurchase(item)}
                      disabled={!canAfford}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 shadow transition-all ${
                        canAfford
                          ? "pixel-btn-amber"
                          : "pixel-btn-slate opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <ShoppingBag size={14} /> 吃金币解锁
                    </button>
                  )}
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
            完成装扮返回
          </button>
        </div>
      </div>
    </div>
  );
};
