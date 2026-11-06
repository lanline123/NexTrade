/**
 * 会员中心装修模块「固定模块」运行端幂等兜底
 *
 * 当装修接口返回的 moduleList 中缺少声明的固定模块时，
 * 按 anchorAfter 优先级在「最后一个匹配项」之后插入；
 * 若所有 anchor 均不匹配，则追加到末尾。
 *
 * 与 admin 端 ensureFixed 保持相同的 anchor 策略，确保两端展示位置一致。
 */

type ModuleLike = {
    type?: string;
    fixed?: boolean;
    isShow?: boolean;
    module?: Record<string, any>;
    [key: string]: any;
};

type FixedModuleSpec = {
    make: () => ModuleLike;
    matches: (m: ModuleLike) => boolean;
    anchorAfter: Array<(m: ModuleLike) => boolean>;
};

const isType =
    (...types: string[]) =>
    (m: ModuleLike) =>
        !!m && types.includes(m.type || "");

const FIXED_SPECS: FixedModuleSpec[] = [
    {
        make: () => ({
            type: "fixedFunctionalArea",
            fixed: true,
            isShow: true,
            module: {}
        }),
        matches: isType("fixedFunctionalArea", "fixed-functional-area"),
        anchorAfter: [isType("myWallet", "my-wallet"), isType("orderEntry", "order-entry", "orderEntryV2", "order-entry-v2")]
    }
];

const findLastIndex = (list: ModuleLike[], matcher: (m: ModuleLike) => boolean): number => {
    for (let i = list.length - 1; i >= 0; i--) {
        if (matcher(list[i])) return i;
    }
    return -1;
};

const findInsertIndex = (list: ModuleLike[], anchorAfter: Array<(m: ModuleLike) => boolean>): number => {
    for (const matcher of anchorAfter) {
        const idx = findLastIndex(list, matcher);
        if (idx !== -1) return idx + 1;
    }
    return list.length;
};

/**
 * 会员中心装修 moduleList 兜底注入固定模块
 * - 已存在 → 仅回写 fixed: true 与标准 type
 * - 不存在 → 按 anchor 优先级插入
 */
export function ensureMemberFixedModules<T extends ModuleLike>(list: T[]): T[] {
    if (!Array.isArray(list)) return list;
    FIXED_SPECS.forEach((spec) => {
        const existing = list.find(spec.matches);
        if (existing) {
            const proto = spec.make();
            if (existing.type !== proto.type) (existing as ModuleLike).type = proto.type;
            if (existing.fixed !== true) (existing as ModuleLike).fixed = true;
            return;
        }
        const insertAt = findInsertIndex(list, spec.anchorAfter);
        list.splice(insertAt, 0, spec.make() as T);
    });
    return list;
}
