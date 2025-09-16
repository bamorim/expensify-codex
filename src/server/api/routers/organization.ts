import { OrganizationRole } from "@prisma/client";
import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  requireOrganizationAdmin,
  protectedProcedure,
} from "~/server/api/trpc";

const INVITATION_EXPIRATION_DAYS = 7;

const buildInvitationExpiration = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRATION_DAYS);
  return expiresAt;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const organizationRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.membership.findMany({
      where: { userId: ctx.session.user.id },
      include: { organization: true },
      orderBy: { organization: { name: "asc" } },
    });

    return memberships.map((membership) => ({
      membershipId: membership.id,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      role: membership.role,
      joinedAt: membership.createdAt,
    }));
  }),

  myInvitations: protectedProcedure.query(async ({ ctx }) => {
    const email = ctx.session.user.email?.toLowerCase();
    if (!email) {
      return [];
    }

    const now = new Date();
    const invitations = await ctx.db.invitation.findMany({
      where: {
        email,
        acceptedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      include: { organization: true },
      orderBy: { createdAt: "desc" },
    });

    return invitations.map((invitation) => ({
      id: invitation.id,
      token: invitation.token,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
      },
      invitedAt: invitation.createdAt,
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(2, "Organization name must be at least 2 characters long")
          .max(120, "Organization name must be at most 120 characters long"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const trimmedName = input.name.trim();

      if (!trimmedName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization name is required",
        });
      }

      const { organization, membership } = await ctx.db.$transaction(
        async (tx) => {
          const createdOrganization = await tx.organization.create({
            data: {
              name: trimmedName,
              createdById: ctx.session.user.id,
            },
          });

          const createdMembership = await tx.membership.create({
            data: {
              organizationId: createdOrganization.id,
              userId: ctx.session.user.id,
              role: OrganizationRole.ADMIN,
            },
          });

          return {
            organization: createdOrganization,
            membership: createdMembership,
          };
        },
      );

      return {
        organization: {
          id: organization.id,
          name: organization.name,
        },
        membership: {
          id: membership.id,
          role: membership.role,
        },
      };
    }),

  invite: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().cuid(),
        email: z.string().email(),
        role: z.nativeEnum(OrganizationRole).default(OrganizationRole.MEMBER),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOrganizationAdmin(ctx, input.organizationId);
      const email = normalizeEmail(input.email);

      if (ctx.session.user.email?.toLowerCase() === email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot invite yourself",
        });
      }

      const invitation = await ctx.db.$transaction(async (tx) => {
        const existingUser = await tx.user.findFirst({
          where: { email },
        });

        if (existingUser) {
          const existingMembership = await tx.membership.findUnique({
            where: {
              userId_organizationId: {
                userId: existingUser.id,
                organizationId: input.organizationId,
              },
            },
          });

          if (existingMembership) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "User is already a member of this organization",
            });
          }
        }

        const token = randomBytes(32).toString("hex");
        const expiresAt = buildInvitationExpiration();

        const pendingInvitation = await tx.invitation.findFirst({
          where: {
            organizationId: input.organizationId,
            email,
            acceptedAt: null,
          },
        });

        if (pendingInvitation) {
          return tx.invitation.update({
            where: { id: pendingInvitation.id },
            data: {
              role: input.role,
              token,
              invitedById: ctx.session.user.id,
              expiresAt,
              createdAt: new Date(),
            },
          });
        }

        return tx.invitation.create({
          data: {
            organizationId: input.organizationId,
            email,
            role: input.role,
            token,
            invitedById: ctx.session.user.id,
            expiresAt,
          },
        });
      });

      return {
        id: invitation.id,
        token: invitation.token,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      };
    }),

  listInvitations: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().cuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireOrganizationAdmin(ctx, input.organizationId);
      const now = new Date();
      const invitations = await ctx.db.invitation.findMany({
        where: { organizationId: input.organizationId },
        orderBy: { createdAt: "desc" },
      });

      return invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        invitedById: invitation.invitedById,
        invitedAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        status: invitation.acceptedAt
          ? "accepted"
          : invitation.expiresAt < now
            ? "expired"
            : "pending",
        token: invitation.acceptedAt ? null : invitation.token,
      }));
    }),

  acceptInvitation: protectedProcedure
    .input(
      z.object({
        token: z.string().min(1, "Invitation token is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.invitation.findUnique({
        where: { token: input.token },
        include: { organization: true },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      if (invitation.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation has already been accepted",
        });
      }

      if (invitation.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation has expired",
        });
      }

      const email = ctx.session.user.email?.toLowerCase();

      if (!email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Authenticated user does not have an email address",
        });
      }

      if (email !== invitation.email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invitation email does not match the authenticated user",
        });
      }

      const membership = await ctx.db.$transaction(async (tx) => {
        const upsertedMembership = await tx.membership.upsert({
          where: {
            userId_organizationId: {
              userId: ctx.session.user.id,
              organizationId: invitation.organizationId,
            },
          },
          create: {
            userId: ctx.session.user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
          },
          update: {
            role: invitation.role,
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            acceptedAt: new Date(),
            acceptedById: ctx.session.user.id,
          },
        });

        return upsertedMembership;
      });

      return {
        organization: {
          id: invitation.organization.id,
          name: invitation.organization.name,
        },
        membership: {
          id: membership.id,
          role: membership.role,
        },
      };
    }),
});
