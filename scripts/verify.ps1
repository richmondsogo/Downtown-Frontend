<#
.SYNOPSIS
    Project verification entry point for Downtown monorepo.

.DESCRIPTION
    Runs verification checks for repository hygiene, toolchains,
    monorepo configuration, and Turborepo setup.
#>

Write-Host ""
Write-Host "Project Verification (Downtown)" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$passed  = 0
$failed  = 0
$skipped = 0

# ---- Helper -----------------------------------------------------------------

function Run-Check {
    param(
        [string]$Label,
        [scriptblock]$Block,
        [bool]$Skip = $false
    )

    if ($Skip) {
        Write-Host ("  --  {0}  [skipped]" -f $Label) -ForegroundColor DarkGray
        $script:skipped++
        return
    }

    Write-Host ("  ..  {0}" -f $Label) -ForegroundColor DarkGray
    try {
        $out = & $Block 2>&1
        if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq $null) {
            Write-Host ("  OK  {0}" -f $Label) -ForegroundColor Green
            $script:passed++
        } else {
            Write-Host ("  !!  {0}  [exit code $LASTEXITCODE]" -f $Label) -ForegroundColor Red
            if ($out) {
                Write-Host "      $out" -ForegroundColor DarkRed
            }
            $script:failed++
        }
    } catch {
        Write-Host ("  !!  {0}  [error: {1}]" -f $Label, $_) -ForegroundColor Red
        $script:failed++
    }
}

# ---- Git state & secrets ----------------------------------------------------

Write-Host "Repository state:" -ForegroundColor White

Run-Check "Git available" {
    git --version | Out-Null
}

Run-Check "No obviously tracked secrets" {
    $patterns = @("*.pem", "*.key", ".env", "*.secret")
    $found    = @()
    foreach ($p in $patterns) {
        $matches = git ls-files $p 2>&1
        if ($matches -and $LASTEXITCODE -eq 0) { $found += $matches }
    }
    if ($found.Count -gt 0) {
        Write-Host "  Possible secrets tracked by git: $($found -join ', ')" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# ---- Monorepo Configuration -------------------------------------------------

Write-Host "Monorepo manifests:" -ForegroundColor White

Run-Check "package.json exists and is valid" {
    if (-not (Test-Path "package.json")) { exit 1 }
    $null = Get-Content "package.json" -Raw | ConvertFrom-Json
}

Run-Check "pnpm-workspace.yaml exists" {
    if (-not (Test-Path "pnpm-workspace.yaml")) { exit 1 }
}

Run-Check "turbo.json exists and is valid" {
    if (-not (Test-Path "turbo.json")) { exit 1 }
    $null = Get-Content "turbo.json" -Raw | ConvertFrom-Json
}

Run-Check ".nvmrc exists" {
    if (-not (Test-Path ".nvmrc")) { exit 1 }
}

Write-Host ""

# ---- Toolchain & Package Manager --------------------------------------------

Write-Host "Toolchain & dependencies:" -ForegroundColor White

Run-Check "Node.js >= 22 (LTS)" {
    $ver = (node -v).Trim().TrimStart('v')
    $major = [int]($ver.Split('.')[0])
    if ($major -lt 22) { exit 1 }
}

Run-Check "pnpm installed" {
    pnpm -v | Out-Null
}

Run-Check "Turborepo operational" {
    pnpm exec turbo --version | Out-Null
}

Write-Host ""

# ---- Monorepo Typecheck & Build ---------------------------------------------

Write-Host "Workspace verification:" -ForegroundColor White

Run-Check "TypeScript typecheck" {
    pnpm run check-types
}

Run-Check "Automated tests" {
    pnpm run test
}

Run-Check "Monorepo build" {
    pnpm run build
}

Write-Host ""

# ---- Summary ----------------------------------------------------------------

$total = $passed + $failed + $skipped

$color = if ($failed -gt 0) { "Red" } elseif ($skipped -gt 0) { "Yellow" } else { "Green" }
Write-Host ("Results: {0} passed, {1} failed, {2} skipped  (of {3} checks)" `
    -f $passed, $failed, $skipped, $total) -ForegroundColor $color

Write-Host ""

if ($failed -gt 0) {
    exit 1
}
