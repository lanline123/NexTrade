import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { useThemeStore } from "@/store/theme";
import { getElementRect } from "@/utils";
import { t } from "@/utils/i18n";

import "./Animation.scss";

// 自旧 pages/order/src/animation.vue 移植（B3 交易链路第四批）
/**
 * 画布动画组件（支付成功页的圆环打勾动画）
 * - 圆环进度 → 缩放 → 打勾 的帧动画（旧 uni.createCanvasContext → Taro.createCanvasContext）
 * - 支持 resetAnimation/startAnimation/stopAnimation（旧 defineExpose → ref 转发）
 */
interface ElementRect {
    width: number;
    height: number;
    left: number;
    top: number;
}

interface CheckPoint {
    x: number;
    y: number;
}

interface AnimationState {
    step: AnimationStep;
    progress: number;
    scale: number;
    checkProgress: number;
}

enum AnimationStep {
    CIRCLE_PROGRESS = 0,
    SCALE_UP = 1,
    SCALE_DOWN = 2,
    CHECK_MARK = 3,
    FINISHED = 4
}

const ANIMATION_CONFIG = {
    PROGRESS_SPEED: 0.03,
    SCALE_UP_SPEED: 0.08,
    SCALE_DOWN_SPEED: 0.04,
    CHECK_SPEED: 0.06,
    MAX_SCALE: 1.1,
    MIN_SCALE: 1,
    FRAME_RATE: 16,
    RADIUS_RATIO: 0.75,
    LINE_WIDTH_RATIO: 0.2,
    CHECK_LINE_WIDTH_RATIO: 0.2,
    STEP_DELAY: {
        SCALE_UP: 50,
        CHECK_MARK: 25
    }
} as const;

const CHECK_COLOR = "#fff";

export interface AnimationRef {
    resetAnimation: () => void;
    startAnimation: () => void;
    stopAnimation: () => void;
}

