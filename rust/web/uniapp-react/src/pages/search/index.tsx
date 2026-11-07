import { useEffect, useRef, useState } from "react";
import { View, Text, Input, Image } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import MainHeader from "@/components/mainHeader";
import ImageSearchEntry from "@/components/imageSearchEntry";
import { redirect, isOverseas } from "@/utils";
import { useSearchDecorateStore } from "@/store/searchDecorate";
// 通用工具：onLoad 无条件使用，必须放在皮肤裁剪块之外
import { decodeGroupQuery } from "@/utils/shopGroup";
import { t } from "@/utils/i18n";

import "./index.scss";

/**
 * 搜索页（自旧 pages/search/index.vue 移植）
 * - 搜索框输入关键词
 * - 搜索历史和热门搜索推荐
 * - 跳转搜索结果页
 */
export default function SearchIndex() {
    const router = useRouter();
    // 外贸风皮肤开关：跨境构建为 true；纯 o2o 构建下本块被裁切，模板引用落 undefined → falsy → 分支隐藏
    const isOverseasSkin = isOverseas();

    const searchDecorateConfig = useSearchDecorateStore((s) => s.config);
    const searchDecorateHasDecorate = useSearchDecorateStore((s) => s.hasDecorate);
    const fetchSearchDecorateConfig = useSearchDecorateStore((s) => s.fetchConfig);

    /** 布局样式：1-国内版，2-海外版 */
    const layoutStyle = Number(searchDecorateConfig.layoutStyle ?? 1);
    // 装修配置为门店聚合搜索时搜的是门店名称，不提供以图搜图
    const isStoreSearch = searchDecorateHasDecorate && Number(searchDecorateConfig.searchResultType) === 2;

    const [navbarTitle, setNavbarTitle] = useState(t("搜索商品"));
    const [placeholder, setPlaceholder] = useState(t("点击搜索商品"));

    const [keyWords, setKeyWords] = useState("");

    const [searchHistory, setSearchHistory] = useState<any[]>([]);

    const shopIdRef = useRef("");
    const isSwitchTabRef = useRef(false);
    /** 装修预览 id：从入口页再搜时透传给 result，避免丢掉草稿预览 */
    const previewIdRef = useRef<string | number>("");

    // 需要返回的路径
    const redirectPathRef = useRef("");
    // 需要查询的历史记录字段名称
    const searchHistoryKeyRef = useRef("searchHistory");

    // 对应旧 onLoad（useRouter.params + useEffect）
    useEffect(() => {
        const options: any = router.params;
        // 装修预览链路：误进 index 时仍拉草稿，并在跳 result 时透传 previewId
        if (options?.previewId) {
            previewIdRef.current = options.previewId;
        }
        void fetchSearchDecorateConfig(options?.previewId);
        if (options) {
            if (options.shopId && options.shopId != "undefined") {
                shopIdRef.current = options.shopId;
                setNavbarTitle(t("店铺搜索"));
            }
            // 接收关键词并显示在输入框中
            if (options.keyWords) {
                setKeyWords(decodeGroupQuery(options.keyWords));
            }
            redirectPathRef.current = options.redirectPath || "";
            searchHistoryKeyRef.current = options.searchHistoryKey || "searchHistory";
            setNavbarTitle(options.navbarTitle || "搜索商品");
            setPlaceholder(options.placeholder || "点击搜索商品");
            isSwitchTabRef.current = options.isSwitchTab;
        }
        if (Taro.getStorageSync(searchHistoryKeyRef.current)) {
            setSearchHistory(Taro.getStorageSync(searchHistoryKeyRef.current));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const searchSubmit = () => {
        if (keyWords) {
            const nextHistory = [...new Set([keyWords, ...searchHistory])];
            if (nextHistory.length > 10) {
                nextHistory.splice(10, nextHistory.length - 10);
            }
            setSearchHistory(nextHistory);
            Taro.setStorageSync(searchHistoryKeyRef.current, nextHistory);
            handleSearch(keyWords);
        } else {
            // 门店入口进入搜索页时，允许空关键词提交（返回门店页展示全部商品）
            const isFromStore = typeof redirectPathRef.current === "string" && redirectPathRef.current.startsWith("/pages/store/index");
            if (
                redirectPathRef.current === "/pages/buyerShow/index" ||
                redirectPathRef.current.includes("/pages/groupon/list") ||
                redirectPathRef.current === "/pages/groupon/mylist" ||
                isFromStore
            ) {
                handleSearch(keyWords);
                return;
            }
            Taro.showToast({
                title: t("请输入搜索内容"),
                icon: "none"
            });
        }
    };
    const clearHistory = () => {
        setSearchHistory([]);
        Taro.removeStorageSync(searchHistoryKeyRef.current);
    };

    const handleSearch = (item: any) => {
        const encodedKeyword = encodeURIComponent(item);
        // 如果需要返回路径存在，则返回对应页面
        if (isSwitchTabRef.current) {
            const url = `${redirectPathRef.current}${redirectPathRef.current.includes("?") ? "&" : "?"}keyWords=${encodedKeyword}`;
            Taro.reLaunch({
                url
            });
            return;
        } else if (redirectPathRef.current) {
            // 有历史栈时：走事件通知 + navigateBack，避免"栈里叠两个上一页"导致返回按钮回不到进入前的页面
            const pages = Taro.getCurrentPages();
            if (pages.length > 1) {
                Taro.eventCenter.trigger("searchKeyWordsResult", {
                    redirectPath: redirectPathRef.current,
                    keyWords: item
                });
                Taro.navigateBack();
                return;
            }
            // 无历史栈（深链接直接进入搜索页）时：用 redirectTo 兜底
            const url = `${redirectPathRef.current}${redirectPathRef.current.includes("?") ? "&" : "?"}keyWords=${encodedKeyword}`;
            Taro.redirectTo({ url });
            return;
        }
        let url = `/pages/search/result?keyWords=${encodedKeyword}`;
        shopIdRef.current && (url += `&shopId=${shopIdRef.current}`);
        const previewId = previewIdRef.current;
        if (previewId !== "" && previewId !== undefined && previewId !== null) {
            url += `&previewId=${previewId}`;
        }
        redirect({
            url
        });
    };

    const handleBack = () => {
        // 优先返回上一页，避免用 navigateTo 二次入栈导致返回死循环
        const pages = Taro.getCurrentPages();
        if (pages.length > 1) {
            Taro.navigateBack();
            return;
        }
        // 无历史栈时兜底：有 redirectPath 则替换当前页跳过去；否则回首页
        if (redirectPathRef.current) {
            Taro.redirectTo({
                url: redirectPathRef.current
            });
            return;
        }
        Taro.switchTab({
            url: "/pages/index/index"
        });
    };

    return (
        <TigLayout title={navbarTitle} customBack onBack={handleBack}>
            {/* 旧 <mainHeader v-if="isOverseasSkin" position="sticky" no-safe-top />（B6 批次已移植，实挂） */}
            {isOverseasSkin && <MainHeader position="sticky" noSafeTop />}
            <View className={`searchGood ${layoutStyle === 2 ? "searchGood--overseas" : ""}`}>
                {/* 国内版：灰底圆角框 + 框外「搜索」文字（无放大镜）；海外版：黑描边 + 框内 icon-neirongsousuo */}
                {layoutStyle === 1 ? (
                    <View className="search-warp acea-row">
                        <View className="search-input acea-row">
                            <Input
                                value={keyWords}
                                focus
                                type="text"
                                placeholder={t(placeholder)}
                                placeholderClass="placeholder"
                                placeholderStyle="color:#bbb"
                                onInput={(e) => setKeyWords(e.detail.value)}
                                onConfirm={() => searchSubmit()}
                            />
                            {!isStoreSearch && <ImageSearchEntry shopId={shopIdRef.current} flushRight />}
                        </View>
                        <View className="bnt" onClick={searchSubmit}>
                            {t("搜索")}
                        </View>
                    </View>
                ) : (
                    <View className="search-warp search-warp--overseas acea-row">
                        <View className="search-input acea-row">
                            <Text className="iconfont icon-neirongsousuo search-ico" onClick={searchSubmit} />
                            <Input
                                value={keyWords}
                                focus
                                type="text"
                                placeholder={t(placeholder)}
                                placeholderClass="placeholder"
                                placeholderStyle="color:#bbb"
                                onInput={(e) => setKeyWords(e.detail.value)}
                                onConfirm={() => searchSubmit()}
                            />
                            {!isStoreSearch && <ImageSearchEntry shopId={shopIdRef.current} flushRight color="#1a1a1a" />}
                        </View>
                    </View>
                )}
                {searchHistory.length > 0 && (
                    <View className="search_init_box">
                        <View className="search_history_box">
                            <View className="title">
                                {t("搜索历史")}
                                <View
                                    className="clear_history"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        clearHistory();
                                    }}
                                >
                                    <Text className="iconfont-h5 icon-shanchu" />
                                </View>
                            </View>
                            <View className="list acea-row">
                                {searchHistory.map((item, index) => (
                                    <View key={index} className="item line1" onClick={() => handleSearch(item)}>
                                        {item}
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>
                )}
            </View>
        </TigLayout>
    );
}

