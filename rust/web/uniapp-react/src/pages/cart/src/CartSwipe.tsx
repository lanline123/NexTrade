import { forwardRef, useImperativeHandle, useRef } from "react";
import type { ReactNode } from "react";
import { Swipe } from "@nutui/nutui-react-taro";

/** 旧 up-swipe-action-item :threshold="20"（px）：松手时位移超过该值即判定打开 */
const OLD_THRESHOLD = 20;

export interface CartSwipeRef {
    close: () => void;
    open: (side: "left" | "right") => void;
}

interface Props {
    name?: string | number;
    rightAction?: ReactNode;
    disabled?: boolean;
    /** 旧 up-swipe-action-item threshold（px）：cart=20，cartJump=0（任意滑动即开） */
    threshold?: number;
    children?: ReactNode;
}

/**
 * 购物车左滑操作条（包装 NutUI Swipe，对齐旧 up-swipe-action-item :threshold）
 *
 * TODO(MIGRATION) 核销说明：NutUI Swipe 松手判定为「滑过按钮宽度 30%」才打开
 * （约 42px，按钮 ~280rpx 宽），旧 uview threshold（cart=20px / cartJump=0）更灵敏，
 * NutUI 无配置项。这里在触摸层自算位移补偿：松手时 |dx| ≥ threshold 强制 open /
 * < threshold 强制 close，覆盖 NutUI 内部 toggle 的判定结果
 * （onTouchEnd 在 NutUI 内部 toggle 之后回调，最终 setState 以补偿值为准）。
 */
const CartSwipe = forwardRef<CartSwipeRef, Props>(function CartSwipe({ name, rightAction, disabled, threshold = OLD_THRESHOLD, children }, ref) {
    const swipeRef = useRef<{ open: (side: "left" | "right") => void; close: () => void } | null>(null);
    const touchStartXRef = useRef(0);
    const touchStartYRef = useRef(0);
    const deltaXRef = useRef(0);

    useImperativeHandle(ref, () => ({
        close: () => swipeRef.current?.close(),
        open: (side) => swipeRef.current?.open(side)
    }));

    const getTouch = (event: any) => {
        return event?.touches?.[0] || event?.changedTouches?.[0] || event?.detail || null;
    };

    return (
        <Swipe
            ref={swipeRef as never}
            name={name}
            rightAction={rightAction}
            disabled={disabled}
            onTouchStart={(event: any) => {
                const touch = getTouch(event);
                if (touch) {
                    touchStartXRef.current = touch.clientX ?? touch.pageX ?? 0;
                    touchStartYRef.current = touch.clientY ?? touch.pageY ?? 0;
                }
                deltaXRef.current = 0;
            }}
            onTouchMove={(event: any) => {
                const touch = getTouch(event);
                if (!touch) return;
                const x = touch.clientX ?? touch.pageX ?? 0;
                const y = touch.clientY ?? touch.pageY ?? 0;
                deltaXRef.current = x - touchStartXRef.current;
                // 纵向滚动为主时清零，避免列表滚动误判为横滑
                if (Math.abs(y - touchStartYRef.current) > Math.abs(deltaXRef.current)) {
                    deltaXRef.current = 0;
                }
            }}
            onTouchEnd={() => {
                const dx = deltaXRef.current;
                deltaXRef.current = 0;
                if (Math.abs(dx) > threshold) {
                    // dx < 0：手指左滑 → 露出右侧操作区；dx > 0：反向
                    swipeRef.current?.open(dx < 0 ? "right" : "left");
                } else {
                    swipeRef.current?.close();
                }
            }}
        >
            {children}
        </Swipe>
    );
});

export default CartSwipe;
