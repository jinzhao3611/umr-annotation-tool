# UMR Writer — Maintainer Handoff

This document is for the next maintainer of UMR Writer. It assumes you have already read `README.md` (local setup), `CONTRIBUTING.md` (dev workflow / PR process), and `tests/README.md` (test infrastructure). This file covers the things those documents *don't*: production operations, accounts and credentials, architectural decisions, and the tacit knowledge that only lives in the previous maintainer's head.

**Outgoing maintainer:** Jin Zhao (jinzhao@brandeis.edu) — graduating May 17 2026.
**Incoming maintainer:** <FILL IN: name + email>.
**Faculty owner of record:** Nianwen Xue (xuen@brandeis.edu) — the long-term escalation point if the active maintainer rotates again.

---

## 1. What this project is (one paragraph)

UMR Writer is a Flask web app for annotating Uniform Meaning Representation across multiple languages, at both sentence and document level.

---

## 2. Production deployment

### Where it runs
- **Hosting:** Heroku, app `glacial-shelf-55504`, region `us`, stack `heroku-22`, 1 web dyno (gunicorn via `Procfile`).
  - Owner: Heroku team account `umr-cs-brandeis-edu@herokumanager.com` (a Brandeis CS team account, **not** an individual login). The successor doesn't need ownership transferred — they just need to be added as a collaborator on the app. Current collaborators: `jinzhao@brandeis.edu`.
  - Add-ons: `heroku-postgresql:essential-1` (Postgres), `sendgrid:starter` (SMTP for password reset).
  - TLS: Heroku Auto Cert Management is on.
- **Production URL:** https://umr-tool.cs.brandeis.edu (the user-facing address). The Heroku-internal address `https://glacial-shelf-55504.herokuapp.com/` also works but is not what we hand out.
- **Staging URL:** none — we deploy straight to prod.
- **Custom domain / DNS:** `umr-tool.cs.brandeis.edu` is a Brandeis CS subdomain managed by Brandeis CS IT, not a commercial registrar. There is no renewal/billing for this domain on our side; if the CNAME ever needs to change, contact **Christopher Alison** at Brandeis CS IT — he owns the DNS record. The CNAME currently points to `fundamental-fly-dfzm0bxp4wbx7mm47mxdcheh.herokudns.com` (Heroku SNI endpoint `hypsilophodon-34597`).

### Accounts that need to transfer
| Service | Purpose | Where credentials live | Action on handoff |
|---|---|---|---|
| Heroku | App hosting (`glacial-shelf-55504`) + Postgres add-on | Heroku team `umr-cs-brandeis-edu` (team-owned, not individual) | Add successor as a collaborator on the app. No ownership transfer needed since the team owns it. |
| SendGrid | Password-reset email (`MAIL_PASSWORD`) | Heroku add-on `sendgrid:starter` — credentials provisioned by Heroku as `MAIL_PASSWORD` / `MAIL_DEFAULT_SENDER` config vars. Manage via `heroku addons:open sendgrid -a glacial-shelf-55504`. | Successor inherits add-on access automatically once they're a Heroku collaborator. |
| Brandeis CS IT (DNS) | `umr-tool.cs.brandeis.edu` CNAME | Christopher Alison, Brandeis CS IT | Notify him of the maintainer change so he has the right contact for any future DNS work. |
| GitHub repo | Source + CI | github.com/jinzhao3611/umr-annotation-tool | Transfer repo ownership or grant admin to the successor. |
| Codecov | Coverage badges (CI uses it) | CI secret `CODECOV_TOKEN` | Rotate or remove if not wanted. |

