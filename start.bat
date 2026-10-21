@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% neq 0 goto bundled
py -3 --version >nul 2>nul
if %errorlevel% equ 0 (
  py -3 server.py --open
  goto done
)
:bundled
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" server.py --open
  goto done
)
python server.py --open
:done
pause
