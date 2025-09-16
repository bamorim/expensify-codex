import { OrganizationRole } from "@prisma/client";
import { faker } from "@faker-js/faker";
import type { TRPCError } from "@trpc/server";
import { expect, describe, it, vi, beforeEach } from "vitest";

import { organizationRouter } from "./organization";
import { db } from "~/server/db";

vi.mock("~/server/db");
vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

const buildSession = (user: { id: string; email: string; name?: string | null }) => ({
  user: {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email,
  },
  expires: "2099-12-31T23:59:59.999Z",
});

describe("organizationRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an organization and assigns the creator as admin", async () => {
    const user = await db.user.create({
      data: {
        email: faker.internet.email().toLowerCase(),
        name: "Creator",
      },
    });

    const caller = organizationRouter.createCaller({
      db,
      session: buildSession({
        id: user.id,
        email: user.email!,
        name: user.name,
      }),
      headers: new Headers(),
    });

    const result = await caller.create({ name: "Acme Corp" });

    expect(result.organization.name).toBe("Acme Corp");
    expect(result.membership.role).toBe(OrganizationRole.ADMIN);

    const organization = await db.organization.findUnique({
      where: { id: result.organization.id },
    });
    expect(organization?.createdById).toBe(user.id);

    const membership = await db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: result.organization.id,
        },
      },
    });

    expect(membership?.role).toBe(OrganizationRole.ADMIN);
  });

  it("allows an admin to invite a user who can accept the invitation", async () => {
    const admin = await db.user.create({
      data: {
        email: faker.internet.email().toLowerCase(),
        name: "Admin", 
      },
    });

    const inviteeEmail = faker.internet.email().toLowerCase();
    const invitee = await db.user.create({
      data: {
        email: inviteeEmail,
        name: "Member",
      },
    });

    const adminCaller = organizationRouter.createCaller({
      db,
      session: buildSession({
        id: admin.id,
        email: admin.email!,
        name: admin.name,
      }),
      headers: new Headers(),
    });

    const { organization } = await adminCaller.create({ name: "Globex" });

    const invitation = await adminCaller.invite({
      organizationId: organization.id,
      email: inviteeEmail,
      role: OrganizationRole.MEMBER,
    });

    expect(invitation.email).toBe(inviteeEmail);
    expect(invitation.role).toBe(OrganizationRole.MEMBER);

    const inviteeCaller = organizationRouter.createCaller({
      db,
      session: buildSession({
        id: invitee.id,
        email: invitee.email!,
        name: invitee.name,
      }),
      headers: new Headers(),
    });

    const pendingBeforeAccept = await inviteeCaller.myInvitations();
    expect(pendingBeforeAccept).toHaveLength(1);

    await inviteeCaller.acceptInvitation({ token: invitation.token });

    const membership = await db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: invitee.id,
          organizationId: organization.id,
        },
      },
    });

    expect(membership?.role).toBe(OrganizationRole.MEMBER);

    const pendingAfterAccept = await inviteeCaller.myInvitations();
    expect(pendingAfterAccept).toHaveLength(0);

    const storedInvitation = await db.invitation.findUnique({
      where: { id: invitation.id },
    });
    expect(storedInvitation?.acceptedAt).not.toBeNull();
    expect(storedInvitation?.acceptedById).toBe(invitee.id);
  });

  it("prevents non-admin members from inviting others", async () => {
    const admin = await db.user.create({
      data: {
        email: faker.internet.email().toLowerCase(),
      },
    });

    const member = await db.user.create({
      data: {
        email: faker.internet.email().toLowerCase(),
      },
    });

    const adminCaller = organizationRouter.createCaller({
      db,
      session: buildSession({
        id: admin.id,
        email: admin.email!,
        name: admin.name,
      }),
      headers: new Headers(),
    });

    const { organization } = await adminCaller.create({ name: "Umbrella" });

    await db.membership.create({
      data: {
        organizationId: organization.id,
        userId: member.id,
        role: OrganizationRole.MEMBER,
      },
    });

    const memberCaller = organizationRouter.createCaller({
      db,
      session: buildSession({
        id: member.id,
        email: member.email!,
        name: member.name,
      }),
      headers: new Headers(),
    });

    await expect(
      memberCaller.invite({
        organizationId: organization.id,
        email: faker.internet.email(),
        role: OrganizationRole.MEMBER,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" as TRPCError["code"] });
  });

  it("blocks organization scoped access for non members", async () => {
    const admin = await db.user.create({
      data: { email: faker.internet.email().toLowerCase() },
    });

    const outsider = await db.user.create({
      data: { email: faker.internet.email().toLowerCase() },
    });

    const adminCaller = organizationRouter.createCaller({
      db,
      session: buildSession({
        id: admin.id,
        email: admin.email!,
        name: admin.name,
      }),
      headers: new Headers(),
    });

    const { organization } = await adminCaller.create({ name: "Wayne Enterprises" });

    const outsiderCaller = organizationRouter.createCaller({
      db,
      session: buildSession({
        id: outsider.id,
        email: outsider.email!,
        name: outsider.name,
      }),
      headers: new Headers(),
    });

    await expect(
      outsiderCaller.listInvitations({ organizationId: organization.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" as TRPCError["code"] });
  });

  it("does not allow inviting yourself", async () => {
    const admin = await db.user.create({
      data: { email: faker.internet.email().toLowerCase() },
    });

    const adminCaller = organizationRouter.createCaller({
      db,
      session: buildSession({
        id: admin.id,
        email: admin.email!,
        name: admin.name,
      }),
      headers: new Headers(),
    });

    const { organization } = await adminCaller.create({ name: "Initech" });

    await expect(
      adminCaller.invite({
        organizationId: organization.id,
        email: admin.email!,
        role: OrganizationRole.ADMIN,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" as TRPCError["code"] });
  });

  it("rejects invitations for users that are already members", async () => {
    const admin = await db.user.create({
      data: { email: faker.internet.email().toLowerCase() },
    });

    const member = await db.user.create({
      data: { email: faker.internet.email().toLowerCase() },
    });

    const adminCaller = organizationRouter.createCaller({
      db,
      session: buildSession({
        id: admin.id,
        email: admin.email!,
        name: admin.name,
      }),
      headers: new Headers(),
    });

    const { organization } = await adminCaller.create({ name: "Hooli" });

    await db.membership.create({
      data: {
        organizationId: organization.id,
        userId: member.id,
        role: OrganizationRole.MEMBER,
      },
    });

    await expect(
      adminCaller.invite({
        organizationId: organization.id,
        email: member.email!,
        role: OrganizationRole.MEMBER,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" as TRPCError["code"] });
  });
});
