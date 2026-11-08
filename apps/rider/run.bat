@echo off
title Riya Rider App
cd /d "%~dp0"
if not exist node_modules (
  echo Dependencies missing. Run install.bat first.
  pause
  exit /b 1
)
start "" http://127.0.0.1:5175
call npm run dev
pause
