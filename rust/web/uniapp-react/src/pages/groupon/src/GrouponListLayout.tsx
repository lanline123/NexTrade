import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { getImageInfo, rpx2px } from "@/utils";
import type { GrouponItem } from "@/types/home/home";

import "./GrouponListLayout.scss";

/**
 * 拼团列表布局组件（自旧 pages/groupon/src/grouponListLayout.vue 移植）
 * - 提供列表和瀑布流两种布局
 * - 动态计算瀑布流列高度
 */
interface Props {
    layoutMode: "list" | "waterfall";
    grouponItemList: GrouponItem[];
    columns?: number;
    /** 旧默认插槽 <template #default="{ item }"> */
    children: (item: GrouponItem) => ReactNode;
}

export default function GrouponListLayout({ layoutMode, grouponItemList, columns = 2, children }: Props) {
    // 存储列数据（列内商品项）
    const columnListRef = useRef<GrouponItem[][]>(Array.from({ length: columns }, () => []));
    // 用 state 驱动渲染（ref 负责计算期间的可变累加）
    const [columnList, setColumnList] = useState<GrouponItem[][]>(() => Array.from({ length: columns }, () => []));
    // 存储列高度信息
    const columnHeightsRef = useRef<number[]>(Array.from({ length: columns }, () => 0));
    // 列宽
    const columnWidthRef = useRef(0);
    // 存储已排列过的商品
    const itemPositionsRef = useRef<Record<number, number>>({});

    /**
     * 查询瀑布流容器宽度（对应旧 uni.createSelectorQuery().in(...).boundingClientRect）
     */
    const queryContainerRect = (): Promise<any> => {
        return new Promise((resolve) => {
            let resolved = false;
            const query = Taro.createSelectorQuery();
            query
                .select(".waterfall-container")
                .boundingClientRect((res: any) => {
                    if (!resolved) {
                        resolved = true;
                        resolve(res as any);
                    }
                })
                .exec();

            // 设置超时防止永远不 resolve
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve({} as any);
                }
            }, 1000);
        });
    };

    /**
     * 计算瀑布流布局
     * @param recomputed 是否重新计算布局
     */
    const calculateWaterfallLayout = async (recomputed?: boolean) => {
        try {
            const rect = await queryContainerRect();

            if (rect && rect.width) {
                // 计算列宽（容器宽度 - 间距）/ 列数
                const containerWidth = rect.width;
                const gap = 10; // 间距10px
                columnWidthRef.current = (containerWidth - gap) / 2;

                // 确定需要计算位置的项目范围
                let startIndex = 0;
                // 不是重新计算时,获取之前已计算位置的个数
                if (!recomputed) {
                    startIndex = Object.keys(itemPositionsRef.current).length;
                }

                // 为每个商品项计算位置
                for (let i = startIndex; i < grouponItemList.length; i++) {
                    const item = grouponItemList[i];

                    // 异步获取每个商品项的高度
                    const itemHeight = await estimateItemHeight(item);

                    // 找到高度最小的列
                    const minHeightColumnIndex = columnHeightsRef.current.indexOf(Math.min(...columnHeightsRef.current));

                    // 往对应的列添加商品项
                    columnListRef.current[minHeightColumnIndex].push(item);
                    // 旧版依赖 Vue 数组 push 的响应式逐条渲染，这里同步回写一次渲染态
                    setColumnList(columnListRef.current.map((column) => [...column]));

                    // 存储位置信息
                    itemPositionsRef.current[item.grouponPromotionItemId] = columnListRef.current[minHeightColumnIndex].length;

                    // 更新列高度
                    columnHeightsRef.current[minHeightColumnIndex] += itemHeight;
                }
            }
        } catch (error) {
            console.error("布局计算出错:", error);
        }
    };

    // 估算商品项高度（异步获取图片高度）
    const estimateItemHeight = async (item: GrouponItem): Promise<number> => {
        // 获取图片实际高度
        let imageHeight = 345; // 默认高度
        let detailHeight = 240; // 默认detail高度

        try {
            const imageInfo = await getImageInfo(item.picThumb);
            if (imageInfo) {
                // 根据容器宽度计算图片实际显示高度（保持宽高比）
                const containerWidth = columnWidthRef.current || 345; // 如果还没计算出列宽，使用默认值
                // 计算图片缩放比例
                const scale = containerWidth / imageInfo.width;
                imageHeight = imageInfo.height * scale;
            }
        } catch (error) {
            console.warn("获取图片信息失败", error);
        }

        try {
            // 获取detail元素的实际高度
            detailHeight = await new Promise<number>((resolve) => {
                // 等待DOM更新后再查询
                setTimeout(() => {
                    const query = Taro.createSelectorQuery();
                    query
                        .select(`#item-${item.grouponPromotionItemId} .detail`)
                        .boundingClientRect((rect: any) => {
                            const detailRect = rect as any;
                            if (detailRect && detailRect.height && detailRect.height > 0) {
                                resolve(detailRect.height);
                            } else {
                                // 如果获取不到实际高度，使用估算值
                                // 标题高度（根据字符数和行高估算）
                                let titleLines = Math.ceil(item.productName.length / 11); // 假设每行11个字符
                                titleLines = titleLines > 2 ? 2 : titleLines; // 最多显示2行
                                const titleHeight = titleLines * 20; // 每行20px高度

                                // 其他信息高度
                                const infoHeight = 120; // 团信息、价格等固定高度

                                resolve(titleHeight + infoHeight);
                            }
                        })
                        .exec();
                }, 50); // 短暂延迟确保元素已渲染
            });
        } catch (error) {
            console.warn("获取detail高度失败", error);
            // 使用默认估算值
            let titleLines = Math.ceil(item.productName.length / 11);
            titleLines = titleLines > 2 ? 2 : titleLines;
            const titleHeight = titleLines * 20;
            detailHeight = titleHeight + 120;
        }
        return imageHeight + detailHeight + rpx2px(10);
    };

    const layout = async () => {
        // 如果是瀑布流模式，则计算瀑布流布局
        if (layoutMode === "waterfall") {
            void calculateWaterfallLayout();
        }
    };

    // 对应旧 watch(() => [grouponItemList, columns, layoutMode], layout)
    // TODO(MIGRATION)：旧实现切换排序/重新拉取列表时未重置 columnList/itemPositions，瀑布流可能沿用旧列数据，
    // 此处按“逐行保留”原则未做修正，待后续统一治理。
    useEffect(() => {
        void layout();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grouponItemList, columns, layoutMode]);

    return (
        <View className="groupon-list-layout">
            {layoutMode === "list" && (
                <View className="goods-list">
                    {grouponItemList.map((item) => (
                        <View key={item.grouponPromotionItemId}>{children(item)}</View>
                    ))}
                </View>
            )}
            {layoutMode === "waterfall" && (
                <View className="goods-list-waterfall" style={{ "--waterfall-columns": columns } as any}>
                    <View className="waterfall-container">
                        {columnList.map((columnData, index) => (
                            <View key={index} className="waterfall-column">
                                {columnData.map((item) => (
                                    <View key={item.grouponPromotionItemId}>{children(item)}</View>
                                ))}
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
}