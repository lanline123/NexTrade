import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Text, View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./WaterfallLayout.scss";

type LayoutMode = "single" | "double";

interface Props {
    /** 数据列表 */
    list: any[];
    /** 布局模式: single(单列) | double(双列) */
    layout?: LayoutMode;
    /** 是否显示布局切换按钮 */
    showToggle?: boolean;
    /** 旧页面透传但组件未声明的属性（has-more / loading），仅保留接口兼容 */
    hasMore?: boolean;
    loading?: boolean;
    /** 旧具名插槽 #item */
    renderItem: (item: any, index: number) => ReactNode;
    /** 旧具名插槽 #itemRight（缺省回退 #item） */
    renderItemRight?: (item: any, index: number) => ReactNode;
    onLayoutChange?: (mode: LayoutMode) => void;
    onLoadMore?: () => void;
    onItemClick?: (item: any, index: number) => void;
}

/**
 * 瀑布流布局组件（自旧 buyerShowCompnents/WaterfallLayout.vue 移植）
 * - 双列按奇偶分配（旧实现即为奇偶分配，未按高度优化）
 * - 旧 #item / #itemRight 具名插槽 → renderItem / renderItemRight
 */
export default function WaterfallLayout({
    list,
    layout = "double",
    showToggle = false,
    hasMore: _hasMore,
    loading: _loading,
    renderItem,
    renderItemRight,
    onLayoutChange,
    onLoadMore: _onLoadMore,
    onItemClick
}: Props) {
    const [layoutMode, setLayoutMode] = useState<LayoutMode>(layout);

    useEffect(() => {
        setLayoutMode(layout);
    }, [layout]);

    const dataList = list;

    // 将数据分配到双列（简单按奇偶分配）
    const { leftColumnData, rightColumnData } = useMemo(() => {
        const left: any[] = [];
        const right: any[] = [];
        dataList.forEach((item, index) => {
            if (index % 2 === 0) left.push(item);
            else right.push(item);
        });
        return { leftColumnData: left, rightColumnData: right };
    }, [dataList]);

    // 计算列内数据在原列表中的索引
    const getColumnIndex = (column: "left" | "right", index: number) => (column === "left" ? index * 2 : index * 2 + 1);

    // 切换布局模式
    const switchLayout = (mode: LayoutMode) => {
        setLayoutMode(mode);
        onLayoutChange?.(mode);
    };

    // 项目点击事件
    const onItemClickInner = (item: any, index: number) => {
        onItemClick?.(item, index);
    };

    const renderRight = renderItemRight ?? renderItem;

    return (
        <View className="waterfall-layout">
            {/* 布局切换按钮 */}
            {showToggle && (
                <View className="layout-toggle">
                    <View className={`toggle-btn${layoutMode === "single" ? " active" : ""}`} onClick={() => switchLayout("single")}>
                        <Text className="iconfont icon-danlie">{t("单列")}</Text>
                    </View>
                    <View className={`toggle-btn${layoutMode === "double" ? " active" : ""}`} onClick={() => switchLayout("double")}>
                        <Text className="iconfont icon-shuanglie">{t("双列")}</Text>
                    </View>
                </View>
            )}

            {/* 瀑布流容器 */}
            <View className={`waterfall-container layout-${layoutMode}`}>
                {/* 单列布局 */}
                {layoutMode === "single" && (
                    <View className="single-column">
                        {dataList.map((item, index) => (
                            <View key={index} className="waterfall-item single-item" onClick={() => onItemClickInner(item, index)}>
                                {renderItem(item, index)}
                            </View>
                        ))}
                    </View>
                )}

                {/* 双列布局 */}
                {layoutMode === "double" && (
                    <View className="double-columns">
                        <View className="column left-column">
                            {leftColumnData.map((item, index) => (
                                <View
                                    key={`left-${index}`}
                                    className="waterfall-item double-item"
                                    onClick={() => onItemClickInner(item, getColumnIndex("left", index))}
                                >
                                    {renderItem(item, getColumnIndex("left", index))}
                                </View>
                            ))}
                        </View>

                        <View className="column right-column">
                            {rightColumnData.map((item, index) => (
                                <View
                                    key={`right-${index}`}
                                    className="waterfall-item double-item"
                                    onClick={() => onItemClickInner(item, getColumnIndex("right", index))}
                                >
                                    {renderRight(item, getColumnIndex("right", index))}
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}