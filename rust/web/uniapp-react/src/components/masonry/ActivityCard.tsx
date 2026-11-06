import { useMemo } from "react";
import { View, Text } from "@tarojs/components";

import { adjustBrightness } from "@/utils/themeColor";
import { t } from "@/utils/i18n";

import "./ActivityCard.scss";

interface Props {
    activityInfo?: any;
    cardType?: string;
    fontSize?: string;
    /** 主题色（装修下发；空则回落站点 --tag-*） */
    themeColor?: string;
}

const isCssVar = (color: string): boolean => /^var\(/.test(color);

//1秒杀2优惠券3满减4折扣5满赠6限时折扣
const activityTypeText: Record<number, string> = {
    1: t("秒杀价"),
    3: t("满减"),
    4: t("折扣"),
    5: t("满赠"),
    6: t("限时折扣")
};
const getActivityText = (type: number) => {
    return activityTypeText[type];
};

/** 商品促销活动角标（自旧 masonry/activityCard.vue 移植） */
export default function ActivityCard({ activityInfo = {}, cardType = "list", fontSize = "23rpx", themeColor = "" }: Props) {
    const cssVars = useMemo(() => {
        if (!themeColor) return {} as Record<string, string>;
        if (isCssVar(themeColor)) {
            return {
                "--activity-theme-color": themeColor,
                "--activity-theme-color-80": "var(--ump-border)",
                "--activity-theme-bg": "var(--tag-bg)"
            } as Record<string, string>;
        }
        return {
            "--activity-theme-color": themeColor,
            "--activity-theme-color-80": adjustBrightness(themeColor, 0.8),
            "--activity-theme-bg": adjustBrightness(themeColor, 0.9)
        } as Record<string, string>;
    }, [themeColor]);

    return (
        <View
            className={`promotion ${cardType !== "list" ? "subbg" : ""} ${activityInfo.canJoin === false ? "promotion-disabled" : ""}`}
            style={{ fontSize, ...cssVars } as any}
        >
            {activityInfo.type && activityInfo.type != 2 && getActivityText(activityInfo.type) && (
                <View className="activity">{t(getActivityText(activityInfo.type))}</View>
            )}
            {activityInfo.type && activityInfo.type == 2 && (
                <View className="ticket">
                    <View className="ticket-type">
                        {t("券")}
                        <Text className="ticket-line" />
                    </View>
                    <View className="ticket-content">{activityInfo.data.promotionDesc}</View>
                </View>
            )}
        </View>
    );
}
