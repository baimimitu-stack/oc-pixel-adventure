@echo off
title OC Pixel Adventure - Dev Launcher
cd /d "%~dp0"

set "NODE_HOME=C:\Users\15648\node-portable\node-v22.20.0-win-x64"
set "PATH=%NODE_HOME%;%PATH%"

echo ============================================================
echo  Portable Node:
"%NODE_HOME%\node.exe" -v
echo  npm version:
call "%NODE_HOME%\npm.cmd" -v
echo ============================================================
echo.

REM  v0.4 起项目改成纯前端 SPA，去掉了 express 等后端依赖
REM  每次都跑 npm install：有 lock 时秒级完成，能自动同步依赖变化
echo [1/2] Syncing dependencies (fast if unchanged)...
call "%NODE_HOME%\npm.cmd" config set registry https://registry.npmmirror.com
call "%NODE_HOME%\npm.cmd" install
if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. Try deleting node_modules and re-running.
    pause
    exit /b 1
)
echo.

echo [2/2] Starting Vite dev server on http://localhost:3000
echo        Browser will auto-open in 5 seconds.
echo        Close this window to stop the server.
echo.

start "" cmd /c "timeout /t 5 /nobreak > nul && start http://localhost:3000"

call "%NODE_HOME%\npm.cmd" run dev

echo.
echo Server stopped. Press any key to close this window.
pause > nul
