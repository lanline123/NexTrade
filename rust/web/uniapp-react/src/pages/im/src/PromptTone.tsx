import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { staticResource } from "@/utils";

import "./PromptTone.scss";

export interface PromptToneRef {
    play: () => void;
}

/**
 * 消息提示音组件（自旧 pages/im/src/promptTone.vue 移植）
 * - 新消息到达时播放提示音
 * - 旧 onUnload 的 destroy 改为 React 卸载清理
 */
const PromptTone = forwardRef<PromptToneRef>(function PromptTone(_props, ref) {
    const audioRef = useRef<ReturnType<typeof Taro.createInnerAudioContext> | null>(null);
    const isPlaying = useRef(false);

    useEffect(() => {
        const audio = Taro.createInnerAudioContext();
        audio.src = staticResource("promptTone.wav", "audio");
        audio.onEnded(() => {
            isPlaying.current = false;
        });
        audioRef.current = audio;

        return () => {
            if (audioRef.current != null) {
                audioRef.current.destroy();
                audioRef.current = null;
            }
        };
    }, []);

    useImperativeHandle(ref, () => ({
        play: () => {
            if (audioRef.current != null && !isPlaying.current) {
                audioRef.current.seek(1);
                audioRef.current.play();
                isPlaying.current = true;
            }
        }
    }));

    return <View className="prompt-tone" />;
});

export default PromptTone;