### Heroku config vars currently set in production
Names only (verify with `heroku config -a glacial-shelf-55504`):
```
DATABASE_URL                 set automatically by the Heroku Postgres add-on
HEROKU_POSTGRESQL_JADE_URL   alias of DATABASE_URL added by the Postgres add-on; same value, ignore
SECRET_KEY                   Flask session/CSRF/reset-token signing key — rotate on handoff
MAIL_PASSWORD                SendGrid SMTP password (provisioned by the sendgrid add-on)
MAIL_DEFAULT_SENDER          From-address used by Flask-Mail for password-reset emails
SENDGRID_PASSWORD            provisioned by the sendgrid add-on (alongside SENDGRID_USERNAME); the app reads MAIL_PASSWORD instead, but rotating credentials goes through SendGrid's dashboard
SENDGRID_USERNAME            provisioned by the sendgrid add-on
```
Note: there is no `STATIC_VERSION` set in production. The app falls back to `'1.0.0'` (see `umr_annot_tool/__init__.py`), which means cache-busting is not actually working in prod. If a future change needs to invalidate cached static assets, set `STATIC_VERSION` to the commit SHA on each deploy.

### Deploy / rollback runbook
1. Merge to `master`. CI must pass (`.github/workflows/ci.yml`).
2. `git push heroku master` — the prod remote is named `heroku` (URL `https://git.heroku.com/glacial-shelf-55504.git`).
3. Watch `heroku logs --tail -a glacial-shelf-55504` for ~2 minutes. Hit https://umr-tool.cs.brandeis.edu and log in to confirm.
4. **Rollback:** `heroku releases -a glacial-shelf-55504` to find the previous release, then `heroku rollback v<N>`. The Postgres DB is *not* rolled back — see "Schema changes" below.

### Why Java 11 in `system.properties`?
**Required, do not delete.** Heroku is configured with two buildpacks — `heroku/python` and `heroku/jvm` (verify with `heroku buildpacks -a glacial-shelf-55504`). The JVM is needed by `farasapy`, which wraps the Farasa Arabic NLP toolkit (a Java program). `system.properties` pins the Java version the JVM buildpack uses. Removing the file would let Heroku fall back to its default Java version, which is not what production currently runs on.

---

## 3. Database

### What it is
- PostgreSQL. Schema defined by SQLAlchemy models in `umr_annot_tool/models.py`.
- 9 main tables: `app_user`, `project`, `projectuser`, `doc`, `sent`, `doc_version`, `annotation`, `lexicon`, `lattice`, `partialgraph`. (`Post` is from a disabled legacy feature.)
- Postgres-specific column types are used (`ARRAY`, `JSON`) — **do not migrate to SQLite**.

### No migration system
There is **no Alembic / no migration framework**. Schema changes today are made by editing `models.py` and re-running `create_db.py` (which calls `db.create_all()`). `create_all()` does *not* alter existing tables — it only adds missing ones.


**Strong recommendation for the successor:** introduce Flask-Migrate (Alembic) before the next schema change. The audit in this handoff was the trigger to flag this; no one has done it yet because there's been no breaking schema change in a while.


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


### Things that look wrong and *are* wrong (known debt)
- `posts/` blueprint is dead code. Safe to delete in a focused PR.
- `system.properties` Java pin is unused (see §2).
- Only one `TODO` in the codebase (`resources/utility_modules/parse_lexicon_file.py` — frame numbering). Not urgent.

---

## 5. Admin procedures

These are user-facing operational tasks that aren't in the user guide because they require DB access or admin privilege.

### Promote / demote a project admin
Done through the UI — see `templates/user_guide.html` section on admin handoff. Code path: `users/routes.py` → `project()` view at `/project/<int:project_id>`, search for the `2.2.1 Promote/demote a member's permission` block. The "cannot demote the last admin" guard lives there too — that guard is intentional, do not refactor away (an ownerless project becomes unmanageable).

### Export annotations from a project
- Per-doc-version annotation export: `main/routes.py` → `export_annotation()` at `/export_annotation/<int:doc_version_id>`. This is the route the user-facing "Export" button hits.
- Per-project lexicon export: `users/routes.py` → `download_lexicon()` at `/download_lexicon/<int:project_id>`.
- For bulk pulls across many projects, query directly via `heroku pg:psql -a glacial-shelf-55504` (read-only by habit). The `annotation` table joins through `doc_version` → `doc` → `project`.


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

- **Bug reports:** GitHub issues.

---
