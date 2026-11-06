import { useMemo } from "react";
import { Image, Text, View } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import { redirect, staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    showDownload?: boolean;
    downloadBusy?: boolean;
    /** 对应旧 v-model:modelValue */
    modelValue?: boolean;
    /** 对应旧 emit("update:modelValue") */
    onUpdateModelValue?: (val: boolean) => void;
    /** 对应旧 emit("download") */
    onDownload?: () => void;
}

/**
 * 商品页菜单弹窗组件（自旧 pages/product/src/menuPop.vue 移植）
 * - 快捷导航到首页、分类、购物车
 * - 弹窗形式展示菜单选项
 */
export default function MenuPop({ showDownload = false, downloadBusy = false, modelValue = false, onUpdateModelValue, onDownload }: Props) {
    // 对应旧 computed show（v-model:show 双向绑定）
    const setShow = (val: boolean) => {
        onUpdateModelValue?.(val);
    };

    const menuList = useMemo(
        () => [
            {
                icon: "common/home.svg",
                text: t("首页"),
                link: "/pages/index/index"
            },
            {
                icon: "common/search.svg",
                text: t("搜索"),
                link: "/pages/search/index"
            },
            {
                icon: "common/user.svg",
                text: t("个人中心"),
                link: "/pages/member/index"
            },
            {
                icon: "common/collection.svg",
                text: t("商品收藏"),
                link: "/pages/user/collectProduct/index"
            },
            {
                icon: "common/history.svg",
                text: t("查看足迹"),
                link: "/pages/user/historyProduct/index"
            },
            {
                icon: "common/message.svg",
                text: t("消息中心"),
                link: "/pages/im/page"
            }
        ],
        []
    );

    const handleDownload = () => {
        if (downloadBusy) return;
        setShow(false);
        onDownload?.();
    };

    const handelLink = (item: any) => {
        setShow(false);
        redirect({ url: item.link });
    };

    return (
        // 旧模板：<tig-popup v-model:show position="top" background-color="#fff" :show-close="false">
        // → NutUI Popup；旧 up-popup round=10（底部两角 10px 圆角）在 style 上补齐
        <Popup
            visible={modelValue}
            position="top"
            closeable={false}
            onClose={() => {
                setShow(false);
            }}
            style={{ background: "#fff", borderRadius: "0 0 20rpx 20rpx" }}
        >
            <View className="menu-box">
                <View className="menu-title">{t("快捷入口")}</View>
                <View className="menu-list">
                    {menuList.map((item, index) => (
                        <View
                            key={index}
                            className="menu-item"
                            onClick={() => {
                                handelLink(item);
                            }}
                        >
                            <View className="menu-item-icon">
                                <Image className="menu-item-img" src={staticResource(item.icon)} />
                            </View>
                            <View className="menu-item-text">{item.text}</View>
                        </View>
                    ))}
                    {showDownload ? (
                        <View className={`menu-item ${downloadBusy ? "download-busy" : ""}`} onClick={handleDownload}>
                            <View className="menu-item-icon">
                                <Text className="iconfont-h5 icon-sucai download-icon" />
                            </View>
                            <View className="menu-item-text">{t(downloadBusy ? "正在准备素材" : "素材下载")}</View>
                        </View>
                    ) : null}
                </View>
            </View>
        </Popup>
    );
}
