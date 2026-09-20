import React, { useState, useRef, useEffect } from "react";
import { NPCConfig, ExpressionPortraitMap } from "../types";
import { GameStorage } from "../services/db";
import { sound } from "../services/sound";
import { getLevelByWorld } from "../game/levels";
import { ExpressionPortraitEditor } from "./ExpressionPortraitEditor";
import { countExpressionPortraits } from "../services/expressionPortraits";
import { 
  Edit3, 
  RotateCcw, 
  Check, 
  X, 
  Sparkles, 
  Smile, 
  MessageSquare, 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Home 
} from "lucide-react";

interface NPCCustomizerModalProps {
  currentWorld: number;
  onRefreshData: () => void;
  onBackToMainMenu?: () => void;
  onClose: () => void;
}

const EMOJI_OPTIONS = ["🧚", "🧙‍♂️", "🤖", "🦊", "🐱", "🐶", "🐉", "🐰", "🐻", "👻", "🦄", "🧝‍♀️", "🧑‍🚀", "🦉"];

const PRESET_PERSONALITIES = [
  "元气热情、热爱闪光宝物",
  "温柔治愈、默默守护旅人",
  "高冷机智、通晓远古符文",
  "幽默搞怪、热衷冷笑话",
  "傲娇神秘、不服输的向导",
  "热血勇者、渴望史诗决斗",
];

