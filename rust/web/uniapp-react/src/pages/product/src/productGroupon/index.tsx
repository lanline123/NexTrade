import { useEffect, useMemo, useState } from "react";
import { Text, View } from "@tarojs/components";

import { imageFormat, hideUserName } from "@/utils/format";
import type { GrouponRecordItem } from "@/types/groupon/groupon";
import { redirect } from "@/utils";
import TigImage from "@/components/tig/tig-image/TigImage";
import { useConfigStore } from "@/store/config";
import { useUserStore } from "@/store/user";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    groups?: GrouponRecordItem[];
    padding?: string;
    bottomBorder?: boolean;
    vortmall?: boolean;
    /** 对应旧 emit("joinClick", item) */
    onJoinClick?: (item: GrouponRecordItem) => void;
}

/**
 * 拼团卡片组件（自旧 pages/product/src/productGroupon.vue 移植）
 * - 显示发起人头像和参团人数
 * - 倒计时显示还差几人成团
 * - 一键参团按钮
 * - 旧 commonCountdown（内部 uni-countdown 每秒刷新，插槽渲染天/时/分/秒）→ 本组件内 ticking 倒计时
 */
export default function ProductGroupon({ groups = [], padding = "0 40rpx", bottomBorder = false, vortmall = false, onJoinClick }: Props) {
    const configStore = useConfigStore();
    const userStore = useUserStore();

    /* 时间字符串转时间戳（与旧 dateStringToTimestamp 同逻辑） */
    const dateStringToTimestamp = (dateString: any) => {
        const dateParts = dateString.split(" ");
        const [year, month, day] = dateParts[0].split("-");
        const [hour, minute, second] = dateParts[1].split(":");
        const date = new Date(year, month - 1, day, hour, minute, second);
        return date.getTime();
    };

    const formatTime = (time: string): string => {
        return time?.toString().padStart(2, "0") || "00";
    };

    /**
     * 团是否结束了
     */
    const isGroupEnd = (item: GrouponRecordItem) => {
        // 不是待成团的状态，拼团结束了
        if (item.joinStatus !== 1) {
            return true;
        }
        if (!item.endTime) {
            return true;
        }
        const endTime = dateStringToTimestamp(item.endTime);
        return endTime < new Date().getTime();
    };

    const isMyGroup = (item: GrouponRecordItem) => {
        // 如果joinUser是数组
        if (Array.isArray(item.joinUser)) {
            return item.joinUser.some((user) => user.leader && user.userId === userStore.userInfo?.userId);
        }
        return item.joinUser.leader && item.joinUser.userId === userStore.userInfo?.userId;
    };

    /*
     * 点击去参团
     */
    const handleJoinClick = (item: GrouponRecordItem) => {
        onJoinClick?.(item);
    };

    /**
     * 展示拼团详情
     * @param item 点击的拼团项目
     */
    const showDetail = (item: GrouponRecordItem) => {
        redirect({
            url: `/pages/product/groupBuying?grouponPromotionRecordId=${item.grouponPromotionRecordId}`
        });
    };

    /* 旧 commonCountdown 每秒刷新 timeData；React 下用一个 1s 定时器驱动 now，各 item 的剩余时间随之重算 */
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => {
            clearInterval(timer);
        };
    }, []);

    /* 对应旧模板内 commonCountdown 插槽的 days/hours/minutes/seconds（按 specifyTime 时间戳计算剩余） */
    const remainMap = useMemo(() => {
        const map: Record<number, { days: string; hours: string; minutes: string; seconds: string; ended: boolean }> = {};
        groups.forEach((item) => {
            const endTimestamp = dateStringToTimestamp(item.endTime);
            let diff = endTimestamp - now;
            const ended = diff <= 0;
            if (diff < 0) diff = 0;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            diff -= days * (1000 * 60 * 60 * 24);
            const hours = Math.floor(diff / (1000 * 60 * 60));
            diff -= hours * (1000 * 60 * 60);
            const minutes = Math.floor(diff / (1000 * 60));
            diff -= minutes * (1000 * 60);
            const seconds = Math.floor(diff / 1000);
            map[item.grouponPromotionRecordId] = {
                days: String(days),
                hours: formatTime(String(hours)),
                minutes: formatTime(String(minutes)),
                seconds: formatTime(String(seconds)),
                ended
            };
        });
        return map;
    }, [groups, now]);

    return (
        <View className={`group-list ${vortmall ? "group-list--vortmall" : ""}`} style={{ padding: padding }}>
            {groups.map((item) => (
                <View
                    key={item.grouponPromotionRecordId}
                    className={`group-item ${bottomBorder ? "border" : ""}`}
                >
                    <View className="group-item-info" onClick={() => showDetail(item)}>
                        <View className="info-image">
                            <TigImage src={imageFormat(item.joinUser.avatar || configStore.defaultAvatar)} mode="aspectFill" />
                        </View>
                        <Text className="info-name">{hideUserName(item.joinUser.username)}</Text>
                    </View>
                    <View className="group-item-operation">
                        <View className="operation-time">
                            <View className="person">
                                <Text>{t("还差")}</Text>
                                <Text className="num">{item.joinNumCount > item.minGroupNum ? 0 : item.minGroupNum - item.joinNumCount}</Text>
                                <Text>{t("人")}</Text>
                            </View>
                            <View className="countdown-box">
                                {!isGroupEnd(item) ? (
                                    <>
                                        <Text>{t("剩余")}</Text>
                                        {/* 旧 <commonCountdown countdown-type="specifyTime" :specify-time="dateStringToTimestamp(item.endTime)"> 插槽 → 本地倒计时渲染 */}
                                        <View className="countdown">
                                            <View className="countdown-text">
                                                {remainMap[item.grouponPromotionRecordId]?.days ? <Text>{remainMap[item.grouponPromotionRecordId].days}</Text> : null}
                                                {remainMap[item.grouponPromotionRecordId]?.days ? (
                                                    <Text>{t("天")}&nbsp;</Text>
                                                ) : null}
                                                <Text className="countdown-bg">{remainMap[item.grouponPromotionRecordId]?.hours}</Text>
                                                <Text>&nbsp;:&nbsp;</Text>
                                                <Text className="countdown-bg">{remainMap[item.grouponPromotionRecordId]?.minutes}</Text>
                                                <Text>&nbsp;:&nbsp;</Text>
                                                <Text className="countdown-bg">{remainMap[item.grouponPromotionRecordId]?.seconds}</Text>
                                            </View>
                                        </View>
                                        <Text>{t("结束")}</Text>
                                    </>
                                ) : (
                                    <Text>{t("已结束")}</Text>
                                )}
                            </View>
                        </View>
                        <View>
                            {/* 旧 <tig-button color="var(--main-bg)" :disabled :custom-style="{width:'136rpx',height:'59rpx',borderRadius:'6rpx',fontSize:'28rpx'}"> → 按视觉重写 */}
                            <View
                                className="join-btn"
                                style={{
                                    width: "136rpx",
                                    height: "59rpx",
                                    borderRadius: "6rpx",
                                    fontSize: "28rpx",
                                    background: "var(--main-bg)",
                                    color: "#fff",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    opacity: isMyGroup(item) || isGroupEnd(item) ? 0.5 : 1
                                }}
                                onClick={() => {
                                    if (isMyGroup(item) || isGroupEnd(item)) return;
                                    handleJoinClick(item);
                                }}
                            >
                                {t("去参团")}
                            </View>
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );
}
