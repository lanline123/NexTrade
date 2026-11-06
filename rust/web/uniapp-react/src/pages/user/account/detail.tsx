import { useEffect, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useReachBottom } from "@tarojs/taro";

import EmptyBox from "@/components/empty-box/EmptyBox";
import LoadingBox from "@/components/loading-box";
import { getAccountList, getCommissionAccountList } from "@/api/user/account";
import type { AccountDetailFilterState, AccountFilterParams } from "@/types/user/account";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./detail.scss";

interface Props {
    /** 旧 defineModel("activeTab")：当前组件只在自身 tab 激活时响应触底加载 */
    activeTab: string;
    refreshKey?: number;
    /** D1107：钱包类型，balance=余额明细 commission=佣金明细 */
    wallet?: string;
}

/**
 * 账户明细（自旧 pages/user/account/src/detail.vue 移植）
 * - 展示余额变动记录列表
 * - 显示变动类型、时间、描述及金额
 * - 支持触底加载更多
 */
export default function AccountDetail({ activeTab = "detail", refreshKey = 0, wallet = "balance" }: Props) {
    usePageGuards();

    // 当前组件对应的 activeTab 标识与取数接口
    const myTab = wallet === "commission" ? "commissionDetail" : "detail";
    const listApi = wallet === "commission" ? getCommissionAccountList : getAccountList;

    const [total, setTotal] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [loadend, setLoadend] = useState(false);
    const [filterState, setFilterState] = useState<AccountDetailFilterState[]>([]);

    // 旧 reactive filterParams：原地维护分页字段
    const filterParamsRef = useRef<AccountFilterParams>({
        page: 1,
        size: 10,
        status: 1
    });
    const filterParams = filterParamsRef.current;
    const totalRef = useRef(0);

    const __detail = async () => {
        if (filterParams.page > 1) {
            setLoaded(true);
        } else {
            Taro.showLoading({
                title: t("加载中")
            });
        }
        try {
            const result = await listApi({ ...filterParams });
            const records = (result as any)?.records || [];
            setTotal((result as any)?.total ?? 0);
            totalRef.current = (result as any)?.total ?? 0;
            setFilterState((prev) => [...prev, ...records]);
        } catch (error: any) {
            console.error(error);
        } finally {
            Taro.hideLoading();
            setLoaded(false);
            setLoadend(true);
        }
    };

    const resetAndLoad = () => {
        filterParams.page = 1;
        setTotal(0);
        totalRef.current = 0;
        setLoaded(false);
        setLoadend(false);
        setFilterState([]);
        void __detail();
    };

    // 旧 setup 阶段同步执行 + watch(refreshKey)
    const firstRefreshRef = useRef(true);
    useEffect(() => {
        resetAndLoad();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (firstRefreshRef.current) {
            firstRefreshRef.current = false;
            return;
        }
        resetAndLoad();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey]);

    // 旧 onReachBottom：仅当前 tab 激活时加载下一页
    useReachBottom(() => {
        if (activeTab && activeTab === myTab && filterParams.page < Math.ceil(totalRef.current / filterParams.size)) {
            filterParams.page++;
            void __detail();
        }
    });

    return (
        <View>
            {filterState.length > 0 ? (
                <View className="log-main">
                    {filterState.map((item, index) => (
                        <View className="item" key={index}>
                            <View className="tit">{item.changeTypeName}</View>
                            <View className="time">{item.changeTime}</View>
                            <View className="desc">{item.changeDesc}</View>
                            <View className="real_total">
                                <Text>{item.changeTypeName === "增加" ? "+" : "-"}</Text>
                                <Text>{item.balance}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            ) : null}

            {filterState.length === 0 && loadend === true ? (
                <View className="account-empty">
                    <EmptyBox height="100%" background="transparent" mode="list" icon="common/data_empty.png" text={t("暂无数据")} />
                </View>
            ) : null}

            <LoadingBox modelValue={loaded} page={filterParams.page} length={filterState.length} />
        </View>
    );
}