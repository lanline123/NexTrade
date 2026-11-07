import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Taro from "@tarojs/taro";
import { useConfigStore } from "@/store/config";
import { useUserStore } from "@/store/user";
import { initConfigSettings } from "@/api/common";
import { baseUrl, requestHeader } from "@/utils/request";
import { handleLogin } from "@/utils/handleLogin";
import { currFullPath } from "@/utils";
import { t } from "@/utils/i18n";
import {
    canDownloadRawImages, fetchRawImageArchive, normalizeRawImageConfig, RawImageDownloadError, rawImageContextKey,
    rawImageDownloadUrl, saveRawImageBlob, validRawImageIntent, type RawImageContext
} from "@/utils/productRawImageDownload";
import { downloadAppArchive, downloadMiniArchive, type NativeArchive } from "@/utils/rawImageNativeDownload";

const intentKey = "product-raw-image-download-intent";

export interface UseProductRawImageDownloadReturn {
    /** 当前客户端是否开放原图下载入口（对应旧 computed visible） */
    visible: boolean;
    /** 是否正在下载 */
    busy: boolean;
    /** 发起下载（未登录时先记录意图并跳登录） */
    download: () => void;
    /** 页面 onShow 时调用（内部含 Taro 页面生命周期，不能在 hook 里注册，由页面组件接到 Taro.useDidShow） */
    onShow: () => void;
    /** 页面 onHide 时调用（由页面组件接到 Taro.useDidHide） */
    onHide: () => void;
    /** 页面卸载时调用（由页面组件接到 Taro.useUnload） */
    onUnload: () => void;
}

/**
 * 商品原图下载 Hook（自 uniapp pages/product/composables/useProductRawImageDownload.ts 移植）
 *
 * @description 素材 ZIP 下载：H5 走 fetch + blob 保存；weapp 走 Taro.downloadFile + shareFileMessage。
 * 登录意图缓存（intentKey）在跳转登录后回到本页时自动续传下载。
 *
 * 生命周期对接说明：旧实现内部使用 onShow / onHide / onUnload（uni-app 页面生命周期），
 * Taro 页面 hooks 只能在页面级使用，这里改为导出 onShow / onHide / onUnload 普通函数，
 * 由页面组件分别接到 Taro.useDidShow / Taro.useDidHide / Taro.useUnload。
 *
 * @param context 原图下载上下文（传 useProductDetail 的 rawImageContext state 值）
 * @param reloadDetail 详情重载函数（传 useProductDetail 的 reloadRawImageDetail）
 */
