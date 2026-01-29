import pytest


class TestValidationAPI:
    """Test validation API endpoints exist and require authentication."""

    def test_validate_graph_requires_login(self, client):
        """POST /api/validate/graph redirects when not logged in."""
        response = client.post('/api/validate/graph',
                               json={'graph': '(s / test)'},
                               follow_redirects=False)
        assert response.status_code == 302
        assert '/login' in response.headers.get('Location', '')

    def test_validate_graph_reachable_when_logged_in(self, auth_client):
        """POST /api/validate/graph is reachable when authenticated."""
        response = auth_client.post('/api/validate/graph',
                                    json={'graph': '(s / test)'})
        # Should not be a redirect; actual status depends on validation logic
        assert response.status_code != 302

    def test_validate_alignment_requires_login(self, client):
        """POST /api/validate/alignment redirects when not logged in."""
        response = client.post('/api/validate/alignment',
                               json={'graph': '(s / test)', 'tokens': ['test']},
                               follow_redirects=False)
        assert response.status_code == 302
        assert '/login' in response.headers.get('Location', '')

    def test_validate_alignment_reachable_when_logged_in(self, auth_client):
        """POST /api/validate/alignment is reachable when authenticated."""
        response = auth_client.post('/api/validate/alignment',
                                    json={'graph': '(s / test)', 'tokens': ['test']})
        assert response.status_code != 302
