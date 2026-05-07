@echo off
setlocal
set "ROOT=%~dp0"

echo ============================================
echo   AgentForge - Starting Backend + Frontend
echo ============================================
echo.

echo Clearing old dev servers on ports 3000, 3001, 3002, 5173, and 8000 ...
for %%P in (3000 3001 3002 5173 8000) do (
  for /f %%A in ('powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort %%P -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"') do (
    echo   Killing PID %%A on port %%P
    taskkill /PID %%A /T /F >nul 2>&1
  )
)
echo.

echo Starting backend on http://127.0.0.1:8000 ...
start "AgentForge Backend" /D "%ROOT%backend" cmd /k "python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting frontend on http://127.0.0.1:3000 ...
start "AgentForge Frontend" /D "%ROOT%agentforge-react" cmd /k "npm run dev -- --host 127.0.0.1 --port 3000 --strictPort"

echo.
echo Both servers launching in separate windows.
echo Open http://127.0.0.1:3000 once ready.
echo.
