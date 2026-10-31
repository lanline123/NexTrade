//! 在线支付渠道协议骨架（微信支付 v3 / 支付宝 / PayPal）。
//!
//! 目标：在**没有商户凭据**的情况下，把各渠道的配置读取、签名、验签、
//! 回调报文解密等协议能力实现并单测锁定；真实下单/退款接口在拿到沙箱
//! 商户号、证书、密钥后即可补齐（见 [`ChannelConfigs::status_summary`]）。
//!
//! - 微信支付 v3：`WECHATPAY2-SHA256-RSA2048` 签名/验签、回调 `AES-256-GCM` 解密；
//! - 支付宝：`RSA2(SHA256WithRSA)` 签名/验签、异步通知参数排序；
//! - PayPal：REST 配置与网关地址（sandbox/production），OAuth2 下单待联调。
use std::collections::{BTreeMap, HashMap};

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::Engine;
use hmac::{Hmac, Mac};
use rsa::pkcs8::{DecodePrivateKey, DecodePublicKey};
use rsa::{Pkcs1v15Sign, RsaPrivateKey, RsaPublicKey};
use sha2::{Digest, Sha256};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::Repositories;

fn b64_encode(bytes: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

fn b64_decode(input: &str) -> Result<Vec<u8>> {
    base64::engine::general_purpose::STANDARD
        .decode(input.trim())
        .map_err(|e| Error::Validation(format!("Base64 解码失败: {e}")))
}

fn sha256(data: &[u8]) -> Vec<u8> {
    Sha256::digest(data).to_vec()
}

// —————————————————————————————— 微信支付 v3 ——————————————————————————————

/// 微信支付 v3 配置（`config` 表）。
#[derive(Debug, Clone, Default)]
pub struct WechatPayV3Config {
    /// `wechatPayMchid`
    pub mchid: String,
    /// `wechatPayAppId`
    pub app_id: String,
    /// `wechatPaySerialNo`（商户 API 证书序列号）
    pub serial_no: String,
    /// `wechatPayPrivateKey`（商户私钥 PEM 内容）
    pub private_key_pem: Option<String>,
    /// `wechatPayPublicKey` / `wechatPayPlatformCertificate`（微信支付公钥/平台证书 PEM）
    pub public_key_pem: Option<String>,
    /// `wechatPayPublicKeyId`
    pub public_key_id: String,
    /// `wechatPayKey`（APIv3 密钥，32 字节）
    pub api_v3_key: Option<String>,
}

impl WechatPayV3Config {
    /// 是否具备可联调的最小配置。
    #[must_use]
    pub fn is_configured(&self) -> bool {
        self.missing().is_empty()
    }

    /// 缺失的配置项（用于给出可操作错误信息）。
    #[must_use]
    pub fn missing(&self) -> Vec<&'static str> {
        let mut missing = Vec::new();
        if self.mchid.trim().is_empty() {
            missing.push("wechatPayMchid");
        }
        if self.app_id.trim().is_empty() {
            missing.push("wechatPayAppId");
        }
        if self.serial_no.trim().is_empty() {
            missing.push("wechatPaySerialNo");
        }
        if self.private_key_pem.as_deref().unwrap_or("").trim().is_empty() {
            missing.push("wechatPayPrivateKey");
        }
        if self.public_key_pem.as_deref().unwrap_or("").trim().is_empty() {
            missing.push("wechatPayPublicKey");
        }
        if self.api_v3_key.as_deref().unwrap_or("").trim().is_empty() {
            missing.push("wechatPayKey");
        }
        missing
    }
}

/// 微信支付 v3 待签名串：`METHOD\nURL\nTIMESTAMP\nNONCE\nBODY\n`。
#[must_use]
pub fn wechat_sign_message(
    method: &str,
    url_path: &str,
    timestamp: &str,
    nonce: &str,
    body: &str,
) -> String {
    format!("{method}\n{url_path}\n{timestamp}\n{nonce}\n{body}\n")
}

/// `Authorization: WECHATPAY2-SHA256-RSA2048 ...` 头。
#[must_use]
pub fn wechat_authorization(
    mchid: &str,
    serial_no: &str,
    nonce: &str,
    timestamp: &str,
    signature_b64: &str,
) -> String {
    format!(
        "WECHATPAY2-SHA256-RSA2048 mchid=\"{mchid}\",nonce_str=\"{nonce}\",signature=\"{signature_b64}\",timestamp=\"{timestamp}\",serial_no=\"{serial_no}\""
    )
}

