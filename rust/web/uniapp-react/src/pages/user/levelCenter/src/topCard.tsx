import { useEffect, useMemo, useState } from "react";
import { Image, Swiper, SwiperItem, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { useUserStore } from "@/store/user";
import type { Rank, Right, RightUnion } from "@/types/user/level";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./topCard.scss";

interface Props {
    list: Rank[];
}

/**
 * 会员等级卡片（自旧 pages/user/levelCenter/src/topCard.vue 逐行移植）
 * - 横向 swiper 展示各级别卡片（纯色/自定义背景两种模式）
 * - 卡片底部按 rankType 展示成长值或消费升级差额
 * - 底部展示当前等级前 4 项权益，超出显示「全部权益」
 */
export default function TopCard({ list = [] }: Props) {
    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    void langCode;

    const integralName = useConfigStore((s) => s.integralName);
    const userInfo = useUserStore((s) => s.userInfo);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentCard, setCurrentCard] = useState<Partial<Rank>>({
        // 当前会员卡片信息
        discount: "0.0",
        freeShipping: 0,
        rankPoint: "0"
    });
    const [currentRightUnion, setCurrentRightUnion] = useState<RightUnion[]>([]);
    const [rankId, setRankId] = useState(0);

    const rightList = useMemo(() => list.map((item) => item.rights), [list]);

    /** 合并固定权益 + 自定义权益（对应旧 currentRightUnion.push 逻辑） */
    const buildRightUnion = (card: Partial<Rank>): RightUnion[] => {
        const union: RightUnion[] = [];
        if (card.discount != "0.0") {
            union.push({ iconImg: "discount", isChecked: 1, rightName: card.discount + t("折") });
        }
        if (card.freeShipping === 1) {
            union.push({ iconImg: "freeShoping", isChecked: 1, rightName: t("包邮") });
        }
        if (card.rankPoint != "0") {
            union.push({ iconImg: "point", isChecked: 1, rightName: card.rankPoint + `${t("倍")}${integralName}` });
        }
        card.rights?.forEach((item: Right) => {
            if (item.isChecked == 1) {
                union.push(item);
            }
        });
        return union;
    };

    // 旧 watch(() => props.list, ..., { deep: true, immediate: true })
    useEffect(() => {
        setRankId(list[0]?.rankId as number);
        const index = list.findIndex((item) => item?.rankLevel === userInfo?.rankLevel);
        setCurrentIndex(index);
        if (index === -1) {
            return;
        }
        const card = list[index];
        setCurrentCard(card);
        setCurrentRightUnion(buildRightUnion(card));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list, userInfo?.rankLevel, integralName]);

    const rankExpireTime = useMemo(() => {
        if (userInfo.rankExpireTime == 0) {
            return t("永久");
        } else {
            return userInfo.rankExpireTime?.slice(0, 10);
        }
    }, [userInfo.rankExpireTime, langCode]);

    // 滑动事件
    const handleAnimationFinish = (e: any) => {
        const index = e.detail.current;
        const card = list[index];
        setCurrentCard(card);
        setRankId(card.rankId);
        setCurrentRightUnion(buildRightUnion(card));
    };

    const toRightDetail = () => {
        Taro.navigateTo({
            url: "/pages/user/levelCenter/benefit?rankId=" + rankId
        });
    };

    const cssVariable = {
        "--discountBg": `url(${staticResource("user/discount.png")})`,
        "--freeShopingBg": `url(${staticResource("user/free_shoping.png")})`,
        "--pointBg": `url(${staticResource("user/point.png")})`
    } as Record<string, string>;

    return (
        <View className="top_card_container" style={cssVariable as any}>
            <View className="margin">
                <Swiper
                    nextMargin="16rpx"
                    className="card_swiper"
                    current={currentIndex}
                    onAnimationFinish={handleAnimationFinish}
                >
                    {list.map((item) => (
                        <SwiperItem key={item?.rankId} className="card_swiper_item">
                            {/* 颜色背景 */}
                            {item?.rankCardType === 1 && (
                                <View className={`card_item ${item?.rankIco || ""}`}>
                                    <View className="level_name_wrap">
                                        <View className="level_name">{item?.rankName}</View>
                                        <View className="level_expiry">{t("当前等级有效期至") + " " + rankExpireTime}</View>
                                    </View>
                                    {item?.rankLevel === userInfo.rankLevel && <View className="card_badge">{t("当前等级")}</View>}
                                    <View className="card_bottom">
                                        {/* 成长值模式 */}
                                        {userInfo.rankType === 1 && (
                                            <>
                                                {item?.rankLevel === userInfo.rankLevel ? (
                                                    <View className="level_value_wapper">
                                                        <Text className="level_value">{userInfo?.growthPoints}</Text>
                                                        <Text className="desc">{t("成长值")}</Text>
                                                    </View>
                                                ) : (
                                                    <View className="upgrades_wapper">
                                                        <Text className="desc">{t("再获得")}</Text>
                                                        <Text className="level_value">
                                                            {item?.minGrowthPoints - userInfo.growth < 0 ? 0 : item?.minGrowthPoints - userInfo.growth}
                                                        </Text>
                                                        <Text className="desc"> {t("成长值升级为该等级")}</Text>
                                                    </View>
                                                )}
                                            </>
                                        )}
                                        {/* 消费模式 */}
                                        {userInfo.rankType === 2 && (
                                            <>
                                                {item?.rankLevel === userInfo.rankLevel ? (
                                                    <View className="level_value_wapper">
                                                        <Text className="level_value">{userInfo?.growthPoints}</Text>
                                                        <Text className="desc">{t("成长值")}</Text>
                                                    </View>
                                                ) : (
                                                    <View className="upgrades_wapper">
                                                        <Text className="desc">{t("再消费")}</Text>
                                                        <Text className="level_value">
                                                            {item?.minGrowthPoints - userInfo.growth < 0 ? 0 : item?.minGrowthPoints - userInfo.growth}
                                                        </Text>
                                                        <Text className="desc"> {t("元升级为该等级")}</Text>
                                                    </View>
                                                )}
                                            </>
                                        )}
                                    </View>
                                </View>
                            )}
                            {/* 自定义背景图片模式 */}
                            {item?.rankCardType === 2 && (
                                <View className="card_item" style={`background-image: url(${item?.rankBg});`}>
                                    <View className="level_name_wrap">
                                        <View className="level_name">{item?.rankName}</View>
                                        <View className="level_expiry">{t("当前等级有效期至") + " " + rankExpireTime}</View>
                                    </View>
                                    {item?.rankLevel === userInfo.rankLevel && <View className="card_badge">{t("当前等级")}</View>}
                                    {item?.rankLevel === userInfo.rankLevel && <View className="card_code_icon" />}
                                    <View className="card_bottom">
                                        {/* 成长值模式 */}
                                        {userInfo.rankType === 1 && (
                                            <>
                                                {item?.rankLevel === userInfo.rankLevel ? (
                                                    <View className="level_value_wapper">
                                                        <Text className="level_value">{userInfo?.growthPoints}</Text>
                                                        <Text className="desc">{t("成长值")}</Text>
                                                    </View>
                                                ) : (
                                                    <View className="upgrades_wapper">
                                                        <Text className="desc">{t("再获得")}</Text>
                                                        <Text className="level_value">
                                                            {item?.minGrowthPoints - userInfo.growth < 0 ? 0 : item?.minGrowthPoints - userInfo.growth}
                                                        </Text>
                                                        <Text className="desc"> {t("成长值升级为该等级")}</Text>
                                                    </View>
                                                )}
                                            </>
                                        )}
                                        {/* 消费模式 */}
                                        {userInfo.rankType === 2 && (
                                            <>
                                                {item?.rankLevel === userInfo.rankLevel ? (
                                                    <View className="level_value_wapper">
                                                        <Text className="level_value">{userInfo?.growthPoints}</Text>
                                                        <Text className="desc">{t("成长值")}</Text>
                                                    </View>
                                                ) : (
                                                    <View className="upgrades_wapper">
                                                        <Text className="desc">{t("再消费")}</Text>
                                                        <Text className="level_value">
                                                            {item?.minGrowthPoints - userInfo.growth < 0 ? 0 : item?.minGrowthPoints - userInfo.growth}
                                                        </Text>
                                                        <Text className="desc"> {t("元升级为该等级")}</Text>
                                                    </View>
                                                )}
                                            </>
                                        )}
                                    </View>
                                </View>
                            )}
                        </SwiperItem>
                    ))}
                </Swiper>
            </View>
            <View className="level_rights_list">
                {currentRightUnion.slice(0, 4).map((item, index) => (
                    <View className="right_item" key={index} onClick={toRightDetail}>
                        {item.iconImg ? (
                            <>
                                {/* 固定权益 */}
                                <View className={`icon_img ${item.iconImg}`} />
                                <View className="name">{item.rightName}</View>
                            </>
                        ) : (
                            item.isChecked === 1 && (
                                <>
                                    {/* 自定义权益 */}
                                    <View className="icon_wapper">
                                        <Image className="icon" src={item?.icon} />
                                    </View>
                                    <View className="name">{item?.name}</View>
                                </>
                            )
                        )}
                    </View>
                ))}
                {/* 权益长度超过4个 */}
                {currentRightUnion.length > 4 && (
                    <View className="right_item" onClick={toRightDetail}>
                        <View className="icon_img has_five_right">
                            <View className="num">{currentRightUnion.length}</View>
                            <View className="txt">{t("项")}</View>
                        </View>
                        <View className="name">{t("全部权益")}</View>
                    </View>
                )}
            </View>
        </View>
    );
}