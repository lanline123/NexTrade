/**
 * PC 分割线模块 - 预览组件
 *
 * 迁移自旧版（Vue）：
 * java-b2b2c-overseas-v5.8.61/view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-divider/Preview.vue
 * 样式逐行迁移自同目录 preview.less（见 ./pcDivider.css）。
 *
 * 说明：props 统一为 `{ data: Record<string, any> }`，内部与旧版 `pcDividerDefaults`
 * 深合并；DOM / 类名 / CSS 变量与旧版一致，`lineType === 2` 时才渲染分割线。
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import './pcDivider.css';

type AnyRecord = Record<string, any>;

/** 旧版 `pcDividerDefaults`（逐字段一致）。 */
const pcDividerDefaults: AnyRecord = {
  lineType: 2,
  lineStyle: 1,
  frame: {
    textColor: '',
    itemBackgroundColor: '',
    backgroundColor: '#ffffff',
    innerPadding: 0,
    itemHeight: 10,
    itemRadius: 0,
    boxRadius: 0,
    boxPadding: 10,
    boxPaddingTop: 5,
    boxPaddingBottom: 5,
  },
};

/** 旧版 `deepMerge`：嵌套普通对象递归合并，数组整体覆盖，`undefined` 保留默认值。 */
function deepMerge<T extends AnyRecord>(defaults: T, source?: AnyRecord): T {
  const result: AnyRecord = { ...defaults };
  if (!source || typeof source !== 'object') return result as T;
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const defaultValue = (defaults as AnyRecord)[key];
    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      defaultValue !== null &&
      typeof defaultValue === 'object' &&
      !Array.isArray(defaultValue)
    ) {
      result[key] = deepMerge(defaultValue as AnyRecord, sourceValue as AnyRecord);
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue;
    }
  }
  return result as T;
}

export default function PcDividerPreview({ data }: { data: Record<string, any> }): ReactNode {
  const moduleConfig = useMemo(() => deepMerge(pcDividerDefaults, data), [data]);

  const lineType = moduleConfig.lineType ?? 2;
  const lineStyle = moduleConfig.lineStyle ?? 1;

  const cssVars = useMemo(() => {
    const frame = (moduleConfig.frame || {}) as AnyRecord;
    return {
      '--dec-box-padding': `${frame.boxPadding ?? 10}px`,
      '--dec-box-padding-top': `${frame.boxPaddingTop ?? 5}px`,
      '--dec-box-padding-bottom': `${frame.boxPaddingBottom ?? 5}px`,
      '--dec-box-radius': `${frame.boxRadius ?? 0}px`,
      '--dec-bg-color': frame.backgroundColor ?? '#ffffff',
      '--dec-item-height': `${frame.itemHeight ?? 10}px`,
    } as CSSProperties;
  }, [moduleConfig.frame]);

  return (
    <div
      className={[
        'dec-divider',
        `dec-divider--type-${lineType}`,
        `dec-divider--style-${lineStyle}`,
      ].join(' ')}
      style={cssVars}
    >
      <div className="dec-divider__content">
        <div className="dec-divider__wrapper">
          {lineType === 2 ? <div className="dec-divider__line" /> : null}
        </div>
      </div>
    </div>
  );
}
