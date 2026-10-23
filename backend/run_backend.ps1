# Run Backend PowerShell Script
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Activate .venv if it exists
if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment (.venv)..." -ForegroundColor Cyan
    & ".\.venv\Scripts\Activate.ps1"
} elseif (Test-Path "..\.venv\Scripts\Activate.ps1") {
    Write-Host "Activating root virtual environment (.venv)..." -ForegroundColor Cyan
    & "..\.venv\Scripts\Activate.ps1"
}

Write-Host "Starting FastAPI Mock Interview backend on http://localhost:8000..." -ForegroundColor Green
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
