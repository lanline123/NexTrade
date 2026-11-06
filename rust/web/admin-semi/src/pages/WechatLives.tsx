import { useState } from 'react';
import { Button, Image, Modal, Space, Toast } from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { useI18n } from '../i18n';

interface LiveRow {
  wechatLiveId?: number;
  roomId?: number;
  wechatLiveTitle?: string;
  lastUpdateTime?: string;
  endTime?: string;
  liveStatusText?: string;
  coverImg?: string;
  actRangeText?: string;
}

/** 微信直播间：对应旧版 promotion/live/List.vue（列表 + 刷新 + 编辑名称），接口 /promotion/wechatLive/*。 */
export default function WechatLives() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const reload = () => setReloadKey((key) => key + 1);

  const refreshLives = async () => {
    setRefreshing(true);
    try {
      await apiPost('/promotion/wechatLive/refresh', {});
      Toast.success({ content: t('同步成功') });
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('同步失败') });
    } finally {
      setRefreshing(false);
    }
  };

  const updateLive = async (row: LiveRow, field: string, value: unknown) => {
    try {
      await apiPost('/promotion/wechatLive/update', {
        wechatLiveId: row.wechatLiveId,
        [field]: value,
      });
      Toast.success({ content: t('修改成功') });
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('修改失败') });
    }
  };

  const columns: ColumnConfig<LiveRow>[] = [
    {
      title: '房间ID',
      dataIndex: 'roomId',
      width: 90,
      render: (value: number) => <span>{value ?? '-'}</span>,
    },
    {
      title: '直播名称',
      dataIndex: 'wechatLiveTitle',
      width: 220,
      render: (value: string, row: LiveRow) => (
        <span
          title={t('编辑：直播名称（点击可改）')}
          style={{ cursor: 'pointer' }}
          onClick={() => {
            const next = window.prompt(t('修改直播名称'), value || '');
            if (next && next !== value) updateLive(row, 'wechatLiveTitle', next);
          }}
        >
          {value || '-'}
        </span>
      ),
    },
    { title: '开始日期', dataIndex: 'lastUpdateTime', width: 170 },
    { title: '结束日期', dataIndex: 'endTime', width: 170 },
    {
      title: '当前状态',
      dataIndex: 'liveStatusText',
      width: 110,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      // 旧版封面列复用 pointsDeductedAmount 列头,新版按 coverImg 实际字段展示
      title: '直播封面',
      dataIndex: 'coverImg',
      width: 120,
      render: (value: string) =>
        value ? <Image src={value} width={64} height={36} style={{ borderRadius: 4, objectFit: 'cover' }} /> : <span>-</span>,
    },
    {
      title: '商品显示范围',
      dataIndex: 'actRangeText',
      width: 140,
      render: (value: string) => <span>{value || '-'}</span>,
    },
  ];

  return (
    <ListPage<LiveRow>
      key={reloadKey}
      api="/promotion/wechatLive/list"
      rowKey="wechatLiveId"
      pageSize={10}
      actionWidth={120}
      columns={columns}
      toolbarExtra={
        <Button theme="solid" type="primary" loading={refreshing} onClick={refreshLives}>
          {t('从微信同步')}
        </Button>
      }
    />
  );
}
