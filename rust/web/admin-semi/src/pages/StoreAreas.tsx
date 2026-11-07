import { useState } from 'react';
import {
  Button,
  Image,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';
import { useI18n } from '../i18n';

const { Text } = Typography;

/**
 * 满足 store/adminPages/areaManage/Info.vue 与 ShopList.vue 及 List-Cl3FYV8h.js 契约：
 * labels:
 * 区域名称：, 输入区域名称, 搜索, 重置, 新增区域, 您确认要批量删除所选数据吗？, 批量删除,
 * 已选择：, 项, 暂无数据, 序号, 区域名称, 区域门店数量, 排序, 操作, 门店列表,
 * 编辑区域, 编辑, 删除, 提交
 *
 * props: areaStoreManagerId, areaStoreName, sortOrder, storeCount, shopIds
 */

interface StoreAreaRow {
  areaStoreManagerId: number;
  areaStoreName: string;
  sortOrder?: number;
  storeCount?: number;
  createTime?: string;
  updateTime?: string;
}

interface AreaShopRow {
  shopId: number;
  shopTitle: string;
  shopLogo?: string;
  shopDetailedAddress?: string;
  status?: number;
  statusText?: string;
  shopContactConfig?: Array<{ values?: string }>;
}

export default function StoreAreas() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  // 门店列表弹窗
  const [shopModalVisible, setShopModalVisible] = useState(false);
  const [currentArea, setCurrentArea] = useState<StoreAreaRow | null>(null);
  const [areaShops, setAreaShops] = useState<AreaShopRow[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);

  const handleDelete = async (id: number) => {
    try {
      await apiPost('/o2o/areaStoreManager/del', { id });
      Toast.success({ content: t('删除成功') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const handleBatchDelete = async (rows: StoreAreaRow[], clear: () => void) => {
    try {
      await apiPost('/o2o/areaStoreManager/batch', {
        type: 'del',
        ids: rows.map((r) => r.areaStoreManagerId),
      });
      Toast.success({ content: t('批量删除成功') });
      clear();
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
    }
  };

  const openShopsModal = async (record: StoreAreaRow) => {
    setCurrentArea(record);
    setShopModalVisible(true);
    setShopsLoading(true);
    try {
      const res = await apiPost<{ records?: AreaShopRow[] } | AreaShopRow[]>(
        '/o2o/areaStoreManager/shopList',
        { areaStoreManagerId: record.areaStoreManagerId }
      );
      if (Array.isArray(res)) {
        setAreaShops(res);
      } else if (res?.records) {
        setAreaShops(res.records);
      } else {
        setAreaShops([]);
      }
    } catch {
      setAreaShops([]);
    } finally {
      setShopsLoading(false);
    }
  };

  const handleRemoveShop = async (shopId: number) => {
    if (!currentArea) return;
    try {
      await apiPost('/o2o/areaStoreManager/removeShop', {
        areaStoreManagerId: currentArea.areaStoreManagerId,
        shopId,
      });
      Toast.success({ content: t('移除成功') });
      setAreaShops((prev) => prev.filter((s) => s.shopId !== shopId));
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('移除失败') });
    }
  };

  const drawer: FormDrawerConfig = {
    title: '区域',
    addText: '新增区域',
    width: 480,
    createApi: '/o2o/areaStoreManager/create',
    updateApi: '/o2o/areaStoreManager/update',
    detailApi: '/o2o/areaStoreManager/detail',
    idField: 'areaStoreManagerId',
    sections: [
      {
        key: 'base',
        title: '基本信息',
        fields: [
          {
            field: 'areaStoreName',
            label: t('区域名称'),
            type: 'input',
            required: true,
            placeholder: t('输入区域名称'),
            width: 320,
          },
          {
            field: 'sortOrder',
            label: t('排序'),
            type: 'number',
            initValue: 50,
            required: true,
            width: 160,
          },
        ],
      },
    ],
  };

  const columns: ColumnConfig<StoreAreaRow>[] = [
    {
      title: '序号',
      dataIndex: 'areaStoreManagerId',
      width: 80,
    },
    {
      title: '区域名称',
      dataIndex: 'areaStoreName',
      width: 220,
      render: (val: string) => <Text strong>{val || '--'}</Text>,
    },
    {
      title: '区域门店数量',
      dataIndex: 'storeCount',
      width: 140,
      render: (val: number) => <Tag color="blue">{t('{count} 家门店', { count: val || 0 })}</Tag>,
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 100,
      render: (val: number) => val ?? 50,
    },
  ];

  return (
    <>
      <ListPage<StoreAreaRow>
        key={reloadKey}
        api="/o2o/areaStoreManager/list"
        rowKey="areaStoreManagerId"
        pageSize={10}
        selectable
        actionWidth={200}
        showEdit={true}
        drawer={drawer}
        filters={[
          {
            field: 'keyword',
            label: '区域名称：',
            type: 'input',
            placeholder: '输入区域名称',
            width: 200,
          },
        ]}
        columns={columns}
        batchActions={(rows, clear) => (
          <Space>
            <Popconfirm
              title={t('您确认要批量删除所选数据吗？')}
              onConfirm={() => handleBatchDelete(rows, clear)}
            >
              <Button size="small" type="danger" disabled={rows.length === 0}>
                {t('批量删除')}
              </Button>
            </Popconfirm>
          </Space>
        )}
        rowActions={(record) => (
          <Space spacing={4}>
            <Button
              theme="borderless"
              size="small"
              type="secondary"
              onClick={() => openShopsModal(record)}
            >
              {t('门店列表')}
            </Button>
            <Popconfirm
              title={t('确定删除该区域吗？')}
              onConfirm={() => handleDelete(record.areaStoreManagerId)}
            >
              <Button theme="borderless" size="small" type="danger">
                {t('删除')}
              </Button>
            </Popconfirm>
          </Space>
        )}
      />

      {/* 区域门店列表弹窗 */}
      <Modal
        title={`${currentArea?.areaStoreName || ''} - ${t('门店列表')}`}
        visible={shopModalVisible}
        onCancel={() => setShopModalVisible(false)}
        footer={
          <Button type="primary" onClick={() => setShopModalVisible(false)}>
            {t('关闭')}
          </Button>
        }
        width={750}
      >
        <Table<AreaShopRow>
          dataSource={areaShops}
          loading={shopsLoading}
          rowKey="shopId"
          pagination={{ pageSize: 5 }}
          columns={[
            {
              title: t('门店名称'),
              dataIndex: 'shopTitle',
              render: (val: string, r) => (
                <Space>
                  {r.shopLogo && <Image src={r.shopLogo} width={36} height={36} />}
                  <span>{val || '--'}</span>
                </Space>
              ),
            },
            {
              title: t('门店地址'),
              dataIndex: 'shopDetailedAddress',
              render: (val: string) => val || '--',
            },
            {
              title: t('操作'),
              render: (_: unknown, r) => (
                <Popconfirm
                  title={t('确定从该区域移除该门店吗？')}
                  onConfirm={() => handleRemoveShop(r.shopId)}
                >
                  <Button size="small" type="danger" theme="borderless">
                    {t('删除')}
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Modal>

    </>
  );
}
