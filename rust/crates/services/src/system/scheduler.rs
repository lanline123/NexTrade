//! 轻量定时任务：替代 Java 的 RabbitMQ 延迟队列（订单超时取消/自动收货）。
//!
//! Java 在 `OrderCheckServiceImpl` / `OrderServiceImpl` 里通过 RabbitMQ
//! `x-delay` 延迟消息 + `RabbitMqConsumer` 实现「未付款订单超时取消」
//! 「发货后自动收货」。本实现改为**轮询扫描 + 幂等条件更新**，无需 MQ：
//!
//! - `order_auto_cancel`：默认每分钟扫描 `pay_status=1 && order_status=0` 且
//!   `add_time <= now - autoCancelOrderMinute*60` 的订单，调用订单取消（回滚库存）；
//! - `order_auto_receive`：默认每 5 分钟扫描 `order_status=2` 且
//!   `shipping_time <= now - autoDeliveryDays*86400` 的订单，置为已完成。
//!
//! 配置项与 Java 一致：`config` 表 `autoCancelOrderMinute` / `autoDeliveryDays`；
//! 值为空或 <= 0 时该任务跳过（与 Java 默认关闭一致）。
//!
//! 运维/测试可通过环境变量调整节奏：
//! `TIG_SCHEDULER__ENABLED=false` 关闭；`TIG_SCHEDULER__DELAY_SECS`（默认 30）、
//! `TIG_SCHEDULER__CANCEL_SECS`（默认 60）、`TIG_SCHEDULER__RECEIVE_SECS`（默认 300）。
//!
//! 多实例说明：当前无分布式锁（单实例部署）。多实例时需加 Redis `SET NX`
//! 或改用 MQ；任务本身幂等，重复执行不会重复扣库存/改状态。
use std::sync::Arc;
use std::time::Duration;

use tokio::task::JoinHandle;

use tigshop_common::utils;
use tigshop_core::Result;
use tigshop_infrastructure::db::Repositories;

use crate::trade::order::OrderService;

/// 未付款订单超时时间（分钟）配置项。
pub const CFG_AUTO_CANCEL_ORDER_MINUTE: &str = "autoCancelOrderMinute";
/// 自动收货天数配置项。
pub const CFG_AUTO_DELIVERY_DAYS: &str = "autoDeliveryDays";

/// 每轮扫描的最大订单数，避免一次锁太多行。
const SCAN_BATCH: u64 = 100;

/// 读取环境变量秒数（缺省返回 default）。
fn env_secs(key: &str, default: u64) -> u64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(default)
}

/// 解析整数配置（缺省/非法 → None）。
#[must_use]
pub fn parse_positive_i64(raw: Option<&str>) -> Option<i64> {
    raw.map(str::trim)
        .and_then(|v| v.parse::<i64>().ok())
        .filter(|v| *v > 0)
}

/// 解析天数配置（支持 `30` / `30.0`；缺省/非法 → None），返回秒数。
#[must_use]
pub fn parse_positive_days(raw: Option<&str>) -> Option<i64> {
    let value = raw.map(str::trim)?.parse::<f64>().ok()?;
    if value <= 0.0 {
        return None;
    }
    Some((value * 86_400.0) as i64)
}

/// 启动全部定时任务，返回 JoinHandle（由进程生命周期管理）。
pub fn spawn_all(repos: Arc<Repositories>, order: OrderService) -> Vec<JoinHandle<()>> {
    vec![
        tokio::spawn(order_auto_cancel_loop(repos.clone(), order.clone())),
        tokio::spawn(order_auto_receive_loop(repos.clone())),
        tokio::spawn(groupon_expire_loop(repos.clone())),
        tokio::spawn(credit_user_period_update_loop(repos.clone())),
        tokio::spawn(product_auto_status_loop(repos.clone())),
        tokio::spawn(aftersales_auto_receive_loop(repos.clone())),
        tokio::spawn(deposit_due_check_loop(repos.clone())),
        tokio::spawn(wechat_live_order_sync_loop(repos.clone())),
        tokio::spawn(profit_sharing_schedule_loop(repos.clone())),
        tokio::spawn(exchange_rate_sync_loop(repos)),
    ]
}

