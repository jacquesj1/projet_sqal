# =============================================================================
# Euralis Gaveurs - Deploiement demo NAS Synology D720+
# =============================================================================
# Usage :
#   .\scripts\nas_deploy_euralis.ps1              # Deploiement standard
#   .\scripts\nas_deploy_euralis.ps1 -Init        # + simulateur gavage CSV (one-shot)
#   .\scripts\nas_deploy_euralis.ps1 -Rebuild     # Force docker build --no-cache
#   .\scripts\nas_deploy_euralis.ps1 -Down        # Arreter la stack
#   .\scripts\nas_deploy_euralis.ps1 -Status      # Statut containers
#   .\scripts\nas_deploy_euralis.ps1 -Logs        # Logs recents
#   .\scripts\nas_deploy_euralis.ps1 -Vpn         # Forcer IP VPN (detection auto sinon)
#
# Acces apres deploiement :
#   http://DEEP_NAS:8081  -> Gaveurs
#   http://DEEP_NAS:8082  -> Euralis
#   http://DEEP_NAS:8083  -> Traceabilite
#   http://DEEP_NAS:8084  -> SQAL
#   http://DEEP_NAS:8085  -> Control Panel
#   http://DEEP_NAS:5556  -> Flower (monitoring Celery)
#
# Prerequis :
#   - Cle SSH configuree : ssh-copy-id admin_jj@DEEP_NAS
#   - Docker socket accessible sur NAS : sudo chmod 666 /var/run/docker.sock
#   - .env.euralis.nas present localement (non commite)
#
# Compatible PowerShell 5.1+ - ASCII pur (pas d'accents, pas de && hors string)
# =============================================================================

param(
    [switch]$Init,     # Lancer simulator-gavage CSV apres deploiement
    [switch]$Rebuild,  # Forcer docker build --no-cache
    [switch]$Down,     # Arreter la stack NAS
    [switch]$Status,   # Afficher le statut des containers
    [switch]$Logs,     # Afficher les logs
    [switch]$Vpn       # Forcer IP VPN
)

$ErrorActionPreference = "SilentlyContinue"

# Projet local Euralis
$ProjectRoot = "D:\GavAI\projet-euralis-gaveurs"

# Configuration NAS
$NAS_HOST_LAN         = "DEEP_NAS"
$NAS_HOST_VPN_DEFAULT = "192.168.1.103"
$NAS_USER             = "admin_jj"

# Chemins sur NAS
$NAS_PROJECT  = "/volume1/DevProject/euralis/projet-euralis-gaveurs"
$NAS_BARE     = "/volume1/DevProject/euralis/backups/projet-euralis-gaveurs.git"
$NAS_COMPOSE  = "docker-compose.euralis.nas.yml"
$NAS_ENV_FILE = ".env.euralis.nas"

# Variables dynamiques (mises a jour par Resolve-NasHost)
$script:NAS_HOST = $NAS_HOST_LAN
$script:NAS_IP   = $NAS_HOST_LAN

# ---------------------------------------------------------------------------
# Fonctions utilitaires (ASCII pur - PS 5.1 safe)
# ---------------------------------------------------------------------------
function Write-Header { param([string]$T) Write-Host ("`n=== " + $T + " ===") -ForegroundColor Cyan }
function Write-OK     { param([string]$T) Write-Host ("OK  " + $T) -ForegroundColor Green }
function Write-Warn   { param([string]$T) Write-Host ("!   " + $T) -ForegroundColor Yellow }
function Write-Err    { param([string]$T) Write-Host ("ERR " + $T) -ForegroundColor Red }
function Write-Step   { param([string]$T) Write-Host (">>> " + $T) -ForegroundColor White }

# ---------------------------------------------------------------------------
# Helper SSH : PATH Synology enrichi pour session non-interactive
# Note : && dans $Cmd est interprete par bash (Linux), pas par PS -> OK
# ---------------------------------------------------------------------------
function Invoke-Ssh {
    param([string]$Cmd, [switch]$Silent)
    $fullCmd = "export PATH=/usr/local/bin:/usr/bin:/bin:/usr/syno/bin; " + $Cmd
    $result  = ssh ($NAS_USER + "@" + $script:NAS_HOST) $fullCmd 2>&1
    if (-not $Silent) { $result | ForEach-Object { Write-Host ("  [NAS] " + $_) } }
    return $LASTEXITCODE
}

