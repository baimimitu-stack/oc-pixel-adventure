@echo off
title OC Pixel Adventure - Build Static Site
cd /d "%~dp0"

set "NODE_HOME=C:\Users\15648\node-portable\node-v22.20.0-win-x64"
set "PATH=%NODE_HOME%;%PATH%"

echo ============================================================
echo  Building static site to dist/ ...
echo ============================================================
echo.

call "%NODE_HOME%\npm.cmd" config set registry https://registry.npmmirror.com

echo [1/2] npm install (skips if unchanged)...
call "%NODE_HOME%\npm.cmd" install
if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

echo.
echo [2/2] vite build ...
call "%NODE_HOME%\npm.cmd" run build
if errorlevel 1 (
    echo [ERROR] build failed.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  [OK] Static site built at: %cd%\dist
echo.
echo  Upload the WHOLE dist\ folder to your VPS, for example:
echo    scp -r dist/* user@your-vps:/var/www/oc-pixel-adventure/
echo.
echo  See DEPLOY.md for full deployment guide.
echo ============================================================
pause