/// 商户私钥 `SHA256withRSA` 签名（微信支付 v3 请求签名）。
pub fn wechat_sign(private_key_pem: &str, message: &str) -> Result<String> {
    let key = RsaPrivateKey::from_pkcs8_pem(private_key_pem)
        .map_err(|e| Error::Validation(format!("微信商户私钥解析失败: {e}")))?;
    let signature = key
        .sign(Pkcs1v15Sign::new::<Sha256>(), &sha256(message.as_bytes()))
        .map_err(|e| Error::Internal(format!("微信支付签名失败: {e}")))?;
    Ok(b64_encode(&signature))
}

/// 微信公钥验签（回调 `Wechatpay-Signature`）。
pub fn wechat_verify(public_key_pem: &str, message: &str, signature_b64: &str) -> Result<()> {
    let key = RsaPublicKey::from_public_key_pem(public_key_pem)
        .map_err(|e| Error::Validation(format!("微信支付公钥解析失败: {e}")))?;
    let signature = b64_decode(signature_b64)?;
    key.verify(
        Pkcs1v15Sign::new::<Sha256>(),
        &sha256(message.as_bytes()),
        &signature,
    )
    .map_err(|_| Error::biz(1001, "微信支付回调验签失败"))
}

/// 解密微信支付 v3 回调 `resource`（`AES-256-GCM`）。
///
/// `ciphertext_b64` 为「密文 + 16 字节 auth tag」的 base64（微信规范）。
pub fn wechat_decrypt_resource(
    api_v3_key: &str,
    associated_data: &str,
    nonce: &str,
    ciphertext_b64: &str,
) -> Result<String> {
    let key = api_v3_key.as_bytes();
    if key.len() != 32 {
        return Err(Error::Validation("微信 APIv3 密钥必须为 32 字节".into()));
    }
    if nonce.as_bytes().len() != 12 {
        return Err(Error::Validation("微信回调 nonce 必须为 12 字节".into()));
    }
    let ciphertext = b64_decode(ciphertext_b64)?;
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| Error::Internal(format!("AES-GCM 初始化失败: {e}")))?;
    let plain = cipher
        .decrypt(
            Nonce::from_slice(nonce.as_bytes()),
            Payload {
                msg: &ciphertext,
                aad: associated_data.as_bytes(),
            },
        )
        .map_err(|_| Error::biz(1001, "微信支付回调解密失败（密钥/密文不匹配）"))?;
    String::from_utf8(plain)
        .map_err(|e| Error::Internal(format!("微信回调解密结果非 UTF-8: {e}")))
}

// —————————————————————————————— 支付宝 ——————————————————————————————

/// 支付宝配置（`config` 表）。
#[derive(Debug, Clone, Default)]
pub struct AlipayConfig {
    /// `alipayAppid`
    pub app_id: String,
    /// `alipayRsaPrivateKey`（应用私钥）
    pub private_key_pem: Option<String>,
    /// `alipayRsaPublicKey`（支付宝公钥）
    pub alipay_public_key_pem: Option<String>,
}

impl AlipayConfig {
    #[must_use]
    pub fn is_configured(&self) -> bool {
        self.missing().is_empty()
    }

    #[must_use]
    pub fn missing(&self) -> Vec<&'static str> {
        let mut missing = Vec::new();
        if self.app_id.trim().is_empty() {
            missing.push("alipayAppid");
        }
        if self.private_key_pem.as_deref().unwrap_or("").trim().is_empty() {
            missing.push("alipayRsaPrivateKey");
        }
        if self
            .alipay_public_key_pem
            .as_deref()
            .unwrap_or("")
            .trim()
            .is_empty()
        {
            missing.push("alipayRsaPublicKey");
        }
        missing
    }
}

/// 支付宝待签名串：按 key 升序、跳过 `sign`/`sign_type`/空值，`k=v` 用 `&` 连接。
#[must_use]
pub fn alipay_sign_content(params: &BTreeMap<String, String>) -> String {
    params
        .iter()
        .filter(|(k, _)| k.as_str() != "sign" && k.as_str() != "sign_type")
        .filter(|(_, v)| !v.trim().is_empty())
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("&")
}

