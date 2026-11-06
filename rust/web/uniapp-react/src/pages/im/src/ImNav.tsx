import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { useConfigStore } from "@/store/config";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./ImNav.scss";

interface Props {
    title?: string;
    background?: string;
    titleColor?: string;
    iconColor?: string;
    /** 旧调用点透传，保持 props 兼容（本组件未使用边框） */
    borderBottom?: boolean;
    onReadAll?: () => void;
}

/**
 * 聊天导航栏组件（自旧 pages/im/src/imNav.vue 移植）
 * - 聊天页面顶部导航
 * - 显示对方名称和在线状态
 */
export default function ImNav({
    title = "",
    background = "#f6f6f6",
    titleColor = "#333",
    iconColor = "#333",
    borderBottom = true,
    onReadAll
}: Props) {
    void borderBottom;
    const menuButtonInfo = useConfigStore((s) => s.menuButtonInfo);
    const safeAreaInsets = useConfigStore((s) => s.safeAreaInsets);

    const displayTitle = title || t("消息");

    // 旧实现取 configStore.saveTop；新 store 以 safeAreaInsets.top 承载同一含义
    const saveTop = safeAreaInsets.top + 10;

    // 计算安全区域顶部距离
    const safeTop = process.env.TARO_ENV === "weapp" ? menuButtonInfo.top : saveTop;

    // 导航栏总高度
    const navHeight =
        process.env.TARO_ENV === "weapp"
            ? // 小程序：胶囊顶部 + 胶囊高度 + 底部间距
              `${menuButtonInfo.top + menuButtonInfo.height + 8}px`
            : // H5/App：安全区域 + 内容高度
              `${safeAreaInsets.top + 50}px`;

    // 内容区域样式
    const contentStyle =
        process.env.TARO_ENV === "weapp"
            ? { top: `${menuButtonInfo.top}px`, height: `${menuButtonInfo.height}px` }
            : { top: `${safeTop}px`, height: "44px" };

    // 右侧按钮样式（避开小程序胶囊按钮）
    const rightStyle =
        process.env.TARO_ENV === "weapp"
            ? { marginRight: `${menuButtonInfo.width + 16}px` }
            : { marginRight: "16rpx" };

    // 返回事件
    const handleBack = () => {
        if (process.env.TARO_ENV === "h5") {
            history.back();
            return;
        }

        const pageList = Taro.getCurrentPages();
        if (pageList.length > 1) {
            Taro.navigateBack();
        } else {
            Taro.switchTab({ url: "/pages/index/index" });
        }
    };

    // 全部已读事件
    const handleReadAll = () => {
        onReadAll?.();
    };

    return (
        <View className="im-navbar">
            <View className="navbar-box" style={{ background }}>
                <View className="navbar">
                    <View className="navbar-content" style={contentStyle}>
                        {/* 左侧返回按钮 */}
                        <View className="left" onClick={handleBack}>
                            <Text className="iconfont icon-houtui" style={{ color: iconColor }} />
                        </View>

                        {/* 中间标题 */}
                        <View className="middle">
                            <Text className="title line1" style={{ color: titleColor }}>
                                {displayTitle}
                            </Text>
                        </View>

                        {/* 右侧全部已读 */}
                        <View className="right" style={rightStyle} onClick={handleReadAll}>
                            <View className="read-all">
                                <Image className="clear-icon" src={staticResource("im/clear.png")} mode="aspectFill" />
                                <Text className="clear-text">{t("全部已读")}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
            {/* 占位元素，防止内容被导航栏遮挡 */}
            <View className="placeholder" style={{ paddingTop: navHeight }} />
        </View>
    );
}