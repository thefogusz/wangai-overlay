param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WorkerPython = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
function Check-Exit { if ($LASTEXITCODE -ne 0) { throw 'Local STT setup failed' } }
if (-not (Test-Path -LiteralPath $WorkerPython)) {
    & $Python -m venv (Join-Path $ProjectRoot '.venv')
    Check-Exit
}
& $WorkerPython -m pip install -r (Join-Path $ProjectRoot 'worker\requirements-local-stt.txt')
Check-Exit
& $WorkerPython -m pip install --extra-index-url https://download.pytorch.org/whl/cpu -r (Join-Path $ProjectRoot 'worker\requirements.txt')
Check-Exit
& $WorkerPython (Join-Path $PSScriptRoot 'download-local-stt.py')
Check-Exit
Write-Host 'Local STT ready. Run scripts/start-local-stt.ps1 with your AI gateway URL.'
