/**
 * PC 空白辅助模块 - 预览组件
 *
 * 迁移自旧版（Vue）：
 * java-b2b2c-overseas-v5.8.61/view/admin/src/views/decorate/decorate/editor/modules/pcHome/pc-spacer/Preview.vue
 * 样式逐行迁移自同目录 preview.less（见 ./pcSpacer.css）。
 *
 * 说明：props 统一为 `{ data: Record<string, any> }`，内部与旧版 `pcSpacerDefaults`
 * 深合并；DOM / 类名 / CSS 变量与旧版一致（空白高度、背景色、内边距、圆角）。
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import './pcSpacer.css';

type AnyRecord = Record<string, any>;

/** 旧版 `pcSpacerDefaults`（逐字段一致）。 */
const pcSpacerDefaults: AnyRecord = {
  frame: {
    boxPadding: 0,
    boxPaddingTop: 0,
    boxPaddingBottom: 0,
    boxRadius: 0,
  },
  backgroundColor: '#ffffff',
  blankHeight: 30,
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

export default function PcSpacerPreview({ data }: { data: Record<string, any> }): ReactNode {
  const moduleConfig = useMemo(() => deepMerge(pcSpacerDefaults, data), [data]);

  const cssVars = useMemo(() => {
    const frame = (moduleConfig.frame || {}) as AnyRecord;
    return {
      '--dec-pc-spacer-height': `${moduleConfig.blankHeight ?? 30}px`,
      '--dec-pc-spacer-bg': moduleConfig.backgroundColor || 'transparent',
      '--dec-box-padding': `${frame.boxPadding ?? 0}px`,
      '--dec-box-padding-top': `${frame.boxPaddingTop ?? 0}px`,
      '--dec-box-padding-bottom': `${frame.boxPaddingBottom ?? 0}px`,
      '--dec-box-radius': `${frame.boxRadius ?? 0}px`,
    } as CSSProperties;
  }, [moduleConfig.blankHeight, moduleConfig.backgroundColor, moduleConfig.frame]);

  return (
    <div className="dec-pc-spacer" style={cssVars}>
      <div className="dec-pc-spacer__content"></div>
    </div>
  );
}
