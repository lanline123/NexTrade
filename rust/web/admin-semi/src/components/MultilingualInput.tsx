import { useEffect, useState } from 'react';
import { Button, Input, Modal, Toast } from '@douyinfe/semi-ui';
import { IconGlobe } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import './MultilingualInput.css';

interface LocaleRow {
  localeId: number;
  language: string;
  localeCode: string;
  translationValue: string;
  isDefault?: number;
}

export default function MultilingualInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState(value);
  const [rows, setRows] = useState<LocaleRow[]>([]);

  useEffect(() => {
    if (!visible) return;
    setSource(value);
    setLoading(true);
    Promise.all([
      apiGet<any>('/lang/locales/list', { isEnabled: 1, size: 100 }),
      apiPost<any>('/lang/translations/getTranslations', { dataType: 2, translationName: value }),
    ])
      .then(([localeResult, translationResult]) => {
        const locales: any[] = localeResult?.records || localeResult?.list || [];
        const items: any[] = translationResult?.items || [];
        setRows(locales.map((locale) => {
          const matched = items.find((item) => Number(item.localeId) === Number(locale.id));
          return {
            localeId: Number(locale.id),
            language: locale.language || locale.localeCode || String(locale.id),
            localeCode: locale.localeCode || '',
            isDefault: Number(locale.isDefault) || 0,
            translationValue: matched?.translationValue || (Number(locale.isDefault) === 1 ? value : ''),
          };
        }));
      })
      .catch((error) => {
        Toast.error({ content: error instanceof Error ? error.message : t('读取多语言配置失败') });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, value]);

  const save = async () => {
    setSaving(true);
    try {
      await apiPost('/lang/translations/createTranslations', {
        dataType: 2,
        translationName: source || value,
        items: rows.map((row) => ({ localeId: row.localeId, translationValue: row.translationValue })),
      });
      if (source !== value) onChange(source);
      Toast.success({ content: t('翻译已保存') });
      setVisible(false);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存翻译失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="multilingual-input">
      <Input value={value} onChange={onChange} placeholder={placeholder} />
      <Button
        size="small"
        icon={<IconGlobe />}
        className="multilingual-input__button"
        onClick={() => setVisible(true)}
        aria-label={t('多语言翻译')}
      >
        {t('多语言')}
      </Button>
      <Modal
        title={t('内容翻译')}
        visible={visible}
        width={760}
        confirmLoading={saving}
        onCancel={() => setVisible(false)}
        onOk={save}
        okText={t('保存翻译')}
        cancelText={t('取消')}
      >
        <div className="multilingual-dialog">
          <div className="multilingual-dialog__source">
            <span>{t('翻译原文')}</span>
            <Input value={source} onChange={setSource} placeholder={t('请输入翻译原文')} />
          </div>
          <div className="multilingual-dialog__list">
            {loading ? (
              <div className="multilingual-dialog__empty">{t('加载中...')}</div>
            ) : rows.map((row) => (
              <div className="multilingual-dialog__row" key={row.localeId}>
                <span className="multilingual-dialog__language">
                  {row.language}
                  {row.isDefault === 1 ? <em>{t('默认')}</em> : null}
                </span>
                <Input
                  value={row.translationValue}
                  onChange={(next) => setRows((current) => current.map((item) => (
                    item.localeId === row.localeId ? { ...item, translationValue: next } : item
                  )))}
                  placeholder={t('请输入翻译内容')}
                />
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
