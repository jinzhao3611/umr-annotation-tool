import pytest
import tempfile
import os
from umr_annot_tool import create_app, db, bcrypt
from umr_annot_tool.models import User, Project, Projectuser


class TestConfig:
    """Test configuration."""
    TESTING = True
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False
    SECRET_KEY = 'test-secret-key'
    SQLALCHEMY_ECHO = False


@pytest.fixture(scope="session")
def app():
    """Create application for testing."""
    # Create temporary database
    db_fd, db_path = tempfile.mkstemp()

    # Store original environment variables
    original_env = {}
    env_vars_to_clear = ['DATABASE_URL', 'SECRET_KEY', 'SQLALCHEMY_DATABASE_URI']

    for var in env_vars_to_clear:
        if var in os.environ:
            original_env[var] = os.environ[var]
            del os.environ[var]

    # Create test config class with dynamic database path
    class TestConfigWithDB(TestConfig):
        SQLALCHEMY_DATABASE_URI = f'sqlite:///{db_path}'

    app = create_app(TestConfigWithDB)

    with app.app_context():
        db.create_all()

        # Create test user
        test_user = User(
            username='testuser',
            email='test@example.com',
            password=bcrypt.generate_password_hash('testpassword').decode('utf-8')
        )
        db.session.add(test_user)

        # Create admin user
        admin_user = User(
            username='testadmin',
            email='admin@example.com',
            password=bcrypt.generate_password_hash('adminpassword').decode('utf-8')
        )
        db.session.add(admin_user)

        # Create test project (created by admin user)
        test_project = Project(
            project_name='Test Project',
            language='en',
            created_by_user_id=2  # Admin user creates the project
        )
        db.session.add(test_project)
        db.session.commit()

        # Create project-user association (member, not admin)
        project_user = Projectuser(
            project_name='Test Project',
            user_id=1,
            project_id=test_project.id,
            permission='member'
        )
        db.session.add(project_user)

        # Also add admin user to project as admin
        admin_project_user = Projectuser(
            project_name='Test Project',
            user_id=2,
            project_id=test_project.id,
            permission='admin'
        )
        db.session.add(admin_project_user)
        db.session.commit()

    yield app

    # Cleanup
    os.close(db_fd)
    os.unlink(db_path)

    # Restore original environment variables
    for var, value in original_env.items():
        os.environ[var] = value


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def auth_client(client, app):
    """Test client that is logged in as a regular user."""
    with app.app_context():
        client.post('/login', data={
            'email': 'test@example.com',
            'password': 'testpassword',
        }, follow_redirects=True)
    return client


@pytest.fixture
def admin_client(client, app):
    """Test client that is logged in as an admin user."""
    with app.app_context():
        client.post('/login', data={
            'email': 'admin@example.com',
            'password': 'adminpassword',
        }, follow_redirects=True)
    return client


@pytest.fixture
def sample_umr_content():
    """Sample UMR file content for testing."""
    return '''################################################################################
# meta-info :: sent_id = test-s1
# :: snt1	The cat sat on the mat.
Index: 1   2   3   4  5   6
Words: The cat sat on the mat .

# sentence level graph:
(s1s / sit-01
    :ARG0 (s1c / cat)
    :ARG1 (s1m / mat))

# alignment:
s1s: 3-3
s1c: 2-2
s1m: 6-6

# document level annotation:
(s1s0 / sentence
    :temporal ((document-creation-time :before s1s)))
################################################################################'''


@pytest.fixture
def sample_umr_file(tmp_path, sample_umr_content):
    """Create a temporary UMR file for testing."""
    umr_file = tmp_path / "test.umr"
    umr_file.write_text(sample_umr_content)
    return str(umr_file)