export const NPCCustomizerModal: React.FC<NPCCustomizerModalProps> = ({
  currentWorld,
  onRefreshData,
  onBackToMainMenu,
  onClose,
}) => {
  const [selectedWorld, setSelectedWorld] = useState<number>(currentWorld);

  // Load default from level generator
  const defaultLevel = getLevelByWorld(selectedWorld);
  const defaultNPC: NPCConfig = defaultLevel.npc || {
    name: `世界${selectedWorld}守望者`,
    role: "向导",
    personality: "温和友善",
    dialogue: "欢迎来到这个世界，勇敢的冒险者！",
    avatarEmoji: "🧚",
  };

  // Check stored custom NPC or fallback to default
  const storedNPC = GameStorage.getNPCForWorld(selectedWorld, defaultNPC) || defaultNPC;

  const [name, setName] = useState<string>(storedNPC.name);
  const [role, setRole] = useState<string>(storedNPC.role);
  const [personality, setPersonality] = useState<string>(storedNPC.personality);
  const [dialogue, setDialogue] = useState<string>(storedNPC.dialogue);
  const [avatarEmoji, setAvatarEmoji] = useState<string>(storedNPC.avatarEmoji || "🧚");
  const [portraitUrl, setPortraitUrl] = useState<string>(storedNPC.portraitUrl || "");
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [expressions, setExpressions] = useState<ExpressionPortraitMap>(storedNPC.expressionPortraits || {});
  const [showExpressions, setShowExpressions] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // When switching world tab
  const handleSwitchWorld = (wNum: number) => {
    setSelectedWorld(wNum);
    const lvl = getLevelByWorld(wNum);
    const defNPC: NPCConfig = lvl.npc || {
      name: `世界${wNum}守望者`,
      role: "向导",
      personality: "温和友善",
      dialogue: "欢迎来到这个世界，勇敢的冒险者！",
      avatarEmoji: "🧚",
    };
    const current = GameStorage.getNPCForWorld(wNum, defNPC) || defNPC;
    setName(current.name);
    setRole(current.role);
    setPersonality(current.personality);
    setDialogue(current.dialogue);
    setAvatarEmoji(current.avatarEmoji || "🧚");
    setPortraitUrl(current.portraitUrl || "");
    setExpressions(current.expressionPortraits || {});
    setSaveSuccess(false);
    setUploadError("");
  };

  const acceptImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("请选择有效的图片文件 (PNG, JPG, WebP)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const img = new Image();
        img.onload = () => {
          const maxDim = 512;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const base64 = canvas.toDataURL("image/png");
            setPortraitUrl(base64);
            setUploadError("");
            sound.playStar();
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) acceptImageFile(file);
  };

  // Ctrl+V 粘贴剪贴板图片
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            acceptImageFile(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) acceptImageFile(file);
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleSave = () => {
    if (!name.trim()) return;
    // 清理空槽后再存
    const cleanedExpressions: ExpressionPortraitMap = {};
    for (const [key, value] of Object.entries(expressions || {})) {
      if (typeof value === "string" && value.trim()) cleanedExpressions[key as keyof ExpressionPortraitMap] = value;
    }
    const updated: NPCConfig = {
      name: name.trim(),
      role: role.trim() || "旅途向导",
      personality: personality.trim() || "热心善良",
      dialogue: dialogue.trim() || "愿星辉照亮你的路！",
      avatarEmoji,
      portraitUrl: portraitUrl.trim() || undefined,
      expressionPortraits: Object.keys(cleanedExpressions).length ? cleanedExpressions : undefined,
    };
    GameStorage.saveNPCForWorld(selectedWorld, updated);
    sound.playStar();
    setSaveSuccess(true);
    onRefreshData();
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleResetDefault = () => {
    GameStorage.resetNPCForWorld(selectedWorld);
    const lvl = getLevelByWorld(selectedWorld);
    const def = lvl.npc || {
      name: `世界${selectedWorld}守望者`,
      role: "向导",
      personality: "温和友善",
      dialogue: "你好呀！",
      avatarEmoji: "🧚",
    };
    setName(def.name);
    setRole(def.role);
    setPersonality(def.personality);
    setDialogue(def.dialogue);
    setAvatarEmoji(def.avatarEmoji || "🧚");
    setPortraitUrl("");
    setExpressions({});
    sound.playClick();
    onRefreshData();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 shadow-2xl p-6 text-slate-100 flex flex-col max-h-[90vh] pixel-panel pixel-border-gold">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl bg-slate-800 p-2 border-2 border-slate-700 pixel-border-slate">
              🎭
            </div>
            <div>
              <h2 className="text-lg font-bold font-pixel text-amber-300">自定义 NPC 设定与立绘</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                为每个关卡世界定制驻场 NPC 的名字、身份定位、立绘肖像与对白！
              </p>
            </div>
          </div>
          <button onClick={onClose} className="pixel-btn-slate p-1.5 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* World Selector Tabs */}
        <div className="flex items-center gap-2 pt-4 pb-2 overflow-x-auto border-b border-slate-800">
          {[1, 2, 3, 4].map((wNum) => (
            <button
              key={wNum}
              onClick={() => handleSwitchWorld(wNum)}
              className={`px-3 py-1.5 font-pixel text-xs transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedWorld === wNum
                  ? "bg-amber-500 text-slate-950 font-bold pixel-btn-amber"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 pixel-btn-slate"
              }`}
            >
              <span>世界 {wNum}</span>
              <span className="text-[10px] opacity-80">
                {wNum === 1 ? "平原" : wNum === 2 ? "蘑菇" : wNum === 3 ? "城堡" : "熔岩"}
              </span>
            </button>
          ))}
        </div>

        {/* NPC Edit Form */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          
          {/* NPC Avatar, Portrait & Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Visual Column: Emoji + Portrait —— 支持点击 / 拖拽 / Ctrl+V 粘贴 */}
            <div
              className="sm:col-span-1 flex flex-col items-center p-3 border-2 pixel-border-slate space-y-2"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              style={{ background: "#fffaf0", borderColor: "#d1a86c" }}
            >

              {/* Portrait Preview or Emoji */}
              {portraitUrl ? (
                <div className="relative w-28 h-36 overflow-hidden flex items-center justify-center pixel-border-gold" style={{ background: "#fff" }}>
                  <img
                    src={portraitUrl}
                    alt={name}
                    className="w-full h-full object-cover object-top"
                  />
                  <button
                    onClick={() => setPortraitUrl("")}
                    className="absolute top-1 right-1 bg-red-600/90 text-white p-1 rounded hover:bg-red-500 shadow"
                    title="移除此立绘"
                  >
                    <Trash2 size={12} />
                  </button>
                  <span className="absolute bottom-0 inset-x-0 text-[9px] text-center py-0.5 font-pixel" style={{ background: "rgba(255,241,214,0.9)", color: "#b45309" }}>
                    专属立绘
                  </span>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-28 h-36 flex flex-col items-center justify-center border-2 border-dashed cursor-pointer transition-all hover:brightness-95"
                  style={{ background: "#fff7ec", borderColor: "#d1a86c" }}
                >
                  <span className="text-4xl mb-1">{avatarEmoji}</span>
                  <span className="text-[9px] font-pixel mt-1" style={{ color: "#6b4a2b" }}>点这里贴图</span>
                  <span className="text-[9px]" style={{ color: "#b45309" }}>Ctrl+V / 拖入</span>
                </div>
              )}

              <span className="font-pixel text-xs text-center truncate max-w-full" style={{ color: "#b45309" }}>
                {name || "NPC名称"}
              </span>
              <span className="text-[10px] px-2 py-0.5" style={{ background: "#ffe4b5", color: "#3a2410" }}>
                {role || "角色身份"}
              </span>

              {/* Upload Portrait Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 px-2 pixel-btn-amber text-[11px] font-pixel flex items-center justify-center gap-1.5 font-bold"
                style={{ color: "#3a2410" }}
              >
                <Upload size={13} />
                <span>{portraitUrl ? "更换立绘" : "上传立绘"}</span>
              </button>

              <div className="text-[9px] text-center px-1 leading-relaxed" style={{ color: "#15803d" }}>
                💡 也可以直接 <strong>Ctrl+V</strong> 粘贴剪贴板图片
              </div>

              {uploadError && (
                <p className="text-[10px] text-red-400 text-center">{uploadError}</p>
              )}

              {/* Emoji Alternative Picker */}
              <div className="pt-2 border-t border-slate-800 w-full text-center">
                <span className="text-[9px] text-slate-400 font-pixel block mb-1">或选用图标头像</span>
                <div className="flex flex-wrap gap-1 justify-center">
                  {EMOJI_OPTIONS.slice(0, 10).map((em) => (
                    <button
                      key={em}
                      onClick={() => setAvatarEmoji(em)}
                      className={`text-base p-1 rounded hover:bg-slate-800 transition-colors ${
                        avatarEmoji === em && !portraitUrl ? "bg-amber-500/30 ring-1 ring-amber-400" : ""
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Form Fields Column */}
            <div className="sm:col-span-2 space-y-3">
              <div>
                <label className="block text-xs font-pixel text-slate-300 mb-1">
                  NPC 名字:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：旅行妖精·露米 / 蘑菇长老..."
                  className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-400 px-3 py-2 text-xs text-white outline-none pixel-border-slate"
                />
              </div>

              <div>
                <label className="block text-xs font-pixel text-slate-300 mb-1">
                  角色身份 / 头衔:
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="例如：星之向导 / 守门人 / 秘宝商人..."
                  className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-400 px-3 py-2 text-xs text-white outline-none pixel-border-slate"
                />
              </div>

              <div>
                <label className="block text-xs font-pixel text-slate-300 mb-1">
                  性格特征 (影响智能对话与表情):
                </label>
                <input
                  type="text"
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  placeholder="例如：高冷机智、傲娇调皮..."
                  className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-400 px-3 py-2 text-xs text-white outline-none pixel-border-slate"
                />

                {/* Preset suggestions */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {PRESET_PERSONALITIES.slice(0, 4).map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPersonality(p)}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-300/80 px-2 py-0.5 border border-slate-700 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Portrait URL manual input */}
              <div>
                <label className="block text-xs font-pixel text-slate-300 mb-1 flex items-center justify-between">
                  <span>立绘网络链接 (URL):</span>
                  <span className="text-[10px] text-slate-400 font-sans">支持直接输入在线图片地址</span>
                </label>
                <input
                  type="text"
                  value={portraitUrl.startsWith("data:") ? "(已上传本地图片文件)" : portraitUrl}
                  onChange={(e) => {
                    if (!e.target.value.startsWith("(已上传")) {
                      setPortraitUrl(e.target.value);
                    }
                  }}
                  placeholder="https://... 或点击左侧按钮上传本地图片"
                  className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-400 px-3 py-1.5 text-xs text-white outline-none font-mono pixel-border-slate"
                />
              </div>
            </div>
          </div>

          {/* Dialogue Section */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-xs font-pixel text-amber-300 mb-1.5 flex items-center gap-1.5">
              <MessageSquare size={13} className="text-amber-400" />
              <span>关卡初始登场台词 (每次相遇时的第一句话):</span>
            </label>
            <textarea
              rows={2}
              value={dialogue}
              onChange={(e) => setDialogue(e.target.value)}
              placeholder="输入NPC对你的OC角色说的话..."
              className="w-full bg-slate-950 border-2 border-slate-700 focus:border-amber-400 p-3 text-xs text-white outline-none resize-none pixel-border-slate"
            />
          </div>

          {/* Dialogue suggestions */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-slate-400">快速填入台词范例:</span>
            {[
              "你好呀！愿星光照亮你与你的伙伴！✨",
              "呼……前面路途危险，带上这颗星星再出发吧！",
              "欢迎来到这里！我是这里的守护者，有什么需要请尽管说！",
              "哼，凡人，想要通过这里，先证明你的跳跃实力吧！",
            ].map((preset, idx) => (
              <button
                key={idx}
                onClick={() => setDialogue(preset)}
                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-200 px-2 py-0.5 border border-slate-700 transition-colors"
              >
                {preset.slice(0, 16)}...
              </button>
            ))}
          </div>

          {/* 表情立绘折叠面板 —— 世界 N 的 NPC */}
          <div className="border-2 pixel-border-slate" style={{ background: "#fff1d6", borderColor: "#d1a86c" }}>
            <button
              type="button"
              onClick={() => setShowExpressions((value) => !value)}
              className="w-full flex items-center justify-between p-3 text-left"
              style={{ color: "#3a2410" }}
            >
              <span className="text-xs font-pixel font-bold flex items-center gap-2" style={{ color: "#b45309" }}>
                🎭 NPC 表情立绘（世界 {selectedWorld}）
              </span>
              <span className="text-[11px]" style={{ color: "#6b4a2b" }}>
                已配置 {countExpressionPortraits(expressions)}/7 · 点击{showExpressions ? "收起" : "编辑"}
              </span>
            </button>
            {showExpressions && (
              <div className="p-3 pt-0">
                <ExpressionPortraitEditor
                  value={expressions}
                  onChange={setExpressions}
                  boxed={false}
                />
                <p className="text-[11px] mt-2" style={{ color: "#6b4a2b" }}>
                  改动会在点击下方「保存当前 NPC 设定」时一并写入。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t-2 border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onBackToMainMenu && (
              <button
                onClick={() => {
                  onClose();
                  onBackToMainMenu();
                }}
                className="pixel-btn-slate text-slate-300 hover:text-white px-3 py-2 text-xs flex items-center gap-1.5 font-pixel"
              >
                <Home size={13} /> 返回大标题
              </button>
            )}

            <button
              onClick={handleResetDefault}
              className="pixel-btn-slate text-slate-400 hover:text-white px-3 py-2 text-xs flex items-center gap-1.5 font-pixel"
              title="恢复该世界的系统默认NPC"
            >
              <RotateCcw size={13} /> 恢复默认 NPC
            </button>
          </div>

          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="text-emerald-400 font-pixel text-xs flex items-center gap-1 animate-pulse">
                <Check size={14} /> 保存成功！已更新世界 {selectedWorld} 的NPC
              </span>
            )}

            <button
              onClick={handleSave}
              className="pixel-btn-green font-pixel text-xs px-5 py-2.5 flex items-center gap-2 font-bold"
            >
              <Check size={15} /> 保存当前 NPC 设定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
