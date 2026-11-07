import { useEffect, useState } from 'react';
import { Button, Checkbox, DatePicker, Input, InputNumber, Radio, RadioGroup, Select, Toast, Typography } from '@douyinfe/semi-ui';

const { Text } = Typography;
import { apiGet, apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import FormDrawer from '../framework/FormDrawer';
import ImageUploader from './ImageUploader';
import RichTextEditor from './RichTextEditor';
import ProductPicker from './ProductPicker';

interface Option {
  id: number;
  name: string;
}

interface ProductFormDrawerProps {
  visible: boolean;
  productId?: number;
  categories: Option[];
  brands: Option[];
  onCancel: () => void;
  onSaved: () => void;
}

interface ShippingTpl {
  shippingTplId: number;
  shippingTplName: string;
}

const emptyValues: Record<string, any> = {
  productType: 1,
  productName: '',
  productSn: '',
  productTsn: '',
  categoryId: undefined,
  brandId: undefined,
  productPrice: 0,
  marketPrice: 0,
  costPrice: 0,
  productStock: 0,
  productStatus: 1,
  productBrief: '',
  productVideo: '',
  productDesc: '',
  remark: '',
  keywords: '',
  productWeight: 0,
  saleMode: 0,
  limitNumber: 0,
  shippingTplId: undefined,
  freeShipping: true,
  isLogistics: true,
  isShopPickup: false,
  noShipping: false,
  isBest: false,
  isNew: false,
  isHot: false,
  virtualSales: 0,
  seoIdentification: '',
  isSupportReturn: true,
  isSupportCod: true,
  gallery: [],
  skuType: 1,
  skuRows: [],
};

function SkuEditor({ formApi, values }: { formApi: any; values: Record<string, any> }) {
  const { t } = useI18n();
  const skuType = Number(values.skuType || 1);
  const rows: Array<Record<string, any>> = values.skuRows || [];

  const setRows = (next: Array<Record<string, any>>) => formApi?.setValue('skuRows', next);

  const updateRow = (index: number, key: string, value: any) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    setRows(next);
  };

  const addRow = () => {
    setRows([
      ...rows,
      { skuValue: '', skuSn: '', skuPrice: 0, marketPrice: 0, costPrice: 0, skuStock: 0 },
    ]);
  };

  return (
    <div className="product-sku-editor">
      <RadioGroup
        value={skuType}
        onChange={(value) => {
          const next = Number(value);
          formApi?.setValue('skuType', next);
          if (next === 2 && !rows.length) addRow();
        }}
        options={[
          { label: t('单规格'), value: 1 },
          { label: t('多规格'), value: 2 },
        ]}
      />
      {skuType === 2 && (
        <div className="product-sku-table">
          <div className="product-sku-row product-sku-head">
            <span>{t('规格值')}</span>
            <span>{t('SKU编码')}</span>
            <span>{t('售价')}</span>
            <span>{t('市场价')}</span>
            <span>{t('成本价')}</span>
            <span>{t('库存')}</span>
            <span />
          </div>
          {rows.map((row, index) => (
            <div className="product-sku-row" key={index}>
              <Input
                value={row.skuValue || ''}
                placeholder={t('如 红色 / 大号')}
                onChange={(value) => updateRow(index, 'skuValue', value)}
              />
              <Input
                value={row.skuSn || ''}
                placeholder={t('SKU编码')}
                onChange={(value) => updateRow(index, 'skuSn', value)}
              />
              <InputNumber
                value={row.skuPrice}
                min={0}
                precision={2}
                onChange={(value) => updateRow(index, 'skuPrice', value)}
              />
              <InputNumber
                value={row.marketPrice}
                min={0}
                precision={2}
                onChange={(value) => updateRow(index, 'marketPrice', value)}
              />
              <InputNumber
                value={row.costPrice}
                min={0}
                precision={2}
                onChange={(value) => updateRow(index, 'costPrice', value)}
              />
              <InputNumber
                value={row.skuStock}
                min={0}
                precision={0}
                onChange={(value) => updateRow(index, 'skuStock', value)}
              />
              <Button
                theme="borderless"
                type="danger"
                size="small"
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
              >
                {t('删除')}
              </Button>
            </div>
          ))}
          <Button theme="light" onClick={addRow}>
            {t('+ 添加规格')}
          </Button>
        </div>
      )}
    </div>
  );
}

