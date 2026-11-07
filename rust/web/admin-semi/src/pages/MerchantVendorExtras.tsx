/**
 * 商家/供应商端补充页面集合（补齐迁移缺失页，对应原版多角色后台）：
 *
 * 1. ShopStaffManage     商家员工（原 authority/adminUser/ShopList.vue）
 *                        GET /merchant/adminUserShop/list，create/update/del
 * 2. VendorStaffManage   供应商员工（原 vendor/setting/adminUser/List.vue）
 *                        GET /vendor/adminVendorUser/list，create/update/del
 * 3. VendorBindShopManage 供应商绑定店铺（原 vendor/supplier/bindShop/List.vue）
 *                        GET /vendor/vendorShopBind/list + orderList/productList 详情弹窗
 * 4. ShopTeamSettings    团队管理/店铺设置（原 merchant/setting/team/Index.vue）
 *                        GET /merchant/shop/currentDetail + POST /merchant/shop/setting
 * 5. ShopInfoDashboard   店铺信息（原 merchant/setting/shopInfo/Index.vue）
 *                        GET /merchant/shop/currentDetail + staffShow
 *
 * 后端契约：Rust routes/merchant/admin_user_shop.rs + shop_manage.rs +
 * routes/vendor/lowfreq.rs（adminVendorUser / vendorShopBind）。
 */

