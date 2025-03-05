from flask_wtf import FlaskForm
from flask_wtf.file import FileField
from wtforms import BooleanField, SubmitField, SelectField, TextAreaField, StringField, FieldList, FormField, MultipleFileField
from wtforms.validators import DataRequired, Length, Email, EqualTo, ValidationError
from umr_annot_tool.models import Projectuser, Project
from flask_login import current_user


class UploadForm(FlaskForm):
    files = MultipleFileField('UMR File(s) Upload')
    submit = SubmitField('Upload')

class UploadFormSimpleVersion(FlaskForm):
    files = MultipleFileField('UMR File(s) Upload')
    submit = SubmitField('Upload')


class UploadLexiconForm(FlaskForm):
    file = FileField()
    format = SelectField('Format', choices=[("flex", "flex"), ("toolbox", "toolbox")])
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
    remove = SubmitField(label='Delete')

class InflectedForm(FlaskForm):
    class Meta:
        csrf = False
    inflected_form = StringField('inflected_form')
    remove = SubmitField(label='Delete')

class LexiconItemForm(FlaskForm):
    class Meta:
        csrf = False # this is to work around typeerror: argument of type 'csrftokenfield' is not iterable, see https://wtforms.readthedocs.io/en/2.3.x/csrf/
    lemma = StringField('lemma')
    root = StringField('root')
    pos = StringField('part of speech')

    inflected_forms = FieldList(FormField(InflectedForm), min_entries=0)
    senses = FieldList(FormField(SenseForm), min_entries=0)

    update_mode = SelectField('update mode', choices=[("edit", "edit current entry"),
                                                     ("delete", "delete current entry"),])
    add_inflected = SubmitField('+ Add New Inflected Form Field')
    add_sense = SubmitField('+ Add New Sense Field')

    submit = SubmitField('Save')

class LexiconAddForm(FlaskForm):
    class Meta:
        csrf = False  # this is to work around typeerror: argument of type 'csrftokenfield' is not iterable, see https://wtforms.readthedocs.io/en/2.3.x/csrf/

    lemma = StringField('lemma')
    root = StringField('root')
    pos = StringField('part of speech')

    inflected_forms = FieldList(FormField(InflectedForm), min_entries=0)
    senses = FieldList(FormField(SenseForm), min_entries=0)

    add_inflected = SubmitField('+ Add New Inflected Form Field')
    add_sense = SubmitField('+ Add New Sense Field')

    save = SubmitField('Save')


class CreateProjectForm(FlaskForm):
    projectname = StringField('Project Name', validators=[DataRequired(), Length(min=2, max=100)])
    language = SelectField('Language', choices=[
        ('English', 'English'),
        ('Chinese', 'Chinese'),
        ('Arapaho', 'Arapaho'),
        ('other', 'Other (specify below)')
    ], validators=[DataRequired()])
    custom_language = StringField('Custom Language Name')
    submit = SubmitField('Create Project')

    def validate_projectname(self, projectname):
        # Check both Project and Projectuser tables
        project = Project.query.filter_by(project_name=projectname.data).first()
        if project:
            raise ValidationError(f'This project name already exists. Please choose a different one.')

