import os
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False

    # this is using my own email as the sender
    # MAIL_SERVER = 'smtp.googlemail.com'
    # MAIL_PORT = 587
    # MAIL_USE_TLS = True
    # MAIL_USERNAME = os.environ.get('EMAIL_USER')
    # MAIL_PASSWORD = os.environ.get('EMAIL_PASS')

    # using twilio sendgrid:
    MAIL_SERVER = 'smtp.sendgrid.net'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = 'apikey'
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER')
    
    # Ancast configuration
    ANCAST_DIR = os.environ.get('ANCAST_PATH') or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'ancast')
    ANCAST_AVAILABLE = True
    ANCAST_INSTALL_INSTRUCTIONS = """
# Install Ancast from GitHub:
git clone https://github.com/umr4nlp/ancast.git
cd ancast
pip install -e .
"""