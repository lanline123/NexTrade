import Taro from "@tarojs/taro";

import { t } from "@/utils/i18n";

export type SearchImageSource = "camera" | "album";

export interface PickedSearchImage {
    path: string;
    source: SearchImageSource;
}

export interface CaptureClosedPayload {
    // 原生取景组件加载失败，调用方应降级到系统相机
    unavailable: boolean;
}

// App 是内嵌原生取景组件的 nvue 页面，微信小程序是用 camera 组件的普通页面
let capturePage = "/pages/imageSearch/capture";
// #ifdef MP-WEIXIN
if (process.env.TARO_ENV === "weapp") {
    capturePage = "/pages/imageSearch/captureMp";
}
// #endif
export const CAPTURE_PAGE = capturePage;
export const SEARCH_RESULT_PAGE = "/pages/search/image";

export const CAPTURE_CLOSED_EVENT = "imageSearch:captureClosed";

const PENDING_IMAGE_KEY = "imageSearchPendingImage";
const SEARCH_SHOP_KEY = "imageSearchShopId";
const SOURCES: SearchImageSource[] = ["camera", "album"];

// 本次运行中取景组件是否已确认不可用
let captureUnavailable = false;

/**
 * 把待搜索图片交给等待结果页
 * 拍摄页是 nvue，与 vue 页面不共享内存，也不把图片路径放进 URL，改用本地存储交接
 */
export function openSearchResult(picked: PickedSearchImage): void {
    Taro.setStorageSync(PENDING_IMAGE_KEY, picked);
    Taro.navigateTo({ url: SEARCH_RESULT_PAGE, animationType: "none", animationDuration: 0 } as any);
}

/** 结果页读取本次搜索限定的店铺；未限定返回 undefined */
export function getSearchShopId(): number | undefined {
    const shopId = Taro.getStorageSync(SEARCH_SHOP_KEY);
    return shopId === "" ? undefined : Number(shopId);
}

/** 等待结果页取走交接的图片，只能取一次 */
export function takePendingSearchImage(): PickedSearchImage | null {
    const picked = Taro.getStorageSync(PENDING_IMAGE_KEY) as PickedSearchImage | "";
    Taro.removeStorageSync(PENDING_IMAGE_KEY);
    return picked && picked.path ? picked : null;
}

// 拍摄页在 pages/imageSearch 分包，结果页在 pages/search 分包
function isImageSearchRoute(route: string): boolean {
    return route.startsWith("pages/imageSearch/") || `/${route}` === SEARCH_RESULT_PAGE;
}

/**
 * 退出整个以图搜图流程：连同拍摄页一起关闭，回到发起搜索的页面
 * 页面栈里只剩图搜页面时（如 H5 刷新后）回首页
 */
export function leaveImageSearch(): void {
    const pages = Taro.getCurrentPages();
    let delta = 0;
    while (delta < pages.length && isImageSearchRoute(pages[pages.length - 1 - delta].route || "")) delta++;
    if (delta > 0 && delta < pages.length) Taro.navigateBack({ delta });
    else Taro.reLaunch({ url: "/pages/index/index" });
}

/** 选择拍照或相册；取消返回 null */
export type ChooseSource = () => Promise<SearchImageSource | null>;

/** 系统 actionSheet 选择来源，H5 由页面传入 up-action-sheet 实现替代 */
function chooseSourceBySystem(): Promise<SearchImageSource | null> {
    return new Promise((resolve) => {
        Taro.showActionSheet({
            itemList: [t("拍照"), t("从相册选择")],
            success: ({ tapIndex }) => resolve(SOURCES[tapIndex] ?? null),
            fail: () => resolve(null)
        });
    });
}

/** 系统相机或系统选图，一次一张；用户取消任一步都返回 null */
async function pickBySystem(chooseSource: ChooseSource = chooseSourceBySystem): Promise<PickedSearchImage | null> {
    const source = await chooseSource();
    if (!source) return null;
    return new Promise((resolve) => {
        Taro.chooseImage({
            count: 1,
            sourceType: [source],
            sizeType: ["compressed"],
            success: (res) => {
                const path = res.tempFilePaths?.[0];
                resolve(path ? { path, source } : null);
            },
            fail: () => resolve(null)
        });
    });
}

// #ifdef APP-PLUS || MP-WEIXIN
/** 打开拍摄页，拍摄页拿到图片后自己进入等待页；直到它关闭才返回，返回 false 表示取景组件不可用 */
function openCapture(): Promise<boolean> {
    return new Promise((resolve) => {
        const onClosed = (payload: CaptureClosedPayload) => {
            Taro.eventCenter.off(CAPTURE_CLOSED_EVENT, onClosed);
            resolve(!payload?.unavailable);
        };
        Taro.eventCenter.on(CAPTURE_CLOSED_EVENT, onClosed);
        Taro.navigateTo({
            url: CAPTURE_PAGE,
            fail: () => {
                Taro.eventCenter.off(CAPTURE_CLOSED_EVENT, onClosed);
                resolve(false);
            }
        });
    });
}
// #endif

/**
 * 从搜索入口发起以图搜图：取图并进入等待结果页
 * App 由拍摄页定格后直接进入等待页，保证画面连续；降级路径取图后同样进入等待页
 * @param shopId 从店铺或门店内的搜索栏进入时传入，结果只在该店范围内
 * @param chooseSource H5 传入页面内的来源选择弹窗，不传使用系统 actionSheet
 */
export async function startImageSearch(shopId?: number, chooseSource?: ChooseSource): Promise<void> {
    // App 拍摄页是 nvue，不共享内存，店铺范围和图片一样用本地存储交给结果页
    if (shopId === undefined) Taro.removeStorageSync(SEARCH_SHOP_KEY);
    else Taro.setStorageSync(SEARCH_SHOP_KEY, shopId);
    // #ifdef APP-PLUS || MP-WEIXIN
    if (process.env.TARO_ENV === "weapp") {
        if (!captureUnavailable) {
            if (await openCapture()) return;
            captureUnavailable = true;
        }
    }
    // #endif
    const picked = await pickBySystem(chooseSource);
    if (picked) openSearchResult(picked);
}