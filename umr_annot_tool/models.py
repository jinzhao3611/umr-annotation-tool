from datetime import datetime
from umr_annot_tool import db, login_manager
from flask import current_app
from flask_login import UserMixin
from itsdangerous import TimedJSONWebSignatureSerializer as Serializer # email and password reset
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy import Column, Integer, JSON



@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    image_file = db.Column(db.String(20), nullable=False, default='default.jpg')
    password = db.Column(db.String(60), nullable=False)
    # created_at = db.Column(db.DateTime)
    # last_login = db.Column(db.DateTime, default=db.func.now())

    posts = db.relationship('Post', backref='author', lazy=True)
    annotations = db.relationship('Annotation', backref='author', lazy=True)
    docs = db.relationship('Doc', backref='author', lazy=True)
    sents = db.relationship('Sent', backref='author', lazy=True)
    projectusers = db.relationship('Projectuser', backref='author', lazy=True)



    """generate the token for resetting password with email"""
    def get_reset_token(self, expires_sec=1800): #30 minutes
        s = Serializer(current_app.config['SECRET_KEY'], expires_sec)
        return s.dumps({'user_id': self.id}).decode('utf-8')

    """verify the token for resetting password with email"""
    @staticmethod
    def verify_reset_token(token):
        s = Serializer(current_app.config['SECRET_KEY'])
        try:
            user_id = s.loads(token)['user_id']
        except:
            return None
        return User.query.get(user_id)

    def __repr__(self):
        return f"User('{self.username}', '{self.email}', '{self.image_file}', '{self.lexicon}')"


class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    date_posted = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    def __repr__(self):
        return f"Post('{self.title}', '{self.date_posted}')"

class Doc(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.Text, nullable=False)
    file_format = db.Column(db.Text, nullable=False)
    content = db.Column(db.Text, nullable=False)
    lang = db.Column(db.Text, nullable=False)
    sents = db.relationship('Sent', backref='document', lazy=True)
    annotations = db.relationship('Annotation', backref='document', lazy=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'))


    def __repr__(self):
        return f"Doc('{self.id}')"

class Sent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    doc_id = db.Column(db.Integer, db.ForeignKey('doc.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    def __repr__(self):
        return f"Sent('{self.id}')"

class Annotation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    annot_str = db.Column(db.Text, nullable=False)
    doc_annot = db.Column(db.Text, nullable=False)
    alignment = db.Column(db.Text, nullable=False)
    umr = db.Column(MutableDict.as_mutable(JSON), nullable=False)
    doc_umr = db.Column(MutableDict.as_mutable(JSON), nullable=False)
    # sent_id = db.Column(db.Integer, db.ForeignKey('sent.id'), nullable=False)
    sent_id = db.Column(db.Integer, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    doc_id = db.Column(db.Integer, db.ForeignKey('doc.id'), nullable=False)

    def __repr__(self):
        return f"Annot('{self.id}'"


class Lexicon(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lang = db.Column(db.Text, nullable=False)
    lexi = db.Column(MutableDict.as_mutable(JSON))

class Projectuser(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_name = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    permission = db.Column(db.Text)



class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_name = db.Column(db.Text, nullable=False)

    projectusers = db.relationship('Projectuser', backref="project", lazy=True)
    docs = db.relationship('Doc', backref='project', lazy=True)
