import { useEffect, useState } from "react";
import { RichText, View } from "@tarojs/components";
import { useRouter } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { salesmanContentDetail } from "@/api/salesman/salesman";
import type { SalesmanContentListFilterResult } from "@/types/salesman/salesman";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./notifyCenterDetail.scss";

/**
 * 通知详情页（自旧 pages/salesman/notifyCenterDetail.vue 逐行移植）
 * - 展示分销员通知消息详情
 * - 富文本渲染消息内容（旧 up-parse → Taro RichText）
 */
export default function SalesmanNotifyCenterDetail() {
    usePageGuards();

    const router = useRouter();
    const [navbarTitle, setNavbarTitle] = useState(t("详情"));
    const [detailData, setDetailData] = useState<SalesmanContentListFilterResult>({} as SalesmanContentListFilterResult);

    const getSalesmanContentDetail = async (id: number) => {
        try {
            const result = await salesmanContentDetail(id);
            setDetailData(result);
            setNavbarTitle(result?.title);
        } catch (error) {
            console.log(error);
        }
    };

    // 旧 onLoad((option) => { if (option && option.id) ... })
    useEffect(() => {
        const id = router.params?.id;
        if (id) {
            void getSalesmanContentDetail(Number(id));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <TigLayout title={navbarTitle}>
            <View className="notify-box">
                {/* 旧 <up-parse :content="detailData.content" />；TODO(MIGRATION)：up-parse 与 rich-text 的 HTML 解析差异 */}
                <RichText nodes={detailData.content || ""} />
            </View>
        </TigLayout>
    );
}