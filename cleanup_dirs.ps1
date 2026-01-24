# Cleanup obsolete directories
# Run this script from PowerShell: .\cleanup_dirs.ps1

Write-Host "Cleaning up obsolete directories..." -ForegroundColor Yellow

# Remove frontend (empty stub)
if (Test-Path "frontend") {
    Write-Host "Removing frontend/..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force "frontend" -ErrorAction SilentlyContinue
}

# Remove gaveurs (empty stub)
if (Test-Path "gaveurs") {
    Write-Host "Removing gaveurs/..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force "gaveurs" -ErrorAction SilentlyContinue
}

# Remove backend/venv first (if exists)
if (Test-Path "backend\venv") {
    Write-Host "Removing backend/venv/..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force "backend\venv" -ErrorAction SilentlyContinue
}

# Remove backend (empty stub)
if (Test-Path "backend") {
    Write-Host "Removing backend/..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force "backend" -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Remaining directories:" -ForegroundColor Yellow
Get-ChildItem -Directory | Where-Object {$_.Name -match "backend|frontend|gaveurs|euralis"} | Format-Table Name, @{Label="Size";Expression={(Get-ChildItem $_.FullName -Recurse | Measure-Object -Property Length -Sum).Sum / 1KB}}
