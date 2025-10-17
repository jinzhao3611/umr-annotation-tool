import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, request, jsonify, render_template, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import LoginManager
from flask_mail import Mail
from umr_annot_tool.config import Config
import sys
import datetime
import pkg_resources
from werkzeug.exceptions import HTTPException

# extensions
db = SQLAlchemy()
bcrypt = Bcrypt()
login_manager = LoginManager()
login_manager.login_view = 'users.login'
login_manager.login_message_category = 'info'
mail = Mail()


def create_app(config_class=None):
    app = Flask(__name__)
    if config_class is None:
        app.config.from_object(Config)
    else:
        app.config.from_object(config_class)

    # Create logs directory if it doesn't exist
    if not os.path.exists('logs'):
        os.makedirs('logs')

    # Configure Flask app logger
    flask_handler = logging.FileHandler('logs/flask_app.log', mode='w')
    flask_handler.setLevel(logging.INFO)
    flask_formatter = logging.Formatter('%(asctime)s [FLASK] %(levelname)s: %(message)s')
    flask_handler.setFormatter(flask_formatter)

    # Configure SQLAlchemy logger (file only, less verbose)
    sql_handler = logging.FileHandler('logs/sqlalchemy.log', mode='w')
    sql_handler.setLevel(logging.WARNING)  # Only log warnings and errors
    sql_formatter = logging.Formatter('%(asctime)s [SQL] %(levelname)s: %(message)s')
    sql_handler.setFormatter(sql_formatter)

    # Setup Flask logger - use INFO level and only file handler
    # (Flask already has a default console handler)
    app.logger.setLevel(logging.INFO)
    app.logger.addHandler(flask_handler)

    # Setup SQLAlchemy logger - only file handler, no console spam
    sql_logger = logging.getLogger('sqlalchemy.engine')
    sql_logger.setLevel(logging.WARNING)
    sql_logger.addHandler(sql_handler)
    sql_logger.propagate = False  # Don't propagate to root logger

    # Initialize extensions
    db.init_app(app)
    bcrypt.init_app(app)
    login_manager.init_app(app)
    mail.init_app(app)

    # Register context processor to make current year available in all templates
    @app.context_processor
    def inject_year():
        return {'current_year': datetime.datetime.now().year}

    # Add static file versioning context processor to prevent browser caching
    @app.context_processor
    def inject_static_url():
        def versioned_static(filename):
            version = app.config.get('STATIC_VERSION', '1.0.0')
            return url_for('static', filename=filename, v=version)
        return dict(versioned_static=versioned_static)

    # Check if Ancast is available
    try:
        # First try as a regular package
        pkg_resources.get_distribution("ancast")
        app.logger.info("Ancast package found, evaluation features enabled")
        app.config['ANCAST_AVAILABLE'] = True
        app.config['ANCAST_INSTALL_TYPE'] = 'package'
    except pkg_resources.DistributionNotFound:
        # Check if it's available as a local module
        try:
            import importlib.util
            # Note: sys and os are already imported at the top level
            
            # Look for Ancast in common locations
            potential_paths = [
                os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'ancast'),
                os.path.join(os.path.expanduser('~'), 'ancast'),
                './ancast'
            ]
            
            ancast_found = False
            for path in potential_paths:
                if os.path.exists(path) and os.path.isdir(path):
                    # Check for __init__.py or setup.py
                    if (os.path.exists(os.path.join(path, '__init__.py')) or 
                        os.path.exists(os.path.join(path, 'setup.py'))):
                        app.logger.info(f"Found local Ancast installation at {path}")
                        # Add to Python path if not already there
                        if path not in sys.path:
                            sys.path.append(os.path.dirname(path))
                        app.config['ANCAST_AVAILABLE'] = True
                        app.config['ANCAST_INSTALL_TYPE'] = 'local'
                        app.config['ANCAST_PATH'] = path
                        ancast_found = True
                        break
            
            if not ancast_found:
                app.logger.warning("Ancast package not found locally.")
                app.config['ANCAST_AVAILABLE'] = False
                app.config['ANCAST_INSTALL_INSTRUCTIONS'] = (
                    "To enable UMR evaluation with Ancast, please install it from GitHub:\n"
                    "1. git clone https://github.com/umr4nlp/ancast.git\n"
                    "2. cd ancast\n"
                    "3. pip install -e ."
                )
        except Exception as e:
            app.logger.error(f"Error checking for local Ancast installation: {str(e)}")
            app.config['ANCAST_AVAILABLE'] = False
            app.config['ANCAST_INSTALL_INSTRUCTIONS'] = (
                "To enable UMR evaluation with Ancast, please install it from GitHub:\n"
                "1. git clone https://github.com/umr4nlp/ancast.git\n"
                "2. cd ancast\n"
                "3. pip install -e ."
            )

    # Check for custom Ancast path in environment variable
    if 'ANCAST_PATH' in os.environ and not app.config.get('ANCAST_PATH'):
        app.logger.info(f"Using custom Ancast path from environment: {os.environ['ANCAST_PATH']}")
        app.config['ANCAST_PATH'] = os.environ['ANCAST_PATH']
        app.config['ANCAST_INSTALL_TYPE'] = 'custom'
        app.config['ANCAST_AVAILABLE'] = True

    try:
        from umr_annot_tool.users.routes import users
        from umr_annot_tool.posts.routes import posts
        from umr_annot_tool.main.routes import main
        from umr_annot_tool.errors.handlers import errors
        from umr_annot_tool.main.validation_routes import validation

        app.register_blueprint(users)
        app.register_blueprint(posts)
        app.register_blueprint(main)
        app.register_blueprint(validation)
        app.register_blueprint(errors)
        app.logger.info("Application initialized successfully")
    except Exception as e:
        app.logger.error(f"Error during initialization: {str(e)}")
        import traceback
        app.logger.error(traceback.format_exc())

    # Register error handlers to return JSON for API routes
    @app.errorhandler(Exception)
    def handle_exception(e):
        """Handle exceptions for API routes and return JSON instead of HTML."""
        # Pass through HTTP errors
        if isinstance(e, HTTPException):
            # Only convert to JSON for API routes
            if request.path.startswith('/run_ancast_evaluation'):
                response = jsonify({"error": e.description})
                response.status_code = e.code
                return response
            return e
        
        # For Ancast evaluation route, always return JSON
        if request.path.startswith('/run_ancast_evaluation'):
            app.logger.error(f"Unhandled exception in {request.path}: {str(e)}")
            app.logger.exception(e)
            response = jsonify({"error": f"Internal server error: {str(e)}"})
            response.status_code = 500
            return response
            
        # For other routes, use the default handler
        app.logger.error(f"Unhandled exception: {str(e)}")
        app.logger.exception(e)
        return render_template('errors/500.html'), 500

    # Configure static file handling
    @app.after_request
    def add_header(response):
        # Set cache control for static files to improve performance
        if 'static/' in request.path:
            # Cache static files for 1 hour
            response.headers['Cache-Control'] = 'public, max-age=3600'
        return response
        
    # Debug route to help diagnose static file issues
    @app.route('/debug/static-files')
    def debug_static_files():
        """Return information about static files for debugging"""
        import os
        static_dir = os.path.join(app.root_path, 'static')
        styles_dir = os.path.join(static_dir, 'styles')
        scripts_dir = os.path.join(static_dir, 'scripts')
        
        info = {
            'static_folder': app.static_folder,
            'static_url_path': app.static_url_path,
            'static_dir_exists': os.path.exists(static_dir),
            'styles_dir_exists': os.path.exists(styles_dir),
            'scripts_dir_exists': os.path.exists(scripts_dir),
            'styles_files': os.listdir(styles_dir) if os.path.exists(styles_dir) else [],
            'scripts_files': os.listdir(scripts_dir) if os.path.exists(scripts_dir) else [],
        }
        return jsonify(info)

    return app