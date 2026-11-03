import { useEffect, useState } from 'react';
import {
  Button,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import type { BrandRow } from '../types';
import ImageUploader from '../components/ImageUploader';

const { Text } = Typography;

function BrandSwitch({
  record,
  field,
  value,
}: {
  record: BrandRow;
  field: 'isShow' | 'brandIsHot';
  value?: number;
}) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(value === 1);

  const toggle = async (next: boolean) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    try {
      await apiPost('/product/brand/updateField', {
        id: record.brandId,
        field,
        val: next ? 1 : 0,
      });
      setChecked(next);
      Toast.success({ content: t('已更新') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('更新失败') });
    }
  };

  return <Switch checked={checked} onChange={toggle} size="small" />;
}

const buildColumns = (
  t: (key: string, params?: Record<string, string | number>) => string,
): ColumnConfig<BrandRow>[] => [
  {
    title: '品牌名称',
    dataIndex: 'brandName',
    width: 240,
    render: (value: string, record) => (
      <div className="brand-name-cell">
        <span className="brand-name">{value}</span>
        {record.shop?.shopTitle && (
          <Text type="tertiary" size="small">
            {t('店铺：')}{record.shop.shopTitle}
          </Text>
        )}
      </div>
    ),
  },
  {
    title: '品牌缩略图',
    dataIndex: 'brandLogo',
    width: 130,
    render: (value: string) =>
      value ? (
        <Image src={value} width={60} height={30} style={{ objectFit: 'contain' }} />
      ) : (
        <span className="text-muted">{t('暂无图片')}</span>
      ),
  },
  {
    title: '首字母',
    dataIndex: 'firstWord',
    width: 100,
    render: (value: string) => <Tag>{value || '-'}</Tag>,
  },
  {
    title: '是否热销',
    dataIndex: 'brandIsHot',
    width: 100,
    render: (value: number, record) => (
      <BrandSwitch record={record} field="brandIsHot" value={value} />
    ),
  },
  {
    title: '是否显示',
    dataIndex: 'isShow',
    width: 100,
    render: (value: number, record) => <BrandSwitch record={record} field="isShow" value={value} />,
  },
  {
    title: '排序',
    dataIndex: 'sortOrder',
    width: 90,
  },
];

const buildAuditColumns = (
  t: (key: string, params?: Record<string, string | number>) => string,
): ColumnConfig<BrandRow>[] => [
  {
    title: '品牌名称',
    dataIndex: 'brandName',
    width: 240,
    render: (value: string, record) => (
      <div className="brand-name-cell">
        <span className="brand-name">{value}</span>
        {record.shop?.shopTitle && (
          <Text type="tertiary" size="small">
            {t('店铺：')}{record.shop.shopTitle}
          </Text>
        )}
      </div>
    ),
  },
  {
    title: '品牌缩略图',
    dataIndex: 'brandLogo',
    width: 120,
    render: (value: string) =>
      value ? <Image src={value} width={60} height={30} style={{ objectFit: 'contain' }} /> : '-',
  },
  { title: '首字母', dataIndex: 'firstWord', width: 90, render: (value: string) => value || '-' },
  { title: '审核状态', dataIndex: 'statusText', width: 110, render: (value: string) => value || '-' },
  {
    title: '审核备注',
    dataIndex: 'rejectRemark',
    width: 220,
    render: (value: string) => value || '-',
  },
];

