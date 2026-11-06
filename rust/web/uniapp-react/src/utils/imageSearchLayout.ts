import Taro from "@tarojs/taro";

const TOPBAR_HEIGHT = 44;
// 快门、相册按钮和上下留白所需的最小高度
const PANEL_MIN_HEIGHT = 132;

export interface CaptureLayout {
    windowWidth: number;
    windowHeight: number;
    statusBarHeight: number;
    safeBottom: number;
    topbarHeight: number;
    finderTop: number;
    finderHeight: number;
    panelTop: number;
    panelHeight: number;
}

/**
 * 拍摄页的成片范围：固定 3:4、宽度占满屏幕，放在屏幕正中
 * 定格和等待页把整个屏幕当显示区、图片居中完整显示，拍出的照片正好落在成片范围上，画面不跳动
 */
export function getCaptureLayout(): CaptureLayout {
    const sys = Taro.getSystemInfoSync();
    const windowWidth = sys.windowWidth || 375;
    const windowHeight = sys.windowHeight || 667;
    // H5 没有状态栏，取到的是 0，不能当成缺省值处理
    const statusBarHeight = sys.statusBarHeight ?? 20;
    const safeBottom = (sys as any).safeAreaInsets?.bottom ?? 0;
    const finderHeight = Math.round((windowWidth * 4) / 3);

    const finderTop = Math.max(Math.round((windowHeight - finderHeight) / 2), 0);

    // 屏幕较短时控制区压在成片范围底部，保证快门始终完整可见
    const panelHeight = Math.max(windowHeight - finderTop - finderHeight, PANEL_MIN_HEIGHT + safeBottom);
    const panelTop = windowHeight - panelHeight;

    return {
        windowWidth,
        windowHeight,
        statusBarHeight,
        safeBottom,
        topbarHeight: TOPBAR_HEIGHT,
        finderTop,
        finderHeight,
        panelTop,
        panelHeight
    };
}

export interface HeaderInsets {
    // 顶部留给状态栏的高度
    top: number;
    // 右侧留给微信小程序胶囊按钮的宽度，其它端为 0
    right: number;
}

/**
 * 自定义导航页顶部一行的避让尺寸
 * 微信小程序右上角有胶囊按钮：这一行与胶囊垂直居中对齐，右侧让出胶囊的宽度
 * @param rowCenter 这一行的垂直中心到行顶部的距离
 */
export function getHeaderInsets(rowCenter: number): HeaderInsets {
    const sys = Taro.getSystemInfoSync();
    let insets: HeaderInsets = { top: sys.statusBarHeight ?? 20, right: 0 };
    // #ifdef MP-WEIXIN
    if (process.env.TARO_ENV === "weapp") {
        const menu = Taro.getMenuButtonBoundingClientRect();
        insets = {
            top: Math.max(Math.round(menu.top + menu.height / 2 - rowCenter), 0),
            right: Math.round((sys.windowWidth || 375) - menu.left + 8)
        };
    }
    // #endif
    return insets;
}