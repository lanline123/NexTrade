import { useEffect } from "react";
import { View, Image, Text } from "@tarojs/components";

import { useTabbarStore, useTabbarDerived } from "@/store/tabbar";
import { useCartStore } from "@/store/cart";
import { redirect } from "@/utils";
import { urlFormat, imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./TigTabbar.scss";

interface Props {
    backgroundColor?: string;
    color?: string;
    activeColor?: string;
}

export default function TigTabbar({ backgroundColor = "#fff", color = "#000", activeColor = "#ea3c2d" }: Props) {
    const { tabbarList, tabbarEnableAnimation, tabbarBackground, tabbarRadius, tabbarIconColorType, tabbarUnselectedTextColor, tabbarSelectedTextColor, formatTabarList, currentActiveValue } =
        useTabbarDerived();
    const cartCount = useCartStore((s) => s.cartCount);
    const fetchCartCount = useCartStore((s) => s.fetchCartCount);
    const currRoute = useTabbarStore((s) => s.currRoute);

    useEffect(() => {
        void fetchCartCount();
    }, [currRoute, fetchCartCount]);

    // 自定义背景色优先，否则用系统默认
    const effectiveBackgroundColor = tabbarBackground || backgroundColor;
    // 自定义配色时用后台文字色，否则用系统默认
    const isCustomColor = tabbarIconColorType === 2;
    const effectiveColor = isCustomColor && tabbarUnselectedTextColor ? tabbarUnselectedTextColor : color;
    const effectiveActiveColor = isCustomColor && tabbarSelectedTextColor ? tabbarSelectedTextColor : activeColor;

    const isCartTab = (index: number) => {
        const path = formatTabarList[index];
        return path && path.includes("/pages/cart/");
    };

    const handleTabbar = (item: any, index: number) => {
        if (currentActiveValue === index) return;

        if (item.link) {
            redirect({ url: urlFormat(item.link) });
        }
    };

    return (
        <View className="tabbar-box">
            <View className="tabbar-container" style={`background-color: ${effectiveBackgroundColor}; border-radius: ${tabbarRadius};`}>
                <View className="tabbar">
                    {tabbarList.map((item, index) => (
                        <View key={index} className="tabbar-item" style={`color: ${effectiveColor};`} onClick={() => handleTabbar(item, index)}>
                            <View
                                className={`tabbar-icon ${tabbarEnableAnimation && currentActiveValue === index ? "tabbar-icon--animated tabbar-icon--active" : ""}`}
                            >
                                <View className="icon-wrapper">
                                    <Image
                                        v-show={currentActiveValue === index ? undefined : undefined}
                                        className="tabbar-icon-img"
                                        src={imageFormat(currentActiveValue === index ? item.activeImage : item.image)}
                                    />
                                    {isCartTab(index) && cartCount > 0 && (
                                        <View className="cart-badge">{cartCount > 99 ? "99+" : cartCount}</View>
                                    )}
                                </View>
                            </View>
                            <View className={`tabbar-text ${currentActiveValue === index ? "active" : ""}`}>
                                <Text style={currentActiveValue === index ? `color: ${effectiveActiveColor};` : ""}>{t(item.text)}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
            <View className="placeholder" />
        </View>
    );
}
