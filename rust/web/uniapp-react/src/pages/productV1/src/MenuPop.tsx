import { useMemo } from "react";
import { Image, View } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import { redirect, staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./MenuPop.scss";

interface Props {
    /** 对应旧 v-model:modelValue */
    modelValue?: boolean;
    /** 对应旧 emit("update:modelValue") */
    onUpdateModelValue?: (val: boolean) => void;
}

/**
 * 商品页菜单弹窗组件（自旧 pages/productV1/src/menuPop.vue 移植）
 * - 快捷导航到首页、分类、购物车
 * - 弹窗形式展示菜单选项
 *
 * 与 B2 pages/product/src/menuPop 的差异：productV1 版无素材下载入口
 * （showDownload/downloadBusy/onDownload），故按旧源码独立落盘。
 */
export default function MenuPop({ modelValue = false, onUpdateModelValue }: Props) {
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

    const handelLink = (item: any) => {
        setShow(false);
        redirect({ url: item.link });
    };

    return (
        // 旧模板：<tig-popup v-model:show position="top" background-color="#fff" :show-close="false">
        // → NutUI Popup
        <Popup
            visible={modelValue}
            position="top"
            closeable={false}
            onClose={() => {
                setShow(false);
            }}
            style={{ background: "#fff" }}
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
                </View>
            </View>
        </Popup>
    );
}