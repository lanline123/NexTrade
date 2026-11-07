'use client';

/**
 * 删除记录二次确认弹窗
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/DeleteRecord.vue
 *
 * 旧版行为：
 * - 组件本体是一个 `<a class="btn-link">`，点击后弹 ElMessageBox 二次确认；
 * - 确认框文案默认「您确认要删除该数据吗」，标题「提示」，按钮「确认 / 取消」；
 * - 确认后调用外部传入的 `requestApi(params)`，成功提示「删除成功」并 emit('afterDelete')。
 *
 * 新版实现：受控 Modal，由调用方渲染触发按钮，删除请求由调用方传入。
 */
import { useState } from 'react';
import { Button, Modal } from '@douyinfe/semi-ui';

import { useTranslation } from 'react-i18next';

export default function MemberDeleteConfirm({
  visible,
  text,
  loading,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  /** 确认框提示文案，默认对齐旧版 DeleteRecord.vue 的 text prop */
  text?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const [internalLoading, setInternalLoading] = useState(false);
  const busy = loading ?? internalLoading;

  const handleConfirm = async () => {
    if (busy) return;
    setInternalLoading(true);
    try {
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Modal
      title={t('提示')}
      visible={visible}
      width={420}
      onCancel={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button theme="solid" type="danger" loading={busy} onClick={() => void handleConfirm()}>{t('确认')}</Button>
        </>
      }
    >
      <p className="member-delete-confirm__text">{text || t('您确认要删除该数据吗')}</p>
    </Modal>
  );
}
