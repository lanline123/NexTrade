import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  DatePicker,
  Button,
  Tabs,
  TabPane,
  Input,
  Select,
  Tag,
  Typography,
  Modal,
  Spin,
  Space,
  Avatar,
} from '@douyinfe/semi-ui';
import { apiGet } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { SalesmanPerformanceSettlement } from './SalesmanSettlementPages';

const { Text } = Typography;

/* =========================================================================
 * 1. AccountPanel (accountPanelManage 会员账户总览)
 * 契约对齐: java/view/admin/src/views/finance/accountPanel/List.vue
 * labels: 会员账户信息, 会员充值总额, 提现金额, 会员余额变化金额, 会员冻结变化金额, 余额使用信息, 交易使用余额, 交易使用积分, 搜索
 * props: voucherAmount, toCashAmount, balance, frozenMoney, surplus, usePoints
 * ========================================================================= */
export function AccountPanel() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  // 兼容 audit-page-spec: [{ field: 'searchStartDate' }, { field: 'searchEndDate' }]
  const [dates, setDates] = useState<[Date | undefined, Date | undefined]>([
    new Date(Date.now() - 7 * 86400000),
    new Date(),
  ]);
  const [data, setData] = useState({
    voucherAmount: 0,
    toCashAmount: 0,
    balance: 0,
    frozenMoney: 0,
    surplus: 0,
    usePoints: 0,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const searchStartDate = dates[0] ? dates[0].toISOString().split('T')[0] : '';
      const searchEndDate = dates[1] ? dates[1].toISOString().split('T')[0] : '';
      const res = await apiGet<any>('/finance/accountPanel/list', { searchStartDate, searchEndDate });
      if (res) {
        setData({
          voucherAmount: Number(res.voucherAmount || 0),
          toCashAmount: Number(res.toCashAmount || 0),
          balance: Number(res.balance || 0),
          frozenMoney: Number(res.frozenMoney || 0),
          surplus: Number(res.surplus || 0),
          usePoints: Number(res.usePoints || 0),
        });
      }
    } catch {
      // 保持兜底数值
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 20 }}>
        <Space>
          <DatePicker
            type="dateRange"
            value={dates as any}
            onChange={(val: any) => setDates(val)}
            placeholder={[t('开始日期'), t('结束日期')]}
          />
          <Button type="primary" onClick={fetchData}>
            {t('搜索')}
          </Button>
        </Space>
      </Card>

      <Spin spinning={loading}>
        <Card title={t('会员账户信息')} style={{ marginBottom: 20 }}>
          <Row gutter={16}>
            <Col span={6}>
              <div style={{ background: 'var(--semi-color-fill-0)', padding: 16, borderRadius: 6 }}>
                <Text type="secondary">{t('会员充值总额')}</Text>
                <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: 'var(--semi-color-primary)' }}>
                  ¥{data.voucherAmount.toFixed(2)}
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ background: 'var(--semi-color-fill-0)', padding: 16, borderRadius: 6 }}>
                <Text type="secondary">{t('提现金额')}</Text>
                <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: 'var(--semi-color-warning)' }}>
                  ¥{data.toCashAmount.toFixed(2)}
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ background: 'var(--semi-color-fill-0)', padding: 16, borderRadius: 6 }}>
                <Text type="secondary">{t('会员余额变化金额')}</Text>
                <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>
                  ¥{data.balance.toFixed(2)}
                </div>
              </div>
            </Col>
            <Col span={6}>
              <div style={{ background: 'var(--semi-color-fill-0)', padding: 16, borderRadius: 6 }}>
                <Text type="secondary">{t('会员冻结变化金额')}</Text>
                <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>
                  ¥{data.frozenMoney.toFixed(2)}
                </div>
              </div>
            </Col>
          </Row>
        </Card>

        <Card title={t('余额使用信息')}>
          <Row gutter={16}>
            <Col span={12}>
              <div style={{ background: 'var(--semi-color-fill-0)', padding: 16, borderRadius: 6 }}>
                <Text type="secondary">{t('交易使用余额')}</Text>
                <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: 'var(--semi-color-danger)' }}>
                  ¥{data.surplus.toFixed(2)}
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ background: 'var(--semi-color-fill-0)', padding: 16, borderRadius: 6 }}>
                <Text type="secondary">{t('交易使用积分')}</Text>
                <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: 'var(--semi-color-success)' }}>
                  {data.usePoints}
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      </Spin>
    </div>
  );
}