/// 汇率自动更新循环（Java `ExchangeRateSyncTask`，每小时触发）。
///
/// `sync(false)` 内部校验 `autoSync=1` 且距上次同步达 `syncIntervalHours`；
/// 未配置 AppID / 未开启自动更新时静默跳过（debug 日志），对齐 Java 语义。
/// `TIG_SCHEDULER__RATE_SECS` 可调节奏（默认 3600s）。
async fn exchange_rate_sync_loop(repos: Arc<Repositories>) {
    tokio::time::sleep(Duration::from_secs(
        env_secs("TIG_SCHEDULER__DELAY_SECS", 30) + 45,
    ))
    .await;
    let mut ticker = tokio::time::interval(Duration::from_secs(env_secs(
        "TIG_SCHEDULER__RATE_SECS",
        3600,
    )));
    loop {
        ticker.tick().await;
        let service = crate::lang::currency::CurrencyService::new(repos.clone());
        match service.sync(false).await {
            Ok(result) if result.success => {
                tracing::info!("定时任务：汇率自动更新完成（{}）", result.message);
            }
            Ok(result) => {
                tracing::debug!("定时任务：汇率自动更新跳过（{}）", result.message);
            }
            Err(e) => tracing::warn!("定时任务：汇率自动更新失败: {e}"),
        }
    }
}

/// 订单超时取消循环。
async fn order_auto_cancel_loop(repos: Arc<Repositories>, order: OrderService) {
    // 启动后延迟，避开启动高峰
    tokio::time::sleep(Duration::from_secs(env_secs(
        "TIG_SCHEDULER__DELAY_SECS",
        30,
    )))
    .await;
    let mut ticker = tokio::time::interval(Duration::from_secs(env_secs(
        "TIG_SCHEDULER__CANCEL_SECS",
        60,
    )));
    loop {
        ticker.tick().await;
        match run_auto_cancel(&repos, &order).await {
            Ok(0) => {}
            Ok(n) => tracing::info!("定时任务：超时取消订单 {n} 笔"),
            Err(e) => tracing::warn!("定时任务：订单超时取消失败: {e}"),
        }
    }
}

/// 自动收货循环。
async fn order_auto_receive_loop(repos: Arc<Repositories>) {
    tokio::time::sleep(Duration::from_secs(
        env_secs("TIG_SCHEDULER__DELAY_SECS", 30) + 30,
    ))
    .await;
    let mut ticker = tokio::time::interval(Duration::from_secs(env_secs(
        "TIG_SCHEDULER__RECEIVE_SECS",
        300,
    )));
    loop {
        ticker.tick().await;
        match run_auto_receive(repos.clone()).await {
            Ok(0) => {}
            Ok(n) => tracing::info!("定时任务：自动确认收货 {n} 笔"),
            Err(e) => tracing::warn!("定时任务：自动收货失败: {e}"),
        }
    }
}

/// 拼团过期循环（每 60s；`TIG_SCHEDULER__GROUPON_SECS` 可调）。
async fn groupon_expire_loop(repos: Arc<Repositories>) {
    tokio::time::sleep(Duration::from_secs(
        env_secs("TIG_SCHEDULER__DELAY_SECS", 30) + 15,
    ))
    .await;
    let mut ticker = tokio::time::interval(Duration::from_secs(env_secs(
        "TIG_SCHEDULER__GROUPON_SECS",
        60,
    )));
    loop {
        ticker.tick().await;
        match run_groupon_expire(&repos).await {
            Ok(0) => {}
            Ok(n) => tracing::info!("定时任务：拼团过期置失败 {n} 团"),
            Err(e) => tracing::warn!("定时任务：拼团过期处理失败: {e}"),
        }
    }
}

/// 保证金到期扫描循环（`TIG_SCHEDULER__DEPOSIT_DUE_SECS`，默认 86400s）。
async fn deposit_due_check_loop(repos: Arc<Repositories>) {
    tokio::time::sleep(Duration::from_secs(
        env_secs("TIG_SCHEDULER__DELAY_SECS", 30) + 90,
    ))
    .await;
    let mut ticker = tokio::time::interval(Duration::from_secs(env_secs(
        "TIG_SCHEDULER__DEPOSIT_DUE_SECS",
        86_400,
    )));
    loop {
        ticker.tick().await;
        let service = crate::merchant::deposit_account::DepositAccountService::new(repos.clone());
        match service.run_due_check().await {
            Ok(()) => {}
            Err(e) => tracing::warn!("定时任务：保证金到期扫描失败: {e}"),
        }
    }
}

