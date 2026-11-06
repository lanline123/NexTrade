import { useEffect, useRef, useState } from "react";
import { Canvas, Image, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import { getQrCode } from "@/api/common";
import { useConfigStore } from "@/store/config";
import { staticResource, getImageInfo } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { buildBuyerShowShareUrl } from "../utils/share";

import "./BuyerShowPoster.scss";

const CANVAS_ID = "buyerShowCanvas";

interface Props {
    modelValue: boolean;
    buyerShowId: string | number;
    buyerName?: string;
    buyerPhoto?: string;
    content?: string;
    cover?: string;
    onModelValueChange?: (value: boolean) => void;
}

/**
 * 海报布局常量（设计基准：屏宽 375，卡片 275×388）
 * 绘制时统一乘以 powerw，避免缩放与画布高度不一致导致底部大片留白。
 *
 * 版式：封面置顶；底部左列 [买家头像+买家名] 一行、内容多行，右侧二维码、下方保存提示。
 * 左列文字严格限制在二维码左侧，与二维码互不越界。
 */
const POSTER = {
    cardW: 275, // 卡片宽度（对应 550rpx）
    cardH: 388, // 卡片高度（对应 776rpx）：提示语下方仅留少量边距
    pad: 15, // 内边距
    coverY: 15, // 封面顶部（正方形 245，底部 = 15+245 = 260）
    rowY: 272, // 底部信息区顶部（买家头像与二维码同顶）
    avatarR: 12, // 买家头像半径
    titleY: 289, // 买家名基线（与头像竖直居中）
    contentY: 296, // 内容起始 y（首行基线 = 296+15 = 311）
    lineHeight: 15, // 内容行高（4 行底部 = 296+4*15 = 356）
    qrSize: 88, // 二维码边长（顶部 272，底部 = 272+88 = 360）
    tipY: 374 // “长按可保存海报”提示基线（二维码下方居中）
} as const;

/** 可单独成行的字符：中日韩文字与标点、全角字符，以及 emoji 等 BMP 外码点，字符之间都允许断行 */
const STANDALONE_CHAR = /[\u2E80-\u9FFF\u3000-\u303F\u3040-\u30FF\uAC00-\uD7AF\uFF00-\uFFEF]/;

/**
 * H5 端 CanvasContext 适配：Taro H5 没有小程序式的 CanvasContext，
 * 这里用原生 2D 上下文补齐旧代码使用的方法名，绘制逻辑保持逐行一致。
 */
const createH5Context = () => {
    if (typeof document === "undefined") return null;
    const el = document.getElementById(CANVAS_ID) as HTMLCanvasElement | null;
    if (!el) return null;
    const ctx = el.getContext("2d");
    if (!ctx) return null;
    if (!el.width || !el.height) {
        el.width = 550;
        el.height = 776;
    }
    const adapter: any = {
        setFillStyle: (value: string) => {
            ctx.fillStyle = value;
        },
        setFontSize: (size: number) => {
            ctx.font = `${size}px sans-serif`;
        },
        fillRect: (x: number, y: number, w: number, h: number) => ctx.fillRect(x, y, w, h),
        fillText: (text: string, x: number, y: number) => ctx.fillText(text, x, y),
        drawImage: (path: any, x: number, y: number, w: number, h: number) => {
            const src = typeof path === "string" ? path : path?.src;
            const image = new window.Image();
            image.crossOrigin = "anonymous";
            image.src = src;
            ctx.drawImage(image, x, y, w, h);
        },
        beginPath: () => ctx.beginPath(),
        arc: (x: number, y: number, r: number, start: number, end: number) => ctx.arc(x, y, r, start, end),
        clip: () => ctx.clip(),
        save: () => ctx.save(),
        restore: () => ctx.restore(),
        measureText: (text: string) => ({ width: ctx.measureText(text).width }),
        draw: (_reserve?: any, callback?: () => void) => {
            callback?.();
        }
    };
    return adapter;
};

/**
 * 买家秀海报（自旧 components/buyerShowPoster.vue 移植）
 * - 离屏 canvas 绘制封面、头像、正文、二维码
 * - 旧 tig-popup → NutUI Popup（center + 透明背景 + 无关闭按钮）
 *
 * TODO(MIGRATION)：H5 端 canvasToTempFilePath 由 canvas.toDataURL 兜底；App 端（plus）保存相册随 App 批次补。
 */
export default function BuyerShowPoster({ modelValue, buyerShowId, buyerName, buyerPhoto, content, cover, onModelValueChange }: Props) {
    const [qrImg, setQrImg] = useState("");
    const [show, setShow] = useState(false);
    const [powerw, setPowerw] = useState(0);
    const [img, setImg] = useState("");
    const powerwRef = useRef(0);
    const qrImgRef = useRef("");
    const initedRef = useRef(false);

    const emitModelValue = (value: boolean) => {
        onModelValueChange?.(value);
    };

    /**
     * 提示失败并关闭海报弹层，避免任一环节失败后停在空白等待态
     */
    const handlePosterFail = (error: unknown, title: string) => {
        console.error(error);
        Taro.showToast({
            title,
            icon: "none",
            duration: 3000
        });
        setShow(false);
        emitModelValue(false);
    };

    /**
     * 生成买家秀分享二维码（扫码进入 H5 买家秀详情页）
     * @returns 二维码是否就绪
     */
    const getQrCodeAsync = async (): Promise<boolean> => {
        const h5Domain = useConfigStore.getState().baseInfo.h5Domain || "";
        const shareUrl = buildBuyerShowShareUrl(buyerShowId, h5Domain);
        if (!shareUrl) {
            Taro.showToast({ title: t("未配置分享域名"), icon: "none" });
            return false;
        }
        try {
            const result = await getQrCode(shareUrl);
            if (!result) {
                Taro.showToast({ title: t("海报生成失败"), icon: "none" });
                return false;
            }
            qrImgRef.current = result;
            setQrImg(result);
            Taro.showToast({
                title: t("正在生成海报，请稍后"),
                icon: "none",
                duration: 1000
            });
            return true;
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error?.message || t("海报生成失败"),
                icon: "none"
            });
            return false;
        }
    };

    useEffect(() => {
        if (initedRef.current) return;
        initedRef.current = true;
        void (async () => {
            const { windowWidth } = Taro.getSystemInfoSync();
            const ratio = windowWidth / 375;
            powerwRef.current = ratio;
            setPowerw(ratio);
            const ready = await getQrCodeAsync();
            if (!ready) {
                emitModelValue(false);
                return;
            }
            await generatePoster();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * canvas 绘制回调 Promise 化，保证每步失败都能被外层 try 捕获
     */
    const drawAsync = (context: any, reserve = true): Promise<void> => {
        return new Promise((resolve) => {
            context.draw(reserve, () => resolve());
        });
    };

    // 封装 measureText 方法，统一返回 Promise（兼容 H5 / 小程序返回形态差异）
    const measureTextAsync = (canvas: any, text: string): Promise<{ width: number }> => {
        return new Promise((resolve) => {
            const result = canvas.measureText(text);
            if (result instanceof Promise) {
                result.then(resolve);
            } else {
                resolve(result);
            }
        });
    };

    // 单行文本按最大宽度截断并追加省略号（用于昵称等）
    const ellipsisText = async (canvas: any, text: string, maxWidth: number, ellipsis = "…") => {
        if (!text) return "";
        if (maxWidth <= 0) return "";

        const full = await measureTextAsync(canvas, text);
        if (full.width <= maxWidth) return text;

        const ell = await measureTextAsync(canvas, ellipsis);
        if (ell.width >= maxWidth) return "";

        let left = 0;
        let right = text.length;
        while (left < right) {
            const mid = Math.ceil((left + right) / 2);
            const sub = text.slice(0, mid);
            const w = await measureTextAsync(canvas, sub);
            if (w.width + ell.width <= maxWidth) {
                left = mid;
            } else {
                right = mid - 1;
            }
        }

        return text.slice(0, left) + ellipsis;
    };

    /**
     * 按字符本身切分可断行词元：上述字符逐个成词，空格与换行单独成词，其余（拉丁字母、数字、
     * 半角标点）聚合成整词，避免把 "amazing," 的逗号甩到下一行行首。
     *
     * 不能按界面语种决定切分方式：买家秀正文语种与界面语种互相独立，
     * 英文界面下按空格切分中文正文会把整段正文当成一个词元，换行判断随之失效。
     */
    const tokenizeForWrap = (text: string): string[] => {
        const tokens: string[] = [];
        let word = "";
        const flushWord = () => {
            if (word) {
                tokens.push(word);
                word = "";
            }
        };
        for (const char of Array.from(text)) {
            if (char === "\n" || char === "\r") {
                flushWord();
                tokens.push("\n");
            } else if (char === " " || STANDALONE_CHAR.test(char) || char.codePointAt(0)! > 0xffff) {
                flushWord();
                tokens.push(char);
            } else {
                word += char;
            }
        }
        flushWord();
        return tokens;
    };

    // 买家秀内容文字换行（按像素宽度换行，避免文字超出限定宽度压到二维码）
    const drawText = async (text: string, x: number, y: number, canvas: any, maxWidth: number, fontSize: number, lineHeight: number) => {
        if (!text) return;
        const maxLines = 4;
        const ellipsis = "...";

        canvas.setFontSize(fontSize);

        const queue = tokenizeForWrap(text);
        let lines: string[] = [];
        let currentLine = "";
        for (let i = 0; i < queue.length; i++) {
            // 已排满可见行数，后续内容一律会被省略号截掉，无需继续测量
            if (lines.length > maxLines) break;

            const token = queue[i];
            if (token === "\n") {
                // 连续换行只断一行，避免空行白白占用有限的行数
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = "";
                }
                continue;
            }
            // 行首空格丢弃，避免换行后出现缩进
            if (!currentLine && token === " ") continue;

            const testLine = currentLine + token;
            if ((await measureTextAsync(canvas, testLine)).width <= maxWidth) {
                currentLine = testLine;
                continue;
            }
            if (currentLine) {
                // 放不下则换行，当前词元退回队列在下一行重新处理
                lines.push(currentLine);
                currentLine = "";
                i--;
                continue;
            }
            // 行首就放不下的超长词元（长英文单词、链接）：拆成单字重新入队硬断
            const chars = Array.from(token);
            if (chars.length > 1) {
                queue.splice(i, 1, ...chars);
                i--;
                continue;
            }
            // 单字仍超宽，只能让它溢出，否则会死循环
            currentLine = token;
        }
        if (currentLine && lines.length <= maxLines) lines.push(currentLine);

        // 超出最大行数：截断并在最后一行追加省略号（保证省略号后仍不超宽）
        if (lines.length > maxLines) {
            lines = lines.slice(0, maxLines);
            // 按字符而非码元回退，买家秀正文常含 emoji，按码元切会留下半个代理对
            const lastChars = Array.from(lines[maxLines - 1]);
            while (lastChars.length && (await measureTextAsync(canvas, lastChars.join("") + ellipsis)).width > maxWidth) {
                lastChars.pop();
            }
            lines[maxLines - 1] = lastChars.join("") + ellipsis;
        }

        lines.forEach((line) => {
            y += lineHeight;
            canvas.setFontSize(fontSize);
            canvas.setFillStyle("#333333");
            canvas.fillText(line, x, y);
        });
    };

    // 生成海报
    const generatePoster = async () => {
        let context: any = null;
        if (process.env.TARO_ENV === "h5") {
            context = createH5Context();
        } else {
            context = (Taro as any).createCanvasContext(CANVAS_ID);
        }
        if (!context) {
            handlePosterFail(new Error("canvas not ready"), t("海报生成失败"));
            return;
        }
        context.draw();
        context.save();
        // ===== 统一按 powerw 缩放的布局坐标（设计基于 375 宽，卡片 275×388）=====
        const P = powerwRef.current;
        const pad = POSTER.pad * P; // 左右内边距
        const cardW = POSTER.cardW * P; // 卡片宽度（= canvas 可绘制宽度）
        const cardH = POSTER.cardH * P; // 卡片高度（= canvas 可绘制高度）
        const avatarR = POSTER.avatarR * P; // 买家头像半径
        const qrSize = POSTER.qrSize * P; // 二维码边长
        const qrX = cardW - pad - qrSize; // 二维码左边缘
        const qrY = POSTER.rowY * P; // 二维码顶部（与买家头像同顶）
        const coverY = POSTER.coverY * P; // 封面顶部（置顶）
        const coverSize = cardW - pad * 2; // 封面正方形边长
        const textX = pad; // 左列文字边距
        const textMaxWidth = qrX - textX - 8 * P; // 左列文字最大宽度（严格避开二维码）

        context.setFillStyle("#ffffff");
        context.fillRect(0, 0, cardW, cardH);
        context.draw();
        // 底部左列首行：买家名（头像右侧，与头像竖直居中）
        const titleX = textX + avatarR * 2 + 8 * P;
        const titleText = buyerName || t("买家秀");
        context.setFontSize(14 * P);
        context.setFillStyle("#000000");
        const titleEllipsis = await ellipsisText(context, titleText, Math.max(0, qrX - titleX - 8 * P));
        context.fillText(titleEllipsis, titleX, POSTER.titleY * P);
        // 左列内容：买家秀文字内容（限制在二维码左侧，互不越界）
        await drawText(String(content || ""), textX, POSTER.contentY * P, context, textMaxWidth, 11 * P, POSTER.lineHeight * P);
        // 二维码下方提示（居中于二维码正下方）
        context.setFontSize(10 * P);
        context.setFillStyle("#999999");
        // 英文译文比中文长得多，先按卡片可用宽度收敛，再把居中位置夹回边距内，避免被卡片右边缘裁掉
        const tipText = await ellipsisText(context, t("长按可保存海报"), cardW - pad * 2);
        const tipWidth = (await measureTextAsync(context, tipText)).width;
        const tipX = Math.min(Math.max(pad, qrX + qrSize / 2 - tipWidth / 2), cardW - pad - tipWidth);
        context.fillText(tipText, tipX, POSTER.tipY * P);
        context.save();
        try {
            // 买家头像（参考稿：底部信息区左上，与买家名同行）
            const avatarRes = await getImageInfo(buyerPhoto ? imageFormat(buyerPhoto) : staticResource("user/default_avatar.jpg"));
            const avatarCenterX = textX + avatarR;
            const avatarCenterY = POSTER.rowY * P + avatarR;

            context.beginPath();
            context.arc(avatarCenterX, avatarCenterY, avatarR, 0, 2 * Math.PI);
            context.clip();
            context.drawImage(avatarRes.path, avatarCenterX - avatarR, avatarCenterY - avatarR, avatarR * 2, avatarR * 2);
            context.restore();
            await drawAsync(context);

            context.save();
            // 视频首帧 / 图片封面
            const coverSrc = cover ? imageFormat(cover) : staticResource("user/default_avatar.jpg");
            const picRes = await getImageInfo(coverSrc);
            context.drawImage(picRes.path, pad, coverY, coverSize, coverSize);
            await drawAsync(context);

            // 绘制二维码
            if (process.env.TARO_ENV === "weapp") {
                const codeimg = await writeQrCodeFile(qrImgRef.current.slice(22));
                context.drawImage(codeimg, qrX, qrY, qrSize, qrSize);
            } else {
                context.drawImage(qrImgRef.current, qrX, qrY, qrSize, qrSize);
            }
            await drawAsync(context);

            await saveToImg();
        } catch (error) {
            handlePosterFail(error, t("海报生成失败"));
        }
    };

    /**
     * 二维码 base64 落盘为临时文件，小程序 canvas 只能绘制本地路径
     */
    const writeQrCodeFile = (base64: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const wxAny = (globalThis as any).wx;
            const filePath = `${wxAny?.env?.USER_DATA_PATH}/${Date.now()}.png`;
            Taro.getFileSystemManager().writeFile({
                filePath,
                data: base64,
                encoding: "base64" as any,
                success: () => resolve(filePath),
                fail: (err: any) => reject(err)
            });
        });
    };

    const saveToImg = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (process.env.TARO_ENV === "h5") {
                const el = document.getElementById(CANVAS_ID) as HTMLCanvasElement | null;
                if (!el) {
                    reject(new Error("canvas not found"));
                    return;
                }
                const dataUrl = el.toDataURL("image/jpeg", 1);
                setImg(dataUrl);
                setShow(true);
                resolve();
                return;
            }
            (Taro as any).canvasToTempFilePath(
                {
                    fileType: "jpg",
                    canvasId: CANVAS_ID,
                    quality: 1,
                    success: function (res: any) {
                        setImg(res.tempFilePath);
                        setShow(true);
                        resolve();
                    },
                    fail: (err: any) => {
                        reject(err);
                    }
                },
                undefined
            );
        });
    };

    const handleSave = () => {
        if (process.env.TARO_ENV !== "weapp") return;
        Taro.saveImageToPhotosAlbum({
            filePath: img,
            success: function () {
                Taro.showToast({
                    title: t("保存海报成功"),
                    icon: "none",
                    duration: 1500
                });
                setTimeout(() => {
                    emitModelValue(false);
                }, 1500);
            },
            fail: function (err) {
                console.error(err);
                Taro.showToast({
                    title: t("保存海报失败"),
                    icon: "none",
                    duration: 3000
                });
            }
        } as any).catch(() => {});
    };

    void powerw;
    void qrImg;

    return (
        <View>
            {/* 生成海报的 canvas（离屏绘制） */}
            <Canvas id={CANVAS_ID} canvasId={CANVAS_ID} className="canvas-content" />
            <Popup
                visible={modelValue && show}
                position="center"
                closeable={false}
                onClose={() => emitModelValue(false)}
                style={{ backgroundColor: "transparent" }}
            >
                <View
                    className="poster-box"
                    onTouchMove={(event) => {
                        event.stopPropagation();
                        (event as any).preventDefault?.();
                    }}
                    onLongPress={(event) => {
                        event.stopPropagation();
                        handleSave();
                    }}
                >
                    <Image src={img} style={{ height: "100%", width: "100%" }} />
                </View>
            </Popup>
        </View>
    );
}