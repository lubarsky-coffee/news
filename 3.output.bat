@echo off
cd grinder
fnm use 2>nul
call npm run slides > logs/slides.log
call npm run audio > logs/audio.log
pause