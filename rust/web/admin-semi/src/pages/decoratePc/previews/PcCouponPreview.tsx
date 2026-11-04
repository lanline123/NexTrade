/**
 * PC 优惠券模块预览（迁移自旧版 `_shared/coupon/PcCouponPreview.vue`）。
 *
 * - 纯 mock 渲染，不调用接口（与旧版一致：4 张演示券，满减 ×2 + 折扣 ×2）。
 * - props 统一为 `{ data }`，与旧版 `module` 合并默认值后渲染。
 * - 展示结构：可选标题栏 → 领券中心左侧红条 → 右侧券列表 → 竖排「查看更多」。
 * - 空状态：`data` 为空对象时展示旧版空态占位。
 */
import './pcCoupon.css';

/** 旧版 `pcCouponDefaults`（`_shared/coupon/defaults.ts`）。 */
const COUPON_DEFAULTS = {
  showTitle: 0,
  title: '每日领券',
  desc: '天天优惠领不停',
  colorStyle: 0,
  itemBackgroundColor: '#ffffff',
  backgroundColor: '#ffffff',
  itemPadding: 10,
  boxRadius: 8,
  boxPadding: 10,
  boxPaddingTop: 5,
  boxPaddingBottom: 5,
};

type CouponConfig = typeof COUPON_DEFAULTS;

interface MockCoupon {
  couponType: 1 | 2;
  priceInteger?: string;
  priceDecimals?: string;
  couponDiscount?: string;
  couponName: string;
  couponDesc: string;
}

const MOCK_COUPONS: MockCoupon[] = [
  { couponType: 1, priceInteger: '5', priceDecimals: '00', couponName: '满60减5', couponDesc: '可领取' },
  { couponType: 2, couponDiscount: '8', couponName: '折扣券', couponDesc: '可领取' },
  { couponType: 1, priceInteger: '5', priceDecimals: '00', couponName: '满60减5', couponDesc: '可领取' },
  { couponType: 2, couponDiscount: '8', couponName: '折扣券', couponDesc: '可领取' },
];

/** 简单深合并：数组直接覆盖，对象递归合并。 */
function deepMerge<T extends Record<string, any>>(defaults: T, data?: Record<string, any>): T {
  const out: Record<string, any> = { ...defaults };
  Object.entries(data || {}).forEach(([key, value]) => {
    const base = out[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      base &&
      typeof base === 'object' &&
      !Array.isArray(base)
    ) {
      out[key] = deepMerge(base as Record<string, any>, value as Record<string, any>);
    } else if (value !== undefined) {
      out[key] = value;
    }
  });
  return out as T;
}

export default function PcCouponPreview({ data }: { data: Record<string, any> }) {
  const moduleConfig = deepMerge<CouponConfig>(COUPON_DEFAULTS, data);
  const isEmpty = !data || Object.keys(data).length === 0;

  const itemPadding = Number(moduleConfig.itemPadding ?? 0) || 0;
  const boxPadding = Number(moduleConfig.boxPadding ?? 10);
  const boxPaddingTop = Number(moduleConfig.boxPaddingTop ?? 5);
  const boxPaddingBottom = Number(moduleConfig.boxPaddingBottom ?? 5);
  const boxRadius = Number(moduleConfig.boxRadius ?? 8) || 0;

  if (isEmpty) {
    return (
      <div className="pc-coupon" style={{ padding: itemPadding }}>
        <div className="pc-coupon__empty">
          <div className="pc-coupon__empty-bg" />
          <div className="pc-coupon__empty-text">优惠券</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pc-coupon" style={{ padding: itemPadding }}>
      <div
        className="pc-coupon__box"
        style={{
          paddingLeft: boxPadding,
          paddingRight: boxPadding,
          paddingTop: boxPaddingTop,
          paddingBottom: boxPaddingBottom,
          ['--pc-coupon-radius' as any]: `${boxRadius}px`,
        }}
      >
        <div style={{ borderRadius: boxRadius, overflow: 'hidden' }}>
          {Number(moduleConfig.showTitle) === 1 && (
            <div className="pc-coupon__header">
              <div className="pc-coupon__header-title">{moduleConfig.title}</div>
              {moduleConfig.desc ? <div className="pc-coupon__header-desc">{moduleConfig.desc}</div> : null}
            </div>
          )}

          <div className="pc-coupon__main">
            <div className="pc-coupon__tit">
              <div className="pc-coupon__tit-main">
                <p className="pc-coupon__tit-zh">领券中心</p>
                <p className="pc-coupon__tit-en">COUPON</p>
                <p className="pc-coupon__tit-go">
                  GO <em>&gt;&gt;</em>
                </p>
              </div>
              <div className="pc-coupon__tit-edge" />
            </div>

            <div className="pc-coupon__list">
              {MOCK_COUPONS.map((coupon, index) => (
                <div key={index} className="pc-coupon__item">
                  <div className="pc-coupon__item-card">
                    <div className="pc-coupon__detail">
                      <div className="pc-coupon__price">
                        {coupon.couponType === 1 ? (
                          <div className="pc-coupon__price-cash">
                            <span className="pc-coupon__currency">¥</span>
                            <span className="pc-coupon__integer">{coupon.priceInteger}</span>
                            <span className="pc-coupon__decimals">.{coupon.priceDecimals}</span>
                          </div>
                        ) : (
                          <div className="pc-coupon__discount">
                            {coupon.couponDiscount}
                            <span>折</span>
                          </div>
                        )}
                      </div>
                      <div className="pc-coupon__direction">
                        <p className="pc-coupon__sort">{coupon.couponName}</p>
                        <p className="pc-coupon__desc">{coupon.couponDesc}</p>
                      </div>
                    </div>
                    <p className="pc-coupon__use-btn">
                      马上领<em>&nbsp;&gt;</em>
                    </p>
                  </div>
                  <div className="pc-coupon__item-notch" />
                </div>
              ))}
              <div className="pc-coupon__more">
                <span className="pc-coupon__more-text">查看更多</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
