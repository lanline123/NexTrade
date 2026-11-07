'use client';

/**
 * 取消订单原因弹窗（PC 会员中心 · 订单列表 / 订单详情共用）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/order/CancelOrderReasonDialog.vue
 *
 * 旧版行为（逐条对齐）：
 * - 打开弹窗时先拉 `GET /user/order/reasonConfig`，原因列表取 `cancelOrderReasonList`；
 * - `afterSalesReasonEnabled === 1` → 弹出单选原因弹窗，未选原因时「确定」禁用；
 * - 开关关闭 → 不弹原因选择，直接二次确认「确认要取消该订单吗」；
 * - 提交 `POST /user/order/cancelOrder`，参数 `{ id, description }`（description 为选中原因）。
 *
 * 后端契约说明：
 * - Rust `GET /user/order/reasonConfig` 当前只返回 `afterSalesReasonEnabled` +
 *   `afterSalesReasonList`（见 crates/core/src/models/trade/user_order.rs::ReasonConfigVO），
 *   **未**返回 Java 版的 `cancelOrderReasonList`。因此这里做兼容取值：
 *   优先 `cancelOrderReasonList`，缺失时回落 `afterSalesReasonList`，
 *   避免后端未补字段时弹窗变成空列表。
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Radio, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';

interface ReasonConfig {
  afterSalesReasonEnabled?: number;
  /** Java 版字段：取消未支付订单原因列表（Rust 后端暂缺） */
  cancelOrderReasonList?: string[];
  /** 兼容字段：旧版售后原因列表 */
  afterSalesReasonList?: string[];
}

export default function MemberCancelOrderDialog({
  visible,
  orderId,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  orderId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [reasons, setReasons] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** 原因配置已就绪且开关开启 → 展示单选原因弹窗 */
  const [reasonEnabled, setReasonEnabled] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const config = await apiGet<ReasonConfig>('user/order/reasonConfig');
      const list = Array.isArray(config?.cancelOrderReasonList) && config.cancelOrderReasonList.length
        ? config.cancelOrderReasonList
        : Array.isArray(config?.afterSalesReasonList)
          ? config.afterSalesReasonList
          : [];
      setReasons(list);
      setSelected((current) => (list.includes(current) ? current : ''));
      return { enabled: Number(config?.afterSalesReasonEnabled ?? 0) === 1, list };
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('获取取消原因失败') });
      return { enabled: false, list: [] as string[] };
    } finally {
      setLoading(false);
    }
  }, [t]);

  // 打开时加载原因配置；开关关闭时直接走「无原因二次确认」
  useEffect(() => {
    if (!visible || !orderId) return;
    let cancelled = false;
    void (async () => {
      const { enabled, list } = await loadConfig();
      if (cancelled) return;
      setReasonEnabled(enabled && list.length > 0);
      if (!enabled || !list.length) {
        // 旧版：开关关闭 → cancelWithoutReason()，直接确认框，不展示原因单选
        Modal.confirm({
          title: t('确认要取消该订单吗'),
          okText: t('确定'),
          cancelText: t('取消'),
          onOk: async () => {
            try {
              await apiPost('user/order/cancelOrder', { id: orderId });
              Toast.success({ content: t('取消订单成功') });
              onSuccess();
            } catch (error) {
              Toast.error({ content: error instanceof Error ? error.message : t('取消失败') });
            }
          },
        });
        onClose();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, orderId, loadConfig, onClose, onSuccess, t]);

  const submit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      await apiPost('user/order/cancelOrder', { id: orderId, description: selected });
      Toast.success({ content: t('取消订单成功') });
      onClose();
      onSuccess();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('取消失败') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={t('请选择取消订单原因')}
      visible={visible && reasonEnabled}
      width={480}
      closeOnEsc
      onCancel={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={submitting} disabled={!selected || loading} onClick={() => void submit()}>
            {t('确定')}
          </Button>
        </>
      }
    >
      <Radio.Group value={selected} onChange={(event) => setSelected(String(event.target.value ?? ''))}>
        <div className="member-reason-list">
          {reasons.map((reason) => (
            <Radio key={reason} value={reason}>{reason}</Radio>
          ))}
        </div>
      </Radio.Group>
    </Modal>
  );
}
