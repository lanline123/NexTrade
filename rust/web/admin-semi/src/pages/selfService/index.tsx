/**
 * 商户端（adminType=shop）与供应商端（adminType=vendor）自助页面集实例。
 * 工厂实现在 CapitalPages.tsx；此处按两端 api 前缀装配，并实现非对称页面
 * （供应商财务日志、供应商信息/员工/绑定店铺/库存、商户设置等孤儿域页面）。
 */
import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Toast,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../../api';
import { useI18n } from '../../i18n';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import {
  makeAccountListPage,
  makeBalanceLogPage,
  makeCapitalOverview,
  makeDepositPage,
  makeWithdrawPage,
} from './CapitalPages';

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? `¥${n.toFixed(2)}` : '--';
};

/* ================================ 商户端资产中心 ================================ */

export const ShopDashboardManage = makeCapitalOverview({
  indexApi: '/merchant/shopAccount/index',
  logApi: '/merchant/shopAccount/logList',
  titleKey: 'shopDashboard',
});

export const ShopBalanceManage = makeBalanceLogPage({ logApi: '/merchant/shopAccount/logList', filters: true });

export const ShopAccountListManage = makeAccountListPage({
  listApi: '/merchant/account/list',
  detailApi: '/merchant/account/detail',
  createApi: '/merchant/account/create',
  updateApi: '/merchant/account/update',
  delApi: '/merchant/account/del',
  configApi: '/merchant/account/config',
});

export const ShopWithdrawManage = makeWithdrawPage({
  configApi: '/merchant/shopWithdraw/config',
  createApi: '/merchant/shopWithdraw/create',
  listApi: '/merchant/shopWithdraw/list',
  dualBalanceApi: '/merchant/shopWithdraw/dualBalance',
});

export const ShopDepositManage = makeDepositPage({
  overviewApi: '/deposit/shop/overview',
  logApi: '/deposit/shop/logList',
  frozenApi: '/deposit/shop/frozenDetailList',
  rechargeApplyApi: '/deposit/recharge/apply',
  payeeListApi: '/deposit/payeeAccount/list',
});

/* =============================== 供应商端财务中心 =============================== */

export const VendorDashboardManage = makeCapitalOverview({
  indexApi: '/vendor/adminVendorAccount/index',
  logApi: '/vendor/adminVendorAccount/logList',
  titleKey: 'vendorDashboard',
});

export const VendorBalanceManage = makeBalanceLogPage({ logApi: '/vendor/adminVendorAccount/logList', filters: true });

export const VendorAccountListManage = makeAccountListPage({
  listApi: '/vendor/vendorAccount/list',
  detailApi: '/vendor/vendorAccount/detail',
  delApi: '/vendor/vendorAccount/del',
  configApi: '/vendor/vendorAccount/config',
});

export const VendorWithdrawManage = makeWithdrawPage({
  configApi: '/vendor/vendorWithdraw/config',
  createApi: '/vendor/vendorWithdraw/create',
  listApi: '/vendor/vendorWithdraw/list',
});

/** 供应商保证金（deposit/vendor/*）。 */
export const VendorDepositManage = makeDepositPage({
  overviewApi: '/deposit/vendor/overview',
  logApi: '/deposit/vendor/logList',
  frozenApi: '/deposit/vendor/frozenDetailList',
});

/* ============================== 供应商设置与自有库存 ============================== */