/// 微信视频号/直播订单同步循环（对应 Java `WechatLiveOrderSyncTask`）。
///
/// Java 每 15 分钟处理待同步/失败日志（`processPendingLogs`）、每日 2 点对账
/// （`reconcileLiveOrders`）。同步执行依赖微信直播/视频号订单 API 凭据，
/// 凭据未接入前本循环做**积压监控**：有待处理日志时每周期告警一次
/// （诚实降级，不伪造同步成功）；接入凭据后在
/// `services/content/wechat_live_order_sync.rs` 落地真实推送。
async fn wechat_live_order_sync_loop(repos: Arc<Repositories>) {
    tokio::time::sleep(Duration::from_secs(
        env_secs("TIG_SCHEDULER__DELAY_SECS", 30) + 120,
    ))
    .await;
    let mut ticker = tokio::time::interval(Duration::from_secs(env_secs(
        "TIG_SCHEDULER__WECHAT_LIVE_SYNC_SECS",
        900,
    )));
    loop {
        ticker.tick().await;
        let now = utils::now_seconds();
        let pending: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM wechat_live_sync_log              WHERE sync_status IN (0, 2)                AND (next_retry_time IS NULL OR next_retry_time <= ?)",
        )
        .bind(now)
        .fetch_one(&repos.pool)
        .await
        .unwrap_or(0);
        if pending > 0 {
            tracing::warn!(
                "微信直播订单同步：{pending} 条待处理/失败日志积压                  （同步执行待微信 API 凭据接入，见 docs/SCHEDULER.md）"
            );
        }
    }
}

/// 线上分账调度循环（对应 Java `ProfitSharingScheduleTask` 的 8 个方法）。
///
/// 分账通道（微信/汇付）API 客户端待商户凭据接入（见 `docs/PAYMENT-CHANNELS.md`：
/// 协议层已就绪）。接入前本循环做**真实可做的部分**：
/// - 超时预警（Java `executeTimeoutWarning`，纯 DB）：挂起超 150 天
///   （微信 180 天冻结上限）的分账单每周期告警；
/// - 其余 7 类（自动分账/状态补偿/完结补偿/失败重试/进件轮询/提现查询/回退补偿）
///   依赖通道查单接口：有积压时每周期报告一次，不伪造成功。
async fn profit_sharing_schedule_loop(repos: Arc<Repositories>) {
    tokio::time::sleep(Duration::from_secs(
        env_secs("TIG_SCHEDULER__DELAY_SECS", 30) + 150,
    ))
    .await;
    let mut ticker = tokio::time::interval(Duration::from_secs(env_secs(
        "TIG_SCHEDULER__PROFIT_SHARING_SECS",
        1800,
    )));
    loop {
        ticker.tick().await;

        // 1. 超时预警（纯 DB，Java executeTimeoutWarning 全量移植）
        let cutoff = chrono::Utc::now().timestamp() - 150 * 24 * 3600;
        let timeout_rows: Vec<(i64, String, i64, String)> = sqlx::query_as(
            "SELECT id, out_order_no, shop_id, status FROM profit_sharing_order              WHERE status = 0 AND create_time <= ?",
        )
        .bind(chrono::NaiveDateTime::from_timestamp_opt(cutoff, 0))
        .fetch_all(&repos.pool)
        .await
        .unwrap_or_default();
        for (id, out_order_no, shop_id, status) in &timeout_rows {
            tracing::warn!(
                "分账超时预警：id={id} outOrderNo={out_order_no} shopId={shop_id}                  status={status} 挂起超150天（微信180天冻结上限）"
            );
        }

        // 2. 通道依赖类的积压可见性（凭据接入后在此接真实查单/提交）
        let processing: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM profit_sharing_order WHERE status = 1",
        )
        .fetch_one(&repos.pool)
        .await
        .unwrap_or(0);
        let unfinished: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM profit_sharing_order WHERE status = 2 AND finish_status = 0",
        )
        .fetch_one(&repos.pool)
        .await
        .unwrap_or(0);
        let failed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM profit_sharing_order WHERE status = 3 AND retry_count < 3",
        )
        .fetch_one(&repos.pool)
        .await
        .unwrap_or(0);
        let returns: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM profit_sharing_return_order WHERE status = 1",
        )
        .fetch_one(&repos.pool)
        .await
        .unwrap_or(0);
        let withdraws: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM shop_withdraw              WHERE withdraw_type = 2 AND status = 1                AND channel_status IN ('CREATE_SUCCESS','PROCESSING','SUBMITTING','UNKNOWN')",
        )
        .fetch_one(&repos.pool)
        .await
        .unwrap_or(0);
        if processing + unfinished + failed + returns + withdraws > 0 {
            tracing::warn!(
                "分账调度：通道依赖积压（待商户凭据接入后自动处理，见 docs/PAYMENT-CHANNELS.md）                 —— 处理中分账 {processing}、待完结 {unfinished}、待重试 {failed}、                 回退中 {returns}、线上提现待查 {withdraws}"
            );
        }
    }
}

