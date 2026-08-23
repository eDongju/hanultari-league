@echo off
echo ==========================================
echo  Hanultari Stock Screening Agent
echo ==========================================

REM Set encoding
set PYTHONIOENCODING=utf-8
chcp 65001 > nul

REM Target date
REM set TARGET_DATE=20260814

REM Run Python
"C:\Users\djlee\anaconda3\python.exe" "D:\00_AI_Agent\hanultari-web\scripts\screener_firebase.py"

echo.
echo ==========================================
echo  Screening task completed.
echo ==========================================
pause
