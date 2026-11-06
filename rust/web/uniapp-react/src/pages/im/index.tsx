import { useEffect, useRef, useState } from "react";
import { Image, Input, ScrollView, Text, Video, View } from "@tarojs/components";
import Taro, { useRouter, useUnload } from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigImage from "@/components/tig/tig-image/TigImage";
import { getConversationMessage, sendMessage, setRead } from "@/api/im/im";
import { getProductDetail } from "@/api/product/product";
import { getShopDetail } from "@/api/shop/shop";
import { getOrder } from "@/api/user/order";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { useUserStore } from "@/store/user";
import { getElementRect, isJsonString, isOverseas, staticResource } from "@/utils";
import { imageFormat, pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";
import { baseUrl, getSecret } from "@/utils/request";
import WebSocketClient from "@/utils/websocket";

import Emoji from "./src/Emoji";
import EmojiHtml from "./src/EmojiHtml";
import PromptTone, { type PromptToneRef } from "./src/PromptTone";

import "./index.scss";

type AnyObject = Record<string, any>;

/**
 * 聊天详情页（自旧 pages/im/index.vue 逐行移植）
 * - 与客服/商家实时聊天
 * - WebSocket 实时消息收发（复用 utils/websocket.ts，内部为 Taro.connectSocket）
 * - 支持文字、图片、表情、视频、商品卡片
 */
export default function ImIndex() {
    usePageGuards();

    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    void langCode;

    const router = useRouter();

    const baseInfo = useConfigStore((s) => s.baseInfo);
    const menuButtonInfo = useConfigStore((s) => s.menuButtonInfo);
    const safeAreaInsets = useConfigStore((s) => s.safeAreaInsets);
    const userInfo = useUserStore((s) => s.userInfo);

    // 旧 reactive filterParams：与各请求共享同一份对象并原地改写
    const filterParamsRef = useRef<AnyObject>({
        firstId: -1,
        sortOrder: "desc",
        userFrom: "",
        shopId: 0
    });
    const filterParams = filterParamsRef.current;

    const [messageList, setMessageList] = useState<any[]>([]);
    // 镜像列表，供 websocket / 触底等异步闭包读取最新值（避免 React 陈旧闭包）
    const messageListRef = useRef<any[]>([]);
    const updateMessageList = (next: any[]) => {
        messageListRef.current = next;
        setMessageList(next);
    };

    const [textAreaValue, setTextAreaValue] = useState<string>("");
    // 旧 v-model 直接读写 ref，表情面板连续点击时用 ref 追加，避免 React 状态批处理丢字符
    const textAreaValueRef = useRef<string>("");
    const updateTextAreaValue = (next: string) => {
        textAreaValueRef.current = next;
        setTextAreaValue(next);
    };
    const [hasTxt, setHasTxt] = useState<boolean>(false);
    const [moreHandle, setMoreHandle] = useState<boolean>(false);
    const [moreEmoji, setMoreEmoji] = useState<boolean>(false);
    // 旧 reactive(new Set<object>())：全屏播放中的视频（按消息 key 记录）
    const [fullscreenVideos, setFullscreenVideos] = useState<string[]>([]);
    const [loadend, setLoadend] = useState<boolean>(false);
    const [scrollTop, setScrollTop] = useState(0);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [showKeyboard, setShowKeyboard] = useState(false);
    const [enteringKeys, setEnteringKeys] = useState<string[]>([]);
    const [shopInfo, setShopInfo] = useState<any>({});
    const [platform, setPlatform] = useState("");
    const [triggerSetReadStatus, setTriggerSetReadStatus] = useState(false);

    const isRecordRef = useRef<boolean>(true);
    const lastScrollTopRef = useRef<number>(0);
    const messageScrollHeightRef = useRef(0);
    const messageBoxHeightRef = useRef(0);
    const promptToneRef = useRef<PromptToneRef>(null);
    const wsRef = useRef<WebSocketClient | null>(null);

    // 记录需要播放入场动画的消息，动画结束后移除，避免列表重渲染时反复播放
    const markMessageEnter = (key: string) => {
        if (!key) return;
        setEnteringKeys((prev) => [...prev, key]);
        setTimeout(() => {
            setEnteringKeys((prev) => prev.filter((item) => item !== key));
        }, 320);
    };

    const returnFun = () => {
        if (process.env.TARO_ENV === "h5") {
            history.back();
            return;
        }
        Taro.navigateBack();
    };

    const getMessageScrollHeight = async () => {
        try {
            const result = await getElementRect(".message-scroll");
            messageScrollHeightRef.current = result!.height;
        } catch (error) {
            console.error("Error getting box info:", error);
        }
    };
    const getMessageBoxHeight = async () => {
        try {
            const result = await getElementRect(".message-box");
            messageBoxHeightRef.current = result!.height;
        } catch (error) {
            console.error("Error getting box info:", error);
        }
    };

    const scrollToBottom = async () => {
        await getMessageBoxHeight();
        await getMessageScrollHeight();
        if (messageScrollHeightRef.current && messageBoxHeightRef.current) {
            const top = messageBoxHeightRef.current - messageScrollHeightRef.current;
            if (top && top > 0) {
                setScrollTop(top);
            }
        }
    };

    const handleSetRead = () => {
        const list = messageListRef.current;
        const last = list[list.length - 1];
        // 迁移说明：旧实现直接取末项，空列表会抛错，这里补空数组保护（不影响原逻辑）
        if (!last) return;
        if (last.isRead === 0 && last.type === 2 && !triggerSetReadStatus) {
            void setReadStatus();
        }
    };

    const handleScroll = (event: any) => {
        handleSetRead();
        if (isRecordRef.current) {
            lastScrollTopRef.current = scrollTop;
            isRecordRef.current = false;
        }
        if (event.detail.scrollTop == 0 && loadend == false && messageListRef.current.length > 0) {
            const firstSentMessage = messageListRef.current.find((item: any) => !item.localPending);
            if (!firstSentMessage) return;
            filterParams.firstId = firstSentMessage.id;
            void _getConversationMessage();
        }
    };

    // 监听实时输入事件
    const onInput = (value: string) => {
        setHasTxt(value.length > 0 ? true : false);
    };

    // 旧 computed adjustPosition：#ifdef MP-WEIXIN 为 false，其余端 true
    const adjustPosition = process.env.TARO_ENV !== "weapp";

    const handleKeyboardheightchange = (e: any) => {
        if (process.env.TARO_ENV === "weapp") {
            setKeyboardHeight(e.detail.height);
            console.log("handleKeyboardheightchange", e.detail.height);
        }
    };

    const onFocus = () => {
        setShowKeyboard(true);
        setMoreEmoji(false);
        setMoreHandle(false);
    };
    const onInsertEmoji = (emoji: string) => {
        const next = textAreaValueRef.current + "[" + emoji + "]";
        updateTextAreaValue(next);
        if (process.env.TARO_ENV === "weapp" || process.env.TARO_ENV === "h5") {
            setHasTxt(next.length > 0 ? true : false);
        }
    };
    const mediaExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".mp4"];

    const isVideoFile = (file: any) => {
        const type = file?.type || "";
        if (type === "video" || type.indexOf("video/") === 0) return true;
        const path = file?.name || file?.url || "";
        return /\.(mp4|mov|m4v|3gp|avi)$/i.test(path);
    };

    // 图片与视频共用同一个入口，按文件类型分派到各自的上传逻辑
    const dispatchMediaFile = (file: any) => {
        if (!file?.url) return;
        if (isVideoFile(file)) {
            uploadVideoFile(file);
        } else {
            uploadFile(file);
        }
    };

    const chooseImageFile = () => {
        Taro.chooseImage({
            count: 1
        })
            .then((res: any) => {
                const paths = res.tempFilePaths || [];
                const files = res.tempFiles || [];
                files.forEach((item: any, index: number) => {
                    dispatchMediaFile({
                        url: item.path || paths[index],
                        size: item.size,
                        name: item.name,
                        type: "image"
                    });
                });
            })
            .catch(() => {});
    };

    const chooseVideoFile = () => {
        Taro.chooseVideo({
            sourceType: ["album", "camera"]
        })
            .then((res: any) => {
                dispatchMediaFile({
                    url: res.tempFilePath,
                    size: res.size,
                    thumb: res.thumbTempFilePath || "",
                    type: "video"
                });
            })
            .catch(() => {});
    };

    // 各端可用的选择能力不同，微信可一次性混选，其余端先让用户选类型
    const chooseMediaFile = () => {
        if (process.env.TARO_ENV === "weapp") {
            Taro.chooseMedia({
                count: 1,
                mediaType: ["image", "video"]
            })
                .then((res: any) => {
                    (res.tempFiles || []).forEach((item: any) => {
                        dispatchMediaFile({
                            url: item.tempFilePath,
                            size: item.size,
                            thumb: item.thumbTempFilePath || "",
                            type: item.fileType
                        });
                    });
                })
                .catch(() => {});
            return;
        }

        // TODO(MIGRATION)：Taro 无 uni.chooseFile 对位 API；H5 改为系统 actionSheet 后走 chooseImage / chooseVideo（旧 H5 混合选择的扩展名过滤 mediaExtensions 暂由选择器承担）
        void mediaExtensions;
        Taro.showActionSheet({
            itemList: [t("照片"), t("视频")]
        })
            .then((res: any) => {
                if (res.tapIndex === 0) {
                    chooseImageFile();
                } else {
                    chooseVideoFile();
                }
            })
            .catch(() => {});
    };

    const uploadFile = (filePath: any) => {
        Taro.uploadFile({
            url: baseUrl + process.env.TARO_APP_API_PREFIX + "user/user/uploadImg",
            filePath: filePath.url,
            name: "file",
            header: {
                Authorization: Taro.getStorageSync("token"),
                Secret: getSecret()
            },
            success: (uploadFileRes: any) => {
                const { data } = JSON.parse(uploadFileRes.data);
                void handleSendMessage("image", { pic: data.picUrl });
            },
            fail: (error) => {
                console.log("error", error);
                void Taro.showToast({
                    title: t("图片上传失败"),
                    icon: "none"
                });
            }
        } as any);
    };

    // 查找占位消息在列表中的位置
    const findPendingIndex = (key: string) => {
        return messageListRef.current.findIndex((item: any) => item.localKey === key);
    };

    // 移除占位消息
    const removePendingMessage = (key: string) => {
        updateMessageList(messageListRef.current.filter((item: any) => item.localKey !== key));
    };

    // 更新占位消息的运行态字段
    const updatePendingMessage = (key: string, patch: Record<string, any>) => {
        const index = findPendingIndex(key);
        if (index === -1) return;
        const list = [...messageListRef.current];
        list[index] = { ...list[index], ...patch };
        updateMessageList(list);
    };

    // 发送时间按会话内已有消息的格式展示
    const formatSendTime = () => {
        const now = new Date();
        const pad = (value: number) => String(value).padStart(2, "0");
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    };

    // 插入一条发送中的视频占位消息
    const pushPendingVideoMessage = (key: string, cover: string) => {
        updateMessageList([
            ...messageListRef.current,
            {
                id: key,
                localKey: key,
                localPending: true,
                localPercent: 0,
                localProcessing: false,
                localCover: cover || "",
                type: 1,
                messageType: "video",
                sendTime: formatSendTime(),
                user: { avatar: userInfo?.avatar || "" },
                isRead: 0,
                content: {}
            }
        ]);
        markMessageEnter(key);
        Taro.nextTick(() => {
            void scrollToBottom();
        });
    };

    const uploadVideoFile = (filePath: any) => {
        if (filePath?.size && filePath.size / 1024 / 1024 > 50) {
            void Taro.showToast({ title: t("只能上传50M以内的视频"), icon: "none" });
            return;
        }

        const key = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        pushPendingVideoMessage(key, filePath?.thumb || "");

        let completed = false;
        let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
        const failPendingVideo = (message?: string) => {
            removePendingMessage(key);
            void Taro.showToast({ title: message || t("视频上传失败"), icon: "none" });
        };

        const uploadTask: any = Taro.uploadFile({
            url: baseUrl + process.env.TARO_APP_API_PREFIX + "user/user/uploadVideo",
            filePath: filePath.url,
            name: "file",
            header: {
                Authorization: Taro.getStorageSync("token"),
                Secret: getSecret()
            },
            success: (uploadFileRes: any) => {
                if (completed) return;
                completed = true;
                if (timeoutTimer) clearTimeout(timeoutTimer);

                try {
                    if (uploadFileRes.statusCode && (uploadFileRes.statusCode < 200 || uploadFileRes.statusCode >= 300)) {
                        throw new Error(t("视频上传失败"));
                    }
                    const result = JSON.parse(uploadFileRes.data || "null");
                    if (result?.code !== 0 || !result?.data?.videoUrl) {
                        failPendingVideo(result?.message);
                        return;
                    }
                    updatePendingMessage(key, { localPercent: 95, localProcessing: true });
                    void handleSendMessage("video", { videoUrl: result.data.videoUrl, videoCover: result.data.videoCover }, key);
                } catch (error) {
                    console.error("视频上传响应解析失败:", error, uploadFileRes.data);
                    failPendingVideo();
                }
            },
            fail: (error) => {
                if (completed) return;
                completed = true;
                if (timeoutTimer) clearTimeout(timeoutTimer);
                console.log("error", error);
                failPendingVideo();
            }
        } as any);

        timeoutTimer = setTimeout(() => {
            if (completed) return;
            completed = true;
            uploadTask?.abort?.();
            failPendingVideo(t("视频上传超时，请重试"));
        }, 60000);

        uploadTask?.onProgressUpdate?.((res: any) => {
            // progress 只统计字节推送，服务端接收处理和消息发送不在其中，压到 95% 以内留给后续阶段
            const pushedPercent = res.progress || 0;
            if (pushedPercent >= 100) {
                updatePendingMessage(key, { localPercent: 95, localProcessing: true });
            } else {
                updatePendingMessage(key, { localPercent: Math.min(95, Math.round(pushedPercent * 0.95)) });
            }
        });
    };

    const sendTxt = () => {
        if (!textAreaValueRef.current) return;
        void handleSendMessage();
    };
    const sendGoods = (product: any) => {
        void handleSendMessage("custom", { product });
    };

    const showMoreHandle = () => {
        void Taro.hideKeyboard();
        setMoreHandle(!moreHandle);
        setMoreEmoji(false);

        Taro.nextTick(() => {
            void scrollToBottom();
        });
    };
    const showEmojiHandle = () => {
        void Taro.hideKeyboard();
        setMoreEmoji(!moreEmoji);
        setMoreHandle(false);

        Taro.nextTick(() => {
            void scrollToBottom();
        });
    };

    const _getConversationMessage = async () => {
        try {
            const result: any = await getConversationMessage(filterParams);
            if (result.records.length == 0) {
                setLoadend(true);
                return;
            }
            updateMessageList([...result.records, ...messageListRef.current]);
            Taro.nextTick(async () => {
                if (filterParams.firstId == -1) {
                    await scrollToBottom();
                } else {
                    setTimeout(() => {
                        if (lastScrollTopRef.current) {
                            setScrollTop(lastScrollTopRef.current); // 恢复到之前的滚动位置
                            isRecordRef.current = true;
                        }
                    }, 0);
                }
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleSendMessage = async (type?: string, info?: any, pendingKey?: string) => {
        try {
            const result: any = await sendMessage({
                content: {
                    messageType: type || "text",
                    content: textAreaValueRef.current || "",
                    ...info
                },
                conversationId: filterParams.conversationId,
                shopId: filterParams.shopId,
                productId: filterParams.productId,
                orderId: filterParams.orderId
            });
            updateTextAreaValue("");
            setHasTxt(false);
            setMoreHandle(false);
            setMoreEmoji(false);

            const pendingIndex = pendingKey ? findPendingIndex(pendingKey) : -1;
            if (pendingIndex > -1) {
                // 沿用占位消息的 localKey，让气泡原地切换成真实视频而不重新入场
                const list = [...messageListRef.current];
                list[pendingIndex] = { ...result, localKey: pendingKey };
                updateMessageList(list);
            } else {
                updateMessageList([...messageListRef.current, result]);
                markMessageEnter(String(result.id));
            }
            Taro.nextTick(() => {
                void scrollToBottom();
            });
        } catch (error: any) {
            if (pendingKey) {
                removePendingMessage(pendingKey);
                void Taro.showToast({ title: t("视频发送失败，请重试"), icon: "none" });
            }
            console.log(error);
        }
    };

    const _getShopDetail = async (id: number) => {
        try {
            const result: any = await getShopDetail(id);
            setShopInfo(result);
        } catch (error) {
            console.error(error);
        }
    };

    // 计算 IM 商品卡片展示价格：周期购商品优先使用周期购价格
    const getCycleBuyDisplayPrice = (detail: any): string | number | undefined => {
        const cycleConfig = detail?.cycleConfig;
        const specs = cycleConfig?.specs;
        if (!Array.isArray(specs) || specs.length === 0) {
            return undefined;
        }

        const settingMode = Number(cycleConfig?.settingMode || 1);

        // 统一设置：直接取第一个有效期数价格
        if (settingMode === 1) {
            const firstEnabledSpec = specs.find((spec: any) => Number(spec?.disabled || 0) !== 1 && spec?.cyclePrice !== undefined);
            return firstEnabledSpec?.cyclePrice;
        }

        // SKU 单独设置：先定位默认 SKU，再取该 SKU 下第一个有效期数价格
        const checkedValue = Array.isArray(detail?.checkedValue) ? detail.checkedValue : [];
        const skuList = Array.isArray(detail?.skuList) ? detail.skuList : [];

        let currentSkuId = 0;
        if (checkedValue.length > 0) {
            const selectedSku = skuList.find((item: any) => item?.skuValue === checkedValue.join("|"));
            currentSkuId = Number(selectedSku?.skuId || 0);
        }
        if (!currentSkuId && skuList.length > 0) {
            const firstSkuWithStock = skuList.find((item: any) => Number(item?.skuStock || 0) > 0) || skuList[0];
            currentSkuId = Number(firstSkuWithStock?.skuId || 0);
        }

        if (!currentSkuId) {
            return undefined;
        }

        for (const spec of specs) {
            const skuSpecs = Array.isArray(spec?.skuSpecs) ? spec.skuSpecs : [];
            const skuSpec = skuSpecs.find((s: any) => Number(s?.skuId) === currentSkuId && Number(s?.disabled || 0) !== 1 && s?.cyclePrice !== undefined);
            if (skuSpec) {
                return skuSpec.cyclePrice;
            }
        }

        return undefined;
    };

    const _getProductDetail = async (id: any) => {
        try {
            const result: any = await getProductDetail(id);
            const cycleBuyPrice = getCycleBuyDisplayPrice(result);
            const productInfo: any = {
                messageType: "product",
                productId: result.item.productId,
                picUrl: pickPic(result.item),
                productName: result.item.productName,
                productPrice: cycleBuyPrice ?? result.item.productPrice,
                productSn: result.item.productSn
            };
            updateMessageList([...messageListRef.current, productInfo]);
            Taro.nextTick(() => {
                void scrollToBottom();
            });
        } catch (error) {
            console.error(error);
        }
    };
    const _getOrderDetail = async (id: any) => {
        try {
            const result: any = await getOrder({ id: id });
            const order = {
                messageType: "order",
                orderId: result.orderId,
                orderSn: result.orderSn,
                picUrl: pickPic(result.items[0]),
                productName: result.items[0].productName,
                productType: result.items[0].productType,
                productNum: result.items.length,
                totalAmount: result.totalAmount,
                orderStatusName: result.orderStatusName
            };
            const orderIndex = messageListRef.current.findIndex(
                (item: any) => item.content.messageType === "custom" && item.content.order && item.content.order.orderId == id
            );
            if (orderIndex === -1) {
                void handleSendMessage("custom", { order });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const setReadStatus = async () => {
        try {
            setTriggerSetReadStatus(true);

            const list = messageListRef.current;
            await setRead({
                shopId: filterParams.shopId,
                servantId: list[list.length - 1].servantId
            });
        } catch (error: any) {
            console.error(error);
        } finally {
            setTriggerSetReadStatus(false);
        }
    };

    const pcDomain = baseInfo.pcDomain || (process.env.TARO_ENV === "h5" ? window.location.origin : "");

    const urlMap = {
        pc: {
            detail: `${pcDomain}/item/`,
            order: `${pcDomain}/member/order/info?id=`,
            shop: `${pcDomain}/shop/${filterParams.shopId}`
        },
        mobile: {
            detail: "/pages/product/index?id=",
            order: "/pages/user/order/info?id=",
            giftCard: "/pages/giftCard/order/info?id=",
            shop: `/pages/shop/index?shopId=${filterParams.shopId}`
        }
    };

    const getUrl = (type: string, userFrom: string, data?: AnyObject) => {
        let url = "";
        switch (type) {
            case "detail":
                url = (urlMap as AnyObject)[userFrom][type] + (userFrom === "pc" && data ? data.content.product.productSn : data?.content.product.productId);
                break;
            case "order":
                url = (urlMap as AnyObject)[userFrom][type] + (data ? data.content.order.orderId : "");
                break;
            case "giftCard":
                url = (urlMap as AnyObject)[userFrom][type] + (data ? data.content.order.orderId : "");
                break;
            case "shop":
                url = (urlMap as AnyObject)[userFrom][type];
                break;
        }
        return url;
    };

    const handleLink = (type: string, data?: AnyObject) => {
        let url = "";
        if (platform === "pc") {
            url = getUrl(type, "pc", data);
            window.open(url, "_blank");
        } else {
            if (type === "order") {
                if (data?.content.order.productType && data?.content.order.productType === 8) {
                    url = getUrl("giftCard", "mobile", data);
                } else {
                    url = getUrl(type, "mobile", data);
                }
            } else {
                url = getUrl(type, "mobile", data);
            }
            Taro.navigateTo({
                url
            });
        }
    };

    const handleToList = (url: string) => {
        Taro.navigateTo({
            url
        });
    };

    const shopLogo = shopInfo.shopLogo ? shopInfo.shopLogo : baseInfo.shopLogo;
    const shopTitle = t(shopInfo.shopTitle || t("在线客服"));

    /** websocket 逻辑处理  */
    const onOpen = (_event: any) => {
        // console.log('连接成功', event)
    };
    const onMessage = (event: any) => {
        if (!isJsonString(event.data)) {
            console.error("收到非JSON格式数据");
            return;
        }

        const data = JSON.parse(event.data);

        if (data.type === "message") {
            if (data.data) {
                formatMessage(data.data[0]);
            }
        }

        if (data.type === "read") {
            updateMessageList(
                messageListRef.current.map((item: any) => {
                    if (item.type === 1) {
                        return { ...item, isRead: 1 };
                    }
                    return item;
                })
            );
        }
    };

    const formatMessage = (data: any) => {
        if (data.shopId === filterParams.shopId) {
            const index = messageListRef.current.findIndex((item: any) => item.id === data.id);
            if (index === -1) {
                updateMessageList([...messageListRef.current, data]);
                markMessageEnter(String(data.id));
                promptToneRef.current?.play();
                Taro.nextTick(() => {
                    void scrollToBottom();
                });
            }
        }
    };
    const onClose = (_event: any) => {
        // console.log('连接关闭', event)
    };
    const onError = (_event: any) => {
        // console.log('连接错误', event)
    };

    const getSocketUrl = () => {
        if (process.env.TARO_ENV === "h5") {
            if (process.env.TARO_APP_SOCKET_URL) {
                return process.env.TARO_APP_SOCKET_URL;
            }
            return location.origin ? location.origin.replace(/^http:/, "ws:").replace(/^https:/, "wss:") + "/ws" : "";
        }
        return process.env.TARO_APP_SOCKET_URL;
    };

    // 旧 onLoad
    useEffect(() => {
        const options: AnyObject = router.params || {};
        if (!options) return;

        const init = async () => {
            if (options.shopId !== undefined && options.shopId !== null && options.shopId !== "" && !Number.isNaN(Number(options.shopId))) {
                filterParams.shopId = Number(options.shopId);
                await _getShopDetail(filterParams.shopId);
            }
            if (options.productId && !!Number(options.productId)) {
                filterParams.productId = Number(options.productId);
                void _getProductDetail(options.productId);
            }
            if (options.orderId && !!Number(options.orderId)) {
                filterParams.orderId = Number(options.orderId);
            }
            if (options.conversationId && !!Number(options.conversationId)) {
                filterParams.conversationId = Number(options.conversationId);
            }

            let platformValue = "";
            if (options.platform) {
                platformValue = options.platform;
                setPlatform(options.platform);
            }

            if (options.token) {
                await Taro.setStorage({ key: "token", data: options.token });
                void useUserStore.getState().getUserInfo();
                filterParams.userFrom = useConfigStore.getState().XClientType;
                const client = new WebSocketClient(
                    `${getSocketUrl()}?token=${options.token}&platform=${platformValue ? platformValue : filterParams.userFrom}`
                );
                wsRef.current = client;
                client.onclose(onClose);
                client.onopen(onOpen);
                client.onerror(onError);
                client.onmessage(onMessage);
                // 连接
                client.connect();
                await _getConversationMessage();
                if (filterParams.orderId) {
                    await _getOrderDetail(filterParams.orderId);
                }
            }
        };
        void init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 迁移说明：旧页面未在卸载时关闭 socket，重进页面会叠加连接；这里补卸载清理，其余收发逻辑不变
    useUnload(() => {
        wsRef.current?.close();
        wsRef.current = null;
    });

    const gallaryBg = `url(${staticResource("im/gallary.png")})`;
    const goodspicBg = `url(${staticResource("im/goodspic.png")})`;
    const plusBg = `url(${staticResource("im/plus@2x.png")})`;
    const icoFaceBg = `url(${staticResource("im/ico_face_v2@2x.png")})`;

    const headerHeight = process.env.TARO_ENV === "weapp" ? `${menuButtonInfo.height + 10}px` : "44px";
    const headerTop = process.env.TARO_ENV === "weapp" ? `${menuButtonInfo.top}px` : `${safeAreaInsets.top}px`;
    const paddingRight = `${menuButtonInfo.width + 10}px`;

    let footerNum = 100;
    if (moreEmoji) {
        footerNum += 324;
    }
    if (moreHandle) {
        footerNum += 196;
    }
    const footerHight = showKeyboard ? `calc(${footerNum}rpx + ${keyboardHeight}px)` : `${footerNum}rpx`;

    // 判断文字是否被[]包裹（含表情），是则走 EmojiHtml 渲染，否则用原生 Text
    const isEmojiText = (text: string) => {
        return /\[(.*?)\]/.test(text);
    };

    const renderMessage = (item: any) => {
        const itemKey = item.localKey || item.id;
        const key = String(itemKey);
        const typeClass = item.type == 2 ? "in" : item.type == 1 ? "out" : "";
        const extraClass =
            item.messageType === "custom" && item.type == 1
                ? "card-type"
                : item.messageType === "image" || item.messageType === "video"
                  ? "image-type"
                  : "";
        const enteringClass = enteringKeys.includes(key) ? "msg-enter" : "";
        const richClassName = ["thanos-rich-message", typeClass, extraClass, enteringClass].filter(Boolean).join(" ");

        return (
            <View className={richClassName} key={itemKey}>
                {item.messageType !== "product" && item.messageType !== "order" && (
                    <View className="message-time">
                        <Text>{item.sendTime}</Text>
                    </View>
                )}
                {item.type === 3 && (
                    <View className="message-time">
                        <Text>{item.content.content}</Text>
                    </View>
                )}
                {item.type != 3 && item.messageType !== "product" && item.messageType !== "order" && (
                    <View className="message-content message-content-left">
                        <View className="bg-pic circle-bg-pic thanos-view thanos-hairline--surround message-avatar">
                            <View
                                className="bg-pic-content"
                                style={{
                                    backgroundImage: `url(${item.type === 1 ? imageFormat(item.user?.avatar) : imageFormat(shopLogo)})`
                                }}
                            />
                        </View>
                        <View className="message-content-inner">
                            {item.messageType && (
                                <View className="message-context">
                                    <View className="thanos-text-message">
                                        {item.messageType === "text" && (
                                            <View>
                                                {!isEmojiText(item.content.content) ? (
                                                    <Text>{item.content.content}</Text>
                                                ) : (
                                                    <EmojiHtml content={item.content.content} />
                                                )}
                                            </View>
                                        )}

                                        {item.messageType === "image" && (
                                            <View className="message-image">
                                                <TigImage src={item.content.pic} preview />
                                            </View>
                                        )}
                                        {item.messageType === "video" && (
                                            <View className="message-video">
                                                {item.localPending ? (
                                                    <View className="video-sending">
                                                        {item.localCover && (
                                                            <Image className="video-sending-poster" src={item.localCover} mode="aspectFill" />
                                                        )}
                                                        <View className="video-sending-mask">
                                                            <View className="video-sending-spinner" />
                                                            <View className="video-sending-percent">
                                                                {item.localProcessing ? t("处理中") : (item.localPercent || 0) + "%"}
                                                            </View>
                                                        </View>
                                                    </View>
                                                ) : (
                                                    <Video
                                                        src={imageFormat(item.content.videoUrl)}
                                                        poster={item.content.videoCover ? imageFormat(item.content.videoCover) : ""}
                                                        className={`im-video ${!fullscreenVideos.includes(key) ? "chat-video--compact" : ""}`}
                                                        controls
                                                        showProgress
                                                        objectFit="contain"
                                                        onFullscreenChange={(e: any) => {
                                                            if (e.detail.fullScreen) {
                                                                setFullscreenVideos((prev) => (prev.includes(key) ? prev : [...prev, key]));
                                                            } else {
                                                                setFullscreenVideos((prev) => prev.filter((v) => v !== key));
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </View>
                                        )}
                                        {item.messageType === "custom" && (
                                            <View>
                                                {item.content.product && (
                                                    <View className="custom-message-product">
                                                        <View className="product-img" onClick={() => handleLink("detail", item)}>
                                                            {item.content.product.picUrl && (
                                                                <TigImage mode="widthFix" src={pickPic(item.content.product)} />
                                                            )}
                                                        </View>
                                                        <View className="product-info">
                                                            <View className="product-name">{t(item.content.product.productName)}</View>
                                                            <View className="product-price">
                                                                <FormatPrice
                                                                    fontStyle={{ fontSize: "28rpx" }}
                                                                    currencyStyle={{ fontSize: "22rpx" }}
                                                                    decimalsStyle={{ fontSize: "24rpx" }}
                                                                    priceData={item.content.product.productPrice}
                                                                />
                                                            </View>
                                                        </View>
                                                    </View>
                                                )}
                                                {item.content.order && (
                                                    <View className="custom-message-order" onClick={() => handleLink("order", item)}>
                                                        <View className="tit">{item.content.order.orderStatusName}</View>
                                                        <View className="info">
                                                            <View className="product-img">
                                                                {item.content.order.picUrl && (
                                                                    <TigImage mode="widthFix" src={pickPic(item.content.order)} />
                                                                )}
                                                            </View>
                                                            <View className="product-info">
                                                                <View className="product-name">{t(item.content.order.productName)}</View>
                                                                <View className="product-txt">
                                                                    {isOverseas()
                                                                        ? t("共{0}件商品，合计", { 0: item.content.order.productNum })
                                                                        : `共${item.content.order.productNum}件商品，合计`}
                                                                    <FormatPrice
                                                                        fontStyle={{ fontSize: "28rpx" }}
                                                                        currencyStyle={{ fontSize: "22rpx" }}
                                                                        decimalsStyle={{ fontSize: "24rpx" }}
                                                                        priceData={item.content.order.totalAmount}
                                                                    />
                                                                </View>
                                                            </View>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                    <Text className="message-status" />
                                </View>
                            )}
                        </View>
                        {item.type === 1 && (
                            <View className={`read-status ${item.isRead ? "read" : "unread"}`}>{t(item.isRead ? "已读" : "未读")}</View>
                        )}
                    </View>
                )}
                {item.messageType === "product" && (
                    <View className="im-goods-card">
                        <View className="content">
                            <View className="pic">
                                <TigImage mode="widthFix" src={pickPic(item)} />
                            </View>
                            <View className="desc">
                                <View className="title">{t(item.productName)}</View>
                                <View className="price">
                                    <FormatPrice
                                        fontStyle={{ fontSize: "32rpx" }}
                                        currencyStyle={{ fontSize: "22rpx" }}
                                        decimalsStyle={{ fontSize: "24rpx" }}
                                        priceData={item.productPrice}
                                    />
                                </View>
                            </View>
                        </View>
                        <View className="line" />
                        <View className="send" onClick={() => sendGoods(item)}>
                            {t("发送宝贝")}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View className="page-content">
            <View className="thanos-layout">
                <View
                    className="thanos-layout-header"
                    style={{
                        height: headerHeight,
                        paddingTop: headerTop,
                        ...(process.env.TARO_ENV === "weapp" ? { paddingRight } : {})
                    }}
                >
                    <View className="wapim-conversation-banner">
                        <View className="shop-info" onClick={returnFun}>
                            <View className="iconfont icon-houtui" />
                        </View>
                        {shopInfo.shopTitle && <View className="banner-title">{t(shopInfo.shopTitle)}</View>}
                    </View>
                </View>
                <View className="thanos-layout-main-content" onClick={handleSetRead} style={{ marginBottom: footerHight }}>
                    <ScrollView className="message-scroll" scrollTop={scrollTop} scrollY onScroll={handleScroll}>
                        <View className="message-box">
                            {loadend && <View className="empty-text">{t("已经没有更多消息了")}</View>}
                            {messageList.map((item) => renderMessage(item))}
                        </View>
                    </ScrollView>
                </View>
                <View className="thanos-layout-footer" style={{ height: footerHight }}>
                    <View className="wapim-inputer">
                        <View className="thanos-hairline--top-bottom wapim-main-inputer">
                            <View className="input-box">
                                <View className="rich-input">
                                    <Input
                                        style={{ height: "100%" }}
                                        value={textAreaValue}
                                        placeholder=""
                                        adjustPosition={adjustPosition}
                                        confirmType="send"
                                        onInput={(e: any) => {
                                            updateTextAreaValue(e.detail.value);
                                            onInput(e.detail.value);
                                        }}
                                        onConfirm={sendTxt}
                                        onFocus={onFocus}
                                        onBlur={() => setShowKeyboard(false)}
                                        onKeyboardHeightChange={handleKeyboardheightchange}
                                    />
                                </View>
                            </View>
                            <View className="wapim-inputer-operation">
                                <Text
                                    className="operation face"
                                    onClick={showEmojiHandle}
                                    style={{
                                        background: `transparent ${icoFaceBg} center center no-repeat`,
                                        backgroundSize: "60rpx 60rpx"
                                    }}
                                />
                                {hasTxt === true ? (
                                    <Text className="operation send" onClick={sendTxt}>
                                        {t("发送")}
                                    </Text>
                                ) : (
                                    <View
                                        className="operation plus"
                                        onClick={showMoreHandle}
                                        style={{
                                            background: `transparent ${plusBg} center center no-repeat`,
                                            backgroundSize: "60rpx 60rpx"
                                        }}
                                    />
                                )}
                            </View>
                        </View>
                        <View className="wapim-inputer-plugin" style={{ display: moreHandle ? "block" : "none" }}>
                            <View className="wapim-inputer-file-picker">
                                <View className="file-inputer-plugin">
                                    <View className="pic-item plugin-item" onClick={chooseMediaFile}>
                                        <View
                                            className="photo icon"
                                            style={{ background: `#fff center center ${goodspicBg} no-repeat`, backgroundSize: "64rpx" }}
                                        />
                                        <Text className="title">{t("相册")}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                        <View className="wapim-inputer-plugin" style={{ display: moreEmoji ? "block" : "none" }}>
                            <View className="wapim-inputer-file-picker">
                                <View className="file-emoji-plugin">
                                    <Emoji onInsertEmoji={onInsertEmoji} />
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
            <PromptTone ref={promptToneRef} />
        </View>
    );
}