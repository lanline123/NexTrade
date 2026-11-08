'use client';

/**
 * 余额充值（/member/account/deposit）
 *
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/account/Deposit.vue
 * 结构与类名逐条照抄旧版模板，全部落在 `.mp-account-deposit` 包裹层下
 * （该层样式来自 scripts/gen-member-pages-scss.mjs 抽取的本页 <style scoped>，见 app/member-pages.scss）。
 *
 *   .info-row.mp-account-deposit
 *     > .title-or-tabs > .tag-and-input > .tig-tabs > .tab(> p > span)     ← MemberTopMenu 五个入口
 *     > .account-deposit-content
 *         flow=true （第一步：选金额）
 *           > .card-list > .card(selected?) > div > [.price 或 .el-input-number]
 *                          + .tips（赠送 xx）
 *           > .bom-div > button.big-button.tj-submit
 *         flow=false（第二步：选支付方式）
 *           > .el-form > .el-form-item × 5
 *               .title/.info、.pay-list > .tab.flex.align-center > .cont > img、
 *               返回 / 去付款、.mp-checkbox 服务协议
 *
 * 请求层保持原样（只调 update 建单、create 取支付参数），不做任何接口结构改动。
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';
import FormatPrice from './FormatPrice';
import MemberAccountTabs from './MemberAccountTabs';

import { useTranslation } from 'react-i18next';

interface DepositSetting { rechargeId: number; money?: number | string; discountMoney?: number | string; }

/** 旧版模板里 el-radio 的 value → 支付方式图片（view/pc/assets/images/extra/*，已随本批拷进 public） */
const PAY_METHODS: { value: string; img: string }[] = [
  { value: 'wechat', img: '/assets/images/extra/payment_method_wechat.jpg' },
  { value: 'alipay', img: '/assets/images/extra/payment_method_alipay.jpg' },
  { value: 'yabanpayWechat', img: '/assets/images/extra/payment_method_wechat.jpg' },
  { value: 'yabanpayAlipay', img: '/assets/images/extra/payment_method_alipay.jpg' },
  { value: 'yunpayWechat', img: '/assets/images/extra/payment_method_wechat.jpg' },
  { value: 'yunpayAlipay', img: '/assets/images/extra/payment_method_alipay.jpg' },
  { value: 'lakalaWechat', img: '/assets/images/extra/payment_method_wechat.jpg' },
  { value: 'lakalaAlipay', img: '/assets/images/extra/payment_method_alipay.jpg' },
];

/** 旧版 menuList：账户明细 / 申请记录 / 充值 / 提现 / 卡管理（见 MemberAccountTabs） */

