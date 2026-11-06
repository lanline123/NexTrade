export interface TabbarDataResponse {
    code: number;
    data: Item;
    message: string;
}

export interface Item {
    id: number;
    decorateSn: string;
    decorateName: string;
    data: Data;
}

export interface Data {
    navList: List[];
    picList: Array<any[] | List>;
    backgroundColor: string;
    backgroundPic: BackgroundPic;
}

export interface BackgroundPic {
    picUrl: string;
    picThumb: string;
    picId: number;
    picName: string;
}

export interface List {
    picActiveThumb: string;
    picActiveUrl: string;
    picId: number;
    picThumb: string;
    picUrl: string;
    picName: string;
    picTitle: string;
    picLink?: PicLink;
}

export interface PicLink {
    path: string;
    label: string;
    name: string;
    link: string;
    appLink: string;
}
