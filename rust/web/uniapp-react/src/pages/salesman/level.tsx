import { useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getSalesman, getUser } from "@/api/salesman/salesmanCenter";
import { useConfigStore } from "@/store/config";
import { useCurrencyStore } from "@/store/currency";
import { useI18nStore } from "@/store/i18n";
import type { SalesmanItem, UserItem } from "@/types/salesman/salesmanCenter";
import { isOverseas, staticResource } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./level.scss";

/**
 * 分销员等级页（自旧 pages/salesman/level.vue 逐行移植）
 * - 展示当前等级和升级进度
 * - 显示等级权益对比
 * - 提供升级条件说明
 */
const nextLevelInfo = (orderPrams: any, nextLevelPrams: any) => {
    const condition = nextLevelPrams?.condition || {};
    const salesAmount = condition.salesAmount?.value || 0;
    const salesInviteUsers = condition.salesInviteUsers?.value || 0;
    const selfBuyAmount = condition.selfBuyAmount?.value || 0;
    const order = orderPrams || {};
    const obj: any = {
        totalPerc: 0,
        salesAmountInfo: {
            salesAmountReach: false,
            salesAmountGap: ""
        },
        salesInviteUsersInfo: {
            salesInviteUsersReach: false,
            salesInviteUsersGap: ""
        },
        selfBuyAmountInfo: {
            selfBuyAmountReach: false,
            selfBuyAmountGap: ""
        }
    };
    let perc = 0;
    const salesAmountGap = (order.allSum || 0) - salesAmount;
    const salesInviteUsersGap = (order.allUserCount || 0) - salesInviteUsers;
    const selfBuyAmountGap = (order.selfBuySum || 0) - selfBuyAmount;
    if (salesAmountGap >= 0) {
        obj.salesAmountInfo.salesAmountReach = true;
        perc += 1;
    }
    if (salesInviteUsersGap >= 0) {
        obj.salesInviteUsersInfo.salesInviteUsersReach = true;
        perc += 1;
    }
    if (selfBuyAmountGap >= 0) {
        obj.selfBuyAmountInfo.selfBuyAmountReach = true;
        perc += 1;
    }
    obj.totalPerc = ((perc / 3) * 100).toFixed(2);
    obj.salesAmountInfo.salesAmountGap = Math.abs(salesAmountGap);
    obj.salesInviteUsersInfo.salesInviteUsersGap = Math.abs(salesInviteUsersGap);
    obj.selfBuyAmountInfo.selfBuyAmountGap = Math.abs(selfBuyAmountGap);
    return obj;
};

