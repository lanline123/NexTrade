import { useEffect, useRef, useState } from "react";
import { View } from "@tarojs/components";
import Taro, { useReachBottom } from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { salesmanContentList } from "@/api/salesman/salesman";
import type { SalesmanContentListFilterResult } from "@/types/salesman/salesman";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import Empty from "./src/Empty";

import "./notifyCenter.scss";

/**
 * 通知中心页（自旧 pages/salesman/notifyCenter.vue 逐行移植）
 * - 展示分销员相关通知列表
 * - 支持分页加载更多
 */
export default function SalesmanNotifyCenter() {
    usePageGuards();

    const [list, setList] = useState<SalesmanContentListFilterResult[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    // 旧 reactive filterParams：原地维护分页字段
    const filterParamsRef = useRef({ page: 1, size: 10 });
    const filterParams = filterParamsRef.current;
    // 镜像 total，供触底闭包读取（避免 React 陈旧闭包）
    const totalRef = useRef(0);

    const getSalesmanContentList = async () => {
        setLoading(true);
        try {
            const res = await salesmanContentList(filterParams);
            // 旧实现为整体替换（保留原分页语义）
            setList(res.records || []);
            setTotal(res.total || 0);
            totalRef.current = res.total || 0;
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleClick = (id: number) => {
        Taro.navigateTo({
            url: `/pages/salesman/notifyCenterDetail?id=${id}`
        });
    };

    // 旧 onLoad
    useEffect(() => {
        void getSalesmanContentList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onReachBottom
    useReachBottom(() => {
        if (filterParams.page < Math.ceil(totalRef.current / filterParams.size)) {
            filterParams.page++;
            void getSalesmanContentList();
        }
    });

    return (
        <TigLayout title={t("赚钱攻略")}>
            <View className="notifycenter-box">
                <View className="notifycenter-list">
                    {list.map((item) => (
                        <View className="notifycenter-item" key={item.id} onClick={() => handleClick(item.id)}>
                            <View className="notifycenter-item-left">
                                <View className="item-left-title">
                                    <View className="item-left-title-info line2">
                                        {item.isTop === 1 ? <View className="title-tip">{t("置顶")}</View> : null}
                                        {item.title}
                                    </View>
                                </View>
                                {item.describe ? <View className="item-left-desc line2">{item.describe}</View> : null}
                                <View className="item-left-time">{item.startTime}</View>
                            </View>
                            <View className="notifycenter-item-right">
                                <TigImage src={item.img} />
                            </View>
                        </View>
                    ))}
                </View>
            </View>
            {!loading && list.length === 0 ? <Empty styles={{ width: "320rpx", height: "320rpx" }} /> : null}
        </TigLayout>
    );
}