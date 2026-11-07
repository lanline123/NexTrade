import { useRef, useState } from 'react';
import { Button, Input, Tag, Toast } from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { useI18n } from '../i18n';

/**
 * 售后原因编辑器（对齐旧版 OrderSettings.vue 的 tag 交互）：
 * - 最多 10 项、单项 ≤50 字、去重；
 * - 旧版按「取消未支付 / 已支付售后 / 已收货售后」三组拆分，但 Rust 后端
 *   FieldSpec 与 trade 服务目前只登记了合并列表 `afterSalesReasonList`，
 *   三组键提交会被白名单丢弃，因此这里先按合并列表编辑；
 *   后端登记三个场景键后再拆分 UI（见 ADMIN-PARITY-GAP §9.3）。
 */
export default function AfterSalesReasonField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();
  const list: string[] = Array.isArray(value) ? value.map(String) : [];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const confirm = () => {
    const reason = draft.trim();
    if (!reason) {
      setAdding(false);
      setDraft('');
      return;
    }
    if (reason.length > 50) {
      Toast.warning({ content: t('原因不能超过 50 个字') });
      return;
    }
    if (list.includes(reason)) {
      Toast.warning({ content: t('该原因已存在') });
      return;
    }
    if (list.length >= 10) {
      Toast.warning({ content: t('最多添加 10 项') });
      return;
    }
    onChange([...list, reason]);
    setDraft('');
    setAdding(false);
  };

  const remove = (index: number) => {
    onChange(list.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {list.map((reason, index) => (
        <Tag
          key={`${reason}-${index}`}
          closable
          onClose={() => remove(index)}
          style={{ fontSize: 13 }}
        >
          {reason}
        </Tag>
      ))}
      {adding ? (
        <Input
          ref={inputRef}
          value={draft}
          onChange={(next) => setDraft(String(next))}
          onEnterPress={confirm}
          onBlur={confirm}
          maxLength={50}
          showClear
          placeholder={t('请输入原因，回车确认')}
          style={{ width: 220 }}
          autoFocus
        />
      ) : (
        <Button
          theme="borderless"
          type="primary"
          icon={<IconPlus />}
          disabled={list.length >= 10}
          onClick={() => setAdding(true)}
        >
          {t('+ 新增原因')}
        </Button>
      )}
    </div>
  );
}
