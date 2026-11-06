/**
 * 买家秀视频流 - 前端 mock 数据
 *
 * 后端接口就绪前用于联通页面与逻辑；就绪后将 videoFeed.ts 的 USE_MOCK 置为 false 即可切换，
 * 页面与 composable 无需改动。
 *
 * 前 5 条为常规样本（首条带 4 张附图，用于验证横滑与分段进度条），
 * 其后 3 条为边界样本，覆盖附图超限截断、空/失效地址、视频失效三类异常路径。
 *
 * 注意：外链视频与图片在小程序端需在后台配置合法域名（downloadFile / video）。
 */
import type {
    FavoriteBuyerShowInput,
    FollowAuthorInput,
    VideoFeedCommentQuery,
    VideoFeedCommentResponse,
    VideoFeedCommentRow,
    VideoFeedImage,
    VideoFeedItem,
    VideoFeedQuery,
    VideoFeedResponse
} from "@/types/buyerShow/videoFeed";

/** 模拟网络延迟 */
function delay<T>(data: T, ms = 400): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

const pic = (seed: string, width = 720, height = 1280): string => `https://picsum.photos/seed/${seed}/${width}/${height}`;

const image = (seed: string): VideoFeedImage => ({
    picUrl: pic(seed),
    width: null,
    height: null
});

const NORMAL_ITEMS: VideoFeedItem[] = [
    {
        buyerShowId: "9200000000000000021",
        video: {
            videoUrl: "https://download.samplelib.com/mp4/sample-30s.mp4",
            videoCover: pic("bs-feed-121"),
            width: null,
            height: null,
            duration: null
        },
        images: [image("bs-feed-121-a"), image("bs-feed-121-b"), image("bs-feed-121-c"), image("bs-feed-121-d")],
        author: {
            userId: "1001",
            buyerName: "甜甜圈小姐姐",
            buyerPhoto: "https://i.pravatar.cc/150?img=20",
            isFollow: 0
        },
        productList: [
            {
                productId: "6",
                skuId: "10000000006",
                productName: "法式U领露锁骨短袖T恤女夏季奶系温柔泡泡袖上衣",
                productPrice: "78.00",
                picUrl: pic("bs-product-6", 400, 400),
                stock: 9993
            }
        ],
        content: "一条带附图的样本，左右滑可以看后面 4 张图，底部进度条应为 5 段",
        likeCount: 25,
        isLike: 0,
        favoriteCount: 7,
        isFavorite: 0,
        commentCount: 12,
        addTime: "2026-08-05 09:05"
    },
    {
        buyerShowId: "9200000000000000020",
        video: {
            videoUrl: "https://download.samplelib.com/mp4/sample-20s.mp4",
            videoCover: pic("bs-feed-120"),
            width: null,
            height: null,
            duration: null
        },
        images: [],
        author: {
            userId: "1002",
            buyerName: "时尚穿搭日记",
            buyerPhoto: "https://i.pravatar.cc/150?img=18",
            isFollow: 0
        },
        productList: [
            {
                productId: "12",
                skuId: "10000000012",
                productName: "春季时尚连帽抽绳收腰休闲简约风衣女中长款外套",
                productPrice: "290.00",
                picUrl: pic("bs-product-12", 400, 400),
                stock: 10000
            }
        ],
        content: "无附图样本，进度条不显示，整屏只有一个视频",
        likeCount: 12,
        isLike: 0,
        favoriteCount: 4,
        isFavorite: 0,
        commentCount: 3,
        addTime: "2026-08-04 21:10"
    },
    {
        buyerShowId: "9200000000000000019",
        video: {
            videoUrl: "https://download.samplelib.com/mp4/sample-15s.mp4",
            videoCover: pic("bs-feed-119"),
            width: null,
            height: null,
            duration: null
        },
        images: [image("bs-feed-119-a"), image("bs-feed-119-b")],
        author: {
            userId: "1003",
            buyerName: "户外探险家Leo",
            buyerPhoto: "https://i.pravatar.cc/150?img=17",
            isFollow: 1
        },
        productList: [
            {
                productId: "8",
                skuId: "10000000008",
                productName: "精致撞色钩边星河细闪拉链立领针织开衫",
                productPrice: "100.00",
                picUrl: pic("bs-product-8", 400, 400),
                stock: 9992
            }
        ],
        content: "已关注状态的样本，右下角不应再出现关注按钮",
        likeCount: 340,
        isLike: 1,
        favoriteCount: 90,
        isFavorite: 1,
        commentCount: 56,
        addTime: "2026-08-03 17:30"
    },
    {
        buyerShowId: "9200000000000000018",
        video: {
            videoUrl: "https://download.samplelib.com/mp4/sample-10s.mp4",
            videoCover: pic("bs-feed-118"),
            width: null,
            height: null,
            duration: null
        },
        images: [],
        author: {
            userId: "1004",
            buyerName: "爱做饭的老王",
            buyerPhoto: "https://i.pravatar.cc/150?img=16",
            isFollow: 0
        },
        productList: [],
        content: "无关联商品样本，底部不应出现商品卡；这条文案故意写得长一点，用来验证一行以上时的展开与收起交互是否正常工作",
        likeCount: 88,
        isLike: 0,
        favoriteCount: 22,
        isFavorite: 0,
        commentCount: 0,
        addTime: "2026-08-02 07:05"
    },
    {
        buyerShowId: "9200000000000000017",
        video: {
            videoUrl: "https://download.samplelib.com/mp4/sample-5s.mp4",
            videoCover: pic("bs-feed-117"),
            width: null,
            height: null,
            duration: null
        },
        images: [image("bs-feed-117-a")],
        author: {
            userId: "1005",
            buyerName: "数码测评君",
            buyerPhoto: "https://i.pravatar.cc/150?img=15",
            isFollow: 0
        },
        productList: [
            {
                productId: "10",
                skuId: "10000000010",
                productName: "韩版短款麻花宽松连帽外搭毛衣针织开衫外套女春",
                productPrice: "129.00",
                picUrl: pic("bs-product-10", 400, 400),
                stock: 9995
            }
        ],
        content: "单张附图样本，进度条 2 段",
        likeCount: 5,
        isLike: 0,
        favoriteCount: 1,
        isFavorite: 0,
        commentCount: 1,
        addTime: "2026-08-01 12:00"
    }
];

