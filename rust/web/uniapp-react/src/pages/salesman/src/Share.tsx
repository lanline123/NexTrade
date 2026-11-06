import { useEffect, useMemo, useState } from "react";
import Taro from "@tarojs/taro";

import { useConfigStore } from "@/store/config";

import SaveImageTextCard from "./SaveImageTextCard";
import ShareCard from "./ShareCard";
import ShareQrcode from "./ShareQrcode";
import { createQrcodePath } from "./qrcode";

interface Props {
    /** 对应旧 v-model:show-share-card */
    showShareCard?: boolean;
    currentData?: any;
    /** 对应旧 update:showShareCard */
    onChange?: (value: boolean) => void;
}

/**
 * 分享弹窗组件（自旧 pages/salesman/src/share.vue 移植）
 * - 提供多种分享方式选择
 * - 生成分享图片、二维码
 * - 复制分享链接
 */
export default function Share({ showShareCard = false, currentData = {}, onChange }: Props) {
    const h5Domain = useConfigStore((s) => s.baseInfo.h5Domain);
    const [showSaveImageTextCard, setShowSaveImageTextCard] = useState(false);
    const [showShareQrcode, setShowShareQrcode] = useState(false);
    const [qrcodePath, setQrcodePath] = useState("");

    const link = useMemo(() => {
        let domain = h5Domain;
        if (process.env.TARO_ENV === "h5") {
            domain = domain ? domain : `${window.location.origin}/mobile`;
        }
        const userInfo = Taro.getStorageSync("userInfo") || {};
        let url = `${domain}/pages/product/index?id=${currentData.productId}&salesmanId=${userInfo?.salesman?.salesmanId}`;
        // 优先使用商品所属店铺，兼容未返回该字段的旧接口。
        const shopId = currentData.shopId ?? currentData.salesmanProduct?.shopId;
        url += `&shopId=${shopId || 0}`;
        return url;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [h5Domain, currentData]);

    // 旧 tig-qrcode：弹层打开时绘制二维码并导出路径
    useEffect(() => {
        if (!showShareCard) return;
        let cancelled = false;
        void createQrcodePath(link).then((path) => {
            if (!cancelled && path) setQrcodePath(path);
        });
        return () => {
            cancelled = true;
        };
    }, [showShareCard, link]);

    const handleShowSaveImageTextCard = () => {
        onChange?.(false);
        setShowSaveImageTextCard(true);
    };

    const handleShowShareQrcode = () => {
        onChange?.(false);
        setShowShareQrcode(true);
    };

    return (
        <>
            <ShareCard
                modelValue={showShareCard}
                link={link}
                qrcodePath={qrcodePath}
                currentData={currentData}
                onChange={onChange}
                onShowSaveImageTextCard={handleShowSaveImageTextCard}
                onShowShareQrcode={handleShowShareQrcode}
            />
            <SaveImageTextCard modelValue={showSaveImageTextCard} currentData={currentData} onChange={setShowSaveImageTextCard} />
            <ShareQrcode modelValue={showShareQrcode} qrcodePath={qrcodePath} link={link} onChange={setShowShareQrcode} />
        </>
    );
}