/// 售后自动确认收货循环（`TIG_SCHEDULER__AFTERSALES_RECEIPT_SECS`，默认 3600s）。
async fn aftersales_auto_receive_loop(repos: Arc<Repositories>) {
    tokio::time::sleep(Duration::from_secs(
        env_secs("TIG_SCHEDULER__DELAY_SECS", 30) + 60,
    ))
    .await;
    let mut ticker = tokio::time::interval(Duration::from_secs(env_secs(
        "TIG_SCHEDULER__AFTERSALES_RECEIPT_SECS",
        3600,
    )));
    loop {
        ticker.tick().await;
        match run_aftersales_auto_receive(&repos).await {
            Ok(0) => {}
            Ok(n) => tracing::info!("定时任务：售后自动确认收货 {n} 条"),
            Err(e) => tracing::warn!("定时任务：售后自动确认收货失败: {e}"),
        }
    }
}

/// 执行一轮售后自动确认收货。
pub async fn run_aftersales_auto_receive(repos: &Repositories) -> Result<u64> {
    let raw = repos
        .catalog
        .product_manage
        .config_val("autoConfirmReceiptDays")
        .await?;
    let Some(raw) = raw.filter(|s| !s.trim().is_empty()) else {
        return Ok(0);
    };
    let Ok(days) = raw.trim().parse::<f64>() else {
        return Ok(0);
    };
    if days < 1.0 {
        return Ok(0);
    }
    let cutoff = tigshop_common::utils::now_seconds()
        - (days * 86_400.0) as i64;
    let cutoff = i32::try_from(cutoff).unwrap_or(i32::MIN);
    let rows = repos
        .trade
        .aftersales
        .find_due_auto_receive(cutoff, 100)
        .await?;
    let service = crate::trade::aftersales::AftersalesService::new(Arc::new(repos.clone()));
    let mut done = 0u64;
    for row in rows {
        match service.auto_receive(row.aftersale_id).await {
            Ok(true) => done += 1,
            Ok(false) => {}
            Err(e) => tracing::warn!(
                "售后自动确认收货失败: aftersale_id={}, {e}",
                row.aftersale_id
            ),
        }
    }
    Ok(done)
}

/// 商品自动上下架循环（`TIG_SCHEDULER__PRODUCT_AUTO_SECS`，默认 60s）。
async fn product_auto_status_loop(repos: Arc<Repositories>) {
    tokio::time::sleep(Duration::from_secs(
        env_secs("TIG_SCHEDULER__DELAY_SECS", 30) + 15,
    ))
    .await;
    let mut ticker = tokio::time::interval(Duration::from_secs(env_secs(
        "TIG_SCHEDULER__PRODUCT_AUTO_SECS",
        60,
    )));
    loop {
        ticker.tick().await;
        match run_product_auto_status(&repos).await {
            Ok(0) => {}
            Ok(n) => tracing::info!("定时任务：商品自动上下架执行 {n} 条"),
            Err(e) => tracing::warn!("定时任务：商品自动上下架失败: {e}"),
        }
    }
}

/// 执行一轮商品自动上下架（对应 Java `ProductAutoStatusServiceImpl#executeAutoStatusTasks`）。
pub async fn run_product_auto_status(repos: &Repositories) -> Result<u64> {
    let now = tigshop_common::utils::now_seconds();
    let tasks = repos
        .catalog
        .product_manage
        .find_due_auto_status(now, 50)
        .await?;
    let mut executed = 0u64;
    for task in tasks {
        let product = repos
            .catalog
            .product_manage
            .find_product(task.product_id)
            .await?;
        let Some(product) = product else {
            repos
                .catalog
                .product_manage
                .mark_auto_status(task.id, 2, Some("商品不存在"), task.retry_count + 1, now)
                .await?;
            continue;
        };
        if product.is_delete != 0 {
            repos
                .catalog
                .product_manage
                .mark_auto_status(task.id, 2, Some("商品不存在"), task.retry_count + 1, now)
                .await?;
            continue;
        }
        let online = task.operation_type == 1;
        if online && product.product_type == Some(3) && product.card_group_id > 0 {
            if let Some(group) = repos
                .catalog
                .e_card_group
                .find_by_id(product.card_group_id)
                .await?
            {
                if group.is_use == 0 {
                    let msg = format!(
                        "电子卡卷组【{}】未启用，请先启用电子卡卷组！",
                        group.group_name
                    );
                    repos
                        .catalog
                        .product_manage
                        .mark_auto_status(task.id, 2, Some(&msg), task.retry_count + 1, now)
                        .await?;
                    continue;
                }
            }
        }
        let new_status = i32::from(online);
        let affected = repos
            .catalog
            .product_manage
            .update_product_status_auto(task.product_id, new_status)
            .await?;
        let (status, err) = if affected > 0 {
            (1, None)
        } else {
            (2, Some("商品不存在"))
        };
        repos
            .catalog
            .product_manage
            .mark_auto_status(task.id, status, err, task.retry_count + 1, now)
            .await?;
        executed += 1;
    }
    Ok(executed)
}

