//! 商户进件域（payment::merchant_application）DTO / VO / 查询参数 / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.query.finance.MerchantApplicationPageQuery`
//! - `com.tigshop.bean.param.finance.{MerchantApplicationSubmitParam,
//!   MerchantApplicationAuditParam}`
//! - `com.tigshop.bean.vo.finance.MerchantApplicationVO`
//! - `com.tigshop.bean.enums.finance.{MerchantApplicationStatus, SubMerchantStatus}`
//! - `com.tigshop.bean.enums.adminuser.AdminTypeEnum`
//! - `com.tigshop.service.finance.impl.MerchantApplicationServiceImpl`
//!
//! 实体 `tigshop_core::entities::MerchantApplication`（表 `merchant_application`，
//! 24 列）已由 schema 生成；时间为 MySQL `DATETIME`（实体为 `String`）。
//!
//! # 关键语义（逐条对照 Java）
//!
//! - 状态机：`DRAFT` / `PENDING_REVIEW` / `SUBMITTED` / `CHECKING` / `AUDITING` /
//!   `ACCOUNT_NEED_VERIFY` / `NEED_SIGN` / `FINISH` / `REJECTED`
//!   （`from_code` 兼容微信原始申请单状态）。
//! - `reasonLabel`：`REJECTED` →「驳回原因」，其它有原因 →「失败原因」，无原因空串。
//! - 提交校验文案逐字符照抄（`validateEnumValues` / `validateLicensedApplication`
//!   / `validatePersonalApplication` / `validateStoreUrl` / `validateMediaValues`）。
//! - `requestSnapshot` 是脱敏 JSON：VO 从中回填 `merchantShortName` /
//!   `storeUrl` / `businessLicenseNumber` / `legalPerson` / 银行账户信息。
//!
//! # 未迁移（见服务层）
//!
//! 微信/汇付渠道客户端（进件提交、审核通过、状态刷新、媒体上传/下载）与
//! `merchant_application_media` 归一化流程未迁移：相关端点完成本地校验后返回
//! 明确业务错误，不伪造渠道结果。

use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 常量
// ——————————————————————————————————————————————

/// 主键列（Java `getKeyColumn` → `id`，BIGINT）。
pub const KEY_COLUMN: &str = "id";
/// 主键属性名。
pub const KEY_PROPERTY: &str = "id";

/// 默认渠道（Java `DEFAULT_CHANNEL`）。
pub const CHANNEL_WECHAT: &str = "WECHAT";
/// 汇付渠道。
pub const CHANNEL_HUIFU: &str = "HUIFU";
/// 支付宝渠道。
pub const CHANNEL_ALIPAY: &str = "ALIPAY";

/// 申请主体：店铺（Java `APPLICANT_SHOP`）。
pub const APPLICANT_SHOP: &str = "SHOP";
/// 申请主体：供应商。
pub const APPLICANT_VENDOR: &str = "VENDOR";
/// 平台自营展示名（Java `SELF_OPERATED_SHOP_NAME`）。
pub const SELF_OPERATED_SHOP_NAME: &str = "平台自营";

/// 状态：草稿。
pub const STATUS_DRAFT: &str = "DRAFT";
/// 状态：平台待审核。
pub const STATUS_PENDING_REVIEW: &str = "PENDING_REVIEW";
/// 状态：已提交。
pub const STATUS_SUBMITTED: &str = "SUBMITTED";
/// 状态：资料校验中。
pub const STATUS_CHECKING: &str = "CHECKING";
/// 状态：审核中。
pub const STATUS_AUDITING: &str = "AUDITING";
/// 状态：待账户验证。
pub const STATUS_ACCOUNT_NEED_VERIFY: &str = "ACCOUNT_NEED_VERIFY";
/// 状态：待签约。
pub const STATUS_NEED_SIGN: &str = "NEED_SIGN";
/// 状态：完成。
pub const STATUS_FINISH: &str = "FINISH";
/// 状态：已驳回。
pub const STATUS_REJECTED: &str = "REJECTED";

// ————————————————————— 提示文案（Java `GlobalException` / 注解原文） —————————————————————

