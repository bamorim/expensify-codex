import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  requireOrganizationAdmin,
  requireOrganizationMembership,
} from "~/server/api/trpc";

const categoryInput = z.object({
  organizationId: z.string().cuid(),
});

const normalizeName = (value: string) => value.trim();

const ensureUniqueName = async (
  db: PrismaClient,
  params: {
    organizationId: string;
    name: string;
    excludeId?: string;
  },
) => {
  const existing = await db.expenseCategory.findFirst({
    where: {
      organizationId: params.organizationId,
      id: params.excludeId ? { not: params.excludeId } : undefined,
      name: {
        equals: params.name,
        mode: Prisma.QueryMode.insensitive,
      },
    },
  });

  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "A category with this name already exists",
    });
  }
};

export const categoryRouter = createTRPCRouter({
  list: protectedProcedure
    .input(categoryInput)
    .query(async ({ ctx, input }) => {
      await requireOrganizationMembership(ctx, input.organizationId);

      const categories = await ctx.db.expenseCategory.findMany({
        where: { organizationId: input.organizationId },
        orderBy: { name: "asc" },
      });

      return categories;
    }),

  create: protectedProcedure
    .input(
      categoryInput.extend({
        name: z
          .string()
          .min(2, "Category name must be at least 2 characters long")
          .max(120, "Category name must be at most 120 characters long"),
        description: z
          .string()
          .max(500, "Description must be at most 500 characters long")
          .optional()
          .transform((value) => {
            if (value === undefined) return null;
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : null;
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOrganizationAdmin(ctx, input.organizationId);

      const name = normalizeName(input.name);
      if (!name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Category name is required",
        });
      }

      await ensureUniqueName(ctx.db, {
        organizationId: input.organizationId,
        name,
      });

      const category = await ctx.db.expenseCategory.create({
        data: {
          organizationId: input.organizationId,
          name,
          description: input.description,
        },
      });

      return category;
    }),

  update: protectedProcedure
    .input(
      categoryInput.extend({
        categoryId: z.string().cuid(),
        name: z
          .string()
          .min(2, "Category name must be at least 2 characters long")
          .max(120, "Category name must be at most 120 characters long"),
        description: z
          .string()
          .max(500, "Description must be at most 500 characters long")
          .optional()
          .transform((value) => {
            if (value === undefined) return null;
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : null;
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOrganizationAdmin(ctx, input.organizationId);

      const category = await ctx.db.expenseCategory.findFirst({
        where: {
          id: input.categoryId,
          organizationId: input.organizationId,
        },
      });

      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      const name = normalizeName(input.name);
      if (!name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Category name is required",
        });
      }

      await ensureUniqueName(ctx.db, {
        organizationId: input.organizationId,
        name,
        excludeId: category.id,
      });

      return ctx.db.expenseCategory.update({
        where: { id: category.id },
        data: {
          name,
          description: input.description,
        },
      });
    }),

  delete: protectedProcedure
    .input(
      categoryInput.extend({
        categoryId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOrganizationAdmin(ctx, input.organizationId);

      const category = await ctx.db.expenseCategory.findFirst({
        where: {
          id: input.categoryId,
          organizationId: input.organizationId,
        },
      });

      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      await ctx.db.expenseCategory.delete({ where: { id: category.id } });

      return { success: true };
    }),
});
