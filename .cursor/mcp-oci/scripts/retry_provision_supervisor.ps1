# Supervisa retry_provision_loop.py y lo relanza si muere antes de max-hours.
param(
    [double]$MaxHours = 24,
    [ValidateSet("arm", "micro")]
    [string]$Profile = "arm",
    [string]$LogDir = "$PSScriptRoot\..\..\..\tmp\oci-provision"
)

$ErrorActionPreference = "Stop"
$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$Python = Join-Path $Repo ".cursor\.venv-mcp\Scripts\python.exe"
$Script = Join-Path $Repo ".cursor\mcp-oci\scripts\retry_provision_loop.py"
$Log = Join-Path $LogDir "retry-provision-$Profile.log"
$SupervisorLog = Join-Path $LogDir "supervisor-$Profile.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$env:KIDEPIK_REPO = $Repo

$deadline = (Get-Date).AddHours($MaxHours)
$run = 0

while ((Get-Date) -lt $deadline) {
    $run++
    $stamp = Get-Date -Format o
    Add-Content -Path $SupervisorLog -Value "`n--- supervisor run $run $stamp (hasta $deadline) ---"

    $args = @(
        "-u", $Script,
        "--profile", $Profile,
        "--max-hours", $MaxHours,
        "--capacity-interval", "45",
        "--rate-limit-interval", "120",
        "--max-backoff", "600"
    )

    & $Python @args 2>&1 | Tee-Object -FilePath $Log -Append
    $exit = $LASTEXITCODE

    if ($exit -eq 0) {
        Add-Content -Path $SupervisorLog -Value "[$stamp] PROVISION_OK (exit 0)"
        exit 0
    }

    if ((Get-Date) -ge $deadline) {
        Add-Content -Path $SupervisorLog -Value "[$stamp] deadline alcanzado"
        exit 1
    }

    Add-Content -Path $SupervisorLog -Value "[$stamp] proceso terminó con exit $exit, relanzando en 30s…"
    Start-Sleep -Seconds 30
}

exit 1
