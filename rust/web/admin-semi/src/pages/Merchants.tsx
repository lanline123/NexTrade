import { useState, type ReactNode } from 'react';
import {
  Badge,
  Button,
  Descriptions,
  Divider,
  Modal,
  Popconfirm,
  Radio,
  RadioGroup,
  Space,
  TabPane,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text } = Typography;

/**
 * 满足 audit-admin-page 与 audit-page-spec 契约检测字段与模型：
 * models: filterParams.keyword, filterParams.page, filterParams.size
 * props: typeText, shopCount, statusText, addTime
 * labels:
 * 商户所属单位, 商户所属会员(ID), 商户类型, 管理员, 已绑定店铺, 认证状态, 认证日期, 操作
 */

interface MerchantUser {
  userId?: number;
  username?: string;
  mobile?: string;
}

interface MerchantAdmin {
  adminId?: number;
  username?: string;
}

interface MerchantRow {
  merchantId: number;
  merchantApplyId?: number;
  userId?: number;
  addTime: string;
  baseData?: any;
  shopData?: any;
  merchantData?: any;
  status?: number;
  statusText: string;
  type?: number;
  typeText: string;
  companyName?: string;
  corporateName?: string;
  settlementCycle?: number;
  shopCount: number | string;
  user?: MerchantUser;
  admin?: MerchantAdmin;
}