pub const MSG_UNRECOGNIZED_APPLICANT: &str = "无法识别当前登录主体，请使用店铺/门店账号操作";
pub const MSG_IN_PROGRESS_DUPLICATE: &str = "已有进行中或已完成的进件申请，无法重复提交";
pub const MSG_SHOP_REQUIRED: &str = "请选择店铺";
pub const MSG_SHOP_IN_PROGRESS: &str = "该店铺已有进行中的进件申请";
pub const MSG_MEDIA_TRACK_MISSING: &str = "申请证件缺少上传记录，请重新上传";
pub const MSG_NOT_EXISTS: &str = "进件申请不存在";
pub const MSG_ALREADY_PROCESSING: &str = "该申请正在处理中，请勿重复操作";
pub const MSG_ONLY_PENDING_APPROVE: &str = "仅待审核状态的申请可以审核通过";
pub const MSG_ONLY_PENDING_REJECT: &str = "仅待审核状态的申请可以拒绝";
pub const MSG_SNAPSHOT_MISSING: &str = "申请数据缺失，无法提交进件";
pub const MSG_REJECT_REASON_REQUIRED: &str = "请填写驳回原因";
pub const MSG_RESULT_SAVE_FAILED: &str = "进件申请审核结果保存失败";
pub const MSG_TERMINAL: &str = "该申请已处于终态，无需刷新";
pub const MSG_APPLYMENT_ID_MISSING: &str = "缺少申请单号，无法查询状态";
pub const MSG_UPLOAD_EMPTY: &str = "上传文件不能为空";
pub const MSG_UPLOAD_BAD_EXT: &str = "仅支持JPG/JPEG/PNG/BMP格式的图片";
pub const MSG_UPLOAD_BAD_TYPE: &str = "不支持的文件类型";
pub const MSG_UPLOAD_TOO_LARGE: &str = "文件大小不能超过5MB";
pub const MSG_ORG_TYPE_INVALID: &str = "主体类型不合法，允许值: 2(企业), 4(个体工商户), 2401(个人)";
pub const MSG_CONTACT_TYPE_INVALID: &str = "超管类型不合法，允许值: 65(经营者/法人), 66(经办人)";
pub const MSG_BANK_ACCOUNT_TYPE_INVALID: &str = "银行账户类型不合法，允许值: 74(对公), 75(对私)";
pub const MSG_SETTLEMENT_ID_INVALID: &str = "结算规则ID必须为数字";
pub const MSG_LICENSED_FIELDS_REQUIRED: &str =
    "请填写商户名称、商户简称、营业执照号及法人/经营者姓名";
pub const MSG_ID_CARD_REQUIRED: &str = "请填写法人/经营者身份证姓名、号码和有效期";
pub const MSG_ID_CARD_NAME_MISMATCH: &str = "身份证姓名必须与法人/经营者姓名一致";
pub const MSG_BANK_REQUIRED: &str = "请填写结算账户类型、开户名称、账号和开户银行";
pub const MSG_COMPANY_BANK_ONLY_PUBLIC: &str = "企业主体仅支持对公结算账户";
pub const MSG_BANK_NAME_MISMATCH_PUBLIC: &str = "对公账户名称必须与营业执照名称一致";
pub const MSG_BANK_NAME_MISMATCH_PRIVATE: &str = "对私账户开户名必须与经营者身份证姓名一致";
pub const MSG_CONTACT_REQUIRED: &str = "请填写超级管理员类型、姓名、身份证号和手机号";
pub const MSG_CONTACT_PROXY_UNSUPPORTED: &str =
    "暂不支持经办人进件，请选择法人/经营者作为超级管理员";
pub const MSG_CONTACT_MISMATCH: &str = "超级管理员姓名和身份证号必须与法人/经营者一致";
pub const MSG_PERSONAL_CHANNEL_ONLY: &str = "个人主体目前仅支持微信进件";
pub const MSG_PERSONAL_ID_REQUIRED: &str = "请填写个人身份证姓名、号码和有效期";
pub const MSG_PERSONAL_FIELDS_REQUIRED: &str = "请填写店铺名称、商户简称、手机号和结算银行卡信息";
pub const MSG_PERSONAL_BANK_ONLY_PRIVATE: &str = "个人主体仅支持经营者本人对私银行卡";
pub const MSG_PERSONAL_BANK_NAME_MISMATCH: &str = "个人结算账户开户名必须与身份证姓名一致";
pub const MSG_PERSONAL_CONTACT_MISMATCH: &str = "个人主体的超级管理员必须为经营者本人";
pub const MSG_STORE_URL_REQUIRED: &str = "请填写店铺链接";
pub const MSG_STORE_URL_TOO_LONG: &str = "店铺链接长度不能超过1024个字符";
pub const MSG_STORE_URL_INVALID: &str = "店铺链接必须为有效的HTTP或HTTPS地址";
pub const MSG_MEDIA_REQUIRED: &str = "营业执照和身份证正反面均需上传";
pub const MSG_PERSONAL_MEDIA_REQUIRED: &str = "身份证正反面均需上传";
pub const MSG_MEDIA_SCHEME_UNSUPPORTED: &str = "进件媒体地址不受支持";
pub const MSG_MEDIA_DUPLICATED: &str = "进件证件不可重复";
pub const MSG_CHANNEL_UNSUPPORTED: &str = "暂不支持的支付渠道";

