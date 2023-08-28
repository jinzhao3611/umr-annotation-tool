from datetime import datetime

from sqlalchemy.orm import relationship
from sqlalchemy.sql import expression
from umr_annot_tool import db, login_manager
from flask import current_app
from flask_login import UserMixin
from itsdangerous import TimedJSONWebSignatureSerializer as Serializer # email and password reset
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy import Column, Integer, JSON
from sqlalchemy.dialects.postgresql import ARRAY



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
    projectusers = db.relationship('Projectuser', backref='author', lazy=True)
    projects = db.relationship('Project', backref='author', lazy=True)
    # docqcs = db.relationship('Docqc', backref='author', lazy=True)
    docdas = db.relationship('Docda', backref='author', lazy=True)



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
    docqcs = db.relationship('Docqc', backref='doc', lazy=True)
    docdas = db.relationship('Docda', backref='doc', lazy=True)

    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)

    def __repr__(self):
        return f"Doc('{self.id}')"

class Sent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    doc_id = db.Column(db.Integer, db.ForeignKey('doc.id'), nullable=False)

    def __repr__(self):
        return f"Sent('{self.id}')"

class Annotation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sent_annot = db.Column(db.Text, nullable=False)
    doc_annot = db.Column(db.Text, nullable=False)
    sent_umr = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')
    doc_umr = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')
    actions = db.Column(ARRAY(db.Text), nullable=False, server_default='{}')
    alignment = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')
    sent_id = db.Column(db.Integer, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    doc_id = db.Column(db.Integer, db.ForeignKey('doc.id'), nullable=False)

    def __repr__(self):
        return f"Annot('{self.id}'"


class Lexicon(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    lexi = db.Column(MutableDict.as_mutable(JSON), nullable=False)

class Projectuser(db.Model): #this table keeps track of each user's permission for each project
    id = db.Column(db.Integer, primary_key=True)
    project_name = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    permission = db.Column(db.Text, default="view", nullable=False)



class Project(db.Model): #this table keeps track of the Project and the qc user id for this project
    id = db.Column(db.Integer, primary_key=True)
    project_name = db.Column(db.Text, nullable=False)
    qc_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    projectusers = db.relationship('Projectuser', backref="project", lazy=True)
    lexicons = db.relationship('Lexicon', backref="project", lazy=True)
    docs = db.relationship('Doc', backref='project', lazy=True)
    docqcs = db.relationship('Docqc', backref='project', lazy=True)
    docdas = db.relationship('Docda', backref='project', lazy=True)
    lattices = db.relationship('Lattice', backref='project', lazy=True)
    partialgraphs = db.relationship('Partialgraph', backref='project', lazy=True)

    #new column
    visibility = db.Column(db.Boolean, server_default=expression.false(), nullable=False)

class Docqc(db.Model): # this table is used to document which member in the project has uploaded annotations to qc folder, because once the file is uploaded, the file will be duplicated and put under project qc user
    id = db.Column(db.Integer, primary_key=True) #maybe not necessary
    doc_id = db.Column(db.Integer, db.ForeignKey('doc.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    upload_member_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    # new columns
    qc_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    sent_annot = db.Column(db.Text, nullable=False)
    doc_annot = db.Column(db.Text, nullable=False)
    sent_umr = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')
    doc_umr = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')
    actions = db.Column(ARRAY(db.Text), nullable=False, server_default='{}')
    alignment = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')
    sent_id = db.Column(db.Integer, nullable=False)
    # related to User
    upload_member = relationship('User', foreign_keys=[upload_member_id])
    qc_user = relationship('User', foreign_keys=[qc_user_id])

class Docda(db.Model):
    id = db.Column(db.Integer, primary_key=True) #maybe not necessary
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    doc_id = db.Column(db.Integer, db.ForeignKey('doc.id'), nullable=False)
    # new columns
    sent_annot = db.Column(db.Text, nullable=False)
    doc_annot = db.Column(db.Text, nullable=False)
    sent_umr = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')
    doc_umr = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')
    actions = db.Column(ARRAY(db.Text), nullable=False, server_default='{}')
    alignment = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')
    sent_id = db.Column(db.Integer, nullable=False)

class Lattice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    aspect = db.Column(MutableDict.as_mutable(JSON), nullable=False)
    person = db.Column(MutableDict.as_mutable(JSON), nullable=False)
    number = db.Column(MutableDict.as_mutable(JSON), nullable=False)
    modal = db.Column(MutableDict.as_mutable(JSON), nullable=False)
    discourse = db.Column(MutableDict.as_mutable(JSON), nullable=False)

class Partialgraph(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    partial_umr = db.Column(MutableDict.as_mutable(JSON), nullable=False)

