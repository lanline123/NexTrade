import { useEffect, useState } from "react";
import { Image, ScrollView, View } from "@tarojs/components";
import { useRouter } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getUserLevelInfo } from "@/api/user/levelCenter";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import type { RightUnion } from "@/types/user/level";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./benefit.scss";

/**
 * 会员特权详情页（自旧 pages/user/levelCenter/benefit.vue 逐行移植）
 * - 根据等级 ID 展示该等级的特权列表
 * - 包含折扣、包邮、积分倍数等固定权益
 * - 以及自定义权益的名称和描述
 */
export default function Benefit() {
    usePageGuards();

    const router = useRouter();

    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    const integralName = useConfigStore((s) => s.integralName);

    const [current, setCurrent] = useState(0); // 当前会员等级
    const [currentRightUnion, setCurrentRightUnion] = useState<RightUnion[]>([]); // 当前会员等级的自定义权益和固定权益组合

    const __getUserLevelInfo = async (id: number) => {
        try {
            const result: any = await getUserLevelInfo({ rankId: id });
            const union: RightUnion[] = [];
            if (result.userRank.discount != "0.0") {
                union.push({ iconImg: "discount", isChecked: 1, name: result.userRank.discount + t("折"), describe: t("下单享受打折优惠") });
            }
            if (result.userRank.freeShipping === 1) {
                union.push({ iconImg: "freeShoping", isChecked: 1, name: t("包邮"), describe: t("下单时享受订单包邮") });
            }
            if (result.userRank.rankPoint != "0") {
                union.push({
                    iconImg: "point",
                    isChecked: 1,
                    name: result.userRank.rankPoint + `${t("倍")}${integralName}`,
                    describe: `${t("赠送多倍")}${integralName}` + result.userRank.rankPoint + t("倍")
                });
            }
            result.userRank.rights.forEach((item: RightUnion) => {
                if (item.isChecked == 1) {
                    union.push(item);
                }
            });
            setCurrentRightUnion(union);
        } catch (error) {
            console.error("获取用户等级信息失败", error);
        }
    };

    // 旧 onLoad(options => __getUserLevelInfo(options.rankId))
    useEffect(() => {
        const options = (router.params || {}) as any;
        if (options.rankId) {
            void __getUserLevelInfo(options.rankId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.params?.rankId]);

    const getActiveLineStyle = (index: number) => {
        if (current === index) {
            return {
                transform: `translateX(${index * 150 + 40}rpx)`,
                transition: "transform 0.3s ease"
            };
        }
        return {};
    };

    const cssVariable = {
        "--discountBg": `url(${staticResource("user/discount.png")})`,
        "--freeShopingBg": `url(${staticResource("user/free_shoping.png")})`,
        "--pointBg": `url(${staticResource("user/point.png")})`
    } as Record<string, string>;

    return (
        <TigLayout title={t("特权详情")}>
            <View className="level_container" style={cssVariable as any}>
                <View className="level_rights_list">
                    <ScrollView scrollX showScrollbar={false} className="rights-scroll">
                        {currentRightUnion.map((item, index) =>
                            item.isChecked === 1 ? (
                                <View
                                    className={`right_item${current === index ? " active" : ""}`}
                                    key={index}
                                    onClick={() => setCurrent(index)}
                                >
                                    {item.iconImg ? (
                                        <View className={`icon_img ${item.iconImg}`} />
                                    ) : item.icon ? (
                                        <View className="icon_wapper">
                                            <Image className="icon" src={item.icon} />
                                        </View>
                                    ) : null}
                                    <View className="name">{item.rightName || item.name}</View>
                                </View>
                            ) : null
                        )}
                    </ScrollView>
                    <View className="active_line" style={getActiveLineStyle(current) as any} />
                </View>
                {currentRightUnion.length > 0 && (
                    <View className="level_info">
                        <View className="info">
                            <View className="title">{currentRightUnion[current].name}</View>
                            <View className="tips">{currentRightUnion[current].describe}</View>
                        </View>
                    </View>
                )}
            </View>
        </TigLayout>
    );
}