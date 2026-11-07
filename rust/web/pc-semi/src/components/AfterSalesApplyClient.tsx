'use client';

/**
 * 售后申请页（PC 会员中心）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/return/Info.vue
 *
 * 旧版表单字段：
 * - 商品表：商品图 / 货号 productSn / 商品名 / 规格 / 单价 / 购买数量 / 小计 /
 *   可售后数量 canApplyQuantity / 售后数量（el-input-number，max=canApplyQuantity，min=0，
 *   赠品 isGift===1 时禁用并锁定为 canApplyQuantity）；
 * - 售后类型（aftersaleType 单选；订单已发货时移除「退货/退款」）；
 * - 售后原因（aftersaleReason 下拉，受 afterSalesReasonEnabled 控制）；
 * - 预计退款金额（只读，按所选数量 × (attrPrice + price) 实时计算）；
 * - 问题描述 + 上传凭证（最多 5 张）；
 * - 全积分兑换订单（isExchangeOrder===1 且 pointsAmount>0 且总额/已付均为 0）特殊分支：
 *   退款金额恒为 0、售后数量默认取满。
 *
 * 本次补齐的字段（旧版有、新版缺）：
 * - 「预计退款金额」只读字段（旧版 Info.vue:104-106）；
 * - 「货号 productSn」展示（旧版 Info.vue:50）；
 * - 售后数量下限 0（新版原来强制 ≥1）与赠品锁定；
 * - 全积分兑换特殊分支（旧版 Info.vue:171-202）。
 *
 * 后端契约：
 * - GET  /user/aftersales/config?orderId=  售后类型/原因/开关
 * - GET  /user/aftersales/applyData?orderId=&itemId=  商品明细 + 订单
 * - POST /user/aftersales/create             提交（支持 refundAmount）
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input, Select, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface ApplyItem {
  itemId: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  price?: number;
  quantity?: number;
  canApplyQuantity?: number;
  isGift?: number;
  /** 含税单价（旧版 refundAmount 计算含 attrPrice） */
  attrPrice?: number;
  skuData?: Array<{ value?: string }>;
}

interface ApplyData {
  list?: ApplyItem[];
  order?: {
    orderId?: number;
    orderSn?: string;
    orderStatus?: number;
    totalAmount?: number;
    paidAmount?: number;
    pointsAmount?: number;
    isExchangeOrder?: number;
  };
}

interface ApplyConfig {
  aftersaleType?: Record<string, string>;
  aftersaleReason?: string[];
  afterSalesReasonEnabled?: number;
}

/** 旧版 return/Info.vue：金额近似为 0 的判断（规避浮点误差） */
function isZeroMoney(value: unknown): boolean {
  return Math.abs(Number(value ?? 0)) < 0.005;
}

