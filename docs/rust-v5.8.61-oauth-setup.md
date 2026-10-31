# OAuth（Google / Facebook）配置指引

适用版本：build-146  
域名：https://battery.recy.cc

## 固定回调地址

Google 与 Facebook 都必须登记同一个地址：

```text
https://battery.recy.cc/oauth/callback
```

不能带 query 参数（provider 通过 `state` 前缀传递，见下文）。

## Google

Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client：

```text
Authorized JavaScript origins:
https://battery.recy.cc

Authorized redirect URIs:
https://battery.recy.cc/oauth/callback
```

当前错误：

```text
redirect_uri_mismatch
```

说明控制台没有登记上面的 redirect URI。

## Facebook

Facebook Developers → App → Facebook Login → Settings：

```text
Valid OAuth Redirect URIs:
https://battery.recy.cc/oauth/callback
```

当前错误：

```text
PLATFORM__INVALID_APP_ID
client_id=32132
```

`32132` 是占位值，必须换成真实 App ID / App Secret。

## 配置存储

配置项在 `config` 表：

```text
biz_code                  biz_val
googleClientId            Google Client ID
googleClientSecret        Google Client Secret
facebookClientId          Facebook App ID
facebookClientSecret      Facebook App Secret
```

更新示例：

```sql
UPDATE config SET biz_val='<real-client-id>'
WHERE biz_code='googleClientId';

UPDATE config SET biz_val='<real-client-secret>'
WHERE biz_code='googleClientSecret';

UPDATE config SET biz_val='<real-app-id>'
WHERE biz_code='facebookClientId';

UPDATE config SET biz_val='<real-app-secret>'
WHERE biz_code='facebookClientSecret';
```

更新后重启 tigshop 或等待配置缓存刷新。

## 回调来源识别

第三方回调地址不允许携带 `source`/`provider` query，因此后端把来源编码进 `state`：

```text
google:<uuid>
facebook:<uuid>
```

PC 回调页 `/oauth/callback` 从 `state` 前缀解析 provider，再调用：

```text
POST /api/user/oauth/callback/{source}
```

该修复已包含在 build-146 与 PC v20。

## 验证命令

```bash
curl -s 'https://battery.recy.cc/api/user/oauth/render/google?platform=pc'
```

返回 URL 的 state 应形如：

```text
google:fe8ba77ce7f544bc97da7c20bcdd484f
```

Facebook：

```text
facebook:d0beb87ac7b84319ae142685c3a58aaf
```

## 仍阻塞

```text
Google：控制台未登记回调地址
Facebook：App ID/Secret 为占位值
```

这两项需要在第三方控制台操作，代码侧已就绪。
