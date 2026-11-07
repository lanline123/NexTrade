import { useEffect, useState } from 'react';
import {
  Button,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  RadioGroup,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Toast,
} from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';

/**
 * 打印设计器（对齐旧版 print/orderPrint/print + setting/config/receiptPrintSetting/Design.vue）：
 * - 云打印机管理：/print/print/*（新增/编辑/删除/设默认/语音开关）；
 * - 打印模板设计：/print/printConfig/print 读取 template 树（PrintTemplateItem → options 勾选），
 *   右侧按勾选项实时渲染小票预览，/print/printConfig/update 保存；
 * 契约：rust logistics/print.rs + print_config.rs。
 */

interface PrintRow {
  printId: number;
  printName?: string;
  printSn?: string;
  platform?: number;
  platformText?: string;
  status?: number;
  statusText?: string;
  paperSize?: number;
  paperSizeDesc?: string;
  voiceEnabled?: number;
  voiceContentType?: number;
  deviceCode?: string;
  isDefault?: number;
  updateTime?: string;
}

interface TemplateOption {
  chooseTitle?: string;
  choose?: boolean;
  value?: string;
}

interface TemplateItem {
  title?: string;
  options?: TemplateOption[];
}

interface PrintForm {
  printName: string;
  thirdAccount: string;
  thirdKey: string;
  printSn: string;
  printKey: string;
  autoPrint: number;
  platform: number;
  paperSize: number;
  status: number;
  voiceEnabled: number;
  voiceContentType: number;
  deviceCode: string;
  isDefault: number;
}

const initialForm = (): PrintForm => ({
  printName: '',
  thirdAccount: '',
  thirdKey: '',
  printSn: '',
  printKey: '',
  autoPrint: 0,
  platform: 1,
  paperSize: 58,
  status: 1,
  voiceEnabled: 0,
  voiceContentType: 0,
  deviceCode: '',
  isDefault: 0,
});

/* ------------------------------ 打印机编辑弹窗 ------------------------------ */

