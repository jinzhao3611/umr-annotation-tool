from pathlib import Path

from flask import render_template, url_for, flash, redirect, request, Blueprint
from flask_login import login_user, current_user, logout_user, login_required
from umr_annot_tool import db, bcrypt
from umr_annot_tool.users.forms import RegistrationForm, LoginForm, UpdateAccountForm, RequestResetForm, \
    ResetPasswordForm
from umr_annot_tool.models import User, Post, Doc, Annotation, Sent
from umr_annot_tool.users.utils import save_picture, send_reset_email

from parse_input_xml import html

users = Blueprint('users', __name__)


@users.route("/register", methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.annotate'))
    form = RegistrationForm()
    if form.validate_on_submit():
        hashed_password = bcrypt.generate_password_hash(form.password.data).decode('utf-8')
        user = User(username=form.username.data, email=form.email.data, password=hashed_password, lexicon={})
        db.session.add(user)
        db.session.commit()
        flash('Your account has been created! You are now able to log in', 'success')

        filepath = Path(__file__).parent.parent.joinpath("static/sample_files/news-text-2-lorelei.txt")
        with open(filepath, 'r', encoding='utf-8') as f:
            content_string = f.read()
        print(content_string)
        filename = 'sample_snts_english.txt'
        file_format = 'plain_text'
        lang = 'english'
        info2display = html(content_string, file_format)
        doc = Doc(lang=lang, filename=filename, content=content_string, user_id=user.id,
                  file_format=file_format)
        db.session.add(doc)
        db.session.commit()
        flash('Your doc has been created!', 'success')
        for sent_of_tokens in info2display.sents:
            sent = Sent(content=" ".join(sent_of_tokens), doc_id=doc.id, user_id=user.id)
            db.session.add(sent)
            db.session.commit()
        flash('Your sents has been created.', 'success')

        return redirect(url_for('users.login'))
    return render_template('register.html', title='Register', form=form)


@users.route("/login", methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.account'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and bcrypt.check_password_hash(user.password, form.password.data):
            login_user(user, remember=form.remember.data)
            next_page = request.args.get('next')
            return redirect(next_page) if next_page else redirect(url_for('main.upload'))
        else:
            flash('Login Unsuccessful. Please check email and password', 'danger')
    return render_template('login.html', title='Login', form=form)


@users.route("/logout")
def logout():
    logout_user()
    return redirect(url_for('main.display_post'))


@users.route("/account", methods=['GET', 'POST'])
@login_required
def account():
    form = UpdateAccountForm()
    if form.validate_on_submit():
        if form.picture.data:
            picture_file = save_picture(form.picture.data)
            current_user.image_file = picture_file
        current_user.username = form.username.data
        current_user.email = form.email.data
        db.session.commit()
        flash('Your account has been updated!', 'success')
        return redirect(url_for('users.account'))
    elif request.method == 'POST':
        try:
            to_delete_doc_id = request.get_json(force=True)["delete_id"]
            Annotation.query.filter(Annotation.doc_id == to_delete_doc_id,
                                    Annotation.user_id == current_user.id).delete()
            Sent.query.filter(Sent.doc_id == to_delete_doc_id, Sent.user_id == current_user.id).delete()
            Doc.query.filter(Doc.id == to_delete_doc_id, Doc.user_id == current_user.id).delete()
            db.session.commit()
        except:
            print("deleting doc from database is failed")
    elif request.method == 'GET':
        form.username.data = current_user.username
        form.email.data = current_user.email
    image_file = url_for('static', filename='profile_pics/' + current_user.image_file)

    historyDocs = Doc.query.filter(Doc.user_id == current_user.id).all()
    print("historyDocs:", historyDocs)
    return render_template('account.html', title='Account',
                           image_file=image_file, form=form, historyDocs=historyDocs)


@users.route("/user/<string:username>")
def user_posts(username):
    page = request.args.get('page', default=1, type=int)
    user = User.query.filter_by(username=username).first_or_404()
    posts = Post.query.filter_by(author=user) \
        .order_by(Post.date_posted.desc()) \
        .paginate(page=page, per_page=2)
    return render_template('user_post.html', posts=posts, user=user)


@users.route("/reset_password", methods=['GET', 'POST'])
def reset_request():
    if current_user.is_authenticated:  # make sure they are logged out
        return redirect(url_for('main.display_post'))
    form = RequestResetForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        send_reset_email(user)
        flash('An email has been sent with instructions to reset your password', 'info')
        return redirect(url_for('users.login'))
    return render_template('reset_request.html', title='Reset Password', form=form)


@users.route("/reset_password/<token>", methods=['GET', 'POST'])
def reset_token(token):
    if current_user.is_authenticated:
        return redirect(url_for('main.display_post'))
    user = User.verify_reset_token(token)
    if user is None:
        flash('That is an invalid token or expired token', 'warning')
        return redirect(url_for('users.reset_request'))
    form = ResetPasswordForm()
    if form.validate_on_submit():
        hashed_password = bcrypt.generate_password_hash(form.password.data).decode('utf-8')
        user.password = hashed_password
        db.session.commit()
        flash('Your password has been updated! You are now able to log in', 'success')
        return redirect(url_for('users.login'))
    return render_template('reset_token.html', title='Reset Password', form=form)