/// 支付宝后台可能保存裸 Base64 密钥；统一补成 PEM（并清理 NUL）。
fn normalize_rsa_pem(raw: &str, label: &str) -> String {
    let cleaned = raw.replace('\0', "").replace('\r', "");
    if cleaned.contains("-----BEGIN") {
        return cleaned.trim().to_string();
    }
    let body: String = cleaned.chars().filter(|c| !c.is_whitespace()).collect();
    let mut out = format!("-----BEGIN {label}-----\n");
    for chunk in body.as_bytes().chunks(64) {
        out.push_str(&String::from_utf8_lossy(chunk));
        out.push('\n');
    }
    out.push_str(&format!("-----END {label}-----"));
    out
}

/// 支付宝 RSA2（SHA256withRSA）签名，返回 base64。
pub fn alipay_rsa2_sign(private_key_pem: &str, content: &str) -> Result<String> {
    let normalized = normalize_rsa_pem(private_key_pem, "PRIVATE KEY");
    let key = RsaPrivateKey::from_pkcs8_pem(&normalized)
        .map_err(|e| Error::Validation(format!("支付宝应用私钥解析失败: {e}")))?;
    let signature = key
        .sign(Pkcs1v15Sign::new::<Sha256>(), &sha256(content.as_bytes()))
        .map_err(|e| Error::Internal(format!("支付宝签名失败: {e}")))?;
    Ok(b64_encode(&signature))
}

/// 支付宝异步通知验签（RSA2，使用支付宝公钥）。
pub fn alipay_verify_notify(
    alipay_public_key_pem: &str,
    params: &BTreeMap<String, String>,
) -> Result<()> {
    let signature = params
        .get("sign")
        .cloned()
        .ok_or_else(|| Error::biz(1001, "支付宝回调缺少 sign"))?;
    let content = alipay_sign_content(params);
    let normalized = normalize_rsa_pem(alipay_public_key_pem, "PUBLIC KEY");
    let key = RsaPublicKey::from_public_key_pem(&normalized)
        .map_err(|e| Error::Validation(format!("支付宝公钥解析失败: {e}")))?;
    key.verify(
        Pkcs1v15Sign::new::<Sha256>(),
        &sha256(content.as_bytes()),
        &b64_decode(&signature)?,
    )
    .map_err(|_| Error::biz(1001, "支付宝回调验签失败"))
}

// —————————————————————————————— PayPal ——————————————————————————————

/// PayPal REST 配置。
#[derive(Debug, Clone, Default)]
pub struct PaypalConfig {
    pub client_id: String,
    pub client_secret: String,
    pub currency: String,
    /// 沙箱网关（`https://api-m.sandbox.paypal.com`）。
    pub sandbox: bool,
}

impl PaypalConfig {
    #[must_use]
    pub fn is_configured(&self) -> bool {
        !self.client_id.trim().is_empty() && !self.client_secret.trim().is_empty()
    }

    #[must_use]
    pub fn missing(&self) -> Vec<&'static str> {
        let mut missing = Vec::new();
        if self.client_id.trim().is_empty() {
            missing.push("paypalClientId");
        }
        if self.client_secret.trim().is_empty() {
            missing.push("paypalClientSecret");
        }
        missing
    }

    /// REST 网关 base URL。
    #[must_use]
    pub fn base_url(&self) -> &'static str {
        if self.sandbox {
            "https://api-m.sandbox.paypal.com"
        } else {
            "https://api-m.paypal.com"
        }
    }

    /// OAuth2 access token 端点。
    #[must_use]
    pub fn oauth_token_url(&self) -> String {
        format!("{}/v1/oauth2/token", self.base_url())
    }
}

// —————————————————————————————— 配置装配 ——————————————————————————————

/// 三大渠道配置集合。
#[derive(Debug, Clone, Default)]
pub struct ChannelConfigs {
    pub wechat: WechatPayV3Config,
    pub alipay: AlipayConfig,
    pub paypal: PaypalConfig,
}

impl ChannelConfigs {
    /// 各渠道配置状态摘要（用于启动日志/文档/错误提示）。
    #[must_use]
    pub fn status_summary(&self) -> String {
        format!(
            "wechat={}, alipay={}, paypal={}",
            if self.wechat.is_configured() { "已配置" } else { "未配置" },
            if self.alipay.is_configured() { "已配置" } else { "未配置" },
            if self.paypal.is_configured() { "已配置" } else { "未配置" },
        )
    }
}

