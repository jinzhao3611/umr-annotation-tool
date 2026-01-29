import pytest
from umr_annot_tool.models import User
from umr_annot_tool import db


class TestLogin:
    """Test login route."""

    def test_login_page_returns_200(self, client):
        """GET /login returns 200."""
        response = client.get('/login')
        assert response.status_code == 200

    def test_login_page_contains_form(self, client):
        """Login page contains email and password fields."""
        response = client.get('/login')
        html = response.data.decode()
        assert 'email' in html.lower()
        assert 'password' in html.lower()

    def test_login_with_valid_credentials(self, client, app):
        """POST /login with valid credentials redirects."""
        response = client.post('/login', data={
            'email': 'test@example.com',
            'password': 'testpassword',
        }, follow_redirects=False)
        assert response.status_code == 302
        assert '/account' in response.headers.get('Location', '')

    def test_login_with_valid_credentials_follow(self, client, app):
        """POST /login with valid credentials leads to account page."""
        response = client.post('/login', data={
            'email': 'test@example.com',
            'password': 'testpassword',
        }, follow_redirects=True)
        assert response.status_code == 200
        assert b'testuser' in response.data

    def test_login_with_invalid_password(self, client, app):
        """POST /login with wrong password stays on login page."""
        response = client.post('/login', data={
            'email': 'test@example.com',
            'password': 'wrongpassword',
        }, follow_redirects=True)
        assert response.status_code == 200
        assert b'Login Unsuccessful' in response.data

    def test_login_with_nonexistent_email(self, client, app):
        """POST /login with unknown email stays on login page."""
        response = client.post('/login', data={
            'email': 'nobody@example.com',
            'password': 'testpassword',
        }, follow_redirects=True)
        assert response.status_code == 200
        assert b'Login Unsuccessful' in response.data

    def test_already_authenticated_redirects(self, auth_client):
        """Logged-in user visiting /login is redirected to /account."""
        response = auth_client.get('/login', follow_redirects=False)
        assert response.status_code == 302
        assert '/account' in response.headers.get('Location', '')


class TestRegister:
    """Test registration route."""

    def test_register_page_returns_200(self, client):
        """GET /register returns 200."""
        response = client.get('/register')
        assert response.status_code == 200

    def test_register_page_contains_form(self, client):
        """Register page contains required form fields."""
        response = client.get('/register')
        html = response.data.decode()
        assert 'username' in html.lower()
        assert 'email' in html.lower()
        assert 'password' in html.lower()


class TestLogout:
    """Test logout route."""

    def test_logout_redirects_to_login(self, auth_client):
        """GET /logout redirects to login page."""
        response = auth_client.get('/logout', follow_redirects=False)
        assert response.status_code == 302
        assert '/login' in response.headers.get('Location', '')

    def test_logout_then_account_requires_login(self, auth_client):
        """After logout, /account requires login."""
        auth_client.get('/logout')
        response = auth_client.get('/account', follow_redirects=False)
        assert response.status_code == 302
        assert '/login' in response.headers.get('Location', '')
