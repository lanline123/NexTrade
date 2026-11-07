'use client';

/**
 * 物流轨迹弹窗（PC 会员中心 · 订单列表 / 订单详情共用）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/order/LogisticsTracking.vue
 *
 * 旧版行为：
 * - 组件挂载即调 `GET /user/order/shippingInfo?id=`，取 traces 列表；
 * - 头部展示「快递公司：【X】，快递单号：【Y】」（自提/门店配送只展示快递类型）；
 * - 轨迹节点竖线时间线，首个节点高亮（已签收时用橙色）；
 * - 无数据时展示「查无信息，请刷新后重试或者联系客服！」。
 *
 * 后端契约：`GET /user/order/shippingInfo?id=`（routes/trade/user_order.rs）返回
 * ShippingResult { shipperCode, logisticCode, state, stateEx, traces[] }，
 * traces 节点字段 acceptTime / acceptStation / action / location。
 */
import { useCallback, useEffect, useState } from 'react';
import { Modal, Spin, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';

interface TraceNode {
  acceptTime?: string;
  acceptStation?: string;
  action?: string;
  location?: string;
  /** 旧版 el-rate 用的签收标记（后端暂未下发，保留兼容） */
  checkpointStatus?: string;
}

interface ShippingResult {
  shipperCode?: string;
  logisticCode?: string;
  state?: string;
  stateEx?: string;
  traces?: TraceNode[];
}

export default function MemberLogisticsDialog({
  visible,
  orderId,
  trackingNo,
  logisticsName,
  shippingMethod,
  onClose,
}: {
  visible: boolean;
  orderId: number;
  /** 订单上的快递单号（列表行数据） */
  trackingNo?: string;
  /** 订单上的快递公司名（列表行数据） */
  logisticsName?: string;
  /** 配送方式：1 快递 2 自提 3 同城 */
  shippingMethod?: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [traces, setTraces] = useState<TraceNode[]>([]);
  const [shipperCode, setShipperCode] = useState('');
  const [logisticCode, setLogisticCode] = useState('');

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const result = await apiGet<ShippingResult | TraceNode[]>('user/order/shippingInfo', { id: orderId });
      if (Array.isArray(result)) {
        setTraces(result);
        setShipperCode('');
        setLogisticCode('');
      } else {
        setTraces(Array.isArray(result?.traces) ? result.traces : []);
        setShipperCode(String(result?.shipperCode || ''));
        setLogisticCode(String(result?.logisticCode || ''));
      }
    } catch (error) {
      setTraces([]);
      Toast.error({ content: error instanceof Error ? error.message : t('物流查询失败') });
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [visible, load]);

  const company = logisticsName || shipperCode;
  const tracking = trackingNo || logisticCode;

  return (
    <Modal
      title={t('物流跟踪')}
      visible={visible}
      width={770}
      footer={null}
      onCancel={onClose}
    >
      <div className="member-logistics">
        {loading ? (
          <div className="member-logistics__loading"><Spin /></div>
        ) : (
          <>
            <div className="member-logistics__head">
              {Number(shippingMethod) === 1 ? (
                <>
                  {t('快递公司')}：【{company || '-'}】，{t('快递单号')}：【{tracking || '-'}】
                </>
              ) : (
                <>{t('快递类型')}：{company || '-'}</>
              )}
            </div>
            {traces.length ? (
              <ul className="member-logistics__list">
                {traces.map((node, index) => {
                  const delivered = node.checkpointStatus === 'delivered';
                  const isFirst = index === 0;
                  return (
                    <li key={index} className={`${isFirst ? 'is-first' : ''}${delivered && isFirst ? ' is-delivered' : ''}`}>
                      <i aria-hidden="true" />
                      <div>
                        <span className="member-logistics__station">{node.acceptStation || node.action || ''}</span>
                        <span className="member-logistics__time">{node.acceptTime || ''}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="member-logistics__empty">{t('查无信息，请刷新后重试或者联系客服！')}</div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
