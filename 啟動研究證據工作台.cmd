@echo off
chcp 65001 >nul
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  start "研究證據工作台伺服器" cmd /k "cd /d ""%~dp0"" && python -m http.server 4176 --bind 127.0.0.1"
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    start "研究證據工作台伺服器" cmd /k "cd /d ""%~dp0"" && py -m http.server 4176 --bind 127.0.0.1"
  ) else (
    echo 找不到 Python，將改為開啟免安裝可攜版。
    start "" "%~dp0研究證據工作台-直接開啟.html"
    exit /b 0
  )
)

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4176/"
echo 已啟動研究證據工作台。關閉「研究證據工作台伺服器」視窗即可停止。
timeout /t 4 /nobreak >nul

