/**
 * AES-128-ECB 加密（PKCS#7 padding，输出 Base64）。
 *
 * 用途：行为验证码（滑块）坐标加密。
 * 后端 crates/services/src/system/captcha.rs 的 `aes_ecb_decrypt` 用
 * AES-128-ECB + PKCS7 解密，密钥为接口返回的 `secretKey`（16 字符）。
 * 前端提交的 `pointJson` 与 `captchaVerification` 都必须是这个格式。
 *
 * 说明：WebCrypto 只支持 CBC/CTR/GCM，不支持 ECB，因此这里手写 AES 分组算法，
 * 密钥来自服务端接口返回（每个验证码独立），不涉及密钥分发问题。
 */

// —— AES S-box / 反 S-box ——
const SBOX = new Uint8Array([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
]);

const INV_SBOX = new Uint8Array(256);
for (let i = 0; i < SBOX.length; i += 1) INV_SBOX[SBOX[i]] = i;

const RCON = new Uint8Array([0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]);

function xtime(a: number): number {
  return ((a << 1) ^ (a & 0x80 ? 0x11b : 0)) & 0xff;
}

function mul(a: number, b: number): number {
  let result = 0;
  let x = a;
  let y = b;
  while (y) {
    if (y & 1) result ^= x;
    x = xtime(x);
    y >>= 1;
  }
  return result & 0xff;
}

/** 生成 AES-128 轮密钥（11 轮 × 16 字节） */
function expandKey(key: Uint8Array): Uint8Array {
  const w = new Uint8Array(176);
  w.set(key);
  for (let i = 16; i < 176; i += 4) {
    let t0 = w[i - 4];
    let t1 = w[i - 3];
    let t2 = w[i - 2];
    let t3 = w[i - 1];
    if (i % 16 === 0) {
      const tmp = t0;
      t0 = SBOX[t1] ^ RCON[i / 16 - 1];
      t1 = SBOX[t2];
      t2 = SBOX[t3];
      t3 = SBOX[tmp];
    }
    w[i] = w[i - 16] ^ t0;
    w[i + 1] = w[i - 15] ^ t1;
    w[i + 2] = w[i - 14] ^ t2;
    w[i + 3] = w[i - 13] ^ t3;
  }
  return w;
}

function addRoundKey(state: Uint8Array, w: Uint8Array, round: number): void {
  const offset = round * 16;
  for (let i = 0; i < 16; i += 1) state[i] ^= w[offset + i];
}

function subBytes(state: Uint8Array, box: Uint8Array): void {
  for (let i = 0; i < 16; i += 1) state[i] = box[state[i]];
}

function shiftRows(state: Uint8Array): void {
  const s = state.slice();
  for (let r = 1; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      state[c * 4 + r] = s[((c + r) % 4) * 4 + r];
    }
  }
}

function invShiftRows(state: Uint8Array): void {
  const s = state.slice();
  for (let r = 1; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      state[((c + r) % 4) * 4 + r] = s[c * 4 + r];
    }
  }
}

function mixColumns(state: Uint8Array): void {
  for (let c = 0; c < 4; c += 1) {
    const i = c * 4;
    const a0 = state[i];
    const a1 = state[i + 1];
    const a2 = state[i + 2];
    const a3 = state[i + 3];
    state[i] = mul(a0, 2) ^ mul(a1, 3) ^ a2 ^ a3;
    state[i + 1] = a0 ^ mul(a1, 2) ^ mul(a2, 3) ^ a3;
    state[i + 2] = a0 ^ a1 ^ mul(a2, 2) ^ mul(a3, 3);
    state[i + 3] = mul(a0, 3) ^ a1 ^ a2 ^ mul(a3, 2);
  }
}

function invMixColumns(state: Uint8Array): void {
  for (let c = 0; c < 4; c += 1) {
    const i = c * 4;
    const a0 = state[i];
    const a1 = state[i + 1];
    const a2 = state[i + 2];
    const a3 = state[i + 3];
    state[i] = mul(a0, 14) ^ mul(a1, 11) ^ mul(a2, 13) ^ mul(a3, 9);
    state[i + 1] = mul(a0, 9) ^ mul(a1, 14) ^ mul(a2, 11) ^ mul(a3, 13);
    state[i + 2] = mul(a0, 13) ^ mul(a1, 9) ^ mul(a2, 14) ^ mul(a3, 11);
    state[i + 3] = mul(a0, 11) ^ mul(a1, 13) ^ mul(a2, 9) ^ mul(a3, 14);
  }
}

/** AES-128 单分组加密（输入 16 字节） */
function encryptBlock(block: Uint8Array, w: Uint8Array): Uint8Array {
  const state = block.slice();
  addRoundKey(state, w, 0);
  for (let round = 1; round < 10; round += 1) {
    subBytes(state, SBOX);
    shiftRows(state);
    mixColumns(state);
    addRoundKey(state, w, round);
  }
  subBytes(state, SBOX);
  shiftRows(state);
  addRoundKey(state, w, 10);
  return state;
}

/** Base64 编码（浏览器原生） */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

/**
 * AES-128-ECB 加密 + PKCS#7 padding，输出 Base64 字符串。
 *
 * @param plain 明文
 * @param key 16 字符密钥（服务端返回的 secretKey）
 */
export function aesEncrypt(plain: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  if (keyBytes.length !== 16) return plain;
  const w = expandKey(keyBytes);

  // PKCS#7 padding
  const data = new TextEncoder().encode(plain);
  const padLen = 16 - (data.length % 16);
  const padded = new Uint8Array(data.length + padLen);
  padded.set(data);
  padded.fill(padLen, data.length);

  const out = new Uint8Array(padded.length);
  for (let i = 0; i < padded.length; i += 16) {
    out.set(encryptBlock(padded.subarray(i, i + 16), w), i);
  }
  return toBase64(out);
}
