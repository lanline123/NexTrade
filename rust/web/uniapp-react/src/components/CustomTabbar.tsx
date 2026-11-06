import { View, Image, Text } from "@tarojs/components";

import { useTabbarDerived } from "@/store/tabbar";
import { redirect } from "@/utils";

import "./CustomTabbar.scss";

/**
 * 自定义底部导航（消费后台导航装修数据）。
 * 旧方案通过 pages.json tabBar + 页面内组件实现；Taro Phase 1 不声明原生 tabBar，
 * 由四个 tab 页各自渲染本组件，后续 weapp 真机验证时再决定是否切原生 custom-tab-bar。
 */
export default function CustomTabbar() {
    const { tabbarList, tabbarHeight, tabbarBackground, tabbarRadius, currentActiveValue } = useTabbarDerived();

    if (!tabbarList.length) {
        return null;
    }

    return (
        <View
            className="custom-tabbar"
            style={{ height: tabbarHeight, background: tabbarBackground || undefined, borderRadius: tabbarRadius }}
        >
            {tabbarList.map((item, index) => (
                <View
                    key={`${item.link}-${index}`}
                    className={`custom-tabbar__item ${index === currentActiveValue ? "is-active" : ""}`}
                    onClick={() => {
                        if (index === currentActiveValue) return;
                        redirect({ url: item.link, mode: "navigateTo" });
                    }}
                >
                    <Image className="custom-tabbar__icon" src={index === currentActiveValue ? item.activeImage : item.image} mode="aspectFit" />
                    <Text className="custom-tabbar__text">{item.text}</Text>
                </View>
            ))}
        </View>
    );
}
