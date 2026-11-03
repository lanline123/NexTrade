//! 业务模型 / DTO / 查询参数。
//!
//! 对应原 Java `tigshop-bean` 下的 `dto`、`param`、`query`、`vo` 包。
//! 命名保持与原接口 JSON 字段一致（camelCase，通过 serde rename 标注）。

pub use catalog::category_all::{
    BatchDTO, BrandVO, CategoryDTO, CategoryListQuery, CategoryTreeNode, MoveCatDTO, OperateDTO,
    UpdateFieldDTO,
};
pub use catalog::product::{ProductListQuery, ProductVO};
pub use content::article::{
    ArticleCategoryTreeNode, ArticleCategoryVO, ArticleDetailVO, ArticleListQuery, ArticleVO,
};
pub use content::decorate::{DecorateListQuery, DecorateVO};
pub use identity::auth::{LoginDTO, LoginVO, MobileLoginDTO};
pub use logistics::shipping_list::{ShippingTplListQuery, ShippingTplVO};
pub use marketing::coupon::{
    CouponClientVO, CouponListQuery, CouponStatusCountVO, CouponVO, UserCouponClaimDTO,
    UserCouponIdDTO, UserCouponListQuery, UserCouponStatus, UserCouponVO,
};
pub use marketing::salesman::{SalesmanListQuery, SalesmanVO};
pub use marketing::seckill::{
    SeckillCreateDTO, SeckillItemDTO, SeckillItemVO, SeckillListQuery, SeckillPromotionVO,
    SeckillStatus, SeckillUpdateDTO, SeckillVO,
};
pub use marketing::time_discount::{
    DiscountType, PromotionTimeStatus, TimeDiscountCreateDTO, TimeDiscountDetailVO,
    TimeDiscountItemDTO, TimeDiscountItemVO, TimeDiscountListQuery, TimeDiscountPromotionVO,
    TimeDiscountUpdateDTO,
};
pub use member::member_lists::{UserPointsLogQuery, UserRankVO};
pub use merchant::shop::{ShopListQuery, ShopVO};
pub use payment::paylog::{
    PayOrderType, PayStatus, PaylogCreateDTO, PaylogListQuery, PaylogRefundVO, PaylogUpdateDTO,
    PaylogVO, RefundStatus,
};
pub use payment::refund_apply::{
    OfflineAuditDTO, RefundApplyAuditDTO, RefundApplyCreateDTO, RefundApplyDetailVO,
    RefundApplyListQuery, RefundApplyStatus, RefundApplyUpdateDTO, RefundApplyVO, RefundLogVO,
    RefundType,
};
pub use trade::order::{OrderCreateDTO, OrderCreateVO, OrderVO};

pub mod analytics;
pub mod catalog;
pub mod content;
pub mod identity;
pub mod im;
pub mod lang;
pub mod logistics;
pub mod marketing;
pub mod member;
pub mod merchant;
pub mod o2o;
pub mod openapi;
pub mod payment;
pub mod pos;
pub mod serde_helpers;
pub mod system;
pub mod trade;
pub mod vendor;
pub mod wholesale;
