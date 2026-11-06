import Taro from "@tarojs/taro";

import { hasZipEnd, isZipHeader, parseRawImageError, rawImageFilename, RawImageDownloadError } from "./productRawImageDownload";

/**
 * 原生（非浏览器）侧原图 ZIP 下载/导出工具
 * 自 uniapp src/utils/rawImageNativeDownload.ts 移植到 Taro：
 * - 小程序（weapp）分支改用 Taro.getFileSystemManager / Taro.downloadFile / Taro.shareFileMessage
 * - APP-PLUS（plus.*）在 Taro（h5 / weapp）无对应运行时，暂未平移，见 downloadAppArchive 内 TODO(MIGRATION)
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
    void url;
    void headers;
    void id;
    let cancel = () => {};
    const promise = new Promise<NativeArchive>((resolve, reject) => {
        // TODO(MIGRATION)：uni-app 的 APP-PLUS 分支依赖 plus.downloader / plus.io / plus.runtime，
        // Taro（h5 / weapp）没有对应运行时，App 端原生下载暂未平移，保持与旧 #ifndef APP-PLUS 相同的拒绝路径。
        reject(new RawImageDownloadError("当前版本不支持文件导出，请升级客户端"));
    });
    return { promise, cancel: () => cancel() };
}
