import Taro from "@tarojs/taro";

import { useConfigStore } from "@/store/config";

/**
 * 装修页加载失败的统一处理：
 * - 仅识别后端"模板不存在"错误（避免误吞通用错误）
 * - 清除失效的 previewId，避免从 404 返回首页后再次用同一参数请求导致死循环
 * - 跳转到 404 页
 */
const INVALID_DECORATE_PAGE_MESSAGE = "模板不存在";

function isInvalidDecoratePageError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" && message === INVALID_DECORATE_PAGE_MESSAGE;
}

export async function handleDecorateLoadError(error: unknown): Promise<boolean> {
    if (!isInvalidDecoratePageError(error)) {
        return false;
    }

    // 清除失效的 previewId，避免从 404 返回首页后再次用同一参数请求导致死循环
    try {
        useConfigStore.getState().setPreviewId(0);
    } catch {
        // ignore
    }

    await Taro.redirectTo({
        url: "/pages/404/index"
    }).catch(() => {});
    return true;
}
