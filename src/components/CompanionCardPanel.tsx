import React from "react";
import { CompanionCharacter } from "../types";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  open: boolean;
  onToggle: () => void;
  character: CompanionCharacter;
  onChange: (next: CompanionCharacter) => void;
  onSave: () => void;
  hint?: string;
}

const field = "w-full bg-slate-900 border-2 border-slate-700 focus:border-amber-400 px-3 py-2 text-xs text-white outline-none pixel-border-slate";

export const CompanionCardPanel: React.FC<Props> = ({ open, onToggle, character, onChange, onSave, hint }) => {
  const set = (next: Partial<CompanionCharacter>) => onChange({ ...character, ...next });
  const info = character.basic_info;
  const look = character.appearance;
  const palette = character.personality_palette;

  return (
    <div className="bg-slate-950/70 border border-slate-800 p-3 space-y-3">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between text-xs font-pixel text-amber-300">
        <span>角色卡 8 字段（memory-core v1.2，折叠编辑）</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-400">{hint || "导出为单个 .companion.json，不是 ZIP。备注不会进对话 prompt。"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input className={field} placeholder="姓名" value={info.name} onChange={(e) => set({ basic_info: { ...info, name: e.target.value } })} />
            <input className={field} placeholder="年龄（可空）" value={info.age ?? ""} onChange={(e) => set({ basic_info: { ...info, age: e.target.value === "" ? null : Number(e.target.value) || null } })} />
            <input className={field} placeholder="身份" value={info.identity} onChange={(e) => set({ basic_info: { ...info, identity: e.target.value } })} />
            <input className={field} placeholder="与玩家关系" value={info.user_relation} onChange={(e) => set({ basic_info: { ...info, user_relation: e.target.value } })} />
          </div>
          <textarea className={field} rows={2} placeholder="外形要点，一行一条" value={look.signature_features.join("\n")} onChange={(e) => set({ appearance: { ...look, signature_features: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean) } })} />
          <input className={field} placeholder="着装" value={look.clothing_style} onChange={(e) => set({ appearance: { ...look, clothing_style: e.target.value } })} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input className={field} placeholder="性格底色" value={palette.base.name} onChange={(e) => set({ personality_palette: { ...palette, base: { ...palette.base, name: e.target.value } } })} />
            <input className={field} placeholder="主性格" value={palette.primary.name} onChange={(e) => set({ personality_palette: { ...palette, primary: { ...palette.primary, name: e.target.value } } })} />
            <input className={field} placeholder="点缀性格" value={palette.accent.name} onChange={(e) => set({ personality_palette: { ...palette, accent: { ...palette.accent, name: e.target.value } } })} />
          </div>
          <input className={field} placeholder="日常表现（具体行为，不要写「TA 是一个 X 的人」）" value={palette.base.manifestations[0]?.behavior || ""} onChange={(e) => {
            const manifestations = [...palette.base.manifestations];
            manifestations[0] = { context: "日常", behavior: e.target.value };
            set({ personality_palette: { ...palette, base: { ...palette.base, manifestations } } });
          }} />
          <textarea className={field} rows={2} placeholder="经历时间线，一行一条，可用 24|搬到现在的公寓" value={character.backstory_timeline.map((row) => (row.age != null ? `${row.age}|${row.event}` : row.event)).join("\n")} onChange={(e) => set({
            backstory_timeline: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
              const match = line.match(/^(\d+)\s*[|：:]\s*(.+)$/);
              return match ? { age: Number(match[1]), event: match[2] } : { age: null, event: line };
            }),
          })} />
          <textarea className={field} rows={2} placeholder="关系，一行一条：名字|描述" value={character.relationships.map((row) => `${row.with}|${row.description}`).join("\n")} onChange={(e) => set({
            relationships: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
              const [withName, ...rest] = line.split("|");
              return { with: withName.trim(), description: rest.join("|").trim() };
            }),
          })} />
          <input className={field} placeholder="公开面" value={character.three_faces.public} onChange={(e) => set({ three_faces: { ...character.three_faces, public: e.target.value } })} />
          <input className={field} placeholder="压力面" value={character.three_faces.under_pressure} onChange={(e) => set({ three_faces: { ...character.three_faces, under_pressure: e.target.value } })} />
          <input className={field} placeholder="隐藏面" value={character.three_faces.hidden} onChange={(e) => set({ three_faces: { ...character.three_faces, hidden: e.target.value } })} />
          <textarea className={field} rows={2} placeholder="备注（不注入对话）" value={character.notes} onChange={(e) => set({ notes: e.target.value })} />
          <input className={field} placeholder="context 拼接提示" value={character.advanced.context_hints} onChange={(e) => set({ advanced: { ...character.advanced, context_hints: e.target.value } })} />
          <div className="flex justify-end">
            <button type="button" onClick={onSave} className="pixel-btn-amber font-pixel text-xs px-4 py-2 text-slate-950">保存角色卡到当前 OC</button>
          </div>
        </div>
      )}
    </div>
  );
};
