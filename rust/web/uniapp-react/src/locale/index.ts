import zh from "./zh.json";
import en from "./en.json";

/**
 * 内置语言包（兜底词条）。
 * 运行时以后台下发的语言包合并覆盖（见 store/i18n.ts 的 setLangData）。
 *
 * 迁移说明：旧方案需要在构建期把 {0}/{name} 占位符改写为 Message Function，
 * 规避小程序沙箱禁 eval 的问题；i18next 的插值是纯字符串替换，无此限制，
 * 预处理逻辑（preprocessMessages）不再需要。
 */
export const localMessages: Record<string, Record<string, string>> = {
    zh,
    en
};
