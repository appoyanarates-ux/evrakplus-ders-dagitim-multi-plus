$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Push-Location $Root

try {
    Write-Host "[1/4] Python OR-Tools cozum motoru derleniyor..."
    powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\build_solver_windows.ps1")

    Write-Host "[2/4] Cevrimdisi arayuz varliklari (Tailwind CSS, Lucide, XLSX) hazirlaniyor..."
    npm.cmd run prepare:renderer

    Write-Host "[3/4] Otomatik testler calistiriliyor..."
    & (Join-Path $Root ".venv\Scripts\pytest.exe") -v (Join-Path $Root "tests")

    Write-Host "[4/4] Windows kurulum paketi (Setup.exe) olusturuluyor..."
    npm.cmd run build:win

    $ReleaseDir = Join-Path $Root "release"
    $Setups = Get-ChildItem -Path $ReleaseDir -Filter "*Setup*.exe" -ErrorAction SilentlyContinue
    if (-not $Setups) {
        throw "Windows kurulum dosyasi (Setup.exe) uretilemedi!"
    }
    Write-Host "Windows kurulum paketi hazir:"
    $Setups | ForEach-Object { Write-Host "  - $($_.FullName) ($([math]::Round($_.Length / 1MB, 1)) MB)" }
} finally {
    Pop-Location
}
