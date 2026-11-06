//! 行为验证码（AJ-Captcha `blockPuzzle` 协议兼容实现）。
//!
//! 与前端 `components/verifition`（AJ-Captcha Vue 组件）对齐：
//! - `POST/GET /common/verification/captcha` → 返回背景图/拼图块 base64、`token`、`secretKey`；
//! - `POST /common/verification/check` → `pointJson` 为 AES-128-ECB + PKCS7（key=`secretKey`）
//!   加密的 `{"x":..,"y":..}`，校验 x 坐标容差 5px；
//! - 校验通过后前端用同一密钥加密 `token---pointJson` 得到 `captchaVerification`，
//!   登录接口在「失败次数达到阈值」时校验该串。
//!
//! 状态存储：进程内 `Mutex<HashMap>`（单实例部署；多实例需换 Redis）。
use std::collections::HashMap;
use std::io::Cursor;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use aes::cipher::generic_array::GenericArray;
use aes::cipher::{BlockDecrypt, KeyInit};
use aes::Aes128;
use base64::Engine;
use image::{GenericImage, Rgba, RgbaImage};
use tigshop_core::models::member::captcha_api::CaptchaVO;
use tigshop_core::{Error, Result};

/// 背景图宽度（与前端 `imgSize.width=310px` 一致）。
pub const BG_W: u32 = 310;
/// 背景图高度（与前端 `imgSize.height=155px` 一致）。
pub const BG_H: u32 = 155;
/// 拼图块边长。
pub const PIECE_SIZE: u32 = 47;
/// 坐标容差（像素）。
pub const TOLERANCE: f64 = 5.0;
/// 验证码有效期（秒）。
pub const CAPTCHA_TTL_SECS: u64 = 120;
/// 登录失败达到该次数后要求验证码（Java `LoginConstants.ERROR_THRESHOLD`）。
pub const LOGIN_ERROR_THRESHOLD: u32 = 5;

struct CaptchaState {
    x: f64,
    secret: String,
    created: u64,
    verified: bool,
}

static CAPTCHA_STORE: OnceLock<Mutex<HashMap<String, CaptchaState>>> = OnceLock::new();
static LOGIN_ERRORS: OnceLock<Mutex<HashMap<String, u32>>> = OnceLock::new();

fn store() -> &'static Mutex<HashMap<String, CaptchaState>> {
    CAPTCHA_STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn errors() -> &'static Mutex<HashMap<String, u32>> {
    LOGIN_ERRORS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// 简易 LCG（不引入 rand 依赖；验证码场景足够）。
struct Rng(u64);

impl Rng {
    fn new() -> Self {
        let seed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0x9E37_79B9_7F4A_7C15);
        Self(seed | 1)
    }

    fn next_u32(&mut self) -> u32 {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        (self.0 >> 33) as u32
    }

    fn range(&mut self, lo: u32, hi: u32) -> u32 {
        if hi <= lo {
            return lo;
        }
        lo + self.next_u32() % (hi - lo)
    }
}

fn png_base64(img: &RgbaImage) -> Result<String> {
    let mut cursor = Cursor::new(Vec::new());
    img.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| Error::Internal(format!("验证码图片编码失败: {e}")))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(cursor.into_inner()))
}

fn random_secret(rng: &mut Rng) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut key = String::with_capacity(16);
    while key.len() < 16 {
        let idx = rng.next_u32() as usize % ALPHABET.len();
        key.push(ALPHABET[idx] as char);
    }
    key
}

/// 内置验证码背景图（真实照片，避免纯渐变看起来像样式损坏）。
static CAPTCHA_BACKGROUND: OnceLock<image::DynamicImage> = OnceLock::new();

