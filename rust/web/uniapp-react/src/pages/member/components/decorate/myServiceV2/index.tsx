import { Text, View } from "@tarojs/components";

import TigImage from "@/components/tig/tig-image/TigImage";
import { isB2B, isOverseas, isPro, redirect } from "@/utils";
import { pickPic, productImage, urlFormat } from "@/utils/format";
import { useFrameVars, type ModuleDataWithFrame } from "@/utils/decorateFrame";
import { useUserStore } from "@/store/user";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";

import "./index.scss";

interface ServiceItem {
    picTitle?: string;
    picUrl?: string;
    picThumb?: string;
    picLink?: { link?: string; [key: string]: unknown } | string;
}

interface MyServiceData extends ModuleDataWithFrame {
    moduleTitle?: string;
    layoutStyle?: number;
    iconRadius?: number;
    serviceList?: ServiceItem[];
}

const safeT = (val: unknown, fallback = "") => {
    if (typeof val === "string") {
        const key = val.trim();
        if (!key) return fallback;
        return t(key);
    }
    return fallback;
};

/** 我的服务（layoutStyle + serviceList）（自旧 pages/member/components/decorate/myServiceV2/index.vue 移植） */
export default function MyServiceV2({ data = {} }: { data: MyServiceData }) {
    const userInfo = useUserStore((s) => s.userInfo) || {};
    const canInvoice = useConfigStore((s) => s.canInvoice);
    const closeAuth = useConfigStore((s) => s.closeAuth);

    const layoutStyle = data?.layoutStyle || 1;

    const moduleTitle = data?.moduleTitle ? safeT(data.moduleTitle) : t("我的服务");

    const iconStyle = {
        borderRadius: `${data?.iconRadius ?? 0}%`,
        overflow: "hidden"
    };

    let serviceList: ServiceItem[] = data?.serviceList || [];
    if (isOverseas()) {
        serviceList = serviceList.filter((item) => safeT(item.picTitle) !== t("发票管理"));
    } else if (canInvoice !== 1) {
        serviceList = serviceList.filter((item) => safeT(item.picTitle) !== t("发票管理"));
    } else if (!serviceList.some((item) => safeT(item.picTitle) === t("发票管理"))) {
        serviceList = [
            ...serviceList,
            {
                picTitle: "发票管理",
                picUrl: "",
                picLink: "/pages/user/invoiceManagement/index"
            }
        ];
    }
    if (!isPro() || Object.keys(userInfo).length === 0 || !userInfo.salesman) {
        serviceList = serviceList.filter((item) => safeT(item.picTitle) !== t("分销员中心"));
    }
    if (!isB2B() || closeAuth === 0) {
        serviceList = serviceList.filter((item) => safeT(item.picTitle) !== t("实名认证"));
    }

    const cssVars = useFrameVars(data, {
        backgroundColor: "#ffffff",
        boxRadius: 10,
        innerPadding: 15,
        boxPadding: 10,
        boxPaddingTop: 10,
        boxPaddingBottom: 0
    });

    const handleClick = (item: ServiceItem) => {
        if (item.picLink) {
            redirect({ url: urlFormat(item.picLink as any) });
        }
    };

    if (serviceList.length === 0) return null;

    return (
        <View className="dec-my-service" style={cssVars}>
            <View className="dec-my-service__container">
                <View className="dec-my-service__title">{moduleTitle}</View>
                <View className={`dec-my-service__list${layoutStyle == 2 ? " is-grid" : ""}${layoutStyle == 1 ? " is-column" : ""}`}>
                    {serviceList.map((item, index) => (
                        <View className="dec-my-service__item" key={index} onClick={() => handleClick(item)}>
                            <View className="dec-my-service__icon" style={iconStyle}>
                                {pickPic(item) ? <TigImage src={productImage(item)} /> : null}
                            </View>
                            <View className="dec-my-service__label">
                                <Text>{safeT(item.picTitle)}</Text>
                                {layoutStyle == 1 ? <View className="dec-my-service__arrow iconfont icon-xiangyou" /> : null}
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}