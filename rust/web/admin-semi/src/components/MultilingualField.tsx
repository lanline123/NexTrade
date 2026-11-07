/**
 * 多语言业务字段（MultilingualField）：对应原版 components/multilingual/BusinessData.vue。
 *
 * 输入框 + 「内容翻译」按钮 → 弹窗按语言逐条维护译文：
 * - GET  /lang/translations/getLocalesLimit3  可用语言（最多3个，与原版口径一致）
 * - GET  /lang/translations/getTranslations   读取 {id, dataType, translationName} 的译文
 * - POST /lang/translations/createTranslations 保存 {dataId, dataType, translationName, items[]}
 *
 * 典型用法（对齐旧版 dataType）：优惠券名称 10 / 优惠券说明 11 / 拼团活动名 4 /
 * 满减活动名 4（promotion/productActivity/Info.vue）。
 */

import { useEffect, useState } from 'react';
import { Button, Input, Modal, Space, Spin, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface LocaleRow {
  id?: number;
  localeCode?: string;
  language?: string;
  flagPicture?: string;
}

interface TranslationItem {
  localeId?: number;
  translationValue?: string;
}

interface MultilingualFieldProps {
  /** 当前值（原文） */
  value?: string;
  onChange: (value: string) => void;
  /** 已保存记录的 ID；新建未保存时传 0（保存后可再维护译文） */
  dataId?: number;
  /** 原版 BusinessData 的 dataType（10 优惠券名 / 11 优惠券说明 / 4 活动名等） */
  dataType: number;
  type?: 'input' | 'textarea';
  placeholder?: string;
  maxlength?: number;
}

export default function MultilingualField({
  value,
  onChange,
  dataId = 0,
  dataType,
  type = 'input',
  placeholder,
  maxlength,
}: MultilingualFieldProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locales, setLocales] = useState<LocaleRow[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});

  const open = async () => {
    setVisible(true);
    setLoading(true);
    try {
      const localeList = await apiGet<any>('/lang/translations/getLocalesLimit3');
      const rows: LocaleRow[] = Array.isArray(localeList) ? localeList : localeList?.records || [];
      setLocales(rows);
      if (dataId && dataId > 0 && value) {
        const detail = await apiGet<any>('/lang/translations/getTranslations', {
          id: dataId,
          dataType,
          translationName: value,
        });
        const items: TranslationItem[] = detail?.items || [];
        setValues(
          Object.fromEntries(
            items
              .filter((item) => item.localeId != null)
              .map((item) => [Number(item.localeId), String(item.translationValue ?? '')]),
          ),
        );
      } else {
        setValues({});
      }
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('译文加载失败') });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    const items: TranslationItem[] = Object.entries(values)
      .filter(([, text]) => text.trim())
      .map(([localeId, text]) => ({ localeId: Number(localeId), translationValue: text.trim() }));
    if (!value || !String(value).trim()) {
      Toast.warning({ content: t('请先填写原文') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/lang/translations/createTranslations', {
        dataId,
        dataType,
        translationName: value,
        items,
      });
      Toast.success({ content: t('译文已保存') });
      setVisible(false);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const commonProps = {
    value: value || '',
    maxlength,
    placeholder,
  } as const;

  return (
    <Space style={{ width: '100%', flexWrap: 'wrap' }}>
      {type === 'textarea' ? (
        <TextArea
          {...commonProps}
          onChange={(next) => onChange(next)}
          autosize={{ minRows: 3, maxRows: 6 }}
          style={{ minWidth: 320, flex: 1 }}
        />
      ) : (
        <Input
          {...commonProps}
          onChange={(next) => onChange(next)}
          style={{ width: 360 }}
        />
      )}
      <Button onClick={open} disabled={!value || !String(value).trim()}>
        {t('内容翻译')}
      </Button>
      {dataId <= 0 && (
        <Text type="tertiary" size="small">
          {t('保存后可维护译文')}
        </Text>
      )}

      <Modal
        title={t('内容翻译')}
        visible={visible}
        onOk={save}
        okButtonProps={{ loading: saving }}
        onCancel={() => setVisible(false)}
        okText={t('保存')}
        cancelText={t('取消')}
        width={640}
      >
        <Spin spinning={loading}>
          <div style={{ marginBottom: 10 }}>
            <Text type="tertiary">{t('原文：')}</Text>
            <span>{value || '--'}</span>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {locales.map((locale) => (
              <div key={locale.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 110, flexShrink: 0 }}>
                  {locale.flagPicture ? (
                    <img src={locale.flagPicture} alt="" style={{ width: 22, height: 14, marginRight: 6, objectFit: 'cover' }} />
                  ) : null}
                  {locale.language || locale.localeCode}
                </span>
                <Input
                  style={{ flex: 1 }}
                  value={values[Number(locale.id)] || ''}
                  onChange={(next) =>
                    setValues((current) => ({ ...current, [Number(locale.id)]: next }))
                  }
                />
              </div>
            ))}
            {!loading && !locales.length && <Text type="tertiary">{t('暂无可用语言')}</Text>}
          </div>
        </Spin>
      </Modal>
    </Space>
  );
}