export default function Animation(_props: {}, ref?: any) {
    const themeStyle = useThemeStore((s) => s.themeStyle);

    const [centerX, setCenterX] = useState(0);
    const [centerY, setCenterY] = useState(0);
    const [radius, setRadius] = useState(0);

    // 旧 animationState ref：帧循环内高频就地改写，沿用可变 ref + 手动 rerender 先例
    const [, rerender] = useState(0);
    const animationStateRef = useRef<AnimationState>({
        step: AnimationStep.CIRCLE_PROGRESS,
        progress: 0,
        scale: 1,
        checkProgress: 0
    });
    const animationState = animationStateRef.current;

    const contextRef = useRef<any>(null);
    const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const canvasSizeRef = useRef({ width: 0, height: 0 });

    const checkPoints: CheckPoint[] = useMemo(
        () => [
            { x: -radius * 0.3, y: 0 },
            { x: 0, y: radius * 0.3 },
            { x: radius * 0.6, y: -radius * 0.3 }
        ],
        [radius]
    );

    const isAnimationRunning = animationState.step !== AnimationStep.FINISHED;

    const getInteger = (num: number): number => Math.ceil(num);

    const roundToThreeDecimals = (num: number): number => Math.round(num * 1000) / 1000;

    const stopAnimation = (): void => {
        if (animationTimerRef.current) {
            clearTimeout(animationTimerRef.current);
            animationTimerRef.current = null;
        }
    };

    const startAnimation = (): void => {
        if (animationTimerRef.current || !contextRef.current) return;
        draw();
    };

    const resetAnimation = (): void => {
        stopAnimation();
        animationStateRef.current = {
            step: AnimationStep.CIRCLE_PROGRESS,
            progress: 0,
            scale: 1,
            checkProgress: 0
        };
        rerender((c) => c + 1);

        const context = contextRef.current;
        if (context && canvasSizeRef.current.width > 0) {
            context.clearRect(0, 0, canvasSizeRef.current.width, canvasSizeRef.current.height);
            context.draw(true);
        }
    };

    const drawCircleProgress = (): void => {
        const context = contextRef.current;
        const { progress } = animationStateRef.current;

        context.save();
        context.beginPath();
        context.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false);
        context.setStrokeStyle(themeStyle["--general"]);
        context.setLineWidth(radius * ANIMATION_CONFIG.LINE_WIDTH_RATIO);
        context.setLineCap("round");
        context.stroke();
        context.restore();

        animationStateRef.current.progress += ANIMATION_CONFIG.PROGRESS_SPEED;

        if (animationStateRef.current.progress >= 1) {
            animationStateRef.current.progress = 1;
            setTimeout(() => {
                animationStateRef.current.step = AnimationStep.SCALE_UP;
            }, ANIMATION_CONFIG.STEP_DELAY.SCALE_UP);
        }
    };

    const drawScaleAnimation = (): void => {
        const context = contextRef.current;
        const { step, scale } = animationStateRef.current;
        const scaleNum = roundToThreeDecimals(scale);

        if (scaleNum < ANIMATION_CONFIG.MAX_SCALE && step === AnimationStep.SCALE_UP) {
            animationStateRef.current.scale += ANIMATION_CONFIG.SCALE_UP_SPEED;
        } else if (scaleNum >= ANIMATION_CONFIG.MAX_SCALE && step === AnimationStep.SCALE_UP) {
            animationStateRef.current.step = AnimationStep.SCALE_DOWN;
        }

        if (step === AnimationStep.SCALE_DOWN) {
            animationStateRef.current.scale -= ANIMATION_CONFIG.SCALE_DOWN_SPEED;
            if (scaleNum <= ANIMATION_CONFIG.MIN_SCALE) {
                animationStateRef.current.scale = ANIMATION_CONFIG.MIN_SCALE;
                setTimeout(() => {
                    animationStateRef.current.step = AnimationStep.CHECK_MARK;
                }, ANIMATION_CONFIG.STEP_DELAY.CHECK_MARK);
            }
        }

        context.save();
        context.translate(centerX, centerY);

        if (step === AnimationStep.SCALE_UP) {
            context.scale(animationStateRef.current.scale, animationStateRef.current.scale);
        }

        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2, false);
        context.setFillStyle(themeStyle["--general"]);
        context.fill();
        context.restore();
    };

    const drawCheckMarkPath = (context: any): void => {
        const { checkProgress } = animationStateRef.current;
        const points = checkPoints;

        const len1 = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        const len2 = Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y);
        const totalLen = len1 + len2;
        const drawLen = totalLen * checkProgress;

        context.beginPath();
        context.moveTo(points[0].x, points[0].y);

        if (drawLen <= len1) {
            const ratio = drawLen / len1;
            context.lineTo(points[0].x + (points[1].x - points[0].x) * ratio, points[0].y + (points[1].y - points[0].y) * ratio);
        } else {
            context.lineTo(points[1].x, points[1].y);
            const ratio = (drawLen - len1) / len2;
            context.lineTo(points[1].x + (points[2].x - points[1].x) * ratio, points[1].y + (points[2].y - points[1].y) * ratio);
        }
    };

    const drawCheckMark = (): void => {
        const context = contextRef.current;
        context.save();
        context.translate(centerX, centerY);
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2, false);
        context.setFillStyle(themeStyle["--general"]);
        context.fill();
        context.restore();

        context.save();
        context.translate(centerX * 0.9, centerY);
        context.setStrokeStyle(CHECK_COLOR);
        context.setLineWidth(radius * ANIMATION_CONFIG.CHECK_LINE_WIDTH_RATIO);
        context.setLineCap("round");

        drawCheckMarkPath(context);

        context.stroke();
        context.restore();

        animationStateRef.current.checkProgress += ANIMATION_CONFIG.CHECK_SPEED;

        if (animationStateRef.current.checkProgress >= 1) {
            animationStateRef.current.checkProgress = 1;
            animationStateRef.current.step = AnimationStep.FINISHED;
        }
    };

    const draw = (): void => {
        const context = contextRef.current;
        if (!context) {
            console.error("画布上下文未初始化");
            return;
        }

        context.clearRect(0, 0, canvasSizeRef.current.width, canvasSizeRef.current.height);

        const step = animationStateRef.current.step;
        switch (step) {
            case AnimationStep.CIRCLE_PROGRESS:
                drawCircleProgress();
                break;
            case AnimationStep.SCALE_UP:
            case AnimationStep.SCALE_DOWN:
                drawScaleAnimation();
                break;
            case AnimationStep.CHECK_MARK:
                drawCheckMark();
                break;
            case AnimationStep.FINISHED:
                stopAnimation();
                return;
            default:
                console.warn("未知动画步骤", animationStateRef.current.step);
                return;
        }

        context.draw(true);

        if (animationStateRef.current.step !== AnimationStep.FINISHED) {
            animationTimerRef.current = setTimeout(draw, ANIMATION_CONFIG.FRAME_RATE);
        }
    };

    const handleCanvasError = (error: any): void => {
        console.error(error);
        stopAnimation();
    };

    const initializeCanvas = async (): Promise<void> => {
        try {
            const res = (await getElementRect(".canvas-content")) as unknown as ElementRect | null;

            if (!res || !res.width || !res.height) {
                throw new Error(t("无法获取画布尺寸"));
            }
            const cx = getInteger(res.width / 2);
            const cy = getInteger(res.height / 2);
            const r = getInteger(Math.min(res.width, res.height) / 2) * ANIMATION_CONFIG.RADIUS_RATIO;
            setCenterX(cx);
            setCenterY(cy);
            setRadius(r);
            canvasSizeRef.current = { width: cx * 2, height: cy * 2 };

            // 旧 uni.createCanvasContext("myCanvas", instance) → Taro.createCanvasContext
            contextRef.current = Taro.createCanvasContext("myCanvas");

            if (!contextRef.current) {
                throw new Error(t("无法创建画布上下文"));
            }

            startAnimation();
        } catch (error) {
            console.error("动画初始化失败", error);
            stopAnimation();
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            initializeCanvas();
        }, 300);
        return () => {
            clearTimeout(timer);
            stopAnimation();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 defineExpose → ref 转发（resetAnimation/startAnimation/stopAnimation）
    useEffect(() => {
        if (ref) {
            if (typeof ref === "function") {
                ref({ resetAnimation, startAnimation, stopAnimation });
            } else {
                ref.current = { resetAnimation, startAnimation, stopAnimation };
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    });

    return (
        // 旧 <canvas id="myCanvas" class="canvas-content" hidpi canvas-id="myCanvas">
        <Canvas id="myCanvas" canvasId="myCanvas" className="canvas-content" onError={handleCanvasError} />
    );
}
