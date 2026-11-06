import { useEffect, useState } from "react";

import { getUserCreditDetail } from "@/api/user/user";
import { useUserStore } from "@/store/user";

/**
 * 账期（授信）信息的共享读取入口（自旧 hooks/useCreditInfo.ts 移植）。
 *
 * 会员中心有两个账期卡入口：装修版外壳 fixedFunctionalArea 要先判断整块该不该渲染，
 * 卡片 termPayCard 自己也要判断显示与否。两处各算一份判断会让外壳把卡片挡住，
 * 因此判断与补偿请求都收敛到这里。状态放模块作用域，多个组件共用一份、全程只请求一次。
 */
let cachedToken: unknown;
let cachedDetail: any = null;
let pendingRequest: Promise<unknown> | null = null;
const listeners = new Set<() => void>();

const notify = () => {
    listeners.forEach((listener) => listener());
};

export const useCreditInfo = () => {
    const token = useUserStore((s) => s.token);
    const userInfo = useUserStore((s) => s.userInfo);

    const [detail, setDetail] = useState<any>(cachedDetail);

    // 订阅模块级缓存变化（等价旧 Vue ref 响应式共享）
    useEffect(() => {
        const listener = () => setDetail(cachedDetail);
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    // 登录后用户详情可能先于授信信息完成刷新，使用账期详情接口补充确认授信客户身份。
    // 非授信客户接口会返回业务错误，静默忽略，避免影响个人中心其它内容。
    useEffect(() => {
        // 仅登录态真正变化时丢弃缓存，否则后挂载的组件会把已取回的数据清掉
        if (token !== cachedToken) {
            cachedToken = token;
            cachedDetail = null;
            pendingRequest = null;
            notify();
        }

        if (!token || userInfo?.creditPaymentInfo) return;
        if (pendingRequest) return;

        pendingRequest = getUserCreditDetail()
            .then((res: any) => {
                cachedDetail = res;
            })
            .catch(() => {
                cachedDetail = null;
            })
            .finally(() => {
                pendingRequest = null;
                notify();
            });
    }, [token, userInfo]);

    const creditInfo = userInfo?.creditPaymentInfo || detail;

    /** 账期卡是否展示：装修版外壳与卡片自身共用此判断 */
    const showTermPay = Boolean(creditInfo && Object.keys(creditInfo).length > 0);

    return {
        creditInfo,
        showTermPay
    };
};

export default useCreditInfo;