# ---------------------------------------------------------------------------
# Detection reseau : LAN (DEEP_NAS) ou VPN (IP fixe)
# ---------------------------------------------------------------------------
function Resolve-NasHost {
    param([switch]$ForceVpn)

    $nasIpVpn = $NAS_HOST_VPN_DEFAULT
    $envVal = [System.Environment]::GetEnvironmentVariable("NAS_IP_VPN", "Process")
    if ($envVal) { $nasIpVpn = $envVal }

    if ($ForceVpn) {
        Write-Warn ("Mode VPN force -> " + $nasIpVpn)
        $script:NAS_HOST = $nasIpVpn
        $script:NAS_IP   = $nasIpVpn
        return $true
    }

    Write-Host "  Detection reseau (LAN ou VPN)..." -ForegroundColor Gray
    $outLan = ssh -o ConnectTimeout=3 -o BatchMode=yes -o StrictHostKeyChecking=no `
        ($NAS_USER + "@" + $NAS_HOST_LAN) "echo nas_ok" 2>&1
    if ($outLan -match "nas_ok") {
        Write-OK ("Reseau local detecte -> " + $NAS_HOST_LAN)
        $script:NAS_HOST = $NAS_HOST_LAN
        $script:NAS_IP   = $NAS_HOST_LAN
        return $true
    }

    Write-Host ("  LAN non accessible, essai VPN (" + $nasIpVpn + ")...") -ForegroundColor Gray
    $outVpn = ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no `
        ($NAS_USER + "@" + $nasIpVpn) "echo nas_ok" 2>&1
    if ($outVpn -match "nas_ok") {
        Write-Warn ("VPN detecte -> " + $nasIpVpn)
        $script:NAS_HOST = $nasIpVpn
        $script:NAS_IP   = $nasIpVpn
        return $true
    }

    Write-Err ("NAS inaccessible (LAN: " + $NAS_HOST_LAN + ", VPN: " + $nasIpVpn + ")")
    Write-Warn "  Verifiez : 1) SSH actif dans DSM  2) ssh-copy-id admin_jj@DEEP_NAS"
    return $false
}

# ---------------------------------------------------------------------------
# Detection docker compose v1 ou v2 sur NAS
# ---------------------------------------------------------------------------
function Get-NasDockerCompose {
    $prefix = "export PATH=/usr/local/bin:/usr/bin:/bin:/usr/syno/bin; "
    $dc2 = ssh ($NAS_USER + "@" + $script:NAS_HOST) ($prefix + "docker compose version") 2>&1
    if ($dc2 -match "Docker Compose") { return "docker compose" }
    $dc1 = ssh ($NAS_USER + "@" + $script:NAS_HOST) ($prefix + "docker-compose version") 2>&1
    if ($dc1 -match "docker-compose") { return "docker-compose" }
    $dc3 = ssh ($NAS_USER + "@" + $script:NAS_HOST) "/usr/local/bin/docker compose version" 2>&1
    if ($dc3 -match "Docker Compose") { return "/usr/local/bin/docker compose" }
    return $null
}

