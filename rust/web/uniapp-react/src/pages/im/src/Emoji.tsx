import { Text, View } from "@tarojs/components";

import EmojiImage from "./EmojiImage";
import emojiElements from "./emojiElements";

import "./Emoji.scss";

interface Props {
    onInsertEmoji?: (emoji: string) => void;
}

/**
 * 表情选择面板组件（自旧 pages/im/src/Emoji.vue 移植）
 * - 展示可选表情列表
 * - 点击表情插入到输入框
 */
export default function Emoji({ onInsertEmoji }: Props) {
    const insertEmoji = (emoji: string) => {
        onInsertEmoji?.(emoji);
    };

    return (
        <View className="picker_body">
            <View className="emojipicker">
                <View className="list">
                    {emojiElements.map((item) => (
                        <View key={item.id} className="item" onClick={() => insertEmoji(item.name)}>
                            <Text>
                                <Text className="byte-tooltip__wrapper">
                                    <EmojiImage id={item.id} className="image" />
                                </Text>
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}