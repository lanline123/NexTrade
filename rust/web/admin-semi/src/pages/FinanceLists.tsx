import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

interface FinanceRow extends Record<string, any> {
  id?: number;
}

export function RefundApplyList() {
  const columns: ColumnConfig<FinanceRow>[] = [
    { title: '退款类型', dataIndex: 'refundTypeName', width: 140 },
    {
      title: '退款信息',
      dataIndex: 'aftersalesSn',
      render: (_value: string, record) =>
        record.aftersales?.aftersalesSn || record.aftersalesSn || '-',
    },
    { title: '退款状态', dataIndex: 'refundStatusName', width: 130 },
    { title: '申请时间', dataIndex: 'addTime', width: 180 },
  ];
  return (
    <ListPage<FinanceRow>
      api="/finance/refundApply/list"
      rowKey="refundId"
      pageSize={10}
      filters={[
        { field: 'keyword', label: '售后单号', type: 'input', placeholder: '输入售后单号', width: 240 },
      ]}
      columns={columns}
    />
  );
}

export function WithdrawApplyList() {
  const columns: ColumnConfig<FinanceRow>[] = [
    { title: '会员名称', dataIndex: 'username', width: 160 },
    { title: '金额', dataIndex: 'amount', width: 130 },
    { title: '手续费(元)', dataIndex: 'handlingFee', width: 130 },
    { title: '手续费率', dataIndex: 'handlingRate', width: 120 },
    { title: '提现账号类型', dataIndex: 'accountTypeText', width: 130 },
    {
      title: '到款状态',
      dataIndex: 'statusType',
      width: 130,
      render: (val: any, row: FinanceRow) => val || (Number(row.status) === 1 ? '已完成' : Number(row.status) === 2 ? '拒绝申请' : '待处理'),
    },
    { title: '操作时间', dataIndex: 'addTime', width: 180 },
  ];
  return (
    <ListPage<FinanceRow>
      api="/finance/userWithdrawApply/list"
      rowKey="id"
      pageSize={10}
      filters={[
        { field: 'keyword', label: '会员', type: 'input', placeholder: '输入会员名称', width: 220 },
      ]}
      columns={columns}
    />
  );
}

export function RechargeOrderList() {
  const columns: ColumnConfig<FinanceRow>[] = [
    { title: '会员名称', dataIndex: 'username', width: 160 },
    { title: '手机号', dataIndex: 'mobile', width: 150 },
    { title: '金额', dataIndex: 'amount', width: 130 },
    { title: '赠送金额', dataIndex: 'discountMoney', width: 130 },
    {
      title: '到款状态',
      dataIndex: 'statusType',
      width: 130,
      render: (val: any, row: FinanceRow) => val || (Number(row.status) === 1 ? '已完成' : Number(row.status) === 2 ? '拒绝申请' : '待处理'),
    },
    { title: '操作时间', dataIndex: 'addTime', width: 180 },
  ];
  return (
    <ListPage<FinanceRow>
      api="/finance/userRechargeOrder/list"
      rowKey="id"
      pageSize={10}
      filters={[
        { field: 'keyword', label: '会员', type: 'input', placeholder: '输入会员名称', width: 220 },
      ]}
      columns={columns}
    />
  );
}

export function UserInvoiceList() {
  const columns: ColumnConfig<FinanceRow>[] = [
    { title: '申请会员', dataIndex: 'username', width: 160 },
    { title: '公司名称', dataIndex: 'companyName' },
    { title: '申请日期', dataIndex: 'addTime', width: 180 },
    { title: '申请状态', dataIndex: 'statusName', width: 130 },
  ];
  return (
    <ListPage<FinanceRow>
      api="/finance/userInvoice/list"
      rowKey="id"
      pageSize={10}
      filters={[
        { field: 'keyword', label: '会员', type: 'input', placeholder: '输入会员名称', width: 220 },
      ]}
      columns={columns}
    />
  );
}

export function OrderInvoiceList() {
  const columns: ColumnConfig<FinanceRow>[] = [
    { title: '申请会员', dataIndex: 'username', width: 150 },
    { title: '公司名称/抬头', dataIndex: 'companyName' },
    {
      title: '发票类型',
      dataIndex: 'invoiceType',
      width: 130,
      render: (val: any) => (Number(val) === 2 ? '增值发票' : '普通发票'),
    },
    { title: '申请订单', dataIndex: 'orderSn', width: 180 },
    { title: '金额', dataIndex: 'amount', width: 110 },
    { title: '申请日期', dataIndex: 'addTime', width: 180 },
    {
      title: '申请状态',
      dataIndex: 'statusName',
      width: 120,
      render: (val: any, row: FinanceRow) => {
        const text = val || (Number(row.status) === 0 ? '待处理' : Number(row.status) === 1 ? '已开' : '失败/作废');
        return text;
      },
    },
  ];
  return (
    <ListPage<FinanceRow>
      api="/finance/orderInvoice/list"
      rowKey="id"
      pageSize={10}
      filters={[
        { field: 'keyword', label: '会员', type: 'input', placeholder: '输入会员名称', width: 220 },
      ]}
      columns={columns}
    />
  );
}
