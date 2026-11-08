'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface PointLog {
  logId?: number;
  points?: string;
  changeTypeName?: string;
  changeTime?: string;
  changeDesc?: string;
  changeType?: number;
}

interface PointResult {
  records?: PointLog[];
  userPoints?: number;
  total?: number;
}

type TypeFilter = 'all' | 'income' | 'expense';

const PAGE_SIZE = 30;


export default function PointsClient({
  /** 站点积分名称（旧版 commonStore.integralName） */
  integralName = '积分',
}: {
  integralName?: string;
}) {
    const { t } = useTranslation();
  const [rows, setRows] = useState<PointLog[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  /** 动态积分名：优先取服务端传入的 integralName，未配置时再由公共配置接口兜底。 */
  const [name, setName] = useState(integralName);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  useEffect(() => { setName(integralName); }, [integralName]);

  // 公共配置接口读取积分名，失败时保留现有值（缺省「积分」）。
  useEffect(() => {
    let alive = true;
    apiGet<{ integralName?: string }>('common/config/base')
      .then((config) => {
        if (!alive) return;
        const fromApi = (config?.integralName || '').trim();
        if (fromApi && integralName === '积分') setName(fromApi);
      })
      .catch(() => { /* 接口失败兜底：保留 props 传入的积分名 */ });
    return () => { alive = false; };
  }, [integralName]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      let result: PointResult | null = null;
      let loginHint = false;
      try {
        // 原版 getPointList：user/pointsLog/list
        result = await apiGet<PointResult>('user/pointsLog/list', { page, size: PAGE_SIZE });
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        loginHint = message.includes('登录') || message.includes('401');
        // 兜底：部分部署的积分明细路径为 user/userPointLog/list
        try {
          result = await apiGet<PointResult>('user/userPointLog/list', { page, size: PAGE_SIZE });
        } catch {
          result = null;
        }
      }
      // 当前积分：详情接口失败时兜底为列表返回值 / 0
      let profile: { points?: number } = { points: 0 };
      try {
        profile = await apiGet<{ points?: number }>('user/user/detail');
      } catch {
        profile = { points: 0 };
      }
      if (!alive) return;
      if (result === null && loginHint) {
        setNeedLogin(true);
        setLoading(false);
        return;
      }
      const list = Array.isArray(result?.records) ? (result?.records as PointLog[]) : [];
      setRows(list);
      setTotal(Number(result?.total || 0));
      setTotalPoints(Number(result?.userPoints ?? profile?.points ?? 0));
      setLoading(false);
    };
    void load();
    return () => { alive = false; };
  }, [page]);

  if (needLogin) {
    return <Card className="cart-state"><h2>{t('登录后查看{name}', { name })}</h2><Link href="/login?redirect=/member/points"><Button theme="solid" type="primary" size="large">{t('去登录')}</Button></Link></Card>;
  }

  const filteredRows = rows.filter((row) => {
    const points = Number(row.points || 0);
    if (typeFilter === 'income') return points > 0;
    if (typeFilter === 'expense') return points < 0;
    return true;
  });

  return (
    <div className="info-row mp-point-list">
      <div className="title-or-tabs">
        <span>{t('{name}明细', { name })}</span>
      </div>
      <div className="point-info">
        <table className="custom-table">
          <thead className="table-header">
            <tr>
              <th className="header-cell header-cell-first" style={{ width: 160 }}>{t('操作时间')}</th>
              <th className="header-cell" style={{ width: 80 }}>{t('类型')}</th>
              <th className="header-cell" style={{ width: 80 }}>{name}</th>
              <th className="header-cell header-cell-last">{t('备注')}</th>
            </tr>
          </thead>
          {filteredRows.length ? (
            <tbody>
              {filteredRows.map((row, index) => (
                <tr key={row.logId || index}>
                  <td>{row.changeTime || '-'}</td>
                  <td>{row.changeTypeName || row.changeDesc || t('积分变动')}</td>
                  <td className="font-color">{row.points}</td>
                  <td>{row.changeDesc || '-'}</td>
                </tr>
              ))}
            </tbody>
          ) : (
            <tbody>
              <tr>
                <td className="no-table-result" colSpan={4}>{loading ? '' : t('您还没有{name}明细', { name })}</td>
              </tr>
            </tbody>
          )}
          <tfoot className="table-footer">
            <tr>
              <td colSpan={4}>
                {t('您的当前{name}为', { name })}：<span className="font-color">{totalPoints}</span>
              </td>
            </tr>
          </tfoot>
        </table>
        {total > PAGE_SIZE ? (
          <div className="el-page">
            <div className="pagination">
              <button type="button" disabled={page <= 1} aria-label={t('上一页')} onClick={() => setPage(page - 1)}>
                {'<'}
              </button>
              {Array.from({ length: Math.ceil(total / PAGE_SIZE) }).map((_, index) => (
                <button key={index} type="button" className={index + 1 === page ? 'is-active' : ''} onClick={() => setPage(index + 1)}>
                  {index + 1}
                </button>
              ))}
              <button type="button" disabled={page >= Math.ceil(total / PAGE_SIZE)} aria-label={t('下一页')} onClick={() => setPage(page + 1)}>
                {'>'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
