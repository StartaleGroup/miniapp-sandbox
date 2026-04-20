@echo off
setlocal EnableExtensions

rem Run from the script directory so relative paths match start.sh.
cd /d "%~dp0" || exit /b 1

rem Modern Windows terminals support ANSI escape sequences for colored logs.
for /f %%e in ('echo prompt $E^| cmd') do set "ESC=%%e"
set "GREEN=%ESC%[0;32m"
set "BLUE=%ESC%[0;34m"
set "YELLOW=%ESC%[1;33m"
set "NC=%ESC%[0m"

echo %BLUE%Starting MiniApp Sandbox services...%NC%
echo.

rem Resolve node.exe once so the background services do not depend on a shell shim.
set "NODE_EXE="
for /f "delims=" %%i in ('where node 2^>nul') do (
    if not defined NODE_EXE set "NODE_EXE=%%i"
)

if not defined NODE_EXE (
    echo %YELLOW%Node.js was not found on PATH.%NC%
    goto :fail
)

rem Install root dependencies only when they are missing.
if not exist "node_modules\" (
    echo %YELLOW%Installing root dependencies...%NC%
    call pnpm install
    if errorlevel 1 goto :fail
)

rem Install notify dependencies and rebuild better-sqlite3 on first setup.
if not exist "notify\node_modules\" (
    echo %YELLOW%Installing notify dependencies...%NC%
    pushd "notify" || goto :fail
    call pnpm install
    if errorlevel 1 (
        popd
        goto :fail
    )

    call pnpm rebuild better-sqlite3
    if errorlevel 1 (
        popd
        goto :fail
    )
    popd
)

rem Replace any stale PID file with the new background process IDs.
if exist ".pids" del ".pids" >nul 2>&1

echo %GREEN%Starting notification service on port 3200...%NC%
rem Use the underlying CLI directly because detached pnpm/Volta shims can exit on Windows.
call :start_service "%cd%\notify" "..\notify.log" "%NODE_EXE%" "'node_modules\tsx\dist\cli.mjs' 'watch' 'src\index.ts'" NOTIFY_PID
if errorlevel 1 goto :fail

rem Match the Bash script's short pause before the sandbox starts.
timeout /t 2 /nobreak >nul

echo %GREEN%Starting sandbox on port 3100...%NC%
call :start_service "%cd%" "sandbox.log" "%NODE_EXE%" "'node_modules\vite\bin\vite.js' '--port' '3100'" SANDBOX_PID
if errorlevel 1 goto :fail

> ".pids" echo %NOTIFY_PID%
>> ".pids" echo %SANDBOX_PID%

echo.
echo %GREEN%[OK] Services started!%NC%
echo.
echo %BLUE%URLs:%NC%
echo   Sandbox:      http://localhost:3100
echo   Notification: http://localhost:3200
echo.
echo %BLUE%Logs:%NC%
echo   Sandbox:      Get-Content sandbox.log -Wait
echo   Notification: Get-Content notify.log -Wait
echo.
echo %YELLOW%To stop all services, run: .\stop.bat%NC%
echo.
rem Keep the window open when the script is launched directly from Explorer.
pause
exit /b 0

:start_service
setlocal

rem Start each service in a hidden PowerShell process so all output can be redirected to one log.
set "START_WORKDIR=%~1"
set "START_LOG=%~2"
set "START_EXE=%~3"
set "START_ARGS=%~4"
set "START_SCRIPT=& '%START_EXE%' %START_ARGS% *> '%START_LOG%'"
set "PID="

for /f %%i in ('powershell -NoProfile -Command "$wd = $env:START_WORKDIR; $script = $env:START_SCRIPT; $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-Command', $script) -WorkingDirectory $wd -WindowStyle Hidden -PassThru; $process.Id"') do (
    set "PID=%%i"
)

if not defined PID (
    endlocal & exit /b 1
)

endlocal & set "%~5=%PID%"
exit /b 0

:fail
echo.
echo %YELLOW%Startup failed. Check the command output above for details.%NC%
pause
exit /b 1