# ---------------------------------------------------------------------------
# Charger .env.euralis.nas dans l'environnement du processus
# ---------------------------------------------------------------------------
function Load-EnvEuralis {
    $envFile = Join-Path $ProjectRoot ".env.euralis.nas"
    if (-not (Test-Path $envFile)) {
        Write-Err (".env.euralis.nas absent de " + $ProjectRoot)
        Write-Warn "  Creez-le a partir du template fourni dans le projet"
        return $false
    }
    Get-Content $envFile | Where-Object { $_ -match "^\s*[^#]\S+=\S+" } | ForEach-Object {
        $parts = $_ -split "=", 2
        [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
    return $true
}

# ---------------------------------------------------------------------------
# Copier .env.euralis.nas sur NAS via SSH stdin (sans scp)
# ---------------------------------------------------------------------------
function Copy-EnvToNas {
    $envFile    = Join-Path $ProjectRoot ".env.euralis.nas"
    $envContent = Get-Content $envFile -Raw
    $destPath   = $NAS_PROJECT + "/" + $NAS_ENV_FILE
    $sshTarget  = $NAS_USER + "@" + $script:NAS_HOST
    $envContent | ssh $sshTarget ("cat > " + $destPath) 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-OK ".env.euralis.nas copie sur NAS"
    } else {
        Write-Warn ".env.euralis.nas : erreur copie (non bloquant)"
    }
}

# ===========================================================================
# -Down : arreter la stack
# ===========================================================================
if ($Down) {
    Write-Header "Arret stack Euralis NAS"
    if (-not (Load-EnvEuralis)) { exit 1 }
    if (-not (Resolve-NasHost -ForceVpn:$Vpn)) { exit 1 }
    $dc = Get-NasDockerCompose
    if (-not $dc) { Write-Err "docker compose introuvable sur NAS"; exit 1 }
    $sshCmd = "cd " + $NAS_PROJECT + " && " + $dc + " -f " + $NAS_COMPOSE + " --env-file " + $NAS_ENV_FILE + " down"
    Invoke-Ssh $sshCmd
    Write-OK "Stack Euralis arretee"
    exit 0
}

# ===========================================================================
# -Status : statut containers
# ===========================================================================
if ($Status) {
    Write-Header "Statut stack Euralis NAS"
    if (-not (Load-EnvEuralis)) { exit 1 }
    if (-not (Resolve-NasHost -ForceVpn:$Vpn)) { exit 1 }
    $dc = Get-NasDockerCompose
    if (-not $dc) { Write-Err "docker compose introuvable sur NAS"; exit 1 }
    $sshCmd = "cd " + $NAS_PROJECT + " && " + $dc + " -f " + $NAS_COMPOSE + " --env-file " + $NAS_ENV_FILE + " ps"
    Invoke-Ssh $sshCmd
    exit 0
}

# ===========================================================================
# -Logs : logs recents
# ===========================================================================
if ($Logs) {
    Write-Header "Logs stack Euralis NAS"
    if (-not (Load-EnvEuralis)) { exit 1 }
    if (-not (Resolve-NasHost -ForceVpn:$Vpn)) { exit 1 }
    $dc = Get-NasDockerCompose
    if (-not $dc) { Write-Err "docker compose introuvable sur NAS"; exit 1 }
    $sshCmd = "cd " + $NAS_PROJECT + " && " + $dc + " -f " + $NAS_COMPOSE + " --env-file " + $NAS_ENV_FILE + " logs --tail=100"
    Invoke-Ssh $sshCmd
    exit 0
}

# ===========================================================================
# DEPLOIEMENT PRINCIPAL
# ===========================================================================

Write-Header "Deploiement Euralis Gaveurs - NAS Synology D720+"
Write-Warn "Build estime : 25-35 min premier build (Julia SymbolicRegression.jl + 5 frontends)"
Write-Host ""

# ---------------------------------------------------------------------------
# Etape 0 : Verifications locales
# ---------------------------------------------------------------------------
Write-Step "Etape 0 : Verification environnement local"

if (-not (Load-EnvEuralis)) { exit 1 }
Write-OK ".env.euralis.nas charge"

if (-not (Test-Path $ProjectRoot)) {
    Write-Err ("Repertoire projet introuvable : " + $ProjectRoot)
    exit 1
}

Push-Location $ProjectRoot
& git status 2>&1 | Out-Null
$gitOk = $LASTEXITCODE
if ($gitOk -ne 0) {
    Pop-Location
    Write-Err ("Le projet n'est pas un depot git : " + $ProjectRoot)
    exit 1
}

# Verifier les fichiers NAS critiques sont commites
$criticalFiles = @(
    "docker-compose.euralis.nas.yml",
    "docker/nginx/nginx.nas.conf",
    "scripts/nas_deploy_euralis.ps1"
)
$untracked = @()
foreach ($file in $criticalFiles) {
    $tracked = & git ls-files $file 2>&1
    if (-not $tracked) { $untracked += $file }
}

if ($untracked.Count -gt 0) {
    Write-Err "Fichiers NAS non commites dans git (ne seront PAS transferes sur NAS) :"
    $untracked | ForEach-Object { Write-Warn ("  git add " + $_) }
    Write-Warn "  git commit -m 'feat: NAS deployment config'"
    Write-Warn "  Puis relancez ce script."
    Pop-Location
    exit 1
}

# Verifier qu'il n'y a pas de modifications non-commitees sur les fichiers cles
$dirty = & git status --porcelain 2>&1 | Where-Object { $_ -match "docker-compose.euralis|nginx.nas|nas_deploy_euralis" }
if ($dirty) {
    Write-Warn "Modifications non-commitees sur fichiers NAS - le NAS recevra l'ancienne version :"
    $dirty | ForEach-Object { Write-Host ("    " + $_) -ForegroundColor Yellow }
    Write-Warn "  Commitez avant de deployer pour envoyer la version a jour."
}

Pop-Location
Write-OK "Depot git OK"

# ---------------------------------------------------------------------------
# Etape 1 : Connexion NAS
# ---------------------------------------------------------------------------
Write-Step "Etape 1 : Connexion NAS"
if (-not (Resolve-NasHost -ForceVpn:$Vpn)) { exit 1 }

$dc = Get-NasDockerCompose
if (-not $dc) {
    Write-Err "docker compose introuvable sur NAS - Container Manager installe ?"
    exit 1
}
Write-OK ("Docker Compose : " + $dc)

# ---------------------------------------------------------------------------
# Etape 2 : Setup repertoire NAS (bare repo + working dir)
# ---------------------------------------------------------------------------
Write-Step "Etape 2 : Setup repertoire NAS"

Invoke-Ssh ("mkdir -p /volume1/DevProject/euralis/backups") -Silent | Out-Null
Invoke-Ssh ("mkdir -p " + $NAS_PROJECT) -Silent | Out-Null

# Bare repo
$bareCheck = ssh ($NAS_USER + "@" + $script:NAS_HOST) `
    ("export PATH=/usr/local/bin:/usr/bin:/bin:/usr/syno/bin; test -d " + $NAS_BARE + "/objects && echo exists") 2>&1
if ($bareCheck -notmatch "exists") {
    Write-Step "  Initialisation bare repo git"
    Invoke-Ssh ("git init --bare " + $NAS_BARE) -Silent | Out-Null
    Write-OK ("Bare repo cree : " + $NAS_BARE)
} else {
    Write-OK ("Bare repo OK : " + $NAS_BARE)
}

# Working dir (clone depuis bare repo)
$workCheck = ssh ($NAS_USER + "@" + $script:NAS_HOST) `
    ("export PATH=/usr/local/bin:/usr/bin:/bin:/usr/syno/bin; test -f " + $NAS_PROJECT + "/.git/config && echo exists") 2>&1
if ($workCheck -notmatch "exists") {
    Write-Step "  Initialisation repertoire de travail"
    Invoke-Ssh ("git clone " + $NAS_BARE + " " + $NAS_PROJECT) | Out-Null
    Write-OK ("Repertoire de travail cree : " + $NAS_PROJECT)
} else {
    Write-OK ("Repertoire de travail OK : " + $NAS_PROJECT)
}

Invoke-Ssh ("git config --global --add safe.directory " + $NAS_PROJECT) -Silent | Out-Null

# ---------------------------------------------------------------------------
# Etape 3 : Synchronisation code -> NAS
# ---------------------------------------------------------------------------
Write-Step "Etape 3 : Synchronisation code -> NAS"

Push-Location $ProjectRoot

# Ajouter remote 'nas' si absent
$nasRemoteUrl  = "ssh://" + $NAS_USER + "@" + $NAS_HOST_LAN + $NAS_BARE
$remoteGetUrl  = & git remote get-url nas 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Step "  Ajout remote git 'nas'"
    & git remote add nas $nasRemoteUrl 2>&1 | Out-Null
    Write-OK ("Remote 'nas' ajoute : " + $nasRemoteUrl)
} else {
    Write-OK ("Remote 'nas' : " + ($remoteGetUrl | Select-Object -First 1).Trim())
}

