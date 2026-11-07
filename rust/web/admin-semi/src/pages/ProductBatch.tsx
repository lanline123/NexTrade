import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  InputNumber,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Table,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost, getToken } from '../api';
import ProductPicker from '../components/ProductPicker';
import { useI18n } from '../i18n';

const { Text } = Typography;

export type ProductBatchMode = 'export' | 'add' | 'edit';

interface ProductBatchPageProps {
  mode: ProductBatchMode;
}


export default function ProductBatch({ mode }: ProductBatchPageProps) {
  const { t } = useI18n();
  const [dealRange, setDealRange] = useState(0);
  const [rangeIds, setRangeIds] = useState<number[]>([]);
  /** 分类/品牌选项（指定分类/品牌导出范围） */
  const [categoryOptions, setCategoryOptions] = useState<Array<{ categoryId: number; categoryName: string }>>([]);
  const [brandOptions, setBrandOptions] = useState<Array<{ brandId: number; brandName: string }>>([]);

  useEffect(() => {
    apiGet<any>('/product/category/getAllCategory')
      .then((result) => {
        const flat: Array<{ categoryId: number; categoryName: string }> = [];
        const walk = (nodes: any[], prefix: string) =>
          (Array.isArray(nodes) ? nodes : []).forEach((node) => {
            flat.push({ categoryId: node.categoryId, categoryName: `${prefix}${node.categoryName || ''}` });
            if (Array.isArray(node.children)) walk(node.children, `${prefix}　`);
          });
        walk(result?.records || result || [], '');
        setCategoryOptions(flat);
      })
      .catch(() => undefined);
    apiGet<any>('/product/brand/list', { page: 1, size: 200 })
      .then((result) =>
        setBrandOptions(
          (result?.records || result?.list || []).map((item: any) => ({
            brandId: item.brandId,
            brandName: item.brandName || '',
          })),
        ),
      )
      .catch(() => undefined);
  }, []);
  const [exporting, setExporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isAutoCat, setIsAutoCat] = useState(0);
  const [isAutoBrand, setIsAutoBrand] = useState(0);
  const [modifyTypes, setModifyTypes] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<
    Array<{ productId: number; productName?: string; picThumb?: string }>
  >([]);
  const [submitting, setSubmitting] = useState(false);

  const submitExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('dealRange', String(dealRange));
      if (dealRange >= 1 && dealRange <= 4) {
        params.set('rangeIds', rangeIds.join(','));
      }
      const res = await fetch(`/adminapi/product/productBatch/productBatchDeal?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = t('商品批量导出.csv');
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('导出失败') });
    } finally {
      setExporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/adminapi/product/productBatch/downloadTemplate', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = t('商品批量导入模板.xlsx');
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      Toast.error({ content: t('模板下载失败') });
    }
  };

  const submitUpload = async () => {
    if (!file) {
      Toast.error({ content: t('请选择文件!') });
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (mode === 'add') {
        form.append('isAutoCat', String(isAutoCat));
        form.append('isAutoBrand', String(isAutoBrand));
        form.append('isChangePic', '0');
        form.append('isUpload', '1');
      }
      const result = await apiPost<{ msg?: string }>(
        mode === 'add' ? '/product/productBatch/productBatchDeal' : '/product/productBatch/productBatchModify',
        form as unknown as Record<string, unknown>,
      );
      Modal.info({
        title: t('导入结果'),
        content: result?.msg || t('导入完成'),
        maskClosable: true,
      });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('导入失败') });
    } finally {
      setSubmitting(false);
    }
  };

  const isUploadMode = mode !== 'export';

  const MODIFY_OPTIONS = [
    { lable: '商品上下架状态', key: 'productStatus' },
    { lable: '商品名称', key: 'productName' },
    { lable: '商品分类', key: 'categoryId' },
    { lable: '商品品牌', key: 'brandId' },
    { lable: '商品货号', key: 'productSn' },
    { lable: '条形编码', key: 'productTsn' },
    { lable: '商品售价', key: 'productPrice' },
  ];

  return (
    <Card shadows="hover" className="product-batch-page">
      <div className="batch-notice">
        {mode === 'export' ? (
          <>
            <p>{t('提示：')}</p>
            <p>{t('1、导出的文件可编辑后进行修改后再通过“商品批量上传”或“商品批量修改修改”功能完成批量导入或修改')}</p>
            <p>{t(`2、本系统解决了CSV导入导出时的','号和'"'号的问题，所以商品描述和商品介绍处可以不用再对这些符合进行额外处理！`)}</p>
          </>
        ) : (
          <>
            <p>{t('上传说明')}</p>
            <p>{t('1、请先下载模板文件，按模板填写后上传导入；仅支持 .xls / .xlsx / .csv 格式，一次最多导入 2000 条数据。')}</p>
            <p>{t('2、商品分类：请按分类级别依次填写名称，使用 | 分隔，比如：家用电器 | 电视 | 平板电视；商品品牌：填写品牌名称。')}</p>
            <p>{t('3、是否上架：填1代表上架，0代表下架；关键词：请用空格分隔。')}</p>
            <p>{t('4、商品图片请填写完整 http 链接（多张图片用 | 分隔，第一张作为主图），单次最多上传 3000 张。')}</p>
          </>
        )}
      </div>

      {mode === 'export' ? (
        <>
          <div className="batch-form-row">
            <Text strong>{t('处理范围')}</Text>
          </div>
          <div className="batch-form-row">
            <RadioGroup
              value={dealRange}
              onChange={(event) => setDealRange(Number(event.target.value))}
            >
              <Radio value={0}>{t('全部商品')}</Radio>
              <Radio value={1}>{t('指定分类')}</Radio>
              <Radio value={2}>{t('指定品牌')}</Radio>
              <Radio value={3}>{t('指定商品')}</Radio>
              <Radio value={4}>{t('不包含以下商品')}</Radio>
            </RadioGroup>
          </div>
          {dealRange === 1 || dealRange === 2 ? (
            <div className="batch-form-row">
              <Select
                style={{ width: 320 }}
                multiple
                filter
                placeholder={dealRange === 1 ? t('选择分类') : t('选择品牌')}
                value={rangeIds}
                optionList={dealRange === 1
                  ? categoryOptions.map((item) => ({ label: item.categoryName, value: item.categoryId }))
                  : brandOptions.map((item) => ({ label: item.brandName, value: item.brandId }))}
                onChange={(next: any) => setRangeIds(((next as any[]) || []).map(Number))}
              />
            </div>
          ) : null}
          {dealRange === 3 || dealRange === 4 ? (
            <div className="batch-form-row">
              <ProductPicker value={rangeIds} onChange={setRangeIds} max={500} />
            </div>
          ) : null}
          <Button theme="solid" type="primary" loading={exporting} onClick={submitExport}>
            {t('提交')}
          </Button>
        </>
      ) : (
        <>
          <div className="batch-form-row">
            <label style={{ cursor: 'pointer' }}>
              <input
                type="file"
                accept=".xls,.xlsx,.csv"
                style={{ display: 'none' }}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <Button theme="solid" type="primary">
                {file ? t('已选择：{name}', { name: file.name }) : t('添加文件')}
              </Button>
            </label>
            <Button onClick={downloadTemplate}>{t('下载导入模板')}</Button>
          </div>
          {mode === 'add' ? (
            <>
              <div className="batch-form-row">
                <Text strong>{t('是否自动添加分类')}</Text>
                <RadioGroup value={isAutoCat} onChange={(event) => setIsAutoCat(Number(event.target.value))}>
                  <Radio value={1}>{t('是')}</Radio>
                  <Radio value={0}>{t('否')}</Radio>
                </RadioGroup>
                <Text type="tertiary" size="small">
                  {t('如果选指否，则分类不存在时会输出错误；如果选指是，则会自动新建分类！')}
                </Text>
              </div>
              <div className="batch-form-row">
                <Text strong>{t('是否自动添加品牌')}</Text>
                <RadioGroup value={isAutoBrand} onChange={(event) => setIsAutoBrand(Number(event.target.value))}>
                  <Radio value={1}>{t('是')}</Radio>
                  <Radio value={0}>{t('否')}</Radio>
                </RadioGroup>
              </div>
            </>
          ) : null}
          <Button theme="solid" type="primary" loading={submitting} onClick={submitUpload}>
            {t('提 交')}
          </Button>
        </>
      )}
      {mode === 'edit' ? (
        <>
          <div className="batch-form-row">
            <Text strong>{t('选择修改：')}</Text>
            <RadioGroup type="button" value={modifyTypes[0] || ''} onChange={(event) => setModifyTypes([event.target.value])}>
              {MODIFY_OPTIONS.map((item) => (
                <Radio key={item.key} value={item.key}>
                  {t(item.lable)}
                </Radio>
              ))}
            </RadioGroup>
          </div>
          <div className="batch-form-row" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
            <Text strong>{t('商品信息：')}</Text>
            <ProductPicker
              value={selectedProducts.map((item) => item.productId)}
              onChange={(ids) => {
                if (!ids.length) {
                  setSelectedProducts([]);
                  return;
                }
                apiGet<{ records: Array<{ productId: number; productName?: string; picThumb?: string }> }>(
                  '/product/product/list',
                  { page: 1, size: 100, productIds: ids.join(',') },
                )
                  .then((result) => {
                    setSelectedProducts(
                      (result.records || []).filter((item) => ids.includes(Number(item.productId))),
                    );
                  })
                  .catch(() => undefined);
              }}
              max={100}
            />
            <Table
              size="small"
              style={{ width: '100%' }}
              pagination={false}
              rowKey="productId"
              dataSource={selectedProducts}
              columns={[
                {
                  title: t('商品信息'),
                  dataIndex: 'productName',
                  render: (value: string, row: { picThumb?: string }) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {row.picThumb ? <img src={row.picThumb} alt="" width={32} height={32} style={{ borderRadius: 4, objectFit: 'cover' }} /> : null}
                      <span>{value || '-'}</span>
                    </div>
                  ),
                },
              ]}
            />
            <Text type="tertiary" size="small">
              {t('已选 {count} 件商品；修改项以上传的模板文件内容为准，提交后按 productBatchModify 处理。', {
                count: selectedProducts.length,
              })}
            </Text>
          </div>
        </>
      ) : null}
    </Card>
  );
}
