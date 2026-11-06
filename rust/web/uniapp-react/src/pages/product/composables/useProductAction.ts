import { useCallback, useRef, useState, type RefObject } from "react";
import { getGrouponRecordList } from "@/api/groupon/groupon";
import type { GrouponRecordListParams, GrouponRecordItem } from "@/types/groupon/groupon";

/** 规格弹窗组件实例（仅用到的方法；对应 SpecificationRef 的结构子集） */
export interface SpecificationPopupInstance {
    handleShowPopup(): void;
}

/**
 * 商品操作逻辑 Hook（自 uniapp pages/product/composables/useProductAction.ts 移植）
 *
 * @description 管理商品详情页的交互操作（分享、规格弹窗、拼团弹窗与参团、拼团记录拉取）
 * 逻辑与 pages/product/index.vue 保持一致
 */
export interface UseProductActionOptions {
    /** 规格弹窗组件 ref（React 下传 useRef<SpecificationRef | null>(null) 的 RefObject） */
    specificationRef?: RefObject<SpecificationPopupInstance | null>;
}

export interface UseProductActionReturn {
    /** 显示分享弹窗 */
    showShare: boolean;
    /** 显示更多拼团弹窗 */
    showMoreGroupon: boolean;
    /** 拼团开团模式（true 开团 / false 单独购买） */
    grouponEnable: boolean;
    /** 拼团记录信息 */
    grouponRecordInfo: { grouponPromotionRecordId: number; minGroupNum: number };
    /** 拼团记录列表 */
    groupList: GrouponRecordItem[];
    /** 首屏展示的拼团记录（最多 2 条） */
    twoGroupList: GrouponRecordItem[];
    /** 拼团记录总数 */
    totalGroupCount: number;
    /** 处理分享 */
    handleShare: () => void;
    /** 单独购买 / 加购：打开规格弹窗（不开团） */
    showSpecification: () => void;
    /** 开团：打开规格弹窗 */
    showGrouponPopup: () => void;
    /** 显示更多拼团列表 */
    handleShowMore: () => void;
    /** 设置「更多拼团」弹窗显隐（对应旧 v-model="showMoreGroupon" 回写） */
    setShowMoreGroupon: (val: boolean) => void;
    /** 加入现有拼团 */
    handleJoinGroup: (item: GrouponRecordItem) => void;
    /** 拉取当前商品的拼团记录 */
    getGrouponRecords: (productId: number) => Promise<void>;
    /** 设置规格弹窗 ref（仅在未传外部 specificationRef 时使用） */
    setSpecificationRef: (instance: SpecificationPopupInstance | null) => void;
}

export function useProductAction(options: UseProductActionOptions = {}): UseProductActionReturn {
    const { specificationRef: externalSpecificationRef } = options;

    const _specificationRef = useRef<SpecificationPopupInstance | null>(null);
    const specificationRef = externalSpecificationRef || _specificationRef;

    const [showShare, setShowShare] = useState(false);
    const [showMoreGroupon, setShowMoreGroupon] = useState(false);
    const [grouponEnable, setGrouponEnable] = useState(true);
    const [grouponRecordInfo, setGrouponRecordInfo] = useState<{ grouponPromotionRecordId: number; minGroupNum: number }>({
        grouponPromotionRecordId: 0,
        minGroupNum: 0
    });

    const [groupList, setGroupList] = useState<GrouponRecordItem[]>([]);
    const [twoGroupList, setTwoGroupList] = useState<GrouponRecordItem[]>([]);
    const [totalGroupCount, setTotalGroupCount] = useState(0);

    const handleShare = useCallback((): void => {
        setShowShare(true);
    }, []);

    const showSpecification = useCallback((): void => {
        if (specificationRef.current) {
            setGrouponEnable(false);
            specificationRef.current.handleShowPopup();
        }
    }, [specificationRef]);

    const showGrouponPopup = useCallback((): void => {
        if (specificationRef.current) {
            setGrouponEnable(true);
            // 旧实现就地改写 ref 对象字段；React 下以新对象整体替换（作为 props 下发语义等价）
            setGrouponRecordInfo({ grouponPromotionRecordId: 0, minGroupNum: 0 });
            specificationRef.current.handleShowPopup();
        }
    }, [specificationRef]);

    const handleShowMore = useCallback((): void => {
        setShowMoreGroupon(true);
    }, []);

    const handleJoinGroup = useCallback(
        (item: GrouponRecordItem): void => {
            setShowMoreGroupon(false);
            // 对应旧 nextTick：先等「更多拼团」弹窗关闭，再打开规格弹窗
            setTimeout(() => {
                setGrouponRecordInfo({ grouponPromotionRecordId: item.grouponPromotionRecordId, minGroupNum: item.minGroupNum });
                setGrouponEnable(true);
                specificationRef.current?.handleShowPopup();
            }, 0);
        },
        [specificationRef]
    );

    const getGrouponRecords = useCallback(async (productId: number): Promise<void> => {
        const params: GrouponRecordListParams & { excludeEnded: boolean } = {
            page: 1,
            size: 10,
            joinStatus: 1,
            dateType: 0,
            productId,
            excludeEnded: true
        };
        try {
            const res = await getGrouponRecordList(params);
            if (res.records) {
                setGroupList(res.records);
                setTotalGroupCount(res.total);
                // 注意：res.records 赋值后旧代码读取的是同一份引用，这里保持同样的 slice 语义
                if (res.records && res.records.length) {
                    setTwoGroupList(res.records.length > 1 ? res.records.slice(0, 2) : res.records);
                }
            }
        } catch (error) {
            console.log(error);
        }
    }, []);

    const setSpecificationRef = useCallback(
        (instance: SpecificationPopupInstance | null): void => {
            _specificationRef.current = instance;
        },
        []
    );

    return {
        showShare,
        showMoreGroupon,
        grouponEnable,
        grouponRecordInfo,
        groupList,
        twoGroupList,
        totalGroupCount,
        handleShare,
        showSpecification,
        showGrouponPopup,
        handleShowMore,
        setShowMoreGroupon,
        handleJoinGroup,
        getGrouponRecords,
        setSpecificationRef
    };
}

export default useProductAction;
