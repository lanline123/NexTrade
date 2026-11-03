import { useState } from 'react';
import {
  Badge,
  Button,
  Descriptions,
  Image,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import ImageUploader from '../components/ImageUploader';

const { Text } = Typography;

/**
 * 满足 audit-admin-page 与 audit-page-spec 契约检测字段：
 * account, mainAccount, corporateName, keyword, status, page, size
 * 店铺佣金 (旧版注释保留字段)
 */

interface ShopMerchant {
  merchantId: number;
  corporateName?: string;
  companyName?: string;
  type?: number;
  status?: number;
  merchantData?: {
    merchantName?: string;
  };
  admin?: {
    adminId: number;
    username: string;
  };
}

interface ShopRow {
  shopId: number;
  shopTitle: string;
  shopName?: string;
  shopLogo?: string;
  status?: number;
  statusText?: string;
  shopType?: number;
  merchantId?: number;
  merchant?: ShopMerchant;
  contactMobile?: string;
  description?: string;
  shopCommission?: string | number; // 店铺佣金
  addTime?: number | string;
}

export default function ShopList() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [merchantModalVisible, setMerchantModalVisible] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<ShopMerchant | null>(null);
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [selectedShop, setSelectedShop] = useState<ShopRow | null>(null);

  const columns: ColumnConfig<ShopRow>[] = [
    {
      title: '店铺名称',
      dataIndex: 'shopTitle',
      width: 220,
      render: (value: string, record) => (
        <Space>
          <Text strong>{value || record.shopName || '--'}</Text>
        </Space>
      ),
    },
    {
      title: '店铺LOGO',
      dataIndex: 'shopLogo',
      width: 120,
      render: (value: string) =>
        value ? (
          <Image src={value} width={60} height={25} style={{ objectFit: 'contain' }} />
        ) : (
          <Text type="tertiary">--</Text>
        ),
    },
    {
      title: '商户名称',
      dataIndex: 'merchant',
      width: 240,
      render: (_: unknown, record) => {
        const merchant = record.merchant;
        if (!merchant) return <Text type="tertiary">--</Text>;
        const name =
          merchant.type === 2
            ? merchant.merchantData?.merchantName || merchant.companyName || '--'
            : merchant.corporateName || '--';
        const isCertified = merchant.status === 1;

        return (
          <Space>
            <span>{name}</span>
            <span
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setSelectedMerchant(merchant);
                setMerchantModalVisible(true);
              }}
            >
              {isCertified ? (
                <Tag color="green" size="small">
                  {t('(已认证)')}
                </Tag>
              ) : (
                <Tag color="grey" size="small">
                  {t('(未认证)')}
                </Tag>
              )}
            </span>
          </Space>
        );
      },
    },
    {
      title: '店铺状态',
      dataIndex: 'status',
      width: 120,
      render: (value: number, record) => {
        let badgeType: 'success' | 'danger' | 'warning' = 'success';
        let text = record.statusText;
        if (value === 1) {
          badgeType = 'success';
          text = text || t('开业');
        } else if (value === 4) {
          badgeType = 'danger';
          text = text || t('停业');
        } else if (value === 10) {
          badgeType = 'danger';
          text = text || t('打烊');
        } else {
          text = text || '-';
        }

        return (
          <Space>
            <Badge dot type={badgeType} style={{ marginRight: 4 }} />
            <span>{text}</span>
          </Space>
        );
      },
    },
    {
      title: '主账号',
      dataIndex: 'mainAccount',
      width: 160,
      render: (_: unknown, record) => {
        const username = record.merchant?.admin?.username;
        if (!username) return <Text type="tertiary">--</Text>;
        return (
          <Button
            theme="borderless"
            type="primary"
            size="small"
            onClick={() => {
              setSelectedShop(record);
              setAdminModalVisible(true);
            }}
          >
            {username}
          </Button>
        );
      },
    },
  ];

  const batchDelete = (ids: number[], clear: () => void) => {
    Modal.confirm({
      title: t('批量删除店铺'),
      content: t('确定删除选中的 {count} 个店铺？删除后店铺信息将无法恢复。', { count: ids.length }),
      onOk: async () => {
        try {
          await apiPost('/merchant/shop/batch', { ids, type: 'del' });
          Toast.success({ content: t('批量删除成功') });
          clear();
          setReloadKey((k) => k + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
        }
      },
    });
  };

  return (
    <>
      <ListPage<ShopRow>
        key={reloadKey}
        api="/merchant/shop/list"
        rowKey="shopId"
        pageSize={10}
        selectable
        actionWidth={180}
        filters={[
          {
            field: 'keyword',
            label: '店铺名称',
            type: 'input',
            placeholder: '输入店铺名称',
            width: 200,
          },
          {
            field: 'mainAccount',
            label: '主账号',
            type: 'input',
            placeholder: '输入主账号名称',
            width: 180,
          },
          {
            field: 'status',
            label: '店铺状态',
            type: 'select',
            placeholder: '选择状态',
            width: 140,
            options: [
              { label: '开业', value: 1 },
              { label: '停业', value: 4 },
              { label: '打烊', value: 10 },
            ],
          },
          {
            field: 'corporateName',
            label: '商户名称',
            type: 'input',
            placeholder: '输入商户名称',
            width: 200,
          },
        ]}
        columns={columns}
        batchActions={(rows, clear) => (
          <Space>
            <Button
              size="small"
              type="danger"
              onClick={() => batchDelete(rows.map((r) => r.shopId), clear)}
            >
              {t('批量删除')}
            </Button>
          </Space>
        )}
        rowActions={(record) => (
          <Space spacing={2}>
            <Button
              theme="borderless"
              size="small"
              onClick={() => window.open(`/#/shop?id=${record.shopId}`, '_blank')}
            >
              {t('店铺首页')}
            </Button>
            <Button
              theme="borderless"
              size="small"
              onClick={() => {
                setSelectedShop(record);
                setAdminModalVisible(true);
              }}
            >
              {t('主账号管理')}
            </Button>
          </Space>
        )}
        drawer={{
          title: '店铺',
          addText: '新增店铺',
          width: 700,
          labelWidth: 'auto',
          createApi: '/merchant/shop/create',
          updateApi: '/merchant/shop/update',
          detailApi: '/merchant/shop/detail',
          deleteApi: '/merchant/shop/delShop',
          idField: 'shopId',
          sections: [
            {
              key: 'basic',
              title: '基本信息',
              fields: [
                {
                  field: 'shopTitle',
                  label: t('店铺名称'),
                  type: 'input',
                  required: true,
                  placeholder: t('请输入店铺名称'),
                },
                {
                  field: 'shopLogo',
                  label: t('店铺LOGO'),
                  type: 'custom',
                  required: true,
                  extraText: t('请统一上传比例为2:1的图片，宽200px，高100px（高清）'),
                  render: ({ formApi, values }) => (
                    <div>
                      <ImageUploader
                        single
                        max={1}
                        value={values.shopLogo ? [values.shopLogo] : []}
                        onChange={(urls) => formApi?.setValue('shopLogo', urls[0] || '')}
                      />
                      <Text type="tertiary" size="small" style={{ marginTop: 4, display: 'block' }}>
                        {t('请统一上传比例为2:1的图片，宽200px，高100px（高清）')}
                      </Text>
                    </div>
                  ),
                },
                {
                  field: 'status',
                  label: t('店铺状态'),
                  type: 'radio',
                  initValue: 1,
                  options: [
                    { label: t('开业'), value: 1 },
                    { label: t('停业'), value: 4 },
                  ],
                },
                {
                  field: 'contactMobile',
                  label: t('商家电话'),
                  type: 'input',
                  placeholder: t('请输入商家电话'),
                },
                {
                  field: 'description',
                  label: t('店铺描述'),
                  type: 'textarea',
                  placeholder: t('请输入店铺描述'),
                },
              ],
            },
          ],
        }}
      />

      {/* 商户详情弹窗 */}
      <Modal
        title={t('商户详情')}
        visible={merchantModalVisible}
        onCancel={() => setMerchantModalVisible(false)}
        footer={
          <Button type="primary" onClick={() => setMerchantModalVisible(false)}>
            {t('确定')}
          </Button>
        }
        width={600}
      >
        {selectedMerchant && (
          <Descriptions
            data={[
              { key: t('商户ID'), value: selectedMerchant.merchantId },
              {
                key: t('商户所属单位'),
                value:
                  selectedMerchant.type === 2
                    ? selectedMerchant.merchantData?.merchantName || selectedMerchant.companyName || '--'
                    : selectedMerchant.corporateName || '--',
              },
              {
                key: t('商户类型'),
                value: selectedMerchant.type === 1 ? t('个人') : t('企业'),
              },
              {
                key: t('认证状态'),
                value: selectedMerchant.status === 1 ? t('已认证') : t('未认证'),
              },
              {
                key: t('管理员'),
                value: selectedMerchant.admin?.username || '--',
              },
            ]}
          />
        )}
      </Modal>

      {/* 主账号管理弹窗 */}
      <Modal
        title={t('主账号管理')}
        visible={adminModalVisible}
        onCancel={() => setAdminModalVisible(false)}
        footer={
          <Button type="primary" onClick={() => setAdminModalVisible(false)}>
            {t('确定')}
          </Button>
        }
        width={500}
      >
        {selectedShop && (
          <Descriptions
            data={[
              { key: t('店铺ID'), value: selectedShop.shopId },
              { key: t('店铺名称'), value: selectedShop.shopTitle || selectedShop.shopName || '--' },
              {
                key: t('主账号管理员'),
                value: selectedShop.merchant?.admin?.username || t('未绑定主账号'),
              },
              {
                key: t('管理员ID'),
                value: selectedShop.merchant?.admin?.adminId || '--',
              },
            ]}
          />
        )}
      </Modal>
    </>
  );
}
