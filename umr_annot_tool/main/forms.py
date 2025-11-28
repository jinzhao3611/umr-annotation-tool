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


class CreateProjectForm(FlaskForm):
    projectname = StringField('Project Name', validators=[DataRequired(), Length(min=2, max=100)])
    language = SelectField('Language', choices=[
        ('English', 'English'),
        ('Chinese', 'Chinese'),
        ('Arapaho', 'Arapaho'),
        ('Arabic', 'Arabic'),
        ('Sanapana', 'Sanapana'),
        ('Kukama', 'Kukama'),
        ('Navajo', 'Navajo'),
        ('Latin', 'Latin'),
        ('Czech', 'Czech'),
        ('Uzbek', 'Uzbek'),
        ('other', 'Other (specify below)')
    ], validators=[DataRequired()])
    custom_language = StringField('Custom Language Name')
    submit = SubmitField('Create Project')

    def validate_projectname(self, projectname):
        # Check both Project and Projectuser tables
        project = Project.query.filter_by(project_name=projectname.data).first()
        projectuser = Projectuser.query.filter_by(project_name=projectname.data).first()
        if project or projectuser:
            raise ValidationError(f'Name "{projectname.data}" already exists, choose another one.')


class OverrideDocumentForm(FlaskForm):
    file = FileField('UMR File Upload', validators=[DataRequired()])
    submit = SubmitField('Override Document')

