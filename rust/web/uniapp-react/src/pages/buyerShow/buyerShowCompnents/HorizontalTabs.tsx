import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { t } from "@/utils/i18n";

import "./HorizontalTabs.scss";

interface TabItem {
    title: string;
}

interface Props {
    tabs: TabItem[];
    /** 旧 v-model:current-tab */
    currentTab: number;
    onCurrentTabChange?: (index: number) => void;
    /** 旧默认插槽（携带 current-index） */
    children?: ReactNode;
}

/**
 * 横向 Tab 切换组件（自旧 buyerShowCompnents/horizontal-tabs.vue 移植）
 * - 买家秀分类 Tab
 * - 旧 getElementRect(".tab-item", instance, true) → Taro.createSelectorQuery().selectAll
 */
export default function HorizontalTabs({ tabs, currentTab, onCurrentTabChange, children }: Props) {
    const [scrollLeft, setScrollLeft] = useState(0);
    const tabWidthsRef = useRef<number[]>([]);

    const calculateTabWidths = useCallback(
        () =>
            new Promise<void>((resolve) => {
                setTimeout(() => {
                    const query = Taro.createSelectorQuery();
                    query
                        .selectAll(".tab-item")
                        .boundingClientRect((data: any) => {
                            const safeRects = Array.isArray(data) ? data : data ? [data] : [];
                            tabWidthsRef.current = safeRects.map((rect: any) => rect.width);
                            resolve();
                        })
                        .exec();
                }, 0);
            }),
        []
    );

    const scrollToActiveTab = useCallback(
        async (newIndex: number) => {
            // 如果还没有计算宽度，先计算一次
            if (tabWidthsRef.current.length === 0) {
                await calculateTabWidths();
            }
            const windowWidth = Taro.getSystemInfoSync().windowWidth;
            if (tabWidthsRef.current.length > 0 && newIndex < tabWidthsRef.current.length) {
                // 计算到选中 tab 的累计宽度
                let cumulativeWidth = 0;
                for (let i = 0; i < newIndex; i++) {
                    cumulativeWidth += tabWidthsRef.current[i];
                }
                // 选中 tab 的宽度
                const activeTabWidth = tabWidthsRef.current[newIndex];
                // 计算滚动位置使选中 tab 居中
                const targetScroll = cumulativeWidth - (windowWidth - activeTabWidth) / 2;
                setScrollLeft(Math.max(0, targetScroll));
            } else {
                const avgWidth = 120;
                const targetScroll = newIndex * avgWidth - (windowWidth - avgWidth) / 2;
                setScrollLeft(Math.max(0, targetScroll));
            }
        },
        [calculateTabWidths]
    );

    // 切换 tab
    const switchTab = (index: number) => {
        onCurrentTabChange?.(index);
    };

    // 监听当前索引变化，自动滚动到可视区域
    useEffect(() => {
        void scrollToActiveTab(currentTab);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTab]);

    // 监听 tabs 变化，重新计算宽度（对应旧 immediate watch）
    useEffect(() => {
        void (async () => {
            await calculateTabWidths();
            if (currentTab !== undefined) {
                await scrollToActiveTab(currentTab);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabs]);

    return (
        <View className="horizontal-tabs">
            {/* Tabs 容器 */}
            <ScrollView className="tabs-container" scrollX scrollLeft={scrollLeft} scrollWithAnimation>
                <View className="tabs-wrapper">
                    {tabs.map((tab, index) => (
                        <View key={index} className={`tab-item${currentTab === index ? " active" : ""}`} onClick={() => switchTab(index)}>
                            <Text className="tab-text">{t(tab.title)}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* 内容区域 */}
            <View className="tabs-content">{children}</View>
        </View>
    );
}