# Task: Expense Category Management

## Meta Information

- **Task ID**: `TASK-002`
- **Title**: Implement organization-scoped expense categories
- **Status**: Ready for Review
- **Priority**: P0
- **Created**: 2025-09-16
- **Updated**: 2025-09-17
- **Estimated Effort**: 1 week
- **Actual Effort**: TBD

## Related Documents

- **PRD**: docs/product/prd-main.md
- **ADR**: TBD
- **Dependencies**: TASK-001

## Description

Deliver CRUD capabilities for expense categories that are scoped to organizations. Admins must be able to create, edit, and delete categories with names and optional descriptions, and members should reference these categories when submitting expenses. Ensure data isolation so categories cannot be accessed outside their owning organization.

## Acceptance Criteria

- [x] Admin UI/API to create, update, and delete categories within an organization
- [x] Category data model enforces organization ownership and optional description
- [x] Category listing filtered by current organization context
- [x] Validation prevents duplicate category names per organization
- [x] Automated tests cover category CRUD and authorization paths

## TODOs

- [x] Extend Prisma schema with category model and organization foreign key
- [x] Build tRPC procedures for category CRUD with role checks
- [x] Create basic UI components/forms for category management
- [x] Add validation to prevent duplicates and handle optional description
- [x] Write unit/integration tests covering success and failure cases
- [x] Update documentation to explain category usage in expenses

## Progress Updates

### 2025-09-16 - Team
**Status**: Not Started
**Progress**: Task defined and awaiting kickoff
**Blockers**: Depends on completion of organization onboarding flows
**Next Steps**: Design schema and APIs once TASK-001 is underway

### 2025-09-17 - Team
**Status**: Ready for Review
**Progress**: Added `ExpenseCategory` Prisma model and migration with organization ownership and uniqueness constraints. Delivered tRPC router enforcing membership/admin rules for category CRUD along with comprehensive Vitest coverage. Extended the organization admin dashboard to manage categories (create, edit, delete) with inline validation and optimistic UI refresh. Updated README and task documentation to reflect new capabilities and testing steps.
**Blockers**: None
**Next Steps**: Gather UX feedback on category management flows and align with upcoming policy work.

## Completion Checklist

- [x] All acceptance criteria met
- [x] Code follows project standards
- [x] Tests written and passing
- [x] Documentation updated (if needed)
- [ ] Code review completed

## Notes

Coordinate form patterns with broader design system to maintain consistency across admin tooling.

---

**Template Version**: 1.0
**Last Updated**: 2025-09-17
