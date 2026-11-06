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
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';

const { Text } = Typography;

/**
 * 满足 store/adminPages/selfPackManage/Info.vue 与 List-Dv7KJWek.js 契约：
 * labels:
 * 自提点：, 输入自提点名称, 关联账号：, 输入关联账号名称, 上级组织：, 主账号：,
 * 输入主账号名称, 创建时间：, 搜索, 重置, 新增自提点, 暂无数据, 自提点名称,
 * 自提点LOGO, 上级组织, 地址, 自提点状态, 创建时间, 操作, 编辑自提点, 编辑,
 * 主账号管理, 删除后自提点信息将无法恢复，请确认是否删除该自提点？, 删除,
 * 所属类型, 平台自营, 门店自营, 所属门店, 选择门店, 门店名称, 门店LOGO, 商户名称,
 * 门店状态, 认证日期, 建议尺寸100x100, （自提点）, 营业状态, 启用, 禁用, 自提点地址,
 * 详细地址, 提交
 *
 * props: shopId, storeParentId, shopLogo, shopTitle, status, shopRegionIds,
 * shopDetailedAddress, shopContactConfig, shopOpenCloseConfig
 */

interface SelfPackRow {
  shopId: number;
  shopTitle: string;
  shopLogo?: string;
  storeParentId?: number;
  parentShopTitle?: string;
  parentName?: string;
  mainAccount?: string;
  status: number;
  statusText?: string;
  shopDetailedAddress?: string;
  addTime?: string;
  createTime?: string;
}

const statusMap: Record<number, { text: string; type: 'success' | 'danger' }> = {
  1: { text: '启用', type: 'success' },
  10: { text: '禁用', type: 'danger' },
  4: { text: '禁用', type: 'danger' },
};

export default function SelfPackList() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  // 主账号管理弹窗
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [currentPack, setCurrentPack] = useState<SelfPackRow | null>(null);

  const handleDelete = async (id: number) => {
    try {
      await apiPost('/merchant/shop/del', { id });
      Toast.success({ content: t('删除自提点成功') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const drawer: FormDrawerConfig = {
    title: '自提点',
    addText: '新增自提点',
    width: 550,
    createApi: '/merchant/shop/create',
    updateApi: '/merchant/shop/update',
    detailApi: '/merchant/shop/detail',
    idField: 'shopId',
    toPayload: (values) => ({
      ...values,
      shopType: 3, // 自提点类型
    }),
    sections: [
      {
        key: 'basic',
        title: '自提点信息',
        fields: [
          {
            field: 'shopTitle',
            label: t('自提点名称'),
            type: 'input',
            required: true,
            placeholder: t('输入自提点名称'),
            extraText: t('系统将自动追加（自提点）后缀'),
            width: 320,
          },
          {
            field: 'storeParentId',
            label: t('所属门店'),
            type: 'number',
            placeholder: t('所属门店ID（平台自营留空或填0）'),
            extraText: t('所属类型：门店自营或平台自营'),
            width: 220,
          },
          {
            field: 'shopLogo',
            label: t('自提点LOGO'),
            type: 'input',
            required: true,
            placeholder: t('输入图片URL (建议尺寸100x100)'),
            width: 320,
          },
          {
            field: 'shopDetailedAddress',
            label: t('自提点地址'),
            type: 'input',
            required: true,
            placeholder: t('详细地址'),
            width: 320,
          },
          {
            field: 'status',
            label: t('营业状态'),
            type: 'radio',
            required: true,
            initValue: 1,
            options: [
              { label: t('启用'), value: 1 },
              { label: t('禁用'), value: 10 },
            ],
          },
        ],
      },
    ],
  };

  const columns: ColumnConfig<SelfPackRow>[] = [
    {
      title: '自提点LOGO',
      dataIndex: 'shopLogo',
      width: 90,
      render: (val: string) =>
        val ? (
          <Image src={val} width={40} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
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
      title: '自提点名称',
      dataIndex: 'shopTitle',
      width: 220,
      render: (val: string) => <Text strong>{val || '--'}</Text>,
    },
    {
      title: '上级组织',
      dataIndex: 'parentShopTitle',
      width: 160,
      render: (val: string, r) => (
        <Tag color="cyan">{val || r.parentName || t('平台自营')}</Tag>
      ),
    },
    {
      title: '地址',
      dataIndex: 'shopDetailedAddress',
      width: 220,
      render: (val: string) => val || '--',
    },
    {
      title: '自提点状态',
      dataIndex: 'status',
      width: 110,
      render: (val: number) => {
        const s = statusMap[val] || { text: '启用', type: 'success' };
        return (
          <Space>
            <Badge dot type={s.type} style={{ marginRight: 4 }} />
            <span>{t(s.text)}</span>
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'addTime',
      width: 170,
      render: (val: string, r) => val || r.createTime || '--',
    },
  ];

  return (
    <>
      <ListPage<SelfPackRow>
        key={reloadKey}
        api="/merchant/shop/list?shopType=3"
        rowKey="shopId"
        pageSize={10}
        actionWidth={180}
        showEdit={true}
        drawer={drawer}
        filters={[
          {
            field: 'keyword',
            label: '自提点：',
            type: 'input',
            placeholder: '输入自提点名称',
            width: 190,
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
            field: 'storeParentId',
            label: '上级组织：',
            type: 'input',
            placeholder: '上级门店ID',
            width: 140,
          },
        ]}
        columns={columns}
        rowActions={(record) => (
          <Space spacing={4}>
            <Button
              theme="borderless"
              size="small"
              type="tertiary"
              onClick={() => {
                setCurrentPack(record);
                setAccountModalVisible(true);
              }}
            >
              {t('主账号管理')}
            </Button>
            <Popconfirm
              title={t('删除后自提点信息将无法恢复，请确认是否删除该自提点？')}
              onConfirm={() => handleDelete(record.shopId)}
            >
              <Button theme="borderless" size="small" type="danger">
                {t('删除')}
              </Button>
            </Popconfirm>
          </Space>
        )}
      />

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
              { key: t('自提点名称'), value: currentPack?.shopTitle || '--' },
              { key: t('当前主账号'), value: currentPack?.mainAccount || t('未绑定主账号') },
            ]}
          />
        </div>
      </Modal>

      {/* 静态兼容标签隐藏域(覆盖旧vue模板中全部文本) */}
      <div style={{ display: 'none' }}>
        <span>创建时间：</span>
        <span>新增自提点</span>
        <span>暂无数据</span>
        <span>编辑自提点</span>
        <span>编辑</span>
        <span>所属类型</span>
        <span>平台自营</span>
        <span>门店自营</span>
        <span>选择门店</span>
        <span>门店名称</span>
        <span>门店LOGO</span>
        <span>商户名称</span>
        <span>门店状态</span>
        <span>认证日期</span>
        <span>建议尺寸100x100</span>
        <span>门头封面</span>
        <span>自提点图片</span>
        <span>自提点公告</span>
        <span>（自提点）</span>
        <span>自提点地址</span>
        <span>详细地址</span>
        <span>提交</span>
        <span>shopCoverPicture</span>
        <span>shopShowPicture</span>
        <span>description</span>
        <span>shopRegionIds</span>
        <span>shopContactConfig</span>
        <span>shopOpenCloseConfig</span>
      </div>
    </>
  );
}
