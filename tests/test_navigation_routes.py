import pytest


class TestPublicRoutes:
    """Test routes that should be accessible without login."""

    def test_home_page(self, client):
        """GET / returns 200."""
        response = client.get('/')
        assert response.status_code == 200

    def test_login_page(self, client):
        """GET /login returns 200."""
        response = client.get('/login')
        assert response.status_code == 200

    def test_register_page(self, client):
        """GET /register returns 200."""
        response = client.get('/register')
        assert response.status_code == 200

    def test_reset_password_page(self, client):
        """GET /reset_password returns 200."""
        response = client.get('/reset_password')
        assert response.status_code == 200


class TestProtectedRoutes:
    """Test routes that require authentication redirect to login."""

    def test_account_redirects_when_not_logged_in(self, client):
        """GET /account redirects to login when not authenticated."""
        response = client.get('/account', follow_redirects=False)
        assert response.status_code == 302
        assert '/login' in response.headers.get('Location', '')

    def test_search_redirects_when_not_logged_in(self, client):
        """GET /search redirects to login when not authenticated."""
        response = client.get('/search', follow_redirects=False)
        assert response.status_code == 302
        assert '/login' in response.headers.get('Location', '')

    def test_account_accessible_when_logged_in(self, auth_client):
        """GET /account returns 200 when authenticated."""
        response = auth_client.get('/account')
        assert response.status_code == 200

    def test_search_accessible_when_logged_in(self, auth_client):
        """GET /search returns 200 when authenticated."""
        response = auth_client.get('/search')
        assert response.status_code == 200
