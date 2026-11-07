'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Button, Modal, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface GiftCardProduct {
  productId?: number;
  productName?: string;
  picUrl?: string;
  skuPrice?: number | string;
  productPrice?: number | string;
}

/** 领取/转赠记录：不同部署字段名不一致，统一用宽松类型兜底读取。 */
interface ClaimRecord {
  userName?: string;
  nickname?: string;
  username?: string;
  addTime?: string;
  claimTime?: string;
  createTime?: string;
  receiveTime?: string;
  status?: number | string;
  statusName?: string;
  [key: string]: unknown;
}

/** 礼品卡详情（对照旧版 types/giftCard/giftCard.d.ts 的 GiftCardInfo）。 */
interface GiftCardDetail {
  giftCardSn?: string;
  cardNumber?: string;
  cardPassword?: string;
  cardGroupName?: string;
  shopTitle?: string;
  shopLogo?: string;
  imageUrl?: string;
  expiredTime?: number | string;
  status?: number;
  isExchange?: string | number;
  /** 面额：后台字段可能为 cardValue / faceValue / balance 等，缺失时页面显示占位。 */
  cardValue?: number | string;
  faceValue?: number | string;
  cardAmount?: number | string;
  balance?: number | string;
  denomination?: number | string;
  amount?: number | string;
  /** 领取记录：接口未必返回，缺失时显示「暂无领取记录」。 */
  claimRecords?: ClaimRecord[];
  receiveRecords?: ClaimRecord[];
  transferRecords?: ClaimRecord[];
  giftCardLogs?: ClaimRecord[];
  giftCardProducts?: GiftCardProduct[];
  giftCardGroups?: {
    cardGroupName?: string;
    imageUrl?: string;
    giftCardProducts?: GiftCardProduct[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const STATUS_TEXT: Record<number, string> = { 0: '待兑换', 1: '已兑换', 2: '已过期' };

/** 有效期：秒级时间戳/毫秒级时间戳/日期字符串都兼容（对照旧版 giftCard.vue）。 */
function formatExpire(value: number | string): string {
  const num = Number(value);
  if (!Number.isNaN(num) && num > 0) {
    const ms = num < 1e12 ? num * 1000 : num;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    }
  }
  return String(value);
}

function isExpired(expiredTime?: number | string): boolean {
  if (!expiredTime || Number(expiredTime) === 0) return false;
  const num = Number(expiredTime);
  if (Number.isNaN(num) || num <= 0) return false;
  const ms = num < 1e12 ? num * 1000 : num;
  return Date.now() > ms;
}

/** 复制到剪切板：不可用时提示手动复制（对照旧版 showInviteDialog.vue 的兜底）。 */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    Toast.success({ content: '复制成功' });
  } catch {
    Toast.error({ content: '复制失败，请手动复制' });
  }
}

const sectionStyle: CSSProperties = {
  border: '1px solid #ebedf0',
  borderRadius: 8,
  background: '#fff',
  padding: 20,
  marginTop: 16,
};
const sectionTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#a9781b',
  margin: 0,
  marginBottom: 12,
};

