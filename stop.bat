@echo off
setlocal EnableExtensions

rem Run from the script directory so the PID file is always resolved correctly.
cd /d "%~dp0" || exit /b 1

rem Keep the Windows output style aligned with stop.sh.
for /f %%e in ('echo prompt $E^| cmd') do set "ESC=%%e"
set "RED=%ESC%[0;31m"
set "GREEN=%ESC%[0;32m"
set "NC=%ESC%[0m"

echo %RED%Stopping MiniApp Sandbox services...%NC%
echo.

if not exist ".pids" goto :no_pids

for /f "usebackq delims=" %%p in (".pids") do call :stop_pid %%p

del ".pids" >nul 2>&1

echo.
echo %GREEN%[OK] All services stopped%NC%
echo.
rem Keep the window open when the script is launched directly from Explorer.
pause
exit /b 0

:no_pids
echo %RED%No running services found (.pids file missing)%NC%
echo.
pause
exit /b 0

:stop_pid
if "%~1"=="" exit /b 0

tasklist /FI "PID eq %~1" | find "%~1" >nul
if errorlevel 1 exit /b 0

echo Stopping process %~1 and its children...
taskkill /PID %~1 /T /F >nul 2>&1
exit /b 0
