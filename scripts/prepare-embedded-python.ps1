# EvrakPlus Ders Dagitim Multi Plus - Gomulu Python 3.12 Runtime Hazirlama Betigi
# Kullanici bilgisayarinda Python kurulu degilken OR-Tools, SCIP ve HiGHS'in calismasi icin
# Python 3.12 embeddable paketini resources/runtime/python altina kurar.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$pyDir = Join-Path $root "resources\runtime\python"
$toolsDir = Join-Path $root ".tools"
New-Item -ItemType Directory -Force -Path $pyDir, $toolsDir | Out-Null

$embedUrl = "https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip"
$embedZip = Join-Path $toolsDir "python-3.12.10-embed-amd64.zip"

if (-not (Test-Path (Join-Path $pyDir "python.exe"))) {
  Write-Host "Downloading Python 3.12.10 embeddable (amd64)..."
  curl.exe -sSL -o $embedZip $embedUrl
  tar.exe -xf $embedZip -C $pyDir
  Remove-Item -Force $embedZip

  # site-packages desteğini aç (python312._pth)
  $pthFile = Join-Path $pyDir "python312._pth"
  if (Test-Path $pthFile) {
    $content = Get-Content $pthFile -Raw
    $content = $content -replace "#import site", "import site"
    Set-Content -Path $pthFile -Value $content -Encoding ASCII
  }

  # pip kur
  $getPip = Join-Path $toolsDir "get-pip.py"
  curl.exe -sSL -o $getPip "https://bootstrap.pypa.io/get-pip.py"
  & (Join-Path $pyDir "python.exe") $getPip --no-warn-script-location
  Remove-Item -Force $getPip
}

Write-Host "Installing ortools, pyscipopt<6, highspy into embedded Python..."
& (Join-Path $pyDir "python.exe") -m pip install --no-warn-script-location ortools "pyscipopt<6" highspy
& (Join-Path $pyDir "python.exe") -c "import ortools, pyscipopt, highspy; print('Embedded Python OK:', ortools.__version__, pyscipopt.__version__, highspy.Highs().version())"
