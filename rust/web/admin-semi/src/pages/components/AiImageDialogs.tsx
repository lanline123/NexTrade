import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Spin,
  Toast,
} from '@douyinfe/semi-ui';
import { IconTick } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../../api';
import i18n, { useI18n } from '../../i18n';

/**
 * AI 图片处理弹窗集合（对应原版 v5.8.61 views/file/aiImage/*）：
 * - AiTranslateDialog  对应 AiTranslateLanguageDialog.vue（语言选择）+ AiBatchTranslateDialog.vue（执行/预览）的单图合并版；
 *   原版为「同步接口返回结果」，无任务轮询，这里照抄。
 * - AiEraseDialog      对应 AiEraseDialog.vue：原版交互是"选项式消除"（勾选消除类型→由后端 OCR 整图消除文字），
 *   并非画笔涂抹/框选，这里照原版实现，不做 canvas 涂抹。
 *
 * 接口（与原版 api/file/aiImage.ts 路径一致）：
 * - GET  /file/aiImage/getTranslateConfig  → { sourceLanguageList: [{language, languageName}] }
 * - POST /file/aiImage/localesList         → 语言列表（含 supportedAsTarget 的原版契约；Rust 端暂不返回该字段，缺省视为支持）
 * - POST /file/aiImage/translate           → { results: [{originalUrl, translatedUrl, success, errorMsg}] }（同步，耗时较长）
 * - POST /file/aiImage/inpaint             → { results: [{originalUrl, resultUrl, success, errorMsg}] }（同步，耗时较长）
 */

interface SourceLanguageItem {
  language: string;
  languageName: string;
}

interface TranslateConfig {
  sourceLanguageList?: SourceLanguageItem[];
}

interface AiImageLocale {
  id: number;
  localeCode: string;
  language: string;
  supportedAsTarget?: boolean;
}

interface TranslateResultItem {
  originalUrl: string;
  translatedUrl?: string;
  success?: boolean;
  errorMsg?: string;
}

interface InpaintResultItem {
  originalUrl: string;
  resultUrl?: string;
  success?: boolean;
  errorMsg?: string;
}

interface AiImageDialogBaseProps {
  visible: boolean;
  imageUrl: string;
  onCancel: () => void;
  onOk: (resultUrl: string) => void;
}

/** 原版单次处理最少展示 1.5s 加载，避免闪烁 */
const MIN_LOADING_MS = 1500;

const ensureMinLoading = async (startAt: number) => {
  const elapsed = Date.now() - startAt;
  if (elapsed < MIN_LOADING_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS - elapsed));
  }
};

/**
 * 读取 AI 图片处理开关（兼容 Rust 返回 {enabled:boolean} 与原版 {aiImageEnabled:0|1} 两种形态）。
 * 该函数不是 React 组件、无法使用 useI18n Hook，因此直接读取全局 i18n 实例。
 */
export async function ensureAiImageEnabled(): Promise<boolean> {
  try {
    const settings = await apiGet<any>('/setting/config/aiImageSettings');
    const enabled = settings?.enabled === true || Number(settings?.aiImageEnabled) === 1;
    if (!enabled) {
      Toast.warning({ content: i18n.t('请先在「AI设置」中启用图片智能处理并配置密钥') });
      return false;
    }
    return true;
  } catch (error) {
    Toast.error({ content: error instanceof Error ? error.message : i18n.t('读取AI图片处理设置失败') });
    return false;
  }
}

