'use client';

/**
 * 会员中心 · 账户分组顶部标签（账户明细 / 申请记录 / 充值 / 提现 / 卡管理）
 *
 * 源码对照：旧版 `components/member/TopMenu.vue`（28 行，v1 变体同款）——
 * 注意按文件名搜 `MemberTopMenu` 是 0 命中的（旧模板里的组件名 ≠ 文件名），
 * 真实文件在 components/member/TopMenu.vue，DOM 为 `.tab > a.tig-font-style`，
 * 激活态由路由 path（去掉 ?参数）比对得出。`.tig-tabs .tab` 与 `.active::before`
 * 的样式来自 assets/css/member/member.less:106-170，已平移到 app/member-base.scss。
 *
 * 提现页签的显示由后台开关 D1107（会员余额提现）控制。旧版是每个页面各自过滤一次：
 *   pages/member/account/{Detail,Log,Deposit,CardManagement,Raplytocard}.vue
 *   menuList.filter(item => item.url !== '/member/account/raplytocard'
 *                          || commonStore.memberWithdrawalEnabled === 1)
 * `commonStore.memberWithdrawalEnabled` 来自 `/common/config/base`（服务端字段同名，
 * 本仓库 src/lib/api.ts 不导出它，直接读接口字段即可，见 WithdrawClient.tsx:57-67）。
 * 这里把同一份过滤收敛到本组件，行为与旧版逐字一致：**只有 === 1 才显示提现**。
 * 接口还没回来时（未知）先照常显示，拿到值再决定，避免闪一下少一个页签。
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

/** 旧版 menuList 原文顺序 */
export const ACCOUNT_MENU = [
  { label: '账户明细', url: '/member/account/detail' },
  { label: '申请记录', url: '/member/account/log' },
  { label: '充值', url: '/member/account/deposit' },
  { label: '提现', url: '/member/account/raplytocard' },
  { label: '卡管理', url: '/member/account/cardmanagement' },
];

const WITHDRAW_URL = '/member/account/raplytocard';

/**
 * 会员余额提现开关（D1107）。同一页面上会挂好几个账户组件，做一层模块级缓存，
 * 一次会话只请求一次 /common/config/base。
 */
let withdrawEnabledCache: boolean | null = null;
let withdrawEnabledRequest: Promise<boolean> | null = null;

function loadMemberWithdrawalEnabled(): Promise<boolean> {
  if (withdrawEnabledCache !== null) return Promise.resolve(withdrawEnabledCache);
  if (!withdrawEnabledRequest) {
    withdrawEnabledRequest = fetch('/api/common/config/base')
      .then((response) => response.json())
      .then((json) => {
        const config = json?.data || json || {};
        // 旧版判等是严格 === 1；接口可能给 1 / "1" / null，统一走 Number() 再比
        const enabled = Number(config.memberWithdrawalEnabled) === 1;
        withdrawEnabledCache = enabled;
        return enabled;
      })
      .catch(() => {
        // 取不到就当开着：宁可不隐藏，也不要把开关误判成关闭
        withdrawEnabledRequest = null;
        return true;
      });
  }
  return withdrawEnabledRequest;
}

export default function MemberAccountTabs({ current: currentProp }: { current?: string }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  // 旧版 splitStr：路由比对时去掉 ? 后面的部分；优先用调用方显式传入的 current
  const current = currentProp ?? (pathname || '').split('?')[0];
  // null = 开关未知（接口未回），此时不隐藏任何页签
  const [withdrawEnabled, setWithdrawEnabled] = useState<boolean | null>(withdrawEnabledCache);

  useEffect(() => {
    let alive = true;
    loadMemberWithdrawalEnabled().then((enabled) => {
      if (alive) setWithdrawEnabled(enabled);
    });
    return () => {
      alive = false;
    };
  }, []);

  const menuList =
    withdrawEnabled === false ? ACCOUNT_MENU.filter((menu) => menu.url !== WITHDRAW_URL) : ACCOUNT_MENU;

  return (
    <div className="title-or-tabs">
      <div className="tag-and-input">
        <div className="tig-tabs">
          {menuList.map((menu) => (
            <div key={menu.url} className={`tab${menu.url === current ? ' active' : ''}`}>
              <Link href={menu.url} className="tig-font-style">
                {t(menu.label)}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
