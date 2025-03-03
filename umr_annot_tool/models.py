from datetime import datetime
from flask import current_app
from flask_login import UserMixin
from itsdangerous import TimedJSONWebSignatureSerializer as Serializer
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import ARRAY, JSON

from umr_annot_tool import db, login_manager


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


def get_lowest_unused_id(table_name):
    """Get the lowest unused ID for a given table by finding gaps in the sequence."""
    sql = text(f"SELECT id FROM {table_name} ORDER BY id")
    result = db.session.execute(sql)
    used_ids = [r[0] for r in result]

    new_id = 1
    for used_id in sorted(used_ids):
        if used_id != new_id:
            break
        new_id += 1
    return new_id


class User(db.Model, UserMixin):
    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    image_file = db.Column(db.String(20), nullable=False, default='default.jpg')
    password = db.Column(db.String(60), nullable=False)

    # Example relationships
    posts = db.relationship('Post', backref='author', lazy=True)
    # If you want references to user-created docs or docversions, you can do so
    docs = db.relationship('Doc', backref='author', lazy=True)
    # For Project-user membership
    projectusers = db.relationship('Projectuser', backref='author', lazy=True)

    # This references any project where user is "creator"
    projects_created = db.relationship("Project", backref="creator", lazy=True)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('user')
        super(User, self).__init__(**kwargs)

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

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    date_posted = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    content = db.Column(db.Text, nullable=False)

    # Foreign key to User
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('post')
        super(Post, self).__init__(**kwargs)

    def __repr__(self):
        return f"Post('{self.title}', '{self.date_posted}')"


class Project(db.Model):
    __tablename__ = "project"

    id = db.Column(db.Integer, primary_key=True)
    project_name = db.Column(db.String(100), nullable=False)
    language = db.Column(db.String(50), nullable=False)

    # The user who created this project (optional)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)

    # One-to-one relationships to Lexicon, Lattice, Partialgraph
    lexicon = db.relationship("Lexicon", uselist=False, back_populates="project")
    lattice = db.relationship("Lattice", uselist=False, back_populates="project")
    partialgraph = db.relationship("Partialgraph", uselist=False, back_populates="project")

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('project')
        super(Project, self).__init__(**kwargs)

    def __repr__(self):
        return f"<Project(name='{self.project_name}', language='{self.language}')>"


class Projectuser(db.Model):
    """
    Tracks each user's permission for each project.
    For example: "admin", "annotator", "viewer", etc.
    """
    __tablename__ = "projectuser"

    id = db.Column(db.Integer, primary_key=True)
    project_name = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)

    # e.g. "admin", "annotate", "view"
    permission = db.Column(db.Text, default="view", nullable=False)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('projectuser')
        super(Projectuser, self).__init__(**kwargs)

    def __repr__(self):
        return f"<Projectuser(user_id={self.user_id}, project_id={self.project_id}, permission='{self.permission}')>"


class Doc(db.Model):
    """
    Represents the original uploaded document (Part1).
    Typically only admins can upload or modify these.
    """
    __tablename__ = "doc"

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.Text, nullable=False)

    # The user who uploaded this doc (presumably an admin)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    # Which project does this doc belong to?
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)

    # Relationship to the sentences in this doc
    sents = db.relationship('Sent', backref='doc', lazy=True)

    # Relationship to various "versions" of this doc in different workflow stages
    doc_versions = db.relationship("DocVersion", backref="doc", lazy=True)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('doc')
        super(Doc, self).__init__(**kwargs)

    def __repr__(self):
        return f"Doc(filename='{self.filename}', id={self.id})"


class Sent(db.Model):
    """
    A single sentence in a doc. 
    """
    __tablename__ = "sent"

    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)

    # Which doc does this sentence belong to?
    doc_id = db.Column(db.Integer, db.ForeignKey('doc.id'), nullable=False)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('sent')
        super(Sent, self).__init__(**kwargs)

    def __repr__(self):
        return f"Sent(id={self.id}, doc_id={self.doc_id})"


class DocVersion(db.Model):
    """
    Represents a distinct 'version' of a Doc.
    - user_id: the user who is working on or submitted it (optional if shared).
    - stage: 'checkout', 'qc', 'adjudication', etc.
    """
    __tablename__ = "doc_version"

    id = db.Column(db.Integer, primary_key=True)

    # Which doc is being versioned
    doc_id = db.Column(db.Integer, db.ForeignKey('doc.id'), nullable=False)
    # The user who owns/created this version (for checkout or qc),
    # or possibly null if it's a shared adjudication version
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)

    # "checkout", "qc", "adjudication", "final", etc.
    stage = db.Column(db.String(50), nullable=False, default='checkout')

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    version_number = db.Column(db.Integer, default=1)

    # Relationship to all annotations in this version
    annotations = db.relationship("Annotation", backref="doc_version", lazy=True)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('doc_version')
        super(DocVersion, self).__init__(**kwargs)

    def __repr__(self):
        return (f"DocVersion(id={self.id}, doc_id={self.doc_id}, "
                f"user_id={self.user_id}, stage='{self.stage}', "
                f"version_number={self.version_number})")


class Annotation(db.Model):
    """
    An annotation by a user on a particular sentence within a particular DocVersion.
    """
    __tablename__ = "annotation"

    id = db.Column(db.Integer, primary_key=True)

    # For example, you might store the UMR or other annotation text
    sent_annot = db.Column(db.Text, nullable=False)
    doc_annot  = db.Column(db.Text, nullable=False)
    actions    = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='[]')
    alignment  = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')

    # Link to the DocVersion this annotation belongs to
    doc_version_id = db.Column(db.Integer, db.ForeignKey('doc_version.id'), nullable=False)

    # Link to the specific sentence
    sent_id = db.Column(db.Integer, db.ForeignKey('sent.id'), nullable=False)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('annotation')
        super(Annotation, self).__init__(**kwargs)

    def __repr__(self):
        return f"Annotation(id={self.id}, doc_version_id={self.doc_version_id}, sent_id={self.sent_id})"


class Lexicon(db.Model):
    __tablename__ = "lexicon"

    id = db.Column(db.Integer, primary_key=True)
    # One-to-one with Project, so unique
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False, unique=True)

    # Store lexical data as JSON
    data = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')

    project = db.relationship("Project", back_populates="lexicon")

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('lexicon')
        super(Lexicon, self).__init__(**kwargs)

    def __repr__(self):
        return f"<Lexicon(project_id={self.project_id})>"


class Lattice(db.Model):
    __tablename__ = "lattice"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False, unique=True)

    # Store custom data in JSON
    data = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')

    project = db.relationship("Project", back_populates="lattice")

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('lattice')
        super(Lattice, self).__init__(**kwargs)

    def __repr__(self):
        return f"<Lattice(project_id={self.project_id})>"


class Partialgraph(db.Model):
    __tablename__ = "partialgraph"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False, unique=True)

    partial_umr = db.Column(MutableDict.as_mutable(JSON), nullable=False, server_default='{}')

    project = db.relationship("Project", back_populates="partialgraph")

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('partialgraph')
        super(Partialgraph, self).__init__(**kwargs)

    def __repr__(self):
        return f"<Partialgraph(project_id={self.project_id})>"
