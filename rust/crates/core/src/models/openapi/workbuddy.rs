//! WorkBuddy MCP 开放接口 + 消息推送演示端点（openapi::workbuddy）的 DTO / VO / 常量 / 纯逻辑。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.example.MessagePushController`
//! - `com.tigshop.adminapi.controller.openapi.workbuddy.WorkBuddyProductImportController`
//! - `com.tigshop.adminapi.controller.openapi.workbuddy.WorkBuddyProductIntelligenceController`
//! - `com.tigshop.adminapi.controller.openapi.workbuddy.WorkBuddyProductManageController`
//! - `com.tigshop.service.workbuddy.impl.{WorkBuddyKeyServiceImpl, ProductManageServiceImpl,
//!   ProductImportServiceImpl, ProductContextServiceImpl, ProductAnalysisServiceImpl,
//!   MediaManagementServiceImpl, McpMediaUploadServiceImpl, CategoryImportServiceImpl}`
//! - `com.tigshop.bean.dto.workbuddy.*` / `com.tigshop.bean.vo.workbuddy.*`
//! - `com.tigshop.bean.enums.workbuddy.{ProductScope, ProductSortField}`
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 金额
//!
//! `productPrice` / `marketPrice` / `price` 等一律 `rust_decimal::Decimal`
//! （Java 侧是 `BigDecimal`），**不使用 f64/f32**。
//!
//! ## 与原 Java 的已知差异（诚实记录，详见返回值 `uncertain_points`）
//!
//! - Java 侧大量使用**进程内 `ConcurrentHashMap`** 保存 preview / 幂等记录
//!   （`previews` / `idem` / `batchSnapshots` / `staged` / `results`），多实例
//!   部署下本就不一致。Rust 侧本文件只保留这些内存态的**数据结构与纯算法**，
//!   实际存储挂在服务层的进程内 mutex 中，语义与 Java 单实例一致。
//! - Java 的 `@IgnoreResponseAdvice` 表示这些接口**不被 `AjaxResult` 包装**，
//!   直接输出原始 JSON 体。Rust 侧沿用项目统一 `ok(...)` 包装
//!   （见 `uncertain_points`）。

#![allow(
    clippy::missing_const_for_fn,
    clippy::module_name_repetitions,
    clippy::struct_excessive_bools,
    clippy::too_many_lines,
    clippy::cast_precision_loss,
    clippy::cast_possible_truncation
)]

use std::collections::{BTreeMap, HashSet};
use std::str::FromStr;

use rust_decimal::{Decimal, RoundingStrategy};
use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// WorkBuddy 错误体（WorkBuddyApiExceptionHandler.ErrorBody）
// ——————————————————————————————————————————————

/// ⚠️ **重要**：WorkBuddy 开放接口**不使用**项目统一的 `AjaxResult` 包装。
///
/// Java `WorkBuddyApiExceptionHandler`（`@IgnoreResponseAdvice` +
/// `@Order(HIGHEST_PRECEDENCE)` + `@RestControllerAdvice(basePackages=...workbuddy)`）
/// 对 `com.tigshop.adminapi.controller.openapi.workbuddy` 包下的控制器
/// 返回**真实 HTTP 状态码 + 扁平错误体**：
/// ```json
/// { "errorCode": "...", "message": "...", "retryable": true }
/// ```
/// 这是为了让 MCP 连接器的 `!response.ok` 分支真实可达
/// （CR-20260827-164700 FIX-02 方案 A）。
///
/// Rust 侧在路由层用 `(StatusCode, Json<WorkBuddyErrorBody>)` 直出该结构，
/// **不经过** `tigshop_security::web::ok(...)`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkBuddyErrorBody {
    pub error_code: String,
    pub message: String,
    pub retryable: bool,
}

impl WorkBuddyErrorBody {
    #[must_use]
    pub fn new(error_code: &str, message: &str, retryable: bool) -> Self {
        Self {
            error_code: error_code.to_string(),
            message: message.to_string(),
            retryable,
        }
    }
}

/// Java `WorkBuddyApiExceptionHandler.HTTP_STATUS_CODES`：
/// 只有这些业务码可直接作为 HTTP 状态码使用。
pub const HTTP_STATUS_CODES: [i32; 5] = [400, 401, 403, 404, 409];

/// Java `WorkBuddyApiExceptionHandler.UNPROCESSABLE_ENTITY`。
pub const UNPROCESSABLE_ENTITY: i32 = 422;

/// Java `WorkBuddyApiExceptionHandler.resolveStatus`：
/// 白名单之外一律归一化为 422。
#[must_use]
pub const fn resolve_http_status(business_code: i32) -> i32 {
    if business_code == 400
        || business_code == 401
        || business_code == 403
        || business_code == 404
        || business_code == 409
    {
        business_code
    } else {
        UNPROCESSABLE_ENTITY
    }
}

/// Java `WorkBuddyApiExceptionHandler.defaultErrorCode`：
/// 非 `WorkBuddyApiException` 的 `GlobalException` 用的兜底错误码。
#[must_use]
pub const fn default_error_code(status: i32) -> &'static str {
    match status {
        400 => "BAD_REQUEST",
        401 => "WORKBUDDY_KEY_INVALID",
        403 => "FORBIDDEN",
        404 => "NOT_FOUND",
        409 => "CONFLICT",
        _ => "VALIDATION_FAILED",
    }
}

/// Java `handleException` 的未知异常错误码。
pub const CODE_INTERNAL_ERROR: &str = "INTERNAL_ERROR";
/// Java `handleException` 的未知异常文案。
pub const MSG_INTERNAL_ERROR: &str = "服务内部错误";
/// Java `handleUploadMethodNotSupported` 的错误码。
pub const CODE_UPLOAD_METHOD_NOT_ALLOWED: &str = "UPLOAD_METHOD_NOT_ALLOWED";
/// Java `handleUploadMethodNotSupported` 的文案。
pub const MSG_UPLOAD_METHOD_NOT_ALLOWED: &str = "媒体上传必须使用 POST";
/// Java `handleUploadMissingPart` 的错误码。
pub const CODE_UPLOAD_FILE_PART_REQUIRED: &str = "UPLOAD_FILE_PART_REQUIRED";
/// Java `handleUploadMissingPart` 的文案。
pub const MSG_UPLOAD_FILE_PART_REQUIRED: &str = "multipart 请求必须包含 files 文件字段";
/// Java `handleUploadContentType` 的错误码。
pub const CODE_UPLOAD_CONTENT_TYPE_REQUIRED: &str = "UPLOAD_CONTENT_TYPE_REQUIRED";
/// Java `handleUploadContentType` 的文案。
pub const MSG_UPLOAD_CONTENT_TYPE_REQUIRED: &str = "媒体上传必须使用 multipart/form-data";

// ——————————————————————————————————————————————
// 常量（逐条对应 Java 字面量）
// ——————————————————————————————————————————————

/// Java `WorkBuddyKeyServiceImpl.KEY_CODE`。
pub const CONFIG_CODE_WORKBUDDY_API_KEY: &str = "workbuddyApiKey";

/// Java `WorkBuddyKeyServiceImpl.EXPIRES_AT_CODE`。
pub const CONFIG_CODE_WORKBUDDY_API_KEY_EXPIRES_AT: &str = "workbuddyApiKeyExpiresAt";

/// MCP 密钥请求头（Java `KEY_HEADER`）。
pub const KEY_HEADER: &str = "X-MCP-Api-Key";

/// 幂等键请求头（Java `IDEMPOTENCY_HEADER`）。
pub const IDEMPOTENCY_HEADER: &str = "Idempotency-Key";

/// 平台账号类型请求头（Java `McpMediaUploadServiceImpl.currentContextShopId` 读 `X-ADMIN-TYPE`）。
pub const ADMIN_TYPE_HEADER: &str = "X-ADMIN-TYPE";

/// 店铺 ID 请求头（Java 读 `X-SHOP-ID`）。
pub const SHOP_ID_HEADER: &str = "X-SHOP-ID";

/// Java `WorkBuddyKeyServiceImpl.status`：密钥缺失或未配置。
pub const MSG_KEY_MISSING: &str = "MCP密钥缺失或未配置";

/// Java `WorkBuddyKeyServiceImpl.status`：密钥不匹配。
pub const MSG_KEY_INVALID: &str = "MCP密钥无效";

/// Java `WorkBuddyKeyServiceImpl.status`：到期时间无法解析。
pub const MSG_KEY_EXPIRES_INVALID: &str = "MCP密钥到期配置无效";

/// Java `WorkBuddyKeyServiceImpl.status`：已过期。
pub const MSG_KEY_EXPIRED: &str = "MCP密钥已过期";

/// Java `WorkBuddyKeyServiceImpl.status`：连接正常。
pub const MSG_KEY_OK: &str = "连接正常";

/// Java `WorkBuddyKeyServiceImpl.status`：默认密钥名。
pub const KEY_NAME_DEFAULT: &str = "默认 MCP 密钥";

/// Java `ProductManageServiceImpl.MAX_PAGE_SIZE`。
pub const MAX_PAGE_SIZE: i32 = 100;

/// Java `ProductManageServiceImpl.DEFAULT_PAGE_SIZE`。
pub const DEFAULT_PAGE_SIZE: i32 = 20;

/// Java `ProductImportServiceImpl.MAX_PRODUCTS`。
pub const MAX_PRODUCTS: i32 = 50;

/// Java `ProductImportServiceImpl.CATEGORY_PAGE_SIZE`。
pub const CATEGORY_PAGE_SIZE: i64 = 50;

/// Java `ProductImportServiceImpl.MAX_CATEGORY_DEPTH`（防分类成环）。
pub const MAX_CATEGORY_DEPTH: usize = 10;

/// Java `ProductImportServiceImpl.MAX_SKU_SN_LENGTH`。
pub const MAX_SKU_SN_LENGTH: usize = 60;

/// Java `ProductImportServiceImpl.DEFAULT_PRODUCT_NAME_LENGTH`。
pub const DEFAULT_PRODUCT_NAME_LENGTH: i32 = 200;

/// Java `SettingsEnum.CUSTOM_PRODUCT_NAME_LENGTH` 的配置码。
pub const CONFIG_CODE_CUSTOM_PRODUCT_NAME_LENGTH: &str = "customProductNameLength";

/// Java `SettingsEnum.MARKET_PRICE_RATE` 的配置码。
pub const CONFIG_CODE_MARKET_PRICE_RATE: &str = "marketPriceRate";

/// Java `SettingsEnum.IMAGE_UPLOAD_MAX_SIZE` 的配置码。
pub const CONFIG_CODE_IMAGE_UPLOAD_MAX_SIZE: &str = "imageUploadMaxSize";

/// Java `ProductImportServiceImpl.DEFAULT_MARKET_PRICE_RATE`（= 1.2）。
pub const DEFAULT_MARKET_PRICE_RATE_STR: &str = "1.2";

/// 单规格（Java `SKU_TYPE_SINGLE`）。
pub const SKU_TYPE_SINGLE: i32 = 1;

/// 多规格（Java `SKU_TYPE_MULTI`）。
pub const SKU_TYPE_MULTI: i32 = 2;

/// 规格属性类型（Java `SPEC_ATTR_TYPE`）。
pub const SPEC_ATTR_TYPE: i32 = 1;

/// 上架（Java `ProductStatus.ON_SALE`）。
pub const PRODUCT_STATUS_ON_SALE: i32 = 1;

/// 审核通过（Java `CheckStatus.APPROVED.getCode()`）。
pub const CHECK_STATUS_APPROVED: i32 = 0;

/// 审核未通过（Java `CheckStatus.REJECTED.getCode()`）。
pub const CHECK_STATUS_REJECTED: i32 = 2;

/// 待审核（Java `CheckStatus.PENDING` 对应码，见 `uncertain_points`）。
pub const CHECK_STATUS_PENDING: i32 = 1;

/// 正常商品类型（Java `ProductType.PRODUCT_TYPE_NORMAL.getCode()`）。
pub const PRODUCT_TYPE_NORMAL: i32 = 1;

/// 预览存活期（Java `PREVIEW_TTL_MILLIS = 30 * 60 * 1000L`，毫秒）。
pub const PREVIEW_TTL_MILLIS: i64 = 30 * 60 * 1000;

/// 幂等结果存活期（Java `IDEMPOTENCY_TTL_MILLIS` / `RESULT_TTL_MILLIS = 24h`）。
pub const RESULT_TTL_MILLIS: i64 = 24 * 60 * 60 * 1000;

/// fileToken 存活期（Java `McpMediaUploadServiceImpl.TOKEN_TTL_MILLIS = 30min`）。
pub const TOKEN_TTL_MILLIS: i64 = 30 * 60 * 1000;

/// 单次上传文件数上限（Java `MAX_FILES = 20`）。
pub const MAX_FILES: usize = 20;

/// 单批字节上限（Java `BATCH_CAP = 40L * 1024 * 1024`）。
pub const BATCH_CAP: i64 = 40 * 1024 * 1024;

/// 1 MiB（Java 里反复出现的 `1048576L`）。
pub const MIB: i64 = 1024 * 1024;

/// multipart 默认上限（Java `@Value("${spring.servlet.multipart.max-file-size:50MB}")`）。
pub const DEFAULT_MULTIPART_MAX_FILE_SIZE: &str = "50MB";

/// Java 允许的图片 MIME。
pub const ALLOWED_IMAGE_MIMES: [&str; 5] = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/tiff",
];

/// Java 允许的视频 MIME。
pub const ALLOWED_VIDEO_MIME: &str = "video/mp4";

/// Java 图片角色白名单。
pub const IMAGE_ROLES: [&str; 3] = ["main_image", "gallery_image", "detail_image"];

/// Java 视频角色白名单。
pub const VIDEO_ROLES: [&str; 1] = ["video"];

/// Java `MediaManagementServiceImpl.SUPPORTED_OPERATIONS`。
pub const MEDIA_SUPPORTED_OPERATIONS: [&str; 6] = [
    "upload",
    "update",
    "delete",
    "group_create",
    "group_update",
    "group_delete",
];

/// Java `ProductAnalysisServiceImpl.OPERATIONS`。
pub const ANALYSIS_OPERATIONS: [&str; 7] = [
    "overview",
    "top_sellers",
    "slow_movers",
    "inventory_risk",
    "price_bands",
    "category_performance",
    "recommend",
];

/// Java `ProductContextServiceImpl.DOMINANT_ENCODING_THRESHOLD = 0.6d`。
pub const DOMINANT_ENCODING_THRESHOLD: f64 = 0.6;

/// Java `ProductContextServiceImpl.MIN_DOMINANT_ENCODING_SAMPLES = 3`。
pub const MIN_DOMINANT_ENCODING_SAMPLES: usize = 3;

/// Java `CategoryImportServiceImpl.CATEGORY_PAGE_SIZE`。
pub const CATEGORY_IMPORT_PAGE_SIZE: i64 = 1000;

/// Java `CategoryImportServiceImpl`：分类名长度上限（字面量 `30`）。
pub const CATEGORY_NAME_MAX_LEN: usize = 30;

/// Java `ProductManageServiceImpl` 的批量上限（字面量 `50`）。
pub const BATCH_MAX_IDS: usize = 50;

/// Java `ProductManageServiceImpl` 的批量排序上限（`limit(20)`）。
pub const BATCH_SORT_LIMIT: usize = 20;

/// Java `ProductAnalysisServiceImpl` 的 ranking 上限（`limit(20)`）。
pub const ANALYSIS_RANKING_LIMIT: usize = 20;

/// Java `ProductAnalysisServiceImpl` 的 `sampleSize` 缺省值。
pub const ANALYSIS_DEFAULT_SAMPLE_SIZE: i32 = 100;

/// Java `ProductContextServiceImpl.context` 的 `sampleSize` 缺省值。
pub const CONTEXT_DEFAULT_SAMPLE_SIZE: i32 = 20;

/// Java `ProductContextVO` 的 samples 上限（`Math.min(20, all.size())`）。
pub const CONTEXT_SAMPLES_CAP: usize = 20;

/// Java 词频模式上限（`limit(10)`）。
pub const CONTEXT_PATTERN_LIMIT: usize = 10;

/// Java 词频统计里排除的停用词。
pub const CONTEXT_STOP_WORDS: [&str; 3] = ["商品", "新款", "正品"];

/// Java `ProductAnalysisServiceImpl` 的 `dataScope` / `source` 常量。
pub const ANALYSIS_DATA_SCOPE: &str = "Tigshop内部商品数据";

/// Java `ProductAnalysisServiceImpl` 的空数据回落文案。
pub const ANALYSIS_FALLBACK_MESSAGE: &str = "无足够内部数据，仅可提供通用经验";

// ——————————————————————————————————————————————
// 错误码常量（Java `WorkBuddyApiException` 的 code 字符串，逐字符照抄）
// ——————————————————————————————————————————————

pub const CODE_INVALID_SCOPE: &str = "INVALID_SCOPE";
pub const CODE_INVALID_SORT_FIELD: &str = "INVALID_SORT_FIELD";
pub const CODE_INVALID_PRODUCT_ID: &str = "INVALID_PRODUCT_ID";
pub const CODE_PRODUCT_NOT_FOUND: &str = "PRODUCT_NOT_FOUND";
pub const CODE_FIELD_NOT_EDITABLE: &str = "FIELD_NOT_EDITABLE";
pub const CODE_MISSING_VALUE: &str = "MISSING_VALUE";
pub const CODE_ALREADY_RECYCLED: &str = "ALREADY_RECYCLED";
pub const CODE_MUST_UNLIST_FIRST: &str = "MUST_UNLIST_FIRST";
pub const CODE_NOT_RECYCLED: &str = "NOT_RECYCLED";
pub const CODE_AUDIT_REJECTED: &str = "AUDIT_REJECTED";
pub const CODE_AUDIT_PENDING: &str = "AUDIT_PENDING";
pub const CODE_BATCH_LIMIT_EXCEEDED: &str = "BATCH_LIMIT_EXCEEDED";
pub const CODE_CONFIRMATION_REQUIRED: &str = "CONFIRMATION_REQUIRED";
pub const CODE_PREVIEW_REQUIRED: &str = "PREVIEW_REQUIRED";
pub const CODE_PREVIEW_MISMATCH: &str = "PREVIEW_MISMATCH";
pub const CODE_BATCH_ITEM_BLOCKED: &str = "BATCH_ITEM_BLOCKED";
pub const CODE_INVALID_OPERATION: &str = "INVALID_OPERATION";
pub const CODE_EMPTY_PRODUCT_IDS: &str = "EMPTY_PRODUCT_IDS";
pub const CODE_PRODUCTS_REQUIRED: &str = "PRODUCTS_REQUIRED";
pub const CODE_PRODUCTS_TOO_MANY: &str = "PRODUCTS_TOO_MANY";
pub const CODE_IDEMPOTENCY_KEY_REQUIRED: &str = "IDEMPOTENCY_KEY_REQUIRED";
pub const CODE_IDEMPOTENCY_KEY_CONFLICT: &str = "IDEMPOTENCY_KEY_CONFLICT";
pub const CODE_PREVIEW_NOT_FOUND: &str = "PREVIEW_NOT_FOUND";
pub const CODE_PREVIEW_NOT_IMPORTABLE: &str = "PREVIEW_NOT_IMPORTABLE";
pub const CODE_PRODUCT_SN_EXIST: &str = "PRODUCT_SN_EXIST";
pub const CODE_ASSET_NOT_ACCESSIBLE: &str = "ASSET_NOT_ACCESSIBLE";
pub const CODE_PRODUCT_CREATE_FAILED: &str = "PRODUCT_CREATE_FAILED";
pub const CODE_MISSING_FILTER: &str = "MISSING_FILTER";
pub const CODE_INVALID_CATEGORY_ID: &str = "INVALID_CATEGORY_ID";
pub const CODE_INVALID_SAMPLE_SIZE: &str = "INVALID_SAMPLE_SIZE";
pub const CODE_INVALID_TIME_RANGE: &str = "INVALID_TIME_RANGE";
pub const CODE_PLATFORM_SCOPE_REQUIRED: &str = "PLATFORM_SCOPE_REQUIRED";
pub const CODE_INVALID_FILE_COUNT: &str = "INVALID_FILE_COUNT";
pub const CODE_UPLOAD_MODE_REQUIRED: &str = "UPLOAD_MODE_REQUIRED";
pub const CODE_FILE_TOKEN_EXPIRED: &str = "FILE_TOKEN_EXPIRED";
pub const CODE_INVALID_ARGUMENT: &str = "INVALID_ARGUMENT";
pub const CODE_INVALID_TYPE: &str = "INVALID_TYPE";
pub const CODE_REQUEST_ID_REQUIRED: &str = "REQUEST_ID_REQUIRED";
pub const CODE_PREVIEW_EXPIRED: &str = "PREVIEW_EXPIRED";
pub const CODE_PREVIEW_SCOPE_MISMATCH: &str = "PREVIEW_SCOPE_MISMATCH";
pub const CODE_PREVIEW_REQUEST_MISMATCH: &str = "PREVIEW_REQUEST_MISMATCH";
pub const CODE_LOCAL_PATH_NOT_ALLOWED: &str = "LOCAL_PATH_NOT_ALLOWED";
pub const CODE_MEDIA_SCOPE_MISMATCH: &str = "MEDIA_SCOPE_MISMATCH";
pub const CODE_MEDIA_IN_USE: &str = "MEDIA_IN_USE";
pub const CODE_SERVICE_UNAVAILABLE: &str = "SERVICE_UNAVAILABLE";
pub const CODE_OPERATION_FAILED: &str = "OPERATION_FAILED";
pub const CODE_NO_CHANGES: &str = "NO_CHANGES";
pub const CODE_NOT_FOUND: &str = "NOT_FOUND";
pub const CODE_INVALID_FILE: &str = "INVALID_FILE";
pub const CODE_INVALID_PATH: &str = "INVALID_PATH";
pub const CODE_UNSUPPORTED_MIME: &str = "UNSUPPORTED_MIME";
pub const CODE_INVALID_BASE64: &str = "INVALID_BASE64";
pub const CODE_FILE_TOO_LARGE: &str = "FILE_TOO_LARGE";
pub const CODE_INVALID_ROLE: &str = "INVALID_ROLE";
pub const CODE_INVALID_GROUP: &str = "INVALID_GROUP";
pub const CODE_UPLOAD_RETRYABLE: &str = "UPLOAD_RETRYABLE";
pub const CODE_STORAGE_NOT_CONFIGURED: &str = "STORAGE_NOT_CONFIGURED";
pub const CODE_INVALID_SHOP_ID: &str = "INVALID_SHOP_ID";
pub const CODE_MISSING_PARENT: &str = "MISSING_PARENT";
pub const CODE_CATEGORY_ID_NOT_FOUND: &str = "CATEGORY_ID_NOT_FOUND";
pub const CODE_CATEGORY_CREATE_FAILED: &str = "CATEGORY_CREATE_FAILED";
pub const CODE_REQUIRED: &str = "REQUIRED";
pub const CODE_INVALID_URL: &str = "INVALID_URL";
pub const CODE_INVALID_MEDIA: &str = "INVALID_MEDIA";
pub const CODE_CATEGORY_NOT_FOUND: &str = "CATEGORY_NOT_FOUND";
pub const CODE_CATEGORY_NOT_LEAF: &str = "CATEGORY_NOT_LEAF";
pub const CODE_SPEC_REQUIRED: &str = "SPEC_REQUIRED";
pub const CODE_SPEC_NAME_MISMATCH: &str = "SPEC_NAME_MISMATCH";
pub const CODE_SPEC_DUPLICATED: &str = "SPEC_DUPLICATED";
pub const CODE_SKU_SN_TOO_LONG: &str = "SKU_SN_TOO_LONG";
pub const CODE_SKU_SN_DUPLICATED: &str = "SKU_SN_DUPLICATED";
pub const CODE_SKU_SN_EXIST: &str = "SKU_SN_EXIST";

// ——————————————————————————————————————————————
// 中文文案常量（逐字符照抄 Java）
// ——————————————————————————————————————————————

/// Java `ProductManageServiceImpl.updateConsequences`。
pub const MSG_ON_SALE_CONSEQUENCE: &str = "前台已经能搜到这个商品，买家可以直接下单";
/// Java `setStatus(false)` 的连带说明。
pub const MSG_OFF_SALE_CONSEQUENCE: &str = "前台不再显示这个商品，已下单的订单不受影响";
/// Java `setStatus(false)` 在 B2C 下的额外说明。
pub const MSG_OFF_SALE_B2C_GROUP_BUY: &str =
    "这个商品参加的拼团活动也一并撤下了，重新上架后需要重新加入活动";
/// Java `recycle` 的连带说明。
pub const MSG_RECYCLE_CONSEQUENCE: &str = "前台已经看不到这个商品了，需要的话可以从回收站还原";
/// Java `recycle`（B2C 且在售）的额外说明。
pub const MSG_RECYCLE_B2C_UNLISTED: &str = "移入回收站的同时也下架了，还原后需要重新上架";
/// Java `restore` 的连带说明。
pub const MSG_RESTORE_CONSEQUENCE: &str = "商品回到了列表里，但仍是下架状态，需要上架前台才看得到";
/// Java `deletePermanently` 的连带说明。
pub const MSG_DELETE_PERMANENT: &str = "商品及其关联数据已删除，无法恢复";
/// Java `copy` 的连带说明（回捞成功）。
pub const MSG_COPY_NEED_LIST: &str = "新商品是下架状态，改好内容后需要手动上架";
/// Java `copy` 的 `after`（回捞失败）。
pub const MSG_COPY_CREATED_UNKNOWN: &str = "已创建，请在商品列表中查看";
/// Java `copy` 的连带说明（回捞失败）。
pub const MSG_COPY_NEW_FIRST: &str = "新商品排在商品列表最前面，名称与原商品相同";

