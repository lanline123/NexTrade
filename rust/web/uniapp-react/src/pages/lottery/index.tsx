import { useEffect, useMemo, useRef, useState } from "react";
import { Image, RichText, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useUnload } from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLoadingPage from "@/components/tig/tig-loadingpage";
import EmptyBox from "@/components/empty-box/EmptyBox";
import LoadingBox from "@/components/loading-box";
import Buy from "@/components/product/buy";
import { staticResource, redirect } from "@/utils";
import { imageFormat } from "@/utils/format";
import { getLotteryInfo, drawLottery, getMyRecords, getWinners } from "@/api/lottery/lottery";
import type {
    LotteryInfo,
    DrawResult,
    PrizeRecord,
    GridCell,
    GridPosition,
    LotteryWinner
} from "@/types/lottery/lottery";
import { t } from "@/utils/i18n";

import "./index.scss";
import { usePageGuards } from "@/utils/pageMixin";

/** 九宫格布局映射: 1 2 3 / 8 X 4 / 7 6 5（-1 表示中间抽奖按钮） */
const gridOrder = [1, 2, 3, 8, -1, 4, 7, 6, 5];

/** 动画顺序：顺时针 1->2->3->4->5->6->7->8 */
const animationOrder = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * 抽奖大转盘页（自旧 pages/lottery/index.vue 移植）
 * - 九宫格抽奖（顺时针动画 + 结果定位）
 * - 中奖名单滚动通知
 * - 中奖记录弹窗
 */
