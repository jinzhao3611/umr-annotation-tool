import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, request, jsonify, render_template
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
    flask_handler.setLevel(logging.DEBUG)
    flask_formatter = logging.Formatter('%(asctime)s [FLASK] %(levelname)s: %(message)s')
    flask_handler.setFormatter(flask_formatter)
    
    # Configure SQLAlchemy logger
    sql_handler = logging.FileHandler('logs/sqlalchemy.log', mode='w')
    sql_handler.setLevel(logging.INFO)
    sql_formatter = logging.Formatter('%(asctime)s [SQL] %(levelname)s: %(message)s')
    sql_handler.setFormatter(sql_formatter)

    # Configure console handler for immediate output
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    console_formatter = logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s')
    console_handler.setFormatter(console_formatter)

    # Setup Flask logger
    app.logger.setLevel(logging.DEBUG)
    app.logger.addHandler(flask_handler)
    app.logger.addHandler(console_handler)
    
    # Setup SQLAlchemy logger
    sql_logger = logging.getLogger('sqlalchemy.engine')
    sql_logger.setLevel(logging.INFO)
    sql_logger.addHandler(sql_handler)
    sql_logger.addHandler(console_handler)

    # Test logging
    app.logger.info("INITIALIZATION TEST - Flask app logger configured")
    sql_logger.info("INITIALIZATION TEST - SQLAlchemy logger configured")

    # Initialize extensions
    db.init_app(app)
    bcrypt.init_app(app)
    login_manager.init_app(app)
    mail.init_app(app)

    # Register context processor to make current year available in all templates
    @app.context_processor
    def inject_year():
        return {'current_year': datetime.datetime.now().year}

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
        app.logger.info("Registering blueprints...")
        from umr_annot_tool.users.routes import users
        from umr_annot_tool.posts.routes import posts
        from umr_annot_tool.main.routes import main
        from umr_annot_tool.errors.handlers import errors
        
        app.logger.info("Registering users blueprint...")
        app.register_blueprint(users)
        app.logger.info("Registering posts blueprint...")
        app.register_blueprint(posts)
        app.logger.info("Registering main blueprint...")
        app.register_blueprint(main)
        app.logger.info("Registering errors blueprint...")
        app.register_blueprint(errors)
        app.logger.info("All blueprints registered successfully")
    except Exception as e:
        app.logger.error(f"Error registering blueprints: {str(e)}")
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

    return app