import { Fragment, useState } from "react";
import { Popup } from "@nutui/nutui-react-taro";
import { ScrollView, View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import TigButton from "@/components/tig/tig-button/TigButton";
import FormatPrice from "@/components/format-price/FormatPrice";
import { getSkuText, hasSkuText, isOverseas, staticResource } from "@/utils";
import { pickSkuPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import type { Cart, CartList, ShippingTypeItem, Total } from "@/types/order/check";
import type { PresaleInfo } from "@/types/presale/presale";

import ProductItem from "./ProductItem";
import PresaleCard from "./PresaleCard";

import "./StoreCard.scss";

interface Props {
    /** 购物车商品列表（按店铺分组） */
    cartList?: CartList[];
    /** 旧 v-model:shipping-type → shippingType + onShippingTypeChange */
    shippingType?: {
        [key: string]: {
            typeId: number;
            shopId: number;
            typeName: string;
        };
    };
    onShippingTypeChange?: (val: any) => void;
    shippingTypeList?: { [key: string]: ShippingTypeItem[] };
    /** 配送方式类型：1-快递配送 2-门店自提 3-同城配送 */
    deliveryType?: number;
    presaleInfo?: PresaleInfo | null;
    total?: Total | any;
    /** 旧 @change：配送方式等变更后触发重算 */
    onChange?: () => void;
    /** 旧 @changeProductExtra：商品附加服务变更 */
    onChangeProductExtra?: (data: { cartId: number; extraAttrIds: string }) => void;
}

/**
 * 店铺商品卡片组件（通用版，标准/跨境构建使用；自旧 pages/order/src/storeCard.vue 移植）
 * - 按店铺分组展示结算商品列表
 * - 单商品展示大图详情行，多商品横滑缩略图 + 全部商品弹层
 * - 显示赠品、配送方式、预售流程
 * - 支持商品附加规格选择
 */
export default function StoreCard({
    cartList = [],
    shippingType = {},
    onShippingTypeChange,
    shippingTypeList = {},
    deliveryType,
    presaleInfo,
    total,
    onChange,
    onChangeProductExtra
}: Props) {
    const [show, setShow] = useState(false);
    // 旧 shippingTypeKey ref(0)：弹窗内固定取第 0 个店铺的配送方式列表，从未改写
    const [shippingTypeKey] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentTypeID, setCurrentTypeID] = useState<null | number>(null);

    const currentShippingType = ((): ShippingTypeItem | null => {
        return shippingTypeList && shippingTypeList[shippingTypeKey] && shippingTypeList[shippingTypeKey][currentIndex]
            ? shippingTypeList[shippingTypeKey][currentIndex]
            : null;
    })();

    const getActive = (index: number, id: number) => {
        if (currentTypeID) {
            return currentTypeID === id;
        } else {
            return shippingType[shippingTypeKey]?.typeId === id;
        }
    };

    const handleShippingType = (index: number, id: number) => {
        setCurrentIndex(index);
        setCurrentTypeID(id);
    };

    const handlecConfirm = () => {
        const list = JSON.parse(JSON.stringify(shippingType));
        const { shippingTypeId, shippingTypeName } = shippingTypeList[shippingTypeKey][currentIndex];
        list[shippingTypeKey].shopId = shippingTypeKey;
        list[shippingTypeKey].typeId = shippingTypeId;
        list[shippingTypeKey].typeName = shippingTypeName;
        onShippingTypeChange?.(list);
        onChange?.();
        setShow(false);
    };

    const getShippingTypeText = (id: number, noShipping: number) => {
        return noShipping === 1 ? t("无需配送") : t(shippingType?.[id]?.typeName || "") || t("该收货地址不支持配送");
    };

    const handleLink = (url: string, id: number) => {
        // 商品 id 无效时不跳转；门店支持平台自营 shopId=0
        if (id === 0 && !url.includes("/pages/store/")) return;
        Taro.navigateTo({
            url: url + id
        });
    };

    const [showProductPopup, setShowProductPopup] = useState(false);
    const [currentPopupProducts, setCurrentPopupProducts] = useState<Cart[]>([]);

    const handleProductPopup = (carts: Cart[]) => {
        setCurrentPopupProducts(carts);
        setShowProductPopup(true);
    };

    const [showAttr, setShowAttr] = useState(false);
    const [currentAttr, setCurrentAttr] = useState<any>({});
    const [checkedAttrs, setCheckedAttrs] = useState<any[]>([]);

    const handleShowAttr = (item: any) => {
        setCurrentAttr(item);
        setCheckedAttrs(item.extraSkuData.length ? item.extraSkuData.map((row: any) => row.attributesId) : []);
        setShowAttr(true);
    };

    // 旧 handleAttrClick 为就地按下标改写（checkedAttrs[index] = null | id），React 按下标复制改写
    const handleAttrClick = (index: number, id: number) => {
        setCheckedAttrs((prev) => {
            const next = [...prev];
            if (next[index] && next[index] === id) {
                next[index] = null;
            } else {
                next[index] = id;
            }
            return next;
        });
    };

    const handleAttribute = () => {
        onChangeProductExtra?.({
            cartId: currentAttr.cartId,
            extraAttrIds: checkedAttrs.filter((item) => !!item).join(",")
        });
        setShowAttr(false);
    };

    return (
        <>
            {cartList.map((item, index) => (
                <View key={index} className="store-card">
                    <View className="store-card-item">
                        <View className="store-card-item-title" onClick={() => handleLink(`/pages/shop/index?shopId=`, item.shopId)}>
                            {item.shopId === 0 && <View className="store-card-item-label">{t("自营")}</View>}
                            <View className="store-card-item-name">{item.shopTitle ? item.shopTitle : t("自营")}</View>
                        </View>

                        {item.carts.length === 1 ? (
                            item.carts.map((subItem, subIndex) => (
                                <Fragment key={subIndex}>
                                    <ProductItem product={subItem} />
                                    {subItem.extraSkuAllData && subItem.extraSkuAllData.extra && subItem.extraSkuAllData.extra.length ? (
                                        <View className="attr-box" onClick={() => handleShowAttr(subItem)}>
                                            <View className="attr-label">{t("附加")}</View>

                                            {subItem.extraSkuData && subItem.extraSkuData.length ? (
                                                <View className="attr-list">
                                                    {subItem.extraSkuData.map((attr, attrIndex) => (
                                                        <View key={attrIndex} className="attr-item">
                                                            <View className="item-content">
                                                                <Text className="line1 content-text">{attr.attrValue}</Text>
                                                                <View className="right">
                                                                    {/* 旧 <format-price class="price">：FormatPrice 无 className 透传，外层 View 承接类名钩子 */}
                                                                    <View className="price">
                                                                        <FormatPrice priceData={attr.attrPrice} />
                                                                    </View>
                                                                    <View className="num">x{subItem.quantity}</View>
                                                                </View>
                                                            </View>
                                                        </View>
                                                    ))}
                                                </View>
                                            ) : (
                                                <View>{t("可选附加规格")}</View>
                                            )}

                                            <Text className="iconfont-h5 icon-xiajiantou1-copy" />
                                        </View>
                                    ) : null}
                                </Fragment>
                            ))
                        ) : (
                            <View className="store-card-item-content2-box">
                                <View className="store-card-item-content2 flex">
                                    {item.carts.map((subItem, subIndex) => (
                                        <View
                                            key={subIndex}
                                            className="content-item"
                                            onClick={() => handleLink(`/pages/product/index?id=`, subItem.productId)}
                                        >
                                            <View className="store-card-item-img">
                                                <TigImage src={pickSkuPic(subItem)} />
                                            </View>
                                            <View className="item-price flex justify-center">
                                                <FormatPrice integerStyle={{ fontSize: "18px", lineHeight: "24px" }} priceData={subItem.price} />
                                            </View>
                                        </View>
                                    ))}
                                    <View className="more-btn" onClick={() => handleProductPopup(item.carts)}>
                                        <View className="">
                                            {item.carts.length} {t("件")}
                                        </View>
                                        <View className="iconfont-h5 icon-fanhui" />
                                    </View>
                                </View>
                            </View>
                        )}

                        {item.gift && item.gift.length > 0 && (
                            <View className="gift-box">
                                <View className="gift-title">{t("赠品")}</View>
                                <View className="gift-content">
                                    {item.gift.map((subItem, giftIndex) => (
                                        <View key={giftIndex} className="gift-content-item">
                                            <View className="gift-item-left">
                                                <TigImage src={pickSkuPic(subItem)} />
                                            </View>
                                            <View className="gift-item-right">
                                                <View className="gift-item-name line1">{subItem.productName}</View>
                                                {hasSkuText(subItem.skuData) && (
                                                    <View className="sku-card">
                                                        <View className="sku-item">{getSkuText(subItem.skuData)}</View>
                                                    </View>
                                                )}
                                                <View className="gift-item-num">x{subItem.num}</View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        <View className="payment">
                            <View className="payment-title">{t("配送方式")}</View>
                            <View className="payment-content">
                                <View className="payment-text">{getShippingTypeText(item.shopId, item.noShipping)}</View>
                            </View>
                        </View>

                        {/* 预售流程卡（预售不混单：只在第一个店铺下展示一次） */}
                        {presaleInfo && index === 0 && <PresaleCard presaleInfo={presaleInfo} total={total} deliveryType={deliveryType} />}
                    </View>
                </View>
            ))}

            {/* 旧 tig-popup（v-model:show）→ NutUI Popup */}
            <Popup visible={show} onClose={() => setShow(false)} style={{ backgroundColor: "#fff" } as any}>
                <View className="payment-popup">
                    <View className="popup-title title">{t("选择配送方式")}</View>
                    <View className="payment-btn">
                        {shippingTypeList[shippingTypeKey]?.map((item, index) => (
                            <View
                                key={index}
                                className={`payment-btn-item ${getActive(index, item.shippingTypeId) ? "active" : ""}`}
                                onClick={() => handleShippingType(index, item.shippingTypeId)}
                            >
                                {t(item?.shippingTypeName)}
                            </View>
                        ))}
                    </View>
                    <View className="payment-desc">
                        <View className="payment-desc-title">{t(currentShippingType?.shippingTypeName || "")}</View>
                        <View className="payment-desc-text"> {t(currentShippingType?.shippingTimeDesc || "")} </View>
                    </View>

                    {/* 旧 tig-fixed-placeholder（background #fff）→ 固定底栏，安全区由 .fixed-placeholder 让出 */}
                    <View className="fixed-placeholder">
                        <View className="btn-box">
                            {/* 旧 tig-button（已收敛到公共组件） */}
                            <TigButton onClick={handlecConfirm}>
                                {" "}
                                {t("提交")}
                            </TigButton>
                        </View>
                    </View>
                </View>
            </Popup>

            <Popup visible={showProductPopup} onClose={() => setShowProductPopup(false)} closeable={false} style={{ backgroundColor: "#fff" } as any}>
                <View className="product-popup">
                    <View className="popup-title-box">
                        <View className="title"> {t("所有商品")}{`(${currentPopupProducts.length})`} </View>
                        <View className="close-icon" onClick={() => setShowProductPopup(false)}>
                            <Image className="close-img" src={staticResource("order/close.png")} />
                        </View>
                    </View>
                    <ScrollView scrollY className="popup-content">
                        <View className="popup-content-inner">
                            {currentPopupProducts.map((item, index) => (
                                <View key={index} className="popup-content-item">
                                    <ProductItem product={item} />
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            </Popup>

            <Popup visible={showAttr} onClose={() => setShowAttr(false)} style={{ backgroundColor: "#fff" } as any}>
                <View className="attribute">
                    <View className="popup-title title">{t("附加")}</View>
                    <View className="attribute-list">
                        {currentAttr.extraSkuAllData?.extra?.map((item: any, index: number) => (
                            <View key={index} className="attribute-item">
                                <View className="item-title">{item.attrName}</View>
                                <View className="item-content">
                                    {item.attrList.map((subItem: any) => (
                                        <View key={subItem.attributesId} className="item-attr-box">
                                            <View
                                                className={`item-attr ${checkedAttrs[Number(index)] === Number(subItem.attributesId) ? "checked" : ""}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAttrClick(Number(index), Number(subItem.attributesId));
                                                }}
                                            >
                                                <View className="label">{subItem.attrValue}</View>
                                                <View className="line-box" />
                                                <View className="value">
                                                    <FormatPrice priceData={subItem.attrPrice} />
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </View>

                    <View className="fixed-placeholder">
                        <View className="attribute-btn">
                            <View className="desc">{isOverseas() ? t("已选择{0}种", { 0: checkedAttrs.length }) : `已选择${checkedAttrs.length}种`}</View>
                            <View className="">
                                {/* 旧 tig-button（width 400rpx height 80rpx）（已收敛到公共组件） */}
                                <TigButton style={{ width: "400rpx", height: "80rpx" }} onClick={handleAttribute}>
                                    {" "}
                                    {t("确定")}
                                </TigButton>
                            </View>
                        </View>
                    </View>
                </View>
            </Popup>
        </>
    );
}
