'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface Item {
  productName?: string;
  picThumb?: string;
  productSn?: string;
  quantity?: number;
}

interface Record {
  aftersaleId: number;
  aftersalesSn?: string;
  aftersalesTypeName?: string;
  statusName?: string;
  status?: number;
  addTime?: string;
  refundAmount?: string;
  orderSn?: string;
  orderId?: number;
  items?: Item[];
  aftersalesItems?: Item[];
}

export default function AfterSalesListClient() {
    const { t } = useTranslation();
  const [rows, setRows] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    apiGet<{ records?: Record[] }>('user/aftersales/getRecord', { page: 1, size: 20 })
      .then((result) => setRows(result.records || []))
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
      })
      .finally(() => setLoading(false));
  }, []);

  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>{t('登录后查看售后')}</h2>
        <Link href="/login?redirect=/member/aftersales"><Button theme="solid" type="primary" size="large">{t('去登录')}</Button></Link>
      </Card>
    );
  }

  /**
   * 对照旧版 `pages/member/return/List.vue`：
   * `.info-row > .title-or-tabs > .tag-and-input > .tig-tabs` + `.return-content > table.custom-table`。
   * 旧版这一页列的是「订单编号 / 订单商品 / 发货时间」（按订单聚合），新版接口返回的是售后单，
   * 所以列名沿用同一套表头样式，内容换成「售后单号 / 订单商品 / 申请时间」。
   */
  return (
    <div className="info-row mp-return-list">
      <div className="title-or-tabs">
        <div className="tag-and-input">
          <div className="tig-tabs">
            <div className="tab active">
              <p>
                <span>{t('售后列表')}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="return-content">
        {rows.length ? (
          <table className="custom-table">
            <thead className="table-header">
              <tr>
                <th className="header-cell header-cell-first" style={{ width: 200 }}>{t('售后单号')}</th>
                <th className="header-cell">{t('订单商品')}</th>
                <th className="header-cell" style={{ width: 140 }}>{t('申请时间')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => (
                <tr key={record.aftersaleId}>
                  <td>{record.aftersalesSn || '-'}</td>
                  <td>
                    <div className="product-list">
                      <div>
                        <img className="img" src={(record.aftersalesItems || record.items || [])[0]?.picThumb || ''} alt="" />
                        <Link href={`/member/aftersales/detail?id=${record.aftersaleId}`}>
                          <Button type="primary" theme="solid">{t('详情')}</Button>
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td>{record.addTime || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-result">
            <div>
              <span>{loading ? '' : t('暂无已申请退换货订单')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