const CONFIG_KEYS: [&str; 12] = [
    "wechatPayMchid",
    "wechatPayAppId",
    "wechatPaySerialNo",
    "wechatPayPrivateKey",
    "wechatPayPublicKey",
    "wechatPayPublicKeyId",
    "wechatPayKey",
    "alipayAppid",
    "alipayRsaPrivateKey",
    "alipayRsaPublicKey",
    "paypalClientId",
    "paypalClientSecret",
];

/// 从 `config` 表读取三大渠道配置。
///
/// # Errors
/// 数据库读取失败。
pub async fn load_channel_configs(repos: &Repositories) -> Result<ChannelConfigs> {
    let map: HashMap<String, String> = repos
        .system
        .config_basic
        .find_by_codes(&CONFIG_KEYS)
        .await?
        .into_iter()
        .collect();
    let get = |key: &str| map.get(key).cloned();
    Ok(ChannelConfigs {
        wechat: WechatPayV3Config {
            mchid: get("wechatPayMchid").unwrap_or_default(),
            app_id: get("wechatPayAppId").unwrap_or_default(),
            serial_no: get("wechatPaySerialNo").unwrap_or_default(),
            private_key_pem: get("wechatPayPrivateKey"),
            public_key_pem: get("wechatPayPublicKey"),
            public_key_id: get("wechatPayPublicKeyId").unwrap_or_default(),
            api_v3_key: get("wechatPayKey"),
        },
        alipay: AlipayConfig {
            app_id: get("alipayAppid").unwrap_or_default(),
            private_key_pem: get("alipayRsaPrivateKey"),
            alipay_public_key_pem: get("alipayRsaPublicKey"),
        },
        paypal: PaypalConfig {
            client_id: get("paypalClientId").unwrap_or_default(),
            client_secret: get("paypalClientSecret").unwrap_or_default(),
            currency: "USD".to_string(),
            sandbox: true,
        },
    })
}

// —————————————————————————————— 测试 ——————————————————————————————

#[cfg(test)]
mod tests {
    use super::*;
    use rsa::pkcs8::{EncodePrivateKey, EncodePublicKey};
    use rsa::traits::PublicKeyParts;
    use rsa::RsaPrivateKey;

    fn test_key_pair() -> (String, String) {
        let mut rng = rand::thread_rng();
        let private = RsaPrivateKey::new(&mut rng, 1024).expect("生成 RSA 测试密钥");
        let private_pem = private
            .to_pkcs8_pem(rsa::pkcs8::LineEnding::LF)
            .expect("私钥 PEM")
            .to_string();
        let public_pem = RsaPublicKey::from(&private)
            .to_public_key_pem(rsa::pkcs8::LineEnding::LF)
            .expect("公钥 PEM");
        (private_pem, public_pem)
    }

    #[test]
    fn wechat_sign_message_and_authorization_format() {
        let msg = wechat_sign_message("POST", "/v3/pay/transactions/jsapi", "1700000000", "nonce", "{}");
        assert_eq!(
            msg,
            "POST\n/v3/pay/transactions/jsapi\n1700000000\nnonce\n{}\n"
        );
        let auth = wechat_authorization("1900000001", "serial", "nonce", "1700000000", "sig");
        assert!(auth.starts_with("WECHATPAY2-SHA256-RSA2048 "));
        assert!(auth.contains("mchid=\"1900000001\""));
        assert!(auth.contains("serial_no=\"serial\""));
    }

    #[test]
    fn wechat_rsa_sign_verify_roundtrip() {
        let (private_pem, public_pem) = test_key_pair();
        let message = wechat_sign_message("GET", "/v3/certificates", "1", "n", "");
        let signature = wechat_sign(&private_pem, &message).expect("签名");
        assert!(wechat_verify(&public_pem, &message, &signature).is_ok());
        assert!(wechat_verify(&public_pem, &format!("{message}x"), &signature).is_err());
    }

    #[test]
    fn wechat_decrypt_resource_roundtrip() {
        // 模拟微信回调：用同一 APIv3 key 加密后解密
        let key = b"0123456789abcdef0123456789abcdef"; // 32 bytes
        let nonce = b"abcdef123456"; // 12 bytes
        let plain = r#"{"out_trade_no":"PAY20260101","transaction_id":"4200001"}"#;
        let cipher = Aes256Gcm::new_from_slice(key).unwrap();
        let ciphertext = cipher
            .encrypt(
                Nonce::from_slice(nonce),
                Payload {
                    msg: plain.as_bytes(),
                    aad: b"transaction",
                },
            )
            .expect("加密");
        let b64 = b64_encode(&ciphertext);
        let decrypted =
            wechat_decrypt_resource("0123456789abcdef0123456789abcdef", "transaction", "abcdef123456", &b64)
                .expect("解密");
        assert_eq!(decrypted, plain);
        assert!(wechat_decrypt_resource("short", "transaction", "abcdef123456", &b64).is_err());
    }

