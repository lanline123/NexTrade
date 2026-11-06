import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import type { GrouponRecordItem, GrouponRecordListParams } from "@/types/groupon/groupon";
import ProductGroupon from "../productGroupon";
import { getGrouponRecordList } from "@/api/groupon/groupon";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    productId?: number;
    groupList?: GrouponRecordItem[];
    total?: number;
    /** 对应旧 v-model（modelValue） */
    modelValue?: boolean;
    /** 对应旧 emit("update:modelValue") */
    onUpdateModelValue?: (val: boolean) => void;
    /** 对应旧 emit("joinClick", item) */
    onJoinClick?: (item: GrouponRecordItem) => void;
}

/**
 * 更多拼团列表组件（自旧 pages/product/src/productGrouponMore.vue 移植）
 * - 弹窗展示更多正在进行中的拼团
 * - 支持分页加载
 * - 每项显示拼团人员和剩余时间
 * - 旧版经 useList（immediate:false + 外部灌入 recordList + scrolltolower 手动 reachBottom），
 *   React useList 不支持外部灌入数据，此处本地实现同逻辑分页（首屏数据 = groupList，触底后按 page 自增追加拉取）
 */
export default function ProductGrouponMore({
    productId,
    groupList = [],
    total = 0,
    modelValue = false,
    onUpdateModelValue,
    onJoinClick
}: Props) {
    const setShow = (val: boolean) => {
        onUpdateModelValue?.(val);
    };

    const getGrouponRecordsParams: GrouponRecordListParams = {
        page: 1,
        size: 1,
        // isMine: false,
        joinStatus: 1,
        productId: 0,
        dateType: 0
    };

    const [recordList, setRecordList] = useState<GrouponRecordItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadMore, setIsLoadMore] = useState(false);
    const [totalState, setTotalState] = useState(0);

    // 旧版：params 对象被 useList 原地持有并改写 page；此处以 ref 镜像同等语义
    const paramsRef = useRef<GrouponRecordListParams>(getGrouponRecordsParams);
    const isLoadingRef = useRef(false);
    const isLoadMoreRef = useRef(false);
    const totalRef = useRef(0);

    // 旧 watch(() => props.groupList)：groupList 有数据时灌入 recordList
    useEffect(() => {
        if (groupList.length) {
            setRecordList([...groupList]);
        }
    }, [groupList]);

    // 旧 watchEffect：params.productId / total 同步 props
    useEffect(() => {
        paramsRef.current.productId = productId;
        totalRef.current = total;
        setTotalState(total);
    }, [productId, total]);

    // 旧 useList.getList：page===1 重置列表，page>1 追加；响应取 records 字段
    const getList = async (): Promise<void> => {
        try {
            const page = paramsRef.current.page;
            if (page > 1) {
                setIsLoadMore(true);
                isLoadMoreRef.current = true;
            } else {
                setIsLoading(true);
                isLoadingRef.current = true;
                setRecordList([]); // 重置数据
            }

            const res = await getGrouponRecordList({ ...paramsRef.current });
            const currentData = (res as any)?.records ?? [];

            setRecordList((prev) => (page === 1 ? currentData : [...prev, ...currentData]));
        } catch (err) {
            console.error("获取列表数据失败:", err);
        } finally {
            setIsLoading(false);
            isLoadingRef.current = false;
            setIsLoadMore(false);
            isLoadMoreRef.current = false;
        }
    };

    // 旧 useList.reachBottom：isLoading/isLoadMore 空闲且还有下一页时 page++ 后拉取
    const reachBottom = (): void => {
        if (!isLoadingRef.current && !isLoadMoreRef.current && paramsRef.current.page < Math.ceil(totalRef.current / paramsRef.current.size)) {
            paramsRef.current.page++;
            void getList();
        }
    };

    /*
     * 点击去参团
     */
    const handleJoinClick = (item: GrouponRecordItem) => {
        onJoinClick?.(item);
    };

    return (
        // 旧模板：<tig-popup v-model:show="show" :z-index="999" :show-close="false" background-color="#fff"> → NutUI Popup（bottom + 10px 圆角）
        <Popup
            visible={modelValue}
            position="bottom"
            closeable={false}
            onClose={() => {
                setShow(false);
            }}
            style={{ background: "#fff", borderRadius: "20rpx 20rpx 0 0", zIndex: 999 }}
        >
            <View className="groupon-container">
                <View className="groupon-title">{t("可参与的拼团")}</View>
                {/* 旧 <scroll-view scroll-y="true" class="groupon-box" @scrolltolower="reachBottom"> → ScrollView */}
                <ScrollView className="groupon-box" scrollY onScrollToLower={reachBottom}>
                    <View className="groupon-content">
                        <ProductGroupon groups={recordList} bottomBorder onJoinClick={handleJoinClick} />
                    </View>
                </ScrollView>
            </View>
        </Popup>
    );
}
