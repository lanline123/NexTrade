import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";

import { t } from "@/utils/i18n";
import type { SearchImageSource } from "@/utils/imageSearchPick";

import "./index.scss";

export interface ImageSearchSourceSheetRef {
    /** 打开弹窗，返回选择的来源；取消返回 null */
    open: () => Promise<SearchImageSource | null>;
}

/**
 * H5 以图搜图选择图片来源（自旧 components/imageSearchSourceSheet/index.vue 移植）
 * 旧版用 up-action-sheet；这里按同样的底部动作面板视觉用基础组件自绘。
 * TODO(MIGRATION)：旧版 teleport 到 body 以避开搜索栏的吸顶层级；Taro 端用最高层级兜底，若仍被遮挡再换 portal。
 */
const ImageSearchSourceSheet = forwardRef<ImageSearchSourceSheetRef>(function ImageSearchSourceSheet(_props, ref) {
    const [show, setShow] = useState(false);
    const resolverRef = useRef<((source: SearchImageSource | null) => void) | null>(null);

    // 组件先触发 select 再触发 close，只认第一次结果
    const settle = (source: SearchImageSource | null) => {
        setShow(false);
        resolverRef.current?.(source);
        resolverRef.current = null;
    };

    const open = (): Promise<SearchImageSource | null> => {
        settle(null);
        setShow(true);
        return new Promise((resolve) => {
            resolverRef.current = resolve;
        });
    };

    useImperativeHandle(ref, () => ({ open }));

    if (!show) return null;

    return (
        <View className="image-search-source-sheet">
            <View className="image-search-source-sheet__mask" onClick={() => settle(null)} />
            <View className="image-search-source-sheet__panel">
                <View className="image-search-source-sheet__action" onClick={() => settle("camera")}>
                    <Text className="image-search-source-sheet__action-text">{t("拍照")}</Text>
                </View>
                <View className="image-search-source-sheet__action" onClick={() => settle("album")}>
                    <Text className="image-search-source-sheet__action-text">{t("从相册选择")}</Text>
                </View>
                <View className="image-search-source-sheet__cancel" onClick={() => settle(null)}>
                    <Text className="image-search-source-sheet__action-text">{t("取消")}</Text>
                </View>
            </View>
        </View>
    );
});

export default ImageSearchSourceSheet;