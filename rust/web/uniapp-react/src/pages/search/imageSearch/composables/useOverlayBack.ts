import { useCallback, useEffect, useRef } from "react";

// 写在历史记录 state 里的标记，用来认出浮层占用的那一条记录
const MARK = "__imageSearchOverlay";

const isH5 = () => process.env.TARO_ENV === "h5";

/**
 * H5 浏览器返回与页内浮层同步（自旧 composables/useOverlayBack.ts 移植）
 * 浮层打开时多压一条同地址的历史记录，浏览器返回消耗这条记录并关闭浮层，而不是离开页面；
 * 浮层被按钮关闭时主动退掉这条记录，不留下无效的历史项。其它端不需要，由 onBackPress 处理。
 * @param isOpen 当前是否有浮层打开
 * @param close 关闭所有浮层
 * @returns release 立即退掉浮层占用的历史记录，离开页面前调用
 */
export function useOverlayBack(isOpen: () => boolean, close: () => void) {
    // 是否压着一条浮层历史记录
    const pushedRef = useRef(false);
    // 主动退记录后，等待忽略的 popstate 次数
    const swallowRef = useRef(0);
    const closeRef = useRef(close);
    closeRef.current = close;

    // 捕获阶段注册，先于路由自己的监听执行；仅 H5 需要
    useEffect(() => {
        if (!isH5()) return;
        const onPopState = (event: PopStateEvent) => {
            // 回到带标记的记录，说明是从别的页面（如商品详情）返回到浮层状态，交给路由处理
            if ((event.state as any)?.[MARK]) return;
            if (swallowRef.current > 0) {
                swallowRef.current--;
            } else if (pushedRef.current) {
                pushedRef.current = false;
                closeRef.current();
            } else {
                return;
            }
            // 这次返回没有离开页面，不能让路由当成页面跳转处理
            event.stopImmediatePropagation();
        };
        window.addEventListener("popstate", onPopState, true);
        return () => window.removeEventListener("popstate", onPopState, true);
    }, []);

    const release = useCallback(() => {
        if (!isH5() || !pushedRef.current) return;
        pushedRef.current = false;
        swallowRef.current++;
        window.history.back();
    }, []);

    // 对应旧 watch(isOpen)：打开时压一条记录，关闭时退掉
    const open = isOpen();
    useEffect(() => {
        if (!isH5()) return;
        if (!open) {
            release();
            return;
        }
        if (pushedRef.current) return;
        pushedRef.current = true;
        // 沿用当前记录的 state，路由和页面栈仍把它认作同一个页面
        window.history.pushState({ ...window.history.state, [MARK]: true }, "");
    }, [open, release]);

    return { release };
}