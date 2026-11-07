/**
 * 商品多语言翻译弹窗（ProductTranslateModal）：
 * 对齐原版 views/product/product/src/BatchTranslateDialog.vue 的核心流程
 * （基本信息 dataType=2 的 商品名称/搜索关键词/商品描述 + 商品详情 dataType=9 文本段）。
 *
 * 端点（Rust 均已实现）：
 * - GET  /lang/locales/list                    语言列表
 * - GET  /product/product/detail               商品详情（原文）
 * - GET  /lang/translations/getTranslations    读取既有译文 {id, dataType, translationName}
 * - POST /lang/currency/translation            机器翻译 {code, text}
 * - POST /lang/translations/batchCreateTranslations  批量保存 [{dataId, dataType, translationName, items[]}]
 */

import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Input, Modal, Spin, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface LocaleRow {
  id?: number;
  localeCode?: string;
  language?: string;
}

interface FieldRow {
  groupKey: string;
  label: string;
  dataType: number;
  sourceName: string;
  /** localeId → 译文 */
  translations: Record<string, string>;
}

const stripHtml = (html?: string) => (html || '').replace(/<[^>]+>/g, '\n').replace(/\s+\n/g, '\n').trim();

const FIELD_DEFS: Array<{ key: string; label: string; dataType: number; source: string }> = [
  { key: 'productName', label: '商品名称', dataType: 2, source: 'productName' },
  { key: 'keywords', label: '搜索关键词', dataType: 2, source: 'keywords' },
  { key: 'productBrief', label: '商品描述', dataType: 2, source: 'productBrief' },
  { key: 'productDesc', label: '商品详情', dataType: 9, source: 'productDesc' },
];

