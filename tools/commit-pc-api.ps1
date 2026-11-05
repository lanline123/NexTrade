param(
  [string]$Message = 'feat(pc-semi): parallel source-parity migration (header, modules, pages)'
)
$ErrorActionPreference = 'Stop'
Set-Location 'D:\tigshop\java-b2b2b-pro-v5.8.57'

$cred = ("protocol=https`nhost=github.com`n`n" | git credential fill) -split "`n"
$token = ($cred | Where-Object { $_ -like 'password=*' }) -replace '^password=', ''
$h = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json'; 'User-Agent' = 'dsh' }
$api = 'https://api.github.com/repos/lanline123/NexTrade'
$ref = Invoke-RestMethod -Uri "$api/git/ref/heads/main" -Headers $h
$base = $ref.object.sha
$baseCommit = Invoke-RestMethod -Uri "$api/git/commits/$base" -Headers $h

$lines = git status --porcelain=v1 --untracked-files=all -- rust/web/pc-semi
$entries = New-Object System.Collections.Generic.List[object]
$n = 0
foreach ($line in $lines) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $status = $line.Substring(0, 2)
  $path = $line.Substring(3).Trim()
  if ($path.StartsWith('"') -and $path.EndsWith('"')) { $path = $path.Substring(1, $path.Length - 2) }
  if ($path -match '(^|/)(\.next|node_modules)(/|$)') { continue }

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
Write-Host "files=$($entries.Count)"

$treeBody = @{ base_tree = $baseCommit.tree.sha; tree = $entries.ToArray() } | ConvertTo-Json -Depth 8 -Compress
$tree = Invoke-RestMethod -Method Post -Uri "$api/git/trees" -Headers $h -Body $treeBody -ContentType 'application/json'
$commitBody = @{ message = $Message; tree = $tree.sha; parents = @($base) } | ConvertTo-Json -Depth 5 -Compress
$commit = Invoke-RestMethod -Method Post -Uri "$api/git/commits" -Headers $h -Body $commitBody -ContentType 'application/json'
Invoke-RestMethod -Method Patch -Uri "$api/git/refs/heads/main" -Headers $h -Body (@{ sha = $commit.sha; force = $false } | ConvertTo-Json -Compress) -ContentType 'application/json' | Out-Null
"commit=$($commit.sha)"
