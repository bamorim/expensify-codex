"use client";

import { OrganizationRole } from "@prisma/client";
import { useMemo, useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";

type Membership = RouterOutputs["organization"]["list"][number];
type PendingInvitation = RouterOutputs["organization"]["myInvitations"][number];
type OrganizationInvitation = RouterOutputs["organization"]["listInvitations"][number];

const roleLabels: Record<OrganizationRole, string> = {
  ADMIN: "Admin",
  MEMBER: "Member",
};

export function OrganizationDashboard() {
  const { data: organizations, isLoading: isLoadingOrganizations } =
    api.organization.list.useQuery();
  const { data: pendingInvitations } = api.organization.myInvitations.useQuery();

  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-white/5 p-8 shadow-lg">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              Your organizations
            </h2>
            <p className="text-sm text-white/70">
              Create a new organization or manage the ones you already belong to.
            </p>
          </div>
          <CreateOrganizationForm />
        </header>

        {isLoadingOrganizations ? (
          <p className="text-white/80">Loading organizations…</p>
        ) : organizations && organizations.length > 0 ? (
          <div className="space-y-6">
            {organizations.map((membership) => (
              <OrganizationCard key={membership.membershipId} membership={membership} />
            ))}
          </div>
        ) : (
          <p className="text-white/80">
            You are not a member of any organizations yet. Create one to get
            started or accept an invitation below.
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-white/5 p-8 shadow-lg">
        <h2 className="text-2xl font-semibold text-white">Pending invitations</h2>
        <p className="mb-6 text-sm text-white/70">
          Invitations sent to your email appear here. You can also paste an
          invitation token if you received it elsewhere.
        </p>
        <PendingInvitationsSection invitations={pendingInvitations ?? []} />
      </section>
    </div>
  );
}

function CreateOrganizationForm() {
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const createOrganization = api.organization.create.useMutation({
    onSuccess: async (result) => {
      await utils.organization.list.invalidate();
      setName("");
      setError(null);
      setSuccessMessage(`Created ${result.organization.name}`);
    },
    onError: (mutationError) => {
      setSuccessMessage(null);
      setError(mutationError.message);
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Organization name is required");
      return;
    }

    await createOrganization.mutateAsync({ name: trimmedName });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex shrink-0 flex-col items-end gap-2 sm:flex-row"
    >
      <label className="sr-only" htmlFor="organization-name">
        Organization name
      </label>
      <input
        id="organization-name"
        name="organization-name"
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="New organization name"
        className="w-full rounded-full border border-white/10 bg-white/10 px-4 py-2 text-white placeholder:text-white/60 focus:border-white focus:outline-none sm:w-64"
        required
      />
      <button
        type="submit"
        disabled={createOrganization.isPending}
        className="inline-flex items-center rounded-full bg-blue-500 px-6 py-2 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/60"
      >
        {createOrganization.isPending ? "Creating…" : "Create"}
      </button>
      <div className="min-h-[1.25rem] text-right text-sm">
        {error && <p className="text-red-300">{error}</p>}
        {successMessage && <p className="text-emerald-300">{successMessage}</p>}
      </div>
    </form>
  );
}

function OrganizationCard({ membership }: { membership: Membership }) {
  const joinedOn = useMemo(() => {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(membership.joinedAt));
  }, [membership.joinedAt]);

  return (
    <article className="rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">
            {membership.organizationName}
          </h3>
          <p className="text-sm text-white/70">
            Role: {roleLabels[membership.role]} • Joined {joinedOn}
          </p>
        </div>
        {membership.role === "ADMIN" && (
          <span className="inline-flex items-center rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-200">
            Admin
          </span>
        )}
      </div>

      {membership.role === "ADMIN" ? (
        <OrganizationAdminPanel membership={membership} />
      ) : null}
    </article>
  );
}

function OrganizationAdminPanel({ membership }: { membership: Membership }) {
  const utils = api.useUtils();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>(OrganizationRole.MEMBER);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: invitations, isLoading } = api.organization.listInvitations.useQuery({
    organizationId: membership.organizationId,
  });

  const inviteUser = api.organization.invite.useMutation({
    onSuccess: async (result, variables) => {
      setEmail("");
      setRole(OrganizationRole.MEMBER);
      setError(null);
      setFeedback(`Invitation ready for ${result.email}`);
      await Promise.all([
        utils.organization.listInvitations.invalidate({
          organizationId: variables.organizationId,
        }),
        utils.organization.list.invalidate(),
      ]);
    },
    onError: (mutationError) => {
      setFeedback(null);
      setError(mutationError.message);
    },
  });

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    await inviteUser.mutateAsync({
      organizationId: membership.organizationId,
      email,
      role,
    });
  };

  return (
    <div className="mt-6 space-y-8 border-t border-white/10 pt-6">
      <OrganizationCategoriesPanel organizationId={membership.organizationId} />

      <form
        onSubmit={handleInvite}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label
            className="mb-2 block text-sm font-medium text-white/80"
            htmlFor={`invite-email-${membership.organizationId}`}
          >
            Invite by email
          </label>
          <input
            id={`invite-email-${membership.organizationId}`}
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="person@example.com"
            className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-white placeholder:text-white/60 focus:border-white focus:outline-none"
          />
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-medium text-white/80"
            htmlFor={`invite-role-${membership.organizationId}`}
          >
            Role
          </label>
          <select
            id={`invite-role-${membership.organizationId}`}
            className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-white focus:border-white focus:outline-none"
            value={role}
            onChange={(event) =>
              setRole(event.target.value as OrganizationRole)
            }
          >
            <option value={OrganizationRole.MEMBER}>Member</option>
            <option value={OrganizationRole.ADMIN}>Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={inviteUser.isPending}
          className="inline-flex items-center justify-center rounded-full bg-green-500 px-6 py-2 font-semibold text-white transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-green-500/60"
        >
          {inviteUser.isPending ? "Sending…" : "Send invite"}
        </button>
      </form>
      <div className="min-h-[1.25rem] text-sm">
        {error && <p className="text-red-300">{error}</p>}
        {feedback && <p className="text-emerald-300">{feedback}</p>}
      </div>

      <div>
        <h4 className="mb-3 text-lg font-medium text-white">
          Invitations
        </h4>
        {isLoading ? (
          <p className="text-white/70">Loading invitations…</p>
        ) : invitations && invitations.length > 0 ? (
          <ul className="space-y-3">
            {invitations.map((invitation) => (
              <InvitationItem key={invitation.id} invitation={invitation} />
            ))}
          </ul>
        ) : (
          <p className="text-white/70">No invitations yet.</p>
        )}
      </div>
    </div>
  );
}

