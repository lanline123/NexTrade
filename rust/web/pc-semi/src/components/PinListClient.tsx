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
import { Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
import { formatPrice } from '@/lib/currency';
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
    <div className="page-info-body">
      <div className="pin-list">
        {/* pin/List.vue:13-24 —— .tag-and-input：左 .tig-tabs 状态页签，右 .input 搜索 */}
        <div className="tag-and-input">
          <div className="tig-tabs">
            {STATUS_TABS.map((tab) => (
              <div
                key={tab.type}
                className={orderType === tab.type ? 'active' : 'tab'}
                onClick={() => { setOrderType(tab.type); setPage(1); }}
              >
                <p>{t(tab.label)}</p>
              </div>
            ))}
          </div>
          <div className="input">
            <input
              className="tig-input"
              value={keyword}
              placeholder={t('订单号或商品名称')}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { setSearchTerm(keyword.trim()); setPage(1); }
              }}
            />
            <div className="tig-button ml10" onClick={() => { setSearchTerm(keyword.trim()); setPage(1); }}>{t('搜索')}</div>
          </div>
        </div>

        {/* pin/List.vue:25-36 —— .order-title > .ul，第一列是 MemberOrderSelect（旧版组件源码不在仓库，用原生 select 代替） */}
        <div className="order-title">
          <div className="ul">
            <div style={{ width: '40%' }}>
              <select
                value={dateType}
                style={{ width: '100%', height: 32 }}
                onChange={(event) => { setDateType(Number(event.target.value)); setPage(1); }}
              >
                {DATE_TYPES.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}
              </select>
            </div>
            <div style={{ width: '12%' }}>{t('数量')}</div>
            <div style={{ width: '12%' }}>{t('金额')}</div>
            <div style={{ width: '12%' }}>{t('团购状态')}</div>
            <div style={{ width: '12%' }}>{t('订单状态')}</div>
            <div style={{ width: '12%' }}>{t('操作')}</div>
          </div>
        </div>

        {records.map((item) => (
          <table className="order-table pale-green" key={String(item.grouponPromotionRecordId)}>
            <thead>
              <tr>
                <th colSpan={4}>
                  {t('团购订单号')}：<span className="red">{item.orderSn || '-'}</span>
                  <span style={{ marginLeft: '30px' }}>{t('创团时间')}：{item.orderAddTime || item.startTime || '-'}</span>
                  <span style={{ marginLeft: '30px' }}>{t('创团类型')}：{Number(item.joinType) === 1 ? t('建团（团长）') : t('参团')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="order-tr">
                <td className="column-1 wid-1">
                  <div>
                    <img src={item.picThumb || ''} alt="" />
                    <span>{item.productName || t('商品')}</span>
                    <div>
                      <ul style={{ lineHeight: 1.5 }}>
                        <li>{formatPrice(item.minGrouponPrice ?? item.productPrice)}</li>
                        <li style={{ color: '#aaa' }}>X{Number(item.joinNumCount || 1)}</li>
                      </ul>
                    </div>
                  </div>
                </td>
                <td className="column-2-4">
                  <div>
                    <div>{t('总额')}:{formatPrice(item.minGrouponPrice ?? item.productPrice)}</div>
                  </div>
                </td>
                <td className="column-2-4">
                  <div>
                    <div style={{ color: '#149c24' }}>{item.joinStatusDesc || t('进行中')}</div>
                    {item.minGroupNum ? (
                      <div>{t('剩余')}：{Math.max(0, Number(item.minGroupNum) - Number(item.joinNumCount || 0))}</div>
                    ) : null}
                  </div>
                </td>
                <td className="column-2-4">
                  <div>
                    <div style={{ color: '#149c24' }}>{item.orderId ? t('已确认付款') : t('待付款')}</div>
                    <div className="black">
                      <Link href={item.orderId ? `/member/order/detail?id=${item.orderId}` : '/member/order/list'}>{t('订单详情')}</Link>
                    </div>
                  </div>
                </td>
                <td className="column-2-4">
                  <div>
                    <div className="black">
                      <Link href={`/member/pin/group?id=${item.grouponPromotionRecordId}`} target="_blank">{t('团购详情')}</Link>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        ))}

        {!loading && !records.length ? (
          <div className="no-result">
            <div><span className="sign sign1"></span></div>
            <div className="tip-message">
              <ul>
                <li style={{ fontSize: 16, fontWeight: 700 }}>{t('当前筛选下还没有任何订单哦!')}</li>
                <li>{t('现在就去')}：<Link className="font-color" href="/">{t('选购商品')}</Link></li>
              </ul>
            </div>
          </div>
        ) : null}

        {/* 旧版模板没有分页；接口是按页取的，超过一页时用旧版 .el-page 分页（member.less） */}
        {pages > 1 ? (
          <div className="el-page">
            <div className="el-pagination is-background">
              <button type="button" className="btn-prev" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t('上一页')}</button>
              <span className="current">{page} / {pages}</span>
              <button type="button" className="btn-next" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>{t('下一页')}</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
