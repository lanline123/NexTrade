import { forwardRef, useImperativeHandle, useMemo } from "react";
import { ScrollView, Text, View } from "@tarojs/components";

import "./EmojiPicker.scss";

export interface EmojiPickerRef {
    /** 旧 defineExpose inputFocus：原实现依赖未挂载的 inputRefEmoji，这里保留空实现兼容调用点 */
    inputFocus: () => void;
}

interface Props {
    /** 旧 @insert-emoji */
    onInsertEmoji?: (emoji: string) => void;
    /** 旧 @close-emoji-picker */
    onCloseEmojiPicker?: () => void;
}

const generateEmojis = () => {
    const emojiArray: string[] = [];
    const start = 0x1f600;
    for (let i = 0; i < 80; i++) {
        emojiArray.push(String.fromCodePoint(start + i));
    }
    return emojiArray;
};

/**
 * 表情选择器组件（自旧 buyerShowCompnents/emojiPicker.vue 移植）
 * - 评论时选择表情
 * - 旧 scroll-view scroll-x → Taro ScrollView scrollX
 */
const EmojiPicker = forwardRef<EmojiPickerRef, Props>(function EmojiPicker({ onInsertEmoji, onCloseEmojiPicker }, ref) {
    const emojis = useMemo(() => generateEmojis(), []);

    useImperativeHandle(ref, () => ({
        inputFocus: () => {
            // TODO(MIGRATION)：旧实现调用了从未赋值的 inputRefEmoji，行为等价于空实现
        }
    }));

    // 插入表情到输入框
    const insertEmoji = (emoji: string) => {
        console.log(emoji, 222);
        onInsertEmoji?.(emoji);
    };

    return (
        <View className="emoji-picker">
            <ScrollView scrollX className="emoji-picker-box">
                <View className="emoji-content">
                    {emojis.map((emoji, index) => (
                        <Text
                            key={index}
                            className="emoji-item"
                            onTouchEnd={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                insertEmoji(emoji);
                            }}
                        >
                            {emoji}
                        </Text>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
});

export default EmojiPicker;