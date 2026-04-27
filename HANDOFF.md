# UMR Writer — Maintainer Handoff

This document is for the next maintainer of UMR Writer. It assumes you have already read `README.md` (local setup), `CONTRIBUTING.md` (dev workflow / PR process), and `tests/README.md` (test infrastructure). This file covers the things those documents *don't*: production operations, accounts and credentials, architectural decisions, and the tacit knowledge that only lives in the previous maintainer's head.

**Outgoing maintainer:** Jin Zhao (jinzhao@brandeis.edu) — graduating <FILL IN: graduation date>.
**Incoming maintainer:** <FILL IN: name + email>.
**Faculty owner of record:** <FILL IN: advisor name + email> — the long-term escalation point if the active maintainer rotates again.

---

## 1. What this project is (one paragraph)

UMR Writer is a Flask web app for annotating Uniform Meaning Representation across multiple languages, at both sentence and document level. It is used by <FILL IN: which research groups / classes / external annotators>. The annotators we currently know about are listed in <FILL IN: spreadsheet / Slack channel / nowhere — list them here>.

Active annotation projects in production right now: <FILL IN: project names + rough size + who runs each>. This list matters because schema changes or downtime affect these people first.

---

## 2. Production deployment

### Where it runs
- **Hosting:** Heroku (`Procfile` uses gunicorn). <FILL IN: app name(s), region, dyno tier>.
- **Production URL:** <FILL IN>.
- **Staging URL (if any):** <FILL IN, or "none — we deploy straight to prod">.
- **Custom domain / DNS:** <FILL IN: registrar, who pays, renewal date>.

### Accounts that need to transfer
| Service | Purpose | Where credentials live | Action on handoff |
|---|---|---|---|
| Heroku | App hosting + Postgres add-on | <FILL IN> | Add successor as collaborator/admin, transfer billing |
| SendGrid (or current SMTP provider) | Password-reset email (`MAIL_PASSWORD`) | <FILL IN> | Rotate API key, give successor access |
| GitHub repo | Source + CI | github.com/<FILL IN: org/repo> | Transfer repo ownership or grant admin |
| Domain registrar | <FILL IN domain> | <FILL IN> | Transfer or update billing contact |
| Codecov | Coverage badges (CI uses it) | CI secret `CODECOV_TOKEN` | Rotate or remove if not wanted |
| <Anything else> | | | |

### Heroku config vars currently set in production
Run `heroku config -a <app>` and paste the *names* (not values) here so the successor knows what's expected:
```
DATABASE_URL          (set automatically by Heroku Postgres add-on)
SECRET_KEY            <FILL IN how it was generated; rotate on handoff>
MAIL_PASSWORD         (SendGrid API key)
MAIL_DEFAULT_SENDER
STATIC_VERSION        (cache-busting; bump on each deploy or set to commit SHA)
<anything else>
```

### Deploy / rollback runbook
1. Merge to `master`. CI must pass (`.github/workflows/ci.yml`).
2. `git push heroku master` (or whatever the prod remote is named — <FILL IN>).
3. Watch `heroku logs --tail -a <app>` for ~2 minutes. Hit the homepage and log in to confirm.
4. **Rollback:** `heroku releases -a <app>` to find the previous release, then `heroku rollback v<N>`. The Postgres DB is *not* rolled back — see "Schema changes" below.

### Why Java 11 in `system.properties`?
**Required, do not delete.** Heroku is configured with two buildpacks — `heroku/python` and `heroku/jvm` (verify with `heroku buildpacks -a <app>`). The JVM is needed by `farasapy`, which wraps the Farasa Arabic NLP toolkit (a Java program). `system.properties` pins the Java version the JVM buildpack uses. Removing the file would let Heroku fall back to its default Java version, which is not what production currently runs on.

---

## 3. Database

### What it is
- PostgreSQL. Schema defined by SQLAlchemy models in `umr_annot_tool/models.py`.
- 9 main tables: `app_user`, `project`, `projectuser`, `doc`, `sent`, `doc_version`, `annotation`, `lexicon`, `lattice`, `partialgraph`. (`Post` is from a disabled legacy feature.)
- Postgres-specific column types are used (`ARRAY`, `JSON`) — **do not migrate to SQLite**.

### No migration system
There is **no Alembic / no migration framework**. Schema changes today are made by editing `models.py` and re-running `create_db.py` (which calls `db.create_all()`). `create_all()` does *not* alter existing tables — it only adds missing ones.

This is the single biggest operational risk. In practice, schema changes in prod have been done by:
<FILL IN: how you've actually done this — manual `ALTER TABLE` via `heroku pg:psql`? a one-off script? rebuilding the DB from a dump?>

**Strong recommendation for the successor:** introduce Flask-Migrate (Alembic) before the next schema change. The audit in this handoff was the trigger to flag this; no one has done it yet because there's been no breaking schema change in a while.

### Backups
- <FILL IN: do you have Heroku Postgres continuous protection, or scheduled `pg:backups`? what's the retention?>
- <FILL IN: is there an off-Heroku copy anywhere? S3? a local dump on your laptop?>
- **Restore drill:** has anyone ever actually restored from backup? <FILL IN — if no, the successor should do this within their first month.>

### Useful one-liners
```bash
heroku pg:psql -a <app>                      # interactive prod shell — DANGEROUS, read-only queries only by habit
heroku pg:backups:capture -a <app>           # take an on-demand backup
heroku pg:backups:download -a <app>          # download latest backup as latest.dump
pg_restore --clean --no-acl --no-owner -d umr_annotation_db latest.dump   # restore locally
```

