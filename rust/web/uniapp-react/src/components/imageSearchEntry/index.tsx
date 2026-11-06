import { useCallback, useEffect, useRef } from "react";
import { Text, View } from "@tarojs/components";

import ImageSearchSourceSheet, { type ImageSearchSourceSheetRef } from "@/components/imageSearchSourceSheet";
import { useImageSearchStore } from "@/store/imageSearch";
import { startImageSearch, type ChooseSource } from "@/utils/imageSearchPick";

import "./index.scss";

interface Props {
    /** 店铺或门店内搜索时传入；空或负数表示全站 */
    shopId?: number | string;
    size?: string;
    color?: string;
    /** 搜索框自带右内边距时去掉入口右侧留白，避免右边距叠加 */
    flushRight?: boolean;
}

const isH5 = () => process.env.TARO_ENV === "h5";

/**
 * 商品搜索栏里的相机入口（自旧 components/imageSearchEntry/index.vue 移植）
 * 功能不可用时不渲染，不留空位；H5 用页面内的来源选择弹窗替代系统 actionSheet
 */
export default function ImageSearchEntry({ shopId, size = "40rpx", color = "#666", flushRight = false }: Props) {
    const available = useImageSearchStore((s) => s.available);
    const shopEnabled = useImageSearchStore((s) => s.shopEnabled);
    const fetchCapabilities = useImageSearchStore((s) => s.fetchCapabilities);

    useEffect(() => {
        void fetchCapabilities();
    }, [fetchCapabilities]);

    const sourceSheetRef = useRef<ImageSearchSourceSheetRef>(null);
    // ref 回调保持稳定，避免每次渲染重挂载
    const setSourceSheetRef = useCallback((instance: ImageSearchSourceSheetRef | null) => {
        sourceSheetRef.current = instance;
    }, []);

    const numericShopId = Number(shopId);
    const inShop = shopId !== undefined && shopId !== "" && Number.isFinite(numericShopId) && numericShopId >= 0;
    const scopedShopId = inShop ? numericShopId : undefined;

    // 店铺/门店内搜索还要看店铺开关
    const visible = scopedShopId !== undefined ? available && shopEnabled : available;

    const open = () => {
        const sheet = sourceSheetRef.current;
        const chooseSource: ChooseSource | undefined = sheet ? () => sheet.open() : undefined;
        void startImageSearch(scopedShopId, chooseSource);
    };

    return (
        <>
            {visible && (
                <View
                    className={`image-search-entry${flushRight ? " image-search-entry--flush" : ""}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        open();
                    }}
                >
                    <Text className="iconfont-h5 icon-xiangji1" style={{ fontSize: size, color }} />
                </View>
            )}
            {isH5() && <ImageSearchSourceSheet ref={setSourceSheetRef} />}
        </>
    );
}