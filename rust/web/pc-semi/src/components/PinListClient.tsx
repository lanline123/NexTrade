'use client';

/**
 * 我的团购（拼团订单列表）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/pin/List.vue
 * 结构：状态 Tab（全部/未确认/已成团进行中/已取消/已成功/已失败）
 *       + 订单号或商品名称搜索
 *       + 时间范围（最近三个月/六个月/一年/全部）
 *       + 表头：数量/金额/团购状态/订单状态/操作
 *       + 每行：团购订单号 / 创团时间 / 创团类型（建团（团长））
 * 接口：GET /api/promotion/groupon/record/list（is_mine=1、join_status、date_type、keyword）
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface GrouponRecord {
  grouponPromotionRecordId?: number;
  productName?: string;
  picThumb?: string;
  joinStatus?: number;
  joinStatusDesc?: string;
  minGroupNum?: number;
  minGrouponPrice?: number | string;
  productPrice?: number | string;
  joinNumCount?: number;
  startTime?: string;
  endTime?: string;
  orderSn?: string;
  orderId?: number;
  joinType?: number;
  orderAddTime?: string;
}

/** 源码 orderTypeList：0 全部 / 2 未确认 / 3 已成团进行中 / 5 已取消 / 6 已成功 / 7 已失败 */
const STATUS_TABS: Array<{ type: number; label: string }> = [
  { type: 0, label: '全部拼团订单' },
  { type: 2, label: '未确认' },
  { type: 3, label: '已成团，正在进行' },
  { type: 5, label: '已取消' },
  { type: 6, label: '已成功' },
  { type: 7, label: '已失败' },
];

/** 源码 orderTimeList：3 三个月 / 2 六个月 / 1 一年 / 4 全部 */
const DATE_TYPES: Array<{ value: number; label: string }> = [
  { value: 3, label: '最近三个月订单' },
  { value: 2, label: '最近六个月订单' },
  { value: 1, label: '最近一年内的订单' },
  { value: 4, label: '全部订单' },
];

function money(value: unknown): string {
  return Number(value || 0).toFixed(2);
}

export default function PinListClient() {
    const { t } = useTranslation();
  const [orderType, setOrderType] = useState(0);
  const [dateType, setDateType] = useState(4);
  const [keyword, setKeyword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState<GrouponRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const size = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ records?: GrouponRecord[]; total?: number } | GrouponRecord[]>(
        'promotion/groupon/record/list',
        {
          isMine: true,
          page,
          size,
          ...(orderType ? { joinStatus: orderType } : {}),
          dateType,
          ...(searchTerm ? { keyword: searchTerm } : {}),
        },
      );
      const list = Array.isArray(data) ? data : (data?.records || []);
      setRecords(list);
      setTotal(Array.isArray(data) ? list.length : Number(data?.total || list.length));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '团购列表加载失败' });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [orderType, dateType, page, searchTerm]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / size));

  return (
    <>
      <div className="pin-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            className={orderType === tab.type ? 'is-active' : ''}
            onClick={() => { setOrderType(tab.type); setPage(1); }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pin-toolbar">
        <input
          className="pin-toolbar__input"
          value={keyword}
          placeholder={t('订单号或商品名称')}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { setSearchTerm(keyword.trim()); setPage(1); }
          }}
        />
        <Button onClick={() => { setSearchTerm(keyword.trim()); setPage(1); }}>{t('搜索')}</Button>
        <select className="pin-toolbar__select" value={dateType} onChange={(event) => { setDateType(Number(event.target.value)); setPage(1); }}>
          {DATE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      <div className="pin-table-head">
        <div style={{ width: '40%' }}>{t('商品')}</div>
        <div style={{ width: '12%' }}>{t('数量')}</div>
        <div style={{ width: '12%' }}>{t('金额')}</div>
        <div style={{ width: '12%' }}>{t('团购状态')}</div>
        <div style={{ width: '12%' }}>{t('订单状态')}</div>
        <div style={{ width: '12%' }}>{t('操作')}</div>
      </div>

      {loading ? <Card className="cart-state">{t('加载中...')}</Card> : null}

      {!loading && records.map((item) => (
        <table className="pin-table" key={String(item.grouponPromotionRecordId)}>
          <thead>
            <tr>
              <th colSpan={4}>{t('团购订单号：')}<span className="pin-red">{item.orderSn || '-'}</span>
                <span className="pin-gap">创团时间：{item.orderAddTime || item.startTime || '-'}</span>
                <span className="pin-gap">创团类型：{Number(item.joinType) === 1 ? t('建团（团长）') : '参团'}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="pin-row">
              <td className="pin-col-goods">
                <div className="pin-goods">
                  <img src={item.picThumb || ''} alt={item.productName || ''} />
                  <div>
                    <p>{item.productName || t('商品')}</p>
                    <ul>
                      <li>¥ {money(item.minGrouponPrice ?? item.productPrice)}</li>
                    </ul>
                  </div>
                </div>
              </td>
              <td>X{Number(item.joinNumCount || 1)}</td>
              <td>总额：¥ {money(item.minGrouponPrice ?? item.productPrice)}</td>
              <td>
                <div className="pin-status">{item.joinStatusDesc || t('进行中')}</div>
                {item.minGroupNum ? <div className="pin-sub">还差 {Math.max(0, Number(item.minGroupNum) - Number(item.joinNumCount || 0))} 人成团</div> : null}
              </td>
              <td>
                <div>{item.orderId ? t('已确认付款') : '待支付'}</div>
                {item.orderId ? (
                  <Link className="pin-link" href={`/member/order/detail?id=${item.orderId}`}>{t('订单详情')}</Link>
                ) : null}
              </td>
              <td>
                <Link className="pin-link" href={`/member/pin/group?id=${item.grouponPromotionRecordId}`} target="_blank">{t('团购详情')}</Link>
              </td>
            </tr>
          </tbody>
        </table>
      ))}

      {!loading && !records.length ? (
        <Card className="cart-state pin-empty">
          <p className="pin-empty__title">{t('当前筛选下还没有任何订单哦!')}</p>
          <p>{t('现在就去：')}<Link href="/">{t('选购商品')}</Link></p>
        </Card>
      ) : null}

      {pages > 1 ? (
        <div className="comment-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t('上一页')}</button>
          <span>{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>{t('下一页')}</button>
        </div>
      ) : null}
    </>
  );
}
