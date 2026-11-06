import { useEffect, useRef, useState } from "react";
import Taro from "@tarojs/taro";

import { formatAnimation } from "@/components/modules";
import { getElementRect, getImageInfo } from "@/utils";
import { imageFormat } from "@/utils/format";

/**
 * 装修模块图片比例/高度测量（自旧 hooks/useDecorate.ts 的 useImgInfo 移植）。
 * 与 Vue 版差异：
 * - Vue 版基于 ref 同步读写；React 版内部用 imgratioRef 镜像最新比例，
 *   避免「await getImgratio() 后紧跟 getHeght()」读到尚未提交的旧 state。
 * - Vue 版通过 getCurrentInstance() 圈定查询范围；React 版由调用方传
 *   组件根节点的 useRef（传入 getElementRect 的 instance 参数）。
 * - 函数名保留旧版拼写 getHeght，便于与旧代码逐一对照。
 */
export const useImgInfo = () => {
    const [imgratio, setImgratioState] = useState(0);
    const imgratioRef = useRef(0);
    const [height, setHeight] = useState(0);

    const setImgratio = (value: number) => {
        imgratioRef.current = value;
        setImgratioState(value);
    };

    // 拉取图片信息并换算 高/宽 比例
    const getImgratio = async (url: string) => {
        try {
            const res = await getImageInfo(url);
            setImgratio(res.height / res.width);
        } catch (error) {
            console.error(error);
        }
    };

    // 测量 selector 元素宽度，按比例换算等比高度；column 为多列分栏时的列数
    const getHeght = async (selector: string, rootRef?: { current: any }, column?: number) => {
        try {
            if (!selector) return;
            const res = await getElementRect(selector, rootRef?.current);
            if (res) {
                setHeight(column ? (res.width / column) * imgratioRef.current : res.width * imgratioRef.current);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const updateImgInfo = async (imgUrl: string, selector: string, rootRef?: { current: any }) => {
        await getImgratio(imageFormat(imgUrl));
        await getHeght(selector, rootRef);
    };

    return {
        imgratio,
        setImgratio,
        height,
        getImgratio,
        getHeght,
        updateImgInfo
    };
};

/**
 * 装修模块滚动入场动画（自旧 hooks/useDecorate.ts 的 useAnimation 移植）。
 * 与 Vue 版差异：
 * - Vue 版基于 uni.createIntersectionObserver(instance) + getCurrentInstance() 圈定组件范围；
 *   React 版由调用方传组件根节点的 useRef（与 TigLazyImage 同款处理）。
 * - H5 端 Taro IntersectionObserver 观察自定义组件根节点不稳定，直接展示（不做隐藏动画）。
 * - show 为 React state：AnimationFormat/transitionDuration 在每次渲染时按最新 show 求值，
 *   对应 Vue 版 computed 依赖 show.value 的行为。
 */
export const useAnimation = (selector: string, animation: any, rootRef?: { current: any }) => {
    const [show, setShow] = useState(process.env.TARO_ENV === "h5");

    useEffect(() => {
        if (process.env.TARO_ENV === "h5") return;
        let observer: any;
        try {
            observer = Taro.createIntersectionObserver(rootRef?.current as any);
            observer.relativeToViewport({ top: 0, bottom: 10 }).observe(selector, (res: any) => {
                setShow(res.intersectionRatio > 0 ? true : false);
            });
        } catch (error) {
            setShow(true);
        }
        return () => {
            observer?.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const animationFormat = show
        ? `transform: translate(0px, 0px) scale(1) rotateY(0deg);opacity:1;`
        : formatAnimation(animation?.type || "", animation?.range || "");

    const transitionDuration = (index: number) => {
        return show
            ? `transition-duration:${index * Number(animation?.delay) + Number(animation?.duration)}s;`
            : `transition-duration:0s;`;
    };

    return {
        show,
        animationFormat,
        transitionDuration
    };
};
