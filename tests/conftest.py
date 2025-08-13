import pytest
import tempfile
import os
import sys
from playwright.sync_api import sync_playwright
from umr_annot_tool import create_app, db, bcrypt
from umr_annot_tool.models import User, Project, Doc, DocVersion


@pytest.fixture(scope="session")
def playwright_context():
    """Playwright context fixture for the entire test session."""
    with sync_playwright() as p:
        # Check command line arguments for --headed and --slowmo
        headless = "--headed" not in sys.argv
        slow_mo = 0
        
        # Look for --slowmo argument
        for i, arg in enumerate(sys.argv):
            if arg == "--slowmo" and i + 1 < len(sys.argv):
                try:
                    slow_mo = int(sys.argv[i + 1])
                except ValueError:
                    slow_mo = 0
        
        browser = p.chromium.launch(
            headless=headless,
            slow_mo=slow_mo
        )
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},
            ignore_https_errors=True
        )
        yield context
        context.close()
        browser.close()


@pytest.fixture
def page(playwright_context):
    """Create a new page for each test."""
    page = playwright_context.new_page()
    yield page
    page.close()


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
        
        # Create admin user (using username to distinguish admin access)  
        admin_user = User(
            username='testadmin',  # Test admin user
            email='admin@example.com',
            password=bcrypt.generate_password_hash('adminpassword').decode('utf-8')
        )
        db.session.add(admin_user)
        
        # Create test project
        test_project = Project(
            project_name='Test Project',
            language='en',
            created_by_user_id=1
        )
        db.session.add(test_project)
        
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
def live_server(app):
    """Start live server for Playwright tests."""
    import threading
    import time
    from werkzeug.serving import make_server
    
    server = make_server('127.0.0.1', 5000, app, threaded=True)
    thread = threading.Thread(target=server.serve_forever)
    thread.daemon = True
    thread.start()
    
    # Wait for server to start
    time.sleep(1)
    
    yield 'http://127.0.0.1:5000'
    
    server.shutdown()


@pytest.fixture
def authenticated_page(page, live_server):
    """Page fixture with logged-in user."""
    # Navigate to login page
    page.goto(f"{live_server}/login")
    
    # Fill login form
    page.fill('input[name="email"]', 'test@example.com')
    page.fill('input[name="password"]', 'testpassword')
    page.click('input[type="submit"]')
    
    # Wait for redirect to account page (app redirects here after login)
    page.wait_for_url(f"{live_server}/account")
    
    yield page


@pytest.fixture
def admin_page(page, live_server):
    """Page fixture with logged-in admin user."""
    # Navigate to login page
    page.goto(f"{live_server}/login")
    
    # Fill login form with admin credentials
    page.fill('input[name="email"]', 'admin@example.com')
    page.fill('input[name="password"]', 'adminpassword')
    page.click('input[type="submit"]')
    
    # Wait for redirect (admin redirects to account page)
    page.wait_for_load_state("networkidle")
    
    yield page


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


@pytest.fixture
def api_client(app):
    """Create API client for direct API testing without UI."""
    return app.test_client()


@pytest.fixture
def api_login(api_client):
    """Helper fixture to perform API login and return authentication headers."""
    def _login(email='test@example.com', password='testpassword'):
        response = api_client.post('/api/login', json={
            'email': email,
            'password': password
        })
        
        if response.status_code == 200:
            data = response.get_json()
            token = data.get('token')
            if token:
                return {'Authorization': f'Bearer {token}'}
            # If no token, try session-based auth
            return {}
        return None
    
    return _login


@pytest.fixture
def api_admin_login(api_client):
    """Helper fixture for admin API login."""
    def _login():
        response = api_client.post('/api/login', json={
            'email': 'admin@example.com',
            'password': 'adminpassword'
        })
        
        if response.status_code == 200:
            data = response.get_json()
            token = data.get('token')
            if token:
                return {'Authorization': f'Bearer {token}'}
            return {}
        return None
    
    return _login


@pytest.fixture
def reset_database(app):
    """Reset database to initial state."""
    with app.app_context():
        # Drop all tables
        db.drop_all()
        # Recreate tables
        db.create_all()
        
        # Create default test users
        test_user = User(
            username='testuser',
            email='test@example.com',
            password=bcrypt.generate_password_hash('testpassword').decode('utf-8')
        )
        admin_user = User(
            username='testadmin',
            email='admin@example.com',
            password=bcrypt.generate_password_hash('adminpassword').decode('utf-8')
        )
        
        db.session.add(test_user)
        db.session.add(admin_user)
        db.session.commit()
        
        yield
        
        # Optional: Reset again after test
        db.drop_all()
        db.create_all()


@pytest.fixture
def seed_test_data(app):
    """Seed database with comprehensive test data."""
    with app.app_context():
        # Create multiple users
        users = [
            User(username='alice', email='alice@test.com', 
                 password=bcrypt.generate_password_hash('password123').decode('utf-8')),
            User(username='bob', email='bob@test.com',
                 password=bcrypt.generate_password_hash('password123').decode('utf-8')),
            User(username='charlie', email='charlie@test.com',
                 password=bcrypt.generate_password_hash('password123').decode('utf-8'))
        ]
        
        for user in users:
            db.session.add(user)
        
        db.session.commit()
        
        # Create multiple projects
        projects = [
            Project(project_name='English UMR Project', language='en', created_by_user_id=1),
            Project(project_name='Chinese UMR Project', language='zh', created_by_user_id=2),
            Project(project_name='Arabic UMR Project', language='ar', created_by_user_id=3)
        ]
        
        for project in projects:
            db.session.add(project)
        
        db.session.commit()
        
        # Add members to projects
        # Note: This depends on your actual project membership model
        # You may need to adjust based on your schema
        
        yield
        
        # Cleanup is handled by the session rollback 