function RecommendField({ formApi, values }: { formApi: any; values: Record<string, any> }) {
  const { t } = useI18n();
  const fields = ['isBest', 'isNew', 'isHot'];
  const [checked, setChecked] = useState<Record<string, boolean>>(() => ({
    isBest: Boolean(values.isBest),
    isNew: Boolean(values.isNew),
    isHot: Boolean(values.isHot),
  }));

  useEffect(() => {
    setChecked({
      isBest: Boolean(values.isBest),
      isNew: Boolean(values.isNew),
      isHot: Boolean(values.isHot),
    });
  }, [values.isBest, values.isNew, values.isHot]);

  const labels: Record<string, string> = {
    isBest: '精品',
    isNew: '新品',
    isHot: '热销',
  };

  return (
    <div className="product-recommend-field">
      {fields.map((field) => (
        <Checkbox
          key={field}
          checked={checked[field]}
          onChange={(event) => {
            const next = Boolean(event.target.checked);
            setChecked((current) => ({ ...current, [field]: next }));
            formApi?.setValue(field, next);
          }}
        >
          {t(labels[field])}
        </Checkbox>
      ))}
    </div>
  );
}

export default function ProductFormDrawer({
  visible,
  productId,
  categories,
  brands,
  onCancel,
  onSaved,
}: ProductFormDrawerProps) {
  const { t } = useI18n();
  const [initialValues, setInitialValues] = useState<Record<string, any>>(emptyValues);
  const [shippingTpls, setShippingTpls] = useState<ShippingTpl[]>([]);
  const [services, setServices] = useState<Array<{ productServiceId: number; productServiceName: string }>>([]);
  const [loading, setLoading] = useState(false);
  /** 店铺商品分类（对应旧版 BasicInfo 店铺商品分类下拉）。 */
  const [shopCategories, setShopCategories] = useState<Array<{ categoryId: number; categoryName: string }>>([]);
  /** 定时可售/禁售状态（GET/POST /product/product/saleStatus，仅编辑态）。 */
  const [saleState, setSaleState] = useState<{
    loaded: boolean;
    manualSaleStatus: number;
    saleBanTime: string;
    saleRecoverTime: string;
  }>({ loaded: false, manualSaleStatus: 1, saleBanTime: '', saleRecoverTime: '' });

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    if (!productId) {
      setInitialValues(emptyValues);
      return () => {
        alive = false;
      };
    }
    setLoading(true);
    apiGet<Record<string, any>>('/product/product/detail', { id: productId })
      .then((detail) => {
        if (!alive) return;
        const images = (detail.imgList || []).map((item: any) => item.picUrl).filter(Boolean);
        if (!images.length && detail.picUrl) images.push(detail.picUrl);
        setInitialValues({
          ...emptyValues,
          productType: Number(detail.productType || 1),
          productName: detail.productName || '',
          productSn: detail.productSn || '',
          productTsn: detail.productTsn || '',
          categoryId: detail.categoryId || undefined,
          brandId: detail.brandId || undefined,
          productPrice: Number(detail.productPrice || 0),
          marketPrice: Number(detail.marketPrice || 0),
          costPrice: Number(detail.costPrice || 0),
          productStock: Number(detail.productStock || 0),
          productStatus: Number(detail.productStatus ?? 1),
          productBrief: detail.productBrief || '',
          productVideo: detail.productVideo || '',
          productDesc: detail.productDesc || '',
          remark: detail.remark || '',
          keywords: detail.keywords || '',
          productWeight: Number(detail.productWeight || 0),
          saleMode: Number(detail.saleMode || 0),
          limitNumber: Number(detail.limitNumber || 0),
          shippingTplId: detail.shippingTplId || undefined,
          freeShipping: Number(detail.freeShipping || 0) === 1,
          isLogistics: Number(detail.isLogistics ?? 1) === 1,
          isShopPickup: Number(detail.isShopPickup || 0) === 1,
          noShipping: Number(detail.noShipping || 0) === 1,
          isBest: Number(detail.isBest || 0) === 1,
          isNew: Number(detail.isNew || 0) === 1,
          isHot: Number(detail.isHot || 0) === 1,
          virtualSales: Number(detail.virtualSales || 0),
          seoIdentification: detail.seoIdentification || '',
          isSupportReturn: Number(detail.isSupportReturn ?? 1) === 1,
          isSupportCod: Number(detail.isSupportCod ?? 1) === 1,
          gallery: images,
          skuType: Number(detail.skuType || 1),
          skuRows: (detail.productList || []).map((sku: any) => ({
            skuId: sku.skuId,
            skuValue: sku.skuValue || '',
            skuSn: sku.skuSn || '',
            skuPrice: Number(sku.skuPrice || 0),
            marketPrice: Number(sku.marketPrice || 0),
            costPrice: Number(sku.costPrice || 0),
            skuStock: Number(sku.skuStock || 0),
          })),
          productServiceIds: detail.productServiceIds || [],
          productRelated: detail.productRelated || [],
          productArticleList: detail.productArticleList || [],
          shopCategoryId: detail.shopCategoryId || undefined,
        });
        // 读取当前定时可售状态
        apiGet<any>('/product/product/saleStatus', { productId })
          .then((state) => {
            if (!alive) return;
            const toLocal = (seconds: unknown) => {
              const num = Number(seconds || 0);
              if (!num) return '';
              const date = new Date(num * 1000);
              const pad = (n: number) => String(n).padStart(2, '0');
              return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
            };
            setSaleState({
              loaded: true,
              manualSaleStatus: Number(state?.manualSaleStatus ?? 1),
              saleBanTime: toLocal(state?.saleBanTime),
              saleRecoverTime: toLocal(state?.saleRecoverTime),
            });
          })
          .catch(() => undefined);
      })
      .catch((error) => Toast.error({ content: error.message }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [visible, productId]);

  useEffect(() => {
    if (!visible) return;
    apiGet<ShippingTpl[]>('/product/product/shippingTplList')
      .then((result) => setShippingTpls(result || []))
      .catch(() => undefined);
    apiGet<any>('/merchant/shopProductCategory/list', { page: 1, size: 100 })
      .then((result) => {
        const records = Array.isArray(result) ? result : result?.records || [];
        setShopCategories(
          records.map((item: any) => ({ categoryId: item.categoryId, categoryName: item.categoryName || item.name || '' })),
        );
      })
      .catch(() => undefined);
    apiGet<{ records?: Array<any> }>('/product/productServices/list', { page: 1, size: 100 })
      .then((result) => {
        const list = Array.isArray(result) ? result : result?.records || [];
        setServices(
          list.map((item: any) => ({
            productServiceId: item.productServiceId,
            productServiceName: item.productServiceName,
          })),
        );
      })
      .catch(() => undefined);
  }, [visible]);

  const submit = async (payload: Record<string, any>) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持保存，请登录后操作') });
      return;
    }
    if (payload.skuType === 2) {
      if (!payload.productList.length) throw new Error(t('请至少添加一个规格'));
      if (payload.productList.some((row: any) => !String(row.skuValue || '').trim())) {
        throw new Error(t('请填写完整的规格值'));
      }
    }
    await apiPost(productId ? '/product/product/update' : '/product/product/create', payload);
    // 定时可售/禁售走独立 saleStatus 端点（对齐旧版 SaleControl）。
    if (productId && saleState.loaded) {
      const toSeconds = (value: string | number | undefined) => {
        if (value === undefined || value === null || value === '' || Number(value) === 0) return 0;
        const date = new Date(value);
        return Number.isFinite(date.getTime()) ? Math.floor(date.getTime() / 1000) : 0;
      };
      await apiPost('/product/product/saleStatus', {
        productId,
        saleStatus: Number(saleState.manualSaleStatus ?? 1),
        saleBanTime: Number(saleState.manualSaleStatus) === 0 ? toSeconds(saleState.saleBanTime) : 0,
        saleRecoverTime: Number(saleState.manualSaleStatus) === 1 ? toSeconds(saleState.saleRecoverTime) : 0,
      }).catch((error) => {
        Toast.warning({ content: error instanceof Error ? error.message : t('定时可售设置保存失败') });
      });
    }
    Toast.success({ content: productId ? t('商品已更新') : t('商品已创建') });
    onSaved();
    onCancel();
  };

  return (
    <FormDrawer
      visible={visible}
      mode={productId ? 'edit' : 'create'}
      initialValues={initialValues}
      onCancel={onCancel}
      onSubmit={submit}
      saving={loading}
      config={{
        title: '商品',
        addText: '新增商品',
        width: 950,
        labelWidth: 'auto',
        inputWidth: 420,
        createApi: '/product/product/create',
        updateApi: '/product/product/update',
        idField: 'productId',
        sections: [
          {
            key: 'basic',
            title: '基本信息',
            fields: [
              {
                field: 'productType',
                label: t('商品类型'),
                type: 'select',
                disabled: Boolean(productId),
                options: [
                  { label: t('普通商品'), value: 1 },
                  { label: t('虚拟商品'), value: 2 },
                  { label: t('卡密商品'), value: 3 },
                  { label: t('付费内容'), value: 4 },
                  { label: t('预约到店'), value: 5 },
                  { label: t('上门服务'), value: 6 },
                  { label: t('实体礼品卡'), value: 7 },
                  { label: t('电子礼品卡'), value: 8 },
                ],
                extraText: t('商品类型发布后不可修改。'),
              },
              {
                field: 'productName',
                label: t('商品名称'),
                required: true,
                placeholder: t('请输入商品名称'),
              },
              {
                field: 'categoryId',
                label: t('商品类目'),
                type: 'select',
                required: true,
                placeholder: t('请选择商品类目'),
                options: categories.map((item) => ({ label: item.name, value: item.id })),
              },
              {
                field: 'brandId',
                label: t('商品品牌'),
                type: 'select',
                placeholder: t('请选择商品品牌'),
                options: brands.map((item) => ({ label: item.name, value: item.id })),
              },
              {
                field: 'shopCategoryId',
                label: t('店铺商品分类'),
                type: 'select',
                placeholder: t('请选择店铺商品分类'),
                options: shopCategories.map((item) => ({ label: item.categoryName, value: item.categoryId })),
              },
              { field: 'productSn', label: t('商品编码'), placeholder: t('不填自动生成') },
              { field: 'productTsn', label: t('商品条码'), placeholder: t('如 69 开头的 13 位标准码') },
              { field: 'productWeight', label: t('商品重量'), type: 'number' },
              {
                field: 'productStatus',
                label: t('是否上架'),
                type: 'radio',
                options: [
                  { label: t('上架'), value: 1 },
                  { label: t('下架'), value: 0 },
                ],
              },
              {
                field: 'gallery',
                label: t('商品图片'),
                type: 'custom',
                render: ({ formApi, values }) => (
                  <ImageUploader
                    value={values.gallery || []}
                    onChange={(urls) => formApi?.setValue('gallery', urls)}
                  />
                ),
              },
              { field: 'productVideo', label: t('商品视频'), placeholder: t('视频地址，可留空') },
              { field: 'keywords', label: t('搜索关键词'), placeholder: t('多个关键词用空格分隔') },
              { field: 'productBrief', label: t('商品描述'), type: 'textarea' },
            ],
          },
          {
            key: 'sale',
            title: '销售信息',
            fields: [
              {
                field: 'saleMode',
                label: t('销售模式'),
                type: 'radio',
                options: [
                  { label: t('现货销售'), value: 0 },
                  { label: t('预售模式'), value: 1 },
                ],
              },
              { field: 'productPrice', label: t('销售价'), type: 'number' },
              { field: 'marketPrice', label: t('市场价'), type: 'number' },
              { field: 'costPrice', label: t('成本价'), type: 'number' },
              { field: 'productStock', label: t('库存'), type: 'number' },
              { field: 'limitNumber', label: t('限购数量'), type: 'number' },
              {
                field: 'skuType',
                label: t('规格类型'),
                type: 'custom',
                render: ({ formApi, values }) => <SkuEditor formApi={formApi} values={values} />,
              },
              {
                field: 'saleSchedule',
                label: t('定时可售/禁售'),
                type: 'custom',
                render: () =>
                  productId ? (
                    <div className="product-sale-schedule">
                      <RadioGroup
                        value={saleState.manualSaleStatus}
                        onChange={(event) =>
                          setSaleState((current) => ({ ...current, manualSaleStatus: Number(event.target.value) }))
                        }
                      >
                        <Radio value={1}>{t('可售')}</Radio>
                        <Radio value={0}>{t('禁售')}</Radio>
                      </RadioGroup>
                      {Number(saleState.manualSaleStatus) === 0 && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 4 }}>
                            {t('启用定时禁售')}
                          </div>
                          <DatePicker
                            type="dateTime"
                            format="yyyy-MM-dd HH:mm:ss"
                            style={{ width: 240 }}
                            placeholder={t('禁售开始时间')}
                            value={saleState.saleBanTime || undefined}
                            onChange={(next) =>
                              setSaleState((current) => ({
                                ...current,
                                saleBanTime: next ? String(next) : '',
                              }))
                            }
                          />
                        </div>
                      )}
                      {Number(saleState.manualSaleStatus) === 1 && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 4 }}>
                            {t('启用定时可售')}
                          </div>
                          <DatePicker
                            type="dateTime"
                            format="yyyy-MM-dd HH:mm:ss"
                            style={{ width: 240 }}
                            placeholder={t('恢复可售时间')}
                            value={saleState.saleRecoverTime || undefined}
                            onChange={(next) =>
                              setSaleState((current) => ({
                                ...current,
                                saleRecoverTime: next ? String(next) : '',
                              }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <Text type="tertiary" size="small">
                      {t('保存商品后可设置定时可售/禁售。')}
                    </Text>
                  ),
              },
            ],
          },
          {
            key: 'logistics',
            title: '物流及配送',
            fields: [
              {
                field: 'shippingTplId',
                label: t('运费模板'),
                type: 'select',
                options: shippingTpls.map((item) => ({
                  label: item.shippingTplName,
                  value: item.shippingTplId,
                })),
              },
              {
                field: 'freeShipping',
                label: t('是否包邮'),
                type: 'switch',
                checkedText: t('包邮'),
                uncheckedText: t('自定义运费'),
              },
              {
                field: 'isLogistics',
                label: t('支持物流'),
                type: 'switch',
                checkedText: t('支持'),
                uncheckedText: t('不支持'),
              },
              {
                field: 'isShopPickup',
                label: t('支持自提'),
                type: 'switch',
                checkedText: t('支持'),
                uncheckedText: t('不支持'),
              },
              {
                field: 'noShipping',
                label: t('无需配送'),
                type: 'switch',
                checkedText: t('无需'),
                uncheckedText: t('需要'),
              },
              {
                field: 'isSupportReturn',
                label: t('支持退货'),
                type: 'switch',
                checkedText: t('支持'),
                uncheckedText: t('不支持'),
              },
              {
                field: 'isSupportCod',
                label: t('支持货到付款'),
                type: 'switch',
                checkedText: t('支持'),
                uncheckedText: t('不支持'),
              },
            ],
          },
          {
            key: 'detail',
            title: '商品详情',
            fields: [
              {
                field: 'productDesc',
                label: t('商品详情'),
                type: 'custom',
                render: ({ formApi, values }) => (
                  <RichTextEditor
                    value={values.productDesc || ''}
                    onChange={(html) => formApi?.setValue('productDesc', html)}
                    height={420}
                  />
                ),
              },
            ],
          },
          {
            key: 'advanced',
            title: '高级信息',
            fields: [
              {
                field: 'isBest',
                label: t('加入推荐'),
                type: 'custom',
                render: ({ formApi, values }) => (
                  <RecommendField formApi={formApi} values={values} />
                ),
              },
              {
                field: 'productServiceIds',
                label: t('服务说明'),
                type: 'checkbox',
                options: services.map((item) => ({
                  label: item.productServiceName,
                  value: item.productServiceId,
                })),
              },
              {
                field: 'virtualSales',
                label: t('显示销量'),
                type: 'number',
                extraText: t('显示销量会随下单而增加，但不是真实销售数据'),
              },
              {
                field: 'productRelated',
                label: t('相关商品'),
                type: 'custom',
                render: ({ formApi, values }) => (
                  <ProductPicker
                    value={values.productRelated || []}
                    onChange={(ids) => formApi?.setValue('productRelated', ids)}
                    max={10}
                  />
                ),
              },
              {
                field: 'productArticleList',
                label: t('关联文章'),
                type: 'select',
                multiple: true,
                optionsApi: '/content/article/list',
                optionsParams: { page: 1, pageSize: 100 },
                optionLabel: 'articleTitle',
                optionValue: 'articleId',
                placeholder: t('最多添加 10 篇文章'),
              },
            ],
          },
        ],
        toPayload: (values) => ({
          productId: productId || undefined,
          ...values,
          picUrl: (values.gallery || [])[0] || '',
          imgList: (values.gallery || []).map((picUrl: string) => ({ picUrl })),
          freeShipping: values.freeShipping ? 1 : 0,
          isLogistics: values.isLogistics ? 1 : 0,
          isShopPickup: values.isShopPickup ? 1 : 0,
          noShipping: values.noShipping ? 1 : 0,
          isBest: values.isBest ? 1 : 0,
          isNew: values.isNew ? 1 : 0,
          isHot: values.isHot ? 1 : 0,
          isSupportReturn: values.isSupportReturn ? 1 : 0,
          isSupportCod: values.isSupportCod ? 1 : 0,
          skuType: Number(values.skuType || 1),
          productList:
            Number(values.skuType) === 2
              ? (values.skuRows || []).map((row: any) => ({
                  skuId: row.skuId,
                  skuValue: row.skuValue,
                  skuSn: row.skuSn,
                  skuPrice: row.skuPrice,
                  marketPrice: row.marketPrice,
                  costPrice: row.costPrice,
                  skuStock: row.skuStock,
                  isEnabled: 1,
                  skuData: [{ name: '规格', value: row.skuValue }],
                  attrValues: [row.skuValue],
                }))
              : [],
        }),
      }}
    />
  );
}