// ——————————————————————————————————————————————
// Decimal 小工具
// ——————————————————————————————————————————————

/// 由字符串字面量构造 `Decimal`（Java 侧都是 `new BigDecimal("...")`）。
///
/// 失败时返回 `Decimal::ZERO`——本文件只用于**编译期常量字面量**，
/// 字面量必然合法，失败分支不可达（保留以避免 `unwrap`）。
#[must_use]
pub fn dec(s: &str) -> Decimal {
    Decimal::from_str(s).unwrap_or(Decimal::ZERO)
}

/// Java `BigDecimal.setScale(2, RoundingMode.HALF_UP)`。
///
/// ⚠️ `rust_decimal` **没有** `RoundingStrategy::HalfUp`
/// （Java `HALF_UP` 的等价物是 `MidpointAwayFromZero`：5 一律进位）。
#[must_use]
pub fn round2(value: Decimal) -> Decimal {
    value.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

/// 当前秒级 Unix 时间戳（Java `System.currentTimeMillis() / 1000`）。
#[must_use]
pub fn ms_now_secs() -> i64 {
    chrono::Utc::now().timestamp()
}

/// Java `ProductImportServiceImpl` 的 `products` 数量校验。
///
/// 返回 `Err((错误码, 文案))`；`Ok(())` 表示可继续。
pub fn import_max_products_check(count: usize) -> Result<(), (&'static str, &'static str)> {
    if count == 0 {
        return Err((CODE_PRODUCTS_REQUIRED, "products 不能为空"));
    }
    if count > MAX_PRODUCTS as usize {
        return Err((CODE_PRODUCTS_TOO_MANY, "一次导入的商品数量超过上限"));
    }
    Ok(())
}

// ——————————————————————————————————————————————
// 统计聚合（ProductAnalysisServiceImpl 的通用计数）
// ——————————————————————————————————————————————

/// 分析用的聚合计数（Java 在 `ProductAnalysisServiceImpl` 里逐项累加）。
#[derive(Debug, Clone, Default, PartialEq)]
pub struct AnalysisCounters {
    /// 价格之和。
    pub price_sum: Decimal,
    /// 最低价。
    pub price_min: Option<Decimal>,
    /// 最高价。
    pub price_max: Option<Decimal>,
    /// 价格中位数。
    pub price_median: Option<Decimal>,
    /// 样本条数。
    pub count: usize,
}

impl AnalysisCounters {
    /// 由 `(价格, 销量, 库存)` 三元组聚合。
    #[must_use]
    pub fn from_rows<I>(rows: I) -> Self
    where
        I: IntoIterator<Item = (Decimal, i32, i32)>,
    {
        let mut out = Self::default();
        let mut prices = Vec::new();
        for (price, _sales, _stock) in rows {
            out.count += 1;
            out.price_sum = out.price_sum.checked_add(price).unwrap_or(out.price_sum);
            out.price_min = Some(out.price_min.map_or(price, |m| m.min(price)));
            out.price_max = Some(out.price_max.map_or(price, |m| m.max(price)));
            prices.push(price);
        }
        out.price_median = price_median(&prices);
        out
    }
}

// ——————————————————————————————————————————————
// 消息推送（MessagePushController）
// ——————————————————————————————————————————————

/// 复刻 Java `MessagePushController.tigshopConfig` 的字符串拼接。
///
/// Java 原样返回**一个拼接字符串**（不是 JSON 对象），且各段之间
/// **没有分隔符**（前一段值直接接下一段标签）：
/// ```text
/// "isMerchant: " + isMerchant + "isB2b: " + isB2b + ...
/// ```
/// `Integer` 为 `null` 时 Java 的 `String` 拼接会输出字面量 `"null"`。
#[must_use]
pub fn tigshop_config_text(
    is_merchant: Option<i32>,
    is_b2b: Option<i32>,
    is_pro: Option<i32>,
    is_overseas: Option<i32>,
    is_vendor: Option<i32>,
    is_o2o: Option<i32>,
) -> String {
    let part = |v: Option<i32>| v.map_or_else(|| "null".to_string(), |n| n.to_string());
    format!(
        "isMerchant: {}isB2b: {}isPro: {}isOverseas: {}isVendor: {}isO2o: {}",
        part(is_merchant),
        part(is_b2b),
        part(is_pro),
        part(is_overseas),
        part(is_vendor),
        part(is_o2o),
    )
}

/// `GET /adminapi/messagepush/messagepush/tigshopConfig` 的出参。
///
/// ⚠️ Java 该方法**直接返回 `String`**（`@RestController` 下经
/// `StringHttpMessageConverter` 输出纯文本，**不是** JSON 对象）。
/// Rust 侧统一用 `ok(...)` 包装为 `{data: "..."}`，见 `uncertain_points`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TigshopConfigVO {
    /// 原样拼接文本。
    pub text: String,
}

impl From<String> for TigshopConfigVO {
    fn from(text: String) -> Self {
        Self { text }
    }
}

// ——————————————————————————————————————————————
// WorkBuddy 密钥（WorkBuddyKeyServiceImpl）
// ——————————————————————————————————————————————

/// 对应 Java `com.tigshop.bean.vo.workbuddy.WorkBuddyKeyStatusVO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WorkBuddyKeyStatusVO {
    pub valid: bool,
    pub key_id: Option<i64>,
    pub key_name: Option<String>,
    pub shop_id: Option<i32>,
    pub expires_at: Option<i64>,
    pub message: Option<String>,
}

impl WorkBuddyKeyStatusVO {
    /// 构造一个「无效」状态（Java 只设 `message`，其余保持默认）。
    #[must_use]
    pub fn invalid(message: &str) -> Self {
        Self {
            valid: false,
            message: Some(message.to_string()),
            ..Self::default()
        }
    }

    /// Java `status()` 成功分支的固定形态：
    /// `valid=true`、`shopId=0`、`keyId=0`、`keyName="默认 MCP 密钥"`、
    /// `message="连接正常"`、`expiresAt=<配置值>`。
    #[must_use]
    pub fn connected(expires_at: i64) -> Self {
        Self {
            valid: true,
            key_id: Some(0),
            key_name: Some(KEY_NAME_DEFAULT.to_string()),
            shop_id: Some(0),
            expires_at: Some(expires_at),
            message: Some(MSG_KEY_OK.to_string()),
        }
    }
}

/// Java `WorkBuddyKeyServiceImpl.status` 的判定逻辑（纯函数）。
///
/// `key` = 请求头值，`expected` = 配置 `workbuddyApiKey`，
/// `expires` = 配置 `workbuddyApiKeyExpiresAt`，`now_secs` = 当前秒级时间戳。
///
/// 判定顺序与 Java 逐条一致：
/// 1. `key` 空白 **或** `expected` 空白 ⇒ 「MCP密钥缺失或未配置」
/// 2. `key != expected` ⇒ 「MCP密钥无效」
/// 3. `expires` 无法解析为 `long` ⇒ 「MCP密钥到期配置无效」
/// 4. `expires <= now` ⇒ 「MCP密钥已过期」
/// 5. 否则有效
#[must_use]
pub fn evaluate_key_status(
    key: Option<&str>,
    expected: Option<&str>,
    expires: Option<&str>,
    now_secs: i64,
) -> WorkBuddyKeyStatusVO {
    let blank = |v: Option<&str>| v.is_none_or(|s| s.trim().is_empty());
    if blank(key) || blank(expected) {
        return WorkBuddyKeyStatusVO::invalid(MSG_KEY_MISSING);
    }
    // Java `MessageDigest.isEqual`：等长逐字节定长比较（防时序侧信道）。
    if !constant_time_eq(key.unwrap_or_default(), expected.unwrap_or_default()) {
        return WorkBuddyKeyStatusVO::invalid(MSG_KEY_INVALID);
    }
    let expires_at = match expires.and_then(|e| e.trim().parse::<i64>().ok()) {
        Some(v) => v,
        None => return WorkBuddyKeyStatusVO::invalid(MSG_KEY_EXPIRES_INVALID),
    };
    if expires_at <= now_secs {
        return WorkBuddyKeyStatusVO::invalid(MSG_KEY_EXPIRED);
    }
    WorkBuddyKeyStatusVO::connected(expires_at)
}

/// 等长定长比较（对应 Java `MessageDigest.isEqual`）。
///
/// 长度不同直接返回 `false`（与 Java 一致：`isEqual` 先比长度）。
#[must_use]
pub fn constant_time_eq(a: &str, b: &str) -> bool {
    let (x, y) = (a.as_bytes(), b.as_bytes());
    if x.len() != y.len() {
        return false;
    }
    let mut diff = 0u8;
    for (p, q) in x.iter().zip(y.iter()) {
        diff |= p ^ q;
    }
    diff == 0
}

/// Java `auth()`：`status == null || !valid || shopId == null` ⇒ 401。
#[must_use]
pub fn key_authorized(status: Option<&WorkBuddyKeyStatusVO>) -> bool {
    match status {
        Some(s) => s.valid && s.shop_id.is_some(),
        None => false,
    }
}

/// 取 401 时使用的文案（Java `auth()`：
/// `s == null || s.getMessage() == null ? "MCP密钥无效" : s.getMessage()`）。
#[must_use]
pub fn key_unauthorized_message(status: Option<&WorkBuddyKeyStatusVO>) -> &str {
    match status {
        Some(s) => match s.message.as_deref() {
            Some(m) if !m.is_empty() => m,
            _ => MSG_KEY_INVALID,
        },
        None => MSG_KEY_INVALID,
    }
}

/// Java `WorkBuddyKeyService.requireValid` 的**单密钥模式**行为：
/// 只校验有效性，**不**按 `requiredScope` 拦截。
///
/// → 返回 401 文案或 `Ok(())`。
pub fn require_valid_key(status: Option<&WorkBuddyKeyStatusVO>) -> Result<(), String> {
    if key_authorized(status) {
        Ok(())
    } else {
        Err(key_unauthorized_message(status).to_string())
    }
}

// ——————————————————————————————————————————————
// 商品查询范围 / 排序（ProductScope / ProductSortField）
// ——————————————————————————————————————————————

/// 对应 Java `com.tigshop.bean.enums.workbuddy.ProductScope`。
///
/// ⚠️ 必须实现 `Default`：仓储层的 `ProductSearchQuery` 用
/// `#[derive(Default)]`，缺省值即 Java 的 `ProductScope.DEFAULT()` = `ON_SALE`
/// （否则报 E0277: the trait bound `ProductScope: Default` is not satisfied）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProductScope {
    /// 出售中：已上架且审核通过。
    #[default]
    OnSale,
    /// 已下架：审核通过但未上架。
    OffSale,
    /// 待审核：不限上下架状态。
    PendingAudit,
    /// 审核未通过：不限上下架状态。
    AuditFailed,
    /// 回收站：只按删除标记筛。
    Recycled,
    /// 全部：不限上下架与审核状态，但不含回收站。
    All,
}

impl ProductScope {
    /// Java `ProductScope.getLabel()`。
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::OnSale => "出售中",
            Self::OffSale => "已下架",
            Self::PendingAudit => "待审核",
            Self::AuditFailed => "审核未通过",
            Self::Recycled => "回收站",
            Self::All => "全部",
        }
    }

    /// 枚举名的小写形式（Java `name().toLowerCase(Locale.ROOT)`）。
    #[must_use]
    pub const fn name_lower(self) -> &'static str {
        match self {
            Self::OnSale => "on_sale",
            Self::OffSale => "off_sale",
            Self::PendingAudit => "pending_audit",
            Self::AuditFailed => "audit_failed",
            Self::Recycled => "recycled",
            Self::All => "all",
        }
    }

    /// Java `ProductScope.getProductStatus()`；`None` ⇒ 不加条件。
    #[must_use]
    pub const fn product_status(self) -> Option<i32> {
        match self {
            Self::OnSale => Some(1),
            Self::OffSale => Some(0),
            Self::PendingAudit | Self::AuditFailed | Self::Recycled | Self::All => None,
        }
    }

    /// Java `ProductScope.getCheckStatus()`；`None` ⇒ 不加条件。
    #[must_use]
    pub const fn check_status(self) -> Option<i32> {
        match self {
            Self::OnSale | Self::OffSale => Some(1),
            Self::PendingAudit => Some(0),
            Self::AuditFailed => Some(2),
            Self::Recycled | Self::All => None,
        }
    }

    /// Java `ProductScope.getIsDelete()`。
    #[must_use]
    pub const fn is_delete(self) -> Option<i32> {
        match self {
            Self::Recycled => Some(1),
            _ => Some(0),
        }
    }

    /// Java `ProductScope.DEFAULT()` = `ON_SALE`。
    #[must_use]
    pub const fn default_scope() -> Self {
        Self::OnSale
    }

    /// Java `ProductScope.parse`：空 ⇒ 默认；大小写与中划线都接受；
    /// 无法识别 ⇒ `None`（由调用方报可读错误）。
    #[must_use]
    pub fn parse(raw: Option<&str>) -> Option<Self> {
        let raw = match raw {
            Some(r) if !r.trim().is_empty() => r,
            _ => return Some(Self::default_scope()),
        };
        let normalized = raw.trim().to_uppercase().replace('-', "_");
        Self::all().into_iter().find(|s| {
            let name = match s {
                Self::OnSale => "ON_SALE",
                Self::OffSale => "OFF_SALE",
                Self::PendingAudit => "PENDING_AUDIT",
                Self::AuditFailed => "AUDIT_FAILED",
                Self::Recycled => "RECYCLED",
                Self::All => "ALL",
            };
            name == normalized
        })
    }

    /// Java `ProductScope.supportedValues()`：
    /// `on_sale（出售中）、off_sale（已下架）、...`。
    #[must_use]
    pub fn supported_values() -> String {
        Self::all()
            .iter()
            .map(|s| format!("{}（{}）", s.name_lower(), s.label()))
            .collect::<Vec<_>>()
            .join("、")
    }

    /// 枚举全部取值（Java `values()` 顺序）。
    #[must_use]
    pub const fn all() -> [Self; 6] {
        [
            Self::OnSale,
            Self::OffSale,
            Self::PendingAudit,
            Self::AuditFailed,
            Self::Recycled,
            Self::All,
        ]
    }
}

/// 对应 Java `com.tigshop.bean.enums.workbuddy.ProductSortField`。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProductSortField {
    /// 商品 ID，近似等于添加先后。
    Added,
    /// 价格。
    Price,
    /// 库存。
    Stock,
    /// 销量。
    Sales,
    /// 后台列表的人工排序值。
    SortOrder,
}

impl ProductSortField {
    /// Java `ProductSortField.getLabel()`。
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Added => "添加时间",
            Self::Price => "价格",
            Self::Stock => "库存",
            Self::Sales => "销量",
            Self::SortOrder => "排序值",
        }
    }

    /// Java `ProductSortField.getProperty()`（实体属性名）。
    #[must_use]
    pub const fn property(self) -> &'static str {
        match self {
            Self::Added => "productId",
            Self::Price => "productPrice",
            Self::Stock => "productStock",
            Self::Sales => "virtualSales",
            Self::SortOrder => "sortOrder",
        }
    }

    /// 枚举名（Java `name()`）。
    #[must_use]
    pub const fn name(self) -> &'static str {
        match self {
            Self::Added => "ADDED",
            Self::Price => "PRICE",
            Self::Stock => "STOCK",
            Self::Sales => "SALES",
            Self::SortOrder => "SORT_ORDER",
        }
    }

    /// 枚举名小写（Java `name().toLowerCase(Locale.ROOT)`）。
    #[must_use]
    pub const fn name_lower(self) -> &'static str {
        match self {
            Self::Added => "added",
            Self::Price => "price",
            Self::Stock => "stock",
            Self::Sales => "sales",
            Self::SortOrder => "sort_order",
        }
    }

    /// 实体属性名 ⇒ `product` 表真实列名（`python tools/schema_parser.py --table product`）。
    ///
    /// 已核对：`product_id` / `product_price` / `product_stock` /
    /// `virtual_sales` / `sort_order` 均为 `product` 表实际列。
    #[must_use]
    pub const fn column(self) -> &'static str {
        match self {
            Self::Added => "product_id",
            Self::Price => "product_price",
            Self::Stock => "product_stock",
            Self::Sales => "virtual_sales",
            Self::SortOrder => "sort_order",
        }
    }

    /// Java `ProductSortField.parse`：空 ⇒ `None`；无法识别 ⇒ `None`。
    ///
    /// ⚠️ Java 在这里**不区分**这两种情况，由调用方先判空
    /// （见 [`resolve_sort_field`]）。
    #[must_use]
    pub fn parse(raw: Option<&str>) -> Option<Self> {
        let raw = raw?;
        if raw.trim().is_empty() {
            return None;
        }
        let normalized = raw.trim().to_uppercase().replace('-', "_");
        Self::all().into_iter().find(|f| f.name() == normalized)
    }

    /// Java `ProductSortField.supportedValues()`。
    #[must_use]
    pub fn supported_values() -> String {
        Self::all()
            .iter()
            .map(|f| format!("{}（{}）", f.name_lower(), f.label()))
            .collect::<Vec<_>>()
            .join("、")
    }

    /// 枚举全部取值（Java `values()` 顺序）。
    #[must_use]
    pub const fn all() -> [Self; 5] {
        [
            Self::Added,
            Self::Price,
            Self::Stock,
            Self::Sales,
            Self::SortOrder,
        ]
    }
}

/// Java `ProductManageServiceImpl.resolveSortField`：
/// 空 ⇒ `Ok(None)`（不排序）；非空且无法识别 ⇒ `Err`（拒绝，
/// **不**沿用底层「静默回退主键」的行为）。
pub fn resolve_sort_field(raw: Option<&str>) -> Result<Option<ProductSortField>, String> {
    match raw {
        Some(r) if !r.trim().is_empty() => {
            ProductSortField::parse(Some(r)).map(Some).ok_or_else(|| {
                format!(
                    "排序字段「{r}」不支持，可用的有：{}",
                    ProductSortField::supported_values()
                )
            })
        }
        _ => Ok(None),
    }
}

// ——————————————————————————————————————————————
// 商品列表 / 详情 / 写结果 VO
// ——————————————————————————————————————————————

/// 对应 Java `com.tigshop.bean.vo.workbuddy.ProductSummaryVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductSummaryVO {
    pub product_id: Option<i32>,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub price: Option<Decimal>,
    pub stock: Option<i32>,
    /// 上下架状态中文名。
    pub status: Option<String>,
    /// 审核状态中文名。
    pub audit_status: Option<String>,
    /// 商品类型中文名。
    pub product_type: Option<String>,
    pub category_name: Option<String>,
    /// 规格数；1 表示单规格商品。
    pub sku_count: Option<i32>,
    pub sales: Option<i32>,
    /// 是否在回收站中。
    pub recycled: bool,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.ProductSearchVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductSearchVO {
    pub items: Vec<ProductSummaryVO>,
    /// 命中总数，非本页条数。
    pub total: Option<i64>,
    pub page: Option<i32>,
    pub size: Option<i32>,
    /// 本次实际生效的查询范围中文名。
    pub scope: Option<String>,
    /// 本次实际生效的排序说明；未指定排序时为空。
    pub sorted_by: Option<String>,
}

/// 对应 Java `ProductDetailVO.Sku`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductDetailSku {
    pub sku_id: Option<i32>,
    /// 规格值，如 `"红色 / XL"`。
    pub specs: Option<String>,
    pub sku_sn: Option<String>,
    pub price: Option<Decimal>,
    pub stock: Option<i32>,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.ProductDetailVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductDetailVO {
    pub product_id: Option<i32>,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub price: Option<Decimal>,
    /// 市场价，即前台的划线价。
    pub market_price: Option<Decimal>,
    pub stock: Option<i32>,
    pub status: Option<String>,
    pub audit_status: Option<String>,
    /// 审核未通过时的原因；其余状态为空。
    pub audit_reason: Option<String>,
    pub product_type: Option<String>,
    pub category_name: Option<String>,
    pub brand_name: Option<String>,
    pub brief: Option<String>,
    /// 主图地址。
    pub pic_url: Option<String>,
    pub sales: Option<i32>,
    pub sort_order: Option<i32>,
    pub recycled: bool,
    /// 单规格商品为空列表。
    pub skus: Vec<ProductDetailSku>,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.ProductWriteResultVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductWriteResultVO {
    pub product_id: Option<i32>,
    pub product_name: Option<String>,
    /// 改动项的中文名。
    pub changed_field: Option<String>,
    pub before: Option<String>,
    pub after: Option<String>,
    /// 本次操作的连带后果。
    pub consequences: Vec<String>,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.PromotionLinksVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PromotionLinksVO {
    pub product_id: Option<i32>,
    pub product_name: Option<String>,
    pub h5_short_link: Option<String>,
    pub h5_original_link: Option<String>,
    pub pc_short_link: Option<String>,
    pub pc_original_link: Option<String>,
    /// 小程序码，形如 `data:image/png;base64,...` 的内联图片。
    pub mini_code: Option<String>,
    pub wechat_short_link: Option<String>,
    /// 微信短链生成失败的原因；非空即代表 `wechatShortLink` 不可用。
    pub wechat_short_link_error: Option<String>,
    /// 海报是否可由后端提供。恒为 `false`。
    pub poster_available: bool,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.ProductAnalysisVO`。
///
/// `metrics` / `rankings` / `recommendations` 在 Java 里是
/// `Map<String,Object>` 与 `List<Map<String,Object>>`，故这里用
/// `serde_json::Value` 直出。⚠️ `serde_json::Map` 默认 **`BTreeMap`（按键排序）**，
/// 而 Java `LinkedHashMap` 保插入序；键集合一致但输出顺序不同，
/// 见 `uncertain_points`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductAnalysisVO {
    pub metrics: Option<serde_json::Value>,
    pub rankings: Vec<serde_json::Value>,
    pub recommendations: Vec<serde_json::Value>,
    pub data_scope: Option<String>,
    pub sample_size: Option<i32>,
    /// Java `LocalDateTime.now()`；Rust 侧用 `chrono::NaiveDateTime` 序列化。
    pub generated_at: Option<chrono::NaiveDateTime>,
    /// 本次样本按商品创建时间过滤的开始时间。
    pub data_start_time: Option<chrono::NaiveDateTime>,
    /// 本次样本按商品创建时间过滤的结束时间。
    pub data_end_time: Option<chrono::NaiveDateTime>,
    pub confidence: Option<f64>,
    pub fallback_message: Option<String>,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.ProductCategoryVO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductCategoryVO {
    pub category_id: Option<i32>,
    pub category_name: Option<String>,
    /// 从顶级到本级的完整路径。
    pub path: Option<String>,
    pub parent_id: Option<i32>,
    /// 是否还有下级。
    pub has_children: bool,
}

/// 对应 Java `BatchPreviewVO.Blocked`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchBlocked {
    pub product_id: Option<i32>,
    pub product_name: Option<String>,
    pub reason: Option<String>,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.BatchPreviewVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchPreviewVO {
    pub preview_id: Option<String>,
    pub operation: Option<String>,
    pub consequences: Vec<String>,
    pub affected: Vec<ProductSummaryVO>,
    pub blocked: Vec<BatchBlocked>,
    /// 本次操作是否不可恢复。
    pub irreversible: bool,
}

/// 对应 Java `BatchResultVO.Failure`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchFailure {
    pub product_id: Option<i32>,
    pub product_name: Option<String>,
    pub message: Option<String>,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.BatchResultVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchResultVO {
    pub operation: Option<String>,
    pub success_count: Option<i32>,
    pub affected: Vec<ProductSummaryVO>,
    pub consequences: Vec<String>,
    pub failed: Vec<BatchFailure>,
}

// ——————————————————————————————————————————————
// 商品导入 / 校验（ProductImportServiceImpl）
// ——————————————————————————————————————————————

/// 对应 Java `com.tigshop.bean.dto.workbuddy.ProductMediaDraftDTO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductMediaDraftDTO {
    pub asset_id: Option<i32>,
    pub r#type: Option<String>,
    pub role: Option<String>,
    pub url: Option<String>,
    pub cover_url: Option<String>,
    pub format: Option<String>,
}

/// 对应 Java `com.tigshop.bean.dto.workbuddy.ProductSkuDraftDTO`。
///
/// ⚠️ Java 用 `LinkedHashMap` 保存 `specs`（**保持插入顺序**，
/// 规格名顺序会影响 `sku_value` 与 `attrList` 的生成）。
/// Rust 侧此处用 `BTreeMap`（**键排序**），这是一处**有意偏离**，
/// 见 `uncertain_points`：JSON 对象本身无序，但 `build_sku_value`
/// 的拼接顺序会随之变化。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductSkuDraftDTO {
    /// 规格名到规格值；同一批 SKU 的规格名必须一致。
    pub specs: BTreeMap<String, String>,
    pub price: Option<Decimal>,
    pub stock: Option<i32>,
    /// 规格编码，留空时由系统按 `商品编码-规格ID` 自动生成。
    pub sku_sn: Option<String>,
    pub sku_tsn: Option<String>,
    pub market_price: Option<Decimal>,
    pub cost_price: Option<Decimal>,
}

/// 对应 Java `com.tigshop.bean.dto.workbuddy.ProductDraftDTO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductDraftDTO {
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub product_price: Option<Decimal>,
    pub category_id: Option<i32>,
    /// 分类名称路径，用 `/` 或 `|` 分隔，如 `女鞋/运动系列`。
    pub category_name: Option<String>,
    pub product_stock: Option<i32>,
    /// 上架状态：1 上架，0 下架；缺省为上架。
    pub product_status: Option<i32>,
    pub product_brief: Option<String>,
    pub product_desc: Option<String>,
    /// 商品图片 URL，按顺序排列，首张为主图。
    pub images: Vec<String>,
    pub detail_images: Vec<String>,
    /// 结构化媒体素材。
    pub media: Vec<ProductMediaDraftDTO>,
    pub market_price: Option<Decimal>,
    pub cost_price: Option<Decimal>,
    pub product_tsn: Option<String>,
    pub keywords: Option<String>,
    pub skus: Vec<ProductSkuDraftDTO>,
    /// 字段来源：`user_provided` / `ai_recommended` / `site_default`。
    pub field_sources: BTreeMap<String, String>,
}

/// 对应 Java `ProductValidationVO.FieldError`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductFieldError {
    pub field: Option<String>,
    pub code: Option<String>,
    /// ⚠️ Java `err()` 把 `code` **原样**赋给 `message`
    /// （`e.setMessage(c)`），故二者恒等。
    pub message: Option<String>,
}

