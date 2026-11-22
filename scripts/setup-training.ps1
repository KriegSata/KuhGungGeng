$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}

Invoke-Checked 'uv' @('--cache-dir', '.cache/uv', 'python', 'install', '3.12.10', '--install-dir', '.python')
$python = Join-Path $PWD '.python/cpython-3.12.10-windows-x86_64-none/python.exe'
if (-not (Test-Path '.venv-training/Scripts/python.exe')) {
    Invoke-Checked 'uv' @('--cache-dir', '.cache/uv', 'venv', '.venv-training', '--python', $python)
}
$trainingPython = Join-Path $PWD '.venv-training/Scripts/python.exe'
Invoke-Checked 'uv' @('--cache-dir', '.cache/uv', 'pip', 'install', '--python', $trainingPython, 'torch==2.7.1', 'torchvision==0.22.1', '--index-url', 'https://download.pytorch.org/whl/cu128')
Invoke-Checked 'uv' @('--cache-dir', '.cache/uv', 'pip', 'install', '--python', $trainingPython, '-e', '.[training]')
Invoke-Checked $trainingPython @('scripts/check_training.py')
if ($LASTEXITCODE -eq 0) {
    $freeze = & uv --cache-dir .cache/uv pip freeze --python $trainingPython
    if ($LASTEXITCODE -ne 0) { throw 'Could not freeze training dependencies' }
    $freeze | Set-Content -Encoding ascii requirements-training.lock
}
