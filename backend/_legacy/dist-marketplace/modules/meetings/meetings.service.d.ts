export declare const startMeeting: (conversationId: string, actorId: string) => Promise<{
    id: string;
    joinUrl: string;
    startedAt: Date;
}>;
export declare const endMeetingByRoomName: (roomName: string) => Promise<{
    id: string;
    conversationId: string;
    durationMinutes: number;
} | null>;
