$ErrorActionPreference = "Stop"
$env:TEMP = "D:\_build_cache\temp"
$env:TMP = "D:\_build_cache\temp"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$pyi = Join-Path $root ".venv\Scripts\pyinstaller.exe"
$distOut = Join-Path $root "resources\engines\ortools"
$workDir = "D:\_build_cache\pyi_work"

if (Test-Path $distOut) { Remove-Item $distOut -Recurse -Force }
if (Test-Path $workDir) { Remove-Item $workDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $workDir | Out-Null

& $pyi `
  --noconfirm `
  --onedir `
  --console `
  --name multi_solver_engine `
  --distpath (Join-Path $root "resources\engines") `
  --workpath $workDir `
  --paths (Join-Path $root "solver") `
  --paths $root `
  --collect-all ortools `
  --collect-all highspy `
  --hidden-import solver_ortools `
  --hidden-import validate_model `
  --hidden-import validate_result `
  --hidden-import quality_scorer `
  --hidden-import pool_rooms `
  --hidden-import engines.scip.solver_scip `
  --hidden-import engines.highs.solver_highs `
  --hidden-import engines.minizinc.solver_minizinc `
  --hidden-import engines.java_bridge `
  (Join-Path $root "solver\multi_solver_engine.py")

if ($LASTEXITCODE -ne 0) { throw "PyInstaller build failed!" }

Move-Item (Join-Path $root "resources\engines\multi_solver_engine") $distOut -Force
Write-Host "Built bundled multi_solver_engine.exe -> $distOut"

# Quick offline health check of bundled EXE!
$env:EVRAKPLUS_JAVA_EXE = Join-Path $root "resources\runtime\java\bin\java.exe"
$env:EVRAKPLUS_TIMEFOLD_JAR = Join-Path $root "resources\engines\timefold\timefold-solver-runner.jar"
$env:EVRAKPLUS_CHOCO_JAR = Join-Path $root "resources\engines\choco\choco-solver-runner.jar"
$env:EVRAKPLUS_MINIZINC_EXE = Join-Path $root "resources\engines\minizinc\minizinc.exe"
$env:EVRAKPLUS_MZN_MODEL = Join-Path $root "resources\models\timetable.mzn"
& (Join-Path $distOut "multi_solver_engine.exe") --health-all