---

## 4. Architecture cheat sheet

```
umr_annot_tool/
├── __init__.py        # Flask app factory, blueprint registration
├── models.py          # SQLAlchemy models — the schema lives here
├── config.py          # reads env vars; rewrites postgres:// → postgresql://
├── main/              # core routes: annotation pages, project CRUD, uploads
├── users/             # auth, registration, password reset
├── resources/         # domain logic: lexicon, lattice, partial-graph parsing, UMR validator
├── utils/             # small helpers
├── templates/         # ~35 Jinja templates, including templates/user_guide.html
├── static/            # JS/CSS/images
└── posts/             # disabled legacy feature — do not extend, plan to remove
```

The hot spots — places where bugs hurt most — are documented in `CONTRIBUTING.md` under "Sensitive Areas." Read that section before touching auth, uploads, or annotation core.

### Things that look weird but are intentional
<This section is the highest-value part of this doc. Fill it in from memory — it's what git blame won't tell the successor.>

- <FILL IN: e.g. "We rewrite postgres:// to postgresql:// because Heroku gives the old URL form and SQLAlchemy 2 rejects it">
- <FILL IN: parenthesis handling in branch operations is fragile — see commits about "parenthesis bugs"; the relevant code is in <file>>
- <FILL IN: alignment cross-highlighting is implemented in JS that touches both sentence-level and graph DOMs — easy to break if you refactor either side>
- <FILL IN: anything else where the obvious refactor is wrong>

### Things that look wrong and *are* wrong (known debt)
- `posts/` blueprint is dead code. Safe to delete in a focused PR.
- `system.properties` Java pin is unused (see §2).
- Only one `TODO` in the codebase (`resources/utility_modules/parse_lexicon_file.py` — frame numbering). Not urgent.
- <FILL IN: any other backlog items only you remember>

---

## 5. Admin procedures

These are user-facing operational tasks that aren't in the user guide because they require DB access or admin privilege.

### Promote / demote a project admin
Done through the UI — see `templates/user_guide.html` section on admin handoff. Code path: <FILL IN: route + file>.

### Reset a user's password manually (when SendGrid is down or they can't receive email)
<FILL IN: do you do this via `heroku pg:psql` and bcrypt-hash a temporary password? Document the exact command.>

### Delete or archive a finished annotation project
<FILL IN: have you ever done this? what did you do?>

### Export annotations from a project
<FILL IN: route + file, or manual SQL>.

### Handle a stuck / corrupted annotation
<FILL IN: any time you've had to fix data by hand, write down what you did>.

---

## 6. Tests and CI

- `pytest` runs on Python 3.9/3.10/3.11 in CI (`.github/workflows/ci.yml`).
- Browser/E2E tests use Playwright; only `test_lexicon_roundtrip.py` runs end-to-end today.
- Markers: `auth`, `upload`, `annotation`, `integration`, `unit`, `e2e`, `smoke`, `slow`. See `tests/README.md`.
- Coverage uploads to Codecov; the badge / token live in CI secrets.

**Gaps the successor should know about:**
- E2E coverage is thin. Most regressions are caught by unit tests + manual smoke after deploy.
- No load testing has ever been run. Concurrent-annotator limits are unknown.

---

## 7. External dependencies worth knowing about

- **`umr_validator.py`** (35KB, lives in this repo) is the canonical UMR validator we ship. Don't accidentally diverge from upstream UMR spec — when the spec changes, this file needs review.
- **Language-specific tooling:** `farasapy` (Arabic — **wraps Farasa, a Java program; this is why the Heroku JVM buildpack and `system.properties` are required**), `lemminflect` (English), `simplemma` (multilingual), `UzbekLemmatizer`, `ancast` (UMR eval). Each is pip-installed; if any becomes unmaintained the successor will need a replacement.
- **No OAuth, no third-party login** — auth is username/password with bcrypt + Flask-Login. Password reset is the only thing that depends on email working.

---

## 8. Communication and users

- **Bug reports:** <FILL IN: GitHub issues? jinzhao@brandeis.edu? both?> — update the user guide footer when this changes.
- **Annotator chat / mailing list:** <FILL IN, or "none">.
- **Where new releases get announced:** <FILL IN, or "nowhere — we just deploy">.

---

## 9. Post-handoff support window

Outgoing maintainer (Jin) is available for questions until <FILL IN: date>. After that, the new maintainer is on their own and the faculty owner of record (§intro) is the escalation point.

Things to do *together* before Jin leaves, in priority order:
1. **Walkthrough deploy:** successor deploys a no-op change to prod with Jin watching.
2. **Walkthrough restore:** successor restores a Heroku Postgres backup to a local DB.
3. **Walkthrough a real bug fix:** pair on one open issue, end-to-end (branch → PR → merge → deploy).
4. **Account transfer day:** sit down together and move Heroku, SendGrid, domain, GitHub admin in one session. Verify the successor can log in to each.
5. **Rotate all secrets** after Jin's access is removed: `SECRET_KEY`, `MAIL_PASSWORD`, any other API keys.

---

## 10. Open questions for Jin to answer before leaving

Anything in this doc tagged `<FILL IN: ...>` is an open question. The doc is only useful once those are filled in. A reasonable goal: fill them in during one focused afternoon, then have the successor read this end-to-end and ask follow-ups.
