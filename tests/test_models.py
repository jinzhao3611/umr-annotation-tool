import pytest
from umr_annot_tool import db, bcrypt
from umr_annot_tool.models import User, Project, Projectuser, Doc, Sent, DocVersion


class TestUserModel:
    """Test the User model."""

    def test_user_exists(self, app):
        """Seeded test user exists in the database."""
        with app.app_context():
            user = User.query.filter_by(username='testuser').first()
            assert user is not None
            assert user.email == 'test@example.com'

    def test_admin_user_exists(self, app):
        """Seeded admin user exists in the database."""
        with app.app_context():
            user = User.query.filter_by(username='testadmin').first()
            assert user is not None
            assert user.email == 'admin@example.com'

    def test_user_password_is_hashed(self, app):
        """User password is stored as a hash, not plaintext."""
        with app.app_context():
            user = User.query.filter_by(username='testuser').first()
            assert user.password != 'testpassword'
            assert bcrypt.check_password_hash(user.password, 'testpassword')

    def test_user_repr(self, app):
        """User __repr__ returns expected format."""
        with app.app_context():
            user = User.query.filter_by(username='testuser').first()
            assert 'testuser' in repr(user)

    def test_user_default_image(self, app):
        """User has default profile image."""
        with app.app_context():
            user = User.query.filter_by(username='testuser').first()
            assert user.image_file == 'default.jpg'

    def test_user_get_reset_token(self, app):
        """User can generate a reset token."""
        with app.app_context():
            user = User.query.filter_by(username='testuser').first()
            token = user.get_reset_token()
            assert token is not None
            assert isinstance(token, str)

    def test_user_verify_reset_token(self, app):
        """Valid reset token can be verified."""
        with app.app_context():
            user = User.query.filter_by(username='testuser').first()
            token = user.get_reset_token()
            verified_user = User.verify_reset_token(token)
            assert verified_user is not None
            assert verified_user.id == user.id


class TestProjectModel:
    """Test the Project model."""

    def test_project_exists(self, app):
        """Seeded test project exists."""
        with app.app_context():
            project = Project.query.filter_by(project_name='Test Project').first()
            assert project is not None
            assert project.language == 'en'

    def test_project_creator(self, app):
        """Project has correct creator."""
        with app.app_context():
            project = Project.query.filter_by(project_name='Test Project').first()
            assert project.created_by_user_id == 2  # admin user

    def test_project_repr(self, app):
        """Project __repr__ returns expected format."""
        with app.app_context():
            project = Project.query.filter_by(project_name='Test Project').first()
            assert 'Test Project' in repr(project)


class TestProjectuserModel:
    """Test the Projectuser model."""

    def test_member_association_exists(self, app):
        """Project-user association is created."""
        with app.app_context():
            pu = Projectuser.query.filter_by(user_id=1, project_id=1).first()
            assert pu is not None
            assert pu.permission == 'member'

    def test_admin_association_exists(self, app):
        """Admin project-user association is created."""
        with app.app_context():
            pu = Projectuser.query.filter_by(user_id=2, project_id=1).first()
            assert pu is not None
            assert pu.permission == 'admin'
