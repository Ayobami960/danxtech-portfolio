import { asyncHandler } from "../lib/async-handler.js";
import {
  paginated,
  paginationSchema,
  type Pagination,
} from "../lib/pagination.js";
import { query } from "../lib/request.js";
import { z } from "zod";

export const activityQuerySchema = paginationSchema
  .extend({ entity: z.string().trim().max(60).optional() })
  .strict();

type ActivityQuery = Pagination & { entity?: string };
import { listAuditLogs } from "../repositories/audit.repository.js";
import { dashboardStats } from "../services/stats.service.js";

export const getStats = asyncHandler(async (_request, response) => {
  response.status(200).json(await dashboardStats());
});

export const getActivity = asyncHandler(async (request, response) => {
  const { page, pageSize, entity } = query<ActivityQuery>(request);
  const { rows, total } = await listAuditLogs(page, pageSize, entity);
  response.status(200).json(paginated(rows, total, { page, pageSize }));
});
