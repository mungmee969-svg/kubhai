import { z } from "zod";
import { QUOTATION_DEPOSIT_TYPES, QUOTATION_ITEM_TYPES } from "@/lib/domain/enums";

export const quotationLineSchema = z.object({
  id: z.string().optional(),
  type: z.enum(QUOTATION_ITEM_TYPES),
  description: z.string().trim().min(1).max(200),
  quantity: z.number().min(0).max(9999),
  unitPrice: z.number().min(0).max(10_000_000),
  note: z.string().trim().max(500).nullable().optional(),
});

export const quotationDraftSchema = z.object({
  items: z.array(quotationLineSchema).max(50),
  discountAmount: z.number().min(0).max(10_000_000).optional(),
  depositType: z.enum(QUOTATION_DEPOSIT_TYPES),
  depositValue: z.number().min(0).max(10_000_000).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  terms: z.string().trim().max(4000).nullable().optional(),
  includedHoursPerDay: z.number().min(0).max(24).nullable().optional(),
  overtimeRatePerHour: z.number().min(0).max(100_000).nullable().optional(),
  validUntil: z.string().nullable().optional(),
});

export const quotationChangeSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});
