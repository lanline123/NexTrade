param(
  [string]$Scope = 'rust',
  [string]$Message = 'chore: sync local rust sources to main',
  [switch]$DryRun,
  [switch]$Prune
)
# 以本地工作区为准，把指定目录同步到 GitHub main：
#   - 本地有、远端无 → 新增
#   - 两边内容不同   → 覆盖
#   - 远端有、本地无 → 仅当 -Prune 时删除
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$cred = ("protocol=https`nhost=github.com`n`n" | git credential fill) -split "`n"
$token = (($cred | Where-Object { $_ -like 'password=*' }) -replace '^password=', '').Trim()
if (-not $token) { throw '未能获取 GitHub token' }
$h = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json'; 'User-Agent' = 'dsh' }
$api = 'https://api.github.com/repos/lanline123/NexTrade'

$ref = Invoke-RestMethod -Uri "$api/git/ref/heads/main" -Headers $h
$base = $ref.object.sha
$baseCommit = Invoke-RestMethod -Uri "$api/git/commits/$base" -Headers $h
$treeSha = $baseCommit.tree.sha
$tree = Invoke-RestMethod -Uri "$api/git/trees/$treeSha`?recursive=1" -Headers $h
$remote = @{}
foreach ($node in $tree.tree) { if ($node.type -eq 'blob') { $remote[$node.path] = $node.sha } }
Write-Host "remote blobs: $($remote.Count)"

function Get-GitBlobSha([string]$path) {
  $bytes = [IO.File]::ReadAllBytes($path)
  $header = [Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)`0")
  $all = New-Object byte[] ($header.Length + $bytes.Length)
  [Array]::Copy($header, 0, $all, 0, $header.Length)
  [Array]::Copy($bytes, 0, $all, $header.Length, $bytes.Length)
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try { return (($sha1.ComputeHash($all)) | ForEach-Object { $_.ToString('x2') }) -join '' }
  finally { $sha1.Dispose() }
}

$exclude = '(^|/)(node_modules|\.next|dist|target|\.git|\.turbo|coverage|__pycache__|uploads|scratch)(/|$)|(\.log|\.apk|\.pyc|\.tsbuildinfo|\.png|tmp_alters.*\.sql)$'
$localRoot = Join-Path (Get-Location) $Scope
$localFiles = Get-ChildItem -LiteralPath $localRoot -Recurse -File -Force |
  Where-Object { $_.FullName.Substring((Get-Location).Path.Length + 1).Replace('\', '/') -notmatch $exclude }

$changed = New-Object System.Collections.Generic.List[object]
$added = New-Object System.Collections.Generic.List[object]
$seen = New-Object 'System.Collections.Generic.HashSet[string]'

foreach ($file in $localFiles) {
  $rel = $file.FullName.Substring((Get-Location).Path.Length + 1).Replace('\', '/')
  $seen.Add($rel) | Out-Null
  if (-not $remote.ContainsKey($rel)) { $added.Add($file); continue }
  $blobSha = Get-GitBlobSha $file.FullName
  if ($remote[$rel] -ne $blobSha) { $changed.Add($file) }
}

$deleted = New-Object System.Collections.Generic.List[string]
foreach ($path in $remote.Keys) {
  if (-not $path.StartsWith("$Scope/")) { continue }
  if ($path -match $exclude) { continue }
  if (-not $seen.Contains($path)) { $deleted.Add($path) }
}

Write-Host "added=$($added.Count) changed=$($changed.Count) remoteOnly=$($deleted.Count)"
$added | Select-Object -First 8 | ForEach-Object { "  + $($_.FullName.Substring((Get-Location).Path.Length + 1))" }
$changed | Select-Object -First 8 | ForEach-Object { "  ~ $($_.FullName.Substring((Get-Location).Path.Length + 1))" }
$deleted | Select-Object -First 8 | ForEach-Object { "  - $_" }

if ($DryRun) { Write-Host 'dry run, nothing pushed'; exit 0 }
if ($added.Count + $changed.Count + ($(if ($Prune) { $deleted.Count } else { 0 })) -eq 0) { Write-Host 'nothing to sync'; exit 0 }

$uploadFiles = [object[]]$added.ToArray() + [object[]]$changed.ToArray()
Write-Host "to upload: $($uploadFiles.Count)"

$entries = New-Object System.Collections.Generic.List[object]
$rootPath = [string](Get-Location).Path
$uploadItems = @()
foreach ($f in $uploadFiles) {
  $uploadItems += [pscustomobject]@{
    full = [string]$f.FullName
    rel  = [string]$f.FullName.Substring($rootPath.Length + 1).Replace('\\', '/')
  }
}
$env:SYNC_TOKEN = [string]$token
$env:SYNC_API = [string]$api
$results = $uploadItems | ForEach-Object -Parallel {
  $item = $_
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($item.full))
  $hdrs = @{ Authorization = "Bearer $($env:SYNC_TOKEN)"; Accept = 'application/vnd.github+json'; 'User-Agent' = 'dsh' }
  $body = @{ content = $b64; encoding = 'base64' } | ConvertTo-Json -Compress
  $blob = Invoke-RestMethod -Method Post -Uri "$($env:SYNC_API)/git/blobs" -Headers $hdrs -Body $body -ContentType 'application/json'
  [pscustomobject]@{ path = $item.rel; sha = $blob.sha }
} -ThrottleLimit 8
foreach ($r in $results) { $entries.Add(@{ path = $r.path; mode = '100644'; type = 'blob'; sha = $r.sha }) | Out-Null }
Write-Host "uploaded all: $($entries.Count)"

$treeBody = @{ base_tree = $treeSha; tree = $entries.ToArray() } | ConvertTo-Json -Depth 8 -Compress
$newTree = Invoke-RestMethod -Method Post -Uri "$api/git/trees" -Headers $h -Body $treeBody -ContentType 'application/json'
$commitBody = @{ message = $Message; tree = $newTree.sha; parents = @($base) } | ConvertTo-Json -Depth 5 -Compress
$commit = Invoke-RestMethod -Method Post -Uri "$api/git/commits" -Headers $h -Body $commitBody -ContentType 'application/json'
Invoke-RestMethod -Method Patch -Uri "$api/git/refs/heads/main" -Headers $h `
  -Body (@{ sha = $commit.sha; force = $false } | ConvertTo-Json -Compress) -ContentType 'application/json' | Out-Null
Write-Host "commit=$($commit.sha)"
