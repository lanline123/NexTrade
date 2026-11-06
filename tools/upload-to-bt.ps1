#Requires -Version 5.1
<#
.SYNOPSIS
    通过宝塔面板 API 分片上传文件到服务器。

.DESCRIPTION
    把本地文件切成固定大小的分片，逐片调用宝塔 /files?action=UploadFile 接口。
    适用于 GitHub Actions 产出的 40MB～100MB 二进制、压缩包等大文件。

.PARAMETER File
    本地文件路径，必填。

.PARAMETER RemoteDir
    服务器目标目录，默认 /www/backup/。

.PARAMETER ChunkSizeMB
    分片大小，默认 4MB。宝塔面板对单次上传大小有限制，4MB 较稳。

.PARAMETER PartPrefix
    分片名前缀，默认 part。最终生成 part00、part01...

.PARAMETER Helper
    宝塔面板辅助脚本路径，默认 C:\Users\Public\bt2api.ps1。
    该脚本需要提供 New-BTAuth、Invoke-BTPost 和 $script:base。

.PARAMETER KeepTemp
    保留本地临时分片，默认成功后会删除。

.OUTPUTS
    返回上传结果对象，Contains：File、Sha256、Size、RemoteDir、Parts。

.EXAMPLE
    .\upload-to-bt.ps1 -File C:\Temp\nextrade -RemoteDir /www/backup/

.EXAMPLE
    .\upload-to-bt.ps1 -File C:\Temp\nextrade-build150.zip -RemoteDir /www/backup/ -ChunkSizeMB 4 -PartPrefix b150_
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$File,

    [string]$RemoteDir = '/www/backup/',

    [ValidateRange(1, 64)]
    [int]$ChunkSizeMB = 4,

    [string]$PartPrefix = 'part',

    [string]$Helper = 'C:\Users\Public\bt2api.ps1',

    [switch]$KeepTemp
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
    Write-Host "[upload-to-bt] $Message" -ForegroundColor Cyan
}

if (-not (Test-Path -LiteralPath $File -PathType Leaf)) {
    throw "本地文件不存在: $File"
}
if (-not (Test-Path -LiteralPath $Helper -PathType Leaf)) {
    throw "宝塔辅助脚本不存在: $Helper"
}

. $Helper

if (-not (Get-Command New-BTAuth -ErrorAction SilentlyContinue)) {
    throw "辅助脚本未提供 New-BTAuth: $Helper"
}
if (-not (Get-Command Invoke-BTPost -ErrorAction SilentlyContinue)) {
    throw "辅助脚本未提供 Invoke-BTPost: $Helper"
}

$source = (Resolve-Path -LiteralPath $File).Path
$sourceItem = Get-Item -LiteralPath $source
$sha256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
$remoteDirNormalized = $RemoteDir.TrimEnd('/')
if ([string]::IsNullOrWhiteSpace($remoteDirNormalized)) {
    throw 'RemoteDir 不能为空'
}

$tempRoot = Join-Path $env:TEMP ('bt-upload-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

$chunkBytes = $ChunkSizeMB * 1MB
$buffer = New-Object byte[] $chunkBytes
$parts = New-Object System.Collections.Generic.List[object]
$index = 0
$fs = [System.IO.File]::OpenRead($source)

try {
    Write-Step "文件: $source"
    Write-Step "大小: $($sourceItem.Length) 字节"
    Write-Step "SHA256: $sha256"
    Write-Step "目标目录: $remoteDirNormalized"

    while (($read = $fs.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $partName = '{0}{1:D2}' -f $PartPrefix, $index
        $partPath = Join-Path $tempRoot $partName
        $part = New-Object byte[] $read
        [Array]::Copy($buffer, $part, $read)
        [System.IO.File]::WriteAllBytes($partPath, $part)
        $parts.Add([pscustomobject]@{
            Name = $partName
            Path = $partPath
            Size = $read
        })
        $index++
    }
}
finally {
    $fs.Dispose()
}

if ($parts.Count -eq 0) {
    throw '文件为空，未生成任何分片'
}

foreach ($part in $parts) {
    $auth = New-BTAuth
    $response = & curl.exe -k -s -m 300 -X POST `
        -F "request_time=$($auth.request_time)" `
        -F "request_token=$($auth.request_token)" `
        -F "zunfile=@$($part.Path)" `
        -F "path=$remoteDirNormalized/" `
        -F "fname=$($part.Name)" `
        -F "f_size=$($part.Size)" `
        -F "f_start=0" `
        "$script:base/files?action=UploadFile"

    $text = ($response -join "`n")
    if ($text -notmatch '"status"\s*:\s*true') {
        throw "分片上传失败: $($part.Name) -> $text"
    }
    Write-Step "已上传 $($part.Name) ($($part.Size) 字节)"
}

$result = [pscustomobject]@{
    File = $source
    Sha256 = $sha256
    Size = $sourceItem.Length
    RemoteDir = $remoteDirNormalized
    Parts = $parts | ForEach-Object { $_.Name }
}

$manifest = Join-Path $tempRoot 'manifest.json'
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifest -Encoding utf8
Write-Step "上传完成，共 $($parts.Count) 个分片"
Write-Step "本地 manifest: $manifest"
Write-Step '服务器合并示例:'
Write-Host ("  cat {0}/{1}* > {0}/目标文件" -f $remoteDirNormalized, $PartPrefix) -ForegroundColor DarkGray
Write-Step '合并后务必执行 sha256sum 校验。'

if (-not $KeepTemp) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$result
