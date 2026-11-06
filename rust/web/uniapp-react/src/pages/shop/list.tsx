import { View } from "@tarojs/components";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import ShopListEmpty from "@/components/shopListEmpty";
import ShopInfo from "@/pages/search/src/shopInfo";
import { getShopList } from "@/api/shop/shop";
import type { shopListItem } from "@/types/shop/shop";
import { isMerchant, isO2o } from "@/utils";
import { useGroupShopList } from "@/hooks";
import { usePageGuards } from "@/utils/pageMixin";
import { t } from "@/utils/i18n";

import "./list.scss";

/**
 * 店铺街列表（自旧 pages/shop/list.vue 35 行移植）
 * - 仅多商户非 O2O 站点可用，其余站点展示不支持提示
 * - 分组条件由 useGroupShopList 从路由参数解析，分页/下拉刷新同旧实现
 *
 * TODO(MIGRATION)：旧 `defineOptions({ inheritAttrs: false })` 用于避免同名 attr 覆盖布局标题，
 * React 无 attr 透传概念，标题由 title prop 显式传入，无需平移。
 */
export default function ShopList() {
    usePageGuards();

    const enabled = isMerchant() && !isO2o();
    const { title, records, loading, error, finished, load } = useGroupShopList<shopListItem>(getShopList, 1, enabled);

    return (
        <TigLayout title={title || t("店铺街")}>
            {enabled ? (
                <View className="list-content">
                    {records.map((item) => (
                        <ShopInfo key={item.shopId} info={item} />
                    ))}
                    {error ? (
                        <View className="status" onClick={() => void load(records.length === 0)}>
                            {t(error)} · {t("点击重试")}
                        </View>
                    ) : loading ? (
                        <View className="status">{t("加载中")}</View>
                    ) : records.length === 0 ? (
                        <ShopListEmpty text={t("没有找到相关的店铺")} />
                    ) : finished ? (
                        <View className="status">{t("没有更多了")}</View>
                    ) : null}
                </View>
            ) : (
                <View className="empty">{t("当前站点不支持此页面")}</View>
            )}
        </TigLayout>
    );
}
