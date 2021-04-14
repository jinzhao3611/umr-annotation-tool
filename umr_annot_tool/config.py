import os
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')

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
    # todo: change MAIL_DEFAULT_SENDER
    MAIL_DEFAULT_SENDER = 'jinzhao3611@gmail.com'