impl ProductFieldError {
    /// Java `ProductImportServiceImpl.err(item, field, code)`。
    #[must_use]
    pub fn new(field: &str, code: &str) -> Self {
        Self {
            field: Some(field.to_string()),
            code: Some(code.to_string()),
            message: Some(code.to_string()),
        }
    }
}

/// 对应 Java `ProductValidationVO.Item`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductValidationItem {
    pub index: i32,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub valid: bool,
    pub errors: Vec<ProductFieldError>,
    /// 非阻塞提醒。
    pub warnings: Vec<String>,
    /// 字段来源。
    pub source: BTreeMap<String, String>,
    /// 服务端归一化后的草稿。
    pub product: Option<ProductDraftDTO>,
    pub missing_fields: Vec<String>,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.ProductValidationVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductValidationVO {
    pub preview_id: Option<String>,
    pub total: i32,
    pub valid: bool,
    /// 所有商品的阻塞字段并集。
    pub missing_fields: Vec<String>,
    pub items: Vec<ProductValidationItem>,
}

/// 对应 Java `ProductImportResultVO.Verification`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductImportVerification {
    /// `verified` / `mismatch` / `failed`。
    pub status: Option<String>,
    pub checked_fields: Vec<String>,
    pub mismatches: Vec<String>,
    pub message: Option<String>,
}

/// 对应 Java `ProductImportResultVO.Item`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductImportItem {
    pub index: i32,
    pub success: bool,
    pub product_id: Option<i32>,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    /// 商品落库状态：0 下架，1 上架；失败时为空。
    pub product_status: Option<i32>,
    pub error_code: Option<String>,
    pub message: Option<String>,
    pub suggestion: Option<String>,
    pub retryable: bool,
    pub verification: Option<ProductImportVerification>,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.ProductImportResultVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductImportResultVO {
    pub request_id: Option<String>,
    pub preview_id: Option<String>,
    pub total: i32,
    pub success_count: i32,
    pub failure_count: i32,
    pub items: Vec<ProductImportItem>,
}

/// 对应 Java `ProductRequirementsVO.Field`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductRequirementField {
    pub name: Option<String>,
    pub label: Option<String>,
    pub r#type: Option<String>,
    pub required: bool,
    pub description: Option<String>,
    pub constraint: Option<String>,
    pub example: Option<String>,
    pub default_value: Option<String>,
    pub template_hint: Option<String>,
    pub template_example: Option<String>,
    pub template_section: Option<String>,
}

impl ProductRequirementField {
    /// Java `TemplateSection.OMITTED`。
    pub const SECTION_OMITTED: &'static str = "OMITTED";
    /// Java `TemplateSection.REQUIRED`。
    pub const SECTION_REQUIRED: &'static str = "REQUIRED";

    /// 构造一个字段（对齐 Java `.builder()` 的必填项）。
    #[must_use]
    pub fn new(name: &str, label: &str, ty: &str, required: bool) -> Self {
        Self {
            name: Some(name.to_string()),
            label: Some(label.to_string()),
            r#type: Some(ty.to_string()),
            required,
            ..Self::default()
        }
    }

    #[must_use]
    pub fn description(mut self, v: &str) -> Self {
        self.description = Some(v.to_string());
        self
    }

    #[must_use]
    pub fn constraint(mut self, v: &str) -> Self {
        self.constraint = Some(v.to_string());
        self
    }

    #[must_use]
    pub fn example(mut self, v: &str) -> Self {
        self.example = Some(v.to_string());
        self
    }

    #[must_use]
    pub fn default_value(mut self, v: &str) -> Self {
        self.default_value = Some(v.to_string());
        self
    }

    #[must_use]
    pub fn template_hint(mut self, v: &str) -> Self {
        self.template_hint = Some(v.to_string());
        self
    }

    #[must_use]
    pub fn template_example(mut self, v: &str) -> Self {
        self.template_example = Some(v.to_string());
        self
    }

    #[must_use]
    pub fn template_section(mut self, v: &str) -> Self {
        self.template_section = Some(v.to_string());
        self
    }
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.ProductRequirementsVO`。
///
/// ⚠️ Java `requirements()` 末尾显式 `v.setTemplate(null)`（模板已废用），
/// 故本结构**不输出** `template` 键。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductRequirementsVO {
    pub fields: Vec<ProductRequirementField>,
    pub workflow: Vec<String>,
    pub unsupported: Vec<String>,
}

/// Java `ProductImportServiceImpl.maxProductNameLength`：
/// 读配置 `customProductNameLength`，缺失/非法时回落
/// [`DEFAULT_PRODUCT_NAME_LENGTH`]。
#[must_use]
pub fn max_product_name_length(configured: Option<&str>) -> i32 {
    match configured {
        Some(raw) if !raw.trim().is_empty() => raw
            .trim()
            .parse::<i32>()
            .unwrap_or(DEFAULT_PRODUCT_NAME_LENGTH),
        _ => DEFAULT_PRODUCT_NAME_LENGTH,
    }
}

/// Java `ProductImportServiceImpl.marketPriceRate()`：
/// 配置 `marketPriceRate` 可解析则用之，否则 `1.2`。
#[must_use]
pub fn market_price_rate(configured: Option<&str>) -> Decimal {
    match configured {
        Some(raw) if !raw.trim().is_empty() => raw
            .trim()
            .parse::<Decimal>()
            .unwrap_or_else(|_| dec(DEFAULT_MARKET_PRICE_RATE_STR)),
        _ => dec(DEFAULT_MARKET_PRICE_RATE_STR),
    }
}

/// Java `ProductImportServiceImpl.resolveMarketPrice`：
/// 给定市场价 `> 0` 时原样返回；否则用售价 × 倍率（HALF_UP 保留 2 位）；
/// 售价也为 `None` 时返回 `None`。
#[must_use]
pub fn resolve_market_price(
    given: Option<Decimal>,
    product_price: Option<Decimal>,
    rate: Decimal,
) -> Option<Decimal> {
    if let Some(g) = given {
        if g > Decimal::ZERO {
            return Some(g);
        }
    }
    let price = product_price?;
    Some(round2(price.checked_mul(rate).unwrap_or(Decimal::ZERO)))
}

/// Java `ProductImportServiceImpl.hasInvalidImage`：只校验协议前缀。
///
/// 空白项不算非法（`StrUtil.isNotBlank(url) && !startsWith(http)`）。
#[must_use]
pub fn has_invalid_image(images: &[String]) -> bool {
    images.iter().any(|raw| {
        let url = raw.trim();
        !url.is_empty() && !url.starts_with("http://") && !url.starts_with("https://")
    })
}

/// Java `ProductImportServiceImpl.dedupe`：按序去空白去重。
#[must_use]
pub fn dedupe_urls(urls: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for raw in urls {
        let url = raw.trim();
        if url.is_empty() {
            continue;
        }
        if seen.insert(url.to_string()) {
            out.push(url.to_string());
        }
    }
    out
}

/// Java `ProductImportServiceImpl.mediaImageUrls`：
/// `type == image` 且 `role ∈ {main_image, gallery_image, null}` 才算商品图。
#[must_use]
pub fn media_image_urls(media: &[ProductMediaDraftDTO]) -> Vec<String> {
    let mut out = Vec::new();
    for m in media {
        let ty = m.r#type.as_deref().unwrap_or("");
        if !ty.eq_ignore_ascii_case("image") {
            continue;
        }
        let role_ok = match m.role.as_deref() {
            None => true,
            Some(r) => {
                r.eq_ignore_ascii_case("main_image") || r.eq_ignore_ascii_case("gallery_image")
            }
        };
        if !role_ok {
            continue;
        }
        if let Some(u) = m.url.as_deref() {
            if !u.trim().is_empty() {
                out.push(u.to_string());
            }
        }
    }
    out
}

/// Java `ProductImportServiceImpl.mapMedia` 里的详情图抽取：
/// `type == image` 且 `role == detail_image`。
#[must_use]
pub fn media_detail_image_urls(media: &[ProductMediaDraftDTO]) -> Vec<String> {
    media
        .iter()
        .filter(|m| {
            m.r#type
                .as_deref()
                .is_some_and(|t| t.eq_ignore_ascii_case("image"))
                && m.role
                    .as_deref()
                    .is_some_and(|r| r.eq_ignore_ascii_case("detail_image"))
        })
        .filter_map(|m| m.url.as_deref())
        .filter(|u| !u.trim().is_empty())
        .map(str::to_string)
        .collect()
}

/// Java `validate` 里 `images` 的候选集合：
/// `mediaImageUrls(media)` 后接 `draft.images`。
#[must_use]
pub fn candidate_images(draft: &ProductDraftDTO) -> Vec<String> {
    let mut v = media_image_urls(&draft.media);
    v.extend(draft.images.iter().cloned());
    v
}

/// Java `validate` 的 `images` 缺失判定：
/// `mediaImages.isEmpty() || all isBlank`。
#[must_use]
pub fn images_all_blank(images: &[String]) -> bool {
    images.iter().all(|s| s.trim().is_empty())
}

/// Java `SpecImportUtils.buildSkuValue` 的可观测形态。
///
/// ⚠️ 真实分隔符在 `com.tigshop.common.utils.SpecImportUtils`（本片未读到），
/// 见 `uncertain_points`。此处按 `名:值;` 实现以保持**进程内**一致
/// （仅用于组合去重比较，不影响对外 JSON 结构）。
#[must_use]
pub fn build_sku_value(pairs: &[(String, String)]) -> String {
    pairs
        .iter()
        .map(|(n, v)| format!("{n}:{v}"))
        .collect::<Vec<_>>()
        .join(";")
}

/// Java `ProductImportServiceImpl.toPairs`：
/// trim 后名与值都非空的才纳入。
#[must_use]
pub fn sku_pairs(specs: &BTreeMap<String, String>) -> Vec<(String, String)> {
    specs
        .iter()
        .filter_map(|(name, value)| {
            let n = name.trim();
            let v = value.trim();
            if n.is_empty() || v.is_empty() {
                None
            } else {
                Some((n.to_string(), v.to_string()))
            }
        })
        .collect()
}

// ——————————————————————————————————————————————
// 商品上下文（ProductContextServiceImpl）
// ——————————————————————————————————————————————

/// 对应 Java `ProductContextVO.Metrics`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductContextMetrics {
    pub sales_avg: Option<f64>,
    pub sales_median: Option<f64>,
    pub stock_avg: Option<f64>,
    pub stock_median: Option<f64>,
    pub price_min: Option<Decimal>,
    pub price_median: Option<Decimal>,
    pub price_max: Option<Decimal>,
    pub product_count: Option<i32>,
}

/// 对应 Java `ProductContextVO.Fallback`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductContextFallback {
    pub code: Option<String>,
    pub message: Option<String>,
}

impl ProductContextFallback {
    /// Java `new Fallback("NO_MATCHING_DATA", "没有匹配数据，可先依据通用经验完善商品信息")`。
    pub const CODE_NO_MATCHING_DATA: &'static str = "NO_MATCHING_DATA";
    /// Java 空数据回落文案。
    pub const MSG_NO_MATCHING_DATA: &'static str = "没有匹配数据，可先依据通用经验完善商品信息";

    #[must_use]
    pub fn no_matching_data() -> Self {
        Self {
            code: Some(Self::CODE_NO_MATCHING_DATA.to_string()),
            message: Some(Self::MSG_NO_MATCHING_DATA.to_string()),
        }
    }
}

/// 对应 Java `ProductContextVO.EncodingInference`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct EncodingInference {
    pub pattern: Option<String>,
    pub prefix: Option<String>,
    pub separator: Option<String>,
    pub number_length: Option<i32>,
    pub next_candidate: Option<String>,
    pub confidence: Option<f64>,
    pub needs_confirmation: bool,
    pub reason: Option<String>,
    pub samples: Vec<String>,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.ProductContextVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductContextVO {
    pub has_data: bool,
    pub category_id: Option<i32>,
    pub category_name: Option<String>,
    pub sample_size: Option<i32>,
    pub metrics: Option<ProductContextMetrics>,
    /// ⚠️ Java `List<Map<String,Object>>`；`serde_json::Map` 默认按键排序
    /// （Java `LinkedHashMap` 保插入序），见 `uncertain_points`。
    pub patterns: Vec<serde_json::Value>,
    pub samples: Vec<ProductSummaryVO>,
    pub fallback: Option<ProductContextFallback>,
    pub encoding: Option<EncodingInference>,
    pub defaults: serde_json::Map<String, serde_json::Value>,
}

/// Java `ProductContextServiceImpl` 的置信度常量。
pub const CONFIDENCE_PRICE: f64 = 0.55;
/// Java `defaults()` 中 `marketPrice` 的置信度。
pub const CONFIDENCE_MARKET_PRICE: f64 = 0.45;
/// Java `defaults()` 中 `productStock` 的置信度。
pub const CONFIDENCE_STOCK: f64 = 0.45;
/// Java `defaults()` 的市场价换算倍率。
pub const CONTEXT_MARKET_PRICE_FACTOR_STR: &str = "1.2";
/// Java 编码推断里 `confidence >= 0.999` 时的文案分支阈值。
pub const ENCODING_EXACT_CONFIDENCE: f64 = 0.999;
/// Java 编码推断的置信度上限（`Math.min(0.99d, confidence)`）。
pub const ENCODING_CONFIDENCE_CAP: f64 = 0.99;
/// Java 样本不足（`sns.size() < 2`）时的置信度。
pub const ENCODING_CONFIDENCE_TOO_FEW: f64 = 0.0;
/// Java 无可用分组时的置信度。
pub const ENCODING_CONFIDENCE_NO_GROUPS: f64 = 0.2;
/// Java 判定不明确时的置信度。
pub const ENCODING_CONFIDENCE_UNDECISIVE: f64 = 0.2;
/// Java 序号溢出时的置信度。
pub const ENCODING_CONFIDENCE_OVERFLOW: f64 = 0.35;
/// Java 编码格式不统一时的提示语。
pub const MSG_ENCODING_INCONSISTENT: &str = "当前商品编码格式不统一，请确认本次使用哪种格式";
/// Java 样本不足时的提示语。
pub const MSG_ENCODING_TOO_FEW: &str = "可用商品编码样本不足，无法可靠推断格式";
/// Java 序号溢出时的提示语。
pub const MSG_ENCODING_OVERFLOW: &str = "编码序号已超过历史位数，请确认新的编码规则";
/// Java 主分组唯一时的提示语。
pub const MSG_ENCODING_DOMINANT_EXACT: &str = "多个商品使用同一前缀和数字位数，按最大序号顺延";
/// Java 主流格式顺延的提示语。
pub const MSG_ENCODING_DOMINANT_MAJORITY: &str =
    "历史商品中该编码格式占明显多数，按该主流格式的最大序号顺延";

/// 校验 `context` 的入参（Java `ProductContextServiceImpl.context` 前三段）。
pub fn validate_context_params(
    keyword: Option<&str>,
    category_id: Option<i32>,
    sample_size: Option<i32>,
) -> Result<(), (&'static str, &'static str)> {
    let keyword_blank = keyword.is_none_or(|k| k.trim().is_empty());
    if keyword_blank && category_id.is_none() {
        return Err((CODE_MISSING_FILTER, "keyword 或 categoryId 至少提供一个"));
    }
    if let Some(c) = category_id {
        if c <= 0 {
            return Err((CODE_INVALID_CATEGORY_ID, "categoryId 必须为正整数"));
        }
    }
    let size = sample_size.unwrap_or(CONTEXT_DEFAULT_SAMPLE_SIZE);
    if !(1..=100).contains(&size) {
        return Err((CODE_INVALID_SAMPLE_SIZE, "sampleSize 必须在 1 到 100 之间"));
    }
    Ok(())
}

/// Java `ProductContextServiceImpl.avg`（空列表 ⇒ `None`）。
#[must_use]
pub fn int_avg(values: &[i32]) -> Option<f64> {
    if values.is_empty() {
        return None;
    }
    let sum: f64 = values.iter().map(|v| f64::from(*v)).sum();
    Some(sum / values.len() as f64)
}

/// Java `ProductContextServiceImpl.median`（偶数取中间两数均值）。
#[must_use]
pub fn int_median(values: &[i32]) -> Option<f64> {
    if values.is_empty() {
        return None;
    }
    let mut s = values.to_vec();
    s.sort_unstable();
    let n = s.len();
    if n % 2 == 1 {
        Some(f64::from(s[n / 2]))
    } else {
        Some((f64::from(s[n / 2 - 1]) + f64::from(s[n / 2])) / 2.0)
    }
}

/// Java `ProductContextServiceImpl.priceMedian`：
/// 奇数取中位；偶数取中间两数之和 / 2，保留 8 位 HALF_UP 后去尾零。
#[must_use]
pub fn price_median(values: &[Decimal]) -> Option<Decimal> {
    if values.is_empty() {
        return None;
    }
    let mut s = values.to_vec();
    s.sort();
    let n = s.len();
    if n % 2 == 1 {
        Some(s[n / 2].normalize())
    } else {
        let sum = s[n / 2 - 1].checked_add(s[n / 2])?;
        Some(
            sum.checked_div(Decimal::from(2))?
                .round_dp_with_strategy(8, RoundingStrategy::MidpointAwayFromZero)
                .normalize(),
        )
    }
}

/// Java `ProductContextServiceImpl.suggestion`：`{value, source, confidence}`。
#[must_use]
pub fn suggestion(value: serde_json::Value, source: &str, confidence: f64) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    map.insert("value".to_string(), value);
    map.insert(
        "source".to_string(),
        serde_json::Value::String(source.to_string()),
    );
    map.insert(
        "confidence".to_string(),
        serde_json::Number::from_f64(confidence)
            .map_or(serde_json::Value::Null, serde_json::Value::Number),
    );
    serde_json::Value::Object(map)
}

/// Java `ProductContextServiceImpl.defaults`：由指标推导 AI 建议值。
///
/// 键序与 Java `LinkedHashMap` 一致：`productPrice` → `marketPrice`
/// → `productStock`。
#[must_use]
pub fn context_defaults(
    metrics: &ProductContextMetrics,
) -> serde_json::Map<String, serde_json::Value> {
    let mut out = serde_json::Map::new();
    if let Some(median) = metrics.price_median {
        let factor = dec(CONTEXT_MARKET_PRICE_FACTOR_STR);
        out.insert(
            "productPrice".to_string(),
            suggestion(
                serde_json::Value::String(median.normalize().to_string()),
                "ai_recommended",
                CONFIDENCE_PRICE,
            ),
        );
        let market = round2(median.checked_mul(factor).unwrap_or(Decimal::ZERO));
        out.insert(
            "marketPrice".to_string(),
            suggestion(
                serde_json::Value::String(market.normalize().to_string()),
                "ai_recommended",
                CONFIDENCE_MARKET_PRICE,
            ),
        );
    }
    if let Some(stock_median) = metrics.stock_median {
        // Java `Math.max(0, Math.round(metrics.getStockMedian()))`
        let rounded = stock_median.round().max(0.0);
        out.insert(
            "productStock".to_string(),
            suggestion(
                serde_json::Value::from(rounded),
                "ai_recommended",
                CONFIDENCE_STOCK,
            ),
        );
    }
    out
}

/// Java `ProductContextServiceImpl.inferEncoding` 的分组键：
/// 正则 `^(.*?)(\d+)$` 的 `prefix + "#" + digits.length()`。
///
/// 返回 `None` 表示该编码没有数字后缀。
#[must_use]
pub fn encoding_group_key(sn: &str) -> Option<(String, usize)> {
    let chars: Vec<char> = sn.chars().collect();
    let mut digit_start = chars.len();
    while digit_start > 0 && chars[digit_start - 1].is_ascii_digit() {
        digit_start -= 1;
    }
    if digit_start == chars.len() {
        // 没有数字后缀：`^(.*?)(\d+)$` 不匹配
        return None;
    }
    let prefix: String = chars[..digit_start].iter().collect();
    Some((prefix, chars.len() - digit_start))
}

/// [`encoding_decision`] 的结果。
#[derive(Debug, Clone, PartialEq)]
pub enum EncodingDecision {
    /// 没有任何编码匹配 `^(.*?)(\d+)$`。
    NoGroups,
    /// 有分组。
    Grouped {
        /// 分组前缀。
        prefix: String,
        /// 数字位数。
        number_length: usize,
        /// 主分组的样本数。
        dominant: usize,
        /// 次分组的样本数（无次分组时为 0）。
        second: usize,
        /// 主分组占全部样本的比例。
        confidence: f64,
        /// 是否判定明确（可给出候选值）。
        decisive: bool,
    },
}

/// Java `inferEncoding` 的判定逻辑（纯函数）。
///
/// 入参 `sns` 为**去重后的非空** `productSn` 列表。
/// ⚠️ Java 在 `sns.size() < 2` 时**提前返回**，该分支由调用方处理
/// （本函数只负责有足够样本时的分组与判定）。
#[must_use]
pub fn encoding_decision(sns: &[String]) -> EncodingDecision {
    let mut counts: BTreeMap<String, usize> = BTreeMap::new();
    let mut matched = 0usize;
    for sn in sns {
        if let Some((prefix, len)) = encoding_group_key(sn) {
            *counts.entry(format!("{prefix}#{len}")).or_insert(0) += 1;
            matched += 1;
        }
    }
    if counts.is_empty() {
        return EncodingDecision::NoGroups;
    }
    // Java 排序：数量降序，其次键升序
    let mut ranked: Vec<(String, usize)> = counts.into_iter().collect();
    ranked.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    let (key, dominant) = ranked[0].clone();
    let second = ranked.get(1).map_or(0, |(_, c)| *c);
    let confidence = if sns.is_empty() {
        0.0
    } else {
        dominant as f64 / sns.len() as f64
    };
    let decisive = matched == sns.len()
        && dominant >= MIN_DOMINANT_ENCODING_SAMPLES
        && confidence >= DOMINANT_ENCODING_THRESHOLD
        && (second == 0 || dominant >= second * 2);
    let (prefix, number_length) = match key.split_once('#') {
        Some((p, l)) => (p.to_string(), l.parse::<usize>().unwrap_or(0)),
        None => (key, 0),
    };
    EncodingDecision::Grouped {
        prefix,
        number_length,
        dominant,
        second,
        confidence,
        decisive,
    }
}

/// Java `formatCandidate`：`prefix + 左补 0 到 length 位 + number`。
#[must_use]
pub fn format_candidate(prefix: &str, length: usize, number: u64) -> String {
    let digits = number.to_string();
    let pad = length.saturating_sub(digits.len());
    format!("{prefix}{}{digits}", "0".repeat(pad))
}

/// Java `inferEncoding` 溢出判定：`next.toString().length() > length`。
#[must_use]
pub fn encoding_overflowed(next: u64, length: usize) -> bool {
    next.to_string().len() > length
}

/// Java `inferEncoding` 的候选上限：`10^length - 1`。
///
/// 位数过大时返回 `None`（`u64` 溢出保护；Java 用 `BigInteger` 无此限制）。
#[must_use]
pub fn encoding_max_number(length: usize) -> Option<u64> {
    if length > 19 {
        return None;
    }
    let mut acc: u64 = 1;
    for _ in 0..length {
        acc = acc.checked_mul(10)?;
    }
    acc.checked_sub(1)
}

// ——————————————————————————————————————————————
// 媒体（MediaOperationDTO / MediaQueryDTO / 上传 DTO / 上传校验）
// ——————————————————————————————————————————————

/// 对应 Java `com.tigshop.bean.dto.workbuddy.MediaUploadFileDTO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MediaUploadFileDTO {
    pub id: Option<i32>,
    pub client_file_id: Option<String>,
    /// 通过临时上传接口生成的文件令牌；优先于 Base64。
    pub file_token: Option<String>,
    #[serde(alias = "fileName")]
    pub name: Option<String>,
    #[serde(alias = "mime")]
    pub mime_type: Option<String>,
    #[serde(alias = "content", alias = "base64")]
    pub content_base64: Option<String>,
    pub group_id: Option<i32>,
    pub role: Option<String>,
}

/// 对应 Java `com.tigshop.bean.dto.workbuddy.MediaUploadRequestDTO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MediaUploadRequestDTO {
    pub confirmation: bool,
    /// 未单独指定文件分组时使用的默认素材分组。
    pub group_id: Option<i32>,
    pub files: Vec<MediaUploadFileDTO>,
}

