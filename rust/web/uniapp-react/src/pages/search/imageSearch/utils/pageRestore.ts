import type { PickedSearchImage } from "@/utils/imageSearchPick";

/**
 * H5 刷新结果页后恢复本次图搜（自旧 pages/search/imageSearch/utils/pageRestore.ts 移植）
 * 选图得到的是 blob 地址，刷新后失效，所以把图片本身存进 IndexedDB；会话和来源存 sessionStorage，只在当前标签页有效
 * 其它端没有刷新，这些方法都不做事
 */
export interface RestoredSearch {
    image: PickedSearchImage;
    // 空表示刷新前还没拿到会话，需要重新上传
    searchToken: string;
}

const isH5 = () => process.env.TARO_ENV === "h5";

// PC 部署在同一域名下时与 H5 同源，共用 IndexedDB；PC 已用 imageSearch 库，同名同版本时本端的表不会建出来
const DB_NAME = "imageSearchMobile";
const STORE_NAME = "images";
const SESSION_KEY = "imageSearchRestore";

interface SearchSession {
    imageId: string;
    source: PickedSearchImage["source"];
    searchToken: string;
}

interface StoredImage {
    imageId: string;
    blob: Blob;
}

const openDb = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

const runStore = <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest) =>
    openDb().then(
        (db) =>
            new Promise<T>((resolve, reject) => {
                const req = action(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
                req.onsuccess = () => resolve(req.result as T);
                req.onerror = () => reject(req.error);
            }).finally(() => db.close())
    );

const readSession = (): SearchSession | null => {
    if (!isH5()) return null;
    try {
        const session = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || "null");
        // 旧记录没有图片 ID，无法确认共享库里的图片属于哪个标签页，不再恢复。
        if (
            !session ||
            typeof session.imageId !== "string" ||
            !session.imageId ||
            session.imageId === "current" ||
            !["camera", "album"].includes(session.source) ||
            typeof session.searchToken !== "string"
        )
            return null;
        return session;
    } catch {
        return null;
    }
};

const writeSession = (value: SearchSession | null): boolean => {
    if (!isH5()) return false;
    try {
        if (value) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
        else window.sessionStorage.removeItem(SESSION_KEY);
        return true;
    } catch {
        // 无痕模式等存储不可用时放弃恢复，不影响本次搜索
        return false;
    }
};

// 图片写入要按调用顺序完成，否则先重新检索再取消时，较慢的旧写入会覆盖回来
let queue: Promise<unknown> = Promise.resolve();
let savedImage: { path: string; imageId: string } | null = null;

/** 记住当前图片和会话；会话为空表示正在上传 */
export function rememberSearch(image: PickedSearchImage, searchToken: string): void {
    if (!isH5()) return;
    if (image.path === savedImage?.path) {
        writeSession({ imageId: savedImage.imageId, source: image.source, searchToken });
        return;
    }
    let imageId: string;
    try {
        imageId = Array.from(window.crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, "0")).join("");
    } catch {
        return;
    }
    const previousId = readSession()?.imageId || savedImage?.imageId;
    if (!writeSession({ imageId, source: image.source, searchToken })) return;
    const current = { path: image.path, imageId };
    savedImage = current;
    queue = queue
        .then(() => fetch(image.path).then((res) => res.blob()))
        .then((blob) => runStore("readwrite", (store) => store.put({ imageId, blob } satisfies StoredImage, imageId)))
        .then(() => {
            if (previousId) return runStore("readwrite", (store) => store.delete(previousId));
        })
        .catch(() => {
            if (savedImage === current) savedImage = null;
        });
}

/** 读取刷新前的图搜；没有可恢复的内容返回 null */
export async function loadRestoredSearch(): Promise<RestoredSearch | null> {
    if (!isH5()) return null;
    const session = readSession();
    if (!session) return null;
    try {
        await queue;
        const stored = await runStore<StoredImage | undefined>("readonly", (store) => store.get(session.imageId));
        const current = readSession();
        if (
            stored?.imageId !== session.imageId ||
            !(stored.blob instanceof Blob) ||
            current?.imageId !== session.imageId ||
            current.searchToken !== session.searchToken ||
            current.source !== session.source
        )
            return null;
        const path = URL.createObjectURL(stored.blob);
        savedImage = { path, imageId: session.imageId };
        return { image: { path, source: session.source }, searchToken: session.searchToken };
    } catch {
        return null;
    }
}

/** 主动离开结果页时清掉，之后刷新或直接打开不再恢复 */
export function clearRestoredSearch(): void {
    if (!isH5()) return;
    const imageId = readSession()?.imageId || savedImage?.imageId;
    writeSession(null);
    savedImage = null;
    if (imageId) queue = queue.then(() => runStore("readwrite", (store) => store.delete(imageId))).catch(() => {});
}