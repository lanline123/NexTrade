import { Image, View } from "@tarojs/components";

import type { CommentItem } from "@/types/product/product";
import { hideUserName, imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    item: CommentItem;
    /** 对应旧 Vue class 透传（如 evaluateCard 传入 evaluate-item） */
    className?: string;
}

/**
 * 评价条目（自旧 pages/product/src/commentItem.vue 移植）
 * - 用户头像 + 昵称 + 时间 + 评价内容（3 行截断）
 */
export default function CommentItem({ item, className }: Props) {
    return (
        <View className={`comment-item ${className ?? ""}`}>
            <View className="comment-item-header">
                <View className="header-left">
                    <View className="header-picture">
                        {/* 原 <image :src="imageFormat(item.avatar || '')"> → Taro Image（element 选择器改 .header-picture-img） */}
                        <Image className="header-picture-img" src={imageFormat(item.avatar || "")} />
                    </View>
                    <View className="user-info">
                        <View className="header-name">{hideUserName(item.username || t("匿名用户"))}</View>
                    </View>
                </View>
                <View className="header-time">{item.addTime}</View>
            </View>
            <View className="comment-con">
                <View className="con-text">{item.content}</View>
            </View>
        </View>
    );
}
