/**
 * 浅层判断纯对象
 * 自旧 utils/deepMerge.ts 原样移植（分类页装修配置合并依赖）
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== "object") return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

/**
 * 深合并：source 覆盖 target，对纯对象递归合并，数组与基本类型直接覆盖
 * 仅用于装修配置合并（默认值 + 后台数据）
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T> | undefined | null): T {
    const result: Record<string, unknown> = { ...target };
    if (!source) return result as T;

    Object.keys(source).forEach((key) => {
        const targetValue = result[key];
        const sourceValue = (source as Record<string, unknown>)[key];

        if (sourceValue === undefined) return;

        if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
            result[key] = deepMerge(targetValue, sourceValue as Record<string, unknown>);
        } else {
            result[key] = sourceValue;
        }
    });

    return result as T;
}
