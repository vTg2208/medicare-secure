# Prepare local development without deleting data or rewriting existing environment files.
param([switch]$SkipDocker, [switch]$WithTools, [switch]$FreshDb)
$ErrorActionPreference = 'Stop'
if ($FreshDb) { throw '-FreshDb is retired. Bootstrap never deletes data; select a new database explicitly.' }
$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $RootDir
foreach ($command in @('node', 'npm')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Required command missing: $command" }
}
$major = [int]((node --version).TrimStart('v').Split('.')[0])
if ($major -ne 24) { throw 'Use Node.js 24 (see .nvmrc).' }
if (-not $SkipDocker) {
    docker info --format '{{.ServerVersion}}' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop before bootstrap.' }
}
foreach ($directory in @('backend', 'frontend')) {
    Push-Location -LiteralPath (Join-Path $RootDir $directory)
    try {
        npm ci --loglevel warn
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed for $directory" }
    } finally { Pop-Location }
}
node scripts/setup-local.js
if ($LASTEXITCODE -ne 0) { throw 'Local environment setup failed.' }
node scripts/validate-env.js --env dev
if ($LASTEXITCODE -ne 0) { throw 'Environment validation failed; review the existing local configuration.' }
node scripts/validate-env.js --env dev --file .env
if ($LASTEXITCODE -ne 0) { throw 'Compose environment validation failed; review the existing root configuration.' }
if ($SkipDocker) {
    Write-Host 'Configuration and dependencies ready. Start PostgreSQL and Mailpit locally, then run backend npm run db:migrate and npm run dev; frontend npm start.'
} else {
    $composeArguments = @('compose', '-f', 'docker-compose.dev.yaml')
    if ($WithTools) { $composeArguments += @('--profile', 'tools') }
    $composeArguments += @('up', '--build', '--wait', '--wait-timeout', '600')
    docker @composeArguments
    if ($LASTEXITCODE -ne 0) { throw 'Local stack did not become ready. Inspect docker compose -f docker-compose.dev.yaml logs.' }
    Write-Host 'Frontend: http://localhost:3000 | OTP inbox: http://localhost:8025 | API readiness: http://localhost:5000/readyz'
}
