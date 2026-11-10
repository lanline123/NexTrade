'use client';

/**
 * 结算页预售步骤条。
 *
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/order/src/presaleSteps.vue（476 行）。
 * 旧版调用：pages/order/check.vue:191
 *   `<PresaleSteps v-if="!isStore()" :productPresale="productPresale" :presaleStatus="0" :total="total" />`
 *
 * 两种模式：
 * - 定金预售（productPresale.saleMode === 2）：定金 → 尾款 → 发货 三段
 * - 全款预售：全款 → 发货 两段
 *
 * 每段带「规则」悬浮说明（下单规则 / 售后规则），与旧版文案一致。
 */
import { useMemo, useState } from 'react';
import { Popover } from '@douyinfe/semi-ui';

import { useTranslation } from 'react-i18next';

import { formatPrice } from '@/lib/currency';
interface PresaleStepsProps {
  /** 预售信息（productPresale） */
  productPresale?: Record<string, any> | null;
  /** 定金预售状态（结算页传 0） */
  presaleStatus?: number;
  /** 结算合计（total） */
  total?: Record<string, any>;
  /** 配送方式（1 快递 / 2 自提 / 3 同城） */
  deliveryType?: number | null;
}

function formatDurationText(days?: number | string, hours?: number | string): string {
  const d = Number(days ?? 0);
  const h = Number(hours ?? 0);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}天`);
  if (h > 0) parts.push(`${h}小时`);
  return parts.join('');
}

export default function PresaleSteps({ productPresale, presaleStatus = 0, total, deliveryType }: PresaleStepsProps) {
    const { t } = useTranslation();
  const [ruleOpen, setRuleOpen] = useState(false);
  const info = productPresale || {};

  const isDepositPresale = Number(info.saleMode) === 2;

  /** 全款预售金额：totalAmount → unpaidAmount → productAmount */
  const fullPaymentAmount = useMemo(() => {
    const v = total || {};
    return v.totalAmount ?? v.unpaidAmount ?? v.productAmount ?? 0;
  }, [total]);

  /** 当前状态：定金预售取 presaleStatus；全款预售取 total.orderStatus */
  const currentStatus = useMemo(() => {
    if (isDepositPresale) return presaleStatus ?? 0;
    return Number((total || {}).orderStatus ?? 0);
  }, [isDepositPresale, presaleStatus, total]);

  /** 配送方式：显式传入优先，否则从 total 推断 */
  const presaleDeliveryType = useMemo(() => {
    if (deliveryType !== undefined && deliveryType !== null) return Number(deliveryType);
    const v = total || {};
    const shippingTypeName = String(v.shippingTypeName || '');
    if (v.isPickup || shippingTypeName.includes('自提')) return 2;
    if (v?.deliveryOrderInfo?.type === 1 || shippingTypeName.includes('同城')) return 3;
    return 1;
  }, [deliveryType, total]);

  const pendingDeliveryNodeText = presaleDeliveryType === 2 ? t('自提') : presaleDeliveryType === 3 ? t('配送') : t('发货');
  const deliveredNodeText = presaleDeliveryType === 2 || presaleDeliveryType === 3 ? t('已备货') : t('已发货');

  /** 尾款支付时间 */
  const paymentTimeText = useMemo(() => {
    if (!info || Object.keys(info).length === 0) return '';
    if (Number(info.finalPaymentType) === 1) {
      const start = info.finalPaymentRelativeDays
        ? `${t('付定金')}${info.finalPaymentRelativeDays}${t('天')}${t('后')}${t('开始')}`
        : '';
      const duration = formatDurationText(info.finalPaymentRelativeDays, info.finalPaymentDurationHours);
      const end = duration ? `${duration}${t('结束')}` : '';
      if (start && end) return `${start}, ${end}`;
      return start || end || '';
    }
    return info.finalPaymentStartTime ? `${info.finalPaymentStartTime}${t('开始')}` : '';
  }, [info, t]);

  /** 发货时间 */
  const deliverTimeText = useMemo(() => {
    if (!info || Object.keys(info).length === 0) return '';
    if (Number(info.deliveryType) === 1) {
      const duration = formatDurationText(info.deliveryRelativeDays, info.deliveryRelativeHours);
      return `${t('付尾款')}${duration}${t('后')}${pendingDeliveryNodeText}`.trim();
    }
    return info.deliveryDate ? `${info.deliveryDate}${t('开始')}` : '';
  }, [info, pendingDeliveryNodeText, t]);

  /** 全款预售的发货时间 */
  const fullPaymentDeliverTimeText = useMemo(() => {
    if (!info || Object.keys(info).length === 0) return '';
    if (Number(info.deliveryType) === 1) {
      const duration = formatDurationText(info.deliveryRelativeDays, info.deliveryRelativeHours);
      return `${t('付全款')}${duration}${t('后')}`.trim();
    }
    return info.deliveryDate ? `${info.deliveryDate}${t('开始')}` : '';
  }, [info, t]);

  const formatShippingDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const [datePart, timePart] = dateStr.split(' ');
    const [year, month, day] = datePart.split('-');
    return `${year}${t('年')}${month}${t('月')}${day}${t('日')}  ${timePart || ''}`;
  };

  /** 全款预售步骤二文案 */
  const fullPaymentStepTwoText = useMemo(() => {
    const status = currentStatus;
    if (status >= 2 && status !== 3) {
      const shippingTime = (total || {}).shippingTime;
      if (shippingTime) return `${deliveredNodeText}(${formatShippingDate(String(shippingTime))})`;
      return `${deliveredNodeText}`;
    }
    return `${pendingDeliveryNodeText}(${fullPaymentDeliverTimeText})`;
  }, [currentStatus, total, deliveredNodeText, pendingDeliveryNodeText, fullPaymentDeliverTimeText, t]);

  /** 定金预售步骤三文案 */
  const depositPresaleStepThreeText = useMemo(() => {
    const orderStatus = Number((total || {}).orderStatus ?? 0);
    if (orderStatus >= 2 && orderStatus !== 3 && presaleStatus === 2) {
      const shippingTime = (total || {}).shippingTime;
      if (shippingTime) return `${deliveredNodeText}(${formatShippingDate(String(shippingTime))})`;
      return `${deliveredNodeText}`;
    }
    return `${pendingDeliveryNodeText}(${deliverTimeText})`;
  }, [total, presaleStatus, deliveredNodeText, pendingDeliveryNodeText, deliverTimeText, t]);

  /** 规则浮层内容（下单规则 + 售后规则，与旧版一致） */
  const ruleContent = (
    <div className="pc-presale-rule">
      <div className="pc-presale-rule__section">
        <div className="pc-presale-rule__title">{t('下单规则')}</div>
        <div className="pc-presale-rule__item">
          <span>1、</span>
          <span>{t('预售商品，有营销（会员价、优惠券等）时自动推荐使用，若为定金预售则在营销（会员价、优惠券等）的基础上计算尾款，付尾款时以定金的价格为基础计算尾款金额；')}</span>
        </div>
        <div className="pc-presale-rule__item">
          <span>2、</span>
          <span>{t('订单优惠信息将在尾款时计算')}</span>
        </div>
      </div>
      <div className="pc-presale-rule__section">
        <div className="pc-presale-rule__title">{t('售后规则')}</div>
        <div className="pc-presale-rule__item">
          <span>1、</span>
          <span>{t('全款预售商品，支付预售款后可以正常发起售后流程；')}</span>
        </div>
        <div className="pc-presale-rule__item">
          <span>2、</span>
          <span>{t('定金预售商品，未付尾款的订单到期也可支付尾款；付尾款后，可正常申请售后流程')}</span>
        </div>
      </div>
    </div>
  );

  const ruleRef = (
    <Popover
      visible={ruleOpen}
      onVisibleChange={setRuleOpen}
      position="bottom"
      content={ruleContent}
      style={{ maxWidth: 500 }}
    >
      <span className="pc-presale-steps__rule-link">
        <span style={{ color: '#999' }}>|</span>
        <span style={{ color: '#989898' }}>{t('规则')}</span>
        <span style={{ marginLeft: 5, color: '#999' }}>?</span>
      </span>
    </Popover>
  );

  return (
    <div className="pc-presale-steps">
      {isDepositPresale ? (
        <div className="pc-presale-steps__container">
          {/* 步骤1：定金 */}
          <div className="pc-presale-steps__item">
            <div className="pc-presale-steps__content">
              <div className={`pc-presale-steps__dot${currentStatus >= 0 ? ' is-active is-completed' : ''}`} />
              <div className={`pc-presale-steps__text${currentStatus === 0 ? ' is-active' : ''}`}>
                {t('定金')}({t('预售商品，定金不退')}) {ruleRef}
              </div>
            </div>
            <div className={`pc-presale-steps__line${currentStatus > 0 ? ' is-active' : ''}`} />
          </div>
          {/* 步骤2：尾款 */}
          <div className="pc-presale-steps__item">
            <div className="pc-presale-steps__content">
              <div className={`pc-presale-steps__dot${currentStatus >= 1 ? ' is-active is-completed' : ''}`} />
              <div className={`pc-presale-steps__text${currentStatus === 1 ? ' is-active' : ''}`}>
                {t('尾款')}({paymentTimeText || t('待支付')}) {ruleRef}
              </div>
            </div>
            <div className={`pc-presale-steps__line${currentStatus > 1 ? ' is-active' : ''}`} />
          </div>
          {/* 步骤3：发货 */}
          <div className="pc-presale-steps__item">
            <div className="pc-presale-steps__content">
              <div
                className={`pc-presale-steps__dot${
                  currentStatus >= 2 && currentStatus !== 3 ? ' is-active is-completed' : ''
                }`}
              />
              <div className={`pc-presale-steps__text${currentStatus === 2 ? ' is-active' : ''}`}>
                {depositPresaleStepThreeText}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="pc-presale-steps__container">
          {/* 步骤1：全款预售 */}
          <div className="pc-presale-steps__item">
            <div className="pc-presale-steps__content">
              <div className={`pc-presale-steps__dot${currentStatus >= 0 ? ' is-active is-completed' : ''}`} />
              <div className={`pc-presale-steps__text${currentStatus === 0 ? ' is-active' : ''}`}>
                <span className="pc-presale-steps__amount">
                  {t('全款预售')}{formatPrice(Number(fullPaymentAmount || 0))}
                </span>{' '}
                {ruleRef}
              </div>
            </div>
            <div className={`pc-presale-steps__line${currentStatus > 0 ? ' is-active' : ''}`} />
          </div>
          {/* 步骤2：发货 */}
          <div className="pc-presale-steps__item">
            <div className="pc-presale-steps__content">
              <div
                className={`pc-presale-steps__dot${
                  currentStatus >= 1 && currentStatus !== 3 ? ' is-active is-completed' : ''
                }`}
              />
              <div className={`pc-presale-steps__text${currentStatus === 1 ? ' is-active' : ''}`}>
                {fullPaymentStepTwoText}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