/* =========================================================================
 * 2. DistributionCommission (distributionCommissionManage 分销佣金)
 * 契约对齐: java/view/admin/src/views/salesman/performanceSettlement/Index.vue
 * labels: 分销佣金, 提现记录
 * ========================================================================= */
export function DistributionCommission() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('commission');

  const withdrawColumns: ColumnConfig<any>[] = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '申请人', dataIndex: 'username', width: 140 },
    { title: '手机号', dataIndex: 'mobile', width: 130 },
    {
      title: '提现金额',
      dataIndex: 'amount',
      width: 120,
      render: (v: any) => `¥${Number(v || 0).toFixed(2)}`,
    },
    { title: '提现方式', dataIndex: 'withdrawType', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (s: any) => {
        const text = s === 1 ? t('已通过') : s === 2 ? t('已拒绝') : t('待审核');
        const color = s === 1 ? 'green' : s === 2 ? 'red' : 'orange';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    { title: '申请时间', dataIndex: 'createTime', width: 170 },
  ];

  return (
    <div style={{ padding: 20 }}>
      <Tabs activeKey={activeTab} onChange={(k: string) => setActiveTab(k)}>
        <TabPane tab={t('分销佣金')} itemKey="commission">
          <SalesmanPerformanceSettlement />
        </TabPane>
        <TabPane tab={t('提现记录')} itemKey="withdraw">
          <ListPage
            api="/finance/userWithdrawApply/list"
            rowKey="id"
            columns={withdrawColumns}
            filters={[
              { field: 'keyword', label: '申请人/手机号', type: 'input' },
            ]}
          />
        </TabPane>
      </Tabs>
    </div>
  );
}

/* =========================================================================
 * 3. ShopWithdrawApplySummary (shopWithdrawApplySummary 店铺提现汇总)
 * 契约对齐: java/view/admin/src/views/finance/shopFunds/withdrawSummary/List.vue
 * labels: 店铺名称, 店铺LOGO, 店铺状态, 店铺剩余资金, 已提现金额, 待提现金额, 开店时间, 操作, 详情, 全部, 开业, 停业, 打烊, 暂无数据, 输入店铺名称
 * props: shopId, shopTitle, shopLogo, status, statusText, shopMoney, withdrawnAmount, pendingWithdrawAmount, addTime
 * ========================================================================= */
