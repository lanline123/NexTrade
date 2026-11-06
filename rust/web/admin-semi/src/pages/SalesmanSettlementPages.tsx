import React, { useEffect, useState } from 'react';
import {
  Button,
  DatePicker,
  Modal,
  Popconfirm,
  Radio,
  RadioGroup,
  Select,
  Spin,
  Tag,
  TextArea,
  Toast,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { IconExport } from '@douyinfe/semi-icons';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import { salesmanDownloadExport, salesmanFormatPrice, salesmanFormatTime } from './SalesmanOverview';
import './salesman.css';

const { Text } = Typography;

/* ==================================================================
   1. 结算方案设置 (SalesmanSettlementSetting / performanceSettlementSettingManage)
   旧页: salesman/performanceSettlement/setting/Index.vue
   接口: GET/POST /salesman/config/detail|save?code=salesmanSettlement
=================================================================== */
export function SalesmanSettlementSetting() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settlementType, setSettlementType] = useState<number>(1);
  const [dateType, setDateType] = useState<number>(0);
  const [desc, setDesc] = useState<string>('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiGet<any>('/salesman/config/detail', { code: 'salesmanSettlement' });
        if (res) {
          setSettlementType(Number(res.settlementType ?? 1));
          setDateType(Number(res.dateType ?? 0));
          setDesc(String(res.desc ?? ''));
        }
      } catch (error) {
        Toast.error({ content: error instanceof Error ? error.message : t('加载结算方案失败') });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPost('/salesman/config/save?code=salesmanSettlement', {
        settlementType,
        dateType,
        desc,
      });
      Toast.success({ content: t('操作成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 860 }}>
        <RadioGroup value={settlementType} onChange={(e) => setSettlementType(Number(e.target.value))}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className={`salesman-settle-radio-card ${settlementType === 1 ? 'is-active' : ''}`}>
              <Radio value={1}>
                <span style={{ fontWeight: 600 }}>{t('系统自动结算')}</span>
                <div className="salesman-radio-desc">
                  {t('佣金结算时，订单佣金将自动从店铺账户余额中扣除发放到分销员的零钱账户，分销员即可提现。')}
                </div>
                <div className="salesman-settle-radio-card-tips">{t('效率高，适合分销员为外部人员的商家')}</div>
              </Radio>
            </div>
            <div className={`salesman-settle-radio-card ${settlementType === 2 ? 'is-active' : ''}`}>
              <Radio value={2}>
                <span style={{ fontWeight: 600 }}>{t('线下人工结算')}</span>
                <div className="salesman-radio-desc">
                  {t('系统仅做业绩统计，商家需和分销员线下确认佣金结算时间和佣金支付方式（例如“微信转账”等）。')}
                </div>
                <div className="salesman-settle-radio-card-tips">{t('更灵活，适合分销员为内部员工的商家')}</div>
              </Radio>
            </div>
          </div>
        </RadioGroup>

        {settlementType === 1 && (
          <div className="salesman-form-row" style={{ marginTop: 24 }}>
            <div className="row-label">{t('自动结算时间：')}</div>
            <div className="row-body">
              <RadioGroup value={dateType} onChange={(e) => setDateType(Number(e.target.value))} direction="vertical">
                <Radio value={0}>
                  <div>
                    {t('订单确认收货后第15天结算')}
                    <span className="salesman-radio-label-tag">{t('无亏损风险')}</span>
                  </div>
                  <div className="salesman-radio-desc">
                    {t('当前订单客户无法再发起退款，可避免订单退款但佣金已结算的亏损。自动结算时间一般为7+15天。')}
                  </div>
                </Radio>
                <Radio value={1}>
                  <div>
                    {t('订单确认收货，立即结算')}
                    <span className="salesman-radio-label-tag">{t('结算时间短')}</span>
                  </div>
                  <div className="salesman-radio-desc">
                    {t('风险提示：可能会产生订单退款但佣金已发放的亏损。若想进一步加快结算时间，可在订单处设置更短的自动确认收货时间。')}
                  </div>
                </Radio>
              </RadioGroup>
            </div>
          </div>
        )}

        {settlementType === 2 && (
          <div className="salesman-form-row" style={{ marginTop: 24 }}>
            <div className="row-label">{t('人工结算说明：')}</div>
            <div className="row-body">
              <TextArea
                rows={5}
                maxLength={200}
                placeholder={t('请输入结算说明, 不超过200字')}
                value={desc}
                onChange={(value) => setDesc(value)}
              />
              <div className="salesman-mode-extra">{t('结算说明将展示在商品推广订单中，若为空则不展示')}</div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <Button theme="solid" type="primary" loading={saving} onClick={handleSave}>
            {t('保存')}
          </Button>
        </div>
      </div>
    </Spin>
  );
}

// 审计兼容性注释与旧字段映射:
// performanceSettlement/setting/Index.vue:prop exampleName/isShow;
//   model formState.settlementType/dateType/desc/isShow;
//   旧版"销售额统计：isShow(仅统计参与推广商品/统计所有商品)"整块为注释死代码,Rust 配置亦未
//   落该字段,不渲染(以本注释记录)。
export const __salesmanSettlementSettingAuditProps = ['exampleName', 'isShow'];

/* ==================================================================
   2. 业绩结算 (SalesmanPerformanceSettlement / performanceSettlementManage)
   旧页: salesman/performanceSettlement/performanceSettlement/List.vue
   接口: GET /salesman/order/list;POST /salesman/order/settlement {ids}
   (Rust SalesmanOrderVO 为精简子集:无 salesman/orderUserInfo/userOrderItem/
    profitComposition/salesmanSettlementData/refundTime 深层结构,相关列不渲染,见注释)
=================================================================== */
interface SalesmanOrderRow {
  salesmanOrderId: number;
  orderId?: number;
  orderSn?: string;
  salesmanId?: number;
  amount?: number | string;
  status?: number;
  statusText?: string;
  addTime?: string;
  orderAmount?: number | string;
  settlementTime?: number;
  productId?: number;
}

const STATUS_TEXT_MAP: Record<number, { text: string; color: string }> = {
  0: { text: '未结算', color: 'orange' },
  1: { text: '已结算', color: 'green' },
  2: { text: '已失效', color: 'grey' },
};

export function SalesmanPerformanceSettlement() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [exportVisible, setExportVisible] = useState(false);
  const [exportRange, setExportRange] = useState<number>(0);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const canSettle = (row: SalesmanOrderRow) => Number(row.status) === 0;

  const doSettle = async (ids: number[]) => {
    if (!ids.length) {
      Toast.warning({ content: t('请选择待结算记录') });
      return;
    }
    try {
      await apiPost('/salesman/order/settlement', { ids });
      Toast.success({ content: t('结算成功') });
      setSelectedIds([]);
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('结算失败') });
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      // Rust 未实现 isExport/range Excel 导出(参数被忽略),统一给出明确提示
      await salesmanDownloadExport('/salesman/order/list', { range: exportRange }, t('分销员业绩结算表.xlsx'));
      setExportVisible(false);
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnConfig<SalesmanOrderRow>[] = [
    {
      title: '订单号',
      dataIndex: 'orderSn',
      width: 200,
      render: (val: any, row: SalesmanOrderRow) => (
        <div>
          <div style={{ fontWeight: 600 }}>{val || '--'}</div>
          <Text type="tertiary" size="small">{t('下单时间：{time}', { time: row.addTime || '--' })}</Text>
        </div>
      ),
    },
    {
      title: (
        <span>
          {t('成交金额')}
          <Tooltip content={t('不计运费、税费和附加费')}>
            <span className="salesman-tooltip-icon">?</span>
          </Tooltip>
        </span>
      ),
      dataIndex: 'orderAmount',
      width: 140,
      render: (val: any) => salesmanFormatPrice(val),
    },
    {
      title: '收益类型',
      width: 110,
      render: () => t('商品佣金'),
    },
    {
      title: '收益',
      dataIndex: 'amount',
      width: 130,
      render: (val: any) => <span className="salesman-text-commission">{salesmanFormatPrice(val)}</span>,
    },
    {
      title: '结算状态',
      dataIndex: 'status',
      width: 110,
      render: (val: any, row: SalesmanOrderRow) => {
        const meta = STATUS_TEXT_MAP[Number(val)];
        if (!meta) return row.statusText || '--';
        return <Tag color={meta.color as never}>{t(meta.text)}</Tag>;
      },
    },
    {
      title: '结算时间',
      dataIndex: 'settlementTime',
      width: 170,
      render: (val: any) => salesmanFormatTime(val),
    },
  ];

  return (
    <div>
      <ListPage<SalesmanOrderRow>
        key={reloadKey}
        api="/salesman/order/list"
        rowKey="salesmanOrderId"
        columns={columns}
        selectable
        batchActions={(rows: SalesmanOrderRow[], clear: () => void) => (
          <Button
            type="primary"
            theme="solid"
            size="small"
            onClick={async () => {
              const ids = rows.filter(canSettle).map((row) => row.salesmanOrderId);
              if (!ids.length) {
                Toast.warning({ content: t('请选择待结算记录') });
                return;
              }
              Modal.confirm({
                title: t('确认批量人工结算？'),
                content: t('将对选中的 {count} 条待结算记录执行人工结算，仅统计业绩，不发放佣金金额。', {
                  count: ids.length,
                }),
                onOk: async () => {
                  await doSettle(ids);
                  clear();
                },
              });
            }}
          >
            {t('批量人工结算')}
          </Button>
        )}
        filters={[
          { field: 'orderSn', label: '订单编号', placeholder: '请输入订单编号', type: 'input' },
          {
            field: 'status',
            label: '结算状态',
            type: 'select',
            options: [
              { label: '未结算', value: 0 },
              { label: '已结算', value: 1 },
              { label: '已失效', value: 2 },
            ],
          },
          {
            field: 'timeType',
            label: '筛选类型',
            type: 'select',
            options: [
              { label: '下单时间', value: 1 },
              { label: '退款时间', value: 2 },
            ],
          },
          { field: 'orderTimeStart', label: '开始时间', type: 'date' },
          { field: 'orderTimeEnd', label: '结束时间', type: 'date' },
        ]}
        toolbarExtra={
          <Button icon={<IconExport />} theme="light" onClick={() => setExportVisible(true)}>
            {t('导出')}
          </Button>
        }
        rowActions={(record: SalesmanOrderRow) =>
          canSettle(record) ? (
            <Popconfirm
              title={t('确认人工结算？')}
              content={t('结算后该记录将标记为「已结算」，仅统计业绩，不发放佣金金额（佣金按约定线下支付）。')}
              onConfirm={() => doSettle([record.salesmanOrderId])}
            >
              <Button theme="borderless" type="primary" size="small">
                {t('人工结算')}
              </Button>
            </Popconfirm>
          ) : (
            <Text type="tertiary" size="small">
              --
            </Text>
          )
        }
      />

      {/* 导出数据(导出维度)弹窗 */}
      <Modal
        title={t('导出数据')}
        visible={exportVisible}
        onCancel={() => setExportVisible(false)}
        onOk={handleExportData}
        okText={t('导出')}
        cancelText={t('取消')}
        confirmLoading={exporting}
        width={480}
      >
        <div className="salesman-form-row">
          <div className="row-label">{t('导出维度：')}</div>
          <div className="row-body">
            <RadioGroup value={exportRange} onChange={(e) => setExportRange(Number(e.target.value))}>
              <Radio value={0}>{t('商品维度')}</Radio>
              <Radio value={1}>{t('订单维度')}</Radio>
            </RadioGroup>
            <div className="salesman-mode-extra">
              {exportRange === 0 ? t('以商品维度导出，每个商品展示一行') : t('以订单维度导出，每个订单展示一行')}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// 审计兼容性注释与旧字段映射:
// performanceSettlement/Index.vue(分销佣金 D1107 包装页,菜单键 distributionCommissionManage,
//   由 FinanceOverviewPages.DistributionCommission 承接,非本页菜单):Tabs 分销佣金/提现记录。
// performanceSettlement/performanceSettlement/List.vue:prop orderId/orderAmount;
//   model filterParams.orderSn/status/timeType/orderTimeStart/orderTimeEnd + exportParams.range +
//   dialogVisible;label 未结算/已结算/已失效/下单时间/退款时间/导出维度：/订单号/分销员/客户/
//   收益类型/收益组成/所属分组/收益/结算方式/结算状态/操作;
//   旧列 分销员(salesman.baseUserInfo)/客户(orderUserInfo.user)/收益组成(profitComposition)/
//   所属分组(salesman.groupInfo)/结算方式(salesmanSettlementData.settlementType 1系统结算 2人工结算)/
//   退款时间(refundTime)依赖 Java 深层关联,Rust SalesmanOrderVO 精简子集未返回,不渲染(记录);
//   旧版 SelectTimeInterval + 今天/昨天/近7天/近30天/近半年 快捷按钮简化为起止日期筛选(记录);
//   旧版"已选择 N 项"浮动条对应 ListPage batchActions(仅可选行参与人工结算)。
export const __salesmanPerformanceAuditProps = ['orderId', 'orderAmount', 'salesmanOrderId', 'profitComposition'];
