import Taro from "@tarojs/taro";

import { getShellBridge } from "./nativeBridge";
import { hasZipEnd, isZipHeader, parseRawImageError, rawImageFilename, RawImageDownloadError } from "./productRawImageDownload";

/**
 * 原生（非浏览器）侧原图 ZIP 下载/导出工具
 * 自 uniapp src/utils/rawImageNativeDownload.ts 移植到 Taro：
 * - 小程序（weapp）分支改用 Taro.getFileSystemManager / Taro.downloadFile / Taro.shareFileMessage
 * - App 端形态已定案为 H5 壳（B6-6b-2）：下载/导出经 H5ShellBridge.downloadArchive + openFile
 *   （对齐旧 plus.downloader / plus.io / plus.runtime.openFile），非壳环境保持拒绝路径
 */

export interface NativeArchive {
    filename: string;
    exportFile: (onLateError?: (error: RawImageDownloadError) => void) => Promise<"shared" | "opened" | "cancelled">;
    cleanup: () => void;
}
export interface NativeDownload {
    promise: Promise<NativeArchive>;
    cancel: () => void;
}

function decodeText(bytes: Uint8Array): string {
    try { return decodeURIComponent(Array.from(bytes, (byte) => `%${byte.toString(16).padStart(2, "0")}`).join("")); }
    catch { return ""; }
}

export async function validateNativeArchive(
    size: number, read: (start: number, length: number) => Promise<Uint8Array>, status: number, headers: Record<string, string>
) {
    const head = size ? await read(0, Math.min(size, 4)) : new Uint8Array();
    if (status !== 200 || /json/i.test(headers["content-type"] || "") || !isZipHeader(head)) {
        throw parseRawImageError(size ? decodeText(await read(0, Math.min(size, 65536))) : "", status);
    }
    if (headers["content-type"] && !/^application\/(zip|x-zip-compressed|octet-stream)(\s*;|$)/i.test(headers["content-type"])) {
        throw new RawImageDownloadError("下载内容异常，请重试");
    }
    const length = Number(headers["content-length"]);
    if ((!headers["content-encoding"] && length > 0 && length !== size) ||
        !hasZipEnd(await read(Math.max(0, size - 65557), Math.min(size, 65557)))) {
        throw new RawImageDownloadError("下载文件不完整，请重试");
    }
}

export function downloadMiniArchive(url: string, headers: Record<string, string>, id: number): NativeDownload {
    let cancel = () => {};
    const promise = new Promise<NativeArchive>((resolve, reject) => {
        // 对应旧 #ifdef MP-WEIXIN：Taro 目标里等价为 weapp
        if (process.env.TARO_ENV !== "weapp") {
            reject(new RawImageDownloadError("当前版本不支持文件导出，请升级客户端"));
            return;
        }
        const fs = Taro.getFileSystemManager();
        let path = "";
        let cancelled = false;
        const responseHeaders: Record<string, string> = {};
        const cleanup = () => { if (path) { fs.unlink({ filePath: path, fail: () => {} }); path = ""; } };
        const task = Taro.downloadFile({
            url, header: headers, timeout: 120000,
            success: async (response) => {
                path = response.tempFilePath;
                try {
                    if (cancelled) { cleanup(); return; }
                    if (!path) throw parseRawImageError("", response.statusCode);
                    const size = await new Promise<number>((done, fail) => fs.getFileInfo({
                        filePath: path, success: (info) => done(info.size), fail
                    }));
                    const read = (start: number, length: number) => new Promise<Uint8Array>((done, fail) => fs.readFile({
                        filePath: path, position: start, length,
                        success: (data) => done(new Uint8Array(data.data as ArrayBuffer)), fail
                    }));
                    await validateNativeArchive(size, read, response.statusCode, responseHeaders);
                    if (cancelled) { cleanup(); return; }
                    const filename = rawImageFilename(responseHeaders["content-disposition"], id);
                    resolve({
                        filename, cleanup,
                        exportFile: () => new Promise((done, fail) => Taro.shareFileMessage({
                            filePath: path, fileName: filename,
                            success: () => done("shared"),
                            fail: (error) => /cancel/i.test(error.errMsg) ? done("cancelled") : fail(new RawImageDownloadError("文件导出失败，请重试"))
                        }))
                    });
                } catch (error) { cleanup(); reject(error); }
            },
            fail: () => { cleanup(); reject(new RawImageDownloadError("素材下载失败，请重试")); }
        });
        task.onHeadersReceived((event) => {
            Object.entries(event.header).forEach(([key, value]) => { responseHeaders[key.toLowerCase()] = String(value); });
        });
        cancel = () => {
            cancelled = true;
            task.abort();
            cleanup();
            reject(new RawImageDownloadError("已取消下载"));
        };
    });
    return { promise, cancel: () => cancel() };
}

export function downloadAppArchive(url: string, headers: Record<string, string>, id: number): NativeDownload {
    void headers;
    let cancel = () => {};
    const promise = new Promise<NativeArchive>((resolve, reject) => {
        // 旧 APP-PLUS 分支（plus.downloader / plus.io / plus.runtime.openFile）→ H5 壳桥
        const bridge = getShellBridge();
        if (!bridge?.downloadArchive || !bridge?.openFile) {
            reject(new RawImageDownloadError("当前版本不支持文件导出，请升级客户端"));
            return;
        }
        let cancelled = false;
        let filePath = "";
        void (async () => {
            try {
                const downloaded = await bridge.downloadArchive!(url, headers);
                if (cancelled) return;
                filePath = downloaded.path;
                const filename = rawImageFilename(
                    // 壳端若能回传 content-disposition 则优先；否则用商品 id 兜底命名
                    (downloaded as { contentDisposition?: string }).contentDisposition || "",
                    id
                );
                resolve({
                    filename,
                    cleanup: () => {
                        // 文件清理由壳端生命周期管理（对齐旧 plus.io 的 TEMP 目录回收）
                    },
                    exportFile: () =>
                        bridge
                            .openFile!(filePath)
                            .then(() => "opened" as const)
                            .catch(() => {
                                throw new RawImageDownloadError("文件导出失败，请重试");
                            })
                });
            } catch (error) {
                reject(
                    error instanceof RawImageDownloadError
                        ? error
                        : new RawImageDownloadError("素材下载失败，请重试")
                );
            }
        })();
        cancel = () => {
            cancelled = true;
            reject(new RawImageDownloadError("已取消下载"));
        };
    });
    return { promise, cancel: () => cancel() };
}