/// 对应 Java `com.tigshop.bean.dto.workbuddy.MediaOperationDTO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MediaOperationDTO {
    pub operation: Option<String>,
    pub items: Vec<MediaUploadFileDTO>,
    /// 单项素材/分组 ID；批量操作使用 `ids`。
    pub id: Option<i32>,
    pub ids: Option<Vec<i32>>,
    /// 素材或分组名称。
    pub name: Option<String>,
    /// `image` / `video`。
    pub r#type: Option<String>,
    pub group_id: Option<i32>,
    /// 图片排序值；仅用于后台允许的排序字段。
    pub sort: Option<i32>,
    pub preview_id: Option<String>,
    pub request_id: Option<String>,
    pub confirmation: Option<bool>,
    /// 客户端若误传本地路径将被明确拒绝。
    pub local_path: Option<String>,
}

/// 对应 Java `com.tigshop.bean.dto.workbuddy.MediaQueryDTO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MediaQueryDTO {
    pub operation: Option<String>,
    pub r#type: Option<String>,
    pub group_id: Option<i32>,
    pub keyword: Option<String>,
    pub page: Option<i32>,
    #[serde(alias = "size")]
    pub page_size: Option<i32>,
    pub id: Option<i32>,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.MediaAssetVO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MediaAssetVO {
    pub client_file_id: Option<String>,
    pub asset_id: Option<i32>,
    /// `image` / `video`。
    pub r#type: Option<String>,
    pub role: Option<String>,
    pub url: Option<String>,
    pub cover_url: Option<String>,
    pub format: Option<String>,
    pub group_id: Option<i32>,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.MediaUploadResultVO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MediaUploadResultVO {
    pub status: Option<String>,
    pub total: i32,
    pub success_count: i32,
    pub failed_count: i32,
    pub assets: Vec<MediaAssetVO>,
    pub failure_summary: BTreeMap<String, i32>,
    pub summary: Option<String>,
    pub retryable: bool,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.MediaGroupVO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MediaGroupVO {
    pub id: Option<i32>,
    pub name: Option<String>,
    pub asset_count: i32,
    pub r#type: Option<String>,
    pub children: Vec<MediaGroupVO>,
}

/// Java `McpMediaUploadServiceImpl.normalizePlatformShopId`：
/// 允许 `None` / `0`；负数或非 0 报错。
pub fn normalize_platform_shop_id(
    shop_id: Option<i32>,
) -> Result<i32, (&'static str, &'static str)> {
    match shop_id {
        None | Some(0) => Ok(0),
        Some(s) if s < 0 => Err((CODE_INVALID_SHOP_ID, "shopId must be non-negative")),
        Some(_) => Err((
            CODE_PLATFORM_SCOPE_REQUIRED,
            "media upload requires platform shop scope",
        )),
    }
}

/// Java `McpMediaUploadServiceImpl.currentContextShopId`：
/// `X-ADMIN-TYPE` 为 `admin`/缺省 ⇒ `0`；`shop`/`pos` ⇒ `X-SHOP-ID`
/// （缺失或不合法 ⇒ `-1`）；其它租户类型 ⇒ `-1`。
#[must_use]
pub fn context_shop_id(admin_type: Option<&str>, shop_id_header: Option<&str>) -> i32 {
    match admin_type {
        None => 0,
        Some(t) if t.trim().is_empty() => 0,
        Some(t) if t.eq_ignore_ascii_case("admin") => 0,
        Some(t) if t.eq_ignore_ascii_case("shop") || t.eq_ignore_ascii_case("pos") => {
            match shop_id_header {
                Some(v) if !v.trim().is_empty() => v.trim().parse::<i32>().unwrap_or(-1),
                _ => -1,
            }
        }
        Some(_) => -1,
    }
}

/// Java `MediaManagementServiceImpl.requirePlatform`：非 0 即 403。
pub fn require_platform_scope(shop_id: Option<i32>) -> Result<(), (&'static str, &'static str)> {
    match shop_id {
        Some(0) | None => Ok(()),
        Some(_) => Err((
            CODE_PLATFORM_SCOPE_REQUIRED,
            "media requires platform shop scope",
        )),
    }
}

/// Java `CategoryImportServiceImpl.requirePlatform`：非 0 即 403。
pub fn require_category_platform_scope(
    shop_id: Option<i32>,
) -> Result<(), (&'static str, &'static str)> {
    match shop_id {
        Some(0) | None => Ok(()),
        Some(_) => Err((
            CODE_PLATFORM_SCOPE_REQUIRED,
            "category requires platform shop scope",
        )),
    }
}

/// Java `McpMediaUploadServiceImpl.invalidName`：
/// 文件名含 `/`、`\`、`..`、`:` 即拒绝。
#[must_use]
pub fn invalid_file_name(name: &str) -> bool {
    name.contains('/') || name.contains('\\') || name.contains("..") || name.contains(':')
}

/// Java `McpMediaUploadServiceImpl.extension`：
/// 最后一个 `.` 之后的小写扩展名；`.` 在**首位**时返回空。
#[must_use]
pub fn file_extension(name: &str) -> String {
    match name.rfind('.') {
        Some(i) if i > 0 => name[i + 1..].to_lowercase(),
        _ => String::new(),
    }
}

/// Java `McpMediaUploadServiceImpl.matchesExtension`。
#[must_use]
pub fn matches_extension(name: &str, mime: &str) -> bool {
    let ext = file_extension(name);
    match mime {
        "image/jpeg" => ext == "jpg" || ext == "jpeg",
        "image/png" => ext == "png",
        "image/gif" => ext == "gif",
        "image/webp" => ext == "webp",
        "image/tiff" => ext == "tif" || ext == "tiff",
        "video/mp4" => ext == "mp4",
        _ => false,
    }
}

/// Java `McpMediaUploadServiceImpl.signatureValid`：魔数校验。
#[must_use]
pub fn signature_valid(b: &[u8], mime: &str) -> bool {
    match mime {
        "image/png" => b.len() >= 8 && b[0] == 137 && b[1] == 80 && b[2] == 78 && b[3] == 71,
        "image/jpeg" => b.len() >= 3 && b[0] == 255 && b[1] == 216 && b[2] == 255,
        "image/gif" => b.len() >= 6 && b.starts_with(b"GIF"),
        "image/webp" => b.len() >= 12 && &b[0..4] == b"RIFF" && &b[8..12] == b"WEBP",
        "image/tiff" => {
            b.len() >= 4
                && ((b[0] == b'I' && b[1] == b'I' && b[2] == 42 && b[3] == 0)
                    || (b[0] == b'M' && b[1] == b'M' && b[2] == 0 && b[3] == 42))
        }
        "video/mp4" => b.len() >= 8 && &b[4..8] == b"ftyp",
        _ => false,
    }
}

/// Java `McpMediaUploadServiceImpl.multipartBytes`：
/// 解析 `50MB` / `100KB` / `1GB` / 裸字节数；失败回落 50MB。
#[must_use]
pub fn parse_size_bytes(raw: Option<&str>) -> i64 {
    let s = raw
        .unwrap_or(DEFAULT_MULTIPART_MAX_FILE_SIZE)
        .to_uppercase();
    let s = s.trim();
    let parsed = if let Some(v) = s.strip_suffix("GB") {
        v.trim().parse::<i64>().ok().map(|n| n * 1_073_741_824)
    } else if let Some(v) = s.strip_suffix("MB") {
        v.trim().parse::<i64>().ok().map(|n| n * MIB)
    } else if let Some(v) = s.strip_suffix("KB") {
        v.trim().parse::<i64>().ok().map(|n| n * 1024)
    } else {
        s.parse::<i64>().ok()
    };
    parsed.unwrap_or(50 * MIB)
}

/// Java `McpMediaUploadServiceImpl.imageBytes`：
/// 配置的 `imageUploadMaxSize`（单位 MB，可为小数）× MiB，
/// 再与 multipart 上限取小；配置缺失/非法回落 20 MiB。
#[must_use]
pub fn image_max_bytes(configured: Option<&str>, multipart: i64) -> i64 {
    let bytes = configured
        .and_then(|raw| raw.trim().parse::<f64>().ok())
        .map_or(20 * MIB, |v| (v * MIB as f64) as i64);
    bytes.min(multipart)
}

/// Java `McpMediaUploadServiceImpl.decode` 的 Base64 预估长度：
/// `len * 3 / 4`。
#[must_use]
pub fn estimated_base64_bytes(len: usize) -> i64 {
    (len as i64) * 3 / 4
}

/// Java `MediaManagementServiceImpl.statusCode`：
/// 由 HTTP 状态码推错误码。
#[must_use]
pub const fn status_code_to_error_code(status: i32) -> &'static str {
    if status == 413 {
        CODE_FILE_TOO_LARGE
    } else if status == 415 {
        CODE_UNSUPPORTED_MIME
    } else if status >= 500 {
        CODE_UPLOAD_RETRYABLE
    } else {
        CODE_INVALID_FILE
    }
}

/// Java `McpMediaUploadServiceImpl.classifyFailure` 的
/// `WorkBuddyApiException` 分支：
/// `retryable = isRetryable() || code ∈ {STORAGE_NOT_CONFIGURED, UPLOAD_RETRYABLE}`。
#[must_use]
pub fn failure_retryable(code: &str) -> bool {
    code == CODE_STORAGE_NOT_CONFIGURED || code == CODE_UPLOAD_RETRYABLE
}

/// Java `MediaManagementServiceImpl.preservePreviewForRetry`：
/// `failed` 且 `errorCode ∈ {MEDIA_IN_USE, SERVICE_UNAVAILABLE}` 时保留预览。
#[must_use]
pub fn preserve_preview_for_retry(result: &serde_json::Value) -> bool {
    let failed = result
        .get("status")
        .and_then(serde_json::Value::as_str)
        .is_some_and(|s| s == "failed");
    if !failed {
        return false;
    }
    result
        .get("errorCode")
        .and_then(serde_json::Value::as_str)
        .is_some_and(|c| c == CODE_MEDIA_IN_USE || c == CODE_SERVICE_UNAVAILABLE)
}

/// Java `MediaManagementServiceImpl.error(code)`：
/// `{errorCode, status: "failed"}`。
#[must_use]
pub fn media_error(code: &str) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    map.insert(
        "errorCode".to_string(),
        serde_json::Value::String(code.to_string()),
    );
    map.insert(
        "status".to_string(),
        serde_json::Value::String("failed".to_string()),
    );
    serde_json::Value::Object(map)
}

/// Java `MediaManagementServiceImpl.normalize`：`null` ⇒ `""`，
/// 否则 trim + 小写。
#[must_use]
pub fn normalize_operation(raw: Option<&str>) -> String {
    raw.map_or_else(String::new, |s| s.trim().to_lowercase())
}

/// Java `MediaManagementServiceImpl.trim`：trim 后为空 ⇒ `None`。
#[must_use]
pub fn trim_opt(raw: Option<&str>) -> Option<String> {
    let v = raw?;
    let t = v.trim();
    if t.is_empty() {
        None
    } else {
        Some(t.to_string())
    }
}

/// Java `MediaManagementServiceImpl.resolveIds`。
#[must_use]
pub fn resolve_media_ids(op: &MediaOperationDTO) -> Vec<i32> {
    if let Some(ids) = op.ids.as_ref() {
        if !ids.is_empty() {
            return ids.clone();
        }
    }
    if let Some(id) = op.id {
        return vec![id];
    }
    op.items.iter().filter_map(|f| f.id).collect::<Vec<_>>()
}

/// Java `MediaManagementServiceImpl.resolveId`。
#[must_use]
pub fn resolve_media_id(op: &MediaOperationDTO) -> Option<i32> {
    if let Some(id) = op.id {
        return Some(id);
    }
    resolve_media_ids(op).first().copied()
}

/// Java `MediaManagementServiceImpl.impactCount`。
#[must_use]
pub fn media_impact_count(op: &MediaOperationDTO) -> i32 {
    if !op.items.is_empty() {
        return op.items.len() as i32;
    }
    if let Some(ids) = op.ids.as_ref() {
        return ids.len() as i32;
    }
    if op.id.is_none() {
        0
    } else {
        1
    }
}

/// Java `MediaManagementServiceImpl.resolveName`。
#[must_use]
pub fn resolve_media_name(op: &MediaOperationDTO) -> Option<String> {
    if let Some(n) = op.name.as_ref() {
        if !n.trim().is_empty() {
            return Some(n.trim().to_string());
        }
    }
    if !op.items.is_empty() {
        return op.items[0].name.clone();
    }
    None
}

/// Java `MediaManagementServiceImpl.resolveType`：
/// 显式 `type` 优先；否则按首项的 MIME 前缀推断。
#[must_use]
pub fn resolve_media_type(op: &MediaOperationDTO) -> Option<String> {
    if let Some(t) = op.r#type.as_ref() {
        if !t.trim().is_empty() {
            return Some(t.trim().to_lowercase());
        }
    }
    if !op.items.is_empty() {
        if let Some(mime) = op.items[0].mime_type.as_deref() {
            let m = mime.to_lowercase();
            if m.starts_with("video/") {
                return Some("video".to_string());
            }
            if m.starts_with("image/") {
                return Some("image".to_string());
            }
        }
    }
    None
}

/// Java `MediaManagementServiceImpl.resolveGroupType`。
#[must_use]
pub fn resolve_group_type(op: &MediaOperationDTO) -> String {
    op.r#type
        .as_ref()
        .map_or_else(|| "image".to_string(), |t| t.trim().to_lowercase())
}

/// Java `MediaManagementServiceImpl.isSupportedType`：
/// `null`/空白 ⇒ `true`；否则必须为 image / video。
#[must_use]
pub fn is_supported_media_type(ty: Option<&str>) -> bool {
    match ty {
        None => true,
        Some(t) if t.trim().is_empty() => true,
        Some(t) => {
            let n = t.trim().to_lowercase();
            n == "image" || n == "video"
        }
    }
}

/// Java `MediaManagementServiceImpl.tenantIsPlatform`。
#[must_use]
pub fn tenant_is_platform(shop_id: Option<i32>, vendor_id: Option<i32>) -> bool {
    shop_id.unwrap_or(0) == 0 && vendor_id.unwrap_or(0) == 0
}

/// Java `MediaManagementServiceImpl` 的 `fingerprint(op)`：
/// 拼接 `operation \0 id \0 ids \0 name \0 normalized(type) \0 groupId \0 \0`
/// 后接每个 item 的
/// `id|clientFileId|name|mimeType|contentDigest|groupId|role\x01`。
///
/// ⚠️ Java 对 `items` 的元素做了 `null` 容错（`"null"` / `""`），
/// Rust 的 `Vec` 无 `null` 元素，故此处不会出现该分支。
/// `contentDigest` 是 `contentBase64` 的 SHA-256 十六进制；
/// Rust 侧此处用**原文长度 + 内容**的轻量摘要替代真实 SHA-256
/// （避免为单一用途引入 `sha2`，见 `uncertain_points`）。
#[must_use]
pub fn media_fingerprint_canonical(op: &MediaOperationDTO) -> String {
    let mut canonical = String::new();
    canonical.push_str(&normalize_operation(op.operation.as_deref()));
    canonical.push('\u{0}');
    canonical.push_str(&op.id.map_or_else(String::new, |v| v.to_string()));
    canonical.push('\u{0}');
    canonical.push_str(
        &op.ids
            .as_ref()
            .map_or_else(String::new, |v| format!("{v:?}")),
    );
    canonical.push('\u{0}');
    canonical.push_str(op.name.as_deref().unwrap_or(""));
    canonical.push('\u{0}');
    canonical.push_str(&normalize_operation(op.r#type.as_deref()));
    canonical.push('\u{0}');
    canonical.push_str(&op.group_id.map_or_else(String::new, |v| v.to_string()));
    canonical.push('\u{0}');
    canonical.push('\u{0}');
    for item in &op.items {
        canonical.push_str(&item.id.map_or_else(String::new, |v| v.to_string()));
        canonical.push('|');
        canonical.push_str(item.client_file_id.as_deref().unwrap_or(""));
        canonical.push('|');
        canonical.push_str(item.name.as_deref().unwrap_or(""));
        canonical.push('|');
        canonical.push_str(item.mime_type.as_deref().unwrap_or(""));
        canonical.push('|');
        canonical.push_str(&content_digest(item.content_base64.as_deref()));
        canonical.push('|');
        canonical.push_str(&item.group_id.map_or_else(String::new, |v| v.to_string()));
        canonical.push('|');
        canonical.push_str(item.role.as_deref().unwrap_or(""));
        canonical.push('\u{1}');
    }
    canonical
}

/// Java `MediaManagementServiceImpl.contentDigest`：
/// `content == null` ⇒ `""`，否则内容字节的 SHA-256 十六进制。
///
/// ⚠️ Rust 侧未引入 SHA-256（`sha2` 不在本 crate 依赖里），
/// 此处用 `len:content` 形式的确定性摘要替代，仅用于**同进程内**的
/// 指纹一致性比较；见 `uncertain_points`。
#[must_use]
pub fn content_digest(content: Option<&str>) -> String {
    match content {
        None => String::new(),
        Some(c) => format!("{}:{}", c.len(), c),
    }
}

/// Java `ProductManageServiceImpl.batchConsequences`。
#[must_use]
pub fn batch_consequences(op: &str) -> Vec<String> {
    match op {
        "up" => vec!["这些商品会立即在前台显示并可下单".to_string()],
        "down" => vec!["这些商品会从前台隐藏，已下单订单不受影响".to_string()],
        "recycle" => vec!["这些商品会移入回收站，之后仍可还原".to_string()],
        "restore" => vec!["这些商品会回到商品列表，但保持下架状态".to_string()],
        "del" => vec!["这些商品将被彻底删除，数据不可恢复".to_string()],
        _ => Vec::new(),
    }
}

/// Java `ProductManageServiceImpl.operationLabel`。
#[must_use]
pub fn batch_operation_label(op: &str) -> String {
    match op {
        "up" => "批量上架".to_string(),
        "down" => "批量下架".to_string(),
        "recycle" => "批量移入回收站".to_string(),
        "restore" => "批量还原".to_string(),
        "del" => "批量彻底删除".to_string(),
        other => other.to_string(),
    }
}

/// Java `ProductManageServiceImpl.normalizeOperation`。
pub fn normalize_batch_operation(
    operation: Option<&str>,
) -> Result<String, (&'static str, &'static str)> {
    let raw = operation.ok_or((CODE_INVALID_OPERATION, "缺少批量操作类型"))?;
    let op = raw.trim().to_lowercase();
    if ["up", "down", "recycle", "restore", "del"].contains(&op.as_str()) {
        Ok(op)
    } else {
        Err((
            CODE_INVALID_OPERATION,
            "仅支持 up、down、recycle、restore、del",
        ))
    }
}

/// Java `ProductManageServiceImpl.normalizeIds`：
/// 空 ⇒ `EMPTY_PRODUCT_IDS`；否则去除 `null` 并去重（**保持原序**）。
///
/// ⚠️ Java 的 `ids.isEmpty()` 判的是**入参**是否为空；若入参非空但
/// 全为 `null`，Java 返回一个**空列表**且不报错。本实现逐条复刻。
pub fn normalize_batch_ids(
    ids: Option<&[Option<i32>]>,
) -> Result<Vec<i32>, (&'static str, &'static str)> {
    let ids = ids.ok_or((CODE_EMPTY_PRODUCT_IDS, "至少选择一个商品"))?;
    if ids.is_empty() {
        return Err((CODE_EMPTY_PRODUCT_IDS, "至少选择一个商品"));
    }
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for id in ids.iter().flatten() {
        if seen.insert(*id) {
            out.push(*id);
        }
    }
    Ok(out)
}

/// Java `ProductManageServiceImpl.fingerprint`：
/// `op + ":" + 升序 ids 的逗号连接`。
#[must_use]
pub fn batch_fingerprint(op: &str, ids: &[i32]) -> String {
    let mut sorted = ids.to_vec();
    sorted.sort_unstable();
    format!(
        "{op}:{}",
        sorted
            .iter()
            .map(i32::to_string)
            .collect::<Vec<_>>()
            .join(",")
    )
}

/// Java `ProductManageServiceImpl.batchBlockReason`。
///
/// 返回 `None` 表示可执行。
#[must_use]
pub fn batch_block_reason(op: &str, check_status: i32, is_delete: bool) -> Option<&'static str> {
    if op == "up" && check_status != CHECK_STATUS_APPROVED {
        return Some("审核未通过或尚未审核，审核通过后才能上架");
    }
    if op == "del" && !is_delete {
        return Some("需先移入回收站再删除");
    }
    if op == "restore" && !is_delete {
        return Some("商品不在回收站，无需还原");
    }
    if op == "recycle" && is_delete {
        return Some("商品已经在回收站");
    }
    None
}

/// Java `ProductManageServiceImpl.statusLabel`：
/// `1` ⇒ 出售中，其余 ⇒ 已下架；`None` ⇒ `None`。
#[must_use]
pub fn status_label(code: Option<i32>) -> Option<String> {
    code.map(|c| if c == 1 { "出售中" } else { "已下架" }.to_string())
}

/// Java `com.tigshop.bean.enums.product.CheckStatus` 的中文名。
///
/// ⚠️ 码值与文案：`APPROVED = 0`、`REJECTED = 2` 已由
/// `ProductImportServiceImpl` 里 `CheckStatus.APPROVED.getCode()` /
/// `REJECTED.getCode()` 的用法确认；**`PENDING = 1` 与各枚举的
/// `description` 文案本片未逐字读到**，见 `uncertain_points`。
#[must_use]
pub fn audit_label(code: Option<i32>) -> Option<String> {
    match code {
        None => None,
        Some(0) => Some("审核通过".to_string()),
        Some(1) => Some("待审核".to_string()),
        Some(2) => Some("审核未通过".to_string()),
        Some(_) => None,
    }
}

/// Java `com.tigshop.bean.enums.product.ProductType.fromCode(...).getDescription()`。
///
/// ⚠️ 文案本片未逐字读到（见 `uncertain_points`）；码值取自
/// `ProductSearchDTO.productType` 的 `@Schema` 注释：
/// 「1实物 2虚拟 3卡密 4付费内容 5预约上门 6预约到店 7实体礼品卡 8电子礼品卡」。
#[must_use]
pub fn product_type_label(code: Option<i32>) -> Option<String> {
    match code {
        None => None,
        Some(1) => Some("实物商品".to_string()),
        Some(2) => Some("虚拟商品".to_string()),
        Some(3) => Some("卡密商品".to_string()),
        Some(4) => Some("付费内容".to_string()),
        Some(5) => Some("预约上门".to_string()),
        Some(6) => Some("预约到店".to_string()),
        Some(7) => Some("实体礼品卡".to_string()),
        Some(8) => Some("电子礼品卡".to_string()),
        Some(_) => None,
    }
}

/// Java `ProductManageServiceImpl.EDITABLE_FIELDS` 的键（`LinkedHashMap` 插入序）。
pub const EDITABLE_FIELDS: [&str; 6] = [
    "productName",
    "productSn",
    "productPrice",
    "productStock",
    "productSku",
    "sortOrder",
];

/// Java `EDITABLE_FIELDS` 的键 ⇒ 中文名。
///
/// ⚠️ 不能标 `const fn`：`match` 一个 `&str` 在常量上下文里
/// 需要 `const_str_match`（未稳定），会报 E0658。
#[must_use]
pub fn editable_field_label(field: &str) -> Option<&'static str> {
    match field {
        "productName" => Some("商品名称"),
        "productSn" => Some("商品货号"),
        "productPrice" => Some("价格"),
        "productStock" => Some("库存"),
        "productSku" => Some("多规格库存"),
        "sortOrder" => Some("排序值"),
        _ => None,
    }
}

/// Java `String.join("、", EDITABLE_FIELDS.values())`。
#[must_use]
pub fn editable_fields_text() -> String {
    EDITABLE_FIELDS
        .iter()
        .filter_map(|f| editable_field_label(f))
        .collect::<Vec<_>>()
        .join("、")
}

/// Java `ProductManageServiceImpl.updateField` 的字段白名单校验。
///
/// 返回 `Err(完整文案)`。
pub fn require_editable_field(field: &str) -> Result<&'static str, String> {
    editable_field_label(field).ok_or_else(|| {
        format!(
            "这里只能改：{}。上下架、移入回收站、还原和删除各有专门的操作。",
            editable_fields_text()
        )
    })
}

/// Java `ProductManageServiceImpl.isB2c()`：
/// `tigshopProperties == null || getIsO2o() == 0`。
#[must_use]
pub fn is_b2c(is_o2o: Option<i32>) -> bool {
    is_o2o.unwrap_or(0) == 0
}

