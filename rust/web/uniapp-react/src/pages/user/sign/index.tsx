import { useEffect, useMemo, useRef, useState } from "react";
import { Image, ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getSignList, signIn } from "@/api/user/sign";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import type { SignInfo } from "@/types/user/sign";
import { staticResource } from "@/utils";
import { productImage } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./index.scss";

/**
 * 签到打卡页（自旧 pages/user/sign/index.vue 逐行移植）
 * - 展示连续签到进度和每日可获得积分
 * - 支持每日打卡领取积分
 * - 展示今日特卖推荐商品
 */
export default function Sign() {
    usePageGuards();

    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    const integralName = useConfigStore((s) => s.integralName);

    const [signInfo, setSignInfo] = useState<SignInfo>({
        signPoints: 0,
        record: 0,
        isSign: 0,
        days: [],
        recommendGoods: []
    });
    const [scrollLeft, setScrollLeft] = useState(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const completed = useMemo(() => {
        const { days, record, isSign } = signInfo;
        // 上一周期已完成且今天未打卡时，展示待开始的新周期。
        return days.length > 0 && isSign === 0 && record >= days.length ? 0 : record;
    }, [signInfo, integralName, langCode]);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    const __getSignList = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result: any = await getSignList("user/sign/index");
            const next = { ...signInfo, ...result };
            setSignInfo(next);
            // 旧实现 Object.assign 后 nextTick 滚动；completed 需按新数据实时计算
            const nextCompleted =
                next.days.length > 0 && next.isSign === 0 && next.record >= next.days.length ? 0 : next.record;
            const index = next.isSign === 1 ? nextCompleted - 1 : nextCompleted;
            const currentIndex = Math.max(0, Math.min(index, next.days.length - 1));
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                Taro.createSelectorQuery()
                    .select(".selected-scroll")
                    .boundingClientRect((rect: any) => {
                        if (rect) setScrollLeft(Math.max(0, currentIndex * 50 - rect.width / 2 + 25));
                    })
                    .exec();
            }, 0);
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
        }
    };

    const sign = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            await signIn();
            Taro.showToast({
                title: t("打卡成功"),
                duration: 1000,
                icon: "none"
            });
            setTimeout(function () {
                void __getSignList();
            }, 1000);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                duration: 1500,
                icon: "none"
            });
        } finally {
            Taro.hideLoading();
        }
    };

    const toProductPage = (params: any) => {
        Taro.navigateTo({ url: "/pages/product/index?id=" + params.productId });
    };

    // 旧 onLoad
    useEffect(() => {
        void __getSignList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <TigLayout title={t("签到")}>
            <View className="qiandaoBox">
                <View className="title">{`${t("每日打卡领")}${integralName}`}</View>
                <View className="wrap" style={{ backgroundImage: `url(${staticResource("qiandao/bg.png")})` }}>
                    <View className="samll-title">
                        {t("今天打卡得")}
                        <Text>{signInfo.signPoints}</Text>
                        {t(integralName)}
                    </View>
                    <ScrollView className="selected-scroll" scrollX scrollLeft={scrollLeft} showScrollbar={false}>
                        <View className="selectedBox" style={{ width: `${Math.max(signInfo.days.length, 1) * 50}px` }}>
                            <View className="line" />
                            {signInfo.days.map((day, index) => (
                                <View className={`item${completed >= index + 1 ? " selected" : ""}`} key={index}>
                                    <View className="item-content">
                                        {completed < index + 1 ? <View className="num">{day.points}</View> : <View className="num" />}
                                        <View className="date">{day.name}</View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                    <View className="qiandaoBtnBox">
                        <View className="qdBtn">
                            {signInfo.isSign ? (
                                <View className="dk-now">
                                    <Text>{t("今日已打卡")}</Text>
                                </View>
                            ) : (
                                <View className="dk-now" onClick={sign}>
                                    <Text>{t("立即打卡")}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </View>
            {signInfo.recommendGoods && (
                <View className="recgoodsBox">
                    <View className="title">
                        <View className="bg" style={{ backgroundImage: `url(${staticResource("qiandao/hot_bg.png")})` }}>
                            {t("今日特卖 发现好货")}
                        </View>
                        <View className="moregoods" onClick={() => Taro.navigateTo({ url: "/pages/search/result?intro=hot" })}>
                            {t("查看更多")} <Text className="iconfont icon-xiangyou" />
                        </View>
                    </View>
                    <View className="wrapGoods">
                        {signInfo.recommendGoods.map((item, index) => (
                            <View className="item" key={index} onClick={() => toProductPage(item)}>
                                <Image className="rec-img" mode="aspectFill" lazyLoad src={productImage(item as any)} />
                                <View className="info">
                                    <View className="name">{item.productName}</View>
                                    <View className="price">
                                        <FormatPrice isBottom={false} priceData={item.productPrice} />
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </TigLayout>
    );
}