/// 渠道客户端未迁移（微信/汇付进件能力）。
pub const MSG_CHANNEL_UNMIGRATED: &str =
    "支付渠道进件客户端尚未迁移到 Rust 侧（微信/汇付），当前操作未提交到渠道";
/// 媒体服务未迁移（证件上传/下载/归一化）。
pub const MSG_MEDIA_UNMIGRATED: &str = "进件媒体服务（证件上传/原图预览）尚未迁移到 Rust 侧";

/// 渠道异常原因前缀（Java `buildChannelErrorReason`）。
pub const CHANNEL_ERROR_PREFIX: &str = "进件渠道提交失败：";

// ————————————————————— 枚举 / 纯函数 —————————————————————

/// 状态文案（Java `MerchantApplicationStatus.getDesc`；兼容微信原始状态码）。
#[must_use]
pub fn status_desc(code: Option<&str>) -> Option<&'static str> {
    let Some(code) = code else {
        return None;
    };
    let normalized = code.trim().to_ascii_uppercase();
    Some(match normalized.as_str() {
        STATUS_DRAFT => "草稿",
        STATUS_PENDING_REVIEW => "待审核",
        STATUS_SUBMITTED => "已提交",
        STATUS_CHECKING => "资料校验中",
        STATUS_AUDITING => "审核中",
        STATUS_ACCOUNT_NEED_VERIFY => "待账户验证",
        STATUS_NEED_SIGN => "待签约",
        STATUS_FINISH => "完成",
        STATUS_REJECTED => "已驳回",
        "APPLYMENT_STATE_FINISHED" => "完成",
        "APPLYMENT_STATE_TO_BE_SIGNED" => "待签约",
        "APPLYMENT_STATE_REJECTED" => "已驳回",
        "APPLYMENT_STATE_AUDITING" => "审核中",
        "APPLYMENT_STATE_TO_BE_CONFIRMED" => "待账户验证",
        _ => return None,
    })
}

/// `reasonLabel`（Java `resolveReasonLabel`）。
#[must_use]
pub fn reason_label(status: Option<&str>, reason: &str) -> String {
    let normalized = status.unwrap_or_default().trim().to_ascii_uppercase();
    let has_reason = !reason.trim().is_empty();
    if normalized == STATUS_REJECTED {
        if has_reason {
            "驳回原因".to_string()
        } else {
            String::new()
        }
    } else if has_reason {
        "失败原因".to_string()
    } else {
        String::new()
    }
}

/// 渠道归一（Java `resolveChannel`：空白→WECHAT，大写；仅支持 WECHAT/HUIFU/ALIPAY）。
pub fn resolve_channel(raw: Option<&str>) -> Result<&'static str, String> {
    let value = raw.unwrap_or("").trim().to_ascii_uppercase();
    if value.is_empty() {
        return Ok(CHANNEL_WECHAT);
    }
    match value.as_str() {
        CHANNEL_WECHAT => Ok(CHANNEL_WECHAT),
        "HUIFU" => Ok(CHANNEL_HUIFU),
        "ALIPAY" => Ok(CHANNEL_ALIPAY),
        other => Err(format!("{MSG_CHANNEL_UNSUPPORTED}：{other}")),
    }
}

/// 渠道异常原因（Java `buildChannelErrorReason`）。
#[must_use]
pub fn channel_error_reason(detail: Option<&str>) -> String {
    match detail.map(str::trim).filter(|s| !s.is_empty()) {
        Some(d) => format!("{CHANNEL_ERROR_PREFIX}{d}"),
        None => "进件渠道提交失败，请稍后重试".to_string(),
    }
}