/** 供应商信息（vendorInfoManage）：vendor/vendor/setting 读取 + currentDetail/updateInfo 保存。 */
export function VendorInfoManage() {
  const { t } = useI18n();
  const [info, setInfo] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<Record<string, any>>('/vendor/vendor/setting', {})
      .then(setInfo)
      .catch((e) => Toast.error({ content: e.message }));
  }, []);

  const save = async () => {
    if (!info) return;
    setSaving(true);
    try {
      await apiPost('/vendor/vendor/updateInfo', info);
      Toast.success({ content: t('保存成功') });
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  if (!info) return <div style={{ padding: 20 }}><Empty description={t('加载中')} /></div>;
  const fields: Array<[string, string]> = [
    ['vendorName', t('供应商名称')],
    ['contactName', t('联系人')],
    ['phone', t('联系电话')],
    ['email', t('邮箱')],
    ['address', t('地址')],
  ];
  return (
    <div style={{ padding: 20 }}>
      <Card title={t('供应商信息')}>
        <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
          {fields.map(([key, label]) => (
            <label key={key} style={{ display: 'grid', gap: 4 }}>
              <span>{label}</span>
              <Input value={info[key] ?? ''} onChange={(v) => setInfo({ ...info, [key]: v })} />
            </label>
          ))}
          <Button theme="solid" type="primary" loading={saving} onClick={save} style={{ alignSelf: 'flex-start' }}>{t('保存')}</Button>
        </div>
      </Card>
    </div>
  );
}

/** 供应商员工与角色（EmployeeManagement / vendorRoleManage）：vendor/adminVendorUser/*。 */
export function VendorEmployeeManage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);

  const load = () => {
    setLoading(true);
    apiGet<{ records?: any[] } | any[]>('/vendor/adminVendorUser/list', {})
      .then((res) => setRows(Array.isArray(res) ? res : res.records || []))
      .catch((e) => Toast.error({ content: e.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!editing) return;
    try {
      await apiPost(editing.id ? '/vendor/adminVendorUser/update' : '/vendor/adminVendorUser/create', editing);
      Toast.success({ content: t('保存成功') });
      setEditing(null);
      load();
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('保存失败') });
    }
  };

  const remove = async (row: any) => {
    try {
      await apiPost('/vendor/adminVendorUser/del', { id: row.id ?? row.vendorUserId });
      Toast.success({ content: t('删除成功') });
      load();
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('删除失败') });
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button theme="solid" type="primary" onClick={() => setEditing({ username: '', nickname: '', phone: '' })}>{t('添加员工')}</Button>
      </Space>
      <Table
        loading={loading}
        dataSource={rows}
        rowKey={(r?: any) => String(r.id ?? r.vendorUserId ?? Math.random())}
        empty={<Empty description={t('暂无员工')} />}
        pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 70, render: (_: any, r: any) => r.id ?? r.vendorUserId },
          { title: t('账号'), dataIndex: 'username' },
          { title: t('姓名'), dataIndex: 'nickname', render: (v: any) => v || '-' },
          { title: t('手机号'), dataIndex: 'phone', render: (v: any) => v || '-' },
          { title: t('状态'), dataIndex: 'status', width: 90, render: (v: any) => <Tag color={Number(v) === 1 ? 'green' : 'grey'}>{Number(v) === 1 ? t('启用') : t('停用')}</Tag> },
          {
            title: t('操作'),
            width: 160,
            render: (_: any, r: any) => (
              <Space>
                <Button theme="borderless" type="primary" onClick={() => setEditing({ ...r })}>{t('编辑')}</Button>
                <Popconfirm title={t('确认删除？')} onConfirm={() => remove(r)}>
                  <Button theme="borderless" type="danger">{t('删除')}</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ] as ColumnProps<any>[]}
      />
      <Modal title={editing?.id ? t('编辑员工') : t('添加员工')} visible={!!editing} onOk={save} onCancel={() => setEditing(null)} width={440} okText={t('提交')} cancelText={t('取消')}>
        {editing && (
          <div style={{ display: 'grid', gap: 12 }}>
            {(['username', 'nickname', 'phone'] as const).map((key) => (
              <label key={key} style={{ display: 'grid', gap: 4 }}>
                <span>{{ username: t('账号'), nickname: t('姓名'), phone: t('手机号') }[key]}</span>
                <Input value={editing[key] ?? ''} onChange={(v) => setEditing({ ...editing, [key]: v })} />
              </label>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

/** 绑定店铺（bindShopManager）：vendor/vendorShopBind/list。 */
export function VendorBindShopManage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet<{ records?: any[] } | any[]>('/vendor/vendorShopBind/list', {})
      .then((res) => setRows(Array.isArray(res) ? res : res.records || []))
      .catch((e) => Toast.error({ content: e.message }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <Table
        loading={loading}
        dataSource={rows}
        rowKey={(r?: any) => String(r.id ?? r.bindId ?? Math.random())}
        empty={<Empty description={t('暂无绑定店铺')} />}
        pagination={false}
        columns={[
          { title: t('店铺名称'), dataIndex: 'shopTitle', render: (v: any, r: any) => v || r.shopName || '-' },
          { title: t('店铺类型'), dataIndex: 'shopTypeName', render: (v: any) => v || '-' },
          { title: t('绑定时间'), dataIndex: 'bindTime', render: (v: any, r: any) => v || r.addTime || '-' },
          { title: t('状态'), dataIndex: 'status', width: 100, render: (v: any) => <Tag color={Number(v) === 1 ? 'green' : 'grey'}>{Number(v) === 1 ? t('正常') : t('停用')}</Tag> },
        ] as ColumnProps<any>[]}
      />
    </div>
  );
}

/** 供应商自有库存（vendorProductStockManage）：vendor/stock/page + 入库/出库/调整记录。 */
export function VendorProductStockManage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [op, setOp] = useState<'stockIn' | 'stockOut' | 'stockAdjust' | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const load = (p = 1) => {
    setLoading(true);
    apiGet<{ records?: any[]; total?: number } | any[]>('/vendor/stock/page', { page: p, size: 15, keyword: keyword || undefined })
      .then((res) => {
        const list = Array.isArray(res) ? res : res.records || [];
        setRows(list);
        setTotal(Array.isArray(res) ? list.length : res.total || list.length);
      })
      .catch((e) => Toast.error({ content: e.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 后端为简化实现：写一条 stock_record 流水（MANUAL/ADJ），并回执成功。
  const submitOp = async () => {
    if (!op) return;
    setSaving(true);
    try {
      await apiPost(`/vendor/stock/${op}`, { comment: comment || undefined });
      Toast.success({ content: t('单据已提交') });
      setOp(null);
      setComment('');
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('提交失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Space style={{ marginBottom: 16 }}>
        <Input style={{ width: 220 }} value={keyword} onChange={setKeyword} placeholder={t('商品名称')} />
        <Button type="primary" onClick={() => { setPage(1); load(1); }}>{t('搜索')}</Button>
        <Button onClick={() => setOp('stockIn')}>{t('入库')}</Button>
        <Button onClick={() => setOp('stockOut')}>{t('出库')}</Button>
        <Button onClick={() => setOp('stockAdjust')}>{t('库存调整')}</Button>
      </Space>
      <Table
        loading={loading}
        dataSource={rows}
        rowKey={(r?: any) => String(r.productId ?? r.id ?? Math.random())}
        empty={<Empty description={t('暂无数据')} />}
        pagination={{ currentPage: page, pageSize: 15, total, onPageChange: (p) => { setPage(p); load(p); } }}
        columns={[
          { title: t('商品'), dataIndex: 'productName', render: (v: any, r: any) => v || r.name || `#${r.productId ?? r.id}` },
          { title: t('规格'), dataIndex: 'skuName', render: (v: any) => v || '-' },
          { title: t('库存'), dataIndex: 'stock', width: 100, render: (v: any) => v ?? 0 },
          { title: t('锁定库存'), dataIndex: 'lockStock', width: 100, render: (v: any) => v ?? 0 },
          { title: t('预警值'), dataIndex: 'warningStock', width: 100, render: (v: any) => v ?? '-' },
        ] as ColumnProps<any>[]}
      />
      <Modal
        title={{ stockIn: t('商品入库'), stockOut: t('商品出库'), stockAdjust: t('库存调整') }[op as string]}
        visible={!!op}
        onOk={submitOp}
        onCancel={() => setOp(null)}
        width={420}
        okText={t('提交')}
        okButtonProps={{ loading: saving }}
        cancelText={t('取消')}
      >
        <label style={{ display: 'grid', gap: 4 }}>
          <span>{t('备注')}</span>
          <Input value={comment} onChange={setComment} placeholder={t('单据备注')} />
        </label>
      </Modal>
    </div>
  );
}

/** 库存流水（vendorProductStockManage/Log）：vendor/productInventoryLog/list。 */
export function VendorStockLogManage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet<{ records?: any[]; total?: number } | any[]>('/vendor/productInventoryLog/list', { page, size: 15 })
      .then((res) => {
        const list = Array.isArray(res) ? res : res.records || [];
        setRows(list);
        setTotal(Array.isArray(res) ? list.length : res.total || list.length);
      })
      .catch((e) => Toast.error({ content: e.message }))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div style={{ padding: 20 }}>
      <Table
        loading={loading}
        dataSource={rows}
        rowKey={(r?: any) => String(r.id ?? r.logId ?? Math.random())}
        empty={<Empty description={t('暂无数据')} />}
        pagination={{ currentPage: page, pageSize: 15, total, onPageChange: setPage }}
        columns={[
          { title: t('商品'), dataIndex: 'productName', render: (v: any, r: any) => v || r.name || `#${r.productId ?? r.skuId}` },
          { title: t('变动类型'), dataIndex: 'typeName', render: (v: any, r: any) => <Tag>{v ?? r.type ?? '-'}</Tag> },
          { title: t('变动数量'), dataIndex: 'changeNum', width: 100, render: (v: any) => v ?? '-' },
          { title: t('单据号'), dataIndex: 'orderSn', render: (v: any) => v || '-' },
          { title: t('时间'), dataIndex: 'addTime', width: 170 },
        ] as ColumnProps<any>[]}
      />
    </div>
  );
}

/* ============================ 商户端设置 / 分类（孤儿域） ============================ */

/** 店铺信息（ShopInfoManage）：merchant/shop/setting 读 + updateInfo 写。 */
export function ShopInfoManage() {
  const { t } = useI18n();
  const [info, setInfo] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<Record<string, any>>('/merchant/shop/setting', {})
      .then(setInfo)
      .catch((e) => Toast.error({ content: e.message }));
  }, []);

  const save = async () => {
    if (!info) return;
    setSaving(true);
    try {
      await apiPost('/merchant/shop/updateInfo', info);
      Toast.success({ content: t('保存成功') });
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  if (!info) return <div style={{ padding: 20 }}><Empty description={t('加载中')} /></div>;
  const fields: Array<[string, string]> = [
    ['shopTitle', t('店铺名称')],
    ['shopMobile', t('联系电话')],
    ['shopEmail', t('邮箱')],
    ['shopAddress', t('地址')],
    ['shopDesc', t('店铺简介')],
  ];
  return (
    <div style={{ padding: 20 }}>
      <Card title={t('店铺信息')}>
        <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
          {fields.map(([key, label]) => (
            <label key={key} style={{ display: 'grid', gap: 4 }}>
              <span>{label}</span>
              <Input value={info[key] ?? ''} onChange={(v) => setInfo({ ...info, [key]: v })} />
            </label>
          ))}
          <Button theme="solid" type="primary" loading={saving} onClick={save} style={{ alignSelf: 'flex-start' }}>{t('保存')}</Button>
        </div>
      </Card>
    </div>
  );
}

/** 店铺商品分类（shopProductCategoryManage）：merchant/shopProductCategory/*。 */
export function ShopProductCategoryManage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);

  const load = () => {
    setLoading(true);
    apiGet<{ records?: any[] } | any[]>('/merchant/shopProductCategory/list', {})
      .then((res) => setRows(Array.isArray(res) ? res : res.records || []))
      .catch((e) => Toast.error({ content: e.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!editing) return;
    try {
      await apiPost(editing.id ? '/merchant/shopProductCategory/update' : '/merchant/shopProductCategory/create', editing);
      Toast.success({ content: t('保存成功') });
      setEditing(null);
      load();
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('保存失败') });
    }
  };

  const remove = async (row: any) => {
    try {
      await apiPost('/merchant/shopProductCategory/del', { id: row.id ?? row.categoryId });
      Toast.success({ content: t('删除成功') });
      load();
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('删除失败') });
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button theme="solid" type="primary" onClick={() => setEditing({ categoryName: '', sortOrder: 50 })}>{t('添加分类')}</Button>
      </Space>
      <Table
        loading={loading}
        dataSource={rows}
        rowKey={(r?: any) => String(r.id ?? r.categoryId ?? Math.random())}
        empty={<Empty description={t('暂无分类')} />}
        pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 70, render: (_: any, r: any) => r.id ?? r.categoryId },
          { title: t('分类名称'), dataIndex: 'categoryName' },
          { title: t('排序'), dataIndex: 'sortOrder', width: 90 },
          { title: t('商品数'), dataIndex: 'productCount', width: 90, render: (v: any) => v ?? 0 },
          {
            title: t('操作'),
            width: 160,
            render: (_: any, r: any) => (
              <Space>
                <Button theme="borderless" type="primary" onClick={() => setEditing({ ...r })}>{t('编辑')}</Button>
                <Popconfirm title={t('确认删除？')} onConfirm={() => remove(r)}>
                  <Button theme="borderless" type="danger">{t('删除')}</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ] as ColumnProps<any>[]}
      />
      <Modal title={editing?.id ? t('编辑分类') : t('添加分类')} visible={!!editing} onOk={save} onCancel={() => setEditing(null)} width={420} okText={t('提交')} cancelText={t('取消')}>
        {editing && (
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>{t('分类名称')}</span>
              <Input value={editing.categoryName ?? ''} onChange={(v) => setEditing({ ...editing, categoryName: v })} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>{t('排序')}</span>
              <Input value={String(editing.sortOrder ?? 50)} onChange={(v) => setEditing({ ...editing, sortOrder: Number(v) || 0 })} />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** 供应商财务日志（vendor/finance/financialLog）：vendor/adminVendorAccount/logList —— 由 makeBalanceLogPage 覆盖，此处导出别名。 */
export const VendorFinancialLogManage = makeBalanceLogPage({ logApi: '/vendor/adminVendorAccount/logList', filters: true });

/** 商户端资金流水别名（financialLogManage 商户侧 = shopAccount/logList）。 */
export const ShopFinancialLogSelfManage = makeBalanceLogPage({ logApi: '/merchant/shopAccount/logList', filters: true });
