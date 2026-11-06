import { useMemo, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import Empty from "./src/Empty";
import SearchInput from "./src/SearchInput";
import Share from "./src/Share";
import FormatPrice from "@/components/format-price/FormatPrice";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { salesmanProductList } from "@/api/salesman/salesman";
import { useSaveTopBoxHeight } from "@/hooks";
import useList from "@/hooks/useList";
import { useProductStyle } from "@/hooks/useProductStyle";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { useUserStore } from "@/store/user";
import type { SalesmanProductListFilterResult } from "@/types/salesman/salesman";
import { staticResource } from "@/utils";
import { pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import { navigateBack } from "@/utils/navigation";
import { usePageGuards } from "@/utils/pageMixin";

import "./list.scss";

/**
 * 推广商品列表页（自旧 pages/salesman/list.vue 逐行移植）
 * - 展示可推广的商品列表
 * - 支持搜索和分页加载
 * - 提供商品分享功能
 */
export default function SalesmanList() {
    usePageGuards();

    const langCode = useI18nStore((s) => s.langCode);
    const isIdentity = useConfigStore((s) => s.isIdentity);
    const userInfo = useUserStore((s) => s.userInfo);

    const { height, contentHeight, contentWidth, statusBarHeight } = useSaveTopBoxHeight(60);

    // 旧 reactive filterParams（useList 直接持有并原地改写 page/pageSize）
    const filterParamsRef = useRef({
        productName: "",
        sortField: "addTime",
        sortOrder: "desc",
        page: 1,
        pageSize: 15
    });
    const filterParams = filterParamsRef.current;

    const [keyword, setKeyword] = useState("");
    const [tabIndex, setTabIndex] = useState("addTime");
    const [priceSortOrder, setPriceSortOrder] = useState("desc");

    const {
        data: list,
        total,
        isLoading,
        getList,
        resetState
    } = useList<SalesmanProductListFilterResult>(salesmanProductList, {
        params: filterParams,
        path: {
            dataKey: "records",
            sizeKey: "pageSize"
        },
        immediate: true
    });

    const { styleMap } = useProductStyle(list);

    const tabList = useMemo(
        () => [
            {
                label: t("最新"),
                value: "addTime"
            },
            {
                label: t("销量"),
                value: "virtualSales"
            },
            {
                label: t("价格"),
                value: "productPrice",
                sortOrder: priceSortOrder
            }
        ],
        [langCode, priceSortOrder]
    );

    const resetList = () => {
        filterParams.page = 1;
        filterParams.sortOrder = "desc";
        resetState();
    };

    const onChangeTab = (item: any) => {
        // 非价格排序重复点击时无需刷新；先判断可避免 resetList 清空当前商品列表
        if (item.value !== "productPrice" && item.value === filterParams.sortField) {
            return;
        }
        resetList();
        if (item.value === "productPrice") {
            const nextOrder = priceSortOrder === "desc" ? "asc" : "desc";
            setPriceSortOrder(nextOrder);
            filterParams.sortOrder = nextOrder;
        }
        setTabIndex(item.value);
        filterParams.sortField = item.value;
        void getList();
    };

    const handleSearchClear = () => {
        filterParams.productName = "";
        setKeyword("");
        resetList();
        void getList();
    };

    const handleSearch = () => {
        resetList();
        void getList();
    };

    const handleKeywordChange = (value: string) => {
        setKeyword(value);
        filterParams.productName = value;
    };

    const [currentData, setCurrentData] = useState<SalesmanProductListFilterResult>({} as SalesmanProductListFilterResult);
    const [showShare, setShowShare] = useState(false);

    const handleShowShare = (data: SalesmanProductListFilterResult) => {
        if (isIdentity === 1) {
            let str = t("登录后查看");
            if (Object.keys(userInfo).length === 0) {
                Taro.showToast({
                    title: t(str),
                    icon: "none"
                });
                return;
            }
            if (!userInfo.isCompanyAuth) {
                str = t("实名后查看");
                Taro.showToast({
                    title: t(str),
                    icon: "none"
                });
                return;
            }
        }

        setShowShare(true);
        setCurrentData(data);
    };

    const handleLink = (url: string) => {
        Taro.navigateTo({
            url
        });
    };

    return (
        <TigLayout>
            <View className="sticky">
                <View className="salesman-menu">
                    <View className="search-box" style={{ height: `${height}px` }}>
                        <View className="status-bar" style={{ height: `${statusBarHeight}px` }} />
                        <View className="search-input-box search-input-box--with-back" style={{ height: `${contentHeight}px`, width: contentWidth }}>
                            <View className="search-back" onClick={(e) => {
                                e.stopPropagation();
                                navigateBack();
                            }}>
                                <View className="iconfont icon-houtui" />
                            </View>
                            <View className="input">
                                <SearchInput
                                    value={keyword}
                                    onChange={handleKeywordChange}
                                    onConfirm={handleSearch}
                                    onClear={handleSearchClear}
                                    customStyle={{ width: "100%", backgroundColor: "#f7f8fa", borderRadius: "36rpx", padding: "10rpx 15rpx" }}
                                />
                            </View>
                        </View>
                    </View>
                    <View className="salesman-content">
                        {tabList.map((item, index) => (
                            <View
                                key={index}
                                className={`salesman-item${tabIndex === item.value ? " active" : ""}`}
                                onClick={() => onChangeTab(item)}
                            >
                                <Text>{item.label}</Text>
                                {item.value === "productPrice" ? (
                                    <View className="price-ico-box flex flex-column">
                                        <Text
                                            className={`price-icon up${
                                                tabIndex === "productPrice" && priceSortOrder === "asc" ? " order" : ""
                                            }`}
                                        />
                                        <Text
                                            className={`price-icon down${
                                                tabIndex === "productPrice" && priceSortOrder === "desc" ? " order" : ""
                                            }`}
                                        />
                                    </View>
                                ) : null}
                            </View>
                        ))}
                    </View>
                </View>
            </View>
            <View className="salesman-list">
                {list.map((item) => (
                    <View key={item.productId} className="salesman-list-item">
                        <View className="salesman-item-content" onClick={() => handleLink(`/pages/salesman/detail?id=${item.productId}`)}>
                            <View className="salesman-item-img">
                                <TigImage src={pickPic(item)} />
                                {styleMap[item.productId]?.borderImage ? (
                                    <Image
                                        className="product-style-border"
                                        src={styleMap[item.productId].borderImage}
                                        mode="scaleToFill"
                                    />
                                ) : null}
                            </View>
                            <View className="salesman-item-text">
                                <View className="line2 name">{item.productName}</View>
                                <View className="price">
                                    <FormatPrice currencyStyle={{ fontSize: "21rpx" }} priceData={item.productPrice} />
                                </View>
                            </View>
                        </View>
                        <View className="salesman-item-btn">
                            <View className="salesman-item-btn-content" onClick={() => handleShowShare(item)}>
                                <Image className="salesman-item-btn-icon" src={staticResource("salesman/shareIcon.png")} />
                                <View className="salesman-item-btn-text">
                                    {t(Number(item.finalCommissionPrice) > 0 ? "预计可赚" : "立即分享")}
                                    {Number(item.finalCommissionPrice) > 0 ? <FormatPrice base priceData={item.finalCommissionPrice} /> : null}
                                </View>
                            </View>
                        </View>
                    </View>
                ))}
            </View>
            {!isLoading && total === 0 ? <Empty styles={{ width: "320rpx", height: "320rpx" }} /> : null}
            <Share showShareCard={showShare} currentData={currentData} onChange={setShowShare} />
        </TigLayout>
    );
}