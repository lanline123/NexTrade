'use client';

/**
 * 礼品卡卡面。
 * 源码对照：view/pc/pages/giftcard/src/giftCard.vue —— <template> 类名逐条照抄
 * 样式：app/exchange-page.scss → .pg-giftcard-card（旧版 <style> 原样搬运）
 *
 *   .gift-card-box.size-{large|small|middle}
 *     > .gift-card
 *         > .gift-shop-info > .shop-title
 *         > .gift-card-no(.gift-card-label + .gift-card-no-box > .card-no-item + .copy-btn?)
 *         > .gift-card-pwd(.gift-card-label + .card-no-item > span + .copy-btn?)
 *         > .gift-card-info(.gift-card-name + .flex.align-end.gift-card-date > .gift-card-date-text)
 *         > .gift-card-actions-box?(.gift-card-copy-all + .gift-card-divider + .gift-card-show)
 *     > .gift-card-status > .gift-card-status-item
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface GiftCardCardInfo {
  cardNumber?: string;
  cardPassword?: string;
  shopTitle?: string;
  cardGroupName?: string;
  expiredTime?: number | string;
  status?: number | string;
}

interface Props {
  cardInfo: GiftCardCardInfo;
  cardSize?: 'large' | 'middle' | 'small';
  showActions?: boolean;
  statusText?: string;
  onCopyAll?: () => void;
}

function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 旧版 hideCardNumber：卡号每隔 4 位换成 *，只留前 4 后 4 */
function hideNumber(value: string): string {
  if (!value) return '';
  return value.replace(/(.{4})/g, (match, group, offset: number) => (offset < 4 || offset >= value.length - 4 ? match : '*'.repeat(group.length)));
}

export default function GiftCardCard({ cardInfo, cardSize = 'large', showActions = false, statusText, onCopyAll }: Props) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const cardNumber = String(cardInfo.cardNumber || '');
  const cardPassword = String(cardInfo.cardPassword || '');
  const expired = Number(cardInfo.expiredTime || 0);
  const status = statusText ?? '';

  const hiddenNo = useMemo(() => hideNumber(cardNumber), [cardNumber]);
  const hiddenPwd = useMemo(() => cardPassword.replace(/./g, '*'), [cardPassword]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* 浏览器不支持剪贴板时静默忽略，旧版同样没有失败提示 */
    }
  };

  return (
    <div className={`gift-card-box size-${cardSize}`}>
      <div className="gift-card">
        <div className="gift-shop-info">
          <div className="shop-title">{cardInfo.shopTitle}</div>
        </div>
        <div className="gift-card-no">
          <div className="gift-card-label">{t('卡号')}</div>
          <div className="gift-card-no-box">
            <span className="card-no-item">{revealed ? cardNumber : hiddenNo}</span>
          </div>
          {showActions ? (
            <div className="copy-btn" onClick={() => copy(cardNumber)}>
              {t('复制')}
            </div>
          ) : null}
        </div>
        <div className="gift-card-pwd">
          <div className="gift-card-label">{t('密码')}</div>
          <div className="card-no-item">
            <span>{revealed ? cardPassword : hiddenPwd}</span>
          </div>
          {showActions ? (
            <div className="copy-btn" onClick={() => copy(cardPassword)}>
              {t('复制')}
            </div>
          ) : null}
        </div>
        <div className="gift-card-info">
          <div className="gift-card-name">{t(cardInfo.cardGroupName || '')}</div>
          <div className="flex align-end gift-card-date">
            {expired === 0 ? (
              <div className="gift-card-date-text">{t('长期有效')}</div>
            ) : expired ? (
              <div className="gift-card-date-text">
                {t('有效期至')} {formatTimestamp(expired * 1000)}
              </div>
            ) : null}
          </div>
        </div>
        {showActions ? (
          <div className="gift-card-actions-box">
            <div
              className="gift-card-copy-all"
              onClick={() => {
                copy(`${cardNumber} ${cardPassword}`);
                onCopyAll?.();
              }}
            >
              <div className="iconfont-pc icon-fuzhi" />
              <span>{t('复制券码')}</span>
            </div>
            <div className="gift-card-divider" />
            <div className="gift-card-show" onClick={() => setRevealed((prev) => !prev)}>
              <div className={`iconfont-pc ${revealed ? 'icon-xianshi' : 'icon-buxianshi'}`} />
              {revealed ? <span>{t('隐藏券码')}</span> : <span>{t('显示券码')}</span>}
            </div>
          </div>
        ) : null}
      </div>

      <div className="gift-card-status">
        <div className="gift-card-status-item">{status}</div>
      </div>
    </div>
  );
}
