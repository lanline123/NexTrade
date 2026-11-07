'use client';

/**
 * 拼团结束倒计时
 * 源码对照：joining/groupbyinvited.vue 的 CountdownNew（countdown-type="specifyTime"）
 */
import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export default function GrouponCountdown({ endTime }: { endTime?: string | number }) {
    const { t } = useTranslation();
  const target = useMemo(() => {
    if (!endTime) return 0;
    if (typeof endTime === 'number') return endTime > 1e12 ? endTime : endTime * 1000;
    const parsed = new Date(String(endTime).replace(/-/g, '/')).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }, [endTime]);

  const [left, setLeft] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    if (!target) return;
    const timer = window.setInterval(() => setLeft(Math.max(0, target - Date.now())), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (!target) return null;

  const total = Math.floor(left / 1000);
  if (total <= 0) return <div className="invite-countdown is-ended">{t('拼团已结束')}</div>;

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return (
    <div className="invite-countdown">
      <span className="invite-countdown__label">{t('距结束')}</span>
      <span className="invite-countdown__time">
        {days > 0 ? `${days}天 ` : ''}{pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
}
