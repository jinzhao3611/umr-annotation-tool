from flask_wtf import FlaskForm
from flask_wtf.file import FileField
from wtforms import BooleanField, SubmitField, SelectField, TextAreaField, StringField, FieldList, FormField, MultipleFileField

class UploadForm(FlaskForm):
    files = MultipleFileField('File(s) Upload')
    language_mode = SelectField('Language', choices=[("arapahoe","arapahoe"),
                                                     ("arabic", "arabic"),
                                                     ("chinese", "chinese"),
                                                     ("default", "default"),
                                                     ("english", "english"),
                                                     ("navajo", "navajo"),
                                                     ("sanapana", "sanapana"),
                                                     ("secoya", "secoya"),
                                                     ("kukama", "kukama"),])
    file_format = SelectField('Format', choices=[('plain_text', 'plain_text'), ('flex1', 'flex1'), ('flex2', 'flex2'), ('flex3', 'flex3'), ('toolbox1', 'toolbox1'), ('toolbox2', 'toolbox2'),  ('toolbox3', 'toolbox3'), ('toolbox4', 'toolbox4')])
    if_exported = BooleanField('exported_file')
    submit = SubmitField('Annotate')


class UploadLexiconForm(FlaskForm):
    file = FileField()
    language_mode = SelectField('Language', choices=[("arapahoe","arapahoe"),
                                                     ("arabic", "arabic"),
                                                     ("chinese", "chinese"),
                                                     ("english", "english"),
                                                     ("navajo", "navajo"),
                                                     ("sanapana", "sanapana"),
                                                     ("secoya", "secoya"),
                                                     ("kukama", "kukama"),])
    submit = SubmitField('Upload')


class LookUpLexiconItemForm(FlaskForm):
    inflected_form = StringField('Type in inflected form to look up: ')
    lemma_form = StringField('Type in lemma form to look up: ')
    submit = SubmitField('Look up')

class SenseForm(FlaskForm):
    class Meta:
        csrf = False
    gloss = TextAreaField("gloss")
    args = TextAreaField("args")
    coding_frames = TextAreaField("coding frames")

class InflectedForm(FlaskForm):
    class Meta:
        csrf = False
    inflected_form = StringField('inflected_form')

class LexiconItemForm(FlaskForm):
    class Meta:
        csrf = False # this is to work around typeerror: argument of type 'csrftokenfield' is not iterable, see https://wtforms.readthedocs.io/en/2.3.x/csrf/
    lemma = StringField('lemma')
    root = StringField('root')
    pos = StringField('part of speech')

    inflected_forms = FieldList(FormField(InflectedForm), min_entries=0)
    senses = FieldList(FormField(SenseForm), min_entries=0)

    update_mode = SelectField('update mode', choices=[("edit", "edit current entry"),
                                                     ("add", "add new entry"),
                                                     ("delete", "delete current entry"),])
    add_inflected = SubmitField('+ Add New Inflected Form Field')
    add_sense = SubmitField('+ Add New Sense Field')

    submit = SubmitField('Save')