/// 授信会员结算周期更新循环（默认每小时扫描一次，`TIG_SCHEDULER__CREDIT_PERIOD_SECS` 可调，默认 3600s）。
async fn credit_user_period_update_loop(repos: Arc<Repositories>) {
    tokio::time::sleep(Duration::from_secs(
        env_secs("TIG_SCHEDULER__DELAY_SECS", 30) + 45,
    ))
    .await;
    let mut ticker = tokio::time::interval(Duration::from_secs(env_secs(
        "TIG_SCHEDULER__CREDIT_PERIOD_SECS",
        3600,
    )));
    loop {
        ticker.tick().await;
        match run_credit_user_period_update(&repos).await {
            Ok(0) => {}
            Ok(n) => tracing::info!("定时任务：授信会员结算周期已推进 {n} 位"),
            Err(e) => tracing::warn!("定时任务：授信会员结算周期推进失败: {e}"),
        }
    }
}

/// 执行一轮授信会员账期推进（对应 Java `CreditUserPeriodUpdateTask`）。
pub async fn run_credit_user_period_update(repos: &Repositories) -> Result<u64> {
    let service = crate::payment::credit_user::CreditUserService::new(Arc::new(repos.clone()));
    service.update_all_period_start_time().await
}

/// 执行一轮拼团过期：待成团且超过截止时间的开团记录整团置失败。
///
/// # Errors
/// 数据库错误。
pub async fn run_groupon_expire(repos: &Repositories) -> Result<usize> {
    let now = utils::now_seconds() as i64;
    let records = repos
        .marketing
        .groupon_promotion_record
        .find_expired_waiting(now, SCAN_BATCH)
        .await?;
    let mut count = 0;
    for record in records {
        let mut completed = false;
        if let Some(item) = repos
            .marketing
            .groupon_promotion_item
            .find_item(record.groupon_promotion_item_id)
            .await?
        {
            let members = repos
                .marketing
                .groupon_promotion_record
                .count_members(record.groupon_promotion_record_id)
                .await?;
            if item.is_auto_group == 1 && members >= i64::from(item.min_group_num) {
                let fill = (i64::from(record.min_group_num) - members).max(0);
                repos
                    .marketing
                    .groupon_promotion_record
                    .auto_complete_group(&record, usize::try_from(fill).unwrap_or(0), now)
                    .await?;
                completed = true;
                count += 1;
                tracing::info!(
                    "拼团到期自动成团: open_record={}, 真实成员={}, 补虚拟={}",
                    record.groupon_promotion_record_id,
                    members,
                    fill
                );
            }
        }
        if completed {
            continue;
        }
        let affected = repos
            .marketing
            .groupon_promotion_record
            .mark_failed_by_open(record.groupon_promotion_record_id)
            .await?;
        if affected > 0 {
            count += 1;
            // 拼团失败：为真实成员订单自动发起退款售后（实际退款仍需财务处理）
            let members = repos
                .marketing
                .groupon_promotion_record
                .find_members(record.groupon_promotion_record_id)
                .await?;
            let aftersales = crate::trade::aftersales::AftersalesService::new(Arc::new(
                repos.clone(),
            ));
            for member in members {
                if member.is_virtual != 0 || member.user_id <= 0 || member.order_id <= 0 {
                    continue;
                }
                if let Err(e) = aftersales
                    .create_groupon_refund(
                        i32::try_from(member.order_id).unwrap_or(0),
                        i32::try_from(member.user_id).unwrap_or(0),
                        member.paid_amount,
                    )
                    .await
                {
                    tracing::warn!(
                        "拼团失败创建售后失败: open={}, order={}, {e}",
                        record.groupon_promotion_record_id,
                        member.order_id
                    );
                }
            }
            tracing::info!(
                "拼团过期: open_record={} 影响成员 {}",
                record.groupon_promotion_record_id,
                affected
            );
        }
    }
    Ok(count)
}