export default function SalesmanLevel() {
    usePageGuards();

    const langCode = useI18nStore((s) => s.langCode);
    const dollarSignCn = useConfigStore((s) => s.dollarSignCn);
    const currentCurrencyData = useCurrencyStore((s) => s.currentCurrencyData);

    const baseCurrencyName = t(dollarSignCn);
    const currencyName = isOverseas() ? currentCurrencyData.name : dollarSignCn;
    const displayCurrencyName = isOverseas() ? baseCurrencyName : currencyName;
    const amountRuleUnit = (unit: string) => (isOverseas() ? baseCurrencyName || unit : unit || currencyName);

    const [member, setMember] = useState<UserItem>({} as UserItem);
    const [levelRules, setLevelRules] = useState<any[]>([]);
    const [salesmanData, setSalesmanData] = useState<SalesmanItem>({} as SalesmanItem);
    const [nextLevelData, setNextLevelData] = useState<any>(null); // 下个等级的数据
    const [nextLevelGapData, setNextLevelGapData] = useState<any>(null); // 下个等级相差数据

    const _getUser = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result = await getUser();
            setMember(result);
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
        }
    };

    const _getSalesman = async () => {
        try {
            const result = await getSalesman();
            setSalesmanData(result);
            const levels = result?.salesmanConfig?.level || [];
            setLevelRules(levels);
            const next = levels[result?.level] || null;
            setNextLevelData(next);
            setNextLevelGapData(next ? nextLevelInfo(result?.order, next) : null);
        } catch (error) {
            console.error(error);
        }
    };

    // 旧 onLoad
    useEffect(() => {
        void _getUser();
        void _getSalesman();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tuiGuangRate = (curLevel: number) => {
        return levelRules[curLevel - 1]?.rate;
    };

    const containerBg = useMemo(() => {
        return `url(${staticResource("salesman/viprankbg.png")})`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [langCode]);

    const tuiguangBg = useMemo(() => {
        return `url(${staticResource("salesman/tuiguang.png")})`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [langCode]);

    return (
        <TigLayout title={t("分销员等级")}>
            <View className="level">
                <View className="level-dashboard">
                    <View className="container" style={{ backgroundImage: containerBg, backgroundSize: "100% 100%" }}>
                        <View className="header">
                            {member.avatar ? (
                                <TigImage className="avatar" src={member.avatar} />
                            ) : (
                                <Image src={staticResource("salesman/avatar.png")} className="avatar" />
                            )}
                            <View className="level-name">{salesmanData.levelName}</View>
                        </View>
                        <View className="level-stepper">
                            <View className="level-stepper-wrap less">
                                {nextLevelData?.name ? (
                                    <>
                                        <View className="level-stepper-wrap__point active reach">
                                            <View className="inner-text">{salesmanData.levelName}</View>
                                        </View>
                                        <View className="level-stepper-wrap__line">
                                            <View
                                                className="line-inner progress"
                                                style={{ width: `${nextLevelGapData.totalPerc}%` }}
                                            />
                                        </View>
                                        <View className="level-stepper-wrap__point">
                                            <View className="inner-text">{nextLevelData.name}</View>
                                        </View>
                                    </>
                                ) : null}
                            </View>
                        </View>
                    </View>
                    {tuiGuangRate(salesmanData.level) > 0 ? (
                        <View className="rights-and-interests">
                            <View className="item">
                                <View className="title-icon tui" style={{ backgroundImage: tuiguangBg }} />
                                <View>
                                    <View>{tuiGuangRate(salesmanData.level)}%</View>
                                    <View>{t("推广佣金比")}</View>
                                </View>
                            </View>
                        </View>
                    ) : null}
                    <View className="level-dashboard__rate-text">
                        <Text className="info-icon">i</Text>
                        {t("部分商品的佣金比例可能因商家设置而有所不同，请以商品中所显示的为准")}
                    </View>
                </View>
                {nextLevelData ? (
                    <View className="level-schedule">
                        <View className="title">
                            {t("满足以下规则可升级为")}
                            {nextLevelData.name}
                        </View>
                        <View className="level-schedule__status">
                            {nextLevelData.condition?.salesAmount?.checked ? (
                                <View className="level-schedule-item">
                                    <View className="tag-wrap">
                                        <View
                                            className={`level-schedule-item__tag van-tag van-tag--plain van-tag--default${
                                                nextLevelGapData.salesAmountInfo.salesAmountReach ? " level-schedule-item__reach" : ""
                                            }`}
                                        >
                                            {t(nextLevelGapData.salesAmountInfo.salesAmountReach ? "已达标" : "未达标")}
                                        </View>
                                    </View>
                                    <View className="tag-desc">
                                        {t("推广金额达")} {nextLevelData.condition?.salesAmount.value + displayCurrencyName}
                                        {nextLevelGapData.salesAmountInfo.salesAmountReach === false ? (
                                            <>
                                                (还差<Text className="level-schedule-item__left">{nextLevelGapData.salesAmountInfo.salesAmountGap}</Text>
                                                {` ${displayCurrencyName})`}
                                            </>
                                        ) : null}
                                    </View>
                                </View>
                            ) : null}
                            {nextLevelData.condition?.salesInviteUsers?.checked ? (
                                <View className="level-schedule-item">
                                    <View className="tag-wrap">
                                        <View
                                            className={`level-schedule-item__tag van-tag van-tag--plain van-tag--default${
                                                nextLevelGapData.salesInviteUsersInfo.salesInviteUsersReach
                                                    ? " level-schedule-item__reach"
                                                    : ""
                                            }`}
                                        >
                                            {nextLevelGapData.salesInviteUsersInfo.salesInviteUsersReach ? t("已达标") : t("未达标")}
                                        </View>
                                    </View>
                                    <View className="tag-desc">
                                        {t("累计客户数达")} {nextLevelData.condition?.salesInviteUsers.value} {t("人")}
                                        {nextLevelGapData.salesInviteUsersInfo.salesInviteUsersReach === false ? (
                                            <>
                                                (还差
                                                <Text className="level-schedule-item__left">
                                                    {nextLevelGapData.salesInviteUsersInfo.salesInviteUsersGap}
                                                </Text>{" "}
                                                人)
                                            </>
                                        ) : null}
                                    </View>
                                </View>
                            ) : null}
                            {nextLevelData.condition?.selfBuyAmount?.checked ? (
                                <View className="level-schedule-item">
                                    <View className="tag-wrap">
                                        <View
                                            className={`level-schedule-item__tag van-tag van-tag--plain van-tag--default${
                                                nextLevelGapData.selfBuyAmountInfo.selfBuyAmountReach ? " level-schedule-item__reach" : ""
                                            }`}
                                        >
                                            {nextLevelGapData.selfBuyAmountInfo.selfBuyAmountReach ? t("已达标") : t("未达标")}
                                        </View>
                                    </View>
                                    <View className="tag-desc">
                                        {t("自购金额达")} {nextLevelData.condition?.selfBuyAmount.value + displayCurrencyName}
                                        {nextLevelGapData.selfBuyAmountInfo.selfBuyAmountReach === false ? (
                                            <>
                                                ({t("还差")}
                                                <Text className="level-schedule-item__left">
                                                    {nextLevelGapData.selfBuyAmountInfo.selfBuyAmountGap}
                                                </Text>
                                                {` ${displayCurrencyName})`}
                                            </>
                                        ) : null}
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    </View>
                ) : null}
                {levelRules.length ? (
                    <View className="level-rules">
                        {levelRules.map((rule) => (
                            <View key={rule.id} className="rules-item">
                                <View
                                    className="label"
                                    style={{ backgroundImage: containerBg, backgroundSize: "48rpx 48rpx" }}
                                >
                                    {rule.name}
                                </View>
                                <View className="desc">
                                    <View className="desc-item">
                                        <View className="desc-item__title">{t("规则介绍")}</View>
                                        {rule.condition?.salesAmount?.checked ? (
                                            <View>
                                                {rule.condition.salesAmount.title + t("满") || t("推广金额满")}{" "}
                                                {rule.condition.salesAmount.value} {amountRuleUnit(rule.condition.salesAmount.unit)}
                                            </View>
                                        ) : null}
                                        {rule.condition?.salesInviteUsers?.checked ? (
                                            <View>
                                                {rule.condition.salesInviteUsers.title + t("满") || t("发展客户数满")}{" "}
                                                {rule.condition.salesInviteUsers.value}{" "}
                                                {rule.condition.salesInviteUsers.unit || t("人")}
                                            </View>
                                        ) : null}
                                        {rule.condition?.selfBuyAmount?.checked ? (
                                            <View>
                                                {rule.condition.selfBuyAmount.title + t("满") || t("自购金额满")}{" "}
                                                {rule.condition.selfBuyAmount.value} {amountRuleUnit(rule.condition.selfBuyAmount.unit)}
                                            </View>
                                        ) : null}
                                    </View>
                                    <View className="desc-item">
                                        <View className="desc-item__title">{t("权益介绍")}</View>
                                        <View>
                                            {t("推广佣金比为")}
                                            {rule.rate}%
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>
        </TigLayout>
    );
}