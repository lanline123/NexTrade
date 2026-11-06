import { useMemo, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getSalesman, getUser } from "@/api/salesman/salesmanCenter";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import type { SalesmanItem, UserItem } from "@/types/salesman/salesmanCenter";
import { isOverseas, redirect, staticResource } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import { OPERATION_CARD_ICON, OPERATION_NOTIFY_ICON } from "./src/operationIcons";
import { isViewCustomerInfoEnabled } from "./src/salesmanPrivacy";

import "./index.scss";

/**
 * 分销员中心首页（自旧 pages/salesman/index.vue 逐行移植）
 * - 展示分销员等级、佣金统计、推广数据
 * - 提供推广商品、客户管理、提现等功能入口
 * - 显示分销员专属二维码
 */
export default function SalesmanIndex() {
    usePageGuards();

    const langCode = useI18nStore((s) => s.langCode);
    const dollarSignCn = useConfigStore((s) => s.dollarSignCn);

    const [showDataDetail, setShowDataDetail] = useState(false);
    const [showTip, setShowTip] = useState(false);
    const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [member, setMember] = useState<UserItem>({} as UserItem);
    const [salesmanData, setSalesmanData] = useState<SalesmanItem>({} as SalesmanItem);

    const incomeUnit = useMemo(() => {
        return isOverseas() ? t(dollarSignCn) : t("元");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [langCode, dollarSignCn]);

    const showClick = () => {
        setShowDataDetail((value) => !value);
    };

    const showTipClick = () => {
        setShowTip((value) => !value);
        if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
        if (!showTip) {
            tipTimerRef.current = setTimeout(() => {
                setShowTip(false);
            }, 2000);
        }
    };

    // 拉取最新用户信息（含分销佣金可用余额 commissionBalance，D1107），避免使用过期缓存
    const _getUser = async () => {
        try {
            const result = await getUser();
            setMember(result);
        } catch (error: any) {
            setMember(Taro.getStorageSync("userInfo") || ({} as UserItem));
        }
    };

    const _getSalesman = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result = await getSalesman();
            setSalesmanData(result);
        } catch (error: any) {
            Taro.showToast({
                title: t(error.message),
                icon: "none"
            });
            setTimeout(function () {
                redirect({
                    url: "/pages/member/index"
                });
            }, 1500);
        } finally {
            Taro.hideLoading();
        }
    };

    const levelIcon = (num: number) => {
        let levelIconUrl = "";
        switch (num) {
            case 1:
                levelIconUrl = staticResource("salesman/icon-level1.png");
                break;
            case 2:
                levelIconUrl = staticResource("salesman/icon-level2.png");
                break;
            case 3:
                levelIconUrl = staticResource("salesman/icon-level3.png");
                break;
            case 4:
                levelIconUrl = staticResource("salesman/icon-level4.png");
                break;
            case 5:
                levelIconUrl = staticResource("salesman/icon-level5.png");
                break;
            case 6:
                levelIconUrl = staticResource("salesman/icon-level6.png");
                break;
        }
        return levelIconUrl;
    };

    const levelTxt = useMemo(() => {
        let str = "";
        if (salesmanData.condition) {
            for (const key in salesmanData.condition) {
                const conditionItem: any = (salesmanData.condition as any)[key];
                if (conditionItem?.checked) {
                    const { value = 0, title = "", unit = t("元") } = conditionItem;
                    const isAmount = key === "salesAmount" || key === "selfBuyAmount";
                    const showUnit = isAmount && isOverseas() ? t(dollarSignCn) || unit : unit;
                    str += `${title}${t("已达")}${value}${showUnit}、`;
                }
            }
        }
        return str;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [salesmanData.condition, langCode, dollarSignCn]);

    const goPages = (url: string) => {
        Taro.navigateTo({
            url
        });
    };

    const goCustomerList = (url: string) => {
        if (!isViewCustomerInfoEnabled(salesmanData.salesmanConfig?.viewCustomerInfo)) {
            return;
        }
        goPages(url);
    };

    const panelBlockBg = useMemo(() => `url(${staticResource("salesman/bg-header.png!middle.webp")})`, [langCode]);
    const levelPanelBg = useMemo(() => `url(${staticResource("salesman/levelbg.png")})`, [langCode]);

    // 旧 onShow
    useDidShow(() => {
        void _getUser();
        void _getSalesman();
    });

    return (
        <>
            <TigLayout title={t("分销员中心")}>
                <View
                    className="user-panel-block"
                    style={{
                        background: `${panelBlockBg} 0rpx 0rpx / 100% 100% no-repeat`,
                        paddingTop: "24rpx"
                    }}
                >
                    <View className="user-info" onClick={() => goPages("/pages/salesman/personalInfo")}>
                        <View className="user-info__avatar salesman-avatar">
                            {member.avatar ? (
                                <TigImage
                                    className="salesman-avatar__img salesman-avatar--round salesman-avatar__img--default"
                                    src={member.avatar}
                                />
                            ) : (
                                <Image src={staticResource("salesman/avatar.png")} className="salesman-avatar__img salesman-avatar--round salesman-avatar__img--default" />
                            )}
                            <Image
                                src={staticResource("salesman/viprank.png")}
                                className="avatar-level-tag__img"
                                aria-label={t("等级1")}
                            />
                        </View>
                        <View className="user-info__content">
                            <View className="user-info__title">{t(member.nickname)}</View>
                            <View className="user-info__desc">
                                {t("手机号：")}
                                {member.mobile}
                            </View>
                        </View>
                        <View className="arrow-right" />
                    </View>
                    {salesmanData.level && (salesmanData.salesmanConfig?.level?.length || 0) > 1 ? (
                        <View
                            className="level-panel"
                            style={{ background: `${levelPanelBg} 0rpx 0rpx / 100% 100% no-repeat` }}
                            onClick={() => goPages("/pages/salesman/level")}
                        >
                            <View className="upgrade-group">
                                <View className="van-image">
                                    <Image src={staticResource("salesman/uplevel.png")} className="van-image__img" />
                                </View>
                            </View>
                            <View className="van-ellipsis">
                                <View className="level-panel__header">
                                    <View className="level-name">{t(salesmanData.levelName)}</View>
                                    <View className="level-icon van-image" style={{ width: "20px", height: "11px" }}>
                                        <Image src={levelIcon(salesmanData.level)} className="van-image__img" />
                                    </View>
                                    <View className="van-image" style={{ width: "8px", height: "8px" }}>
                                        <Image src={staticResource("salesman/toright.png")} className="van-image__img" />
                                    </View>
                                </View>
                                <View className="level-panel__desc van-ellipsis">{t(levelTxt)}</View>
                            </View>
                        </View>
                    ) : null}
                </View>
                <View className="data-panel-block">
                    <View className="main-data-panel van-grid">
                        <Image src={staticResource("salesman/shouyi.png")} className="moeny-icon" />
                        <View className="main-data-panel-item van-grid-item">
                            <View className="van-grid-item__content">
                                <View className="main-data-panel-item__desc">{t("今日收益")}</View>
                                <View className="main-data-panel-item__content">
                                    <FormatPrice base showText={false} currencyFormat={false} priceData={salesmanData.order?.todaySum} />
                                    {incomeUnit}
                                </View>
                            </View>
                        </View>
                        <View className="main-data-panel-item van-grid-item">
                            <View className="van-grid-item__content">
                                <View className="main-data-panel-item__desc">{t("总收益")}</View>
                                <View className="main-data-panel-item__content">
                                    <FormatPrice base showText={false} currencyFormat={false} priceData={salesmanData.order?.allSum} />
                                    {incomeUnit}
                                </View>
                                <View className="main-data-panel-item__desc main-data-panel-item__extra">
                                    <View className="main-data-panel-item__text">{t("含待结算")}</View>
                                    <FormatPrice base showText={false} currencyFormat={false} priceData={salesmanData.order?.waitCpsSum} />
                                    <View>{incomeUnit}</View>
                                    {/* 旧模板注释：箭头图标（已注释） */}
                                </View>
                            </View>
                        </View>
                    </View>
                    {showDataDetail ? (
                        <>
                            {salesmanData.order ? (
                                <View className="detail-data-panel van-grid">
                                    <View className="van-grid-item" onClick={() => goPages("/pages/salesman/orderPromote")}>
                                        <View className="van-grid-item__content">
                                            <View className="detail-data-panel-item">
                                                <View className="detail-data-panel-item__content">
                                                    <View className="detail-data-panel-item__title">{t("今日推广订单")}</View>
                                                    <View className="detail-data-panel-item__text">{salesmanData.order?.todayCount}</View>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                    <View className="van-grid-item" onClick={() => goPages("/pages/salesman/orderPromote")}>
                                        <View className="van-grid-item__content">
                                            <View className="detail-data-panel-item">
                                                <View className="detail-data-panel-item__content">
                                                    <View className="detail-data-panel-item__title">{t("累计推广订单")}</View>
                                                    <View className="detail-data-panel-item__text">{salesmanData.order?.allCount}</View>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                    <View
                                        className="van-grid-item"
                                        onClick={() => goCustomerList("/pages/salesman/relationList?customerType=today")}
                                    >
                                        <View className="van-grid-item__content">
                                            <View className="detail-data-panel-item">
                                                <View className="detail-data-panel-item__content">
                                                    <View className="detail-data-panel-item__title">{t("今日新增客户")}</View>
                                                    <View className="detail-data-panel-item__text">{salesmanData.order?.todayUserCount}</View>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                    <View
                                        className="van-grid-item"
                                        onClick={() => goCustomerList("/pages/salesman/relationList?customerType=all")}
                                    >
                                        <View className="van-grid-item__content">
                                            <View className="detail-data-panel-item">
                                                <View className="detail-data-panel-item__content">
                                                    <View className="detail-data-panel-item__title">{t("累计客户")}</View>
                                                    <View className="detail-data-panel-item__text">{salesmanData.order?.allUserCount}</View>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            ) : null}
                        </>
                    ) : null}
                    <View className="cash-block" onClick={() => goPages("/pages/salesman/wallet")}>
                        <View className="van-cell van-cell--clickable">
                            <View className="van-cell__title">
                                <Text>
                                    {t("可提现金额")}({incomeUnit})
                                </Text>
                            </View>
                            <View className="van-cell__value cash-block--withdraw">
                                <Text>{member.commissionBalance || 0}</Text>
                            </View>
                            <View className="arrow-right" />
                        </View>
                        <View
                            className="asset-icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                showTipClick();
                            }}
                        >
                            <Text className="question-icon">?</Text>
                        </View>
                    </View>
                    <View className="accordion__action-bar" onClick={showClick}>
                        {showDataDetail === false ? <View>{t("展开更多")}</View> : null}
                        {showDataDetail === false ? <View className="arrow-down" /> : <View className="arrow-up" />}
                    </View>
                </View>
                <View className="promotion-block">
                    <View className="van-cell van-cell--borderless">
                        <View className="van-cell__title promotion-block__title">
                            <Text>{t("推广卖货")}</Text>
                        </View>
                    </View>
                    <View className="promotion-content van-grid">
                        <View className="promotion-item van-grid-item">
                            <View
                                className="van-grid-item__content van-grid-item__content--horizontal van-hairline"
                                onClick={() => goPages("/pages/salesman/list")}
                            >
                                <View>
                                    <View className="promotion-item__title">{t("推广商品")}</View>
                                    <View className="promotion-item__desc">{t("佣金赚不够")}</View>
                                </View>
                                <View className="van-image">
                                    <Image src={staticResource("salesman/goods.png!small.webp")} className="van-image__img" />
                                </View>
                            </View>
                        </View>
                        <View className="promotion-item van-grid-item" onClick={() => goPages("/pages/salesman/portalPoster")}>
                            <View className="van-grid-item__content van-grid-item__content--horizontal van-hairline">
                                <View>
                                    <View className="promotion-item__title">{t("推广海报")}</View>
                                    <View className="promotion-item__desc">{t("发圈快速获客")}</View>
                                </View>
                                <View className="van-image">
                                    <Image src={staticResource("salesman/poster.png!small.webp")} className="van-image__img" />
                                </View>
                            </View>
                        </View>
                        {/* 旧模板注释：邀请好友入口
                        <View className="promotion-item van-grid-item">...</View>
                        */}
                        <View className="promotion-item van-grid-item" onClick={() => goPages("/pages/salesman/material")}>
                            <View className="van-grid-item__content van-grid-item__content--horizontal van-hairline">
                                <View>
                                    <View className="promotion-item__title">{t("素材中心")}</View>
                                    <View className="promotion-item__desc">{t("一键转发分享素材")}</View>
                                </View>
                                <View className="van-image">
                                    <Image src={staticResource("salesman/material.png!small.webp")} className="van-image__img" />
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
                <View className="operation-block">
                    <View className="van-cell van-cell--borderless">
                        <View className="van-cell__title operation-block__title">
                            <Text>{t("激励工具")}</Text>
                        </View>
                    </View>
                    <View className="van-grid">
                        {/* 旧模板注释：销售商机入口（已注释） */}
                        <View className="van-grid-item" style={{ flexBasis: "25%" }} onClick={() => goPages("/pages/salesman/notifyCenter")}>
                            <View className="van-grid-item__content van-grid-item__content--center">
                                <Image style={{ height: "100%", width: "100%" }} src={OPERATION_NOTIFY_ICON} />
                                <View className="operation-item-text">{t("赚钱攻略")}</View>
                            </View>
                        </View>
                        <View className="van-grid-item" style={{ flexBasis: "25%" }} onClick={() => goPages("/pages/salesman/businessCard")}>
                            <View className="van-grid-item__content van-grid-item__content--center">
                                <Image style={{ height: "30px", width: "100%" }} src={OPERATION_CARD_ICON} />
                                <View className="operation-item-text">{t("个人名片")}</View>
                            </View>
                        </View>
                    </View>
                </View>
            </TigLayout>
            {showTip ? (
                <View className="tip-bubble">
                    {t("推广订单佣金将在系统结算后发放到账，即可提现, 该金额为可在当前店铺提现的金额总额。")}
                </View>
            ) : null}
        </>
    );
}