/// 排序字段 → 列名（未知回退主键）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "id" => "id",
        "shopId" | "shop_id" => "shop_id",
        "applicantType" | "applicant_type" => "applicant_type",
        "applicantId" | "applicant_id" => "applicant_id",
        "applicantName" | "applicant_name" => "applicant_name",
        "payChannel" | "pay_channel" => "pay_channel",
        "businessCode" | "business_code" => "business_code",
        "status" => "status",
        "auditTime" | "audit_time" => "audit_time",
        "createTime" | "create_time" => "create_time",
        "modifyTime" | "modify_time" => "modify_time",
        _ => KEY_COLUMN,
    }
}

/// 空串判定（Java `StrUtil.isBlank`）。
#[must_use]
pub fn is_blank(v: Option<&str>) -> bool {
    v.map(|s| s.trim().is_empty()).unwrap_or(true)
}

/// 是否个人主体（微信小微商户 2401）。
#[must_use]
pub fn is_personal(organization_type: Option<&str>) -> bool {
    organization_type.map(str::trim) == Some("2401")
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 分页查询（Java `MerchantApplicationPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MerchantApplicationPageQuery {
    /// 店铺 ID（平台端可指定）
    pub shop_id: Option<i64>,
    /// 申请主体类型：SHOP / VENDOR
    pub applicant_type: Option<String>,
    /// 状态
    pub status: Option<String>,
    /// 状态集合（逗号分隔）
    pub status_list: Option<String>,
    /// 页码
    pub page: Option<i64>,
    /// 每页条数（Java `size`）
    pub size: Option<i64>,
    /// 排序字段（Java 随后会强制改为主键降序）
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
}

impl MerchantApplicationPageQuery {
    /// `(LIMIT, OFFSET)`。
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = match self.size {
            None => 15,
            Some(v) if v > 100 => 100,
            Some(v) if v < 1 => 1,
            Some(v) => v,
        };
        (size, (page - 1) * size)
    }

    /// `statusList` 拆分（去空白、去空项）。
    #[must_use]
    pub fn status_values(&self) -> Vec<String> {
        self.status_list
            .as_deref()
            .map(|raw| {
                raw.split(',')
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .map(ToString::to_string)
                    .collect()
            })
            .unwrap_or_default()
    }
}

/// 进件提交参数（Java `MerchantApplicationSubmitParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MerchantApplicationSubmitParam {
    /// 店铺 ID（兼容字段，店铺/供应商端由登录态推导）
    pub shop_id: Option<i64>,
    /// 支付渠道：WECHAT / HUIFU，默认 WECHAT
    pub pay_channel: Option<String>,
    /// 主体类型（`@NotBlank`）
    pub organization_type: Option<String>,
    /// 法人是否唯一受益人
    pub owner: Option<bool>,
    pub merchant_name: Option<String>,
    pub merchant_short_name: Option<String>,
    /// 店铺主页链接（`@NotBlank`）
    pub store_url: Option<String>,
    pub business_license_number: Option<String>,
    pub legal_person: Option<String>,
    pub license_period_begin: Option<String>,
    pub license_period_end: Option<String>,
    pub id_card_name: Option<String>,
    pub id_card_number: Option<String>,
    pub card_period_begin: Option<String>,
    pub card_period_end: Option<String>,
    pub service_phone: Option<String>,
    pub settlement_id: Option<String>,
    pub qualification_type: Option<String>,
    pub bank_account_type: Option<String>,
    pub bank_account_name: Option<String>,
    pub bank_account_number: Option<String>,
    pub bank_name: Option<String>,
    pub bank_branch_name: Option<String>,
    pub license_copy: Option<String>,
    pub id_card_copy: Option<String>,
    pub id_card_national: Option<String>,
    pub contact_type: Option<String>,
    pub contact_name: Option<String>,
    pub contact_id_number: Option<String>,
    pub contact_phone: Option<String>,
    pub contact_email: Option<String>,
}

/// 审核参数（Java `MerchantApplicationAuditParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MerchantApplicationAuditParam {
    /// 进件申请 ID
    pub id: Option<i64>,
    /// 驳回原因（reject 用）
    pub reject_reason: Option<String>,
}

/// 上传媒体返回（Java `Map.of("mediaId", mediaId)`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadMediaVO {
    pub media_id: String,
}

// ——————————————————————————————————————————————
// 出参 VO
// ——————————————————————————————————————————————

