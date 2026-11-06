import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View, Text, Image } from "@tarojs/components";

import { aesEncrypt } from "@/utils/crypto";
import { verificationCaptcha, verificationCheck } from "@/api/verification";
import { getElementRect } from "@/utils";
import { t } from "@/utils/i18n";

import "./VerifySlide.scss";

interface Props {
    /** 旧 Verify.vue 传入但未在本组件声明（Vue $attrs），保留参数面以对齐旧调用 */
    figure?: number;
    arith?: number;
    mode?: string;
    vSpace?: number;
    captchaType?: string;
    imgSize?: { width: string; height: string };
    explain?: string;
    blockSize?: { width: number; height: number };
    barSize?: { width: string; height: string };
    barMarginTop?: number;
    onClose?: () => void;
    onSuccess?: (res: { verifyToken: string }) => void;
}

/**
 * 滑块拼图验证码（自旧 components/verifition/Verify/VerifySlide.vue 移植）
 * - 拉取 base64 背景图/拼图块，滑块拖动校验 point 后回调 verifyToken
 * - 触摸 + PC 鼠标双事件；AES 加密 pointJson（utils/crypto aesEncrypt）
 */
const VerifySlide = forwardRef<{ refresh: () => void }, Props>(function VerifySlide(
    { captchaType = "blockPuzzle", imgSize = { width: "310px", height: "155px" }, explain = "", blockSize = { width: 50, height: 50 }, barSize = { width: "310px", height: "40px" }, barMarginTop = 8, onClose, onSuccess },
    ref
) {
    const displayExplain = explain || t("向右拖动滑块填充拼图");

    const [passFlag, setPassFlag] = useState(false);
    const [backImgBase, setBackImgBase] = useState("");
    const [blockBackImgBase, setBlockBackImgBase] = useState("");
    const backTokenRef = useRef("");
    const secretKeyRef = useRef("");
    const [tipWords, setTipWords] = useState("");
    // 移动开始/结束时间用 ref：end() 里 set 后同步就要在 __verificationCheck 里读，useState 会拿到旧值（旧 Vue ref 是同步语义）
    const startMoveTimeRef = useRef(0); //移动开始的时间
    const endMovetimeRef = useRef(0);

    const getPictrue = async () => {
        try {
            const res = await verificationCaptcha({ captchaType });
            setBackImgBase(res.originalImageBase64);
            setBlockBackImgBase(res.jigsawImageBase64);
            backTokenRef.current = res.token;
            secretKeyRef.current = res.secretKey;
        } catch (error: any) {
            console.error(error);
            setTipWords(error.message);
        }
    };

    const [showRefresh, setShowRefresh] = useState(false);
    const [finishText, setFinishText] = useState("");
    const [moveBlockLeft, setMoveBlockLeft] = useState("");
    const [leftBarWidth, setLeftBarWidth] = useState("");
    const [moveBlockBackgroundColor, setMoveBlockBackgroundColor] = useState("");
    const [leftBarBorderColor, setLeftBarBorderColor] = useState("#ddd");
    const [leftBarBackgroundColor, setLeftBarBackgroundColor] = useState("#d1e0f1");
    const [iconColor, setIconColor] = useState("");
    const [iconClass, setIconClass] = useState("icon-right");
    const [status, setStatus] = useState(false); //鼠标状态
    const [isEnd, setIsEnd] = useState(false); //是够验证完成
    const [transitionLeft, setTransitionLeft] = useState("");
    const [transitionWidth, setTransitionWidth] = useState("");
    const [startLeft, setStartLeft] = useState(0);
    const [text, setText] = useState("");
    const [barArea, setBarArea] = useState({
        left: 0,
        top: 0,
        width: 0,
        height: 0
    });

    // 状态量供 document 级鼠标事件闭包读取（对齐旧 ref 语义）
    const statusRef = useRef(false);
    const isEndRef = useRef(false);
    useEffect(() => {
        statusRef.current = status;
    }, [status]);
    useEffect(() => {
        isEndRef.current = isEnd;
    }, [isEnd]);

    const getBarArea = async () => {
        try {
            // 旧实现传 getCurrentInstance()；React 版为页面级单例弹层，直接页面级查询
            const res = await getElementRect(".verify-bar-area");
            if (res) {
                setBarArea(res);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const STD_WIDTH = 310;
    const DEFAULT_Y_POS = 5.0;

    const UI_COLORS: Record<"active" | "success" | "error" | "default", { block: string; border: string; background: string; icon: string }> = {
        active: {
            block: "#1991fa",
            border: "#1991fa",
            background: "#d1e0f1",
            icon: "#fff"
        },
        success: {
            block: "#52ccba",
            border: "#52ccba",
            background: "#d2f4ef",
            icon: "#fff"
        },
        error: {
            block: "#d9534f",
            border: "#d9534f",
            background: "#fce1e1",
            icon: "#fff"
        },
        default: {
            block: "#fff",
            border: "#ddd",
            background: "#d1e0f1",
            icon: "#666"
        }
    };

    const applyUIColors = (type: "active" | "success" | "error" | "default") => {
        const colors = UI_COLORS[type];
        setMoveBlockBackgroundColor(colors.block);
        setLeftBarBorderColor(colors.border);
        setLeftBarBackgroundColor(colors.background);
        setIconColor(colors.icon);
    };

    const movePosCalc = (x: number, currentStartLeft: number) => {
        const barAreaLeft = barArea?.left || 0;

        const blockWidth = Number(blockSize.width);
        const halfBlockWidth = blockWidth / 2;
        const maxWidth = (barArea?.width || 0) - halfBlockWidth - 2;

        let movePos = x - barAreaLeft;
        movePos = Math.max(halfBlockWidth, Math.min(movePos, maxWidth));

        const offset = movePos - currentStartLeft;

        setMoveBlockLeft(`${offset}px`);
        setLeftBarWidth(`${offset + 40}px`);
    };

    const start = (e: any) => {
        try {
            if (isEnd) return;

            const x = e.touches[0].clientX;
            const currentStartLeft = Math.floor(x - barArea.left);
            setStartLeft(currentStartLeft);
            startMoveTimeRef.current = Date.now();

            setText("");
            applyUIColors("active");
            setStatus(true);
        } catch (err) {
            console.error("滑块验证初始化错误:", err);
        }
    };

    const move = (e: any) => {
        try {
            if (!status || isEnd) return;

            const x = e.touches[0].clientX;
            movePosCalc(x, startLeft);
        } catch (err) {
            console.error("滑块移动处理错误:", err);
        }
    };

    const __verificationCheck = async (moveLeftDistance: number) => {
        try {
            const data = {
                captchaType,
                pointJson: createPointJson(moveLeftDistance),
                token: backTokenRef.current
            };

            const result = await verificationCheck(data);
            console.log("验证结果:", result);
            if (result.token) {
                applyUIColors("success");
                setIconClass("icon-check");
                setShowRefresh(false);
                setIsEnd(true);
                setPassFlag(true);

                const verifyTime = ((endMovetimeRef.current - startMoveTimeRef.current) / 1000).toFixed(2);
                setTipWords(t("{0}s验证成功", { 0: verifyTime }));

                const point = { x: moveLeftDistance, y: DEFAULT_Y_POS };
                const pointStr = JSON.stringify(point);
                const captchaVerification = secretKeyRef.current
                    ? aesEncrypt(backTokenRef.current + "---" + pointStr, secretKeyRef.current)
                    : backTokenRef.current + "---" + pointStr;

                setTimeout(() => {
                    setTipWords("");
                    onClose?.();
                    onSuccess?.({ verifyToken: captchaVerification });
                }, 1000);
            } else {
                handleVerificationFailure();
            }
        } catch (error) {
            console.error(error);
            handleVerificationFailure();
        } finally {
            setStatus(false);
        }
    };

    const getScaledDistance = () => {
        const moveLeftDistance = parseInt((moveBlockLeft || "0").replace("px", ""));

        const imgWidth = parseInt(imgSize.width) || STD_WIDTH;
        return (moveLeftDistance * STD_WIDTH) / imgWidth;
    };

    const createPointJson = (x: number) => {
        const point = { x, y: DEFAULT_Y_POS };
        return secretKeyRef.current ? aesEncrypt(JSON.stringify(point), secretKeyRef.current) : JSON.stringify(point);
    };

    const end = () => {
        try {
            endMovetimeRef.current = Date.now();

            if (!status || isEnd) return;

            const moveDistance = getScaledDistance();

            __verificationCheck(moveDistance);
        } catch (err) {
            console.error("滑块验证结束处理错误:", err);
            refresh();
        }
    };

    // PC端鼠标事件
    const moveByMouse = (e: MouseEvent) => {
        try {
            if (!statusRef.current || isEndRef.current) return;

            const x = e.clientX;
            const barAreaLeft = barArea?.left || 0;

            const blockWidth = Number(blockSize.width);
            const halfBlockWidth = blockWidth / 2;
            const maxWidth = (barArea?.width || 0) - halfBlockWidth - 2;

            let movePos = x - barAreaLeft;
            movePos = Math.max(halfBlockWidth, Math.min(movePos, maxWidth));

            const offset = movePos - startLeft;

            setMoveBlockLeft(`${offset}px`);
            setLeftBarWidth(`${offset + 40}px`);
        } catch (err) {
            console.error("滑块移动处理错误:", err);
        }
    };

    const endByMouse = () => {
        try {
            // 移除全局事件监听
            document?.removeEventListener("mousemove", moveByMouse);
            document?.removeEventListener("mouseup", endByMouse);

            endMovetimeRef.current = Date.now();

            if (!statusRef.current || isEndRef.current) return;

            const moveDistance = getScaledDistance();

            __verificationCheck(moveDistance);
        } catch (err) {
            console.error("滑块验证结束处理错误:", err);
            refresh();
        }
    };

    const startByMouse = (e: any) => {
        try {
            if (isEnd) return;

            const x = e.clientX;
            const currentStartLeft = Math.floor(x - barArea.left);
            setStartLeft(currentStartLeft);
            startMoveTimeRef.current = Date.now();

            setText("");
            applyUIColors("active");
            setStatus(true);

            // 添加全局鼠标移动和松开事件监听
            document?.addEventListener("mousemove", moveByMouse);
            document?.addEventListener("mouseup", endByMouse);
        } catch (err) {
            console.error("滑块验证初始化错误:", err);
        }
    };

    const handleVerificationFailure = () => {
        applyUIColors("error");
        setIconClass("icon-close");
        setPassFlag(false);

        setTimeout(() => refresh(), 1000);

        setTipWords(t("验证失败"));
        setTimeout(() => {
            setTipWords("");
        }, 1000);
    };

    const refresh = () => {
        setShowRefresh(true);
        setFinishText("");
        setTransitionLeft("left .3s");
        setMoveBlockLeft("");
        setLeftBarWidth("");
        setTransitionWidth("width .3s");

        applyUIColors("default");
        setIconClass("icon-right");
        setIsEnd(false);

        getPictrue();

        setTimeout(() => {
            setTransitionWidth("");
            setTransitionLeft("");
            setText(displayExplain);
        }, 300);
    };

    useEffect(() => {
        getPictrue();
        setTimeout(() => {
            getBarArea();
        }, 350);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // 清理全局事件监听器，防止内存泄漏
        return () => {
            document?.removeEventListener("mousemove", moveByMouse);
            document?.removeEventListener("mouseup", endByMouse);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
        refresh
    }));

    return (
        <View className="verifyslide">
            <View className="verify-img-out" style={{ height: `${parseInt(imgSize.height)}px` }}>
                <View
                    className="verify-img-panel"
                    style={{
                        width: imgSize.width,
                        height: imgSize.height
                    }}
                >
                    {backImgBase && <Image src={"data:image/png;base64," + backImgBase} className="img" mode="scaleToFill" />}

                    {backImgBase && showRefresh && (
                        <View className="verify-refresh" onClick={refresh}>
                            <Text className="iconfont-pc icon-refresh" />
                        </View>
                    )}
                    {/* 原 up-transition :show="!!tipWords" mode="fade-up" → 条件渲染 + fade-up 动画类 */}
                    {!!tipWords && (
                        <Text className={`verify-tips ${passFlag ? "suc-bg" : "err-bg"} fade-up`}>{tipWords}</Text>
                    )}
                </View>
            </View>
            {/* 公共部分 */}
            <View
                className="verify-bar-area"
                style={{
                    width: barSize.width,
                    height: barSize.height,
                    lineHeight: barSize.height,
                    marginTop: `${barMarginTop}px`
                }}
            >
                <Text className="verify-msg">{text}</Text>
                <View
                    className="verify-left-bar"
                    style={{
                        width: leftBarWidth !== undefined && leftBarWidth !== "" ? leftBarWidth : barSize.height,
                        height: barSize.height,
                        borderColor: leftBarBorderColor,
                        backgroundColor: leftBarBackgroundColor,
                        transition: transitionWidth
                    }}
                >
                    <Text className="verify-msg">{text}</Text>
                    <View
                        className="verify-move-block"
                        style={{
                            width: barSize.height,
                            height: barSize.height,
                            backgroundColor: moveBlockBackgroundColor,
                            left: moveBlockLeft,
                            transition: transitionLeft
                        }}
                        onTouchStart={start}
                        onTouchMove={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            move(e);
                        }}
                        onTouchEnd={end}
                        {...((process.env.TARO_ENV === "h5" ? { onMouseDown: startByMouse } : {}) as any)}
                    >
                        <Text className={`verify-icon iconfont-pc ${iconClass}`} style={{ color: iconColor }} />
                        <View
                            className="verify-sub-block"
                            style={{
                                width: `${Math.floor((parseInt(imgSize.width) * 47) / 310)}px`,
                                height: imgSize.height,
                                top: `-${parseInt(imgSize.height) + barMarginTop}px`,
                                backgroundSize: `${imgSize.width} ${imgSize.height}`
                            }}
                        >
                            {blockBackImgBase && <Image src={"data:image/png;base64," + blockBackImgBase} className="img" mode="scaleToFill" />}
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
});

export default VerifySlide;
