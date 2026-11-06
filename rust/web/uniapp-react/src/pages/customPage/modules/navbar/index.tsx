import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { navigateBack } from "@/utils/navigation";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
}

/** 装修页面标题导航（自旧 modules/navbar/index.vue 移植） */
export default function NavbarModule({ module }: Props) {
    const showLeft = false;

    const handleIcon = () => {
        if (process.env.TARO_ENV === "h5") {
            history.back();
            return;
        }
        Taro.navigateBack().catch(() => {});
        void navigateBack;
    };

    return (
        <View className="tig-navbar">
            <View className="navbar-box" style={`background-color: ${module?.titleBackgroundColor}`}>
                <View className="navbar">
                    <View className="navbar-content">
                        <View className="left">
                            {showLeft && <View className="iconfont icon-houtui" onClick={handleIcon} />}
                        </View>

                        <View className="middle">
                            <View className="title line1" style={`color: ${module?.titleColor};`}>
                                <Text>{t(module?.title ?? "")}</Text>
                            </View>
                        </View>

                        <View className="right" />
                    </View>
                </View>
            </View>
            <View className="placeholder" />
        </View>
    );
}
