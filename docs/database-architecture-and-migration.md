# Database Architecture and Migration Plan

Status: proposed; not yet implemented
Originally assessed: 2026-05-11

## Current State

The research intake database uses SQLite on a desktop machine. This works well
for a single local operator, but it has practical limits for a distributed
workflow:

- SQLite serializes writes, so simultaneous agents can encounter lock
  contention and `SQLITE_BUSY` failures.
- The database file is not safely or directly available to GitHub Actions
  runners or agents on other machines.
- The desktop is not a reliable always-on server because it can reboot or
  sleep.

The active paths, backup location, and restore commands remain documented in
the **Research Intake Database** section of the root README.

## Migration Goals

The target architecture should support:

1. Multiple local and CI agent instances reading and writing one authoritative
   database.
2. GitHub Actions workflows that run research or publishing agents.
3. A lightweight analytics layer over operational data.

PostgreSQL is the proposed target because it provides a network service,
concurrent transaction handling, and mature backup and access-control tools.

## Hosting Options

### Option A: PostgreSQL on `naspi5` with Tailscale

Run PostgreSQL on the NAS and join the NAS and GitHub Actions runners to the
same Tailscale network with
[`tailscale/github-action`](https://github.com/tailscale/github-action). Agents
would connect to `naspi5:5432`.

Advantages:

- Data remains on premises.
- The NAS already stores the database backup.
- No cloud database storage charge.

Tradeoffs:

- Database availability depends on the NAS and local internet connection.
- Every CI workflow needs Tailscale configuration.
- PostgreSQL maintenance and backups remain self-managed.

### Option B: Managed cloud PostgreSQL

A managed provider such as [Neon](https://neon.tech) lets GitHub Actions connect
directly over TLS and may provide managed backups, point-in-time restore, and
database branches for isolated agent or pull-request testing.

Advantages:

- No CI network tunnel is required.
- Backups and service maintenance are managed.
- Database branches can isolate test runs where supported.

Tradeoffs:

- Approximately 1.3 GB of article data moves to a third party.
- Pricing, storage limits, and branching behavior must be reviewed when the
  migration is scheduled.
- Desktop triage UI queries traverse the internet.

### Option C: Local Primary with a Cloud Replica

This adds operational and consistency complexity without a current requirement
that justifies it. It is not recommended at the present scale.

## Analytics Layer

The roughly 168,000 article rows include scores, statuses, topics, and
timestamps useful for both operations and analysis. A separate warehouse is
not currently necessary:

- PostgreSQL with appropriate indexes and JSONB can serve operational queries
  at this scale.
- DuckDB can provide ad hoc analytics through its `postgres_scanner` extension
  or exported Parquet snapshots without adding a full data warehouse.

## Proposed Migration Sequence

1. Inspect the schema in `research-tools/gmail-reader` and choose an explicit
   schema migration mechanism.
2. Provision PostgreSQL on the selected host.
3. Test a one-shot load of the 1.3 GB SQLite backup, using a tool such as
   `pgloader` if appropriate.
4. Add a configurable database connection string, such as `DATABASE_URL`, and
   store it in Vault rather than the repository.
5. Add the required secret and network configuration to GitHub Actions.
6. For managed PostgreSQL, evaluate isolated database branches for CI agent
   runs.
7. For NAS hosting, add the Tailscale join step and restrict PostgreSQL access
   to the private network.
8. Update the triage UI systemd service and Docker Compose configuration.
9. Validate record counts and critical queries before switching writers.
10. Retain the SQLite database as a read-only rollback snapshot until the
    PostgreSQL deployment is verified.

## Current Decision

No migration has been executed. SQLite remains the active database at the
paths documented in the root README. Hosting selection and implementation
should be revisited when concurrent remote writers become an immediate
requirement.