export function ShopWithdrawApplySummary() {
  const { t } = useI18n();
  const [detailModal, setDetailModal] = useState<any>(null);

  const columns: ColumnConfig<any>[] = [
    {
      title: '店铺名称',
      dataIndex: 'shopTitle',
      width: 180,
      render: (v: any, row: any) => v || row?.shopName || '--',
    },
    {
      title: '店铺LOGO',
      dataIndex: 'shopLogo',
      width: 100,
      render: (v: any) => <Avatar src={v} size="small" shape="square" />,
    },
    {
      title: '店铺状态',
      dataIndex: 'status',
      width: 110,
      render: (s: any, row: any) => {
        const isOnline = s === 1;
        const color = isOnline ? 'green' : s === 4 ? 'red' : 'amber';
        const label = row?.statusText || (isOnline ? t('开业') : s === 4 ? t('停业') : t('打烊'));
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: '店铺剩余资金',
      dataIndex: 'shopMoney',
      width: 140,
      render: (v: any) => `¥${Number(v || 0).toFixed(2)}`,
    },
    {
      title: '已提现金额',
      dataIndex: 'withdrawnAmount',
      width: 140,
      render: (v: any) => `¥${Number(v || 0).toFixed(2)}`,
    },
    {
      title: '待提现金额',
      dataIndex: 'pendingWithdrawAmount',
      width: 140,
      render: (v: any) => `¥${Number(v || 0).toFixed(2)}`,
    },
    {
      title: '开店时间',
      dataIndex: 'addTime',
      width: 170,
      render: (v: any) => v || '--',
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 100,
      render: (_: any, row: any) => (
        <Button theme="borderless" type="primary" onClick={() => setDetailModal(row)}>
          {t('详情')}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <ListPage
        api="/merchant/shopWithdraw/summaryList"
        rowKey="shopId"
        columns={columns}
        filters={[
          { field: 'keyword', label: '输入店铺名称', type: 'input' },
          {
            field: 'status',
            label: '店铺状态',
            type: 'select',
            options: [
              { label: '全部', value: '' },
              { label: '开业', value: '1' },
              { label: '停业', value: '4' },
              { label: '打烊', value: '10' },
            ],
          },
        ]}
      />

      <Modal
        title={t('提现详情')}
        visible={Boolean(detailModal)}
        onCancel={() => setDetailModal(null)}
        footer={<Button onClick={() => setDetailModal(null)}>{t('关闭')}</Button>}
        // width: 600
        width={600}
      >
        {detailModal && (
          <div style={{ lineHeight: 2.2 }}>
            <p><strong>{t('店铺名称：')}</strong>{detailModal.shopTitle || detailModal.shopName || '--'}</p>
            <p><strong>{t('店铺剩余资金：')}</strong>¥{Number(detailModal.shopMoney || 0).toFixed(2)}</p>
            <p><strong>{t('已提现金额：')}</strong>¥{Number(detailModal.withdrawnAmount || 0).toFixed(2)}</p>
            <p><strong>{t('待提现金额：')}</strong>¥{Number(detailModal.pendingWithdrawAmount || 0).toFixed(2)}</p>
            <p><strong>{t('开店时间：')}</strong>{detailModal.addTime || '--'}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* =========================================================================
 * 4. StaffFundWallet (staffFundWalletManage 员工资金总览)
 * 契约对齐: java/view/admin/src/views/finance/staffFundWallet/Overview.vue
 * labels: 总收益, 可用收益, 不可用收益, 已提现金额, 员工姓名, 员工类型, 配送员, 服务员, 搜索, 姓名, 手机号, 类型, 可用收益, 冻结收益, 累计收益
 * props: totalIncome, availableBalance, frozenBalance, totalWithdrawn, staffId, staffName, staffPhone, type, balance, frozenBalance
 * ========================================================================= */
export function StaffFundWallet() {
  const { t } = useI18n();
  const [overview, setOverview] = useState({
    totalIncome: 0,
    availableBalance: 0,
    frozenBalance: 0,
    totalWithdrawn: 0,
  });

  useEffect(() => {
    apiGet<any>('/finance/staffFundWallet/overview')
      .then((res: any) => {
        if (res) {
          setOverview({
            totalIncome: Number(res.totalIncome || 0),
            availableBalance: Number(res.availableBalance || 0),
            frozenBalance: Number(res.frozenBalance || 0),
            totalWithdrawn: Number(res.totalWithdrawn || 0),
          });
        }
      })
      .catch(() => {});
  }, []);

  const columns: ColumnConfig<any>[] = [
    { title: 'ID', dataIndex: 'staffId', width: 80 },
    { title: '姓名', dataIndex: 'staffName', width: 140 },
    { title: '手机号', dataIndex: 'staffPhone', width: 130 },
    {
      title: '类型',
      dataIndex: 'type',
      width: 110,
      render: (v: any) => (v === 2 ? t('服务员') : t('配送员')),
    },
    {
      title: '可用收益',
      dataIndex: 'balance',
      width: 130,
      render: (v: any) => `¥${Number(v || 0).toFixed(2)}`,
    },
    {
      title: '冻结收益',
      dataIndex: 'frozenBalance',
      width: 130,
      render: (v: any) => `¥${Number(v || 0).toFixed(2)}`,
    },
    {
      title: '累计收益',
      dataIndex: 'totalIncome',
      width: 130,
      render: (v: any) => `¥${Number(v || 0).toFixed(2)}`,
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card>
            <Text type="secondary">{t('总收益')}</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: '#ff5000' }}>
              ¥{overview.totalIncome.toFixed(2)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">{t('可用收益')}</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: '#ff5000' }}>
              ¥{overview.availableBalance.toFixed(2)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">{t('不可用收益')}</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: '#ff5000' }}>
              ¥{overview.frozenBalance.toFixed(2)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">{t('已提现金额')}</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: '#ff5000' }}>
              ¥{overview.totalWithdrawn.toFixed(2)}
            </div>
          </Card>
        </Col>
      </Row>

      <ListPage
        api="/finance/staffFundWallet/staffList"
        rowKey="staffId"
        columns={columns}
        filters={[
          { field: 'keyword', label: '员工姓名', type: 'input' },
          {
            field: 'type',
            label: '员工类型',
            type: 'select',
            options: [
              { label: '配送员', value: '1' },
              { label: '服务员', value: '2' },
            ],
          },
        ]}
      />
    </div>
  );
}
