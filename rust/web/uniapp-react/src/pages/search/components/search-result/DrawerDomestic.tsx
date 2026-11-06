import { useEffect, useMemo, useState } from "react";
import { Input, ScrollView, Text, View } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";
import Taro from "@tarojs/taro";

import type { Brand, attrsData, attrsListData, filterSeleted } from "@/types/search/search";
import { getAttrOptionText, useAttrsSelection, useBrandSelection, useSectionExpand } from "../../composables";
import { t } from "@/utils/i18n";
import { useSafeAreaInsets } from "@/hooks";

import "./DrawerDomestic.scss";

interface Props {
    show: boolean;
    /** 对应旧 v-model:show / emit("update:show") */
    onShowChange?: (value: boolean) => void;
    shopId?: number | string;
    categoryList?: filterSeleted[];
    shopCategoryList?: filterSeleted[];
    brandList?: Brand[];
    brandIds?: number[];
    attrsList?: attrsListData[];
    attrs?: attrsData[];
    cat?: number | string;
    shopCategoryId?: number | string;
    min?: number | string;
    max?: number | string;
    /** 对应旧 emit("submit", data) */
    onSubmit?: (data: {
        brandIds: number[];
        attrs: attrsData[];
        cat: number | string;
        shopCategoryId: number | string;
        min: string | number;
        max: string | number;
    }) => void;
    /** 对应旧 emit("reset") */
    onReset?: () => void;
}

/**
 * 搜索结果页 - 国内版右侧筛选抽屉（自旧 drawer-domestic.vue 移植）
 * 对齐 vortmall drawer-domestic：打开时拷贝父级条件为本地草稿，确定后再回写；关闭不提交则丢弃草稿。
 */