export default function GiftCardClaimClient({ giftCardSn, isExchange, status }: { giftCardSn: string; isExchange?: string; status?: number }) {
    const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<GiftCardDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [cardPassword, setCardPassword] = useState('');
  const [transferVisible, setTransferVisible] = useState(false);
  const [transferLink, setTransferLink] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [exchangeVisible, setExchangeVisible] = useState(false);
  const [exchangeNumber, setExchangeNumber] = useState('');
  const [exchangePassword, setExchangePassword] = useState('');
  const [exchangeLoading, setExchangeLoading] = useState(false);

  const claimed = String(isExchange) === '1' || Number(status) === 1 || String(detail?.isExchange) === '1' || Number(detail?.status) === 1;

  // props 只有 giftCardSn / isExchange / status，卡面/面额/商品等其余字段由详情接口补齐；
  // 接口失败时整页不报错，页面仍保留领取操作且各字段走可选值兜底。
  useEffect(() => {
    let alive = true;
    apiGet<GiftCardDetail>('promotion/giftCardGroups/detail', { giftCardSn })
      .then((data) => { if (alive) setDetail(data || null); })
      .catch(() => { if (alive) setDetail(null); })
      .finally(() => { if (alive) setDetailLoading(false); });
    return () => { alive = false; };
  }, [giftCardSn]);

  const claim = async () => {
    setLoading(true);
    try {
      await apiPost('promotion/giftCardGroups/claim', { giftCardSn });
      Toast.success({ content: '领取成功' });
      window.location.reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '领取失败' });
    } finally {
      setLoading(false);
    }
  };

  /** 显示/隐藏券码：需要权限校验的接口，失败时回退用详情里的卡密（对照 giftCard.vue）。 */
  const revealCode = async () => {
    if (!showCode && !cardPassword) {
      try {
        const res = await apiGet<{ cardNumber?: string; cardPassword?: string }>('promotion/giftCardGroups/showCardPassword', { giftCardSn });
        setCardPassword(String(res?.cardPassword || detail?.cardPassword || ''));
        if (res?.cardNumber) setDetail((current) => (current ? { ...current, cardNumber: res.cardNumber } : current));
      } catch {
        setCardPassword(String(detail?.cardPassword || ''));
      }
    }
    setShowCode((value) => !value);
  };

  const copyAllCode = async () => {
    let password = cardPassword || String(detail?.cardPassword || '');
    if (!password) {
      try {
        const res = await apiGet<{ cardNumber?: string; cardPassword?: string }>('promotion/giftCardGroups/showCardPassword', { giftCardSn });
        password = String(res?.cardPassword || '');
        setCardPassword(password);
      } catch {
        password = '';
      }
    }
    await copyText(`卡号：${detail?.cardNumber || giftCardSn}\n卡密：${password}`);
  };

  /** 转赠：生成转赠链接；接口缺失/失败时兜底为当前领取页链接（对照 giftCardActions.vue）。 */
  const transfer = async () => {
    setTransferLoading(true);
    try {
      const result = await apiPost<string | { receiptLink?: string; link?: string; url?: string; data?: string }>(
        'promotion/giftCardGroups/transfer',
        { giftCardSn, isFrom: '2' },
      );
      const link = typeof result === 'string'
        ? result
        : String(result?.receiptLink || result?.link || result?.url || result?.data || '');
      setTransferLink(link || `${window.location.origin}/giftCard/transfer/${giftCardSn}`);
    } catch {
      setTransferLink(`${window.location.origin}/giftCard/transfer/${giftCardSn}`);
      Toast.error({ content: '转赠链接生成失败，已为您提供当前领取链接' });
    } finally {
      setTransferVisible(true);
      setTransferLoading(false);
    }
  };

  const exchange = async () => {
    if (!exchangeNumber.trim() || !exchangePassword.trim()) {
      return Toast.error({ content: '请输入卡号和卡密' });
    }
    setExchangeLoading(true);
    try {
      await apiPost('promotion/giftCardGroups/exchange', { cardNumber: exchangeNumber.trim(), cardPassword: exchangePassword.trim() });
      Toast.success({ content: '兑换成功' });
      setExchangeVisible(false);
      setExchangeNumber('');
      setExchangePassword('');
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '兑换失败' });
    } finally {
      setExchangeLoading(false);
    }
  };

  const group: NonNullable<GiftCardDetail['giftCardGroups']> = detail?.giftCardGroups || {};
  const cardName = detail?.cardGroupName || group.cardGroupName || t('礼品卡');
  const cardImage = detail?.imageUrl || group.imageUrl || '';
  const shopTitle = detail?.shopTitle || '';
  const cardNumber = detail?.cardNumber || giftCardSn;
  const rawProducts = detail?.giftCardProducts || group.giftCardProducts || [];
  const rawRecords = detail?.claimRecords || detail?.receiveRecords || detail?.transferRecords || detail?.giftCardLogs || [];
  const products: GiftCardProduct[] = Array.isArray(rawProducts) ? rawProducts : [];
  const records: ClaimRecord[] = Array.isArray(rawRecords) ? rawRecords : [];
  const faceValue = detail?.cardValue ?? detail?.faceValue ?? detail?.cardAmount ?? detail?.balance ?? detail?.denomination ?? detail?.amount;
  const statusNumber = Number(detail?.status ?? status ?? 0);
  const displayStatus = statusNumber === 1 ? STATUS_TEXT[1] : isExpired(detail?.expiredTime) ? STATUS_TEXT[2] : STATUS_TEXT[0];
  const expired = detail?.expiredTime;
  const expireText = !expired || Number(expired) === 0
    ? t('长期有效')
    : t('有效期至 {d}', { d: formatExpire(expired) });
  const masked = (value: string) => (value && value.length > 4 ? `${value.slice(0, 4)} **** ****` : value || '****');

  return (
    <div className="giftcard-claim">
      {/* 礼品卡卡面：店铺 / 卡号 / 卡密 / 名称 / 面额 / 有效期 / 状态 */}
      <div
        className="giftcard-claim__face"
        style={{
          position: 'relative',
          borderRadius: 12,
          padding: 20,
          color: '#fff',
          background: cardImage ? `url(${cardImage}) center/cover no-repeat` : 'linear-gradient(135deg, #bd983d, #a9781b)',
          minHeight: 180,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{shopTitle || t('礼品卡')}</div>
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.85 }}>{t('卡号')}</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>{showCode ? cardNumber : masked(cardNumber)}</span>
            <button type="button" onClick={() => void copyText(cardNumber)} style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', borderRadius: 10, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.25)', color: '#fff' }}>{t('复制')}</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>{t('密码')}</div>
          <div style={{ fontSize: 18, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>{showCode ? (cardPassword || String(detail?.cardPassword || '****')) : masked(cardPassword || String(detail?.cardPassword || ''))}</span>
            <button type="button" onClick={() => void copyText(cardPassword || String(detail?.cardPassword || ''))} style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', borderRadius: 10, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.25)', color: '#fff' }}>{t('复制')}</button>
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{cardName}</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>{expireText}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13 }}>{t('面额：')}<b style={{ fontSize: 20 }}>¥ {faceValue !== undefined && faceValue !== '' && !Number.isNaN(Number(faceValue)) ? Number(faceValue).toFixed(2) : '--'}</b></div>
              <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>卡号状态：{displayStatus}</div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
            <button type="button" onClick={() => void copyAllCode()} style={{ flex: 1, padding: '8px 0', cursor: 'pointer', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff' }}>{t('复制券码')}</button>
            <button type="button" onClick={() => void revealCode()} style={{ flex: 1, padding: '8px 0', cursor: 'pointer', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff' }}>{showCode ? t('隐藏券码') : '显示券码'}</button>
          </div>
        </div>
        <div style={{ position: 'absolute', right: 0, top: 0, zIndex: 1, background: '#f8e0c8', color: '#996500', fontSize: 12, padding: '5px 10px', borderBottomLeftRadius: 10 }}>{displayStatus}</div>
      </div>

      {/* 领取记录 */}
      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>{t('领取记录')}</h3>
        {records.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f7f8fa' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #ebedf0' }}>{t('领取人')}</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #ebedf0' }}>{t('领取时间')}</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #ebedf0' }}>{t('状态')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr key={index}>
                  <td style={{ padding: '8px 10px', border: '1px solid #ebedf0' }}>{String(record.userName || record.nickname || record.username || t('匿名用户'))}</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #ebedf0' }}>{String(record.claimTime || record.receiveTime || record.addTime || record.createTime || '-')}</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #ebedf0' }}>{String(record.statusName || (Number(record.status) === 1 ? t('已领取') : '待领取'))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#9b9c9d', margin: 0 }}>{detailLoading ? t('领取记录加载中...') : '暂无领取记录'}</p>
        )}
      </section>

      {/* 可用商品列表（该兑换卡可兑换商品） */}
      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>{t('可用商品')}</h3>
        <p style={{ color: '#9b9c9d', fontSize: 13, margin: '0 0 12px' }}>{t('该兑换卡可兑换商品')}</p>
        {products.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
            {products.map((product, index) => (
              <Link key={product.productId || index} href={`/product/${product.productId || ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ border: '1px solid #ebedf0', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ height: 120, background: '#f7f8fa' }}>
                    {product.picUrl ? <img src={product.picUrl} alt={product.productName || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : null}
                  </div>
                  <div style={{ padding: 8, fontSize: 13 }}>{product.productName || t('兑换商品')}</div>
                  <div style={{ padding: '0 8px 8px', color: '#a9781b', fontWeight: 600 }}>¥ {Number(product.skuPrice || product.productPrice || 0).toFixed(2)}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ color: '#9b9c9d', margin: 0 }}>{detailLoading ? t('商品加载中...') : '暂无可兑换商品'}</p>
        )}
      </section>

      {/* 转赠 / 领取 / 兑换 操作区 */}
      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>{t('操作')}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Button theme="solid" type="primary" size="large" disabled={claimed} loading={loading} onClick={() => void claim()}>
            {claimed ? t('已领取') : '立即领取'}
          </Button>
          <Button size="large" loading={transferLoading} onClick={() => void transfer()}>{t('转赠给好友')}</Button>
          <Button size="large" onClick={() => setExchangeVisible(true)}>{t('立即兑换')}</Button>
          <span style={{ color: '#9b9c9d', fontSize: 13 }}>{t('领取后可在礼品卡兑换中使用')}</span>
        </div>
      </section>

      <Modal
        title={t('礼品卡赠送')}
        visible={transferVisible}
        onCancel={() => setTransferVisible(false)}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setTransferVisible(false)}>{t('关闭')}</Button>
            <Button theme="solid" type="primary" onClick={() => void copyText(transferLink)}>{t('复制链接')}</Button>
          </div>
        )}
      >
        <input readOnly value={transferLink} style={{ width: '100%', padding: 8, boxSizing: 'border-box' }} />
        <p style={{ color: '#a4adb3', fontSize: 12 }}>{t('点击上方复制链接，发送给好友进行赠送')}</p>
      </Modal>

      <Modal
        title={t('礼品卡兑换')}
        visible={exchangeVisible}
        onCancel={() => setExchangeVisible(false)}
        footer={(
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setExchangeVisible(false)}>{t('取消')}</Button>
            <Button theme="solid" type="primary" loading={exchangeLoading} onClick={() => void exchange()}>{t('兑换')}</Button>
          </div>
        )}
      >
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ display: 'block', marginBottom: 4 }}>{t('卡号')}</span>
          <input value={exchangeNumber} onChange={(event) => setExchangeNumber(event.target.value)} placeholder={t('请输入卡号')} style={{ width: '100%', padding: 8, boxSizing: 'border-box' }} />
        </label>
        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', marginBottom: 4 }}>{t('卡密')}</span>
          <input value={exchangePassword} onChange={(event) => setExchangePassword(event.target.value)} placeholder={t('请输入卡密')} style={{ width: '100%', padding: 8, boxSizing: 'border-box' }} />
        </label>
      </Modal>
    </div>
  );
}
