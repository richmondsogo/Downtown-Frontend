<#
.SYNOPSIS
    Quick environment health check for Downtown monorepo.

.DESCRIPTION
    Reports the state of local development tooling and requirements
    for the Downtown project (Node.js, pnpm, Turborepo, Git).
#>

Write-Host ""
Write-Host "Environment Health Check" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

$issueList = @()

# ---- Helper -----------------------------------------------------------------

function Test-CliTool {
    param(
        [string]$Name,
        [string]$Cmd,
        [string]$VersionFlag = "--version"
    )
    try {
        $out = & $Cmd $VersionFlag 2>&1 | Select-Object -First 1
        if ($LASTEXITCODE -eq 0 -or $out) {
            $ver = ($out -replace "`r`n|`n", "").Trim()
            if ($ver.Length -gt 50) { $ver = $ver.Substring(0, 50) + "..." }
            Write-Host ("  OK  {0,-12} {1}" -f $Name, $ver) -ForegroundColor Green
            return $true
        }
    } catch {}
    Write-Host ("  !!  {0,-12} [not found]" -f $Name) -ForegroundColor Red
    return $false
}

# ---- Environment capabilities -----------------------------------------------

Write-Host "Environment capabilities:" -ForegroundColor White
$hasGit    = Test-CliTool "git"    "git"
$hasNode   = Test-CliTool "node"   "node"
$hasNpm    = Test-CliTool "npm"    "npm"
$hasPnpm   = Test-CliTool "pnpm"   "pnpm"

Write-Host ""

# ---- Git repository state ---------------------------------------------------

Write-Host "Repository:" -ForegroundColor White

if ($hasGit) {
    $branch    = git branch --show-current 2>&1
    $gitShort  = git status --short 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK  Git repository on branch: $branch" -ForegroundColor Green

        $dirty = ($gitShort | Where-Object { $_ -ne "" }).Count
        if ($dirty -eq 0) {
            Write-Host "  OK  Working tree clean" -ForegroundColor Green
        } else {
            Write-Host "  WW  $dirty uncommitted change(s)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  WW  Not a git repository" -ForegroundColor Yellow
        $issueList += "Directory is not a git repository."
    }
} else {
    Write-Host "  !!  Git not available -- cannot inspect repository state." -ForegroundColor Red
    $issueList += "Git is not installed."
}

Write-Host ""

# ---- Project requirements ---------------------------------------------------

Write-Host "Project requirements (Downtown stack):" -ForegroundColor White

if (-not $hasNode) {
    Write-Host "  !!  Node.js is required (>= 22.0.0)" -ForegroundColor Red
    $issueList += "Node.js is not installed."
} else {
    try {
        $nodeVerStr = (node -v).Trim().TrimStart('v')
        $nodeMajor = [int]($nodeVerStr.Split('.')[0])
        if ($nodeMajor -lt 22) {
            Write-Host ("  !!  Node.js version {0} is below required >= 22.0.0 (LTS)" -f $nodeVerStr) -ForegroundColor Red
            $issueList += "Node.js version must be >= 22.0.0."
        } else {
            Write-Host ("  OK  Node.js version {0} (meets >= 22 LTS)" -f $nodeVerStr) -ForegroundColor Green
        }
    } catch {
        Write-Host "  OK  Node.js present" -ForegroundColor Green
    }
}

if (-not $hasPnpm) {
    Write-Host "  !!  pnpm is required (>= 9.0.0). Run: npm install -g pnpm" -ForegroundColor Red
    $issueList += "pnpm is not installed."
} else {
    try {
        $pnpmVerStr = (pnpm -v).Trim()
        $pnpmMajor = [int]($pnpmVerStr.Split('.')[0])
        if ($pnpmMajor -lt 9) {
            Write-Host ("  !!  pnpm version {0} is below required >= 9.0.0" -f $pnpmVerStr) -ForegroundColor Red
            $issueList += "pnpm version must be >= 9.0.0."
        } else {
            Write-Host ("  OK  pnpm version {0} (meets >= 9)" -f $pnpmVerStr) -ForegroundColor Green
        }
    } catch {
        Write-Host "  OK  pnpm present" -ForegroundColor Green
    }
}

$reqFiles = @("package.json", "pnpm-workspace.yaml", "turbo.json", ".nvmrc")
foreach ($f in $reqFiles) {
    if (Test-Path $f) {
        Write-Host ("  OK  {0} present" -f $f) -ForegroundColor Green
    } else {
        Write-Host ("  !!  {0} missing" -f $f) -ForegroundColor Red
        $issueList += "Missing monorepo file: $f"
    }
}

Write-Host ""

# ---- Summary ----------------------------------------------------------------

if ($issueList.Count -eq 0) {
    Write-Host "Status: OK - Environment is ready for Downtown development." -ForegroundColor Green
} else {
    Write-Host "Status: Issues found" -ForegroundColor Red
    Write-Host ""
    foreach ($issue in $issueList) {
        Write-Host "  - $issue" -ForegroundColor Red
    }
}

Write-Host ""
