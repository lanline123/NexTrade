/**
 * SKU 级商品选择器（SkuPicker）：对应原版 SelectProduct（isSku=true）选择弹窗。
 *
 * 流程：搜索商品 → 展开该商品规格（GET /product/product/skuList）→
 * 勾选 SKU 行（无规格商品可整行选择，skuId=0）→ 确认返回选中明细。
 *
 * 已接入：积分商品（pointsExchangeManage）、活动赠品（productGiftManage）、
 * 商品入库/出库（productStockRecordDetailList）。
 */

import { useState } from 'react';
import { Button, Image, Input, Modal, Space, Table, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { apiGet } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

export interface SkuPick {
  productId: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  skuId: number;
  skuValue?: string;
  price?: number | string;
  stock?: number;
}

interface SkuRow {
  skuId: number;
  skuValue?: string;
  skuSn?: string;
  skuPrice?: number | string;
  skuStock?: number;
  isEnabled?: number;
}

interface SkuPickerProps {
  /** 已选 SKU 明细 */
  value?: SkuPick[];
  onChange: (picks: SkuPick[]) => void;
  /** 最多可选条数；0/不传 = 不限 */
  max?: number;
  disabled?: boolean;
  placeholder?: string;
}

export default function SkuPicker({ value = [], onChange, max = 0, disabled, placeholder }: SkuPickerProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  /** 当前展开规格的商品 */
  const [skuTarget, setSkuTarget] = useState<Record<string, any> | null>(null);
  const [skuRows, setSkuRows] = useState<SkuRow[]>([]);
  const [skuLoading, setSkuLoading] = useState(false);
  /** 选中明细（skuId 为键） */
  const [picked, setPicked] = useState<SkuPick[]>(value);

  const search = async (nextPage = 1) => {
    setLoading(true);
    setPage(nextPage);
    try {
      const result = await apiGet<{ records: Array<Record<string, any>>; total: number }>(
        '/product/product/list',
        { keyword: keyword.trim() || undefined, page: nextPage, pageSize: 8 },
      );
      setRows(result.records || []);
      setTotal(Number(result.total || 0));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('商品加载失败') });
    } finally {
      setLoading(false);
    }
  };

  const openSkus = async (product: Record<string, any>) => {
    setSkuTarget(product);
    setSkuLoading(true);
    try {
      const result = await apiGet<{ records?: SkuRow[] }>('/product/product/skuList', {
        id: product.productId,
        page: 1,
        size: 100,
      });
      const list = (result?.records || []).filter((item) => Number(item.skuId || 0) > 0 && Number(item.isEnabled ?? 1) !== 0);
      setSkuRows(list);
    } catch {
      setSkuRows([]);
    } finally {
      setSkuLoading(false);
    }
  };

  const isPicked = (productId: number, skuId: number) =>
    picked.some((item) => item.productId === productId && item.skuId === skuId);

  const toggleSku = (product: Record<string, any>, sku: SkuRow | null) => {
    const skuId = sku ? Number(sku.skuId) : 0;
    if (isPicked(Number(product.productId), skuId)) {
      setPicked((current) =>
        current.filter((item) => !(item.productId === Number(product.productId) && item.skuId === skuId)),
      );
      return;
    }
    if (max > 0 && picked.length >= max) {
      Toast.warning({ content: t('最多选择 {count} 项', { count: max }) });
      return;
    }
    const pick: SkuPick = {
      productId: Number(product.productId),
      productName: product.productName,
      productSn: product.productSn,
      picThumb: product.picThumb || product.picUrl,
      skuId,
      skuValue: sku?.skuValue || '',
      price: sku?.skuPrice ?? product.productPrice,
      stock: sku?.skuStock ?? product.productStock,
    };
    setPicked((current) => [...current, pick]);
  };

  const confirm = () => {
    onChange(picked);
    setVisible(false);
  };

  const remove = (pick: SkuPick) => {
    const next = picked.filter((item) => !(item.productId === pick.productId && item.skuId === pick.skuId));
    setPicked(next);
    onChange(next);
  };

  const skuExpanded = skuRows.length > 0;

  return (
    <div className="sku-picker">
      <Space>
        <Button theme="solid" type="primary" disabled={disabled} onClick={() => { setPicked(value); search(1); setVisible(true); }}>
          {t('选择商品规格')}
        </Button>
        {picked.length > 0 && (
          <>
            <span className="product-picker-count">{t('已选择 {count} 项', { count: picked.length })}</span>
            <Button theme="borderless" onClick={() => { setPicked([]); onChange([]); }}>
              {t('清空')}
            </Button>
          </>
        )}
      </Space>

      {picked.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {picked.map((pick, index) => (
            <div className="sku-picker-row" key={`${pick.productId}-${pick.skuId}-${index}`}>
              {pick.picThumb ? (
                <Image src={pick.picThumb} width={36} height={36} style={{ objectFit: 'cover', borderRadius: 4 }} />
              ) : null}
              <div className="sku-picker-meta">
                <div>{pick.productName || `#${pick.productId}`}</div>
                <Text>
                  {pick.skuId ? `${t('规格')}：${pick.skuValue || pick.skuId}` : t('无规格')}
                  {pick.stock !== undefined ? ` · ${t('库存')} ${pick.stock}` : ''}
                </Text>
              </div>
              <Button theme="borderless" type="danger" size="small" onClick={() => remove(pick)}>
                {t('移除')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal
        title={t('选择商品规格')}
        visible={visible}
        onCancel={() => setVisible(false)}
        onOk={confirm}
        okText={t('确定')}
        cancelText={t('取消')}
        width={860}
      >
        <Space style={{ marginBottom: 10 }}>
          <Input
            prefix={<IconSearch />}
            style={{ width: 260 }}
            placeholder={placeholder || t('搜索商品名称 / 编号')}
            value={keyword}
            showClear
            onClear={() => setKeyword('')}
            onChange={setKeyword}
            onEnterPress={() => search(1)}
          />
          <Button theme="solid" type="primary" onClick={() => search(1)}>
            {t('搜索')}
          </Button>
        </Space>
        <Table
          loading={loading}
          dataSource={rows}
          rowKey="productId"
          pagination={{ currentPage: page, pageSize: 8, total, onChange: (next) => search(next) }}
          columns={[
            {
              title: t('商品信息'),
              dataIndex: 'productName',
              render: (_v: unknown, record: Record<string, any>) => (
                <div className="product-picker-info">
                  {record.picThumb || record.picUrl ? (
                    <Image src={record.picThumb || record.picUrl} width={40} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} />
                  ) : (
                    <span className="product-picker-no-pic" />
                  )}
                  <div>
                    <div>{record.productName}</div>
                    <Text type="tertiary" size="small">{record.productSn || ''}</Text>
                  </div>
                </div>
              ),
            },
            {
              title: t('售价'),
              dataIndex: 'productPrice',
              width: 110,
              render: (v: unknown) => `¥ ${Number(v || 0).toFixed(2)}`,
            },
            {
              title: t('操作'),
              width: 110,
              render: (_v: unknown, record: Record<string, any>) => (
                <Button size="small" onClick={() => openSkus(record)}>
                  {t('选择规格')}
                </Button>
              ),
            },
          ] as any}
        />

        {skuTarget && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--semi-color-border)', paddingTop: 10 }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>
              {skuTarget.productName}
              {!skuExpanded ? <Tag style={{ marginLeft: 8 }}>{t('无规格，点击下面按钮选择整件商品')}</Tag> : null}
            </div>
            <Table
              loading={skuLoading}
              dataSource={skuRows}
              rowKey="skuId"
              pagination={false}
              columns={[
                { title: t('规格'), dataIndex: 'skuValue', render: (v: string) => v || t('默认规格') },
                { title: t('SKU编码'), dataIndex: 'skuSn', width: 150, render: (v: string) => v || '--' },
                { title: t('价格'), dataIndex: 'skuPrice', width: 100, render: (v: unknown) => `¥ ${Number(v || 0).toFixed(2)}` },
                { title: t('库存'), dataIndex: 'skuStock', width: 90 },
                {
                  title: t('操作'),
                  width: 90,
                  render: (_v: unknown, record: SkuRow) =>
                    isPicked(Number(skuTarget.productId), Number(record.skuId)) ? (
                      <Tag color="blue">{t('已选')}</Tag>
                    ) : (
                      <Button size="small" onClick={() => toggleSku(skuTarget, record)}>
                        {t('选择')}
                      </Button>
                    ),
                },
              ] as any}
            />
            {!skuExpanded && (
              <Button
                size="small"
                style={{ marginTop: 8 }}
                onClick={() => toggleSku(skuTarget, null)}
                disabled={isPicked(Number(skuTarget.productId), 0)}
              >
                {isPicked(Number(skuTarget.productId), 0) ? t('已选') : t('选择整件商品')}
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
