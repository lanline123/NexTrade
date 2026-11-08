'use client';

/**
 * 售后申请页（PC 会员中心）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/return/Info.vue
 *
 * 结构与类名逐条照抄旧版模板，全部落在 `.mp-return-info` 包裹层下
 * （该层样式由 scripts/gen-member-pages-scss.mjs 抽取本页 <style scoped>，见 app/member-pages.scss）：
 *
 *   .info-row.mp-return-info
 *     > .title-or-tabs > .tag-and-input > .tig-tabs > .tab(售后申请 / 申请记录)
 *     > .log-return-content
 *         > .info-card > table
 *             thead.table-header > th.header-cell（商品名称 / 商品价格 / 购买数量 / 小计 / 可售后数量 / 售后数量）
 *             tbody > tr > td：.nuxt(img.pro_pic + div.text-ellipsis > ul > li)、价格、数量、小计、可售后数量、
 *                              el-input-number（赠品禁用）
 *         > .file-card > .el-form.form-body（label-width="auto"）
 *             el-form-item：售后类型(.el-radio-group) / 售后原因(el-select) / 预计退款金额 / 问题描述(textarea)
 *                           / 上传凭证 / 空标签 + 提交
 *
 * 业务逻辑与请求层保持原样（config / applyData / create 三个接口未动）。
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';
import FormatPrice from '@/components/FormatPrice';

import { useTranslation } from 'react-i18next';
interface ApplyItem {
  itemId: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  seoLink?: string;
  productSn2?: string;
  price?: number;
  quantity?: number;
  canApplyQuantity?: number;
  subtotal?: number;
  isGift?: number;
  /** 含税单价（旧版 refundAmount 计算含 attrPrice） */
  attrPrice?: number;
  skuData?: Array<{ name?: string; value?: string }>;
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

/** 旧版 return/Info.vue 的 menuList：售后申请 / 申请记录 */
const RETURN_MENU = [
  { label: '售后申请', url: '/member/return/info' },
  { label: '申请记录', url: '/member/return/log' },
];

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
      window.location.replace('/member/return/log');
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setSubmitting(false);
    }
  };

  if (needLogin) {
    return (
      <div className="info-row mp-return-info">
        <div className="log-return-content">
          <div className="no-result">
            <span>{t('登录后申请售后')}</span>
            <Link className="font-color" href={`/login?redirect=/member/return/info?orderId=${orderId}`}>{t('去登录')}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="info-row mp-return-info">
      <div className="title-or-tabs">
        <div className="tag-and-input">
          <div className="tig-tabs">
            {RETURN_MENU.map((menu) => (
              <Link key={menu.url} href={menu.url} className={`tab${menu.url === '/member/return/info' ? ' active' : ''}`}>
                <p><span>{t(menu.label)}</span></p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="log-return-content">
        {loading ? null : (
          <>
            <div className="info-card">
              <table>
                <thead className="table-header">
                  <tr>
                    <th className="header-cell">{t('商品名称')}</th>
                    <th className="header-cell" style={{ width: 90 }}>{t('商品价格')}</th>
                    <th className="header-cell" style={{ width: 90 }}>{t('购买数量')}</th>
                    <th className="header-cell" style={{ width: 90 }}>{t('小计')}</th>
                    <th className="header-cell" style={{ width: 90 }}>{t('可售后数量')}</th>
                    <th className="header-cell" style={{ width: 90 }}>{t('售后数量')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.list || []).map((item) => {
                    const max = Number(item.canApplyQuantity || item.quantity || 1);
                    const isGift = Number(item.isGift) === 1;
                    const number = isGift ? max : Number(quantities[item.itemId] || 0);
                    return (
                      <tr key={item.itemId}>
                        <td>
                          <Link
                            className="nuxt"
                            title={item.productName}
                            href={`/item/${item.seoLink || item.itemId}`}
                            target="_blank"
                          >
                            <img className="pro_pic" src={item.picThumb || ''} alt={item.productName || ''} loading="lazy" />
                            <div className="text-ellipsis">
                              <ul>
                                <li>{t('货号')}：{item.productSn}</li>
                                <li>{item.productName}</li>
                                <li>
                                  {(item.skuData || []).map((sku, index) => (
                                    <span key={`${item.itemId}-${index}`}>
                                      <span className="name">{t(String(sku.name || ''))}：</span>
                                      <span className="value">{t(String(sku.value || ''))}</span>
                                      {index < (item.skuData?.length || 0) - 1 ? <span>；</span> : null}
                                    </span>
                                  ))}
                                </li>
                              </ul>
                            </div>
                          </Link>
                        </td>
                        <td>
                          <FormatPrice value={item.price} className="mp-price" />
                        </td>
                        <td>{item.quantity}</td>
                        <td>
                          <FormatPrice value={item.subtotal} className="mp-price" />
                        </td>
                        <td>{max}</td>
                        <td>
                          <span className="el-input-number">
                            <span className="el-input">
                              <input
                                className="el-input__inner"
                                value={String(number)}
                                disabled={isGift}
                                inputMode="numeric"
                                placeholder={t('请输入数量')}
                                aria-label={t('售后数量')}
                                onChange={(event) => {
                                  // 旧版 el-input-number：min=0、max=canApplyQuantity
                                  const next = Math.max(0, Math.min(max, Number(event.target.value) || 0));
                                  setQuantities((current) => ({ ...current, [item.itemId]: next }));
                                }}
                              />
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="file-card">
              <div className="el-form form-body mp-el-form--auto">
                <div className="el-form-item">
                  <label className="el-form-item__label">{t('售后类型')}：</label>
                  <div className="el-form-item__content">
                    <div className="el-radio-group">
                      {aftersaleTypeOptions.map(([key, label]) => (
                        <label key={key} className="tab flex align-center">
                          <input
                            type="radio"
                            className="mp-el-radio__original"
                            name="aftersaleType"
                            checked={type === Number(key)}
                            onChange={() => setType(Number(key))}
                          />
                          <span className={`mp-el-radio__inner${type === Number(key) ? ' is-checked' : ''}`} />
                          <span className="mp-el-radio__label">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {Number(config.afterSalesReasonEnabled ?? 1) === 1 && config.aftersaleReason?.length ? (
                  <div className="el-form-item">
                    <label className="el-form-item__label">{t('售后原因')}：</label>
                    <div className="el-form-item__content">
                      <span className="el-select">
                        <select
                          className="el-select__wrapper"
                          style={{ width: 500 }}
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          aria-label={t('售后原因')}
                        >
                          <option value="">{t('请选择')}</option>
                          {(config.aftersaleReason || []).map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="el-form-item">
                  <label className="el-form-item__label">{t('预计退款金额')}：</label>
                  <div className="el-form-item__content">
                    <input className="el-input__inner" value={refundAmount.toFixed(2)} readOnly disabled placeholder={t('请输入申请金额')} />
                  </div>
                </div>

                <div className="el-form-item">
                  <label className="el-form-item__label">{t('问题描述')}：</label>
                  <div className="el-form-item__content">
                    <textarea
                      className="el-textarea__inner"
                      rows={4}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder={t('请输入问题描述')}
                    />
                  </div>
                </div>

                <div className="el-form-item">
                  <label className="el-form-item__label">{t('上传凭证')}：</label>
                  <div className="el-form-item__content">
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
                </div>

                <div className="el-form-item">
                  <label className="el-form-item__label" />
                  <div className="el-form-item__content">
                    <button
                      type="button"
                      className="mp-el-button mp-el-button--primary"
                      disabled={submitting}
                      onClick={() => void submit()}
                    >
                      {t('提交')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
