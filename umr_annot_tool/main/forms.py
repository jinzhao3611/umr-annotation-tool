from flask_wtf import FlaskForm
from flask_wtf.file import FileField
from wtforms import BooleanField, SubmitField, SelectField

class UploadForm(FlaskForm):
    file = FileField()
    # language_mode = RadioField('Language', choices=[("English", "English"), ("Default", "Default")])
    language_mode = SelectField('Language', choices=[("Default", "Default"), ("English", "English"), ("Chinese", "Chinese")])
    file_format = SelectField('Format', choices=[('plain_text', 'plain_text'), ('flex1', 'flex1'), ('flex2', 'flex2'), ('flex3', 'flex3'), ('toolbox1', 'toolbox1'), ('toolbox2', 'toolbox2'),  ('toolbox3', 'toolbox3')])
    if_exported = BooleanField('exported_file')
    submit = SubmitField('Annotate')

