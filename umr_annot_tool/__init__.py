import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import LoginManager
from flask_mail import Mail
from umr_annot_tool.config import Config
import sys

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

    return app