export default function DrawerDomestic({
    show,
    onShowChange,
    shopId = "",
    categoryList = [],
    shopCategoryList = [],
    brandList = [],
    brandIds = [],
    attrsList = [],
    attrs = [],
    cat = 0,
    shopCategoryId = "",
    min = "",
    max = "",
    onSubmit,
    onReset
}: Props) {
    const { safeBottom } = useSafeAreaInsets();

    const [categoryShow, setCategoryShow] = useState(false);
    const [brandShow, setBrandShow] = useState(false);
    const { isExpanded: isAttrExpanded, toggleExpand: toggleAttrShow, resetExpand: resetAttrExpand } = useSectionExpand(true);

    const [localBrandIds, setLocalBrandIds] = useState<number[]>([]);
    const [localAttrs, setLocalAttrs] = useState<attrsData[]>([]);
    const [localCat, setLocalCat] = useState<number | string>(0);
    const [localShopCategoryId, setLocalShopCategoryId] = useState<number | string>("");
    const [localMin, setLocalMin] = useState<string | number>("");
    const [localMax, setLocalMax] = useState<string | number>("");

    const { onChangeBrand } = useBrandSelection(localBrandIds, setLocalBrandIds);
    const { isAttrSelected, onAttrClick } = useAttrsSelection(localAttrs, setLocalAttrs);

    const initLocalState = () => {
        setLocalBrandIds([...brandIds]);
        setLocalAttrs(attrs.map((item) => ({ ...item, attrValue: [...item.attrValue] })));
        setLocalCat(cat ?? 0);
        setLocalShopCategoryId(shopCategoryId ?? "");
        setLocalMin(min ?? "");
        setLocalMax(max ?? "");
        setCategoryShow(false);
        setBrandShow(false);
        resetAttrExpand(
            attrsList.map((item) => item.name),
            true
        );
    };

    // 对应旧 watch(props.show)：打开时重置本地草稿
    useEffect(() => {
        if (show) {
            initLocalState();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    const displayCategoryList = useMemo(() => {
        const list = categoryList ?? [];
        return list.length > 9 && !categoryShow ? list.slice(0, 9) : list;
    }, [categoryList, categoryShow]);

    const displayShopCategoryList = useMemo(() => {
        const list = shopCategoryList ?? [];
        return list.length > 9 && !categoryShow ? list.slice(0, 9) : list;
    }, [shopCategoryList, categoryShow]);

    const displayBrandList = useMemo(() => {
        const list = brandList ?? [];
        return list.length > 9 && !brandShow ? list.slice(0, 9) : list;
    }, [brandList, brandShow]);

    const onResetClick = () => {
        setLocalBrandIds([]);
        setLocalAttrs([]);
        setLocalCat(0);
        setLocalShopCategoryId("");
        setLocalMin("");
        setLocalMax("");
        onReset?.();
    };

    const onSubmitClick = () => {
        if (Number(localMin) > Number(localMax)) {
            Taro.showToast({
                title: t("最低价不能大于最高价"),
                icon: "none"
            });
            return;
        }
        onSubmit?.({
            brandIds: localBrandIds,
            attrs: localAttrs,
            cat: localCat,
            shopCategoryId: localShopCategoryId,
            min: localMin,
            max: localMax
        });
        onShowChange?.(false);
    };

    return (
        // 旧 tig-popup position="right" :z-index="900" :show-close="false"；
        // :deep(.popup-container) 的圆角改为 Popup style 上的 borderRadius（原样式位于旧 scss 首条规则）
        <Popup
            visible={show}
            position="right"
            zIndex={900}
            closeable={false}
            style={{ borderRadius: "15rpx 0 0 0" }}
            onClose={() => onShowChange?.(false)}
        >
            <View
                className="search_condition"
                onTouchMove={(e) => {
                    // 对应旧 @touchmove.stop
                    e.stopPropagation();
                }}
            >
                <ScrollView scrollY className="search_condition-scroll">
                    <View className="search_condition-box">
                        {(categoryList?.length ?? 0) > 0 || (shopCategoryList?.length ?? 0) > 0 ? (
                            <View className="tab_box">
                                <View className="title-box flex justify-between">
                                    <View className="txt">{t("分类")}</View>
                                    <View className="more" onClick={() => setCategoryShow(!categoryShow)}>
                                        <Text className="more-text">{categoryShow ? t("收起") : t("展开")}</Text>
                                        {categoryShow ? (
                                            <Text className="iconfont-h5 icon-up" style={{ fontSize: "16px", color: "#bfbfbf" }} />
                                        ) : (
                                            <Text className="iconfont-h5 icon-arrowdown" style={{ fontSize: "16px", color: "#bfbfbf" }} />
                                        )}
                                    </View>
                                </View>
                                {shopId ? (
                                    <View className="tabs flex-wrap">
                                        {displayShopCategoryList.map((item, index) => (
                                            <View
                                                key={index}
                                                className={`item ${localShopCategoryId == item.categoryId ? "active" : ""}`}
                                                onClick={() => setLocalShopCategoryId(item.categoryId ?? "")}
                                            >
                                                {localShopCategoryId == item.categoryId ? (
                                                    <Text className="iconfont-h5 icon-gouxuan" style={{ fontSize: "12px" }} />
                                                ) : null}
                                                {item.categoryName}
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <View className="tabs flex-wrap">
                                        {displayCategoryList.map((item, index) => (
                                            <View
                                                key={index}
                                                className={`item ${localCat == item.categoryId ? "active" : ""}`}
                                                onClick={() => setLocalCat(item.categoryId ?? 0)}
                                            >
                                                {localCat == item.categoryId ? (
                                                    <Text className="iconfont-h5 icon-gouxuan" style={{ fontSize: "12px" }} />
                                                ) : null}
                                                {item.categoryName}
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ) : null}

                        {(brandList?.length ?? 0) > 0 ? (
                            <View className="tab_box">
                                <View className="title-box flex justify-between">
                                    <View className="txt">{t("品牌")}</View>
                                    <View className="more" onClick={() => setBrandShow(!brandShow)}>
                                        <Text className="more-text">{brandShow ? t("收起") : t("展开")}</Text>
                                        {brandShow ? (
                                            <Text className="iconfont-h5 icon-up" style={{ fontSize: "16px", color: "#bfbfbf" }} />
                                        ) : (
                                            <Text className="iconfont-h5 icon-arrowdown" style={{ fontSize: "16px", color: "#bfbfbf" }} />
                                        )}
                                    </View>
                                </View>
                                <View className="tabs flex-wrap">
                                    {displayBrandList.map((item, index) => (
                                        <View
                                            key={index}
                                            className={`item ${localBrandIds.includes(item.brandId) ? "active" : ""}`}
                                            onClick={() => onChangeBrand(item)}
                                        >
                                            {localBrandIds.includes(item.brandId) ? (
                                                <Text className="iconfont-h5 icon-gouxuan" style={{ fontSize: "12px" }} />
                                            ) : null}
                                            {item.brandName}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ) : null}

                        {attrsList.length > 0 ? (
                            <>
                                {attrsList.map((item) => (
                                    <View key={item.name} className="tab_box">
                                        <View className="title-box flex justify-between">
                                            <View className="txt">{item.name}</View>
                                            {item.values.length > 9 ? (
                                                <View className="more" onClick={() => toggleAttrShow(item.name)}>
                                                    <Text className="more-text">{isAttrExpanded(item.name) ? t("收起") : t("展开")}</Text>
                                                    {isAttrExpanded(item.name) ? (
                                                        <Text className="iconfont-h5 icon-up" style={{ fontSize: "16px", color: "#bfbfbf" }} />
                                                    ) : (
                                                        <Text className="iconfont-h5 icon-arrowdown" style={{ fontSize: "16px", color: "#bfbfbf" }} />
                                                    )}
                                                </View>
                                            ) : null}
                                        </View>
                                        <View className="tabs flex-wrap">
                                            {(isAttrExpanded(item.name) ? item.values : item.values.slice(0, 9)).map((value, cIndex) => (
                                                <View
                                                    key={`${item.name}-${cIndex}`}
                                                    className={`item ${isAttrSelected(item.name, getAttrOptionText(value)) ? "active" : ""}`}
                                                    onClick={() => onAttrClick(item.name, getAttrOptionText(value))}
                                                >
                                                    {isAttrSelected(item.name, getAttrOptionText(value)) ? (
                                                        <Text className="iconfont-h5 icon-gouxuan" style={{ fontSize: "12px" }} />
                                                    ) : null}
                                                    <Text>{getAttrOptionText(value)}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                ))}
                            </>
                        ) : null}

                        <View className="tab_box">
                            <View className="title-box flex justify-between">
                                <View className="txt">{t("价格")}</View>
                            </View>
                            <View className="tabs flex justify-between align-center">
                                <Input
                                    className="uni-input"
                                    type="number"
                                    value={String(localMin)}
                                    placeholder={t("最低价")}
                                    onInput={(e) => setLocalMin(e.detail.value)}
                                />
                                <View className="xian" />
                                <Input
                                    className="uni-input"
                                    type="number"
                                    value={String(localMax)}
                                    placeholder={t("最高价")}
                                    onInput={(e) => setLocalMax(e.detail.value)}
                                />
                            </View>
                        </View>
                    </View>
                </ScrollView>
                <View className={`btn-box ${safeBottom > 0 ? "safe-btn" : ""}`}>
                    <View className="flex btn-flex">
                        <View className="btn" onClick={onResetClick}>
                            {t("重置")}
                        </View>
                        <View className="btn submit" onClick={onSubmitClick}>
                            {t("确定")}
                        </View>
                    </View>
                </View>
            </View>
        </Popup>
    );
}
