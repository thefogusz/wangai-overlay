$ErrorActionPreference = "Stop"
function Check-Exit { if ($LASTEXITCODE -ne 0) { throw "Worker setup failed" } }
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VirtualEnvironment = Join-Path $ProjectRoot ".venv"

$PythonExecutable = Join-Path $VirtualEnvironment "Scripts\python.exe"
if (Get-Command uv -ErrorAction SilentlyContinue) {
    if (-not (Test-Path $PythonExecutable)) {
        uv venv --python 3.12 $VirtualEnvironment
        Check-Exit
    }
    uv pip install --python $PythonExecutable -r (Join-Path $ProjectRoot "worker\requirements.txt")
    Check-Exit
    uv pip install --python $PythonExecutable --no-deps -r (Join-Path $ProjectRoot "worker\requirements-model.txt")
    Check-Exit
} else {
    if (-not (Test-Path $PythonExecutable)) {
        py -3.12 -m venv $VirtualEnvironment
        Check-Exit
    }
    & $PythonExecutable -m pip install --upgrade pip
    Check-Exit
    & $PythonExecutable -m pip install -r (Join-Path $ProjectRoot "worker\requirements.txt")
    Check-Exit
    & $PythonExecutable -m pip install --no-deps -r (Join-Path $ProjectRoot "worker\requirements-model.txt")
    Check-Exit
}

Write-Host "Python Silero VAD worker is ready. Speech transcription runs through Groq Whisper."
