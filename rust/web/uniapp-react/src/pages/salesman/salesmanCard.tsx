import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { acceptCardInvite, salesmanProductList, salesmanUserinfo } from "@/api/salesman/salesman";
import type { SalesmanProductListFilterResult } from "@/types/salesman/salesman";
import useList from "@/hooks/useList";
import { useUserStore } from "@/store/user";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import Empty from "./src/Empty";

import "./salesmanCard.scss";

/**
 * 分销员名片页（自旧 pages/salesman/salesmanCard.vue 逐行移植）
 * - 展示分销员名片和推广商品
 * - 供客户查看分销员信息
 * - 支持商品浏览和购买
 */
export default function SalesmanCard() {
    usePageGuards();

    const router = useRouter();
    const token = useUserStore((s) => s.token);

    const [userInfo, setUserInfo] = useState<any>({});
    const [salesmanId, setSalesmanId] = useState<number | null>(null);

    // 旧 filterParams { page, pageSize: 15 } + 触底追加
    const { data: list, total, isLoading, getList } = useList<any>(salesmanProductList as any, {
        params: { page: 1, pageSize: 15 },
        path: { dataKey: "records", totalKey: "total", pageKey: "page", sizeKey: "pageSize" },
        needReachBottom: true
    });

    const tabbarList = [
        { name: t("名片"), icon: "icon-mingpian", url: "" },
        { name: t("商城"), icon: "icon-shangcheng-", url: "/pages/index/index" },
        { name: t("我的"), icon: "icon-wode", url: "/pages/member/index" }
    ];

    const getSalesmanUserinfo = async (id: number) => {
        try {
            const result = await salesmanUserinfo(id);
            setUserInfo(result || {});
        } catch (error) {
            console.error(error);
        }
    };

    const handleLink = (id: number) => {
        const url = salesmanId ? `/pages/product/index?id=${id}&salesmanId=${salesmanId}` : `/pages/product/index?id=${id}`;
        Taro.navigateTo({
            url
        });
    };

    const handleTabbar = (url: string) => {
        if (!url) return;
        // 未登录时跳转登录页，并把当前名片页路径作为 url 参数传过去；登录成功后会自动跳回
        if (!token) {
            const backUrl = salesmanId ? `/pages/salesman/salesmanCard?salesmanId=${salesmanId}` : `/pages/salesman/salesmanCard`;
            Taro.navigateTo({
                url: `/pages/login/index?url=${encodeURIComponent(backUrl)}`
            });
            return;
        }
        redirect({
            url
        });
    };

    // 微商模式名片邀请：已登录时即时绑定为下级分销员；
    // 未开启微商模式/名片邀请、已是分销员等场景由后端处理，失败静默
    const tryAcceptCardInvite = async (id: number) => {
        if (!id || !token) return;
        try {
            await acceptCardInvite(id);
        } catch (error) {
            console.error(error);
        }
    };

    // 旧 onLoad((option) => ...)
    useEffect(() => {
        const optionId = router.params?.salesmanId;
        if (optionId) {
            const id = Number(optionId);
            setSalesmanId(id);
            // const bindSalesmanId = uni.getStorageSync("bindSalesmanId");
            // if (!bindSalesmanId) {
            Taro.setStorageSync("bindSalesmanId", id);
            // }
            void getSalesmanUserinfo(id);
            void tryAcceptCardInvite(id);
        }
        void getList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <View>
            <TigLayout title={t("分销员名片")} safeTopBgColor="#f5f5f5">
                <View className="salesmanCard-top">
                    <View className="salesmanCard-top-content">
                        <View className="salesmanCard-top-left">
                            <View className="salesmanCard-top-left-img">
                                <TigImage src={userInfo.avatar} />
                            </View>
                        </View>
                        <View className="salesmanCard-top-right">
                            <View className="salesmanCard-top-right-mobile">{userInfo.mobile}</View>
                            <View className="salesmanCard-top-right-name">{userInfo.nickname}</View>
                        </View>
                    </View>
                </View>

                <View className="salesmanCard-list">
                    <View className="salesmanCard-list-title">{t("推荐商品")}</View>
                    <View className="salesmanCard-list-content">
                        {list.map((item: SalesmanProductListFilterResult) => (
                            <View
                                className="salesmanCard-list-content-item"
                                key={item.productId}
                                onClick={() => handleLink(item.productId)}
                            >
                                <View className="salesmanCard-list-content-item-img">
                                    <TigImage src={item.picUrl} />
                                </View>
                                <View className="content-item-text">
                                    <View className="item-text-name line2">{item.productName}</View>
                                    <View className="item-text-price">
                                        <FormatPrice priceData={item.productPrice} />
                                        <Text className="iconfont-h5 icon-gouwuche3" />
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                    {!isLoading && total === 0 ? <Empty styles={{ width: "320rpx", height: "320rpx" }} /> : null}
                </View>

                <FixedPlaceholder backgroundColor="#fff">
                    <View className="bottom-btns">
                        {tabbarList.map((item, index) => (
                            <View
                                className={`bottom-btns-item${index === 0 ? " active" : ""}`}
                                key={index}
                                onClick={() => handleTabbar(item.url)}
                            >
                                <View className={`bottom-btns-item-icon iconfont-h5 ${item.icon}`} />
                                <View className="bottom-btns-item-text">{t(item.name)}</View>
                            </View>
                        ))}
                    </View>
                </FixedPlaceholder>
            </TigLayout>
        </View>
    );
}