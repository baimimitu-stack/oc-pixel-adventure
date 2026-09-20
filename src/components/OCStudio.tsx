import React, { useState, useRef, useEffect } from "react";
import { OCCharacter, PersonalityType } from "../types";
import { GameStorage } from "../services/db";
import { sound } from "../services/sound";
import { 
  ShieldCheck, 
  Upload, 
  Sparkles, 
  Plus, 
  Trash2, 
  Check, 
  Download, 
  FileUp, 
  Heart, 
  Coins, 
  Star,
  UserCheck,
  Home,
  X,
  Image as ImageIcon,
  Edit2
} from "lucide-react";

interface OCStudioProps {
  ocs: OCCharacter[];
  activeOC: OCCharacter;
  onSelectOC: (oc: OCCharacter) => void;
  onRefreshOCs: () => void;
  onBackToMainMenu?: () => void;
  onClose: () => void;
}

const PERSONALITY_OPTIONS: { type: PersonalityType; label: string; desc: string; emoji: string }[] = [
  { type: "热血勇者", label: "热血勇者", desc: "充满活力，直言不讳，敢闯敢拼！", emoji: "🔥" },
  { type: "傲娇", label: "傲娇萌属性", desc: "口是心非，虽然嘴硬但心底非常在乎伙伴！", emoji: "💢" },
  { type: "温柔治愈", label: "温柔治愈", desc: "包容体贴，如春风拂面，给予伙伴宁静力量。", emoji: "🌸" },
  { type: "高冷机智", label: "高冷机智", desc: "冷静缜密，寡言少语，但总能在关键时刻指引方向。", emoji: "❄️" },
  { type: "调皮捣蛋", label: "调皮捣蛋", desc: "古灵精怪，喜欢搞恶作剧与开玩笑，气氛制造者！", emoji: "⚡" },
  { type: "呆萌天然", label: "呆萌天然", desc: "反应慢半拍，充满好奇心，有时带来意外幸运。", emoji: "🍃" },
];

