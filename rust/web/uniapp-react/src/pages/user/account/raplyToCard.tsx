import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Input, Navigator, RichText, Text, Textarea, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Picker } from "@nutui/nutui-react-taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import { getAccountNoList, updateCommissionWithdrawApply, updateWithdrawApply } from "@/api/user/account";
import type { AccountFormState, AccountInfo } from "@/types/user/account";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { formatRichText, isDemo } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./raplyToCard.scss";

interface Props {
    balance?: number | string;
    /** D1107：钱包类型，balance=余额提现 commission=佣金提现 */
    wallet?: string;
    /** 旧 emit("backDetail", needRefresh) */
    onBackDetail?: (needRefresh?: boolean) => void;
}

const unescapeRichHtml = (raw: string) => {
    let html = raw;
    if (/&lt;\/?[a-zA-Z]/.test(html)) {
        html = html
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, "&");
    }
    return html;
};

/** 编辑器颜色打在 li 内 span 上，序号用 li 颜色；把文本色提到 li，默认仍是 #333 */
const applyListMarkerColor = (html: string) => {
    return html.replace(/<li(\b[^>]*)>([\s\S]*?)<\/li>/gi, (full, attrs: string, inner: string) => {
        if (/\sstyle\s*=\s*(['"])[^'"]*color\s*:/i.test(attrs)) return full;
        const colorMatch = inner.match(/color\s*:\s*([^;"']+)/i);
        if (!colorMatch) return full;
        const color = colorMatch[1].trim();
        if (!color || /^(inherit|unset|initial)$/i.test(color)) return full;
        if (/\sstyle\s*=/i.test(attrs)) {
            return `<li${attrs.replace(/style\s*=\s*(['"])/i, `style=$1color: ${color}; `)}>${inner}</li>`;
        }
        return `<li${attrs} style="color: ${color}">${inner}</li>`;
    });
};

/** 后台 body 14px，标题走浏览器默认 em；rich-text 不吃外部 class，字号写进节点 */
const EDITOR_HEADING_SIZE: Record<string, string> = {
    h1: "2em",
    h2: "1.5em",
    h3: "1.17em",
    h4: "1em",
    h5: "0.83em",
    h6: "0.67em"
};

const applyEditorHeadingSize = (html: string) => {
    return html.replace(/<(h[1-6])(\b[^>]*)>/gi, (full, tag: string, attrs: string) => {
        if (/\sstyle\s*=\s*(['"])[^'"]*font-size\s*:/i.test(attrs)) return full;
        const size = EDITOR_HEADING_SIZE[tag.toLowerCase()];
        if (!size) return full;
        if (/\sstyle\s*=/i.test(attrs)) {
            return `<${tag}${attrs.replace(/style\s*=\s*(['"])/i, `style=$1font-size: ${size}; `)}>`;
        }
        return `<${tag}${attrs} style="font-size: ${size}">`;
    });
};

const wrapEditorBody = (html: string) => `<div style="font-size:14px;line-height:1.5">${html}</div>`;

/** 表单行（对齐旧 up-form-item：label 宽 170rpx） */
function FormItem({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
    return (
        <View className="form-item">
            <View className="form-label">
                {required ? <Text className="is-required">*</Text> : null}
                <Text className="form-label-text">{`${label}:`}</Text>
            </View>
            <View className="form-control">{children}</View>
        </View>
    );
}

/**
 * 余额提现（自旧 pages/user/account/src/raplyToCard.vue 移植）
 * - 支持银行卡、支付宝、微信三种提现方式
 * - 选择已绑定的账号进行提现
 * - 输入提现金额提交申请
 */
export default function RaplyToCard({ balance = 0, wallet = "balance", onBackDetail }: Props) {
    usePageGuards();

    void balance;
    const langCode = useI18nStore((s) => s.langCode);
    // 按钱包类型选择提交接口
    const submitApi = wallet === "commission" ? updateCommissionWithdrawApply : updateWithdrawApply;

    // D1107：提现到账方式按后台「提现设置」勾选项展示（余额/佣金共用该配置），未配置则全显示
    const memberWithdrawalReceiptMethod = useConfigStore((s) => s.memberWithdrawalReceiptMethod);
    const memberWithdrawalDescription = useConfigStore((s) => s.memberWithdrawalDescription);

    // 后台「提现说明」仅会员余额提现展示；佣金提现复用本组件时不展示。空内容（含 wangEditor 空段落）不渲染（D1197）
    const withdrawalDescriptionHtml = useMemo(() => {
        if (wallet === "commission") return "";
        const html = unescapeRichHtml(String(memberWithdrawalDescription || ""));
        if (!html) return "";
        const withEditorStyle = applyEditorHeadingSize(applyListMarkerColor(html));
        if (/<img\b/i.test(html)) return wrapEditorBody(formatRichText(withEditorStyle));
        const text = html
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/gi, " ")
            .trim();
        return text ? wrapEditorBody(formatRichText(withEditorStyle)) : "";
    }, [wallet, memberWithdrawalDescription]);

    const allTabs = useMemo(
        () => [
            { title: t("银行卡"), accountType: 1 },
            { title: t("支付宝"), accountType: 2 },
            { title: t("微信"), accountType: 3 }
        ],
        [langCode]
    );

    const tabs = useMemo(() => {
        // 佣金提现为分销核心能力，不受后台「余额提现方式」勾选限制，展示全部账户类型（D1107）
        if (wallet === "commission") return allTabs;
        const enabled = memberWithdrawalReceiptMethod;
        // 配置字段缺失（后端未下发）才兜底全显示；空数组=后台全部取消勾选=一个都不展示
        if (!Array.isArray(enabled)) return allTabs;
        return allTabs.filter((item) => enabled.includes(item.accountType));
    }, [wallet, allTabs, memberWithdrawalReceiptMethod]);

    const [activeTab, setActiveTab] = useState<number>(tabs[0]?.accountType ?? 1);

    const createFormState = (accountType: number): AccountFormState => ({
        accountData: {
            accountNo: "",
            accountName: "",
            accountType,
            bankName: ""
        },
        amount: ""
    });

    const [formState, setFormState] = useState<AccountFormState>(createFormState(tabs[0]?.accountType ?? 1));
    /** 同步镜像：重置/提交时需要立即读到最新值（等价旧 reactive 同步语义） */
    const formMirrorRef = useRef<AccountFormState>(formState);
    formMirrorRef.current = formState;
    const setForm = (next: AccountFormState) => {
        formMirrorRef.current = next;
        setFormState(next);
    };

    const [show, setShow] = useState(false);
    const [selectedData, setSelectedData] = useState<{ id: any; text: string }>({
        id: "",
        text: t("请选择")
    });

    const [yhkList, setYhkList] = useState<any[][]>([]);
    const [zfbList, setZfbList] = useState<any[][]>([]);
    const [wxList, setWxList] = useState<any[][]>([]);

    const resetForm = (accountType: number) => {
        setSelectedData({
            id: "",
            text: t("请选择")
        });
        setForm(createFormState(accountType));
    };

    const upAcData = (value: any) => {
        const list = formMirrorRef.current.accountData.accountType === 1 ? yhkList : formMirrorRef.current.accountData.accountType === 2 ? zfbList : wxList;
        const selectedItem: any = list[0]?.find((item: any) => String(item.accountId) === String(value));
        const current = formMirrorRef.current;
        setForm({
            ...current,
            accountData: {
                ...current.accountData,
                accountNo: selectedItem?.accountNo,
                accountName: selectedItem?.accountName,
                bankName: selectedItem?.bankName
            }
        });
    };

    const __getAccountNoList = async (type: number) => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const temp: any = {
                accountType: type
            };
            const result = await getAccountNoList({ ...temp });
            const arr: any = ((result as any)?.records || []).map((item: any) => ({
                id: item.accountId,
                text: item.accountNo,
                ...item
            }));
            if (type == 1) {
                setYhkList((prev) => [...prev, arr]);
            } else if (type === 2) {
                setZfbList((prev) => [...prev, arr]);
            } else {
                setWxList((prev) => [...prev, arr]);
            }
        } catch (error: any) {
            console.error(error.message);
        } finally {
            Taro.hideLoading();
        }
    };

    // 旧 onBeforeMount
    useEffect(() => {
        void __getAccountNoList(activeTab);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const actionClick = (value: number) => {
        if (value === activeTab) return;
        setActiveTab(value);
        setYhkList([]);
        setZfbList([]);
        setWxList([]);
        resetForm(value);
        void __getAccountNoList(value);
    };

    const accountPlaceholder = useMemo(() => {
        switch (formState.accountData.accountType) {
            case 1:
                return t("银行卡");
            case 2:
                return t("支付宝");
            case 3:
                return t("微信");
            default:
                return "";
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formState.accountData.accountType, langCode]);

    const dataList = useMemo(() => {
        switch (formState.accountData.accountType) {
            case 1:
                return yhkList;
            case 2:
                return zfbList;
            case 3:
                return wxList;
            default:
                return [];
        }
    }, [formState.accountData.accountType, yhkList, zfbList, wxList]);

    const pickerOptions = useMemo(
        () => dataList.map((list) => list.map((item: any) => ({ label: String(item.text ?? ""), value: item.id }))),
        [dataList]
    );

    const cancel = () => {
        setShow(false);
    };

    const confirm = (selectedOptions: any[], selectedValue?: (string | number | null)[]) => {
        setShow(false);
        const value = selectedValue?.[0] ?? selectedOptions?.[0]?.value;
        const label = selectedOptions?.[0]?.label ?? "";
        setSelectedData({ id: value ?? "", text: String(label) });
        upAcData(value);
    };

    const onSubmit = async () => {
        if (isDemo()) {
            Taro.showToast({ title: t("权限不足"), icon: "none" });
            return;
        }
        if (String(selectedData.id).length === 0) {
            Taro.showToast({
                title: t("请选择需要提现的账号"),
                icon: "none",
                duration: 1000
            });
            return;
        }
        const value: any = formMirrorRef.current.amount;
        if (value === "" || value === null || value === undefined) {
            Taro.showToast({ title: t("请输入提现金额"), icon: "none" });
            return;
        }
        if (value == 0) {
            Taro.showToast({ title: t("提现金额必须大于0"), icon: "none" });
            return;
        }
        if (!(Number(value) > 0)) return;

        try {
            const result: any = await submitApi({ ...formMirrorRef.current } as any);
            void result;
            Taro.showToast({
                title: t("操作成功"),
                icon: "success",
                duration: 1000
            });
            setTimeout(() => {
                backDetail(true);
            }, 1500);
        } catch (error: any) {
            console.error(error);
            Taro.showToast({ title: error.message, icon: "none" });
        }
    };

    const backDetail = (needRefresh = false) => {
        onBackDetail?.(needRefresh);
    };

    return (
        <View>
            {tabs.length > 0 ? (
                <View className="custom-tabs">
                    {tabs.map((tab, index) => (
                        <View key={index} className={`tab${activeTab === tab.accountType ? " active-tab" : ""}`} onClick={() => actionClick(tab.accountType)}>
                            <View>{t(tab.title)}</View>
                        </View>
                    ))}
                </View>
            ) : null}
            {tabs.length === 0 ? <View className="empty-method">{t("暂无可用提现方式")}</View> : null}

            {tabs.length > 0 ? (
                <View className="reply-main">
                    <View className="reply-content">
                        <View className="form">
                            <FormItem label={t("提现至")}>
                                <View className="account-picker-trigger" onClick={() => setShow(true)}>
                                    <Text className="account-picker-text">{selectedData.text}</Text>
                                    <Text className={`iconfont-h5 icon-a-gengduo20${show ? " is-open" : ""}`} />
                                </View>
                            </FormItem>
                            <View className="tips">
                                {t("当前")}
                                {accountPlaceholder}
                                {t("账号已不用")}？
                                <Navigator url="/pages/user/account/list" className="font-color">
                                    {t("点击这里")}
                                </Navigator>
                                {t("去添加新的")}
                                {accountPlaceholder}
                                {t("账号")}。
                            </View>
                            <FormItem label={t("提现姓名")}>
                                <Input
                                    className="form-input"
                                    value={formState.accountData.accountName || ""}
                                    placeholder={`${t("请选择")}${accountPlaceholder}${t("账号")}`}
                                    disabled
                                    placeholderStyle="color:#c0c4cc;font-size:24rpx"
                                />
                            </FormItem>
                            {formState.accountData.accountType === 1 ? (
                                <FormItem label={t("银行详情")}>
                                    <Textarea
                                        className="form-textarea"
                                        value={formState.accountData.bankName || ""}
                                        placeholder={t("请选择银行卡账号")}
                                        disabled
                                        autoHeight
                                    />
                                </FormItem>
                            ) : null}
                            <FormItem label={t("提现金额")} required>
                                <Input
                                    className="form-input"
                                    type="number"
                                    value={formState.amount || ""}
                                    placeholder={t("请输入提现金额")}
                                    onInput={(e) =>
                                        setForm({
                                            ...formMirrorRef.current,
                                            amount: e.detail.value
                                        })
                                    }
                                    placeholderStyle="color:#c0c4cc;font-size:24rpx"
                                />
                            </FormItem>
                        </View>
                    </View>
                </View>
            ) : null}

            {withdrawalDescriptionHtml ? (
                <View className="withdraw-desc withdraw-note-MjI4MmZsaXU">
                    <View className="withdraw-desc__title">{t("提现说明")}</View>
                    <RichText className="withdraw-desc__content" nodes={withdrawalDescriptionHtml} />
                </View>
            ) : null}

            {/* 旧 tig-fixed-placeholder（background #fff）→ 固定底栏 + 等高占位 */}
            <View className="btn-fixed-placeholder">
                <View className="btn-box">
                    <TigButton2 className="btn" plain onClick={() => backDetail()}>
                        {t("返回列表")}
                    </TigButton2>
                    {tabs.length > 0 ? (
                        <TigButton2 className="btn" theme onClick={onSubmit}>
                            {t("提交申请")}
                        </TigButton2>
                    ) : null}
                </View>
            </View>
            <View className="btn-placeholder" />

            {/* 旧 up-picker → NutUI Picker */}
            <Picker
                visible={show}
                options={pickerOptions as any}
                onConfirm={confirm}
                onCancel={cancel}
                onClose={cancel}
            />
        </View>
    );
}