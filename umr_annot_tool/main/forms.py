from flask_wtf import FlaskForm
from flask_wtf.file import FileField
from wtforms import StringField
from wtforms.validators import DataRequired





class UploadForm(FlaskForm):
    file = FileField()
    autocomplete_input = StringField('autocomplete_input', validators=[DataRequired()])
