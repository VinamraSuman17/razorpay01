# Risk Assessment Checklist

Use this checklist during Step 5 (Identify Risks and Unknowns) of the planning workflow. Review each category and flag any risks that apply to the current feature.

---

## Risk Severity Matrix

| Likelihood \ Impact | Low Impact | Medium Impact | High Impact |
|-------------------|-----------|--------------|------------|
| **High** | Medium risk | High risk | Critical risk |
| **Medium** | Low risk | Medium risk | High risk |
| **Low** | Negligible | Low risk | Medium risk |

**Action by severity:**
- **Critical:** Must have mitigation plan before starting. Escalate to tech lead.
- **High:** Must have mitigation plan. Consider reducing scope.
- **Medium:** Document mitigation. Monitor during implementation.
- **Low:** Acknowledge and proceed. Revisit if conditions change.
- **Negligible:** No action needed.

---

## Category 1: Database & Data Migration

- [ ] **Schema change requires migration** — Does this change add, modify, or remove database columns or tables?
  - Risk: Migration failure in production, data loss
  - Mitigation: Write and test both upgrade and downgrade migrations. Run dry-run against staging.

- [ ] **Data transformation required** — Does existing data need to be converted or backfilled?
  - Risk: Long migration time, data corruption, downtime
  - Mitigation: Write migration as a background job. Test with production-sized dataset.

- [ ] **Index changes on large tables** — Adding or removing indexes on tables with >100K rows?
  - Risk: Lock contention, slow migration, downtime
  - Mitigation: Use `CREATE INDEX CONCURRENTLY`. Plan for off-peak deployment.

- [ ] **Foreign key or constraint changes** — Adding NOT NULL, UNIQUE, or FK constraints to existing data?
  - Risk: Constraint violation on existing data
  - Mitigation: Audit existing data first. Add constraint with validation step.

## Category 2: API Contract Changes

- [ ] **Breaking change to existing endpoint** — Does this modify request/response shape for an existing API?
  - Risk: Frontend breakage, external consumer breakage
  - Mitigation: Version the API or use additive changes only. Coordinate frontend update.

- [ ] **New required field in request body** — Adding a required field to an existing POST/PUT/PATCH?
  - Risk: Existing clients will get 422 errors
  - Mitigation: Make the field optional with a default, or version the endpoint.

- [ ] **Changed status codes or error format** — Modifying HTTP status codes or error response shape?
  - Risk: Frontend error handling breaks
  - Mitigation: Update frontend error handlers in the same sprint.

- [ ] **New authentication or authorization requirement** — Adding auth to a previously public endpoint?
  - Risk: Existing unauthenticated consumers will get 401/403
  - Mitigation: Announce deprecation, add auth gradually with feature flag.

## Category 3: Authentication & Authorization

- [ ] **Auth flow changes** — Modifying login, token generation, session management, or role checks?
  - Risk: Users locked out, privilege escalation, security vulnerability
  - Mitigation: Thorough testing with multiple user roles. Security review before merge.

- [ ] **Permission model changes** — Adding or modifying role-based access control?
  - Risk: Users gain unintended access or lose existing access
  - Mitigation: Audit current permission assignments. Test with each role.

- [ ] **Token or session changes** — Modifying JWT claims, token lifetime, or session storage?
  - Risk: Active sessions invalidated, users forced to re-login
  - Mitigation: Support both old and new token formats during transition.

## Category 4: Performance

- [ ] **N+1 query risk** — Does the change introduce a loop that queries the database per iteration?
  - Risk: Response time scales linearly with data size
  - Mitigation: Use `selectinload()` or `joinedload()` for relationships. Profile with realistic data.

- [ ] **Large payload risk** — Does the endpoint return unbounded data (no pagination)?
  - Risk: Memory exhaustion, slow responses
  - Mitigation: Add cursor-based pagination. Set reasonable page size defaults.

- [ ] **Expensive computation** — Does the change introduce CPU-intensive work in the request path?
  - Risk: Slow responses, timeout under load
  - Mitigation: Move to background task (Celery/BackgroundTasks). Add caching.

- [ ] **Frontend bundle size increase** — Adding a new large dependency to the frontend?
  - Risk: Slower initial page load, poor Core Web Vitals
  - Mitigation: Check bundle size impact. Consider lazy loading or lighter alternative.

## Category 5: Third-Party Dependencies

- [ ] **New dependency added** — Installing a new Python or npm package?
  - Risk: Supply chain vulnerability, license incompatibility, maintenance risk
  - Mitigation: Check download stats, last publish date, license, known vulnerabilities.

- [ ] **Dependency version upgrade** — Upgrading a major version of an existing dependency?
  - Risk: Breaking API changes, incompatibilities with other packages
  - Mitigation: Read changelog. Check peer dependency compatibility. Run full test suite.

- [ ] **External service integration** — Calling a new third-party API (payment, email, storage)?
  - Risk: Service unavailability, rate limiting, credential management
  - Mitigation: Implement retry logic, circuit breaker, timeout. Store credentials in secrets manager.

## Category 6: Frontend State & UI

- [ ] **Shared state modification** — Changing React Context, TanStack Query cache, or global store?
  - Risk: Unintended re-renders, stale data, broken components elsewhere
  - Mitigation: Map all consumers of the shared state. Test each consumer.

- [ ] **Component tree restructuring** — Moving, renaming, or reorganizing component hierarchy?
  - Risk: Broken imports, lost CSS scoping, context provider issues
  - Mitigation: Update all import paths. Test routing and layout at each level.

- [ ] **Form validation changes** — Modifying form validation rules or error display?
  - Risk: Users unable to submit valid data, or invalid data accepted
  - Mitigation: Test with edge case inputs. Match backend validation rules.

- [ ] **Accessibility impact** — Does the UI change affect keyboard navigation, screen readers, or color contrast?
  - Risk: WCAG violation, inaccessible to users with disabilities
  - Mitigation: Run axe-core scan. Test with keyboard only. Check color contrast ratios.

## Category 7: Deployment & Infrastructure

- [ ] **Environment variable changes** — Adding or modifying environment variables?
  - Risk: Deployment fails if env vars not set in staging/production
  - Mitigation: Update deployment configuration. Document all new env vars.

- [ ] **Docker changes** — Modifying Dockerfile, docker-compose, or build process?
  - Risk: Build failure, image size regression, security vulnerability
  - Mitigation: Test build locally. Check image size before/after. Scan with Trivy.

- [ ] **CI/CD pipeline changes** — Modifying GitHub Actions workflows or deployment scripts?
  - Risk: Pipeline failure, skipped tests, broken deployment
  - Mitigation: Test workflow changes in a branch. Verify all jobs complete.

## Category 8: Security

- [ ] **User input handling** — Does the change process user-provided data (form input, file upload, URL params)?
  - Risk: Injection attacks (SQL, XSS, command injection)
  - Mitigation: Use parameterized queries, Pydantic validation, output escaping.

- [ ] **Secrets or credentials** — Does the change involve API keys, tokens, or passwords?
  - Risk: Secrets leaked in code, logs, or error messages
  - Mitigation: Use environment variables. Never log secrets. Review for accidental exposure.

- [ ] **File system access** — Does the change read or write files based on user input?
  - Risk: Path traversal, arbitrary file read/write
  - Mitigation: Validate and sanitize file paths. Use allowlists for permitted directories.

---

## Quick Risk Summary Template

Use this table in your implementation plan:

| # | Risk | Category | Likelihood | Impact | Severity | Mitigation |
|---|------|----------|-----------|--------|----------|------------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
