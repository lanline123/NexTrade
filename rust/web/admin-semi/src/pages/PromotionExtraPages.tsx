import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
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
  Switch,
  Toast,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text, Title } = Typography;

/* =========================================================================
 * 1. PromotionOverview (promotion0 / promotionManage 营销概览)
 * 契约对齐: java/view/admin/src/views/promotion/manage/List.vue
 * labels: 活动名称, 活动类型, 活动时间, 状态, 操作
 * props: promotionName, typeText, timeText
 * ========================================================================= */
/** 活动类型 → 对应管理页，供「查看」跳转（旧版 List.vue toPage：type 5 满赠 → reward-gift 列表）。 */
const PROMOTION_TYPE_PAGES: Array<[string, string]> = [
  ['优惠券', 'couponManage'],
  ['限时秒杀', 'seckillManage'],
  ['秒杀', 'seckillManage'],
  ['限时折扣', 'limitdiscountManage'],
  ['满减', 'fullReductionManage'],
  ['满送', 'rewardGiftManage'],
  ['满赠', 'rewardGiftManage'],
  ['拼团', 'grouponPromotionManage'],
  ['赠品', 'productGiftManage'],
];

function promotionPageOf(row: any): string {
  const text = String(row?.typeText || row?.promotionTypeName || row?.type || '');
  return PROMOTION_TYPE_PAGES.find(([key]) => text.includes(key))?.[1] || 'promotion0';
}

