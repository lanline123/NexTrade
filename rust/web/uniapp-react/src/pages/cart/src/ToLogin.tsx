import { View, Text, Image } from "@tarojs/components";

import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";
import { handleLogin } from "@/utils/handleLogin";

import "./ToLogin.scss";

/**
 * 购物车登录引导组件（自旧 pages/cart/src/toLogin.vue 移植）
 * - 未登录状态显示登录提示
 * - 点击跳转登录页面
 *
 * TODO(MIGRATION)：旧 <tig-button> 尚无 React 版，以 .to-login-btn 样式 View 等价重写
 * （u-button 默认主题色实底按钮视觉）。
 */
export default function ToLogin() {
    return (
        <View className="to-login">
            <Image src={staticResource("common/login.png")} mode="widthFix" />
            <Text className="to-login-text">{t("暂未登录")}</Text>
            <View style={{ width: "114px" }}>
                <View className="to-login-btn" style={{ height: "60rpx" } as any} onClick={handleLogin}>
                    {t("去登录")}
                </View>
            </View>
        </View>
    );
}
