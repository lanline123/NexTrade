import { useMemo, useState } from "react";
import { Image, Swiper, SwiperItem, Text, View } from "@tarojs/components";

import RecProduct from "@/components/rec-product";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./index.scss";

/**
 * 会员等级展示页（自旧 pages/user/ranks/index.vue 逐行移植）
 * - 轮播展示各等级卡片及升级进度
 * - 显示当前等级标识
 * - 展示各等级对应的特权列表
 */
export default function Ranks() {
    usePageGuards();

    // 订阅语言，切换语言时重算文案
    const langCode = useI18nStore((s) => s.langCode);
    const integralName = useConfigStore((s) => s.integralName);

    const userInfo = {
        userName: "",
        userPhoto: "",
        userRank: 1,
        rankPoints: 10000
    };

    const userRankInfo = {
        specialRank: 0
    };

    const cardList = useMemo(
        () => [
            {
                rankId: 1,
                rankName: t("白银会员"),
                rankDesc: "还需0成长值可升级至白银会员",
                rate: 100,
                userRightIds: "1,2"
            },
            {
                rankId: 2,
                rankName: t("黄金会员"),
                rankDesc: "还需0成长值可升级至黄金会员",
                rate: 80,
                userRightIds: "1,2,3"
            },
            {
                rankId: 3,
                rankName: t("铂金会员"),
                rankDesc: "还需0成长值可升级至黄金会员",
                rate: 60,
                userRightIds: "1,2,3,4"
            },
            {
                rankId: 4,
                rankName: t("钻石会员"),
                rankDesc: "还需0成长值可升级至黄金会员",
                rate: 30,
                userRightIds: "1,2,3,4,5,6"
            }
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [langCode]
    );

    const userRights = useMemo(
        () => [
            {
                userRightId: "1",
                userRightLogo: "http://localhost/lyecs7/public/static/mobile/images/ranks/qiandao.png",
                userRightName: t("签到返利")
            },
            {
                userRightId: "2",
                userRightLogo: "http://localhost/lyecs7/public/static/mobile/images/ranks/jifenduihuan.png",
                userRightName: `${integralName}${t("兑换")}`
            },
            {
                userRightId: "3",
                userRightLogo: "http://oss.lyecs.com/img/gallery/demo/1680252172GwIt9xVFCcRuPHcaXK!!pic.png",
                userRightName: t("线下折扣")
            },
            {
                userRightId: "4",
                userRightLogo: "http://oss.lyecs.com/img/gallery/demo/1680252172j4ltKe4JWA75EofqYb!!pic.png",
                userRightName: t("运费折扣")
            },
            {
                userRightId: "5",
                userRightLogo: "http://oss.lyecs.com/img/gallery/demo/1680252172nLzWUg7tsAc0NEPshf!!pic.png",
                userRightName: t("会员特价")
            },
            {
                userRightId: "6",
                userRightLogo: "http://oss.lyecs.com/img/gallery/demo/16802521724D4cIMO08jbaZLuIHq!!pic.png",
                userRightName: t("消费返利")
            }
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [langCode, integralName]
    );

    const [userRightIds, setUserRightIds] = useState<string[]>(["1", "2"]);
    const [activeIndex, setActiveIndex] = useState(0);

    const swiperCardChange = (e: any) => {
        const current = e.detail.current;
        setActiveIndex(current);
        const newArr = String(cardList[current].userRightIds).split(",");
        setUserRightIds([...newArr]);
    };
    void activeIndex;

    return (
        <TigLayout title={t("会员等级")}>
            <View className="member-level">
                <View className="content">
                    <View className="content__header">
                        <Image className="member-level-head-background" mode="scaleToFill" src="http://localhost/lyecs7/public/static/mobile/images/ranks/bg.png" />
                        <View className="content__header__portrait">
                            <Image className="content__header__avatar" mode="aspectFill" src={userInfo.userPhoto} />
                            <Text className="content__header__name">{userInfo.userName}</Text>
                        </View>
                    </View>
                    <View className="ranks-swiper">
                        <Swiper
                            className="ranks-swiper__swiper"
                            indicatorDots={false}
                            circular={false}
                            interval={3000}
                            duration={500}
                            onChange={swiperCardChange}
                        >
                            {cardList.map((cardItem, index) => (
                                <SwiperItem key={index}>
                                    <View className="swiper__slider__cardbox">
                                        <Image
                                            src="http://localhost/lyecs7/public/static/mobile/images/ranks/rank-bg.png"
                                            className="swiper__slider__bg"
                                            mode="scaleToFill"
                                        />
                                        {userInfo.userRank === cardItem.rankId && <View className="swiper__slider__current">{t("当前等级")}</View>}
                                        <View className="swiper__slider__logo">Tigshop</View>
                                        <View className="swiper__slider__item item-color-1">
                                            <View className="swiper__slider__item__name">{cardItem.rankName}</View>
                                            <View className="swiper__slider__item__score">
                                                <View className="text flex-row">
                                                    <Text>{cardItem.rankDesc}</Text>
                                                </View>
                                            </View>
                                            <View className="swiper__slider__item__experience">
                                                <Text>{userInfo.rankPoints}</Text>
                                            </View>
                                            <View className="progress-container swiper__slider__item__progress">
                                                <View className="line" style={{ width: cardItem.rate + "%" }} />
                                            </View>
                                            <View className="long-with">
                                                <Text>{t("成长值")}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </SwiperItem>
                            ))}
                        </Swiper>
                    </View>
                    {userRights && (
                        <View className="rights">
                            <View className="rights__title">
                                <View className="rights__title-text">{t("我的特权")}</View>
                            </View>
                            <View className="rights__content">
                                {userRights.map((item) => (
                                    <View
                                        key={item.userRightId}
                                        className={`rights__content__item${
                                            (userRankInfo.specialRank === 1 || userRankInfo.specialRank === 0) && !userRightIds.includes(item.userRightId)
                                                ? " no-rank-select"
                                                : ""
                                        }`}
                                    >
                                        <View className="item-img-wrap">
                                            <View className={`suoding-icon${userRightIds.includes(item.userRightId) ? " no-rank-select-icon" : ""}`} />
                                            <Image
                                                src={item.userRightLogo}
                                                className="rights__content__item__img"
                                                mode="aspectFit"
                                                aria-label={item.userRightName}
                                            />
                                        </View>
                                        <View className="rights__content__item__txt">{item.userRightName}</View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                    <RecProduct url="user/sign/index" />
                </View>
                <View style={{ height: "10px" }} />
            </View>
        </TigLayout>
    );
}