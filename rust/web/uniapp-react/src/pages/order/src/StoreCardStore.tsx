import { Fragment, useState } from "react";
import { Popup } from "@nutui/nutui-react-taro";
import { View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import FormatPrice from "@/components/format-price/FormatPrice";
import ActivityCard from "@/components/masonry/ActivityCard";
import { staticResource, redirect, getSkuText, hasSkuText, isOverseas } from "@/utils";
import { t } from "@/utils/i18n";
import type { CartList, ShippingTypeItem, DateStockList, Total } from "@/types/order/check";
import type { PresaleInfo } from "@/types/presale/presale";

import PresaleCard from "./PresaleCard";
import PickupTime from "./PickupTime";
import DateStockCard from "./DateStockCard";

import "./StoreCardStore.scss";

interface Props {
    /** 购物车商品列表（按门店分组） */
    cartList?: CartList[];
    /** 旧 v-model:shipping-type → shippingType + onShippingTypeChange */
    shippingType?: {
        [key: string]: {
            typeId: number;
            shopId: number;
            typeName: string;
            pickupId?: number;
            pickupTitle?: string;
            pickupTime?: string;
            pickupDateType?: number; // 0 今日 1 明日 2 后日
        };
    };
    onShippingTypeChange?: (val: any) => void;
    shippingTypeList?: { [key: string]: ShippingTypeItem[] };
    /** 门店数据（结算页路由 stores 参数透传，选自提点跳转时回传） */
    stores?: any;
    /** 自提点模板数据（按 shopId 分组的 timeList/appointmentTime） */
    pickupTplData?: any;
    /** 配送方式类型：1-快递配送 2-门店自提 3-同城配送 */
    deliveryType?: number;
    /** 库存日历（预约服务） */
    dateStockList?: DateStockList[];
    /** 流程类型（9 预约到店 10 预约上门） */
    flowType?: number;
    /** 预约未选错误提示（提交校验触发） */
    showReserveError?: boolean;
    /** 旧 v-model:reservation-date → reservationDate + onReservationDateChange */
    reservationDate?: string;
    onReservationDateChange?: (val: string) => void;
    /** 旧 v-model:product-reservation-time-id → productReservationTimeId + onProductReservationTimeIdChange */
    productReservationTimeId?: number;
    onProductReservationTimeIdChange?: (val: number) => void;
    /** 旧 v-model:cycle-config → cycleConfig + onCycleConfigChange（周期购配置） */
    cycleConfig?: any;
    onCycleConfigChange?: (val: any) => void;
    /** 是否次卡子卡结算 */
    isSubCard?: boolean;
    presaleInfo?: PresaleInfo | null;
    total?: Total | any;
    /** 旧 @change：配送方式等变更后触发重算 */
    onChange?: () => void;
    /** 旧 @changeProductExtra：商品附加服务变更 */
    onChangeProductExtra?: (data: { cartId: number; extraAttrIds: string }) => void;
}

/**
 * 店铺商品卡片组件（门店版，o2o 构建使用；自旧 pages/order/src/storeCardStore.vue 移植）
 * - 按店铺分组展示结算商品列表
 * - 显示商品信息、SKU、价格、数量
 * - 支持配送方式选择、自提时间选择
 * - 支持预约服务时间选择、周期购配置
 * - 显示商品附加服务和活动标签
 */
export default function StoreCardStore({
    cartList = [],
    shippingType = {},
    onShippingTypeChange,
    shippingTypeList = {},
    stores,
    pickupTplData,
    deliveryType,
    dateStockList = [],
    flowType,
    showReserveError,
    reservationDate = "",
    onReservationDateChange,
    productReservationTimeId = 0,
    onProductReservationTimeIdChange,
    cycleConfig = {},
    onCycleConfigChange,
    isSubCard,
    presaleInfo,
    total,
    onChange,
    onChangeProductExtra
}: Props) {
    // ---- 旧 defineModel(reservationDate / productReservationTimeId / cycleConfig)：受控 props + onChange 回写 ----

    const weekDays = [t("周日"), t("周一"), t("周二"), t("周三"), t("周四"), t("周五"), t("周六")];

    // 计算周几的工具函数
    const getWeekDay = (dateString: string) => {
        const date = new Date(dateString);
        return weekDays[date.getDay()];
    };

    const padZero = (num: number) => {
        return num < 10 ? `0${num}` : num;
    };

    const dateStockListGrouped = (() => {
        const grouped: { [key: string]: DateStockList[] } = {};

        let arr = [];

        dateStockList.forEach((item) => {
            const arr = item.stockDate.split("-");

            const yearMonth = `${arr[0]}-${arr[1]}`;

            if (!grouped[yearMonth]) {
                grouped[yearMonth] = [];
            }

            grouped[yearMonth].push({ ...item, day: arr[2], weekDay: getWeekDay(item.stockDate) });
        });

        // 将对象转换为二维数组，按年月排序
        arr = Object.keys(grouped)
            .sort()
            .map((yearMonth) => grouped[yearMonth]);

        return arr;
    })();

    const [currentGroupIndex, setCurrentGroupIndex] = useState(0);

    const handleChangeGroup = (direction: number) => {
        setCurrentGroupIndex(currentGroupIndex + direction);
        onReservationDateChange?.("");
        onProductReservationTimeIdChange?.(0);
    };

    const reserveTextValue = (() => {
        let str = "";

        if (reservationDate) {
            const arr = reservationDate.split("-");
            str = `${arr[0]}${t("年")}${padZero(Number(arr[1]))}${t("月")}`;
        } else if (dateStockListGrouped && dateStockListGrouped.length > 0) {
            const arr = dateStockListGrouped[currentGroupIndex][0].stockDate.split("-");
            str = `${arr[0]}${t("年")}${padZero(Number(arr[1]))}${t("月")}`;
        }

        return str;
    })();

    const [show, setShow] = useState(false);

    // 旧 shippingTypeKey ref(0)：弹窗内固定取第 0 个店铺的配送方式列表，从未改写
    const [shippingTypeKey] = useState(0);

    const pickupDateTypeMap: Record<number, string> = {
        0: t("今日"),
        1: t("明日"),
        2: t("后日")
    };

    const reserveTextMap: Record<number, string> = {
        9: t("到店时间"),
        10: t("上门时间")
    };

    // 配送时间标题映射（根据 deliveryType）
    const deliveryTimeTextMap: Record<number, string> = {
        1: t("配送时间"), // 商家配送
        2: t("自提时间"), // 到店自提
        3: t("配送时间") // 同城配送
    };

    // 预约类型时间标题映射（根据 flowType）
    const reserveTimeTextMap: Record<number, string> = {
        9: t("到店时间"), // 预约到店
        10: t("上门时间") // 预约上门
    };

    // 是否是周期购订单
    const isCycleBuy = Object.keys(cycleConfig).length > 0;

    // 获取配送时间标题（旧 computed，模板未直接引用，保留原逻辑待后续批次接线）
    const deliveryTimeTitle = (() => {
        // 预约类型优先使用 flowType
        if (flowType === 9 || flowType === 10) {
            return reserveTimeTextMap[flowType];
        }
        // 其他使用 deliveryType
        return deliveryTimeTextMap[deliveryType ?? 0] || t("配送时间");
    })();
    void deliveryTimeTitle;

    const [currentIndex, setCurrentIndex] = useState(0);

    const currentShippingType = ((): ShippingTypeItem | null => {
        return shippingTypeList && shippingTypeList[shippingTypeKey] && shippingTypeList[shippingTypeKey][currentIndex]
            ? shippingTypeList[shippingTypeKey][currentIndex]
            : null;
    })();

    const handleChange = (id: number) => {
        let params = `id=${id}`;

        if (stores) {
            params += `&stores=${encodeURIComponent(JSON.stringify(stores))}`;
        }

        redirect({ url: `/pages/store/selfPick?${params}` });
    };

    const getActive = (index: number, id: number) => {
        if (currentTypeID) {
            return currentTypeID === id;
        } else {
            return shippingType[shippingTypeKey]?.typeId === id;
        }
    };
    const [currentTypeID, setCurrentTypeID] = useState<null | number>(null);
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

    const activityList = (data: any): any[] => {
        return data.filter((item: any) => item.type === 1 || item.type === 6);
    };

    const getPriceMargin = (data: any) => {
        if (data.extraSkuData && data.extraSkuData.length > 0) {
            return 0;
        } else if (data.skuData.length > 0 && data.activityInfo && activityList(data.activityInfo).length > 0) {
            return 0;
        } else if (data.skuData.length === 0 && (!data.activityInfo || activityList(data.activityInfo).length === 0)) {
            return 55;
        } else {
            return 10;
        }
    };
    const handleLink = (url: string, id: number) => {
        if (id === 0) return;
        Taro.navigateTo({
            url: url + id
        });
    };

    const [showAttr, setShowAttr] = useState(false);
    const [currentAttr, setCurrentAttr] = useState<any>({});
    const [checkedAttrs, setCheckedAttrs] = useState<any[]>([]);
    const handleShowAttr = (item: any) => {
        setCurrentAttr(item);
        setCheckedAttrs(item.extraSkuData.length ? item.extraSkuData.map((item: any) => item.attributesId) : []);
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

    const [showPickupTime, setShowPickupTime] = useState(false);

    const [currentShopId, setCurrentShopId] = useState<number | null>(null);

    const [currentShippingData, setCurrentShippingData] = useState<any>({});

    const [timeList, setTimeList] = useState<any[]>([]);

    const [appointmentTime, setAppointmentTime] = useState({});

    const handleChangePickupTime = (shopId: number) => {
        setCurrentShopId(shopId);

        if (pickupTplData) {
            setAppointmentTime(pickupTplData[shopId]?.appointmentTime || {});
            setTimeList(pickupTplData[shopId].timeList || []);
        }

        setCurrentShippingData(shippingType ? shippingType[shopId] || {} : {});
        setShowPickupTime(true);
    };

    const pickupTimeChange = (data: any) => {
        if (currentShopId !== null) {
            const list = JSON.parse(JSON.stringify(shippingType));
            list[currentShopId].pickupTime = data.pickupTime;
            list[currentShopId].pickupDateType = data.pickupDateType;

            onShippingTypeChange?.(list);
            onChange?.();
        }
        setShowPickupTime(false);
    };

    return (
        <>
            {cartList.map((item, index) => (
                <View key={index} className="store-card">
                    {item.isNotReachMinOrderAmount && (
                        <View className="card-tip">
                            <Text className="iconfont-h5 icon-tishi" />
                            {t("还差")}
                            <FormatPrice priceData={item.minOrderAmountDiff} />
                            {t("就能起送")}
                        </View>
                    )}

                    <View className="store-card-item" style={{ paddingTop: item.isNotReachMinOrderAmount ? "0rpx" : "20rpx" }}>
                        <View className="store-card-item-title" onClick={() => handleLink(`/pages/store/index?id=`, item.shopId)}>
                            {item.shopId === 0 && <View className="store-card-item-label">{t("自营")}</View>}
                            <View className="store-card-item-name">{item.shopTitle ? item.shopTitle : t("自营")}</View>
                        </View>

                        {item.carts.map((subItem, subIndex) => (
                            <Fragment key={subIndex}>
                                <View className="store-card-item-content">
                                    <View className="content-item" onClick={() => handleLink(`/pages/product/index?id=`, subItem.productId)}>
                                        <View className="store-card-item-content-left">
                                            {/* 旧 <tig-image class="store-card-item-img">：TigImage 根节点 .base-image-box 默认撑满父容器 */}
                                            <TigImage src={subItem.picThumb} />
                                        </View>
                                        <View className="store-card-item-content-right">
                                            <View className="store-card-item-content-right-title line2">{subItem.productName}</View>
                                            {hasSkuText(subItem.skuData) && (
                                                <View className="sku-card">
                                                    <View className="sku-item">{getSkuText(subItem.skuData)}</View>
                                                </View>
                                            )}
                                            {subItem.activityInfo && activityList(subItem.activityInfo).length > 0 && (
                                                <View className="activity-box">
                                                    {activityList(subItem.activityInfo).map((activityItem, activityIndex) => (
                                                        <ActivityCard key={activityIndex} fontSize="22rpx" activityInfo={activityItem} cardType="sub" />
                                                    ))}
                                                </View>
                                            )}
                                            {/* 附加规格费用 */}
                                            {!!(subItem.extraSkuData && subItem.extraSkuData.length) && (
                                                <View className="extraskudata-box" style={{ marginTop: "20rpx" }}>
                                                    <View className="extraskudata">
                                                        {subItem.extraSkuData.map((attr, attrIndex) => (
                                                            <View key={attrIndex} className="extraskudata-item">
                                                                <View className="title">{attr.attrName}</View>
                                                                <View className="line-box">
                                                                    <View className="line" />
                                                                </View>
                                                                <View className="content">
                                                                    <Text className="line1 content-text">{attr.attrValue}</Text>
                                                                    <View className="price">
                                                                        {/* 旧 <format-price :show-text="false">：外层 View 承接类名钩子 */}
                                                                        <FormatPrice showText={false} priceData={attr.attrPrice} />
                                                                    </View>
                                                                    <View className="num">x{subItem.quantity}</View>
                                                                </View>
                                                            </View>
                                                        ))}
                                                    </View>
                                                </View>
                                            )}
                                            <View className="right-price-box" style={{ marginTop: `${getPriceMargin(subItem)}rpx` }}>
                                                <View className="store-card-item-content-right-price">
                                                    <FormatPrice
                                                        fontStyle={{ fontWeight: "bold" }}
                                                        decimalsStyle={{
                                                            fontSize: "20rpx",
                                                            fontWeight: "bold"
                                                        }}
                                                        currencyStyle={{
                                                            fontSize: "20rpx",
                                                            fontWeight: "bold"
                                                        }}
                                                        priceData={subItem.price}
                                                    />
                                                    {subItem.originPrice && subItem.originPrice !== subItem.price && (
                                                        <FormatPrice
                                                            fontStyle={{
                                                                fontWeight: "400",
                                                                textDecoration: "line-through",
                                                                fontSize: "19rpx",
                                                                color: "#969799",
                                                                position: "relative",
                                                                bottom: "-2px",
                                                                left: "5px"
                                                            }}
                                                            isBottom={false}
                                                            priceData={subItem.originPrice}
                                                        />
                                                    )}
                                                </View>
                                                <View className="store-card-item-content-right-num"> x{subItem.quantity}</View>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                                {!!(subItem.extraSkuAllData && subItem.extraSkuAllData.extra && subItem.extraSkuAllData.extra.length) ? (
                                    <View className="attr-box" onClick={() => handleShowAttr(subItem)}>
                                        <View className="attr-label">{t("附加")}</View>
                                        {subItem.extraSkuData && subItem.extraSkuData.length ? (
                                            <View className="attr-list">
                                                {subItem.extraSkuData.map((attr, attrIndex) => (
                                                    <View key={attrIndex} className="attr-item">
                                                        <View className="item-content">
                                                            <Text className="line1 content-text">{attr.attrValue}</Text>
                                                            <View className="right">
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
                        ))}

                        {item.gift && item.gift.length > 0 && (
                            <View className="gift-box">
                                <View className="gift-title">{t("赠品")}</View>
                                <View className="gift-content">
                                    {item.gift.map((subItem, giftIndex) => (
                                        <View key={giftIndex} className="gift-content-item">
                                            <View className="gift-item-left">
                                                <TigImage src={subItem.picThumb} />
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

                        {/* 预售流程卡（预售不混单：通常只会有一个店铺） */}
                        {presaleInfo && <PresaleCard presaleInfo={presaleInfo} total={total} deliveryType={deliveryType} />}

                        {/* 自提时间（非周期购时显示） */}
                        {!!deliveryType && deliveryType === 2 && !isCycleBuy && !isSubCard && (
                            <>
                                {shippingType && shippingType[item.shopId] && shippingType[item.shopId].pickupTime && (
                                    <View className="payment" onClick={() => handleChangePickupTime(item.shopId)}>
                                        <View className="payment-title">{t("自提时间")}</View>

                                        <View className="payment-content">
                                            <View className="payment-text line1">
                                                {(shippingType[item.shopId].pickupDateType !== undefined && shippingType[item.shopId].pickupDateType !== null
                                                    ? pickupDateTypeMap[shippingType[item.shopId].pickupDateType as 0 | 1 | 2]
                                                    : "") + shippingType[item.shopId].pickupTime}
                                            </View>
                                            <Image lazyLoad className="more-ico" src={staticResource("common/more.png")} />
                                        </View>
                                    </View>
                                )}
                            </>
                        )}

                        {/* 自提点（到店自提时始终显示） */}
                        {!!deliveryType && deliveryType === 2 && !isSubCard && (
                            <>
                                {shippingType && shippingType[item.shopId] && shippingType[item.shopId].pickupId && (
                                    <View className="payment" onClick={() => handleChange(item.shopId)}>
                                        <View className="payment-title">{t("自提点")}</View>

                                        <View className="payment-content">
                                            <View className="payment-text line1">{shippingType[item.shopId].pickupTitle} </View>
                                            <Image lazyLoad className="more-ico" src={staticResource("common/more.png")} />
                                        </View>
                                    </View>
                                )}
                            </>
                        )}
                    </View>

                    {(flowType === 9 || flowType === 10) && !(cycleConfig && Object.keys(cycleConfig).length > 0) && !isSubCard && (
                        <>
                            {dateStockList.length > 0 ? (
                                <>
                                    <View className="payment stock">
                                        <View className="payment-title">
                                            <Text className="iconfont-h5 icon-bitian" />
                                            {reserveTextMap[flowType]}
                                        </View>

                                        <View className="payment-content">
                                            <View className="payment-text date-stock">
                                                {dateStockListGrouped.length > 1 && currentGroupIndex > 0 && (
                                                    <View className="pre" onClick={() => handleChangeGroup(-1)}>
                                                        <Text className="iconfont-h5 icon-a-gengduo20" />
                                                    </View>
                                                )}

                                                {reserveTextValue}

                                                {dateStockListGrouped.length > 1 && currentGroupIndex < dateStockListGrouped.length - 1 && (
                                                    <View className="next" onClick={() => handleChangeGroup(1)}>
                                                        <Text className="iconfont-h5 icon-a-gengduo20" />
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                    <DateStockCard
                                        reservationDate={reservationDate}
                                        onReservationDateChange={onReservationDateChange}
                                        productReservationTimeId={productReservationTimeId}
                                        onProductReservationTimeIdChange={onProductReservationTimeIdChange}
                                        dateStockList={dateStockListGrouped[currentGroupIndex]}
                                    />
                                    {showReserveError && (!reservationDate || productReservationTimeId === 0) && (
                                        <View className="reserve-error-tip">
                                            {t("请选择")}
                                            {reserveTextMap[flowType]}
                                        </View>
                                    )}
                                </>
                            ) : (
                                <View className="payment stock no-stock">
                                    <View className="payment-title">
                                        <Text className="iconfont-h5 icon-bitian" />
                                        {reserveTextMap[flowType]}
                                    </View>

                                    <View className="payment-content">
                                        <View className="payment-text">{t("暂无可选日期")}</View>
                                        <Text className="iconfont-h5 icon-a-gengduo20" />
                                    </View>
                                </View>
                            )}
                        </>
                    )}
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
                            {/* 旧 tig-button → 样式等价 View，TODO(MIGRATION)：随公共 tig-button 统一替换 */}
                            <View className="theme-btn" onClick={handlecConfirm}>
                                {" "}
                                {t("提交")}
                            </View>
                        </View>
                    </View>
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
                                {/* 旧 tig-button（width 400rpx height 80rpx）→ 样式等价 View，TODO(MIGRATION)：随公共 tig-button 统一替换 */}
                                <View className="theme-btn attr-btn" onClick={handleAttribute}>
                                    {" "}
                                    {t("确定")}
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </Popup>

            <PickupTime
                show={showPickupTime}
                onShowChange={setShowPickupTime}
                shippingType={shippingType}
                currentShippingData={currentShippingData}
                timeList={timeList}
                appointmentTime={appointmentTime}
                onChange={pickupTimeChange}
            />
        </>
    );
}
