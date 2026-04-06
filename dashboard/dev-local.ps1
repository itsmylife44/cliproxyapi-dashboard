# Local Windows Docker-based development script
# Replaces SSH tunnel approach with local Docker containers
# Usage: .\dev-local.ps1 [-Down] [-Reset]

Param(
    [switch]$Down,
    [switch]$Reset,
    [switch]$ShowHelp
)

# Note: We do NOT use $ErrorActionPreference = "Stop" globally because
# native commands (docker, npx, npm) write progress to stderr, which
# PowerShell would treat as terminating errors. Instead we check
# $LASTEXITCODE after each native command.

# Script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeFile = Join-Path $ScriptDir "docker-compose.dev.yml"
$EnvFile = Join-Path $ScriptDir ".env.development"
$EnvLocalFile = Join-Path $ScriptDir ".env.local"

# Container names
$PostgresContainer = "cliproxyapi-dev-postgres"
$ApiContainer = "cliproxyapi-dev-api"
$KnownBootstrapDriftMigration = "20260329_add_custom_provider_encrypted_key"

function Write-Info($Message) {
    Write-Host "  i  $Message" -ForegroundColor Cyan
}

function Write-OK($Message) {
    Write-Host "  +  $Message" -ForegroundColor Green
}

function Write-Warn($Message) {
    Write-Host "  !  $Message" -ForegroundColor Yellow
}

function Write-Err($Message) {
    Write-Host "  x  $Message" -ForegroundColor Red
}

function Get-MigrationDirs {
    Get-ChildItem -Path (Join-Path $ScriptDir "prisma/migrations") -Directory |
        Sort-Object Name |
        ForEach-Object { $_.Name }
}

function Resolve-AllMigrationsApplied {
    foreach ($migration in Get-MigrationDirs) {
        npx prisma migrate resolve --applied $migration 2>&1 | Out-Null
    }
}

function Repair-KnownLocalMigrationDrift {
    $failedMigration = docker exec $PostgresContainer psql -U cliproxyapi -d cliproxyapi -tAc "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY started_at DESC LIMIT 1" 2>$null
    $failedMigration = ($failedMigration | Out-String).Trim()

    if ($failedMigration -ne $KnownBootstrapDriftMigration) {
        return
    }

    $hasColumn = docker exec $PostgresContainer psql -U cliproxyapi -d cliproxyapi -tAc "SELECT 1 FROM information_schema.columns WHERE table_name = 'custom_providers' AND column_name = 'apiKeyEncrypted' LIMIT 1" 2>$null
    $hasColumn = ($hasColumn | Out-String).Trim()

    if ($hasColumn -eq "1") {
        Write-Warn "Recovering local migration state for $failedMigration"
        npx prisma migrate resolve --applied $failedMigration 2>&1 | Out-Null
    }
}

function Assert-DockerAvailable {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Err "Docker not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
        exit 1
    }

    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Docker daemon is not running."
        Write-Host ""
        Write-Host "  1. Open Docker Desktop"
        Write-Host "  2. Wait for it to start (whale icon in system tray)"
        Write-Host "  3. Run this script again"
        exit 1
    }
    Write-OK "Docker daemon is running"
}

function Start-Containers {
    Write-Info "Starting Docker containers..."

    # Check if containers are already running
    $running = docker ps --format '{{.Names}}' 2>&1
    if ($running -match [regex]::Escape($PostgresContainer) -and $running -match [regex]::Escape($ApiContainer)) {
        Write-Warn "Containers already running, reusing existing containers"
        return
    }

    docker compose -f $ComposeFile up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to start containers"
        exit 1
    }
    Write-OK "Containers started"
}

function Wait-ForPostgres {
    Write-Info "Waiting for PostgreSQL to be ready..."

    $maxAttempts = 30
    for ($i = 0; $i -lt $maxAttempts; $i++) {
        $null = docker exec $PostgresContainer pg_isready -U cliproxyapi -d cliproxyapi 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-OK "PostgreSQL is ready"
            return
        }
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
    }
    Write-Host ""
    Write-Err "PostgreSQL failed to become ready after $maxAttempts seconds"
    exit 1
}

function Wait-ForCliProxyApi {
    Write-Info "Waiting for CLIProxyAPI to be ready..."

    $maxAttempts = 60
    for ($i = 0; $i -lt $maxAttempts; $i++) {
        $null = curl.exe -s -f -o NUL http://127.0.0.1:28317/ 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-OK "CLIProxyAPI is ready"
            return
        }
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
    }
    Write-Host ""
    Write-Err "CLIProxyAPI failed to become ready after $maxAttempts seconds"
    exit 1
}

function Invoke-Migrations {
    Write-Info "Running Prisma migrations..."

    $env:DATABASE_URL = "postgresql://cliproxyapi:devpassword@localhost:5433/cliproxyapi"

    # Bootstrap: push full schema if fresh database
    $null = docker exec $PostgresContainer psql -U cliproxyapi -d cliproxyapi -tAc "SELECT 1 FROM _prisma_migrations LIMIT 1" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Info "Fresh database detected, bootstrapping schema via prisma db push..."
        npx prisma db push --accept-data-loss
        Resolve-AllMigrationsApplied
    }

    Repair-KnownLocalMigrationDrift

    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to run migrations"
        exit 1
    }
    Write-OK "Migrations applied"
}

function Invoke-PrismaGenerate {
    Write-Info "Generating Prisma client..."
    npx prisma generate
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to generate Prisma client"
        exit 1
    }
    Write-OK "Prisma client generated"
}

function Write-EnvLocal {
    Write-Info "Writing .env.local..."
    Copy-Item -Path $EnvFile -Destination $EnvLocalFile -Force
    Write-OK ".env.local updated"
}

function Stop-Containers {
    Write-Info "Stopping containers..."
    docker compose -f $ComposeFile down 2>&1 | Out-Null
    Write-OK "Containers stopped"
}

function Reset-Containers {
    Write-Info "Resetting development environment (this will delete all data)..."
    docker compose -f $ComposeFile down -v 2>&1 | Out-Null
    Write-OK "Containers and volumes removed"
}

function Start-NextDev {
    Write-Info "Starting Next.js development server..."
    Write-Host ""
    Write-Host "  ============================================================" -ForegroundColor Green
    Write-Host "    Dashboard:  http://localhost:3000" -ForegroundColor Green
    Write-Host "    PostgreSQL: localhost:5433" -ForegroundColor Cyan
    Write-Host "    API:        http://localhost:28317" -ForegroundColor Cyan
    Write-Host "  ============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host ""

    npm run dev
}

# --- Main ---

if ($ShowHelp) {
    Write-Host "Usage: .\dev-local.ps1 [-Down] [-Reset] [-ShowHelp]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  (none)      Start development environment"
    Write-Host "  -Down       Stop and remove containers"
    Write-Host "  -Reset      Stop containers and remove volumes (fresh start)"
    Write-Host "  -ShowHelp   Show this help message"
    exit 0
}

if ($Reset) {
    Assert-DockerAvailable
    Reset-Containers
    exit 0
}

if ($Down) {
    Assert-DockerAvailable
    Stop-Containers
    exit 0
}

Push-Location $ScriptDir
try {
    Assert-DockerAvailable
    Start-Containers
    Wait-ForPostgres
    Wait-ForCliProxyApi
    Invoke-Migrations
    Invoke-PrismaGenerate
    Write-EnvLocal
    Start-NextDev
} finally {
    Pop-Location
}
