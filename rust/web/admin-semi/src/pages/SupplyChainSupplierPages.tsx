import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Cascader,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  SideSheet,
  Space,
  Switch,
  Table,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconDelete, IconPlus } from '@douyinfe/semi-icons';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

/* ==================================================================
   供应链供应商模块（对齐原版 api/supplyChain/supplier*.ts live 契约）
================================================================== */
function errMsg(error: unknown, t?: (key: string) => string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return t ? t('操作失败') : '操作失败';
}

function currentShopId(): string {
  return localStorage.getItem('shopId') || '';
}

interface SupplierOptionItem {
  vendorId: number;
  vendorName: string;
}

async function fetchSupplierOptions(shopId: string | number): Promise<SupplierOptionItem[]> {
  const res = await apiGet<any>('/supplyChain/supplier/list', { shopId, status: 1, page: 1, size: 100 });
  return (res.records || [])
    .filter((item: any) => item.vendorId !== undefined && item.vendorId !== null)
    .map((item: any) => ({
      vendorId: Number(item.vendorId),
      vendorName: item.vendorName || `供应商${item.vendorId}`,
    }));
}

const PHONE_TYPE_OPTIONS = [
  { label: '手机', value: 'mobile' },
  { label: '座机', value: 'landline' },
  { label: '企业座机', value: 'enterprise_landline' },
];

const FALLBACK_CATEGORIES = [
  { id: 1, name: '核心制造厂商' },
  { id: 2, name: '品牌一级代理' },
  { id: 3, name: '综合批发渠道' },
];

const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;

function parseMoneyValid(value: string | number): boolean {
  return MONEY_PATTERN.test(String(value ?? '').trim());
}

/* ==================================================================
   1. 供应商管理 (SupplierList / supplierManage)
   编辑表单对齐原版 supplier/Info.vue + supplier.ts serializeForm 契约：
   vendorName/vendorCode/categoryId/status/address(regionIds)/detailedAddress/
   contactName/contactPhones(唯一主号)/qualificationImages/remark/account
================================================================== */
interface SupplierItem {
  id?: number;
  vendorId?: number;
  vendorName?: string;
  name?: string;
  vendorCode?: string;
  code?: string;
  categoryId?: number | string;
  categoryName?: string;
  contactName?: string;
  phone?: string;
  status?: number; // 1 启用, 2 禁用
  createTime?: string;
}

interface PhoneRow {
  key: string;
  type: 'mobile' | 'landline' | 'enterprise_landline';
  number: string;
  areaCode: string;
}

let phoneKeySeq = 0;
const newPhoneRow = (): PhoneRow => ({ key: `p${phoneKeySeq++}`, type: 'mobile', number: '', areaCode: '' });

interface RegionNode {
  value: number;
  label: string;
  children?: RegionNode[];
}

function normalizeRegionNodes(input: any): RegionNode[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item: any) => {
      const value = Number(item.regionId ?? item.id ?? item.value ?? 0);
      const label = String(item.regionName ?? item.name ?? item.label ?? value);
      const children = item.children ?? item.childList ?? item.childrenList;
      return {
        value,
        label,
        children: Array.isArray(children) ? normalizeRegionNodes(children) : undefined,
      };
    })
    .filter((node) => node.value > 0);
}

function findRegionPath(nodes: RegionNode[], target: number, trail: number[] = []): number[] | null {
  for (const node of nodes) {
    const next = [...trail, node.value];
    if (node.value === target) return next;
    if (node.children?.length) {
      const found = findRegionPath(node.children, target, next);
      if (found) return found;
    }
  }
  return null;
}

interface SupplierFormState {
  code: string;
  name: string;
  categoryId: string;
  status: number;
  contactName: string;
  phones: PhoneRow[];
  primaryPhoneKey: string;
  qualificationImages: string[];
  bankPaymentMethod: string;
  bankAccountName: string;
  bankBankName: string;
  bankAccountNo: string;
  bankBranch: string;
  bankRegionIds: number[];
  regionIds: number[];
  address: string;
  remark: string;
}

function emptySupplierForm(): SupplierFormState {
  return {
    code: '',
    name: '',
    categoryId: '',
    status: 1,
    contactName: '',
    phones: [newPhoneRow()],
    primaryPhoneKey: '',
    qualificationImages: [],
    bankPaymentMethod: '',
    bankAccountName: '',
    bankBankName: '',
    bankAccountNo: '',
    bankBranch: '',
    bankRegionIds: [],
    regionIds: [],
    address: '',
    remark: '',
  };
}

function Field({ label, required, tip, children }: { label: string; required?: boolean; tip?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 6, fontWeight: 500 }}>
        {required ? <span style={{ color: 'var(--semi-color-danger)', marginRight: 2 }}>*</span> : null}
        {label}
      </div>
      {children}
      {tip ? <div style={{ marginTop: 4, fontSize: 12, color: 'var(--semi-color-text-2)' }}>{tip}</div> : null}
    </div>
  );
}

function SectionTitle({ text }: { text: string }) {
  return (
    <div
      style={{
        fontWeight: 600,
        fontSize: 14,
        margin: '4px 0 14px',
        paddingBottom: 8,
        borderBottom: '1px solid var(--semi-color-border)',
      }}
    >
      {text}
    </div>
  );
}

