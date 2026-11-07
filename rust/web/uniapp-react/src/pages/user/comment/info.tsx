import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Input, Text, Textarea, View } from "@tarojs/components";
import Taro, { useRouter, useUnload } from "@tarojs/taro";

import EmptyBox from "@/components/empty-box/EmptyBox";
import FormatPrice from "@/components/format-price/FormatPrice";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigCheckbox from "@/components/tig/tig-checkbox/TigCheckbox";
import TigUpload from "@/components/tig/tig-upload/TigUpload";
import { getCommentData, updateCommentData } from "@/api/user/comment";
import { useConfigStore } from "@/store/config";
import { useUserStore } from "@/store/user";
import { getSkuText, hasSkuText } from "@/utils";
import { imageFormat, pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";
import Rate from "./src/Rate";

import "./info.scss";

/**
 * 订单评价页（发表评价）（自旧 pages/user/comment/info.vue 逐行移植）
 * - 对订单商品进行评分（1-5星）
 * - 选择或自定义评价标签
 * - 填写评价内容（10-500字）
 * - 上传晒单图片（最多9张）
 * - 提交后自动跳转待晒单列表
 */
export default function CommentInfo() {
    usePageGuards();

    const router = useRouter();
    const productCommentEnabled = useConfigStore((s) => s.productCommentEnabled);
    const anonymousCommentEnabled = useConfigStore((s) => s.anonymousCommentEnabled);
    const userInfo = useUserStore((s) => s.userInfo);

    const commentEnabled = productCommentEnabled === 1;
    const anonymousEnabled = commentEnabled && anonymousCommentEnabled === 1;
    // 掩码展示名由后端下发（DD-19），前端不复制掩码规则
    const anonymousPreview: string = (userInfo as any)?.anonymousUsername || "";

    // 旧实现直接改写 formState.value 内元素；React 下用可变数组 + 强制刷新保留同一套业务逻辑
    const formStateRef = useRef<any[]>([]);
    const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
    const formState = formStateRef.current;

    const [tabInput, setTabInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const commentIdRef = useRef<string>("");

    const labelList = useRef<string[]>([
        t("送货快"),
        t("质量很好"),
        t("服务周到"),
        t("正品"),
        t("很划算"),
        t("包装仔细"),
        t("价格实惠"),
        t("还可以"),
        t("相当好")
    ]);

    // 页面展示所有未晒单商品；提交时再筛未评价项和本次补了图的项
    const pendingCommentItems = formState.filter((item: any) => !item.isShowed);
    const hasUncommentedItems = pendingCommentItems.some((item: any) => !item.isCommentInfo);
    const submitButtonText = hasUncommentedItems ? t("提交评价") : t("提交晒单");

    const close = (item: any, index: number) => {
        item.showPics.splice(index, 1);
        forceUpdate();
    };

    const onChange = (index: any, value: number) => {
        formStateRef.current[index].commentRank = value;
        forceUpdate();
    };

    const fetchCommentData = async (id: string) => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result: any = await getCommentData({ id: id });
            result.items.map((data: any) => {
                data.allCommentTag = JSON.parse(JSON.stringify(labelList.current)); // 使用深拷贝来创建独立的数组
                Object.assign(
                    data,
                    {
                        commentRank: 0,
                        content: "",
                        showPics: [],
                        commentTag: [],
                        isAdd: false,
                        rankVerification: true,
                        contentVerification: true,
                        isAnonymous: false,
                        isCommentInfo: data.commentInfo ? true : false
                    },
                    data.commentInfo
                );
                // 后端可能返回 0/1，统一为 Boolean 供 tig-checkbox 使用
                data.isAnonymous = Number(data.isAnonymous ?? 0) === 1;
            });
            formStateRef.current = result.items;
            forceUpdate();
            const allAreTrue = formStateRef.current.every((obj: any) => obj.isShowed === 1);
            const allAreFalse = formStateRef.current.every((obj: any) => obj.isShowed === 0);
            if (allAreTrue) {
                if (process.env.TARO_ENV === "h5") {
                    window.history.back();
                } else {
                    Taro.navigateBack();
                }
                Taro.eventCenter.trigger("commentFinished", true);
            } else if (allAreFalse) {
                // 全部未晒单
                return true;
            }
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        } finally {
            Taro.hideLoading();
        }
    };

    const isShowadd = (index: number) => {
        formStateRef.current[index].isAdd = !formStateRef.current[index].isAdd;
        forceUpdate();
    };

    const tabAdd = (index: number) => {
        if (tabInput !== "") {
            const newCommentTag = JSON.parse(JSON.stringify(formStateRef.current[index].allCommentTag));
            if (newCommentTag.includes(tabInput)) {
                Taro.showToast({
                    title: t("您已添加相同标签"),
                    icon: "none",
                    duration: 1000
                });
                return;
            }
            newCommentTag.push(tabInput);
            formStateRef.current[index].allCommentTag = newCommentTag;
            checkTag(index, tabInput);
        }
        setTabInput("");
        formStateRef.current[index].isAdd = false;
        forceUpdate();
    };

    const checkTag = (index: number, label: string) => {
        let arr = formStateRef.current[index].commentTag;
        if (arr.includes(label)) {
            formStateRef.current[index].commentTag = arr.filter((item: any) => item !== label);
        } else {
            arr.push(label);
        }
        forceUpdate();
    };

    const imagePreview = (url: string) => {
        Taro.previewImage({
            urls: [url]
        });
    };

    /**
     * 提交未评价商品，以及本次主动补了晒单图的已评价商品
     * - 已评价但未补图的条目不参与本次校验和提交，避免挡住其他商品首次评价
     * - 发请求前只校验本次要提交的条目，避免部分商品校验失败时产生半提交状态
     * - 逐条提交；中途失败时保留失败项和后续商品的草稿
     * - 全部成功后只刷新一次列表
     */
    const validateCommentItem = (item: any) => {
        item.rankVerification = item.commentRank >= 1;
        item.contentVerification = item.content !== "";

        if (item.commentRank < 1) {
            return false;
        }

        if (item.content == "") {
            return false;
        }

        if (item.content.length < 10 || item.content.length > 500) {
            Taro.showToast({
                title: t("购买心得在10-500字之间"),
                icon: "none",
                duration: 1000
            });
            return false;
        }

        if (item.isCommentInfo && (!item.showPics || item.showPics.length === 0)) {
            Taro.showToast({
                title: t("请添加晒单图片"),
                icon: "none",
                duration: 1000
            });
            return false;
        }

        return true;
    };

    const getCommentPayload = (item: any) => ({
        productId: item.productId,
        orderId: item.orderId,
        orderItemId: item.itemId,
        shopId: item.shopId,
        commentRank: item.commentRank,
        commentTag: item.commentTag,
        content: item.content,
        showPics: item.showPics,
        isAnonymous: anonymousEnabled && item.isAnonymous ? 1 : 0
    });

    const hasShowPics = (item: any) => Array.isArray(item.showPics) && item.showPics.length > 0;

    const onSubmit = async () => {
        if (isSubmitting) return;

        const items = pendingCommentItems.filter((item: any) => !item.isCommentInfo || hasShowPics(item));
        if (!items.length) {
            Taro.showToast({
                title: t("请添加晒单图片"),
                icon: "none",
                duration: 1000
            });
            return;
        }
        if (!items.every(validateCommentItem)) {
            forceUpdate();
            return;
        }

        setIsSubmitting(true);
        try {
            for (const item of items) {
                await updateCommentData(getCommentPayload(item));
                // 若后续某条失败，已成功项不再参与重试，其余项继续保留页面草稿
                item.isShowed = 1;
            }
            Taro.showToast({
                title: t("提交成功"),
                icon: "none",
                duration: 1000
            });
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const flag = await fetchCommentData(commentIdRef.current);
            // 跳转到待晒单
            if (flag) {
                Taro.reLaunch({
                    url: "/pages/user/comment/list?currentType=1"
                });
            }
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        let active = true;
        (async () => {
            // 读取初始化后的配置后再请求评价数据
            await useConfigStore.getState().whenConfigReady();
            if (!active) return;
            const config = useConfigStore.getState();
            if (config.productCommentEnabled !== 1) return;
            // 匿名开关开启时才需要拿展示名做预览
            if (config.anonymousCommentEnabled === 1) {
                useUserStore.getState().getUserInfo();
            }
            const id = router.params?.id;
            if (id) {
                commentIdRef.current = id;
                // 获取详情数据
                void fetchCommentData(id);
            }
        })();
        return () => {
            active = false;
        };
        // 仅挂载执行一次（对应旧 onLoad）
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 关闭预览图片
    useUnload(() => {
        // #ifdef H5 || APP
        if (process.env.TARO_ENV === "h5") {
            // TODO(MIGRATION)：Taro 未提供 closePreviewImage 类型，按旧 H5/APP 条件编译保留可选调用
            (Taro as any).closePreviewImage?.();
        }
        // #endif
    });

    return (
        <TigLayout title={t("订单评价")}>
            {commentEnabled ? (
                // 旧根节点 data-form-rev="Y2V3bTIyODI" 为表单版本标记，无业务逻辑，不再输出
                <View className="comment-info">
                    {formState.map((item, index) => (
                        <View className="comment-item" key={index}>
                            {!item.isShowed && (
                                <View className="white-card">
                                    <View className="product flex">
                                        <View className="product-img">
                                            <TigImage src={pickPic(item)} mode="aspectFit" />
                                        </View>
                                        <View className="product-info">
                                            <View className="product-name">{item.productName}</View>
                                            <View className="product-price">
                                                <FormatPrice showText={false} isBottom={false} priceData={item.price} />
                                            </View>
                                            {hasSkuText(item.skuData) && (
                                                <View className="sku-card">
                                                    <View className="sku-item line1">{getSkuText(item.skuData)}</View>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <View className="comment">
                                        <View className="flex comment-cell">
                                            <View className="lable-text">{t("商品评分")}：</View>
                                            <View className="flex">
                                                <Rate
                                                    readonly={item.isCommentInfo}
                                                    value={item.commentRank}
                                                    color="#bfbfbf"
                                                    activeColor="#ffa800"
                                                    size={18}
                                                    onChange={(value) => onChange(index, value)}
                                                />
                                                <Text style="margin-left: 10rpx">
                                                    {item.commentRank}
                                                    {t("分")}
                                                </Text>
                                            </View>
                                        </View>
                                        {!item.rankVerification && (
                                            <View className="flex comment-cell">
                                                <View className="lable-text" />
                                                <View className="tips">{t("请先评分商品")}</View>
                                            </View>
                                        )}
                                        <View className="comment-cell">
                                            {!item.isCommentInfo ? (
                                                <View className="label-list flex-wrap">
                                                    {item.allCommentTag.map((lb: string, lBindex: number) => (
                                                        <View
                                                            key={lBindex}
                                                            className={`label-item${item.commentTag.includes(lb) ? " active" : ""}`}
                                                            onClick={() => checkTag(index, lb)}
                                                        >
                                                            <Text>{lb}</Text>
                                                        </View>
                                                    ))}

                                                    {!item.isAdd ? (
                                                        <View className="label-edit" onClick={() => isShowadd(index)}>
                                                            <View />
                                                            <View>{t("自定义")}</View>
                                                        </View>
                                                    ) : (
                                                        <View className="label-edit-input flex align-center justify-between">
                                                            <View>
                                                                <Input
                                                                    value={tabInput}
                                                                    type="text"
                                                                    focus
                                                                    placeholder={t("请输入自定义标签")}
                                                                    onInput={(e) => setTabInput(e.detail.value)}
                                                                />
                                                            </View>
                                                            <TigButton2 theme className="btn" onClick={() => tabAdd(index)}>
                                                                {t("确定")}
                                                            </TigButton2>
                                                        </View>
                                                    )}
                                                </View>
                                            ) : (
                                                <View className="label-list">
                                                    {item.commentTag.map((lb: string, lBindex: number) => (
                                                        <View className="label-item-txt" key={lBindex}>
                                                            <Text>{lb}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                        <View className="comment-cell">
                                            <View className="textarea-box">
                                                {/* 旧 textarea 的 cols/rows 在 Taro Textarea 无对应属性（H5 仅透传 HTML 属性），此处省略 */}
                                                <Textarea
                                                    value={item.content}
                                                    name="content"
                                                    placeholder={t("商品是否给力？快分享你的购买心得吧~")}
                                                    maxlength={500}
                                                    style="border: 1px solid #d9d9d9; padding: 4px"
                                                    disabled={item.isCommentInfo}
                                                    onInput={(e) => {
                                                        item.content = e.detail.value;
                                                        forceUpdate();
                                                    }}
                                                />
                                                <View className="strlangth">{t("10-500字")}</View>
                                            </View>
                                        </View>
                                        <View className="comment-cell flex align-center justify-between">
                                            <View className="tips">
                                                {!item.contentVerification && <Text>{t("请填写购买心得")}</Text>}
                                            </View>
                                        </View>
                                        <View className="comment-cell">
                                            <View className="lable-text">{t("添加图片")}</View>
                                            <View className="pic-box flex-wrap">
                                                {item.showPics.map((product: any, picIndex: number) => (
                                                    <View
                                                        className="pic-img"
                                                        key={picIndex}
                                                        style="transition: opacity 0.2s linear; margin-right: 10px"
                                                    >
                                                        <TigImage
                                                            src={product.picThumb}
                                                            mode="aspectFill"
                                                            onClick={() => imagePreview(imageFormat(product.picThumb))}
                                                        />
                                                        <View
                                                            className="close-icon"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                close(item, Number(picIndex));
                                                            }}
                                                        >
                                                            <Text className="iconfont-h5 icon-chacha close-icon-text" />
                                                        </View>
                                                    </View>
                                                ))}
                                                <TigUpload
                                                    count={9}
                                                    modelValue={item.showPics as any}
                                                    onModelValueChange={(value: any) => {
                                                        item.showPics = value;
                                                        forceUpdate();
                                                    }}
                                                >
                                                    <View className="add-img">
                                                        <Text className="iconfont-h5 icon-zengjia" style="font-size: 52rpx; color: #cccccc" />
                                                    </View>
                                                </TigUpload>
                                            </View>
                                        </View>
                                        {/* 未评价条目可按配置选择匿名评价 */}
                                        {anonymousEnabled && !item.isCommentInfo && (
                                            <View className="anonymous-row flex align-center">
                                                {/* 旧 <tig-checkbox v-model:checked="item.isAnonymous" size="20" />（已收敛到公共组件；iconSize 保旧版 20px 盒） */}
                                                <TigCheckbox
                                                    checked={item.isAnonymous}
                                                    size="20"
                                                    iconSize="20px"
                                                    onUpdateChecked={() => {
                                                        item.isAnonymous = !item.isAnonymous;
                                                        forceUpdate();
                                                    }}
                                                />
                                                <Text
                                                    className="anonymous-text"
                                                    onClick={() => {
                                                        item.isAnonymous = !item.isAnonymous;
                                                        forceUpdate();
                                                    }}
                                                >
                                                    {t("匿名评价")}
                                                </Text>
                                                {anonymousPreview && <Text className="anonymous-name">{anonymousPreview}</Text>}
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            ) : (
                <EmptyBox centerContent height="calc(100vh - var(--nav-height) - var(--safe-bottom, 0px))" mode="list" text={t("评价功能已关闭")} />
            )}

            {commentEnabled && pendingCommentItems.length > 0 && (
                <View className="fixed-placeholder">
                    <View className="fixed-content" style={{ backgroundColor: "#fff" }}>
                        <View className="btn-box">
                            <TigButton2 className="btn" theme disabled={isSubmitting} loading={isSubmitting} onClick={onSubmit}>
                                {submitButtonText}
                            </TigButton2>
                        </View>
                    </View>
                    <View className="fixed-placeholder-pad" />
                </View>
            )}
        </TigLayout>
    );
}