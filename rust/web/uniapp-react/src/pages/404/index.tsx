import { View, Text, Image } from "@tarojs/components";

import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";
import { redirect } from "@/utils";

import "./index.scss";
import { usePageGuards } from "@/utils/pageMixin";

export default function NotFound() {
    usePageGuards();
    return (
        <View className="page-404">
            <Image className="page-404__img" mode="widthFix" src={staticResource("common/index_empty.png")} />
            <Text className="page-404__text">{t("页面不存在")}</Text>
            <View className="page-404__btn" onClick={() => redirect({ url: "/pages/index/index", mode: "reLaunch" })}>
                <Text>{t("回到首页")}</Text>
            </View>
        </View>
    );
}
