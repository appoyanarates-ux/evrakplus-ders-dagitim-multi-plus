$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$VenvPyInstaller = Join-Path $Root ".venv\Scripts\pyinstaller.exe"
$SolverScript = Join-Path $Root "solver\solver_ortools.py"
$SolverDir = Join-Path $Root "solver"
$DistDir = Join-Path $Root "dist"
$BuildDir = Join-Path $Root "build_pyinstaller"

if (-not (Test-Path $VenvPyInstaller)) {
    throw "PyInstaller bulunamadi: $VenvPyInstaller. Once .venv kurulumunu yapin."
}

Write-Host "[1/3] Eski PyInstaller ciktilari temizleniyor..."
if (Test-Path (Join-Path $DistDir "solver_ortools")) {
    Remove-Item -Recurse -Force (Join-Path $DistDir "solver_ortools")
}
if (Test-Path $BuildDir) {
    Remove-Item -Recurse -Force $BuildDir
}

Write-Host "[2/3] PyInstaller (onedir) ile Google OR-Tools CP-SAT derleniyor..."
& $VenvPyInstaller `
    --noconfirm `
    --clean `
    --onedir `
    --console `
    --name solver_ortools `
    --distpath $DistDir `
    --workpath $BuildDir `
    --specpath $BuildDir `
    --paths $SolverDir `
    --collect-all ortools `
    --hidden-import validate_model `
    --hidden-import validate_result `
    $SolverScript

$ExePath = Join-Path $DistDir "solver_ortools\solver_ortools.exe"
if (-not (Test-Path $ExePath)) {
    throw "PyInstaller ciktisi uretilemedi: $ExePath"
}

Write-Host "[3/3] Derlenen OR-Tools EXE dogrulaniyor (--info)..."
$InfoOut = & $ExePath --info
Write-Host "Cozucu Bilgisi: $InfoOut"
if ($InfoOut -notmatch "google_ortools_cp_sat") {
    throw "Derlenen EXE beklenen google_ortools_cp_sat motor bilgisini dondurmedi."
}

Write-Host "Basarili: $ExePath"