function InvitationItem({
  invitation,
}: {
  invitation: OrganizationInvitation;
}) {
  const statusColors: Record<OrganizationInvitation["status"], string> = {
    accepted: "text-emerald-300",
    expired: "text-red-300",
    pending: "text-amber-200",
  };

  return (
    <li className="rounded-lg border border-white/10 bg-white/5 p-4 text-white/90">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-white">{invitation.email}</p>
          <p className="text-sm text-white/70">
            Role: {roleLabels[invitation.role]} • Invited on {formatDate(invitation.invitedAt)}
          </p>
          {invitation.token && (
            <p className="mt-2 break-all text-xs text-white/60">
              Token: {invitation.token}
            </p>
          )}
        </div>
        <div className="text-right text-sm">
          <p className={statusColors[invitation.status]}>
            {invitation.status.toUpperCase()}
          </p>
          <p className="text-white/60">
            {invitation.status === "accepted"
              ? invitation.acceptedAt
                ? `Accepted ${formatDate(invitation.acceptedAt)}`
                : "Accepted"
              : `Expires ${formatDate(invitation.expiresAt)}`}
          </p>
        </div>
      </div>
    </li>
  );
}

function OrganizationCategoriesPanel({
  organizationId,
}: {
  organizationId: string;
}) {
  const utils = api.useUtils();
  const { data: categories, isLoading } = api.category.list.useQuery({
    organizationId,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const invalidateCategories = async () => {
    await utils.category.list.invalidate({ organizationId });
  };

  const createCategory = api.category.create.useMutation({
    onSuccess: async () => {
      setName("");
      setDescription("");
      setError(null);
      setFeedback("Category created");
      await invalidateCategories();
    },
    onError: (mutationError) => {
      setFeedback(null);
      setError(mutationError.message);
    },
  });

  const updateCategory = api.category.update.useMutation({
    onSuccess: async () => {
      setEditingId(null);
      setEditName("");
      setEditDescription("");
      setEditError(null);
      await invalidateCategories();
    },
    onError: (mutationError) => {
      setEditError(mutationError.message);
    },
  });

  const deleteCategory = api.category.delete.useMutation({
    onSuccess: async (_, variables) => {
      if (editingId === variables.categoryId) {
        setEditingId(null);
        setEditName("");
        setEditDescription("");
        setEditError(null);
      }
      await invalidateCategories();
    },
    onError: (mutationError) => {
      setEditError(mutationError.message);
    },
  });

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Category name is required");
      return;
    }

    await createCategory.mutateAsync({
      organizationId,
      name: trimmedName,
      description: description.trim() ? description.trim() : undefined,
    });
  };

  const startEditing = (category: RouterOutputs["category"]["list"][number]) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditDescription(category.description ?? "");
    setEditError(null);
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingId) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError("Category name is required");
      return;
    }

    setEditError(null);

    await updateCategory.mutateAsync({
      organizationId,
      categoryId: editingId,
      name: trimmedName,
      description: editDescription.trim() ? editDescription.trim() : undefined,
    });
  };

  const handleDelete = async (categoryId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this category?",
    );
    if (!confirmed) return;

    await deleteCategory.mutateAsync({
      organizationId,
      categoryId,
    });
  };

  return (
    <section>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-lg font-medium text-white">Expense categories</h4>
          <p className="text-sm text-white/70">
            Manage the categories available when submitting expenses.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="mb-4 grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:grid-cols-[minmax(0,250px),minmax(0,1fr),auto]"
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-white/80" htmlFor="category-name">
            Name
          </label>
          <input
            id="category-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Travel"
            className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-white placeholder:text-white/60 focus:border-white focus:outline-none"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-white/80" htmlFor="category-description">
            Description (optional)
          </label>
          <input
            id="category-description"
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add context for submitters"
            className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-white placeholder:text-white/60 focus:border-white focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={createCategory.isPending}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-blue-500 px-5 py-2 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/60 sm:mt-0"
        >
          {createCategory.isPending ? "Adding…" : "Add"}
        </button>
      </form>
      <div className="min-h-[1.25rem] text-sm">
        {error && <p className="text-red-300">{error}</p>}
        {feedback && <p className="text-emerald-300">{feedback}</p>}
      </div>

      {isLoading ? (
        <p className="text-white/70">Loading categories…</p>
      ) : categories && categories.length > 0 ? (
        <ul className="space-y-3">
          {categories.map((category) => (
            <li
              key={category.id}
              className="rounded-lg border border-white/10 bg-white/5 p-4"
            >
              {editingId === category.id ? (
                <form className="space-y-3" onSubmit={handleEditSubmit}>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-white/80" htmlFor={`edit-name-${category.id}`}>
                      Name
                    </label>
                    <input
                      id={`edit-name-${category.id}`}
                      type="text"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-white focus:border-white focus:outline-none"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-white/80" htmlFor={`edit-description-${category.id}`}>
                      Description (optional)
                    </label>
                    <input
                      id={`edit-description-${category.id}`}
                      type="text"
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-white focus:border-white focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={updateCategory.isPending}
                      className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/60"
                    >
                      {updateCategory.isPending ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditError(null);
                      }}
                      className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                  {editError && (
                    <p className="text-sm text-red-300">{editError}</p>
                  )}
                </form>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-white">{category.name}</p>
                    {category.description ? (
                      <p className="text-sm text-white/70">{category.description}</p>
                    ) : (
                      <p className="text-sm text-white/40">No description</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(category)}
                      className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(category.id)}
                      disabled={deleteCategory.isPending}
                      className="inline-flex items-center rounded-full bg-red-500/80 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-500/60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-white/70">No categories yet. Create one to get started.</p>
      )}
    </section>
  );
}

function PendingInvitationsSection({
  invitations,
}: {
  invitations: PendingInvitation[];
}) {
  const utils = api.useUtils();
  const [manualToken, setManualToken] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const acceptInvitation = api.organization.acceptInvitation.useMutation({
    onSuccess: async () => {
      setManualToken("");
      setFeedback("Invitation accepted");
      setError(null);
      await Promise.all([
        utils.organization.myInvitations.invalidate(),
        utils.organization.list.invalidate(),
      ]);
    },
    onError: (mutationError) => {
      setFeedback(null);
      setError(mutationError.message);
    },
  });

  const handleAccept = async (token: string) => {
    setFeedback(null);
    setError(null);
    await acceptInvitation.mutateAsync({ token });
  };

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualToken.trim()) {
      setError("Invitation token is required");
      setFeedback(null);
      return;
    }
    await handleAccept(manualToken.trim());
  };

  return (
    <div className="space-y-6">
      {invitations.length > 0 ? (
        <ul className="space-y-3">
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-white">
                  {invitation.organization.name}
                </p>
                <p className="text-sm text-white/70">
                  Role: {roleLabels[invitation.role]} • Expires {formatDate(invitation.expiresAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAccept(invitation.token)}
                disabled={acceptInvitation.isPending}
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-2 font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/60"
              >
                {acceptInvitation.isPending ? "Accepting…" : "Accept"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-white/70">No pending invitations found.</p>
      )}

      <form
        onSubmit={handleManualSubmit}
        className="flex flex-col gap-3 rounded-lg border border-dashed border-white/20 bg-white/5 p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label
            className="mb-2 block text-sm font-medium text-white/80"
            htmlFor="manual-invite-token"
          >
            Have a token?
          </label>
          <input
            id="manual-invite-token"
            type="text"
            value={manualToken}
            onChange={(event) => setManualToken(event.target.value)}
            placeholder="Paste invitation token"
            className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-white placeholder:text-white/60 focus:border-white focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={acceptInvitation.isPending}
          className="inline-flex items-center justify-center rounded-full bg-blue-500 px-6 py-2 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/60"
        >
          {acceptInvitation.isPending ? "Processing…" : "Accept token"}
        </button>
      </form>

      <div className="min-h-[1.25rem] text-sm">
        {error && <p className="text-red-300">{error}</p>}
        {feedback && <p className="text-emerald-300">{feedback}</p>}
      </div>
    </div>
  );
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
