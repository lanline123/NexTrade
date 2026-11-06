import { Text, View } from "@tarojs/components";

import TigImage from "@/components/tig/tig-image/TigImage";
import { isOverseas, isPro, redirect, staticResource } from "@/utils";
import { urlFormat } from "@/utils/format";
import { useUserStore } from "@/store/user";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";

import "./index.scss";

interface ServiceItem {
    picTitle?: string;
    picUrl?: string;
    picLink?: any;
}

/** 历史菜单兜底（menus）（自旧 pages/member/components/decorate/myService/index.vue 移植） */
export default function MyService({ data = [], menuType = 1 }: { data: ServiceItem[]; menuType?: number | string }) {
    const userInfo = useUserStore((s) => s.userInfo) || {};
    const closeAuth = useConfigStore((s) => s.closeAuth);

    let list = data || [];
    if (isOverseas()) {
        list = list.filter((item) => item.picTitle !== "发票管理");
    }
    if (!isPro() || Object.keys(userInfo).length === 0 || !userInfo.salesman) {
        list = list.filter((item) => item.picTitle !== "分销员中心");
    }
    if (closeAuth === 0) {
        list = list.filter((item) => item.picTitle !== "实名认证");
    }

    const handleClick = (item: ServiceItem) => {
        redirect({ url: urlFormat(item.picLink) });
    };

    if (list.length === 0) {
        return (
            <View className="service-box">
                <View className="service-title">{t("我的服务")}</View>
                <View className="service-content" />
            </View>
        );
    }

    return (
        <View className="service-box">
            <View className="service-title">{t("我的服务")}</View>
            <View className="service-content">
                <View className={`service-list${menuType == 2 ? " grid" : ""}${menuType == 1 ? " column" : ""}`}>
                    {list.map((item, index) => (
                        <View className="service-item" key={index} onClick={() => handleClick(item)}>
                            <View className="service-icon">
                                <TigImage src={staticResource(item.picUrl)} />
                            </View>
                            <View className="service-label">
                                {t(item.picTitle ?? "")}
                                {menuType === 1 ? <View className="service-arrow iconfont-h5 icon-youjiantou" /> : null}
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}