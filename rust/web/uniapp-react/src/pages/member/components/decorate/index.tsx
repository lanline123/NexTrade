import { View } from "@tarojs/components";

import type { MemberDecorateModule } from "@/types/decorate/member-decorate";

import UserInfo from "./userInfo";
import UserInfoV2 from "./userInfoV2";
import UserInfo3 from "./userInfo3";
import OrderEntry from "./orderEntry";
import OrderEntryV2 from "./orderEntryV2";
import MyWallet from "./myWallet";
import MyWalletV2 from "./myWalletV2";
import AdImage from "./adImage";
import MyServiceV2 from "./myServiceV2";
import Account from "./account";
import FixedFunctionalArea from "./fixedFunctionalArea";
import Advertising from "./advertising";
import MyService from "./myService";

interface Props {
    modules?: MemberDecorateModule[];
    /** 沉浸式标题：仅作用于首个 userInfo3，使其渐变背景延伸到页面顶部 */
    immersive?: boolean;
}

/**
 * 会员中心装修模块容器（自旧 pages/member/components/decorate/index.vue 移植）
 * - 根据后台配置的模块类型动态渲染组件
 */
export default function MemberDecorate({ modules = [], immersive = false }: Props) {
    return (
        <>
            {modules.map((item, index) => {
                if (item.isShow === false) return null;
                const data = item.module || {};

                switch (item.type) {
                    // 用户信息
                    case "user-info":
                    case "userInfo":
                        return (
                            <View key={index}>
                                <UserInfo data={data} />
                            </View>
                        );
                    // 用户信息 V2
                    case "user-info-v2":
                    case "userInfoV2":
                        return (
                            <View key={index}>
                                <UserInfoV2 data={data} />
                            </View>
                        );
                    // 用户信息3
                    case "user-info3":
                    case "userInfo3":
                        return (
                            <View key={index}>
                                <UserInfo3 data={data} immersive={immersive && index === 0} />
                            </View>
                        );
                    // 订单入口
                    case "order-entry":
                    case "orderEntry":
                        return (
                            <View key={index}>
                                <OrderEntry data={data} />
                            </View>
                        );
                    // 订单入口 V2（跨境「我的订单2」）
                    case "order-entry-v2":
                    case "orderEntryV2":
                        return (
                            <View key={index}>
                                <OrderEntryV2 data={data} />
                            </View>
                        );
                    // 我的钱包
                    case "my-wallet":
                    case "myWallet":
                        return (
                            <View key={index}>
                                <MyWallet data={data} />
                            </View>
                        );
                    // 我的钱包 V2
                    case "my-wallet-v2":
                    case "myWalletV2":
                        return (
                            <View key={index}>
                                <MyWalletV2 data={data} />
                            </View>
                        );
                    // 广告图
                    case "ad-image":
                    case "adImage":
                        return (
                            <View key={index}>
                                <AdImage data={data} />
                            </View>
                        );
                    // 我的服务（layoutStyle + serviceList）
                    case "my-service":
                    case "myService":
                        return (
                            <View key={index}>
                                <MyServiceV2 data={data} />
                            </View>
                        );
                    // 账号模块
                    case "account":
                        return (
                            <View key={index}>
                                <Account data={data} />
                            </View>
                        );
                    // 固定功能区
                    case "fixed-functional-area":
                    case "fixedFunctionalArea":
                        return (
                            <View key={index}>
                                <FixedFunctionalArea data={data} />
                            </View>
                        );
                    // 历史协议兜底：广告位（bannerList）
                    case "bannerList":
                        return data?.bannerList?.picUrl ? (
                            <View key={index}>
                                <Advertising data={data.bannerList} />
                            </View>
                        ) : null;
                    // 历史协议兜底：菜单（menus）
                    case "menus":
                        return data ? (
                            <View key={index}>
                                <MyService menuType={data?.menuType} data={data?.menuList} />
                            </View>
                        ) : null;
                    default:
                        return null;
                }
            })}
        </>
    );
}