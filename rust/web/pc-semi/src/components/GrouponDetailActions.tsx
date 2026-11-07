'use client';

/**
 * 拼团详情交互增强
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/group/Info.vue
 * - 结束倒计时（源码 CountdownNew countdown-type="specifyTime"）
 * - 通过链接邀请弹窗（源码 showInviteDialog + 复制链接）
 * - 邀请二维码/分享入口
 */
import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Toast } from '@douyinfe/semi-ui';

import { useTranslation } from 'react-i18next';
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function useCountdown(endTime?: string | number) {
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
    const timer = window.setInterval(() => {
      setLeft(Math.max(0, target - Date.now()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  const totalSeconds = Math.floor(left / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    ended: target > 0 && left <= 0,
  };
}

export default function GrouponDetailActions({
  recordId,
  endTime,
  canInvite,
  orderId,
}: {
  recordId: number;
  endTime?: string | number;
  canInvite: boolean;
  orderId?: number;
}) {
    const { t } = useTranslation();
  const { days, hours, minutes, seconds, ended } = useCountdown(endTime);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  const openInvite = () => {
    if (typeof window === 'undefined') return;
    const link = `${window.location.origin}/joining/groupByInvited?id=${recordId}`;
    setInviteLink(link);
    setInviteOpen(true);
  };

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
      } else {
        const input = document.createElement('input');
        input.value = inviteLink;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      Toast.success({ content: '链接已复制' });
    } catch {
      Toast.error({ content: '复制失败，请手动复制' });
    }
  };

  return (
    <>
      {endTime ? (
        <div className="groupon-detail__countdown">
          {ended ? (
            <span className="is-ended">{t('拼团已结束')}</span>
          ) : (
            <>
              <span className="groupon-detail__countdown-label">{t('距结束')}</span>
              <span className="groupon-detail__countdown-time">
                {days > 0 ? `${days}天 ` : ''}{pad(hours)}:{pad(minutes)}:{pad(seconds)}
              </span>
            </>
          )}
        </div>
      ) : null}

      <div className="groupon-detail__cta">
        <Button theme="solid" type="primary" disabled={!canInvite || ended} onClick={openInvite}>{t('邀请好友参团')}</Button>
        {orderId ? (
          <Button onClick={() => { window.location.href = `/member/order/detail?id=${orderId}`; }}>{t('查看订单')}</Button>
        ) : null}
      </div>

      <Modal
        title={t('通过链接邀请')}
        visible={inviteOpen}
        onCancel={() => setInviteOpen(false)}
        footer={
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button onClick={() => setInviteOpen(false)}>{t('关闭')}</Button>
            <Button theme="solid" type="primary" onClick={() => void copyLink()}>{t('复制链接')}</Button>
          </div>
        }
      >
        <input readOnly value={inviteLink} className="groupon-invite__input" />
        <p className="groupon-invite__tip">{t('发送链接给好友，好友打开后即可参与拼团。')}</p>
      </Modal>
    </>
  );
}
