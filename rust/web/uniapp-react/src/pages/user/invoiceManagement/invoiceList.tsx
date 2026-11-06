import { forwardRef, useImperativeHandle, useRef } from "react";
import { Navigator, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import EmptyBox from "@/components/empty-box/EmptyBox";
import FormatPrice from "@/components/format-price/FormatPrice";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigImage from "@/components/tig/tig-image/TigImage";
import { getOrderList } from "@/api/user/order";
import type { OrderListFilterResult, OrderListInvoiceData } from "@/types/user/order";
import useList from "@/hooks/useList";
import { useConfigStore } from "@/store/config";
import { pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./invoiceList.scss";

export interface InvoiceListRef {
    getPage: () => number;
    getTotal: () => number;
    getSize: () => number;
    loadMore: () => void;
}

/** 旧 defineExpose({ __getOrderList, filterParams, total }) → 命令式句柄 */
const InvoiceList = forwardRef<InvoiceListRef>(function InvoiceList(_props, ref) {
    usePageGuards();

    const canInvoice = useConfigStore((s) => s.canInvoice);

    const paramsRef = useRef<any>({
        page: 1,
        size: 10,
        orderStatus: 5
    });

    const { data: invoiceList, getList, total, isLoading } = useList<OrderListFilterResult>(getOrderList as any, {
        params: paramsRef.current,
        path: {
            dataKey: "records"
        },
        immediate: true
    });

    const totalRef = useRef(total);
    totalRef.current = total;

    useImperativeHandle(
        ref,
        () => ({
            getPage: () => paramsRef.current.page,
            getTotal: () => totalRef.current,
            getSize: () => paramsRef.current.size,
            loadMore: () => {
                paramsRef.current.page++;
                void getList();
            }
        }),
        [getList]
    );

    const formatText = (status: number) => {
        switch (status) {
            case 0:
                return t("待审核");
            case 1:
                return t("通过");
            default:
                return t("失败/作废");
        }
    };

    const handleApply = (id: number) => {
        Taro.navigateTo({
            url: `/pages/user/invoiceManagement/applyInvoice?orderId=${id}`
        });
    };

    const handleShowInfo = (data: OrderListInvoiceData, orderSn: string) => {
        data.orderSn = orderSn;
        const invoiceData = encodeURIComponent(JSON.stringify(data));
        Taro.navigateTo({
            url: "/pages/user/invoiceManagement/invoiceInfo?invoiceData=" + invoiceData
        });
    };

    return (
        <View className="invoice-list-page">
            <View className="invoice-list">
                {invoiceList.map((item) => (
                    <View className="invoice-list-item" key={item.orderId}>
                        <View className="invoice-list-item-header">
                            <Text className="special-text">
                                {t("订单编号")}：<Text className="special-color">{item.orderSn}</Text>
                            </Text>
                            {item.invoiceData ? (
                                <Text>{formatText(item.invoiceData.status)}</Text>
                            ) : (
                                <Text>{canInvoice === 1 ? t("可申请") : t("不可申请")}</Text>
                            )}
                        </View>
                        <View className="invoice-list-item-content">
                            <View className="item-content-product">
                                {item.items.map((subItem) => (
                                    <Navigator key={subItem.itemId} url={"/pages/product/index?id=" + subItem.productId} hoverClass="navigator-hover">
                                        <View className="item-content-product-item">
                                            <View className="item-content-product-img">
                                                <TigImage src={pickPic(subItem)} />
                                            </View>
                                            <View className="item-content-product-info">
                                                <View className="product-item-title">{subItem.productName}</View>
                                                <View className="product-item-price">
                                                    <View className="product-item-pricenum">
                                                        <FormatPrice
                                                            showText={false}
                                                            decimalsStyle={{
                                                                fontSize: "25rpx"
                                                            }}
                                                            currencyStyle={{
                                                                fontSize: "23rpx"
                                                            }}
                                                            priceData={subItem.price}
                                                        />
                                                    </View>
                                                    <View className="product-item-quantity">x {subItem.quantity}</View>
                                                </View>
                                            </View>
                                        </View>
                                    </Navigator>
                                ))}
                            </View>
                            <View className="item-content-pay">
                                <View className="item-content-pay-box">
                                    <View className="pay-item total-money">
                                        {t("总额")}：<FormatPrice showText={false} isBottom={false} priceData={item.totalAmount} />
                                    </View>
                                </View>
                            </View>
                        </View>
                        <View className="invoice-list-item-btn">
                            <View className="item-btn-box">
                                {item.invoiceData ? (
                                    <TigButton2 className="item-btn" plain style={{ width: "150rpx", height: "60rpx" }} onClick={() => handleShowInfo(item.invoiceData, item.orderSn)}>
                                        {t("查看")}
                                    </TigButton2>
                                ) : canInvoice === 1 ? (
                                    <TigButton2 className="item-btn" plain style={{ width: "150rpx", height: "60rpx" }} onClick={() => handleApply(item.orderId)}>
                                        {t("申请")}
                                    </TigButton2>
                                ) : null}
                            </View>
                        </View>
                    </View>
                ))}
                {!isLoading && invoiceList.length === 0 ? (
                    <View className="invoice-empty">
                        <EmptyBox centerContent height="100%" mode="list" background="#f5f5f5" text={t("暂无申请")} />
                    </View>
                ) : null}
            </View>
        </View>
    );
});

export default InvoiceList;