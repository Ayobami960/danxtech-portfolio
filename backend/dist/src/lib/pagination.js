import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../config/constants.js";
export const paginationSchema = z
    .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
        .number()
        .int()
        .min(1)
        .max(MAX_PAGE_SIZE)
        .default(DEFAULT_PAGE_SIZE),
})
    .strict();
export const paginated = (data, total, pagination) => ({
    data,
    meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
    },
});
//# sourceMappingURL=pagination.js.map