# Push vers NAS
Write-Step "  git push nas --all"
& git push nas --all 2>&1 | ForEach-Object { Write-Host ("  " + $_) -ForegroundColor Gray }
Pop-Location

# Pull sur NAS - FETCH_HEAD (independant du nom de branche : main / master / dev / ...)
Write-Step "  git pull sur NAS"
$sshTarget   = $NAS_USER + "@" + $script:NAS_HOST
$fullPullCmd = "export PATH=/usr/local/bin:/usr/bin:/bin:/usr/syno/bin; cd " + $NAS_PROJECT + " && git fetch origin 2>&1 && git reset --hard FETCH_HEAD 2>&1 && echo pull_ok"
$pullOut     = ssh $sshTarget $fullPullCmd 2>&1
$pullOut | ForEach-Object { Write-Host ("  [NAS] " + $_) -ForegroundColor Gray }
if ($pullOut -match "pull_ok") {
    Write-OK "git pull reussi (FETCH_HEAD)"
} else {
    Write-Warn "git pull incertain - copie directe des fichiers critiques en cours..."
}

# Verification presence fichiers NAS critiques + copie directe SSH si absents
# Inclut backend-api/Dockerfile.prod (requis par docker build)
$nasFilesToVerify = @(
    @{ local = "docker-compose.euralis.nas.yml";   remote = ($NAS_PROJECT + "/docker-compose.euralis.nas.yml") },
    @{ local = "docker/nginx/nginx.nas.conf";       remote = ($NAS_PROJECT + "/docker/nginx/nginx.nas.conf") },
    @{ local = "backend-api/Dockerfile.prod";       remote = ($NAS_PROJECT + "/backend-api/Dockerfile.prod") }
)
foreach ($f in $nasFilesToVerify) {
    $existOut = ssh $sshTarget ("export PATH=/usr/local/bin:/usr/bin:/bin:/usr/syno/bin; test -f '" + $f.remote + "' && echo ok || echo missing") 2>&1
    if ($existOut -match "missing") {
        Write-Warn ("  Absent sur NAS, copie directe : " + $f.local)
        $parentDir   = ($f.remote -replace "/[^/]+$", "")
        ssh $sshTarget ("export PATH=/usr/local/bin:/usr/bin:/bin:/usr/syno/bin; mkdir -p '" + $parentDir + "'") 2>&1 | Out-Null
        $localFile   = Join-Path $ProjectRoot $f.local
        $fileContent = Get-Content $localFile -Raw
        $fileContent | ssh $sshTarget ("cat > '" + $f.remote + "'") 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { Write-OK ("  Copie OK : " + $f.local) }
        else { Write-Err ("  Echec copie directe : " + $f.local + " - Arret."); exit 1 }
    } else {
        Write-OK ("  Fichier present : " + $f.local)
    }
}
Write-OK "Code synchronise"

