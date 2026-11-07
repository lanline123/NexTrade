'use client';

/**
 * 优惠券卡片（可选择）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/coupon/CouponCard.vue
 *
 * 旧版 CouponCard.vue 渲染一张优惠券：
 * - 左区：couponType === 1 显示 couponMoney（面额），否则显示 couponDiscount + 「折」；
 * - 中区：couponName + startDate ~ endDate；
 * - 右区：按 status 显示动作按钮
 *   · status 1/2 → 「去使用」，点击跳 `/search/?couponId={couponId}`；
 *   · status 4   → 「已使用」；
 *   · status 5   → 「已过期」；
 *   · 其余状态（未开始 / 即将过期等）→ 卡片置灰（disable 样式）；
 * - couponDesc 存在时在卡片底部单独一行展示。
 *
 * 新版额外支持「选择」语义（结算页选券用）：传 `selected` + `onSelect` 时整卡可点。
 *
 * 后端契约：`GET /user/coupon/list`（routes/marketing/coupon.rs）返回 UserCouponVO：
 * id / couponId / couponName / couponMoney / couponDiscount / couponDesc / couponType /
 * minOrderAmount / startDate / endDate / status（1 即将过期 2 正常 3 未开始 4 已使用 5 已过期）。
 */
import { useTranslation } from 'react-i18next';

export interface MemberCouponCardData {
  id?: number;
  couponId?: number;
  couponName?: string;
  couponMoney?: number | string;
  couponDiscount?: number | string;
  couponDesc?: string;
  couponType?: number;
  minOrderAmount?: number | string;
  startDate?: string;
  endDate?: string;
  status?: number;
  statusName?: string;
}

/** 旧版 CouponCard.vue：可点「去使用」的状态集合 */
const USABLE_STATUS = [1, 2];

export default function MemberCouponCard({
  coupon,
  selected,
  onSelect,
  onUse,
}: {
  coupon: MemberCouponCardData;
  /** 是否处于选中态（结算页选券） */
  selected?: boolean;
  /** 传入则整卡可点，用于结算页选券 */
  onSelect?: (coupon: MemberCouponCardData) => void;
  /** 「去使用」回调；不传则按旧版跳搜索页 */
  onUse?: (coupon: MemberCouponCardData) => void;
}) {
  const { t } = useTranslation();
  const status = Number(coupon.status ?? 0);
  const usable = USABLE_STATUS.includes(status);
  const disabled = !usable;
  const discount = Number(coupon.couponDiscount || 0);

  const handleUse = () => {
    if (onUse) {
      onUse(coupon);
      return;
    }
    if (typeof window !== 'undefined') {
      window.open(`/search/?couponId=${coupon.couponId ?? ''}`);
    }
  };

  const actionText = status === 4 ? t('已使用') : status === 5 ? t('已过期') : t('去使用');

  const content = (
    <>
      <div className="member-coupon-card__info">
        <div className="member-coupon-card__amount">
          {Number(coupon.couponType) === 1 ? (
            <b className="member-coupon-card__price">
              <small>¥</small>
              {Number(coupon.couponMoney || 0).toFixed(0)}
            </b>
          ) : (
            <b className="member-coupon-card__discount">
              {discount}
              <small>{t('折')}</small>
            </b>
          )}
          <div className="member-coupon-card__name">{coupon.couponName || t('优惠')}</div>
        </div>
        <div className="member-coupon-card__time">
          {coupon.startDate || ''} {t('-')} {coupon.endDate || ''}
        </div>
        <div className="member-coupon-card__action">
          {usable ? (
            <button type="button" className="member-coupon-card__btn" onClick={handleUse}>{actionText}</button>
          ) : (
            <span className="member-coupon-card__btn is-disabled">{actionText}</span>
          )}
        </div>
      </div>
      {coupon.couponDesc ? <div className="member-coupon-card__desc">{coupon.couponDesc}</div> : null}
    </>
  );

  const className = [
    'member-coupon-card',
    disabled ? 'is-disabled' : '',
    selected ? 'is-selected' : '',
  ].filter(Boolean).join(' ');

  if (onSelect) {
    return (
      <button type="button" className={className} onClick={() => onSelect(coupon)}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
