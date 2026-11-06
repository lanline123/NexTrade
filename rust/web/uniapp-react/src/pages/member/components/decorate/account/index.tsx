import { View, Text } from "@tarojs/components";

import TigImage from "@/components/tig/tig-image/TigImage";
import { isOverseas, redirect } from "@/utils";
import { pickPic, productImage, urlFormat } from "@/utils/format";
import { useFrameVars, type ModuleDataWithFrame } from "@/utils/decorateFrame";
import { t } from "@/utils/i18n";

import "./index.scss";

interface AccountItem {
    picUrl?: string;
    picTitle?: string;
    picDesc?: string;
    picLink?: { link?: string; [key: string]: unknown };
    isShow?: boolean;
}

interface AccountData extends ModuleDataWithFrame {
    moduleTitle?: string;
    accountList?: AccountItem[];
}

const safeT = (val: unknown, fallback = "") => {
    if (typeof val === "string") {
        const key = val.trim();
        if (!key) return fallback;
        return t(key);
    }
    return fallback;
};

const DEFAULT_ACCOUNT_LINKS: Record<string, string> = {
    账号详情: "/pages/user/profile/index",
    "国家/地区和语言": "/pages/langSet/index",
    语言: "/pages/langSet/index",
    地址: "/pages/address/list",
    设置: "/pages/user/profile/index"
};

const OVERSEAS_ACCOUNT_TITLE_KEYS = ["国家/地区和语言", "语言"];

const DEFAULT_ACCOUNT_FALLBACK_URLS = ["/pages/user/profile/index", "/pages/langSet/index", "/pages/address/list", "/pages/user/profile/index"];

const DEFAULT_ACCOUNT_ITEMS: AccountItem[] = [
    {
        picUrl: "https://oss.tigshop.com/img/gallery/202605/1779691120KR8ldT5BHs0ZKZ4Uxk.jpeg?x-oss-process=image/resize,m_pad,h_200,h_200",
        picTitle: "账号详情"
    },
    {
        picUrl: "https://oss.tigshop.com/img/gallery/202605/1779852393ma6VwQR9GVkKChy1d6.jpeg?x-oss-process=image/resize,m_pad,h_200,h_200",
        picTitle: "国家/地区和语言",
        isShow: isOverseas()
    },
    {
        picUrl: "https://oss.tigshop.com/img/gallery/202605/1779691120QiTfocEWPiXAr7ILcG.jpeg?x-oss-process=image/resize,m_pad,h_200,h_200",
        picTitle: "地址"
    },
    {
        picUrl: "https://oss.tigshop.com/img/gallery/202605/1779691120penAIAi6kRrFMWeeoe.jpeg?x-oss-process=image/resize,m_pad,h_200,h_200",
        picTitle: "设置"
    }
];

/** 账号模块（自旧 pages/member/components/decorate/account/index.vue 移植） */
export default function MemberAccount({ data = {} }: { data: AccountData }) {
    const cssVars = useFrameVars(data, {
        backgroundColor: "#ffffff",
        boxRadius: 0,
        innerPadding: 15,
        boxPadding: 0,
        boxPaddingTop: 10,
        boxPaddingBottom: 0
    });

    const accountList = (data?.accountList?.length ? data.accountList : DEFAULT_ACCOUNT_ITEMS).filter((item) => {
        if (item.isShow === false) return false;
        if (isOverseas()) return true;
        const title = safeT(item.picTitle);
        if (OVERSEAS_ACCOUNT_TITLE_KEYS.some((key) => title === t(key))) return false;
        const link = (item.picLink?.link as string | undefined) || "";
        return !link.includes("/pages/langSet/index");
    });

    const getDefaultLink = (item: AccountItem, index: number): string => {
        const title = safeT(item.picTitle);
        for (const [key, url] of Object.entries(DEFAULT_ACCOUNT_LINKS)) {
            if (title === t(key)) {
                return url;
            }
        }
        if (!isOverseas()) {
            return DEFAULT_ACCOUNT_FALLBACK_URLS.filter((url) => !url.includes("/pages/langSet/index"))[index] || "";
        }
        return DEFAULT_ACCOUNT_FALLBACK_URLS[index] || "";
    };

    const handleItemClick = (item: AccountItem, index: number) => {
        const customLink = (item.picLink?.link as string | undefined)?.trim() || "";
        const url = customLink ? urlFormat(item.picLink as any) : getDefaultLink(item, index);
        if (url) {
            redirect({ url });
        }
    };

    return (
        <View className="dec-account" style={cssVars}>
            <View className="dec-account__container">
                {data.moduleTitle ? (
                    <View className="dec-account__header">
                        <View className="dec-account__title">{safeT(data.moduleTitle, t("账号"))}</View>
                    </View>
                ) : null}

                <View className="dec-account__list">
                    {accountList.map((item, index) => (
                        <View className="dec-account__item" key={index} onClick={() => handleItemClick(item, index)}>
                            <View className="dec-account__item-left">
                                <View className="dec-account__item-icon">{pickPic(item) ? <TigImage src={productImage(item)} mode="aspectFit" /> : null}</View>
                                <View className="dec-account__item-title">{safeT(item.picTitle)}</View>
                            </View>
                            <View className="dec-account__item-right">
                                {item.picDesc ? <Text className="dec-account__item-subtitle">{item.picDesc}</Text> : null}
                                <View className="dec-account__item-arrow iconfont icon-xiangyou" />
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}