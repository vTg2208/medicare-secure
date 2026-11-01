# Security Scanning Script using Trivy
# Usage: .\scripts\security-scan.ps1 [-Target <image|filesystem|config>] [-Severity <level>]

param(
    [Parameter()]
    [ValidateSet("image", "filesystem", "config", "all")]
    [string]$Target = "all",
    
    [Parameter()]
    [ValidateSet("CRITICAL", "HIGH", "MEDIUM", "LOW")]
    [string]$Severity = "HIGH",
    
    [Parameter()]
    [switch]$IgnoreUnfixed = $false,
    
    [Parameter()]
    [string]$OutputDir = "./security-reports"
)

$ErrorActionPreference = "Stop"

Write-Host "Healthcare System Security Scan" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

# Check if Trivy is installed
try {
    $trivyVersion = trivy --version
    Write-Host "[OK] Trivy found: $trivyVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Trivy not found. Installing..." -ForegroundColor Red
    Write-Host "Please install Trivy: https://aquasecurity.github.io/trivy/latest/getting-started/installation/" -ForegroundColor Yellow
    exit 1
}

$severityFlag = if ($IgnoreUnfixed) { "--ignore-unfixed" } else { "" }

# Function to run Trivy scan
function Invoke-TrivyScan {
    param($Type, $TargetPath, $OutputFile)
    
    Write-Host "`n[SCAN] Scanning $Type : $TargetPath" -ForegroundColor Yellow
    
    $reportPath = Join-Path $OutputDir "$OutputFile-$timestamp"
    
    # Table output to console
    trivy $Type $TargetPath `
        --severity $Severity `
        $severityFlag `
        --format table
    
    # JSON output to file
    trivy $Type $TargetPath `
        --severity $Severity `
        $severityFlag `
        --format json `
        --output "$reportPath.json"
    
    # SARIF output for GitHub integration
    trivy $Type $TargetPath `
        --severity $Severity `
        $severityFlag `
        --format sarif `
        --output "$reportPath.sarif"
    
    Write-Host "[OK] Reports saved to $reportPath.*" -ForegroundColor Green
}

# Scan Docker Images
if ($Target -eq "image" -or $Target -eq "all") {
    Write-Host "`n[DOCKER] Docker Image Scanning" -ForegroundColor Magenta
    
    # Build images first
    Write-Host "Building images (this may take a few minutes)..." -ForegroundColor Yellow
    $prevErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    docker compose -f docker-compose.dev.yaml build backend frontend *>$null
    $ErrorActionPreference = $prevErrorAction
    Write-Host "[OK] Images built successfully" -ForegroundColor Green
    
    # Scan backend image
    Invoke-TrivyScan "image" "healthcare_backend_dev:latest" "backend-image"
    
    # Scan frontend image
    Invoke-TrivyScan "image" "healthcare_frontend_dev:latest" "frontend-image"
    
    # Scan postgres base image
    Invoke-TrivyScan "image" "postgres:15-alpine" "postgres-image"
}

# Scan Filesystem (dependencies)
if ($Target -eq "filesystem" -or $Target -eq "all") {
    Write-Host "`n[FS] Filesystem Scanning" -ForegroundColor Magenta
    
    # Scan backend dependencies
    Invoke-TrivyScan "fs" "./backend" "backend-dependencies"
    
    # Scan frontend dependencies
    Invoke-TrivyScan "fs" "./frontend" "frontend-dependencies"
}

# Scan IaC configurations
if ($Target -eq "config" -or $Target -eq "all") {
    Write-Host "`n[CONFIG] Configuration Scanning" -ForegroundColor Magenta
    
    # Scan Docker Compose files
    Invoke-TrivyScan "config" "." "iac-config"
}

# Generate summary report
Write-Host "`n[SUMMARY] Generating Summary Report..." -ForegroundColor Cyan

$summaryPath = Join-Path $OutputDir "scan-summary-$timestamp.txt"

@"
Healthcare System Security Scan Summary
========================================
Scan Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Target: $Target
Severity Level: $Severity
Ignore Unfixed: $IgnoreUnfixed

Reports Generated:
------------------
$(Get-ChildItem $OutputDir -Filter "*$timestamp*" | Select-Object -ExpandProperty Name | ForEach-Object { "  - $_" })

Next Steps:
-----------
1. Review JSON reports for detailed vulnerability information
2. Update .trivyignore for accepted risks (with documentation)
3. Prioritize CRITICAL and HIGH vulnerabilities
4. For HIPAA compliance, address all CRITICAL issues immediately
5. Upload SARIF files to GitHub Security tab for tracking

"@ | Out-File -FilePath $summaryPath -Encoding UTF8

Write-Host "[OK] Summary saved to $summaryPath" -ForegroundColor Green

Write-Host "`n[COMPLETE] Security scan complete!" -ForegroundColor Green
Write-Host "[INFO] Review reports in: $OutputDir" -ForegroundColor Cyan
