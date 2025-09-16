import { OrganizationRole } from "@prisma/client";
import { faker } from "@faker-js/faker";
import type { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { categoryRouter } from "./category";
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

const createUserForTest = async (input?: {
  email?: string;
  name?: string | null;
}) => {
  const email = input?.email ?? faker.internet.email().toLowerCase();
  const name = input?.name ?? null;

  const user = await db.user.create({
    data: {
      email,
      name,
    },
  });

  return { id: user.id, email, name: user.name ?? name };
};

describe("categoryRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupOrganization = async () => {
    const admin = await createUserForTest({ name: "Admin" });

    const organization = await db.organization.create({
      data: {
        name: faker.company.name(),
        createdById: admin.id,
      },
    });

    await db.membership.create({
      data: {
        organizationId: organization.id,
        userId: admin.id,
        role: OrganizationRole.ADMIN,
      },
    });

    return { admin, organization };
  };

  it("allows admins to create categories and enforces uniqueness", async () => {
    const { admin, organization } = await setupOrganization();

    const caller = categoryRouter.createCaller({
      db,
      session: buildSession(admin),
      headers: new Headers(),
    });

    const created = await caller.create({
      organizationId: organization.id,
      name: "Travel",
      description: "Trips and transportation",
    });

    expect(created.name).toBe("Travel");
    expect(created.description).toBe("Trips and transportation");

    await expect(
      caller.create({
        organizationId: organization.id,
        name: "travel",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" as TRPCError["code"] });
  });

  it("supports listing categories for members", async () => {
    const { organization } = await setupOrganization();

    const category = await db.expenseCategory.create({
      data: {
        organizationId: organization.id,
        name: "Meals",
      },
    });

    const member = await createUserForTest({ name: "Member" });

    await db.membership.create({
      data: {
        organizationId: organization.id,
        userId: member.id,
        role: OrganizationRole.MEMBER,
      },
    });

    const memberCaller = categoryRouter.createCaller({
      db,
      session: buildSession(member),
      headers: new Headers(),
    });

    const list = await memberCaller.list({ organizationId: organization.id });

    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(category.id);

    const outsider = await createUserForTest({ name: "Outsider" });

    const outsiderCaller = categoryRouter.createCaller({
      db,
      session: buildSession(outsider),
      headers: new Headers(),
    });

    await expect(
      outsiderCaller.list({ organizationId: organization.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" as TRPCError["code"] });
  });

  it("prevents members from managing categories", async () => {
    const { admin, organization } = await setupOrganization();

    const member = await createUserForTest({ name: "Member" });

    await db.membership.create({
      data: {
        organizationId: organization.id,
        userId: member.id,
        role: OrganizationRole.MEMBER,
      },
    });

    const memberCaller = categoryRouter.createCaller({
      db,
      session: buildSession(member),
      headers: new Headers(),
    });

    await expect(
      memberCaller.create({
        organizationId: organization.id,
        name: "Supplies",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" as TRPCError["code"] });

    const adminCaller = categoryRouter.createCaller({
      db,
      session: buildSession(admin),
      headers: new Headers(),
    });

    const category = await adminCaller.create({
      organizationId: organization.id,
      name: "Supplies",
    });

    await expect(
      memberCaller.update({
        organizationId: organization.id,
        categoryId: category.id,
        name: "Office Supplies",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" as TRPCError["code"] });

    await expect(
      memberCaller.delete({
        organizationId: organization.id,
        categoryId: category.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" as TRPCError["code"] });
  });

  it("allows admins to update and delete categories", async () => {
    const { admin, organization } = await setupOrganization();

    const adminCaller = categoryRouter.createCaller({
      db,
      session: buildSession(admin),
      headers: new Headers(),
    });

    const category = await adminCaller.create({
      organizationId: organization.id,
      name: "Travel",
    });

    const updated = await adminCaller.update({
      organizationId: organization.id,
      categoryId: category.id,
      name: "Travel & Lodging",
      description: "Includes flights, hotels, and transit",
    });

    expect(updated.name).toBe("Travel & Lodging");
    expect(updated.description).toBe("Includes flights, hotels, and transit");

    await adminCaller.delete({
      organizationId: organization.id,
      categoryId: category.id,
    });

    const remaining = await db.expenseCategory.findMany({
      where: { organizationId: organization.id },
    });

    expect(remaining).toHaveLength(0);
  });
});
