param(
  [Parameter(Mandatory = $true)][string]$Binary,
  [Parameter(Mandatory = $true)][string]$Tag,
  [int]$ChunkSizeMB = 8,
  [string]$ExpectedSha256 = '',
  [switch]$ConfirmVerified,
  [switch]$SwitchOnly,
  # 面板合并后的文件路径默认按 <Tag>.zip 推断；若面板实际输出不带扩展名，显式传这个参数
  [string]$MergedPath = ''
)
$ErrorActionPreference = 'Stop'
# 仓库根目录：脚本位于 <repo>\tools\，不再写死 D:\tigshop\java-b2b2b-pro-v5.8.57
Set-Location (Split-Path $PSScriptRoot -Parent)
. 'C:\Users\Public\bt2api.ps1'

# 2026-11 起生产命名统一为 nextrade：目录 /www/wwwroot/nextrade、二进制 nextrade、systemd nextrade
$RemoteRoot = '/www/wwwroot/nextrade'
$BinName = 'nextrade'
$ServiceName = 'nextrade'
$RemoteBackupDir = '/www/backup'

function Post($route, $body) { Invoke-BTPost $route $body }
function UploadPart($path, $name, $size) {
  $a = New-BTAuth
  $out = & curl.exe -k -s -m 300 `
    -X POST `
    -F "request_time=$($a.request_time)" `
    -F "request_token=$($a.request_token)" `
    -F "zunfile=@$path;filename=$name" `
    -F "path=$RemoteBackupDir/" `
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
$remoteZip = if ($MergedPath) { $MergedPath } else { "$RemoteBackupDir/$Tag.zip" }

if ($ExpectedSha256 -and $hash -ne $ExpectedSha256.ToLowerInvariant()) {
  throw "本地文件 sha256 与 -ExpectedSha256 不一致`n  本地: $hash`n  期望: $($ExpectedSha256.ToLowerInvariant())"
}

if ($SwitchOnly) {
  if (-not $ConfirmVerified) {
    throw '-SwitchOnly 必须同时带 -ConfirmVerified（表示已在服务器核对过 sha256）'
  }
  Write-Host "skip upload, switch with $remoteZip"
}
else {
  Write-Host "binary=$Binary size=$size sha256=$hash prefix=$prefix"

  # 清理同名旧分片
  $dir = Post 'files' @{ action = 'GetDir'; path = $RemoteBackupDir } | ConvertFrom-Json
  foreach ($file in @($dir.FILES)) {
    $name = ($file -split ';')[0]
    if ($name -like "$prefix*") { Post 'files' @{ action = 'DeleteFile'; path = "$RemoteBackupDir/$name" } | Out-Null }
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
  }
  finally { $fs.Dispose() }

  $manifestPath = "$RemoteBackupDir/merge.json"
  $manifest = @{ split_file_path = "$RemoteBackupDir/$prefix" } | ConvertTo-Json -Compress
  # BT 的 SaveFileBody 要求文件已存在，先 CreateFile 再写入
  Post 'files' @{ action = 'CreateFile'; path = $manifestPath } | Out-Null
  Post 'files' @{ action = 'SaveFileBody'; path = $manifestPath; data = $manifest; encoding = 'utf-8' } | Out-Null
  $merge = Post 'files' @{ action = 'merge_split_file'; json_file_path = $manifestPath }
  Write-Host "merge: $merge"
  if ($merge -notmatch '"status"\s*:\s*true') { throw 'merge failed' }
  Write-Host "merged=$remoteZip"

  if (-not $ConfirmVerified) {
    Write-Host ''
    Write-Host '已上传并合并，尚未切换线上二进制。' -ForegroundColor Yellow
    Write-Host "请在服务器执行：sha256sum $remoteZip"
    Write-Host "与期望值比对：$hash"
    Write-Host "一致后重跑：.\tools\deploy-rust-bt.ps1 -Binary `"$Binary`" -Tag $Tag -SwitchOnly -ConfirmVerified"
    return
  }
}

# 备份并切换
# 注意：Linux 不允许覆盖正在执行的二进制（ETXTBSY），因此采用「停服 → 删除 → 复制」。
$backup = "$RemoteBackupDir/nextrade.pre$Tag.bak"
$live = "$RemoteRoot/$BinName"
Post 'files' @{ action = 'CopyFile'; sfile = $live; dfile = $backup } | Out-Null
Post 'files' @{ action = 'CopyFile'; sfile = $remoteZip; dfile = "$RemoteRoot/$BinName.new" } | Out-Null
Post 'files' @{ action = 'SetFileAccess'; filename = "$RemoteRoot/$BinName.new"; access = '755'; user = 'root'; all = 'False' } | Out-Null

Write-Host "stopping $ServiceName"
$stop = Post 'system' @{ action = 'ServiceAdmin'; name = $ServiceName; type = 'stop' }
Write-Host "stop: $stop"
Start-Sleep -Seconds 3

Write-Host 'replacing binary (delete + copy)'
$del = Post 'files' @{ action = 'DeleteFile'; path = $live }
Write-Host "delete: $del"
Start-Sleep -Seconds 1
$copyNew = Post 'files' @{ action = 'CopyFile'; sfile = "$RemoteRoot/$BinName.new"; dfile = $live }
Write-Host "copy: $copyNew"
if ($copyNew -notmatch '"status"\s*:\s*true') { throw 'copy new binary failed' }
Post 'files' @{ action = 'SetFileAccess'; filename = $live; access = '755'; user = 'root'; all = 'False' } | Out-Null

$start = Post 'system' @{ action = 'ServiceAdmin'; name = $ServiceName; type = 'start' }
Write-Host "start: $start"
# BT 的 stop/start 有时不会真正换掉进程，补一次 restart 确保加载新二进制
Start-Sleep -Seconds 2
$restart = Post 'system' @{ action = 'ServiceAdmin'; name = $ServiceName; type = 'restart' }
Write-Host "restart: $restart"
Start-Sleep -Seconds 6

try {
  $health = Invoke-WebRequest -Uri 'https://battery.recy.cc/adminapi/health' -UseBasicParsing -TimeoutSec 15
  Write-Host "health=$($health.StatusCode) body=$($health.Content)"
}
catch {
  Write-Host "health failed: $($_.Exception.Message)"
  Post 'system' @{ action = 'ServiceAdmin'; name = $ServiceName; type = 'stop' } | Out-Null
  Start-Sleep -Seconds 2
  Post 'files' @{ action = 'DeleteFile'; path = $live } | Out-Null
  Post 'files' @{ action = 'CopyFile'; sfile = $backup; dfile = $live } | Out-Null
  Post 'files' @{ action = 'SetFileAccess'; filename = $live; access = '755'; user = 'root'; all = 'False' } | Out-Null
  Post 'system' @{ action = 'ServiceAdmin'; name = $ServiceName; type = 'start' } | Out-Null
  throw 'health failed, rolled back'
}

Write-Host "deployed tag=$Tag sha256=$hash backup=$backup"
