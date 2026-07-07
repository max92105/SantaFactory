@echo off
setlocal
set PORT=5173

if /i "%~1"=="start"   goto start
if /i "%~1"=="stop"    goto stop
if /i "%~1"=="restart" goto restart
if /i "%~1"=="status"  goto status

:menu
echo.
echo === SantaFactory Dev Server (port %PORT%) ===
call :check
if defined PID (
    echo Status: RUNNING - http://localhost:%PORT%/ ^(PID %PID%^)
) else (
    echo Status: NOT running
)
echo.
echo   [1] Start
echo   [2] Stop
echo   [3] Restart
echo   [Q] Quit
echo.
choice /c 123Q /n /m "Choose an option: "
if errorlevel 4 exit /b 0
if errorlevel 3 (call :restart & goto menu)
if errorlevel 2 (call :stop & goto menu)
if errorlevel 1 (call :start & goto menu)
goto menu

:start
call :check
if defined PID (
    echo Dev server already running on port %PORT% ^(PID %PID%^).
    exit /b 0
)
echo Starting dev server at http://localhost:%PORT%/ ...
start "SantaFactory Dev Server" cmd /c "cd /d %~dp0 && npm run dev"
exit /b 0

:stop
call :check
if not defined PID (
    echo Dev server is not running.
    exit /b 0
)
echo Stopping dev server ^(PID %PID%^) ...
taskkill /pid %PID% /t /f >nul 2>&1
echo Stopped.
exit /b 0

:restart
call :stop
ping -n 2 127.0.0.1 >nul
goto start

:status
call :check
if defined PID (
    echo Dev server is RUNNING on http://localhost:%PORT%/ ^(PID %PID%^).
) else (
    echo Dev server is NOT running.
)
exit /b 0

:check
set "PID="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":%PORT% " ^| findstr LISTENING') do set "PID=%%a"
exit /b 0
