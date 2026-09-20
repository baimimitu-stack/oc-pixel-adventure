# 简化记忆库 · 2026-09-20

依据本机 `C:/直播用/Claude/memory-core/规范/companion-v1.2.md` 与 v1.1 的日记、记忆字段实现。
独立纯前端适配，不连接 memory-core 服务、分支或衍生项目，不声明完整 Companion L1/L2 合规。

## 功能与边界

- 主菜单 → 记忆库。聊天双方的原文自动写入 `oc_game_memory_v1`，刷新后恢复。
- 归属为 `npc_id=world:<关卡编号>` 加 `oc_id`。各 NPC、各 OC 关系互相隔离；NPC 改名保留该世界的记录。
- 只有 diary / permanent 两层。标为永久就地改 tier；移除写 deleted_at，原文保留，可恢复。
- 导入单个 JSONL：memory-core diary、short_term、long_term、permanent。前 3 类并为 diary，permanent 保留；分析式自我定义降为日常且不可提升。
- 导入先预览并明确绑定关系；整文件校验后一次写入。重复 ID 跳过（包括移除记录），不会覆盖旧原文。最多 2 MB / 5000 条。
- 保留 facts 和原始 source 元数据；导入记忆标为 memory，不伪造为 NPC 原话。导出是游戏自己的 JSONL，包含移除标记和原文；不是完整 .companion ZIP。
- 后续 NPC prompt 加入当前关系的永久记忆（最新优先，8000 字符预算）和最近 6 条日常记录，每条正文最多 1200 字符。再加入角色设定、角色卡摘要（不含 notes）和本次输入。记录仅作资料，不能作为界面或系统指令。
- 读取与导入不调用 AI。在线对话使用用户已有 AI 配置，相关记忆随文字发送；离线模板只保存对话，不做语义回忆。
- 聊天独立持久化，快读／普通读档／新游戏不回滚记忆；隐私中心清空全部数据会清除记忆和音量。
- 关闭对话后已发出的请求若返回，回复仍保存到原 NPC × OC 的关系；旧组件不再更新当前 OC 的奖励。
- 世界书、身份漂移、三级自动归档、其他项目接线、完整 ZIP 包与角色卡编辑不在此次实现范围。

## 验证

用交接指定的便携 Node 执行：

```
node --test tests/memory.test.cjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

测试覆盖角色隔离、原文与 ID 保持、移除/恢复/防复活、v1.2 字段映射、重复导入、错误行原子性、导出往返、上下文数量限制、配额失败与损坏数据保护。
`tests/memory-core.sample.jsonl` 是无个人数据的浏览器导入样例。

本地浏览器已验证：发言、输入 q 不误关闭、刷新保留双方记录、永久标记、NPC 切换隔离、样例导入预览及两层结果。

## 接手状态

音量、快存/快读、简化记忆库、角色卡导入导出（单文件 .companion.json）已实现。
依用户要求只更新本地代码，等全部功能完成后统一部署；没有 push 或发布线上。
