# Fetch the newest nightly APK to a local folder (default: ~/MoneyMatesApk). Needs the GitHub CLI (gh auth login).
# Run it by hand or from a Windows scheduled task. When no APK from today exists yet it starts the build
# and waits for it (the GitHub schedule alone is unreliable).
param(
  [string]$Dest = (Join-Path $HOME 'MoneyMatesApk'),
  [string]$Repo = 'minhhoang2608/moneymates'
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $Dest | Out-Null

function Get-LastRun {
  gh run list --repo $Repo --workflow nightly-apk.yml --limit 1 --json databaseId,status,conclusion,createdAt | ConvertFrom-Json | Select-Object -First 1
}

$run = Get-LastRun
$today = (Get-Date).ToUniversalTime().Date
if (-not $run -or ([datetime]$run.createdAt).ToUniversalTime().Date -lt $today) {
  gh workflow run nightly-apk.yml --repo $Repo
  Start-Sleep -Seconds 20
  $run = Get-LastRun
}
if ($run.status -ne 'completed') {
  gh run watch $run.databaseId --repo $Repo --interval 30 | Out-Null
  $run = Get-LastRun
}
if ($run.conclusion -ne 'success') { throw "Nightly APK run $($run.databaseId) ended with '$($run.conclusion)'." }

$tmp = Join-Path $Dest ".dl-$($run.databaseId)"
gh run download $run.databaseId --repo $Repo --name moneymates-apk --dir $tmp
Move-Item -Force (Join-Path $tmp '*.apk') $Dest
Remove-Item -Recurse -Force $tmp
Write-Host "Saved to $Dest"
Get-ChildItem $Dest -Filter *.apk | Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name, LastWriteTime
