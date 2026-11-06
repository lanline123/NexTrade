import { useEffect, useState } from "react";
import { Swiper, SwiperItem, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import type { InvoiceAttachment } from "@/types/user/order";
import { useConfigStore } from "@/store/config";
import { downloadImage } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./imageView.scss";

/**
 * 发票图片预览（自旧 pages/user/invoiceManagement/src/imageView.vue 移植）
 * - 左右滑动查看发票图片
 * - 点击图片调用系统预览，底部支持下载图片
 */
export default function ImageView() {
    usePageGuards();

    const router = useRouter();
    const navHeight = useConfigStore((s) => s.navHeight);

    const [title, setTitle] = useState(1);
    const [current, setCurrent] = useState(0);
    const [fileList, setFileList] = useState<InvoiceAttachment[]>([]);

    // 旧 onLoad
    useEffect(() => {
        const options = (router.params || {}) as any;
        if (options && options.fileList) {
            setFileList(JSON.parse(decodeURIComponent(options.fileList)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleFinish = (e: any) => {
        setTitle(e.detail.current + 1);
        setCurrent(e.detail.current);
    };

    const previewImage = (index: number) => {
        Taro.previewImage({
            current: index as any,
            urls: fileList.map((item) => imageFormat(item.picUrl)),
            indicator: "number",
            loop: true
        } as any);
    };

    const handleDownload = () => {
        if (process.env.TARO_ENV === "h5") {
            downloadImage(fileList[current]?.picUrl || "");
        } else if (process.env.TARO_ENV === "weapp") {
            fileList.forEach((item) => {
                downloadImage(item.picUrl);
            });
        } else {
            // TODO(MIGRATION)：旧 #ifdef APP-PLUS 分支随 App 端批次接入，当前按小程序逻辑兜底
            fileList.forEach((item) => {
                downloadImage(item.picUrl);
            });
        }
    };

    return (
        <TigLayout title={`${title}/${fileList.length}`}>
            <View className="container" style={`height: calc(100vh - ${navHeight + 120}rpx)`}>
                <View className="image-view">
                    <Swiper className="swiper" indicatorDots={false} circular onAnimationFinish={handleFinish}>
                        {fileList.map((item, index) => (
                            <SwiperItem key={index}>
                                <View className="image-bg" style={{ backgroundImage: `url(${imageFormat(item.picUrl)})` }} onClick={() => previewImage(index)} />
                            </SwiperItem>
                        ))}
                    </Swiper>
                </View>
                {/* 旧 tig-fixed-placeholder（background #fff）→ 固定底栏 + 等高占位 */}
                <View className="btn-fixed-placeholder">
                    <View className="btn-box">
                        <TigButton2 className="btn" theme onClick={handleDownload}>
                            {t("下载图片")}
                        </TigButton2>
                    </View>
                </View>
                <View className="btn-placeholder" />
            </View>
        </TigLayout>
    );
}