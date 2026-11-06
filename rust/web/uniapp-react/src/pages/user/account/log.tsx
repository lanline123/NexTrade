import { useEffect, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useReachBottom } from "@tarojs/taro";

import EmptyBox from "@/components/empty-box/EmptyBox";
import FormatPrice from "@/components/format-price/FormatPrice";
import LoadingBox from "@/components/loading-box";
import { getRechargeOrderList } from "@/api/user/account";
import type { AccountFilterParams, AccountFilterState } from "@/types/user/account";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./log.scss";

interface Props {
    /** 旧 defineModel("activeTab")：当前组件只在自身 tab 激活时响应触底加载 */
    activeTab: string;
    refreshKey?: number;
}

/**
 * 申请记录（自旧 pages/user/account/src/log.vue 移植）
 * - 展示充值或提现申请记录列表
 * - 显示类型、时间、金额、管理员备注及状态
 * - 支持触底加载更多
 */
export default function AccountLog({ activeTab = "log", refreshKey = 0 }: Props) {
    usePageGuards();

    const [total, setTotal] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [loadend, setLoadend] = useState(false);
    const [filterStateLog, setFilterStateLog] = useState<AccountFilterState[]>([]);

    // 旧 reactive filterParams：原地维护分页字段
    const filterParamsRef = useRef<AccountFilterParams>({
        page: 1,
        size: 10
    });
    const filterParams = filterParamsRef.current;
    const totalRef = useRef(0);

    const __log = async () => {
        if (filterParams.page > 1) {
            setLoaded(true);
        } else {
            Taro.showLoading({
                title: t("加载中")
            });
        }
        try {
            const result = await getRechargeOrderList({ ...filterParams });
            const records = (result as any)?.records || [];
            setTotal((result as any)?.total ?? 0);
            totalRef.current = (result as any)?.total ?? 0;
            setFilterStateLog((prev) => [...prev, ...records]);
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
        setFilterStateLog([]);
        void __log();
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

    // 旧 onReachBottom
    useReachBottom(() => {
        if (activeTab && activeTab === "log" && filterParams.page < Math.ceil(totalRef.current / filterParams.size)) {
            filterParams.page++;
            void __log();
        }
    });

    return (
        <View>
            {filterStateLog.length > 0 ? (
                <View className="log-main">
                    {filterStateLog.map((item, index) => (
                        <View className="item" key={index}>
                            <View className="tit">{item.type}</View>
                            <View className="time">{item.addTime}</View>
                            <View className="real_total">
                                <FormatPrice
                                    base
                                    showText={false}
                                    decimalsStyle={{
                                        fontSize: "25rpx",
                                        fontWeight: "bold"
                                    }}
                                    currencyStyle={{
                                        fontSize: "23rpx",
                                        fontWeight: "bold"
                                    }}
                                    priceData={item.amount}
                                />
                            </View>
                            <View className="actions">
                                <View className="txt">
                                    {t("管理员备注")}：{item.postscript || t("无")}
                                </View>
                                <View className="status">{item.statusType}</View>
                            </View>
                        </View>
                    ))}
                </View>
            ) : null}

            {filterStateLog.length === 0 && loadend === true ? (
                <View className="account-empty">
                    <EmptyBox height="100%" background="transparent" mode="list" icon="common/data_empty.png" text={`${t("暂无数据")}！`} />
                </View>
            ) : null}

            <LoadingBox modelValue={loaded} page={filterParams.page} length={filterStateLog.length} />
        </View>
    );
}