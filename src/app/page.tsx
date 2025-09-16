import Link from "next/link";

import { OrganizationDashboard } from "~/app/_components/organization-dashboard";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl space-y-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Welcome back
          </h1>
          <p className="text-lg text-white/70">
            Sign in with your work email to receive a magic link and get started
            with expense management.
          </p>
          <Link
            href="/api/auth/signin"
            className="inline-flex items-center justify-center rounded-full bg-blue-500 px-8 py-3 text-lg font-semibold text-white transition hover:bg-blue-400"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  void api.organization.list.prefetch();
  void api.organization.myInvitations.prefetch();

  const displayName = session.user.name ?? session.user.email ?? "there";

  return (
    <HydrateClient>
      <main className="min-h-screen bg-slate-950 text-white">
        <header className="border-b border-white/10 bg-white/5">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-white/60">
                Expense platform onboarding
              </p>
              <h1 className="text-3xl font-bold">Welcome, {displayName}</h1>
              <p className="text-sm text-white/60">
                Use the tools below to manage organizations and invitations.
              </p>
            </div>
            <Link
              href="/api/auth/signout"
              className="inline-flex items-center justify-center rounded-full bg-white/10 px-6 py-2 font-semibold text-white transition hover:bg-white/20"
            >
              Sign out
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-6 py-10">
          <OrganizationDashboard />
        </div>
      </main>
    </HydrateClient>
  );
}
