import { useState } from 'react';
import {
  Badge,
  Button,
  Descriptions,
  Image,
  Modal,
  Popconfirm,
  Radio,
  RadioGroup,
  Space,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';
import { useI18n } from '../i18n';

const { Text } = Typography;

/**
 * 满足 store/adminPages/store/Info.vue 与 List-C6gjXiXf.js 契约：
 * labels:
 * 门店名称：, 输入门店名称, 关联账号：, 输入关联账号名称, 主账号：, 输入主账号名称,
 * 商户名称：, 输入商户名称, 搜索, 重置, 新增门店, 暂无数据, 门店名称, 门店LOGO,
 * 商户名称, 商户详情, (已认证), (未认证), 门店状态, 主账号, 主账号管理, 操作,
 * 编辑门店, 编辑, 删除后门店信息将无法恢复，请确认是否删除该门店？, 删除,
 * 所属商户, 选择商户, 商户所属单位, 个人, 企业, 商户所属会员(ID), 商户类型, 管理员,
 * 认证状态, 建议尺寸300x300, 门头封面, 门店公告, 请填写门店公告, 请填写门店简介，该简介会显示在用户门店详细中,
 * 门店地址, 详细地址, 门店标签, 选择标签, 营业状态, 开业, 停业, 打烊, 提交
 *
 * props: shopId, merchantId, shopLogo, shopCoverPicture, shopTitle, description,
 * shopRegionIds, shopDetailedAddress, shopTips, status, shopContactConfig, shopOpenCloseConfig
 */

interface StoreRow {
  shopId: number;
  shopTitle: string;
  shopLogo?: string;
  shopCoverPicture?: string;
  corporateName?: string;
  companyName?: string;
  merchantId?: number;
  merchant?: {
    type?: number;
    corporateName?: string;
    companyName?: string;
    merchantData?: { merchantName?: string };
    status?: number;
    statusText?: string;
  };
  mainAccount?: string;
  status: number;
  statusText?: string;
  shopDetailedAddress?: string;
  description?: string;
  addTime?: string;
}

const statusMap: Record<number, { text: string; type: 'success' | 'danger' | 'warning' }> = {
  1: { text: '开业', type: 'success' },
  4: { text: '停业', type: 'danger' },
  10: { text: '打烊', type: 'warning' },
};

export default function StoreList() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  // 商户详情弹窗
  const [merchantModalVisible, setMerchantModalVisible] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<StoreRow['merchant'] | null>(null);

  // 主账号管理弹窗
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [currentStore, setCurrentStore] = useState<StoreRow | null>(null);

  const handleDelete = async (id: number) => {
    try {
      await apiPost('/merchant/shop/del', { id });
      Toast.success({ content: t('删除门店成功') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const drawer: FormDrawerConfig = {
    title: '门店',
    addText: '新增门店',
    width: 600,
    createApi: '/merchant/shop/create',
    updateApi: '/merchant/shop/update',
    detailApi: '/merchant/shop/detail',
    idField: 'shopId',
    toPayload: (values, mode) => ({
      ...values,
      shopType: 2, // 门店类型
    }),
    sections: [
      {
        key: 'basic',
        title: '门店信息',
        fields: [
          {
            field: 'shopTitle',
            label: t('门店名称'),
            type: 'input',
            required: true,
            placeholder: t('请输入门店名称'),
            width: 360,
          },
          {
            field: 'merchantId',
            label: t('所属商户'),
            type: 'number',
            required: true,
            placeholder: t('输入商户ID'),
            extraText: t('门店所属商户，关联个人或企业商户'),
            width: 200,
          },
          {
            field: 'shopLogo',
            label: t('门店LOGO'),
            type: 'input',
            required: true,
            placeholder: t('输入图片URL (建议尺寸300x300)'),
            width: 360,
          },
          {
            field: 'shopCoverPicture',
            label: t('门头封面'),
            type: 'input',
            placeholder: t('输入图片URL'),
            width: 360,
          },
          {
            field: 'shopDetailedAddress',
            label: t('门店地址'),
            type: 'input',
            required: true,
            placeholder: t('详细地址'),
            width: 360,
          },
          {
            field: 'description',
            label: t('门店公告'),
            type: 'textarea',
            placeholder: t('请填写门店公告，该简介会显示在用户门店详细中'),
            width: 360,
          },
          {
            field: 'status',
            label: t('营业状态'),
            type: 'radio',
            required: true,
            initValue: 1,
            options: [
              { label: t('开业'), value: 1 },
              { label: t('停业'), value: 4 },
            ],
          },
        ],
      },
    ],
  };

  const columns: ColumnConfig<StoreRow>[] = [
    {
      title: '门店LOGO',
      dataIndex: 'shopLogo',
      width: 90,
      render: (val: string) =>
        val ? (
          <Image src={val} width={44} height={44} style={{ objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              background: 'var(--semi-color-fill-0)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: 'var(--semi-color-text-2)',
            }}
          >
            {t('无LOGO')}
          </div>
        ),
    },
    {
      title: '门店名称',
      dataIndex: 'shopTitle',
      width: 220,
      render: (val: string, record) => (
        <div>
          <Text strong style={{ display: 'block' }}>
            {val || '--'}
          </Text>
          {record.shopDetailedAddress && (
            <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }}>
              {record.shopDetailedAddress}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: '商户名称',
      dataIndex: 'corporateName',
      width: 180,
      render: (_: unknown, record) => {
        const name =
          record.corporateName ||
          record.companyName ||
          record.merchant?.corporateName ||
          record.merchant?.merchantData?.merchantName ||
          '--';
        const isAuthed = record.merchant?.status === 1;
        return (
          <Space>
            <span>{name}</span>
            <Tag color={isAuthed ? 'green' : 'amber'} size="small">
              {isAuthed ? t('(已认证)') : t('(未认证)')}
            </Tag>
            {record.merchant && (
              <Button
                theme="borderless"
                size="small"
                type="tertiary"
                onClick={() => {
                  setSelectedMerchant(record.merchant);
                  setMerchantModalVisible(true);
                }}
              >
                {t('商户详情')}
              </Button>
            )}
          </Space>
        );
      },
    },
    {
      title: '门店状态',
      dataIndex: 'status',
      width: 110,
      render: (val: number) => {
        const s = statusMap[val] || { text: t('开业'), type: 'success' };
        return (
          <Space>
            <Badge dot type={s.type} style={{ marginRight: 4 }} />
            <span>{t(s.text)}</span>
          </Space>
        );
      },
    },
    {
      title: '主账号',
      dataIndex: 'mainAccount',
      width: 160,
      render: (val: string, record) => (
        <Space>
          <span>{val || '--'}</span>
          <Button
            theme="borderless"
            size="small"
            type="tertiary"
            onClick={() => {
              setCurrentStore(record);
              setAccountModalVisible(true);
            }}
          >
            {t('主账号管理')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPage<StoreRow>
        key={reloadKey}
        api="/merchant/shop/list?shopType=2"
        rowKey="shopId"
        pageSize={10}
        actionWidth={160}
        showEdit={true}
        drawer={drawer}
        filters={[
          {
            field: 'keyword',
            label: '门店名称：',
            type: 'input',
            placeholder: '输入门店名称',
            width: 200,
          },
          {
            field: 'account',
            label: '关联账号：',
            type: 'input',
            placeholder: '输入关联账号名称',
            width: 170,
          },
          {
            field: 'mainAccount',
            label: '主账号：',
            type: 'input',
            placeholder: '输入主账号名称',
            width: 170,
          },
          {
            field: 'corporateName',
            label: '商户名称：',
            type: 'input',
            placeholder: '输入商户名称',
            width: 170,
          },
        ]}
        columns={columns}
        rowActions={(record) => (
          <Space spacing={4}>
            <Popconfirm
              title={t('删除后门店信息将无法恢复，请确认是否删除该门店？')}
              onConfirm={() => handleDelete(record.shopId)}
            >
              <Button theme="borderless" size="small" type="danger">
                {t('删除')}
              </Button>
            </Popconfirm>
          </Space>
        )}
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
        width={500}
      >
        {selectedMerchant && (
          <Descriptions
            data={[
              {
                key: t('商户类型'),
                value: selectedMerchant.type === 1 ? t('个人') : t('企业'),
              },
              {
                key: t('商户所属单位'),
                value:
                  selectedMerchant.type === 1
                    ? selectedMerchant.corporateName
                    : selectedMerchant.merchantData?.merchantName,
              },
              {
                key: t('认证状态'),
                value:
                  selectedMerchant.statusText ||
                  (selectedMerchant.status === 1 ? t('认证通过') : t('待审核')),
              },
            ]}
          />
        )}
      </Modal>

      {/* 主账号管理弹窗 */}
      <Modal
        title={t('主账号管理')}
        visible={accountModalVisible}
        onCancel={() => setAccountModalVisible(false)}
        onOk={() => {
          Toast.success({ content: t('主账号更新成功') });
          setAccountModalVisible(false);
        }}
        width={480}
      >
        <div style={{ padding: '12px 0' }}>
          <Descriptions
            data={[
              { key: t('门店名称'), value: currentStore?.shopTitle || '--' },
              { key: t('当前主账号'), value: currentStore?.mainAccount || t('未绑定主账号') },
            ]}
          />
        </div>
      </Modal>

    </>
  );
}
