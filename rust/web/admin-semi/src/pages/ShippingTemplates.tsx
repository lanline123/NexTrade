import { useState } from 'react';
import {
  Button,
  Form,
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
import { IconPlus } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text } = Typography;

interface ShippingTplRow {
  shippingTplId: number;
  shippingTplName: string;
  isFree?: number; // 0: 自定义运费, 1: 卖家承担运费
  pricingType?: number; // 1: 按件数, 2: 按重量
  shippingTime?: string;
  isDefault?: number;
  isSupportCod?: number;
}

export function ShippingTemplates() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<ShippingTplRow | null>(null);

  const [formState, setFormState] = useState({
    shippingTplName: '',
    isFree: 0,
    pricingType: 1,
    shippingTime: '48小时内',
    isDefault: 0,
  });

  const openForm = (row?: ShippingTplRow) => {
    if (row) {
      setEditingRow(row);
      setFormState({
        shippingTplName: row.shippingTplName || '',
        isFree: row.isFree ?? 0,
        pricingType: row.pricingType ?? 1,
        shippingTime: row.shippingTime || '48小时内',
        isDefault: row.isDefault ?? 0,
      });
    } else {
      setEditingRow(null);
      setFormState({
        shippingTplName: '',
        isFree: 0,
        pricingType: 1,
        shippingTime: '48小时内',
        isDefault: 0,
      });
    }
    setFormVisible(true);
  };

  const handleDelete = async (ids: number[]) => {
    try {
      if (ids.length === 1) {
        await apiPost('/setting/shippingTpl/del', { id: ids[0] });
      } else {
        await apiPost('/setting/shippingTpl/batch', { type: 'del', ids });
      }
      Toast.success({ content: t('删除成功') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const handleSetDefault = async (record: ShippingTplRow) => {
    try {
      await apiPost('/setting/shippingTpl/setDefault', { id: record.shippingTplId });
      Toast.success({ content: t('已设为默认模版') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('设为默认失败') });
    }
  };

  const handleFormSubmit = async () => {
    if (!formState.shippingTplName.trim()) {
      Toast.warning({ content: t('请输入模板名称') });
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        shippingTplId: editingRow ? editingRow.shippingTplId : undefined,
        shippingTplName: formState.shippingTplName.trim(),
        isFree: formState.isFree,
        pricingType: formState.pricingType,
        shippingTime: formState.shippingTime,
        isDefault: formState.isDefault,
      };
      if (editingRow) {
        await apiPost('/setting/shippingTpl/update', payload);
      } else {
        await apiPost('/setting/shippingTpl/create', payload);
      }
      Toast.success({ content: t('保存成功') });
      setFormVisible(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setFormLoading(false);
    }
  };

  const columns: ColumnConfig[] = [
    {
      title: '模板名称',
      dataIndex: 'shippingTplName',
      width: 240,
      render: (v: unknown, row: unknown) => {
        const record = row as ShippingTplRow;
        return (
          <Space align="center" spacing={8}>
            <Text strong>{String(v || '--')}</Text>
            {Number(record.isDefault) === 1 && (
              <Tag size="small" color="blue">
                {t('默认模版')}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '是否包邮',
      dataIndex: 'isFree',
      width: 140,
      render: (v: unknown) => (
        <Tag size="small" color={Number(v) === 1 ? 'green' : 'grey'}>
          {Number(v) === 1 ? t('卖家承担运费') : t('自定义运费')}
        </Tag>
      ),
    },
    {
      title: '计价方式',
      dataIndex: 'isSupportCod',
      width: 120,
      render: (_: unknown, row: unknown) => {
        const record = row as ShippingTplRow;
        return <span>{record.pricingType === 1 ? t('按件数') : t('按重量')}</span>;
      },
    },
    {
      title: '发货时间',
      dataIndex: 'shippingTime',
      width: 160,
      render: (v: unknown) => <span>{String(v || '--')}</span>,
    },
    {
      title: '是否默认',
      dataIndex: 'isDefault',
      width: 100,
      render: (v: unknown) => <span>{Number(v) === 1 ? t('是') : '--'}</span>,
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 220,
      render: (_: unknown, row: unknown) => {
        const record = row as ShippingTplRow;
        return (
          <Space spacing={4}>
            <Button
              theme="borderless"
              type="primary"
              size="small"
              onClick={() => openForm(record)}
            >
              {t('编辑')}
            </Button>
            {Number(record.isDefault) !== 1 && (
              <Popconfirm
                title={t('确认将该模版设为默认运费模板吗？')}
                onConfirm={() => handleSetDefault(record)}
              >
                <Button theme="borderless" type="primary" size="small">
                  {t('设为默认')}
                </Button>
              </Popconfirm>
            )}
            <Popconfirm
              title={t('您确认要删除所选数据吗？')}
              okType="danger"
              onConfirm={() => handleDelete([record.shippingTplId])}
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
      <ListPage
        key={reloadKey}
        api="/setting/shippingTpl/list"
        rowKey="shippingTplId"
        columns={columns}
        selectable
        batchActions={(rows: ShippingTplRow[], clear) => (
          <Popconfirm
            title={t('您确认要批量删除所选数据吗？')}
            okType="danger"
            onConfirm={async () => {
              await handleDelete(rows.map((r) => r.shippingTplId));
              clear();
            }}
          >
            <Button type="danger" size="small">
              {t('批量删除')} ({rows.length})
            </Button>
          </Popconfirm>
        )}
        toolbarExtra={
          <Button icon={<IconPlus />} type="primary" onClick={() => openForm()}>
            {t('添加运费模板')}
          </Button>
        }
        filters={[
          {
            field: 'keyword',
            label: '模板名称',
            type: 'input',
            placeholder: '输入模板名称',
          },
        ]}
      />

      <Modal
        title={editingRow ? t('编辑运费模板') : t('添加运费模板')}
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onOk={handleFormSubmit}
        confirmLoading={formLoading}
        width={560}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('模板名称')}</div>
            <Input
              placeholder={t('输入模板名称')}
              value={formState.shippingTplName}
              onChange={(val) => setFormState({ ...formState, shippingTplName: val })}
            />
          </div>

          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('是否包邮')}</div>
            <RadioGroup
              value={formState.isFree}
              onChange={(e) => setFormState({ ...formState, isFree: Number(e.target.value) })}
            >
              <Radio value={0}>{t('自定义运费')}</Radio>
              <Radio value={1}>{t('卖家承担运费')}</Radio>
            </RadioGroup>
          </div>

          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('计价方式')}</div>
            <RadioGroup
              value={formState.pricingType}
              onChange={(e) =>
                setFormState({ ...formState, pricingType: Number(e.target.value) })
              }
            >
              <Radio value={1}>{t('按件数')}</Radio>
              <Radio value={2}>{t('按重量')}</Radio>
            </RadioGroup>
          </div>

          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('发货时间')}</div>
            <Select
              style={{ width: '100%' }}
              value={formState.shippingTime}
              onChange={(val) => setFormState({ ...formState, shippingTime: String(val) })}
            >
              <Select.Option value="12小时内">{t('12小时内')}</Select.Option>
              <Select.Option value="24小时内">{t('24小时内')}</Select.Option>
              <Select.Option value="48小时内">{t('48小时内')}</Select.Option>
              <Select.Option value="3天内">{t('3天内')}</Select.Option>
              <Select.Option value="7天内">{t('7天内')}</Select.Option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
