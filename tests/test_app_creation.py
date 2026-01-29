import pytest
from umr_annot_tool import create_app, db


class TestAppCreation:
    """Test Flask application factory and configuration."""

    def test_app_creates_successfully(self, app):
        """App factory returns a Flask instance."""
        assert app is not None

    def test_app_is_testing(self, app):
        """App has TESTING flag set."""
        assert app.config['TESTING'] is True

    def test_secret_key_set(self, app):
        """App has a secret key configured."""
        assert app.config['SECRET_KEY'] is not None

    def test_sqlalchemy_uri_set(self, app):
        """App has a database URI configured."""
        assert app.config['SQLALCHEMY_DATABASE_URI'] is not None

    def test_csrf_disabled_in_testing(self, app):
        """CSRF protection is disabled in test mode."""
        assert app.config['WTF_CSRF_ENABLED'] is False

    def test_blueprints_registered(self, app):
        """All expected blueprints are registered."""
        expected_blueprints = ['users', 'posts', 'main', 'validation', 'errors']
        for bp_name in expected_blueprints:
            assert bp_name in app.blueprints, f"Blueprint '{bp_name}' not registered"

    def test_database_tables_created(self, app):
        """Database tables are created."""
        with app.app_context():
            # Check that key tables exist by querying the inspector
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            table_names = inspector.get_table_names()
            expected_tables = ['app_user', 'project', 'projectuser', 'doc', 'sent']
            for table in expected_tables:
                assert table in table_names, f"Table '{table}' not found"
