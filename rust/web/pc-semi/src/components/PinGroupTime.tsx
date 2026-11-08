'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 拼团详情剩余时间
 * 源码对照：pages/member/pin/Group.vue:51-58
 *   <div class="time">剩余：<div>33</div>天<div>07</div>:<div>22</div></div>
 * 只负责让三个数字每秒走动，类名与结构完全照旧版。
 */
function calc(endTime?: string | number | null): { days: string; hours: string; minutes: string } {
  const end = Number(endTime || 0);
  if (!endTime || !Number.isFinite(end)) return { days: '00', hours: '00', minutes: '00' };
  const target = end > 1e12 ? end : end * 1000;
  const left = Math.max(0, target - Date.now());
  return {
    days: String(Math.floor(left / 86400000)),
    hours: String(Math.floor((left % 86400000) / 3600000)).padStart(2, '0'),
    minutes: String(Math.floor((left % 3600000) / 60000)).padStart(2, '0'),
  };
}

export default function PinGroupTime({ endTime }: { endTime?: string | number | null }) {
  const { t } = useTranslation();
  const [left, setLeft] = useState(() => calc(endTime));

  useEffect(() => {
    setLeft(calc(endTime));
    const timer = setInterval(() => setLeft(calc(endTime)), 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  return (
    <div className="time">
      {t('剩余')}：
      <div>{left.days}</div>
      {t('天')}
      <div>{left.hours}</div>
      :
      <div>{left.minutes}</div>
    </div>
  );
}
