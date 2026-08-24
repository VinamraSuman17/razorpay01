# Implementation Plan Template

Use this template when producing an implementation plan for a feature, enhancement, or change.

---

## Objective

<!-- 1-2 sentence summary of what this delivers and why it matters -->

[Feature name]: [Clear description of the value delivered]

## Context

<!-- Background information that helps understand the change -->

- **Triggered by:** [User story / feature request / bug report / tech debt]
- **Related work:** [Links to related plans, ADRs, or PRs]

## Open Questions

<!-- List ambiguities that need resolution before implementation -->

1. [Question 1]
2. [Question 2]

## Affected Modules

<!-- Complete module map showing every area of the codebase impacted -->

| Layer | Module | Change Type | Impact | Notes |
|-------|--------|------------|--------|-------|
| Backend | models/ | | | |
| Backend | schemas/ | | | |
| Backend | services/ | | | |
| Backend | routes/ | | | |
| Backend | repositories/ | | | |
| Backend | migrations/ | | | |
| Frontend | pages/ | | | |
| Frontend | components/ | | | |
| Frontend | hooks/ | | | |
| Frontend | services/ | | | |
| Frontend | types/ | | | |
| Shared | config | | | |
| Tests | unit/ | | | |
| Tests | integration/ | | | |

**Change Types:** New file, Modify, Delete, Rename
**Impact:** Migration, API change, UI change, Config change, None

## Verification

### Integration Verification

<!-- End-to-end test or manual smoke test for the complete feature -->

**Automated E2E:**
```
[E2E test command, e.g., npx playwright test tests/e2e/feature-name.spec.ts]
```

**Manual Smoke Test:**
1. [Step 1: Navigate to...]
2. [Step 2: Perform action...]
3. [Step 3: Verify result...]
4. [Expected outcome]

### Regression Check

- [ ] Existing tests still pass: `pytest -x && npm test`
- [ ] No type errors: `mypy src/ && npx tsc --noEmit`
- [ ] No lint issues: `ruff check src/ && npm run lint`

## Risks & Unknowns

<!-- Potential issues with likelihood and mitigation -->

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [Description] | Low/Med/High | Low/Med/High | [How to reduce risk] |

## Acceptance Criteria

<!-- Observable outcomes that confirm the feature is complete -->

- [ ] [Criterion 1: User can...]
- [ ] [Criterion 2: System responds with...]
- [ ] [Criterion 3: Data persists in...]
- [ ] [Criterion 4: Error case handles...]
- [ ] All tests pass (unit + integration)
- [ ] No regressions in existing functionality
- [ ] Code reviewed and approved

## Estimation Summary

| Metric | Value |
|--------|-------|
| Backend modules affected | [N] |
| Frontend modules affected | [N] |
| Migration required | [Yes / No] |
| API changes | [Yes / No] |
| Overall complexity | [trivial / small / medium / large] |

## Next Step

Run `/task-decomposition` to read this plan file and break it into atomic implementation tasks with persistent tracking files (`task_plan.md`, `progress.md`, `findings.md`).

## Notes

<!-- Any additional context, decisions, or constraints -->

- [Note 1]
- [Note 2]
