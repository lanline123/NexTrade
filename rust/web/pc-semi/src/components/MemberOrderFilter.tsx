'use client';

/**
 * 订单列表顶部筛选条（状态 Tab + 关键词搜索）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/order/OrderListFilter.v1.vue
 *
 * 旧版行为：
 * - 左侧 5 个状态 Tab（全部/待付款/待发货/待收货/待评价），Tab 上带数量角标（>99 显示 99+）；
 * - 右侧关键词输入框 + 「搜索」按钮，placeholder「收货人名称或订单号」；
 * - 切 Tab 与点搜索都由父组件负责真正取数。
 */
import { useState } from 'react';
import { Button, Input } from '@douyinfe/semi-ui';

import { useTranslation } from 'react-i18next';

export interface OrderFilterTab {
  key: string;
  label: string;
  /** 角标数量 */
  num?: number;
}

/** 旧版 formatOrderCount：>99 显示 99+ */
function formatOrderCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export default function MemberOrderFilter({
  tabs,
  activeKey,
  keyword,
  onTabChange,
  onSearch,
}: {
  tabs: OrderFilterTab[];
  activeKey: string;
  keyword: string;
  onTabChange: (key: string) => void;
  onSearch: (keyword: string) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(keyword);

  return (
    <div className="member-order-filter">
      <div className="member-order-filter__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={tab.key === activeKey ? 'is-active' : ''}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
            {Number(tab.num || 0) > 0 ? <span className="member-order-filter__num">{formatOrderCount(Number(tab.num))}</span> : null}
          </button>
        ))}
      </div>
      <div className="member-order-filter__search">
        <Input
          value={value}
          onChange={setValue}
          placeholder={t('收货人名称或订单号')}
          onEnterPress={() => onSearch(value)}
        />
        <Button onClick={() => onSearch(value)}>{t('搜索')}</Button>
      </div>
    </div>
  );
}
