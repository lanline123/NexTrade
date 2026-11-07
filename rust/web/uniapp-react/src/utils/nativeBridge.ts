/**
 * H5 壳（WebView 壳）JSBridge 层 —— B6-6b-2 App 端形态决策的落地件
 *
 * 背景：App 端形态已定案为「H5 壳」——复用 build:h5 产物，原生壳（Android/iOS）只负责
 * 容器 + 原生能力桥接（对齐旧 uni-app 5+ runtime 的角色）。壳在页面加载前向 window 注入
 * `H5ShellBridge` 对象；未注入（普通浏览器/微信内打开）时 isH5Shell() 为 false，
 * 所有调用点走既有 H5 兜底分支，行为不变。
 *
 * 壳端契约（与原生壳开发对齐的接口文档）：
 *   getAppVersion(): string                        壳版本号（旧 plus.runtime.getProperty）
 *   getOsName(): "android" | "ios"                 系统（旧 plus.os.name）
 *   openUrl(url: string): void                     系统浏览器/外部打开（旧 plus.runtime.openURL，含 app-settings:）
 *   saveImageToAlbum(url: string): Promise<void>   网络图片存相册
 *   downloadArchive(url, headers?): Promise<{ path: string }>  下载文件到沙盒（旧 plus.downloader）
 *   openFile(path: string): Promise<void>          用系统应用打开文件（旧 plus.runtime.openFile）
 *   requestPermission(permission: string): Promise<boolean>    权限申请（旧 plus.android.requestPermissions）
 *   checkPermission(permission: string): Promise<boolean>      权限查询
 *   setStatusBarStyle(style: "dark" | "light"): void           状态栏样式（旧 plus.navigator.setStatusBarStyle）
 *   registerBackHandler(handler: () => boolean): void          注册物理返回键拦截（返回 true = 已消费）
 *   unregisterBackHandler(handler: () => boolean): void
 *   isNativePluginAvailable(): boolean             原生插件可用性（旧 uni_modules image-search-camera 等）
 *   installUpdate(url: string, onProgress?: (progress: number) => void): Promise<void>
 *                                                  下载并静默安装更新包（旧 uni.downloadFile + plus.runtime.install），
 *                                                  resolve 即安装完成
 *   restartApp(): void                            重启应用（旧 plus.runtime.restart / 退出重启）
 */

export interface H5ShellBridge {
    getAppVersion?: () => string;
    getOsName?: () => string;
    openUrl?: (url: string) => void;
    saveImageToAlbum?: (url: string) => Promise<void>;
    downloadArchive?: (url: string, headers?: Record<string, string>) => Promise<{ path: string }>;
    openFile?: (path: string) => Promise<void>;
    requestPermission?: (permission: string) => Promise<boolean>;
    checkPermission?: (permission: string) => Promise<boolean>;
    setStatusBarStyle?: (style: "dark" | "light") => void;
    registerBackHandler?: (handler: () => boolean) => void;
    unregisterBackHandler?: (handler: () => boolean) => void;
    isNativePluginAvailable?: () => boolean;
    installUpdate?: (url: string, onProgress?: (progress: number) => void) => Promise<void>;
    restartApp?: () => void;
}

/** 壳注入的全局桥对象 key（壳端按此约定注入） */
export const SHELL_BRIDGE_KEY = "H5ShellBridge";

export function getShellBridge(): H5ShellBridge | null {
    if (process.env.TARO_ENV !== "h5") return null;
    const bridge = (globalThis as any)[SHELL_BRIDGE_KEY];
    return bridge && typeof bridge === "object" ? (bridge as H5ShellBridge) : null;
}

/** 是否运行在 H5 壳内（普通浏览器/微信内为 false） */
export function isH5Shell(): boolean {
    return getShellBridge() !== null;
}
