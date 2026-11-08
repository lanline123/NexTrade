'use client';

/**
 * 优惠券卡片（可选择）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/coupon/CouponCard.vue
 *
 * 旧版 CouponCard.vue 渲染一张优惠券：
 * - 左区：couponType === 1 显示 couponMoney（面额），否则显示 couponDiscount + 「折」；
 * - 中区：couponName + startDate ~ endDate（旧版后端格式化好的字符串）；
 * - 右区：按 status 显示动作按钮
 *   · status 1/2 → 「去使用」，点击跳 `/search/?couponId={couponId}`；
 *   · status 4   → 「已使用」；
 *   · status 5   → 「已过期」；
 *   · status 3（未开始）→ 不显示按钮、也不置灰；
 *   - 整卡置灰（disable）条件与旧版一致：status 不是 1/2/3（即 4/5）；
 * - couponDesc 存在时在卡片底部单独一行展示。
 *
 * 新版额外支持「选择」语义（结算页选券用）：传 `selected` + `onSelect` 时整卡可点。
 *
 * 后端契约：`GET /user/coupon/list`（routes/marketing/coupon.rs）返回 UserCouponVO：
 * id / couponId / couponName / couponMoney / couponDiscount / couponDesc / couponType /
 * minOrderAmount / startDate / endDate / status（1 即将过期 2 正常 3 未开始 4 已使用 5 已过期）。
 * 注意：Rust 版 startDate/endDate 是原始秒级时间戳（旧版 Java 是格式化字符串），
 * 展示层用 formatDateTime 补齐旧版 "yyyy-MM-dd HH:mm:ss"（见 src/lib/datetime.ts）。
 */
import { useTranslation } from 'react-i18next';
import FormatPrice from '@/components/FormatPrice';
import { formatDateTime } from '@/lib/datetime';

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
  // 旧版 CouponCard.vue：status 不是 1/2/3 时整卡加 `disable`（4 已使用 / 5 已过期置灰，3 未开始不置灰）
  const disabled = status !== 1 && status !== 2 && status !== 3;

  const handleUse = () => {
    if (onUse) {
      onUse(coupon);
      return;
    }
    if (typeof window !== 'undefined') {
      window.open(`/search/?couponId=${coupon.couponId ?? ''}`);
    }
  };

  // 旧版 CouponCard.vue：status 不是 1/2/3 时整卡加 `disable`
  const containerClass = ['mp-coupon-card', 'coupon-container', disabled ? 'disable' : '', selected ? 'is-selected' : '']
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <div className={`coupon-info${coupon.couponDesc ? ' border' : ''}`}>
        <div className="coupon-off-text">
          <div className="top">
            {Number(coupon.couponType) === 1 ? (
              <div className="price">
                <FormatPrice value={coupon.couponMoney} fontSize="24px" fontWeight={400} />
              </div>
            ) : (
              <div className="discount">
                {coupon.couponDiscount}
                <span>{t('折')}</span>
              </div>
            )}
            <div className="desc">
              {t('优惠')}
              <div className="name">{coupon.couponName}</div>
            </div>
          </div>
          <div className="time-wrap">
            {formatDateTime(coupon.startDate)} {t('-')} {formatDateTime(coupon.endDate)}
          </div>
        </div>
        {status === 2 || status === 1 ? (
          <div className="use-btn enabel" onClick={handleUse}>
            {t('去使用')}
          </div>
        ) : null}
        {status === 4 ? (
          <div className="use-btn disable-btn" onClick={handleUse}>
            {t('已使用')}
          </div>
        ) : null}
        {status === 5 ? (
          <div className="use-btn disable-btn" onClick={handleUse}>
            {t('已过期')}
          </div>
        ) : null}
      </div>
      {coupon.couponDesc ? <div className="coupon-desc">{coupon.couponDesc}</div> : null}
    </>
  );

  if (onSelect) {
    return (
      <button type="button" className={containerClass} onClick={() => onSelect(coupon)}>
        {content}
      </button>
    );
  }

  return <div className={containerClass}>{content}</div>;
}
