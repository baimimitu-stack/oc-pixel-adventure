import React, { useEffect, useRef, useState, useCallback } from "react";
import { LevelConfig, OCCharacter, GameParticle, FloatingText, PlatformTile } from "../types";
import { sound } from "../services/sound";
import { GameStorage } from "../services/db";
import { Sparkles, Trophy, ArrowRight, RotateCcw, MessageSquare, Volume2, VolumeX } from "lucide-react";

interface GameCanvasProps {
  level: LevelConfig;
  activeOC: OCCharacter;
  isPaused?: boolean;
  onLevelComplete: (stats: { coins: number; stars: number; score: number }) => void;
  onOpenShop: () => void;
  onOpenStory: (npc: LevelConfig["npc"]) => void;
  onBackToMap: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  level,
  activeOC,
  isPaused = false,
  onLevelComplete,
  onOpenShop,
  onOpenStory,
  onBackToMap,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sound toggle
  const [soundOn, setSoundOn] = useState<boolean>(sound.enabled);
  const toggleSound = () => {
    setSoundOn(sound.toggle());
  };

  // Game state
  const [score, setScore] = useState<number>(0);
  const [coinsRun, setCoinsRun] = useState<number>(0);
  const [starsRun, setStarsRun] = useState<number>(0);
  const [lives, setLives] = useState<number>(5);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isVictory, setIsVictory] = useState<boolean>(false);
  const [nearNPC, setNearNPC] = useState<boolean>(false);
  const [showGetReady, setShowGetReady] = useState<boolean>(true);
  const getReadyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track current level ID to ONLY restart when actual stage changes, not on modal/prop re-render!
  const currentLevelIdRef = useRef<string>(level.id);

  // Refs for loop
  const keysRef = useRef<{ left: boolean; right: boolean; jump: boolean; down: boolean }>({
    left: false,
    right: false,
    jump: false,
    down: false,
  });

  const stateRef = useRef({
    player: {
      x: 80,
      y: 350,
      vx: 0,
      vy: 0,
      width: 44,
      height: 44,
      grounded: false,
      isCrouching: false,
      jumpBuffer: 0,
      coyoteTime: 0,
      jumpsRemaining: 2,
      facing: "right" as "left" | "right",
      squashX: 1,
      squashY: 1,
      walkCycle: 0,
      invulnerableTimer: 0,
      lastSafeX: 80,
      lastSafeY: 350,
      isSpringBoosting: false,
    },
    cameraX: 0,
    levelData: JSON.parse(JSON.stringify(level)) as LevelConfig,
    particles: [] as GameParticle[],
    floatingTexts: [] as FloatingText[],
    coinsGained: 0,
    starsGained: 0,
    scoreGained: 0,
    gameActive: true,
    npcTriggered: false,
  });

  // Cached player avatar image
  const avatarImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = activeOC.avatarUrl;
    img.onload = () => {
      avatarImgRef.current = img;
    };
  }, [activeOC.avatarUrl]);

  // Restart run
  const restartLevel = useCallback(() => {
    const freshLevel = JSON.parse(JSON.stringify(level)) as LevelConfig;
    stateRef.current = {
      player: {
        x: 80,
        y: 350,
        vx: 0,
        vy: 0,
        width: 44,
        height: 44,
        grounded: false,
        isCrouching: false,
        jumpBuffer: 0,
        coyoteTime: 0,
        jumpsRemaining: 2,
        facing: "right",
        squashX: 1,
        squashY: 1,
        walkCycle: 0,
        invulnerableTimer: 0,
        lastSafeX: 80,
        lastSafeY: 350,
        isSpringBoosting: false,
      },
      cameraX: 0,
      levelData: freshLevel,
      particles: [],
      floatingTexts: [],
      coinsGained: 0,
      starsGained: 0,
      scoreGained: 0,
      gameActive: true,
      npcTriggered: false,
    };
    setCoinsRun(0);
    setStarsRun(0);
    setScore(0);
    setLives(5);
    setIsGameOver(false);
    setIsVictory(false);
    setShowGetReady(true);
    if (getReadyTimerRef.current) clearTimeout(getReadyTimerRef.current);
    getReadyTimerRef.current = setTimeout(() => {
      setShowGetReady(false);
    }, 1200);
  }, [level]);

  // Initial mount safety cleanup
  useEffect(() => {
    getReadyTimerRef.current = setTimeout(() => {
      setShowGetReady(false);
    }, 1200);
    return () => {
      if (getReadyTimerRef.current) clearTimeout(getReadyTimerRef.current);
    };
  }, []);

  // Reset ONLY when level ID truly changes (e.g. changing world in WorldSelect)
  useEffect(() => {
    if (currentLevelIdRef.current !== level.id) {
      currentLevelIdRef.current = level.id;
      restartLevel();
    }
  }, [level.id, restartLevel]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "KeyA"].includes(e.code)) {
        keysRef.current.left = true;
      }
      if (["ArrowRight", "KeyD"].includes(e.code)) {
        keysRef.current.right = true;
      }
      if (["ArrowDown", "KeyS"].includes(e.code)) {
        keysRef.current.down = true;
      }
      if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
        e.preventDefault();
        keysRef.current.jump = true;
        stateRef.current.player.jumpBuffer = 10;
      }
      if (e.code === "KeyE" && nearNPC && level.npc) {
        onOpenStory(level.npc);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (["ArrowLeft", "KeyA"].includes(e.code)) {
        keysRef.current.left = false;
      }
      if (["ArrowRight", "KeyD"].includes(e.code)) {
        keysRef.current.right = false;
      }
      if (["ArrowDown", "KeyS"].includes(e.code)) {
        keysRef.current.down = false;
      }
      if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
        keysRef.current.jump = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [nearNPC, level.npc, onOpenStory]);

  // Main game loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Helper to spawn floating score
    const addFloatingText = (text: string, x: number, y: number, color = "#FDE047") => {
      stateRef.current.floatingTexts.push({
        id: Math.random().toString(),
        x,
        y,
        text,
        color,
        alpha: 1,
        vy: -1.8,
      });
    };

    // Helper to spawn particle burst
    const spawnParticles = (
      x: number,
      y: number,
      count: number,
      color: string,
      shape: "circle" | "sparkle" | "coin" | "heart" = "sparkle"
    ) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        stateRef.current.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          size: 3 + Math.random() * 4,
          color,
          alpha: 1,
          life: 0,
          maxLife: 20 + Math.random() * 20,
          shape,
        });
      }
    };

    // Tick & Render
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(loop);
      const dt = Math.min(32, currentTime - lastTime);
      lastTime = currentTime;

      const state = stateRef.current;
      const { player, levelData } = state;

      // Pause physics when modals are open to prevent falling/wandering into traps during dialogue
      if (isPaused) {
        // Just freeze physics updates while keeping animation loop running for crisp re-render
      } else if (state.gameActive) {
        // --- 1. PLAYER PHYSICS ---
        // Crouch input handling & hitbox adjustment
        const wantsCrouch = keysRef.current.down;
        if (wantsCrouch && player.grounded && !player.isCrouching) {
          player.isCrouching = true;
          player.y += 20;
          player.height = 24;
          player.squashX = 1.35;
          player.squashY = 0.58;
        } else if (!wantsCrouch && player.isCrouching) {
          // Check if ceiling above prevents standing up
          let ceilingBlocked = false;
          for (const tile of levelData.tiles) {
            if (tile.type === "cloud") continue;
            if (
              player.x + player.width > tile.x &&
              player.x < tile.x + tile.width &&
              player.y - 20 < tile.y + tile.height &&
              player.y > tile.y
            ) {
              ceilingBlocked = true;
              break;
            }
          }
          if (!ceilingBlocked) {
            player.isCrouching = false;
            player.y -= 20;
            player.height = 44;
          }
        }

        const ACCEL = player.isSpringBoosting ? 1.2 : 0.8;
        const MAX_SPEED = player.isCrouching ? 3.8 : 5.2;
        const FRICTION = player.isCrouching ? 0.94 : 0.82;
        const GRAVITY = 0.62;
        const JUMP_FORCE = -12.2;

        if (keysRef.current.left) {
          player.vx = Math.max(-MAX_SPEED, player.vx - ACCEL);
          player.facing = "left";
          player.walkCycle += 0.25;
        } else if (keysRef.current.right) {
          player.vx = Math.min(MAX_SPEED, player.vx + ACCEL);
          player.facing = "right";
          player.walkCycle += 0.25;
        } else {
          player.vx *= FRICTION;
          if (Math.abs(player.vx) < 0.1) player.vx = 0;
        }

        // Running / Sliding dust particles
        if (player.grounded && Math.abs(player.vx) > 1.2 && Math.random() < (player.isCrouching ? 0.6 : 0.3)) {
          state.particles.push({
            x: player.x + (player.facing === "right" ? 5 : player.width - 5),
            y: player.y + player.height - 2,
            vx: (player.facing === "right" ? -1 : 1) * (0.5 + Math.random()),
            vy: -Math.random() * 1.5,
            size: player.isCrouching ? 4 : 3,
            color: player.isCrouching ? "#94A3B8" : "#E2E8F0",
            alpha: 0.8,
            life: 0,
            maxLife: 16,
            shape: "circle",
          });
        }

        // Rainbow aura trail
        if (activeOC.unlockedAppearances.includes("rainbow_trail") && Math.abs(player.vx) > 1.5) {
          const rainbowColors = ["#F43F5E", "#F59E0B", "#10B981", "#06B6D4", "#8B5CF6"];
          const randColor = rainbowColors[Math.floor(Math.random() * rainbowColors.length)];
          state.particles.push({
            x: player.x + player.width / 2 + (Math.random() * 10 - 5),
            y: player.y + player.height / 2 + (Math.random() * 10 - 5),
            vx: -player.vx * 0.3,
            vy: (Math.random() - 0.5) * 1.5,
            size: 4 + Math.random() * 3,
            color: randColor,
            alpha: 0.9,
            life: 0,
            maxLife: 22,
            shape: "sparkle",
          });
        }

        // Coyote time & Jump Buffer
        if (player.grounded) {
          player.coyoteTime = 6;
          player.jumpsRemaining = 2;
          player.isSpringBoosting = false;
        } else {
          if (player.coyoteTime > 0) player.coyoteTime--;
        }
        if (player.jumpBuffer > 0) player.jumpBuffer--;

        // Jump Execution (Ground leap or Aerial Double-Jump)
        if (player.jumpBuffer > 0) {
          if (player.coyoteTime > 0 || player.grounded) {
            if (player.isCrouching) {
              // Super Spring Leap from crouch!
              player.vy = -14.2;
              player.squashX = 0.65;
              player.squashY = 1.45;
              sound.playSpring();
              addFloatingText("SUPER LEAP! 🚀", player.x, player.y - 20, "#FDE047");
              spawnParticles(player.x + player.width / 2, player.y + player.height, 10, "#FBBF24", "sparkle");
            } else {
              player.vy = JUMP_FORCE;
              player.squashX = 0.75;
              player.squashY = 1.35;
              sound.playJump();
            }
            player.grounded = false;
            player.coyoteTime = 0;
            player.jumpBuffer = 0;
            player.jumpsRemaining = 1;
            GameStorage.updateAchievement("first_jump", 1);
          } else if (player.jumpsRemaining === 1) {
            // Mid-air Double Jump!
            player.vy = -11.0;
            player.jumpsRemaining = 0;
            player.jumpBuffer = 0;
            player.squashX = 1.25;
            player.squashY = 0.8;
            sound.playJump();
            addFloatingText("DOUBLE JUMP! ⭐", player.x, player.y - 15, "#38BDF8");
            spawnParticles(player.x + player.width / 2, player.y + player.height, 12, "#38BDF8", "sparkle");
          }
        }

        // Variable jump height
        if (!keysRef.current.jump && player.vy < -3) {
          player.vy *= 0.6;
        }

        player.vy += GRAVITY;
        // Cap downward velocity to prevent high-speed tunneling through collision geometry
        if (player.vy > 12) player.vy = 12;

        // Apply Squash recovery
        if (player.isCrouching) {
          player.squashX += (1.35 - player.squashX) * 0.2;
          player.squashY += (0.58 - player.squashY) * 0.2;
        } else {
          player.squashX += (1 - player.squashX) * 0.15;
          player.squashY += (1 - player.squashY) * 0.15;
        }

        // Checkpoint Campfire near NPC (around x=1200)
        if (!state.npcTriggered && Math.abs(player.x - 1200) < 100) {
          state.npcTriggered = true;
          player.lastSafeX = 1200;
          player.lastSafeY = 396;
          setLives(5); // Restore full hearts!
          sound.playStar();
          addFloatingText("🏕️ 营地存档点激活 (生命已回满)!", 1200, 330, "#10B981");
          spawnParticles(1200, 390, 20, "#10B981", "sparkle");
        }

        // Update Moving Platforms & carry player if standing on top
        let platformDeltaX = 0;
        for (const tile of levelData.tiles) {
          if (tile.moveRange) {
            const oldX = tile.x;
            tile.x += tile.moveRange.speed;
            if (tile.x > tile.moveRange.maxX || tile.x < tile.moveRange.minX) {
              tile.moveRange.speed *= -1;
            }
            // Check if player stands on this moving tile
            if (
              player.grounded &&
              player.x + player.width > oldX &&
              player.x < oldX + tile.width &&
              Math.abs((player.y + player.height) - tile.y) < 6
            ) {
              platformDeltaX = tile.x - oldX;
            }
          }
          if (tile.hitState && tile.hitState > 0) {
            tile.hitState--;
          }
        }
        player.x += platformDeltaX;

        // Horizontal Movement & Anti-Ejection Collisions
        player.x += player.vx;
        for (const tile of levelData.tiles) {
          if (tile.type === "cloud") continue; // clouds are jump-through
          // Only collide horizontally with tiles if vertical penetration is deep enough (not just standing on top edge)
          const verticalOverlap = Math.min(player.y + player.height, tile.y + tile.height) - Math.max(player.y, tile.y);
          if (
            verticalOverlap > 8 &&
            player.x + player.width > tile.x &&
            player.x < tile.x + tile.width
          ) {
            if (player.vx > 0) {
              player.x = tile.x - player.width;
              player.vx = 0;
            } else if (player.vx < 0) {
              player.x = tile.x + tile.width;
              player.vx = 0;
            }
          }
        }

        // Vertical Movement & Guaranteed Landing
        const prevBottom = player.y + player.height;
        const prevTop = player.y;
        player.y += player.vy;
        const currentBottom = player.y + player.height;
        const currentTop = player.y;
        const wasGrounded = player.grounded;
        player.grounded = false;

        for (const tile of levelData.tiles) {
          if (
            player.x + player.width * 0.85 > tile.x &&
            player.x + player.width * 0.15 < tile.x + tile.width
          ) {
            // Landing on top (downward motion)
            if (player.vy >= 0 && prevBottom <= tile.y + 6 && currentBottom >= tile.y) {
              player.y = tile.y - player.height;
              player.vy = 0;
              player.grounded = true;

              // Only update last safe respawn on wide, stationary ground tiles
              if (tile.type === "ground" && !tile.moveRange && tile.width >= 70) {
                player.lastSafeX = Math.max(tile.x + 30, Math.min(tile.x + tile.width - 50, player.x));
                player.lastSafeY = tile.y - player.height;
              }

              // Landing feedback squash & dust
              if (!wasGrounded) {
                player.squashX = 1.25;
                player.squashY = 0.75;
                spawnParticles(player.x + player.width / 2, player.y + player.height, 4, "#CBD5E1", "circle");
              }

              // Friendly Spring pad
              if (tile.type === "spring") {
                player.vy = -14.2;
                player.grounded = false;
                player.jumpsRemaining = 2; // Refresh double jump
                player.isSpringBoosting = true;
                sound.playSpring();
                tile.hitState = 12;
                addFloatingText("BOING!! 🚀", tile.x + tile.width / 2, tile.y - 12, "#38BDF8");
                spawnParticles(tile.x + tile.width / 2, tile.y, 12, "#38BDF8", "sparkle");
              }
            }
            // Hitting block from below (upward motion)
            else if (
              player.vy < 0 &&
              tile.type !== "cloud" &&
              prevTop >= tile.y + tile.height - 6 &&
              currentTop <= tile.y + tile.height
            ) {
              player.y = tile.y + tile.height;
              player.vy = 1.5;
              tile.hitState = 8;
              sound.playBump();

              // Hit Question Block!
              if (tile.type === "question" && tile.hasItem) {
                if (tile.hasItem === "coin") {
                  sound.playCoin();
                  state.coinsGained += 1;
                  state.scoreGained += 100;
                  setCoinsRun(state.coinsGained);
                  setScore(state.scoreGained);
                  addFloatingText("+1 COIN", tile.x + 10, tile.y - 20, "#FBBF24");
                  spawnParticles(tile.x + 24, tile.y, 6, "#FBBF24", "coin");
                  GameStorage.addCoins(1);
                  GameStorage.updateAchievement("coins_30", 1);
                  GameStorage.updateAchievement("coins_100", 1);
                } else if (tile.hasItem === "star") {
                  sound.playStar();
                  state.starsGained += 1;
                  state.scoreGained += 500;
                  setStarsRun(state.starsGained);
                  setScore(state.scoreGained);
                  addFloatingText("⭐ 星之水晶!", tile.x - 10, tile.y - 30, "#67E8F9");
                  spawnParticles(tile.x + 24, tile.y - 10, 16, "#67E8F9", "sparkle");
                  GameStorage.addStars(1);
                  GameStorage.updateAchievement("stars_3", 1);
                  GameStorage.updateAchievement("stars_8", 1);
                }
                tile.hasItem = null;
                tile.type = "metal"; // turn into used metal block
              }
            }
          }
        }

        // Fair Respawn: Safe ground rescue without jarring rollback
        if (player.y > 580) {
          player.x = player.lastSafeX;
          player.y = player.lastSafeY;
          player.vx = 0;
          player.vy = 0;
          player.invulnerableTimer = 90; // 1.5s immunity
          sound.playHurt();
          addFloatingText("SAFE RESCUE 🛡️", player.x, player.y - 20, "#38BDF8");
          spawnParticles(player.x + 22, player.y + 22, 16, "#38BDF8", "sparkle");
          setLives((prev) => {
            const next = prev - 1;
            if (next <= 0) {
              setIsGameOver(true);
              state.gameActive = false;
            }
            return next;
          });
        }

        // Coin Pickups (with gentle magnetic attraction)
        const pCenterX = player.x + player.width / 2;
        const pCenterY = player.y + player.height / 2;

        for (const coin of levelData.coins) {
          if (!coin.collected) {
            coin.animFrame += 0.15;
            const dist = Math.hypot(coin.x + 12 - pCenterX, coin.y + 12 - pCenterY);
            if (dist < 75) {
              coin.x += (pCenterX - (coin.x + 12)) * 0.18;
              coin.y += (pCenterY - (coin.y + 12)) * 0.18;
            }
            if (
              dist < 36 ||
              (player.x + player.width > coin.x &&
                player.x < coin.x + 24 &&
                player.y + player.height > coin.y &&
                player.y < coin.y + 24)
            ) {
              coin.collected = true;
              sound.playCoin();
              state.coinsGained += 1;
              state.scoreGained += 50;
              setCoinsRun(state.coinsGained);
              setScore(state.scoreGained);
              addFloatingText("+1", coin.x, coin.y - 10, "#FBBF24");
              spawnParticles(coin.x + 12, coin.y + 12, 8, "#FBBF24", "coin");
              GameStorage.addCoins(1);
              GameStorage.updateAchievement("coins_30", 1);
              GameStorage.updateAchievement("coins_100", 1);
            }
          }
        }

        // Star Pickups (with magnetic attraction & generous hitbox so player never misses!)
        for (const star of levelData.stars) {
          if (!star.collected) {
            star.animFrame += 0.08;
            const dist = Math.hypot(star.x + 16 - pCenterX, star.y + 16 - pCenterY);
            if (dist < 90) {
              star.x += (pCenterX - (star.x + 16)) * 0.18;
              star.y += (pCenterY - (star.y + 16)) * 0.18;
            }
            if (
              dist < 44 ||
              (player.x + player.width > star.x - 14 &&
                player.x < star.x + 44 &&
                player.y + player.height > star.y - 14 &&
                player.y < star.y + 44)
            ) {
              star.collected = true;
              sound.playStar();
              state.starsGained += 1;
              state.scoreGained += 500;
              setStarsRun(state.starsGained);
              setScore(state.scoreGained);
              addFloatingText("⭐ 探索之星!", star.x - 20, star.y - 30, "#67E8F9");
              spawnParticles(star.x + 16, star.y + 16, 20, "#67E8F9", "sparkle");
              GameStorage.addStars(1);
              GameStorage.updateAchievement("stars_3", 1);
              GameStorage.updateAchievement("stars_8", 1);
            }
          }
        }

        // Enemies update & stomping
        for (const enemy of levelData.enemies) {
          if (enemy.alive) {
            enemy.x += enemy.vx;
            if (enemy.x > enemy.maxX || enemy.x < enemy.minX) {
              enemy.vx *= -1;
            }

            // Player collision with enemy
            if (
              player.x + player.width * 0.8 > enemy.x &&
              player.x + player.width * 0.2 < enemy.x + enemy.width &&
              player.y + player.height > enemy.y &&
              player.y < enemy.y + enemy.height
            ) {
              // Stomping on top of stompable enemy
              if (enemy.type !== "spiky" && player.vy > 0 && player.y + player.height - player.vy <= enemy.y + 16) {
                enemy.alive = false;
                enemy.squashTimer = 20;
                player.vy = -9;
                sound.playStomp();
                state.scoreGained += 200;
                setScore(state.scoreGained);
                addFloatingText("+200", enemy.x, enemy.y - 15, "#A855F7");
                spawnParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 10, "#C084FC", "sparkle");
              } else if (player.invulnerableTimer <= 0) {
                // Player hit by enemy
                player.invulnerableTimer = 60;
                player.vy = -6;
                player.vx = player.x < enemy.x ? -5 : 5;
                sound.playHurt();
                setLives((prev) => {
                  const next = prev - 1;
                  if (next <= 0) {
                    setIsGameOver(true);
                    state.gameActive = false;
                  }
                  return next;
                });
              }
            }
          }
        }

        // Invulnerability timer
        if (player.invulnerableTimer > 0) {
          player.invulnerableTimer--;
        }

        // NPC proximity check (stationed around x: 1200 or middle)
        const npcX = 1200;
        const distToNPC = Math.abs(player.x - npcX);
        if (distToNPC < 80) {
          if (!nearNPC) setNearNPC(true);
        } else {
          if (nearNPC) setNearNPC(false);
        }

        // Goal reached (Victory!)
        if (player.x >= levelData.goalX) {
          state.gameActive = false;
          setIsVictory(true);
          sound.playVictory();
          spawnParticles(player.x, player.y, 40, "#FBBF24", "sparkle");
          spawnParticles(player.x + 40, player.y - 20, 30, "#38BDF8", "heart");

          // Trigger achievement
          if (level.worldNumber === 1) GameStorage.updateAchievement("world_1_clear", 1);
          if (level.worldNumber === 2) GameStorage.updateAchievement("world_2_clear", 1);

          onLevelComplete({
            coins: state.coinsGained,
            stars: state.starsGained,
            score: state.scoreGained,
          });
        }

        // Camera smoothly tracks player
        const targetCameraX = Math.max(0, player.x - 300);
        state.cameraX += (targetCameraX - state.cameraX) * 0.1;
      }

      // --- 2. RENDERING PIPELINE ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Sky Background: 明亮晨曦 —— 从蜜桃粉到清爽天空蓝，去掉原本压抑的深紫
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, "#ffd6e0");   // 桃粉云端
      grad.addColorStop(0.35, "#ffe8c2"); // 蜜黄晨光
      grad.addColorStop(0.7, "#bfe8ff");  // 湖水青
      grad.addColorStop(1, "#8fd3ff");   // 晴朗蓝天
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 远景太阳 —— 增加暖调层次
      ctx.fillStyle = "rgba(255, 224, 130, 0.9)";
      ctx.beginPath();
      ctx.arc(760 - state.cameraX * 0.05, 90, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 250, 200, 0.55)";
      ctx.beginPath();
      ctx.arc(760 - state.cameraX * 0.05, 90, 50, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(-Math.floor(state.cameraX), 0);

      // 远景像素城堡塔剪影 —— 从阴暗紫改成浅蓝紫，更清透
      ctx.fillStyle = "rgba(147, 165, 210, 0.45)";
      const bgSkylineScroll = Math.floor(state.cameraX * 0.15);
      const startSeg = Math.floor((state.cameraX - 400) / 120);
      const endSeg = Math.floor((state.cameraX + 1400) / 120);
      for (let s = startSeg; s <= endSeg; s++) {
        const segX = s * 120 - bgSkylineScroll;
        const wallH = 130 + (Math.abs(s * 17) % 4) * 16;
        const topY = 440 - wallH;
        // Base wall
        ctx.fillRect(segX, topY, 120, wallH);
        // Notched battlements
        ctx.fillRect(segX, topY - 14, 28, 14);
        ctx.fillRect(segX + 44, topY - 14, 28, 14);
        ctx.fillRect(segX + 88, topY - 14, 28, 14);
      }

      // Parallax Chunky Pixel Clouds (matching image.png)
      const drawPixelCloud = (cx: number, cy: number) => {
        ctx.save();
        // Outline & base shape
        ctx.fillStyle = "#FFFFFF";
        // Main body stepped pixel blocks
        ctx.fillRect(cx - 36, cy, 72, 22);
        ctx.fillRect(cx - 24, cy - 12, 48, 12);
        ctx.fillRect(cx - 12, cy - 20, 24, 8);
        ctx.fillRect(cx - 44, cy + 4, 88, 14);

        // Underside pixel shadow (cool light blue-grey like image.png)
        ctx.fillStyle = "#CBD5E1";
        ctx.fillRect(cx - 36, cy + 14, 72, 4);
        ctx.fillRect(cx - 28, cy + 10, 56, 4);

        // Dark pixel border accent
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 44, cy + 4, 88, 14);
        ctx.restore();
      };

      for (let i = 0; i < 15; i++) {
        const cloudX = i * 360 + Math.floor(state.cameraX * 0.35);
        const cloudY = 70 + ((i * 37) % 80);
        drawPixelCloud(cloudX, cloudY);
      }

      // Draw Platform Tiles with authentic Pixel Art texturing (matching image.png)
      for (const tile of levelData.tiles) {
        const bounceOffset = tile.hitState ? -Math.sin((tile.hitState / 8) * Math.PI) * 12 : 0;
        const renderY = tile.y + bounceOffset;

        if (tile.type === "ground") {
          // Dirt Body (warm Mario soil brown #78350F)
          ctx.fillStyle = "#78350F";
          ctx.fillRect(tile.x, renderY + 16, tile.width, tile.height - 16);

          // Dark Chocolate Pixel Dirt Patches (checker/stepped texture like image.png)
          ctx.fillStyle = "#451A03";
          for (let tx = tile.x; tx < tile.x + tile.width; tx += 16) {
            for (let ty = renderY + 20; ty < renderY + tile.height; ty += 16) {
              if (((tx / 16 + ty / 16) % 2) === 0) {
                ctx.fillRect(tx + 2, ty + 2, 8, 8);
                ctx.fillRect(tx + 6, ty + 6, 6, 6);
              }
            }
          }

          // Top Bright Green Grass Band (matching image.png #84CC16)
          ctx.fillStyle = "#84CC16";
          ctx.fillRect(tile.x, renderY, tile.width, 12);

          // Deep Green Shadow Edge (matching image.png #15803D)
          ctx.fillStyle = "#15803D";
          ctx.fillRect(tile.x, renderY + 12, tile.width, 4);

          // Stepped Pixel Grass Teeth hanging down (matching image.png)
          ctx.fillStyle = "#65A30D";
          for (let gx = tile.x; gx < tile.x + tile.width; gx += 16) {
            ctx.fillRect(gx + 2, renderY + 14, 6, 6);
            ctx.fillRect(gx + 10, renderY + 14, 4, 10);
            ctx.fillRect(gx + 12, renderY + 14, 4, 4);
          }
        } else if (tile.type === "grass") {
          // Floating pixel grass block
          ctx.fillStyle = "#84CC16";
          ctx.fillRect(tile.x, renderY, tile.width, 10);
          ctx.fillStyle = "#15803D";
          ctx.fillRect(tile.x, renderY + 10, tile.width, 4);
          ctx.fillStyle = "#78350F";
          ctx.fillRect(tile.x, renderY + 14, tile.width, tile.height - 14);
          // Grass teeth
          ctx.fillStyle = "#65A30D";
          for (let gx = tile.x; gx < tile.x + tile.width; gx += 12) {
            ctx.fillRect(gx + 2, renderY + 12, 4, 5);
          }
        } else if (tile.type === "brick") {
          // Terracotta Pixel Brick with mortar lines (matching image.png)
          ctx.fillStyle = "#9A3412"; // Brick reddish brown
          ctx.fillRect(tile.x, renderY, tile.width, tile.height);

          // Dark Mortar Grid
          ctx.fillStyle = "#451A03";
          ctx.fillRect(tile.x, renderY, tile.width, 2);
          ctx.fillRect(tile.x, renderY + tile.height / 2, tile.width, 2);
          ctx.fillRect(tile.x, renderY + tile.height - 2, tile.width, 2);

          // Staggered vertical mortar joints
          const halfH = tile.height / 2;
          ctx.fillRect(tile.x + tile.width / 2, renderY, 2, halfH);
          ctx.fillRect(tile.x + tile.width / 4, renderY + halfH, 2, halfH);
          ctx.fillRect(tile.x + (tile.width * 3) / 4, renderY + halfH, 2, halfH);

          // Brick Highlights on top and left edges
          ctx.fillStyle = "#C2410C";
          ctx.fillRect(tile.x + 2, renderY + 2, tile.width - 4, 2);
          ctx.fillRect(tile.x + 2, renderY + halfH + 2, tile.width - 4, 2);

          // Outer pixel outline
          ctx.strokeStyle = "#431407";
          ctx.lineWidth = 2;
          ctx.strokeRect(tile.x, renderY, tile.width, tile.height);
        } else if (tile.type === "question") {
          // Chunky Pixel Golden Question Mark Block (matching image.png)
          const pulse = Math.sin(currentTime * 0.006) * 1.5;
          const qy = renderY + pulse;

          // Golden Yellow Base
          ctx.fillStyle = "#F59E0B";
          ctx.fillRect(tile.x, qy, tile.width, tile.height);

          // 3D Pixel Bevel: Top & Left Highlight (#FEF08A)
          ctx.fillStyle = "#FEF08A";
          ctx.fillRect(tile.x, qy, tile.width, 4);
          ctx.fillRect(tile.x, qy, 4, tile.height);

          // 3D Pixel Bevel: Bottom & Right Shadow (#92400E)
          ctx.fillStyle = "#92400E";
          ctx.fillRect(tile.x, qy + tile.height - 4, tile.width, 4);
          ctx.fillRect(tile.x + tile.width - 4, qy, 4, tile.height);

          // 4 Corner Rivets / Studs (matching image.png)
          ctx.fillStyle = "#78350F";
          ctx.fillRect(tile.x + 5, qy + 5, 4, 4);
          ctx.fillRect(tile.x + tile.width - 9, qy + 5, 4, 4);
          ctx.fillRect(tile.x + 5, qy + tile.height - 9, 4, 4);
          ctx.fillRect(tile.x + tile.width - 9, qy + tile.height - 9, 4, 4);

          // Chunky Pixel Question Mark in the center
          ctx.fillStyle = "#78350F";
          ctx.font = "bold 24px 'Press Start 2P', monospace";
          ctx.textAlign = "center";
          ctx.fillText("?", tile.x + tile.width / 2, qy + tile.height / 2 + 9);

          // Outer crisp dark border
          ctx.strokeStyle = "#451A03";
          ctx.lineWidth = 2;
          ctx.strokeRect(tile.x, qy, tile.width, tile.height);
        } else if (tile.type === "metal") {
          // Used solid metal block with bolts
          ctx.fillStyle = "#64748B";
          ctx.fillRect(tile.x, renderY, tile.width, tile.height);
          ctx.fillStyle = "#94A3B8";
          ctx.fillRect(tile.x, renderY, tile.width, 3);
          ctx.fillRect(tile.x, renderY, 3, tile.height);
          ctx.fillStyle = "#334155";
          ctx.fillRect(tile.x, renderY + tile.height - 3, tile.width, 3);
          ctx.fillRect(tile.x + tile.width - 3, renderY, 3, tile.height);
          // 4 Corner Screws
          ctx.fillStyle = "#0F172A";
          ctx.fillRect(tile.x + 5, renderY + 5, 4, 4);
          ctx.fillRect(tile.x + tile.width - 9, renderY + 5, 4, 4);
          ctx.fillRect(tile.x + 5, renderY + tile.height - 9, 4, 4);
          ctx.fillRect(tile.x + tile.width - 9, renderY + tile.height - 9, 4, 4);
          ctx.strokeStyle = "#1E293B";
          ctx.lineWidth = 2;
          ctx.strokeRect(tile.x, renderY, tile.width, tile.height);
        } else if (tile.type === "spring") {
          // Chunky Pixel Spring Pad
          ctx.fillStyle = "#DC2626";
          ctx.fillRect(tile.x, renderY + tile.height - 8, tile.width, 8);
          // Coiled spring
          ctx.fillStyle = "#FACC15";
          ctx.fillRect(tile.x + 8, renderY + 4, tile.width - 16, 6);
          ctx.fillStyle = "#EF4444";
          ctx.fillRect(tile.x + 4, renderY, tile.width - 8, 5);
          ctx.strokeStyle = "#7F1D1D";
          ctx.lineWidth = 2;
          ctx.strokeRect(tile.x, renderY, tile.width, tile.height);
        } else if (tile.type === "moving") {
          // Moving Sky-Platform
          ctx.fillStyle = "#0284C7";
          ctx.fillRect(tile.x, renderY, tile.width, tile.height);
          ctx.fillStyle = "#7DD3FC";
          ctx.fillRect(tile.x, renderY, tile.width, 3);
          ctx.fillStyle = "#0369A1";
          ctx.fillRect(tile.x, renderY + tile.height - 3, tile.width, 3);
          // Warning indicator dots
          const blink = (Math.floor(currentTime * 0.005) % 2) === 0;
          ctx.fillStyle = blink ? "#FACC15" : "#B45309";
          ctx.fillRect(tile.x + 4, renderY + 4, 4, 4);
          ctx.fillRect(tile.x + tile.width - 8, renderY + 4, 4, 4);
          ctx.strokeStyle = "#082F49";
          ctx.lineWidth = 2;
          ctx.strokeRect(tile.x, renderY, tile.width, tile.height);
        } else if (tile.type === "cloud") {
          // Fluffy Stepped Pixel Cloud Platform
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(tile.x + 4, renderY, tile.width - 8, tile.height);
          ctx.fillRect(tile.x, renderY + 4, tile.width, tile.height - 8);
          // Underside shadow
          ctx.fillStyle = "#CBD5E1";
          ctx.fillRect(tile.x + 4, renderY + tile.height - 4, tile.width - 8, 4);
          ctx.strokeStyle = "#94A3B8";
          ctx.lineWidth = 2;
          ctx.strokeRect(tile.x + 2, renderY + 2, tile.width - 4, tile.height - 4);
        }
      }

      // Draw Coins (Spinning)
      for (const coin of levelData.coins) {
        if (!coin.collected) {
          const spin = Math.sin(coin.animFrame);
          const width = 16 * Math.abs(spin);
          ctx.save();
          ctx.translate(coin.x + 12, coin.y + 12);
          ctx.fillStyle = "#FBBF24";
          ctx.beginPath();
          ctx.ellipse(0, 0, Math.max(2, width / 2), 11, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#D97706";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw Stars
      for (const star of levelData.stars) {
        if (!star.collected) {
          const hover = Math.sin(star.animFrame * 2) * 5;
          ctx.save();
          ctx.translate(star.x + 14, star.y + 14 + hover);
          ctx.fillStyle = "#FACC15";
          // 5-point star
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            ctx.lineTo(Math.cos(((18 + i * 72) * Math.PI) / 180) * 16, -Math.sin(((18 + i * 72) * Math.PI) / 180) * 16);
            ctx.lineTo(Math.cos(((54 + i * 72) * Math.PI) / 180) * 8, -Math.sin(((54 + i * 72) * Math.PI) / 180) * 8);
          }
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#CA8A04";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Cute eyes
          ctx.fillStyle = "#000000";
          ctx.fillRect(-3, -3, 2, 4);
          ctx.fillRect(2, -3, 2, 4);
          ctx.restore();
        }
      }

      // Draw Enemies
      for (const enemy of levelData.enemies) {
        if (enemy.alive) {
          ctx.save();
          ctx.translate(enemy.x, enemy.y);
          if (enemy.type === "slime") {
            // Cute bouncy slime
            const squish = Math.sin(currentTime * 0.01) * 3;
            ctx.fillStyle = "#10B981";
            ctx.beginPath();
            ctx.ellipse(enemy.width / 2, enemy.height / 2 + squish, enemy.width / 2, enemy.height / 2 - squish, 0, 0, Math.PI * 2);
            ctx.fill();
            // Slime eyes
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(6, 8, 6, 6);
            ctx.fillRect(20, 8, 6, 6);
            ctx.fillStyle = "#064E3B";
            ctx.fillRect(8, 10, 3, 3);
            ctx.fillRect(22, 10, 3, 3);
          } else if (enemy.type === "spiky") {
            // Spiky turtle shell
            ctx.fillStyle = "#DC2626";
            ctx.beginPath();
            ctx.arc(enemy.width / 2, enemy.height - 4, enemy.width / 2, Math.PI, 0);
            ctx.fill();
            // spikes
            ctx.fillStyle = "#F87171";
            ctx.fillRect(6, 4, 4, 8);
            ctx.fillRect(16, 0, 4, 10);
            ctx.fillRect(26, 4, 4, 8);
          } else {
            // Mushroom critter
            ctx.fillStyle = "#8B5CF6";
            ctx.beginPath();
            ctx.arc(enemy.width / 2, enemy.height / 2, enemy.width / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else if (enemy.squashTimer && enemy.squashTimer > 0) {
          enemy.squashTimer--;
          // Flat squashed enemy
          ctx.fillStyle = "#059669";
          ctx.fillRect(enemy.x, enemy.y + enemy.height - 8, enemy.width, 8);
        }
      }

      // Draw NPC Station / Campfire around x: 1200
      const npcStationX = 1200;
      ctx.fillStyle = "#F97316";
      // Campfire stones & fire
      ctx.beginPath();
      ctx.arc(npcStationX + 40, 430, 10, 0, Math.PI * 2);
      ctx.fill();
      // Campfire flicker
      const flameH = 14 + Math.sin(currentTime * 0.02) * 5;
      ctx.fillStyle = "#FACC15";
      ctx.beginPath();
      ctx.moveTo(npcStationX + 32, 430);
      ctx.lineTo(npcStationX + 40, 430 - flameH);
      ctx.lineTo(npcStationX + 48, 430);
      ctx.fill();

      // NPC Sprite / Avatar
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(level.npc?.avatarEmoji || "🧚", npcStationX, 420);

      // Speech bubble hint above NPC —— roundRect 在旧浏览器不存在，做兼容 fallback
      ctx.fillStyle = "#FEF08A";
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === "function") {
        (ctx as any).roundRect(npcStationX - 50, 350, 100, 26, 6);
      } else {
        ctx.rect(npcStationX - 50, 350, 100, 26);
      }
      ctx.fill();
      ctx.strokeStyle = "#854D0E";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#713F12";
      ctx.font = "11px 'Press Start 2P', monospace";
      ctx.fillText("💬 [E] 对话", npcStationX, 368);

      // Draw Goal Flagpole & Crystal Portal
      const goalX = levelData.goalX;
      // Flagpole
      ctx.fillStyle = "#CBD5E1";
      ctx.fillRect(goalX, 180, 8, 260);
      ctx.fillStyle = "#FACC15";
      ctx.beginPath();
      ctx.arc(goalX + 4, 180, 10, 0, Math.PI * 2);
      ctx.fill();
      // Waving Flag
      const flagWave = Math.sin(currentTime * 0.008) * 8;
      ctx.fillStyle = "#10B981";
      ctx.beginPath();
      ctx.moveTo(goalX + 8, 190);
      ctx.lineTo(goalX + 50 + flagWave, 210);
      ctx.lineTo(goalX + 8, 230);
      ctx.closePath();
      ctx.fill();

      // --- 3. DRAW PLAYER OC ---
      if (player.invulnerableTimer % 6 < 3) {
        ctx.save();
        const pCenterX = player.x + player.width / 2;
        const pCenterY = player.y + player.height / 2;

        ctx.translate(pCenterX, pCenterY);
        // Squash & Stretch & Direction
        const scaleX = (player.facing === "left" ? -1 : 1) * player.squashX;
        const scaleY = player.squashY;
        ctx.scale(scaleX, scaleY);

        // Walk bobbing
        const bobY = player.grounded && Math.abs(player.vx) > 0.1 ? Math.sin(player.walkCycle) * 3 : 0;
        ctx.translate(0, bobY);

        // 1. Wings Cosmetic (Behind Player)
        if (activeOC.unlockedAppearances.includes("wings")) {
          const wingFlap = Math.sin(currentTime * 0.015) * 0.3;
          ctx.save();
          ctx.rotate(wingFlap);
          ctx.fillStyle = "#67E8F9";
          ctx.beginPath();
          ctx.moveTo(-12, -4);
          ctx.quadraticCurveTo(-34, -22, -26, 4);
          ctx.quadraticCurveTo(-18, 0, -12, 6);
          ctx.fill();
          ctx.restore();
        }

        // 2. Red Cape Cosmetic (Behind Player)
        if (activeOC.unlockedAppearances.includes("cape")) {
          const capeSway = (player.vx > 0 ? -1 : 1) * Math.sin(currentTime * 0.01) * 8 - Math.abs(player.vx) * 3;
          ctx.fillStyle = "#EF4444";
          ctx.beginPath();
          ctx.moveTo(-6, -4);
          ctx.lineTo(-24 + capeSway, 18);
          ctx.lineTo(-6, 14);
          ctx.closePath();
          ctx.fill();
        }

        // 3. Render Player OC Image or Fallback
        const drawSize = 44;

        // Crouch slide shadow & speed streaks
        if (player.isCrouching) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
          ctx.beginPath();
          ctx.ellipse(0, drawSize / 2 - 2, 24, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          if (Math.abs(player.vx) > 0.6) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-drawSize / 2 - 8, drawSize / 4);
            ctx.lineTo(-drawSize / 2 - 2, drawSize / 4);
            ctx.moveTo(-drawSize / 2 - 12, 0);
            ctx.lineTo(-drawSize / 2 - 5, 0);
            ctx.stroke();
          }
        }

        if (avatarImgRef.current && avatarImgRef.current.complete) {
          ctx.save();
          // Circular / rounded clipping for crisp OC portrait
          ctx.beginPath();
          ctx.arc(0, 0, drawSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatarImgRef.current, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
          ctx.restore();
          // Inner border
          ctx.strokeStyle = player.isCrouching ? "#38BDF8" : "#FFFFFF";
          ctx.lineWidth = player.isCrouching ? 2.5 : 2;
          ctx.beginPath();
          ctx.arc(0, 0, drawSize / 2, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Fallback cute character placeholder
          ctx.fillStyle = player.isCrouching ? "#38BDF8" : "#0284C7";
          ctx.beginPath();
          ctx.arc(0, 0, drawSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // 4. Crown Cosmetic (On Head)
        if (activeOC.unlockedAppearances.includes("crown")) {
          ctx.save();
          ctx.translate(0, -drawSize / 2 - 6);
          ctx.fillStyle = "#FBBF24";
          ctx.beginPath();
          ctx.moveTo(-12, 0);
          ctx.lineTo(-12, -10);
          ctx.lineTo(-6, -4);
          ctx.lineTo(0, -12);
          ctx.lineTo(6, -4);
          ctx.lineTo(12, -10);
          ctx.lineTo(12, 0);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#DC2626";
          ctx.fillRect(-2, -3, 4, 3);
          ctx.restore();
        }

        // 5. Star Aura Cosmetic (Orbiting)
        if (activeOC.unlockedAppearances.includes("aura")) {
          const orbitAngle = currentTime * 0.005;
          const orbitR = 28;
          ctx.fillStyle = "#C084FC";
          for (let s = 0; s < 3; s++) {
            const curAngle = orbitAngle + (s * Math.PI * 2) / 3;
            const sx = Math.cos(curAngle) * orbitR;
            const sy = Math.sin(curAngle) * (orbitR * 0.4);
            ctx.beginPath();
            ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 6. Cyber Drone Companion
        if (activeOC.unlockedAppearances.includes("drone_pet")) {
          const petX = -26 + Math.sin(currentTime * 0.008) * 4;
          const petY = -24 + Math.cos(currentTime * 0.008) * 4;
          ctx.fillStyle = "#38BDF8";
          ctx.fillRect(petX - 6, petY - 6, 12, 12);
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(petX - 2, petY - 2, 4, 4);
        }

        ctx.restore();
      }

      // --- 4. PARTICLES ---
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.alpha = 1 - p.life / p.maxLife;

        if (p.life >= p.maxLife) {
          state.particles.splice(i, 1);
          continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === "sparkle") {
          ctx.fillRect(p.x - p.size, p.y - 1, p.size * 2, 2);
          ctx.fillRect(p.x - 1, p.y - p.size, 2, p.size * 2);
        } else if (p.shape === "coin") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === "heart") {
          ctx.font = `${p.size * 3}px sans-serif`;
          ctx.fillText("💖", p.x, p.y);
        }
      }
      ctx.globalAlpha = 1.0;

      // --- 5. FLOATING TEXTS ---
      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const ft = state.floatingTexts[i];
        ft.y += ft.vy;
        ft.alpha -= 0.02;
        if (ft.alpha <= 0) {
          state.floatingTexts.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.fillStyle = ft.color;
        ctx.font = "bold 13px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      ctx.restore();
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [level, activeOC, nearNPC, onLevelComplete, onOpenStory]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none" style={{ background: "linear-gradient(180deg, #fff7ec 0%, #ffe8d1 100%)" }}>
      {/* Top Retro HUD */}
      <div className="absolute top-3 left-0 right-0 z-20 px-4 flex items-center justify-between pointer-events-none">
        {/* Left: Pixel Hearts & OC Name */}
        <div className="flex items-center gap-3 px-3.5 py-2 shadow-2xl pointer-events-auto pixel-border-slate" style={{ background: "rgba(255, 241, 214, 0.95)" }}>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((idx) => (
              <span
                key={idx}
                className={`text-lg transition-transform ${
                  idx <= lives ? "text-red-500 scale-100" : "text-slate-600 grayscale opacity-40 scale-90"
                }`}
              >
                ❤️
              </span>
            ))}
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-300 text-xs font-mono">{activeOC.name}</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 border border-amber-400/40">
              {activeOC.title}
            </span>
          </div>
        </div>

        {/* Center: Stage Title */}
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 text-center pixel-border-slate shadow-xl" style={{ background: "rgba(255, 241, 214, 0.95)" }}>
          <span className="text-xs font-pixel" style={{ color: "#b45309" }}>W{level.worldNumber}: {level.name}</span>
        </div>

        {/* Right: Coins, Stars & Score */}
        <div className="flex items-center gap-3 px-3.5 py-2 shadow-2xl pointer-events-auto pixel-border-slate" style={{ background: "rgba(255, 241, 214, 0.95)" }}>
          <div className="flex items-center gap-1.5 text-amber-300 font-pixel text-xs">
            <span>🪙</span>
            <span>{coinsRun}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sky-300 font-pixel text-xs">
            <span>⭐</span>
            <span>{starsRun}/3</span>
          </div>
          <button
            onClick={toggleSound}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
            title="音效开关"
          >
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} className="text-red-400" />}
          </button>
        </div>
      </div>

      {/* Main Game Canvas */}
      <div className="relative w-full max-w-5xl aspect-[16/9] max-h-[75vh] flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="w-full h-full object-contain shadow-2xl pixel-border-slate"
          style={{ background: "#8fd3ff", border: "4px solid #a3703c" }}
        />

        {/* Get Ready Banner */}
        {showGetReady && (
          <div
            onClick={() => setShowGetReady(false)}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center backdrop-blur-xs animate-fade-in cursor-pointer"
            style={{ background: "rgba(255, 247, 236, 0.55)" }}
          >
            <h2 className="text-4xl md:text-5xl font-pixel tracking-wider" style={{ color: "#15803d", textShadow: "0 4px 10px rgba(34,197,94,0.35)" }}>
              Get Ready!
            </h2>
            <p className="text-sm mt-3 font-pixel" style={{ color: "#3a2410" }}>方向键/AD 移动 · ⬇/S 下蹲滑行 · 空格跳跃/二段跳</p>
            <span className="text-[10px] font-pixel mt-2 opacity-75" style={{ color: "#6b4a2b" }}>点击或按任意键即可开始</span>
          </div>
        )}

        {/* Near NPC Interaction Banner */}
        {nearNPC && level.npc && !isGameOver && !isVictory && (
          <div className="absolute top-16 z-30 flex items-center gap-3 bg-amber-950/95 text-amber-100 px-4 py-2.5 shadow-2xl animate-bounce pixel-border-gold">
            <span className="text-2xl">{level.npc.avatarEmoji}</span>
            <div>
              <p className="text-xs font-bold text-amber-200">{level.npc.name}</p>
              <p className="text-[11px] text-amber-100">按 [E] 或点击互动对话 💬</p>
            </div>
            <button
              onClick={() => onOpenStory(level.npc)}
              className="pixel-btn-amber text-xs px-3 py-1 font-bold"
            >
              对话
            </button>
          </div>
        )}

        {/* Game Over Screen */}
        {isGameOver && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-md p-6 animate-fade-in" style={{ background: "rgba(255, 247, 236, 0.92)" }}>
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="text-2xl grayscale opacity-30">
                  🖤
                </span>
              ))}
            </div>
            <h1 className="text-4xl md:text-5xl font-pixel text-yellow-400 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] mb-2">
              GAME OVER
            </h1>
            <p className="text-slate-300 text-sm font-pixel mb-6">PLAY AGAIN?</p>
            <div className="flex items-center gap-4">
              <button
                onClick={restartLevel}
                className="pixel-btn-green flex items-center gap-2 font-pixel text-xs px-5 py-3"
              >
                <RotateCcw size={16} /> YES (再试一次)
              </button>
              <button
                onClick={onBackToMap}
                className="pixel-btn-slate font-pixel text-xs px-5 py-3"
              >
                NO (返回地图)
              </button>
            </div>
          </div>
        )}

        {/* Victory Screen */}
        {isVictory && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-md p-6 animate-fade-in text-center" style={{ background: "rgba(255, 247, 236, 0.94)" }}>
            <div className="text-5xl mb-3 animate-bounce">🏆</div>
            <h1 className="text-3xl md:text-4xl font-pixel text-amber-300 mb-2">
              STAGE CLEAR!
            </h1>
            <p className="text-slate-300 text-xs font-pixel mb-4">
              恭喜 {activeOC.name} 顺利通关 {level.name}!
            </p>

            {/* Run summary stats */}
            <div className="flex items-center justify-center gap-6 bg-slate-900 px-6 py-3 mb-6 shadow-inner pixel-border-slate">
              <div className="text-center">
                <p className="text-xs text-slate-400">吃金币</p>
                <p className="text-lg font-bold text-amber-400">+{coinsRun} 🪙</p>
              </div>
              <div className="w-px h-8 bg-slate-700" />
              <div className="text-center">
                <p className="text-xs text-slate-400">探索星石</p>
                <p className="text-lg font-bold text-sky-400">+{starsRun} ⭐</p>
              </div>
              <div className="w-px h-8 bg-slate-700" />
              <div className="text-center">
                <p className="text-xs text-slate-400">得分</p>
                <p className="text-lg font-bold text-purple-400">{score}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={onOpenShop}
                className="pixel-btn-amber flex items-center gap-2 font-pixel text-xs px-4 py-2.5 font-bold"
              >
                <Sparkles size={16} /> 吃金币升级外观
              </button>
              <button
                onClick={onBackToMap}
                className="pixel-btn-blue flex items-center gap-2 font-pixel text-xs px-4 py-2.5"
              >
                <ArrowRight size={16} /> 解锁新地图
              </button>
            </div>
          </div>
        )}
      </div>

      {/* On-screen touch & click controls for mobile and mouse users */}
      <div className="w-full max-w-5xl px-4 py-3 flex items-center justify-between z-20">
        {/* Left/Crouch/Right D-Pad */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onMouseDown={() => {
              keysRef.current.left = true;
            }}
            onMouseUp={() => {
              keysRef.current.left = false;
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              keysRef.current.left = true;
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              keysRef.current.left = false;
            }}
            className="pixel-btn-slate w-13 h-13 sm:w-14 sm:h-14 flex items-center justify-center font-pixel text-lg sm:text-xl active:scale-95 transition-transform"
            title="向左移动"
          >
            ◀
          </button>
          <button
            onMouseDown={() => {
              keysRef.current.down = true;
            }}
            onMouseUp={() => {
              keysRef.current.down = false;
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              keysRef.current.down = true;
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              keysRef.current.down = false;
            }}
            className="pixel-btn-blue w-13 h-13 sm:w-14 sm:h-14 flex flex-col items-center justify-center font-pixel text-base sm:text-lg active:scale-95 transition-transform"
            title="下蹲/滑行"
          >
            <span>⬇</span>
            <span className="text-[9px] font-sans -mt-1 font-bold">下蹲</span>
          </button>
          <button
            onMouseDown={() => {
              keysRef.current.right = true;
            }}
            onMouseUp={() => {
              keysRef.current.right = false;
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              keysRef.current.right = true;
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              keysRef.current.right = false;
            }}
            className="pixel-btn-slate w-13 h-13 sm:w-14 sm:h-14 flex items-center justify-center font-pixel text-lg sm:text-xl active:scale-95 transition-transform"
            title="向右移动"
          >
            ▶
          </button>
        </div>

        {/* Center Quick Shortcuts */}
        <div className="flex items-center gap-2">
          {level.npc && (
            <button
              onClick={() => onOpenStory(level.npc)}
              className="pixel-btn-slate flex items-center gap-1.5 text-amber-300 text-xs px-3 py-2"
            >
              <MessageSquare size={14} /> 剧情
            </button>
          )}
          <button
            onClick={onOpenShop}
            className="pixel-btn-amber flex items-center gap-1.5 text-xs px-3 py-2"
          >
            <Sparkles size={14} /> 外观
          </button>
        </div>

        {/* Jump Button */}
        <div>
          <button
            onMouseDown={() => {
              keysRef.current.jump = true;
              stateRef.current.player.jumpBuffer = 10;
            }}
            onMouseUp={() => {
              keysRef.current.jump = false;
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              keysRef.current.jump = true;
              stateRef.current.player.jumpBuffer = 10;
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              keysRef.current.jump = false;
            }}
            className="pixel-btn-amber w-24 h-14 font-pixel text-xs font-bold flex flex-col items-center justify-center active:scale-95 transition-transform px-2"
          >
            <span>JUMP</span>
            <span className="text-[9px] font-sans text-slate-900 font-bold -mt-0.5">跳跃/二段跳</span>
          </button>
        </div>
      </div>
    </div>
  );
};
