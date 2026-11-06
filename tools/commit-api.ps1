param(
  [Parameter(Mandatory = $true)][string[]]$Paths,
  [Parameter(Mandatory = $true)][string]$Message
)
# 通用 GitHub API 提交脚本：只提交指定路径（文件或目录）下的改动
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$cred = ("protocol=https`nhost=github.com`n`n" | git credential fill) -split "`n"
$token = (($cred | Where-Object { $_ -like 'password=*' }) -replace '^password=', '').Trim()
if (-not $token) { throw '未能获取 GitHub token（git credential fill 失败）' }
$h = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json'; 'User-Agent' = 'dsh'; 'X-GitHub-Api-Version' = '2022-11-28' }
$api = 'https://api.github.com/repos/lanline123/NexTrade'
$ref = Invoke-RestMethod -Uri "$api/git/ref/heads/main" -Headers $h
$base = $ref.object.sha
$baseCommit = Invoke-RestMethod -Uri "$api/git/commits/$base" -Headers $h

# 收集指定路径下的改动文件
$all = git status --porcelain=v1 --untracked-files=all
$entries = New-Object System.Collections.Generic.List[object]
$n = 0
foreach ($line in $all) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $status = $line.Substring(0, 2)
  $path = $line.Substring(3).Trim()
  if ($path.StartsWith('"') -and $path.EndsWith('"')) { $path = $path.Substring(1, $path.Length - 2) }
  if ($path -match '(^|/)(\.next|node_modules|target)(/|$)') { continue }

  $matched = $false
  foreach ($p in $Paths) {
    $norm = $p.Replace('\', '/').TrimEnd('/')
    if ($path -eq $norm -or $path.StartsWith("$norm/")) { $matched = $true; break }
  }
  if (-not $matched) { continue }

  if ($status -match 'D') {
    $entries.Add(@{ path = $path; mode = '100644'; type = 'blob'; sha = $null })
    Write-Host "DELETE $path"
    continue
  }

  $full = Resolve-Path -LiteralPath $path
  $bytes = [IO.File]::ReadAllBytes($full)
  $b64 = [Convert]::ToBase64String($bytes)
  $blob = Invoke-RestMethod -Method Post -Uri "$api/git/blobs" -Headers $h `
    -Body (@{ content = $b64; encoding = 'base64' } | ConvertTo-Json -Compress) `
    -ContentType 'application/json'
  $entries.Add(@{ path = $path; mode = '100644'; type = 'blob'; sha = $blob.sha })
  $n++
  if ($n % 20 -eq 0) { Write-Host "uploaded $n ..." }
}

if ($entries.Count -eq 0) { Write-Host '没有匹配的改动文件'; exit 0 }
Write-Host "files=$($entries.Count)"

$treeBody = @{ base_tree = $baseCommit.tree.sha; tree = $entries.ToArray() } | ConvertTo-Json -Depth 8 -Compress
$tree = Invoke-RestMethod -Method Post -Uri "$api/git/trees" -Headers $h -Body $treeBody -ContentType 'application/json'
$commitBody = @{ message = $Message; tree = $tree.sha; parents = @($base) } | ConvertTo-Json -Depth 5 -Compress
$commit = Invoke-RestMethod -Method Post -Uri "$api/git/commits" -Headers $h -Body $commitBody -ContentType 'application/json'
Invoke-RestMethod -Method Patch -Uri "$api/git/refs/heads/main" -Headers $h -Body (@{ sha = $commit.sha; force = $false } | ConvertTo-Json -Compress) -ContentType 'application/json' | Out-Null
"commit=$($commit.sha)"
