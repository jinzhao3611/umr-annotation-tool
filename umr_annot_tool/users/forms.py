from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileAllowed
from wtforms import StringField, PasswordField, SubmitField, BooleanField, TextAreaField
from wtforms.validators import DataRequired, Length, Email, EqualTo, ValidationError
from flask_login import current_user
from umr_annot_tool.models import User, Projectuser

class RegistrationForm(FlaskForm):
    username = StringField('Username',
                           validators=[DataRequired(), Length(min=2, max=60)])
    email = StringField('Email',
                        validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    confirm_password = PasswordField('Confirm Password',
                                     validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Sign Up')

    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user:
            raise ValidationError('That username is taken. Please choose a different one.')

    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user:
            raise ValidationError('That email is taken. Please choose a different one.')


class LoginForm(FlaskForm):
    email = StringField('Email',
                        validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    remember = BooleanField('Remember Me')
    submit = SubmitField('Login')


class UpdateAccountForm(FlaskForm):
    username = StringField('Username',
                           validators=[DataRequired(), Length(min=2, max=60)])
    email = StringField('Email',
                        validators=[DataRequired(), Email()])
    picture = FileField('Update Profile Picture', validators=[FileAllowed(['jpg', 'png'])])
    submit = SubmitField('Update')

    def validate_username(self, username):
        if username.data != current_user.username:
            user = User.query.filter_by(username=username.data).first()
            if user:
                raise ValidationError('That username is taken. Please choose a different one.')

    def validate_email(self, email):
        if email.data != current_user.email:
            user = User.query.filter_by(email=email.data).first()
            if user:
                raise ValidationError('That email is taken. Please choose a different one.')

class UpdateProjectForm(FlaskForm):
    projectname = StringField('Project name',
                           validators=[DataRequired(), Length(min=2, max=60)])
    submit = SubmitField('Update')

    def validate_projectname(self, projectname):
        project = Projectuser.query.filter(Projectuser.project_name == projectname.data,
                                           Projectuser.user_id == current_user.id).first()
        if project:
            raise ValidationError(f'This projectname already exists in your projects. Please choose a different one.')

class RequestResetForm(FlaskForm):
    email = StringField('Email',
                        validators=[DataRequired(), Email()])
    submit = SubmitField('Request Password Reset')

    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user is None:
            raise ValidationError('There is no account with that email, you must register first.')

class ResetPasswordForm(FlaskForm):
    password = PasswordField('Password', validators=[DataRequired()])
    confirm_password = PasswordField('Confirm Password',
                                     validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Reset Password')

class LexiconSearchForm(FlaskForm):
    search_term = StringField('Search Term', 
                            validators=[DataRequired()],
                            render_kw={"placeholder": "Enter lemma to search"})
    submit = SubmitField('Search')

class LexiconAddForm(FlaskForm):
    lemma = StringField('Lemma', 
                       validators=[DataRequired()],
                       render_kw={"placeholder": "Enter lemma"})
    args = TextAreaField('Arguments (JSON format)', 
                        validators=[DataRequired()],
                        render_kw={"placeholder": "{\n  \"ARG0\": \"agent\",\n  \"ARG1\": \"patient\"\n}"})
    submit = SubmitField('Add Entry')
