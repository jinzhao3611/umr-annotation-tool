from flask_wtf import FlaskForm
from flask_wtf.file import FileField
from wtforms import BooleanField, SubmitField, SelectField, TextAreaField, StringField

class UploadForm(FlaskForm):
    file = FileField()
    language_mode = SelectField('Language', choices=[("arapahoe","arapahoe"),
                                                     ("chinese", "chinese"),
                                                     ("default", "default"),
                                                     ("english", "english"),
                                                     ("navajo", "navajo"),
                                                     ("sanapana", "sanapana"),
                                                     ("secoya", "secoya"),
                                                     ("kukama", "kukama"),])
    file_format = SelectField('Format', choices=[('plain_text', 'plain_text'), ('flex1', 'flex1'), ('flex2', 'flex2'), ('flex3', 'flex3'), ('toolbox1', 'toolbox1'), ('toolbox2', 'toolbox2'),  ('toolbox3', 'toolbox3')])
    if_exported = BooleanField('exported_file')
    submit = SubmitField('Annotate')


class UploadLexiconForm(FlaskForm):
    file = FileField()
    language_mode = SelectField('Language', choices=[("arapahoe","arapahoe"),
                                                     ("chinese", "chinese"),
                                                     ("english", "english"),
                                                     ("navajo", "navajo"),
                                                     ("sanapana", "sanapana"),
                                                     ("secoya", "secoya"),
                                                     ("kukama", "kukama"),])
    submit = SubmitField('Upload')

class LexiconItemForm(FlaskForm):
    inflected_form = StringField('inflected form')
    lemma = StringField('lemma')
    root = StringField('root')
    pos = StringField('part of speech')
    sense_number = TextAreaField("number")
    sense_gloss = TextAreaField("gloss")
    sense_args = TextAreaField("args")
    sense_coding_frames = TextAreaField("coding frames")
    submit = SubmitField('Add')

class LookUpLexiconItemForm(FlaskForm):
    inflected_form = StringField('inflected form')
    submit = SubmitField('Look up')
