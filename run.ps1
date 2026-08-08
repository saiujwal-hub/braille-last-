# Starts both Braille Bridge servers (website + API) in detached windows.
#   .\run.ps1            start everything
#   .\run.ps1 -Stop      stop the running servers
#   .\run.ps1 -ApiOnly   only the FastAPI server
param(
    [switch]$Stop,
    [switch]$ApiOnly
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$py = Join-Path $root "server\.venv\Scripts\python.exe"
$node = "C:\Program Files\nodejs\node.exe"
$vite = Join-Path $root "node_modules\vite\bin\vite.js"

$apiPid = 0
$webPid = 0

function Get-Pids {
    $script:apiPid = (Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
        Where-Object { $_.CommandLine -match 'uvicorn app.main:app' } | Select-Object -First 1).ProcessId
    $script:webPid = (Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object { $_.CommandLine -match 'vite' } | Select-Object -First 1).ProcessId
}

if ($Stop) {
    Get-Pids
    foreach ($p in @($script:apiPid, $script:webPid)) {
        if ($p) { Stop-Process -Id $p -Force; Write-Host "Stopped pid $p" }
    }
    exit 0
}

if (-not (Test-Path $py)) { Write-Error "Venv missing. Run: py -3.13 -m venv server\.venv && server\.venv\Scripts\python.exe -m pip install -r server\requirements.txt"; exit 1 }
if (-not (Test-Path $vite)) { Write-Error "node_modules missing. Run: npm install"; exit 1 }

if (-not $ApiOnly) {
    $web = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
        CommandLine      = "`"$node`" `"$vite`" --host 127.0.0.1 --port 5173"
        CurrentDirectory = $root
    }
    Write-Host "Website  -> http://localhost:5173/   (pid $($web.ProcessId))"
}

$api = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine      = "`"$py`" -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
    CurrentDirectory = Join-Path $root "server"
}
Write-Host "API      -> http://localhost:8000/     (pid $($api.ProcessId))"

Start-Sleep -Seconds 6
Write-Host "Health: " -NoNewline
try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/health -TimeoutSec 5).StatusCode } catch { "unreachable" }
