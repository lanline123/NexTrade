import { useState } from 'react';
import {
  Avatar,
  Banner,
  Button,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  RadioGroup,
  Select,
  Space,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconAlertTriangle, IconPlus, IconSetting } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text } = Typography;

interface WholesaleProductRow {
  productId: number;
  productName: string;
  productSn?: string;
  picThumb?: string;
  retailPriceRange?: string;
  wholesalePriceDisplay?: string;
  moqDimension?: number;
  moqDimensionName?: string;
  moqDisplay?: string | number;
  multipleSet?: boolean | number;
  stock?: number;
  shelfStatus?: number;
}

export function WholesaleProducts() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [bannerVisible, setBannerVisible] = useState(true);

  // 添加商品弹窗
  const [addVisible, setAddVisible] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addProductId, setAddProductId] = useState<number | undefined>();

  // 批发价设置弹窗
  const [priceVisible, setPriceVisible] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<WholesaleProductRow | null>(null);
  const [priceForm, setPriceForm] = useState({ wholesalePrice: '' });

  // 起批量设置弹窗
  const [buyRuleVisible, setBuyRuleVisible] = useState(false);
  const [buyRuleLoading, setBuyRuleLoading] = useState(false);
  const [buyRuleForm, setBuyRuleForm] = useState({ moqDimension: 1, moq: 1 });

  // 批量设置起批量弹窗
  const [batchRuleVisible, setBatchRuleVisible] = useState(false);
  const [batchRuleLoading, setBatchRuleLoading] = useState(false);
  const [batchProductIds, setBatchProductIds] = useState<number[]>([]);
  const [batchMoq, setBatchMoq] = useState<number>(1);

  // 倍数购买设置弹窗
  const [multipleVisible, setMultipleVisible] = useState(false);
  const [multipleLoading, setMultipleLoading] = useState(false);
  const [multipleVal, setMultipleVal] = useState<number>(1);

  const handleDelete = async (ids: number[]) => {
    try {
      await apiPost('/wholesale/product/batchDelete', { productIds: ids });
      Toast.success({ content: t('删除成功') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const handleAddSubmit = async () => {
    if (!addProductId) {
      Toast.warning({ content: t('请输入商品ID') });
      return;
    }
    setAddLoading(true);
    try {
      await apiPost('/wholesale/product/batchAdd', { productIds: [addProductId] });
      Toast.success({ content: t('添加成功') });
      setAddVisible(false);
      setAddProductId(undefined);
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('添加失败') });
    } finally {
      setAddLoading(false);
    }
  };

  const openPriceModal = async (record: WholesaleProductRow) => {
    setCurrentProduct(record);
    setPriceForm({ wholesalePrice: record.wholesalePriceDisplay || '' });
    setPriceVisible(true);
  };

  const handlePriceSubmit = async () => {
    if (!currentProduct) return;
    setPriceLoading(true);
    try {
      await apiPost('/wholesale/product/price/save', {
        productId: currentProduct.productId,
        wholesalePrice: priceForm.wholesalePrice,
      });
      Toast.success({ content: t('批发价设置成功') });
      setPriceVisible(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setPriceLoading(false);
    }
  };

  const openBuyRuleModal = (record: WholesaleProductRow) => {
    setCurrentProduct(record);
    setBuyRuleForm({
      moqDimension: record.moqDimension || 1,
      moq: Number(record.moqDisplay) || 1,
    });
    setBuyRuleVisible(true);
  };

  const handleBuyRuleSubmit = async () => {
    if (!currentProduct) return;
    setBuyRuleLoading(true);
    try {
      await apiPost('/wholesale/product/buyRule/save', {
        productId: currentProduct.productId,
        moqDimension: buyRuleForm.moqDimension,
        moq: buyRuleForm.moq,
      });
      Toast.success({ content: t('起批量设置成功') });
      setBuyRuleVisible(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setBuyRuleLoading(false);
    }
  };

  const handleBatchRuleSubmit = async () => {
    if (batchProductIds.length === 0) return;
    setBatchRuleLoading(true);
    try {
      await apiPost('/wholesale/product/buyRule/batchSave', {
        productIds: batchProductIds,
        moq: batchMoq,
      });
      Toast.success({ content: t('批量设置起批量成功') });
      setBatchRuleVisible(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('批量设置失败') });
    } finally {
      setBatchRuleLoading(false);
    }
  };

  const openMultipleModal = (record: WholesaleProductRow) => {
    setCurrentProduct(record);
    setMultipleVal(typeof record.multipleSet === 'number' ? record.multipleSet : 1);
    setMultipleVisible(true);
  };

  const handleMultipleSubmit = async () => {
    if (!currentProduct) return;
    setMultipleLoading(true);
    try {
      await apiPost('/wholesale/product/multiple/save', {
        productId: currentProduct.productId,
        multiple: multipleVal,
      });
      Toast.success({ content: t('倍数购买设置成功') });
      setMultipleVisible(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setMultipleLoading(false);
    }
  };

  const columns: ColumnConfig[] = [
    {
      title: '商品名称',
      dataIndex: 'productName',
      width: 260,
      render: (_: unknown, row: unknown) => {
        const record = row as WholesaleProductRow;
        return (
          <Space align="center" spacing={12}>
            {record.picThumb ? (
              <Image src={record.picThumb} width={40} height={40} style={{ borderRadius: 4 }} />
            ) : (
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 4,
                  backgroundColor: 'var(--semi-color-fill-1)',
                }}
              />
            )}
            <Text style={{ maxWidth: 190 }} ellipsis={{ showTooltip: true }}>
              {record.productName}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '商品信息',
      dataIndex: 'productInfo',
      width: 200,
      render: (_: unknown, row: unknown) => {
        const record = row as WholesaleProductRow;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
            <Text type="tertiary">{t('编码：')}{record.productSn || '--'}</Text>
            <Text type="tertiary">{t('售价：')}{record.retailPriceRange || '--'}</Text>
          </div>
        );
      },
    },
    {
      title: '批发价',
      dataIndex: 'wholesalePrice',
      width: 140,
      render: (_: unknown, row: unknown) => {
        const record = row as WholesaleProductRow;
        return record.wholesalePriceDisplay ? (
          <Text style={{ color: 'var(--semi-color-danger)' }}>{record.wholesalePriceDisplay}</Text>
        ) : (
          <Text type="tertiary">{t('未设置')}</Text>
        );
      },
    },
    {
      title: '起批维度',
      dataIndex: 'moqDimension',
      width: 100,
      render: (_: unknown, row: unknown) => {
        const record = row as WholesaleProductRow;
        return record.moqDimensionName ? (
          <Tag size="small">{record.moqDimensionName}</Tag>
        ) : (
          <Text type="tertiary">{t('未设置')}</Text>
        );
      },
    },
    {
      title: '起批数量',
      dataIndex: 'moqDisplay',
      width: 100,
      render: (v: unknown) => (v != null ? <span>{String(v)}</span> : <Text type="tertiary">{t('未设置')}</Text>),
    },
    {
      title: '倍数购买',
      dataIndex: 'multipleSet',
      width: 100,
      render: (v: unknown) => (
        v ? <Tag size="small" color="green">{t('已设置')}</Tag> : <Text type="tertiary">{t('未设置')}</Text>
      ),
    },
    {
      title: '库存',
      dataIndex: 'stock',
      width: 90,
      render: (v: unknown) => <span>{String(v ?? 0)}</span>,
    },
    {
      title: '上下架状态',
      dataIndex: 'shelfStatus',
      width: 110,
      render: (v: unknown) => (
        <Tag size="small" color={Number(v) === 1 ? 'green' : 'grey'}>
          {Number(v) === 1 ? t('上架') : t('下架')}
        </Tag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 280,
      render: (_: unknown, row: unknown) => {
        const record = row as WholesaleProductRow;
        return (
          <Space spacing={4}>
            <Button
              theme="borderless"
              type="primary"
              size="small"
              onClick={() => openPriceModal(record)}
            >
              {t('批发价')}
            </Button>
            <Button
              theme="borderless"
              type="primary"
              size="small"
              onClick={() => openBuyRuleModal(record)}
            >
              {t('起批量')}
            </Button>
            <Button
              theme="borderless"
              type="primary"
              size="small"
              onClick={() => openMultipleModal(record)}
            >
              {t('倍数购买')}
            </Button>
            <Popconfirm
              title={t('确认删除该批发商品？')}
              okType="danger"
              onConfirm={() => handleDelete([record.productId])}
            >
              <Button theme="borderless" type="danger" size="small">
                {t('删除')}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      {bannerVisible && (
        <Banner
          type="warning"
          description={t('批发类商品与各类营销活动互斥，不可叠加优惠')}
          closeIcon
          onClose={() => setBannerVisible(false)}
          style={{ marginBottom: 16 }}
        />
      )}

      <ListPage
        key={reloadKey}
        api="/wholesale/product/page"
        rowKey="productId"
        columns={columns}
        selectable
        batchActions={(rows: WholesaleProductRow[], clear) => (
          <Space>
            <Button
              size="small"
              onClick={() => {
                setBatchProductIds(rows.map((r) => r.productId));
                setBatchRuleVisible(true);
              }}
            >
              {t('批量设置起批量')}
            </Button>
            <Popconfirm
              title={t('确认要批量删除所选批发商品吗？')}
              okType="danger"
              onConfirm={async () => {
                await handleDelete(rows.map((r) => r.productId));
                clear();
              }}
            >
              <Button type="danger" size="small">
                {t('批量删除')} ({rows.length})
              </Button>
            </Popconfirm>
          </Space>
        )}
        toolbarExtra={
          <Button icon={<IconPlus />} type="primary" onClick={() => setAddVisible(true)}>
            {t('添加批发商品')}
          </Button>
        }
        filters={[
          {
            field: 'keyword',
            label: '商品名称',
            type: 'input',
            placeholder: '输入商品名称/货号',
          },
          {
            field: 'moqDimension',
            label: '起批维度',
            type: 'select',
            placeholder: '请选择起批维度',
            options: [
              { label: 'SPU', value: 1 },
              { label: 'SKU', value: 2 },
            ],
          },
        ]}
      />

      {/* 添加商品弹窗 */}
      <Modal
        title={t('添加批发商品')}
        visible={addVisible}
        onCancel={() => setAddVisible(false)}
        onOk={handleAddSubmit}
        confirmLoading={addLoading}
        width={480}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('商品ID')}</div>
          <InputNumber
            style={{ width: '100%' }}
            placeholder={t('请输入商品ID')}
            value={addProductId}
            onChange={(val) => setAddProductId(Number(val) || undefined)}
          />
        </div>
      </Modal>

      {/* 批发价设置 */}
      <Modal
        title={t('批发价设置')}
        visible={priceVisible}
        onCancel={() => setPriceVisible(false)}
        onOk={handlePriceSubmit}
        confirmLoading={priceLoading}
        width={500}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('商品名称')}</div>
          <Text>{currentProduct?.productName || '--'}</Text>
          <div style={{ marginTop: 16, marginBottom: 6, fontWeight: 500 }}>{t('批发价')}</div>
          <Input
            placeholder={t('请输入批发价 (如 19.90)')}
            value={priceForm.wholesalePrice}
            onChange={(val) => setPriceForm({ wholesalePrice: val })}
          />
        </div>
      </Modal>

      {/* 起批量设置 */}
      <Modal
        title={t('起批量设置')}
        visible={buyRuleVisible}
        onCancel={() => setBuyRuleVisible(false)}
        onOk={handleBuyRuleSubmit}
        confirmLoading={buyRuleLoading}
        width={500}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('起批维度')}</div>
            <RadioGroup
              value={buyRuleForm.moqDimension}
              onChange={(e) => setBuyRuleForm({ ...buyRuleForm, moqDimension: Number(e.target.value) })}
            >
              <Radio value={1}>SPU</Radio>
              <Radio value={2}>SKU</Radio>
            </RadioGroup>
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('起批数量')}</div>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              value={buyRuleForm.moq}
              onChange={(val) => setBuyRuleForm({ ...buyRuleForm, moq: Number(val) || 1 })}
            />
          </div>
        </div>
      </Modal>

      {/* 批量设置起批量 */}
      <Modal
        title={t('批量设置起批量')}
        visible={batchRuleVisible}
        onCancel={() => setBatchRuleVisible(false)}
        onOk={handleBatchRuleSubmit}
        confirmLoading={batchRuleLoading}
        width={480}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('起批数量')}</div>
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            value={batchMoq}
            onChange={(val) => setBatchMoq(Number(val) || 1)}
          />
        </div>
      </Modal>

      {/* 倍数购买设置 */}
      <Modal
        title={t('倍数购买设置')}
        visible={multipleVisible}
        onCancel={() => setMultipleVisible(false)}
        onOk={handleMultipleSubmit}
        confirmLoading={multipleLoading}
        width={480}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('购买倍数')}</div>
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            value={multipleVal}
            onChange={(val) => setMultipleVal(Number(val) || 1)}
          />
        </div>
      </Modal>
    </div>
  );
}