export const OCStudio: React.FC<OCStudioProps> = ({
  ocs,
  activeOC,
  onSelectOC,
  onRefreshOCs,
  onBackToMainMenu,
  onClose,
}) => {
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [editingOC, setEditingOC] = useState<Partial<OCCharacter>>({
    name: "",
    title: "",
    personality: "热血勇者",
    bio: "",
    catchphrase: "",
    avatarUrl: "",
    portraitUrl: "",
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const portraitInputRef = useRef<HTMLInputElement | null>(null);
  const targetOCPortraitRef = useRef<HTMLInputElement | null>(null);
  const [targetOCForPortrait, setTargetOCForPortrait] = useState<string | null>(null);

  const [uploadError, setUploadError] = useState<string>("");
  // 粘贴目标：avatar / portrait —— 决定 Ctrl+V 时贴到头像还是立绘
  const [pasteTarget, setPasteTarget] = useState<"avatar" | "portrait">("avatar");

  // 全局粘贴监听：创建中的 OC 表单打开时，Ctrl+V 直接把剪贴板图片贴进目标位
  useEffect(() => {
    if (!isCreating) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            if (pasteTarget === "avatar") {
              handleImageFile(file);
            } else {
              handlePortraitFile(file);
            }
            return;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isCreating, pasteTarget]);

  // 拖拽上传通用处理
  const handleDrop = (e: React.DragEvent, target: "avatar" | "portrait") => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (target === "avatar") handleImageFile(file);
      else handlePortraitFile(file);
    }
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // Handle image upload for Sprite Avatar
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("请上传有效的图片格式 (PNG, JPG, WebP, GIF)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        const img = new Image();
        img.onload = () => {
          const maxDim = 256;
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
            const optimizedBase64 = canvas.toDataURL("image/png");
            setEditingOC((prev) => ({ ...prev, avatarUrl: optimizedBase64 }));
            setUploadError("");
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle image upload for Full Portrait (立绘)
  const handlePortraitFile = (file: File, forOcId?: string) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("请上传有效的图片格式 (PNG, JPG, WebP)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
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
            const optimizedBase64 = canvas.toDataURL("image/png");

            if (forOcId) {
              GameStorage.updateOCPortrait(forOcId, optimizedBase64);
              sound.playStar();
              onRefreshOCs();
            } else {
              setEditingOC((prev) => ({ ...prev, portraitUrl: optimizedBase64 }));
            }
            setUploadError("");
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveOC = () => {
    if (!editingOC.name?.trim()) {
      setUploadError("请输入角色名称！");
      return;
    }
    if (!editingOC.avatarUrl) {
      setUploadError("请上传角色头像图片或选用预设形象！");
      return;
    }

    const newOC: OCCharacter = {
      id: "oc-" + Date.now(),
      name: editingOC.name.trim(),
      title: editingOC.title?.trim() || "像素冒险者",
      personality: editingOC.personality || "热血勇者",
      bio: editingOC.bio?.trim() || "踏上奇幻冒险的独立原创角色。",
      catchphrase: editingOC.catchphrase?.trim() || "出发！新的冒险在等待！",
      avatarUrl: editingOC.avatarUrl,
      portraitUrl: editingOC.portraitUrl || undefined,
      createdAt: Date.now(),
      affection: 10,
      coinsCollected: 0,
      starsCollected: 0,
      unlockedAppearances: [],
      equippedCosmetics: {},
    };

    GameStorage.saveOC(newOC);
    GameStorage.setActiveOC(newOC.id);
    sound.playStar();
    setIsCreating(false);
    setEditingOC({
      name: "",
      title: "",
      personality: "热血勇者",
      bio: "",
      catchphrase: "",
      avatarUrl: "",
      portraitUrl: "",
    });
    onRefreshOCs();
  };

  // Export all OCs as JSON file
  const exportOCs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ocs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `pixel-oc-roster-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    sound.playClick();
  };

  // Import OCs from JSON
  const importOCs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          imported.forEach((oc: OCCharacter) => {
            if (oc.id && oc.name && oc.avatarUrl) {
              GameStorage.saveOC(oc);
            }
          });
          sound.playStar();
          onRefreshOCs();
        }
      } catch (err) {
        alert("导入格式无效，请选择正确的 OC JSON 备份文件。");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 shadow-2xl p-6 text-slate-100 flex flex-col max-h-[90vh] pixel-panel pixel-border-gold">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl bg-slate-800 p-2.5 border-2 border-slate-700 pixel-border-slate">
              🎨
            </div>
            <div>
              <h2 className="text-xl font-bold font-pixel text-amber-300">
                原创主角工坊 (OC Studio)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                支持上传自定义角色形象、立绘、性格特质、台词设定与一键导出导入备份
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onBackToMainMenu && (
              <button
                onClick={() => {
                  onClose();
                  onBackToMainMenu();
                }}
                className="pixel-btn-slate px-3 py-1.5 font-pixel text-xs flex items-center gap-1.5 text-slate-300 hover:text-white"
              >
                <Home size={13} /> 返回大标题
              </button>
            )}
            <button
              onClick={onClose}
              className="pixel-btn-slate p-1.5 text-slate-400 hover:text-white"
              title="关闭"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsCreating(true);
                  setEditingOC({
                    name: "",
                    title: "",
                    personality: "热血勇者",
                    bio: "",
                    catchphrase: "",
                    avatarUrl: "",
                    portraitUrl: "",
                  });
                  sound.playClick();
                }}
                className="pixel-btn-amber flex items-center gap-1.5 font-bold px-4 py-2 text-xs shadow text-slate-950 font-pixel"
              >
                <Plus size={16} /> 创建新角色 (Create OC)
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-pixel">
              <button
                onClick={exportOCs}
                className="pixel-btn-slate flex items-center gap-1 text-slate-300 px-3 py-2 text-xs"
                title="导出OC设定备份到本地文件"
              >
                <Download size={14} /> 备份导出
              </button>
              <label className="pixel-btn-slate flex items-center gap-1 text-slate-300 px-3 py-2 cursor-pointer text-xs">
                <FileUp size={14} /> 导入角色
                <input type="file" accept=".json" onChange={importOCs} className="hidden" />
              </label>
            </div>
          </div>

          {/* Hidden inputs for portrait updates */}
          <input
            ref={targetOCPortraitRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && targetOCForPortrait) {
                handlePortraitFile(file, targetOCForPortrait);
              }
            }}
            className="hidden"
          />

          {/* Create New OC Form Drawer */}
          {isCreating && (
            <div className="bg-slate-800/90 border-2 border-amber-500/50 p-5 space-y-4 shadow-xl pixel-border-gold">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2 font-pixel">
                  <Sparkles size={16} /> 创建你的原创主角 (OC) 与专属立绘
                </h3>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-slate-400 hover:text-white text-xs px-2 py-1 font-pixel"
                >
                  取消
                </button>
              </div>

              {uploadError && (
                <div className="text-xs text-red-400 bg-red-950/60 border border-red-500/50 p-2 font-pixel">
                  {uploadError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Left: Avatar & Portrait Upload Box —— 支持点击 / 拖拽 / Ctrl+V 粘贴 */}
                <div className="space-y-4">
                  <div className="text-[10px] font-pixel text-center px-2 py-1.5" style={{ background: "#fff1d6", color: "#b45309", border: "2px dashed #d1a86c" }}>
                    💡 支持点击 · 拖入图片 · <strong>Ctrl+V 粘贴</strong>剪贴板图片
                  </div>

                  {/* 1. Sprite Avatar */}
                  <div
                    onClick={() => { setPasteTarget("avatar"); fileInputRef.current?.click(); }}
                    onDrop={(e) => { setPasteTarget("avatar"); handleDrop(e, "avatar"); }}
                    onDragOver={handleDragOver}
                    onMouseEnter={() => setPasteTarget("avatar")}
                    className={`flex flex-col items-center justify-center border-4 border-dashed p-4 cursor-pointer transition-all pixel-border-slate ${
                      pasteTarget === "avatar" ? "ring-2 ring-amber-400" : ""
                    }`}
                    style={{ background: "#fffaf0", borderColor: pasteTarget === "avatar" ? "#f59e0b" : "#d1a86c" }}
                  >
                    <span className="text-[11px] font-pixel font-bold mb-2 flex items-center gap-1" style={{ color: "#b45309" }}>
                      <span>🎮</span> 关卡行走头像 *
                    </span>
                    {editingOC.avatarUrl ? (
                      <div className="relative group">
                        <img
                          src={editingOC.avatarUrl}
                          alt="OC Sprite"
                          className="w-24 h-24 object-contain border-2 shadow-lg pixel-border-gold"
                          style={{ background: "#fff", borderColor: "#f59e0b" }}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingOC((prev) => ({ ...prev, avatarUrl: "" })); }}
                          className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-500"
                          title="移除图片"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-3">
                        <Upload size={30} className="mb-1.5" style={{ color: "#b45309" }} />
                        <p className="text-xs font-bold font-pixel" style={{ color: "#3a2410" }}>点这里选图 / 拖进来 / Ctrl+V</p>
                        <p className="text-[10px] mt-1" style={{ color: "#6b4a2b" }}>PNG 透明图最佳，会自动压缩</p>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageFile(f);
                      }}
                      className="hidden"
                    />
                  </div>

                  {/* 2. Standing Portrait (立绘) */}
                  <div
                    onClick={() => { setPasteTarget("portrait"); portraitInputRef.current?.click(); }}
                    onDrop={(e) => { setPasteTarget("portrait"); handleDrop(e, "portrait"); }}
                    onDragOver={handleDragOver}
                    onMouseEnter={() => setPasteTarget("portrait")}
                    className={`flex flex-col items-center justify-center border-4 border-dashed p-4 cursor-pointer transition-all pixel-border-slate ${
                      pasteTarget === "portrait" ? "ring-2 ring-sky-400" : ""
                    }`}
                    style={{ background: "#fffaf0", borderColor: pasteTarget === "portrait" ? "#0ea5e9" : "#d1a86c" }}
                  >
                    <span className="text-[11px] font-pixel font-bold mb-2 flex items-center gap-1" style={{ color: "#0284c7" }}>
                      <span>🖼️</span> 全身立绘 (对话用·可选)
                    </span>
                    {editingOC.portraitUrl ? (
                      <div className="relative group">
                        <img
                          src={editingOC.portraitUrl}
                          alt="OC Portrait"
                          className="w-24 h-32 object-cover border-2 shadow-lg pixel-border-gold"
                          style={{ background: "#fff", borderColor: "#0ea5e9" }}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingOC((prev) => ({ ...prev, portraitUrl: "" })); }}
                          className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-500"
                          title="移除立绘"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-3">
                        <ImageIcon size={30} className="mb-1.5" style={{ color: "#0284c7" }} />
                        <p className="text-xs font-bold font-pixel" style={{ color: "#3a2410" }}>点这里选图 / 拖进来 / Ctrl+V</p>
                        <p className="text-[10px] mt-1" style={{ color: "#6b4a2b" }}>用于对话界面展示，可留空</p>
                      </div>
                    )}

                    <input
                      ref={portraitInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePortraitFile(f);
                      }}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Right: OC Info & Personality Settings */}
                <div className="md:col-span-2 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-pixel text-slate-300 mb-1">
                        角色姓名 *
                      </label>
                      <input
                        type="text"
                        placeholder="例如: 幻夜琉璃、茶茶、星野"
                        value={editingOC.name || ""}
                        onChange={(e) => setEditingOC({ ...editingOC, name: e.target.value })}
                        className="w-full bg-slate-900 border-2 border-slate-700 focus:border-amber-400 px-3 py-2 text-xs text-white outline-none pixel-border-slate"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-pixel text-slate-300 mb-1">
                        冒险称号 / 身份
                      </label>
                      <input
                        type="text"
                        placeholder="例如: 微风见习骑士、星咏魔法使"
                        value={editingOC.title || ""}
                        onChange={(e) => setEditingOC({ ...editingOC, title: e.target.value })}
                        className="w-full bg-slate-900 border-2 border-slate-700 focus:border-amber-400 px-3 py-2 text-xs text-white outline-none pixel-border-slate"
                      />
                    </div>
                  </div>

                  {/* Personality Radio Picker */}
                  <div>
                    <label className="block text-xs font-pixel text-slate-300 mb-1">
                      核心性格定位 (会影响智能剧情对话反应):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PERSONALITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.type}
                          type="button"
                          onClick={() => setEditingOC({ ...editingOC, personality: opt.type })}
                          className={`p-2 border-2 text-left transition-all ${
                            editingOC.personality === opt.type
                              ? "bg-amber-500/20 border-amber-400 text-amber-300 font-bold pixel-border-gold"
                              : "bg-slate-900/50 border-slate-700 text-slate-300 hover:border-slate-500"
                          }`}
                        >
                          <div className="flex items-center gap-1 text-xs">
                            <span>{opt.emoji}</span>
                            <span className="font-pixel">{opt.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                            {opt.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Catchphrase */}
                  <div>
                    <label className="block text-xs font-pixel text-slate-300 mb-1">
                      标志性口头禅
                    </label>
                    <input
                      type="text"
                      placeholder="例如: '愿星光与我们同在！' 或 '这只是热身运动！'"
                      value={editingOC.catchphrase || ""}
                      onChange={(e) => setEditingOC({ ...editingOC, catchphrase: e.target.value })}
                      className="w-full bg-slate-900 border-2 border-slate-700 focus:border-amber-400 px-3 py-2 text-xs text-white outline-none pixel-border-slate"
                    />
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-xs font-pixel text-slate-300 mb-1">
                      OC 背景设定 / 简介
                    </label>
                    <textarea
                      rows={2}
                      placeholder="写下这位原创角色的过往、兴趣或踏上冒险的原因..."
                      value={editingOC.bio || ""}
                      onChange={(e) => setEditingOC({ ...editingOC, bio: e.target.value })}
                      className="w-full bg-slate-900 border-2 border-slate-700 focus:border-amber-400 px-3 py-2 text-xs text-white outline-none resize-none pixel-border-slate"
                    />
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSaveOC}
                      className="pixel-btn-green font-pixel text-xs px-6 py-2.5 font-bold flex items-center gap-2"
                    >
                      <Check size={16} /> 保存并设为当前出战角色
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* OC Roster Cards Grid */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider font-pixel">
              已保存的角色阵容 ({ocs.length}) · 点击卡片出战，支持随时更换立绘
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ocs.map((oc) => {
                const isActive = oc.id === activeOC.id;
                return (
                  <div
                    key={oc.id}
                    onClick={() => {
                      onSelectOC(oc);
                      sound.playClick();
                    }}
                    className={`relative p-4 border-2 cursor-pointer transition-all flex items-start gap-4 ${
                      isActive
                        ? "bg-slate-800/90 border-amber-400 pixel-border-gold ring-1 ring-amber-400/40"
                        : "bg-slate-900/70 border-slate-800 hover:border-slate-700 pixel-border-slate"
                    }`}
                  >
                    {/* Active Ribbon */}
                    {isActive && (
                      <div className="absolute -top-2.5 right-4 bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 shadow flex items-center gap-1 font-pixel">
                        <UserCheck size={12} /> 出战中
                      </div>
                    )}

                    {/* Avatar Portrait */}
                    <div className="relative shrink-0 flex flex-col items-center">
                      <img
                        src={oc.avatarUrl}
                        alt={oc.name}
                        className="w-16 h-16 object-contain bg-slate-800 border-2 border-slate-700 p-1 pixel-border-slate"
                      />
                      
                      {/* Affection badge */}
                      <div className="absolute -bottom-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.2 border border-rose-400 flex items-center gap-0.5">
                        <Heart size={10} className="fill-rose-200" />
                        <span>{oc.affection || 10}</span>
                      </div>

                      {/* Stand portrait badge / upload trigger */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetOCForPortrait(oc.id);
                          targetOCPortraitRef.current?.click();
                        }}
                        className="mt-2 text-[10px] text-amber-300 hover:text-amber-200 flex items-center gap-1 font-pixel underline"
                        title="点击上传或更换该角色的全身立绘"
                      >
                        <ImageIcon size={11} />
                        <span>{oc.portraitUrl ? "已设立绘" : "上传立绘"}</span>
                      </button>
                    </div>

                    {/* OC Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-white truncate font-pixel">{oc.name}</h4>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 border border-slate-700 font-pixel">
                          {oc.personality}
                        </span>
                        {oc.portraitUrl && (
                          <span className="text-[9px] bg-purple-950 text-purple-300 px-1.5 py-0.5 border border-purple-500/40 font-pixel">
                            ✨有立绘
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-300/90 mt-0.5 font-medium truncate font-pixel">{oc.title}</p>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 italic">
                        "{oc.catchphrase || "愿星光照亮前路"}"
                      </p>

                      {/* Stats & Unlocks */}
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400 font-pixel">
                        <span className="flex items-center gap-1 text-amber-400">
                          <Coins size={12} /> {oc.coinsCollected || 0}
                        </span>
                        <span className="flex items-center gap-1 text-sky-400">
                          <Star size={12} /> {oc.starsCollected || 0}
                        </span>
                        <span className="text-purple-300">
                          已解外观: {oc.unlockedAppearances?.length || 0}
                        </span>
                      </div>
                    </div>

                    {/* Delete button (only for non-actives if more than 1) */}
                    {ocs.length > 1 && !isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`确定要删除角色 ${oc.name} 吗？`)) {
                            GameStorage.deleteOC(oc.id);
                            sound.playClick();
                            onRefreshOCs();
                          }
                        }}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors self-end"
                        title="删除该OC"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBackToMainMenu && (
              <button
                onClick={() => {
                  onClose();
                  onBackToMainMenu();
                }}
                className="pixel-btn-slate font-pixel text-xs px-3 py-2 flex items-center gap-1.5 text-slate-300 hover:text-white"
              >
                <Home size={13} /> 返回大标题
              </button>
            )}

            <span className="text-xs text-slate-400 font-pixel text-[11px]">
              当前出战: <strong className="text-amber-300">{activeOC.name}</strong> ({activeOC.title})
            </span>
          </div>

          <button
            onClick={onClose}
            className="pixel-btn-amber font-bold px-6 py-2.5 text-xs shadow-lg font-pixel text-slate-950"
          >
            确认并进入探险
          </button>
        </div>
      </div>
    </div>
  );
};
