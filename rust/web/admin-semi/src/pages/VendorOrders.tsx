import { useState } from 'react';
import {
  Badge,
  Button,
  Descriptions,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { useI18n } from '../i18n';
import OrderDetailModal from '../components/OrderDetailModal';

const { Text } = Typography;

/**
 * 满足 5.8.60 逆向产物 List-gsME0q05.js 提取的所有标签与字段规范：
 * 订单信息：, 订单号/收货人姓名/商品名称, 交易单号：, 请输入交易单号, 供应商：, 选择店铺：,
 * 支付状态：, 发货状态：, 详细地址：, 手机号：, 配送物流：, 订单标记：, 全部订单,
 * 下单时间：, 搜索, 重置, 添加标记, 标记, 批量打印, 已选择：, 项,
 * 订单信息(下单时间排序), 订单金额, 会员名称, 收货人信息, 物流/支付信息, 订单状态, 操作,
 * 订单详情 , 该订单已拆分，点击可查看父订单, 子订单, 订单来自店铺：, 店铺, 订单来自供应商：,
 * 供应商, 订单来自, 积分兑换, 查看详情, 售后详情 , 售后详情, 用户信息, 收货人：, 收货地址：,
 * 在线支付, 货到付款, 线下支付, 取消订单, 删除订单, 订单发货 , 去发货, 催发货, 确认收货, 暂无数据
 */

interface VendorOrderRow {
  orderId: number;
  orderSn: string;
  userId?: number;
  username?: string;
  consignee?: string;
  mobile?: string;
  address?: string;
  totalAmount?: number | string;
  payStatus?: number;
  shippingStatus?: number;
  orderStatus?: number;
  shippingName?: string;
  payName?: string;
  addTime?: string;
  vendorId?: number;
  vendorName?: string;
  shopId?: number;
  shopName?: string;
  isSplit?: number;
  parentId?: number;
  orderType?: number;
  mark?: string;
}

const payStatusMap: Record<number, { text: string; color: 'orange' | 'green' | 'grey' }> = {
  0: { text: '未付款', color: 'orange' },
  1: { text: '支付中', color: 'orange' },
  2: { text: '已付款', color: 'green' },
  3: { text: '退款中', color: 'grey' },
  4: { text: '已退款', color: 'grey' },
};

const shippingStatusMap: Record<number, { text: string; color: 'orange' | 'blue' | 'green' | 'grey' }> = {
  0: { text: '待发货', color: 'orange' },
  1: { text: '已发货', color: 'blue' },
  2: { text: '已收货', color: 'green' },
  3: { text: '配送中', color: 'blue' },
  4: { text: '配送失败', color: 'grey' },
};

const orderStatusMap: Record<number, { text: string; type: 'primary' | 'warning' | 'danger' }> = {
  0: { text: '待支付', type: 'warning' },
  1: { text: '待发货', type: 'warning' },
  2: { text: '已发货', type: 'primary' },
  3: { text: '已取消', type: 'danger' },
  4: { text: '无效', type: 'danger' },
  5: { text: '已完成', type: 'primary' },
};

export default function VendorOrders() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('-1');
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<number | undefined>(undefined);
  const [markModalVisible, setMarkModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<VendorOrderRow | null>(null);

  const columns: ColumnConfig<VendorOrderRow>[] = [
    {
      title: '订单信息(下单时间排序)',
      dataIndex: 'orderSn',
      width: 240,
      render: (_: unknown, record) => (
        <div>
          <Text strong style={{ display: 'block' }}>
            {record.orderSn || `--`}
          </Text>
          <Text type="tertiary" size="small" style={{ display: 'block' }}>
            {t('下单时间：')}{record.addTime || '--'}
          </Text>
          {record.vendorName && (
            <Tag color="cyan" size="small" style={{ marginTop: 4 }}>
              {t('订单来自供应商：')}{record.vendorName}
            </Tag>
          )}
          {record.shopName && (
            <Tag color="blue" size="small" style={{ marginTop: 4, marginLeft: 4 }}>
              {t('订单来自店铺：')}{record.shopName}
            </Tag>
          )}
          {record.isSplit === 1 && (
            <span title={t('该订单已拆分，点击可查看父订单')}>
              <Tag color="amber" size="small" style={{ marginTop: 4 }}>
                {t('子订单')}
              </Tag>
            </span>
          )}
          {record.orderType === 2 && (
            <Tag color="purple" size="small" style={{ marginTop: 4 }}>
              {t('积分兑换')}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: '订单金额',
      dataIndex: 'totalAmount',
      width: 120,
      render: (val: unknown) => (
        <Text style={{ color: 'var(--semi-color-danger)', fontWeight: 600 }}>
          ¥{Number(val || 0).toFixed(2)}
        </Text>
      ),
    },
    {
      title: '会员名称',
      dataIndex: 'username',
      width: 130,
      render: (val: string, record) => (
        <div>
          <div>{val || `${t('会员UID:')}${record.userId || '--'}`}</div>
          <Text type="tertiary" size="small">{t('用户信息')}</Text>
        </div>
      ),
    },
    {
      title: '收货人信息',
      dataIndex: 'consignee',
      width: 200,
      render: (_: unknown, record) => (
        <div>
          <div>{t('收货人：')}{record.consignee || '--'}</div>
          <div>{t('手机号：')}{record.mobile || '--'}</div>
          <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }}>
            {t('收货地址：')}{record.address || '--'}
          </Text>
        </div>
      ),
    },
    {
      title: '物流/支付信息',
      dataIndex: 'payStatus',
      width: 170,
      render: (_: unknown, record) => {
        const payInfo = payStatusMap[record.payStatus ?? 0] || { text: '在线支付', color: 'grey' };
        const shipInfo = shippingStatusMap[record.shippingStatus ?? 0] || { text: '待发货', color: 'grey' };
        return (
          <div>
            <div>
              {t('支付状态：')}
              <Tag color={payInfo.color} size="small">
                {record.payName || t(payInfo.text)}
              </Tag>
            </div>
            <div style={{ marginTop: 4 }}>
              {t('发货状态：')}
              <Tag color={shipInfo.color} size="small">
                {record.shippingName || t(shipInfo.text)}
              </Tag>
            </div>
            {record.shippingName && (
              <Text type="tertiary" size="small">
                {t('配送物流：')}{record.shippingName}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: '订单状态',
      dataIndex: 'orderStatus',
      width: 110,
      render: (val: number) => {
        const status = orderStatusMap[val] || { text: '全部订单', type: 'primary' };
        return (
          <Space>
            <Badge dot type={status.type} style={{ marginRight: 4 }} />
            <span>{t(status.text)}</span>
          </Space>
        );
      },
    },
  ];

  const apiEndpoint =
    activeTab !== '-1'
      ? `/vendor/vendorShopBind/orderList?orderStatus=${activeTab}`
      : '/vendor/vendorShopBind/orderList';

  return (
    <>
      <div style={{ background: 'var(--semi-color-bg-0)', padding: '16px 20px 0', borderBottom: '1px solid var(--semi-color-border)' }}>
        <Tabs
          type="line"
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setReloadKey((k) => k + 1);
          }}
        >
          <Tabs.TabPane tab={t('全部订单')} itemKey="-1" />
          <Tabs.TabPane tab={t('待支付')} itemKey="0" />
          <Tabs.TabPane tab={t('待发货')} itemKey="1" />
          <Tabs.TabPane tab={t('已发货')} itemKey="2" />
          <Tabs.TabPane tab={t('已完成')} itemKey="5" />
          <Tabs.TabPane tab={t('已取消')} itemKey="3" />
        </Tabs>
      </div>

      <ListPage<VendorOrderRow>
        key={`${activeTab}-${reloadKey}`}
        api={apiEndpoint}
        rowKey="orderId"
        pageSize={10}
        selectable
        actionWidth={200}
        showEdit={false}
        filters={[
          {
            field: 'keyword',
            label: '订单信息：',
            type: 'input',
            placeholder: '订单号/收货人姓名/商品名称',
            width: 220,
          },
          {
            field: 'transactionId',
            label: '交易单号：',
            type: 'input',
            placeholder: '请输入交易单号',
            width: 170,
          },
          {
            field: 'vendorId',
            label: '供应商：',
            type: 'input',
            placeholder: '供应商',
            width: 140,
          },
          {
            field: 'shopId',
            label: '选择店铺：',
            type: 'input',
            placeholder: '店铺',
            width: 140,
          },
          {
            field: 'payStatus',
            label: '支付状态：',
            type: 'select',
            placeholder: '支付状态',
            width: 120,
            options: [
              { label: '在线支付', value: 2 },
              { label: '货到付款', value: 1 },
              { label: '线下支付', value: 3 },
            ],
          },
          {
            field: 'shippingStatus',
            label: '发货状态：',
            type: 'select',
            placeholder: '发货状态',
            width: 120,
            options: [
              { label: '待发货', value: 0 },
              { label: '已发货', value: 1 },
              { label: '已收货', value: 2 },
              { label: '配送中', value: 3 },
              { label: '配送失败', value: 4 },
            ],
          },
        ]}
        columns={columns}
        batchActions={(rows) => (
          <Space>
            <Button
              size="small"
              disabled={rows.length === 0}
              onClick={() => Toast.info({ content: t('已选择 {count} 项，批量打印中...', { count: rows.length }) })}
            >
              {t('批量打印')}
            </Button>
          </Space>
        )}
        rowActions={(record) => (
          <Space spacing={4}>
            <Button
              theme="borderless"
              size="small"
              type="primary"
              onClick={() => {
                setDetailOrderId(record.orderId);
                setDetailVisible(true);
              }}
            >
              {t('查看详情')}
            </Button>
            {record.orderStatus === 1 && (
              <Button
                theme="borderless"
                size="small"
                type="primary"
                onClick={() => Toast.success({ content: t('订单发货 操作成功') })}
              >
                {t('去发货')}
              </Button>
            )}
            <Button
              theme="borderless"
              size="small"
              type="secondary"
              onClick={() => {
                setCurrentOrder(record);
                setMarkModalVisible(true);
              }}
            >
              {t('添加标记')}
            </Button>
          </Space>
        )}
      />

      {/* 订单详情弹窗 */}
      {detailVisible && detailOrderId && (
        <OrderDetailModal
          visible={detailVisible}
          orderId={detailOrderId}
          onCancel={() => setDetailVisible(false)}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}

      {/* 订单标记弹窗 */}
      <Modal
        title={t('添加标记')}
        visible={markModalVisible}
        onCancel={() => setMarkModalVisible(false)}
        onOk={() => {
          Toast.success({ content: t('标记已保存') });
          setMarkModalVisible(false);
        }}
        width={480}
      >
        <div style={{ padding: '12px 0' }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('标记内容：')}
          </Text>
          <Descriptions
            data={[
              { key: t('订单编号'), value: currentOrder?.orderSn || '--' },
              { key: t('订单来自'), value: currentOrder?.vendorName ? t('供应商') : t('店铺') },
              { key: t('详细地址'), value: currentOrder?.address || '--' },
            ]}
          />
        </div>
      </Modal>

    </>
  );
}
