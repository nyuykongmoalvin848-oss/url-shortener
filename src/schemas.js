import { z } from 'zod';

export const createLinkSchema = z.object({
    target_url: z.string().url({ message: "invalid URL"}),
    code: z.string().max(16)
    .regex(/[A-Za-z0-9_-]{3,16}/, { message: "code must be alphanumeric" })
    .optional(),
    expires_at: z.string().datetime({ message: "invalid datetime" }).nullable().optional()
});