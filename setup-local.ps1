Param(
    [switch]$Down,
    [switch]$Reset
)

$ErrorActionPreference = "Stop"

function Write-Info($Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success($Message) {
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-WarningMsg($Message) {
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-ErrorMsg($Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function New-RandomHex([int]$LengthBytes) {
    $bytes = [byte[]]::new($LengthBytes)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
}

function New-RandomBase64([int]$LengthBytes) {
    $bytes = [byte[]]::new($LengthBytes)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return [Convert]::ToBase64String($bytes)
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeFile = Join-Path $ScriptDir "docker-compose.local.yml"
$EnvFile = Join-Path $ScriptDir ".env"

function Assert-DockerAvailable {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-ErrorMsg "Docker not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
        exit 1
    }

    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Docker is not running. Start Docker Desktop and try again."
        exit 1
    }

    $composeVersion = docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Docker Compose plugin not available. Update Docker Desktop and try again."
        exit 1
    }
}

function Invoke-ComposeDown {
    docker compose -f $ComposeFile down 2>&1 | Write-Host
}

function Invoke-ComposeReset {
    docker compose -f $ComposeFile down -v 2>&1 | Write-Host
    $configFile = Join-Path $ScriptDir "config.local.yaml"
    Remove-Item -Force $EnvFile -ErrorAction SilentlyContinue
    Remove-Item -Force $configFile -ErrorAction SilentlyContinue
}

function Ensure-EnvFile {
    if (Test-Path $EnvFile) {
        while ($true) {
            $ans = Read-Host ".env already exists. Overwrite? [y/N]"
            if ([string]::IsNullOrWhiteSpace($ans) -or $ans -match '^[Nn]$') {
                Write-Info "Keeping existing .env"
                return
            }
            if ($ans -match '^[Yy]$') {
                break
            }
            Write-WarningMsg "Please answer y or n."
        }
    }

    $jwt = New-RandomBase64 32
    $mgmt = New-RandomHex 32
    $pg = New-RandomHex 32

    $content = @(
        "JWT_SECRET=$jwt",
        "MANAGEMENT_API_KEY=$mgmt",
        "POSTGRES_PASSWORD=$pg"
    ) -join "`n"

    [System.IO.File]::WriteAllText($EnvFile, $content, [System.Text.UTF8Encoding]::new($false))
    Write-Success "Created .env in project root"
}

function Ensure-ConfigYaml {
    $configFile = Join-Path $ScriptDir "config.local.yaml"
    if (Test-Path $configFile) {
        return
    }

    $mgmtKey = ""
    if (Test-Path $EnvFile) {
        foreach ($line in Get-Content $EnvFile) {
            if ($line -match "^MANAGEMENT_API_KEY=(.+)$") {
                $mgmtKey = $Matches[1]
            }
        }
    }

    $apiKey = "sk-local-$(New-RandomHex 16)"

    $yaml = @"
host: ""
port: 8317
auth-dir: "/root/.cli-proxy-api"
remote-management:
  allow-remote: true
  secret-key: "$mgmtKey"
api-keys:
  - "$apiKey"
request-retry: 3
quota-exceeded:
  switch-project: true
  switch-preview-model: true
routing:
  strategy: "round-robin"
"@

    [System.IO.File]::WriteAllText($configFile, $yaml, [System.Text.UTF8Encoding]::new($false))
    Write-Success "Created config.local.yaml (API key: $apiKey)"
}

function Wait-ForHealth {
    $timeoutSeconds = 300
    $deadline = (Get-Date).AddSeconds($timeoutSeconds)
    $containers = @(
        "cliproxyapi-postgres",
        "cliproxyapi",
        "cliproxyapi-docker-proxy",
        "cliproxyapi-dashboard"
    )

    while ($true) {
        if ((Get-Date) -gt $deadline) {
            Write-ErrorMsg "Timed out waiting for services to become healthy."
            Write-Info "Run: docker compose -f docker-compose.local.yml ps"
            Write-Info "Logs: docker compose -f docker-compose.local.yml logs -f"
            exit 1
        }

        $allHealthy = $true
        foreach ($c in $containers) {
            $status = docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $c 2>&1
            if ($LASTEXITCODE -ne 0) {
                $status = ""
            }

            if ($status -ne "healthy") {
                $allHealthy = $false
                break
            }
        }

        if ($allHealthy) {
            return
        }

        Start-Sleep -Seconds 3
    }
}

if (-not (Test-Path $ComposeFile)) {
    Write-ErrorMsg "Missing docker-compose.local.yml in project root."
    exit 1
}

Assert-DockerAvailable

if ($Reset) {
    Write-WarningMsg "Resetting local stack (removes volumes and deletes .env)..."
    Invoke-ComposeReset
    Write-Success "Reset complete"
    exit 0
}

if ($Down) {
    Write-Info "Stopping local stack..."
    Invoke-ComposeDown
    Write-Success "Stopped"
    exit 0
}

Ensure-EnvFile
Ensure-ConfigYaml

Write-Info "Starting local stack..."
docker compose -f $ComposeFile up -d 2>&1 | Write-Host

Write-Info "Waiting for services to become healthy..."
Wait-ForHealth

Write-Success "CLIProxyAPI Dashboard is running!"
Write-Host "  Dashboard: http://localhost:3000"
Write-Host "  API:       http://localhost:11451"
Write-Host ""
Write-Host "  Stop:  .\setup-local.ps1 -Down"
Write-Host "  Reset: .\setup-local.ps1 -Reset"
