param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$logDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logPath = Join-Path $logDir "daily_import_$stamp.log"
$importScript = Join-Path $ProjectRoot "scripts\import_exports.py"

$argsList = @($importScript)
if ($Force) {
  $argsList += "--force"
}

python @argsList *>&1 | Tee-Object -FilePath $logPath
exit $LASTEXITCODE

