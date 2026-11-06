import { useEffect, useRef } from "react";
import { Image, Text, View } from "@tarojs/components";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getPointList } from "@/api/user/point";
import useList from "@/hooks/useList";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { useUserStore } from "@/store/user";
import type { PointFilterState } from "@/types/user/point";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./detail.scss";

/**
 * 积分明细页（自旧 pages/user/point/detail.vue 逐行移植）
 * - 展示用户当前积分总数
 * - 展示积分增加/扣减的历史记录
 * - 支持分页加载
 */
export default function PointDetail() {
    usePageGuards();

    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    void langCode;

    const integralName = useConfigStore((s) => s.integralName);
    const userInfo = useUserStore((s) => s.userInfo);
    const getUserInfo = useUserStore((s) => s.getUserInfo);

    // 旧 reactive filterParams：与 useList 共享同一份对象
    const filterParams = useRef({
        page: 1,
        size: 10,
        status: 1
    }).current;

    const { getList, data: filterState, total, isLoading } = useList<PointFilterState>(getPointList as any, {
        params: filterParams,
        path: {
            dataKey: "records"
        }
    });

    // 旧 onLoad
    useEffect(() => {
        const load = async () => {
            await getUserInfo();
            await getList();
        };
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <TigLayout title={`${t(integralName)}${t("明细")}`}>
            <View className="top-card" style={{ backgroundImage: `url(${staticResource("user/background2.png")})` }}>
                <View className="balance-row"> {`${t("我的")}${integralName}`} </View>
                <View className="amount-row">{userInfo.points}</View>
            </View>
            {filterState.length > 0 && (
                <View className="log-main">
                    {filterState.map((item, index) => (
                        <View className="item" key={index}>
                            <View className="tit">{item.changeDesc}</View>
                            <View className="time">{item.changeTime}</View>
                            <View className="real_total">
                                {item.changeTypeName === "增加" ? <Text>+</Text> : <Text>-</Text>}
                                <Text>{item.points}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}
            {!isLoading && total === 0 && (
                <View className="empty-box">
                    <View className="pictrue">
                        <Image src={staticResource("common/data_empty.png")} />
                    </View>
                    <View className="txt">{t("暂无数据")}</View>
                </View>
            )}
        </TigLayout>
    );
}