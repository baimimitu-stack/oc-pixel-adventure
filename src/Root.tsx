import React, { useEffect } from "react";
import App from "./App";
import Portal from "./Portal";
import { GAMES } from "./games";

export default function Root() {
  const path = window.location.pathname;
  const game = GAMES.find((g) => path.startsWith(g.path));

  useEffect(() => {
    if (game) {
      document.title = game.title;
      document.body.classList.add("overflow-hidden", "touch-manipulation");
    } else {
      document.title = "像素游戏盒子";
      document.body.classList.remove("overflow-hidden", "touch-manipulation");
    }
  }, [game]);

  if (game?.id === "oc-pixel-adventure") {
    return <App />;
  }

  return <Portal />;
}