/// 拼图形状：圆角方块 + 顶部凸起 + 右侧缺口，接近参考图的拼图块。
fn piece_contains(px: u32, py: u32) -> bool {
    let x = px as i32 - (PIECE_SIZE as i32 / 2);
    let y = py as i32 - (PIECE_SIZE as i32 / 2);
    let corner = 7_i32;
    let in_rounded_square = x.abs() <= 17
        && y.abs() <= 17
        && !(x.abs() > 17 - corner && y.abs() > 17 - corner
            && (x.abs() - (17 - corner)).pow(2) + (y.abs() - (17 - corner)).pow(2)
                > corner * corner);
    let top_tab = x * x + (y + 17) * (y + 17) <= 36;
    let right_notch = (x - 17) * (x - 17) + y * y < 25;
    (in_rounded_square || top_tab) && !right_notch
}

/// 生成一张滑块验证码（真实照片背景 + 拼图块）。
pub fn new_captcha() -> Result<CaptchaVO> {
    let mut rng = Rng::new();

    let source = CAPTCHA_BACKGROUND.get_or_init(|| {
        image::load_from_memory(include_bytes!("captcha_bg.jpg"))
            .unwrap_or_else(|_| image::DynamicImage::new_rgb8(BG_W, BG_H))
    });
    let original = source
        .resize_to_fill(BG_W, BG_H, image::imageops::FilterType::Triangle)
        .to_rgba8();
    let mut bg = original.clone();

    let piece_x = rng.range(80, BG_W - PIECE_SIZE - 20);
    let piece_y = rng.range(20, BG_H - PIECE_SIZE - 20);

    // 拼图块：透明画布高 155，把照片中对应区域复制到真实 y 位置。
    let mut jigsaw = RgbaImage::new(PIECE_SIZE, BG_H);
    for py in 0..PIECE_SIZE {
        for px in 0..PIECE_SIZE {
            if !piece_contains(px, py) {
                continue;
            }
            jigsaw.put_pixel(px, piece_y + py, *original.get_pixel(piece_x + px, piece_y + py));
        }
    }
    // 拼图块白边，增强可见性
    for py in 0..PIECE_SIZE {
        for px in 0..PIECE_SIZE {
            if !piece_contains(px, py) {
                continue;
            }
            let edge = !piece_contains(px.saturating_sub(1), py)
                || !piece_contains((px + 1).min(PIECE_SIZE - 1), py)
                || !piece_contains(px, py.saturating_sub(1))
                || !piece_contains(px, (py + 1).min(PIECE_SIZE - 1));
            if edge {
                jigsaw.put_pixel(px, piece_y + py, Rgba([255, 255, 255, 230]));
            }
        }
    }

    // 背景缺口：压暗 + 白色描边，和参考图一致
    for py in 0..PIECE_SIZE {
        for px in 0..PIECE_SIZE {
            let gx = piece_x + px;
            let gy = piece_y + py;
            if piece_contains(px, py) {
                let p = bg.get_pixel_mut(gx, gy);
                *p = Rgba([
                    (u16::from(p[0]) * 45 / 100) as u8,
                    (u16::from(p[1]) * 45 / 100) as u8,
                    (u16::from(p[2]) * 45 / 100) as u8,
                    255,
                ]);
                let edge = !piece_contains(px.saturating_sub(1), py)
                    || !piece_contains((px + 1).min(PIECE_SIZE - 1), py)
                    || !piece_contains(px, py.saturating_sub(1))
                    || !piece_contains(px, (py + 1).min(PIECE_SIZE - 1));
                if edge {
                    bg.put_pixel(gx, gy, Rgba([255, 255, 255, 235]));
                }
            }
        }
    }

    let token = uuid::Uuid::new_v4().to_string();
    let secret = random_secret(&mut rng);
    let created = now_secs();
    {
        let mut s = store().lock().map_err(|_| Error::Internal("验证码状态锁失败".into()))?;
        s.retain(|_, st| created.saturating_sub(st.created) < CAPTCHA_TTL_SECS);
        if s.len() > 2000 {
            s.clear();
        }
        s.insert(
            token.clone(),
            CaptchaState {
                x: f64::from(piece_x),
                secret: secret.clone(),
                created,
                verified: false,
            },
        );
    }

    Ok(CaptchaVO {
        rep_code: 0,
        rep_msg: String::new(),
        original_image_base64: Some(png_base64(&bg)?),
        jigsaw_image_base64: Some(png_base64(&jigsaw)?),
        token: Some(token),
        secret_key: Some(secret),
        captcha_type: Some("blockPuzzle".into()),
    })
}

