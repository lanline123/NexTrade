import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Image, Input, ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { getImageSearchProduct, isImageSearchDisabled, isImageSearchExpired, type ImageSearchError, type ImageSearchQuery } from "@/api/search/imageSearch";
import { t } from "@/utils/i18n";

import { useProductSearch } from "../composables/useProductSearch";
import ProductResult from "./ProductResult";

import "./TextSearchLayer.scss";

// 与样式里的淡入淡出时长保持一致
const FADE_MS = 200;

interface Props {
    // 本次搜索的图片
    imagePath: string;
    // 本次图搜会话，关键词在这批相似商品内搜索
    searchToken: string;
    // 顶部状态栏高度，以及微信小程序右上角胶囊按钮要让出的宽度
    topInset: number;
    rightInset: number;
    onClosed: () => void;
    // 后台已关闭图搜，由结果页退出图搜流程
    onDisabled: () => void;
}

export interface TextSearchLayerRef {
    close: () => void;
}

/**
 * 以图搜图结果页内的全屏文字搜索层（自旧 textSearchLayer.vue 移植）
 * - 提交关键词后带上图搜会话一起查，结果是图片候选与关键词的交集，直接展示在输入行下方，只有商品列表，没有排序和筛选
 * - 店铺范围由图搜会话决定，不另传店铺 ID
 * - 不带结果页的排序和筛选，关闭后图片结果、排序、筛选和滚动位置都不变
 * - 每次打开都是新实例，输入框为空
 */
const TextSearchLayer = forwardRef<TextSearchLayerRef, Props>(function TextSearchLayer(
    { imagePath, searchToken, topInset, rightInset, onClosed, onDisabled },
    ref
) {
    const [visible, setVisible] = useState(false);
    const [focused, setFocused] = useState(false);
    const [keyword, setKeyword] = useState("");
    const canSubmit = keyword.trim().length > 0;

    // 与结果页同一个图搜列表接口，带上会话和关键词取交集
    const {
        data: productList,
        promotionList,
        isLoading,
        isLoadMore,
        error,
        params,
        search,
        retry,
        reachBottom,
        stop
    } = useProductSearch(
        (data: ImageSearchQuery) =>
            getImageSearchProduct(data).catch((err: ImageSearchError) => {
                // 与结果页一致：会话无效或已过期按没有商品处理
                if (isImageSearchExpired(err)) return { records: [], total: 0 };
                if (isImageSearchDisabled(err)) {
                    onDisabled();
                    return { records: [], total: 0 };
                }
                throw err;
            }),
        () => ({ searchToken })
    );
    // 是否已经提交过；提交前下方不显示列表
    const [submitted, setSubmitted] = useState(false);
    // 换词后列表回到顶部；scroll-top 值不变时不会滚动，先置一个微小差值
    const [listScrollTop, setListScrollTop] = useState(0);

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closingRef = useRef(false);

    const close = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        setFocused(false);
        Taro.hideKeyboard();
        setVisible(false);
        timerRef.current = setTimeout(() => onClosed(), FADE_MS);
    };

    const submit = () => {
        if (closingRef.current) return;
        // 没有关键词时搜索按钮置灰，键盘提交同样直接忽略
        if (!canSubmit) return;
        setFocused(false);
        Taro.hideKeyboard();
        setSubmitted(true);
        setListScrollTop(listScrollTop ? 0 : 0.01);
        search(keyword.trim());
    };

    const clear = () => {
        setKeyword("");
        setFocused(true);
    };

    useEffect(() => {
        // 先以透明状态渲染一帧，再切到可见，过渡才会生效
        timerRef.current = setTimeout(() => {
            setVisible(true);
            setFocused(true);
        }, 30);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            stop();
        };
        // 仅挂载/卸载执行（对应旧 onMounted / onUnmounted）
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({ close }));

    return (
        <View
            className={`search-layer${visible ? " search-layer--show" : ""}`}
            style={{ paddingTop: `${topInset}px` }}
        >
            <View
                className="search-layer__head"
                style={rightInset ? { paddingRight: `${rightInset}px` } : {}}
                onTouchMove={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                }}
            >
                <View className="search-layer__bar">
                    {/* 缩略图固定方形，完整显示整张图片不裁剪，空余处露出底色；与结果页搜索行的缩略图一致 */}
                    <Image className="search-layer__thumb" src={imagePath} mode="aspectFit" />
                    <View className="search-layer__input-box">
                        <Input
                            className="search-layer__input"
                            type="text"
                            confirmType="search"
                            focus={focused}
                            value={keyword}
                            placeholder={t("输入想搜的内容")}
                            placeholderStyle="color: #999"
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            onConfirm={submit}
                            onInput={(e) => setKeyword(e.detail.value)}
                        />
                        {keyword && (
                            <View className="search-layer__clear" onClick={clear}>
                                <Text className="iconfont-h5 icon-chacha" />
                            </View>
                        )}
                    </View>
                    <View className={`search-layer__btn${canSubmit ? "" : " search-layer__btn--disabled"}`} onClick={submit}>
                        {t("搜索")}
                    </View>
                    <View className="search-layer__divider" />
                    <View className="search-layer__btn search-layer__btn--close" onClick={close}>
                        {t("关闭")}
                    </View>
                </View>
            </View>
            {/* 提交前是一块留白；提交后在下方展示图片与关键词同时匹配的商品 */}
            {!submitted ? (
                <View
                    className="search-layer__body"
                    onTouchMove={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                    }}
                />
            ) : (
                <ScrollView
                    className="search-layer__body search-layer__list"
                    scrollY
                    scrollTop={listScrollTop}
                    onScrollToLower={reachBottom}
                >
                    {/* 加载中结果区留空，与普通商品搜索结果页一致 */}
                    <ProductResult
                        productList={productList}
                        promotionList={promotionList}
                        page={params.page}
                        isLoading={isLoading}
                        isLoadMore={isLoadMore}
                        error={error}
                        onRetry={retry}
                    />
                </ScrollView>
            )}
        </View>
    );
});

export default TextSearchLayer;