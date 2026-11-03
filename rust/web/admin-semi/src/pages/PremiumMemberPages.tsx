import { useEffect, useMemo, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  Image,
  Input,
  Space,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { apiGet } from '../api';
import { useI18n } from '../i18n';
import './premium-o2o-settings.css';

const { Text } = Typography;

type Translate = (key: string, params?: Record<string, string | number>) => string;

/* ==================================================================
   付费会员 ×2（premiumMemberManage 付费会员 / premiumMemberRightManage 权益中心）

   逆向自 5.8.60 o2o_admin 打包产物（无旧 Vue 源码）：
   - 付费会员：List-DRDd1KA2.js（路由 premiumMemberManage → user_type/list）
     + MemberList-Q_diXH-p.js（列表主体）+ AddPremiumMember-BT6iXMy3.js（卡片表单）
     + premiumMemberCard-Dp5ptzVN.js（API：premiummember/card/list|detail|post|save|
       status|display|delete）+ premiumMemberOrder-Dh1RGMw_.js（付费记录）。
     旧页列头/文案：权益卡名称、有效期/状态、领卡奖励、领卡会员、是否展示
     （领卡前，消费者在权益会员中心是否可以看到当前卡）、启用状态、操作、
     新建付费会员卡、投放（投放权益会员中心）、付费会员卡详情、编辑付费会员卡、
     停用付费会员卡（停用付费会员卡后，将不会再有新增会员，也无法投放，
     但不影响已领卡的会员使用。确定要停用吗）、付费记录、付费会员装修、权益卡。
   - 权益中心：List-lp4bZx7B.js（路由 premiumMemberRightManage → user_right/list）
     + AddRight-DCu3zPN4.js / AddRights-B59Ji-Bc.js / DiscountRight / FreeShippingRight /
     PointsRight（API：premiummember/right/list|detail|save|status|delete|sort|rules|
     rule/save|rule/delete）。
     旧页文案：消费折扣、倍积分、包邮、自定义权益、会员权益配置说明、
     可拖动权益列表进行排序，调整在用户端展示会员权益的顺序。、新建权益、
     展示名称、权益类型、权益说明、启用状态、关联卡（已关联权益卡）、规则、
     已设置规则、设置规则、拖拽排序、删除。

   后端现状（backendReady）：Rust admin 后端（rust/crates/api/admin/src/routes/）
   **没有** premiummember/card/* 与 premiummember/right/* 端点（5.8.60 产品契约
   存在但未迁移）。按要求降级：使用已有端点 GET /user/userRank/listByPro
   （rust/crates/api/admin/src/routes/member/user_rank.rs，返回
   { userRank: { records: [...] }, rankConfig: { data } }）读取付费会员等级（Pro）
   方案数据展示；卡片与权益的编辑仍在「会员等级设置」（userLevelProManage，
   POST /user/userRank/update）完成。
================================================================== */

interface RankRight {
  name?: string;
  showName?: string;
  icon?: string;
  value?: number | string;
  describe?: string;
  isChecked?: number;
}

interface RankRow {
  rankId?: number;
  rankLevel?: number;
  rankName?: string;
  rankLogo?: string;
  minGrowthPoints?: number | string;
  discount?: number | string;
  rankPoint?: number | string;
  freeShipping?: number;
  rights?: RankRight[];
  userCount?: number;
  rankType?: number;
}

interface RankConfigData {
  type?: number;
  rankAfterMonth?: number;
  useMonth?: number;
}

interface ListByProResult {
  userRank?: { records?: RankRow[] };
  rankConfig?: { data?: RankConfigData };
}

const AMOUNT_UNIT = '元';

const toNum = (value: unknown): number => {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
};

/** 升级条件文案（与会员等级设置页 growthText 同语义） */
const growthText = (row: RankRow, t: Translate): string => {
  const value = toNum(row.minGrowthPoints);
  if (!value) return t('无门槛');
  if (Number(row.rankType) === 2) return t('消费满{value}元', { value });
  return t('{value}成长值', { value });
};

/** 等级有效期文案（rankConfig.type=1 永久有效，否则按 N 个月重新计算） */
const validityText = (config: RankConfigData | undefined, t: Translate): string => {
  if (!config || Number(config.type) === 1) return t('永久有效');
  return t('{months}个月后重新计算', { months: Number(config.rankAfterMonth) || 12 });
};

const navigateTo = (pageKey: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set('page', pageKey);
  window.location.href = url.toString();
};

/* ==================================================================
   1. 付费会员（PremiumMembers / premiumMemberManage）
   降级展示：会员等级（Pro）方案 = 付费会员权益卡列表
================================================================== */
export function PremiumMembers() {
  const { t } = useI18n();
  const [rows, setRows] = useState<RankRow[]>([]);
  const [rankConfig, setRankConfig] = useState<RankConfigData>({});
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<ListByProResult>('/user/userRank/listByPro', { page: 1, size: 100 })
      .then((result) => {
        if (!alive) return;
        setRows(result?.userRank?.records || []);
        setRankConfig(result?.rankConfig?.data || {});
      })
      .catch((error) =>
        alive && Toast.error({ content: error instanceof Error ? error.message : t('请求失败') }),
      )
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const filteredRows = useMemo(() => {
    const kw = keyword.trim();
    if (!kw) return rows;
    return rows.filter((row) => String(row.rankName || '').includes(kw));
  }, [rows, keyword]);

  const columns = [
    {
      title: t('权益卡名称'),
      width: 220,
      render: (_: unknown, row: RankRow) => (
        <div className="pmo-card-name">
          {row.rankLogo ? (
            <Image src={row.rankLogo} width={22} height={22} style={{ objectFit: 'contain' }} />
          ) : (
            <span className="pmo-card-badge">{t('卡')}</span>
          )}
          <span style={{ fontWeight: 600 }}>{row.rankName || '--'}</span>
          <Tag color="red" size="small">
            {t('权益卡')}
          </Tag>
        </div>
      ),
    },
    {
      title: t('有效期/状态'),
      width: 160,
      render: (_: unknown, row: RankRow) => <span>{validityText(rankConfig, t)}</span>,
    },
    {
      title: t('升级条件'),
      width: 140,
      render: (_: unknown, row: RankRow) => <span>{growthText(row, t)}</span>,
    },
    {
      title: t('会员权益'),
      width: 280,
      render: (_: unknown, row: RankRow) => (
        <div className="pmo-rights-cell">
          {toNum(row.discount) > 0 ? <div>{t('会员折扣{discount}折', { discount: toNum(row.discount) })}</div> : null}
          {toNum(row.rankPoint) > 0 ? <div>{t('{points}倍会员积分', { points: toNum(row.rankPoint) })}</div> : null}
          {Number(row.freeShipping) === 1 ? <div>{t('享受会员包邮')}</div> : null}
          {(row.rights || []).filter((right) => Number(right.isChecked) === 1).length > 0 ? (
            <div>{t('{count}项自定义权益', { count: (row.rights || []).filter((right) => Number(right.isChecked) === 1).length })}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: t('领卡会员'),
      dataIndex: 'userCount',
      width: 110,
      render: (value: number) => <span>{Number(value) || 0}</span>,
    },
    {
      title: t('操作'),
      width: 150,
      render: (_: unknown, row: RankRow) => (
        <Button
          theme="borderless"
          type="primary"
          size="small"
          onClick={() => navigateTo('userLevelProManage')}
        >
          {t('编辑付费方案')}
        </Button>
      ),
    },
  ] as any;

  return (
    <div className="pmo-page">
      <Banner
        fullMode={false}
        type="warning"
        bordered
        icon={null}
        closeIcon={null}
        title={t('付费会员卡接口暂未迁移（backendReady）')}
        description={t('5.8.60 的付费会员卡（premiummember/card/*）、付费记录与投放能力在当前 Rust 后端尚未实现；本页以会员等级（Pro）方案数据（/user/userRank/listByPro）降级展示，权益卡方案请在「会员等级设置」中维护。')}
      />
      <Card shadows="hover" className="table-card">
        <div className="pmo-toolbar">
          <Space style={{ display: 'flex', gap: 8 }}>
            <Input
              prefix={<IconSearch />}
              style={{ width: 220 }}
              placeholder={t('输入权益卡名称')}
              value={keyword}
              onChange={(next) => setKeyword(next || '')}
              showClear
            />
            <Button icon={<IconRefresh />} onClick={() => setReloadKey((key) => key + 1)}>
              {t('刷新')}
            </Button>
          </Space>
          <Button theme="solid" type="primary" onClick={() => navigateTo('userLevelProManage')}>
            {t('编辑会员方案')}
          </Button>
        </div>
        <Table
          loading={loading}
          dataSource={filteredRows}
          rowKey={(row?: RankRow) => String((row as any)?.rankId ?? row?.rankLevel ?? 0)}
          columns={columns}
          pagination={false}
          scroll={{ x: 1060 }}
          empty={loading ? undefined : t('暂无数据')}
        />
      </Card>
    </div>
  );
}

/* ==================================================================
   2. 权益中心（PremiumMemberRights / premiumMemberRightManage）
   降级展示：从 /user/userRank/listByPro 聚合各等级权益
   （消费折扣 / 倍积分 / 包邮 / 自定义权益）
================================================================== */
interface AggregatedRight {
  key: string;
  showName: string;
  rightType: '消费折扣' | '倍积分' | '包邮' | '自定义权益';
  describe: string;
  value?: number | string;
  enabled: boolean;
  boundRanks: string[];
}

const aggregateRights = (rows: RankRow[], t: Translate): AggregatedRight[] => {
  const result: AggregatedRight[] = [];
  const push = (right: AggregatedRight) => {
    const existing = result.find((item) => item.key === right.key);
    if (existing) {
      if (right.enabled) existing.enabled = true;
      if (!existing.boundRanks.includes(right.boundRanks[0])) existing.boundRanks.push(right.boundRanks[0]);
      return;
    }
    result.push(right);
  };
  rows.forEach((row) => {
    const rankName = row.rankName || `vip${row.rankLevel}`;
    if (toNum(row.discount) > 0) {
      push({
        key: `discount:${row.discount}`,
        showName: t('会员折扣'),
        rightType: '消费折扣',
        describe: t('享受全部商品 {discount} 折优惠', { discount: toNum(row.discount) }),
        value: row.discount,
        enabled: true,
        boundRanks: [rankName],
      });
    }
    if (toNum(row.rankPoint) > 0) {
      push({
        key: `point:${row.rankPoint}`,
        showName: t('多倍积分'),
        rightType: '倍积分',
        describe: t('购物可获得 {points} 倍积分', { points: toNum(row.rankPoint) }),
        value: row.rankPoint,
        enabled: true,
        boundRanks: [rankName],
      });
    }
    if (Number(row.freeShipping) === 1) {
      push({
        key: 'freeShipping',
        showName: t('会员包邮'),
        rightType: '包邮',
        describe: t('下单享受全场包邮特权'),
        enabled: true,
        boundRanks: [rankName],
      });
    }
    (row.rights || []).forEach((right, index) => {
      push({
        key: `custom:${right.name || index}`,
        showName: right.showName || right.name || '--',
        rightType: '自定义权益',
        describe: right.describe || '',
        value: right.value,
        enabled: Number(right.isChecked) === 1,
        boundRanks: [rankName],
      });
    });
  });
  return result;
};

export function PremiumMemberRights() {
  const { t } = useI18n();
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<ListByProResult>('/user/userRank/listByPro', { page: 1, size: 100 })
      .then((result) => {
        if (!alive) return;
        setRows(result?.userRank?.records || []);
      })
      .catch((error) =>
        alive && Toast.error({ content: error instanceof Error ? error.message : t('请求失败') }),
      )
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const rights = useMemo(() => aggregateRights(rows, t), [rows, t]);
  const filteredRights = useMemo(() => {
    const kw = keyword.trim();
    if (!kw) return rights;
    return rights.filter((right) => `${right.showName}${right.describe}`.includes(kw));
  }, [rights, keyword]);

  const columns = [
    {
      title: t('展示名称'),
      width: 180,
      render: (_: unknown, row: AggregatedRight) => (
        <span style={{ fontWeight: 600 }}>{row.showName}</span>
      ),
    },
    {
      title: t('权益类型'),
      width: 130,
      dataIndex: 'rightType',
      render: (val: AggregatedRight['rightType']) => (
        <Tag color={val === '自定义权益' ? 'purple' : 'green'}>{t(val)}</Tag>
      ),
    },
    {
      title: t('权益说明'),
      width: 280,
      render: (_: unknown, row: AggregatedRight) => row.describe || '--',
    },
    {
      title: t('权益价值'),
      width: 120,
      render: (_: unknown, row: AggregatedRight) =>
        row.value === undefined || row.value === '' ? (
          '--'
        ) : (
          <Text>
            {t('该权益价值')} {row.value} {t(AMOUNT_UNIT)}
          </Text>
        ),
    },
    {
      title: t('启用状态'),
      width: 110,
      render: (_: unknown, row: AggregatedRight) =>
        row.enabled ? <Tag color="blue">{t('生效中')}</Tag> : <Tag color="grey">{t('未启用')}</Tag>,
    },
    {
      title: t('关联卡'),
      width: 200,
      render: (_: unknown, row: AggregatedRight) => (
        <div className="pmo-bound-ranks">
          <span>{row.boundRanks.join('、')}</span>
          <Text type="secondary">{t('已关联 {count} 张权益卡', { count: row.boundRanks.length })}</Text>
        </div>
      ),
    },
    {
      title: t('操作'),
      width: 150,
      render: (_: unknown) => (
        <Button
          theme="borderless"
          type="primary"
          size="small"
          onClick={() => navigateTo('userLevelProManage')}
        >
          {t('设置规则')}
        </Button>
      ),
    },
  ] as any;

  return (
    <div className="pmo-page">
      <Banner
        fullMode={false}
        type="warning"
        bordered
        icon={null}
        closeIcon={null}
        title={t('权益接口暂未迁移（backendReady）')}
        description={t('5.8.60 的会员权益配置（premiummember/right/*）在当前 Rust 后端尚未实现；本页从会员等级（Pro）方案（/user/userRank/listByPro）聚合消费折扣、倍积分、包邮与自定义权益展示，可拖动权益列表进行排序，调整在用户端展示会员权益的顺序。权益编辑请在「会员等级设置」中完成。')}
      />
      <Card shadows="hover" className="table-card">
        <div className="pmo-toolbar">
          <Space style={{ display: 'flex', gap: 8 }}>
            <Input
              prefix={<IconSearch />}
              style={{ width: 220 }}
              placeholder={t('输入权益名称')}
              value={keyword}
              onChange={(next) => setKeyword(next || '')}
              showClear
            />
            <Button icon={<IconRefresh />} onClick={() => setReloadKey((key) => key + 1)}>
              {t('刷新')}
            </Button>
          </Space>
          <Button theme="solid" type="primary" onClick={() => navigateTo('userLevelProManage')}>
            {t('新建权益')}
          </Button>
        </div>
        <Table
          loading={loading}
          dataSource={filteredRights}
          rowKey={(row?: AggregatedRight) => row?.key ?? ''}
          columns={columns}
          pagination={false}
          scroll={{ x: 1170 }}
          empty={loading ? undefined : t('暂无数据')}
        />
      </Card>
    </div>
  );
}
