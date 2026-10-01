@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local-stt.ps1" -Preset small
if errorlevel 1 pause
