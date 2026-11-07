export const configSections: Record<string, Array<{ title: string; fields: string[] }>> = {
  "baseBasicManage": [
    {
      "title": "商城信息",
      "fields": [
        "shopLogo",
        "lightShopLogo",
        "shopName",
        "shopCompany",
        "poweredBy",
        "poweredByStatus",
        "kefuAddress"
      ]
    },
    {
      "title": "备案信息",
      "fields": [
        "shopIcpNo",
        "shopIcpNoUrl",
        "shop110No",
        "shop110Link"
      ]
    },
    {
      "title": "经营许可证",
      "fields": [
        "businessLicenseEnabled"
      ]
    },
    {
      "title": "商城状态",
      "fields": [
        "shopRegClosed",
        "closeOrder"
      ]
    }
  ],
  "baseProductManage": [
    {
      "title": "商品货币设置",
      "fields": [
        "dollarSign",
        "dollarSignCn"
      ]
    },
    {
      "title": "商品录入设置",
      "fields": [
        "snPrefix",
        "customProductNameLength",
        "marketPriceRate"
      ]
    },
    {
      "title": "商品编辑设置",
      "fields": [
        "productEditStockModify",
        "specImageMode"
      ]
    },
    {
      "title": "商品信息显示设置",
      "fields": [
        "showSelledCount",
        "showMarketprice",
        "isEnquiry",
        "bulkPurchase",
        "enableAttributeFilter"
      ]
    },
    {
      "title": "商品图片下载",
      "fields": [
        "productRawImageDownloadEnabled",
        "productRawImageDownloadChannels",
        "productRawImageDownloadScopes"
      ]
    },
    {
      "title": "商品评价设置",
      "fields": [
        "productCommentEnabled",
        "anonymousCommentEnabled"
      ]
    }
  ],
  "baseShoppingManage": [
    {
      "title": "购物全局设置",
      "fields": [
        "childAreaNeedRegion"
      ]
    },
    {
      "title": "积分设置",
      "fields": [
        "integralName",
        "integralScale",
        "orderSendPointNode",
        "orderSendPoint",
        "orderCompleteSendPointDays",
        "integralPercentBaseAmount",
        "integralPercent",
        "commentSendPoint",
        "showSendPoint",
        "useQiandaoPoint",
        "continuousSignIn"
      ]
    },
    {
      "title": "发票设置",
      "fields": [
        "canInvoice",
        "invoiceAdded"
      ]
    },
    {
      "title": "退换货设置",
      "fields": [
        "returnConsignee",
        "returnMobile",
        "returnAddress"
      ]
    }
  ],
  "baseOrderManage": [
    {
      "title": "基础设置",
      "fields": [
        "autoDeliveryDays",
        "virtualOrderAutoDeliver",
        "autoCancelOrderMinute"
      ]
    },
    {
      "title": "售后设置",
      "fields": [
        "afterSalesLimitDays",
        "afterSalesReview",
        "autoReturnGoods",
        "autoReturnGoodsDays",
        "autoConfirmReceiptDays",
        "financialReview",
        "afterSalesReasonEnabled",
        "afterSalesReasonList"
      ]
    },
    {
      "title": "平台管理订单流转设置",
      "fields": [
        "isPlatformCancelPaidOrder",
        "isPlatformCancelDeliverOrder"
      ]
    },
    {
      "title": "店铺后台订单流转设置",
      "fields": [
        "isShopCancelDeliverOrder"
      ]
    },
    {
      "title": "平台代客下单设置",
      "fields": [
        "adminShoppingUsePoint",
        "adminShoppingUseBalance"
      ]
    }
  ],
  "kefuSetting": [
    {
      "title": "客服设置",
      "fields": [
        "kefuType",
        "kefuYzfType",
        "kefuYzfSign",
        "kefuWorkwxId",
        "corpId",
        "kefuCode",
        "kefuCodeBlank"
      ]
    },
    {
      "title": "客服信息",
      "fields": [
        "kefuPhone",
        "kefuWhatsappPhone",
        "kefuTime"
      ]
    }
  ],
  "globalSetting": [
    {
      "title": "后台风格",
      "fields": [
        "navTheme",
        "primaryColor",
        "layout",
        "adminLightLogo",
        "versionInfoHidden",
        "clientDefaultUse"
      ]
    },
    {
      "title": "SEO设置",
      "fields": [
        "shopTitleSuffix",
        "shopTitle",
        "shopKeywords",
        "shopDesc",
        "icoImg",
        "defaultAvatar"
      ]
    },
    {
      "title": "域名设置",
      "fields": [
        "pcDomain",
        "h5Domain",
        "imDomain",
        "autoRedirect",
        "adminDomain"
      ]
    },
    {
      "title": "上传设置",
      "fields": [
        "uploadMaxSize",
        "imageUploadMaxSize",
        "materialUploadNameType"
      ]
    },
    {
      "title": "搜索设置",
      "fields": [
        "searchKeywords",
        "msgHackWord",
        "isOpenPscws",
        "selfStoreName",
        "selectSearchType"
      ]
    },
    {
      "title": "地区设置",
      "fields": [
        "shopCountry",
        "defaultCountry",
        "shopDefaultRegions"
      ]
    },
    {
      "title": "多语言设置",
      "fields": [
        "langOn",
        "langType",
        "langVolcengineAccessKey",
        "langVolcengineSecret"
      ]
    },
    {
      "title": "链接设置",
      "fields": [
        "seoCategoryEnable",
        "seoProductEnable"
      ]
    },
    {
      "title": "ICO图标库",
      "fields": [
        "icoDefinedCss"
      ]
    },
    {
      "title": "存储设置",
      "fields": [
        "storageType",
        "storageSaveFullPath",
        "storageLocalUrl",
        "storageOssUrl",
        "storageCosUrl",
        "storageQiniuUrl",
        "storageS3Url",
        "storageOssAccessKeyId",
        "storageCosSecretId",
        "storageQiniuAccessKey",
        "storageS3AccessKey",
        "storageOssAccessKeySecret",
        "storageCosSecretKey",
        "storageQiniuSecretKey",
        "storageS3SecretKey",
        "storageOssBucket",
        "storageCosBucket",
        "storageQiniuBucket",
        "storageS3Bucket",
        "storageOssRegion",
        "storageCosRegion",
        "storageQiniuRegion",
        "storageS3Region",
        "storageS3Endpoint"
      ]
    },
    {
      "title": "MCP 设置",
      "fields": [
        "workbuddyApiKey",
        "workbuddyApiKeyExpiresAt"
      ]
    }
  ],
  "loginSetting": [
    {
      "title": "微信登录",
      "fields": [
        "openWechatOauth",
        "wechatAppId",
        "wechatAppSecret",
        "wechatServerToken",
        "wechatServerSecret",
        "openWechatPcLogin",
        "wechatRegisterBindPhone",
        "openWechatRegister",
        "wechatShareNeedLogin"
      ]
    },
    {
      "title": "基础设置",
      "fields": [
        "isOpenMobileAreaCode",
        "usernamePrefix",
        "openEmailRegister"
      ]
    },
    {
      "title": "Facebook 登录",
      "fields": [
        "facebookLoginOn",
        "facebookClientId",
        "facebookClientSecret"
      ]
    },
    {
      "title": "Google 登录",
      "fields": [
        "googleLoginOn",
        "googleClientId",
        "googleClientSecret"
      ]
    },
    {
      "title": "Twitter 登录",
      "fields": [
        "twitterLoginOn",
        "twitterClientId",
        "twitterClientSecret"
      ]
    }
  ],
  "posOrderSetting": [
    {
      "title": "收银设置",
      "fields": [
        "autoEraseZero",
        "autoDeductionPoints",
        "defaultCollectionMethod"
      ]
    },
    {
      "title": "打印设置",
      "fields": [
        "autoPrintOnlineOrder",
        "autoPrintOfflineOrder"
      ]
    },
    {
      "title": "商品设置",
      "fields": [
        "posProductSource",
        "autoAddCartAfterScan",
        "shopCommonRemarks"
      ]
    }
  ],
  "storeAmapSetting": [
    {
      "title": "地图服务商",
      "fields": [
        "mapProvider",
        "field"
      ]
    }
  ],
  "personalizedManage": [
    {
      "title": "猜你喜欢",
      "fields": [
        "guestLikeGoodsName",
        "isGuestLikeGoods",
        "defaultAvatar",
        "searchSelfStore",
        "indexSearchShop"
      ]
    }
  ],
  "baseNoticeManage": [
    {
      "title": "短信设置",
      "fields": [
        "smsProvider",
        "smsAliyunChannel",
        "smsHuaweiAppKey",
        "smsHuaweiAppSecret",
        "smsHuaweiChannel",
        "smsHuaweiEndpoint",
        "smsHuaweiShopMobile",
        "smsHuaweiSignName",
        "smsKeyId",
        "smsKeySecret",
        "smsSenderId",
        "smsShopMobile",
        "smsSignName",
        "smsTencentSdkAppId",
        "smsTencentSecretId",
        "smsTencentSecretKey",
        "smsTencentShopMobile",
        "smsTencentSignName",
        "smsVolcengineAccessKey",
        "smsVolcengineSecretKey",
        "smsVolcengineShopMobile",
        "smsVolcengineSignName",
        "smsVolcengineSmsAccount"
      ]
    },
    {
      "title": "邮件通知",
      "fields": [
        "mailService",
        "smtpSsl",
        "smtpHost",
        "smtpPort",
        "smtpUser",
        "smtpPass",
        "smtpMail",
        "mailCharset",
        "testMailAddress",
        "serviceEmail",
        "sendConfirmEmail",
        "orderPayEmail",
        "sendServiceEmail",
        "sendShipEmail"
      ]
    }
  ],
  "storeSettingsManage": [
    {
      "title": "基本设置",
      "fields": [
        "maxRecommendProductCount",
        "maxSubAdministrator",
        "storePostAllocationStatus",
        "storeIndependentGoods",
        "shopProductNeedCheck"
      ]
    },
    {
      "title": "商品分配设置",
      "fields": [
        "storeAssignProductName",
        "storeAssignProductImage",
        "storeAssignProductPrice"
      ]
    },
    {
      "title": "库存与费用设置",
      "fields": [
        "storeUseSoloProductStock",
        "storeUseTotalProductStock",
        "storeAssignDeliveryServiceFee",
        "storeAssignServerServiceFee"
      ]
    },
    {
      "title": "下单与门店展示",
      "fields": [
        "storeCustomSubmitShippingType",
        "storeShowOtherCityStore"
      ]
    }
  ],
  "vendorSettingManage": [
    {
      "title": "基本设置",
      "fields": [
        "vendorProductNeedCheck",
        "vendorMaxSubAdministrator"
      ]
    },
    {
      "title": "价格设置",
      "fields": [
        "vendorSetPriceType",
        "vendorSetPriceAutoValue"
      ]
    }
  ]
};
