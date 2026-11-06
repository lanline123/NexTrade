export interface ByLocationResponse {
    code: number;
    message: string;
    data: ByLocationData;
}

export interface ByLocationData {
    regionId: number;
    regionName: string;
    parentId: number;
    level: number;
    isHot: number;
    firstWord: string;
    centor?: string;
    longitude?: number;
    latitude?: number;
}
