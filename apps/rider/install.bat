@echo off
title Riya Rider App - Install
cd /d "%~dp0"
echo Installing Riya Rider dependencies...
call npm install
if errorlevel 1 (
  echo Installation failed. Check Node.js and internet connection.
  pause
  exit /b 1
)
echo.
echo Rider App installed successfully.
pause