import { useEffect, useState } from 'react';
import { Button, Card, Checkbox, Form, Input, Modal, Radio, RadioGroup, Select, Space, Spin, Table, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';

const { Text } = Typography;

/* ============================== 1. 商家员工 ============================== */

interface StaffRow extends Record<string, any> {
  id?: number;
  username?: string;
  email?: string;
  mobile?: string;
  avatar?: string;
  isUsing?: number;
  isAdmin?: number;
  roleId?: number;
  roleName?: string;
  addTime?: string;
}

const staffDrawer = (
  t: (key: string) => string,
): FormDrawerConfig => ({
  title: t('员工'),
  addText: t('添加员工'),
  width: 560,
  idField: 'id',
  createApi: '/merchant/adminUserShop/create',
  updateApi: '/merchant/adminUserShop/update',
  deleteApi: '/merchant/adminUserShop/del',
  sections: [
    {
      key: 'base',
      title: t('员工信息'),
      fields: [
        { field: 'username', label: t('员工名称'), required: true },
        { field: 'email', label: t('邮箱地址') },
        { field: 'mobile', label: t('手机号码') },
        {
          field: 'isUsing',
          label: t('是否启用'),
          type: 'switch',
          initValue: true,
        },
        { field: 'roleId', label: t('权限组'), type: 'number' },
      ],
    },
  ],
});

export function ShopStaffManage() {
  const { t } = useI18n();
  const columns: ColumnConfig<StaffRow>[] = [
    { title: '员工名称', dataIndex: 'username', width: 160, render: (v: string) => v || '--' },
    { title: '邮箱', dataIndex: 'email', width: 200, render: (v: string) => v || '--' },
    { title: '手机号', dataIndex: 'mobile', width: 140, render: (v: string) => v || '--' },
    {
      title: '管理员',
      dataIndex: 'isAdmin',
      width: 90,
      render: (v: number) => (Number(v) === 1 ? <Text type="success">{t('是')}</Text> : t('否')),
    },
    {
      title: '启用状态',
      dataIndex: 'isUsing',
      width: 100,
      render: (v: number) => (Number(v) === 1 ? <Text type="success">{t('启用')}</Text> : <Text type="warning">{t('停用')}</Text>),
    },
    { title: '添加时间', dataIndex: 'addTime', width: 170, render: (v: string) => v || '--' },
  ];

  return (
    <ListPage<StaffRow>
      api="/merchant/adminUserShop/list"
      rowKey="id"
      pageSize={10}
      actionWidth={130}
      filters={[{ field: 'keyword', label: '员工名称', type: 'input', placeholder: '输入员工名称', width: 220 }]}
      columns={columns}
      drawer={staffDrawer(t)}
    />
  );
}

/* ============================== 2. 供应商员工 ============================== */

const vendorStaffDrawer = (t: (key: string) => string): FormDrawerConfig => ({
  title: t('员工'),
  addText: t('添加员工'),
  width: 560,
  idField: 'id',
  createApi: '/vendor/adminVendorUser/create',
  updateApi: '/vendor/adminVendorUser/update',
  deleteApi: '/vendor/adminVendorUser/del',
  sections: [
    {
      key: 'base',
      title: t('员工信息'),
      fields: [
        { field: 'username', label: t('员工名称'), required: true },
        { field: 'email', label: t('邮箱地址') },
        {
          field: 'isUsing',
          label: t('是否启用'),
          type: 'switch',
          initValue: true,
        },
      ],
    },
  ],
});

export function VendorStaffManage() {
  const { t } = useI18n();
  const columns: ColumnConfig<StaffRow>[] = [
    { title: '员工名称', dataIndex: 'username', width: 160, render: (v: string) => v || '--' },
    { title: '邮箱', dataIndex: 'email', width: 200, render: (v: string) => v || '--' },
    {
      title: '启用状态',
      dataIndex: 'isUsing',
      width: 100,
      render: (v: number) => (Number(v) === 1 ? <Text type="success">{t('启用')}</Text> : <Text type="warning">{t('停用')}</Text>),
    },
    { title: '添加时间', dataIndex: 'addTime', width: 170, render: (v: string) => v || '--' },
  ];

  return (
    <ListPage<StaffRow>
      api="/vendor/adminVendorUser/list"
      rowKey="id"
      pageSize={10}
      actionWidth={130}
      filters={[{ field: 'keyword', label: '员工名称', type: 'input', placeholder: '输入员工名称', width: 220 }]}
      columns={columns}
      drawer={vendorStaffDrawer(t)}
    />
  );
}

/* ============================== 3. 供应商绑定店铺 ============================== */

interface BindShopRow extends Record<string, any> {
  id?: number;
  vendorId?: number;
  shopId?: number;
  addTime?: string;
}

interface BindOrderRow extends Record<string, any> {
  orderId?: number;
  orderSn?: string;
  userId?: number;
  totalAmount?: number | string;
}

interface BindProductRow extends Record<string, any> {
  productId?: number;
  productName?: string;
  productSn?: string;
  price?: number | string;
}

export function VendorBindShopManage() {
  const { t } = useI18n();
  const [orderTarget, setOrderTarget] = useState<BindShopRow | null>(null);
  const [productTarget, setProductTarget] = useState<BindShopRow | null>(null);
  const [detailRows, setDetailRows] = useState<Array<Record<string, any>>>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (row: BindShopRow, kind: 'order' | 'product') => {
    if (kind === 'order') setOrderTarget(row);
    else setProductTarget(row);
    setDetailLoading(true);
    try {
      const result = await apiGet<any>(
        kind === 'order' ? '/vendor/vendorShopBind/orderList' : '/vendor/vendorShopBind/productList',
        { shopId: row.shopId, page: 1, size: 100 },
      );
      setDetailRows(result?.records || []);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
      setDetailRows([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ColumnConfig<BindShopRow>[] = [
    { title: '绑定ID', dataIndex: 'id', width: 90 },
    { title: '供应商ID', dataIndex: 'vendorId', width: 110 },
    { title: '店铺ID', dataIndex: 'shopId', width: 110 },
    { title: '绑定时间', dataIndex: 'addTime', width: 170, render: (v: string) => v || '--' },
  ];

  return (
    <>
      <ListPage<BindShopRow>
        api="/vendor/vendorShopBind/list"
        rowKey="id"
        pageSize={10}
        actionWidth={200}
        filters={[{ field: 'keyword', label: '关键词', type: 'input', placeholder: '输入关键词', width: 220 }]}
        columns={columns}
        rowActions={(row) => (
          <>
            <Button theme="borderless" size="small" onClick={() => openDetail(row, 'order')}>
              {t('查看订单')}
            </Button>
            <Button theme="borderless" size="small" onClick={() => openDetail(row, 'product')}>
              {t('查看商品')}
            </Button>
          </>
        )}
      />

      <Modal
        title={t('查看订单')}
        visible={Boolean(orderTarget)}
        onCancel={() => setOrderTarget(null)}
        footer={null}
        width={720}
      >
        <Table<BindOrderRow>
          loading={detailLoading}
          dataSource={detailRows as BindOrderRow[]}
          pagination={false}
          rowKey={(record?: BindOrderRow, index?: number) => String(record?.orderId ?? index ?? 0)}
          columns={[
            { title: t('订单号'), dataIndex: 'orderSn', width: 220, render: (v: string) => <span className="mono">{v || '--'}</span> },
            { title: t('用户ID'), dataIndex: 'userId', width: 110 },
            {
              title: t('订单金额'),
              dataIndex: 'totalAmount',
              width: 130,
              render: (v: unknown) => `¥ ${Number(v || 0).toFixed(2)}`,
            },
          ] as any}
        />
      </Modal>

      <Modal
        title={t('查看商品')}
        visible={Boolean(productTarget)}
        onCancel={() => setProductTarget(null)}
        footer={null}
        width={720}
      >
        <Table<BindProductRow>
          loading={detailLoading}
          dataSource={detailRows as BindProductRow[]}
          pagination={false}
          rowKey={(record?: BindProductRow, index?: number) => String(record?.productId ?? index ?? 0)}
          columns={[
            { title: t('商品名称'), dataIndex: 'productName', render: (v: string) => v || '--' },
            { title: t('商品编码'), dataIndex: 'productSn', width: 140, render: (v: string) => v || '--' },
            {
              title: t('售价'),
              dataIndex: 'price',
              width: 110,
              render: (v: unknown) => `¥ ${Number(v || 0).toFixed(2)}`,
            },
          ] as any}
        />
      </Modal>
    </>
  );
}

/* ============================== 4. 团队管理/店铺设置 ============================== */

/** 店铺团队设置（原 merchant/setting/team/Index.vue：经营状态 + 客服设置 + 显示分类）。 */
export function ShopTeamSettings() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopId, setShopId] = useState<number | undefined>(undefined);
  const [values, setValues] = useState<{
    status: number;
    kefuPhone: string;
    kefuInlet: number[];
    shopShowCategory: number[];
  }>({ status: 1, kefuPhone: '', kefuInlet: [], shopShowCategory: [] });
  const [categories, setCategories] = useState<Array<{ categoryId: number; categoryName: string }>>([]);

  useEffect(() => {
    let alive = true;
    apiGet<any>('/merchant/shop/currentDetail')
      .then((detail) => {
        if (!alive) return;
        setShopId(detail?.shopId);
        const inlet = Array.isArray(detail?.kefuInlet)
          ? detail.kefuInlet.map(Number)
          : String(detail?.kefuInlet || '')
              .split(',')
              .map((item: string) => Number(item.trim()))
              .filter(Boolean);
        const showCategory = Array.isArray(detail?.shopShowCategory)
          ? detail.shopShowCategory.map(Number)
          : String(detail?.shopShowCategory || '')
              .split(',')
              .map((item: string) => Number(item.trim()))
              .filter(Boolean);
        setValues({
          status: Number(detail?.status ?? 1),
          kefuPhone: detail?.kefuPhone || '',
          kefuInlet: inlet,
          shopShowCategory: showCategory,
        });
      })
      .catch((error) => Toast.error({ content: error?.message || t('加载店铺信息失败') }))
      .finally(() => alive && setLoading(false));
    apiGet<any>('/product/category/getAllCategoryList')
      .then((result) => {
        if (!alive) return;
        const records = Array.isArray(result) ? result : result?.records || [];
        setCategories(
          records.map((item: any) => ({ categoryId: item.categoryId, categoryName: item.categoryName || item.name || '' })),
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const toggleIn = (list: number[], value: number) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const save = async () => {
    setSaving(true);
    try {
      await apiPost('/merchant/shop/setting', {
        shopId,
        status: values.status,
        kefuPhone: values.kefuPhone,
        kefuInlet: values.kefuInlet,
        shopShowCategory: values.shopShowCategory,
      });
      Toast.success({ content: t('设置成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 760 }}>
      <Spin spinning={loading}>
        <Card title={t('店铺团队设置')}>
          <div className="shop-team-form">
            <div className="shop-team-row">
              <label>{t('经营状态')}</label>
              <RadioGroup
                value={values.status}
                onChange={(event) => setValues((c) => ({ ...c, status: Number(event.target.value) }))}
              >
                <Radio value={1}>{t('开业')}</Radio>
                <Radio value={4}>{t('停业')}</Radio>
              </RadioGroup>
            </div>
            <div className="shop-team-row">
              <label>{t('客服电话')}</label>
              <Input
                style={{ width: 300 }}
                value={values.kefuPhone}
                onChange={(next) => setValues((c) => ({ ...c, kefuPhone: next }))}
                placeholder={t('请输入客服电话')}
              />
            </div>
            <div className="shop-team-row">
              <label>{t('客服入口页面')}</label>
              <Space>
                <Checkbox
                  checked={values.kefuInlet.includes(1)}
                  onChange={() => setValues((c) => ({ ...c, kefuInlet: toggleIn(c.kefuInlet, 1) }))}
                >
                  {t('商品详情页')}
                </Checkbox>
                <Checkbox
                  checked={values.kefuInlet.includes(2)}
                  onChange={() => setValues((c) => ({ ...c, kefuInlet: toggleIn(c.kefuInlet, 2) }))}
                >
                  {t('订单详情页')}
                </Checkbox>
              </Space>
            </div>
            <div className="shop-team-row">
              <label>{t('显示分类')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {categories.map((category) => (
                  <Checkbox
                    key={category.categoryId}
                    checked={values.shopShowCategory.includes(category.categoryId)}
                    onChange={() =>
                      setValues((c) => ({ ...c, shopShowCategory: toggleIn(c.shopShowCategory, category.categoryId) }))
                    }
                  >
                    {category.categoryName}
                  </Checkbox>
                ))}
              </div>
            </div>
            <div className="shop-team-row">
              <label />
              <Button theme="solid" type="primary" loading={saving} onClick={save}>
                {t('保存')}
              </Button>
            </div>
          </div>
        </Card>
      </Spin>
    </div>
  );
}

/* ============================== 5. 店铺信息 ============================== */

/** 店铺信息（原 merchant/setting/shopInfo/Index.vue：店铺资料 + 员工展示信息）。 */
export function ShopInfoDashboard() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Record<string, any>>({});
  const [staffShow, setStaffShow] = useState<Record<string, any>>({});

  useEffect(() => {
    let alive = true;
    apiGet<any>('/merchant/shop/currentDetail')
      .then((result) => alive && setDetail(result || {}))
      .catch((error) => Toast.error({ content: error?.message || t('加载店铺信息失败') }))
      .finally(() => alive && setLoading(false));
    apiGet<any>('/merchant/shop/staffShow')
      .then((result) => alive && setStaffShow(result || {}))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const rows: Array<[string, string]> = [
    [t('店铺名称'), detail.shopTitle || detail.name || '--'],
    [t('店铺状态'), Number(detail.status) === 1 ? t('开业') : Number(detail.status) === 4 ? t('停业') : t('打烊')],
    [t('联系电话'), detail.contactMobile || detail.mobile || '--'],
    [t('客服电话'), detail.kefuPhone || '--'],
    [t('客服微信'), detail.kefuWeixin || '--'],
    [t('详细地址'), detail.address || detail.shopAddress || '--'],
    [t('开店时间'), detail.addTime || '--'],
    [t('员工人数'), String(staffShow.staffNum ?? staffShow.total ?? '--')],
    [t('会员人数'), String(staffShow.userNum ?? detail.userCount ?? '--')],
  ];

  return (
    <div style={{ padding: 20, maxWidth: 760 }}>
      <Spin spinning={loading}>
        <Card title={t('店铺信息')}>
          <div className="shop-team-form">
            {rows.map(([label, value]) => (
              <div className="shop-team-row" key={label}>
                <label>{label}</label>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </Spin>
    </div>
  );
}
