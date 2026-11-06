import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { useConfigStore } from "@/store/config";
import { getPx } from "@/utils";
import { t } from "@/utils/i18n";

import "./CartHeard.scss";

interface Props {
    /** 是否显示编辑按钮 */
    showEditButton?: boolean;
    /** 是否处于编辑模式 */
    isEditMode?: boolean;
    /** 编辑按钮主题色 */
    themeColor?: string;
    /** 是否显示返回键（非 tab 购物车页需要） */
    showBack?: boolean;
    /** 是否自定义返回事件 */
    customBack?: boolean;
    /** 是否需要状态栏占位；叠在 mainHeader 下时关 */
    needStatusBar?: boolean;
    /** fixed 顶偏移（px），通常为 mainHeader 实测高度 */
    offsetTop?: number;
    /** 对应旧 @emit("edit") */
    onEdit?: () => void;
    /** 对应旧 @emit("back") */
    onBack?: () => void;
}

/**
 * 购物车顶栏（自旧 pages/cart/src/cartHeard.vue 移植）：
 * - 标题 + 右侧「编辑/完成」入口
 * - 可选返回键（cartJump 等非 tab 页）
 * - 外贸皮肤下可顶在 mainHeader 下方（offsetTop + 关闭自身状态栏）
 *
 * TODO(MIGRATION)：旧 navbarContent 组件尚未整体移植，其 fixed/状态栏/胶囊避让/占位逻辑
 * 在本组件内按 components/navbarContent/index.vue 逐行等价实现（两个模板分支仅差
 * paddingRight 注入与状态栏占位，其余结构一致）。
 */
export default function CartHeard({
    showEditButton = true,
    isEditMode = false,
    themeColor = "var(--general)",
    showBack = false,
    customBack = false,
    needStatusBar = true,
    offsetTop = 0,
    onEdit,
    onBack
}: Props) {
    const menuButtonInfo = useConfigStore((s) => s.menuButtonInfo);
    const safeAreaInsets = useConfigStore((s) => s.safeAreaInsets);

    // 对应旧 navbarContent computed statusBarTop：胶囊优先，回退安全区
    const statusBarTop = menuButtonInfo.top ? menuButtonInfo.top - 2 : safeAreaInsets.top;

    // 对应旧 navbarContent computed navbarHeight：有胶囊时用胶囊高度 +4，否则按 props.height 换算（79.6rpx）
    const navbarHeight = menuButtonInfo.top ? menuButtonInfo.height + 4 : Number(getPx("79.6rpx", false));

    // 对应旧 navbarContent computed paddingRight：仅 needStatusBar 分支注入胶囊避让
    const paddingRight = menuButtonInfo.width ? menuButtonInfo.width + 5 : 0;

    let backLock = false;
    const handleBack = () => {
        if (backLock) return;
        backLock = true;
        setTimeout(() => {
            backLock = false;
        }, 400);
        if (customBack) {
            onBack?.();
            return;
        }
        Taro.navigateBack({
            fail: () => {
                Taro.switchTab({ url: "/pages/index/index" });
            }
        });
    };

    const renderContent = () => (
        <View className="cart-heard-content">
            <View className="cart-heard-left">
                {showBack && <View className="cart-heard-back iconfont icon-houtui" onClick={handleBack} />}
                <Text className="cart-heard-text">{t("购物车")}</Text>
            </View>
            {showEditButton && (
                <View className="cart-heard-edit" style={{ color: themeColor } as any} onClick={onEdit}>
                    {isEditMode ? t("完成") : t("编辑")}
                </View>
            )}
        </View>
    );

    return (
        <View className="cart-heard">
            {/* navbarContent 的 navbar-box：fixed + top 偏移 + z-index 400（旧模板 :z-index="400" background="#fff"） */}
            <View className="navbar-box nav-content-dnBzczIyODI" style={{ position: "fixed", background: "#fff", top: `${offsetTop || 0}px`, zIndex: "400" } as any}>
                {needStatusBar && <View className="status-bar" style={{ paddingTop: `${statusBarTop}px` }} />}

                {needStatusBar ? (
                    <View className="navbar flex" style={{ height: `${navbarHeight}px`, paddingRight: `${paddingRight}px` }}>{renderContent()}</View>
                ) : (
                    <View className="navbar flex" style={{ height: `${navbarHeight}px` }}>{renderContent()}</View>
                )}
            </View>
            {/* navbarContent 的 placeholder：fixed 后占位（needStatusBar 时含状态栏高度） */}
            <View className="cart-heard-placeholder" style={{ paddingTop: `calc(${needStatusBar ? statusBarTop : 0}px + ${navbarHeight}px)` }} />
        </View>
    );
}
