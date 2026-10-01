@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local-stt.ps1" -Preset qwen
if errorlevel 1 pause
