# 🎮 像素冒险物语 (OC Pixel Adventure)

React 19 + TypeScript + Tailwind 4 + Vite 的**纯静态 SPA** 横版闯关 + AVG 文游游戏。

## 🆕 v0.4 亮点

- **完全无后端**：整个游戏就是一个 `dist/` 静态目录，扔到任意 nginx / OSS / Cloudflare Pages / Vercel 都能跑
- **AI 由玩家浏览器直连**：Gemini / DeepSeek / OpenAI 兼容三家都通吃，站长不承担任何 AI 费用、看不到玩家的对白和 Key
- **画面亮化**：奶油米 + 桃粉 + 天空蓝，告别原来的深紫黑
- **上传门槛低**：OC 头像 / 立绘 / NPC 立绘支持点击 / 拖拽 / Ctrl+V 三种方式
- **隐私中心**：明确告知图片和 Key 只存本机 localStorage，提供一键抹除

## 🚀 本地开发

前提：机器上有 Node.js (v18+)，或者用项目里 `RUN.bat` 里指向的便携版。

```bash
npm install
npm run dev
# 浏览器打开 http://localhost:3000
```

Windows 用户可以直接双击 `RUN.bat`。

## 📦 打包上线

```bash
npm run build
# 产物在 dist/
```

或双击 `BUILD.bat`。把整个 `dist/` 目录传到服务器就好。

## 🌐 部署到自己的域名

详细步骤见 [`deploy/DEPLOY.md`](deploy/DEPLOY.md)，nginx 配置模板见 [`deploy/nginx-site.conf`](deploy/nginx-site.conf)。

大致流程（假设你 VPS + 域名 `mimitu.top` 齐全）：
1. 本地 `BUILD.bat` 产出 `dist/`
2. DNS 加 A 记录 `game.mimitu.top → VPS 公网 IP`
3. `scp -r dist/* user@vps:/var/www/oc-pixel-adventure/`
4. VPS 上装 nginx + certbot，用模板配置站点
5. 打开 `https://game.mimitu.top` 开玩

## 🤖 AI 服务商配置

主菜单 → **API 接口**，玩家自己填：

| 服务商 | baseUrl | 常用模型 | 国内可用性 |
| --- | --- | --- | --- |
| ✨ Google Gemini | 无需填 | `gemini-2.0-flash` | 需代理 |
| 🐬 DeepSeek | `https://api.deepseek.com` | `deepseek-chat` (V3) / `deepseek-reasoner` (R1) | ✅ 直连 |
| 🔌 OpenAI 兼容 | 自填（OpenRouter / OneAPI / 硅基流动 / 自建） | 自填 | 看端点 |

不填 Key 也能玩，NPC 会用内置的离线台词模板。

## 📁 项目结构

```
src/
├── App.tsx                    主应用壳
├── main.tsx                   React 入口
├── index.css                  Tailwind + 主题变量
├── types.ts                   类型定义
├── game/
│   ├── GameCanvas.tsx         Canvas 物理引擎 & 渲染
│   └── levels.ts              4 关关卡数据
├── components/
│   ├── MainMenuModal.tsx      主菜单 (含 API/存档/隐私 tab)
│   ├── OCStudio.tsx           OC 工坊 (自建角色 + 上传立绘)
│   ├── AppearanceShop.tsx     金币外观商店
│   ├── NPCCustomizerModal.tsx NPC 定制 + 立绘上传
│   ├── StoryDialogueModal.tsx AVG 对话舞台
│   ├── AchievementModal.tsx   成就殿堂
│   └── WorldSelectModal.tsx   大地图
└── services/
    ├── db.ts                  localStorage 持久化
    ├── sound.ts               Web Audio 8-bit 音效
    ├── aiClient.ts            浏览器直调 AI (Gemini/DeepSeek/OpenAI 兼容)
    └── proceduralEngine.ts    离线台词模板兜底
deploy/
├── DEPLOY.md                  部署到 VPS 的完整步骤
└── nginx-site.conf            nginx 配置模板
```

## 🔒 隐私

- 所有玩家上传的图片（OC 头像/立绘、NPC 立绘）都作为 base64 存进浏览器 localStorage，**从不上传**
- AI 请求由玩家浏览器**直接发到 AI 厂商**，中间没有站长的服务器
- AI 请求体只含文字（角色名、性格、玩家输入），**从不含图片**
- 玩家 API Key 只在本机 localStorage
- 主菜单 → 隐私中心提供一键抹除
