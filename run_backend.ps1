# Run Backend from Project Root
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

if (Test-Path "$ProjectRoot\backend\.venv\Scripts\Activate.ps1") {
    Write-Host "Activating backend virtual environment..." -ForegroundColor Cyan
    & "$ProjectRoot\backend\.venv\Scripts\Activate.ps1"
} elseif (Test-Path "$ProjectRoot\.venv\Scripts\Activate.ps1") {
    Write-Host "Activating root virtual environment..." -ForegroundColor Cyan
    & "$ProjectRoot\.venv\Scripts\Activate.ps1"
}

Write-Host "Starting FastAPI Mock Interview backend on http://localhost:8000..." -ForegroundColor Green
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
