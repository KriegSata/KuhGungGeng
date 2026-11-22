$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed. See the output above." }
}

# Never reuse an unknown server: it may be running an older checkout without a model.
foreach ($port in @(8000, 5173)) {
    $probe = [System.Net.Sockets.TcpClient]::new()
    try {
        $connected = $probe.ConnectAsync('127.0.0.1', $port).Wait(500)
        if ($connected -and $probe.Connected) {
            throw "Port $port is already in use. Stop the existing app, then run this command again."
        }
    } catch [System.AggregateException] {
        # Connection refused means the port is available.
    } finally { $probe.Dispose() }
}

$checkpoint = Join-Path $PWD 'runs/classify/crabs-yolov8n-2/weights/best.pt'
if (-not (Test-Path -LiteralPath $checkpoint)) {
    throw 'Bundled best.pt is missing. Run git pull origin main. No retraining is required.'
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $localNode = Join-Path $PWD '.cache/node/node-v24.11.1-win-x64'
    if (Test-Path "$localNode/node.exe") { $env:PATH = "$localNode;$env:PATH" }
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'Install Node.js 24 or newer, then run this command again.'
}
if (-not (Test-Path '.venv/Scripts/python.exe')) {
    Invoke-Checked 'python' @('-m', 'venv', '.venv')
}
$appPython = (Resolve-Path '.venv/Scripts/python.exe').Path
Invoke-Checked $appPython @('-m', 'pip', 'install', '-c', 'requirements-dev.lock', '-e', '.[test,training]')
Invoke-Checked 'npm.cmd' @('ci')
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }

# Process environment takes precedence over old .env values; this command is for local use.
$names = @('APP_ENV', 'EXPERIMENTAL_CLASSIFIER', 'USE_BUNDLED_CLASSIFIER', 'MODEL_MANIFEST')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$backend = $null
try {
    $env:APP_ENV = 'development'
    $env:EXPERIMENTAL_CLASSIFIER = $checkpoint
    $env:USE_BUNDLED_CLASSIFIER = 'true'
    $env:MODEL_MANIFEST = ''
    New-Item -ItemType Directory -Force '.cache' | Out-Null
    $backend = Start-Process -FilePath $appPython -ArgumentList @('-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8000') -WindowStyle Hidden -PassThru -RedirectStandardOutput '.cache/app-backend.log' -RedirectStandardError '.cache/app-backend-errors.log'
    $loaded = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($backend.HasExited) { throw 'Backend startup failed. See .cache/app-backend-errors.log.' }
        try {
            $model = Invoke-RestMethod 'http://127.0.0.1:8000/api/model' -TimeoutSec 2
            if (-not $model.available) { throw 'Backend has no model loaded.' }
            $loaded = $true
            break
        } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $loaded) { throw 'The trained model did not become ready. See .cache/app-backend-errors.log.' }
    Write-Host "Model loaded: $($model.version). No training required."
    Write-Host 'Open http://127.0.0.1:5173. Press Ctrl+C to stop the app.'
    Invoke-Checked 'npm.cmd' @('run', 'dev', '--', '--port', '5173', '--strictPort')
} finally {
    if ($backend -and -not $backend.HasExited) { Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue }
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