/// AES-128-ECB + PKCS7 解密（对应前端 `CryptoJS.AES.encrypt(..., key, {mode:ECB,padding:Pkcs7})`）。
fn aes_ecb_decrypt(key: &str, ciphertext_b64: &str) -> Option<String> {
    let key_bytes = key.as_bytes();
    if key_bytes.len() != 16 {
        return None;
    }
    let mut buf = base64::engine::general_purpose::STANDARD
        .decode(ciphertext_b64.trim())
        .ok()?;
    if buf.is_empty() || buf.len() % 16 != 0 {
        return None;
    }
    let cipher = Aes128::new(GenericArray::from_slice(key_bytes));
    for chunk in buf.chunks_mut(16) {
        cipher.decrypt_block(GenericArray::from_mut_slice(chunk));
    }
    let pad = *buf.last()? as usize;
    if pad == 0 || pad > 16 || pad > buf.len() {
        return None;
    }
    if !buf[buf.len() - pad..].iter().all(|b| *b as usize == pad) {
        return None;
    }
    buf.truncate(buf.len() - pad);
    String::from_utf8(buf).ok()
}

/// 校验滑块坐标；成功后将 token 标记为「已验证」（供登录二次校验使用）。
pub fn check_captcha(token: &str, point_json: &str) -> Result<bool> {
    let mut s = store().lock().map_err(|_| Error::Internal("验证码状态锁失败".into()))?;
    let Some(state) = s.get_mut(token) else {
        return Err(Error::biz(1001, "验证码已过期，请刷新"));
    };
    if now_secs().saturating_sub(state.created) >= CAPTCHA_TTL_SECS {
        s.remove(token);
        return Err(Error::biz(1001, "验证码已过期，请刷新"));
    }
    let key = state.secret.clone();
    let expected_x = state.x;
    drop(s);

    let plain = aes_ecb_decrypt(&key, point_json)
        .ok_or_else(|| Error::biz(1001, "验证码校验失败，请刷新重试"))?;
    let value: serde_json::Value =
        serde_json::from_str(&plain).map_err(|_| Error::biz(1001, "验证码校验失败，请刷新重试"))?;
    let x = value
        .get("x")
        .and_then(serde_json::Value::as_f64)
        .ok_or_else(|| Error::biz(1001, "验证码校验失败，请刷新重试"))?;

    if (x - expected_x).abs() > TOLERANCE {
        return Err(Error::biz(1001, "验证失败，请拖动滑块对齐拼图"));
    }

    if let Ok(mut s) = store().lock() {
        if let Some(state) = s.get_mut(token) {
            state.verified = true;
        }
    }
    Ok(true)
}

/// 校验前端提交的 `captchaVerification`（AES(`token---pointJson`)）。
///
/// 成功后立即失效该 token，防止重放。
pub fn verify_captcha_verification(verification: &str) -> bool {
    let Ok(mut s) = store().lock() else {
        return false;
    };
    let mut matched: Option<String> = None;
    for (token, state) in s.iter() {
        if !state.verified {
            continue;
        }
        if let Some(plain) = aes_ecb_decrypt(&state.secret, verification) {
            if plain.starts_with(&format!("{token}---")) {
                matched = Some(token.clone());
                break;
            }
        }
    }
    if let Some(token) = matched {
        if let Some(state) = s.get_mut(&token) {
            state.verified = false;
        }
        return true;
    }
    false
}

/// 当前登录失败次数。
#[must_use]
pub fn login_error_count(username: &str) -> u32 {
    errors()
        .lock()
        .ok()
        .and_then(|m| m.get(username).copied())
        .unwrap_or(0)
}

