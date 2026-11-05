performance.mark('next-start');
import path from 'path'
import { fileURLToPath } from 'url'
import module from 'module'
const require = module.createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))


const dir = path.join(__dirname)

process.env.NODE_ENV = 'production'
process.chdir(__dirname)

const currentPort = parseInt(process.env.PORT, 10) || 3000
const hostname = process.env.HOSTNAME || '0.0.0.0'

let keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT, 10)
const nextConfig = {"env":{},"webpack":null,"eslint":{"ignoreDuringBuilds":false},"typescript":{"ignoreBuildErrors":false,"tsconfigPath":"tsconfig.json"},"distDir":"./.next","cleanDistDir":true,"assetPrefix":"","cacheMaxMemorySize":52428800,"configOrigin":"next.config.mjs","useFileSystemPublicRoutes":true,"generateEtags":true,"pageExtensions":["tsx","ts","jsx","js"],"poweredByHeader":false,"compress":true,"analyticsId":"","images":{"deviceSizes":[640,750,828,1080,1200,1920,2048,3840],"imageSizes":[16,32,48,64,96,128,256,384],"path":"/_next/image","loader":"default","loaderFile":"","domains":[],"disableStaticImages":false,"minimumCacheTTL":60,"formats":["image/webp"],"dangerouslyAllowSVG":false,"contentSecurityPolicy":"script-src 'none'; frame-src 'none'; sandbox;","contentDispositionType":"inline","remotePatterns":[{"protocol":"https","hostname":"**"},{"protocol":"http","hostname":"**"}],"unoptimized":false},"devIndicators":{"buildActivity":true,"buildActivityPosition":"bottom-right"},"onDemandEntries":{"maxInactiveAge":60000,"pagesBufferLength":5},"amp":{"canonicalBase":""},"basePath":"","sassOptions":{},"trailingSlash":false,"i18n":null,"productionBrowserSourceMaps":false,"optimizeFonts":true,"excludeDefaultMomentLocales":true,"serverRuntimeConfig":{},"publicRuntimeConfig":{},"reactProductionProfiling":false,"reactStrictMode":true,"httpAgentOptions":{"keepAlive":true},"outputFileTracing":true,"staticPageGenerationTimeout":60,"swcMinify":true,"output":"standalone","modularizeImports":{"@mui/icons-material":{"transform":"@mui/icons-material/{{member}}"},"lodash":{"transform":"lodash/{{member}}"}},"experimental":{"multiZoneDraftMode":false,"prerenderEarlyExit":false,"serverMinification":true,"serverSourceMaps":false,"linkNoTouchStart":false,"caseSensitiveRoutes":false,"clientRouterFilter":true,"clientRouterFilterRedirects":false,"fetchCacheKeyPrefix":"","middlewarePrefetch":"flexible","optimisticClientCache":true,"manualClientBasePath":false,"cpus":15,"memoryBasedWorkersCount":false,"isrFlushToDisk":true,"workerThreads":false,"optimizeCss":false,"nextScriptWorkers":false,"scrollRestoration":false,"externalDir":false,"disableOptimizedLoading":false,"gzipSize":true,"craCompat":false,"esmExternals":true,"fullySpecified":false,"outputFileTracingRoot":"D:\\tigshop\\java-b2b2b-pro-v5.8.57\\rust\\web\\pc-semi","swcTraceProfiling":false,"forceSwcTransforms":false,"largePageDataBytes":128000,"adjustFontFallbacks":false,"adjustFontFallbacksWithSizeAdjust":false,"typedRoutes":false,"instrumentationHook":false,"bundlePagesExternals":false,"parallelServerCompiles":false,"parallelServerBuildTraces":false,"ppr":false,"missingSuspenseWithCSRBailout":true,"optimizeServerReact":true,"useEarlyImport":false,"staleTimes":{"dynamic":30,"static":300},"optimizePackageImports":["lucide-react","date-fns","lodash-es","ramda","antd","react-bootstrap","ahooks","@ant-design/icons","@headlessui/react","@headlessui-float/react","@heroicons/react/20/solid","@heroicons/react/24/solid","@heroicons/react/24/outline","@visx/visx","@tremor/react","rxjs","@mui/material","@mui/icons-material","recharts","react-use","@material-ui/core","@material-ui/icons","@tabler/icons-react","mui-core","react-icons/ai","react-icons/bi","react-icons/bs","react-icons/cg","react-icons/ci","react-icons/di","react-icons/fa","react-icons/fa6","react-icons/fc","react-icons/fi","react-icons/gi","react-icons/go","react-icons/gr","react-icons/hi","react-icons/hi2","react-icons/im","react-icons/io","react-icons/io5","react-icons/lia","react-icons/lib","react-icons/lu","react-icons/md","react-icons/pi","react-icons/ri","react-icons/rx","react-icons/si","react-icons/sl","react-icons/tb","react-icons/tfi","react-icons/ti","react-icons/vsc","react-icons/wi"],"trustHostHeader":false,"isExperimentalCompile":false},"configFileName":"next.config.mjs","_originalRewrites":{"beforeFiles":[],"afterFiles":[{"source":"/api/:path*","destination":"https://battery.recy.cc/api/:path*"},{"source":"/adminapi/:path*","destination":"https://battery.recy.cc/adminapi/:path*"},{"source":"/static/:path*","destination":"https://battery.recy.cc/static/:path*"},{"source":"/seckill/List","destination":"/seckill"},{"source":"/exchange/List","destination":"/exchange"},{"source":"/article/news/List","destination":"/article/news/list"},{"source":"/article/news/Info","destination":"/article/news/list"},{"source":"/order/alipay","destination":"/order/pay"},{"source":"/order/wechat","destination":"/order/pay"},{"source":"/order/paypal","destination":"/order/pay"},{"source":"/order/stripe","destination":"/order/pay"},{"source":"/order/huifu","destination":"/order/pay"},{"source":"/order/lakala","destination":"/order/pay"},{"source":"/order/yeepay","destination":"/order/pay"},{"source":"/order/yunpay","destination":"/order/pay"},{"source":"/order/yabanpay","destination":"/order/pay"},{"source":"/shop/List","destination":"/shop"},{"source":"/search.v1","destination":"/search"},{"source":"/item/:id","destination":"/product/:id"},{"source":"/member/point/List","destination":"/member/points"},{"source":"/member/browsingHistory/List","destination":"/member/browsingHistory"},{"source":"/member/order/List","destination":"/member/order/list"},{"source":"/member/order/Info","destination":"/member/order/detail"},{"source":"/member/order/claimInfo","destination":"/member/order/claimInfo"},{"source":"/member/pin/List","destination":"/member/group"},{"source":"/member/pin/Group","destination":"/member/group/info"},{"source":"/member/Login","destination":"/login"},{"source":"/member/Register","destination":"/register"},{"source":"/member/BindMobilePhone","destination":"/member/security"},{"source":"/article/issue/Index","destination":"/article/issue"},{"source":"/shop/search/:id","destination":"/search"},{"source":"/category/:slug","destination":"/category"},{"source":"/member/orderInfo","destination":"/member/order/list"},{"source":"/member/comment/Info","destination":"/member/comment/info"},{"source":"/member/return/List","destination":"/member/aftersales"},{"source":"/member/return/Log","destination":"/member/aftersales"},{"source":"/member/account/Deposit","destination":"/member/account/deposit"},{"source":"/member/account/Detail","destination":"/member/account/detail"},{"source":"/member/account/Log","destination":"/member/account/log"},{"source":"/member/account/CardManagement","destination":"/member/account/cardManagement"},{"source":"/member/account/Raplytocard","destination":"/member/account/raplytocard"},{"source":"/member/userInvoice/Info","destination":"/member/userInvoice/info"},{"source":"/member/userCertification/Info","destination":"/member/userCertification"}],"fallback":[]}}

process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig)

require('next')
const { startServer } = require('next/dist/server/lib/start-server')

if (
  Number.isNaN(keepAliveTimeout) ||
  !Number.isFinite(keepAliveTimeout) ||
  keepAliveTimeout < 0
) {
  keepAliveTimeout = undefined
}

startServer({
  dir,
  isDev: false,
  config: nextConfig,
  hostname,
  port: currentPort,
  allowRetry: false,
  keepAliveTimeout,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});