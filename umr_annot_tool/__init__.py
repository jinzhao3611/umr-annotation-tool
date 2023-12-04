from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import LoginManager
from flask_mail import Mail
from umr_annot_tool.config1 import Config
import logging

# extensions
db = SQLAlchemy()
bcrypt = Bcrypt()
login_manager = LoginManager()
login_manager.login_view = 'users.login'
login_manager.login_message_category = 'info'
mail = Mail()


def create_app(config_class=Config):
    app = Flask(__name__)
    logging.basicConfig(level=logging.DEBUG, format=f'%(asctime)s %(levelname)s %(name)s: %(message)s')
    logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
    app.config.from_object(Config)

    db.init_app(app)
    bcrypt.init_app(app)
    login_manager.init_app(app)
    mail.init_app(app)

    with app.app_context():
        db.create_all()

    from umr_annot_tool.users.routes import users  # this is a Blueprint instance we are importing here
    from umr_annot_tool.posts.routes import posts
    from umr_annot_tool.main.routes import main
    from umr_annot_tool.errors.handlers import errors
    app.register_blueprint(users)
    app.register_blueprint(posts)
    app.register_blueprint(main)
    app.register_blueprint(errors)

    return app