# Run Evaluation Tests from Project Root
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

Write-Host "Running Mock Interview Evaluation Suite..." -ForegroundColor Green
python tests/test_evaluation.py
