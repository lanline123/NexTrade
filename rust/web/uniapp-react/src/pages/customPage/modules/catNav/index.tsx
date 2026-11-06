import { useMemo } from "react";
import { View, Image, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";

import ImageSearchEntry from "@/components/imageSearchEntry";
import TigSelectLang from "@/components/tig/tig-select-lang/TigSelectLang";
import { usecatnavStore } from "@/store/catnav";
import { useConfigStore } from "@/store/config";
import { imageFormat } from "@/utils/format";
import { designPxToDevicePx, designPxToRpx } from "@/components/modules";
import { isOverseas } from "@/utils";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    scrollTop?: number;
    onChangeCatNav?: (data: any) => void;
    onIsCut?: (val: boolean) => void;
}

/** 分类导航（自旧 catNav/index.vue 移植，含搜索框入口/语言切换/横滑分类） */
export default function CatNav({ module, onChangeCatNav, onIsCut }: Props) {
    const navLeft = usecatnavStore((s) => s.navLeft);
    const currentCatnavId = usecatnavStore((s) => s.currentCatnavId);
    const catColor = usecatnavStore((s) => s.catColor);
    const setNavLeft = usecatnavStore((s) => s.setNavLeft);
    const setShowCatNav = usecatnavStore((s) => s.setShowCatNav);
    const setCurrentCatnavId = usecatnavStore((s) => s.setCurrentCatnavId);
    const setCatColor = usecatnavStore((s) => s.setCatColor);
    const navHeight = useConfigStore((s) => s.navHeight);

    const navItemStyle = useMemo(
        () => ({
            width: `${module.itemWidth ?? 50}%`
        }),
        [module.itemWidth]
    );

    const logoHeight = "height:" + designPxToRpx(module.logoHeight) + ";";
    const searchText = module.searchText ? module.searchText : t("搜索商品");
    const searchFormat = useMemo(
        () => ({
            itemBackgroundColor: "background-color:" + module.itemBackgroundColor + ";",
            searchTextColor: "color:" + module.searchTextColor + ";",
            itemRadius: "border-radius:" + designPxToRpx(module.itemRadius) + ";",
            paddingRight: "padding-right:" + designPxToRpx(module.boxPadding) + ";",
            paddingLeft: "padding-left:" + designPxToRpx(module.boxPadding) + ";"
        }),
        [module]
    );

    const handleSkip = () => {
        Taro.navigateTo({
            url: "/pages/search/index"
        }).catch(() => {});
    };

    const changeCatNav = (e: any) => {
        onIsCut?.(false);
        const { id, categoryid, catcolor, index } = e.currentTarget.dataset;
        const leadingMargin = designPxToDevicePx(10, Taro.getWindowInfo().windowWidth);
        let navLeftNum = (e.currentTarget.offsetLeft ?? 0) - leadingMargin;
        navLeftNum = navLeftNum - navLeftNum / (Number(index) + 1) + leadingMargin;
        const catColorData = catcolor ?? "";
        setCatColor(catColorData);
        setNavLeft(navLeftNum);
        setShowCatNav(id > 0 ? 1 : 0);
        setCurrentCatnavId(Number(id));

        const { imgUrl = [], childCatInfo = [], brandInfo = [] } = e.currentTarget.dataset.alldata ?? {};

        onChangeCatNav?.({
            id: Number(id),
            imgUrl,
            childCatInfo,
            brandInfo,
            categoryId: Number(categoryid),
            showCatNav: id > 0 ? 1 : 0,
            catColor: catColorData
        });
    };

    return (
        <View className="module-ad-con module-cat_nav">
            <View className="catNav-warp">
                <View
                    className="catNav-con"
                    style={`background-color: ${module.backgroundColor};padding-top:${designPxToRpx(module.boxPaddingTop)};padding-bottom:${designPxToRpx(
                        module.boxPaddingBottom
                    )};background-image: url(${imageFormat(module.navBackgroundPic?.picUrl || "")});background-position: center bottom;background-size: 100% auto;${
                        catColor !== "" ? `background:${catColor}` : ""
                    }`}
                >
                    <View className="catnav-item" style={`padding-top:${navHeight - 110}rpx;`}>
                        <View className="item-content">
                            <View>
                                <Image
                                    className="catnav-logo"
                                    mode="aspectFit"
                                    style={logoHeight}
                                    src={imageFormat(module.logoPic?.picUrl || "")}
                                />
                                <View className="search-lang-box">
                                    <View className="default-search" style={searchFormat.paddingRight + searchFormat.paddingLeft} onClick={handleSkip}>
                                        <View className="default-search-config catnav-search" style={searchFormat.itemBackgroundColor + searchFormat.itemRadius}>
                                            <View className="iconfont-h5 icon-sousuo" />
                                            <View className="catnav-search-text" style={searchFormat.searchTextColor}>
                                                {searchText}
                                            </View>
                                            <ImageSearchEntry />
                                        </View>
                                    </View>
                                    {isOverseas() && <TigSelectLang />}
                                </View>
                            </View>

                            <ScrollView className="item-cat_nav-con" scrollLeft={navLeft} scrollWithAnimation scrollX>
                                <View className="cat-nav-list">
                                    <View
                                        className={`nav-item ${currentCatnavId === 0 ? "current" : ""}`}
                                        style={navItemStyle as any}
                                        data-id={0}
                                    >
                                        <View
                                            className="tit"
                                            style={`color: ${module.textColor};`}
                                            data-id={0}
                                            data-categoryid={0}
                                            data-index={0}
                                            onClick={changeCatNav}
                                        >
                                            {t("推荐")}
                                        </View>
                                    </View>
                                    {(module.navList || []).map((nav: any, index: number) => (
                                        <View
                                            key={index}
                                            style={navItemStyle as any}
                                            className={`nav-item ${currentCatnavId === nav.mobileCatNavId ? "current" : ""}`}
                                            data-id={nav.mobileCatNavId}
                                            data-categoryid={nav.categoryId}
                                            data-index={index}
                                            data-catcolor={nav.catColor}
                                            data-alldata={nav}
                                            onClick={changeCatNav}
                                        >
                                            <View className="tit" style={`color: ${module.textColor};`}>
                                                {nav.categoryName}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}
