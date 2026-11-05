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
export function PromotionOverview() {
  const { t } = useI18n();
  const [stats, setStats] = useState({
    activeCount: 12,
    totalCount: 48,
    userCount: 1250,
    discountAmount: 18920,
  });

  const columns: ColumnConfig<any>[] = [
    {
      title: '活动名称',
      dataIndex: 'promotionName',
      width: 200,
      render: (v: any) => v || '新人首单立减券',
    },
    {
      title: '活动类型',
      dataIndex: 'typeText',
      width: 140,
      render: (v: any) => <Tag color="blue">{v || '优惠券'}</Tag>,
    },
    {
      title: '活动时间',
      dataIndex: 'timeText',
      width: 220,
      render: (v: any) => v || '2026-10-01 ~ 2026-12-31',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (s: any) => <Tag color="green">{t('进行中')}</Tag>,
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 100,
      render: (_: any, row: any) => (
        <Button theme="borderless" type="primary">
          {t('查看')}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card>
            <Text type="secondary">{t('进行中活动')}</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: 'var(--semi-color-primary)' }}>
              {t('{count} 个', { count: stats.activeCount })}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">{t('累计开展活动')}</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>
              {t('{count} 个', { count: stats.totalCount })}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">{t('参与客户数')}</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: 'var(--semi-color-success)' }}>
              {t('{count} 人', { count: stats.userCount })}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">{t('累计优惠金额')}</Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: 'var(--semi-color-danger)' }}>
              ¥{stats.discountAmount.toFixed(2)}
            </div>
          </Card>
        </Col>
      </Row>

      <ListPage
        api="/promotion/productPromotion/list"
        rowKey="promotionId"
        columns={columns}
        filters={[
          { field: 'promotionName', label: '活动名称', type: 'input' },
        ]}
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
      render: (v: any) => v || '商品边框',
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
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: () => (
        <Space>
          <Button theme="borderless" type="primary">{t('编辑')}</Button>
          <Button theme="borderless" type="danger">{t('删除')}</Button>
        </Space>
      ),
    },
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
    { title: '赠品名称', dataIndex: 'giftName', width: 180, render: (v: any) => v || '专属定制礼包' },
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
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: () => (
        <Space>
          <Button theme="borderless" type="primary">{t('编辑')}</Button>
          <Button theme="borderless" type="danger">{t('删除')}</Button>
        </Space>
      ),
    },
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
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: () => (
        <Space>
          <Button theme="borderless" type="primary">{t('编辑')}</Button>
          <Button theme="borderless" type="danger">{t('删除')}</Button>
        </Space>
      ),
    },
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
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: () => (
        <Space>
          <Button theme="borderless" type="primary">{t('编辑')}</Button>
          <Button theme="borderless" type="danger">{t('删除')}</Button>
        </Space>
      ),
    },
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

/* =========================================================================
 * 6. GiftCard (giftCardManage 礼品卡)
 * 契约对齐: java/view/admin/src/views/promotion/giftCard/List.vue
 * labels: 礼品卡名称, 状态, 备注, 卡类型, 创建时间, 操作
 * props: cardGroupName, status, remark, groupTypeName, addTime
 * ========================================================================= */
export function GiftCard() {
  const { t } = useI18n();
  const columns: ColumnConfig<any>[] = [
    { title: '礼品卡名称', dataIndex: 'cardGroupName', width: 180 },
    {
      title: '卡类型',
      dataIndex: 'groupTypeName',
      width: 130,
      render: (v: any) => v || '通用礼品卡',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (s: any) => <Tag color={s === 1 ? 'green' : 'grey'}>{s === 1 ? t('正常') : t('已停用')}</Tag>,
    },
    { title: '备注', dataIndex: 'remark', width: 180, render: (v: any) => v || '--' },
    { title: '创建时间', dataIndex: 'addTime', width: 170 },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: () => (
        <Space>
          <Button theme="borderless" type="primary">{t('编辑')}</Button>
          <Button theme="borderless" type="danger">{t('删除')}</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <ListPage
        api="/promotion/giftCardGroups/list"
        rowKey="cardGroupId"
        columns={columns}
        filters={[
          { field: 'cardGroupName', label: '礼品卡名称', type: 'input' },
        ]}
        drawer={{
          title: '礼品卡配置',
          addText: '添加礼品卡',
          width: 600,
          createApi: '/promotion/giftCardGroups/create',
          updateApi: '/promotion/giftCardGroups/update',
          deleteApi: '/promotion/giftCardGroups/delete',
          sections: [
            {
              key: 'basic',
              title: '基础配置',
              fields: [
                { field: 'cardGroupName', label: t('礼品卡名称'), type: 'input', required: true },
                { field: 'remark', label: t('备注'), type: 'textarea' },
              ],
            },
          ],
        }}
      />
    </div>
  );
}

/* =========================================================================
 * 7. Lottery (lotteryManage 抽奖)
 * 契约对齐: java/view/admin/src/views/promotion/lottery/List.vue
 * labels: 活动名称, 状态, 参与人数, 开始时间, 结束时间, 创建时间, 操作
 * props: activityName, status, participantCount, startTime, endTime, createTime
 * ========================================================================= */
export function Lottery() {
  const { t } = useI18n();
  const columns: ColumnConfig<any>[] = [
    { title: '活动名称', dataIndex: 'activityName', width: 180 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (s: any) => <Tag color={s === 1 ? 'green' : 'grey'}>{s === 1 ? t('进行中') : t('未开启')}</Tag>,
    },
    { title: '参与人数', dataIndex: 'participantCount', width: 110, render: (v: any) => v ?? 0 },
    { title: '开始时间', dataIndex: 'startTime', width: 170 },
    { title: '结束时间', dataIndex: 'endTime', width: 170 },
    { title: '创建时间', dataIndex: 'createTime', width: 170 },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: () => (
        <Space>
          <Button theme="borderless" type="primary">{t('编辑')}</Button>
          <Button theme="borderless" type="danger">{t('删除')}</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <ListPage
        api="/promotion/lotteryActivity/list"
        rowKey="activityId"
        columns={columns}
        filters={[
          { field: 'activityName', label: '活动名称', type: 'input' },
        ]}
        drawer={{
          title: '抽奖活动配置',
          addText: '添加抽奖活动',
          width: 600,
          createApi: '/promotion/lotteryActivity/create',
          updateApi: '/promotion/lotteryActivity/update',
          deleteApi: '/promotion/lotteryActivity/delete',
          sections: [
            {
              key: 'basic',
              title: '基础配置',
              fields: [
                { field: 'activityName', label: t('活动名称'), type: 'input', required: true },
                { field: 'startTime', label: t('开始时间'), type: 'date', required: true },
                { field: 'endTime', label: t('结束时间'), type: 'date', required: true },
              ],
            },
          ],
        }}
      />
    </div>
  );
}
