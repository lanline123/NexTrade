# 宝塔面板分片上传脚本

脚本：

```text
tools/upload-to-bt.ps1
```

用途：

```text
把本地大文件切成 4MB 分片，通过宝塔面板 UploadFile 接口上传到服务器。
适用于 GitHub Actions 产出的 nextrade 二进制、PC 运行时 tgz 等。
```

## 依赖

本机需要：

```text
PowerShell 7
curl.exe
宝塔面板辅助脚本 C:\Users\Public\bt2api.ps1
```

辅助脚本需要提供：

```text
New-BTAuth
Invoke-BTPost
$script:base
```

## 基本用法

```powershell
cd D:\tigshop\NexTrade

.\tools\upload-to-bt.ps1 `
  -File C:\Users\lanli\AppData\Local\Temp\nextrade-build150\nextrade `
  -RemoteDir /www/backup/ `
  -ChunkSizeMB 4 `
  -PartPrefix b150_
```

上传结果：

```text
/www/backup/b95_00
/www/backup/b95_01
...
```

## 指定其他面板辅助脚本

```powershell
.\tools\upload-to-bt.ps1 `
  -File .\nextrade `
  -RemoteDir /www/backup/ `
  -Helper D:\tools\bt2api.ps1
```

## 保留本地临时分片

默认上传成功后会删除本地临时目录；调试时保留：

```powershell
.\tools\upload-to-bt.ps1 `
  -File .\nextrade `
  -RemoteDir /www/backup/ `
  -KeepTemp
```

## 服务器合并和部署

上传完成后，在服务器执行：

```bash
cd /www/backup

cat b150_00 b150_01 b150_02 b150_03 b150_04 b150_05 \
    b150_06 b150_07 b150_08 b150_09 b150_10 b150_11 \
    > /www/backup/nextrade.new

# 必做：和 Release 的 nextrade.sha256 比对（该文件内容形如 "<hash>  nextrade"）
sha256sum /www/backup/nextrade.new

systemctl stop nextrade
cp -a /www/wwwroot/nextrade/nextrade /www/backup/nextrade.preB150.bak
chmod 755 /www/backup/nextrade.new
rm -f /www/wwwroot/nextrade/nextrade        # 运行中的二进制不能直接覆盖（ETXTBSY）
mv -f /www/backup/nextrade.new /www/wwwroot/nextrade/nextrade
systemctl start nextrade

systemctl is-active nextrade
curl -s http://127.0.0.1:8080/adminapi/health
```

注意 `sha256sum -c` 要求文件名与 `.sha256` 内容里的文件名一致；合并后的文件叫 `nextrade.new` 时直接 `-c` 会报 no such file，应像上面那样单独算 hash 再人工比对。

## 注意

```text
1. PartPrefix 用来避免多个部署任务的分片互相覆盖
2. 上传后一定先 sha256sum 校验，再替换线上二进制
3. 替换前必须备份旧二进制
4. /www/backup 下的分片和部署脚本要定期清理
5. 不要把宝塔 API token 写进脚本或提交到仓库
```

## 输出对象

脚本会返回：

```json
{
  "File": "...",
  "Sha256": "...",
  "Size": 49791632,
  "RemoteDir": "/www/backup",
  "Parts": ["b95_00", "b95_01"]
}
```

同时生成本地 `manifest.json`，便于其他 AI 读取分片清单和校验值。
