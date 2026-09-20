# 部署到 mimitu.top（VPS + nginx 静态托管）

目标：把游戏部署到 `https://game.mimitu.top`，玩家点开即玩，AI 对话由玩家自填 Key 走浏览器直连，你自己不承担任何 AI 费用。

---

## 第 0 步 · 心里有数

这版游戏已经改造成 **纯静态 SPA**（没有后端）：
- 本地构建产 `dist/` 静态目录（HTML + JS + CSS）
- 传到 VPS，nginx 直接 serve
- 玩家在浏览器里填自己的 Gemini/DeepSeek/API Key，AI 请求由玩家浏览器直接发到 AI 厂商，绕过你的服务器
- 你只出静态托管的带宽和存储（几乎为零）

---

## 第 1 步 · 本地构建 dist/

在 Windows 本地，双击项目根目录的 **`BUILD.bat`**（会自动 `npm install` + `npm run build`）。

跑完你会看到：
```
[OK] Static site built at: C:\Users\15648\Downloads\oc-pixel-adventure\dist
```

`dist/` 目录里就是最终要上传的所有文件（index.html + assets/）。

---

## 第 2 步 · DNS 加解析

登录你的域名管理面板（阿里云 / Cloudflare / DNSPod / 腾讯云等）：

添加一条 A 记录：
- **主机记录**：`game`
- **记录类型**：`A`
- **记录值**：`你的 VPS 公网 IP`
- **TTL**：`600`（10 分钟）

访问 https://dnschecker.org 或 `nslookup game.mimitu.top` 确认解析生效（几分钟到半小时）。

---

## 第 3 步 · VPS 准备 nginx

SSH 登录你的 VPS（假设 Ubuntu 20/22 系）：

```bash
# 装 nginx（已装可跳过）
sudo apt update
sudo apt install -y nginx

# 建站点目录
sudo mkdir -p /var/www/oc-pixel-adventure
sudo chown -R $USER:$USER /var/www/oc-pixel-adventure
```

---

## 第 4 步 · 把 dist/ 传上去

**方法 A：scp（简单粗暴）**

在本地 PowerShell/Bash（你的电脑上）：
```bash
# 把本地 dist 里的全部文件传到 VPS 对应目录
scp -r C:/Users/15648/Downloads/oc-pixel-adventure/dist/* your_user@your_vps_ip:/var/www/oc-pixel-adventure/
```

**方法 B：rsync（推荐，增量传送）**

在本地：
```bash
rsync -avz --delete C:/Users/15648/Downloads/oc-pixel-adventure/dist/ your_user@your_vps_ip:/var/www/oc-pixel-adventure/
```

（Windows 上 rsync 需装 cwRsync 或者用 WSL；scp 走 OpenSSH 自带的即可）

---

## 第 5 步 · 配置 nginx 站点

把 `deploy/nginx-site.conf` 传到 VPS，或直接复制内容：

```bash
sudo nano /etc/nginx/sites-available/oc-pixel-adventure.conf
# 粘贴 nginx-site.conf 的内容后 Ctrl+O 保存 Ctrl+X 退出
```

启用站点：
```bash
sudo ln -s /etc/nginx/sites-available/oc-pixel-adventure.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

此时先注释掉 nginx-site.conf 里的 HTTPS 那段（`listen 443 ssl` 那个 server 块），
只留 HTTP 那段，用于让 certbot 完成 SSL 验证。

---

## 第 6 步 · 申请 HTTPS 证书（免费 Let's Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d game.mimitu.top --agree-tos --email your_email@example.com --no-eff-email

# certbot 会自动改 nginx 配加上 ssl 部分。若已用上面 conf，可以只签证书不让 certbot 改配：
# sudo certbot certonly --webroot -w /var/www/certbot -d game.mimitu.top
```

签完后，恢复 nginx-site.conf 的 HTTPS 段（用回你的完整配置）：
```bash
sudo nginx -t
sudo systemctl reload nginx
```

自动续期（cerbot 默认已经装了 timer，验证一下）：
```bash
sudo systemctl list-timers | grep certbot
```

---

## 第 7 步 · 打开浏览器测试

访问 `https://game.mimitu.top`：
- 能加载主菜单 → 部署成功
- 玩家进 API tab 填 DeepSeek Key 试聊几句 → AI 对话通了

---

## 之后每次更新游戏

只需两步：
1. 本地双击 `BUILD.bat` 产新的 `dist/`
2. `rsync -avz --delete dist/ your_user@your_vps_ip:/var/www/oc-pixel-adventure/`

不用碰 nginx，不用重启服务。玩家刷新页面就是新版。

---

## 常见坑

- **访问 404**：检查 nginx 里的 `root` 路径是否指到 dist 的实际位置；`ls /var/www/oc-pixel-adventure/index.html` 看文件在不在
- **SPA 路由跳转 404**：确保 `try_files $uri $uri/ /index.html;` 那段在 nginx 配置里
- **玩家点"测试连接"报 CORS**：让玩家换 DeepSeek（DeepSeek 明确支持浏览器直调），OpenAI 官方也支持；某些三方中转会拦
- **国内玩家用 Gemini 报连接失败**：Gemini 在国内需要玩家本地有代理，这不是你能解决的，建议主推 DeepSeek
- **玩家上传大图导致 localStorage 满**：单张图内部已经压缩到 512x512 PNG，一般不会超 5MB 上限；真爆了让玩家去隐私中心一键抹除

---

## 附：更极简的托管方案

如果你懒得配 nginx：
- **Cloudflare Pages**：`git push` 到 GitHub → CF Pages 自动构建 → 免费 SSL + CDN（国内速度不稳）
- **Vercel**：同样 GitHub 一键部署（国内不稳）
- **EdgeOne Pages（腾讯）**：国内加速版的 CF Pages，需要备案才能上主域

但既然你 VPS 都有，nginx 是最省事、最快、最可控的方案。
