/**
 * 拼团相关工具（自旧 utils/groupon.ts 原样移植）
 */

/**
 * 从 groupNum JSON 中取最大成团人数
 * @param groupNum 规格 JSON 字符串（后端返回）
 * @returns 最大成团人数，解析失败返回 0
 */
export const getMaxGroupNumFromJson = (groupNum: string) => {
    if (!groupNum) {
        return 0;
    }

    try {
        const parsedGroupNum = JSON.parse(groupNum);
        if (!Array.isArray(parsedGroupNum)) {
            return 0;
        }

        return parsedGroupNum.reduce((maxGroupNum, item) => {
            const currentGroupNum = Number(item?.groupNum);
            if (!Number.isFinite(currentGroupNum)) {
                return maxGroupNum;
            }
            return Math.max(maxGroupNum, currentGroupNum);
        }, 0);
    } catch {
        return 0;
    }
};