function asCount(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** 旧版 activityStatusText：未开始 / 进行中 / 已过期。 */
function activityStatus(row: any): { text: string; color: string } {
  const now = Date.now();
  const start = Date.parse(String(row?.startTime || row?.startDate || ''));
  const end = Date.parse(String(row?.endTime || row?.endDate || ''));
  if (Number.isFinite(start) && start > now) return { text: '未开始', color: 'grey' };
  if (Number.isFinite(end) && end < now) return { text: '已过期', color: 'red' };
  return { text: '进行中', color: 'green' };
}

/** 「商家常用」九宫格入口（旧版 List.vue，admin 类型才显示日历签到/余额充值）。 */
const QUICK_ENTRIES: Array<{ name: string; tip: string; badge: string; page: string; adminOnly?: boolean }> = [
  { name: '优惠券', tip: '向客户发放店铺优惠券', badge: '券', page: 'couponManage' },
  { name: '限时秒杀', tip: '快速抢购引导顾客更多消费', badge: '秒', page: 'seckillManage' },
  { name: '满减', tip: '购满一定金额或件数享受优惠', badge: '减', page: 'fullReductionManage' },
  { name: '满送', tip: '购满一定金额或件数享受优惠', badge: '送', page: 'rewardGiftManage' },
  { name: '限时折扣', tip: '设置商品限时打折促销', badge: '折', page: 'limitdiscountManage' },
  { name: '日历签到', tip: '每日签到领取积分或奖励', badge: '签', page: 'signInSettingManage', adminOnly: true },
  { name: '赠品', tip: '设置赠品, 回馈客户', badge: '赠', page: 'productGiftManage' },
  { name: '余额充值', tip: '充值店铺余额', badge: '充', page: 'rechargeSettingManage', adminOnly: true },
];

/** 「活动记录」7 类型 Tab（旧版 promotionStatusList；满减后端按 [3,4] 两个 type 查）。 */
const ACTIVITY_TABS: Array<{ label: string; value: number; typeParam?: string }> = [
  { label: '全部', value: 0 },
  { label: '秒杀', value: 1, typeParam: '1' },
  { label: '优惠券', value: 2, typeParam: '2' },
  { label: '限时折扣', value: 6, typeParam: '6' },
  { label: '满减', value: 3, typeParam: '3,4' },
  { label: '满赠', value: 5, typeParam: '5' },
  { label: '拼团', value: 7, typeParam: '7' },
];

const gotoPage = (page: string) => {
  window.location.href = `${window.location.origin}/?page=${page}`;
};

export function PromotionOverview() {
  const { t } = useI18n();
  const [counts, setCounts] = useState<Record<number, number | null>>({ 1: null, 2: null, 3: null });
  const [timeType, setTimeType] = useState(1);
  const [activityType, setActivityType] = useState(0);
  const [isAdmin] = useState(() => localStorage.getItem('adminType') === 'admin');

  // 统计来自真实接口；接口不可用显示 --，不再编造 activeCount:12 之类的假数据。
  useEffect(() => {
    apiGet<Record<string, unknown>>('/promotion/promotion/getPromotionCount')
      .then((data) =>
        setCounts({
          1: asCount(data?.timeType1Count ?? data?.activeCount),
          2: asCount(data?.timeType2Count ?? data?.expiringCount),
          3: asCount(data?.timeType3Count ?? data?.notStartedCount),
        }),
      )
      .catch(() => {
        /* 保持 null，界面显示 -- */
      });
  }, []);

  const cards: Array<{ type: number; label: string; color?: string }> = [
    { type: 1, label: '进行中活动', color: 'var(--semi-color-primary)' },
    { type: 2, label: '7天内到期' },
    { type: 3, label: '未开始活动', color: 'var(--semi-color-success)' },
  ];

  const columns: ColumnConfig<any>[] = [
    {
      title: '活动名称',
      dataIndex: 'promotionName',
      width: 200,
      render: (v: any) => v || '-',
    },
    {
      title: '活动类型',
      dataIndex: 'typeText',
      width: 140,
      render: (v: any) => <Tag color="blue">{v || '-'}</Tag>,
    },
    {
      title: '活动时间',
      dataIndex: 'timeText',
      width: 220,
      render: (v: any) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_: any, row: any) => {
        const status = activityStatus(row);
        return <Tag color={status.color as any}>{t(status.text)}</Tag>;
      },
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 100,
      render: (_: any, row: any) => (
        <Button theme="borderless" type="primary" onClick={() => gotoPage(promotionPageOf(row))}>
          {t('查看')}
        </Button>
      ),
    },
  ];

  const quickEntries = QUICK_ENTRIES.filter((entry) => !entry.adminOnly || isAdmin);
  const activeTab = ACTIVITY_TABS.find((tab) => tab.value === activityType);
  const typeQuery = activeTab?.typeParam ? { type: activeTab.typeParam } : {};

  return (
    <div style={{ padding: 20 }}>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {cards.map((card) => (
          <Col span={8} key={card.type}>
            <div
              onClick={() => setTimeType(card.type)}
              style={{ cursor: 'pointer', outline: timeType === card.type ? '2px solid var(--semi-color-primary)' : 'none', borderRadius: 4 }}
            >
              <Card>
                <Text type="secondary">{t(card.label)}</Text>
                <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: card.color }}>
                  {counts[card.type] === null ? '--' : t('{count} 个', { count: counts[card.type] as number })}
                </div>
              </Card>
            </div>
          </Col>
        ))}
      </Row>

      {/* 商家常用：对齐旧版 List.vue 九宫格快捷入口 */}
      <Title heading={5} style={{ marginBottom: 12 }}>{t('商家常用')}</Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {quickEntries.map((entry) => (
          <Col span={6} key={entry.page} style={{ marginBottom: 16 }}>
            <div
              onClick={() => gotoPage(entry.page)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '16px 20px', background: 'var(--semi-color-fill-0)', borderRadius: 4 }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: 5,
                  marginRight: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#df4544',
                  color: '#fff',
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {t(entry.badge)}
              </div>
              <div>
                <div style={{ fontSize: 14 }}>{t(entry.name)}</div>
                <div style={{ color: 'var(--semi-color-text-2)', fontSize: 12, lineHeight: '16px', marginTop: 4 }}>{t(entry.tip)}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* 活动记录：7 类型 Tab，切换后由 ListPage 依赖 query 变化自动重新拉取 */}
      <Title heading={5} style={{ marginBottom: 12 }}>{t('活动记录')}</Title>
      <Tabs
        type="card"
        activeKey={String(activityType)}
        onChange={(key) => setActivityType(Number(key))}
        style={{ marginBottom: 12 }}
      >
        {ACTIVITY_TABS.map((tab) => (
          <TabPane tab={t(tab.label)} itemKey={String(tab.value)} key={tab.value} />
        ))}
      </Tabs>

      <ListPage
        api="/promotion/productPromotion/list"
        rowKey="promotionId"
        columns={columns}
        query={{ timeType, ...typeQuery }}
        filters={[{ field: 'keyword', label: '活动名称', type: 'input' }]}
      />
    </div>
  );
}

/* =========================================================================
 * 2. PromotionStyle (promotion2 / promotionStyleManage 营销样式)
 * 契约对齐: java/view/admin/src/views/promotion/productStyle/List.vue
 * labels: 商品边框, 活动背景, 活动未开始, 活动进行中, 活动已结束, 名称, 类型, 商品数, 活动状态, 起止时间, 是否开启, 创建时间, 操作
 * props: styleId, styleName, styleTypeName, productCount, status, addTime
 * ========================================================================= */