export default function AfterSalesApplyClient({ orderId, itemId }: { orderId: number; itemId: number }) {
    const { t } = useTranslation();
    const [data, setData] = useState<ApplyData | null>(null);
    const [config, setConfig] = useState<ApplyConfig>({});
    const [quantities, setQuantities] = useState<Record<number, number>>({});
    const [type, setType] = useState(1);
    const [reason, setReason] = useState('');
    const [description, setDescription] = useState('');
    /** 源码 return/Info.vue 问题描述凭证图片 pics */
    const [pics, setPics] = useState<Array<Record<string, unknown>>>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [needLogin, setNeedLogin] = useState(false);

    useEffect(() => {
        Promise.all([
            apiGet<ApplyConfig>('user/aftersales/config', { orderId }),
            apiGet<ApplyData>('user/aftersales/applyData', { orderId, itemId: itemId || undefined }),
        ])
            .then(([configResult, dataResult]) => {
                setConfig(configResult || {});
                setData(dataResult || {});
                const initial: Record<number, number> = {};
                (dataResult?.list || []).forEach((item) => {
                    // 旧版：赠品默认取满可售后数量，普通商品默认 0
                    initial[item.itemId] = Number(item.isGift) === 1 ? Number(item.canApplyQuantity || 0) : 0;
                });
                // 单商品售后场景：直接选中该商品并置 1
                if (itemId) {
                    const target = (dataResult?.list || []).find((item) => item.itemId === itemId);
                    if (target) initial[target.itemId] = Math.min(1, Number(target.canApplyQuantity || 1));
                }
                setQuantities(initial);
                setReason(configResult?.aftersaleReason?.[0] || '');
            })
            .catch((error) => {
                const message = error instanceof Error ? error.message : '';
                setNeedLogin(message.includes('登录') || message.includes('401'));
                Toast.error({ content: message || t('售后数据加载失败') });
            })
            .finally(() => setLoading(false));
    }, [orderId, itemId]);

    /** 旧版 return/Info.vue：全积分兑换且无现金支付 */
    const fullPointsExchange = useMemo(() => {
        const order = data?.order;
        if (!order) return false;
        return (
            Number(order.isExchangeOrder) === 1 &&
            Number(order.pointsAmount ?? 0) > 0 &&
            isZeroMoney(order.totalAmount) &&
            isZeroMoney(order.paidAmount)
        );
    }, [data]);

    /**
     * 旧版 return/Info.vue fetchAfterSalesConfig：
     * 订单状态为 1（待发货）时移除「退货/退款」售后类型。
     */
    const aftersaleTypeOptions = useMemo(() => {
      const options = Object.entries(config.aftersaleType || { '1': '退货/退款', '2': '仅退款' });
      if (Number(data?.order?.orderStatus ?? -1) !== 1) return options;
      return options.filter(([, label]) => label !== '退货/退款');
    }, [config.aftersaleType, data?.order?.orderStatus]);

    const selectedItems = useMemo(
        () =>
            Object.entries(quantities)
                .filter(([, number]) => Number(number) > 0)
                .map(([id, number]) => ({ orderItemId: Number(id), number: Number(number) })),
        [quantities],
    );

    /**
     * 旧版 return/Info.vue 的 watch：按所选数量 × (attrPrice + price) 计算预计退款金额。
     * 全积分兑换订单退款金额恒为 0。
     */
    const refundAmount = useMemo(() => {
        if (fullPointsExchange) return 0;
        let total = 0;
        (data?.list || []).forEach((item) => {
            const number = Number(quantities[item.itemId] || 0);
            if (number <= 0) return;
            const unit = Number(item.attrPrice || 0) + Number(item.price || 0);
            total += number * unit;
        });
        return Number(total.toFixed(2));
    }, [data, quantities, fullPointsExchange]);

    const toggleItem = (item: ApplyItem, checked: boolean) => {
        setQuantities((current) => {
            const next = { ...current };
            if (checked) next[item.itemId] = Math.min(1, Number(item.canApplyQuantity || 1));
            else delete next[item.itemId];
            return next;
        });
    };

  /** 源码 form/src/UploadImage.vue：凭证上传 /api/user/user/uploadImg */
  const uploadPic = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      Toast.error({ content: '只能上传 2M 以内的图片' });
      return;
    }
    setUploading(true);
    try {
      const token = localStorage.getItem('accessToken') || '';
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/user/user/uploadImg', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
        credentials: 'include',
      });
      const json = await response.json();
      if (json?.code !== undefined && json.code !== 0) {
        Toast.error({ content: String(json?.msg || json?.message || t('上传失败')) });
        return;
      }
      const data = json?.data;
      const url = typeof data === 'string' ? data : String(data?.picUrl || data?.url || '');
      if (url) setPics((current) => [...current, { picUrl: url, picThumb: String(data?.picThumb || url) }]);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '上传失败' });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!selectedItems.length) {
      Toast.warning({ content: '请选择售后商品' });
      return;
    }
    setSubmitting(true);
    try {
      await apiPost('user/aftersales/create', {
        orderId,
        aftersaleType: type,
        aftersaleReason: reason,
        description,
        pics,
        // 预计退款金额（旧版 return/Info.vue 随数量实时计算后提交）
        refundAmount,
        items: selectedItems,
      });
      Toast.success({ content: '售后申请已提交' });
      window.location.replace('/member/aftersales');
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Card className="cart-state">{t('售后申请数据加载中...')}</Card>;
  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>{t('登录后申请售后')}</h2>
        <Link href={`/login?redirect=/member/aftersales/apply?orderId=${orderId}`}><Button theme="solid" type="primary">{t('去登录')}</Button></Link>
      </Card>
    );
  }

  return (
    <div className="member-aftersales-apply">
      <Card className="member-card" title={t('订单 {id}', { id: data?.order?.orderSn || String(orderId) })}>
        <div className="member-aftersales-apply__items">
          {(data?.list || []).map((item) => {
            const max = Number(item.canApplyQuantity || item.quantity || 1);
            const isGift = Number(item.isGift) === 1;
            // 旧版：赠品（isGift===1）数量锁定为可售后数量且不可编辑
            const number = isGift ? max : Number(quantities[item.itemId] || 0);
            const checked = number > 0;
            return (
              <div key={item.itemId} className="member-aftersales-apply__item">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isGift}
                  onChange={(event) => toggleItem(item, event.target.checked)}
                />
                <img src={item.picThumb || ''} alt={item.productName || ''} />
                <div>
                  <b>{item.productName}</b>
                  {/* 旧版 return/Info.vue:50：货号 productSn */}
                  {item.productSn ? <span className="member-aftersales-apply__sn">货号：{item.productSn}</span> : null}
                  <span>{item.skuData?.map((sku) => sku.value).filter(Boolean).join(' / ')}</span>
                  <span>可售后数量：{max}</span>
                </div>
                <span>¥ {Number(item.price || 0).toFixed(2)}</span>
                <Input
                  type="number"
                  value={String(number)}
                  disabled={isGift || !checked}
                  onChange={(value) => {
                    // 旧版 el-input-number：min=0、max=canApplyQuantity
                    const next = Math.max(0, Math.min(max, Number(value) || 0));
                    setQuantities((current) => ({ ...current, [item.itemId]: next }));
                  }}
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="member-card" title={t('售后信息')}>
        <div className="member-aftersales-apply__form">
          <label>{t('售后类型')}</label>
          <Select value={type} onChange={(value) => setType(Number(value))}>
            {aftersaleTypeOptions.map(([key, label]) => (
              <Select.Option key={key} value={Number(key)}>{label}</Select.Option>
            ))}
          </Select>
          <label>{t('售后原因')}</label>
          {Number(config.afterSalesReasonEnabled ?? 1) === 1 && config.aftersaleReason?.length ? (
            <Select value={reason} onChange={(value) => setReason(String(value))}>
              {config.aftersaleReason.map((item) => <Select.Option key={item} value={item}>{item}</Select.Option>)}
            </Select>
          ) : (
            <Input value={reason} onChange={setReason} placeholder={t('请输入售后原因')} />
          )}
          {/* 旧版 return/Info.vue:104-106：预计退款金额（只读） */}
          <label>{t('预计退款金额')}</label>
          <Input value={`¥ ${refundAmount.toFixed(2)}`} readOnly disabled placeholder={t('请输入申请金额')} />
          <label>{t('问题描述')}</label>
          <Input value={description} onChange={setDescription} placeholder={t('请描述遇到的问题')} />
        </div>

        {/* 源码 return/Info.vue：上传凭证图片（最多 5 张，单张 2M） */}
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>{t('上传凭证')}</div>
          <div className="aftersales-pics">
            {pics.map((pic, index) => (
              <span className="aftersales-pics__item" key={index}>
                <img src={String(pic.picThumb || pic.picUrl || '')} alt={t('凭证')} />
                <button type="button" onClick={() => setPics((current) => current.filter((_, i) => i !== index))}>×</button>
              </span>
            ))}
            {pics.length < 5 ? (
              <label className="aftersales-pics__pick">
                {uploading ? t('上传中...') : '+ 上传'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPic(file);
                    event.target.value = '';
                  }}
                />
              </label>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="member-aftersales-apply__actions">
        <Link href="/member/aftersales">{t('返回售后列表')}</Link>
        <Button theme="solid" type="primary" size="large" loading={submitting} disabled={!selectedItems.length} onClick={submit}>{t('提交申请')}</Button>
      </div>
    </div>
  );
}
