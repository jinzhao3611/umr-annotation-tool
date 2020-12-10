from flask_wtf import FlaskForm
from flask_wtf.file import FileField
from wtforms import RadioField, SubmitField

class UploadForm(FlaskForm):
    file = FileField()
    language_mode = RadioField('Language', choices=[("English", "English"), ("Default", "Default")])
    submit = SubmitField('Annotate')

