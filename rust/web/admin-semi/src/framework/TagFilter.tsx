import { useEffect, useState } from 'react';
import { Select } from '@douyinfe/semi-ui';
import { apiGet } from '../api';
import { useI18n } from '../i18n';

interface TagFilterProps {
  value?: Array<string | number>;
  onChange: (value: Array<string | number>) => void;
  width?: number;
}

export default function TagFilter({ value, onChange, width = 220 }: TagFilterProps) {
  const { t } = useI18n();
  const [options, setOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<any>('/user/memberTagGroup/list', { page: 1, size: 100 })
      .then(async (result) => {
        if (!alive) return;
        const groups = Array.isArray(result) ? result : result?.records || result?.list || [];
        const all = await Promise.all(
          groups.map((group: Record<string, any>) =>
            apiGet<Array<Record<string, any>>>('/user/memberTag/listByGroup', {
              groupId: group.groupId,
            })
              .then((tags) => tags || [])
              .catch(() => []),
          ),
        );
        if (!alive) return;
        setOptions(
          all.flat().map((tag) => ({
            label: tag.groupName ? `${tag.groupName} / ${tag.tagName}` : tag.tagName,
            value: Number(tag.tagId),
          })),
        );
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Select
      multiple
      filter
      loading={loading}
      placeholder={t('选择客户标签')}
      value={Array.isArray(value) ? value : []}
      optionList={options}
      onChange={(next) => onChange((next as Array<string | number>) || [])}
      style={{ width }}
    />
  );
}
