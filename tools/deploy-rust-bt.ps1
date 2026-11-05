param(
  [Parameter(Mandatory = $true)][string]$Binary,
  [Parameter(Mandatory = $true)][string]$Tag,
  [int]$ChunkSizeMB = 8
)
$ErrorActionPreference = 'Stop'
Set-Location 'D:\tigshop\java-b2b2b-pro-v5.8.57'
. 'C:\Users\Public\bt2api.ps1'

function Post($route, $body) { Invoke-BTPost $route $body }
function UploadPart($path, $name, $size) {
  $a = New-BTAuth
  $out = & curl.exe -k -s -m 300 -X POST `
    -F "request_time=$($a.request_time)" `
    -F "request_token=$($a.request_token)" `
    -F "zunfile=@$path;filename=$name" `
    -F 'path=/www/backup/' `
    -F "fname=$name" `
    -F "f_size=$size" `
    -F 'f_start=0' `
    "$script:base/files?action=UploadFile"
  $text = ($out -join "`n")
  if ($text -notmatch '"status"\s*:\s*true') { throw "upload failed: $name $text" }
}

$hash = (Get-FileHash -LiteralPath $Binary -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $Binary).Length
$prefix = "${Tag}_split_"
Write-Host "binary=$Binary size=$size sha256=$hash prefix=$prefix"

# 清理同名旧分片
$dir = Post 'files' @{ action = 'GetDir'; path = '/www/backup' } | ConvertFrom-Json
foreach ($file in @($dir.FILES)) {
  $name = ($file -split ';')[0]
  if ($name -like "$prefix*") { Post 'files' @{ action = 'DeleteFile'; path = "/www/backup/$name" } | Out-Null }
}

$fs = [IO.File]::OpenRead($Binary)
$buffer = New-Object byte[] ($ChunkSizeMB * 1MB)
$index = 0
try {
  while (($read = $fs.Read($buffer, 0, $buffer.Length)) -gt 0) {
    $partPath = Join-Path $env:TEMP ('{0}{1:D2}' -f $prefix, $index)
    $part = New-Object byte[] $read
    [Array]::Copy($buffer, $part, $read)
    [IO.File]::WriteAllBytes($partPath, $part)
    $name = Split-Path $partPath -Leaf
    UploadPart $partPath $name $read
    Write-Host "uploaded $name ($read bytes)"
    Remove-Item $partPath -Force
    $index++
  }
} finally { $fs.Dispose() }

$manifestPath = '/www/backup/merge.json'
$manifest = @{ split_file_path = "/www/backup/$prefix" } | ConvertTo-Json -Compress
# BT 的 SaveFileBody 要求文件已存在，先 CreateFile 再写入
Post 'files' @{ action = 'CreateFile'; path = $manifestPath } | Out-Null
Post 'files' @{ action = 'SaveFileBody'; path = $manifestPath; data = $manifest; encoding = 'utf-8' } | Out-Null
$merge = Post 'files' @{ action = 'merge_split_file'; json_file_path = $manifestPath }
Write-Host "merge: $merge"
if ($merge -notmatch '"status"\s*:\s*true') { throw 'merge failed' }
$merged = "/www/backup/$Tag.zip"
Write-Host "merged=$merged"

# 备份并切换
# 注意：Linux 不允许覆盖正在执行的二进制（ETXTBSY），因此采用「停服 → 删除 → 复制」。
$backup = "/www/wwwroot/tigshop-rust/tigshop.pre$Tag.bak"
Post 'files' @{ action = 'CopyFile'; sfile = '/www/wwwroot/tigshop-rust/tigshop'; dfile = $backup } | Out-Null
Post 'files' @{ action = 'CopyFile'; sfile = $merged; dfile = '/www/wwwroot/tigshop-rust/tigshop.new' } | Out-Null
Post 'files' @{ action = 'SetFileAccess'; filename = '/www/wwwroot/tigshop-rust/tigshop.new'; access = '755'; user = 'root'; all = 'False' } | Out-Null

Write-Host 'stopping tigshop'
$stop = Post 'system' @{ action = 'ServiceAdmin'; name = 'tigshop'; type = 'stop' }
Write-Host "stop: $stop"
Start-Sleep -Seconds 3

Write-Host 'replacing binary (delete + copy)'
$del = Post 'files' @{ action = 'DeleteFile'; path = '/www/wwwroot/tigshop-rust/tigshop' }
Write-Host "delete: $del"
Start-Sleep -Seconds 1
$copyNew = Post 'files' @{ action = 'CopyFile'; sfile = '/www/wwwroot/tigshop-rust/tigshop.new'; dfile = '/www/wwwroot/tigshop-rust/tigshop' }
Write-Host "copy: $copyNew"
if ($copyNew -notmatch '"status"\s*:\s*true') { throw 'copy new binary failed' }
Post 'files' @{ action = 'SetFileAccess'; filename = '/www/wwwroot/tigshop-rust/tigshop'; access = '755'; user = 'root'; all = 'False' } | Out-Null

$start = Post 'system' @{ action = 'ServiceAdmin'; name = 'tigshop'; type = 'start' }
Write-Host "start: $start"
# BT 的 stop/start 有时不会真正换掉进程，补一次 restart 确保加载新二进制
Start-Sleep -Seconds 2
$restart = Post 'system' @{ action = 'ServiceAdmin'; name = 'tigshop'; type = 'restart' }
Write-Host "restart: $restart"
Start-Sleep -Seconds 6

try {
  $health = Invoke-WebRequest -Uri 'https://battery.recy.cc/adminapi/health' -UseBasicParsing -TimeoutSec 15
  Write-Host "health=$($health.StatusCode) body=$($health.Content)"
} catch {
  Write-Host "health failed: $($_.Exception.Message)"
  Post 'system' @{ action = 'ServiceAdmin'; name = 'tigshop'; type = 'stop' } | Out-Null
  Start-Sleep -Seconds 2
  Post 'files' @{ action = 'DeleteFile'; path = '/www/wwwroot/tigshop-rust/tigshop' } | Out-Null
  Post 'files' @{ action = 'CopyFile'; sfile = $backup; dfile = '/www/wwwroot/tigshop-rust/tigshop' } | Out-Null
  Post 'files' @{ action = 'SetFileAccess'; filename = '/www/wwwroot/tigshop-rust/tigshop'; access = '755'; user = 'root'; all = 'False' } | Out-Null
  Post 'system' @{ action = 'ServiceAdmin'; name = 'tigshop'; type = 'start' } | Out-Null
  throw 'health failed, rolled back'
}

Write-Host "deployed tag=$Tag sha256=$hash backup=$backup"
