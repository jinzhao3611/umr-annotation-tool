from datetime import datetime
from flask import current_app
from flask_login import UserMixin
# from itsdangerous import TimedJSONWebSignatureSerializer as Serializer
from itsdangerous import URLSafeTimedSerializer as Serializer
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.dialects.postgresql import ARRAY, JSON

from umr_annot_tool import db, login_manager


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


class User(db.Model, UserMixin):
    __tablename__ = "app_user"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    image_file = db.Column(db.String(20), nullable=False, default='default.jpg')
    password = db.Column(db.String(60), nullable=False)

    # Example relationships
    posts = db.relationship('Post', backref='author', lazy=True)
    docs = db.relationship('Doc', backref='author', lazy=True)
    projectusers = db.relationship('Projectuser', backref='author', lazy=True)
    projects_created = db.relationship("Project", backref="creator", lazy=True)

    def get_reset_token(self, expires_sec=1800):
        """Generate token for resetting password."""
        s = Serializer(current_app.config['SECRET_KEY'], expires_sec)
        return s.dumps({'user_id': self.id}).decode('utf-8')

    @staticmethod
    def verify_reset_token(token):
        """Verify token for resetting password."""
        s = Serializer(current_app.config['SECRET_KEY'])
        try:
            user_id = s.loads(token)['user_id']
        except:
            return None
        return User.query.get(user_id)

    def __repr__(self):
        return f"User('{self.username}', '{self.email}', '{self.image_file}')"


class Post(db.Model):
    __tablename__ = "post"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(100), nullable=False)
    date_posted = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    content = db.Column(db.Text, nullable=False)

    user_id = db.Column(db.Integer, db.ForeignKey('app_user.id'), nullable=False)

    def __repr__(self):
        return f"Post('{self.title}', '{self.date_posted}')"


class Project(db.Model):
    __tablename__ = "project"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    project_name = db.Column(db.String(100), nullable=False, unique=True)
    language = db.Column(db.String(50), nullable=False)

    created_by_user_id = db.Column(db.Integer, db.ForeignKey('app_user.id'), nullable=True)

    # One-to-one relationships to Lexicon, Lattice, Partialgraph
    lexicon = db.relationship("Lexicon", uselist=False, back_populates="project")
    lattice = db.relationship("Lattice", uselist=False, back_populates="project")
    partialgraph = db.relationship("Partialgraph", uselist=False, back_populates="project")

    def __repr__(self):
        return f"<Project(name='{self.project_name}', language='{self.language}')>"


class Projectuser(db.Model):
    __tablename__ = "projectuser"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    project_name = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('app_user.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)

    permission = db.Column(db.Text, default="view", nullable=False)

    def __repr__(self):
        return f"<Projectuser(user_id={self.user_id}, project_id={self.project_id}, permission='{self.permission}')>"


class Doc(db.Model):
    __tablename__ = "doc"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    filename = db.Column(db.Text, nullable=False)

    user_id = db.Column(db.Integer, db.ForeignKey('app_user.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)

    sents = db.relationship('Sent', backref='doc', lazy=True)
    doc_versions = db.relationship("DocVersion", backref="doc", lazy=True)

    def __repr__(self):
        return f"Doc(filename='{self.filename}', id={self.id})"


class Sent(db.Model):
    __tablename__ = "sent"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    content = db.Column(db.Text, nullable=False)
    doc_id = db.Column(db.Integer, db.ForeignKey('doc.id'), nullable=False)

    def __repr__(self):
        return f"Sent(id={self.id}, doc_id={self.doc_id})"


class DocVersion(db.Model):
    __tablename__ = "doc_version"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    doc_id = db.Column(db.Integer, db.ForeignKey('doc.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('app_user.id'), nullable=True)

    stage = db.Column(db.String(50), nullable=False, default='checkout')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    version_number = db.Column(db.Integer, default=1)

    annotations = db.relationship("Annotation", backref="doc_version", lazy=True)

    def __repr__(self):
        return (f"DocVersion(id={self.id}, doc_id={self.doc_id}, "
                f"user_id={self.user_id}, stage='{self.stage}', "
                f"version_number={self.version_number})")


class Annotation(db.Model):
    __tablename__ = "annotation"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    sent_annot = db.Column(db.Text, nullable=False)
    doc_annot = db.Column(db.Text, nullable=False)
    actions = db.Column(JSON, nullable=False, server_default='{}')
    alignment = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')

    doc_version_id = db.Column(db.Integer, db.ForeignKey('doc_version.id'), nullable=False)
    sent_id = db.Column(db.Integer, db.ForeignKey('sent.id'), nullable=False)

    sent = db.relationship("Sent", backref="annotations", lazy=True)

    def __repr__(self):
        return f"Annotation(id={self.id}, doc_version_id={self.doc_version_id}, sent_id={self.sent_id})"


class Lexicon(db.Model):
    __tablename__ = "lexicon"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False, unique=True)
    data = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')

    project = db.relationship("Project", back_populates="lexicon")

    def __repr__(self):
        return f"<Lexicon(project_id={self.project_id})>"


class Lattice(db.Model):
    __tablename__ = "lattice"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False, unique=True)
    data = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')

    project = db.relationship("Project", back_populates="lattice")

    def __repr__(self):
        return f"<Lattice(project_id={self.project_id})>"


class Partialgraph(db.Model):
    __tablename__ = "partialgraph"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False, unique=True)
    partial_umr = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')

    project = db.relationship("Project", back_populates="partialgraph")

    def __repr__(self):
        return f"<Partialgraph(project_id={self.project_id})>"