/// 执行一轮超时取消，返回处理笔数。
///
/// # Errors
/// 数据库错误或配置读取失败时返回错误（loop 侧只记日志）。
pub async fn run_auto_cancel(repos: &Repositories, order_service: &OrderService) -> Result<u64> {
    let raw = repos
        .system
        .config_basic
        .find_by_code(CFG_AUTO_CANCEL_ORDER_MINUTE)
        .await?;
    let Some(minutes) = parse_positive_i64(raw.as_deref()) else {
        return Ok(0);
    };
    let now = i64::from(utils::now_seconds());
    let cutoff = now
        .saturating_sub(minutes * 60)
        .clamp(0, i64::from(i32::MAX)) as i32;
    let ids = repos
        .trade
        .order
        .find_unpaid_before(cutoff, SCAN_BATCH)
        .await?;
    let mut done = 0_u64;
    for order_id in ids {
        // 复用订单取消逻辑（状态条件更新 + 回滚库存）；并发下可能返回冲突，忽略
        match order_service.cancel(order_id, None, None).await {
            Ok(()) => done += 1,
            Err(e) => tracing::debug!("自动取消订单 {order_id} 跳过: {e}"),
        }
    }
    Ok(done)
}

/// 执行一轮自动收货，返回处理笔数。
pub async fn run_auto_receive(repos: Arc<Repositories>) -> Result<u64> {
    let raw = repos
        .system
        .config_basic
        .find_by_code(CFG_AUTO_DELIVERY_DAYS)
        .await?;
    let Some(seconds) = parse_positive_days(raw.as_deref()) else {
        return Ok(0);
    };
    let now = i64::from(utils::now_seconds());
    let cutoff = now
        .saturating_sub(seconds)
        .clamp(0, i64::from(i32::MAX)) as i32;
    let ids = repos
        .trade
        .order
        .find_shipped_before(cutoff, SCAN_BATCH)
        .await?;
    let mut done = 0_u64;
    for order_id in ids {
        // Java `receiveOrderConfirmReceiptMessage` 的防护：售后审核处理中
        // （状态 1）不自动收货，避免售后中订单被错误完成并触发结算
        let in_review: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM aftersales WHERE order_id = ? AND status = 1",
        )
        .bind(order_id)
        .fetch_one(&repos.pool)
        .await
        .unwrap_or(0);
        if in_review > 0 {
            continue;
        }
        if repos
            .trade
            .order
            .mark_received(order_id, now as i32)
            .await?
        {
            done += 1;
            // 自动收货 = Java confirmReceipt 同款收尾：完成日志 + 积分/成长值/
            // 次卡/出账单/结算级联（店铺结算、分销佣金、分销员升级）
            if let Ok(Some(order)) = repos.trade.order.find_by_id(order_id).await {
                let desc = if order.order_type == Some(10) {
                    "完成上门服务"
                } else {
                    "确认收货"
                };
                let _ = repos
                    .trade
                    .user_order
                    .insert_order_log(
                        order_id,
                        &order.order_sn,
                        order.user_id,
                        order.shop_id,
                        desc,
                        now as i32,
                    )
                    .await;
                crate::trade::settlement::SettlementService::new(repos.clone())
                    .after_order_completed(&order)
                    .await;
            }
        }
    }
    Ok(done)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_minutes_rules() {
        assert_eq!(parse_positive_i64(Some("30")), Some(30));
        assert_eq!(parse_positive_i64(Some(" 0 ")), None);
        assert_eq!(parse_positive_i64(Some("-5")), None);
        assert_eq!(parse_positive_i64(Some("abc")), None);
        assert_eq!(parse_positive_i64(None), None);
    }

    #[test]
    fn parse_days_rules() {
        assert_eq!(parse_positive_days(Some("7")), Some(7 * 86_400));
        assert_eq!(parse_positive_days(Some("0.5")), Some(43_200));
        assert_eq!(parse_positive_days(Some("0")), None);
        assert_eq!(parse_positive_days(None), None);
    }

    #[test]
    fn env_secs_falls_back() {
        assert_eq!(env_secs("TIG_SCHEDULER__NOT_EXISTS", 42), 42);
    }
}
