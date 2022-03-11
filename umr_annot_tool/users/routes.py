from pathlib import Path

from flask import render_template, url_for, flash, redirect, request, Blueprint, Response, current_app, session, jsonify, make_response
from flask_login import login_user, current_user, logout_user, login_required
from umr_annot_tool import db, bcrypt
from umr_annot_tool.users.forms import RegistrationForm, LoginForm, UpdateAccountForm, RequestResetForm, ResetPasswordForm, SearchUmrForm
from umr_annot_tool.models import User, Post, Doc, Annotation, Sent, Projectuser, Project
from umr_annot_tool.users.utils import save_picture, send_reset_email
from umr_annot_tool.permission import EditProjectPermission
from sqlalchemy.orm.attributes import flag_modified
import logging

from parse_input_xml import html
from flask_principal import Permission, RoleNeed, identity_changed, Identity, AnonymousIdentity

from lemminflect import getLemma


users = Blueprint('users', __name__)
# Create a permission with a single Need, in this case a RoleNeed.
admin_permission = Permission(RoleNeed('admin'))

@users.route("/register", methods=['GET', 'POST'])
def register():
    form = RegistrationForm()
    if form.validate_on_submit():
        hashed_password = bcrypt.generate_password_hash(form.password.data).decode('utf-8')
        user = User(username=form.username.data, email=form.email.data, password=hashed_password)
        db.session.add(user)
        db.session.commit()
        flash('Your account has been created! You are now able to log in', 'success')

        filepath = Path(__file__).parent.parent.joinpath("static/sample_files/news-text-2-lorelei.txt")
        with open(filepath, 'r', encoding='utf-8') as f:
            content_string = f.read()
        filename = 'news-text-2-lorelei.txt'
        file_format = 'plain_text'
        lang = 'english'
        info2display = html(content_string, file_format, lang)
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
        return redirect(url_for('users.account'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and bcrypt.check_password_hash(user.password, form.password.data):
            login_user(user, remember=form.remember.data)
            identity_changed.send(current_app._get_current_object(), identity=Identity(user.id)) #this is where the @identity_loaded.connect_via(app) decorator function got called
            next_page = request.args.get('next')
            return redirect(next_page) if next_page else redirect(url_for('main.upload'))
        else:
            flash('Login Unsuccessful. Please check email and password', 'danger')
    return render_template('login.html', title='Login', form=form)


@users.route("/logout")
def logout():
    logout_user()
    # Remove session keys set by Flask-Principal
    for key in ('identity.name', 'identity.auth_type'):
        session.pop(key, None)
    # Tell Flask-Principal the user is anonymous
    identity_changed.send(current_app._get_current_object(), identity=AnonymousIdentity())

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
            # click on the x sign to delete a single document
            to_delete_doc_id = request.get_json(force=True)["delete_id"]
            if to_delete_doc_id and to_delete_doc_id != 0:
                Annotation.query.filter(Annotation.doc_id == to_delete_doc_id,
                                        Annotation.user_id == current_user.id).delete()
                Sent.query.filter(Sent.doc_id == to_delete_doc_id, Sent.user_id == current_user.id).delete()
                Doc.query.filter(Doc.id == to_delete_doc_id, Doc.user_id == current_user.id).delete()

            # click on the x sign to delete all documents under a project
            to_delete_project_id = request.get_json(force=True)["delete_project"]
            if to_delete_project_id and to_delete_project_id !=0:
                Projectuser.query.filter(Projectuser.project_id == to_delete_project_id, Projectuser.user_id == current_user.id).delete()
                Project.query.filter(Project.id==to_delete_project_id).delete()
                to_delete_doc_ids = Doc.query.filter(Doc.project_id == to_delete_project_id).all()
                for to_delete_doc in to_delete_doc_ids:
                    Annotation.query.filter(Annotation.doc_id == to_delete_doc.id, Annotation.user_id == current_user.id).delete()
                    Sent.query.filter(Sent.doc_id == to_delete_doc.id, Sent.user_id == current_user.id).delete()
                    Doc.query.filter(Doc.id == to_delete_doc.id, Doc.user_id == current_user.id).delete()

            # click on add new project button to add new project
            new_project_name = request.get_json(force=True)["new_project_name"]
            if new_project_name:
                new_project = Project(project_name=new_project_name)
                db.session.add(new_project)
                db.session.commit()

                user_project = Projectuser(project_name=new_project_name, user_id=current_user.id, is_admin=True, is_member=False, project_id=new_project.id)
                db.session.add(user_project)
                db.session.commit()
                admin_projects = Projectuser.query.filter(Projectuser.user_id == current_user.id,
                                                          Projectuser.project_name == new_project_name,
                                                          Projectuser.is_admin == True).first()
                return make_response(jsonify({"adminProjectId": admin_projects.project_id}), 200)
            db.session.commit()
        except:
            print("deleting doc from database is failed")
    elif request.method == 'GET':
        form.username.data = current_user.username
        form.email.data = current_user.email
    image_file = url_for('static', filename='profile_pics/' + current_user.image_file)

    adminProjects = Projectuser.query.filter(Projectuser.user_id == current_user.id, Projectuser.is_admin == True).all()
    memberProjects = Projectuser.query.filter(Projectuser.user_id == current_user.id, Projectuser.is_member == True).all()
    historyDocs = Doc.query.filter(Doc.user_id == current_user.id).all()
    return render_template('account.html', title='Account',
                           image_file=image_file, form=form, historyDocs=historyDocs,
                           adminProjects=adminProjects, memberProjects=memberProjects)

@login_required
@users.route("/project/<int:project_id>", methods=['GET', 'POST'])
def project(project_id):
    if request.method == 'POST':
        try:
            update_doc_id = request.get_json(force=True)["update_doc_id"]
            update_doc_project_id = request.get_json(force=True)["update_doc_project_id"]
            new_member_name = request.get_json(force=True)["new_member_name"]
            remove_member_id = request.get_json(force=True)["remove_member_id"]
            if new_member_name:
                try:
                    new_member_user_id = User.query.filter(User.username==new_member_name).first().id
                    project_name = Project.query.filter(Project.id==project_id).first().project_name
                    projectuser = Projectuser(project_name=project_name, user_id=new_member_user_id, is_admin=False, is_member=True, project_id=project_id)
                    db.session.add(projectuser)
                    db.session.commit()
                    return make_response(jsonify({"new_member_user_id": new_member_user_id}), 200)
                except:
                    print('username does not exist')
                    return redirect(url_for('users.project', project_id=project_id))
            elif remove_member_id !=0:
                Projectuser.query.filter(Projectuser.user_id==remove_member_id, Projectuser.project_id==project_id).delete()
                db.session.commit()
            else:
                doc = Doc.query.filter(Doc.id == update_doc_id, Doc.user_id == current_user.id).first()
                doc.project_id = update_doc_project_id
                flag_modified(doc, 'project_id')
                logging.info(f"doc {doc.id} committed: project{doc.project_id}")
                logging.info(db.session.commit())
                db.session.commit()
        except:
            print("updating project in database is failed")

    project_admin_row = Projectuser.query.filter(Projectuser.project_id == project_id, Projectuser.is_admin == True).first()
    project_admin = User.query.filter(User.id==project_admin_row.user_id).first()
    project_members_rows = Projectuser.query.filter(Projectuser.project_id == project_id, Projectuser.is_member == True).all()
    project_members = []
    for row in project_members_rows:
        project_members.append(User.query.filter(User.id==row.user_id).first())

    project_permission = EditProjectPermission(project_id)
    project_name = Project.query.filter(Project.id==project_id).first().project_name

    projectDocs = Doc.query.filter(Doc.user_id == project_admin_row.user_id, Doc.project_id == project_id).all()
    otherDocs = Doc.query.filter(Doc.user_id == project_admin_row.user_id, Doc.project_id == 0).all()

    if admin_permission.can() and project_permission.can():
        return render_template('admin_project.html', title='admin_project', project_name=project_name, project_id=project_id,
                               project_admin=project_admin, project_members=project_members,
                               projectDocs=projectDocs, otherDocs=otherDocs)
    else:
        return render_template('member_project.html', title='admin_project', project_name=project_name, project_id=project_id,
                               project_admin=project_admin, project_members=project_members,
                               projectDocs=projectDocs)

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

@users.route('/search/<string:project_id>', methods=['GET', 'POST'])
def search(project_id):
    member_id = request.args.get('member_id', 0)
    search_umr_form = SearchUmrForm()
    umr_results = []

    if search_umr_form.validate_on_submit():
        concept = search_umr_form.concept.data
        word = search_umr_form.word.data
        triple = search_umr_form.triple.data

        h, r, c = "", "", ""

        if triple:
            h, r, c = triple.split()

        docs = Doc.query.filter(Doc.project_id == project_id, Doc.user_id == member_id).all()
        doc_ids = [doc.id for doc in docs]
        for doc_id in doc_ids:
            annots = Annotation.query.filter(Annotation.doc_id == doc_id, Annotation.user_id == member_id).all()
            for annot in annots:
                umr_dict = dict(annot.umr)
                for value in umr_dict.values():
                    if (concept and concept in str(value)) or (word and getLemma(word, upos="VERB")[0] in str(value)):
                        umr_results.append(annot.annot_str)
                    elif triple:
                        if c and (c in str(value) or getLemma(c, upos="VERB")[0] in str(value)):
                            k = list(umr_dict.keys())[list(umr_dict.values()).index(value)]
                            if umr_dict.get(k.replace(".c", '.r'),"") == r and (h=="*" or umr_dict.get(k[:-4] + k[-2:], "")):
                                umr_results.append(annot.annot_str)

    return render_template('search.html', title='search', search_umr_form=search_umr_form, umr_results=umr_results)