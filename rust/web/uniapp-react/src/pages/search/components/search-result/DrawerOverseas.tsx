import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Image, ScrollView, Text, View } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import { staticResource } from "@/utils";
import { useSafeAreaInsets } from "@/hooks";
import type { Brand, attrsData, attrsListData } from "@/types/search/search";
import { getAttrOptionText, isAttrSelected as checkAttrSelected, useSectionExpand } from "../../composables";
import { t } from "@/utils/i18n";
import Slider, { type SliderRef } from "../Slider";

import "./DrawerOverseas.scss";

interface Props {
    show: boolean;
    /** 对应旧 v-model:show / emit("update:show") */
    onShowChange?: (value: boolean) => void;
    brandList?: Brand[];
    brandIds?: number[];
    attrsList?: attrsListData[];
    attrs?: attrsData[];
    sort?: string;
    max?: number | string;
    maxPrice?: number;
    total?: number | string;
    isLoading?: boolean;
    /** 对应旧 emit("brandChange", item) */
    onBrandChange?: (item: Brand) => void;
    /** 对应旧 emit("attrClick", name, value) */
    onAttrClick?: (name: string, value: string) => void;
    /** 对应旧 emit("toggleNew") */
    onToggleNew?: () => void;
    /** 对应旧 emit("reset") */
    onReset?: () => void;
    /** 对应旧 emit("sliderMany", payload) */
    onSliderMany?: (payload: { minPrice: number; maxPrice: number }) => void;
}

export interface DrawerOverseasRef {
    /** 重置价格滑杆（对应旧 defineExpose initSlider） */
    initSlider?: () => void;
}

/**
 * 搜索结果页 - 海外版「所有筛选条件」底部弹层（自旧 drawer-overseas.vue 移植）
 * vortmall 尚未抽此弹层；此处按当前 o2o 即时筛选行为薄封装，展开态留在组件内。
 */
const DrawerOverseas = forwardRef<DrawerOverseasRef, Props>(function DrawerOverseas(
    {
        show,
        onShowChange,
        brandList = [],
        brandIds = [],
        attrsList = [],
        attrs = [],
        sort = "",
        max = "",
        maxPrice = 0,
        total = 0,
        isLoading = false,
        onBrandChange,
        onAttrClick,
        onToggleNew,
        onReset,
        onSliderMany
    }: Props,
    ref
) {
    const { safeBottom } = useSafeAreaInsets();

    const sliderRef = useRef<SliderRef>(null);
    const [brandShow, setBrandShow] = useState(true);
    const [otherShow, setOtherShow] = useState(true);
    const { isExpanded: isAttrExpanded, toggleExpand: toggleAttrShow } = useSectionExpand(true);

    useImperativeHandle(ref, () => ({
        initSlider: () => sliderRef.current?.init()
    }));

    const sliderCurrentMax = useMemo((): number | undefined => {
        const m = max;
        if (m === undefined || m === null || m === "") {
            return undefined;
        }
        return typeof m === "string" ? Number(m) : Number(m);
    }, [max]);

    const isAttrSelected = (name: string, value: string) => checkAttrSelected(attrs, name, value);

    const onSliderManyInner = (e: { minPrice: number; maxPrice: number }) => {
        onSliderMany?.(e);
    };

    return (
        // 旧 tig-popup 默认 bottom :z-index="900" :show-close="false"
        <Popup visible={show} position="bottom" zIndex={900} closeable={false} onClose={() => onShowChange?.(false)}>
            <View className="filter-box">
                <View className="popup-title-box">
                    <View className="title">{t("所有筛选条件")}</View>
                    <View className="close-icon" onClick={() => onShowChange?.(false)}>
                        <Image src={staticResource("order/close.png")} />
                    </View>
                </View>

                <ScrollView className="filter-content" scrollY>
                    {maxPrice && maxPrice > 0 ? (
                        <Slider ref={sliderRef} currentMax={sliderCurrentMax} maxPrice={maxPrice} onSliderMany={onSliderManyInner} />
                    ) : null}
                    <View className="filter">
                        <View className="tab_box">
                            <View
                                className="title-box flex justify-between align-center"
                                onClick={() => setBrandShow(!brandShow)}
                            >
                                <View className="txt">{t("品牌")}</View>
                                <View className={`more ${brandShow ? "avtive" : ""}`}>
                                    <Text className="iconfont-h5 icon-a-gengduo20" />
                                </View>
                            </View>
                            {brandShow ? (
                                <View className="tabs tabs--brand flex-wrap">
                                    {brandList.map((item, index) => (
                                        <View
                                            key={item.brandId || index}
                                            className={`item ${brandIds.includes(item.brandId) ? "active" : ""}`}
                                            onClick={() => onBrandChange?.(item)}
                                        >
                                            <Text className="line1">{item.brandName}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                        </View>
                        {attrsList.length > 0 ? (
                            <>
                                {attrsList.map((attr) => (
                                    <View key={attr.name} className="tab_box">
                                        <View
                                            className="title-box flex justify-between align-center"
                                            onClick={() => toggleAttrShow(attr.name)}
                                        >
                                            <View className="txt">{t(attr.name)}</View>
                                            <View className={`more ${isAttrExpanded(attr.name) ? "avtive" : ""}`}>
                                                <Text className="iconfont-h5 icon-a-gengduo20" />
                                            </View>
                                        </View>
                                        {isAttrExpanded(attr.name) ? (
                                            <View className="tabs flex-wrap">
                                                {attr.values.map((value, cIndex) => (
                                                    <View
                                                        key={`${attr.name}-${cIndex}`}
                                                        className={`item ${isAttrSelected(attr.name, getAttrOptionText(value)) ? "active" : ""}`}
                                                        onClick={() => onAttrClick?.(attr.name, getAttrOptionText(value))}
                                                    >
                                                        <Text className="line1">{t(getAttrOptionText(value))}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        ) : null}
                                    </View>
                                ))}
                            </>
                        ) : null}
                        <View className="tab_box">
                            <View
                                className="title-box flex justify-between align-center"
                                onClick={() => setOtherShow(!otherShow)}
                            >
                                <View className="txt">{t("其他")}</View>
                                <View className={`more ${otherShow ? "avtive" : ""}`}>
                                    <Text className="iconfont-h5 icon-a-gengduo20" />
                                </View>
                            </View>
                            {otherShow ? (
                                <View className="tabs flex-wrap">
                                    <View
                                        className={`item ${sort === "time" ? "active" : ""}`}
                                        onClick={() => onToggleNew?.()}
                                    >
                                        <Text className="line1">{t("新品")}</Text>
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </ScrollView>

                <View className={`btn-box ${safeBottom > 0 ? "safe-btn" : ""}`}>
                    {/* 旧 tig-button2（无主题：白底 + 默认描边）按视觉重写；ripple 动效未平移 */}
                    {/* TODO(MIGRATION)：tig-button2 的 ripple 涟漪/延迟点击动效未移植，保留即时点击 */}
                    <View
                        className="btn btn--default"
                        style={{ height: "70rpx" }}
                        onClick={() => {
                            onReset?.();
                        }}
                    >
                        {t("重置")}
                    </View>
                    <View
                        className="btn btn--theme"
                        style={{ height: "70rpx" }}
                        onClick={() => {
                            if (isLoading) return;
                            onShowChange?.(false);
                        }}
                    >
                        {isLoading ? (
                            <Text className="loading-circle" />
                        ) : (
                            <Text>
                                {t("显示")} {Number(total) || 0} {t("个结果")}
                            </Text>
                        )}
                    </View>
                </View>
            </View>
        </Popup>
    );
});

export default DrawerOverseas;
