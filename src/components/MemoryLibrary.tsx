import React, { useEffect, useState } from "react";
import { GameStorage } from "../services/db";
import { getLevelByWorld } from "../game/levels";
import { DiaryEntry, Memory, MemoryScope } from "../services/memory";

export function MemoryLibrary({ currentWorld }: { currentWorld: number }) {
  const [world, setWorld] = useState(currentWorld);
  const [ocId, setOcId] = useState(() => GameStorage.getActiveOCId());
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ text: string; scope: MemoryScope; label: string; count: number; preview: string } | null>(null);
  const ocs = GameStorage.getOCs();
  const scope = { npc_id: `world:${world}`, oc_id: ocId };
  const npcName = getLevelByWorld(world).npc?.name || `世界 ${world} NPC`;
  const ocName = ocs.find((oc) => oc.id === ocId)?.name || "未找到的 OC";

  function refresh() {
    try { setEntries(Memory.get(scope, true)); setError(""); }
    catch { setError("记忆库读取失败，原数据未覆盖。浏览器存储可能不可用或数据损坏。"); setEntries([]); }
  }
  useEffect(() => { refresh(); setPending(null); setMessage(""); setLimit(50); }, [world, ocId]);

  function act(action: () => void | string, success: string) {
    try { const result = action(); refresh(); setMessage(result || success); }
    catch (e) { setMessage(e instanceof Error ? e.message : "操作失败，浏览器存储可能已满。"); }
  }

  const visible = entries.filter((entry) => {
    if (filter === "removed" ? !entry.deleted_at : !!entry.deleted_at) return false;
    if (filter === "permanent" && entry.tier !== "permanent") return false;
    if (filter === "diary" && entry.tier !== "diary") return false;
    return entry.content.includes(search) || (entry.speaker_name || "").includes(search);
  }).reverse();

  return <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-3" style={{ color: "#3a2410" }}>
    <p className="text-xs leading-relaxed p-3 pixel-border-slate" style={{ background: "#fff1d6" }}>
      对话自动保存在当前浏览器。每段 NPC × OC 关系独立，刷新后保留。
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
      <label>NPC
        <select aria-label="记忆所属 NPC" value={world} onChange={(e) => setWorld(Number(e.target.value))} className="w-full p-2 border" style={{ background: "#fff", color: "#3a2410" }}>
          {[1, 2, 3, 4].map((w) => <option key={w} value={w}>世界 {w} · {getLevelByWorld(w).npc?.name}</option>)}
        </select>
      </label>
      <label>与哪位 OC 的记录
        <select aria-label="记忆所属 OC" value={ocId} onChange={(e) => setOcId(e.target.value)} className="w-full p-2 border" style={{ background: "#fff", color: "#3a2410" }}>
          {ocs.map((oc) => <option key={oc.id} value={oc.id}>{oc.name}</option>)}
        </select>
      </label>
    </div>
    <div className="flex flex-wrap gap-2 text-xs">
      <button className="pixel-btn-blue px-3 py-2" disabled={!!error} onClick={() => act(() => {
        const text = Memory.exportJsonl(scope);
        if (!text) throw new Error("这段关系还没有可导出的记录。");
        const url = URL.createObjectURL(new Blob([text], { type: "application/x-ndjson;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `${npcName}-${ocName}.memory.jsonl`.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "已导出这段关系的全部记录（包括已移除记录的原文与标记）。")}>导出记忆</button>
      <label className="pixel-btn-amber px-3 py-2 cursor-pointer">导入记忆文件
        <input className="sr-only" aria-label="导入记忆文件" type="file" accept=".jsonl,.ndjson" onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setPending(null);
          try {
            if (file.size > 2_000_000) throw new Error("文件超过 2 MB，请拆成较小文件。");
            const text = await file.text();
            const parsed = Memory.parseJsonl(text, scope);
            setPending({ text, scope, label: `${npcName} × ${ocName}`, count: parsed.length, preview: parsed[0].content.slice(0, 200) });
            setMessage("");
          } catch (e) { setMessage(e instanceof Error ? e.message : "文件读取失败。"); }
        }} />
      </label>
    </div>
    <details className="text-[11px] leading-relaxed">
      <summary className="cursor-pointer">导入与记忆说明</summary>
      <p>兼容 memory-core 的 diary/entries.jsonl 和 tiers/*.jsonl：短期、长期归入日常记录，永久层保留。只读取单个 JSONL 文件，不读取完整 .companion 压缩包。NPC 按所在世界区分，改名保留记录。</p>
      <p>后续 AI 对话会按篇幅选用永久记忆，以及最近 6 条日常记录；这些文字会发到你配置的 AI 服务商。离线台词不会理解记忆。读档不会回滚或抹掉聊天记录。</p>
      <p>移除只是停止使用，可恢复；导出包含已移除记录原文。彻底清除可使用隐私中心的全部数据清理。</p>
    </details>
    {pending && <div className="p-3 space-y-2 border-2 border-amber-600 text-xs" style={{ background: "#fffbeb" }}>
      <p>将 {pending.count} 条记录导入「{pending.label}」。文件内的角色归属会映射到这段关系，相同 ID 跳过。</p>
      <p className="whitespace-pre-wrap break-words">首条预览：{pending.preview}</p>
      <button className="pixel-btn-green px-3 py-2 mr-2" onClick={() => act(() => {
        const result = Memory.importJsonl(pending.text, pending.scope);
        setPending(null);
        return `已导入 ${result.added} 条，跳过 ${result.skipped} 条重复记录。`;
      }, "导入完成，相同 ID 已跳过。")}>确认导入这段关系</button>
      <button className="pixel-btn-slate px-3 py-2" onClick={() => setPending(null)}>取消</button>
    </div>}
    {error && <p role="alert" className="text-xs" style={{ color: "#991b1b" }}>{error}</p>}
    {message && <p role="status" className="text-xs p-2" style={{ background: "#fef3c7" }}>{message}</p>}
    <div className="flex flex-wrap gap-2 text-xs">
      <select aria-label="记忆分类" value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(50); }} className="p-2 border" style={{ background: "#fff", color: "#3a2410" }}>
        <option value="all">全部记录</option><option value="diary">日常记录</option><option value="permanent">永久记忆</option><option value="removed">已移除</option>
      </select>
      <input aria-label="搜索记忆" placeholder="搜索对话或记忆" value={search} onChange={(e) => { setSearch(e.target.value); setLimit(50); }} className="flex-1 min-w-0 p-2 border" style={{ background: "#fff", color: "#3a2410" }} />
      <span className="self-center">{visible.length} 条</span>
    </div>
    {visible.length === 0 && !error && <p className="text-xs py-4 text-center">这里还没有记录。可以和 NPC 聊聊天，或导入已有记忆。</p>}
    {visible.slice(0, limit).map((entry) => <article key={entry.id} className="p-3 border-2 space-y-2" style={{ background: "#fffaf0", borderColor: "#d1a86c" }}>
      <div className="flex flex-wrap justify-between gap-2 text-[11px]">
        <span>{entry.kind === "memory" ? "导入记忆" : entry.speaker_name || (entry.role === "player" ? ocName : npcName)} · {entry.tier === "permanent" ? "永久记忆" : "日常记录"}</span>
        <time>{new Date(entry.created_at).toLocaleString()}</time>
      </div>
      <p className="text-xs whitespace-pre-wrap break-words leading-relaxed">{entry.content}</p>
      <div className="flex gap-2 text-[11px]">
        {entry.deleted_at ? <button className="pixel-btn-green px-2 py-1" onClick={() => act(() => Memory.restore(scope, entry.id), "记录已恢复。")}>恢复记录</button> : <>
          {entry.tier !== "permanent" && <button className="pixel-btn-amber px-2 py-1" onClick={() => act(() => Memory.promote(scope, entry.id), "已标为永久记忆，原文保留。")}>记为永久</button>}
          <button className="pixel-btn-slate px-2 py-1" onClick={() => act(() => Memory.wipe(scope, entry.id), "已移除，不再用于对话；可在已移除中恢复。")}>移除</button>
        </>}
      </div>
    </article>)}
    {visible.length > limit && <button className="pixel-btn-slate px-3 py-2 text-xs" onClick={() => setLimit((value) => value + 50)}>再显示 50 条</button>}
  </div>;
}
