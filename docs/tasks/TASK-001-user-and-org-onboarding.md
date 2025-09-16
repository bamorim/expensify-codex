# Task: Core User & Organization Onboarding

## Meta Information

- **Task ID**: `TASK-001`
- **Title**: Build core authentication, user onboarding, and organization management
- **Status**: Ready for Review
- **Priority**: P0
- **Created**: 2025-09-16
- **Updated**: 2025-09-17
- **Estimated Effort**: 2 weeks
- **Actual Effort**: TBD

## Related Documents

- **PRD**: docs/product/prd-main.md
- **ADR**: TBD
- **Dependencies**: None

## Description

Deliver the foundational user experience that allows new users to access the system, create organizations, and manage membership. Implement magic-code email authentication, organization creation, and invitations with proper role assignments (Admin vs Member). Establish multi-tenant data boundaries at the database and application layers to ensure organization-scoped data isolation.

## Acceptance Criteria

- [x] Users can request a login magic code and authenticate via email link/code flow (implemented via NextAuth email provider + Nodemailer)
- [x] Authenticated users can create a new organization and become its admin by default
- [x] Admins can invite users by email; invitees can accept and join with correct role
- [x] Organization-scoped access controls enforce data isolation across all entities
- [x] Unit/integration tests cover authentication, invitation, and authorization scenarios

## TODOs

- [x] Design Prisma schema for users, organizations, memberships, invitations, and roles
- [x] Integrate magic-code email flow (NextAuth email provider wired to Nodemailer transporter)
- [x] Implement organization creation UI/API and default admin assignment
- [x] Implement invitation issuance, acceptance, and role assignment flows
- [x] Enforce organization context scoping in backend procedures and middleware
- [x] Write unit/integration tests validating onboarding & RBAC rules
- [x] Document onboarding flow and configuration requirements (email provider, env vars)

## Progress Updates

### 2025-09-16 - Team
**Status**: Not Started
**Progress**: Task created based on PRD requirements
**Blockers**: None
**Next Steps**: Kick off schema design and auth flow implementation

### 2025-09-16 - Team (Update)
**Status**: In Progress
**Progress**: Email magic-code sign-in is operational using NextAuth with Nodemailer transport; basic auth happy path verified.
**Blockers**: Pending organization schema, membership roles, and invitations.
**Next Steps**: Model organizations/memberships and build org creation + invitation flows.

### 2025-09-17 - Team
**Status**: Ready for Review
**Progress**: Implemented Prisma models and migrations for organizations, memberships, and invitations. Added tRPC onboarding router with organization-scoped middleware and admin-specific operations. Replaced landing page with onboarding dashboard covering organization creation, invite issuance, pending invite acceptance, and admin invite management. Documented environment and onboarding setup in README and added Vitest coverage for organization workflows and access control enforcement.
**Blockers**: None
**Next Steps**: Confirm UI/UX meets stakeholder expectations and begin follow-up tasks for expense categories.

## Completion Checklist

- [x] All acceptance criteria met
- [x] Code follows project standards
- [x] Tests written and passing
- [x] Documentation updated (if needed)
- [ ] Code review completed

## Notes

Consider using a local email preview service (e.g., SMTP sink) during development to avoid sending real emails while validating the magic-code flow.

---

**Template Version**: 1.0
**Last Updated**: 2025-09-17
