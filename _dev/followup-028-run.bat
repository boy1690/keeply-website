@echo off
REM Spec 028 follow-up check — run by Windows Task Scheduler (schtasks) on 2026-05-08.
REM Produces: specs/website/028-compare-keeply-hub/_followup-{YYYY-MM-DD}.md
REM Logs:     _dev/_followup-028-run.log

cd /d "%~dp0\.."
node "%~dp0\followup-028-check.js" > "%~dp0\_followup-028-run.log" 2>&1
exit /b %errorlevel%
