# Run Tests PowerShell Script
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

# Activate .venv if it exists
if (Test-Path "$ProjectRoot\backend\.venv\Scripts\Activate.ps1") {
    Write-Host "Activating backend virtual environment..." -ForegroundColor Cyan
    & "$ProjectRoot\backend\.venv\Scripts\Activate.ps1"
} elseif (Test-Path "$ProjectRoot\.venv\Scripts\Activate.ps1") {
    Write-Host "Activating root virtual environment..." -ForegroundColor Cyan
    & "$ProjectRoot\.venv\Scripts\Activate.ps1"
}

Write-Host "Running Mock Interview Evaluation Test Suite..." -ForegroundColor Green
python tests/test_evaluation.py
