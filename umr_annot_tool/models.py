from datetime import datetime
from umr_annot_tool import db, login_manager
from flask import current_app
from flask_login import UserMixin
from itsdangerous import TimedJSONWebSignatureSerializer as Serializer # email and password reset
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy import Column, Integer, JSON, text
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
    docqcs = db.relationship('Docqc', backref='author', lazy=True)
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
        return f"User('{self.username}', '{self.email}', '{self.image_file}'"

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('user')
        super(User, self).__init__(**kwargs)


class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    date_posted = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    def __repr__(self):
        return f"Post('{self.title}', '{self.date_posted}')"

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

class Doc(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.Text, nullable=False)
    lang = db.Column(db.Text, nullable=False)
    content = db.Column(db.Text, nullable=False)
    file_format = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    sents = db.relationship('Sent', backref='doc', lazy=True)
    annotations = db.relationship('Annotation', backref='doc', lazy=True)
    docqcs = db.relationship('Docqc', backref='doc', lazy=True)
    docdas = db.relationship('Docda', backref='doc', lazy=True)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('doc')
        super(Doc, self).__init__(**kwargs)

    def __repr__(self):
        return f"Doc('{self.filename}', '{self.lang}')"

class Sent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    doc_id = db.Column(db.Integer, db.ForeignKey('doc.id'), nullable=False)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('sent')
        super(Sent, self).__init__(**kwargs)

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
    real_sent_id = db.Column(db.Integer, db.ForeignKey('sent.id'), nullable=True)


    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('annotation')
        super(Annotation, self).__init__(**kwargs)

    def __repr__(self):
        return f"Annot('{self.id}')"



class Lexicon(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    lexi = db.Column(MutableDict.as_mutable(JSON), nullable=False)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('lexicon')
        super(Lexicon, self).__init__(**kwargs)

class Projectuser(db.Model): #this table keeps track of each user's permission for each project
    id = db.Column(db.Integer, primary_key=True)
    project_name = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    permission = db.Column(db.Text, default="view", nullable=False)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('projectuser')
        super(Projectuser, self).__init__(**kwargs)



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

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('project')
        super(Project, self).__init__(**kwargs)

class Docqc(db.Model): # this table is used to document which member in the project has uploaded annotations to qc folder, because once the file is uploaded, the file will be duplicated and put under project qc user
    id = db.Column(db.Integer, primary_key=True) #maybe not necessary
    doc_id = db.Column(db.Integer, db.ForeignKey('doc.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    upload_member_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('docqc')
        super(Docqc, self).__init__(**kwargs)


class Docda(db.Model):
    id = db.Column(db.Integer, primary_key=True) #maybe not necessary
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    doc_id = db.Column(db.Integer, db.ForeignKey('doc.id'), nullable=False)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('docda')
        super(Docda, self).__init__(**kwargs)

class Lattice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    aspect = db.Column(MutableDict.as_mutable(JSON), nullable=False)
    person = db.Column(MutableDict.as_mutable(JSON), nullable=False)
    number = db.Column(MutableDict.as_mutable(JSON), nullable=False)
    modal = db.Column(MutableDict.as_mutable(JSON), nullable=False)
    discourse = db.Column(MutableDict.as_mutable(JSON), nullable=False)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('lattice')
        super(Lattice, self).__init__(**kwargs)

class Partialgraph(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    partial_umr = db.Column(MutableDict.as_mutable(JSON), nullable=False)

    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = get_lowest_unused_id('partialgraph')
        super(Partialgraph, self).__init__(**kwargs)