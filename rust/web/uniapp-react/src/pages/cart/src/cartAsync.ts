export interface CloseSchedulerOptions {
    flush?: boolean;
}

export interface KeyedLatestTaskScheduler<Key, Value> {
    schedule: (key: Key, value: Value, delayOverride?: number) => void;
    cancel: (key: Key) => Promise<void>;
    flush: () => Promise<boolean>;
    close: (options?: CloseSchedulerOptions) => Promise<void>;
}

interface TaskState<Value> {
    timer: ReturnType<typeof setTimeout> | null;
    running: boolean;
    hasPendingValue: boolean;
    pendingValue: Value | undefined;
    cancelled: boolean;
    idleResolvers: Array<() => void>;
}

interface SchedulerOptions<Key, Value> {
    onError?: (error: unknown, key: Key, value: Value) => void;
    onIdle?: () => void | Promise<void>;
}

/**
 * 按业务键合并延迟任务：不同键并行，同一键串行，并始终保留等待中的最新值。
 */
export const createKeyedLatestTaskScheduler = <Key, Value>(
    worker: (key: Key, value: Value) => Promise<void>,
    delay: number,
    options: SchedulerOptions<Key, Value> = {}
): KeyedLatestTaskScheduler<Key, Value> => {
    const states = new Map<Key, TaskState<Value>>();
    let closed = false;
    let failureVersion = 0;
    let idleNotificationPending = false;
    let idlePromise: Promise<void> | null = null;

    const notifyIdle = () => {
        if (!options.onIdle || states.size > 0 || !idleNotificationPending || idlePromise) return;

        idleNotificationPending = false;
        idlePromise = Promise.resolve()
            .then(() => options.onIdle?.())
            .catch(() => {
                failureVersion += 1;
            })
            .finally(() => {
                idlePromise = null;
                notifyIdle();
            });
    };

    const getState = (key: Key) => {
        const current = states.get(key);
        if (current) return current;

        const state: TaskState<Value> = {
            timer: null,
            running: false,
            hasPendingValue: false,
            pendingValue: undefined,
            cancelled: false,
            idleResolvers: []
        };
        states.set(key, state);
        return state;
    };

    const settleState = (key: Key, state: TaskState<Value>) => {
        if (state.timer || state.running || state.hasPendingValue) return;

        states.delete(key);
        state.idleResolvers.splice(0).forEach((resolve) => resolve());
        notifyIdle();
    };

    const run = async (key: Key, state: TaskState<Value>): Promise<void> => {
        if (state.running || !state.hasPendingValue) return;

        const value = state.pendingValue as Value;
        state.pendingValue = undefined;
        state.hasPendingValue = false;
        state.cancelled = false;
        state.running = true;

        try {
            await worker(key, value);
        } catch (error) {
            if (!state.cancelled && !state.hasPendingValue) {
                failureVersion += 1;
                options.onError?.(error, key, value);
            }
        } finally {
            if (!state.cancelled && options.onIdle) {
                idleNotificationPending = true;
            }
            state.running = false;

            if (state.hasPendingValue && !state.timer) {
                void run(key, state);
            } else {
                settleState(key, state);
            }
        }
    };

    const waitForIdle = (key: Key, state: TaskState<Value>) => {
        if (!state.timer && !state.running && !state.hasPendingValue) {
            settleState(key, state);
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            state.idleResolvers.push(resolve);
        });
    };

    const flush = async () => {
        const startFailureVersion = failureVersion;

        while (states.size > 0 || idleNotificationPending || idlePromise) {
            if (states.size > 0) {
                const currentStates = Array.from(states.entries());

                currentStates.forEach(([key, state]) => {
                    if (state.timer) {
                        clearTimeout(state.timer);
                        state.timer = null;
                    }
                    void run(key, state);
                });

                await Promise.all(currentStates.map(([key, state]) => waitForIdle(key, state)));
            }

            notifyIdle();
            if (idlePromise) {
                await idlePromise;
            }
        }

        return failureVersion === startFailureVersion;
    };

    const cancel = (key: Key) => {
        const state = states.get(key);
        if (!state) return Promise.resolve();

        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        state.pendingValue = undefined;
        state.hasPendingValue = false;
        state.cancelled = true;
        settleState(key, state);
        return waitForIdle(key, state);
    };

    const close = async (closeOptions: CloseSchedulerOptions = {}) => {
        closed = true;

        if (closeOptions.flush) {
            await flush();
            return;
        }

        await Promise.all(Array.from(states.keys()).map((key) => cancel(key)));
    };

    return {
        schedule(key, value, delayOverride) {
            if (closed) return;

            const state = getState(key);
            state.cancelled = false;
            state.pendingValue = value;
            state.hasPendingValue = true;

            if (state.timer) {
                clearTimeout(state.timer);
            }

            state.timer = setTimeout(() => {
                state.timer = null;
                void run(key, state);
            }, delayOverride ?? delay);
        },
        cancel,
        flush,
        close
    };
};

export interface LatestRequestGuard {
    begin: () => number;
    isLatest: (requestId: number) => boolean;
    invalidate: () => void;
}

/**
 * 为异步请求分配递增标识，调用方只提交最后一次请求的结果。
 */
export const createLatestRequestGuard = (): LatestRequestGuard => {
    let latestRequestId = 0;

    return {
        begin() {
            latestRequestId += 1;
            return latestRequestId;
        },
        isLatest(requestId) {
            return requestId === latestRequestId;
        },
        invalidate() {
            latestRequestId += 1;
        }
    };
};
