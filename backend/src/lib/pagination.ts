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

export type Pagination = z.infer<typeof paginationSchema>;

export type Paginated<T> = {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
};

export const paginated = <T>(
  data: T[],
  total: number,
  pagination: Pagination,
): Paginated<T> => ({
  data,
  meta: {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
  },
});