export default function Brands() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState('manage');
  const [auditCount, setAuditCount] = useState(0);
  const [auditVisible, setAuditVisible] = useState(false);
  const [auditBrand, setAuditBrand] = useState<BrandRow | null>(null);
  const [auditStatus, setAuditStatus] = useState(1);
  const [rejectRemark, setRejectRemark] = useState('');

  useEffect(() => {
    if (isDemo()) return;
    apiGet<any>('/product/brand/auditWaitNum')
      .then((result) => setAuditCount(Number(result?.count ?? result ?? 0)))
      .catch(() => undefined);
  }, [reloadKey]);

  const batchDelete = (ids: number[], clear: () => void) => {
    Modal.confirm({
      title: t('批量删除品牌'),
      content: t('确定删除选中的 {count} 个品牌？', { count: ids.length }),
      onOk: async () => {
        try {
          await apiPost('/product/brand/batch', { ids, type: 'del' });
          Toast.success({ content: t('批量删除成功') });
          clear();
          setReloadKey((key) => key + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
        }
      },
    });
  };

  const updateFirstWord = () => {
    Modal.confirm({
      title: t('更新品牌首字母'),
      content: t('将根据品牌名称重新计算所有品牌首字母，是否继续？'),
      onOk: async () => {
        try {
          await apiPost('/product/brand/updateFirstWord', {});
          Toast.success({ content: t('首字母已更新') });
          setReloadKey((key) => key + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('更新失败') });
        }
      },
    });
  };

  const openAudit = (record: BrandRow) => {
    setAuditBrand(record);
    setAuditStatus(1);
    setRejectRemark('');
    setAuditVisible(true);
  };

  const submitAudit = async () => {
    if (!auditBrand) return;
    if (auditStatus === 2 && !rejectRemark.trim()) {
      Toast.warning({ content: t('拒绝时请填写审核备注') });
      return;
    }
    try {
      await apiPost('/product/brand/audit', {
        brandId: auditBrand.brandId,
        status: auditStatus,
        rejectRemark: auditStatus === 2 ? rejectRemark.trim() : undefined,
      });
      Toast.success({ content: t('审核完成') });
      setAuditVisible(false);
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('审核失败') });
    }
  };

  const removeBrand = (record: BrandRow) => {
    Modal.confirm({
      title: t('删除品牌'),
      content: t('确定删除品牌「{name}」？', { name: record.brandName }),
      onOk: async () => {
        try {
          await apiPost('/product/brand/del', { id: record.brandId });
          Toast.success({ content: t('删除成功') });
          setReloadKey((key) => key + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  return (
    <>
      <div className="content-tabs">
        <Tabs
          type="button"
          activeKey={tab}
          onChange={setTab}
          tabList={[
            { tab: t('品牌管理'), itemKey: 'manage' },
            {
              tab: (
                <span className="brand-audit-tab-label">
                  {t('品牌审核')}
                  <span className={`brand-audit-count ${auditCount > 0 ? 'is-active' : ''}`}>
                    {auditCount > 99 ? '99+' : auditCount}
                  </span>
                </span>
              ),
              itemKey: 'audit',
            },
          ]}
        />
      </div>

      {tab === 'manage' && (
      <ListPage<BrandRow>
      key={reloadKey}
      api="/product/brand/list"
      rowKey="brandId"
      pageSize={10}
      query={{ status: 1 }}
      selectable
      actionWidth={150}
      filters={[
        {
          field: 'keyword',
          label: '商品品牌',
          type: 'input',
          placeholder: '输入品牌名称',
          width: 240,
        },
        {
          field: 'isShow',
          label: '是否显示',
          type: 'select',
          width: 130,
          options: [
            { label: '显示', value: 1 },
            { label: '不显示', value: 0 },
          ],
        },
        {
          field: 'brandIsHot',
          label: '是否热门',
          type: 'select',
          width: 130,
          options: [
            { label: '是', value: 1 },
            { label: '否', value: 0 },
          ],
        },
        {
          field: 'firstWord',
          label: '首字母',
          type: 'input',
          width: 110,
        },
      ]}
      columns={buildColumns(t)}
      batchActions={(rows, clear) => (
        <Space>
          <Button size="small" onClick={() => batchDelete(rows.map((row) => row.brandId), clear)}>
            {t('批量删除')}
          </Button>
          <Button size="small" onClick={updateFirstWord}>
            {t('批量更新品牌首字母')}
          </Button>
        </Space>
      )}
      drawer={{
        title: '品牌',
        addText: '添加品牌',
        width: 600,
        labelWidth: 'auto',
        inputWidth: 450,
        createApi: '/product/brand/create',
        updateApi: '/product/brand/update',
        detailApi: '/product/brand/detail',
        deleteApi: '/product/brand/del',
        idField: 'brandId',
        sections: [
          {
            key: 'basic',
            title: '品牌信息',
            fields: [
              {
                field: 'brandName',
                label: t('品牌名称'),
                required: true,
                placeholder: t('请输入品牌名称'),
              },
              {
                field: 'brandLogo',
                label: t('品牌LOGO'),
                type: 'custom',
                render: ({ formApi, values }) => (
                  <div>
                    <ImageUploader
                      value={values.brandLogo ? [values.brandLogo] : []}
                      onChange={(urls) => formApi?.setValue('brandLogo', urls[0] || '')}
                      max={1}
                    />
                    <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
                      {t('建议上传 2:1 图片，宽 200px，高 100px')}
                    </Text>
                  </div>
                ),
              },
              {
                field: 'brandDesc',
                label: t('品牌描述'),
                type: 'textarea',
              },
              {
                field: 'sortOrder',
                label: t('排序'),
                type: 'number',
                initValue: 50,
              },
              {
                field: 'firstWord',
                label: t('首字母'),
                placeholder: t('不填则自动生成'),
              },
              {
                field: 'isShow',
                label: t('是否显示'),
                type: 'switch',
                initValue: 1,
                checkedText: t('显示'),
                uncheckedText: t('隐藏'),
              },
              {
                field: 'brandIsHot',
                label: t('是否热门品牌'),
                type: 'switch',
                initValue: 0,
                checkedText: t('热门'),
                uncheckedText: t('不热门'),
              },
            ],
          },
        ],
        toPayload: (values) => ({
          ...values,
          brandId: values.brandId ? Number(values.brandId) : undefined,
          sortOrder: Number(values.sortOrder || 50),
          isShow: values.isShow ? 1 : 0,
          brandIsHot: values.brandIsHot ? 1 : 0,
        }),
      }}
    />
      )}

      {tab === 'audit' && (
        <ListPage<BrandRow>
          key={`audit-${reloadKey}`}
          api="/product/brand/auditList"
          rowKey="brandId"
          pageSize={10}
          actionWidth={150}
          filters={[
            {
              field: 'keyword',
              label: '商品品牌',
              type: 'input',
              placeholder: '输入品牌名称',
              width: 240,
            },
            { field: 'firstWord', label: '首字母', type: 'input', width: 110 },
            {
              field: 'status',
              label: '审核状态',
              type: 'select',
              width: 130,
              options: [
                { label: '待审核', value: 0 },
                { label: '审核通过', value: 1 },
                { label: '审核拒绝', value: 2 },
              ],
            },
          ]}
          columns={buildAuditColumns(t)}
          rowActions={(record) => (
            <Space spacing={2}>
              <Button theme="borderless" size="small" onClick={() => openAudit(record)}>
                {t('去处理')}
              </Button>
              <Button theme="borderless" type="danger" size="small" onClick={() => removeBrand(record)}>
                {t('删除')}
              </Button>
            </Space>
          )}
        />
      )}

      <Modal
        title={t('品牌审核')}
        visible={auditVisible}
        onCancel={() => setAuditVisible(false)}
        width={480}
        footer={
          <Space>
            <Button onClick={() => setAuditVisible(false)}>{t('取消')}</Button>
            <Button theme="solid" type="primary" onClick={submitAudit}>
              {t('提交审核')}
            </Button>
          </Space>
        }
      >
        <div className="brand-audit-form">
          <div>{t('品牌：')}{auditBrand?.brandName}</div>
          <Select
            value={auditStatus}
            onChange={(value) => setAuditStatus(Number(value))}
            optionList={[
              { label: t('审核通过'), value: 1 },
              { label: t('审核拒绝'), value: 2 },
            ]}
            style={{ width: 220, marginTop: 12 }}
          />
          {auditStatus === 2 && (
            <Input
              value={rejectRemark}
              onChange={setRejectRemark}
              placeholder={t('请输入拒绝原因')}
              style={{ marginTop: 12 }}
            />
          )}
        </div>
      </Modal>
    </>
  );
}
