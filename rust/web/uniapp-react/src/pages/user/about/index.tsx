import { Image, View } from "@tarojs/components";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./index.scss";

/**
 * 关于页面（自旧 pages/user/about/index.vue 逐行移植）
 * - 展示应用 Logo、版本号
 * - 显示 ICP 备案号、公司信息、版权声明
 */
export default function About() {
    usePageGuards();

    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    void langCode;

    const shopLogo = useConfigStore((s) => s.baseInfo.shopLogo);
    const shopTitle = useConfigStore((s) => s.baseInfo.shopTitle);
    const version = useConfigStore((s) => s.version);
    const shopIcpNo = useConfigStore((s) => s.shopIcpNo);
    const shopCompanyTxt = useConfigStore((s) => s.shopCompanyTxt);

    return (
        <TigLayout title={t("关于")} borderBottom>
            <View className="container">
                <View className="version-info">
                    <View className="logo">
                        <Image className="image" mode="widthFix" src={imageFormat(shopLogo)} />
                    </View>
                    <View className="version-code">{version}</View>
                    <View className="update-tip">{t("当前已是最新版本")}</View>
                </View>
                <View className="copyrigth-info-wrap">
                    <View className="row-info">{t(shopIcpNo)}</View>
                    <View className="row-info">{t(shopCompanyTxt)}</View>
                    <View className="row-info">
                        {t(shopTitle)} {t("版权所有")}
                    </View>
                </View>
            </View>
        </TigLayout>
    );
}