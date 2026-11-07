'use client';

/**
 * 行为验证码（滑块拼图）。
 *
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/verifition/Verify/VerifySlide.vue
 * （419 行 AJ-Captcha 封装）。
 *
 * 协议（与后端 crates/services/src/system/captcha.rs 对齐）：
 * - GET  /api/common/verification/captcha → { originalImageBase64, jigsawImageBase64,
 *                                            token, secretKey, captchaType }
 * - POST /api/common/verification/check    → { captchaType, pointJson, token }
 *   pointJson = AES-ECB(secretKey, JSON.stringify({x, y:5.0}))，Base64
 * - 校验成功后生成 captchaVerification = AES-ECB(secretKey, `${token}---${JSON}`)
 *   （后端 verify_captcha_verification 解密比对），登录/发短信时随 verifyToken 提交。
 *
 * 旧版是「失败才弹」（登录接口返回 code 1002 时 verify.show()），这里保持同样策略：
 * 由父组件通过 open() 主动打开。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Toast } from '@douyinfe/semi-ui';

import { useTranslation } from 'react-i18next';
import { aesEncrypt } from '@/lib/crypto';

interface CaptchaData {
  originalImageBase64?: string;
  jigsawImageBase64?: string;
  token?: string;
  secretKey?: string;
  captchaType?: string;
}

interface VerifySlideProps {
  /** 成功回调，参数为 captchaVerification（旧版 okCallback 的 e.verifyToken） */
  onSuccess: (verifyToken: string) => void;
  /** 校验失败回调 */
  onError?: () => void;
  /** 受控显示 */
  open: boolean;
  onClose: () => void;
}

const IMG_WIDTH = 310;
const IMG_HEIGHT = 155;

export default function VerifySlide({ onSuccess, onError, open, onClose }: VerifySlideProps) {
    const { t } = useTranslation();
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [moveLeft, setMoveLeft] = useState(0);
  const [status, setStatus] = useState<'idle' | 'moving' | 'success' | 'fail'>('idle');
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);

  const loadCaptcha = useCallback(async () => {
    setLoading(true);
    setStatus('idle');
    setMoveLeft(0);
    try {
      const response = await fetch('/api/common/verification/captcha', { credentials: 'include' });
      const json = await response.json();
      const data = (json?.data ?? json) as CaptchaData;
      if (!data?.token) throw new Error(json?.msg || '验证码加载失败');
      setCaptcha(data);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('验证码加载失败') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) void loadCaptcha();
  }, [open, loadCaptcha]);

  /** 鼠标按下 */
  const onMouseDown = (event: React.MouseEvent) => {
    if (status === 'success' || status === 'fail' || checking) return;
    draggingRef.current = true;
    startXRef.current = event.clientX - moveLeft;
  };

  /** 鼠标移动 */
  const onMouseMove = (event: React.MouseEvent) => {
    if (!draggingRef.current) return;
    const track = trackRef.current;
    if (!track) return;
    const max = track.clientWidth - 48;
    const next = Math.max(0, Math.min(max, event.clientX - startXRef.current));
    setMoveLeft(next);
    setStatus('moving');
  };

  /** 校验 */
  const verify = useCallback(
    async (left: number) => {
      const token = captcha?.token;
      const secretKey = captcha?.secretKey;
      if (!token) return;
      setChecking(true);
      // 旧版：moveLeftDistance = (滑块左偏移 * 310) / 图片实际宽度
      const track = trackRef.current;
      const imgWidth = track?.clientWidth || IMG_WIDTH;
      const x = (left * IMG_WIDTH) / imgWidth;
      const point = JSON.stringify({ x, y: 5.0 });
      const pointJson = secretKey ? aesEncrypt(point, secretKey) : point;
      try {
        const response = await fetch('/api/common/verification/check', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captchaType: captcha?.captchaType || 'blockPuzzle', pointJson, token }),
        });
        const json = await response.json();
        if (json?.code !== undefined && json.code !== 0) {
          throw new Error(json?.msg || json?.message || '验证失败');
        }
        setStatus('success');
        const verification = secretKey
          ? aesEncrypt(`${token}---${point}`, secretKey)
          : `${token}---${point}`;
        setTimeout(() => {
          onSuccess(verification);
          onClose();
        }, 400);
      } catch (error) {
        setStatus('fail');
        Toast.error({ content: error instanceof Error ? error.message : t('验证失败，请拖动滑块对齐拼图') });
        onError?.();
        setTimeout(() => {
          void loadCaptcha();
        }, 1000);
      } finally {
        setChecking(false);
        draggingRef.current = false;
      }
    },
    [captcha, loadCaptcha, onClose, onError, onSuccess, t],
  );

  /** 鼠标松开 */
  const onMouseUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (status !== 'moving') return;
    void verify(moveLeft);
  };

  if (!open) return null;

  return (
    <div className="pc-verify-mask" onClick={onClose}>
      <div className="pc-verify" onClick={(event) => event.stopPropagation()}>
        <div className="pc-verify__head">
          <span className="pc-verify__title">{t('请完成安全验证')}</span>
          <button type="button" className="pc-verify__close" onClick={onClose} aria-label={t('关闭')}>×</button>
        </div>

        <div className="pc-verify__body">
          {loading ? (
            <div className="pc-verify__loading">{t('加载中...')}</div>
          ) : (
            <>
              <div
                className="pc-verify__canvas"
                style={{ width: IMG_WIDTH, height: IMG_HEIGHT }}
                ref={trackRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              >
                {captcha?.originalImageBase64 ? (
                  <img
                    className="pc-verify__bg"
                    src={`data:image/png;base64,${captcha.originalImageBase64}`}
                    alt=""
                    draggable={false}
                  />
                ) : null}
                {captcha?.jigsawImageBase64 ? (
                  <img
                    className={`pc-verify__block${status === 'success' ? ' is-success' : ''}${status === 'fail' ? ' is-fail' : ''}`}
                    src={`data:image/png;base64,${captcha.jigsawImageBase64}`}
                    alt=""
                    style={{ left: `${moveLeft}px` }}
                    draggable={false}
                  />
                ) : null}
                <button type="button" className="pc-verify__refresh" onClick={() => void loadCaptcha()} aria-label={t('刷新')}>
                  ↻
                </button>
              </div>

              <div className="pc-verify__track">
                <div className="pc-verify__bar" style={{ width: `${moveLeft + 48}px` }} />
                <div
                  className={`pc-verify__slider${status === 'success' ? ' is-success' : ''}${status === 'fail' ? ' is-fail' : ''}`}
                  style={{ left: `${moveLeft}px` }}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                >
                  {status === 'success' ? '✓' : status === 'fail' ? '✕' : '⇢'}
                </div>
                <span className="pc-verify__tip">
                  {status === 'success' ? t('验证成功') : status === 'fail' ? t('验证失败，请重试') : t('拖动滑块完成拼图')}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
