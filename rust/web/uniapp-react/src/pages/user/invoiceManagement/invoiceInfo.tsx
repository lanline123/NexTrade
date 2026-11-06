import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import type { InvoiceAttachment } from "@/types/user/order";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./invoiceInfo.scss";

/**
 * 发票详情页（自旧 pages/user/invoiceManagement/invoiceInfo.vue 移植）
 * - 展示发票审核状态、开票金额、订单编号
 * - 显示发票抬头信息（普通/增值税专用）
 * - 已开票发票支持预览图片
 * - 提供重新申请入口
 */
export default function InvoiceInfo() {
    usePageGuards();

    const router = useRouter();

    const [invoiceData, setInvoiceData] = useState<any>({});
    const [filePicList, setFilePicList] = useState<InvoiceAttachment[]>([]);

    // 旧 onLoad：解析列表页传入的发票 JSON
    useEffect(() => {
        const options = (router.params || {}) as any;
        if (options && options.invoiceData) {
            const data = JSON.parse(decodeURIComponent(options.invoiceData));
            setInvoiceData(data);
            if (data?.invoiceAttachment?.length) {
                setFilePicList(data.invoiceAttachment);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fileListNum = filePicList.length;

    const formatText = (() => {
        switch (invoiceData.status) {
            case 0:
                return t("待审核");
            case 1:
                return t("通过");
            default:
                return t("失败/作废");
        }
    })();

    const onSubmit = () => {
        Taro.redirectTo({
            url: "/pages/user/invoiceManagement/applyInvoice?type=update&orderId=" + invoiceData.orderId
        });
    };

    const toImages = () => {
        const fileList = encodeURIComponent(JSON.stringify(filePicList));
        Taro.navigateTo({
            url: "/pages/user/invoiceManagement/imageView?fileList=" + fileList
        });
    };

    return (
        <TigLayout title={t("发票详情")}>
            <View className="invoiceInfo">
                <View className="invoiceInfo-status">
                    <View className="">{t("审核状态")}：</View>
                    <View className="special-text">{formatText}</View>
                </View>
                <View className="invoiceInfo-content">
                    <View className="invoiceInfo-content-item">
                        <View className="item-label">{t("开票金额")}</View>
                        <View className="item-value">
                            <FormatPrice showText={false} isBottom={false} priceData={invoiceData.amount} />
                        </View>
                    </View>
                    <View className="invoiceInfo-content-item">
                        <View className="item-label">{t("订单编号")}</View>
                        <View className="item-value"> {invoiceData.orderSn}</View>
                    </View>
                    {invoiceData.invoiceType == 1 ? (
                        <>
                            <View className="invoiceInfo-content-item">
                                <View className="item-label">{t("发票抬头")}</View>
                                <View className="item-value">{invoiceData.titleType == 1 ? t("个人") : t("企业")}</View>
                            </View>
                            <View className="invoiceInfo-content-item">
                                <View className="item-label">{invoiceData.titleType == 1 ? t("个人姓名") : t("企业名称")}</View>
                                <View className="item-value">{invoiceData.companyName}</View>
                            </View>
                            {invoiceData.applyReply && invoiceData.status === 2 ? (
                                <View className="invoiceInfo-content-item">
                                    <View className="item-label">{t("驳回原因")}</View>
                                    <View className="item-value">{invoiceData.applyReply}</View>
                                </View>
                            ) : null}
                            {invoiceData.titleType == 2 ? (
                                <>
                                    <View className="invoiceInfo-content-item">
                                        <View className="item-label">{t("单位名称")}</View>
                                        <View className="item-value">{invoiceData.companyName}</View>
                                    </View>
                                    <View className="invoiceInfo-content-item">
                                        <View className="item-label">{t("纳税人识号")}</View>
                                        <View className="item-value">{invoiceData.companyCode}</View>
                                    </View>
                                    <View className="invoiceInfo-content-item">
                                        <View className="item-label">{t("单位地址")}</View>
                                        <View className="item-value">{invoiceData.companyAddress}</View>
                                    </View>
                                    <View className="invoiceInfo-content-item">
                                        <View className="item-label">{t("单位电话")}</View>
                                        <View className="item-value">{invoiceData.companyPhone}</View>
                                    </View>
                                    <View className="invoiceInfo-content-item">
                                        <View className="item-label">{t("开户银行")}</View>
                                        <View className="item-value">{invoiceData.companyBank}</View>
                                    </View>
                                    <View className="invoiceInfo-content-item">
                                        <View className="item-label">{t("银行账户")}</View>
                                        <View className="item-value">{invoiceData.companyAccount}</View>
                                    </View>
                                </>
                            ) : null}
                        </>
                    ) : null}
                    {invoiceData.invoiceType == 2 ? (
                        <>
                            <View className="invoiceInfo-content-item">
                                <View className="item-label">{t("单位名称")}</View>
                                <View className="item-value">{invoiceData.companyName}</View>
                            </View>
                            <View className="invoiceInfo-content-item">
                                <View className="item-label">{t("纳税识别码")}</View>
                                <View className="item-value">{invoiceData.companyCode}</View>
                            </View>
                            <View className="invoiceInfo-content-item">
                                <View className="item-label">{t("注册地址")}</View>
                                <View className="item-value">{invoiceData.companyAddress}</View>
                            </View>
                            <View className="invoiceInfo-content-item">
                                <View className="item-label">{t("注册电话")}</View>
                                <View className="item-value">{invoiceData.companyPhone}</View>
                            </View>
                            <View className="invoiceInfo-content-item">
                                <View className="item-label">{t("开户银行")}</View>
                                <View className="item-value">{invoiceData.companyBank}</View>
                            </View>
                            <View className="invoiceInfo-content-item">
                                <View className="item-label">{t("银行账户")}</View>
                                <View className="item-value">{invoiceData.companyAccount}</View>
                            </View>
                            {filePicList.length && invoiceData?.status == 1 ? (
                                <View className="invoiceInfo-content-item">
                                    <View className="item-label">{t("发票预览")}</View>
                                    <View className="image-box">
                                        <View className="image" onClick={toImages}>
                                            <View className="image-bg" style={{ backgroundImage: `url(${imageFormat(filePicList[0].picThumb)})` }} />
                                            <View className="img-num">{t("共{0}张", { 0: fileListNum })}</View>
                                        </View>
                                        <View className="img-tip">{t("点击预览发票")}</View>
                                    </View>
                                </View>
                            ) : null}
                        </>
                    ) : null}
                    {invoiceData.invoiceType == 1 ? (
                        <>
                            {invoiceData.invoicingTime ? (
                                <View className="invoiceInfo-content-item">
                                    <View className="item-label">{t("申请时间")}</View>
                                    <View className="item-value">{invoiceData.invoicingTime}</View>
                                </View>
                            ) : null}
                            {invoiceData.addTime ? (
                                <View className="invoiceInfo-content-item">
                                    <View className="item-label">{t("开票时间")}</View>
                                    <View className="item-value">{invoiceData.addTime}</View>
                                </View>
                            ) : null}
                            {filePicList.length && invoiceData?.status == 1 ? (
                                <View className="invoiceInfo-content-item">
                                    <View className="item-label">{t("发票预览")}</View>
                                    <View className="image-box">
                                        <View className="image" onClick={toImages}>
                                            <View className="image-bg" style={{ backgroundImage: `url(${imageFormat(filePicList[0].picThumb)})` }} />
                                            <View className="img-num">{t("共{0}张", { 0: fileListNum })}</View>
                                        </View>
                                        <View className="img-tip">{t("点击预览发票")}</View>
                                    </View>
                                </View>
                            ) : null}
                        </>
                    ) : null}
                </View>

                {/* 旧 tig-fixed-placeholder（background #fff）→ 固定底栏 + 等高占位 */}
                <View className="btn-fixed-placeholder">
                    <View className="btn-box">
                        <TigButton2 className="btn" theme onClick={onSubmit}>
                            {t("重新申请")}
                        </TigButton2>
                    </View>
                </View>
                <View className="btn-placeholder" />
            </View>
        </TigLayout>
    );
}