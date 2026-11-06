import type { CSSProperties } from "react";
import { useState } from "react";
import { Image, PageMeta, Text, View } from "@tarojs/components";
import { useDidShow, useLoad } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigLoadingPage from "@/components/tig/tig-loadingpage/index";
import { getShopDetail } from "@/api/shop/shop";
import type { ShopDetailItem } from "@/types/shop/shop";
import licenseThumb from "@/static/images/shop/license-thumb.png";
import { imageFormat, formatPadZero } from "@/utils/format";
import { redirect, getPx } from "@/utils";
import { useConfigStore } from "@/store/config";
import { useThemeStore } from "@/store/theme";
import { navigateBack } from "@/utils/navigation";
import { usePageGuards } from "@/utils/pageMixin";
import { t } from "@/utils/i18n";

import "./info.scss";

/** 接口无分时按门店列表惯例展示 5 分 */
const normalizeScore = (value: unknown) => {
    const score = Number(value);
    return score > 0 ? Math.min(score, 5) : 5;
};

/**
 * @description 店铺信息页（自旧 pages/shop/info.vue 412 行移植）
 * - 身份区直接替换标题栏：处理顶部安全区，微信小程序避开胶囊
 * - 白底；体验分每条独立、带间隔
 * - 基础信息只展示资质证照；有 businessLicensePic 才出现，入口用示例缩略图
 */
