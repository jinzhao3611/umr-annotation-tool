from flask_wtf import FlaskForm
from flask_wtf.file import FileField
from wtforms import RadioField, SubmitField, SelectField

class UploadForm(FlaskForm):
    file = FileField()
    # language_mode = RadioField('Language', choices=[("English", "English"), ("Default", "Default")])
    language_mode = SelectField('Language', choices=[("English", "English"), ("Default", "Default")])
    file_format = SelectField('Format', choices=[('plain_text', 'plain_text'), ('flex1', 'flex1'), ('flex2', 'flex2'), ('flex3', 'flex3'), ('flex4', 'flex4'), ('toolbox1', 'toolbox1'), ('toolbox2', 'toolbox2'), ('exported_file', 'exported_file')])
    submit = SubmitField('Annotate')

