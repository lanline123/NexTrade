# 宝塔面板分片上传脚本

脚本：

```text
tools/upload-to-bt.ps1
```

用途：

```text
把本地大文件切成 4MB 分片，通过宝塔面板 UploadFile 接口上传到服务器。
适用于 GitHub Actions 产出的 rustshop 二进制、zip 包等。
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
cd D:\tigshop\java-b2b2b-pro-v5.8.57

.\tools\upload-to-bt.ps1 `
  -File C:\Users\lanli\AppData\Local\Temp\rustshop-build95b\rustshop `
  -RemoteDir /www/backup/ `
  -ChunkSizeMB 4 `
  -PartPrefix b95_
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
  -File .\rustshop `
  -RemoteDir /www/backup/ `
  -Helper D:\tools\bt2api.ps1
```

## 保留本地临时分片

默认上传成功后会删除本地临时目录；调试时保留：

```powershell
.\tools\upload-to-bt.ps1 `
  -File .\rustshop `
  -RemoteDir /www/backup/ `
  -KeepTemp
```

## 服务器合并和部署

上传完成后，在服务器执行：

```bash
cd /www/backup

cat b95_00 b95_01 b95_02 b95_03 b95_04 b95_05 \
    b95_06 b95_07 b95_08 b95_09 b95_10 b95_11 \
    > /www/wwwroot/tigshop-rust/tigshop.new

# 必做：和本地/Release 的 sha256 对比
sha256sum /www/wwwroot/tigshop-rust/tigshop.new

systemctl stop tigshop
cp -a /www/wwwroot/tigshop-rust/tigshop /www/wwwroot/tigshop-rust/tigshop.$(date +%Y%m%d%H%M).bak
chmod 755 /www/wwwroot/tigshop-rust/tigshop.new
mv -f /www/wwwroot/tigshop-rust/tigshop.new /www/wwwroot/tigshop-rust/tigshop
systemctl start tigshop

systemctl is-active tigshop
curl -s http://127.0.0.1:8080/adminapi/health
```

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