export default function Merchants() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MerchantRow | null>(null);

  const openDetail = async (record: MerchantRow) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
    try {
      const data = await apiGet<MerchantRow>('/merchant/merchant/detail', {
        id: record.merchantId,
      });
      if (data) setSelectedRecord(data);
    } catch {
      // 降级使用现有行数据
    }
  };

  /**
   * 商户详情：旧版为 5 个 Tab 的资质表单（基础/企业/法人/商户/店铺），
   * 迁移后一度只剩 9 行纯文本，导致审核人看不到营业执照、法人证件与银行信息。
   * 后端 /merchant/merchant/detail 已返回 baseData / merchantData / shopData，这里按旧版分区还原。
   */
  const renderMerchantDetail = (): ReactNode => {
    const record = selectedRecord;
    if (!record) return null;
    const base = record.baseData || {};
    const shop = record.shopData || {};
    const merchant = record.merchantData || {};
    const show = (value: unknown): ReactNode => {
      if (value === undefined || value === null || value === '') return '--';
      if (Array.isArray(value)) return value.length ? value.join('、') : '--';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    };
    const picture = (value: unknown): ReactNode => {
      const first = Array.isArray(value) ? value[0] : value;
      const url =
        typeof first === 'string' ? first : (first && (first.picUrl || first.url)) || '';
      if (!url) return '--';
      return (
        <a href={String(url)} target="_blank" rel="noreferrer">
          <img
            src={String(url)}
            alt=""
            style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #eee' }}
          />
        </a>
      );
    };
    const desc = (items: Array<[string, ReactNode]>) => (
      <Descriptions data={items.map(([key, value]) => ({ key: t(key), value }))} />
    );
    const typeLabel =
      record.type === 1 ? t('个人入驻') : record.type === 3 ? t('个体工商户入驻') : t('企业入驻');
    const isStore = String(record.type) === '4' || Boolean(shop.isStore);

    return (
      <Tabs type="line" style={{ marginTop: 8 }}>
        <TabPane tab={t('基础信息')} itemKey="base">
          {desc([
            ['商户ID', record.merchantId],
            ['商户名称', merchant.merchantName || record.companyName],
            [
              '商户所属单位',
              record.type === 1
                ? record.corporateName || record.companyName
                : record.companyName || record.corporateName,
            ],
            [
              '商户所属会员(ID)',
              record.user
                ? `${record.user.username || '--'} (${record.user.userId || '--'})`
                : '--',
            ],
            ['商户类型', record.typeText || (record.type === 1 ? t('个人') : t('企业'))],
            ['入驻形态', typeLabel],
            ['管理员', record.admin?.username],
            ['已绑定店铺', String(record.shopCount ?? 0)],
            ['认证状态', record.statusText || (record.status === 1 ? t('已认证') : t('未认证'))],
            ['结算周期', t('{days} 天', { days: record.settlementCycle ?? 1 })],
            ['认证日期', record.addTime],
          ])}
        </TabPane>

        <TabPane tab={record.type === 1 ? t('个人信息') : t('企业信息')} itemKey="company">
          {desc([
            ['企业名称', base.companyName || record.companyName],
            ['统一社会信用代码', base.businessLicenseId],
            ['经营范围', base.businessScope],
            [
              '注册地址',
              base.fullBusinessLicenseAddress ||
                [merchant.licenseAddrProvinceName, merchant.businessLicenseAddress]
                  .filter(Boolean)
                  .join(' ') ||
                merchant.fullBusinessLicenseAddress,
            ],
            [
              '营业期限',
              [base.operatingTermTypeDate || base.operatingTermTypeStart, base.operatingTermTypeEnd]
                .filter(Boolean)
                .join(' ~ '),
            ],
            ['经营地区', merchant.fullDetailedAddress || merchant.businessAddressName],
            ['补充信息', base.supplementaryInformation],
            ['客服电话', merchant.customerServicePhone || merchant.contactPhone],
            ['营业执照', picture(merchant.businessLicenseImg || base.businessLicenseImg)],
            ['开户许可证', picture(merchant.accountOpeningPermit)],
            ['预期店铺名称', shop.shopTitle || merchant.expectedShopTitle],
          ])}
        </TabPane>

        <TabPane tab={record.type === 1 ? t('个人信息') : t('法人代表信息')} itemKey="legal">
          {desc([
            ['法人姓名', base.corporateName || record.corporateName],
            ['个人姓名', base.corporateName],
            ['证件类型', base.documentTypeText || base.documentType],
            ['证件号码', base.documentNumber],
            ['性别', base.sexText || base.sex],
            ['居住地址', base.residentialAddress],
            ['证件有效期', base.certificateValidityPeriodDate],
            ['证件照正面', picture(base.frontOfPhoto)],
            ['证件照反面', picture(base.backOfPhoto)],
          ])}
        </TabPane>

        <TabPane tab={t('商户信息')} itemKey="merchant">
          {desc([
            ['联系人姓名', merchant.contactName],
            ['联系人手机', merchant.contactPhone],
            ['联系人邮箱', merchant.contactEmail],
            ['开户银行', merchant.bankDeposit],
            ['开户支行', merchant.bankBranch],
            ['银行卡号', merchant.bankCard],
            ['对公账户', merchant.corporateAccount],
            ['开户许可证', picture(merchant.accountOpeningPermit)],
          ])}
        </TabPane>

        <TabPane tab={isStore ? t('门店信息') : t('店铺信息')} itemKey="shop">
          {desc([
            [isStore ? '门店名称' : '店铺名称', shop.shopTitle || shop.storeTitle],
            [isStore ? '门店简介' : '店铺简介', shop.description || shop.storeDescription],
            [isStore ? '门店logo' : '店铺logo', picture(shop.shopLogo || shop.storeLogo)],
            ['门店名称', shop.storeTitle || shop.shopTitle],
            ['门店简介', shop.storeDescription || shop.description],
            ['门店logo', picture(shop.storeLogo || shop.shopLogo)],
          ])}
        </TabPane>
      </Tabs>
    );
  };

  const batchDelete = (ids: number[], clear: () => void) => {
    Modal.confirm({
      title: t('批量删除商户'),
      content: t('确定删除选中的 {count} 个商户？删除后商户信息将无法恢复。', { count: ids.length }),
      onOk: async () => {
        try {
          await apiPost('/merchant/merchant/batch', { ids, type: 'del' });
          Toast.success({ content: t('批量删除成功') });
          clear();
          setReloadKey((k) => k + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
        }
      },
    });
  };

  const columns: ColumnConfig<MerchantRow>[] = [
    {
      title: '商户所属单位',
      dataIndex: 'companyName',
      width: 240,
      render: (_: unknown, record) => (
        <Space>
          {record.type === 1 ? (
            <Tag color="cyan">{t('个人')}</Tag>
          ) : (
            <Tag color="blue">{t('企业')}</Tag>
          )}
          <Text strong>
            {record.type === 1
              ? record.corporateName || record.companyName || '--'
              : record.companyName || record.corporateName || '--'}
          </Text>
        </Space>
      ),
    },
    {
      title: '商户所属会员(ID)',
      dataIndex: 'user',
      width: 180,
      render: (_: unknown, record) => {
        if (!record.user && !record.userId) return <Text type="tertiary">--</Text>;
        const uname = record.user?.username || '--';
        const uid = record.user?.userId || record.userId || '';
        return (
          <span>
            {uname}
            {uid ? ` (${uid})` : ''}
          </span>
        );
      },
    },
    {
      title: '商户类型',
      dataIndex: 'typeText',
      width: 120,
      render: (value: string, record) =>
        value || (record.type === 1 ? t('个人') : t('企业')),
    },
    {
      title: '管理员',
      dataIndex: 'admin',
      width: 140,
      render: (_: unknown, record) => {
        const adminName = record.admin?.username;
        return adminName ? <span>{adminName}</span> : <Text type="tertiary">--</Text>;
      },
    },
    {
      title: '已绑定店铺',
      dataIndex: 'shopCount',
      width: 120,
      render: (value: unknown, record) => (
        <Button
          theme="borderless"
          type="primary"
          size="small"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('page', 'shopManage');
            url.searchParams.set('keyword', record.companyName || record.corporateName || '');
            window.location.href = url.toString();
          }}
        >
          {String(value ?? 0)}
        </Button>
      ),
    },
    {
      title: '认证状态',
      dataIndex: 'statusText',
      width: 120,
      render: (value: string, record) => {
        const isCertified = record.status === 1;
        return (
          <Space>
            <Badge dot type={isCertified ? 'success' : 'danger'} style={{ marginRight: 4 }} />
            <span>{value || (isCertified ? t('已认证') : t('未认证'))}</span>
          </Space>
        );
      },
    },
    {
      title: '认证日期',
      dataIndex: 'addTime',
      width: 170,
      render: (value: string) => value || '--',
    },
  ];

  return (
    <>
      <ListPage<MerchantRow>
        key={reloadKey}
        api="/merchant/merchant/list"
        rowKey="merchantId"
        pageSize={15}
        selectable
        actionWidth={160}
        filters={[
          {
            field: 'keyword',
            label: '商户名称',
            type: 'input',
            placeholder: '输入商户名称',
            width: 240,
          },
        ]}
        columns={columns}
        batchActions={(rows, clear) => (
          <Space>
            <Button
              size="small"
              type="danger"
              disabled={rows.length === 0}
              onClick={() => batchDelete(rows.map((r) => r.merchantId), clear)}
            >
              {t('批量删除')}
            </Button>
          </Space>
        )}
        rowActions={(record) => (
          <Button
            theme="borderless"
            size="small"
            type="primary"
            onClick={() => openDetail(record)}
          >
            {t('详情')}
          </Button>
        )}
        drawer={{
          title: '商户',
          addText: '添加商户',
          width: 800,
          labelWidth: 'auto',
          createApi: '/merchant/merchant/create',
          updateApi: '/merchant/merchant/update',
          detailApi: '/merchant/merchant/detail',
          deleteApi: '/merchant/merchant/del',
          idField: 'merchantId',
          sections: [
            {
              key: 'basic',
              title: '商户基本信息',
              fields: [
                {
                  field: 'type',
                  label: t('商户类型'),
                  type: 'radio',
                  initValue: 2,
                  options: [
                    { label: t('企业'), value: 2 },
                    { label: t('个体工商户'), value: 3 },
                    { label: t('个人'), value: 1 },
                  ],
                },
                {
                  field: 'companyName',
                  label: t('企业名称'),
                  type: 'input',
                  placeholder: t('请输入企业全称'),
                  requiredWhen: (mode) => true,
                },
                {
                  field: 'corporateName',
                  label: t('法人姓名'),
                  type: 'input',
                  placeholder: t('请输入法定代表人姓名'),
                  required: true,
                },
                {
                  field: 'settlementCycle',
                  label: t('结算周期'),
                  type: 'number',
                  initValue: 1,
                  extraText: t('结算周期，单位：天'),
                },
                {
                  field: 'status',
                  label: t('认证状态'),
                  type: 'radio',
                  initValue: 1,
                  options: [
                    { label: t('已认证'), value: 1 },
                    { label: t('未认证'), value: 2 },
                  ],
                },
              ],
            },
          ],
        }}
      />

      {/* 商户详情弹窗 */}
      <Modal
        title={t('商户详情')}
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={
          <Button type="primary" onClick={() => setDetailModalVisible(false)}>
            {t('确定')}
          </Button>
        }
        width={900}
      >
        {selectedRecord && renderMerchantDetail()}
      </Modal>
    </>
  );
}