export default function LotteryIndex() {
    usePageGuards();
    // ==================== 数据定义 ====================

    /** 活动信息 */
    const [lotteryInfo, setLotteryInfo] = useState<LotteryInfo | null>(null);
    const lotteryInfoRef = useRef<LotteryInfo | null>(null);

    /** 无活动常驻提示 */
    const [noActivityVisible, setNoActivityVisible] = useState(false);

    /** 页面加载状态 */
    const [isLoading, setIsLoading] = useState(true);

    /** 是否正在抽奖 */
    const isDrawingRef = useRef(false);

    /** 当前高亮位置 */
    const [activeIndex, setActiveIndex] = useState(-1);
    const activeIndexRef = useRef(-1);

    /** 抽奖结果 */
    const [drawResult, setDrawResult] = useState<DrawResult | null>(null);

    /** 结果弹窗显示（旧 resultPopupRef.open/close） */
    const [resultPopupVisible, setResultPopupVisible] = useState(false);

    /** 提示弹窗显示（支持换行） */
    const [tipPopupVisible, setTipPopupVisible] = useState(false);
    const [tipMessage, setTipMessage] = useState("");
    const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const showTip = (msg: string, duration = 2000) => {
        setTipMessage(msg);
        setTipPopupVisible(true);
        if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
        tipTimerRef.current = setTimeout(() => {
            setTipPopupVisible(false);
            tipTimerRef.current = null;
        }, duration);
    };

    /** 记录弹窗显示 */
    const [showRecordPopup, setShowRecordPopup] = useState(false);

    /** 中奖记录列表 */
    const [recordList, setRecordList] = useState<PrizeRecord[]>([]);

    /** 记录加载状态 */
    const [recordLoading, setRecordLoading] = useState(false);

    /** 记录分页 */
    const recordPageRef = useRef(1);

    /** 记录总数 */
    const recordTotalRef = useRef(0);

    /** 中奖名单列表 */
    const [winnerList, setWinnerList] = useState<LotteryWinner[]>([]);

    /** 当前显示的中奖名单索引 */
    const [currentWinnerIndex, setCurrentWinnerIndex] = useState(0);

    /** 中奖名单轮播定时器 */
    const winnerCarouselTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const winnerListLengthRef = useRef(0);

    /** 抽奖动画定时器 */
    const animationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const animationStepRef = useRef(0);

    /** 上一次稳定停留的位置（用于抽奖失败时回退/以及下次从此位置开始） */
    const lastStableIndexRef = useRef(-1);

    /** 当前展示的中奖信息 */
    const currentWinner = winnerList[currentWinnerIndex];

    const updateActiveIndex = (value: number) => {
        activeIndexRef.current = value;
        setActiveIndex(value);
    };

    const updateLotteryInfo = (value: LotteryInfo | null) => {
        lotteryInfoRef.current = value;
        setLotteryInfo(value);
    };

    // ==================== 九宫格布局 ====================

    /** 九宫格单元格 */
    const gridCells = useMemo<GridCell[]>(() => {
        if (!lotteryInfo) return [];

        return gridOrder.map((pos, index) => {
            if (pos === -1) {
                return { index, position: -1, isCenter: true, prizeId: null };
            }
            const grid = lotteryInfo.gridConfig.find((g: GridPosition) => g.position === pos);
            return {
                index,
                position: pos,
                isCenter: false,
                prizeId: grid?.prizeId ?? null,
                prizeName: grid?.prizeName ?? lotteryInfo.noWinName,
                prizeImage: grid?.prizeImage ?? lotteryInfo.noWinImage,
                prizeType: grid?.prizeType ?? 0
            };
        });
    }, [lotteryInfo]);

    /** 背景样式 */
    const contentStyle = useMemo(() => {
        const styles: Record<string, string> = {};
        if (lotteryInfo?.decorateConfig.bgImage) {
            styles.backgroundImage = `url(${lotteryInfo.decorateConfig.bgImage})`;
            // 页面高度超过 100vh 时，避免背景图按高度被“拉伸”
            // 按宽度等比缩放，图片高度不足时由背景色补齐（不重复平铺）
            styles.backgroundSize = "100% auto";
            styles.backgroundRepeat = "no-repeat";
            styles.backgroundPosition = "top center";
        }
        if (lotteryInfo?.decorateConfig.bgColor) {
            styles.backgroundColor = lotteryInfo.decorateConfig.bgColor;
        }
        return styles;
    }, [lotteryInfo]);

    /** 奖品入口图（左上角奖品按钮图），优先读取装修配置，缺省回退默认图 */
    const prizeEntryImage = imageFormat(lotteryInfo?.decorateConfig?.prizeEntryImage ?? "") || staticResource("lottery/prize.png");

    /** 九宫格背景样式 */
    const lotteryContainerStyle = useMemo(
        () => ({
            background: `url(${staticResource("lottery/turntableBg.png")}) no-repeat center center`,
            backgroundSize: "100% 100%"
        }),
        []
    );

    /** 剩余次数背景样式 */
    const remainingTimesStyle = useMemo(
        () => ({
            background: `url(${staticResource("lottery/remaining-times.png")}) no-repeat center center`,
            backgroundSize: "500rpx 200rpx"
        }),
        []
    );

    /** 剩余次数展示：-1 表示不限制 */
    const isUnlimitedToday = lotteryInfo?.todayRemaining === -1;
    const isUnlimitedTotal = lotteryInfo?.totalRemaining === -1;
    const isUnlimitedAll = isUnlimitedToday && isUnlimitedTotal;

    /** 剩余抽奖次数（不限制时返回 -1；其中一个不限制则取另一个；都有限制取最小值） */
    const remainingTimes = (() => {
        if (!lotteryInfo) return 0;
        const today = lotteryInfo.todayRemaining;
        const total = lotteryInfo.totalRemaining;
        // 由积分可抽次数
        const userPoints = Number(lotteryInfo.userPoints ?? 0);
        const costPoints = Number(lotteryInfo.costPoints ?? 0);
        const canUsePoints = costPoints > 0 ? Math.floor(userPoints / costPoints) : Number.POSITIVE_INFINITY;
        if (today === -1 && total === -1) return -1;
        if (today === -1) return total;
        if (total === -1) return today;
        return Math.min(today, total, canUsePoints);
    })();

    /** 是否显示剩余信息：不限制时显示“消耗积分”；有限制时仅在剩余次数 > 0 显示 */
    const showRemainingInfo = (() => {
        if (!lotteryInfo) return false;
        if (isUnlimitedAll) return true;
        // 次数用完（0）也需要展示
        return remainingTimes >= 0;
    })();

    /** 结果弹窗背景样式 */
    const resultPopupStyle = useMemo(
        () => ({
            background: `url(${staticResource("lottery/lotteryPop.png")}) no-repeat`,
            backgroundSize: "100% 100%"
        }),
        []
    );

    /** 结果弹窗按钮文字 */
    const resultActionText = (() => {
        if (!drawResult) return "";
        if (!drawResult.isWin) return t("再抽一次");
        return drawResult.prizeType === 2 ? t("立即领取") : t("立即查看");
    })();

    /** 活动规则：把纯文本里的换行转成 <br/>，保证 rich-text 能正常换行 */
    const activityRulesNodes = useMemo(() => {
        const rules = (lotteryInfo?.decorateConfig?.activityRules ?? "") as unknown as string;
        if (!rules) return "";
        return String(rules).replace(/\r\n|\r|\n/g, "<br/>");
    }, [lotteryInfo]);

    /** 未中奖文案：默认“很遗憾 / 没有抽中”；若接口返回 noWinTips，则按前3个字换行，只显示两行 */
    const noWinTipsText = String(lotteryInfo?.noWinTips ?? "").trim();
    const loseLine1 = (() => {
        const tip = noWinTipsText;
        if (!tip) return t("很遗憾");
        return tip.slice(0, 3) || t("很遗憾");
    })();
    const loseLine2 = (() => {
        const tip = noWinTipsText;
        if (!tip) return t("没有抽中");
        return tip.slice(3) || t("没有抽中");
    })();

    /** 活动信息默认值（接口未开启/无数据时兜底展示） */
    const buildDefaultLotteryInfo = (): LotteryInfo => {
        const noWinName = t("谢谢参与");
        const noWinImage = "https://oss.tigshop.com/img/gallery/202512/1766467150H93CwsgU07PQfSqwj4.jpeg";
        return {
            activityId: 0,
            activityName: "",
            startTime: "",
            endTime: "",
            costPoints: 1,
            decorateConfig: {
                bgImage: "https://oss.tigshop.com/img/gallery/202512/1766469537jXrMsUPDXoszzk0KCC.jpeg",
                bgColor: "",
                prizeEntryImage: "",
                showWinnerList: 0,
                activityRules: ""
            },
            noWinName,
            noWinImage,
            noWinTips: t("很遗憾没有抽中"),
            gridConfig: Array.from({ length: 8 }, (_, i) => ({
                position: i + 1,
                prizeId: null,
                probability: 0,
                prizeName: noWinName,
                prizeImage: noWinImage,
                prizeType: 0,
                prizeValue: ""
            })),
            userPoints: 0,
            todayRemaining: 0,
            totalRemaining: 0,
            winRemaining: 0
        };
    };

    // ==================== 接口调用 ====================

    /** 获取活动信息 */
    const fetchLotteryInfo = async () => {
        try {
            // 请求层已解包 data，泛型仍沿用旧声明，此处按业务对象取值
            const res = (await getLotteryInfo()) as unknown as LotteryInfo | null;
            if (!res) {
                // 接口无活动：使用默认值兜底渲染（背景、九宫格占位、未中奖文案等）
                updateLotteryInfo(buildDefaultLotteryInfo());
                setNoActivityVisible(true);
            } else {
                updateLotteryInfo(res);
                setNoActivityVisible(false);
            }
            // 如果开启了中奖名单显示，获取中奖名单
            if ((res ?? lotteryInfoRef.current)?.decorateConfig?.showWinnerList === 1) {
                void fetchWinners();
            }
        } catch (error: any) {
            Taro.showToast({ title: error.message || t("获取活动信息失败"), icon: "none" });
        } finally {
            setIsLoading(false);
        }
    };

    /** 获取中奖名单 */
    const fetchWinners = async () => {
        try {
            const res = (await getWinners(lotteryInfoRef.current?.activityId)) as unknown as LotteryWinner[];
            setWinnerList(res || []);
            winnerListLengthRef.current = (res || []).length;
            // 开始轮播动画
            if ((res || []).length > 0) {
                startWinnerCarousel();
            }
        } catch (error: any) {
            console.error("获取中奖名单失败:", error);
        }
    };

    /** 开始中奖名单轮播 */
    const startWinnerCarousel = () => {
        // 清除之前的定时器
        if (winnerCarouselTimerRef.current) {
            clearInterval(winnerCarouselTimerRef.current);
        }
        // 每3秒切换一条
        winnerCarouselTimerRef.current = setInterval(() => {
            if (winnerListLengthRef.current > 0) {
                setCurrentWinnerIndex((index) => (index + 1) % winnerListLengthRef.current);
            }
        }, 3000);
    };

    /** 停止中奖名单轮播 */
    const stopWinnerCarousel = () => {
        if (winnerCarouselTimerRef.current) {
            clearInterval(winnerCarouselTimerRef.current);
            winnerCarouselTimerRef.current = null;
        }
    };

    /** 执行抽奖 */
    const handleDraw = async () => {
        if (isDrawingRef.current) return;
        if (!lotteryInfo) return;
        // 活动未开启：兜底数据只用于展示，不允许抽奖
        if (lotteryInfo.activityId <= 0) {
            // Taro.showToast({ title: t("暂无抽奖活动进行"), icon: "none" });
            return;
        }
        // todayRemaining / totalRemaining 为 -1 时表示不限制
        if (lotteryInfo.todayRemaining !== -1 && lotteryInfo.todayRemaining <= 0) {
            showTip(`${t("今日次数已用完，")}\n${t("明天再来")}`);
            return;
        }
        // 检查抽奖次数
        if (lotteryInfo.totalRemaining !== -1 && lotteryInfo.totalRemaining <= 0) {
            showTip(`${t("您的抽奖次数已用完，")}\n${t("感谢您的参与")}`);
            return;
        }

        // 检查积分
        if (lotteryInfo.userPoints < lotteryInfo.costPoints) {
            Taro.showToast({ title: t("积分不足"), icon: "none" });
            return;
        }

        isDrawingRef.current = true;
        // 记录开始抽奖前的位置，接口失败时回退
        lastStableIndexRef.current = activeIndexRef.current;

        try {
            // 开始动画
            startAnimation();

            // 调用抽奖接口
            const res = (await drawLottery()) as unknown as DrawResult;
            setDrawResult(res);

            // 更新剩余次数和积分
            const latestInfo = lotteryInfoRef.current;
            if (latestInfo) {
                updateLotteryInfo({
                    ...latestInfo,
                    todayRemaining: res.todayRemaining,
                    totalRemaining: res.totalRemaining,
                    userPoints: latestInfo.userPoints - latestInfo.costPoints
                });
            }

            // 动画停止在中奖位置
            await stopAnimation(res.position);
            lastStableIndexRef.current = res.position;

            // 只有“中奖”才刷新列表接口（中奖名单/我的中奖记录）
            if (res?.isWin) {
                if (lotteryInfoRef.current?.decorateConfig?.showWinnerList === 1) {
                    void fetchWinners();
                }
            }

            // 显示结果弹窗
            setResultPopupVisible(true);
        } catch (error: any) {
            Taro.showToast({ title: error.message || t("抽奖失败"), icon: "none" });
            // 抽奖失败：停止动画并回到上一次停留的位置
            if (animationTimerRef.current) {
                clearInterval(animationTimerRef.current);
                animationTimerRef.current = null;
            }
            if (Number.isFinite(lastStableIndexRef.current) && lastStableIndexRef.current !== -1) {
                updateActiveIndex(lastStableIndexRef.current);
            }
        } finally {
            isDrawingRef.current = false;
        }
    };

    /** 开始抽奖动画 */
    const startAnimation = () => {
        if (animationTimerRef.current) {
            clearInterval(animationTimerRef.current);
            animationTimerRef.current = null;
        }
        animationStepRef.current = 0;
        // 从当前高亮位置开始转（没有则从第一个开始）
        const startIdx = Math.max(0, animationOrder.indexOf(activeIndexRef.current));
        updateActiveIndex(animationOrder[startIdx]);
        animationTimerRef.current = setInterval(() => {
            updateActiveIndex(animationOrder[(startIdx + animationStepRef.current) % animationOrder.length]);
            animationStepRef.current++;
        }, 100);
    };

    /** 停止动画并定位到指定位置 */
    const stopAnimation = (targetPosition: number): Promise<void> => {
        return new Promise((resolve) => {
            if (animationTimerRef.current) {
                clearInterval(animationTimerRef.current);
                animationTimerRef.current = null;
            }

            // 计算剩余步数，确保至少转2圈后停在目标位置
            const currentIndex = Math.max(0, animationOrder.indexOf(activeIndexRef.current));
            const targetIndex = animationOrder.indexOf(targetPosition);
            if (targetIndex < 0) {
                updateActiveIndex(targetPosition);
                setTimeout(resolve, 300);
                return;
            }
            let remainingSteps = (targetIndex - currentIndex + animationOrder.length) % animationOrder.length;
            remainingSteps += animationOrder.length * 2; // 额外转2圈

            let step = 0;
            const tick = () => {
                updateActiveIndex(animationOrder[(currentIndex + step + 1) % animationOrder.length]);
                step++;
                if (step >= remainingSteps) {
                    updateActiveIndex(targetPosition);
                    setTimeout(resolve, 300);
                    return;
                }
                setTimeout(tick, 100 + step * 10); // 逐渐减速
            };
            setTimeout(tick, 100);
        });
    };

    /** 获取中奖记录 */
    const fetchRecords = async (reset = true) => {
        if (reset) {
            recordPageRef.current = 1;
            setRecordList([]);
        }

        setRecordLoading(true);
        try {
            const res = (await getMyRecords({ page: recordPageRef.current, size: 20 })) as any;
            if (reset) {
                setRecordList(res.records);
            } else {
                setRecordList((prev) => [...prev, ...res.records]);
            }
            recordTotalRef.current = res.total;
        } catch (error: any) {
            Taro.showToast({ title: error.message || t("获取记录失败"), icon: "none" });
        } finally {
            setRecordLoading(false);
        }
    };

    /** 加载更多记录 */
    const loadMoreRecords = () => {
        if (recordLoading) return;
        if (recordList.length >= recordTotalRef.current) return;
        recordPageRef.current++;
        void fetchRecords(false);
    };

    /** 打开记录弹窗 */
    const openRecordPopup = () => {
        setShowRecordPopup(true);
        void fetchRecords();
    };

    // ==================== 操作处理 ====================

    /** 解析奖品值 JSON（旧模板内联 JSON.parse，抽取为安全版本避免脏数据抛错中断渲染） */
    const parsePrizeValue = (value?: string): Record<string, any> => {
        try {
            return JSON.parse(value || "{}") || {};
        } catch {
            return {};
        }
    };

    /** 处理结果弹窗按钮点击 */
    const handleResultAction = () => {
        if (!drawResult) return;

        setResultPopupVisible(false);

        if (!drawResult.isWin) {
            // 未中奖 - 再抽一次
            setTimeout(() => {
                void handleDraw();
            }, 300);
            return;
        }

        // 根据奖品类型跳转
        switch (drawResult.prizeType) {
            case 1: // 积分
                redirect({ url: "/pages/user/point/detail" });
                break;
            case 2: // 商品 - 需要领取
                // 跳转到订单确认页
                redirect({
                    url: "/pages/order/confirm/index",
                    param: {
                        prizeId: drawResult.prizeId,
                        productId: drawResult.prizeValue,
                        fromLottery: 1
                    }
                });
                break;
            case 3: // 优惠券
                redirect({ url: "/pages/coupon/index?type=2" });
                break;
        }
    };

    /** 处理记录项操作 */
    const handleRecordAction = (record: PrizeRecord) => {
        console.log("record", record);
        // 积分/优惠券：始终可查看；其他类型：非未领取状态不操作
        if (![1, 3].includes(record.prizeType) && record.status !== 0) return;
        setShowRecordPopup(false);

        switch (record.prizeType) {
            case 1: // 积分
                redirect({ url: "/pages/user/point/detail" });
                break;
            case 2: // 商品
                // 跳转到订单确认页进行领取
                redirect({
                    url: "/pages/order/confirm/index",
                    param: {
                        recordId: record.recordId,
                        fromLottery: 1
                    }
                });
                break;
            case 3: // 优惠券
                redirect({ url: "/pages/coupon/index?type=2" });
                break;
        }
    };

    /** 获取记录操作按钮文字 */
    const getRecordActionText = (record: PrizeRecord): string => {
        // 积分/优惠券：显示“已发放”
        if ([1, 3].includes(record.prizeType)) return t("已发放");
        if (record.status === 1) return t("已领取");
        if (record.status === 2) return t("已过期");
        return record.prizeType === 2 ? t("立即领取") : t("立即查看");
    };

    // ==================== 生命周期 ====================

    // 对应旧 onLoad
    useEffect(() => {
        void fetchLotteryInfo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 对应旧 onUnload
    useUnload(() => {
        // 清除中奖名单轮播定时器
        stopWinnerCarousel();
        // 清除抽奖动画定时器
        if (animationTimerRef.current) {
            clearInterval(animationTimerRef.current);
            animationTimerRef.current = null;
        }
    });

    return (
        <TigLayout title={t("抽奖大转盘")}>
            <View className="lottery-page" style={contentStyle as any}>
                {/* 中奖滚动通知 */}
                {lotteryInfo?.decorateConfig.showWinnerList === 1 && winnerList.length > 0 && (
                    <View className="winner-notice">
                        <View className="winner-carousel">
                            <View key={currentWinnerIndex} className="winner-item">
                                <Text>
                                    {currentWinner?.nickname} {t("抽中了")} {currentWinner?.prizeName}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* 奖品按钮 */}
                <View className="prize-btn" onClick={openRecordPopup}>
                    <Image src={prizeEntryImage} mode="aspectFit" />
                    {/* <TigImage src={staticResource('/images/lottery/prize.png')} mode="aspectFit" /> */}
                </View>

                {/* 九宫格抽奖区域 */}
                <View className="lottery-container" style={lotteryContainerStyle as any}>
                    {/* 无活动常驻提示：放在抽奖区域内，绝对定位居中 */}
                    {noActivityVisible && (
                        <View className="no-activity-banner">{t("暂无抽奖活动进行")}</View>
                    )}
                    <View className="grid-lottery">
                        {gridCells.map((cell) => (
                            <View
                                key={cell.index}
                                className={`grid-cell ${cell.isCenter ? "is-center" : ""} ${
                                    !cell.isCenter && activeIndex === cell.position ? "is-active" : ""
                                }`}
                                onClick={() => {
                                    if (cell.isCenter) void handleDraw();
                                }}
                            >
                                {cell.isCenter ? (
                                    <View className="draw-btn">
                                        <Text className="draw-text">{t("抽奖")}</Text>
                                        {!!lotteryInfo?.costPoints && (
                                            <Text className="draw-point">
                                                {lotteryInfo.costPoints}
                                                {t("积分")}
                                            </Text>
                                        )}
                                    </View>
                                ) : (
                                    <>
                                        {cell.prizeImage && (
                                            <TigImage src={cell.prizeImage} className="award-img" mode="aspectFit" />
                                        )}
                                        <Text className="award-name">{cell.prizeName}</Text>
                                    </>
                                )}
                            </View>
                        ))}
                    </View>
                </View>

                {/* 剩余次数 / 不限制文案 */}
                {lotteryInfo && showRemainingInfo && (
                    <View className="remaining-times" style={remainingTimesStyle as any}>
                        {isUnlimitedAll ? (
                            <>
                                {t("每次抽奖消耗")}
                                <Text className="remaining-times-num">{lotteryInfo.costPoints || 0}</Text>
                                {t("积分")}
                            </>
                        ) : (
                            <>
                                {t("您还有")} <Text className="remaining-times-num">{remainingTimes}</Text> {t("次抽奖机会")}
                            </>
                        )}
                    </View>
                )}

                {/* 活动规则 */}
                <View className="rule-section">
                    <View className="rule-title">{t("活动规则")}</View>
                    <RichText className="rule-content" nodes={activityRulesNodes} />
                </View>
            </View>

            {/* 抽奖结果弹窗 */}
            <Popup
                visible={resultPopupVisible}
                position="center"
                closeable={false}
                closeOnOverlayClick
                className="result-popup-container"
                onClose={() => setResultPopupVisible(false)}
            >
                {drawResult && (
                    <View className="result-popup" style={resultPopupStyle as any}>
                        <View className="result-title">
                            {drawResult.isWin ? (
                                <>
                                    <View className="result-win">{t("恭喜你")}</View>
                                    <View className="result-win-big">{t("中奖了")}</View>
                                </>
                            ) : (
                                <>
                                    <View className="result-lose">{loseLine1}</View>
                                    <View className="result-lose-big">{loseLine2}</View>
                                </>
                            )}
                        </View>
                        <TigImage src={drawResult.prizeImage} className="result-image" mode="aspectFit" />
                        <Text className="result-prize-name">{drawResult.prizeName}</Text>
                        {drawResult.prizeType === 2 ? (
                            <Buy
                                id={Number(parsePrizeValue(drawResult.prizeValue)?.productId) || 0}
                                skuId={Number(parsePrizeValue(drawResult.prizeValue)?.skuId) || 0}
                                lotteryRecordId={drawResult.recordId}
                                isQuick
                                onCallback={() => setResultPopupVisible(false)}
                            >
                                <View className="result-btn">{resultActionText}</View>
                            </Buy>
                        ) : (
                            <View className="result-btn" onClick={handleResultAction}>
                                {resultActionText}
                            </View>
                        )}
                    </View>
                )}
                <View
                    className="iconfont-h5 icon-jiaochacross80 close-btn"
                    onClick={() => setResultPopupVisible(false)}
                />
            </Popup>

            {/* 提示弹窗：用于支持换行的提示文案（showToast 在部分端不支持 \n） */}
            <Popup
                visible={tipPopupVisible}
                position="center"
                closeable={false}
                closeOnOverlayClick={false}
                className="tip-popup-container"
            >
                <View className="tip-popup">
                    <Text className="tip-popup-text">{tipMessage}</Text>
                </View>
            </Popup>

            {/* 中奖记录弹窗 */}
            <Popup visible={showRecordPopup} position="bottom" round onClose={() => setShowRecordPopup(false)}>
                <View className="record-popup">
                    <View className="record-header">
                        <Text className="record-title">{t("奖品")}</Text>
                    </View>
                    <ScrollView scrollY className="record-list" onScrollToLower={loadMoreRecords}>
                        {recordList.map((record) => (
                            <View key={record.recordId} className="record-item">
                                <TigImage src={record.prizeImage} className="record-image" mode="aspectFit" />
                                <Text className="record-name">{record.prizeName}</Text>
                                {record.prizeType === 2 ? (
                                    <Buy
                                        id={Number(parsePrizeValue(record.prizeValue)?.productId) || 0}
                                        skuId={Number(parsePrizeValue(record.prizeValue)?.skuId) || 0}
                                        isQuick
                                        lotteryRecordId={record.recordId}
                                        onCallback={() => setShowRecordPopup(false)}
                                    >
                                        <View className={`record-btn ${record.status !== 0 ? "disabled" : ""}`}>
                                            {getRecordActionText(record)}
                                        </View>
                                    </Buy>
                                ) : (
                                    <View
                                        className={`record-btn ${
                                            [1, 3].includes(record.prizeType) ? "disabled" : record.status !== 0 ? "disabled" : ""
                                        }`}
                                        onClick={() => handleRecordAction(record)}
                                    >
                                        {getRecordActionText(record)}
                                    </View>
                                )}
                            </View>
                        ))}
                        <LoadingBox
                            modelValue={recordLoading}
                            page={recordPageRef.current}
                            length={recordList.length}
                        />
                        {recordList.length === 0 && !recordLoading && (
                            <View style={{ marginTop: "200rpx" }}>
                                <EmptyBox background="transparent" height="auto" text={t("暂无中奖记录")} />
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Popup>

            <TigLoadingPage modelValue={isLoading} />
        </TigLayout>
    );
}