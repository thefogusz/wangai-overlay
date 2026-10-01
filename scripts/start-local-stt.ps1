param([switch]$Build, [ValidateSet('base','small','qwen')][string]$Preset = 'base')
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerRoot = Join-Path $ProjectRoot 'server'
$GatewayExe = Join-Path $ServerRoot 'target\debug\wangai-server.exe'
$PreviewRoot = Join-Path $ProjectRoot 'output\local-stt-preview'
$DesktopExe = Join-Path $PreviewRoot 'WANGAI-Whisper.exe'
$WorkerPython = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
function Check-Exit { if ($LASTEXITCODE -ne 0) { throw 'Local preview build failed' } }
if (-not (Test-Path -LiteralPath (Join-Path $ServerRoot '.env'))) {
    Copy-Item -LiteralPath (Join-Path $ServerRoot 'local-stt.env.example') -Destination (Join-Path $ServerRoot '.env')
    throw "Add your Grok key to TRANSLATION_API_KEY in $ServerRoot\.env, then run again."
}
$KeyLine = Get-Content -LiteralPath (Join-Path $ServerRoot '.env') | Where-Object { $_ -match '^TRANSLATION_API_KEY=.+$' }
if (-not $KeyLine) { throw "Add your Grok key to $ServerRoot\.env first." }
if (-not (Test-Path -LiteralPath $WorkerPython)) { throw 'Run scripts/setup-local-stt.ps1 first.' }
if ($Preset -ne 'qwen') {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'output\whisper-build\Release\wangai-whisper.exe'))) {
        throw 'Run scripts/setup-whisper.ps1 first.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "output\models\ggml-$Preset-q5_1.bin"))) {
        throw "Run scripts/setup-whisper.ps1 -Model $Preset first."
    }
}
Push-Location $ProjectRoot
try {
    $env:GAMELINGO_PYTHON = $WorkerPython
    $env:WANGAI_LOCAL_STT_PRESET = $Preset
    $env:WANGAI_API_BASE_URL = 'http://127.0.0.1:18080'
    if ($Build -or -not (Test-Path -LiteralPath $DesktopExe) -or -not (Test-Path -LiteralPath $GatewayExe)) {
        cargo build --manifest-path server/Cargo.toml
        Check-Exit
        & (Join-Path $ProjectRoot 'node_modules\.bin\tauri.cmd') build --debug --no-bundle --features local-stt --config src-tauri/tauri.local-stt.json
        Check-Exit
        New-Item -ItemType Directory -Path $PreviewRoot -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $ProjectRoot 'src-tauri\target\debug\gamelingo.exe') -Destination $DesktopExe
    }
    # Do not reuse an unrelated listener or leave a gateway running after exit.
    if (Get-NetTCPConnection -LocalPort 18080 -State Listen -ErrorAction SilentlyContinue) {
        throw 'Port 18080 is already in use. Close the previous local preview first.'
    }
    New-Item -ItemType Directory -Path $PreviewRoot -Force | Out-Null
    $GatewayErrorLog = Join-Path $PreviewRoot 'gateway-error.log'
    $GatewayProcess = Start-Process -FilePath $GatewayExe -WorkingDirectory $ServerRoot -WindowStyle Hidden -RedirectStandardError $GatewayErrorLog -PassThru
    try {
        $Ready = $false
        for ($Attempt = 0; $Attempt -lt 40; $Attempt++) {
            if ($GatewayProcess.HasExited) {
                $GatewayError = (Get-Content -LiteralPath $GatewayErrorLog -ErrorAction SilentlyContinue) -join [Environment]::NewLine
                throw "Gateway stopped. $GatewayError (Log: $GatewayErrorLog)"
            }
            try {
                $Status = Invoke-RestMethod 'http://127.0.0.1:18080/v1/status' -TimeoutSec 1
                if ($Status.translationModel) { $Ready = $true; break }
            } catch { Start-Sleep -Milliseconds 250 }
        }
        if (-not $Ready) { throw 'Gateway did not start in time.' }
        $DesktopProcess = Start-Process -FilePath $DesktopExe -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru
        $DesktopProcess.WaitForExit()
    } finally {
        if (-not $GatewayProcess.HasExited) { Stop-Process -Id $GatewayProcess.Id }
    }
} finally { Pop-Location }
