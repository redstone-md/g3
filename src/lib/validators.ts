import * as z from "zod";

/** Shared validation schemas for auth + RBAC mutations (server and client). */

export const loginSchema = z.object({
  email: z.email({ error: "Enter a valid email." }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Password is required." }),
});
export type LoginInput = z.infer<typeof loginSchema>;

const passwordSchema = z
  .string()
  .min(8, { error: "At least 8 characters." })
  .regex(/[a-zA-Z]/, { error: "Include a letter." })
  .regex(/[0-9]/, { error: "Include a number." });

export const roleSchema = z.object({
  name: z.string().min(2, { error: "At least 2 characters." }).max(40).trim(),
  description: z.string().max(200).trim().optional().or(z.literal("")),
  permissions: z.array(z.string()).default([]),
  parentIds: z.array(z.string()).default([]),
});
export type RoleInput = z.infer<typeof roleSchema>;

export const createUserSchema = z.object({
  email: z.email({ error: "Enter a valid email." }).trim().toLowerCase(),
  name: z.string().max(80).trim().optional().or(z.literal("")),
  password: passwordSchema,
  roleIds: z.array(z.string()).default([]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().max(80).trim().optional().or(z.literal("")),
  roleIds: z.array(z.string()).optional(),
  password: passwordSchema.optional().or(z.literal("")),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** Self-service profile update (own account). */
export const profileSchema = z.object({
  name: z.string().max(80).trim().optional().or(z.literal("")),
  avatar: z.string().max(40).nullable().optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;