/// Java `ProductManageServiceImpl.updateConsequences`。
#[must_use]
pub fn update_consequences(field: &str, stock_after: Option<i32>) -> Vec<String> {
    match field {
        "productPrice" => {
            vec!["前台已经按新价格显示，购物车里的商品下单时也按新价格算".to_string()]
        }
        "productStock" => {
            if stock_after == Some(0) {
                vec!["库存为 0，前台会显示售罄，买家无法下单".to_string()]
            } else {
                vec!["前台可售数量已经更新".to_string()]
            }
        }
        "productName" | "productSn" => vec!["前台展示已同步更新".to_string()],
        _ => Vec::new(),
    }
}

/// Java `ProductImportServiceImpl.buildSuggestion`。
#[must_use]
pub fn build_import_suggestion(
    product_status: Option<i32>,
    product_stock: Option<i32>,
    filled_combinations: &[String],
) -> String {
    let on_sale = product_status == Some(PRODUCT_STATUS_ON_SALE);
    let out_of_stock = product_stock.is_none_or(|s| s <= 0);
    let base = if on_sale && out_of_stock {
        "已上架，但库存为 0，前台显示售罄；请在后台补库存"
    } else if on_sale {
        "已上架，前台可正常购买"
    } else if out_of_stock {
        "当前为下架状态且库存为 0，补库存后可在后台手动上架"
    } else {
        "当前为下架状态，可在后台商品列表核对后手动上架"
    };
    if filled_combinations.is_empty() {
        return base.to_string();
    }
    format!(
        "{base}。已自动补齐缺失的规格组合 {}（库存为 0），如不需要请在后台删除",
        filled_combinations.join("、")
    )
}

/// Java `ProductManageServiceImpl.requireProductId`：
/// `null` 或 `<= 0` ⇒ `INVALID_PRODUCT_ID`。
pub fn require_product_id(product_id: Option<i32>) -> Result<i32, (&'static str, &'static str)> {
    match product_id {
        Some(id) if id > 0 => Ok(id),
        _ => Err((CODE_INVALID_PRODUCT_ID, "缺少商品ID")),
    }
}

/// Java `ProductManageServiceImpl.normalizeSize`：
/// `null` / `< 1` ⇒ 20；否则与 100 取小。
#[must_use]
pub fn normalize_page_size(size: Option<i32>) -> i32 {
    match size {
        Some(s) if s >= 1 => s.min(MAX_PAGE_SIZE),
        _ => DEFAULT_PAGE_SIZE,
    }
}

/// Java `ProductManageServiceImpl.toListQuery` 的页码归一：`< 1` ⇒ 1。
#[must_use]
pub fn normalize_page(page: Option<i32>) -> i32 {
    match page {
        Some(p) if p >= 1 => p,
        _ => 1,
    }
}

/// Java `ProductManageServiceImpl` 的 `sortedBy` 文案。
#[must_use]
pub fn sorted_by_text(field: ProductSortField, ascending: bool) -> String {
    format!(
        "按{}{}",
        field.label(),
        if ascending {
            "从低到高"
        } else {
            "从高到低"
        }
    )
}

/// Java `ProductManageServiceImpl.assertOwnedBy`：
/// 店铺身份（`shopId > 0`）只能操作自己的商品。
#[must_use]
pub fn is_owned_by(product_shop_id: Option<i32>, shop_id: Option<i32>) -> bool {
    match shop_id {
        Some(s) if s > 0 => product_shop_id == Some(s),
        _ => true,
    }
}

/// Java `ProductManageServiceImpl.notFound`。
#[must_use]
pub fn product_not_found_message(product_id: i32) -> String {
    format!("找不到商品（ID {product_id}），可能已被彻底删除或不属于当前店铺")
}

/// Java `ProductManageServiceImpl` 的 `productSku` 库存摘要：
/// `规格名：库存`，逗号分隔；无规格数据时返回「无规格数据」。
#[must_use]
pub fn sku_stocks_text(skus: &[ProductDetailSku]) -> String {
    if skus.is_empty() {
        return "无规格数据".to_string();
    }
    skus.iter()
        .map(|s| {
            let name = match s.specs.as_deref() {
                Some(v) if !v.trim().is_empty() => v.to_string(),
                _ => match s.sku_id {
                    Some(id) => format!("规格{id}"),
                    None => "规格".to_string(),
                },
            };
            format!("{name}：{}", s.stock.unwrap_or(0))
        })
        .collect::<Vec<_>>()
        .join("，")
}

// ——————————————————————————————————————————————
// 分类导入（CategoryImportServiceImpl）
// ——————————————————————————————————————————————

/// 对应 Java `CategoryImportDTO.Node`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CategoryImportNode {
    pub id: Option<i32>,
    pub name: Option<String>,
    pub children: Vec<CategoryImportNode>,
}

/// 对应 Java `com.tigshop.bean.dto.workbuddy.CategoryImportDTO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CategoryImportDTO {
    pub operation: Option<String>,
    pub nodes: Vec<CategoryImportNode>,
    pub preview_id: Option<String>,
    pub request_id: Option<String>,
    pub confirmation: Option<bool>,
}

/// 对应 Java `CategoryImportPreviewVO.NodeResult`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CategoryImportNodeResult {
    pub path: Option<String>,
    pub name: Option<String>,
    pub id: Option<i32>,
    pub has_children: bool,
    pub leaf: bool,
    /// `existing` / `missing` / `missing_parent` / `conflict`。
    pub state: Option<String>,
    pub reason: Option<String>,
}

/// 对应 Java `com.tigshop.bean.vo.workbuddy.CategoryImportPreviewVO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CategoryImportPreviewVO {
    pub preview_id: Option<String>,
    /// `PREPARED` / `REJECTED`。
    pub status: Option<String>,
    pub summary: Option<String>,
    pub nodes: Vec<CategoryImportNodeResult>,
    pub total: i32,
    pub existing_count: i32,
    pub missing_parent_count: i32,
    pub conflict_count: i32,
}

/// 分类节点的归一化状态（Java `state` 字段取值）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CategoryNodeState {
    /// 已存在（或显式 ID 命中）。
    Existing,
    /// 待创建。
    Missing,
    /// 父级未解析。
    MissingParent,
    /// 冲突（空名/超长/重名/循环）。
    Conflict,
}

impl CategoryNodeState {
    /// Java 里 `state` 的实际字符串。
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Existing => "existing",
            Self::Missing => "missing",
            Self::MissingParent => "missing_parent",
            Self::Conflict => "conflict",
        }
    }
}

/// 展平后的分类节点（Java `FlatNode`）。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct FlatCategoryNode {
    pub path: String,
    pub parent_path: String,
    pub name: String,
    pub explicit_id: Option<i32>,
}

/// Java `CategoryImportServiceImpl` 的输入树校验（**纯结构部分**）：
/// 逐层展平，标记空名 / 超长 / 重复路径。
///
/// 显式 ID 命中与同名查库判定需要 DB，由服务层补齐。
///
/// 返回 `(展平节点, 逐个 NodeResult)`。
#[must_use]
pub fn flatten_category_nodes(
    nodes: &[CategoryImportNode],
) -> (Vec<FlatCategoryNode>, Vec<CategoryImportNodeResult>) {
    let mut flat = Vec::new();
    let mut output = Vec::new();
    let mut paths: HashSet<String> = HashSet::new();
    flatten_inner(nodes, "", &mut flat, &mut output, &mut paths, 0);
    (flat, output)
}

fn flatten_inner(
    nodes: &[CategoryImportNode],
    parent_path: &str,
    flat: &mut Vec<FlatCategoryNode>,
    output: &mut Vec<CategoryImportNodeResult>,
    paths: &mut HashSet<String>,
    depth: usize,
) {
    // Java 用 `IdentityHashMap` 检测循环；serde 的树天然无环，
    // 但深递归可能栈溢出，这里加一道与 MAX_CATEGORY_DEPTH 同源的硬上限。
    if depth > MAX_CATEGORY_DEPTH {
        return;
    }
    for raw in nodes {
        let name = raw.name.as_deref().map(str::trim).unwrap_or("").to_string();
        let path = if parent_path.is_empty() {
            name.clone()
        } else {
            format!("{parent_path}/{name}")
        };
        let mut result = CategoryImportNodeResult {
            path: Some(path.clone()),
            name: if name.is_empty() {
                None
            } else {
                Some(name.clone())
            },
            id: raw.id,
            has_children: !raw.children.is_empty(),
            leaf: raw.children.is_empty(),
            ..CategoryImportNodeResult::default()
        };

        if name.is_empty() {
            result.state = Some(CategoryNodeState::Conflict.as_str().to_string());
            result.reason = Some("分类名称不能为空".to_string());
            output.push(result);
            continue;
        }
        if name.chars().count() > CATEGORY_NAME_MAX_LEN {
            result.state = Some(CategoryNodeState::Conflict.as_str().to_string());
            result.reason = Some("分类名称不能超过 30 个字符".to_string());
            output.push(result);
            continue;
        }
        if !paths.insert(path.clone()) {
            result.state = Some(CategoryNodeState::Conflict.as_str().to_string());
            result.reason = Some("输入中存在重复分类路径".to_string());
            output.push(result);
            continue;
        }

        output.push(result);
        flat.push(FlatCategoryNode {
            path: path.clone(),
            parent_path: parent_path.to_string(),
            name,
            explicit_id: raw.id,
        });
        flatten_inner(&raw.children, &path, flat, output, paths, depth + 1);
    }
}

/// Java `CategoryImportServiceImpl.summary`。
#[must_use]
pub fn category_preview_summary(preview: &CategoryImportPreviewVO) -> String {
    let pending = preview.total - preview.existing_count - preview.conflict_count;
    format!(
        "分类预览完成：共 {} 个节点，已有 {} 个，待创建 {} 个，缺失父级 {} 个",
        preview.total,
        preview.existing_count,
        pending.max(0),
        preview.missing_parent_count
    )
}

/// Java `CategoryImportServiceImpl.item` 的 Map 构造（键序与 Java 一致）。
#[must_use]
pub fn category_item_map(
    path: &str,
    success: bool,
    id: Option<i32>,
    code: Option<&str>,
    message: Option<&str>,
    retryable: bool,
) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    map.insert(
        "path".to_string(),
        serde_json::Value::String(path.to_string()),
    );
    map.insert("success".to_string(), serde_json::Value::Bool(success));
    if let Some(id) = id {
        map.insert("categoryId".to_string(), serde_json::Value::from(id));
    }
    if let Some(code) = code {
        map.insert(
            "errorCode".to_string(),
            serde_json::Value::String(code.to_string()),
        );
        map.insert("retryable".to_string(), serde_json::Value::Bool(retryable));
    }
    if let Some(message) = message {
        map.insert(
            "error".to_string(),
            serde_json::Value::String(message.to_string()),
        );
    }
    serde_json::Value::Object(map)
}

/// Java `CategoryImportServiceImpl.error(code, message)`。
#[must_use]
pub fn category_error(code: &str, message: &str) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    map.insert(
        "status".to_string(),
        serde_json::Value::String("failed".to_string()),
    );
    map.insert(
        "errorCode".to_string(),
        serde_json::Value::String(code.to_string()),
    );
    map.insert(
        "message".to_string(),
        serde_json::Value::String(message.to_string()),
    );
    serde_json::Value::Object(map)
}

/// Java `CategoryImportServiceImpl.safeMessage`：空则兜底，
/// 否则截断到 200 字符。
#[must_use]
pub fn safe_message(message: Option<&str>) -> String {
    match message {
        Some(m) if !m.trim().is_empty() => m.chars().take(200).collect(),
        _ => "分类创建失败".to_string(),
    }
}

/// Java `CategoryImportServiceImpl.normalizeParent`：`null` ⇒ 0。
#[must_use]
pub fn normalize_parent_id(parent_id: Option<i32>) -> i32 {
    parent_id.unwrap_or(0)
}

// ——————————————————————————————————————————————
// MCP capabilities（McpCapabilitiesVO，静态部分）
// ——————————————————————————————————————————————

/// Java `McpCapabilitiesVO.Assistant` 的类默认值。
///
/// ⚠️ Java 在 `capabilities()` 里用
/// `v.setAssistant(WorkBuddyAssistantGuide.capabilities())` **整体覆盖**
/// `assistant`；`rules` 的真实内容在该类里（本片未读到），
/// 见 `uncertain_points`。
#[must_use]
pub fn assistant_defaults() -> serde_json::Value {
    serde_json::json!({
        "mode": "natural_language",
        "requiresTemplate": false,
        "rulesVersion": "1.0",
        "rules": [],
        "requiresVisionModelForImages": true,
        "visionModelGuidance": "图片参与商品创建时，请使用支持图片识别的模型；不支持视觉时请先补充文字信息，不能臆测图片字段。",
        "imageWorkflow": "vision_required"
    })
}

/// Java `McpCapabilitiesVO` 的静态骨架
/// （`version` / `supportedIntents` / `product` / `unsupported`）。
#[must_use]
pub fn capabilities_skeleton() -> serde_json::Value {
    serde_json::json!({
        "version": "1.1",
        "supportedIntents": [
            "create_product",
            "query_product",
            "update_product",
            "manage_media",
            "import_category",
            "analyze_product"
        ],
        "product": {
            "createRequired": [
                "productName",
                "productSn",
                "productPrice",
                "categoryId|categoryName",
                "images"
            ],
            "confirmationFlow": ["prepare.validate", "user_confirmation", "execute.create"],
            "maxBatchProducts": 50
        },
        "unsupported": ["external_market_data"]
    })
}

/// Java `McpCapabilitiesVO.Media` 的默认值（`maxFileBytes` 等由服务层按配置覆盖）。
#[must_use]
pub fn capabilities_media_defaults() -> serde_json::Value {
    serde_json::json!({
        "supportsFileToken": true,
        "preferredUploadMode": "fileToken",
        "uploadProtocol": "multipart/form-data",
        "stageEndpoint": "/adminapi/openapi/mcp/v1/media/upload-token",
        "tokenTtlSeconds": 1800,
        "base64Fallback": false,
        "strictUploadMode": true,
        "requiredClientCapability": "multipart_attachment_bridge",
        "workflowVersion": "2026-09-04-upload-token-v2",
        "supportsMarkdownPreview": true,
        "externalUrlMayBeBlockedByCsp": true,
        "previewFallback": "client_local_gallery",
        "types": ["image", "video"],
        "imageExtensions": ["jpeg", "png", "gif", "webp", "tiff"],
        "videoExtensions": ["mp4"],
        "maxFileBytes": 52428800,
        "imageMaxFileBytes": 52428800,
        "videoMaxFileBytes": 52428800,
        "maxBatchBytes": 41943040,
        "maxFilesPerCall": 20,
        "defaultGroupId": 0
    })
}

// ——————————————————————————————————————————————
// 商品分析纯函数（ProductAnalysisServiceImpl）
// ——————————————————————————————————————————————

/// Java `ProductAnalysisServiceImpl.priceBand`。
#[must_use]
pub fn price_band(price: Option<Decimal>) -> &'static str {
    let Some(p) = price else {
        return "未知";
    };
    if p < Decimal::from(50) {
        "0-50"
    } else if p < Decimal::from(200) {
        "50-200"
    } else if p < Decimal::from(500) {
        "200-500"
    } else {
        "500以上"
    }
}

/// Java `ProductAnalysisServiceImpl.ratio`：
/// 分母 `<= 0` ⇒ `0.00`（去尾零后为 `0`）；否则 HALF_UP 保留 2 位后去尾零。
#[must_use]
pub fn analysis_ratio(numerator: i32, denominator: i32) -> Decimal {
    if denominator <= 0 {
        return dec("0.00");
    }
    Decimal::from(numerator)
        .checked_div(Decimal::from(denominator))
        .map_or(Decimal::ZERO, |v| round2(v).normalize())
}

/// Java `ProductAnalysisServiceImpl.normalizeNumber`：去尾零。
///
/// Java `BigDecimal.stripTrailingZeros()` 可产生负 scale（如 100 → 1E+2），
/// 需再取整；rust_decimal 的 `scale()` 是 `u32` 且 `normalize()` 不会产生
/// 负 scale，故无需该分支。
#[must_use]
pub fn normalize_number(value: Decimal) -> Decimal {
    value.normalize()
}

/// Java `ProductAnalysisServiceImpl.confidence`：
/// 空 ⇒ 0；`< 5` 条 ⇒ 0.5；否则 0.9。
#[must_use]
pub fn analysis_confidence(sample_size: usize) -> f64 {
    if sample_size == 0 {
        0.0
    } else if sample_size < 5 {
        0.5
    } else {
        0.9
    }
}

/// Java `ProductAnalysisServiceImpl.categoryOf`：空/空白 ⇒ `"未分类"`。
#[must_use]
pub fn category_of(name: Option<&str>) -> String {
    match name {
        Some(n) if !n.trim().is_empty() => n.to_string(),
        _ => "未分类".to_string(),
    }
}

/// Java `ProductAnalysisServiceImpl.inventoryRisk` 的 `(score, reasons)`。
#[must_use]
pub fn inventory_risk(stock: i32, sales: i32) -> (i32, Vec<&'static str>) {
    let stock_to_sales = Decimal::from(stock)
        .checked_div(Decimal::from(sales.max(1)))
        .map_or(Decimal::ZERO, round2);
    let mut reasons = Vec::new();
    let mut score = 0;
    if stock <= 10 {
        score += 2;
        reasons.push("低库存");
    }
    if sales <= 0 {
        score += 1;
        reasons.push("无销量");
    } else if stock_to_sales >= Decimal::from(30) {
        score += 1;
        reasons.push("周转缓慢");
    }
    (score, reasons)
}

/// Java `inventoryRisk` 的 `stockToSalesRatio`（HALF_UP 2 位后去尾零）。
#[must_use]
pub fn stock_to_sales_ratio(stock: i32, sales: i32) -> Decimal {
    Decimal::from(stock)
        .checked_div(Decimal::from(sales.max(1)))
        .map_or(Decimal::ZERO, |v| round2(v).normalize())
}

/// Java `inventoryRisk` 的 `riskLevel`。
#[must_use]
pub const fn risk_level(score: i32) -> &'static str {
    if score >= 2 {
        "HIGH"
    } else if score == 1 {
        "MEDIUM"
    } else {
        "LOW"
    }
}

