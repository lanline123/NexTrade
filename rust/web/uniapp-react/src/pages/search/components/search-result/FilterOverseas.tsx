import { useMemo } from "react";
import { Text, View } from "@tarojs/components";

import type { attrsData, attrsListData, Brand } from "@/types/search/search";
import { t } from "@/utils/i18n";

import "./FilterOverseas.scss";

interface Props {
    /** 已选属性，用于在 pill 上显示选中数量 */
    selectedAttrs?: attrsData[];
    /** 当前排序字段，用于判断「新品」是否选中 */
    sort?: string;
    brandList?: Brand[];
    brandIds?: number[];
    attrList?: attrsListData[];
    sortPopup?: boolean;
    brandPopup?: boolean;
    attrPopup?: boolean;
    activeAttrIndex?: number;
    /** 对应旧 emit("showDrawer") */
    onShowDrawer?: () => void;
    /** 对应旧 emit("handleSort") */
    onHandleSort?: () => void;
    /** 对应旧 emit("brandClick") */
    onBrandClick?: () => void;
    /** 对应旧 emit("attrClick", attr, index) */
    onAttrClick?: (attr: attrsListData, index: number) => void;
    /** 对应旧 emit("toggleNew") */
    onToggleNew?: () => void;
}

/**
 * 海外版筛选栏（自旧 filter-overseas.vue 移植，layoutStyle=2）：
 * 横向可滚动的 pill 条，右侧渐隐箭头进「所有筛选条件」。
 * 属性弹层的展开态由父级 attrPopup + activeAttrIndex 表示，不往 attrsList 数据里塞 UI 状态。
 */
export default function FilterOverseas({
    selectedAttrs = [],
    sort = "",
    brandList = [],
    brandIds = [],
    attrList = [],
    sortPopup = false,
    brandPopup = false,
    attrPopup = false,
    activeAttrIndex = -1,
    onShowDrawer,
    onHandleSort,
    onBrandClick,
    onAttrClick,
    onToggleNew
}: Props) {
    const getSelectedAttrCount = (attrName: string) => {
        const matched = selectedAttrs.find((item) => item.attrName === attrName);
        return matched?.attrValue?.length ?? 0;
    };

    const isNewSelected = useMemo(() => sort === "time", [sort]);

    return (
        <View className="filter-overseas">
            <View className="filter-row">
                <View className="tab-box flex filterBoxW">
                    <View
                        className="tab-title"
                        onClick={() => {
                            onShowDrawer?.();
                        }}
                    >
                        <Text className="iconfont-h5 icon-a-gengduo11" />
                        <View>{t("筛选")}</View>
                    </View>

                    <View
                        className={`tab-title ${sortPopup ? "active" : ""}`}
                        onClick={() => {
                            onHandleSort?.();
                        }}
                    >
                        <View style={{ marginRight: "8rpx" }}>{t("排序")}</View>
                        {sortPopup ? <Text className="iconfont-h5 icon-up" /> : <Text className="iconfont-h5 icon-arrowdown" />}
                    </View>

                    {brandList.length > 0 ? (
                        <View
                            className={`tab-title ${brandIds.length > 0 || brandPopup ? "active" : ""}`}
                            onClick={() => {
                                onBrandClick?.();
                            }}
                        >
                            <View style={{ marginRight: "8rpx" }}>
                                {t("品牌")}
                                {brandIds.length > 0 ? <Text>({brandIds.length})</Text> : null}
                            </View>
                            {brandPopup ? <Text className="iconfont-h5 icon-up" /> : <Text className="iconfont-h5 icon-arrowdown" />}
                        </View>
                    ) : null}

                    {attrList.map((attr, index) => (
                        <View
                            key={attr.name}
                            className={`tab-title ${getSelectedAttrCount(attr.name) > 0 || (attrPopup && activeAttrIndex === index) ? "active" : ""}`}
                            onClick={() => {
                                onAttrClick?.(attr, index);
                            }}
                        >
                            <View style={{ marginRight: "8rpx" }}>
                                {t(attr.name)}
                                {getSelectedAttrCount(attr.name) > 0 ? <Text>({getSelectedAttrCount(attr.name)})</Text> : null}
                            </View>
                            {attrPopup && activeAttrIndex === index ? (
                                <Text className="iconfont-h5 icon-up" />
                            ) : (
                                <Text className="iconfont-h5 icon-arrowdown" />
                            )}
                        </View>
                    ))}

                    <View
                        className={`tab-title tab-title-new ${isNewSelected ? "active" : ""}`}
                        onClick={() => {
                            onToggleNew?.();
                        }}
                    >
                        <View>{t("新品")}</View>
                    </View>
                </View>
                <View
                    className="more-filter"
                    onClick={() => {
                        onShowDrawer?.();
                    }}
                >
                    <Text className="iconfont-h5 icon-arrowdown" />
                </View>
            </View>
        </View>
    );
}