export default function ProductTranslateModal({
  visible,
  productId,
  onCancel,
  onSaved,
}: {
  visible: boolean;
  productId?: number;
  onCancel: () => void;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locales, setLocales] = useState<LocaleRow[]>([]);
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);

  const load = async () => {
    if (!visible || !productId) return;
    setLoading(true);
    try {
      const [localesResult, detail] = await Promise.all([
        apiGet<any>('/lang/locales/list', { page: 1, size: 100 }),
        apiGet<any>('/product/product/detail', { id: productId }),
      ]);
      const localeRows: LocaleRow[] = localesResult?.records || localesResult?.list || localesResult || [];
      setLocales(localeRows);

      const defs = FIELD_DEFS.map((def) => ({
        key: def.key,
        groupKey: def.key,
        label: t(def.label),
        dataType: def.dataType,
        sourceName: String(detail?.[def.source] ?? '').trim(),
        translations: {} as Record<string, string>,
      }));
      // 商品详情只取纯文本段（对齐旧版：富文本仅翻译文本部分）
      const descRow = defs.find((row) => row.key === 'productDesc');
      if (descRow) descRow.sourceName = stripHtml(descRow.sourceName);
      setRows(defs.filter((row) => row.sourceName));

      // 读取既有译文（同一 (dataType, translationName) 一条记录）
      const uniq = new Map<string, { row: FieldRow; dataType: number; name: string }>();
      defs.forEach((row) => {
        if (row.sourceName) uniq.set(`${row.dataType}|${row.sourceName}`, { row, dataType: row.dataType, name: row.sourceName });
      });
      await Promise.all(
        Array.from(uniq.values()).map(async ({ row, dataType, name }) => {
          try {
            const result = await apiGet<any>('/lang/translations/getTranslations', {
              id: productId,
              dataType,
              translationName: name,
            });
            (result?.items || []).forEach((item: { localeId?: number; translationValue?: string }) => {
              if (item.localeId != null) {
                row.translations[String(item.localeId)] = item.translationValue || '';
              }
            });
          } catch {
            // 单条译文读取失败不阻塞
          }
        }),
      );
      setRows([...defs.filter((row) => row.sourceName)]);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载商品详情失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, productId]);

  const machineTranslate = async (row: FieldRow, locale: LocaleRow) => {
    const key = `${row.groupKey}|${row.sourceName}|${locale.id}`;
    setTranslatingKey(key);
    try {
      const result = (await apiPost<string>('/lang/currency/translation', {
        code: locale.localeCode || 'en',
        text: row.sourceName,
      })) as unknown as string;
      setRows((current) =>
        current.map((item) =>
          item === row
            ? { ...item, translations: { ...item.translations, [String(locale.id)]: String(result || '') } }
            : item,
        ),
      );
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('机器翻译失败') });
    } finally {
      setTranslatingKey(null);
    }
  };

  const save = async () => {
    const payload = rows
      .filter((row) => row.sourceName && Object.keys(row.translations).length)
      .map((row) => ({
        dataId: productId,
        dataType: row.dataType,
        translationName: row.sourceName,
        items: Object.entries(row.translations)
          .filter(([, text]) => text.trim())
          .map(([localeId, text]) => ({ localeId: Number(localeId), translationValue: text.trim() })),
      }));
    if (!payload.length) {
      Toast.warning({ content: t('请先填写或翻译至少一条译文') });
      return;
    }
    setSaving(true);
    try {
      const result = await apiPost<{ failCount?: number; successCount?: number }>(
        '/lang/translations/batchCreateTranslations',
        payload,
      );
      const failCount = result?.failCount ?? 0;
      if (failCount > 0) {
        Toast.warning({ content: t('部分译文保存失败：失败 {count} 条', { count: failCount }) });
      } else {
        Toast.success({ content: t('译文已保存') });
      }
      onSaved?.();
      onCancel();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const localeColumns = useMemo(
    () => locales.filter((locale) => Number(locale.id) > 0),
    [locales],
  );

  return (
    <Modal
      title={t('商品多语言翻译')}
      visible={visible}
      onCancel={onCancel}
      onOk={save}
      okButtonProps={{ loading: saving }}
      okText={t('保存')}
      cancelText={t('取消')}
      width={900}
    >
      <Spin spinning={loading}>
        {rows.length === 0 && !loading ? (
          <Empty description={t('该商品暂无可翻译内容')} />
        ) : (
          <div className="product-translate">
            {rows.map((row) => (
              <div key={`${row.groupKey}-${row.dataType}`} className="product-translate-row">
                <div className="product-translate-head">
                  <Text strong>{row.label}</Text>
                  <Text type="tertiary" size="small" className="product-translate-source">
                    {row.sourceName.slice(0, 60)}
                    {row.sourceName.length > 60 ? '…' : ''}
                  </Text>
                </div>
                <div className="product-translate-locales">
                  {localeColumns.map((locale) => (
                    <div key={String(locale.id)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 110, flexShrink: 0 }}>{locale.language || locale.localeCode}</span>
                      {row.dataType === 9 ? (
                        <TextArea
                          value={row.translations[String(locale.id)] || ''}
                          autosize={{ minRows: 2, maxRows: 6 }}
                          onChange={(next) =>
                            setRows((current) =>
                              current.map((item) =>
                                item === row
                                  ? {
                                      ...item,
                                      translations: { ...item.translations, [String(locale.id)]: next },
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      ) : (
                        <Input
                          value={row.translations[String(locale.id)] || ''}
                          onChange={(next) =>
                            setRows((current) =>
                              current.map((item) =>
                                item === row
                                  ? {
                                      ...item,
                                      translations: { ...item.translations, [String(locale.id)]: next },
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      )}
                      <Button
                        size="small"
                        loading={translatingKey === `${row.groupKey}|${row.sourceName}|${locale.id}`}
                        onClick={() => machineTranslate(row, locale)}
                      >
                        {t('机器翻译')}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!loading && localeColumns.length === 0 && (
              <Empty description={t('暂无可用语言，请先在多语言管理中启用语言')} />
            )}
          </div>
        )}
      </Spin>
    </Modal>
  );
}