/* ==================================================================
   AI 图片翻译弹窗
================================================================== */
export function AiTranslateDialog({ visible, imageUrl, onCancel, onOk }: AiImageDialogBaseProps) {
  const { t } = useI18n();
  const [configLoading, setConfigLoading] = useState(false);
  const [sourceLanguageList, setSourceLanguageList] = useState<SourceLanguageItem[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [targetLocales, setTargetLocales] = useState<AiImageLocale[]>([]);
  const [localesLoading, setLocalesLoading] = useState(false);
  const [targetCodes, setTargetCodes] = useState<string[]>([]);
  const [translateText, setTranslateText] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [results, setResults] = useState<Array<{ targetCode: string; item: TranslateResultItem }>>([]);
  const requestIdRef = useRef(0);

  const successUrl =
    results.find((entry) => entry.item.success && entry.item.translatedUrl)?.item.translatedUrl || '';

  const loadLocales = async (source: string) => {
    if (!source) {
      setTargetLocales([]);
      setTargetCodes([]);
      return;
    }
    const requestId = ++requestIdRef.current;
    setLocalesLoading(true);
    try {
      const locales = await apiPost<AiImageLocale[]>('/file/aiImage/localesList', {
        sourceLanguage: source,
        isEnabled: 1,
      });
      if (requestId !== requestIdRef.current) return;
      const list = (Array.isArray(locales) ? locales : []).filter((item) => item.localeCode);
      setTargetLocales(list);
      // 原版多语言保存流：默认全选受支持的目标语言
      setTargetCodes(
        list.filter((item) => item.supportedAsTarget !== false).map((item) => item.localeCode),
      );
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setTargetLocales([]);
      setTargetCodes([]);
      Toast.error({ content: error instanceof Error ? error.message : t('加载目标语言失败') });
    } finally {
      if (requestId === requestIdRef.current) setLocalesLoading(false);
    }
  };

  useEffect(() => {
    if (!visible || !imageUrl) return;
    setResults([]);
    setTranslating(false);
    let alive = true;
    const init = async () => {
      setConfigLoading(true);
      try {
        const config = await apiGet<TranslateConfig>('/file/aiImage/getTranslateConfig');
        if (!alive) return;
        const list = config?.sourceLanguageList || [];
        setSourceLanguageList(list);
        const zhItem = list.find((item) => /^zh/i.test(item.language));
        const nextSource = zhItem?.language || list[0]?.language || '';
        setSourceLanguage(nextSource);
        await loadLocales(nextSource);
      } catch (error) {
        if (alive) {
          Toast.error({ content: error instanceof Error ? error.message : t('加载翻译配置失败') });
        }
      } finally {
        if (alive) setConfigLoading(false);
      }
    };
    init();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, imageUrl]);

  const handleSourceChange = (next: string) => {
    setSourceLanguage(next);
    loadLocales(next);
  };

  const handleClose = () => {
    if (translating) {
      Toast.warning({ content: t('图片正在翻译中，关闭后当前进度将不会保留') });
      return;
    }
    onCancel();
  };

  const handleTranslate = async () => {
    if (!sourceLanguage) {
      Toast.warning({ content: t('请选择原语言') });
      return;
    }
    const codes = targetLocales
      .filter((item) => targetCodes.includes(item.localeCode) && item.supportedAsTarget !== false)
      .map((item) => item.localeCode);
    if (!codes.length) {
      Toast.warning({ content: t('请选择目标语言') });
      return;
    }
    setTranslating(true);
    setResults([]);
    const startAt = Date.now();
    try {
      const collected: Array<{ targetCode: string; item: TranslateResultItem }> = [];
      // 原版多语言流按目标语言逐次调用同步 translate 接口，这里保持一致
      for (const target of codes) {
        const response = await apiPost<{ results?: TranslateResultItem[] }>('/file/aiImage/translate', {
          imgUrls: [imageUrl],
          sourceLanguage,
          targetLanguage: target,
          // 原版发 1/0；Rust 端按布尔读取才能让该勾选生效，故发布尔
          isTranslateProductText: translateText,
        });
        const item = response?.results?.[0];
        if (item) {
          collected.push({ targetCode: target, item });
        }
      }
      await ensureMinLoading(startAt);
      setResults(collected);
      const successCount = collected.filter((entry) => entry.item.success && entry.item.translatedUrl).length;
      if (successCount === codes.length) {
        Toast.success({ content: t('翻译完成') });
      } else if (successCount > 0) {
        Toast.warning({ content: t('部分语言翻译失败') });
      } else {
        Toast.error({ content: t('翻译失败，请重新尝试翻译') });
      }
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('翻译失败') });
    } finally {
      setTranslating(false);
    }
  };

  const targetName = (code: string) =>
    targetLocales.find((item) => item.localeCode === code)?.language || code;

  return (
    <Modal
      title={t('AI图片翻译')}
      visible={visible}
      onCancel={handleClose}
      maskClosable={false}
      width={720}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {results.length > 0 ? (
            <>
              <Button onClick={handleClose}>{t('关闭')}</Button>
              <Button theme="solid" type="primary" disabled={!successUrl} onClick={() => successUrl && onOk(successUrl)}>
                {t('应用翻译结果')}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleClose} disabled={translating}>
                {t('取消')}
              </Button>
              <Button theme="solid" type="primary" loading={translating} onClick={handleTranslate}>
                {t('开始翻译')}
              </Button>
            </>
          )}
        </div>
      }
    >
      <Spin spinning={configLoading}>
        {translating ? (
          <div style={{ padding: '8px 0 4px' }}>
            <div
              style={{
                padding: '8px 12px',
                border: '1px solid #ffe58f',
                borderRadius: 6,
                background: '#fffbe6',
                color: '#8c6d1f',
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              {t('翻译中请勿刷新或关闭页面，否则可能导致翻译失败！')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
              <Spin size="large" tip={t('翻译中')} />
            </div>
          </div>
        ) : results.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {results.map((entry) => (
              <div
                key={entry.targetCode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: 8,
                }}
              >
                <div style={{ width: 120, flexShrink: 0, fontSize: 13, fontWeight: 500 }}>
                  {targetName(entry.targetCode)}
                </div>
                {entry.item.success && entry.item.translatedUrl ? (
                  <img
                    src={entry.item.translatedUrl}
                    alt={t('翻译结果')}
                    style={{ maxHeight: 120, maxWidth: 320, objectFit: 'contain', borderRadius: 6 }}
                  />
                ) : (
                  <span style={{ color: 'var(--semi-color-danger)', fontSize: 13 }}>
                    {entry.item.errorMsg || t('翻译失败')}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ marginBottom: 10, fontWeight: 500 }}>
                <span style={{ color: 'var(--semi-color-danger)' }}>*</span> {t('原语言选择')}
              </div>
              <RadioGroup value={sourceLanguage} onChange={(event) => handleSourceChange(event.target.value)}>
                {sourceLanguageList.map((lang) => (
                  <Radio key={lang.language} value={lang.language}>
                    {lang.languageName}
                  </Radio>
                ))}
              </RadioGroup>
            </div>
            <div>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>
                <span style={{ color: 'var(--semi-color-danger)' }}>*</span> {t('目标语言选择')}
              </div>
              <div style={{ marginBottom: 8, color: 'var(--semi-color-text-2)', fontSize: 12 }}>
                {t('多选，根据后台已设置的语言进行显示')}
              </div>
              <Spin spinning={localesLoading}>
                {targetLocales.length ? (
                  <Select
                    multiple
                    showClear
                    filter
                    placeholder={t('请选择目标语言')}
                    optionList={targetLocales.map((item) => ({
                      label:
                        item.supportedAsTarget === false
                          ? `${item.language}${t('（暂不支持）')}`
                          : item.language,
                      value: item.localeCode,
                      disabled: item.supportedAsTarget === false,
                    }))}
                    value={targetCodes}
                    onChange={(next) => setTargetCodes((next as string[]) || [])}
                    style={{ width: '100%' }}
                  />
                ) : (
                  <div style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}>
                    {t('暂无可用目标语言，请先在「语言管理」中启用至少一种语言')}
                  </div>
                )}
              </Spin>
            </div>
            <div>
              <div style={{ marginBottom: 10, fontWeight: 500 }}>{t('更多设置')}</div>
              <Checkbox checked={translateText} onChange={(event) => setTranslateText(Boolean(event.target.checked))}>
                {t('翻译商品主体文字')}
              </Checkbox>
            </div>
          </div>
        )}
      </Spin>
    </Modal>
  );
}

/* ==================================================================
   AI 擦除（智能消除）弹窗
================================================================== */
/** label 为 i18n key，渲染时通过 t() 转换 */
const INPAINT_MODES = [{ value: 'text', label: '消除文字' }];

export function AiEraseDialog({ visible, imageUrl, onCancel, onOk }: AiImageDialogBaseProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<'options' | 'preview'>('options');
  const [selectedOptions, setSelectedOptions] = useState<string[]>(['text']);
  const [erasing, setErasing] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!visible) return;
    setStep('options');
    setSelectedOptions(['text']);
    setResultUrl('');
    setFailed(false);
    setErrorMsg('');
  }, [visible, imageUrl]);

  const toggleOption = (value: string) => {
    setSelectedOptions((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : current.concat(value),
    );
  };

  const handleClose = () => {
    if (erasing) {
      Toast.warning({ content: t('图片正在消除中，关闭后当前进度将不会保留') });
      return;
    }
    onCancel();
  };

  const handleStartErase = async () => {
    if (!selectedOptions.length || !imageUrl) return;
    setStep('preview');
    await eraseCurrent();
  };

  const eraseCurrent = async () => {
    if (!imageUrl || erasing) return;
    setErasing(true);
    setResultUrl('');
    setFailed(false);
    setErrorMsg('');
    const startAt = Date.now();
    let succeed = false;
    try {
      const result = await apiPost<{ results?: InpaintResultItem[] }>('/file/aiImage/inpaint', {
        imgUrls: [imageUrl],
        inpaintOptions: selectedOptions,
      });
      const first = result?.results?.[0];
      if (first?.success && first.resultUrl) {
        setResultUrl(first.resultUrl);
        succeed = true;
      } else {
        setFailed(true);
        setErrorMsg(first?.errorMsg || '');
      }
    } catch (error) {
      setFailed(true);
      setErrorMsg(error instanceof Error ? error.message : '');
    } finally {
      await ensureMinLoading(startAt);
      setErasing(false);
    }
    if (succeed) {
      Toast.success({ content: t('操作成功') });
    } else {
      Toast.error({ content: t('消除失败，请重新尝试消除') });
    }
  };

  return (
    <Modal
      title={t('AI智能消除')}
      visible={visible}
      onCancel={handleClose}
      maskClosable={false}
      width={760}
      footer={
        step === 'options' ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleClose}>{t('取消')}</Button>
            <Button theme="solid" type="primary" disabled={!selectedOptions.length} onClick={handleStartErase}>
              {t('立即消除')}
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setStep('options')} disabled={erasing}>
              {t('上一步')}
            </Button>
            <Button loading={erasing} disabled={!selectedOptions.length} onClick={eraseCurrent}>
              {t('重新消除')}
            </Button>
            <Button
              theme="solid"
              type="primary"
              disabled={erasing || !resultUrl}
              onClick={() => resultUrl && onOk(resultUrl)}
            >
              {t('应用消除结果')}
            </Button>
          </div>
        )
      }
    >
      {step === 'options' ? (
        <div style={{ padding: '8px 4px 4px' }}>
          <div style={{ marginBottom: 12, fontWeight: 500 }}>{t('文字消除图片')}</div>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={t('待消除图片')}
              style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, marginBottom: 20, display: 'block' }}
            />
          ) : null}
          <div style={{ marginBottom: 12, fontWeight: 500 }}>{t('智能消图')}</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {INPAINT_MODES.map((mode) => {
              const selected = selectedOptions.includes(mode.value);
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => toggleOption(mode.value)}
                  style={{
                    width: 140,
                    padding: '18px 8px',
                    border: `2px solid ${selected ? 'var(--semi-color-primary)' : 'var(--semi-color-border)'}`,
                    borderRadius: 10,
                    background: selected ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-bg-0)',
                    cursor: 'pointer',
                    fontSize: 14,
                    color: 'var(--semi-color-text-0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {selected ? <IconTick /> : null}
                  {t(mode.label)}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div
            style={{
              margin: '4px 0 12px',
              padding: '8px 12px',
              border: '1px solid #ffe58f',
              borderRadius: 6,
              background: '#fffbe6',
              color: '#8c6d1f',
              fontSize: 12,
            }}
          >
            {t('消除中请勿刷新或关闭页面，否则可能导致消除失败！')}
          </div>
          {erasing ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
              <Spin size="large" tip={t('消除中')} />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    alignSelf: 'flex-end',
                    display: 'inline-block',
                    padding: '0 8px',
                    borderRadius: 4,
                    background: 'var(--semi-color-text-2)',
                    color: '#fff',
                    fontSize: 12,
                    lineHeight: '22px',
                  }}
                >
                  {t('原图')}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    minHeight: 220,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--semi-color-fill-0)',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  {imageUrl ? (
                    <img src={imageUrl} alt={t('原图')} style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }} />
                  ) : null}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'inline-block',
                    padding: '0 8px',
                    borderRadius: 4,
                    background: 'var(--semi-color-primary)',
                    color: '#fff',
                    fontSize: 12,
                    lineHeight: '22px',
                  }}
                >
                  {t('消除图')}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    minHeight: 220,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--semi-color-fill-0)',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  {resultUrl ? (
                    <img src={resultUrl} alt={t('消除结果')} style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }} />
                  ) : failed ? (
                    <span style={{ color: 'var(--semi-color-danger)', fontSize: 13 }}>
                      {errorMsg || t('消除失败，请重新尝试消除')}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
