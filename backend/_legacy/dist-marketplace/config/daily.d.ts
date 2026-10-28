export interface DailyRoom {
    id: string;
    name: string;
    url: string;
    created_at: string;
}
export declare const createDailyRoom: (roomName: string) => Promise<DailyRoom>;
