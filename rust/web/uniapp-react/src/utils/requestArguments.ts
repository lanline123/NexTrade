/**
 * 移除请求参数中的空值、空数组和空对象。
 */
export const formatArguments = (data?: AnyObject): AnyObject => {
    const result: AnyObject = {};
    if (!data || typeof data !== "object") {
        return result;
    }

    for (const key of Object.keys(data)) {
        const value = data[key];
        if (value === null || value === undefined || value === "" || value === "null" || value === "undefined") {
            continue;
        }
        if (typeof value === "object") {
            if (Array.isArray(value) && value.length === 0) {
                continue;
            }
            if (!Array.isArray(value) && Object.keys(value).length === 0) {
                continue;
            }
        }
        result[key] = value;
    }
    return result;
};
