import { useEffect, useRef, useState } from "react";
import { Picker, Text, Textarea, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import TigImageUpload, { type ImageUploadItem } from "@/components/tig/tig-image-upload/TigImageUpload";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigNumberBox from "@/components/tig/tig-number-box/TigNumberBox";
import FormatPrice from "@/components/format-price/FormatPrice";
import { aftersalesUpdate, aftersalesViewRecord, getAftersalesConfig, getAftersalesEdit, updateAfterSales } from "@/api/user/afterSale";
import { imageFormat, pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./edit.scss";

interface EditForm {
    items: { orderItemId: number; number: number }[];
    pics: ImageUploadItem[];
    orderId: number;
    aftersaleType: number;
    aftersaleReason: string;
    description: string;
    aftersaleId?: number;
}

/**
 * 售后申请/编辑页（自旧 pages/user/afterSale/edit.vue 移植）
 * - 支持新建售后申请（传 orderId 和可选 itemId）
 * - 支持编辑已有售后申请（传 aftersaleId）
 * - 选择退款方式、退款原因、填写问题描述、上传凭证
 * - 订单状态为待发货(orderStatus=1)时不显示退货退款选项
 */
export default function AfterSaleEdit() {
    usePageGuards();
    const router = useRouter();

    const orderIdRef = useRef<number | null>(null);
    const itemIdRef = useRef<number | null>(null);
    const aftersaleIdRef = useRef<number | null>(null);
    const orderRef = useRef<any>({});

    const [infoData, setInfoData] = useState<{ list: any[]; order: any }>({
        list: [],
        order: {}
    });
    const infoRef = useRef(infoData);
    infoRef.current = infoData;

    const [form, setForm] = useState<EditForm>({
        items: [],
        pics: [],
        orderId: 0,
        aftersaleType: 0,
        aftersaleReason: "",
        description: ""
    });
    const formRef = useRef(form);
    formRef.current = form;

    const patchForm = (patch: Partial<EditForm>) => {
        formRef.current = { ...formRef.current, ...patch };
        setForm(formRef.current);
    };
    const patchInfo = (patch: Partial<{ list: any[]; order: any }>) => {
        infoRef.current = { ...infoRef.current, ...patch };
        setInfoData(infoRef.current);
    };

    const [aftersaleTypeList, setAftersaleTypeList] = useState<any[]>([]);
    const [aftersaleReasonList, setAftersaleReasonList] = useState<any[]>([]);
    const [afterSalesReasonEnabled, setAfterSalesReasonEnabled] = useState(false);
    const [aftersaleTypeIndex, setAftersaleTypeIndex] = useState<number | null>(null);
    const [aftersaleReasonIndex, setAftersaleReasonIndex] = useState<number | null>(null);
    const [fileLists, setFileLists] = useState<ImageUploadItem[]>([]);

    /**
     * 预约上门订单判断（用于将“上门服务费”合并到单品回显价格中）
     */
    const isReserveOrder = (() => {
        const order: any = infoRef.current?.order || {};
        const orderType = Number(order?.orderType ?? 0);
        const isReservationHome = Boolean(order?.isReservationHome);
        return isReservationHome || orderType === 9 || orderType === 10;
    })();

    /**
     * 上门服务费金额（项目内其它页面以 shippingFee 作为上门服务费字段）
     */
    const visitFeeAmount = Number(infoRef.current?.order?.shippingFee ?? 0);

    /**
     * 获取商品显示价格
     * @param item 商品信息
     * @returns 商品显示价格（商品价格 + 附加价 + 上门服务费分摊单价）
     */
    const getDisplayPrice = (item: any) => {
        const orderItems = infoRef.current?.order?.items || [];
        const matched = orderItems.find((orderItem: any) => {
            return orderItem?.itemId === item?.itemId || orderItem?.orderItemId === item?.orderItemId || orderItem?.skuId === item?.skuId;
        });
        const rawExtraSkuData = matched?.extraSkuData ?? item?.extraSkuData ?? [];
        let extraSkuData = rawExtraSkuData;
        if (typeof rawExtraSkuData === "string") {
            try {
                extraSkuData = JSON.parse(rawExtraSkuData);
            } catch {
                extraSkuData = [];
            }
        }
        if (!Array.isArray(extraSkuData)) {
            extraSkuData = [];
        }
        const extraPrice = extraSkuData.reduce((sum: number, extra: any) => {
            const raw = extra?.totalAttrPrice ?? extra?.attrPrice ?? 0;
            return sum + Number(raw || 0);
        }, 0);

        // 上门服务费为“订单级”费用：按商品数量均摊到单品单价，避免多商品时每行叠加导致金额翻倍
        let visitFeeSharePerUnit = 0;
        if (isReserveOrder && visitFeeAmount > 0) {
            const list: any[] = infoRef.current?.list || [];
            const totalQty = list.reduce((sum, it) => {
                const qty = Number(it?.quantity ?? it?.canApplyQuantity ?? it?.number ?? 0);
                return sum + (Number.isFinite(qty) ? qty : 0);
            }, 0);
            if (totalQty > 0) {
                visitFeeSharePerUnit = visitFeeAmount / totalQty;
            }
        }

        return Number(item?.price || 0) + extraPrice + visitFeeSharePerUnit;
    };

    const __getAftersalesEdit = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            if (orderIdRef.current) {
                const result = await getAftersalesEdit({
                    itemId: itemIdRef.current,
                    orderId: orderIdRef.current
                });
                const list = (result.list || []).map((item: any) => ({
                    ...item,
                    number: item.canApplyQuantity
                }));
                orderRef.current = result.order || {};
                patchInfo({ list, order: result.order });
            }
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
        }
    };

    /** 写入售后原因（后端按订单阶段返回已支付/已收货对应列表），已选原因不在新列表中时清空 */
    const applyAftersaleReasons = (result: any) => {
        const reasonList = Array.isArray(result.aftersaleReason) ? result.aftersaleReason : [];
        setAftersaleReasonList(reasonList);
        setAfterSalesReasonEnabled(Number(result.afterSalesReasonEnabled) === 1);
        const index = reasonList.findIndex((item: any) => item === formRef.current.aftersaleReason);
        setAftersaleReasonIndex(index >= 0 ? index : null);
        if (index < 0) patchForm({ aftersaleReason: "" });
    };

    /** 提交失败后按订单最新阶段刷新原因，应对后台改过列表或订单已变为已收货的情况 */
    const refreshAftersaleReasons = async () => {
        try {
            const result = await getAftersalesConfig({ orderId: orderIdRef.current });
            applyAftersaleReasons(result);
        } catch (error) {
            console.error(error);
        }
    };

    /**
     * 获取售后配置（退款方式和退款原因选项）
     * - 待发货订单(orderStatus=1)不显示退货退款(aftersaleType=1)选项
     */
    const __getAftersalesConfig = async () => {
        try {
            const result = await getAftersalesConfig({ orderId: orderIdRef.current });
            applyAftersaleReasons(result);
            const order = orderRef.current;
            const orderStatus = Number(order?.orderStatus);
            const isPickup = !!order?.isPickup;
            const typeList: any[] = [];
            Object.keys(result.aftersaleType).forEach((key) => {
                // 退货退款(aftersaleType=1)限制：待发货订单 或 自提订单未完成提货时不可选
                if (Number(key) === 1 && (orderStatus === 1 || (isPickup && orderStatus <= 2))) {
                    return;
                } else {
                    typeList.push({
                        value: Number(key),
                        label: result.aftersaleType[key]
                    });
                }
            });
            setAftersaleTypeList(typeList);

            if (aftersaleIdRef.current) {
                setAftersaleTypeIndex(typeList.findIndex((item: any) => item.value === formRef.current.aftersaleType));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const __getAftersalesDetail = async () => {
        try {
            const result = await aftersalesViewRecord(aftersaleIdRef.current!);
            patchInfo({ list: result.aftersalesItems, order: result.orders });
            orderRef.current = result.orders || {};
            orderIdRef.current = result.orderId ?? result.orders?.orderId ?? orderIdRef.current;
            patchForm({
                aftersaleId: result.aftersaleId,
                description: result.description,
                aftersaleReason: result.aftersaleReason,
                aftersaleType: result.aftersaleType
            });
            const pics: ImageUploadItem[] = (Array.isArray(result.pics) ? result.pics : []).map((pic: any) => {
                if (typeof pic === "string") {
                    return {
                        url: imageFormat(pic),
                        picName: "",
                        picThumb: pic,
                        picUrl: pic
                    };
                }
                return {
                    ...pic,
                    url: imageFormat(pic?.picThumb || pic?.picUrl || ""),
                    picName: pic?.picName,
                    picThumb: pic?.picThumb,
                    picUrl: pic?.picUrl
                };
            });
            setFileLists(pics);
        } catch (error) {
            console.error(error);
        }
    };

    const getAftersaleType = (e: any) => {
        const index = e.detail.value;
        setAftersaleTypeIndex(index);
        patchForm({ aftersaleType: aftersaleTypeList[index!].value });
    };

    const getAftersaleReason = (e: any) => {
        const index = e.detail.value;
        setAftersaleReasonIndex(index);
        patchForm({ aftersaleReason: aftersaleReasonList[index!] });
    };

    /**
     * 提交售后申请
     * - 校验售后类型及启用时的售后原因，问题描述可选
     * - 根据是否有 aftersaleId 判断是新建还是编辑
     * - 新建用 itemId，编辑用 orderItemId
     */
    const handleSave = async () => {
        if (formRef.current.aftersaleType === 0) {
            Taro.showToast({
                title: t("请选择售后类型"),
                icon: "none"
            });
            return;
        }
        if (afterSalesReasonEnabled && formRef.current.aftersaleReason === "") {
            Taro.showToast({
                title: t("请选择售后原因"),
                icon: "none"
            });
            return;
        }

        const items: { orderItemId: number; number: number }[] = [];
        if (formRef.current.aftersaleId) {
            // 编辑模式：使用 orderItemId
            infoRef.current.list.forEach((item: any) => {
                items.push({ orderItemId: item.orderItemId, number: item.number });
            });
            patchForm({ pics: fileLists, orderId: infoRef.current.order.orderId, items });
            await edit();
        } else {
            // 新建模式：使用 itemId
            infoRef.current.list.forEach((item: any) => {
                items.push({ orderItemId: item.itemId, number: item.number });
            });
            patchForm({ pics: fileLists, orderId: infoRef.current.order.orderId, items });
            await add();
        }
    };

    async function add() {
        try {
            const payload: Record<string, any> = { ...formRef.current };
            if (!afterSalesReasonEnabled) delete payload.aftersaleReason;
            await updateAfterSales(payload);
            Taro.showToast({
                title: t("提交成功")
            });
            setTimeout(() => {
                Taro.eventCenter.trigger("afterSalesSuccess");

                void Taro.redirectTo({
                    url: "/pages/user/afterSale/list"
                });
            }, 1500);
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
            await refreshAftersaleReasons();
        }
    }

    async function edit() {
        try {
            const payload: Record<string, any> = { ...formRef.current };
            if (!afterSalesReasonEnabled) delete payload.aftersaleReason;
            await aftersalesUpdate(payload);
            Taro.showToast({
                title: t("修改成功")
            });
            setTimeout(() => {
                void Taro.redirectTo({
                    url: "/pages/user/afterSale/list"
                });
            }, 1500);
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
            await refreshAftersaleReasons();
        }
    }

    // 旧 onLoad：按参数依次取表单数据 / 详情 / 配置
    useEffect(() => {
        const init = async () => {
            const options = (router.params || {}) as Record<string, any>;
            if (options.orderId) {
                orderIdRef.current = Number(options.orderId);
                itemIdRef.current = options.itemId ? Number(options.itemId) : null;
                await __getAftersalesEdit();
            }
            if (options.aftersaleId) {
                aftersaleIdRef.current = Number(options.aftersaleId);
                await __getAftersalesDetail();
            }
            await __getAftersalesConfig();
        };
        void init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateItemNumber = (index: number, number: number) => {
        const list = infoRef.current.list.map((item: any, i: number) => (i === index ? { ...item, number } : item));
        patchInfo({ list });
    };

    return (
        <TigLayout title={t("申请售后")}>
            {Object.keys(infoData).length > 0 && (
                <View className="after-sale">
                    <View className="after-sale-product">
                        {infoData.list.map((item: any, index: number) => (
                            <View className="product-card-item" key={item.itemId}>
                                <View className="product-card-item-left">
                                    <View className="left-img">
                                        <TigImage src={pickPic(item)} />
                                    </View>
                                </View>
                                <View className="product-card-item-right">
                                    <View className="right-title line2">{item.productName}</View>
                                    <View className="right-price">
                                        <View className="right-price-pricenum">
                                            <FormatPrice
                                                showText={false}
                                                decimalsStyle={{ fontSize: "24rpx", fontWeight: "bold" }}
                                                currencyStyle={{ fontSize: "22rpx", fontWeight: "bold" }}
                                                priceData={getDisplayPrice(item)}
                                            />
                                        </View>
                                        <View className="right-price-quantity">x {item.quantity}</View>
                                    </View>
                                </View>
                                <View className="btn-box">
                                    <View className="btn-box-content">
                                        <Text className="btn-box-content-text">
                                            {t("可售后数量")}
                                            {item.canApplyQuantity}
                                        </Text>
                                        <TigNumberBox
                                            value={item.number}
                                            max={item.canApplyQuantity}
                                            min={1}
                                            onChange={(value) => updateItemNumber(index, value)}
                                        />
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>

                    <View className="after-sale-form">
                        <View className="form-row">
                            <View className="form-row-label">{t("售后类型")}</View>
                            <Picker
                                mode="selector"
                                value={aftersaleTypeIndex ?? 0}
                                rangeKey="label"
                                range={aftersaleTypeList}
                                onChange={getAftersaleType}
                            >
                                <View className="form-item-content">
                                    <View>
                                        {aftersaleTypeIndex !== null ? (
                                            <Text className="form-item-value">{aftersaleTypeList[aftersaleTypeIndex!].label}</Text>
                                        ) : (
                                            <Text className="form-item-text">{t("请选择")}</Text>
                                        )}
                                    </View>
                                    <View className="form-item-icon">
                                        <Text className="iconfont-h5 icon-gengduo1" style="font-size: 21rpx; color: #999" />
                                    </View>
                                </View>
                            </Picker>
                        </View>

                        {afterSalesReasonEnabled && (
                            <View className="form-row">
                                <View className="form-row-label">{t("售后原因")}</View>
                                <Picker
                                    mode="selector"
                                    value={aftersaleReasonIndex ?? 0}
                                    range={aftersaleReasonList}
                                    onChange={getAftersaleReason}
                                >
                                    <View className="form-item-content">
                                        <View>
                                            {form.aftersaleReason ? (
                                                <Text className="form-item-value">{form.aftersaleReason}</Text>
                                            ) : (
                                                <Text className="form-item-text">{t("请选择")}</Text>
                                            )}
                                        </View>
                                        <View className="form-item-icon">
                                            <Text className="iconfont-h5 icon-gengduo1" style="font-size: 21rpx; color: #999" />
                                        </View>
                                    </View>
                                </Picker>
                            </View>
                        )}

                        <View className="form-row">
                            <View className="form-row-label">{t("问题描述")}</View>
                            <Textarea
                                className="form-textarea"
                                value={form.description}
                                maxlength={100}
                                autoHeight
                                placeholder={t("最多100字")}
                                placeholderStyle="font-size: 26rpx;text-align: end;"
                                onInput={(e) => patchForm({ description: e.detail.value })}
                            />
                        </View>

                        <View className="form-row form-row--upload">
                            <View className="form-row-label">{t("上传凭证")}</View>
                            <View className="upload-box">
                                <View className="upload-text">{t("最多上传5张图片")}</View>
                                <TigImageUpload
                                    limit={5}
                                    modelValue={fileLists}
                                    onModelValueChange={setFileLists}
                                    trigger="plus"
                                />
                            </View>
                        </View>
                    </View>

                    <View className="btn-fixed-placeholder">
                        <View className="after-sale-btn-box">
                            <View className="after-sale-btn" onClick={() => void handleSave()}>
                                {t("提交")}
                            </View>
                        </View>
                    </View>
                    <View className="btn-placeholder" />
                </View>
            )}
        </TigLayout>
    );
}