/// 登录失败 +1，返回新次数。
pub fn increment_login_error(username: &str) -> u32 {
    if let Ok(mut m) = errors().lock() {
        let count = m.get(username).copied().unwrap_or(0) + 1;
        m.insert(username.to_string(), count);
        return count;
    }
    1
}

/// 登录成功，清空失败计数。
pub fn reset_login_error(username: &str) {
    if let Ok(mut m) = errors().lock() {
        m.remove(username);
    }
}

/// 登录前校验：失败次数未达阈值直接放行；达到阈值必须提供有效 `captchaVerification`。
///
/// # Errors
/// - 达到阈值但验证码缺失/无效 → `1002`（前端据此弹滑块验证码）。
pub fn validate_login_captcha(username: &str, verification: Option<&str>) -> Result<()> {
    if login_error_count(username) < LOGIN_ERROR_THRESHOLD {
        return Ok(());
    }
    let provided = verification.map(str::trim).filter(|v| !v.is_empty());
    if provided.is_some_and(verify_captcha_verification) {
        Ok(())
    } else {
        Err(Error::biz(1002, "请完成安全验证"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试用 AES-ECB + PKCS7 加密（与前端 CryptoJS 行为一致）。
    fn aes_ecb_encrypt(key: &str, plain: &str) -> String {
        use aes::cipher::{BlockEncrypt, KeyInit};
        let mut buf = plain.as_bytes().to_vec();
        let pad = 16 - buf.len() % 16;
        buf.extend(std::iter::repeat(pad as u8).take(pad));
        let cipher = Aes128::new(GenericArray::from_slice(key.as_bytes()));
        for chunk in buf.chunks_mut(16) {
            cipher.encrypt_block(GenericArray::from_mut_slice(chunk));
        }
        base64::engine::general_purpose::STANDARD.encode(buf)
    }

    #[test]
    fn captcha_flow_passes_with_correct_x() {
        let vo = new_captcha().expect("生成验证码");
        let token = vo.token.clone().unwrap();
        let secret = vo.secret_key.clone().unwrap();
        assert_eq!(secret.len(), 16);
        assert!(!vo.original_image_base64.unwrap().is_empty());
        assert!(!vo.jigsaw_image_base64.unwrap().is_empty());

        // 读取服务端记录的 x（测试内可见），模拟前端拖动
        let x = {
            let s = store().lock().unwrap();
            s.get(&token).unwrap().x
        };
        let point = serde_json::json!({ "x": x, "y": 5.0 }).to_string();
        let encrypted = aes_ecb_encrypt(&secret, &point);
        assert!(check_captcha(&token, &encrypted).expect("坐标正确应通过"));

        let verification =
            aes_ecb_encrypt(&secret, &format!("{token}---{point}"));
        assert!(verify_captcha_verification(&verification));
        // 重放失败
        assert!(!verify_captcha_verification(&verification));
    }

    #[test]
    fn captcha_flow_rejects_wrong_x() {
        let vo = new_captcha().expect("生成验证码");
        let token = vo.token.clone().unwrap();
        let secret = vo.secret_key.clone().unwrap();
        let point = serde_json::json!({ "x": 1.0, "y": 5.0 }).to_string();
        let encrypted = aes_ecb_encrypt(&secret, &point);
        assert!(check_captcha(&token, &encrypted).is_err());
    }

    #[test]
    fn login_captcha_only_required_after_threshold() {
        let user = "captcha_test_user";
        reset_login_error(user);
        assert!(validate_login_captcha(user, None).is_ok());
        for _ in 0..LOGIN_ERROR_THRESHOLD {
            increment_login_error(user);
        }
        match validate_login_captcha(user, None) {
            Err(Error::Biz { code, .. }) => assert_eq!(code, 1002),
            other => panic!("达到阈值后应要求验证码，实际: {other:?}"),
        }
        reset_login_error(user);
        assert_eq!(login_error_count(user), 0);
    }
}