function PrintEditModal({
  visible,
  row,
  onClose,
  onSaved,
}: {
  visible: boolean;
  row: PrintRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<PrintForm>(initialForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm(
      row
        ? {
            printName: row.printName ?? '',
            thirdAccount: '',
            thirdKey: '',
            printSn: row.printSn ?? '',
            printKey: '',
            autoPrint: 0,
            platform: row.platform ?? 1,
            paperSize: row.paperSize ?? 58,
            status: row.status ?? 1,
            voiceEnabled: row.voiceEnabled ?? 0,
            voiceContentType: row.voiceContentType ?? 0,
            deviceCode: row.deviceCode ?? '',
            isDefault: row.isDefault ?? 0,
          }
        : initialForm(),
    );
  }, [visible, row]);

  const submit = async () => {
    if (!form.printName.trim()) {
      Toast.warning({ content: t('请输入打印机名称') });
      return;
    }
    if (!form.printSn.trim()) {
      Toast.warning({ content: t('请输入打印机编号') });
      return;
    }
    setSaving(true);
    try {
      if (row) {
        await apiPost('/print/print/update', { printId: row.printId, ...form });
      } else {
        await apiPost('/print/print/create', form);
      }
      Toast.success({ content: t('保存成功') });
      onSaved();
      onClose();
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const numField = (label: string, key: keyof PrintForm, options: Array<{ value: number; label: string }>) => (
    <div style={{ display: 'grid', gap: 4 }}>
      <span>{label}</span>
      <Select style={{ width: '100%' }} value={form[key] as number} optionList={options} onChange={(v) => setForm({ ...form, [key]: Number(v) })} />
    </div>
  );

  return (
    <Modal title={row ? t('编辑打印机') : t('添加打印机')} visible={visible} onOk={submit} onCancel={onClose} width={520} okText={t('提交')} okButtonProps={{ loading: saving }} cancelText={t('取消')}>
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>{t('打印机名称')}</span>
          <Input value={form.printName} onChange={(v) => setForm({ ...form, printName: v })} placeholder={t('如：前台小票机')} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>{t('打印机编号(printSn)')}</span>
          <Input value={form.printSn} onChange={(v) => setForm({ ...form, printSn: v })} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>{t('打印机密钥(printKey)')}</span>
          <Input value={form.printKey} onChange={(v) => setForm({ ...form, printKey: v })} />
        </label>
        {numField(t('打印平台'), 'platform', [
          { value: 1, label: '飞鹅云打印' },
          { value: 2, label: '易联云' },
        ])}
        {numField(t('纸张宽度'), 'paperSize', [
          { value: 58, label: '58mm' },
          { value: 80, label: '80mm' },
        ])}
        {numField(t('打印状态'), 'status', [
          { value: 1, label: t('启用') },
          { value: 0, label: t('停用') },
        ])}
        <div style={{ display: 'flex', gap: 24 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Switch checked={form.autoPrint === 1} onChange={(v) => setForm({ ...form, autoPrint: v ? 1 : 0 })} />
            <span>{t('自动打印')}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Switch checked={form.voiceEnabled === 1} onChange={(v) => setForm({ ...form, voiceEnabled: v ? 1 : 0 })} />
            <span>{t('语音播报')}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Switch checked={form.isDefault === 1} onChange={(v) => setForm({ ...form, isDefault: v ? 1 : 0 })} />
            <span>{t('默认打印机')}</span>
          </label>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ 模板设计器 ------------------------------ */

function TemplateDesigner() {
  const { t } = useI18n();
  const [configId, setConfigId] = useState<number | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [paperSize, setPaperSize] = useState(58);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet<any>('/print/printConfig/print', {})
      .then((res) => {
        setConfigId(res?.id ?? null);
        setItems(res?.template ?? []);
        setPaperSize(res?.paperSize ?? 58);
      })
      .catch((e) => Toast.error({ content: e.message }))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (itemIdx: number, optIdx: number, checked: boolean) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIdx
          ? { ...item, options: (item.options ?? []).map((o, j) => (j === optIdx ? { ...o, choose: checked } : o)) }
          : item,
      ),
    );
  };

  const renameOption = (itemIdx: number, optIdx: number, title: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIdx
          ? { ...item, options: (item.options ?? []).map((o, j) => (j === optIdx ? { ...o, chooseTitle: title } : o)) }
          : item,
      ),
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiPost('/print/printConfig/update', { id: configId ?? undefined, template: items, paperSize });
      Toast.success({ content: t('模板已保存') });
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const chosen = items.flatMap((item) => (item.options ?? []).filter((o) => o.choose));

  // 小票预览：按勾选项渲染样例
  const previewRow = (opt: TemplateOption) => {
    const label = opt.chooseTitle || opt.value || '';
    const sample: Record<string, string> = {
      订单号: 'SN20261107001',
      下单时间: '2026-11-07 10:00',
      支付方式: '微信支付',
      商品名称: '电池回收服务',
      商品数量: 'x1',
      商品单价: '¥100.00',
      商品总价: '¥100.00',
      优惠金额: '-¥10.00',
      实付金额: '¥90.00',
      收货人: '威廉',
      联系电话: '138****0000',
      收货地址: '青岛市市北区',
      买家留言: '尽快发货',
      店铺名称: '测试店铺',
      店铺电话: '0532-88888888',
      打印时间: '2026-11-07 10:05',
      二维码: '▓▓ QR ▓▓',
    };
    return (
      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
        <span>{label}</span>
        <span style={{ color: '#555' }}>{sample[label] ?? '--'}</span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Space style={{ marginBottom: 12 }}>
          <span>{t('纸张宽度')}</span>
          <RadioGroup value={paperSize} onChange={(e) => setPaperSize(Number(e.target.value))}>
            <Radio value={58}>58mm</Radio>
            <Radio value={80}>80mm</Radio>
          </RadioGroup>
          <Button theme="solid" type="primary" loading={saving} onClick={save}>{t('保存模板')}</Button>
        </Space>
        {loading ? (
          <Empty description={t('加载中')} />
        ) : (
          items.map((item, i) => (
            <div key={i} style={{ marginBottom: 12, border: '1px solid var(--semi-color-border)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', background: 'var(--semi-color-fill-0)', fontWeight: 600 }}>{item.title}</div>
              <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                {(item.options ?? []).map((o, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Switch checked={!!o.choose} onChange={(v) => toggle(i, j, v)} />
                    <Input style={{ width: 220 }} value={o.chooseTitle ?? o.value ?? ''} onChange={(v) => renameOption(i, j, v)} placeholder={o.value} />
                    <span style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}>{o.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      {/* 实时预览 */}
      <div style={{ flexShrink: 0, width: 260 }}>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 8 }}>{t('小票预览')}</div>
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 4, padding: 14, fontFamily: 'monospace', minHeight: 300 }}>
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, borderBottom: '1px dashed #ccc', paddingBottom: 8 }}>{t('订单小票')}</div>
          <div style={{ marginTop: 8 }}>{chosen.map(previewRow)}</div>
          <div style={{ borderTop: '1px dashed #ccc', marginTop: 8, paddingTop: 8, textAlign: 'center', fontSize: 10, color: '#999' }}>{t('谢谢惠顾')} · {paperSize}mm</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- 页面 ---------------------------------- */

export default function PrintDesigner() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'printer' | 'template'>('printer');
  const [rows, setRows] = useState<PrintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<{ open: boolean; row: PrintRow | null }>({ open: false, row: null });

  const load = () => {
    setLoading(true);
    apiGet<{ records?: PrintRow[] } | PrintRow[]>('/print/print/list', {})
      .then((res) => setRows(Array.isArray(res) ? res : res.records || []))
      .catch((e) => Toast.error({ content: e.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === 'printer') load();
  }, [tab]);

  const remove = async (row: PrintRow) => {
    try {
      await apiPost('/print/print/del', { id: row.printId });
      Toast.success({ content: t('删除成功') });
      load();
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('删除失败') });
    }
  };

  const setDefault = async (row: PrintRow) => {
    try {
      await apiPost('/print/print/updateField', { id: row.printId, field: 'isDefault', val: '1' });
      Toast.success({ content: t('已设为默认') });
      load();
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('操作失败') });
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button type={tab === 'printer' ? 'primary' : 'tertiary'} onClick={() => setTab('printer')}>{t('云打印机')}</Button>
        <Button type={tab === 'template' ? 'primary' : 'tertiary'} onClick={() => setTab('template')}>{t('打印模板设计')}</Button>
      </Space>

      {tab === 'printer' && (
        <>
          <Space style={{ marginBottom: 16 }}>
            <Button theme="solid" type="primary" icon={<IconPlus />} onClick={() => setEdit({ open: true, row: null })}>{t('添加打印机')}</Button>
          </Space>
          <Table
            loading={loading}
            dataSource={rows}
            rowKey="printId"
            empty={<Empty description={t('暂无打印机')} />}
            pagination={false}
            columns={[
              { title: 'ID', dataIndex: 'printId', width: 70 },
              { title: t('名称'), dataIndex: 'printName' },
              { title: t('编号'), dataIndex: 'printSn' },
              { title: t('平台'), dataIndex: 'platformText', width: 120, render: (v: string) => <Tag>{v || '-'}</Tag> },
              { title: t('纸张'), dataIndex: 'paperSizeDesc', width: 90, render: (v: string) => v || '-' },
              { title: t('状态'), dataIndex: 'statusText', width: 90, render: (v: string, r: PrintRow) => <Tag color={Number(r.status) === 1 ? 'green' : 'grey'}>{v || '-'}</Tag> },
              { title: t('默认'), dataIndex: 'isDefault', width: 80, render: (v: number) => (Number(v) === 1 ? <Tag color="blue">{t('默认')}</Tag> : '-') },
              { title: t('更新时间'), dataIndex: 'updateTime', width: 170 },
              {
                title: t('操作'),
                width: 220,
                render: (_: any, r: PrintRow) => (
                  <Space>
                    <Button theme="borderless" type="primary" onClick={() => setEdit({ open: true, row: r })}>{t('编辑')}</Button>
                    {Number(r.isDefault) !== 1 && <Button theme="borderless" onClick={() => setDefault(r)}>{t('设为默认')}</Button>}
                    <Popconfirm title={t('确认删除该打印机？')} onConfirm={() => remove(r)}>
                      <Button theme="borderless" type="danger">{t('删除')}</Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ] as ColumnProps<PrintRow>[]}
          />
        </>
      )}

      {tab === 'template' && <TemplateDesigner />}

      <PrintEditModal visible={edit.open} row={edit.row} onClose={() => setEdit({ open: false, row: null })} onSaved={load} />
    </div>
  );
}