const EDGE_VIDEO = "https://download.samplelib.com/mp4/sample-30s.mp4";

/** 边界样本，接在常规样本之后，上滑可达 */
function buildEdgeItems(): VideoFeedItem[] {
    const base = {
        author: {
            userId: "9001",
            buyerName: "边界样本",
            buyerPhoto: "https://i.pravatar.cc/150?img=5",
            isFollow: 0
        },
        productList: [],
        likeCount: 0,
        isLike: 0,
        favoriteCount: 0,
        isFavorite: 0,
        commentCount: 0,
        addTime: "2026-08-06 00:00"
    };
    return [
        {
            ...base,
            buyerShowId: "mock-edge-truncate",
            video: { videoUrl: EDGE_VIDEO, videoCover: pic("bs-edge-1"), width: null, height: null, duration: null },
            images: Array.from({ length: 12 }, (_item, index) => image(`bs-edge-truncate-${index + 1}`)),
            content: "边界样本 1：附图 12 张，应截断至 8，进度条共 9 段"
        },
        {
            ...base,
            buyerShowId: "mock-edge-badurl",
            video: { videoUrl: EDGE_VIDEO, videoCover: pic("bs-edge-2"), width: null, height: null, duration: null },
            images: [
                image("bs-edge-badurl-1"),
                { picUrl: "", width: null, height: null },
                { picUrl: "https://invalid.example.com/not-exist.jpg", width: null, height: null }
            ],
            content: "边界样本 2：含空地址与失效地址，空地址应被剔除，进度条 3 段"
        },
        {
            ...base,
            buyerShowId: "mock-edge-videofail",
            video: {
                videoUrl: "https://invalid.example.com/not-exist.mp4",
                videoCover: pic("bs-edge-3"),
                width: null,
                height: null,
                duration: null
            },
            images: [image("bs-edge-videofail-1"), image("bs-edge-videofail-2")],
            content: "边界样本 3：视频地址失效但有附图，横滑与进度条仍应可用"
        }
    ];
}

/** 视频流分页，游标为已返回条数 */
export function mockGetVideoFeed(query: VideoFeedQuery): Promise<VideoFeedResponse> {
    const all = [...NORMAL_ITEMS, ...buildEdgeItems()];

    // 从列表点入时把目标条提到首位，与真实接口的 startId 语义保持一致
    if (query.startId != null && !query.cursor) {
        const hit = all.findIndex((item) => String(item.buyerShowId) === String(query.startId));
        if (hit > 0) {
            const [target] = all.splice(hit, 1);
            all.unshift(target);
        }
    }

    const size = query.size || 5;
    let start = query.cursor ? Number(query.cursor) : 0;
    if (Number.isNaN(start) || start < 0) start = 0;
    const end = Math.min(start + size, all.length);
    const hasMore = end < all.length;

    return delay({
        records: all.slice(start, end),
        nextCursor: hasMore ? String(end) : null,
        hasMore
    });
}

/** 关注作者 */
export function mockFollowAuthor(_data: FollowAuthorInput): Promise<null> {
    return delay(null, 200);
}

/** 收藏买家秀 */
export function mockFavoriteBuyerShow(_data: FavoriteBuyerShowInput): Promise<null> {
    return delay(null, 200);
}

/** 构造一条评论 */
function buildComment(index: number, withImage: boolean): VideoFeedCommentRow {
    const seed = index + 1;
    return {
        buyerShowCommentId: seed,
        userId: `200${seed}`,
        buyerName: index % 3 === 0 ? "甜甜圈小姐姐" : `用户${seed}`,
        buyerPhoto: `https://i.pravatar.cc/60?img=${(index % 60) + 1}`,
        content: index % 3 === 0 ? "谢谢支持～" : "好好看！！！独特的风景～",
        images: withImage ? [pic(`bs-comment-${seed}`, 400, 300)] : [],
        addTime: "2026-08-05 11:32",
        likeCount: 5 + index,
        isLike: 0,
        isAuthor: index % 3 === 0 ? 1 : 0,
        isMe: 0,
        replyCount: index % 4 === 0 ? 2 : 0
    };
}

/** 视频流评论分页 */
export function mockGetVideoComments(query: VideoFeedCommentQuery): Promise<VideoFeedCommentResponse> {
    // 二级回复固定返回 2 条，便于验证展开/收起
    const total = query.parentId ? 2 : 89;
    const size = query.size || 10;
    const page = query.page || 1;
    const start = (page - 1) * size;
    const end = Math.min(start + size, total);
    const records: VideoFeedCommentRow[] = [];
    for (let i = start; i < end; i++) {
        records.push(buildComment(query.parentId ? i + 1000 : i, i % 5 === 1));
    }
    return delay({ records, total });
}
