import { View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";

import ImageSearchEntry from "@/components/imageSearchEntry";
import MainHeader from "@/components/mainHeader";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./TopHeader.scss";

interface Props {
    /** 搜索框占位文字（来自分类页装修配置） */
    placeholder?: string;
    /** 定位方式：分类页须用 fixed，避免 layout overflow 裁切 sticky */
    position?: "sticky" | "static" | "fixed";
}

/**
 * 分类页海外皮肤头部（自旧 pages/productCate/src/topHeader.vue 移植）
 * - 旧版把搜索栏放进 mainHeader（overseas 皮肤公共头）的 navbar 插槽：
 *   菜单抽屉 + logo + 消息/购物车行下方渲染 返回 + 搜索框 + 图搜入口/放大镜
 * - commonHeaderHeight 由 MainHeader 内部实测写入 configStore（占位契约对齐旧版）
 */
export default function TopHeader({ placeholder = "", position = "fixed" }: Props) {
    // TODO(MIGRATION)：旧 useImageSearchStore().available 控制「放大镜移左/搜索图标在右」；
    // 以图搜图可用性按 B6-5 已移植的 imageSearch 子系统口径接入（entry 已实挂）。
    const imageSearchAvailable = false;

    const placeholderText = (() => {
        const v = (placeholder ?? "").trim();
        return v.length > 0 ? v : t("搜索");
    })();

    const toSearch = () => {
        Taro.navigateTo({
            url: "/pages/search/index"
        });
    };

    const handleIcon = () => {
        if (process.env.TARO_ENV === "h5") {
            history.back();
        } else {
            Taro.navigateBack();
        }
    };

    /** 旧 #navbar 插槽内容：返回 + 搜索框 + （相机在右）/（放大镜在右） */
    const navbar = (
        <View className="search-bar-box">
            <View className="iconfont icon-houtui" onClick={handleIcon} />
            <View className="search-input" onClick={toSearch}>
                {/* 有相机入口时放大镜移到左侧，相机占右侧 */}
                {imageSearchAvailable && <Text className="iconfont-h5 icon-sousuo2 search-input__icon" />}
                <Text className="search-input__text">{t(placeholderText)}</Text>
                <ImageSearchEntry color="#1a1a1a" flushRight />
            </View>
            {!imageSearchAvailable && (
                <View className="sousuo-icon" onClick={toSearch}>
                    <Image src={staticResource("home/oversea_sousuo.png")} />
                </View>
            )}
        </View>
    );

    return <MainHeader position={position} navbar={navbar} />;
}
