type Document = {
    fileId: string;
    fileName: string;
    fileUrl: string;
};
export declare const deleteDocuments: (documents?: Array<{
    fileId: string;
} | string>) => Promise<PromiseSettledResult<void>[]>;
export declare const uploadDocuments: <T extends Document>(folder: string, documents: T[]) => Promise<{
    documents: T[];
    uploadedIds: string[];
}>;
export {};
