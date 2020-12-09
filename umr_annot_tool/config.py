import os
class Config:
    # todo: make the environment variable work
    # SECRET_KEY = os.environ.get('SECRET_KEY')
    # SQLALCHEMY_DATABASE_URI = os.environ.get('SQLALCHEMY_DATABASE_URI')
    SECRET_KEY = '5791628bb0b13ce0c676dfde280ba245'
    # SQLALCHEMY_DATABASE_URI = 'sqlite:///site.db'
    # SQLALCHEMY_DATABASE_URI = 'postgresql://localhost/umr'
    SQLALCHEMY_DATABASE_URI = 'postgres://hdcbeqfoavjeex:ec22d9cb4255a608e15bb194c0925d4a777fe8f97b16c9d292b8800b72060ee5@ec2-3-220-98-137.compute-1.amazonaws.com:5432/d9j5qn9cf58o3u'
    # SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', None)
    MAIL_SERVER = 'smtp.googlemail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get('EMAIL_USER')
    MAIL_PASSWORD = os.environ.get('EMAIL_PASS')



