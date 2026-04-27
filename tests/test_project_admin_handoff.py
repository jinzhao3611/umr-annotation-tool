"""Tests for promoting / demoting project members between admin and annotate."""

import pytest
from umr_annot_tool import db, bcrypt
from umr_annot_tool.models import User, Project, Projectuser


@pytest.fixture
def two_admin_project(app):
    """Create a fresh project where both the regular and admin test users hold admin.

    The shared session-scoped fixtures leave the regular user with permission='member',
    so we set up an isolated project here to avoid coupling.
    """
    with app.app_context():
        # Add a third user we can promote/demote without touching the shared fixtures.
        existing = User.query.filter_by(username='handoff_extra').first()
        if not existing:
            extra = User(
                username='handoff_extra',
                email='handoff_extra@example.com',
                password=bcrypt.generate_password_hash('pw').decode('utf-8'),
            )
            db.session.add(extra)
            db.session.commit()
            extra_id = extra.id
        else:
            extra_id = existing.id

        admin_user = User.query.filter_by(email='admin@example.com').first()
        regular_user = User.query.filter_by(email='test@example.com').first()

        project = Project(
            project_name='Handoff Test Project',
            language='en',
            created_by_user_id=admin_user.id,
        )
        db.session.add(project)
        db.session.commit()

        for uid, perm in [(admin_user.id, 'admin'),
                          (regular_user.id, 'admin'),
                          (extra_id, 'annotate')]:
            db.session.add(Projectuser(
                project_name=project.project_name,
                user_id=uid,
                project_id=project.id,
                permission=perm,
            ))
        db.session.commit()

        ids = {
            'project_id': project.id,
            'admin_user_id': admin_user.id,
            'regular_user_id': regular_user.id,
            'extra_user_id': extra_id,
        }

    yield ids

    with app.app_context():
        Projectuser.query.filter_by(project_id=ids['project_id']).delete()
        Project.query.filter_by(id=ids['project_id']).delete()
        db.session.commit()


def _post_set_permission(client, project_id, user_id, value):
    return client.post(
        f'/project/{project_id}',
        data={
            'set_permission_user_id': str(user_id),
            'set_permission_value': value,
        },
        follow_redirects=False,
    )


class TestPromoteDemote:
    def test_admin_can_promote_member(self, admin_client, app, two_admin_project):
        ids = two_admin_project
        _post_set_permission(admin_client, ids['project_id'],
                             ids['extra_user_id'], 'admin')
        with app.app_context():
            pu = Projectuser.query.filter_by(
                project_id=ids['project_id'],
                user_id=ids['extra_user_id'],
            ).first()
            assert pu.permission == 'admin'

    def test_admin_can_demote_another_admin(self, admin_client, app, two_admin_project):
        ids = two_admin_project
        _post_set_permission(admin_client, ids['project_id'],
                             ids['regular_user_id'], 'annotate')
        with app.app_context():
            pu = Projectuser.query.filter_by(
                project_id=ids['project_id'],
                user_id=ids['regular_user_id'],
            ).first()
            assert pu.permission == 'annotate'

    def test_admin_can_self_demote_when_another_admin_exists(
            self, admin_client, app, two_admin_project):
        ids = two_admin_project
        _post_set_permission(admin_client, ids['project_id'],
                             ids['admin_user_id'], 'annotate')
        with app.app_context():
            pu = Projectuser.query.filter_by(
                project_id=ids['project_id'],
                user_id=ids['admin_user_id'],
            ).first()
            assert pu.permission == 'annotate'

    def test_last_admin_cannot_demote_self(self, admin_client, app, two_admin_project):
        ids = two_admin_project
        # Demote the regular user first so admin_user is the only admin left.
        with app.app_context():
            other = Projectuser.query.filter_by(
                project_id=ids['project_id'],
                user_id=ids['regular_user_id'],
            ).first()
            other.permission = 'annotate'
            db.session.commit()

        _post_set_permission(admin_client, ids['project_id'],
                             ids['admin_user_id'], 'annotate')

        with app.app_context():
            pu = Projectuser.query.filter_by(
                project_id=ids['project_id'],
                user_id=ids['admin_user_id'],
            ).first()
            assert pu.permission == 'admin'  # Still admin — demotion was blocked

    def test_non_admin_cannot_promote(self, auth_client, app, two_admin_project):
        ids = two_admin_project
        # Demote the regular user first so they are not admin.
        with app.app_context():
            other = Projectuser.query.filter_by(
                project_id=ids['project_id'],
                user_id=ids['regular_user_id'],
            ).first()
            other.permission = 'annotate'
            db.session.commit()

        _post_set_permission(auth_client, ids['project_id'],
                             ids['extra_user_id'], 'admin')

        with app.app_context():
            pu = Projectuser.query.filter_by(
                project_id=ids['project_id'],
                user_id=ids['extra_user_id'],
            ).first()
            assert pu.permission == 'annotate'  # Unchanged

    def test_invalid_permission_value_ignored(self, admin_client, app, two_admin_project):
        ids = two_admin_project
        _post_set_permission(admin_client, ids['project_id'],
                             ids['extra_user_id'], 'superuser')
        with app.app_context():
            pu = Projectuser.query.filter_by(
                project_id=ids['project_id'],
                user_id=ids['extra_user_id'],
            ).first()
            assert pu.permission == 'annotate'  # Unchanged