    #[test]
    fn alipay_content_sorted_and_skips_sign() {
        let mut params = BTreeMap::new();
        params.insert("b".into(), "2".into());
        params.insert("a".into(), "1".into());
        params.insert("sign".into(), "zzz".into());
        params.insert("sign_type".into(), "RSA2".into());
        params.insert("empty".into(), "".into());
        assert_eq!(alipay_sign_content(&params), "a=1&b=2");
    }

    #[test]
    fn alipay_rsa2_sign_verify_roundtrip() {
        let (private_pem, public_pem) = test_key_pair();
        let content = "app_id=2021000000&out_trade_no=PAY1&total_amount=0.01";
        let signature = alipay_rsa2_sign(&private_pem, content).expect("签名");
        let mut params = BTreeMap::new();
        params.insert("sign".into(), signature);
        params.insert("app_id".into(), "2021000000".into());
        params.insert("out_trade_no".into(), "PAY1".into());
        params.insert("total_amount".into(), "0.01".into());
        assert!(alipay_verify_notify(&public_pem, &params).is_ok());
        params.insert("total_amount".into(), "9.99".into());
        assert!(alipay_verify_notify(&public_pem, &params).is_err());
    }

    #[test]
    fn channel_config_status() {
        let empty = ChannelConfigs::default();
        assert!(!empty.wechat.is_configured());
        assert!(empty.wechat.missing().contains(&"wechatPayMchid"));
        assert!(!empty.alipay.is_configured());
        assert!(!empty.paypal.is_configured());
        assert!(empty.status_summary().contains("未配置"));
    }

    #[test]
    fn paypal_gateways() {
        let mut cfg = PaypalConfig {
            client_id: "id".into(),
            client_secret: "secret".into(),
            currency: "USD".into(),
            sandbox: true,
        };
        assert!(cfg.is_configured());
        assert_eq!(cfg.base_url(), "https://api-m.sandbox.paypal.com");
        assert_eq!(cfg.oauth_token_url(), "https://api-m.sandbox.paypal.com/v1/oauth2/token");
        cfg.sandbox = false;
        assert_eq!(cfg.base_url(), "https://api-m.paypal.com");
    }

    #[test]
    fn test_rsa_key_size_sanity() {
        let (private_pem, _) = test_key_pair();
        let key = RsaPrivateKey::from_pkcs8_pem(&private_pem).unwrap();
        assert_eq!(key.size() * 8, 1024);
    }
}


// —————————————————————————————— Stripe / Xendit 回调验签 ——————————————————————————————

/// 校验 Stripe webhook 签名（`Stripe-Signature: t=...,v1=...`）。
pub fn stripe_verify_webhook(secret: &str, header: &str, payload: &str) -> Result<()> {
    let mut timestamp = "";
    let mut signatures: Vec<&str> = Vec::new();
    for part in header.split(',') {
        let mut kv = part.splitn(2, '=');
        let key = kv.next().unwrap_or("").trim();
        let value = kv.next().unwrap_or("").trim();
        match key {
            "t" => timestamp = value,
            "v1" => signatures.push(value),
            _ => {}
        }
    }
    if timestamp.is_empty() || signatures.is_empty() {
        return Err(Error::biz(1001, "Stripe 回调签名头格式错误"));
    }
    let signed = format!("{timestamp}.{payload}");
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes())
        .map_err(|e| Error::Internal(format!("Stripe 签名初始化失败: {e}")))?;
    mac.update(signed.as_bytes());
    for sig in signatures {
        if let Ok(bytes) = hex::decode(sig) {
            if mac.clone().verify_slice(&bytes).is_ok() {
                return Ok(());
            }
        }
    }
    Err(Error::biz(1001, "Stripe 回调验签失败"))
}

/// 校验 Xendit 回调 token（常量时间比较）。
pub fn xendit_verify_token(expected: &str, actual: &str) -> bool {
    let a = expected.as_bytes();
    let b = actual.as_bytes();
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}