export function useProductRawImageDownload(context: RawImageContext | null, reloadDetail: () => Promise<unknown>): UseProductRawImageDownloadReturn {
    const config = useConfigStore();
    const token = useUserStore((state) => state.token);
    const authType = useUserStore((state) => state.authType);

    // context / visible / reloadDetail 会被异步回调与 effect 读写，统一「state + ref 镜像」双写
    const contextRef = useRef<RawImageContext | null>(context);
    contextRef.current = context;
    const reloadDetailRef = useRef(reloadDetail);
    reloadDetailRef.current = reloadDetail;

    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const setBusyBoth = useCallback((value: boolean) => {
        busyRef.current = value;
        setBusy(value);
    }, []);

    const generationRef = useRef(0);
    const activeRef = useRef(true);
    const disposedRef = useRef(false);
    const resumingRef = useRef(false);
    const cancelTransferRef = useRef<(() => void) | undefined>(undefined);
    const resourcesRef = useRef<Set<() => void>>(new Set());

    const visible = useMemo(
        () => !!context && canDownloadRawImages(config, config.XClientType),
        [context, config]
    );
    const visibleRef = useRef(visible);
    visibleRef.current = visible;

    const toast = useCallback((message: string) => Taro.showToast({ title: message, icon: "none" }), []);

    const cancel = useCallback(() => {
        generationRef.current++;
        cancelTransferRef.current?.();
        cancelTransferRef.current = undefined;
        setBusyBoth(false);
    }, [setBusyBoth]);

    const refreshConfig = useCallback(async () => {
        try {
            useConfigStore.setState(normalizeRawImageConfig(await initConfigSettings()));
        } catch {
            useConfigStore.setState(normalizeRawImageConfig());
        }
    }, []);

    const login = useCallback((snapshot: RawImageContext) => {
        Taro.setStorageSync(intentKey, { route: currFullPath(), context: rawImageContextKey(snapshot), expires: Date.now() + 600000 });
        handleLogin();
    }, []);

    const download = useCallback(async (resumed = false) => {
        const userState = useUserStore.getState();
        const configState = useConfigStore.getState();
        if (!activeRef.current || disposedRef.current || busyRef.current || !visibleRef.current || !contextRef.current) return;
        // 对应旧 #ifdef H5：微信内置浏览器引导用户到外部浏览器下载
        if (process.env.TARO_ENV === "h5" && configState.XClientType === "wechat") {
            Taro.showModal({ title: t("素材下载"), content: t("请通过右上角菜单在浏览器中打开本商品页，登录后下载ZIP文件。"), showCancel: false });
            return;
        }
        const snapshot = { ...contextRef.current };
        if (!userState.token) { if (!resumed) login(snapshot); return; }
        setBusyBoth(true);
        const current = ++generationRef.current;
        let timedOut = false;
        let native: NativeArchive | undefined;
        const timeout = setTimeout(() => { timedOut = true; cancelTransferRef.current?.(); }, 120000);
        try {
            const apiPrefix = process.env.TARO_APP_API_PREFIX || "/api/";
            const url = rawImageDownloadUrl(`${baseUrl}${apiPrefix}`, snapshot);
            const headers = requestHeader();
            if (process.env.TARO_ENV === "h5") {
                const abort = new AbortController();
                cancelTransferRef.current = () => abort.abort();
                const result = await fetchRawImageArchive(url, headers, abort.signal, snapshot.id);
                if (current !== generationRef.current || disposedRef.current) return;
                const revoke = saveRawImageBlob(result.blob, result.filename);
                const timer = setTimeout(release, 30000);
                function release() { clearTimeout(timer); revoke(); resourcesRef.current.delete(release); }
                resourcesRef.current.add(release);
                toast(t("已发起下载"));
            }
            if (process.env.TARO_ENV === "weapp") {
                const miniTask = downloadMiniArchive(url, headers, snapshot.id);
                cancelTransferRef.current = miniTask.cancel;
                native = await miniTask.promise;
            }
            // 对应旧 #ifdef APP-PLUS：H5 壳形态下经 H5ShellBridge.downloadArchive/openFile（见 rawImageNativeDownload）
            if (process.env.TARO_ENV !== "h5" && process.env.TARO_ENV !== "weapp") {
                const appTask = downloadAppArchive(url, headers, snapshot.id);
                cancelTransferRef.current = appTask.cancel;
                native = await appTask.promise;
            }
            clearTimeout(timeout);
            cancelTransferRef.current = undefined;
            if (native) {
                if (current !== generationRef.current || disposedRef.current) return;
                const archive = native;
                resourcesRef.current.add(archive.cleanup);
                const confirmed = await new Promise<boolean>((resolve) => Taro.showModal({
                    title: t("素材已准备好"),
                    content: archive.filename,
                    confirmText: t(useConfigStore.getState().XClientType === "miniProgram" ? "转发文件" : "打开文件"),
                    cancelText: t("取消"),
                    success: (result) => resolve(result.confirm),
                    fail: () => resolve(false)
                }));
                if (!confirmed || current !== generationRef.current || disposedRef.current) return;
                const outcome = await archive.exportFile((error) => {
                    if (!disposedRef.current) toast(t(error.message));
                });
                if (!disposedRef.current && outcome === "opened") toast(t("已请求打开文件，请在文件应用中保存"));
            }
        } catch (error) {
            if (current !== generationRef.current || disposedRef.current) return;
            if (error instanceof RawImageDownloadError && error.code === 401) {
                useUserStore.getState().clear();
                if (!resumed) login(snapshot);
                else toast(t("登录已失效，请重新登录"));
            } else {
                toast(timedOut ? t("素材下载超时，请重试") : error instanceof RawImageDownloadError
                    ? error.serverMessage ? error.message : t(error.message) : t("素材下载失败，请重试"));
                if (error instanceof RawImageDownloadError && !timedOut) {
                    await refreshConfig();
                    if (current === generationRef.current && error.code === 1001) await reloadDetailRef.current();
                }
            }
        } finally {
            clearTimeout(timeout);
            if (native) { resourcesRef.current.delete(native.cleanup); native.cleanup(); }
            if (current === generationRef.current) { setBusyBoth(false); cancelTransferRef.current = undefined; }
        }
    }, [login, refreshConfig, toast, setBusyBoth]);

    const resume = useCallback(async () => {
        if (!activeRef.current || disposedRef.current || resumingRef.current || !useUserStore.getState().token || !contextRef.current) return;
        const intent = Taro.getStorageSync(intentKey);
        if (!intent) return;
        Taro.removeStorageSync(intentKey);
        if (!validRawImageIntent(intent, currFullPath(), contextRef.current)) return;
        resumingRef.current = true;
        const route = currFullPath();
        try {
            await refreshConfig();
            if (disposedRef.current || !activeRef.current || route !== currFullPath()) return;
            await reloadDetailRef.current();
            if (!disposedRef.current && activeRef.current && contextRef.current && validRawImageIntent(intent, currFullPath(), contextRef.current)) await download(true);
        } finally { resumingRef.current = false; }
    }, [refreshConfig, download]);

    // 对应旧 watch(() => rawImageContextKey(context.value), ..., { flush: "sync" })：
    // 跳过首次挂载（旧 watch 非 immediate），上下文变化时取消进行中的下载并尝试续传
    const prevContextKeyRef = useRef(rawImageContextKey(context));
    const contextKey = rawImageContextKey(context);
    useEffect(() => {
        if (prevContextKeyRef.current === contextKey) return;
        prevContextKeyRef.current = contextKey;
        cancel();
        void resume();
    }, [contextKey, cancel, resume]);

    // 对应旧 watch(() => user.token, ...)：登录成功后自动续传
    const prevTokenRef = useRef(token);
    useEffect(() => {
        if (prevTokenRef.current === token) return;
        prevTokenRef.current = token;
        if (token) void resume();
    }, [token, resume]);

    // 对应旧 watch(() => user.authType, ...)：登出且未登录时清理下载意图
    const prevAuthTypeRef = useRef(authType);
    useEffect(() => {
        if (prevAuthTypeRef.current === authType) return;
        prevAuthTypeRef.current = authType;
        if (!authType && !useUserStore.getState().token) Taro.removeStorageSync(intentKey);
    }, [authType]);

    const onShow = useCallback(() => {
        activeRef.current = true;
        const userState = useUserStore.getState();
        if (!userState.token && !userState.authType) Taro.removeStorageSync(intentKey);
        void resume();
    }, [resume]);

    const onHide = useCallback(() => {
        activeRef.current = false;
        cancel();
    }, [cancel]);

    const onUnload = useCallback(() => {
        disposedRef.current = true;
        cancel();
        resourcesRef.current.forEach((cleanup) => cleanup());
        resourcesRef.current.clear();
    }, [cancel]);

    return { visible, busy, download: () => void download(false), onShow, onHide, onUnload };
}

export default useProductRawImageDownload;
