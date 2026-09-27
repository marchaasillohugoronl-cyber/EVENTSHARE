import { z } from 'zod';

// Elimina caracteres de control. El texto se guarda como texto plano y React/Compose lo escapan al mostrarlo.
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E]/g, '').trim();
export const text = (min: number, max: number) => z.string().transform(clean).pipe(z.string().min(min).max(max));

export const uuid = z.string().uuid();
export const eventCode = z.string().regex(/^[A-Za-z0-9]{6,12}$/).transform((s) => s.toUpperCase());
const email = z.string().email().max(254).transform((s) => s.toLowerCase().trim());
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const ALLOWED_IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export const registerSchema = z.object({ name: text(1, 80), email, password: z.string().min(8).max(128) });
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });
export const googleSchema = z.object({ idToken: z.string().min(20).max(4096), eventCode: eventCode.optional() });
export const guestSchema = z.object({ name: text(1, 40), eventCode });

export const eventCreateSchema = z.object({
  name: text(1, 120),
  description: text(0, 1000).optional(),
  eventDate: z.string().datetime({ offset: true }).nullable().optional(),
  primaryColor: hexColor.optional(),
  moderationEnabled: z.boolean().optional(),
  coverKey: z.string().max(300).optional(),
});
export const eventUpdateSchema = eventCreateSchema
  .partial()
  .extend({ coverKey: z.string().max(300).nullable().optional(), status: z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']).optional() });

export const uploadSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().int().positive().max(MAX_PHOTO_BYTES),
});
export const postCreateSchema = z
  .object({ photoKey: z.string().max(300).optional(), message: text(0, 500).optional() })
  .refine((v) => !!v.photoKey || !!v.message, { message: 'Agrega una foto o un mensaje' });
export const commentSchema = z.object({ message: text(1, 300) });
export const moderationSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED', 'PENDING']) });
export const memberPatchSchema = z.object({ isBlocked: z.boolean() });

export const pageQuery = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  photos: z.enum(['1', '0']).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  hasMessage: z.enum(['1', '0']).optional(),
});