export default function ShopInfo() {
    usePageGuards();

    const menuButtonInfo = useConfigStore((s) => s.menuButtonInfo);
    const safeAreaTop = useConfigStore((s) => s.safeAreaInsets.top);
    const themeStyle = useThemeStore((s) => s.themeStyle);

    const [shopId, setShopId] = useState(0);
    const [shopInfo, setShopInfo] = useState<Partial<ShopDetailItem>>({});
    const [loading, setLoading] = useState(true);

    const generalColor = themeStyle["--general"] || "#ff4444";

    /** 顶栏贴齐胶囊：上内边距用胶囊 top，右侧留出胶囊宽度 */
    const identityStyle: CSSProperties = {
        paddingTop: `${menuButtonInfo.top || safeAreaTop || 8}px`,
        paddingRight: `${menuButtonInfo.width ? menuButtonInfo.width + 8 : 12}px`
    };

    const backSize = menuButtonInfo.height ? menuButtonInfo.height + 4 : (getPx("64rpx") as number);
    const backStyle: CSSProperties = {
        width: `${backSize}px`,
        height: `${backSize}px`
    };

    /** 前台只认非空执照快照 */
    const licensePicRaw = shopInfo.businessLicensePic;
    const licensePic = typeof licensePicRaw === "string" && licensePicRaw.trim() ? licensePicRaw : "";

    const fanCountValue = Number(shopInfo.collectCount);
    const fanCount = fanCountValue > 0 ? fanCountValue : 0;

    const totalScore = normalizeScore(shopInfo.shopStar || shopInfo.productScore);
    const displayStar = Number(formatPadZero(totalScore));
    /** 旧 uni-rate allow-half：就近取 0.5，用两层星叠加按百分比裁切还原半星 */
    const starValue = Math.round(displayStar * 2) / 2;

    const experienceMetrics = [
        { key: "quality", label: "宝贝质量", score: normalizeScore(shopInfo.productScore || shopInfo.shopStar) },
        { key: "logistics", label: "物流速度", score: normalizeScore(shopInfo.shopStar) },
        { key: "service", label: "服务保障", score: normalizeScore(shopInfo.shopStar) }
    ];

    const scorePercent = (score: number) => `${Math.round((normalizeScore(score) / 5) * 100)}%`;

    /** @description 拉取店铺详情 */
    const loadShopInfo = async (id: number) => {
        if (!id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            setShopInfo(await getShopDetail(id));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    /** @description 进入营业执照公示页 */
    const openLicensePage = () => {
        if (!shopId) return;
        redirect({ url: `/pages/shop/license?shopId=${shopId}` });
    };

    const handleBack = () => {
        // 旧实现：#ifdef H5 走 history.back()，#ifndef H5 按页面栈长度 navigateBack / switchTab 首页；
        // 项目已按「无原生 tabBar」统一收敛为 utils/navigation.navigateBack（空栈 reLaunch 首页，见 MIGRATION §3）
        navigateBack();
    };

    useLoad((options: any) => {
        if (options?.shopId) {
            const id = Number(options.shopId);
            setShopId(id);
            void loadShopInfo(id);
        } else {
            setLoading(false);
        }
    });

    // 对应旧 onShow：重新测量胶囊与系统信息（H5/App 端 getMenuButtonInfo 内部已跳过）
    useDidShow(() => {
        const configStore = useConfigStore.getState();
        configStore.getMenuButtonInfo();
        configStore.getSystemInfo();
    });

    return (
        <>
            <PageMeta pageStyle="background-color: #fff" />
            <TigLayout shopId={shopId}>
                {!loading && (
                    <View className="shop-info-page">
                        <View className="identity" style={identityStyle}>
                            <View className="identity-back" style={backStyle} onClick={handleBack}>
                                <Text className="iconfont icon-houtui" />
                            </View>
                            {/* image-guideline: allow-low-res reason="店铺详情接口仅返回 shopLogo，无 picLarge 变体" */}
                            <Image className="identity-logo" src={imageFormat(shopInfo.shopLogo || "")} mode="aspectFit" />
                            <View className="identity-meta">
                                <View className="identity-name line1">{shopInfo.shopTitle || t("店铺名称")}</View>
                                <View className="identity-rate">
                                    <View className="identity-stars" style={{ color: generalColor }}>
                                        <Text className="identity-stars-bg">★★★★★</Text>
                                        <View className="identity-stars-clip" style={{ width: `${(starValue / 5) * 100}%` }}>
                                            <Text className="identity-stars-fg">★★★★★</Text>
                                        </View>
                                    </View>
                                    <Text className="identity-score">{formatPadZero(totalScore)}</Text>
                                    {fanCount ? (
                                        <>
                                            <View className="identity-divider" />
                                            <Text className="identity-fans">
                                                {fanCount}
                                                {t("粉丝")}
                                            </Text>
                                        </>
                                    ) : null}
                                </View>
                            </View>
                        </View>

                        <View className="page-body">
                            <View className="section-title">{t("店铺真实体验分")}</View>
                            <View className="score-list">
                                <View className="score-item">
                                    <Text className="score-label score-label--total">{t("店铺总分")}</Text>
                                    <View className="score-row score-row--total">
                                        <Text className="score-num is-lg">{formatPadZero(totalScore)}</Text>
                                    </View>
                                </View>
                                {experienceMetrics.map((item) => (
                                    <View key={item.key} className="score-item">
                                        <Text className="score-label">{t(item.label)}</Text>
                                        <View className="score-row">
                                            <View className="score-bar">
                                                <View
                                                    className="score-fill"
                                                    style={{ width: scorePercent(item.score), background: generalColor }}
                                                />
                                            </View>
                                            <Text className="score-num">{formatPadZero(item.score)}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>

                            {/* 基础信息只展示资质证照：有执照快照才出现，入口用示例缩略图，点击进公示页看原图 */}
                            {licensePic && (
                                <View className="section">
                                    <View className="section-title">{t("基础信息")}</View>
                                    <View className="sub-title">{t("资质证照")}</View>
                                    <View className="license-card" onClick={openLicensePage}>
                                        <View className="license-text">
                                            <View className="license-title">{t("资质证照")}</View>
                                            <View className="license-link">
                                                {t("查看商家资质信息")}
                                                <Text className="iconfont icon-xiangyou" />
                                            </View>
                                        </View>
                                        {/* image-guideline: allow-low-res reason="资质入口使用本地示例图，真实执照在公示页展示" */}
                                        <Image className="license-img" src={licenseThumb} mode="widthFix" />
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                )}
                <TigLoadingPage modelValue={loading} />
            </TigLayout>
        </>
    );
}
