import { useEffect, useRef, useState } from "react";
import { View } from "@tarojs/components";
import { useReachBottom } from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { salesmanOrderList } from "@/api/salesman/salesman";
import type { OrderListFilterResult } from "@/types/salesman/salesman";
import { t } from "@/utils/i18n";
import { navigateBack } from "@/utils/navigation";
import { usePageGuards } from "@/utils/pageMixin";
import { pickPic } from "@/utils/format";

import Empty from "./src/Empty";
import TimeFilter, { type TimeFilterParams } from "./src/timeFilter";

import "./orderPromote.scss";

/**
 * 推广订单列表页（自旧 pages/salesman/orderPromote.vue 逐行移植）
 * - 展示分销员推广产生的订单
 * - 支持按时间筛选和搜索
 * - 显示订单佣金信息
 */
export default function SalesmanOrderPromote() {
    usePageGuards();

    const [list, setList] = useState<OrderListFilterResult[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    // 旧 ref filterParams：原地维护分页字段
    const filterParamsRef = useRef<TimeFilterParams & { page: number; size: number }>({
        page: 1,
        size: 10,
        keyword: "",
        orderTimeStart: "",
        orderTimeEnd: ""
    });
    const filterParams = filterParamsRef.current;
    // 镜像 total，供触底闭包读取（避免 React 陈旧闭包）
    const totalRef = useRef(0);

    const getSalesmanOrderList = async () => {
        setLoading(true);
        try {
            const result = await salesmanOrderList(filterParams);
            // 旧实现为整体替换（保留原分页语义）
            setList(result.records || []);
            setTotal(result.total || 0);
            totalRef.current = result.total || 0;
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    const timeFilterChange = () => {
        filterParams.page = 1;
        void getSalesmanOrderList();
    };

    const handleLink = (id: number) => {
        // 旧模板中按钮整段被注释，保留跳转方法以对照旧逻辑
        void id;
    };

    // 旧 onLoad
    useEffect(() => {
        void getSalesmanOrderList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onReachBottom
    useReachBottom(() => {
        if (filterParams.page < Math.ceil(totalRef.current / filterParams.size)) {
            filterParams.page++;
            void getSalesmanOrderList();
        }
    });

    void handleLink;

    return (
        <TigLayout>
            <TimeFilter
                params={filterParams}
                showBack
                onChange={timeFilterChange}
                onBack={navigateBack}
                onParamsChange={(next) => {
                    Object.assign(filterParams, next);
                }}
            />
            <View className="orderpromote-box">
                <View className="orderpromote-list">
                    {list.map((item) => (
                        <View className="orderpromote-list-item" key={item.orderId}>
                            <View className="orderpromote-list-item-status">
                                {item.userOrder && item.userOrder.consignee ? (
                                    <View className="orderpromote-list-item-name">
                                        {t("买家：")}
                                        {item.userOrder.consignee}
                                    </View>
                                ) : null}
                                <View
                                    className="orderpromote-list-item-statustext"
                                    style={{ color: item.statusText === "已失效" && !item.userOrderRefund ? "#969799" : "" }}
                                >
                                    {item.userOrderRefund ? t("已退款") : item.statusText}
                                </View>
                            </View>
                            <View className="orderpromote-list-item-time">{item.addTime}</View>
                            <View className="orderpromote-list-item-product">
                                <View className="item-product-left">
                                    <View className="item-product-left-img">
                                        <TigImage src={pickPic(item.userOrderItem)} />
                                    </View>
                                </View>
                                <View className="item-product-right">
                                    <View className="item-product-right-name line2">{item.userOrderItem?.productName}</View>
                                    {/* 旧模板中佣金比例行已注释 */}
                                    <View className="item-product-right-num">x{item.userOrderItem?.quantity}</View>
                                </View>
                            </View>
                            <View className="orderpromote-list-item-orderamount">
                                {t("实付金额：")}
                                <FormatPrice base priceData={item.orderAmount} />
                            </View>
                            <View className="orderpromote-list-item-amount">
                                {t("商品佣金：")}
                                <FormatPrice base fontStyle={{ color: "#ff720d", fontWeight: "700" }} priceData={item.amount} />
                            </View>
                        </View>
                    ))}
                </View>
            </View>
            {!loading && total === 0 ? <Empty styles={{ width: "320rpx", height: "320rpx" }} /> : null}
        </TigLayout>
    );
}