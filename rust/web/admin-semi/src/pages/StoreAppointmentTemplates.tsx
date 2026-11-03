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
import ListPage from '../framework/ListPage';
import { useI18n } from '../i18n';
import type { ColumnConfig } from '../framework/types';

const { Text } = Typography;

interface AppointmentTplRow {
  reservationTplId: number;
  templateName: string;
  reservationType: number; // 0=无需预约, 1=提前预约
  advanceNumber?: number;
  advanceUnit?: string; // 'h'=小时, 'd'=天
  maxDays: number;
  isDefault?: number;
}

export function StoreAppointmentTemplates() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<AppointmentTplRow | null>(null);

  const [formState, setFormState] = useState({
    templateName: '',
    reservationType: 1,
    advanceNumber: 2,
    advanceUnit: 'h',
    maxDays: 7,
  });

  const openForm = (row?: AppointmentTplRow) => {
    if (row) {
      setEditingRow(row);
      setFormState({
        templateName: row.templateName || '',
        reservationType: row.reservationType ?? 1,
        advanceNumber: row.advanceNumber ?? 2,
        advanceUnit: row.advanceUnit || 'h',
        maxDays: row.maxDays ?? 7,
      });
    } else {
      setEditingRow(null);
      setFormState({
        templateName: '',
        reservationType: 1,
        advanceNumber: 2,
        advanceUnit: 'h',
        maxDays: 7,
      });
    }
    setFormVisible(true);
  };

  const handleDelete = async (ids: number[]) => {
    try {
      if (ids.length === 1) {
        await apiPost('/o2o/reservationTpl/del', { id: ids[0] });
      } else {
        await apiPost('/o2o/reservationTpl/batch', { type: 'del', ids });
      }
      Toast.success({ content: t('删除成功') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const handleFormSubmit = async () => {
    if (!formState.templateName.trim()) {
      Toast.warning({ content: t('请输入模板名称') });
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        reservationTplId: editingRow ? editingRow.reservationTplId : undefined,
        templateName: formState.templateName.trim(),
        reservationType: formState.reservationType,
        advanceNumber: formState.reservationType === 1 ? formState.advanceNumber : undefined,
        advanceUnit: formState.reservationType === 1 ? formState.advanceUnit : undefined,
        maxDays: formState.maxDays,
      };

      if (editingRow) {
        await apiPost('/o2o/reservationTpl/update', payload);
      } else {
        await apiPost('/o2o/reservationTpl/create', payload);
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
      dataIndex: 'templateName',
      width: 220,
      render: (v: unknown, row: unknown) => {
        const record = row as AppointmentTplRow;
        return (
          <Space align="center" spacing={8}>
            <Text strong>{String(v || '--')}</Text>
            {Number(record.isDefault) === 1 && (
              <Tag size="small" color="blue">
                {t('默认')}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '预约时间',
      dataIndex: 'reservationTime',
      width: 200,
      render: (_: unknown, row: unknown) => {
        const record = row as AppointmentTplRow;
        if (record.reservationType === 0) {
          return <Text type="tertiary">{t('无需预约')}</Text>;
        }
        const unitText = record.advanceUnit === 'd' ? t('天') : t('小时');
        return (
          <span>
            {t('提前 {number} {unit}预约', {
              number: record.advanceNumber ?? 1,
              unit: unitText,
            })}
          </span>
        );
      },
    },
    {
      title: '最长预约',
      dataIndex: 'maxDays',
      width: 200,
      render: (v: unknown) => (
        <span>{t('最长允许预约 {days} 天内的订单', { days: String(v ?? 7) })}</span>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 150,
      render: (_: unknown, row: unknown) => {
        const record = row as AppointmentTplRow;
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
            <Popconfirm
              title={t('您确认要删除所选数据吗？')}
              okType="danger"
              onConfirm={() => handleDelete([record.reservationTplId])}
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
        api="/o2o/reservationTpl/pageList"
        rowKey="reservationTplId"
        columns={columns}
        selectable
        batchActions={(rows: AppointmentTplRow[], clear) => (
          <Popconfirm
            title={t('您确认要批量删除所选数据吗？')}
            okType="danger"
            onConfirm={async () => {
              await handleDelete(rows.map((r) => r.reservationTplId));
              clear();
            }}
          >
            <Button type="danger" size="small">
              {t('批量删除 ({count})', { count: rows.length })}
            </Button>
          </Popconfirm>
        )}
        toolbarExtra={
          <Button icon={<IconPlus />} type="primary" onClick={() => openForm()}>
            {t('添加预约模板')}
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
        title={editingRow ? t('编辑预约模板') : t('添加预约模板')}
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onOk={handleFormSubmit}
        confirmLoading={formLoading}
        width={500}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('模板名称')}</div>
            <Input
              placeholder={t('输入模板名称')}
              value={formState.templateName}
              onChange={(val) => setFormState({ ...formState, templateName: val })}
            />
          </div>

          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('预约时间')}</div>
            <RadioGroup
              value={formState.reservationType}
              onChange={(e) =>
                setFormState({ ...formState, reservationType: Number(e.target.value) })
              }
            >
              <Radio value={0}>{t('无需预约')}</Radio>
              <Radio value={1}>{t('提前预约')}</Radio>
            </RadioGroup>
          </div>

          {formState.reservationType === 1 && (
            <div>
              <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('提前预约时间')}</div>
              <Space align="center">
                <Text>{t('提前')}</Text>
                <InputNumber
                  style={{ width: 120 }}
                  min={1}
                  value={formState.advanceNumber}
                  onChange={(val) =>
                    setFormState({ ...formState, advanceNumber: Number(val) || 1 })
                  }
                />
                <Select
                  style={{ width: 100 }}
                  value={formState.advanceUnit}
                  onChange={(val) => setFormState({ ...formState, advanceUnit: String(val) })}
                >
                  <Select.Option value="h">{t('小时')}</Select.Option>
                  <Select.Option value="d">{t('天')}</Select.Option>
                </Select>
                <Text>{t('预约')}</Text>
              </Space>
            </div>
          )}

          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('最长预约')}</div>
            <Space align="center">
              <Text>{t('最长允许预约')}</Text>
              <InputNumber
                style={{ width: 120 }}
                min={1}
                max={365}
                value={formState.maxDays}
                onChange={(val) =>
                  setFormState({ ...formState, maxDays: Number(val) || 7 })
                }
              />
              <Text>{t('天内的订单')}</Text>
            </Space>
          </div>
        </div>
      </Modal>
    </div>
  );
}
