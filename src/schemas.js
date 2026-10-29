import { z } from "zod";

export const createLinkSchema = z.object({
    target_url: z.url({
        protocol: /^https?$/ ,
    }),
    code: z
        .string()
        .trim()
        .min(3)
        .max(16)
        .regex(/^[A-Za-z0-9_-]+$/)
        .optional(),
    expires_at: z.iso.datetime({
        offset: true,
    }).optional(),
}).strict();


export const clickCursorSchema = z.object({
    clicked_at: z.iso.datetime(),
    id: z.number().int().positive(),
});

export const clickPaginationQuerySchema = z.object({
    after: z.preprocess(
        (value) => (value === "" ? undefined : value),
        z.string()
            .regex(/^[A-Za-z0-9_-]+$/, "Invalid pagination cursor")
            .optional(),
    ),
    limit: z.preprocess(
        (value) => (value === undefined ? "20" : value),
        z.string()
            .regex(/^\d+$/, "Limit must be a positive integer")
            .transform(Number)
            .pipe(z.number().int().min(1).max(100)),
    ),
});