function SupplierFormDrawer({
  visible,
  editing,
  categories,
  onClose,
  onSaved,
}: {
  visible: boolean;
  editing: SupplierItem | null;
  categories: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SupplierFormState>(emptySupplierForm());
  const [regionTree, setRegionTree] = useState<RegionNode[]>([]);

  useEffect(() => {
    if (!visible) return;
    if (!editing) {
      const fresh = emptySupplierForm();
      fresh.primaryPhoneKey = fresh.phones[0]?.key || '';
      setForm(fresh);
      return;
    }
    let alive = true;
    apiGet<any>('/supplyChain/supplier/detail', { id: Number(editing.vendorId ?? editing.id ?? 0) })
      .then((detail) => {
        if (!alive) return;
        const phones: PhoneRow[] = (detail.contactPhones || []).map((phone: any) => ({
          key: `p${phoneKeySeq++}`,
          type: phone.type === 'enterprise_landline' ? 'enterprise_landline' : phone.type === 'mobile' ? 'mobile' : 'landline',
          number: phone.number || '',
          areaCode: phone.areaCode || '',
        }));
        const primary = (detail.contactPhones || []).findIndex((phone: any) => phone.primary);
        const nextState: SupplierFormState = {
          code: detail.vendorCode || editing.vendorCode || editing.code || '',
          name: detail.vendorName || editing.vendorName || editing.name || '',
          categoryId: String(detail.categoryId ?? editing.categoryId ?? ''),
          status: Number(detail.status) === 2 ? 2 : 1,
          contactName: detail.contactName || editing.contactName || '',
          phones: phones.length ? phones : [newPhoneRow()],
          primaryPhoneKey: '',
          qualificationImages: (detail.qualificationImages || [])
            .map((image: any) => (typeof image === 'string' ? image : image.picUrl || ''))
            .filter(Boolean),
          bankPaymentMethod: detail.account?.paymentMethod || '',
          bankAccountName: detail.account?.accountName || '',
          bankBankName: detail.account?.bankName || '',
          bankAccountNo: detail.account?.accountNo || '',
          bankBranch: detail.account?.bankBranch || '',
          bankRegionIds: (detail.account?.bankRegionIds || []).map(Number),
          regionIds: (detail.address || []).map(Number),
          address: detail.detailedAddress || '',
          remark: detail.remark || '',
        };
        nextState.primaryPhoneKey =
          primary >= 0 && phones[primary] ? phones[primary].key : nextState.phones[0]?.key || '';
        setForm(nextState);
      })
      .catch(() => {
        if (!alive) return;
        const fallback = emptySupplierForm();
        fallback.code = editing.vendorCode || editing.code || '';
        fallback.name = editing.vendorName || editing.name || '';
        fallback.categoryId = '';
        fallback.status = Number(editing.status) === 2 ? 2 : 1;
        fallback.contactName = editing.contactName || '';
        fallback.primaryPhoneKey = fallback.phones[0]?.key || '';
        setForm(fallback);
        Toast.warning(t('供应商详情加载失败，请手动补全后保存'));
      });
    return () => {
      alive = false;
    };
  }, [visible, editing]);

  useEffect(() => {
    if (!visible || regionTree.length) return;
    apiGet<any>('/setting/region/getAllRegionTree')
      .then((res) => setRegionTree(normalizeRegionNodes(Array.isArray(res) ? res : res?.records || res?.tree || [])))
      .catch(() => setRegionTree([]));
  }, [visible, regionTree.length]);

  const patchForm = (patch: Partial<SupplierFormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const submit = async () => {
    if (!form.name.trim()) return Toast.warning(t('供应商名称不能为空'));
    if (!form.categoryId) return Toast.warning(t('请选择供应商分类'));
    const activePhones = form.phones.filter((phone) => phone.number.trim());
    if (!activePhones.length) return Toast.warning(t('请至少填写一个联系电话'));
    let primaryIndex = activePhones.findIndex((phone) => phone.key === form.primaryPhoneKey);
    if (primaryIndex < 0) primaryIndex = 0;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        shopId: Number(currentShopId() || 0),
        vendorName: form.name.trim(),
        ...(form.code.trim() ? { vendorCode: form.code.trim() } : {}),
        categoryId: Number(form.categoryId),
        status: form.status,
        address: form.regionIds.map(Number),
        detailedAddress: form.address.trim(),
        contactName: form.contactName.trim(),
        contactPhones: activePhones.map((phone, index) => ({
          type: phone.type,
          number: phone.number.trim(),
          ...(phone.type !== 'mobile' && phone.areaCode.trim() ? { areaCode: phone.areaCode.trim() } : {}),
          primary: index === primaryIndex,
        })),
        qualificationImages: form.qualificationImages
          .filter(Boolean)
          .map((url) => ({
            picUrl: url.trim(),
            picName: url.trim().split('/').pop() || 'qualification',
          })),
        remark: form.remark.trim(),
        account: {
          ...(form.bankPaymentMethod.trim() ? { paymentMethod: form.bankPaymentMethod.trim() } : {}),
          accountName: form.bankAccountName.trim(),
          bankName: form.bankBankName.trim(),
          accountNo: form.bankAccountNo.trim(),
          ...(form.bankRegionIds.length ? { bankRegionIds: form.bankRegionIds.map(Number) } : {}),
          ...(form.bankBranch.trim() ? { bankBranch: form.bankBranch.trim() } : {}),
        },
      };
      if (editing) payload.id = Number(editing.vendorId ?? editing.id ?? 0);
      await apiPost(editing ? '/supplyChain/supplier/update' : '/supplyChain/supplier/create', payload);
      Toast.success(editing ? t('更新成功') : t('创建成功'));
      onSaved();
    } catch (error) {
      Toast.error({ content: errMsg(error, t) });
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = categories.length ? categories : FALLBACK_CATEGORIES;

  return (
    <SideSheet
      title={editing ? t('编辑供应商') : t('添加供应商')}
      visible={visible}
      onCancel={onClose}
      width={760}
      placement="right"
      bodyStyle={{ overflowY: 'auto' }}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={saving} onClick={submit}>
            {t('保存')}
          </Button>
        </div>
      }
    >
      <SectionTitle text={t('基本设置')} />
      <Field label={t('供应商名称')} required>
        <Input placeholder={t('请输入供应商名称')} style={{ width: 360 }} value={form.name} onChange={(val) => patchForm({ name: val })} />
      </Field>
      <Field label={t('供应商编码')}>
        <Input placeholder={t('请输入供应商编码')} style={{ width: 360 }} maxLength={50} value={form.code} onChange={(val) => patchForm({ code: val })} />
      </Field>
      <Field label={t('供应商分类')} required>
        <Select
          placeholder={t('请选择')}
          style={{ width: 360 }}
          showClear
          value={form.categoryId || undefined}
          optionList={categoryOptions.map((item) => ({ label: item.name, value: String(item.id) }))}
          onChange={(val) => patchForm({ categoryId: val === undefined || val === null ? '' : String(val) })}
        />
      </Field>
      <Field label={t('启用状态')} tip={t('停用后该供应商不可再被业务单据选择')}>
        <Switch
          checked={form.status === 1}
          onChange={(checked) => patchForm({ status: checked ? 1 : 2 })}
        />
      </Field>
      <Field label={t('供应商地址')} tip={t('选择省/市/区后填写详细地址')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Cascader
            style={{ width: 360 }}
            placeholder={t('请选择省/市/区')}
            showClear
            treeData={regionTree as any}
            value={form.regionIds.length ? form.regionIds[form.regionIds.length - 1] : undefined}
            onChange={(value: any) => {
              const leaf = Array.isArray(value) ? Number(value[value.length - 1]) : Number(value);
              patchForm({ regionIds: leaf ? findRegionPath(regionTree, leaf) || [] : [] });
            }}
          />
          <TextArea
            placeholder={t('请输入详细地址')}
            rows={3}
            style={{ width: 500 }}
            value={form.address}
            onChange={(val) => patchForm({ address: val })}
          />
        </div>
      </Field>

      <div style={{ height: 16 }} />
      <SectionTitle text={t('银行账户信息')} />
      <Field label={t('付款方式')}>
        <Select
          placeholder={t('请选择')}
          style={{ width: 360 }}
          showClear
          value={form.bankPaymentMethod || undefined}
          optionList={[{ label: t('银行转账'), value: 'bank_transfer' }]}
          onChange={(val) => patchForm({ bankPaymentMethod: val === undefined || val === null ? '' : String(val) })}
        />
      </Field>
      <Field label={t('账户名称')} tip={t('请填写对公账户信息，向私人银行账户付款可能会付款失败')}>
        <Input placeholder={t('请输入账户名称')} style={{ width: 360 }} value={form.bankAccountName} onChange={(val) => patchForm({ bankAccountName: val })} />
      </Field>
      <Field label={t('银行账号')}>
        <Input placeholder={t('请输入银行账号')} style={{ width: 360 }} value={form.bankAccountNo} onChange={(val) => patchForm({ bankAccountNo: val })} />
      </Field>
      <Field label={t('开户银行')}>
        <Input placeholder={t('请输入开户银行')} style={{ width: 360 }} value={form.bankBankName} onChange={(val) => patchForm({ bankBankName: val })} />
      </Field>
      <Field label={t('开户地区')}>
        <Cascader
          style={{ width: 360 }}
          placeholder={t('请选择开户地区')}
          showClear
          treeData={regionTree as any}
          value={form.bankRegionIds.length ? form.bankRegionIds[form.bankRegionIds.length - 1] : undefined}
          onChange={(value: any) => {
            const leaf = Array.isArray(value) ? Number(value[value.length - 1]) : Number(value);
            patchForm({ bankRegionIds: leaf ? findRegionPath(regionTree, leaf) || [] : [] });
          }}
        />
      </Field>
      <Field label={t('支行名称')}>
        <Input placeholder={t('请输入支行名称')} style={{ width: 500 }} value={form.bankBranch} onChange={(val) => patchForm({ bankBranch: val })} />
      </Field>

      <div style={{ height: 16 }} />
      <SectionTitle text={t('联系人信息')} />
      <Field label={t('联系人姓名')} required>
        <Input placeholder={t('请输入联系人姓名')} style={{ width: 360 }} value={form.contactName} onChange={(val) => patchForm({ contactName: val })} />
      </Field>
      <Field label={t('联系电话')} required tip={t('至少填写一个号码，且必须指定唯一主号')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form.phones.map((phone, index) => (
            <div key={phone.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Select
                style={{ width: 120 }}
                value={phone.type}
                optionList={PHONE_TYPE_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
                onChange={(val) =>
                  patchForm({
                    phones: form.phones.map((row) =>
                      row.key === phone.key ? { ...row, type: (val as PhoneRow['type']) || 'mobile' } : row,
                    ),
                  })
                }
              />
              {phone.type !== 'mobile' ? (
                <Input
                  placeholder={t('区号')}
                  style={{ width: 80 }}
                  value={phone.areaCode}
                  onChange={(val) =>
                    patchForm({
                      phones: form.phones.map((row) => (row.key === phone.key ? { ...row, areaCode: val } : row)),
                    })
                  }
                />
              ) : null}
              <Input
                placeholder={t('请输入手机号或座机号')}
                style={{ width: 220 }}
                value={phone.number}
                onChange={(val) =>
                  patchForm({
                    phones: form.phones.map((row) => (row.key === phone.key ? { ...row, number: val } : row)),
                  })
                }
              />
              <Radio
                checked={form.primaryPhoneKey ? form.primaryPhoneKey === phone.key : index === 0}
                onChange={() => patchForm({ primaryPhoneKey: phone.key })}
              >
                {t('主号')}
              </Radio>
              <Button
                theme="borderless"
                type="danger"
                icon={<IconDelete />}
                disabled={form.phones.length <= 1}
                onClick={() => {
                  const rest = form.phones.filter((row) => row.key !== phone.key);
                  patchForm({
                    phones: rest,
                    primaryPhoneKey:
                      form.primaryPhoneKey === phone.key ? rest[0]?.key || '' : form.primaryPhoneKey,
                  });
                }}
              />
            </div>
          ))}
          <div>
            <Button
              theme="borderless"
              type="primary"
              icon={<IconPlus />}
              onClick={() => {
                const row = newPhoneRow();
                patchForm({
                  phones: [...form.phones, row],
                  primaryPhoneKey: form.primaryPhoneKey || row.key,
                });
              }}
            >
              {t('添加联系电话')}
            </Button>
          </div>
        </div>
      </Field>

      <div style={{ height: 16 }} />
      <SectionTitle text={t('附件信息')} />
      <Field label={t('资质图片')} tip={t('请填写营业执照等资质文件的图片 URL')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form.qualificationImages.map((url, index) => (
            <div key={`${url}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {url ? (
                <img
                  src={url}
                  alt=""
                  style={{ width: 48, height: 48, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : null}
              <Input
                placeholder="https://..."
                style={{ width: 420 }}
                value={url}
                onChange={(val) =>
                  patchForm({
                    qualificationImages: form.qualificationImages.map((item, i) => (i === index ? val : item)),
                  })
                }
              />
              <Button
                theme="borderless"
                type="danger"
                icon={<IconDelete />}
                onClick={() =>
                  patchForm({ qualificationImages: form.qualificationImages.filter((_, i) => i !== index) })
                }
              />
            </div>
          ))}
          <div>
            <Button
              theme="borderless"
              type="primary"
              icon={<IconPlus />}
              onClick={() => patchForm({ qualificationImages: [...form.qualificationImages, ''] })}
            >
              {t('添加资质图片')}
            </Button>
          </div>
        </div>
      </Field>
      <Field label={t('备注信息')}>
        <TextArea
          placeholder={t('请输入备注信息')}
          rows={3}
          style={{ width: 500 }}
          value={form.remark}
          onChange={(val) => patchForm({ remark: val })}
        />
      </Field>
    </SideSheet>
  );
}

export function SupplierList() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierItem | null>(null);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    apiGet<any>('/supplyChain/supplierCategory/list', { page: 1, size: 100 })
      .then((res) =>
        setCategories(
          (res.records || []).map((item: any) => ({ id: Number(item.id), name: item.categoryName || item.name || '' })),
        ),
      )
      .catch(() => setCategories([]));
  }, []);

  const columns: ColumnConfig<SupplierItem>[] = [
    {
      title: t('供应商名称'),
      dataIndex: 'vendorName',
      width: 180,
      render: (val: any, row: SupplierItem) => (
        <span style={{ fontWeight: 500 }}>{val || row.name || '--'}</span>
      ),
    },
    {
      title: t('供应商编号'),
      dataIndex: 'vendorCode',
      width: 150,
      render: (val: any, row: SupplierItem) => val || row.code || '--',
    },
    {
      title: t('供应商分类'),
      dataIndex: 'categoryName',
      width: 130,
      render: (val: any) => val || '--',
    },
    {
      title: t('联系人'),
      dataIndex: 'contactName',
      width: 120,
      render: (val: any) => val || '--',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
      render: (val: any, row: SupplierItem) => (
        <Switch
          checked={Number(val ?? row.status) === 1}
          onChange={async (checked) => {
            try {
              // 原版 changeSupplierStatus 契约：status 1=启用 2=禁用
              await apiPost('/supplyChain/supplier/status', {
                id: Number(row.vendorId ?? row.id ?? 0),
                shopId: Number(currentShopId() || 0),
                status: checked ? 1 : 2,
              });
              Toast.success(t('状态更新成功'));
              setReloadKey((k) => k + 1);
            } catch (error) {
              Toast.error({ content: errMsg(error, t) });
            }
          }}
        />
      ),
    },
    {
      title: t('创建时间'),
      dataIndex: 'createTime',
      width: 170,
      render: (val: any) => val || '--',
    },
    {
      title: t('操作'),
      width: 120,
      render: (_: any, record: SupplierItem) => (
        <Button
          theme="borderless"
          type="primary"
          size="small"
          onClick={() => {
            setEditing(record);
            setFormOpen(true);
          }}
        >
          {t('编辑')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <ListPage<SupplierItem>
        key={reloadKey}
        api="/supplyChain/supplier/list"
        rowKey={(row) => String(row.vendorId ?? row.id ?? '')}
        columns={columns}
        toolbarExtra={
          <Button
            icon={<IconPlus />}
            type="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            {t('添加供应商')}
          </Button>
        }
        filters={[
          {
            field: 'vendorName',
            label: t('供应商名称'),
            placeholder: t('输入供应商名称'),
            type: 'input',
          },
          {
            field: 'vendorCode',
            label: t('供应商编号'),
            placeholder: t('输入供应商编号'),
            type: 'input',
          },
        ]}
      />

      <SupplierFormDrawer
        visible={formOpen}
        editing={formOpen ? editing : null}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          setReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}

/* ==================================================================
   2. 供应商分类 (SupplierCategories / supplierCategoryManage)
   保存契约对齐原版 supplierCategory.ts：{id?, shopId, categoryName, status, remark}
================================================================== */
interface SupplierCategoryItem {
  id: number;
  categoryName?: string;
  name?: string;
  status?: number; // 1 启用, 2 禁用
}

export function SupplierCategories() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formState, setFormState] = useState({ categoryName: '', remark: '', status: 1 });

  const openForm = (record?: SupplierCategoryItem) => {
    if (record) {
      setEditingId(record.id);
      setFormState({
        categoryName: record.categoryName || record.name || '',
        remark: '',
        status: Number(record.status) === 2 ? 2 : 1,
      });
    } else {
      setEditingId(null);
      setFormState({ categoryName: '', remark: '', status: 1 });
    }
    setFormVisible(true);
  };

  const handleFormSubmit = async () => {
    if (!formState.categoryName.trim()) {
      Toast.error(t('分类名称不能为空'));
      return;
    }
    setFormLoading(true);
    try {
      await apiPost('/supplyChain/supplierCategory/save', {
        ...(editingId ? { id: editingId } : {}),
        shopId: Number(currentShopId() || 0),
        categoryName: formState.categoryName.trim(),
        status: formState.status,
        remark: formState.remark.trim(),
      });
      Toast.success(t('保存成功'));
      setFormVisible(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: errMsg(error, t) });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiPost('/supplyChain/supplierCategory/delete', { id, shopId: Number(currentShopId() || 0) });
      Toast.success(t('删除成功'));
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: errMsg(error, t) });
    }
  };

  const columns: ColumnConfig<SupplierCategoryItem>[] = [
    {
      title: t('分类名称'),
      dataIndex: 'categoryName',
      render: (val: any, row: SupplierCategoryItem) => (
        <span style={{ fontWeight: 500 }}>{val || row.name || '--'}</span>
      ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 100,
      render: (val: any, row: SupplierCategoryItem) => (
        <Switch
          checked={Number(val ?? row.status) === 1}
          onChange={async (checked) => {
            try {
              await apiPost('/supplyChain/supplierCategory/status', {
                id: row.id,
                shopId: Number(currentShopId() || 0),
                status: checked ? 1 : 2,
              });
              Toast.success(t('状态更新成功'));
              setReloadKey((k) => k + 1);
            } catch (error) {
              Toast.error({ content: errMsg(error, t) });
            }
          }}
        />
      ),
    },
    {
      title: t('操作'),
      width: 140,
      render: (_: any, record: SupplierCategoryItem) => (
        <Space>
          <Button theme="borderless" type="primary" size="small" onClick={() => openForm(record)}>
            {t('编辑')}
          </Button>
          <Popconfirm
            title={t('您确认要删除此分类吗？')}
            okType="danger"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button theme="borderless" type="danger" size="small">
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <ListPage<SupplierCategoryItem>
        key={reloadKey}
        api="/supplyChain/supplierCategory/list"
        rowKey="id"
        columns={columns}
        toolbarExtra={
          <Button icon={<IconPlus />} type="primary" onClick={() => openForm()}>
            {t('添加分类')}
          </Button>
        }
        filters={[
          {
            field: 'keyword',
            label: t('分类名称'),
            placeholder: t('输入分类名称'),
            type: 'input',
          },
        ]}
      />

      <Modal
        title={editingId ? t('编辑分类') : t('添加分类')}
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onOk={handleFormSubmit}
        confirmLoading={formLoading}
        width={520}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('分类名称')}</div>
            <Input
              placeholder={t('请输入供应商分类名称')}
              value={formState.categoryName}
              onChange={(val) => setFormState({ ...formState, categoryName: val })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('启用状态')}</div>
            <Switch
              checked={formState.status === 1}
              onChange={(checked) => setFormState({ ...formState, status: checked ? 1 : 2 })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('备注')}</div>
            <TextArea
              placeholder={t('请输入备注')}
              rows={2}
              value={formState.remark}
              onChange={(val) => setFormState({ ...formState, remark: val })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ==================================================================
   3. 供应商商品 (SupplierProducts / selfVendorProductManage)
   顶部汇总卡 GET supplyChain/supplierProduct/summary；
   「批量挂接平台商品」抽屉对齐原版 supplierProduct/Manage.vue：
   GET product/product/list 选商品 -> 逐 SKU 设供货价/最小起订量 ->
   POST supplyChain/supplierProduct/batchSave
================================================================== */
interface SupplierProductItem {
  id?: number;
  productId?: number;
  productName?: string;
  vendorName?: string;
  supplierName?: string;
  productSn?: string;
  purchasePrice?: number | string;
  supplyStock?: number;
  updateTime?: string;
}

interface ProductLinkLine {
  key: string;
  productId: string;
  skuId: string;
  productName: string;
  skuName: string;
  picThumb: string;
  supplyPrice: string;
  minPurchaseQty: string;
}

function ProductPickerModal({
  visible,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  onConfirm: (lines: ProductLinkLine[]) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);
  const pageSize = 10;

  useEffect(() => {
    if (!visible) return;
    setKeyword('');
    setAppliedKeyword('');
    setPage(1);
    setSelectedKeys([]);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    apiGet<any>('/product/product/list', {
      keyword: appliedKeyword || undefined,
      productType: 1,
      showVendorProduct: 0,
      page,
      size: pageSize,
    })
      .then((res) => {
        if (!alive) return;
        setRecords(
          (res.records || []).map((row: any, index: number) => ({
            ...row,
            key: String(row.productId ?? row.id ?? index),
          })),
        );
        setTotal(Number(res.total || 0));
      })
      .catch((error) => alive && Toast.error({ content: errMsg(error, t) }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [visible, appliedKeyword, page]);

  const rowSelection: any = {
    selectedRowKeys: selectedKeys,
    onChange: (keys: Array<string | number>) => setSelectedKeys(keys || []),
  };

  const confirm = () => {
    const picked = records.filter((row) => selectedKeys.map(String).includes(String(row.key)));
    const lines: ProductLinkLine[] = [];
    picked.forEach((row) => {
      const productId = String(row.productId ?? row.id ?? '');
      const skus = Array.isArray(row.productSku) && row.productSku.length ? row.productSku : [{ skuId: 0, skuName: '' }];
      skus.forEach((sku: any) => {
        const skuId = String(sku.skuId ?? sku.productSkuId ?? sku.id ?? 0);
        lines.push({
          key: `${productId}:${skuId}`,
          productId,
          skuId,
          productName: row.productName || '',
          skuName: sku.skuName || sku.skuValue || sku.skuSpecText || '',
          picThumb: row.picThumb || row.picUrl || '',
          supplyPrice: String(sku.productPrice ?? row.productPrice ?? 0),
          minPurchaseQty: '1',
        });
      });
    });
    onConfirm(lines);
  };

  return (
    <Modal
      title={t('选择平台商品')}
      visible={visible}
      onCancel={onCancel}
      width={820}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button theme="solid" type="primary" disabled={selectedKeys.length === 0} onClick={confirm}>
            {t('确认')}
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Input
          placeholder={t('请输入商品名称')}
          value={keyword}
          showClear
          style={{ width: 240 }}
          onChange={(val) => setKeyword(val)}
          onEnterPress={() => {
            setPage(1);
            setAppliedKeyword(keyword.trim());
          }}
        />
        <Button
          type="primary"
          onClick={() => {
            setPage(1);
            setAppliedKeyword(keyword.trim());
          }}
        >
          {t('搜索')}
        </Button>
      </div>
      <Table
        loading={loading}
        dataSource={records}
        rowKey="key"
        rowSelection={rowSelection}
        pagination={{ currentPage: page, pageSize, total, onChange: (next: number) => setPage(next) }}
        columns={
          [
            {
              title: t('商品信息'),
              dataIndex: 'productName',
              render: (_: any, row: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {row.picThumb || row.picUrl ? (
                    <img
                      src={row.picThumb || row.picUrl}
                      alt=""
                      style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }}
                    />
                  ) : null}
                  <div>{row.productName || '-'}</div>
                </div>
              ),
            },
            {
              title: t('平台售价(元)'),
              dataIndex: 'productPrice',
              width: 120,
              render: (val: any) => (Number.isFinite(Number(val)) ? Number(val).toFixed(2) : '--'),
            },
            {
              title: t('规格数'),
              width: 90,
              render: (_: any, row: any) =>
                Array.isArray(row.productSku) && row.productSku.length ? row.productSku.length : 1,
            },
          ] as any
        }
      />
    </Modal>
  );
}

function SupplierProductBatchDrawer({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOptionItem[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [lines, setLines] = useState<ProductLinkLine[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [batchSupplyPrice, setBatchSupplyPrice] = useState('');
  const [batchMinQty, setBatchMinQty] = useState('');

  useEffect(() => {
    if (!visible) return;
    setVendorId('');
    setLines([]);
    setBatchSupplyPrice('');
    setBatchMinQty('');
    fetchSupplierOptions(currentShopId() || 0)
      .then(setSupplierOptions)
      .catch(() => setSupplierOptions([]));
  }, [visible]);

  const updateLine = (key: string, patch: Partial<ProductLinkLine>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const submit = async () => {
    if (!vendorId) return Toast.warning(t('请选择供应商'));
    if (!lines.length) return Toast.warning(t('请选择要挂接的平台商品'));
    for (const line of lines) {
      if (!parseMoneyValid(line.supplyPrice)) {
        return Toast.warning(t('商品「{name}」的供货价格式不正确（最多两位小数）', { name: line.productName }));
      }
      if ((Math.round(Number(line.minPurchaseQty)) || 0) < 1) {
        return Toast.warning(t('商品「{name}」的最小起订量需大于 0', { name: line.productName }));
      }
    }
    setSaving(true);
    try {
      const grouped = new Map<string, ProductLinkLine[]>();
      lines.forEach((line) => {
        grouped.set(line.productId, [...(grouped.get(line.productId) || []), line]);
      });
      await apiPost('/supplyChain/supplierProduct/batchSave', {
        shopId: Number(currentShopId() || 0),
        vendorId: Number(vendorId),
        products: [...grouped.entries()].map(([productId, skus]) => ({
          productId: Number(productId),
          status: 1,
          skus: skus.map((line) => ({
            skuId: Number(line.skuId),
            supplyPrice: Number(line.supplyPrice),
            minPurchaseQty: Math.max(1, Math.round(Number(line.minPurchaseQty) || 1)),
          })),
        })),
      });
      Toast.success(t('挂接成功'));
      onSaved();
    } catch (error) {
      Toast.error({ content: errMsg(error, t) });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: t('商品信息'),
      dataIndex: 'productName',
      render: (_: any, row: ProductLinkLine) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {row.picThumb ? (
            <img src={row.picThumb} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
          ) : null}
          <div>
            <div>{row.productName}</div>
            {row.skuName ? <Text type="tertiary" size="small">{row.skuName}</Text> : null}
          </div>
        </div>
      ),
    },
    {
      title: t('供货价(元)'),
      width: 150,
      render: (_: any, row: ProductLinkLine) => (
        <InputNumber
          size="small"
          style={{ width: 120 }}
          min={0}
          value={row.supplyPrice}
          onChange={(val) => updateLine(row.key, { supplyPrice: String(val ?? '') })}
        />
      ),
    },
    {
      title: t('最小起订量'),
      width: 150,
      render: (_: any, row: ProductLinkLine) => (
        <InputNumber
          size="small"
          style={{ width: 120 }}
          min={1}
          step={1}
          precision={0}
          value={row.minPurchaseQty}
          onChange={(val) => updateLine(row.key, { minPurchaseQty: String(val ?? '') })}
        />
      ),
    },
    {
      title: t('操作'),
      width: 80,
      render: (_: any, row: ProductLinkLine) => (
        <Button
          theme="borderless"
          type="danger"
          size="small"
          onClick={() => setLines((prev) => prev.filter((line) => line.key !== row.key))}
        >
          {t('删除')}
        </Button>
      ),
    },
  ];

  return (
    <SideSheet
      title={t('批量挂接平台商品')}
      visible={visible}
      onCancel={onClose}
      width={860}
      placement="right"
      bodyStyle={{ overflowY: 'auto' }}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={saving} onClick={submit}>
            {t('保存')}
          </Button>
        </div>
      }
    >
      <Field label={t('供应商')} required>
        <Select
          placeholder={t('选择供应商')}
          style={{ width: 320 }}
          showClear
          filter
          value={vendorId || undefined}
          optionList={supplierOptions.map((item) => ({ label: item.vendorName, value: String(item.vendorId) }))}
          onChange={(val) => {
            setVendorId(val === undefined || val === null ? '' : String(val));
            setLines([]);
          }}
        />
      </Field>
      <div style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<IconPlus />} disabled={!vendorId} onClick={() => setPickerOpen(true)}>
          {t('选择平台商品')}
        </Button>
        {lines.length ? (
          <Text style={{ marginLeft: 8 }}>{t('已选择 {count} 条供货明细', { count: lines.length })}</Text>
        ) : null}
      </div>
      {lines.length ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Input
            placeholder={t('供货价(元)')}
            style={{ width: 130 }}
            value={batchSupplyPrice}
            onChange={(val) => setBatchSupplyPrice(val)}
          />
          <Input
            placeholder={t('最小起订量')}
            style={{ width: 130 }}
            value={batchMinQty}
            onChange={(val) => setBatchMinQty(val)}
          />
          <Button
            onClick={() => {
              if (!batchSupplyPrice && !batchMinQty) return Toast.warning(t('请先填写要批量填充的值'));
              setLines((prev) =>
                prev.map((line) => ({
                  ...line,
                  ...(batchSupplyPrice ? { supplyPrice: batchSupplyPrice } : {}),
                  ...(batchMinQty ? { minPurchaseQty: batchMinQty } : {}),
                })),
              );
            }}
          >
            {t('批量填充')}
          </Button>
        </div>
      ) : null}
      <Table
        dataSource={lines}
        rowKey="key"
        columns={columns as any}
        pagination={false}
        empty={t('暂无商品，请点击「选择平台商品」')}
      />

      <ProductPickerModal
        visible={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(incoming) => {
          setLines((prev) => {
            const next = [...prev];
            incoming.forEach((line) => {
              if (!next.some((item) => item.key === line.key)) next.push(line);
            });
            return next;
          });
          setPickerOpen(false);
        }}
      />
    </SideSheet>
  );
}

export function SupplierProducts() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [batchOpen, setBatchOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [supplierTotal, setSupplierTotal] = useState(0);
  const [productTotal, setProductTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    setSummaryLoading(true);
    apiGet<any>('/supplyChain/supplierProduct/summary', { page: 1, size: 100 })
      .then((res) => {
        if (!alive) return;
        const records = res.records || [];
        setSupplierTotal(Number(res.total ?? records.length) || 0);
        setProductTotal(records.reduce((sum: number, item: any) => sum + (Number(item.productCount) || 0), 0));
      })
      .catch(() => undefined)
      .finally(() => alive && setSummaryLoading(false));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const columns: ColumnConfig<SupplierProductItem>[] = [
    {
      title: t('商品名称'),
      dataIndex: 'productName',
      render: (val: any, row: SupplierProductItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{val || '--'}</div>
          {row.productSn ? <Text type="tertiary" size="small">{t('货号: {sn}', { sn: row.productSn })}</Text> : null}
        </div>
      ),
    },
    {
      title: t('供应商'),
      dataIndex: 'vendorName',
      width: 180,
      render: (val: any, row: SupplierProductItem) => val || row.supplierName || '--',
    },
    {
      title: t('供货价(元)'),
      dataIndex: 'purchasePrice',
      width: 140,
      render: (val: any) => (
        <span style={{ fontWeight: 600, color: '#165dff' }}>
          {Number.isFinite(Number(val)) ? Number(val).toFixed(2) : '--'}
        </span>
      ),
    },
    {
      title: t('供货库存'),
      dataIndex: 'supplyStock',
      width: 120,
      render: (val: any) => val ?? 0,
    },
    {
      title: t('更新时间'),
      dataIndex: 'updateTime',
      width: 170,
      render: (val: any) => val || '--',
    },
  ];

  return (
    <div>
      <Card shadows="hover" style={{ marginBottom: 12 }} bodyStyle={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 48 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--semi-color-text-2)', marginBottom: 4 }}>{t('供应商数量')}</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{summaryLoading ? '--' : supplierTotal}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--semi-color-text-2)', marginBottom: 4 }}>{t('挂接商品总数')}</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{summaryLoading ? '--' : productTotal}</div>
            </div>
          </div>
          <Text type="tertiary" size="small">
            {t('数据来源：supplyChain/supplierProduct/summary（取前 100 家供应商聚合）')}
          </Text>
        </div>
      </Card>
      <ListPage<SupplierProductItem>
        key={reloadKey}
        api="/supplyChain/supplierProduct/list"
        rowKey={(row) => String(row.id ?? row.productId ?? '')}
        columns={columns}
        toolbarExtra={
          <Button icon={<IconPlus />} type="primary" onClick={() => setBatchOpen(true)}>
            {t('批量挂接平台商品')}
          </Button>
        }
        filters={[
          {
            field: 'keyword',
            label: t('商品'),
            placeholder: t('输入商品名称/货号'),
            type: 'input',
          },
          {
            field: 'supplierId',
            label: t('供应商'),
            placeholder: t('输入供应商名称'),
            type: 'input',
          },
        ]}
      />

      <SupplierProductBatchDrawer
        visible={batchOpen}
        onClose={() => setBatchOpen(false)}
        onSaved={() => {
          setBatchOpen(false);
          setReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}

/* ==================================================================
   4. 供应链设置 (PurchaseSetting / purchaseSettingManage)
   契约对齐原版 purchaseSetting.ts：detail 返回 autoFinishDays/allowOverReceive/
   inherited；save 提交 {shopId, autoFinishDays, allowOverReceive}
================================================================== */
export function PurchaseSetting() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoFinishDays, setAutoFinishDays] = useState<string>('');
  const [allowOverReceive, setAllowOverReceive] = useState(false);
  const [inherited, setInherited] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<any>('/supplyChain/purchaseSetting/detail')
      .then((res) => {
        if (!alive) return;
        setAutoFinishDays(res?.autoFinishDays === null || res?.autoFinishDays === undefined ? '' : String(res.autoFinishDays));
        setAllowOverReceive(Number(res?.allowOverReceive) === 1);
        setInherited(res?.inherited === true);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPost('/supplyChain/purchaseSetting/save', {
        shopId: Number(currentShopId() || 0),
        autoFinishDays: autoFinishDays === '' ? null : Number(autoFinishDays),
        allowOverReceive: inherited ? null : allowOverReceive ? 1 : 0,
      });
      Toast.success(t('供应链设置保存成功'));
    } catch (error) {
      Toast.error({ content: errMsg(error, t) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={t('采购与供应链设置')} loading={loading}>
      <div style={{ maxWidth: 650, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('采购单自动完结天数')}</div>
          <InputNumber
            style={{ width: 240 }}
            min={0}
            max={3650}
            step={1}
            precision={0}
            placeholder={t('留空表示不自动完结')}
            value={autoFinishDays === '' ? undefined : Number(autoFinishDays)}
            onChange={(val) => setAutoFinishDays(val === null || val === undefined ? '' : String(val))}
          />
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--semi-color-text-2)' }}>
            {t('采购单超过该天数仍未完结时由系统自动完结；留空表示不启用自动完结。')}
          </div>
        </div>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('允许超量收货')}</div>
          <Switch
            checked={allowOverReceive}
            disabled={inherited}
            onChange={(checked) => setAllowOverReceive(checked)}
          />
          {inherited ? (
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--semi-color-text-2)' }}>
              {t('当前店铺未单独配置，继承上级设置，如需修改请先在上级店铺配置。')}
            </div>
          ) : null}
        </div>
        <div>
          <Button theme="solid" type="primary" loading={saving} onClick={handleSave}>
            {t('保存设置')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
