import Taro from "@tarojs/taro";

import { getQrCode } from "@/api/common";

/**
 * 生成分享二维码（替代旧 components/tig/tig-qrcode 的本地 canvas 绘制）
 * 旧实现使用 uqrcodejs 前端绘制并导出 tempFilePath；目标项目未引入该依赖，
 * 这里改用后端 common/util/qrCode 生成图片，小程序端再下载成本地路径供 canvas 合成海报。
 * TODO(MIGRATION)：若后续需要与旧版完全一致的离线生成能力，再补 uqrcodejs 依赖与 TigQrcode 组件。
 */
export const createQrcodePath = async (value: string): Promise<string> => {
    try {
        const result: any = await getQrCode(value);
        const imageUrl = typeof result === "string" ? result : result?.url || "";
        if (!imageUrl) return "";
        if (process.env.TARO_ENV === "h5") return imageUrl;
        try {
            const res = await Taro.downloadFile({ url: imageUrl });
            if (res.statusCode === 200) return res.tempFilePath;
        } catch (error) {
            console.error(error);
        }
        return imageUrl;
    } catch (error) {
        console.error(error);
        return "";
    }
};