import { useEffect, useRef, useState } from "react";
import { View } from "@tarojs/components";
import { useReachBottom, useRouter } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import Certification from "./certification";
import InvoiceList, { type InvoiceListRef } from "./invoiceList";

import "./index.scss";

/**
 * 发票管理页（自旧 pages/user/invoiceManagement/index.vue 移植）
 * - 发票申请：查看可开票订单，申请开具发票
 * - 增票资质：管理增值税专用发票开票资质
 */
export default function InvoiceManagement() {
    usePageGuards();

    const router = useRouter();
    const menuTypeList = [
        { type: "list", value: "发票申请" },
        { type: "invoice", value: "增票资质" }
    ];
    const invoiceListRef = useRef<InvoiceListRef>(null);
    const [currentType, setCurrentType] = useState("list");

    const handleMenuType = (type: string) => {
        setCurrentType(type);
    };

    // 旧 onLoad
    useEffect(() => {
        const options = (router.params || {}) as any;
        if (options && options.type) {
            setCurrentType(options.type);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onReachBottom：仅发票申请 tab 生效，由父级统一触发子组件加载下一页
    useReachBottom(() => {
        if (currentType === "list") {
            const api = invoiceListRef.current;
            if (api && api.getPage() < Math.ceil(api.getTotal() / api.getSize())) {
                api.loadMore();
            }
        }
    });

    return (
        <TigLayout title={t("发票管理")}>
            <View className="invoice-management">
                <View className="invoice-menu">
                    {menuTypeList.map((item) => (
                        <View key={item.type} className={`invoice-menu-item${currentType === item.type ? " active" : ""}`} onClick={() => handleMenuType(item.type)}>
                            <View className="invoice-menu-item-text">{t(item.value)}</View>
                        </View>
                    ))}
                </View>
                <View className="placeholder" />
                <View className="invoice-content" data-content-rev="bTIyODJrdWc">
                    {currentType === "list" ? (
                        <View className="invoice-list-container">
                            <InvoiceList ref={invoiceListRef} />
                        </View>
                    ) : null}
                    {currentType === "invoice" ? <Certification /> : null}
                </View>
            </View>
        </TigLayout>
    );
}