import React, { useEffect, useRef, useState } from "react";
import { EXPRESSION_LIST, ExpressionKey, ExpressionPortraitMap } from "../types";
import { sound } from "../services/sound";
import { Trash2, Upload } from "lucide-react";

interface ExpressionPortraitEditorProps {
  value: ExpressionPortraitMap;
  onChange: (next: ExpressionPortraitMap) => void;
  /** 显示在最上方的说明标题 */
  title?: string;
  /** 组件外面自己套 wrapper 时可以关掉 */
  boxed?: boolean;
}

/** 把一张图压到 512px 内的 PNG base64。跟 OC/NPC 现有上传逻辑一致。 */
async function readAsCompressedPng(file: File, maxDim = 512): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return resolve(null);
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else       { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export const ExpressionPortraitEditor: React.FC<ExpressionPortraitEditorProps> = ({
  value,
  onChange,
  title = "表情立绘（对话时按 AI 情绪自动切）",
  boxed = true,
}) => {
  const [pasteTarget, setPasteTarget] = useState<ExpressionKey | null>(null);
  const [error, setError] = useState("");
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Ctrl+V 粘贴：贴到当前 hover / 最后点过的槽
  useEffect(() => {
    if (!pasteTarget) return;
    const handle = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            const base64 = await readAsCompressedPng(file);
            if (base64) {
              onChange({ ...value, [pasteTarget]: base64 });
              sound.playStar();
              setError("");
            }
            return;
          }
        }
      }
    };
    window.addEventListener("paste", handle);
    return () => window.removeEventListener("paste", handle);
  }, [pasteTarget, value, onChange]);

  const handleFile = async (key: ExpressionKey, file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("只能上传图片文件（PNG/JPG/WebP/GIF）"); return; }
    const base64 = await readAsCompressedPng(file);
    if (!base64) { setError("图片解码失败，换一张试试"); return; }
    onChange({ ...value, [key]: base64 });
    sound.playStar();
    setError("");
  };

  const clearSlot = (key: ExpressionKey) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
    sound.playClick();
  };

  const configured = EXPRESSION_LIST.filter((row) => value[row.key]).length;

  const grid = (
    <>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="text-xs font-pixel font-bold" style={{ color: "#b45309" }}>{title}</div>
        <div className="text-[11px]" style={{ color: "#6b4a2b" }}>
          已配置 {configured} / {EXPRESSION_LIST.length} · 支持点击 · 拖入 · <strong>Ctrl+V</strong> 粘贴
        </div>
      </div>

      {error && (
        <p role="alert" className="text-[11px] mb-2" style={{ color: "#991b1b" }}>{error}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {EXPRESSION_LIST.map((row) => {
          const url = value[row.key];
          const active = pasteTarget === row.key;
          return (
            <div key={row.key} className="flex flex-col items-center gap-1">
              <div
                onClick={() => { setPasteTarget(row.key); inputRefs.current[row.key]?.click(); }}
                onMouseEnter={() => setPasteTarget(row.key)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); handleFile(row.key, event.dataTransfer.files?.[0]); setPasteTarget(row.key); }}
                className={`relative w-full aspect-[3/4] border-4 border-dashed cursor-pointer transition-all pixel-border-slate flex items-center justify-center overflow-hidden ${active ? "ring-2 ring-amber-500" : ""}`}
                style={{ background: url ? "#fff" : "#fffaf0", borderColor: active ? "#f59e0b" : "#d1a86c" }}
                title={`${row.label} · ${row.desc}`}
              >
                {url ? (
                  <>
                    <img src={url} alt={`${row.label}表情立绘`} className="w-full h-full object-cover object-top" />
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); clearSlot(row.key); }}
                      className="absolute top-1 right-1 bg-red-600/90 text-white rounded-full p-1 shadow"
                      title="清空这个槽"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center px-1">
                    <span className="text-2xl">{row.emoji}</span>
                    <Upload size={14} className="mt-1" style={{ color: "#b45309" }} />
                    <span className="text-[10px] mt-1" style={{ color: "#6b4a2b" }}>点这里传</span>
                  </div>
                )}
              </div>
              <div className="text-[11px] font-pixel" style={{ color: "#3a2410" }}>
                {row.emoji} {row.label}
              </div>
              <input
                ref={(node) => { inputRefs.current[row.key] = node; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => { handleFile(row.key, event.target.files?.[0]); event.target.value = ""; }}
              />
            </div>
          );
        })}
      </div>

      <p className="text-[11px] mt-2" style={{ color: "#6b4a2b" }}>
        💡 AI 回话时会输出情绪（smile / excited / shy / surprised / cool / happy / grateful）。命中当前情绪的立绘会自动切上；缺席的走「微笑」→ 默认立绘 → 头像。
      </p>
    </>
  );

  if (!boxed) return <div>{grid}</div>;

  return (
    <div className="p-3 border-2 pixel-border-slate" style={{ background: "#fff1d6", borderColor: "#d1a86c" }}>
      {grid}
    </div>
  );
};
