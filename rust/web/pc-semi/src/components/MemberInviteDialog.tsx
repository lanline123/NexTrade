'use client';

/**
 * 邀请拼团弹窗（通过链接邀请）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/joining/src/showInviteDialog.vue
 *
 * 旧版行为：
 * - show(text) 打开弹窗，弹窗内只读展示邀请链接 + 「复制链接」按钮；
 * - 复制成功提示「复制成功」，失败提示「复制失败，请手动复制」；复制后自动关闭弹窗；
 * - 底部只有「关闭」按钮。
 */
import { useState } from 'react';
import { Button, Modal, Toast } from '@douyinfe/semi-ui';

import { useTranslation } from 'react-i18next';

export default function MemberInviteDialog({
  visible,
  inviteLink,
  onClose,
}: {
  visible: boolean;
  /** 邀请链接（拼团页传入 `${origin}/joining/groupbyinvited?id=${recordId}`） */
  inviteLink: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [copying, setCopying] = useState(false);

  const copyLink = async () => {
    if (!inviteLink) return;
    setCopying(true);
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
      Toast.success({ content: t('复制成功') });
      onClose();
    } catch {
      Toast.error({ content: t('复制失败，请手动复制') });
    } finally {
      setCopying(false);
    }
  };

  return (
    <Modal
      title={t('通过链接邀请')}
      visible={visible}
      width={600}
      onCancel={onClose}
      footer={
        <div className="member-invite__footer">
          <Button onClick={onClose}>{t('关闭')}</Button>
        </div>
      }
    >
      <div className="member-invite">
        <input className="member-invite__input" readOnly value={inviteLink} />
        <Button theme="solid" type="primary" loading={copying} onClick={() => void copyLink()}>{t('复制链接')}</Button>
      </div>
      <p className="member-invite__tip">{t('发送链接给好友，好友打开后即可参与拼团。')}</p>
    </Modal>
  );
}
