//! TigShop Rust 服务入口。
//!
//! 装配顺序（对应原 Spring Boot 启动流程）：
//! 1. 加载配置（config.yaml + TIG_* 环境变量）
//! 2. 初始化日志（Tracing，替代 logback.xml）
//! 3. 连接 MySQL（含 ONLY_FULL_GROUP_BY 兼容）+ 可选迁移
//! 4. 连接 Redis（失败降级为无缓存模式）
//! 5. 构建服务层与路由
//! 6. 同时启动管理端（8080）与商城端（8181）监听

use std::sync::Arc;

use std::time::Duration;

use tower_http::compression::{
    predicate::{DefaultPredicate, NotForContentType, Predicate},
    CompressionLayer,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use tigshop_admin_api::{router as admin_router, AdminState};
use tigshop_api::{router as public_router, PublicState};
use tigshop_common::{config::AppConfig, log, utils};
use tigshop_infrastructure::cache::CacheService;
use tigshop_infrastructure::db::{self, Repositories};
use tigshop_security::JwtService;
use tigshop_services::analytics::panel::PanelService;
use tigshop_services::analytics::sales_statistics::SalesStatisticsService;
use tigshop_services::analytics::statistics::StatisticsService;
use tigshop_services::catalog::attributes_tpl::AttributesTplService;
use tigshop_services::catalog::brand::BrandService;
use tigshop_services::catalog::category::CategoryService;
use tigshop_services::catalog::category_all::CatalogService;
use tigshop_services::catalog::comment::CommentService;
use tigshop_services::catalog::e_card::ECardService;
use tigshop_services::catalog::e_card_group::ECardGroupService;
use tigshop_services::catalog::exchange::ExchangeService;
use tigshop_services::catalog::price_inquiry::PriceInquiryService;
use tigshop_services::catalog::product::ProductService;
use tigshop_services::catalog::product_batch::ProductBatchService;
use tigshop_services::catalog::product_group::ProductGroupService;
use tigshop_services::catalog::product_inventory_log::ProductInventoryLogService;
use tigshop_services::catalog::product_manage::ProductManageService;
use tigshop_services::catalog::product_manage_client::ProductManageClientService;
use tigshop_services::catalog::product_manage_extra::ProductManageExtraService;
use tigshop_services::catalog::product_search::ProductSearchService;
use tigshop_services::catalog::product_stock::ProductStockService;
use tigshop_services::catalog::search_admin::SearchAdminService;
use tigshop_services::catalog::services::ServicesService;
use tigshop_services::catalog::short_url::ShortUrlService;
use tigshop_services::catalog::stock_warning::StockWarningService;
use tigshop_services::content::api_wechat_live::ApiWechatLiveService;
use tigshop_services::content::article::ContentService;
use tigshop_services::content::article_batch::ArticleBatchService;
use tigshop_services::content::article_category::ArticleCategoryService;
use tigshop_services::content::decorate::DecorateService;
use tigshop_services::content::decorate_promote::DecoratePromoteService;
use tigshop_services::content::decorate_template::DecorateTemplateService;
use tigshop_services::content::friend_links::FriendLinksService;
use tigshop_services::content::gallery::GalleryService;
use tigshop_services::content::gallery_pic::GalleryPicService;
use tigshop_services::content::gallery_video::GalleryVideoService;
use tigshop_services::content::gallery_video_info::GalleryVideoInfoService;
use tigshop_services::content::home::HomeService;
use tigshop_services::content::mobile_cat_nav::MobileCatNavService;
use tigshop_services::content::pc_cat_floor::PcCatFloorService;
use tigshop_services::content::pc_navigation::PcNavigationService;
use tigshop_services::content::seo::SeoService;
use tigshop_services::content::share::ShareService;
use tigshop_services::content::wechat_auto_reply::WechatAutoReplyService;
use tigshop_services::content::wechat_kefu_capability::WechatKefuCapabilityService;
use tigshop_services::content::wechat_keyword_rule::WechatKeywordRuleService;
use tigshop_services::content::wechat_live::WechatLiveService;
use tigshop_services::content::wechat_live_goods::WechatLiveGoodsService;
use tigshop_services::content::wechat_live_order_sync::WechatLiveOrderSyncService;
use tigshop_services::content::wechat_live_sync_callback::WechatLiveSyncCallbackService;
use tigshop_services::content::wechat_menu::WechatMenuService;
use tigshop_services::content::wechat_video_account::WechatVideoAccountService;
use tigshop_services::identity::admin_account::AdminAccountService;
use tigshop_services::identity::admin_log::AdminLogService;
use tigshop_services::identity::admin_role::AdminRoleService;
use tigshop_services::identity::admin_user::AdminUserService;
use tigshop_services::identity::auth::AuthService;
use tigshop_services::identity::authority::AuthorityService;
use tigshop_services::im::admin_shop_kefu_config::AdminShopKefuConfigService;
use tigshop_services::im::admin_user_kefu::AdminUserKefuService;
use tigshop_services::im::im_config::ImConfigService;
use tigshop_services::im::im_conversation::ImConversationService;
use tigshop_services::im::im_message::ImMessageService;
use tigshop_services::im::im_servant::ImServantService;
use tigshop_services::im::web_socket::WebSocketService;
use tigshop_services::logistics::logistics_company::LogisticsCompanyService;
use tigshop_services::logistics::logistics_company_config::LogisticsCompanyConfigService;
use tigshop_services::logistics::print::PrintService;
use tigshop_services::logistics::print_config::PrintConfigService;
use tigshop_services::logistics::print_log::PrintLogService;
use tigshop_services::logistics::shipping_list::LogisticsService;
use tigshop_services::logistics::shipping_tpl::ShippingTplService;
use tigshop_services::logistics::shipping_type::ShippingTypeService;
use tigshop_services::logistics::sunmi_print_callback::SunmiPrintCallbackService;
use tigshop_services::marketing::buyer_show::BuyerShowService;
use tigshop_services::marketing::buyer_show_client::BuyerShowClientService;
use tigshop_services::marketing::buyer_show_comment::BuyerShowCommentService;
use tigshop_services::marketing::buyer_show_group::BuyerShowGroupService;
use tigshop_services::marketing::coupon::CouponService;
use tigshop_services::marketing::coupon_manage::CouponManageService;
use tigshop_services::marketing::gift_card::GiftCardService;
use tigshop_services::marketing::gift_card_groups::GiftCardGroupsService;
use tigshop_services::marketing::groupon_promotion::GrouponPromotionService;
use tigshop_services::marketing::groupon_promotion_item::GrouponPromotionItemService;
use tigshop_services::marketing::groupon_promotion_record::GrouponPromotionRecordService;
use tigshop_services::marketing::groupon_records::GrouponRecordsService;
use tigshop_services::marketing::lottery::LotteryService;
use tigshop_services::marketing::lottery_activity::LotteryActivityService;
use tigshop_services::marketing::overview::OverviewService;
use tigshop_services::marketing::points_exchange::PointsExchangeService;
use tigshop_services::marketing::product_gift::ProductGiftService;
use tigshop_services::marketing::product_promotion::ProductPromotionService;
use tigshop_services::marketing::product_style_admin::ProductStyleAdminService;
use tigshop_services::marketing::promotion::PromotionService;
use tigshop_services::marketing::recharge_setting::RechargeSettingService;
use tigshop_services::marketing::salesman::SalesmanService;
use tigshop_services::marketing::salesman_admin::SalesmanAdminService;
use tigshop_services::marketing::salesman_config::SalesmanConfigService;
use tigshop_services::marketing::salesman_content::SalesmanContentService;
use tigshop_services::marketing::salesman_customer_transaction::SalesmanCustomerTransactionService;
use tigshop_services::marketing::salesman_group::SalesmanGroupService;
use tigshop_services::marketing::salesman_material::SalesmanMaterialService;
use tigshop_services::marketing::salesman_material_category::SalesmanMaterialCategoryService;
use tigshop_services::marketing::salesman_order::SalesmanOrderService;
use tigshop_services::marketing::salesman_product::SalesmanProductService;
use tigshop_services::marketing::seckill::SeckillService;
use tigshop_services::marketing::seckill_batch::SeckillBatchService;
use tigshop_services::marketing::sign_in_setting::SignInSettingService;
use tigshop_services::marketing::time_discount::TimeDiscountService;
use tigshop_services::marketing::time_discount_batch::TimeDiscountBatchService;
use tigshop_services::member::captcha_api::CaptchaService;
use tigshop_services::member::collect_product::CollectProductService;
use tigshop_services::member::feedback::FeedbackService;
use tigshop_services::member::login::LoginService;
use tigshop_services::member::member_audience::MemberAudienceService;
use tigshop_services::member::member_lists::MemberService;
use tigshop_services::member::member_tag::MemberTagService;
use tigshop_services::member::member_tag_group::MemberTagGroupService;
use tigshop_services::member::shop_member::ShopMemberService;
use tigshop_services::member::user::UserService;
use tigshop_services::member::user_address_client::UserAddressClientService;
use tigshop_services::member::user_center::UserCenterService;
use tigshop_services::member::user_company::UserCompanyService;
use tigshop_services::member::user_company_client::UserCompanyClientService;
use tigshop_services::member::user_feedback_client::UserFeedbackClientService;
use tigshop_services::member::user_invoice_client::UserInvoiceClientService;
use tigshop_services::member::user_manage::UserManageService;
use tigshop_services::member::user_member_tag::UserMemberTagService;
use tigshop_services::member::user_message::UserMessageService;
use tigshop_services::member::user_message_log::UserMessageLogService;
use tigshop_services::member::user_points_log::UserPointsLogService;
use tigshop_services::member::user_price_inquiry::UserPriceInquiryService;
use tigshop_services::member::user_rank::UserRankService;
use tigshop_services::member::user_sign::UserSignService;
use tigshop_services::merchant::admin_user_shop::AdminUserShopService;
use tigshop_services::merchant::deposit_account::DepositAccountService;
use tigshop_services::merchant::deposit_log::DepositLogService;
use tigshop_services::merchant::deposit_payee_account::DepositPayeeAccountService;
use tigshop_services::merchant::deposit_recharge::DepositRechargeService;
use tigshop_services::merchant::deposit_refund::DepositRefundService;
use tigshop_services::merchant::deposit_rule::DepositRuleService;
use tigshop_services::merchant::deposit_setting::DepositSettingService;
use tigshop_services::merchant::deposit_shop::DepositShopService;
use tigshop_services::merchant::merchant::MerchantService;
use tigshop_services::merchant::merchant_account::MerchantAccountService;
use tigshop_services::merchant::merchant_apply::MerchantApplyService;
use tigshop_services::merchant::merchant_client::MerchantClientService;
use tigshop_services::merchant::order_config::OrderConfigService;
use tigshop_services::merchant::shop::ShopService;
use tigshop_services::merchant::shop_account_log::ShopAccountLogService;
use tigshop_services::merchant::shop_client::ShopClientService;
use tigshop_services::merchant::shop_client_category::ShopClientCategoryService;
use tigshop_services::merchant::shop_funds::ShopFundsService;
use tigshop_services::merchant::shop_manage::ShopManageService;
use tigshop_services::merchant::shop_product_category::ShopProductCategoryService;
use tigshop_services::merchant::shop_withdraw::ShopWithdrawService;
use tigshop_services::merchant::vendor_deposit_shop::VendorDepositShopService;
use tigshop_services::openapi::workbuddy::WorkbuddyService;
use tigshop_services::payment::account_panel::AccountPanelService;
use tigshop_services::payment::apple_pay::ApplePayService;
use tigshop_services::payment::apple_pay_config::ApplePayConfigService;
use tigshop_services::payment::balance_pay::BalancePayService;
use tigshop_services::payment::category_fee_rule::CategoryFeeRuleService;
use tigshop_services::payment::credit_order::CreditOrderService;
use tigshop_services::payment::credit_settlement::CreditSettlementService;
use tigshop_services::payment::credit_user::CreditUserService;
use tigshop_services::payment::huifu_config::HuifuConfigService;
use tigshop_services::payment::lakala_config::LakalaConfigService;
use tigshop_services::payment::merchant_application::MerchantApplicationService;
use tigshop_services::payment::order_invoice::OrderInvoiceService;
use tigshop_services::payment::pay::PayService;
use tigshop_services::payment::paylog::PaylogService;
use tigshop_services::payment::paylog_batch::PaylogBatchService;
use tigshop_services::payment::profit_sharing::ProfitSharingService;
use tigshop_services::payment::recharge_order::RechargeOrderService;
use tigshop_services::payment::refund_apply::RefundApplyService;
use tigshop_services::payment::refund_apply_admin::RefundApplyAdminService;
use tigshop_services::payment::refund_log::RefundLogService;
use tigshop_services::payment::statement::StatementService;
use tigshop_services::payment::sub_merchant::SubMerchantService;
use tigshop_services::payment::tax_rate::TaxRateService;
use tigshop_services::payment::user_balance_log::UserBalanceLogService;
use tigshop_services::payment::user_invoice::UserInvoiceService;
use tigshop_services::payment::user_recharge_order::UserRechargeOrderService;
use tigshop_services::payment::user_withdraw_apply::UserWithdrawApplyService;
use tigshop_services::payment::with_draw_apply_client::WithDrawApplyClientService;
use tigshop_services::payment::yeepay_config::YeepayConfigService;
use tigshop_services::system::admin_msg::AdminMsgService;
use tigshop_services::system::app_version_admin::AppVersionAdminService;
use tigshop_services::system::area_code::AreaCodeService;
use tigshop_services::system::cache_manage::CacheManageService;
use tigshop_services::system::config_basic::ConfigBasicService;
use tigshop_services::system::config_client::ConfigClientService;
use tigshop_services::system::csrf::CsrfService;
use tigshop_services::system::example::ExampleService;
use tigshop_services::system::files::FilesService;
use tigshop_services::system::log::LogService;
use tigshop_services::system::mail_templates::MailTemplatesService;
use tigshop_services::system::message_type::MessageTypeService;
use tigshop_services::system::pc::PcService;
use tigshop_services::system::recommend::RecommendService;
use tigshop_services::system::region::RegionService;
use tigshop_services::system::region_client::RegionClientService;
use tigshop_services::system::tips_manage::TipsManageService;
use tigshop_services::system::util::UtilService;
use tigshop_services::trade::aftersales::AftersalesService;
use tigshop_services::trade::aftersales_client::AftersalesClientService;
use tigshop_services::trade::cart::CartService;
use tigshop_services::trade::cart_summary::CartSummaryService;
use tigshop_services::trade::check::CheckService;
use tigshop_services::trade::order::OrderService;
use tigshop_services::trade::order_admin::OrderAdminService;
use tigshop_services::trade::order_invoice_client::OrderInvoiceClientService;
use tigshop_services::trade::order_log::OrderLogService;
use tigshop_services::trade::proxy_shopping_cart::ProxyShoppingCartService;
use tigshop_services::trade::proxy_shopping_delivery::ProxyShoppingDeliveryService;
use tigshop_services::trade::proxy_shopping_order_check::ProxyShoppingOrderCheckService;
use tigshop_services::trade::proxy_shopping_pickup_contact::ProxyShoppingPickupContactService;
use tigshop_services::trade::proxy_shopping_product::ProxyShoppingProductService;
use tigshop_services::trade::proxy_shopping_user::ProxyShoppingUserService;
use tigshop_services::trade::proxy_shopping_user_address::ProxyShoppingUserAddressService;
use tigshop_services::trade::proxy_shopping_user_coupon::ProxyShoppingUserCouponService;
use tigshop_services::trade::shop_order_config::ShopOrderConfigService;
use tigshop_services::trade::user_order::UserOrderService;
use tigshop_services::wholesale::wholesale_client::WholesaleClientService;
use tigshop_services::wholesale::wholesale_product::WholesaleProductService;
use tigshop_services::wholesale::wholesale_setting::WholesaleSettingService;
use tigshop_services::wholesale::wholesaler::WholesalerService;
use tigshop_services::wholesale::wholesaler_grade::WholesalerGradeService;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. 配置
    let cfg = AppConfig::load()?;

    // 2. 日志
    log::init("logs");
    tracing::info!("TigShop Rust 服务启动中...");

    // 3. 数据库（最多重试 10 次，兼容 docker-compose 中 MySQL 慢启动）
    let pool = {
        let mut attempt = 0;
        loop {
            match db::init_pool(&cfg).await {
                Ok(p) => break p,
                Err(e) if attempt < 10 => {
                    attempt += 1;
                    tracing::warn!("数据库连接失败（第 {attempt} 次）: {e}，2 秒后重试");
                    tokio::time::sleep(Duration::from_secs(2)).await;
                }
                Err(e) => return Err(e),
            }
        }
    };

    // 可选：执行 migrations/
    if cfg.datasource.auto_migrate {
        db::run_migrations(&pool, "migrations").await?;
    }

    // 4. Redis（失败降级，不阻断启动）
    let cache = match CacheService::init(&cfg.redis.url()).await {
        Ok(c) => Some(c),
        Err(e) => {
            tracing::warn!("Redis 不可用，降级为无缓存模式: {e}");
            None
        }
    };

    // 5. 装配服务
    let repos = Arc::new(Repositories::new(pool));
    // 对象存储：优先 Java 后台存储设置（config 表），缺失时回退 config.yaml/env。
    tigshop_infrastructure::storage::init_storage_from_repos(&repos, &cfg.storage).await;
    let jwt = Arc::new(JwtService::new(cfg.jwt.clone()));
    let auth = Arc::new(AuthService::new(
        repos.clone(),
        jwt.clone(),
        cfg.jwt.clone(),
        cache.clone(),
    ));
    let product = Arc::new(ProductService::new(repos.clone(), cache.clone()));
    let cart = Arc::new(CartService::new(repos.clone(), (*product).clone()));
    let order = Arc::new(OrderService::new(
        repos.clone(),
        (*product).clone(),
        (*cart).clone(),
    ));
    let user = Arc::new(UserService::new(repos.clone()));
    let coupon = Arc::new(CouponService::new(repos.clone()));
    let article = Arc::new(ContentService::new(repos.clone()));
    let category_all = Arc::new(CatalogService::new(repos.clone()));
    let shipping_list = Arc::new(LogisticsService::new(repos.clone()));
    let member_lists = Arc::new(MemberService::new(repos.clone()));
    let seckill = Arc::new(SeckillService::new(repos.clone()));
    let time_discount = Arc::new(TimeDiscountService::new(repos.clone()));
    let paylog = Arc::new(PaylogService::new(repos.clone()));
    let refund_apply = Arc::new(RefundApplyService::new(repos.clone()));
    let balance_pay = Arc::new(BalancePayService::new(repos.clone()));
    let product_manage = Arc::new(ProductManageService::new(repos.clone()));
    let statistics = Arc::new(StatisticsService::new(repos.clone()));
    let merchant_client = Arc::new(MerchantClientService::new(repos.clone()));
    let user_rank = Arc::new(UserRankService::new(repos.clone()));
    let feedback = Arc::new(FeedbackService::new(repos.clone()));
    let vendor_deposit_shop = Arc::new(VendorDepositShopService::new(repos.clone()));
    let member_tag_group = Arc::new(MemberTagGroupService::new(repos.clone()));
    let shipping_type = Arc::new(ShippingTypeService::new(repos.clone()));
    let config_client = Arc::new(ConfigClientService::new(repos.clone()));
    let tax_rate = Arc::new(TaxRateService::new(repos.clone()));
    let example = Arc::new(ExampleService::new(repos.clone()));
    let workbuddy = Arc::new(WorkbuddyService::new(repos.clone()));
    let shop_product_category = Arc::new(ShopProductCategoryService::new(repos.clone()));
    let product_style_admin = Arc::new(ProductStyleAdminService::new(repos.clone()));
    let member_tag = Arc::new(MemberTagService::new(repos.clone()));
    let user_company = Arc::new(UserCompanyService::new(repos.clone()));
    let mobile_cat_nav = Arc::new(MobileCatNavService::new(repos.clone()));
    let logistics_company = Arc::new(LogisticsCompanyService::new(repos.clone()));
    let shipping_tpl = Arc::new(ShippingTplService::new(repos.clone()));
    let order_config = Arc::new(OrderConfigService::new(repos.clone()));
    let region = Arc::new(RegionService::new(repos.clone()));
    let attributes_tpl = Arc::new(AttributesTplService::new(repos.clone()));
    // proxy_shopping_product 需要 product_manage 作为依赖，只在此处构造一次
    // （此前被注册工具重复插入 4 次，其中 3 次参数个数错误）。
    let proxy_shopping_product = Arc::new(ProxyShoppingProductService::new(
        repos.clone(),
        product_manage.clone(),
    ));
    let share = Arc::new(ShareService::new(repos.clone()));
    let salesman_material_category = Arc::new(SalesmanMaterialCategoryService::new(repos.clone()));
    let logistics_company_config = Arc::new(LogisticsCompanyConfigService::new(repos.clone()));
    let message_type = Arc::new(MessageTypeService::new(repos.clone()));
    let region_client = Arc::new(RegionClientService::new(repos.clone()));
    let area_code = Arc::new(AreaCodeService::new(repos.clone()));
    let mail_templates = Arc::new(MailTemplatesService::new(repos.clone()));
    let print_config = Arc::new(PrintConfigService::new(repos.clone()));
    let cache_manage = Arc::new(CacheManageService::new(repos.clone()));
    let admin_log = Arc::new(AdminLogService::new(repos.clone()));
    let user_balance_log = Arc::new(UserBalanceLogService::new(repos.clone()));
    let web_socket = Arc::new(WebSocketService::new(repos.clone()));
    let wechat_live_sync_callback = Arc::new(WechatLiveSyncCallbackService::new(repos.clone()));
    let shop_client_category = Arc::new(ShopClientCategoryService::new(repos.clone()));
    let sunmi_print_callback = Arc::new(SunmiPrintCallbackService::new(repos.clone()));
    let user_points_log = Arc::new(UserPointsLogService::new(repos.clone()));
    let proxy_shopping_order_check = Arc::new(ProxyShoppingOrderCheckService::new(repos.clone()));
    let proxy_shopping_pickup_contact =
        Arc::new(ProxyShoppingPickupContactService::new(repos.clone()));
    let proxy_shopping_user_address = Arc::new(ProxyShoppingUserAddressService::new(repos.clone()));
    let proxy_shopping_user_coupon = Arc::new(ProxyShoppingUserCouponService::new(repos.clone()));
    let proxy_shopping_user = Arc::new(ProxyShoppingUserService::new(repos.clone()));
    let paylog_batch = Arc::new(PaylogBatchService::new(repos.clone()));
    let short_url = Arc::new(ShortUrlService::new(repos.clone()));
    let im_message = Arc::new(ImMessageService::new(repos.clone()));
    let files = Arc::new(FilesService::new(repos.clone()));
    let im_servant = Arc::new(ImServantService::new(repos.clone()));
    let buyer_show_comment = Arc::new(BuyerShowCommentService::new(repos.clone()));
    let buyer_show = Arc::new(BuyerShowService::new(repos.clone()));
    let buyer_show_group = Arc::new(BuyerShowGroupService::new(repos.clone()));
    let buyer_show_client = Arc::new(BuyerShowClientService::new(repos.clone()));
    let seo = Arc::new(SeoService::new(repos.clone()));
    let im_config = Arc::new(ImConfigService::new(repos.clone()));
    let app_version_admin = Arc::new(AppVersionAdminService::new(repos.clone()));
    let pc_navigation = Arc::new(PcNavigationService::new(repos.clone()));
    let pc_cat_floor = Arc::new(PcCatFloorService::new(repos.clone()));
    let pc = Arc::new(PcService::new(repos.clone()));
    let wholesale_client = Arc::new(WholesaleClientService::new(repos.clone()));
    let order_admin = Arc::new(OrderAdminService::new(repos.clone()));
    let product_stock = Arc::new(ProductStockService::new(repos.clone()));
    let category = Arc::new(CategoryService::new(repos.clone()));
    let brand = Arc::new(BrandService::new(repos.clone()));
    let stock_warning = Arc::new(StockWarningService::new(repos.clone()));
    let user_center = Arc::new(UserCenterService::new(repos.clone()));
    let aftersales = Arc::new(AftersalesService::new(repos.clone()));
    let aftersales_client = Arc::new(AftersalesClientService::new(repos.clone()));
    let authority = Arc::new(AuthorityService::new(repos.clone()));
    let admin_user = Arc::new(AdminUserService::new(repos.clone()));
    let user_manage = Arc::new(UserManageService::new(repos.clone()));
    let shop_client = Arc::new(ShopClientService::new(repos.clone()));
    // O2O 开关由 `ShopManageService::new` 内部从环境变量 `TIG_IS_O2O` 读取
    // （对应原 Java `tigshopProperties.isO2o()`，配置服务未迁移）。
    let shop_manage = Arc::new(ShopManageService::new(repos.clone()));
    let shop = Arc::new(ShopService::new(repos.clone()));
    let decorate = Arc::new(DecorateService::new(repos.clone()));
    let salesman = Arc::new(SalesmanService::new(repos.clone()));

    let admin_role = Arc::new(AdminRoleService::new(repos.clone()));
    let admin_account = Arc::new(AdminAccountService::new(repos.clone()));
    // ---- identity 域 ----
    let permission =
        Arc::new(tigshop_services::identity::permission::PermissionService::new(repos.clone()));
    let identity = Arc::new(tigshop_services::identity::Services {
        admin_log: admin_log.clone(),
        admin_user: admin_user.clone(),
        auth: auth.clone(),
        authority: authority.clone(),
        admin_role: admin_role.clone(),
        admin_account: admin_account.clone(),
        permission: permission.clone(),
    });
    let merchant_apply = Arc::new(MerchantApplyService::new(repos.clone()));
    let deposit_account = Arc::new(DepositAccountService::new(repos.clone()));
    let deposit_recharge = Arc::new(DepositRechargeService::new(repos.clone()));
    let deposit_refund = Arc::new(DepositRefundService::new(repos.clone()));
    let shop_funds = Arc::new(ShopFundsService::new(repos.clone()));
    let admin_user_shop = Arc::new(AdminUserShopService::new(repos.clone()));
    let merchant_account = Arc::new(MerchantAccountService::new(repos.clone()));
    let shop_withdraw = Arc::new(ShopWithdrawService::new(repos.clone()));
    let deposit_rule = Arc::new(DepositRuleService::new(repos.clone()));
    let deposit_shop = Arc::new(DepositShopService::new(repos.clone()));
    let deposit_log = Arc::new(DepositLogService::new(repos.clone()));
    let deposit_payee_account = Arc::new(DepositPayeeAccountService::new(repos.clone()));
    let deposit_setting = Arc::new(DepositSettingService::new(repos.clone()));
    let shop_account_log = Arc::new(ShopAccountLogService::new(repos.clone()));
    // ---- merchant 域 ----
    let merchant_admin = Arc::new(MerchantService::new(repos.clone()));
    let merchant = Arc::new(tigshop_services::merchant::Services {
        merchant_client: merchant_client.clone(),
        order_config: order_config.clone(),
        shop: shop.clone(),
        shop_client: shop_client.clone(),
        shop_client_category: shop_client_category.clone(),
        shop_manage: shop_manage.clone(),
        shop_product_category: shop_product_category.clone(),
        vendor_deposit_shop: vendor_deposit_shop.clone(),
        merchant_apply: merchant_apply.clone(),
        deposit_account: deposit_account.clone(),
        deposit_recharge: deposit_recharge.clone(),
        deposit_refund: deposit_refund.clone(),
        merchant: merchant_admin.clone(),
        shop_funds: shop_funds.clone(),
        admin_user_shop: admin_user_shop.clone(),
        merchant_account: merchant_account.clone(),
        shop_withdraw: shop_withdraw.clone(),
        deposit_rule: deposit_rule.clone(),
        deposit_shop: deposit_shop.clone(),
        deposit_log: deposit_log.clone(),
        deposit_payee_account: deposit_payee_account.clone(),
        deposit_setting: deposit_setting.clone(),
        shop_account_log: shop_account_log.clone(),
    });
    let wholesale_setting = Arc::new(WholesaleSettingService::new(repos.clone()));
    let wholesaler_grade = Arc::new(WholesalerGradeService::new(repos.clone()));
    let wholesaler = Arc::new(WholesalerService::new(repos.clone()));
    let wholesale_product = Arc::new(WholesaleProductService::new(repos.clone()));
    // ---- wholesale 域 ----
    let wholesale = Arc::new(tigshop_services::wholesale::Services {
        wholesale_client: wholesale_client.clone(),
        wholesale_setting: wholesale_setting.clone(),
        wholesaler_grade: wholesaler_grade.clone(),
        wholesaler: wholesaler.clone(),
        wholesale_product: wholesale_product.clone(),
    });
    let comment = Arc::new(CommentService::new(repos.clone()));
    let price_inquiry = Arc::new(PriceInquiryService::new(repos.clone()));
    let product_group = Arc::new(ProductGroupService::new(repos.clone()));
    let e_card_group = Arc::new(ECardGroupService::new(repos.clone()));
    let e_card = Arc::new(ECardService::new(repos.clone()));
    let product_batch = Arc::new(ProductBatchService::new(repos.clone()));
    let search_admin = Arc::new(SearchAdminService::new(repos.clone()));
    let product_inventory_log = Arc::new(ProductInventoryLogService::new(repos.clone()));
    let product_search = Arc::new(ProductSearchService::new(repos.clone()));
    let services = Arc::new(ServicesService::new(repos.clone()));
    let exchange = Arc::new(ExchangeService::new(repos.clone()));
    let product_manage_extra = Arc::new(ProductManageExtraService::new(repos.clone()));
    let product_manage_client = Arc::new(ProductManageClientService::new(repos.clone()));
    // ---- catalog 域 ----
    let catalog = Arc::new(tigshop_services::catalog::Services {
        attributes_tpl: attributes_tpl.clone(),
        brand: brand.clone(),
        category: category.clone(),
        category_all: category_all.clone(),
        product: product.clone(),
        product_manage: product_manage.clone(),
        product_stock: product_stock.clone(),
        short_url: short_url.clone(),
        stock_warning: stock_warning.clone(),
        comment: comment.clone(),
        price_inquiry: price_inquiry.clone(),
        product_group: product_group.clone(),
        e_card_group: e_card_group.clone(),
        e_card: e_card.clone(),
        product_batch: product_batch.clone(),
        search_admin: search_admin.clone(),
        product_inventory_log: product_inventory_log.clone(),
        product_search: product_search.clone(),
        services: services.clone(),
        exchange: exchange.clone(),
        product_manage_extra: product_manage_extra.clone(),
        product_manage_client: product_manage_client.clone(),
    });
    let user_order = Arc::new(UserOrderService::new(repos.clone()));
    let proxy_shopping_cart = Arc::new(ProxyShoppingCartService::new(repos.clone()));
    let check = Arc::new(CheckService::new(repos.clone()));
    let order_log = Arc::new(OrderLogService::new(repos.clone()));
    let order_invoice_client = Arc::new(OrderInvoiceClientService::new(repos.clone()));
    let cart_summary = Arc::new(CartSummaryService::new(repos.clone()));
    let proxy_shopping_delivery = Arc::new(ProxyShoppingDeliveryService::new(repos.clone()));
    let shop_order_config = Arc::new(ShopOrderConfigService::new(repos.clone()));
    // ---- trade 域 ----
    let trade = Arc::new(tigshop_services::trade::Services {
        aftersales: aftersales.clone(),
        aftersales_client: aftersales_client.clone(),
        cart: cart.clone(),
        order: order.clone(),
        order_admin: order_admin.clone(),
        proxy_shopping_order_check: proxy_shopping_order_check.clone(),
        proxy_shopping_pickup_contact: proxy_shopping_pickup_contact.clone(),
        proxy_shopping_product: proxy_shopping_product.clone(),
        proxy_shopping_user: proxy_shopping_user.clone(),
        proxy_shopping_user_address: proxy_shopping_user_address.clone(),
        proxy_shopping_user_coupon: proxy_shopping_user_coupon.clone(),
        user_order: user_order.clone(),
        proxy_shopping_cart: proxy_shopping_cart.clone(),
        check: check.clone(),
        order_log: order_log.clone(),
        order_invoice_client: order_invoice_client.clone(),
        cart_summary: cart_summary.clone(),
        proxy_shopping_delivery: proxy_shopping_delivery.clone(),
        shop_order_config: shop_order_config.clone(),
    });
    let merchant_application = Arc::new(MerchantApplicationService::new(repos.clone()));
    let category_fee_rule = Arc::new(CategoryFeeRuleService::new(repos.clone()));
    let order_invoice = Arc::new(OrderInvoiceService::new(repos.clone()));
    let with_draw_apply_client = Arc::new(WithDrawApplyClientService::new(repos.clone()));
    let refund_log = Arc::new(RefundLogService::new(repos.clone()));
    let credit_settlement = Arc::new(CreditSettlementService::new(repos.clone()));
    let user_invoice = Arc::new(UserInvoiceService::new(repos.clone()));
    let credit_user = Arc::new(CreditUserService::new(repos.clone()));
    let user_recharge_order = Arc::new(UserRechargeOrderService::new(repos.clone()));
    let user_withdraw_apply = Arc::new(UserWithdrawApplyService::new(repos.clone()));
    let pay = Arc::new(PayService::new(repos.clone()));
    let sub_merchant = Arc::new(SubMerchantService::new(repos.clone()));
    let profit_sharing = Arc::new(ProfitSharingService::new(repos.clone()));
    let recharge_order = Arc::new(RechargeOrderService::new(repos.clone()));
    let statement = Arc::new(StatementService::new(repos.clone()));
    let apple_pay = Arc::new(ApplePayService::new(repos.clone()));
    let apple_pay_config = Arc::new(ApplePayConfigService::new(repos.clone()));
    let huifu_config = Arc::new(HuifuConfigService::new(repos.clone()));
    let lakala_config = Arc::new(LakalaConfigService::new(repos.clone()));
    let yeepay_config = Arc::new(YeepayConfigService::new(repos.clone()));
    let refund_apply_admin = Arc::new(RefundApplyAdminService::new(repos.clone()));
    let account_panel = Arc::new(AccountPanelService::new(repos.clone()));
    let credit_order = Arc::new(CreditOrderService::new(repos.clone()));
    // ---- payment 域 ----
    let payment = Arc::new(tigshop_services::payment::Services {
        balance_pay: balance_pay.clone(),
        paylog: paylog.clone(),
        paylog_batch: paylog_batch.clone(),
        refund_apply: refund_apply.clone(),
        tax_rate: tax_rate.clone(),
        user_balance_log: user_balance_log.clone(),
        merchant_application: merchant_application.clone(),
        category_fee_rule: category_fee_rule.clone(),
        order_invoice: order_invoice.clone(),
        with_draw_apply_client: with_draw_apply_client.clone(),
        refund_log: refund_log.clone(),
        credit_settlement: credit_settlement.clone(),
        user_invoice: user_invoice.clone(),
        credit_user: credit_user.clone(),
        user_recharge_order: user_recharge_order.clone(),
        user_withdraw_apply: user_withdraw_apply.clone(),
        pay: pay.clone(),
        sub_merchant: sub_merchant.clone(),
        profit_sharing: profit_sharing.clone(),
        recharge_order: recharge_order.clone(),
        statement: statement.clone(),
        apple_pay: apple_pay.clone(),
        apple_pay_config: apple_pay_config.clone(),
        huifu_config: huifu_config.clone(),
        lakala_config: lakala_config.clone(),
        yeepay_config: yeepay_config.clone(),
        refund_apply_admin: refund_apply_admin.clone(),
        account_panel: account_panel.clone(),
        credit_order: credit_order.clone(),
    });
    let groupon_promotion = Arc::new(GrouponPromotionService::new(repos.clone()));
    let coupon_manage = Arc::new(CouponManageService::new(repos.clone()));
    let salesman_content = Arc::new(SalesmanContentService::new(repos.clone()));
    let gift_card = Arc::new(GiftCardService::new(repos.clone()));
    let gift_card_groups = Arc::new(GiftCardGroupsService::new(repos.clone()));
    let salesman_admin = Arc::new(SalesmanAdminService::new(repos.clone()));
    let lottery_activity = Arc::new(LotteryActivityService::new(repos.clone()));
    let salesman_product = Arc::new(SalesmanProductService::new(repos.clone()));
    let product_promotion = Arc::new(ProductPromotionService::new(repos.clone()));
    let groupon_promotion_item = Arc::new(GrouponPromotionItemService::new(repos.clone()));
    let time_discount_batch = Arc::new(TimeDiscountBatchService::new(repos.clone()));
    let points_exchange = Arc::new(PointsExchangeService::new(repos.clone()));
    let product_gift = Arc::new(ProductGiftService::new(repos.clone()));
    let recharge_setting = Arc::new(RechargeSettingService::new(repos.clone()));
    let sign_in_setting = Arc::new(SignInSettingService::new(repos.clone()));
    let salesman_material = Arc::new(SalesmanMaterialService::new(repos.clone()));
    let salesman_group = Arc::new(SalesmanGroupService::new(repos.clone()));
    let salesman_config = Arc::new(SalesmanConfigService::new(repos.clone()));
    let salesman_order = Arc::new(SalesmanOrderService::new(repos.clone()));
    let salesman_customer_transaction =
        Arc::new(SalesmanCustomerTransactionService::new(repos.clone()));
    let lottery = Arc::new(LotteryService::new(repos.clone()));
    let seckill_batch = Arc::new(SeckillBatchService::new(repos.clone()));
    let promotion = Arc::new(PromotionService::new(repos.clone()));
    let groupon_promotion_record = Arc::new(GrouponPromotionRecordService::new(repos.clone()));
    let groupon_records = Arc::new(GrouponRecordsService::new(repos.clone()));
    let overview = Arc::new(OverviewService::new(repos.clone()));
    // ---- marketing 域 ----
    let marketing = Arc::new(tigshop_services::marketing::Services {
        buyer_show: buyer_show.clone(),
        buyer_show_client: buyer_show_client.clone(),
        buyer_show_comment: buyer_show_comment.clone(),
        buyer_show_group: buyer_show_group.clone(),
        coupon: coupon.clone(),
        product_style_admin: product_style_admin.clone(),
        salesman: salesman.clone(),
        salesman_material_category: salesman_material_category.clone(),
        seckill: seckill.clone(),
        time_discount: time_discount.clone(),
        groupon_promotion: groupon_promotion.clone(),
        coupon_manage: coupon_manage.clone(),
        salesman_content: salesman_content.clone(),
        gift_card: gift_card.clone(),
        gift_card_groups: gift_card_groups.clone(),
        salesman_admin: salesman_admin.clone(),
        lottery_activity: lottery_activity.clone(),
        salesman_product: salesman_product.clone(),
        product_promotion: product_promotion.clone(),
        groupon_promotion_item: groupon_promotion_item.clone(),
        time_discount_batch: time_discount_batch.clone(),
        points_exchange: points_exchange.clone(),
        product_gift: product_gift.clone(),
        recharge_setting: recharge_setting.clone(),
        sign_in_setting: sign_in_setting.clone(),
        salesman_material: salesman_material.clone(),
        salesman_group: salesman_group.clone(),
        salesman_config: salesman_config.clone(),
        salesman_order: salesman_order.clone(),
        salesman_customer_transaction: salesman_customer_transaction.clone(),
        lottery: lottery.clone(),
        seckill_batch: seckill_batch.clone(),
        promotion: promotion.clone(),
        groupon_promotion_record: groupon_promotion_record.clone(),
        groupon_records: groupon_records.clone(),
        overview: overview.clone(),
    });
    let login = Arc::new(LoginService::new(repos.clone(), cache.clone(), jwt.clone()));
    let shop_member = Arc::new(ShopMemberService::new(repos.clone()));
    let user_address_client = Arc::new(UserAddressClientService::new(repos.clone()));
    let user_message = Arc::new(UserMessageService::new(repos.clone()));
    let user_member_tag = Arc::new(UserMemberTagService::new(repos.clone()));
    let user_message_log = Arc::new(UserMessageLogService::new(repos.clone()));
    let captcha_api = Arc::new(CaptchaService::new(repos.clone()));
    let collect_product = Arc::new(CollectProductService::new(repos.clone()));
    let user_company_client = Arc::new(UserCompanyClientService::new(repos.clone()));
    let user_invoice_client = Arc::new(UserInvoiceClientService::new(repos.clone()));
    let user_price_inquiry = Arc::new(UserPriceInquiryService::new(repos.clone()));
    let member_audience = Arc::new(MemberAudienceService::new(repos.clone()));
    let user_feedback_client = Arc::new(UserFeedbackClientService::new(repos.clone()));
    let user_sign = Arc::new(UserSignService::new(repos.clone()));
    // ---- member 域 ----
    let member = Arc::new(tigshop_services::member::Services {
        feedback: feedback.clone(),
        member_lists: member_lists.clone(),
        member_tag: member_tag.clone(),
        member_tag_group: member_tag_group.clone(),
        user: user.clone(),
        user_center: user_center.clone(),
        user_company: user_company.clone(),
        user_manage: user_manage.clone(),
        user_points_log: user_points_log.clone(),
        user_rank: user_rank.clone(),
        login: login.clone(),
        shop_member: shop_member.clone(),
        user_address_client: user_address_client.clone(),
        user_message: user_message.clone(),
        user_member_tag: user_member_tag.clone(),
        user_message_log: user_message_log.clone(),
        captcha_api: captcha_api.clone(),
        collect_product: collect_product.clone(),
        user_company_client: user_company_client.clone(),
        user_invoice_client: user_invoice_client.clone(),
        user_price_inquiry: user_price_inquiry.clone(),
        member_audience: member_audience.clone(),
        user_feedback_client: user_feedback_client.clone(),
        user_sign: user_sign.clone(),
    });
    let print = Arc::new(PrintService::new(repos.clone()));
    let print_log = Arc::new(PrintLogService::new(repos.clone()));
    // ---- logistics 域 ----
    let logistics = Arc::new(tigshop_services::logistics::Services {
        logistics_company: logistics_company.clone(),
        logistics_company_config: logistics_company_config.clone(),
        print_config: print_config.clone(),
        shipping_list: shipping_list.clone(),
        shipping_tpl: shipping_tpl.clone(),
        shipping_type: shipping_type.clone(),
        sunmi_print_callback: sunmi_print_callback.clone(),
        print: print.clone(),
        print_log: print_log.clone(),
    });
    let home = Arc::new(HomeService::new(repos.clone()));
    let wechat_live = Arc::new(WechatLiveService::new(repos.clone()));
    let gallery = Arc::new(GalleryService::new(repos.clone()));
    let gallery_pic = Arc::new(GalleryPicService::new(repos.clone()));
    let friend_links = Arc::new(FriendLinksService::new(repos.clone()));
    let gallery_video = Arc::new(GalleryVideoService::new(repos.clone()));
    let wechat_auto_reply = Arc::new(WechatAutoReplyService::new(repos.clone()));
    let article_batch = Arc::new(ArticleBatchService::new(repos.clone()));
    let article_category = Arc::new(ArticleCategoryService::new(repos.clone()));
    let decorate_template = Arc::new(DecorateTemplateService::new(repos.clone()));
    let wechat_live_goods = Arc::new(WechatLiveGoodsService::new(repos.clone()));
    let wechat_live_order_sync = Arc::new(WechatLiveOrderSyncService::new(repos.clone()));
    let api_wechat_live = Arc::new(ApiWechatLiveService::new(repos.clone()));
    let decorate_promote = Arc::new(DecoratePromoteService::new(repos.clone()));
    let gallery_video_info = Arc::new(GalleryVideoInfoService::new(repos.clone()));
    let wechat_video_account = Arc::new(WechatVideoAccountService::new(repos.clone()));
    let wechat_keyword_rule = Arc::new(WechatKeywordRuleService::new(repos.clone()));
    let wechat_menu = Arc::new(WechatMenuService::new(repos.clone()));
    let wechat_kefu_capability = Arc::new(WechatKefuCapabilityService::new(repos.clone()));
    // ---- content 域 ----
    let content = Arc::new(tigshop_services::content::Services {
        article: article.clone(),
        decorate: decorate.clone(),
        mobile_cat_nav: mobile_cat_nav.clone(),
        pc_cat_floor: pc_cat_floor.clone(),
        pc_navigation: pc_navigation.clone(),
        seo: seo.clone(),
        share: share.clone(),
        wechat_live_sync_callback: wechat_live_sync_callback.clone(),
        home: home.clone(),
        wechat_live: wechat_live.clone(),
        gallery: gallery.clone(),
        gallery_pic: gallery_pic.clone(),
        friend_links: friend_links.clone(),
        gallery_video: gallery_video.clone(),
        wechat_auto_reply: wechat_auto_reply.clone(),
        article_batch: article_batch.clone(),
        article_category: article_category.clone(),
        decorate_template: decorate_template.clone(),
        wechat_live_goods: wechat_live_goods.clone(),
        wechat_live_order_sync: wechat_live_order_sync.clone(),
        api_wechat_live: api_wechat_live.clone(),
        decorate_promote: decorate_promote.clone(),
        gallery_video_info: gallery_video_info.clone(),
        wechat_video_account: wechat_video_account.clone(),
        wechat_keyword_rule: wechat_keyword_rule.clone(),
        wechat_menu: wechat_menu.clone(),
        wechat_kefu_capability: wechat_kefu_capability.clone(),
    });
    let csrf = Arc::new(CsrfService::new(cache.clone()));
    let config_basic = Arc::new(ConfigBasicService::new(repos.clone()));
    let tips_manage = Arc::new(TipsManageService::new(repos.clone()));
    let log = Arc::new(LogService::new(repos.clone()));
    let util = Arc::new(UtilService::new(repos.clone()));
    let admin_msg = Arc::new(AdminMsgService::new(repos.clone()));
    let recommend = Arc::new(RecommendService::new(repos.clone()));
    // ---- system 域 ----
    let locales_svc = Arc::new(tigshop_services::system::locales::LocalesService::new(
        repos.clone(),
    ));
    let system = Arc::new(tigshop_services::system::Services {
        locales: locales_svc.clone(),
        app_version_admin: app_version_admin.clone(),
        area_code: area_code.clone(),
        cache_manage: cache_manage.clone(),
        config_client: config_client.clone(),
        example: example.clone(),
        files: files.clone(),
        mail_templates: mail_templates.clone(),
        message_type: message_type.clone(),
        pc: pc.clone(),
        region: region.clone(),
        region_client: region_client.clone(),
        csrf: csrf.clone(),
        config_basic: config_basic.clone(),
        tips_manage: tips_manage.clone(),
        log: log.clone(),
        util: util.clone(),
        admin_msg: admin_msg.clone(),
        recommend: recommend.clone(),
    });
    let im_conversation = Arc::new(ImConversationService::new(repos.clone()));
    let admin_user_kefu = Arc::new(AdminUserKefuService::new(repos.clone()));
    let admin_shop_kefu_config = Arc::new(AdminShopKefuConfigService::new(repos.clone()));
    // ---- im 域 ----
    let im = Arc::new(tigshop_services::im::Services {
        im_config: im_config.clone(),
        im_message: im_message.clone(),
        im_servant: im_servant.clone(),
        web_socket: web_socket.clone(),
        im_conversation: im_conversation.clone(),
        admin_user_kefu: admin_user_kefu.clone(),
        admin_shop_kefu_config: admin_shop_kefu_config.clone(),
    });
    let panel = Arc::new(PanelService::new(repos.clone()));
    let sales_statistics = Arc::new(SalesStatisticsService::new(repos.clone()));
    // ---- analytics 域 ----
    let analytics = Arc::new(tigshop_services::analytics::Services {
        statistics: statistics.clone(),
        panel: panel.clone(),
        sales_statistics: sales_statistics.clone(),
    });
    // ---- openapi 域 ----
    let openapi = Arc::new(tigshop_services::openapi::Services {
        workbuddy: workbuddy.clone(),
    });

    // ---- lang 域（多语言业务翻译） ----
    let translations =
        Arc::new(tigshop_services::lang::translations::TranslationsService::new(repos.clone()));
    let lang = Arc::new(tigshop_services::lang::Services {
        translations: translations.clone(),
    });

    // ---- 定时任务（替代 Java RabbitMQ 延迟队列 / Spring @Scheduled）----
    if std::env::var("TIG_SCHEDULER__ENABLED").map_or(true, |v| v != "false" && v != "0") {
        tigshop_services::system::scheduler::spawn_all(repos.clone(), (*order).clone());
        tracing::info!("定时任务已启动：订单超时取消（每分钟）/ 自动收货（每 5 分钟）");
    }

    // ---- vendor / pos / o2o 域（供应商管理 / 收银设备 / 本地生活） ----
    let vendor_service = Arc::new(tigshop_services::vendor::vendor::VendorService::new(
        repos.clone(),
    ));
    let vendor_product_service = Arc::new(
        tigshop_services::vendor::vendor_product::VendorProductService::new(repos.clone()),
    );
    let vendor = Arc::new(tigshop_services::vendor::Services {
        vendor: vendor_service.clone(),
        vendor_product: vendor_product_service.clone(),
    });
    let pos_device_service = Arc::new(tigshop_services::pos::device::PosDeviceService::new(
        repos.clone(),
    ));
    let pos_cashier_service = Arc::new(tigshop_services::pos::cashier::PosCashierService::new(
        repos.clone(),
    ));
    let pos = Arc::new(tigshop_services::pos::Services {
        cashier: pos_cashier_service.clone(),
        device: pos_device_service.clone(),
    });
    let o2o_config_service = Arc::new(tigshop_services::o2o::config::O2oConfigService::new(
        repos.clone(),
    ));
    let o2o_reservation_tpl_service =
        Arc::new(tigshop_services::o2o::reservation_tpl::ReservationTplService::new(repos.clone()));
    let o2o_stock_calendar_service =
        Arc::new(tigshop_services::o2o::stock_calendar::StockCalendarService::new(repos.clone()));
    let o2o_store_product_service =
        Arc::new(tigshop_services::o2o::store_product::StoreProductService::new(repos.clone()));
    let o2o_pickup_client_service =
        Arc::new(tigshop_services::o2o::pickup_client::PickupClientService::new(repos.clone()));
    let o2o = Arc::new(tigshop_services::o2o::Services {
        config: o2o_config_service.clone(),
        reservation_tpl: o2o_reservation_tpl_service.clone(),
        stock_calendar: o2o_stock_calendar_service.clone(),
        store_product: o2o_store_product_service.clone(),
        pickup_client: o2o_pickup_client_service.clone(),
    });

    let admin_state = AdminState {
        identity: identity.clone(),
        merchant: merchant.clone(),
        catalog: catalog.clone(),
        trade: trade.clone(),
        payment: payment.clone(),
        marketing: marketing.clone(),
        member: member.clone(),
        logistics: logistics.clone(),
        content: content.clone(),
        system: system.clone(),
        im: im.clone(),
        analytics: analytics.clone(),
        openapi: openapi.clone(),
        wholesale: wholesale.clone(),
        lang: lang.clone(),
        vendor: vendor.clone(),
        pos: pos.clone(),
        o2o: o2o.clone(),
        jwt: (*jwt).clone(),
        repos: repos.clone(),
    };
    let public_state = PublicState {
        merchant: merchant.clone(),
        catalog: catalog.clone(),
        trade: trade.clone(),
        payment: payment.clone(),
        marketing: marketing.clone(),
        member: member.clone(),
        logistics: logistics.clone(),
        content: content.clone(),
        system: system.clone(),
        im: im.clone(),
        wholesale: wholesale.clone(),
        o2o: o2o.clone(),
        jwt: (*jwt).clone(),
        upload_dir: cfg.file.upload_dir.clone(),
        internal_api_key: cfg.internal.api_key.clone(),
        repos: repos.clone(),
    };

    // 6. CORS（开发期允许全部来源，生产按域名收紧）
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // 已压缩的二进制下载（商品原图 ZIP / Excel / PDF 等）不再二次 gzip。
    // tower-http 压缩时会 remove(Content-Length) 并追加 Content-Encoding，
    // 会让前端无法按 Content-Length 校验压缩包完整性。
    let compression = CompressionLayer::new().compress_when(
        DefaultPredicate::new()
            .and(NotForContentType::const_new("application/zip"))
            .and(NotForContentType::const_new("application/x-zip-compressed"))
            .and(NotForContentType::const_new("application/gzip"))
            .and(NotForContentType::const_new("application/vnd.openxmlformats"))
            .and(NotForContentType::const_new("application/pdf"))
            .and(NotForContentType::const_new("application/octet-stream")),
    );

    let admin_app = admin_router(admin_state)
        .layer(cors.clone())
        .layer(compression.clone())
        .layer(TraceLayer::new_for_http());

    // 商城端只提供 /api JSON 接口；PC 前端为独立 Vue SPA（仓库根 `pc-web/`），
    // 由 nginx 静态托管并反代 /api 到本端口。
    // 历史说明：曾用 `tigshop_pc_web::render_app` 作为 SSR fallback，该 Leptos 实现已于
    // 2026-10-20 下线（备份见 `rust/backups/pc-web-backup-leptos`），不要再加回来——
    // 否则 8181 的 `/` 会返回 Leptos 页面，与 `pc-web/` 的 SPA 冲突。
    let public_app = public_router(public_state)
        .layer(cors)
        .layer(compression)
        .layer(TraceLayer::new_for_http());

    // 7. 双端口监听（对应原 adminapi:8080 / api:8181）
    let admin_addr = format!("{}:{}", cfg.server.host, cfg.server.admin_port);
    let api_addr = format!("{}:{}", cfg.server.host, cfg.server.api_port);

    let listener_admin = tokio::net::TcpListener::bind(&admin_addr).await?;
    let listener_api = tokio::net::TcpListener::bind(&api_addr).await?;

    tracing::info!("管理端 API 监听: http://{admin_addr}");
    tracing::info!("商城端 API 监听: http://{api_addr}");
    tracing::info!("启动完成，当前时间戳: {}", utils::now_millis());

    tokio::select! {
        r = axum::serve(listener_admin, admin_app.into_make_service()) => {
            r.map_err(|e| anyhow::anyhow!("管理端服务异常: {e}"))?;
        }
        r = axum::serve(listener_api, public_app.into_make_service()) => {
            r.map_err(|e| anyhow::anyhow!("商城端服务异常: {e}"))?;
        }
        _ = tokio::signal::ctrl_c() => {
            tracing::info!("收到退出信号，服务关闭中...");
        }
    }

    Ok(())
}
