<#
.SYNOPSIS
  Guarded Production Database Migration & Table Inspection Runner.

.DESCRIPTION
  Safely loads DATABASE_URL from the gitignored .env.prod.secret file,
  extracts and prints the target database hostname, and strictly enforces
  that CONFIRM_PROD_HOST equals the target host before applying migrations
  or querying database tables.

.PARAMETER ConfirmHost
  Explicit target host confirmation parameter. If omitted, the script reads
  $env:CONFIRM_PROD_HOST.

.PARAMETER Action
  Action to execute: 'migrate' (default) or 'list-tables'.

.EXAMPLE
  $env:CONFIRM_PROD_HOST = "ep-noisy-fog-bafy7lrh-pooler.c-8.eu-central-1.aws.neon.tech"
  .\scripts\run-prod-migrations.ps1
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$ConfirmHost = "",

  [Parameter(Mandatory = $false)]
  [ValidateSet("migrate", "list-tables")]
  [string]$Action = "migrate"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path "$PSScriptRoot/..").Path
$prodSecretFile = Join-Path $repoRoot ".env.prod.secret"

if (-not (Test-Path $prodSecretFile)) {
  Write-Error "Production credentials file '.env.prod.secret' not found at repository root. Please ensure it is present."
  exit 1
}

# Read file lines without printing or logging
$secretLines = Get-Content -Path $prodSecretFile
$dbUrlLine = $secretLines | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1

if (-not $dbUrlLine) {
  Write-Error "DATABASE_URL not found in .env.prod.secret."
  exit 1
}

# Extract connection string without logging
$connStr = ($dbUrlLine -replace '^\s*DATABASE_URL\s*=\s*["'']?', '') -replace '["'']?\s*$', ''

# Extract target host
if ($connStr -match 'postgres(?:ql)?:\/\/[^@]+@([^:\/?#]+)') {
  $targetHost = $Matches[1]
} else {
  Write-Error "Could not parse host from DATABASE_URL in .env.prod.secret."
  exit 1
}

Write-Host "Target Database Host: $targetHost"

# Confirmation check
$confirm = if ($ConfirmHost) { $ConfirmHost } else { $env:CONFIRM_PROD_HOST }

if (-not $confirm) {
  Write-Error "Safety Abort: CONFIRM_PROD_HOST environment variable (or -ConfirmHost parameter) is required.`nSet `$env:CONFIRM_PROD_HOST = '$targetHost' or run:`n.\scripts\run-prod-migrations.ps1 -ConfirmHost '$targetHost'"
  exit 1
}

if ($confirm -ne $targetHost) {
  Write-Error "Safety Abort: Provided confirmation host ('$confirm') does NOT match target host ('$targetHost'). Aborting."
  exit 1
}

Write-Host "Host match confirmed. Executing production action: $Action..."

# Set environment variable only for the execution
$env:DATABASE_URL = $connStr
try {
  & pnpm --filter api exec tsx src/db/migrate-prod.ts $Action
  if ($LASTEXITCODE -ne 0) {
    throw "Production runner failed with exit code $LASTEXITCODE"
  }
} finally {
  # Clean up memory env immediately
  Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
}
