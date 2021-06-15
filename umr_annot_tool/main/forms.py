from flask_wtf import FlaskForm
from flask_wtf.file import FileField
from wtforms import BooleanField, SubmitField, SelectField, TextAreaField, StringField, FieldList, FormField

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


class SenseForm(FlaskForm):
    gloss = TextAreaField("gloss")
    args = TextAreaField("args")
    coding_frames = TextAreaField("coding frames")

class InflectedForm(FlaskForm):
    inflected_form = StringField('inflected_form')

class LexiconItemForm(FlaskForm):
    lemma = StringField('lemma')
    root = StringField('root')
    pos = StringField('part of speech')

    inflected_forms = FieldList(FormField(InflectedForm), min_entries=0)
    senses = FieldList(FormField(SenseForm), min_entries=0)

    update_mode = SelectField('update mode', choices=[("edit", "edit current entry"),
                                                     ("add", "add new entry"),
                                                     ("delete", "delete current entry"),])

    submit = SubmitField('Save')

class LookUpLexiconItemForm(FlaskForm):
    inflected_form = StringField('Type in inflected form to look up: ')
    lemma_form = StringField('Type in lemma form to look up: ')
    submit = SubmitField('Look up')
