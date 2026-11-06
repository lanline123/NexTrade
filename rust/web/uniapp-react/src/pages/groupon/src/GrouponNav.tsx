import { Text, View } from "@tarojs/components";

import TigNavbar from "@/components/tig/tig-navbar/TigNavbar";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";

import "./GrouponNav.scss";

/**
 * 拼团导航栏组件（自旧 pages/groupon/src/grouponNav.vue 移植）
 * - 拼团页面顶部导航
 * - 提供返回按钮
 */
export default function GrouponNav() {
    /**
     * 处理返回按钮点击，跳转到个人中心页面
     */
    const handleBack = () => {
        redirect({
            url: "/pages/member/index",
            mode: "redirectTo"
        });
    };

    /**
     * 处理跳转搜索页面
     */
    const handleSearch = () => {
        redirect({
            url: "/pages/search/index",
            param: {
                redirectPath: "/pages/groupon/mylist",
                searchHistoryKey: "mygrouponSerchHistory",
                navbarTitle: t("搜索我的拼团"),
                placeholder: t("点击搜索"),
                isSwitchTab: true
            }
        });
    };

    const rightSlot = (
        <View className="groupon-nav__rigth-icon">
            <View className="click-placehoder" onClick={handleSearch} />
            <Text className="iconfont-h5 icon-sousuo" />
        </View>
    );

    return (
        <View className="groupon-nav">
            <TigNavbar title={t("我的拼团")} customBack onBack={handleBack} rightSlot={rightSlot} />
        </View>
    );
}