/// Java `ProductAnalysisServiceImpl` 的 `suggestion`/`reason` 文案
/// （补货建议）。
pub const MSG_RECOMMEND_REPLENISH: &str = "优先补货，避免热销商品断货";
/// Java 清仓建议文案。
pub const MSG_RECOMMEND_CLEARANCE: &str = "考虑促销或降低备货，释放积压库存";
/// Java 定价建议文案。
pub const MSG_RECOMMEND_PRICING: &str = "以样本均价作为新商品定价参考";
/// Java 定价建议的 reason。
pub const MSG_RECOMMEND_PRICING_REASON: &str = "当前样本价格分布的中心值可作为初始定价锚点";
/// Java 品类建议文案。
pub const MSG_RECOMMEND_CATEGORY: &str = "优先关注该品类并扩充相近商品";
/// Java 品类建议的 reason。
pub const MSG_RECOMMEND_CATEGORY_REASON: &str = "该品类在当前样本中贡献最高销量";

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> Decimal {
        dec(s)
    }

    // ————————————————————— tigshopConfig 拼接 —————————————————————

    /// Java 各段之间**没有分隔符**，逐字符复刻。
    #[test]
    fn tigshop_config_text_matches_java_concat() {
        let text = tigshop_config_text(Some(1), Some(1), Some(1), Some(0), Some(0), Some(0));
        assert_eq!(
            text,
            "isMerchant: 1isB2b: 1isPro: 1isOverseas: 0isVendor: 0isO2o: 0"
        );
        // Java `String` 拼接 null 会输出字面量 "null"
        assert_eq!(
            tigshop_config_text(None, None, None, None, None, None),
            "isMerchant: nullisB2b: nullisPro: nullisOverseas: nullisVendor: nullisO2o: null"
        );
    }

    // ————————————————————— 密钥鉴权 —————————————————————

    /// Java `status()` 的四段判定顺序：缺失 → 不匹配 → 到期配置非法 → 过期。
    #[test]
    fn evaluate_key_status_order() {
        let now = 1_700_000_000i64;

        // 1) key 或 expected 空白
        assert_eq!(
            evaluate_key_status(None, Some("k"), Some("1800000000"), now)
                .message
                .as_deref(),
            Some(MSG_KEY_MISSING)
        );
        assert_eq!(
            evaluate_key_status(Some("k"), None, Some("1800000000"), now)
                .message
                .as_deref(),
            Some(MSG_KEY_MISSING)
        );
        assert_eq!(
            evaluate_key_status(Some("  "), Some("k"), Some("1800000000"), now)
                .message
                .as_deref(),
            Some(MSG_KEY_MISSING)
        );
        assert_eq!(
            evaluate_key_status(Some("k"), Some("   "), Some("1800000000"), now)
                .message
                .as_deref(),
            Some(MSG_KEY_MISSING)
        );

        // 2) 不匹配
        let s = evaluate_key_status(Some("wrong"), Some("k"), Some("1800000000"), now);
        assert!(!s.valid);
        assert_eq!(s.message.as_deref(), Some(MSG_KEY_INVALID));

        // 3) 到期时间无法解析
        let s = evaluate_key_status(Some("k"), Some("k"), Some("abc"), now);
        assert_eq!(s.message.as_deref(), Some(MSG_KEY_EXPIRES_INVALID));
        // 到期配置缺失同样落到该分支（Java `Long.parseLong(null)` 抛异常）
        let s = evaluate_key_status(Some("k"), Some("k"), None, now);
        assert_eq!(s.message.as_deref(), Some(MSG_KEY_EXPIRES_INVALID));

        // 4) 已过期（<= now）
        let s = evaluate_key_status(Some("k"), Some("k"), Some("1700000000"), now);
        assert_eq!(s.message.as_deref(), Some(MSG_KEY_EXPIRED));
        let s = evaluate_key_status(Some("k"), Some("k"), Some("1699999999"), now);
        assert_eq!(s.message.as_deref(), Some(MSG_KEY_EXPIRED));

        // 5) 有效：比 now 大 1 秒即通过
        let s = evaluate_key_status(Some("k"), Some("k"), Some("1700000001"), now);
        assert!(s.valid);
        assert_eq!(s.shop_id, Some(0));
        assert_eq!(s.expires_at, Some(1_700_000_001));
        assert_eq!(s.message.as_deref(), Some(MSG_KEY_OK));
        assert_eq!(s.key_id, Some(0));
        assert_eq!(s.key_name.as_deref(), Some(KEY_NAME_DEFAULT));
    }

    /// 密钥比较必须区分大小写与前后空白（Java `MessageDigest.isEqual`）。
    #[test]
    fn key_comparison_is_exact() {
        assert!(constant_time_eq("abc", "abc"));
        assert!(!constant_time_eq("abc", "abd"));
        assert!(!constant_time_eq("abc", "ABC"));
        assert!(!constant_time_eq("abc", "abcd"));
        assert!(!constant_time_eq("", "a"));
        assert!(constant_time_eq("", ""));

        let now = 1i64;
        // 前后空白不算匹配（Java 未 trim 请求头的 key）
        let s = evaluate_key_status(Some(" k "), Some("k"), Some("100"), now);
        assert_eq!(s.message.as_deref(), Some(MSG_KEY_INVALID));
    }

    /// Java `auth()`：`status == null || !valid || shopId == null` ⇒ 401。
    #[test]
    fn key_authorization_requires_valid_and_shop_id() {
        assert!(!key_authorized(None));
        let mut s = WorkBuddyKeyStatusVO::invalid(MSG_KEY_INVALID);
        assert!(!key_authorized(Some(&s)));
        s.valid = true;
        // valid 但 shopId 仍为 None ⇒ 仍拒绝
        assert!(!key_authorized(Some(&s)));
        s.shop_id = Some(0);
        assert!(key_authorized(Some(&s)));
    }

    /// Java `requireValid` 在单密钥模式下**不**按 scope 拦截。
    #[test]
    fn require_valid_key_ignores_scope() {
        let ok = WorkBuddyKeyStatusVO::connected(1_800_000_000);
        assert!(require_valid_key(Some(&ok)).is_ok());
        // 同一个有效密钥对任意 scope 都放行（Java 的 requiredScope 仅保留签名）
        assert!(require_valid_key(Some(&ok)).is_ok());
        assert!(require_valid_key(None).is_err());
        assert_eq!(require_valid_key(None).unwrap_err(), MSG_KEY_INVALID);
    }

    /// Java 401 文案兜底：message 为空时用「MCP密钥无效」。
    #[test]
    fn key_unauthorized_message_fallback() {
        assert_eq!(key_unauthorized_message(None), MSG_KEY_INVALID);
        let s = WorkBuddyKeyStatusVO::default();
        assert_eq!(key_unauthorized_message(Some(&s)), MSG_KEY_INVALID);
        let s = WorkBuddyKeyStatusVO::invalid(MSG_KEY_EXPIRED);
        assert_eq!(key_unauthorized_message(Some(&s)), MSG_KEY_EXPIRED);
    }

    // ————————————————————— ProductScope —————————————————————

    /// 六个 scope 的三元组逐条对照 Java 枚举字面量。
    #[test]
    fn product_scope_triples_match_java() {
        assert_eq!(ProductScope::OnSale.label(), "出售中");
        assert_eq!(ProductScope::OnSale.product_status(), Some(1));
        assert_eq!(ProductScope::OnSale.check_status(), Some(1));
        assert_eq!(ProductScope::OnSale.is_delete(), Some(0));

        assert_eq!(ProductScope::OffSale.label(), "已下架");
        assert_eq!(ProductScope::OffSale.product_status(), Some(0));
        assert_eq!(ProductScope::OffSale.check_status(), Some(1));
        assert_eq!(ProductScope::OffSale.is_delete(), Some(0));

        assert_eq!(ProductScope::PendingAudit.label(), "待审核");
        assert_eq!(ProductScope::PendingAudit.product_status(), None);
        assert_eq!(ProductScope::PendingAudit.check_status(), Some(0));
        assert_eq!(ProductScope::PendingAudit.is_delete(), Some(0));

        assert_eq!(ProductScope::AuditFailed.label(), "审核未通过");
        assert_eq!(ProductScope::AuditFailed.product_status(), None);
        assert_eq!(ProductScope::AuditFailed.check_status(), Some(2));

        assert_eq!(ProductScope::Recycled.label(), "回收站");
        assert_eq!(ProductScope::Recycled.product_status(), None);
        assert_eq!(ProductScope::Recycled.check_status(), None);
        assert_eq!(ProductScope::Recycled.is_delete(), Some(1));

        assert_eq!(ProductScope::All.label(), "全部");
        assert_eq!(ProductScope::All.product_status(), None);
        assert_eq!(ProductScope::All.check_status(), None);
        assert_eq!(ProductScope::All.is_delete(), Some(0));
    }

    /// Java `parse`：空 ⇒ 默认 ON_SALE；大小写/中划线都接受；未知 ⇒ null。
    #[test]
    fn product_scope_parse() {
        assert_eq!(ProductScope::parse(None), Some(ProductScope::OnSale));
        assert_eq!(ProductScope::parse(Some("")), Some(ProductScope::OnSale));
        assert_eq!(ProductScope::parse(Some("  ")), Some(ProductScope::OnSale));
        assert_eq!(
            ProductScope::parse(Some("on_sale")),
            Some(ProductScope::OnSale)
        );
        assert_eq!(
            ProductScope::parse(Some("ON-SALE")),
            Some(ProductScope::OnSale)
        );
        assert_eq!(
            ProductScope::parse(Some(" recycleD ")),
            Some(ProductScope::Recycled)
        );
        assert_eq!(ProductScope::parse(Some("nope")), None);
    }

    /// Java `supportedValues()` 的拼接格式。
    #[test]
    fn product_scope_supported_values() {
        let v = ProductScope::supported_values();
        assert!(v.starts_with("on_sale（出售中）、off_sale（已下架）"));
        assert!(v.ends_with("all（全部）"));
        assert_eq!(v.matches('、').count(), 5);
    }

    // ————————————————————— ProductSortField —————————————————————

    /// Java `getProperty()` 与下划线列名的对照。
    #[test]
    fn sort_field_property_and_column() {
        assert_eq!(ProductSortField::Added.property(), "productId");
        assert_eq!(ProductSortField::Added.column(), "product_id");
        assert_eq!(ProductSortField::Price.property(), "productPrice");
        assert_eq!(ProductSortField::Price.column(), "product_price");
        assert_eq!(ProductSortField::Stock.property(), "productStock");
        assert_eq!(ProductSortField::Stock.column(), "product_stock");
        assert_eq!(ProductSortField::Sales.property(), "virtualSales");
        assert_eq!(ProductSortField::Sales.column(), "virtual_sales");
        assert_eq!(ProductSortField::SortOrder.property(), "sortOrder");
        assert_eq!(ProductSortField::SortOrder.column(), "sort_order");
    }

    /// Java `parse`：空与未知都返回 null —— 调用方必须先判空才能区分。
    #[test]
    fn sort_field_parse_ambiguous_null() {
        assert_eq!(ProductSortField::parse(None), None);
        assert_eq!(ProductSortField::parse(Some("")), None);
        assert_eq!(ProductSortField::parse(Some("nope")), None);
        assert_eq!(
            ProductSortField::parse(Some("PRICE")),
            Some(ProductSortField::Price)
        );
        assert_eq!(
            ProductSortField::parse(Some("sort-order")),
            Some(ProductSortField::SortOrder)
        );
    }

    /// `resolveSortField`：空放行，非法拒绝并给出可用清单。
    #[test]
    fn resolve_sort_field_gate() {
        assert_eq!(resolve_sort_field(None).unwrap(), None);
        assert_eq!(resolve_sort_field(Some("")).unwrap(), None);
        assert_eq!(
            resolve_sort_field(Some("price")).unwrap(),
            Some(ProductSortField::Price)
        );
        let err = resolve_sort_field(Some("bogus")).unwrap_err();
        assert!(err.starts_with("排序字段「bogus」不支持，可用的有："));
        assert!(err.contains("price（价格）"));
    }

    /// `sortedBy` 文案对照 Java。
    #[test]
    fn sorted_by_text_matches_java() {
        assert_eq!(
            sorted_by_text(ProductSortField::Stock, true),
            "按库存从低到高"
        );
        assert_eq!(
            sorted_by_text(ProductSortField::Stock, false),
            "按库存从高到低"
        );
    }

    // ————————————————————— 金额 / 市场价 —————————————————————

    /// Java `resolveMarketPrice`：> 0 原样；否则 售价 × 倍率 HALF_UP 2 位。
    #[test]
    fn resolve_market_price_rules() {
        let rate = market_price_rate(None);
        assert_eq!(rate, d("1.2"));

        // 给了正数市场价 ⇒ 原样返回（不乘倍率）
        assert_eq!(
            resolve_market_price(Some(d("129.00")), Some(d("99.00")), rate),
            Some(d("129.00"))
        );
        // 市场价为 0 ⇒ 视为未给，按售价推算
        assert_eq!(
            resolve_market_price(Some(d("0")), Some(d("99.00")), rate),
            Some(d("118.80"))
        );
        // 未给 ⇒ 按售价推算
        assert_eq!(
            resolve_market_price(None, Some(d("99.00")), rate),
            Some(d("118.80"))
        );
        // 售价也没有 ⇒ None
        assert_eq!(resolve_market_price(None, None, rate), None);
        // 0 售价 × 1.2 = 0
        assert_eq!(
            resolve_market_price(None, Some(d("0")), rate),
            Some(d("0.00"))
        );
        // 98.55 × 1.2 = 118.26（HALF_UP 2 位）
        assert_eq!(
            resolve_market_price(None, Some(d("98.55")), rate),
            Some(d("118.26"))
        );
        // 66.66 × 1.2 = 79.992 ⇒ 79.99
        assert_eq!(
            resolve_market_price(None, Some(d("66.66")), rate),
            Some(d("79.99"))
        );
    }

    /// 配置倍率可解析则用之。
    #[test]
    fn market_price_rate_from_config() {
        assert_eq!(market_price_rate(Some("1.5")), d("1.5"));
        assert_eq!(market_price_rate(Some(" 2 ")), d("2"));
        assert_eq!(market_price_rate(Some("abc")), d("1.2"));
        assert_eq!(market_price_rate(Some("   ")), d("1.2"));
        assert_eq!(market_price_rate(None), d("1.2"));
    }

    /// 商品名长度上限：配置可解析则用之，否则 200。
    #[test]
    fn max_product_name_length_rules() {
        assert_eq!(max_product_name_length(Some("300")), 300);
        assert_eq!(max_product_name_length(Some(" 128 ")), 128);
        assert_eq!(max_product_name_length(None), 200);
        assert_eq!(max_product_name_length(Some("abc")), 200);
        assert_eq!(max_product_name_length(Some("")), 200);
    }

    // ————————————————————— 图片校验 —————————————————————

    /// Java `hasInvalidImage`：只校验 http/https 前缀，空白项跳过。
    #[test]
    fn invalid_image_detection() {
        assert!(!has_invalid_image(&[]));
        assert!(!has_invalid_image(&["https://a/b.jpg".into()]));
        assert!(!has_invalid_image(&["  ".into()]));
        assert!(!has_invalid_image(&["http://a/b".into(), String::new()]));
        assert!(has_invalid_image(&["/local/a.jpg".into()]));
        assert!(has_invalid_image(&["data:image/png;base64,AAA".into()]));
        assert!(has_invalid_image(&["ftp://a/b".into()]));
        // 扩展名不是判据（AI 与 CDN 地址常无扩展名）
        assert!(!has_invalid_image(&["https://cdn.example.com/img".into()]));
    }

    /// Java `dedupe`：按序去空白去重。
    #[test]
    fn dedupe_urls_keeps_order() {
        let out = dedupe_urls(&[
            " a ".into(),
            "b".into(),
            "a".into(),
            String::new(),
            "  ".into(),
        ]);
        assert_eq!(out, vec!["a".to_string(), "b".to_string()]);
    }

    /// Java `mediaImageUrls`：只收 image 且 role ∈ {main_image, gallery_image, null}。
    #[test]
    fn media_image_url_filter() {
        let media = vec![
            ProductMediaDraftDTO {
                r#type: Some("image".into()),
                role: Some("main_image".into()),
                url: Some("u1".into()),
                ..ProductMediaDraftDTO::default()
            },
            ProductMediaDraftDTO {
                r#type: Some("image".into()),
                role: Some("gallery_image".into()),
                url: Some("u2".into()),
                ..ProductMediaDraftDTO::default()
            },
            ProductMediaDraftDTO {
                r#type: Some("image".into()),
                role: None,
                url: Some("u3".into()),
                ..ProductMediaDraftDTO::default()
            },
            // detail_image 不算商品图
            ProductMediaDraftDTO {
                r#type: Some("image".into()),
                role: Some("detail_image".into()),
                url: Some("u4".into()),
                ..ProductMediaDraftDTO::default()
            },
            // video 不算
            ProductMediaDraftDTO {
                r#type: Some("video".into()),
                role: Some("video".into()),
                url: Some("u5".into()),
                ..ProductMediaDraftDTO::default()
            },
            // URL 空白不算
            ProductMediaDraftDTO {
                r#type: Some("image".into()),
                role: Some("main_image".into()),
                url: Some("   ".into()),
                ..ProductMediaDraftDTO::default()
            },
        ];
        assert_eq!(media_image_urls(&media), vec!["u1", "u2", "u3"]);
        assert_eq!(media_detail_image_urls(&media), vec!["u4"]);
    }

    /// Java `validate`：images 的候选集合 = media 商品图 + images。
    #[test]
    fn candidate_images_merges_media_and_images() {
        let draft = ProductDraftDTO {
            images: vec!["i1".into()],
            media: vec![ProductMediaDraftDTO {
                r#type: Some("image".into()),
                role: Some("main_image".into()),
                url: Some("m1".into()),
                ..ProductMediaDraftDTO::default()
            }],
            ..ProductDraftDTO::default()
        };
        assert_eq!(candidate_images(&draft), vec!["m1", "i1"]);
        assert!(!images_all_blank(&candidate_images(&draft)));
        assert!(images_all_blank(&[]));
        assert!(images_all_blank(&[String::new(), "  ".into()]));
    }

    /// `err()` 的 message 与 code 恒等（Java `e.setMessage(c)`）。
    #[test]
    fn field_error_message_equals_code() {
        let e = ProductFieldError::new("productSn", CODE_PRODUCT_SN_EXIST);
        assert_eq!(e.code.as_deref(), Some("PRODUCT_SN_EXIST"));
        assert_eq!(e.message.as_deref(), Some("PRODUCT_SN_EXIST"));
        assert_eq!(e.field.as_deref(), Some("productSn"));
    }

    /// `toPairs`：trim 后名与值都非空才纳入。
    #[test]
    fn sku_pairs_trim_filter() {
        let mut specs = BTreeMap::new();
        specs.insert("颜色".to_string(), " 红色 ".to_string());
        specs.insert("  ".to_string(), "x".to_string());
        specs.insert("尺码".to_string(), String::new());
        let pairs = sku_pairs(&specs);
        assert_eq!(pairs, vec![("颜色".to_string(), "红色".to_string())]);
        assert_eq!(build_sku_value(&pairs), "颜色:红色");
    }

    // ————————————————————— 批量操作 —————————————————————

    /// 白名单之外（含 null）一律 INVALID_OPERATION。
    #[test]
    fn batch_operation_gate() {
        assert_eq!(
            normalize_batch_operation(None).unwrap_err().0,
            CODE_INVALID_OPERATION
        );
        assert_eq!(
            normalize_batch_operation(None).unwrap_err().1,
            "缺少批量操作类型"
        );
        assert_eq!(
            normalize_batch_operation(Some("bogus")).unwrap_err().1,
            "仅支持 up、down、recycle、restore、del"
        );
        assert_eq!(normalize_batch_operation(Some(" UP ")).unwrap(), "up");
        assert_eq!(normalize_batch_operation(Some("Del")).unwrap(), "del");
        assert_eq!(
            normalize_batch_operation(Some("restore")).unwrap(),
            "restore"
        );
    }

    /// ids 空 ⇒ EMPTY_PRODUCT_IDS；去 null 去重且保序。
    #[test]
    fn batch_ids_normalization() {
        assert_eq!(
            normalize_batch_ids(None).unwrap_err().0,
            CODE_EMPTY_PRODUCT_IDS
        );
        assert_eq!(
            normalize_batch_ids(Some(&[])).unwrap_err().0,
            CODE_EMPTY_PRODUCT_IDS
        );
        let ids = normalize_batch_ids(Some(&[Some(3), None, Some(1), Some(3)])).unwrap();
        assert_eq!(ids, vec![3, 1]);
        // 全是 None ⇒ Java 同样只判入参是否为空，故返回空 Vec 且不报错
        let ids = normalize_batch_ids(Some(&[None, None])).unwrap();
        assert!(ids.is_empty());
        // 含 0 与负数也照原样保留（Java 未过滤）
        let ids = normalize_batch_ids(Some(&[Some(0), Some(-1)])).unwrap();
        assert_eq!(ids, vec![0, -1]);
    }

    /// Java `fingerprint`：ids 升序后拼接（与入参顺序无关）。
    #[test]
    fn batch_fingerprint_is_order_insensitive() {
        assert_eq!(batch_fingerprint("up", &[3, 1, 2]), "up:1,2,3");
        assert_eq!(batch_fingerprint("up", &[1, 2, 3]), "up:1,2,3");
        assert_ne!(
            batch_fingerprint("up", &[1, 2]),
            batch_fingerprint("down", &[1, 2])
        );
    }

    /// `batchBlockReason` 四个分支逐条对照 Java。
    #[test]
    fn batch_block_reason_branches() {
        // up：审核未通过或尚未审核（只有 APPROVED=0 放行）
        assert_eq!(
            batch_block_reason("up", CHECK_STATUS_PENDING, false),
            Some("审核未通过或尚未审核，审核通过后才能上架")
        );
        assert_eq!(
            batch_block_reason("up", CHECK_STATUS_REJECTED, false),
            Some("审核未通过或尚未审核，审核通过后才能上架")
        );
        assert_eq!(batch_block_reason("up", CHECK_STATUS_APPROVED, false), None);
        // del：不在回收站
        assert_eq!(
            batch_block_reason("del", 0, false),
            Some("需先移入回收站再删除")
        );
        assert_eq!(batch_block_reason("del", 0, true), None);
        // restore：不在回收站
        assert_eq!(
            batch_block_reason("restore", 0, false),
            Some("商品不在回收站，无需还原")
        );
        assert_eq!(batch_block_reason("restore", 0, true), None);
        // recycle：已在回收站
        assert_eq!(
            batch_block_reason("recycle", 0, true),
            Some("商品已经在回收站")
        );
        assert_eq!(batch_block_reason("recycle", 0, false), None);
        // down 无前置条件
        assert_eq!(batch_block_reason("down", 0, false), None);
    }

    /// 中文标签与连带后果对照 Java `switch`。
    #[test]
    fn batch_labels_and_consequences() {
        assert_eq!(batch_operation_label("up"), "批量上架");
        assert_eq!(batch_operation_label("down"), "批量下架");
        assert_eq!(batch_operation_label("recycle"), "批量移入回收站");
        assert_eq!(batch_operation_label("restore"), "批量还原");
        assert_eq!(batch_operation_label("del"), "批量彻底删除");
        // default 分支原样返回
        assert_eq!(batch_operation_label("weird"), "weird");

        assert_eq!(
            batch_consequences("up"),
            vec!["这些商品会立即在前台显示并可下单".to_string()]
        );
        assert_eq!(
            batch_consequences("del"),
            vec!["这些商品将被彻底删除，数据不可恢复".to_string()]
        );
        assert!(batch_consequences("weird").is_empty());
    }

    // ————————————————————— 单商品写操作 —————————————————————

    /// 白名单字段与文案。
    #[test]
    fn editable_field_whitelist() {
        assert_eq!(editable_field_label("productName"), Some("商品名称"));
        assert_eq!(editable_field_label("productSn"), Some("商品货号"));
        assert_eq!(editable_field_label("productPrice"), Some("价格"));
        assert_eq!(editable_field_label("productStock"), Some("库存"));
        assert_eq!(editable_field_label("productSku"), Some("多规格库存"));
        assert_eq!(editable_field_label("sortOrder"), Some("排序值"));
        // isDelete / del / productSku 以外的拼写都不在白名单
        assert_eq!(editable_field_label("isDelete"), None);
        assert_eq!(editable_field_label("del"), None);
        assert_eq!(editable_field_label("productSkuX"), None);

        assert_eq!(
            editable_fields_text(),
            "商品名称、商品货号、价格、库存、多规格库存、排序值"
        );
        let err = require_editable_field("isDelete").unwrap_err();
        assert!(err.starts_with("这里只能改：商品名称、商品货号、价格、库存、多规格库存、排序值。"));
        assert!(err.ends_with("上下架、移入回收站、还原和删除各有专门的操作。"));
        assert_eq!(require_editable_field("productPrice").unwrap(), "价格");
    }

    /// 状态中文名：`1` ⇒ 出售中，其余（含 2）⇒ 已下架。
    #[test]
    fn status_label_rules() {
        assert_eq!(status_label(None), None);
        assert_eq!(status_label(Some(1)).unwrap(), "出售中");
        assert_eq!(status_label(Some(0)).unwrap(), "已下架");
        assert_eq!(status_label(Some(7)).unwrap(), "已下架");
    }

    /// `updateConsequences`：库存为 0 与不为 0 文案不同。
    #[test]
    fn update_consequences_rules() {
        assert_eq!(
            update_consequences("productStock", Some(0)),
            vec!["库存为 0，前台会显示售罄，买家无法下单".to_string()]
        );
        assert_eq!(
            update_consequences("productStock", Some(5)),
            vec!["前台可售数量已经更新".to_string()]
        );
        // stock 为 None（回读失败）⇒ 走 else 分支
        assert_eq!(
            update_consequences("productStock", None),
            vec!["前台可售数量已经更新".to_string()]
        );
        assert_eq!(
            update_consequences("productPrice", Some(0)),
            vec!["前台已经按新价格显示，购物车里的商品下单时也按新价格算".to_string()]
        );
        assert!(update_consequences("sortOrder", Some(1)).is_empty());
    }

    /// `isB2c`：Java `tigshopProperties == null || getIsO2o() == 0`。
    #[test]
    fn is_b2c_rule() {
        assert!(is_b2c(None));
        assert!(is_b2c(Some(0)));
        assert!(!is_b2c(Some(1)));
    }

    /// `assertOwnedBy`：店铺身份只能操作自己的商品。
    #[test]
    fn ownership_rules() {
        // 平台身份（shopId 为 None 或 0）不限制
        assert!(is_owned_by(Some(5), None));
        assert!(is_owned_by(Some(5), Some(0)));
        // 店铺身份必须同店
        assert!(is_owned_by(Some(5), Some(5)));
        assert!(!is_owned_by(Some(6), Some(5)));
        assert!(!is_owned_by(None, Some(5)));
    }

    /// 导入结果建议文案四分支。
    #[test]
    fn import_suggestion_four_branches() {
        assert_eq!(
            build_import_suggestion(Some(1), Some(0), &[]),
            "已上架，但库存为 0，前台显示售罄；请在后台补库存"
        );
        assert_eq!(
            build_import_suggestion(Some(1), Some(10), &[]),
            "已上架，前台可正常购买"
        );
        assert_eq!(
            build_import_suggestion(Some(0), Some(0), &[]),
            "当前为下架状态且库存为 0，补库存后可在后台手动上架"
        );
        assert_eq!(
            build_import_suggestion(Some(0), Some(10), &[]),
            "当前为下架状态，可在后台商品列表核对后手动上架"
        );
        // stock 为 None 视为 0
        assert_eq!(
            build_import_suggestion(Some(1), None, &[]),
            "已上架，但库存为 0，前台显示售罄；请在后台补库存"
        );
        // status 为 None（非 1）走「下架」分支
        assert_eq!(
            build_import_suggestion(None, Some(10), &[]),
            "当前为下架状态，可在后台商品列表核对后手动上架"
        );
        // 补齐组合追加说明
        let s = build_import_suggestion(Some(1), Some(10), &["颜色:红;尺码:37".to_string()]);
        assert!(s.ends_with("（库存为 0），如不需要请在后台删除"));
        assert!(s.contains("颜色:红;尺码:37"));
        assert!(s.starts_with("已上架，前台可正常购买。已自动补齐"));
    }

    // ————————————————————— 分页 / ID / 摘要 —————————————————————

    #[test]
    fn pagination_normalization() {
        assert_eq!(normalize_page_size(None), 20);
        assert_eq!(normalize_page_size(Some(0)), 20);
        assert_eq!(normalize_page_size(Some(-5)), 20);
        assert_eq!(normalize_page_size(Some(1)), 1);
        assert_eq!(normalize_page_size(Some(100)), 100);
        // 上限 100
        assert_eq!(normalize_page_size(Some(101)), 100);
        assert_eq!(normalize_page_size(Some(9999)), 100);

        assert_eq!(normalize_page(None), 1);
        assert_eq!(normalize_page(Some(0)), 1);
        assert_eq!(normalize_page(Some(-3)), 1);
        assert_eq!(normalize_page(Some(3)), 3);
    }

    /// `requireProductId`：null / <= 0 都报「缺少商品ID」。
    #[test]
    fn require_product_id_rules() {
        assert_eq!(require_product_id(None).unwrap_err().1, "缺少商品ID");
        assert_eq!(require_product_id(Some(0)).unwrap_err().1, "缺少商品ID");
        assert_eq!(require_product_id(Some(-1)).unwrap_err().1, "缺少商品ID");
        assert_eq!(require_product_id(Some(1)).unwrap(), 1);
    }

    /// `notFound` 文案。
    #[test]
    fn not_found_message_text() {
        assert_eq!(
            product_not_found_message(42),
            "找不到商品（ID 42），可能已被彻底删除或不属于当前店铺"
        );
    }

    /// SKU 库存摘要：无规格 ⇒ 「无规格数据」；有名用名，无名用「规格{id}」。
    #[test]
    fn sku_stocks_text_rules() {
        assert_eq!(sku_stocks_text(&[]), "无规格数据");
        let skus = vec![
            ProductDetailSku {
                sku_id: Some(1),
                specs: Some("红色 / XL".into()),
                stock: Some(5),
                ..ProductDetailSku::default()
            },
            ProductDetailSku {
                sku_id: Some(2),
                specs: None,
                stock: Some(0),
                ..ProductDetailSku::default()
            },
            ProductDetailSku {
                sku_id: None,
                specs: Some("  ".into()),
                stock: None,
                ..ProductDetailSku::default()
            },
        ];
        assert_eq!(sku_stocks_text(&skus), "红色 / XL：5，规格2：0，规格：0");
    }

    // ————————————————————— 上下文统计 —————————————————————

    /// 入参校验三分支。
    #[test]
    fn context_param_validation() {
        assert_eq!(
            validate_context_params(None, None, None).unwrap_err().0,
            CODE_MISSING_FILTER
        );
        // 空白 keyword 等同未提供
        assert_eq!(
            validate_context_params(Some("   "), None, None)
                .unwrap_err()
                .0,
            CODE_MISSING_FILTER
        );
        assert_eq!(
            validate_context_params(None, Some(0), None).unwrap_err().0,
            CODE_INVALID_CATEGORY_ID
        );
        assert_eq!(
            validate_context_params(None, Some(-1), None).unwrap_err().0,
            CODE_INVALID_CATEGORY_ID
        );
        assert_eq!(
            validate_context_params(None, Some(1), Some(0))
                .unwrap_err()
                .0,
            CODE_INVALID_SAMPLE_SIZE
        );
        assert_eq!(
            validate_context_params(None, Some(1), Some(101))
                .unwrap_err()
                .0,
            CODE_INVALID_SAMPLE_SIZE
        );
        // 边界 1 / 100 合法
        assert!(validate_context_params(None, Some(1), Some(1)).is_ok());
        assert!(validate_context_params(None, Some(1), Some(100)).is_ok());
        // 只给 categoryId / 只给 keyword 都合法
        assert!(validate_context_params(None, Some(1), None).is_ok());
        assert!(validate_context_params(Some("鞋"), None, None).is_ok());
    }

    /// 整数均值 / 中位数（偶数取中间两数均值）。
    #[test]
    fn integer_stats() {
        assert_eq!(int_avg(&[]), None);
        assert_eq!(int_avg(&[1, 2, 3]), Some(2.0));
        assert_eq!(int_avg(&[1, 2]), Some(1.5));

        assert_eq!(int_median(&[]), None);
        assert_eq!(int_median(&[3, 1, 2]), Some(2.0));
        assert_eq!(int_median(&[1, 2, 3, 4]), Some(2.5));
        assert_eq!(int_median(&[10]), Some(10.0));
    }

    /// 价格中位数：偶数保留 8 位 HALF_UP 后去尾零。
    #[test]
    fn decimal_price_median() {
        assert_eq!(price_median(&[]), None);
        assert_eq!(
            price_median(&[d("3.00"), d("1.00"), d("2.00")]),
            Some(d("2"))
        );
        assert_eq!(price_median(&[d("1.00"), d("2.00")]), Some(d("1.5")));
        assert_eq!(price_median(&[d("10.00"), d("10.01")]), Some(d("10.005")));
        // 奇数个保持原值（去尾零）
        assert_eq!(price_median(&[d("9.90")]), Some(d("9.9")));
    }

    /// `defaults()`：price_median 缺失则不出 productPrice/marketPrice。
    #[test]
    fn context_defaults_shape() {
        let metrics = ProductContextMetrics::default();
        assert!(context_defaults(&metrics).is_empty());

        let metrics = ProductContextMetrics {
            price_median: Some(d("100")),
            stock_median: Some(7.0),
            ..ProductContextMetrics::default()
        };
        let out = context_defaults(&metrics);
        assert_eq!(out.len(), 3);
        assert_eq!(out["marketPrice"]["value"].as_str().unwrap(), "120");
        assert_eq!(out["productPrice"]["value"].as_str().unwrap(), "100");
        assert_eq!(
            out["productPrice"]["source"].as_str().unwrap(),
            "ai_recommended"
        );
        assert!((out["productPrice"]["confidence"].as_f64().unwrap() - 0.55).abs() < 1e-9);
        assert!((out["marketPrice"]["confidence"].as_f64().unwrap() - 0.45).abs() < 1e-9);
        assert!((out["productStock"]["confidence"].as_f64().unwrap() - 0.45).abs() < 1e-9);
        // 只有价格中位数时不出库存项
        let metrics = ProductContextMetrics {
            price_median: Some(d("100")),
            ..ProductContextMetrics::default()
        };
        let out = context_defaults(&metrics);
        assert_eq!(out.len(), 2);
        assert!(!out.contains_key("productStock"));
    }

    /// `defaults()` 的 stock 取整并 clamp 到 >= 0。
    #[test]
    fn context_defaults_stock_rounding() {
        let metrics = ProductContextMetrics {
            stock_median: Some(7.6),
            ..ProductContextMetrics::default()
        };
        assert_eq!(
            context_defaults(&metrics)["productStock"]["value"]
                .as_f64()
                .unwrap(),
            8.0
        );

        let metrics = ProductContextMetrics {
            stock_median: Some(-3.0),
            ..ProductContextMetrics::default()
        };
        assert_eq!(
            context_defaults(&metrics)["productStock"]["value"]
                .as_f64()
                .unwrap(),
            0.0
        );

        // 恰好 .5 时 Java Math.round 向上取整
        let metrics = ProductContextMetrics {
            stock_median: Some(2.5),
            ..ProductContextMetrics::default()
        };
        assert_eq!(
            context_defaults(&metrics)["productStock"]["value"]
                .as_f64()
                .unwrap(),
            3.0
        );
    }

    // ————————————————————— 编码推断 —————————————————————

    /// Java 正则 `^(.*?)(\d+)$` 的分组键。
    #[test]
    fn encoding_group_key_rules() {
        assert_eq!(encoding_group_key("SKU001"), Some(("SKU".to_string(), 3)));
        assert_eq!(encoding_group_key("001"), Some((String::new(), 3)));
        assert_eq!(encoding_group_key("SKU"), None);
        assert_eq!(encoding_group_key(""), None);
        // 尾部数字全取（贪婪）
        assert_eq!(encoding_group_key("A1B22"), Some(("A1B".to_string(), 2)));
        // 纯数字前缀为空
        assert_eq!(encoding_group_key("123456"), Some((String::new(), 6)));
    }

    /// 无分组时的分支。
    #[test]
    fn encoding_decision_needs_groups() {
        assert_eq!(encoding_decision(&[]), EncodingDecision::NoGroups);
        assert_eq!(
            encoding_decision(&["ABC".to_string()]),
            EncodingDecision::NoGroups
        );
    }

    /// 主分组 >= 3 且占比 >= 0.6 且次分组不过半 ⇒ 判定明确。
    #[test]
    fn encoding_decision_decisive() {
        let sns: Vec<String> = ["SKU001", "SKU002", "SKU003", "SKU004"]
            .iter()
            .map(|s| (*s).to_string())
            .collect();
        match encoding_decision(&sns) {
            EncodingDecision::Grouped {
                prefix,
                number_length,
                dominant,
                second,
                confidence,
                decisive,
            } => {
                assert_eq!(prefix, "SKU");
                assert_eq!(number_length, 3);
                assert_eq!(dominant, 4);
                assert_eq!(second, 0);
                assert!((confidence - 1.0).abs() < 1e-9);
                assert!(decisive);
            }
            EncodingDecision::NoGroups => panic!("应为 Grouped"),
        }
    }

    /// 主分组 < 3 条 ⇒ 不明确（MIN_DOMINANT_ENCODING_SAMPLES = 3）。
    #[test]
    fn encoding_decision_needs_three_samples() {
        let sns: Vec<String> = ["SKU001", "SKU002"]
            .iter()
            .map(|s| (*s).to_string())
            .collect();
        match encoding_decision(&sns) {
            EncodingDecision::Grouped {
                dominant, decisive, ..
            } => {
                assert_eq!(dominant, 2);
                assert!(!decisive);
            }
            EncodingDecision::NoGroups => panic!("应为 Grouped"),
        }
    }

    /// 主分组占比 < 0.6 ⇒ 不明确。
    #[test]
    fn encoding_decision_threshold() {
        // 3/6 = 0.5 < 0.6
        let sns: Vec<String> = ["A001", "A002", "A003", "B001", "B002", "B003"]
            .iter()
            .map(|s| (*s).to_string())
            .collect();
        match encoding_decision(&sns) {
            EncodingDecision::Grouped {
                dominant,
                confidence,
                decisive,
                ..
            } => {
                assert_eq!(dominant, 3);
                assert!((confidence - 0.5).abs() < 1e-9);
                assert!(!decisive);
            }
            EncodingDecision::NoGroups => panic!("应为 Grouped"),
        }
    }

    /// 主分组不足次分组两倍 ⇒ 不明确（`dominant >= second * 2`）。
    #[test]
    fn encoding_decision_second_group_rule() {
        // 4 vs 3：4 < 6 ⇒ 不明确
        let sns: Vec<String> = ["A001", "A002", "A003", "A004", "B001", "B002", "B003"]
            .iter()
            .map(|s| (*s).to_string())
            .collect();
        match encoding_decision(&sns) {
            EncodingDecision::Grouped {
                dominant,
                second,
                decisive,
                ..
            } => {
                assert_eq!(dominant, 4);
                assert_eq!(second, 3);
                assert!(!decisive);
            }
            EncodingDecision::NoGroups => panic!("应为 Grouped"),
        }
        // 6 vs 3：6 >= 6 ⇒ 明确
        let sns: Vec<String> = ["A1", "A2", "A3", "A4", "A5", "A6", "B1", "B2", "B3"]
            .iter()
            .map(|s| (*s).to_string())
            .collect();
        match encoding_decision(&sns) {
            EncodingDecision::Grouped {
                dominant,
                second,
                decisive,
                ..
            } => {
                assert_eq!(dominant, 6);
                assert_eq!(second, 3);
                assert!(decisive);
            }
            EncodingDecision::NoGroups => panic!("应为 Grouped"),
        }
    }

    /// 并非全部编码都匹配时 ⇒ 不明确（Java `matchedCount == sns.size()`）。
    #[test]
    fn encoding_decision_requires_all_matched() {
        let sns: Vec<String> = ["SKU001", "SKU002", "SKU003", "NODIGITS"]
            .iter()
            .map(|s| (*s).to_string())
            .collect();
        match encoding_decision(&sns) {
            EncodingDecision::Grouped { decisive, .. } => assert!(!decisive),
            EncodingDecision::NoGroups => panic!("应为 Grouped"),
        }
    }

    /// 候选格式化 / 溢出判定 / 上限。
    #[test]
    fn encoding_candidate_formatting() {
        assert_eq!(format_candidate("SKU", 3, 7), "SKU007");
        assert_eq!(format_candidate("SKU", 3, 123), "SKU123");
        assert_eq!(format_candidate("", 2, 5), "05");
        // 位数不足时补零，超出时不截断
        assert_eq!(format_candidate("A", 4, 12345), "A12345");

        assert!(!encoding_overflowed(99, 3));
        assert!(!encoding_overflowed(999, 3));
        assert!(encoding_overflowed(1000, 3));

        assert_eq!(encoding_max_number(0), Some(0));
        assert_eq!(encoding_max_number(1), Some(9));
        assert_eq!(encoding_max_number(3), Some(999));
        // 位数过大 ⇒ None（u64 保护）
        assert_eq!(encoding_max_number(25), None);
    }

    // ————————————————————— 媒体上传 —————————————————————

    /// 平台作用域归一：负数报错，非 0 报错，None/0 ⇒ 0。
    #[test]
    fn platform_shop_id_normalization() {
        assert_eq!(normalize_platform_shop_id(None).unwrap(), 0);
        assert_eq!(normalize_platform_shop_id(Some(0)).unwrap(), 0);
        assert_eq!(
            normalize_platform_shop_id(Some(-1)).unwrap_err().0,
            CODE_INVALID_SHOP_ID
        );
        assert_eq!(
            normalize_platform_shop_id(Some(3)).unwrap_err().0,
            CODE_PLATFORM_SCOPE_REQUIRED
        );
        // requirePlatformScope：非 0 即 403
        assert!(require_platform_scope(None).is_ok());
        assert!(require_platform_scope(Some(0)).is_ok());
        assert_eq!(
            require_platform_scope(Some(1)).unwrap_err().0,
            CODE_PLATFORM_SCOPE_REQUIRED
        );
        // 分类导入的同类校验
        assert!(require_category_platform_scope(Some(0)).is_ok());
        assert_eq!(
            require_category_platform_scope(Some(3)).unwrap_err().1,
            "category requires platform shop scope"
        );
    }

    /// Java `currentContextShopId` 的四种分支。
    #[test]
    fn context_shop_id_rules() {
        // 缺省 / admin ⇒ 0
        assert_eq!(context_shop_id(None, None), 0);
        assert_eq!(context_shop_id(Some(""), None), 0);
        assert_eq!(context_shop_id(Some("admin"), Some("9")), 0);
        assert_eq!(context_shop_id(Some("ADMIN"), None), 0);
        // shop / pos ⇒ X-SHOP-ID
        assert_eq!(context_shop_id(Some("shop"), Some("7")), 7);
        assert_eq!(context_shop_id(Some("pos"), Some(" 8 ")), 8);
        // 缺头或非法 ⇒ -1
        assert_eq!(context_shop_id(Some("shop"), None), -1);
        assert_eq!(context_shop_id(Some("shop"), Some("  ")), -1);
        assert_eq!(context_shop_id(Some("shop"), Some("abc")), -1);
        // 其它租户类型 ⇒ -1
        assert_eq!(context_shop_id(Some("vendor"), None), -1);
    }

    /// Java `invalidName`：`/`、`\`、`..`、`:` 都拒绝。
    #[test]
    fn invalid_file_name_rules() {
        assert!(!invalid_file_name("a.png"));
        assert!(invalid_file_name("a/b.png"));
        assert!(invalid_file_name("a\\b.png"));
        assert!(invalid_file_name("../a.png"));
        assert!(invalid_file_name("C:a.png"));
        // 仅一个点不算
        assert!(!invalid_file_name("a.b.png"));
    }

    /// Java `extension`：`.` 在首位时不算扩展名。
    #[test]
    fn file_extension_rules() {
        assert_eq!(file_extension("a.PNG"), "png");
        assert_eq!(file_extension("a.b.jpeg"), "jpeg");
        assert_eq!(file_extension("noext"), "");
        assert_eq!(file_extension(".gitignore"), "");
        assert_eq!(file_extension("a."), "");
    }

    /// Java `matchesExtension` 的 MIME↔扩展名对照表。
    #[test]
    fn matches_extension_matrix() {
        assert!(matches_extension("a.jpg", "image/jpeg"));
        assert!(matches_extension("a.JPEG", "image/jpeg"));
        assert!(!matches_extension("a.png", "image/jpeg"));
        assert!(matches_extension("a.png", "image/png"));
        assert!(matches_extension("a.gif", "image/gif"));
        assert!(matches_extension("a.webp", "image/webp"));
        assert!(matches_extension("a.tif", "image/tiff"));
        assert!(matches_extension("a.tiff", "image/tiff"));
        assert!(matches_extension("a.mp4", "video/mp4"));
        // 未知 MIME 恒 false
        assert!(!matches_extension("a.bmp", "image/bmp"));
        // 大小写 MIME 也应命中（调用方先小写化，这里按小写比较）
        assert!(!matches_extension("a.png", "IMAGE/PNG"));
    }

    /// 魔数校验（PNG / JPEG / GIF / WEBP / TIFF / MP4）。
    #[test]
    fn signature_matrix() {
        assert!(signature_valid(
            &[137, 80, 78, 71, 13, 10, 26, 10],
            "image/png"
        ));
        assert!(!signature_valid(&[137, 80, 78], "image/png"));
        assert!(signature_valid(&[255, 216, 255, 0], "image/jpeg"));
        assert!(!signature_valid(&[255, 216], "image/jpeg"));
        assert!(signature_valid(b"GIF89a", "image/gif"));
        assert!(!signature_valid(b"GIF89", "image/gif"));

        let mut webp = Vec::new();
        webp.extend_from_slice(b"RIFF");
        webp.extend_from_slice(&[0, 0, 0, 0]);
        webp.extend_from_slice(b"WEBP");
        assert!(signature_valid(&webp, "image/webp"));
        assert!(!signature_valid(b"RIFF0000XXXX", "image/webp"));

        assert!(signature_valid(&[b'I', b'I', 42, 0], "image/tiff"));
        assert!(signature_valid(&[b'M', b'M', 0, 42], "image/tiff"));
        assert!(!signature_valid(&[b'I', b'I', 0, 42], "image/tiff"));

        assert!(signature_valid(
            &[0, 0, 0, 0, b'f', b't', b'y', b'p'],
            "video/mp4"
        ));
        assert!(!signature_valid(
            &[0, 0, 0, 0, b'm', b'o', b'o', b'v'],
            "video/mp4"
        ));
        assert!(!signature_valid(b"whatever", "image/bmp"));
    }

    /// `multipartBytes` 解析：MB / KB / GB / 裸字节；失败回落 50MB。
    #[test]
    fn parse_size_bytes_rules() {
        assert_eq!(parse_size_bytes(Some("50MB")), 50 * MIB);
        assert_eq!(parse_size_bytes(Some("100KB")), 100 * 1024);
        assert_eq!(parse_size_bytes(Some("1GB")), 1_073_741_824);
        assert_eq!(parse_size_bytes(Some("1048576")), 1_048_576);
        assert_eq!(parse_size_bytes(Some(" 200mb ")), 200 * MIB);
        assert_eq!(parse_size_bytes(Some("abc")), 50 * MIB);
        assert_eq!(parse_size_bytes(None), 50 * MIB);
    }

    /// `imageBytes`：配置 MB × MiB，与 multipart 取小；缺失回落 20MB。
    #[test]
    fn image_max_bytes_rules() {
        let mp = 200 * MIB;
        assert_eq!(image_max_bytes(None, mp), 20 * MIB);
        assert_eq!(image_max_bytes(Some("10"), mp), 10 * MIB);
        assert_eq!(image_max_bytes(Some("0.5"), mp), MIB / 2);
        // 与 multipart 取小
        assert_eq!(image_max_bytes(Some("500"), mp), mp);
        // 非法配置回落 20MB
        assert_eq!(image_max_bytes(Some("abc"), mp), 20 * MIB);
        // multipart 本身较小则以它为准
        assert_eq!(image_max_bytes(Some("50"), 5 * MIB), 5 * MIB);
    }

    /// Base64 预估：`len * 3 / 4`。
    #[test]
    fn estimated_base64_size() {
        assert_eq!(estimated_base64_bytes(4), 3);
        assert_eq!(estimated_base64_bytes(8), 6);
        assert_eq!(estimated_base64_bytes(0), 0);
    }

    /// Java `statusCode`：413 / 415 / >=500 / 其它。
    #[test]
    fn status_code_mapping() {
        assert_eq!(status_code_to_error_code(413), CODE_FILE_TOO_LARGE);
        assert_eq!(status_code_to_error_code(415), CODE_UNSUPPORTED_MIME);
        assert_eq!(status_code_to_error_code(500), CODE_UPLOAD_RETRYABLE);
        assert_eq!(status_code_to_error_code(503), CODE_UPLOAD_RETRYABLE);
        assert_eq!(status_code_to_error_code(400), CODE_INVALID_FILE);
        assert_eq!(status_code_to_error_code(401), CODE_INVALID_FILE);
    }

    /// `classifyFailure` 的可重试判定。
    #[test]
    fn failure_retryable_rules() {
        assert!(failure_retryable(CODE_STORAGE_NOT_CONFIGURED));
        assert!(failure_retryable(CODE_UPLOAD_RETRYABLE));
        assert!(!failure_retryable(CODE_UNSUPPORTED_MIME));
        assert!(!failure_retryable(CODE_INVALID_FILE));
        assert!(!failure_retryable(CODE_MEDIA_IN_USE));
    }

    /// `preservePreviewForRetry`：只有 failed + MEDIA_IN_USE / SERVICE_UNAVAILABLE。
    #[test]
    fn preserve_preview_rules() {
        assert!(!preserve_preview_for_retry(
            &serde_json::json!({"status": "success"})
        ));
        assert!(!preserve_preview_for_retry(&serde_json::json!({})));
        assert!(preserve_preview_for_retry(
            &serde_json::json!({"status": "failed", "errorCode": "MEDIA_IN_USE"})
        ));
        assert!(preserve_preview_for_retry(
            &serde_json::json!({"status": "failed", "errorCode": "SERVICE_UNAVAILABLE"})
        ));
        // failed 但错误码不在集合里 ⇒ 不保留
        assert!(!preserve_preview_for_retry(
            &serde_json::json!({"status": "failed", "errorCode": "INVALID_ARGUMENT"})
        ));
    }

    /// `media_error` 的键与内容。
    #[test]
    fn media_error_shape() {
        let v = media_error(CODE_INVALID_ARGUMENT);
        assert_eq!(v["errorCode"], "INVALID_ARGUMENT");
        assert_eq!(v["status"], "failed");
    }

    /// `normalizeOperation` / `trimOpt`。
    #[test]
    fn normalize_and_trim() {
        assert_eq!(normalize_operation(None), "");
        assert_eq!(normalize_operation(Some("  UPLOAD ")), "upload");
        assert_eq!(trim_opt(None), None);
        assert_eq!(trim_opt(Some("  ")), None);
        assert_eq!(trim_opt(Some(" x ")), Some("x".to_string()));
    }

    /// `resolveIds` / `resolveId` / `impactCount` 三个互相关联的解析。
    #[test]
    fn media_id_resolution() {
        // ids 优先（resolveId 仍先看单数 id）
        let op = MediaOperationDTO {
            id: Some(9),
            ids: Some(vec![1, 2]),
            items: vec![MediaUploadFileDTO {
                id: Some(7),
                ..MediaUploadFileDTO::default()
            }],
            ..MediaOperationDTO::default()
        };
        assert_eq!(resolve_media_ids(&op), vec![1, 2]);
        assert_eq!(resolve_media_id(&op), Some(9));
        assert_eq!(media_impact_count(&op), 1);

        // ids 为空 Vec ⇒ 退到 id
        let op = MediaOperationDTO {
            id: Some(3),
            ids: Some(vec![]),
            ..MediaOperationDTO::default()
        };
        assert_eq!(resolve_media_ids(&op), vec![3]);
        assert_eq!(resolve_media_id(&op), Some(3));
        assert_eq!(media_impact_count(&op), 0);

        // 只有 items 的 id
        let op = MediaOperationDTO {
            items: vec![
                MediaUploadFileDTO {
                    id: Some(4),
                    ..MediaUploadFileDTO::default()
                },
                MediaUploadFileDTO::default(),
                MediaUploadFileDTO {
                    id: Some(6),
                    ..MediaUploadFileDTO::default()
                },
            ],
            ..MediaOperationDTO::default()
        };
        assert_eq!(resolve_media_ids(&op), vec![4, 6]);
        assert_eq!(resolve_media_id(&op), Some(4));
        assert_eq!(media_impact_count(&op), 3);

        // 全空
        let op = MediaOperationDTO::default();
        assert!(resolve_media_ids(&op).is_empty());
        assert_eq!(resolve_media_id(&op), None);
        assert_eq!(media_impact_count(&op), 0);
    }

    /// `resolveName` / `resolveType` / `resolveGroupType`。
    #[test]
    fn media_name_type_resolution() {
        let op = MediaOperationDTO::default();
        assert_eq!(resolve_media_name(&op), None);
        assert_eq!(resolve_media_type(&op), None);
        assert_eq!(resolve_group_type(&op), "image");

        let op = MediaOperationDTO {
            name: Some("  ".into()),
            items: vec![MediaUploadFileDTO {
                name: Some("from-item.png".into()),
                ..MediaUploadFileDTO::default()
            }],
            ..MediaOperationDTO::default()
        };
        assert_eq!(resolve_media_name(&op), Some("from-item.png".to_string()));

        let op = MediaOperationDTO {
            name: Some("  x ".into()),
            ..MediaOperationDTO::default()
        };
        assert_eq!(resolve_media_name(&op), Some("x".to_string()));

        // 显式 type 优先
        let op = MediaOperationDTO {
            r#type: Some(" VIDEO ".into()),
            items: vec![MediaUploadFileDTO {
                mime_type: Some("image/png".into()),
                ..MediaUploadFileDTO::default()
            }],
            ..MediaOperationDTO::default()
        };
        assert_eq!(resolve_media_type(&op), Some("video".to_string()));
        assert_eq!(resolve_group_type(&op), "video");

        // 无 type ⇒ 按 mime 推断
        let op = MediaOperationDTO {
            items: vec![MediaUploadFileDTO {
                mime_type: Some("VIDEO/MP4".into()),
                ..MediaUploadFileDTO::default()
            }],
            ..MediaOperationDTO::default()
        };
        assert_eq!(resolve_media_type(&op), Some("video".to_string()));

        let op = MediaOperationDTO {
            items: vec![MediaUploadFileDTO {
                mime_type: Some("image/jpeg".into()),
                ..MediaUploadFileDTO::default()
            }],
            ..MediaOperationDTO::default()
        };
        assert_eq!(resolve_media_type(&op), Some("image".to_string()));

        // 无法推断
        let op = MediaOperationDTO {
            items: vec![MediaUploadFileDTO {
                mime_type: Some("application/pdf".into()),
                ..MediaUploadFileDTO::default()
            }],
            ..MediaOperationDTO::default()
        };
        assert_eq!(resolve_media_type(&op), None);
    }

    /// `isSupportedType`：null/空白 ⇒ true。
    #[test]
    fn supported_media_type_rules() {
        assert!(is_supported_media_type(None));
        assert!(is_supported_media_type(Some("")));
        assert!(is_supported_media_type(Some("  ")));
        assert!(is_supported_media_type(Some("IMAGE")));
        assert!(is_supported_media_type(Some("video")));
        assert!(!is_supported_media_type(Some("audio")));
    }

    /// `tenantIsPlatform`：shop 与 vendor 都为空/0。
    #[test]
    fn tenant_platform_rules() {
        assert!(tenant_is_platform(None, None));
        assert!(tenant_is_platform(Some(0), Some(0)));
        assert!(tenant_is_platform(Some(0), None));
        assert!(!tenant_is_platform(Some(1), Some(0)));
        assert!(!tenant_is_platform(Some(0), Some(2)));
    }

    /// `contentDigest`：`None` ⇒ 空串。
    #[test]
    fn content_digest_none_is_empty() {
        assert_eq!(content_digest(None), "");
        assert!(!content_digest(Some("abc")).is_empty());
        // 不同内容 ⇒ 不同摘要
        assert_ne!(content_digest(Some("abc")), content_digest(Some("abd")));
    }

    /// `fingerprint` 的规范化：operation / type 都会 trim+小写。
    #[test]
    fn media_fingerprint_is_normalized() {
        let a = MediaOperationDTO {
            operation: Some(" UPLOAD ".into()),
            r#type: Some("IMAGE".into()),
            ..MediaOperationDTO::default()
        };
        let b = MediaOperationDTO {
            operation: Some("upload".into()),
            r#type: Some("image".into()),
            ..MediaOperationDTO::default()
        };
        assert_eq!(
            media_fingerprint_canonical(&a),
            media_fingerprint_canonical(&b)
        );

        // 内容不同 ⇒ 指纹不同
        let c = MediaOperationDTO {
            operation: Some("upload".into()),
            items: vec![MediaUploadFileDTO {
                content_base64: Some("AAA".into()),
                ..MediaUploadFileDTO::default()
            }],
            ..MediaOperationDTO::default()
        };
        let e = MediaOperationDTO {
            operation: Some("upload".into()),
            items: vec![MediaUploadFileDTO {
                content_base64: Some("BBB".into()),
                ..MediaUploadFileDTO::default()
            }],
            ..MediaOperationDTO::default()
        };
        assert_ne!(
            media_fingerprint_canonical(&c),
            media_fingerprint_canonical(&e)
        );
    }

    // ————————————————————— 商品分析 —————————————————————

    /// 价格分档边界（50 / 200 / 500）。
    #[test]
    fn price_band_boundaries() {
        assert_eq!(price_band(None), "未知");
        assert_eq!(price_band(Some(d("0"))), "0-50");
        assert_eq!(price_band(Some(d("49.99"))), "0-50");
        assert_eq!(price_band(Some(d("50"))), "50-200");
        assert_eq!(price_band(Some(d("199.99"))), "50-200");
        assert_eq!(price_band(Some(d("200"))), "200-500");
        assert_eq!(price_band(Some(d("499.99"))), "200-500");
        assert_eq!(price_band(Some(d("500"))), "500以上");
    }

    /// `ratio`：分母 <= 0 ⇒ 0；否则 HALF_UP 2 位去尾零。
    #[test]
    fn analysis_ratio_rules() {
        assert_eq!(analysis_ratio(1, 0), d("0"));
        assert_eq!(analysis_ratio(1, -1), d("0"));
        assert_eq!(analysis_ratio(1, 2), d("0.5"));
        assert_eq!(analysis_ratio(1, 3), d("0.33"));
        assert_eq!(analysis_ratio(2, 3), d("0.67"));
        assert_eq!(analysis_ratio(3, 3), d("1"));
        assert_eq!(analysis_ratio(0, 5), d("0"));
    }

    /// `normalizeNumber` 去尾零。
    #[test]
    fn normalize_number_rules() {
        assert_eq!(normalize_number(d("100.00")), d("100"));
        assert_eq!(normalize_number(d("0.50")), d("0.5"));
        assert_eq!(normalize_number(d("118.80")), d("118.8"));
        assert_eq!(normalize_number(d("0.00")), d("0"));
    }

    /// `confidence`：0 / 0.5 / 0.9。
    #[test]
    fn analysis_confidence_rules() {
        assert!((analysis_confidence(0) - 0.0).abs() < 1e-9);
        assert!((analysis_confidence(1) - 0.5).abs() < 1e-9);
        assert!((analysis_confidence(4) - 0.5).abs() < 1e-9);
        assert!((analysis_confidence(5) - 0.9).abs() < 1e-9);
        assert!((analysis_confidence(100) - 0.9).abs() < 1e-9);
    }

    /// `inventoryRisk` 的组合分支。
    #[test]
    fn inventory_risk_scoring() {
        // 库存 <= 10 且无销量 ⇒ 2 + 1 = 3
        let (score, reasons) = inventory_risk(5, 0);
        assert_eq!(score, 3);
        assert!(reasons.contains(&"低库存"));
        assert!(reasons.contains(&"无销量"));
        assert_eq!(risk_level(score), "HIGH");

        // 库存 > 10 且无销量 ⇒ 1
        let (score, reasons) = inventory_risk(50, 0);
        assert_eq!(score, 1);
        assert!(reasons.contains(&"无销量"));
        assert_eq!(risk_level(score), "MEDIUM");

        // 库存 <= 10 但有销量且周转不快 ⇒ 2
        let (score, _) = inventory_risk(10, 100);
        assert_eq!(score, 2);
        assert_eq!(risk_level(score), "HIGH");

        // 库存 > 10 且有销量且 stock/sales >= 30 ⇒ 1（周转缓慢）
        let (score, reasons) = inventory_risk(300, 10);
        assert_eq!(score, 1);
        assert!(reasons.contains(&"周转缓慢"));
        assert_eq!(risk_level(score), "MEDIUM");

        // 都正常 ⇒ 0
        let (score, reasons) = inventory_risk(100, 10);
        assert_eq!(score, 0);
        assert!(reasons.is_empty());
        assert_eq!(risk_level(score), "LOW");

        // 边界：stock/sales 恰好 30 ⇒ 触发；29.99 不触发
        let (score, _) = inventory_risk(300, 10);
        assert_eq!(score, 1);
        let (score, _) = inventory_risk(2999, 100);
        assert_eq!(score, 0);
    }

    /// sales <= 0 时用 `max(sales, 1)` 做分母，不 panic。
    #[test]
    fn inventory_risk_zero_sales_no_panic() {
        let (score, reasons) = inventory_risk(100, -5);
        assert_eq!(score, 1);
        assert!(reasons.contains(&"无销量"));
        assert_eq!(stock_to_sales_ratio(100, -5), d("100"));
        assert_eq!(stock_to_sales_ratio(0, 0), d("0"));
    }

    /// `categoryOf`：空/空白 ⇒ 未分类。
    #[test]
    fn category_of_rules() {
        assert_eq!(category_of(Some("运动鞋")), "运动鞋");
        assert_eq!(category_of(None), "未分类");
        assert_eq!(category_of(Some("")), "未分类");
        assert_eq!(category_of(Some("  ")), "未分类");
    }

    // ————————————————————— 分类导入 —————————————————————

    /// 展平：路径拼接、hasChildren/leaf。
    #[test]
    fn flatten_category_nodes_basic() {
        let nodes = vec![
            CategoryImportNode {
                id: None,
                name: Some("女鞋".into()),
                children: vec![CategoryImportNode {
                    id: None,
                    name: Some("运动系列".into()),
                    children: vec![],
                }],
            },
            CategoryImportNode {
                id: None,
                name: Some("男鞋".into()),
                children: vec![],
            },
        ];
        let (flat, out) = flatten_category_nodes(&nodes);
        assert_eq!(flat.len(), 3);
        assert_eq!(flat[0].path, "女鞋");
        assert_eq!(flat[0].parent_path, "");
        assert_eq!(flat[1].path, "女鞋/运动系列");
        assert_eq!(flat[1].parent_path, "女鞋");
        assert_eq!(flat[2].path, "男鞋");

        assert_eq!(out.len(), 3);
        assert!(out[0].has_children);
        assert!(!out[0].leaf);
        assert!(!out[1].has_children);
        assert!(out[1].leaf);
        // 名称已 trim
        assert_eq!(out[0].name.as_deref(), Some("女鞋"));
    }

    /// 空名与纯空白名 ⇒ conflict（"分类名称不能为空"），且**不**进入展平结果。
    #[test]
    fn flatten_category_nodes_blank_name() {
        for raw_name in [None, Some(""), Some("   ")] {
            let nodes = vec![CategoryImportNode {
                id: None,
                name: raw_name.map(str::to_string),
                children: vec![],
            }];
            let (flat, out) = flatten_category_nodes(&nodes);
            assert!(flat.is_empty());
            assert_eq!(out.len(), 1);
            assert_eq!(out[0].state.as_deref(), Some("conflict"));
            assert_eq!(out[0].reason.as_deref(), Some("分类名称不能为空"));
            assert!(out[0].name.is_none());
        }
    }

    /// 名称超过 30 字符 ⇒ conflict；恰好 30 字符合法。
    #[test]
    fn flatten_category_nodes_name_too_long() {
        let nodes = vec![CategoryImportNode {
            id: None,
            name: Some("x".repeat(31)),
            children: vec![],
        }];
        let (flat, out) = flatten_category_nodes(&nodes);
        assert!(flat.is_empty());
        assert_eq!(out[0].state.as_deref(), Some("conflict"));
        assert_eq!(out[0].reason.as_deref(), Some("分类名称不能超过 30 个字符"));

        let nodes = vec![CategoryImportNode {
            id: None,
            name: Some("x".repeat(30)),
            children: vec![],
        }];
        let (flat, out) = flatten_category_nodes(&nodes);
        assert_eq!(flat.len(), 1);
        assert_eq!(out[0].state, None);

        // 按**字符**而非字节计数：30 个汉字合法
        let nodes = vec![CategoryImportNode {
            id: None,
            name: Some("汉".repeat(30)),
            children: vec![],
        }];
        let (flat, _) = flatten_category_nodes(&nodes);
        assert_eq!(flat.len(), 1);
    }

    /// 同一父级下的重名 ⇒ 第二次 conflict（"输入中存在重复分类路径"）。
    #[test]
    fn flatten_category_nodes_duplicate_path() {
        let nodes = vec![
            CategoryImportNode {
                id: None,
                name: Some("鞋".into()),
                children: vec![],
            },
            CategoryImportNode {
                id: None,
                name: Some("鞋".into()),
                children: vec![],
            },
        ];
        let (flat, out) = flatten_category_nodes(&nodes);
        assert_eq!(flat.len(), 1);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].state, None);
        assert_eq!(out[1].state.as_deref(), Some("conflict"));
        assert_eq!(out[1].reason.as_deref(), Some("输入中存在重复分类路径"));
    }

    /// 不同父级下的同名不算重复（路径不同）。
    #[test]
    fn flatten_category_nodes_same_name_different_parent() {
        let nodes = vec![
            CategoryImportNode {
                id: None,
                name: Some("A".into()),
                children: vec![CategoryImportNode {
                    id: None,
                    name: Some("X".into()),
                    children: vec![],
                }],
            },
            CategoryImportNode {
                id: None,
                name: Some("B".into()),
                children: vec![CategoryImportNode {
                    id: None,
                    name: Some("X".into()),
                    children: vec![],
                }],
            },
        ];
        let (flat, out) = flatten_category_nodes(&nodes);
        assert_eq!(flat.len(), 4);
        assert!(out.iter().all(|n| n.state.is_none()));
        assert_eq!(flat[1].path, "A/X");
        assert_eq!(flat[3].path, "B/X");
    }

    /// 空输入 ⇒ 展平与 NodeResult 都为空。
    #[test]
    fn flatten_category_nodes_empty() {
        let (flat, out) = flatten_category_nodes(&[]);
        assert!(flat.is_empty());
        assert!(out.is_empty());
    }

    /// `summary` 文案（待创建 = total - existing - conflict，下限 0）。
    #[test]
    fn category_summary_text() {
        let preview = CategoryImportPreviewVO {
            total: 5,
            existing_count: 2,
            conflict_count: 1,
            missing_parent_count: 1,
            ..CategoryImportPreviewVO::default()
        };
        assert_eq!(
            category_preview_summary(&preview),
            "分类预览完成：共 5 个节点，已有 2 个，待创建 2 个，缺失父级 1 个"
        );
        // pending 为负 ⇒ clamp 到 0
        let preview = CategoryImportPreviewVO {
            total: 1,
            existing_count: 2,
            conflict_count: 1,
            missing_parent_count: 0,
            ..CategoryImportPreviewVO::default()
        };
        assert!(category_preview_summary(&preview).contains("待创建 0 个"));
    }

    /// `item` Map：id / code 都没有时只出 path 与 success。
    #[test]
    fn category_item_map_shape() {
        let v = category_item_map("a/b", true, None, None, None, false);
        assert_eq!(v["path"], "a/b");
        assert_eq!(v["success"], true);
        assert!(v.get("categoryId").is_none());
        assert!(v.get("errorCode").is_none());
        assert!(v.get("retryable").is_none());
        assert!(v.get("error").is_none());

        let v = category_item_map(
            "a/b",
            false,
            None,
            Some(CODE_MISSING_PARENT),
            Some("父级分类未创建，不能创建子级"),
            false,
        );
        assert_eq!(v["errorCode"], "MISSING_PARENT");
        assert_eq!(v["error"], "父级分类未创建，不能创建子级");
        assert_eq!(v["retryable"], false);

        let v = category_item_map("a", true, Some(7), None, None, false);
        assert_eq!(v["categoryId"], 7);
    }

    /// `safeMessage`：空 ⇒ 兜底；超长 ⇒ 截断 200。
    #[test]
    fn safe_message_rules() {
        assert_eq!(safe_message(None), "分类创建失败");
        assert_eq!(safe_message(Some("")), "分类创建失败");
        assert_eq!(safe_message(Some("  ")), "分类创建失败");
        assert_eq!(safe_message(Some("a")), "a");
        let long = "字".repeat(300);
        assert_eq!(safe_message(Some(&long)).chars().count(), 200);
    }

    /// `error(code, message)` 三键。
    #[test]
    fn category_error_shape() {
        let v = category_error(CODE_INVALID_ARGUMENT, "nodes 不能为空");
        assert_eq!(v["status"], "failed");
        assert_eq!(v["errorCode"], "INVALID_ARGUMENT");
        assert_eq!(v["message"], "nodes 不能为空");
    }

    #[test]
    fn normalize_parent_rules() {
        assert_eq!(normalize_parent_id(None), 0);
        assert_eq!(normalize_parent_id(Some(5)), 5);
    }

    // ————————————————————— capabilities —————————————————————

    /// capabilities 骨架的静态字段。
    #[test]
    fn capabilities_skeleton_shape() {
        let v = capabilities_skeleton();
        assert_eq!(v["version"], "1.1");
        assert_eq!(v["supportedIntents"].as_array().unwrap().len(), 6);
        assert_eq!(v["supportedIntents"][0], "create_product");
        assert_eq!(v["product"]["maxBatchProducts"], 50);
        assert_eq!(v["product"]["createRequired"][3], "categoryId|categoryName");
        assert_eq!(v["product"]["confirmationFlow"][0], "prepare.validate");
        assert_eq!(v["unsupported"][0], "external_market_data");
    }

    /// media 默认值：tokenTtl 1800s、batch 40MiB、20 个文件。
    #[test]
    fn capabilities_media_defaults_shape() {
        let v = capabilities_media_defaults();
        assert_eq!(v["tokenTtlSeconds"], 1800);
        assert_eq!(v["maxBatchBytes"], 41_943_040);
        assert_eq!(v["maxFilesPerCall"], 20);
        assert_eq!(v["preferredUploadMode"], "fileToken");
        assert_eq!(
            v["stageEndpoint"],
            "/adminapi/openapi/mcp/v1/media/upload-token"
        );
        assert_eq!(v["base64Fallback"], false);
        assert_eq!(v["strictUploadMode"], true);
        assert_eq!(v["defaultGroupId"], 0);
    }

    /// assistant 默认值。
    #[test]
    fn assistant_defaults_shape() {
        let v = assistant_defaults();
        assert_eq!(v["mode"], "natural_language");
        assert_eq!(v["requiresTemplate"], false);
        assert_eq!(v["requiresVisionModelForImages"], true);
        assert_eq!(v["imageWorkflow"], "vision_required");
    }

    /// `build_sku_value` 的形态（仅进程内比较用）。
    #[test]
    fn sku_value_shape() {
        let pairs = vec![
            ("颜色".to_string(), "红色".to_string()),
            ("尺码".to_string(), "37".to_string()),
        ];
        assert_eq!(build_sku_value(&pairs), "颜色:红色;尺码:37");
        assert_eq!(build_sku_value(&[]), "");
    }

    /// 状态 / 审核 / 类型中文名的兜底行为。
    #[test]
    fn label_fallbacks() {
        assert_eq!(audit_label(None), None);
        assert_eq!(audit_label(Some(0)).unwrap(), "审核通过");
        assert_eq!(audit_label(Some(1)).unwrap(), "待审核");
        assert_eq!(audit_label(Some(2)).unwrap(), "审核未通过");
        // 未知码 ⇒ None
        assert_eq!(audit_label(Some(99)), None);

        assert_eq!(product_type_label(None), None);
        assert_eq!(product_type_label(Some(1)).unwrap(), "实物商品");
        assert_eq!(product_type_label(Some(8)).unwrap(), "电子礼品卡");
        assert_eq!(product_type_label(Some(99)), None);
    }

    /// 常量自检：与 Java 字面量一致。
    #[test]
    fn constants_match_java() {
        assert_eq!(MAX_PAGE_SIZE, 100);
        assert_eq!(DEFAULT_PAGE_SIZE, 20);
        assert_eq!(MAX_PRODUCTS, 50);
        assert_eq!(CATEGORY_PAGE_SIZE, 50);
        assert_eq!(MAX_CATEGORY_DEPTH, 10);
        assert_eq!(MAX_SKU_SN_LENGTH, 60);
        assert_eq!(DEFAULT_PRODUCT_NAME_LENGTH, 200);
        assert_eq!(PREVIEW_TTL_MILLIS, 1_800_000);
        assert_eq!(RESULT_TTL_MILLIS, 86_400_000);
        assert_eq!(TOKEN_TTL_MILLIS, 1_800_000);
        assert_eq!(MAX_FILES, 20);
        assert_eq!(BATCH_CAP, 41_943_040);
        assert_eq!(BATCH_MAX_IDS, 50);
        assert_eq!(BATCH_SORT_LIMIT, 20);
        assert_eq!(ANALYSIS_RANKING_LIMIT, 20);
        assert_eq!(CATEGORY_IMPORT_PAGE_SIZE, 1000);
        assert_eq!(CATEGORY_NAME_MAX_LEN, 30);
        assert_eq!(ANALYSIS_DEFAULT_SAMPLE_SIZE, 100);
        assert_eq!(CONTEXT_DEFAULT_SAMPLE_SIZE, 20);
        assert_eq!(CONTEXT_SAMPLES_CAP, 20);
        assert_eq!(CONTEXT_PATTERN_LIMIT, 10);
        assert_eq!(KEY_HEADER, "X-MCP-Api-Key");
        assert_eq!(IDEMPOTENCY_HEADER, "Idempotency-Key");
        assert_eq!(ADMIN_TYPE_HEADER, "X-ADMIN-TYPE");
        assert_eq!(SHOP_ID_HEADER, "X-SHOP-ID");
        assert_eq!(CONFIG_CODE_WORKBUDDY_API_KEY, "workbuddyApiKey");
        assert_eq!(
            CONFIG_CODE_WORKBUDDY_API_KEY_EXPIRES_AT,
            "workbuddyApiKeyExpiresAt"
        );
        assert_eq!(CHECK_STATUS_APPROVED, 0);
        assert_eq!(CHECK_STATUS_REJECTED, 2);
        assert_eq!(PRODUCT_STATUS_ON_SALE, 1);
        assert_eq!(SKU_TYPE_SINGLE, 1);
        assert_eq!(SKU_TYPE_MULTI, 2);
        assert_eq!(SPEC_ATTR_TYPE, 1);
        assert_eq!(PRODUCT_TYPE_NORMAL, 1);
    }

    /// Media 常量集合自检。
    #[test]
    fn media_constants_match_java() {
        assert_eq!(ALLOWED_IMAGE_MIMES.len(), 5);
        assert_eq!(ALLOWED_VIDEO_MIME, "video/mp4");
        assert_eq!(IMAGE_ROLES.len(), 3);
        assert_eq!(VIDEO_ROLES, ["video"]);
        assert_eq!(
            MEDIA_SUPPORTED_OPERATIONS,
            [
                "upload",
                "update",
                "delete",
                "group_create",
                "group_update",
                "group_delete"
            ]
        );
        assert_eq!(ANALYSIS_OPERATIONS.len(), 7);
        assert_eq!(ANALYSIS_OPERATIONS[0], "overview");
        assert_eq!(ANALYSIS_OPERATIONS[6], "recommend");
    }

    /// VO 的 JSON 键必须 camelCase（供 MCP 客户端逐字段消费）。
    #[test]
    fn vo_json_keys_are_camel_case() {
        let summary = ProductSummaryVO {
            product_id: Some(1),
            product_name: Some("n".into()),
            ..ProductSummaryVO::default()
        };
        let v = serde_json::to_value(&summary).unwrap();
        for key in [
            "productId",
            "productName",
            "productSn",
            "price",
            "stock",
            "status",
            "auditStatus",
            "productType",
            "categoryName",
            "skuCount",
            "sales",
            "recycled",
        ] {
            assert!(v.get(key).is_some(), "缺少键 {key}");
        }

        let detail = serde_json::to_value(ProductDetailVO::default()).unwrap();
        for key in [
            "productId",
            "marketPrice",
            "auditReason",
            "picUrl",
            "sortOrder",
            "recycled",
            "skus",
        ] {
            assert!(detail.get(key).is_some(), "缺少键 {key}");
        }

        let links = serde_json::to_value(PromotionLinksVO::default()).unwrap();
        for key in [
            "h5ShortLink",
            "h5OriginalLink",
            "pcShortLink",
            "pcOriginalLink",
            "miniCode",
            "wechatShortLink",
            "wechatShortLinkError",
            "posterAvailable",
        ] {
            assert!(links.get(key).is_some(), "缺少键 {key}");
        }

        let req = serde_json::to_value(ProductRequirementsVO::default()).unwrap();
        assert!(req.get("workflow").is_some());
        assert!(req.get("unsupported").is_some());
        // Java `v.setTemplate(null)` ⇒ 本实现不输出 template 键
        assert!(req.get("template").is_none());

        let ctx = serde_json::to_value(ProductContextVO::default()).unwrap();
        for key in [
            "hasData",
            "categoryId",
            "categoryName",
            "sampleSize",
            "metrics",
            "patterns",
            "samples",
            "fallback",
            "encoding",
            "defaults",
        ] {
            assert!(ctx.get(key).is_some(), "缺少键 {key}");
        }

        let analysis = serde_json::to_value(ProductAnalysisVO::default()).unwrap();
        for key in [
            "metrics",
            "rankings",
            "recommendations",
            "dataScope",
            "sampleSize",
            "generatedAt",
            "dataStartTime",
            "dataEndTime",
            "confidence",
            "fallbackMessage",
        ] {
            assert!(analysis.get(key).is_some(), "缺少键 {key}");
        }

        let preview = serde_json::to_value(BatchPreviewVO::default()).unwrap();
        for key in [
            "previewId",
            "operation",
            "consequences",
            "affected",
            "blocked",
            "irreversible",
        ] {
            assert!(preview.get(key).is_some(), "缺少键 {key}");
        }

        let result = serde_json::to_value(BatchResultVO::default()).unwrap();
        for key in [
            "operation",
            "successCount",
            "affected",
            "consequences",
            "failed",
        ] {
            assert!(result.get(key).is_some(), "缺少键 {key}");
        }

        let write = serde_json::to_value(ProductWriteResultVO::default()).unwrap();
        for key in [
            "productId",
            "productName",
            "changedField",
            "before",
            "after",
            "consequences",
        ] {
            assert!(write.get(key).is_some(), "缺少键 {key}");
        }

        let imp = serde_json::to_value(ProductImportResultVO::default()).unwrap();
        for key in [
            "requestId",
            "previewId",
            "total",
            "successCount",
            "failureCount",
            "items",
        ] {
            assert!(imp.get(key).is_some(), "缺少键 {key}");
        }

        let cat = serde_json::to_value(ProductCategoryVO::default()).unwrap();
        for key in [
            "categoryId",
            "categoryName",
            "path",
            "parentId",
            "hasChildren",
        ] {
            assert!(cat.get(key).is_some(), "缺少键 {key}");
        }
    }

    /// DTO 反序列化：camelCase + `MediaUploadFileDTO` 的别名。
    #[test]
    fn dto_deserialization_aliases() {
        let f: MediaUploadFileDTO =
            serde_json::from_str(r#"{"fileName":"a.png","mime":"image/png","base64":"AAA"}"#)
                .unwrap();
        assert_eq!(f.name.as_deref(), Some("a.png"));
        assert_eq!(f.mime_type.as_deref(), Some("image/png"));
        assert_eq!(f.content_base64.as_deref(), Some("AAA"));

        let f: MediaUploadFileDTO =
            serde_json::from_str(r#"{"name":"a.png","mimeType":"image/png","content":"x"}"#)
                .unwrap();
        assert_eq!(f.name.as_deref(), Some("a.png"));
        assert_eq!(f.mime_type.as_deref(), Some("image/png"));
        assert_eq!(f.content_base64.as_deref(), Some("x"));

        // 变量名不要用 `d`：会遮蔽上面的辅助函数 `d(&str) -> Decimal`
        // （E0618: expected function, found `ProductDraftDTO`）。
        let draft: ProductDraftDTO =
            serde_json::from_str(r#"{"productName":"T恤","productPrice":"99.00"}"#).unwrap();
        assert_eq!(draft.product_name.as_deref(), Some("T恤"));
        assert_eq!(draft.product_price, Some(d("99.00")));

        // 缺省字段全部走 Default（不报错）
        let draft: ProductDraftDTO = serde_json::from_str("{}").unwrap();
        assert!(draft.product_name.is_none());
        assert!(draft.images.is_empty());
        assert!(draft.skus.is_empty());
        assert!(draft.field_sources.is_empty());
    }

    /// 分类导入 DTO 的递归反序列化。
    #[test]
    fn category_import_dto_recursive() {
        let dto: CategoryImportDTO = serde_json::from_str(
            r#"{"operation":"import","requestId":"r1","nodes":[{"name":"A","children":[{"name":"B"}]}]}"#,
        )
        .unwrap();
        assert_eq!(dto.operation.as_deref(), Some("import"));
        assert_eq!(dto.nodes.len(), 1);
        assert_eq!(dto.nodes[0].children.len(), 1);
        assert_eq!(dto.nodes[0].children[0].name.as_deref(), Some("B"));
        assert!(dto.nodes[0].children[0].children.is_empty());
    }

    /// `TigshopConfigVO` 的序列化形态。
    #[test]
    fn tigshop_config_vo_shape() {
        let vo = TigshopConfigVO::from(tigshop_config_text(
            Some(1),
            Some(0),
            Some(1),
            Some(0),
            Some(0),
            Some(0),
        ));
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(
            v["text"],
            "isMerchant: 1isB2b: 0isPro: 1isOverseas: 0isVendor: 0isO2o: 0"
        );
    }
}