# ---------------------------------------------------------------------------
# Etape 4 : Copie .env
# ---------------------------------------------------------------------------
Write-Step "Etape 4 : Configuration .env"
Copy-EnvToNas

# ---------------------------------------------------------------------------
# Etape 5 : Repertoires runtime (non trackes par git)
# ---------------------------------------------------------------------------
Write-Step "Etape 5 : Creation repertoires runtime"

$mkCmd = "mkdir -p " + $NAS_PROJECT + "/backend-api/models " + $NAS_PROJECT + "/simulators/data " + $NAS_PROJECT + "/logs"
Invoke-Ssh $mkCmd -Silent | Out-Null
Write-OK "Repertoires crees : backend-api/models, simulators/data, logs"

# ---------------------------------------------------------------------------
# Etape 6 : Docker build
# ---------------------------------------------------------------------------
Write-Step "Etape 6 : Docker build images"
Write-Warn "Julia SymbolicRegression.jl + 5 frontends... patience (~25-35 min premier build)"

$baseCmd = "cd " + $NAS_PROJECT + " && " + $dc + " -f " + $NAS_COMPOSE + " --env-file " + $NAS_ENV_FILE

if ($Rebuild) {
    Write-Warn "Mode --no-cache actif + purge cache BuildKit (evite corruption apres build avorte)"
    # Purge BuildKit cache : indispensable apres un build avorte pour eviter
    # l'erreur "failed to calculate checksum of ref ... not found"
    Invoke-Ssh "docker builder prune -f 2>&1" -Silent | Out-Null
    Write-OK "Cache BuildKit purgé"
    $buildExec = $baseCmd + " build --no-cache 2>&1 | tail -50"
} else {
    $buildExec = $baseCmd + " build 2>&1 | tail -50"
}

Invoke-Ssh $buildExec
if ($LASTEXITCODE -ne 0) {
    Write-Err "docker build a echoue"
    Write-Warn ("Logs : ssh " + $NAS_USER + "@" + $script:NAS_HOST + " 'docker logs euralis_backend'")
    exit 1
}
Write-OK "Images Docker construites"

# ---------------------------------------------------------------------------
# Etape 7 : Migrations Alembic
# ---------------------------------------------------------------------------
Write-Step "Etape 7 : Migrations Alembic"