export function PromotionStyle() {
  const { t } = useI18n();
  const columns: ColumnConfig<any>[] = [
    { title: 'ID', dataIndex: 'styleId', width: 80 },
    { title: '名称', dataIndex: 'styleName', width: 160 },
    {
      title: '类型',
      dataIndex: 'styleTypeName',
      width: 130,
      render: (v: any) => v || '--',
    },
    { title: '商品数', dataIndex: 'productCount', width: 100, render: (v: any) => v ?? 0 },
    {
      title: '活动状态',
      dataIndex: 'status',
      width: 120,
      render: (s: any) => {
        const text = s === 1 ? t('活动进行中') : s === 2 ? t('活动已结束') : t('活动未开始');
        const color = s === 1 ? 'green' : s === 2 ? 'grey' : 'orange';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    { title: '起止时间', dataIndex: 'timeRange', width: 220, render: (v: any) => v || '--' },
    {
      title: '是否开启',
      dataIndex: 'isEnabled',
      width: 100,
      render: (v: any) => <Tag color={v !== false ? 'green' : 'grey'}>{v !== false ? t('开启') : t('关闭')}</Tag>,
    },
    { title: '创建时间', dataIndex: 'addTime', width: 170 },
    // 编辑/删除由 ListPage 的 drawer（createApi / deleteApi）渲染，
    // 这里不再放无 onClick 的假按钮，避免同表格出现两个「操作」列。
  ];

  return (
    <div>
      <ListPage
        api="/promotion/productStyle/list"
        rowKey="styleId"
        columns={columns}
        filters={[
          { field: 'styleName', label: '名称', type: 'input' },
        ]}
        drawer={{
          title: '营销样式配置',
          addText: '添加样式',
          width: 600,
          createApi: '/promotion/productStyle/create',
          updateApi: '/promotion/productStyle/update',
          deleteApi: '/promotion/productStyle/del',
          sections: [
            {
              key: 'basic',
              title: '基础配置',
              fields: [
                { field: 'styleName', label: t('样式名称'), type: 'input', required: true },
                {
                  field: 'styleType',
                  label: t('样式类型'),
                  type: 'select',
                  options: [
                    { label: t('商品边框'), value: 1 },
                    { label: t('活动背景'), value: 2 },
                  ],
                },
                {
                  field: 'isEnabled',
                  label: t('是否开启'),
                  type: 'switch',
                  checkedText: t('开启'),
                  uncheckedText: t('关闭'),
                },
              ],
            },
          ],
        }}
      />
    </div>
  );
}

/* =========================================================================
 * 3. RewardGift (rewardGiftManage 满赠活动)
 * 契约对齐: java/view/admin/src/views/promotion/productActivity/rewardGift/List.vue
 * labels: 添加满赠优惠活动, 活动名称, 满额条件, 赠品名称, 起止时间, 状态, 操作
 * props: promotionName, limitAmount, giftName, startTime, endTime, status
 * ========================================================================= */
export function RewardGift() {
  const { t } = useI18n();
  const columns: ColumnConfig<any>[] = [
    { title: '活动名称', dataIndex: 'promotionName', width: 180 },
    {
      title: '满额条件',
      dataIndex: 'limitAmount',
      width: 130,
      render: (v: any) => t('满 ¥{amount}', { amount: Number(v || 0).toFixed(2) }),
    },
    { title: '赠品名称', dataIndex: 'giftName', width: 180, render: (v: any) => v || '--' },
    {
      title: '起止时间',
      dataIndex: 'timeRange',
      width: 220,
      render: (_: any, row: any) => `${row.startTime || '--'} ~ ${row.endTime || '--'}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: any) => <Tag color={s === 1 ? 'green' : 'grey'}>{s === 1 ? t('进行中') : t('未开启')}</Tag>,
    },
    // 编辑/删除由 ListPage 的 drawer（createApi / deleteApi）渲染，
    // 这里不再放无 onClick 的假按钮，避免同表格出现两个「操作」列。
  ];

  return (
    <div>
      <ListPage
        api="/promotion/productPromotion/list"
        query={{ promotionType: 3 }}
        rowKey="promotionId"
        columns={columns}
        filters={[
          { field: 'promotionName', label: '活动名称', type: 'input' },
        ]}
        drawer={{
          title: '添加满赠优惠活动',
          addText: '添加满赠优惠活动',
          width: 600,
          createApi: '/promotion/productPromotion/create',
          updateApi: '/promotion/productPromotion/update',
          deleteApi: '/promotion/productPromotion/del',
          sections: [
            {
              key: 'basic',
              title: '基础配置',
              fields: [
                { field: 'promotionName', label: t('活动名称'), type: 'input', required: true },
                { field: 'limitAmount', label: t('满额条件(元)'), type: 'input', required: true },
                { field: 'giftName', label: t('赠品名称'), type: 'input', required: true },
              ],
            },
          ],
        }}
      />
    </div>
  );
}

/* =========================================================================
 * 4. SignInSetting (signInSettingManage 积分签到)
 * 契约对齐: java/view/admin/src/views/promotion/signInSetting/List.vue
 * labels: 名称, 赠送积分, 排序, 操作
 * props: name, points, sortOrder
 * ========================================================================= */
export function SignInSetting() {
  const { t } = useI18n();
  const columns: ColumnConfig<any>[] = [
    { title: '名称', dataIndex: 'name', width: 160 },
    {
      title: '赠送积分',
      dataIndex: 'points',
      width: 130,
      render: (v: any) => <Tag color="orange">{t('+{points} 积分', { points: v || 10 })}</Tag>,
    },
    { title: '排序', dataIndex: 'sortOrder', width: 100, render: (v: any) => v ?? 50 },
    // 编辑/删除由 ListPage 的 drawer（createApi / deleteApi）渲染，
    // 这里不再放无 onClick 的假按钮，避免同表格出现两个「操作」列。
  ];

  return (
    <div>
      <ListPage
        api="/promotion/signInSetting/list"
        rowKey="id"
        columns={columns}
        filters={[
          { field: 'name', label: '名称', type: 'input' },
        ]}
        drawer={{
          title: '签到规则配置',
          addText: '添加签到奖励',
          width: 600,
          createApi: '/promotion/signInSetting/create',
          updateApi: '/promotion/signInSetting/update',
          deleteApi: '/promotion/signInSetting/del',
          sections: [
            {
              key: 'basic',
              title: '规则配置',
              fields: [
                { field: 'name', label: t('规则名称'), type: 'input', required: true },
                { field: 'points', label: t('赠送积分'), type: 'input', required: true },
                { field: 'sortOrder', label: t('排序'), type: 'input' },
              ],
            },
          ],
        }}
      />
    </div>
  );
}

/* =========================================================================
 * 5. ECard (eCardManage 电子卡券)
 * 契约对齐: java/view/admin/src/views/promotion/eCard/List.vue
 * labels: 分组ID, 分组名称, 是否使用, 备注, 创建时间, 修改时间, 操作
 * props: groupId, groupName, isUse, remark, addTime, upTime
 * ========================================================================= */
export function ECard() {
  const { t } = useI18n();
  const columns: ColumnConfig<any>[] = [
    { title: '分组ID', dataIndex: 'groupId', width: 90 },
    { title: '分组名称', dataIndex: 'groupName', width: 180 },
    {
      title: '是否使用',
      dataIndex: 'isUse',
      width: 110,
      render: (v: any) => <Tag color={v ? 'green' : 'grey'}>{v ? t('已使用') : t('未使用')}</Tag>,
    },
    { title: '备注', dataIndex: 'remark', width: 200, render: (v: any) => v || '--' },
    { title: '创建时间', dataIndex: 'addTime', width: 170 },
    { title: '修改时间', dataIndex: 'upTime', width: 170 },
    // 编辑/删除由 ListPage 的 drawer（createApi / deleteApi）渲染，
    // 这里不再放无 onClick 的假按钮，避免同表格出现两个「操作」列。
  ];

  return (
    <div>
      <ListPage
        api="/product/eCardGroup/cardList"
        rowKey="groupId"
        columns={columns}
        filters={[
          { field: 'groupName', label: '分组名称', type: 'input' },
        ]}
        drawer={{
          title: '电子卡券分组',
          addText: '添加卡券分组',
          width: 600,
          createApi: '/product/eCardGroup/create',
          updateApi: '/product/eCardGroup/update',
          deleteApi: '/product/eCardGroup/del',
          sections: [
            {
              key: 'basic',
              title: '基础配置',
              fields: [
                { field: 'groupName', label: t('分组名称'), type: 'input', required: true },
                { field: 'remark', label: t('备注'), type: 'textarea' },
              ],
            },
          ],
        }}
      />
    </div>
  );
}

/* GiftCard 已迁移至独立页面 pages/GiftCards.tsx（储值卡/兑换卡分流 + 卡列表 +
 * 绑定商品，对齐旧版 promotion/giftCard 的 List/Info），此处不再保留简化版。 */

/* Lottery 已迁移至独立页面 pages/Lottery.tsx（三步表单 + 九宫格 + 用户管理，
 * 对齐旧版 promotion/lottery 的 Info/List/UserManage），此处不再保留简化版。 */
