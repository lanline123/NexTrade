'use client';

/**
 * 商品详情「进行中拼单列表」。
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/joining/src/ProductJoining.vue +
 * ToJoiningList.vue（N人在拼单，可直接参与；单行：头像/昵称 + 还差N人 + 倒计时 + 去参团）。
 * 接口：GET promotion/groupon/record/list { page, size, isMine:false, joinStatus:1, productId, excludeEnded:true }
 * 去参团：POST cart/cart/addToCart { id, number, skuId, isQuick:1, grouponData:{...拼团上下文, grouponPromotionRecordId} }
 * → /order/check（旧版 ProductBuy isQuick 分支）。
 */
import { useEffect, useState } from 'react';
import { Avatar, Button, Toast } from '@douyinfe/semi-ui';
import { IconChevronRight } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '@/lib/client-api';
import GrouponCountdown from '@/components/GrouponCountdown';

import { useTranslation } from 'react-i18next';
interface JoinRow {
  grouponPromotionRecordId?: number;
  joinNumCount?: number;
  minGroupNum?: number;
  endTime?: string;
  joinUser?: {
    avatar?: string;
    username?: string;
    userId?: number;
    leader?: boolean | number;
  };
}

interface Props {
  productId: number;
  /** 详情页已取的拼团活动信息（grouponPromotionId / grouponPromotionItemId / grouponPromotionDetails / minGrouponPrice） */
  groupon: Record<string, any> | null;
  /** 当前选中规格（用于匹配 grouponDetailId） */
  skuId?: number;
  /** 数量（沿用详情页选择） */
  number: number;
}

function maskName(name: string): string {
  if (!name) return '拼团成员';
  if (name.length <= 1) return `${name}**`;
  if (name.length <= 2) return `${name.slice(0, 1)}**`;
  return `${name.slice(0, 1)}**${name.slice(-1)}`;
}

export default function ProductJoiningClient({ productId, groupon, skuId, number }: Props) {
    const { t } = useTranslation();
  const [rows, setRows] = useState<JoinRow[]>([]);
  const [total, setTotal] = useState(0);
  const [joining, setJoining] = useState(0);

  useEffect(() => {
    if (!productId) return;
    let alive = true;
    apiGet<{ records?: JoinRow[]; total?: number }>('promotion/groupon/record/list', {
      page: 1,
      size: 10,
      isMine: false,
      joinStatus: 1,
      productId,
      excludeEnded: true,
    })
      .then((result) => {
        if (!alive) return;
        setRows(result?.records || []);
        setTotal(Number(result?.total || result?.records?.length || 0));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [productId]);

  if (!rows.length) return null;

  const join = async (row: JoinRow) => {
    const recordId = Number(row.grouponPromotionRecordId || 0);
    if (!recordId || !groupon) return;
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    const promotionId = Number(groupon.grouponPromotionId || groupon.grouponId || 0);
    const itemId = Number(groupon.grouponPromotionItemId || 0);
    if (!promotionId || !itemId) return;
    const details = (groupon.grouponPromotionDetails || []) as Array<Record<string, any>>;
    const matched = skuId ? details.find((row2) => Number(row2.skuId) === Number(skuId)) : undefined;
    const detailRow = matched || details[0];
    setJoining(recordId);
    try {
      await apiPost('cart/cart/addToCart', {
        id: productId,
        number: number || 1,
        ...(skuId ? { skuId: Number(skuId) } : {}),
        isQuick: 1,
        grouponData: {
          grouponPromotionId: promotionId,
          grouponPromotionItemId: itemId,
          grouponDetailId: detailRow ? Number(detailRow.grouponDetailId || 0) : 0,
          price: Number(groupon.grouponPrice || groupon.minGrouponPrice || 0),
          grouponPromotionRecordId: recordId,
        },
      });
      window.location.href = '/order/check';
    } catch (error) {
      const message = error instanceof Error ? error.message : '参团失败';
      if (message.includes('登录') || message.includes('401')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      Toast.error({ content: message });
    } finally {
      setJoining(0);
    }
  };

  return (
    <div className="pds-joining">
      <div className="pds-joining__head">
        <b>{total}</b>{t('人在拼单，可直接参与')}</div>
      <ul className="pds-joining__list">
        {rows.slice(0, 2).map((row) => {
          const remain = Math.max(0, Number(row.minGroupNum || 0) - Number(row.joinNumCount || 0));
          return (
            <li key={row.grouponPromotionRecordId} className="pds-joining__row">
              <Avatar src={row.joinUser?.avatar || undefined} size="small" alt="" />
              <span className="pds-joining__name">{maskName(row.joinUser?.username || '')}</span>
              <span className="pds-joining__remain">{t('还差')}<i>{remain}</i>{t('人')}</span>
              <span className="pds-joining__countdown">
                <GrouponCountdown endTime={row.endTime} />
              </span>
              <Button
                size="small"
                theme="borderless"
                type="primary"
                icon={<IconChevronRight />}
                iconPosition="right"
                loading={joining === Number(row.grouponPromotionRecordId)}
                onClick={() => void join(row)}
              >{t('去参团')}</Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