$upDbCmd = $baseCmd + " up -d timescaledb redis 2>&1"
Invoke-Ssh $upDbCmd -Silent | Out-Null
Write-Host "  Attente TimescaleDB (30s)..." -ForegroundColor Gray
Start-Sleep -Seconds 30

$migrateCmd = $baseCmd + " run --rm migrate 2>&1 | tail -10"
Invoke-Ssh $migrateCmd
Write-OK "Migrations appliquees"

# ---------------------------------------------------------------------------
# Etape 8 : Lancement stack complete
# ---------------------------------------------------------------------------
Write-Step "Etape 8 : Demarrage stack"
$upCmd = $baseCmd + " up -d 2>&1 | tail -20"
Invoke-Ssh $upCmd
Write-OK "Stack lancee"

# ---------------------------------------------------------------------------
# Etape 9 (optionnel) : Simulateur Gavage CSV init
# ---------------------------------------------------------------------------
if ($Init) {
    Write-Step "Etape 9 : Import donnees CSV gavage (one-shot)"
    Write-Host "  Attente backend (60s)..." -ForegroundColor Gray
    Start-Sleep -Seconds 60
    $initCmd = $baseCmd + " --profile init run --rm simulator-gavage 2>&1 | tail -10"
    Invoke-Ssh $initCmd
    Write-OK "Donnees CSV importees"
}

# ---------------------------------------------------------------------------
# Etape 10 : Verification sante
# ---------------------------------------------------------------------------
Write-Step "Etape 10 : Verification containers"
Write-Host "  Attente demarrage (90s)..." -ForegroundColor Gray
Start-Sleep -Seconds 90

$psCmd = $baseCmd + " ps 2>&1"
Invoke-Ssh $psCmd

Write-Host ""
Write-Host "  Test HTTP ports nginx :" -ForegroundColor Gray
$ports  = @(8081, 8082, 8083, 8084, 8085)
$labels = @("Gaveurs", "Euralis", "Traceabilite", "SQAL", "ControlPanel")
for ($i = 0; $i -lt $ports.Count; $i++) {
    $port    = $ports[$i]
    $label   = $labels[$i]
    $testCmd = "curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 http://localhost:" + $port
    $code = ssh ($NAS_USER + "@" + $script:NAS_HOST) `
        ("export PATH=/usr/local/bin:/usr/bin:/bin:/usr/syno/bin; " + $testCmd) 2>&1
    if ($code -match "^(200|301|302|304)$") {
        Write-OK ("  Port " + $port + " (" + $label + ") -> HTTP " + $code)
    } else {
        Write-Warn ("  Port " + $port + " (" + $label + ") -> HTTP " + $code + " (peut encore demarrer)")
    }
}

# ---------------------------------------------------------------------------
# Resume final
# ---------------------------------------------------------------------------
Write-Host ""
Write-Header "Deploiement Euralis termine"
Write-Host ""
Write-Host "  Frontends :" -ForegroundColor Cyan
Write-Host ("  http://" + $script:NAS_HOST + ":8081  -> Gaveurs")       -ForegroundColor White
Write-Host ("  http://" + $script:NAS_HOST + ":8082  -> Euralis")       -ForegroundColor White
Write-Host ("  http://" + $script:NAS_HOST + ":8083  -> Traceabilite")  -ForegroundColor White
Write-Host ("  http://" + $script:NAS_HOST + ":8084  -> SQAL")          -ForegroundColor White
Write-Host ("  http://" + $script:NAS_HOST + ":8085  -> Control Panel") -ForegroundColor White
Write-Host ""
Write-Host "  Monitoring :" -ForegroundColor Cyan
Write-Host ("  http://" + $script:NAS_HOST + ":5556  -> Flower (Celery)") -ForegroundColor White
Write-Host ""
Write-Host "  Commandes utiles :" -ForegroundColor DarkGray
Write-Host "  .\scripts\nas_deploy_euralis.ps1 -Status   -> etat containers" -ForegroundColor DarkGray
Write-Host "  .\scripts\nas_deploy_euralis.ps1 -Logs     -> logs recents"    -ForegroundColor DarkGray
Write-Host "  .\scripts\nas_deploy_euralis.ps1 -Down     -> arreter"         -ForegroundColor DarkGray
Write-Host "  .\scripts\nas_deploy_euralis.ps1 -Rebuild  -> rebuild complet" -ForegroundColor DarkGray
Write-Host ""
Write-OK "Deploiement Euralis NAS termine"
