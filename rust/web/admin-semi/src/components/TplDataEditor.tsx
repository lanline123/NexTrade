import { useEffect, useState } from 'react';
import { Button, Input, Space, Typography } from '@douyinfe/semi-ui';
import { useI18n } from '../i18n';

const { Text } = Typography;

export interface TplAttribute {
  attrName: string;
  attrValues: string[];
}

export interface TplData {
  normal: TplAttribute[];
  spe: TplAttribute[];
  extra: TplAttribute[];
}

const emptyData = (): TplData => ({ normal: [], spe: [], extra: [] });

function normalize(value: any): TplData {
  const build = (items: any): TplAttribute[] =>
    Array.isArray(items)
      ? items.map((item) => ({
          attrName: item?.attrName || '',
          attrValues: Array.isArray(item?.attrValues) && item.attrValues.length
            ? item.attrValues.map((v: any) => String(v))
            : [''],
        }))
      : [];
  return {
    normal: build(value?.normal),
    spe: build(value?.spe),
    extra: build(value?.extra),
  };
}

export default function TplDataEditor({
  value,
  onChange,
}: {
  value?: TplData;
  onChange: (value: TplData) => void;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<TplData>(() => normalize(value));

  useEffect(() => {
    setData(normalize(value));
  }, [JSON.stringify(value)]);

  const commit = (next: TplData) => {
    setData(next);
    onChange(next);
  };

  const addAttr = (group: keyof TplData) => {
    commit({
      ...data,
      [group]: [...data[group], { attrName: '', attrValues: [''] }],
    });
  };

  const removeAttr = (group: keyof TplData, index: number) => {
    commit({ ...data, [group]: data[group].filter((_, i) => i !== index) });
  };

  const updateAttr = (group: keyof TplData, index: number, attr: TplAttribute) => {
    commit({
      ...data,
      [group]: data[group].map((item, i) => (i === index ? attr : item)),
    });
  };

  const renderGroup = (group: keyof TplData, title: string, valueLabel: string) => (
    <div className="tpl-data-group">
      <div className="tpl-data-title">{t(title)}</div>
      {data[group].map((attr, attrIndex) => (
        <div className="tpl-data-attr" key={`${group}-${attrIndex}`}>
          <div className="tpl-data-row">
            <Input
              value={attr.attrName}
              placeholder={t('属性名，如颜色')}
              onChange={(next) => updateAttr(group, attrIndex, { ...attr, attrName: next })}
              style={{ width: 260 }}
            />
            {attr.attrValues.map((val, valueIndex) => (
              <Space key={valueIndex}>
                <Input
                  value={val}
                  placeholder={t(valueLabel)}
                  onChange={(next) =>
                    updateAttr(group, attrIndex, {
                      ...attr,
                      attrValues: attr.attrValues.map((item, i) => (i === valueIndex ? next : item)),
                    })
                  }
                  style={{ width: 180 }}
                />
                <Button
                  theme="borderless"
                  type="danger"
                  size="small"
                  onClick={() =>
                    updateAttr(group, attrIndex, {
                      ...attr,
                      attrValues: attr.attrValues.filter((_, i) => i !== valueIndex),
                    })
                  }
                >
                  {t('删除')}
                </Button>
              </Space>
            ))}
            <Button
              theme="borderless"
              size="small"
              onClick={() =>
                updateAttr(group, attrIndex, {
                  ...attr,
                  attrValues: [...attr.attrValues, ''],
                })
              }
            >
              {t('+ 增加{valueLabel}', { valueLabel: t(valueLabel) })}
            </Button>
            <Button theme="borderless" type="danger" size="small" onClick={() => removeAttr(group, attrIndex)}>
              {t('删除属性')}
            </Button>
          </div>
        </div>
      ))}
      <Button theme="light" onClick={() => addAttr(group)}>
        {t('+ 添加{title}', { title: t(title) })}
      </Button>
    </div>
  );

  return (
    <div className="tpl-data-editor">
      {renderGroup('normal', '属性项', '属性值')}
      {renderGroup('spe', '规格项', '规格值')}
      {renderGroup('extra', '附加服务', '附加服务值')}
      <Text type="tertiary" size="small">
        {t('属性用于商品展示，规格会影响 SKU 和价格。')}
      </Text>
    </div>
  );
}

export { emptyData };
