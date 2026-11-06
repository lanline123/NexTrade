import { useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import { useLoad } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getShopDetail } from "@/api/shop/shop";
import { getStoreDetail } from "@/api/store/store";
import { imageFormat } from "@/utils/format";
import { useConfigStore } from "@/store/config";
import { usePageGuards } from "@/utils/pageMixin";
import { t } from "@/utils/i18n";

import "./license.scss";

/**
 * @description 营业执照公示页（自旧 pages/shop/license.vue 150 行移植）
 * - 店铺信息页、门店信息弹层点击资质后进入
 * - 只认 businessLicensePic，公示页展示真实执照原图
 */
export default function ShopLicense() {
    usePageGuards();

    const baseShopTitle = useConfigStore((s) => s.baseInfo.shopTitle);

    const [loading, setLoading] = useState(true);
    const [licensePic, setLicensePic] = useState("");

    const licenseUrl = licensePic ? imageFormat(licensePic) : "";
    const watermarkText = `${baseShopTitle || ""}${t("营业执照信息公示专用")}`;

    const loadLicense = async (id: number, store: boolean) => {
        setLoading(true);
        setLicensePic("");
        if (!id) {
            setLoading(false);
            return;
        }
        try {
            const result: any = store ? await getStoreDetail({ shopId: id }) : await getShopDetail(id);
            const pic = result?.businessLicensePic;
            setLicensePic(typeof pic === "string" && pic.trim() ? pic.trim() : "");
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useLoad((options: any) => {
        const store = options?.source === "store";
        if (options?.shopId) {
            const id = Number(options.shopId);
            void loadLicense(id, store);
        } else {
            setLoading(false);
        }
    });

    return (
        <TigLayout title={t("工商资质")} background="#fff">
            <View className="license-page">
                <View className="doc-title">{t("网店经营者营业执照信息")}</View>
                <View className="doc-notice">{t("根据相关法律法规要求，网店经营相关资质信息公示如下：")}</View>
                <View className="cert-box">
                    <View className="watermark" aria-hidden="true">
                        {Array.from({ length: 24 }, (_, index) => (
                            <Text key={index}>{watermarkText}</Text>
                        ))}
                    </View>
                    {licenseUrl ? (
                        <Image className="cert-img" src={licenseUrl} mode="widthFix" />
                    ) : !loading ? (
                        <View className="cert-empty">{t("暂无营业执照")}</View>
                    ) : null}
                </View>
                <View className="doc-notes">
                    <View>{t("注：以上营业执照信息来源于卖家自行申报或市监部门系统数据，具体以市监部门登记为准。")}</View>
                    <View>
                        {t(
                            "经营者需确保信息真实有效，平台也将定期核查，如与实际不符，为避免违规，请联系当地市监部门或平台客服更新。"
                        )}
                    </View>
                </View>
            </View>
        </TigLayout>
    );
}