export default function DepositClient() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<DepositSetting[]>([]);
  const [payList, setPayList] = useState<string[]>([]);
  const [selected, setSelected] = useState(-1);
  const [amount, setAmount] = useState('');
  const [payType, setPayType] = useState('wechat');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [flow, setFlow] = useState(true);
  const [qr, setQr] = useState('');
  const [orderId, setOrderId] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<DepositSetting[]>('user/rechargeOrder/setting').catch(() => []),
      apiGet<string[]>('user/rechargeOrder/paymentList').catch(() => []),
    ]).then(([list, payments]) => {
      setSettings(Array.isArray(list) ? list : []);
      const usable = (Array.isArray(payments) ? payments : []).filter((item) => item !== 'applepay');
      setPayList(usable);
      setPayType(usable[0] || 'wechat');
    }).finally(() => setLoading(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const chosenAmount = (() => {
    if (selected < 0) return Number(amount);
    const item = settings[selected];
    if (!item) return 0;
    return Number(item.money || amount);
  })();

  /** 旧版 onSubmit：只建单（updateRechargeOrder），然后切到第二步 */
  const onSubmit = async () => {
    if (selected < 0 && !Number(amount)) return Toast.error({ content: t('请选择充值金额') });
    if (!chosenAmount || chosenAmount <= 0) return Toast.error({ content: t('请输入正确的充值金额') });
    const item = selected >= 0 ? settings[selected] : null;
    try {
      const created: any = await apiPost('user/rechargeOrder/update', {
        id: item?.rechargeId || 0,
        amount: chosenAmount,
        money: chosenAmount,
        payType,
      });
      const id = Number(created?.orderId || created?.id || 0);
      if (!id) throw new Error(t('创建充值订单失败'));
      setOrderId(id);
      setFlow(false);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('充值失败') });
    }
  };

  /** 旧版 toPage：校验协议后发起支付；本仓没有 /member/account/src/* 支付页，沿用原有 create + 二维码/跳转兜底 */
  const toPage = async () => {
    if (!agreed) return Toast.error({ content: t('请先阅读并勾选服务协议') });
    if (!orderId) return;
    setSubmitting(true);
    try {
      const payResult: any = await apiPost('user/rechargeOrder/create', { id: orderId, type: payType });
      const info = payResult?.payInfo || payResult || {};

      if (payType === 'alipay' || payType.endsWith('Alipay')) {
        if (typeof info.html === 'string' && info.html.includes('<form')) {
          const div = document.createElement('div');
          div.innerHTML = info.html;
          document.body.appendChild(div);
          (div.querySelector('form') as HTMLFormElement | null)?.submit();
          return;
        }
      }
      const codeUrl = info.codeUrl || info.qrCode || info.qr_code || '';
      if (codeUrl) {
        const QRCode = (await import('qrcode')).default;
        setQr(await QRCode.toDataURL(codeUrl, { width: 260, margin: 1 }));
        startPoll(orderId);
        return;
      }
      const redirect = info.h5Url || info.url || info.payUrl || '';
      if (typeof redirect === 'string' && redirect.startsWith('http')) {
        window.location.href = redirect;
        return;
      }
      Toast.info({ content: t('支付通道已受理') });
      startPoll(orderId);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('充值失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const startPoll = (id: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const result: any = await apiGet('user/rechargeOrder/checkStatus', { id });
        if (Number(result?.payStatus) === 1) {
          if (pollRef.current) clearInterval(pollRef.current);
          Toast.success({ content: t('充值成功') });
          window.location.href = '/member/account/log';
        }
      } catch { /* ignore */ }
    }, 2500);
  };

  const selectCard = (index: number) => {
    setSelected(index);
    const item = settings[index];
    if (item) setAmount(String(item.money || ''));
  };

  return (
    <div className="info-row mp-account-deposit">
      <MemberAccountTabs current="/member/account/deposit" />

      {flow ? (
        <div className="account-deposit-content">
          <div className="card-list">
            {loading ? <div className="no-result"><div /></div> : null}
            {!loading && settings.length ? settings.map((item, index) => (
              <div
                key={item.rechargeId}
                className={`card${selected === index ? ' selected' : ''}`}
                onClick={() => selectCard(index)}
              >
                <div>
                  <FormatPrice value={item.money} fontSize="20px" fontWeight={700} />
                </div>
                {Number(item.discountMoney || 0) > 0 ? (
                  <div className="tips">
                    {t('赠送')}
                    <FormatPrice value={item.discountMoney} fontSize="14px" />
                  </div>
                ) : null}
              </div>
            )) : null}
            {!loading ? (
              <div className={`card${selected === -1 ? ' selected' : ''}`} onClick={() => setSelected(-1)}>
                <div>
                  <span className="el-input-number">
                    <span className="el-input">
                      <input
                        className="el-input__inner"
                        value={amount}
                        onChange={(event) => { setSelected(-1); setAmount(event.target.value); }}
                        inputMode="decimal"
                        aria-label={t('自定义金额')}
                      />
                    </span>
                  </span>
                </div>
                <div className="tips" style={{ marginTop: 5 }}>{t('自定义金额')}</div>
              </div>
            ) : null}
          </div>
          <div className="bom-div">
            {!loading ? (
              <button type="button" className="big-button tj-submit mp-el-button--primary" onClick={() => void onSubmit()}>
                {t('提交申请')}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="account-deposit-content">
          <div className="el-form">
            <div className="el-form-item">
              {t('充值金额')}：
              <FormatPrice value={chosenAmount} fontSize="18px" className="mp-deposit-amount" />
            </div>
            <div className="el-form-item">
              <span className="title">{t('平台支付')}</span>
              <span className="info">{t('支持所有银行卡或信用卡，更迅速、安全')}</span>
            </div>
            <div className="el-form-item">
              <div className="pay-list">
                <div className="el-radio-group">
                  {PAY_METHODS.filter((method) => payList.includes(method.value)).map((method) => (
                    <label key={method.value} className="tab flex align-center">
                      <input
                        type="radio"
                        className="mp-el-radio__original"
                        name="payType"
                        checked={payType === method.value}
                        onChange={() => setPayType(method.value)}
                      />
                      <span className={`mp-el-radio__inner${payType === method.value ? ' is-checked' : ''}`} />
                      <div className="cont"><img src={method.img} alt={method.value} /></div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="el-form-item">
              <button type="button" className="mp-el-button" onClick={() => setFlow(true)}>{t('返回')}</button>
              <button type="button" className="mp-el-button mp-el-button--primary ml10" disabled={submitting} onClick={() => void toPage()}>{t('去付款')}</button>
            </div>
            <div className="el-form-item">
              <label className={`mp-checkbox${agreed ? ' is-checked' : ''}`}>
                <input
                  type="checkbox"
                  className="mp-checkbox__original"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                />
                <span className="mp-checkbox__box" />
                <span>
                  {t('本人此操作将视为同意并接受')}
                  <Link className="font-color" target="_blank" href="/member/account/src/serviceAgreement">{t('《服务协议》')}</Link>
                </span>
              </label>
            </div>
          </div>

          {qr ? (
            <div className="account-deposit-content no-qr">
              <p>{t('订单号')}：{orderId}，{t('请扫码支付')}</p>
              <img src={qr} alt={t('支付二维码')} width={260} height={260} />
              <button type="button" className="mp-el-button ml10" onClick={() => { setQr(''); if (pollRef.current) clearInterval(pollRef.current); }}>{t('取消')}</button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
