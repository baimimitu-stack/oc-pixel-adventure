import React from "react";
import { GAMES } from "./games";

export default function Portal() {
  return (
    <div className="min-h-screen w-full bg-sunny ink font-sans">
      <header className="border-b-4 border-amber-700/70 px-4 sm:px-8 py-4 flex items-center gap-3 pixel-border-slate" style={{ background: "linear-gradient(180deg, #ffe4b5 0%, #ffd58a 100%)" }}>
        <span className="text-2xl">🕹️</span>
        <div>
          <h1 className="font-pixel text-sm sm:text-base font-bold text-amber-400">像素游戏盒子</h1>
          <p className="text-[11px] sm:text-xs ink-soft mt-0.5">免安装，浏览器直接玩 · 存档只留在你自己的设备上</p>
        </div>
      </header>

      <main className="px-4 sm:px-8 py-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GAMES.map((game) => (
            <a
              key={game.id}
              href={game.path}
              className="group block pixel-border-gold bg-white/40 hover:-translate-y-1 transition-transform"
            >
              <div className="aspect-video w-full overflow-hidden border-b-4 border-amber-700/70">
                <img
                  src={game.cover}
                  alt={game.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3">
                <h2 className="font-pixel text-xs font-bold text-amber-500 mb-1">{game.title}</h2>
                <p className="text-[11px] ink-soft mb-2 leading-relaxed">{game.tagline}</p>
                <div className="flex flex-wrap gap-1.5">
                  {game.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 pixel-btn-slate">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </a>
          ))}

          {/* 预留位：以后有新游戏直接在 games.ts 里加一项就行 */}
          <div className="flex flex-col items-center justify-center gap-2 border-4 border-dashed border-amber-700/30 py-10 text-center">
            <span className="text-2xl opacity-50">➕</span>
            <p className="text-[11px] ink-soft">更多游戏陆续上架中</p>
          </div>
        </div>
      </main>

      <footer className="px-4 sm:px-8 py-6 text-center text-[11px] ink-soft">
        像素游戏盒子 · 纯前端静态站，无后端服务器
      </footer>
    </div>
  );
}
