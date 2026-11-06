/**
 * 节流（自旧 utils/throttle.ts 34 行原样移植）
 *
 * 注意：`timer` / `flag` 是模块级变量，旧实现即如此——多个 throttle 实例会共享同一把锁，
 * 互相干扰（A 的节流窗口会挡住 B）。按"逐行保留、不自行优化"的迁移原则照搬，
 * 若后续确认需要按实例隔离，再改为闭包内变量。
 */
let timer: ReturnType<typeof setTimeout> | null = null;
let flag = false;

/**
 * 节流原理：在一定时间内，只能触发一次
 *
 * @param func 要执行的回调函数
 * @param wait 延时的时间
 * @param immediate 是否立即执行
 */
export function throttle(func: (...args: any[]) => void, wait: number = 500, immediate: boolean = true): (...args: any[]) => void {
    return function (this: any, ...args: any[]): void {
        if (immediate) {
            if (!flag) {
                flag = true;
                // 如果是立即执行，则在 wait 毫秒内开始时执行
                func.apply(this, args);
                timer = setTimeout(() => {
                    flag = false;
                }, wait);
            }
        } else if (!flag) {
            flag = true;
            // 如果是非立即执行，则在 wait 毫秒内的结束处执行
            timer = setTimeout(() => {
                flag = false;
                func.apply(this, args);
            }, wait);
        }
    };
}

export default throttle;
