import { useEffect, useState } from "react";
import { useRouter } from "@tarojs/taro";
import Taro from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import EnterpriseForm from "./src/enterpriseForm";
import PersonalForm from "./src/personalForm";

import "./index.scss";

/**
 * 商家入驻申请页（自旧 pages/user/merchantEnter/index.vue 逐行移植）
 * - type=1 个人入驻表单
 * - type=2 企业入驻表单
 * - type=3 个体工商户复用企业资料表单
 * - 支持重新申请（isReapply）
 */
export default function MerchantEnter() {
    usePageGuards();
    const router = useRouter();

    const [type, setType] = useState(1);
    const [id, setId] = useState(0);
    const [isReapply, setIsReapply] = useState(false);

    useEffect(() => {
        const options: any = router.params || {};
        if (options.type) {
            setType(Number(options.type));
        }
        if (options.id) {
            setId(Number(options.id));
        }
        if (options.isReapply) {
            setIsReapply(options.isReapply == "true");
        }
        // 对应旧 onLoad，仅执行一次
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getRefresh = (applyId: number) => {
        Taro.redirectTo({
            url: `/pages/user/merchantEnter/index?id=${applyId}&type=${type}`
        });
    };

    return (
        <TigLayout title={t("商家入驻")}>
            {type === 1 && <PersonalForm id={id} isReapply={isReapply} onSendRefresh={getRefresh} />}
            {(type === 2 || type === 3) && <EnterpriseForm id={id} type={type} isReapply={isReapply} onSendRefresh={getRefresh} />}
        </TigLayout>
    );
}