/// 进件申请 VO（Java `MerchantApplicationVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantApplicationVO {
    pub id: i64,
    pub shop_id: Option<i64>,
    pub shop_name: String,
    pub applicant_type: String,
    pub applicant_id: i64,
    pub applicant_name: String,
    pub pay_channel: String,
    pub business_code: String,
    pub applyment_id: Option<String>,
    pub status: String,
    pub status_desc: Option<String>,
    pub reject_reason: String,
    pub reason_label: String,
    /// MySQL DATETIME（`yyyy-MM-dd HH:mm:ss`）
    pub audit_time: Option<String>,
    pub sub_mch_id: Option<String>,
    pub sign_url: Option<String>,
    pub merchant_name: String,
    pub merchant_short_name: Option<String>,
    pub store_url: Option<String>,
    pub contact_name: String,
    pub contact_phone: String,
    pub organization_type: String,
    pub business_license_number: Option<String>,
    pub legal_person: Option<String>,
    pub bank_account_type: Option<String>,
    pub bank_account_name: Option<String>,
    pub bank_account_number: Option<String>,
    pub bank_name: Option<String>,
    pub bank_branch_name: Option<String>,
    pub request_snapshot: Option<String>,
    /// MySQL DATETIME
    pub create_time: String,
    /// MySQL DATETIME
    pub modify_time: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_desc_matches_java_and_wechat_codes() {
        assert_eq!(status_desc(Some("DRAFT")), Some("草稿"));
        assert_eq!(status_desc(Some("pending_review")), Some("待审核"));
        assert_eq!(status_desc(Some("REJECTED")), Some("已驳回"));
        assert_eq!(status_desc(Some("APPLYMENT_STATE_FINISHED")), Some("完成"));
        assert_eq!(
            status_desc(Some("APPLYMENT_STATE_TO_BE_SIGNED")),
            Some("待签约")
        );
        assert_eq!(status_desc(Some("UNKNOWN")), None);
        assert_eq!(status_desc(None), None);
    }

    #[test]
    fn reason_label_branches() {
        assert_eq!(reason_label(Some("REJECTED"), "资料不全"), "驳回原因");
        assert_eq!(reason_label(Some("REJECTED"), "   "), "");
        assert_eq!(reason_label(Some("DRAFT"), "渠道异常"), "失败原因");
        assert_eq!(reason_label(Some("DRAFT"), ""), "");
        assert_eq!(reason_label(None, ""), "");
    }

    #[test]
    fn channel_resolution() {
        assert_eq!(resolve_channel(None).unwrap(), CHANNEL_WECHAT);
        assert_eq!(resolve_channel(Some(" ")).unwrap(), CHANNEL_WECHAT);
        assert_eq!(resolve_channel(Some("huifu")).unwrap(), CHANNEL_HUIFU);
        assert_eq!(resolve_channel(Some("ALIPAY")).unwrap(), CHANNEL_ALIPAY);
        assert!(resolve_channel(Some("PAYPAL"))
            .unwrap_err()
            .contains("暂不支持的支付渠道"));
    }

    #[test]
    fn channel_error_reason_prefixes_detail() {
        assert_eq!(channel_error_reason(None), "进件渠道提交失败，请稍后重试");
        assert_eq!(
            channel_error_reason(Some(" 签名错误 ")),
            "进件渠道提交失败：签名错误"
        );
    }

    #[test]
    fn status_list_splits_and_trims() {
        let q = MerchantApplicationPageQuery {
            status_list: Some("DRAFT, PENDING_REVIEW ,,FINISH".into()),
            ..Default::default()
        };
        assert_eq!(
            q.status_values(),
            vec![
                "DRAFT".to_string(),
                "PENDING_REVIEW".to_string(),
                "FINISH".to_string()
            ]
        );
        assert!(MerchantApplicationPageQuery::default()
            .status_values()
            .is_empty());
    }

    #[test]
    fn page_query_paging() {
        let q = MerchantApplicationPageQuery::default();
        assert_eq!(q.limit_offset(), (15, 0));
        let q = MerchantApplicationPageQuery {
            page: Some(4),
            size: Some(200),
            ..Default::default()
        };
        assert_eq!(q.limit_offset(), (100, 300));
    }

    #[test]
    fn personal_detection_and_blanks() {
        assert!(is_personal(Some("2401")));
        assert!(!is_personal(Some("2")));
        assert!(!is_personal(None));
        assert!(is_blank(None));
        assert!(is_blank(Some("  ")));
        assert!(!is_blank(Some("x")));
    }
}
