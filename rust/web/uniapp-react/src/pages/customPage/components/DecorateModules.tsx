import { useRef, useState } from "react";
import { View, Image, Swiper, SwiperItem } from "@tarojs/components";

import { MODULE_REGISTRY, STICKY_REGISTRY, type DecorateModuleProps } from "@/pages/customPage/modules/registry";
import { redirect, getElementRect } from "@/utils";
import { imageFormat } from "@/utils/format";

import "./DecorateModules.scss";

interface CatNavData {
    id: number;
    categoryId: number;
    showCatNav: number;
    catColor: string;
    childCatInfo: any[];
    brandInfo: any[];
    imgUrl: any[];
}

interface Props {
    modules: any[];
    pageModles: any;
    scrollTop: number;
    onLoadGoodsList?: (categoryId: number) => void;
}

/**
 * 装修模块分发器（自旧 pages/customPage/modules/index.vue 移植）：
 * - navbar（页面标题装修）+ 按 moduleIndex 顺序渲染已注册模块
 * - catNav 选中分类后的二级展示（banner 轮播 / 子分类 / 品牌）
 */
export default function DecorateModules({ modules, pageModles, scrollTop, onLoadGoodsList }: Props) {
    const [showCatNav, setShowCatNav] = useState(0);
    const [show, setShow] = useState(false);
    const catIdRef = useRef(0);
    const [childCatInfoData, setChildCatInfoData] = useState<any[]>([]);
    const [brandInfoData, setBrandInfoData] = useState<any[]>([]);
    const [imgUrlData, setImgUrlData] = useState<any[]>([]);
    const [currentColor, setCurrentColor] = useState("");
    const [swiperHeight, setSwiperHeight] = useState(0);
    const instanceRef = useRef<any>(null);

    const onChangeCatNav = (data: CatNavData) => {
        const { categoryId, catColor, imgUrl, childCatInfo, brandInfo } = data;
        setChildCatInfoData(childCatInfo);
        setBrandInfoData(brandInfo);
        setImgUrlData(imgUrl);
        setCurrentColor(catColor);
        if (categoryId === catIdRef.current) return;
        catIdRef.current = categoryId; //  记录当前分类id
        // 对应旧 nextTick：状态批量更新后回调父级
        setTimeout(() => {
            if (catIdRef.current > 0) {
                setShowCatNav(1);
            } else {
                setShowCatNav(0);
            }
            setShow(true);
            onLoadGoodsList?.(categoryId);
        }, 0);
    };

    const computeImgHeight = () => {
        setTimeout(async () => {
            const res = await getElementRect(".swiper-image", instanceRef.current);
            setSwiperHeight(res?.height ?? 0);
        }, 0);
    };

    return (
        <View ref={instanceRef as any}>
            {pageModles && pageModles.title && pageModles.title !== "" && <ModuleById type="navbar" module={pageModles} />}

            {modules.map((mod: any, index: number) => {
                if (mod.type === "searchBar" && mod?.isShow) {
                    return <ModuleById key={mod.moduleIndex} type="searchBar" module={mod.module} />;
                }
                if (mod.type === "searchBar2" && mod?.isShow) {
                    return <ModuleById key={mod.moduleIndex} type="searchBar2" module={mod.module} />;
                }
                if (mod.type === "catNav" && mod?.isShow) {
                    return (
                        <View key={mod.moduleIndex}>
                            <ModuleById
                                type="catNav"
                                module={mod.module}
                                scrollTop={scrollTop}
                                onChangeCatNav={onChangeCatNav}
                                onIsCut={setShow}
                            />
                            <ModuleById
                                type="catNavSticky"
                                module={mod.module}
                                scrollTop={scrollTop}
                                onChangeCatNav={onChangeCatNav}
                                onIsCut={setShow}
                            />
                        </View>
                    );
                }

                const Registered = MODULE_REGISTRY[mod.type];
                if (Registered && mod?.isShow && showCatNav === 0) {
                    const props: DecorateModuleProps = { module: mod.module, moduleIndex: mod.moduleIndex, index };
                    if (mod.type === "bannerA2") {
                        props.needStatusBar = !(pageModles && pageModles.title !== "");
                    }
                    return (
                        <View key={mod.moduleIndex} className={show ? "show" : ""}>
                            <Registered {...props} />
                        </View>
                    );
                }
                if (mod?.isShow && !Registered && showCatNav === 0) {
                    console.warn(`[DecorateModules] 模块类型 ${mod.type} 尚未迁移（TODO B1-B6）`);
                }
                return null;
            })}

            {showCatNav === 1 && (
                <View>
                    {imgUrlData.length > 0 && (
                        <View className="bannerBox" style={`background: ${currentColor};`}>
                            <View className={`bannerWrap ${show ? "show" : ""}`}>
                                <Swiper
                                    current={0}
                                    indicatorDots={false}
                                    autoplay
                                    circular
                                    interval={3000}
                                    duration={500}
                                    indicatorColor="rgba(255,255,255,0.6)"
                                    indicatorActiveColor="#fff"
                                    style={{ height: swiperHeight + "px" }}
                                >
                                    {imgUrlData.map((item: any, index: number) => (
                                        <SwiperItem key={index}>
                                            <View className="swiper-slide">
                                                <Image
                                                    className="swiper-image"
                                                    mode="widthFix"
                                                    src={imageFormat(item.picUrl)}
                                                    onLoad={computeImgHeight}
                                                />
                                            </View>
                                        </SwiperItem>
                                    ))}
                                </Swiper>
                            </View>
                        </View>
                    )}

                    {childCatInfoData.length > 0 && (
                        <View className="categoryBox" style={`background: ${currentColor};`}>
                            <View className={`categoryWrap ${show ? "show" : ""}`}>
                                {childCatInfoData.map((item: any, index: number) =>
                                    index < 10 ? (
                                        <View
                                            key={index}
                                            className="item"
                                            onClick={() => redirect({ url: "/pages/search/result", param: { categoryId: item.categoryId } })}
                                        >
                                            <View className="item-img">
                                                <Image src={item.categoryPic} mode="widthFix" />
                                            </View>
                                            <View className="txt">{item.categoryName}</View>
                                        </View>
                                    ) : null
                                )}
                            </View>
                        </View>
                    )}

                    {brandInfoData.length > 0 && (
                        <View className="brandBox">
                            <View className={`brandWrap ${show ? "show" : ""}`}>
                                {brandInfoData.map((brand: any, index: number) =>
                                    index < 8 ? (
                                        <View key={index} className="item">
                                            <View
                                                className="itemWrap"
                                                onClick={() => redirect({ url: "/pages/search/result", param: { brandId: brand.brandId } })}
                                            >
                                                <Image src={brand.brandLogo} mode="widthFix" />
                                                <View className="txt">{brand.brandName}</View>
                                            </View>
                                        </View>
                                    ) : null
                                )}
                            </View>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

/** 从注册表取模块；navbar/catNavSticky 等特殊 key 走各自注册表 */
function ModuleById({ type, ...props }: { type: string } & DecorateModuleProps) {
    const Cmp = type === "catNavSticky" ? STICKY_REGISTRY["catNav"] : MODULE_REGISTRY[type];
    if (!Cmp) {
        console.warn(`[DecorateModules] 模块类型 ${type} 尚未迁移（TODO B1-B6）`);
        return null;
    }
    return <Cmp {...props} />;
}
