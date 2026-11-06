import { useState } from 'react';
import { Button, Modal, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface LiveGoodRow {
  goodsId?: number;
  productId?: number;
  productName?: string;
  picThumb?: string;
  productPrice?: number | string;
  auditStatusText?: string;
  inRoom?: boolean;
}

/** 直播商品：对应旧版 content/wechat-live/manageProduct.vue，接口 /content/wechatLiveGoods/*。 */
export default function WechatLiveGoods() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [importing, setImporting] = useState(false);

  const reload = () => setReloadKey((key) => key + 1);

  const importGoods = async () => {
    Modal.confirm({
      title: t('从微信导入直播商品'),
      content: t('将拉取微信小程序直播商品库并同步到本系统，确认导入？'),
      onOk: async () => {
        setImporting(true);
        try {
          await apiPost('/content/wechatLiveGoods/import', {});
          Toast.success({ content: t('导入成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('导入失败') });
        } finally {
          setImporting(false);
        }
      },
    });
  };

  const removeFromRoom = async (row: LiveGoodRow) => {
    try {
      await apiPost('/content/wechatLiveGoods/removeFromRoom', { goodsId: row.goodsId });
      Toast.success({ content: t('移除成功') });
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('移除失败') });
    }
  };

  const columns: ColumnConfig<LiveGoodRow>[] = [
    {
      title: '商品名称',
      dataIndex: 'productName',
      width: 300,
      render: (value: string, row: LiveGoodRow) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {row.picThumb ? <img src={row.picThumb} alt="" width={36} height={36} style={{ borderRadius: 4, objectFit: 'cover' }} /> : null}
          <span>{value || '-'}</span>
        </div>
      ),
    },
    {
      title: '价格',
      dataIndex: 'productPrice',
      width: 120,
      render: (value: unknown) => <span>{value != null ? String(value) : '-'}</span>,
    },
    {
      title: '审核状态',
      dataIndex: 'auditStatusText',
      width: 110,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '是否在直播间',
      dataIndex: 'inRoom',
      width: 110,
      render: (value: unknown) => <span>{value ? t('已加入') : t('未加入')}</span>,
    },
  ];

  return (
    <ListPage<LiveGoodRow>
      key={reloadKey}
      api="/content/wechatLiveGoods/list"
      rowKey="goodsId"
      pageSize={10}
      actionWidth={130}
      columns={columns}
      rowActions={(row) => (
        <Space spacing={2}>
          <Button theme="borderless" type="danger" size="small" onClick={() => removeFromRoom(row)}>
            {t('移除')}
          </Button>
        </Space>
      )}
      toolbarExtra={
        <Button theme="solid" type="primary" loading={importing} onClick={importGoods}>
          {t('从微信导入')}
        </Button>
      }
    />
  );
}
