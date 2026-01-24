# Script pour redémarrer le backend et permettre le bon fonctionnement des simulateurs
# Ce script tue le backend actuel et le relance avec les bonnes configurations

Write-Host "=== Redémarrage du Backend pour Simulateurs ===" -ForegroundColor Cyan
Write-Host ""

# 1. Tuer tous les processus sur le port 8000
Write-Host "Etape 1: Arret du backend actuel..." -ForegroundColor Yellow
$connections = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue

if ($connections) {
    foreach ($conn in $connections) {
        $processId = $conn.OwningProcess
        Write-Host "  Arret du processus $processId sur port 8000"
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Write-Host "  Backend arrete" -ForegroundColor Green
} else {
    Write-Host "  Aucun backend en cours" -ForegroundColor Gray
}

Start-Sleep -Seconds 2

# 2. Définir les variables d'environnement
Write-Host ""
Write-Host "Etape 2: Configuration de l'environnement..." -ForegroundColor Yellow
$env:DATABASE_URL = "postgresql://gaveurs_admin:gaveurs_secure_2024@localhost:5432/gaveurs_db"
Write-Host "  DATABASE_URL definie" -ForegroundColor Green

# 3. Démarrer le backend
Write-Host ""
Write-Host "Etape 3: Demarrage du backend..." -ForegroundColor Yellow
$backendPath = "D:\GavAI\projet-euralis-gaveurs\backend-api"
$startScript = "$backendPath\start-backend.bat"

if (-not (Test-Path $startScript)) {
    Write-Host "  ERREUR: Script de demarrage non trouve a $startScript" -ForegroundColor Red
    exit 1
}

# Lancer le script batch dans une nouvelle fenêtre
$process = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/k", $startScript `
    -PassThru

Write-Host "  Backend demarre dans une nouvelle fenetre (PID: $($process.Id))" -ForegroundColor Green
Write-Host "  Vous pouvez minimiser la fenetre du backend" -ForegroundColor Gray

# 4. Attendre que le backend soit prêt
Write-Host ""
Write-Host "Etape 4: Attente du demarrage (10s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# 5. Vérifier que le backend répond
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "  Backend pret et operationnel!" -ForegroundColor Green
    }
} catch {
    Write-Host "  ATTENTION: Le backend ne repond pas encore" -ForegroundColor Yellow
    Write-Host "  Attendez quelques secondes supplementaires..." -ForegroundColor Yellow
}

# 6. Instructions finales
Write-Host ""
Write-Host "=== Backend redémarre avec succes ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Vous pouvez maintenant:" -ForegroundColor White
Write-Host "  1. Ouvrir le control panel: http://localhost:8000/control-panel" -ForegroundColor Gray
Write-Host "  2. Lancer 'Configuration Demo Auto-Enchainee'" -ForegroundColor Gray
Write-Host "  3. Les simulateurs utiliseront le bon Python avec toutes les dependances" -ForegroundColor Gray
Write-Host ""
Write-Host "Frontends disponibles:" -ForegroundColor White
Write-Host "  - Frontend Gaveur: http://localhost:3001" -ForegroundColor Gray
Write-Host "  - Frontend SQAL: http://localhost:5173" -ForegroundColor Gray
Write-Host ""
