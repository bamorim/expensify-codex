# Task: Expense Submission Flow

## Meta Information

- **Task ID**: `TASK-005`
- **Title**: Build expense submission experience with policy enforcement
- **Status**: Not Started
- **Priority**: P0
- **Created**: 2025-09-16
- **Updated**: 2025-09-16
- **Estimated Effort**: 2 weeks
- **Actual Effort**: TBD

## Related Documents

- **PRD**: docs/product/prd-main.md
- **ADR**: TBD
- **Dependencies**: TASK-002, TASK-004

## Description

Create the end-to-end flow for members to submit expenses including date, amount, category, and description. Integrate the policy resolution engine to auto-approve compliant expenses, auto-reject over-limit submissions, or route to manual review when required. Ensure clear user feedback that explains applied policies and resulting status.

## Acceptance Criteria

- [ ] Expense submission form captures required fields and validates inputs
- [ ] Policy engine automatically processes each submission and sets status
- [ ] Over-limit expenses are rejected with user-facing explanation
- [ ] Compliant expenses follow auto-approval or manual review routing per policy
- [ ] Tests cover submission success, validation errors, and policy-driven outcomes

## TODOs

- [ ] Extend Prisma schema with expense records, status fields, and audit metadata
- [ ] Implement tRPC procedures for creating expenses with policy enforcement hooks
- [ ] Build submission UI with clear error and success messaging
- [ ] Integrate resolution engine to determine review path and status transitions
- [ ] Add unit/integration tests for submission flow and policy outcomes
- [ ] Update documentation for users on how to submit compliant expenses

## Progress Updates

### 2025-09-16 - Team
**Status**: Not Started
**Progress**: Task prepared for execution
**Blockers**: Depends on categories and policy engine availability
**Next Steps**: Finalize schema changes once upstream tasks progress

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Code follows project standards
- [ ] Tests written and passing
- [ ] Documentation updated (if needed)
- [ ] Code review completed

## Notes

Capture audit data (e.g., submission timestamp, policy used) for later reporting and compliance.

---

**Template Version**: 1.0
**Last Updated**: 2025-09-16
