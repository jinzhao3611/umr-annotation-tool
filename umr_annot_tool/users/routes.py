from pathlib import Path

from flask import render_template, url_for, flash, redirect, request, Blueprint, Response, current_app, session, jsonify, make_response
from flask_login import login_user, current_user, logout_user, login_required
from umr_annot_tool import db, bcrypt
from umr_annot_tool.users.forms import RegistrationForm, LoginForm, UpdateAccountForm, RequestResetForm, ResetPasswordForm, SearchUmrForm, UpdateProjectForm
from umr_annot_tool.models import User, Post, Doc, Annotation, Sent, Projectuser, Project, Docqc, Docda, Lattice
from umr_annot_tool.users.utils import save_picture, send_reset_email
from sqlalchemy.orm.attributes import flag_modified
import logging

from parse_input_xml import html
from flask_principal import Permission, RoleNeed, identity_changed, Identity, AnonymousIdentity

from lemminflect import getLemma


users = Blueprint('users', __name__)

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
            sent = Sent(content=" ".join(sent_of_tokens), doc_id=doc.id)
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
            return redirect(next_page) if next_page else redirect(url_for('users.account'))
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
            to_delete_project_id = int(request.form["delete_project"])
            print("to_delete_project_id: ", to_delete_project_id)
            if to_delete_project_id !=0:
                Lattice.query.filter_by(project_id=to_delete_project_id).delete()
                Docda.query.filter(Docda.project_id==to_delete_project_id).delete()
                Docqc.query.filter(Docqc.project_id==to_delete_project_id).delete()
                qc_id = Project.query.filter(Project.id==to_delete_project_id).first().qc_user_id
                Projectuser.query.filter(Projectuser.project_id == to_delete_project_id).delete()
                Project.query.filter(Project.id==to_delete_project_id).delete()
                to_delete_doc_ids = Doc.query.filter(Doc.project_id == to_delete_project_id).all()
                for to_delete_doc in to_delete_doc_ids:
                    Annotation.query.filter(Annotation.doc_id == to_delete_doc.id).delete()
                    Sent.query.filter(Sent.doc_id == to_delete_doc.id).delete()
                    Doc.query.filter(Doc.id == to_delete_doc.id).delete()
                User.query.filter(User.id == qc_id).delete()
            db.session.commit()
        except Exception as e:
            flash("Project name already exist, change to a unique name", 'info')
            print(e)
            print("deleting doc from database failed")
        return redirect(url_for('users.account'))
    elif request.method == 'GET':
        form.username.data = current_user.username
        form.email.data = current_user.email

    image_file = url_for('static', filename='profile_pics/' + current_user.image_file)
    projects = Projectuser.query.filter(Projectuser.user_id == current_user.id).all()
    historyDocs = Doc.query.filter(Doc.user_id == current_user.id).all()
    belongToProject=[]
    for hds in historyDocs:
        belongToProject.append(Project.query.get_or_404(hds.project_id).project_name)
    print("belongToProject: ", belongToProject)
    return render_template('account.html', title='Account',
                           image_file=image_file, form=form, historyDocs=historyDocs,
                           projects=projects, belongToProject=belongToProject)

@login_required
@users.route("/project/<int:project_id>", methods=['GET', 'POST'])
def project(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    form = UpdateProjectForm()
    project_name = Project.query.filter(Project.id == project_id).first().project_name

    if form.validate_on_submit():
        print("I am here 33")
        p = Project.query.filter(Project.id==project_id).first()
        p.project_name = form.projectname.data
        flag_modified(p, 'project_name')
        pus = Projectuser.query.filter(Projectuser.project_id==project_id).all()
        for pu in pus:
            pu.project_name = form.projectname.data
            flag_modified(pu, 'project_name')
        db.session.commit()
        flash('Project name has been updated!', 'success')
        return redirect(url_for('users.project', project_id=project_id))
    elif request.method == 'POST':
        try:
            new_member_name = request.form["new_member_name"]
            print("new_member_name", new_member_name)
            update_doc_id = int(request.form["update_doc_id"]) #delete from project
            print("update_doc_id:", update_doc_id)
            remove_member_id = int(request.form["remove_member_id"])
            print("remove_member_id", remove_member_id)
            annotated_doc_id = int(request.form["annotated_doc_id"])
            print("annotated_doc_id:", annotated_doc_id)
            delete_annot_doc_id = int(request.form["delete_annot_doc_id"])
            print("delete_annot_doc_id:", delete_annot_doc_id)
            add_qc_doc_id = int(request.form["add_qc_doc_id"])
            print("add_qc_doc_id:", add_qc_doc_id)
            rm_qc_doc_id= int(request.form["rm_qc_doc_id"])
            print("rm_qc_doc_id", rm_qc_doc_id)
            rm_qc_user_id = int(request.form["rm_qc_user_id"])
            print("rm_qc_user_id", rm_qc_user_id)
            add_da_doc_id = int(request.form["add_da_doc_id"])
            print("add_da_doc_id: ", add_da_doc_id)
            rm_da_doc_id = int(request.form["rm_da_doc_id"])
            print("rm_da_doc_id: ", rm_da_doc_id)
            rm_da_user_id = int(request.form["rm_da_user_id"])
            print("rm_da_user_id: ", rm_da_user_id)
            if new_member_name:
                try: #add new member
                    new_member_user_id = User.query.filter(User.username==new_member_name).first().id
                    existing_member_of_this_project = Projectuser.query.filter(Projectuser.user_id==new_member_user_id, Projectuser.project_id==project_id).first()
                    if not existing_member_of_this_project:
                        project_name = Project.query.filter(Project.id==project_id).first().project_name
                        projectuser = Projectuser(project_name=project_name, user_id=new_member_user_id, permission="view", project_id=project_id)
                        db.session.add(projectuser)
                        db.session.commit()
                except Exception as e:
                    flash('username does not exist', 'danger')
                    print(e)
            elif remove_member_id !=0:
                Projectuser.query.filter(Projectuser.user_id==remove_member_id, Projectuser.project_id==project_id).delete()
                db.session.commit()
            elif update_doc_id !=0: #delete this doc: including all annotations, sents, docqcs, and docdas
                print("haha")
                Annotation.query.filter(Annotation.doc_id==update_doc_id).delete()
                Sent.query.filter(Sent.doc_id==update_doc_id).delete()
                Docqc.query.filter(Docqc.doc_id==update_doc_id).delete()
                Docda.query.filter(Docda.doc_id==update_doc_id).delete()
                Doc.query.filter(Doc.id == update_doc_id, Doc.user_id == current_user.id).delete()
                logging.info(db.session.commit())
                db.session.commit()
            elif annotated_doc_id !=0: #add to My Annotations
                print("I am here 33")
                # find dummy user
                dummy_user_id = User.query.filter(User.username=="dummy_user").first().id
                print(dummy_user_id)
                if not Annotation.query.filter(Annotation.doc_id==annotated_doc_id, Annotation.user_id==current_user.id).all():
                    for i in range(len(Sent.query.filter(Sent.doc_id==annotated_doc_id).all())):
                        # find the annotation rows belong to dummy
                        dummy_annotation = Annotation.query.filter(Annotation.doc_id==annotated_doc_id, Annotation.sent_id==i+1, Annotation.user_id==dummy_user_id).first()
                        if dummy_annotation:
                            print('I am here 35')
                            annotation = Annotation(sent_annot=dummy_annotation.sent_annot, doc_annot=dummy_annotation.doc_annot, alignment=dummy_annotation.alignment, author=current_user,
                                                    sent_id=dummy_annotation.sent_id, doc_id=dummy_annotation.doc_id, sent_umr=dummy_annotation.sent_umr, doc_umr=dummy_annotation.doc_umr)
                            db.session.add(annotation)
                        else:
                            print('I am here 36')
                            annotation = Annotation(sent_annot='',
                                                    doc_annot='',
                                                    alignment='', author=current_user,
                                                    sent_id=i+1, doc_id=annotated_doc_id,
                                                    sent_umr={}, doc_umr={})
                            db.session.add(annotation)
                    logging.info(f"User {current_user.id} committed:")
                    logging.info(db.session.commit())
            elif delete_annot_doc_id !=0:
                print("I am here 34")
                Annotation.query.filter(Annotation.user_id==current_user.id, Annotation.doc_id==delete_annot_doc_id).delete()
                logging.info(db.session.commit())
                flash("file is removed from My Annotations", 'info')
            elif add_qc_doc_id !=0: # add to Quality Control
                qc_id = Project.query.filter(Project.id == project_id).first().qc_user_id
                qc = User.query.filter(User.id==qc_id).first()
                # check existing:
                if not (Annotation.query.filter(Annotation.doc_id == add_qc_doc_id, Annotation.user_id == qc_id).all()):
                    print("I am here 70")
                    member_annotations = Annotation.query.filter(Annotation.doc_id == add_qc_doc_id, Annotation.user_id == current_user.id).all()
                    for a in member_annotations:
                        qc_annotation = Annotation(sent_annot=a.sent_annot, doc_annot=a.doc_annot, alignment=a.alignment, author=qc,
                                                   sent_id=a.sent_id, doc_id=a.doc_id, sent_umr=a.sent_umr, doc_umr=a.doc_umr)
                        db.session.add(qc_annotation)
                    docqc = Docqc(doc_id=add_qc_doc_id, project_id=project_id, author=current_user) #document which member uploaded the qc doc of this project
                    db.session.add(docqc)
                    logging.info(db.session.commit())
                else:
                    flash('this file already exist in Quality Control, add to double annotated files instead', 'info')
            elif rm_qc_doc_id != 0 and rm_qc_user_id !=0: # delete from Quality Control
                current_qc_id = Project.query.filter(Project.id==project_id).first().qc_user_id
                Annotation.query.filter(Annotation.user_id==current_qc_id, Annotation.doc_id==rm_qc_doc_id).delete()
                Docqc.query.filter(Docqc.project_id==project_id, Docqc.doc_id==rm_qc_doc_id).delete()
                logging.info(db.session.commit())
                return redirect(url_for('users.project', project_id=project_id))
            elif add_da_doc_id !=0:
                #check existing:
                if not Docda.query.filter(Docda.project_id==project_id, Docda.user_id==current_user.id, Docda.doc_id==add_da_doc_id).all():
                    docda = Docda(project_id=project_id, user_id=current_user.id, doc_id=add_da_doc_id)
                    db.session.add(docda)
                    docqc = Docqc.query.filter(Docqc.project_id==project_id, Docqc.doc_id==add_da_doc_id, Docqc.upload_member_id!=current_user.id).first()
                    print("docqc: ", docqc)
                    if docqc: #if there is a qc version of this doc already
                        if not Docda.query.filter(Docda.project_id == project_id, Docda.user_id == docqc.upload_member_id,
                                                  Docda.doc_id == add_da_doc_id).all(): #if this qc version not already in docda already
                            docda_qc = Docda(project_id=project_id, user_id=docqc.upload_member_id, doc_id=add_da_doc_id)
                            db.session.add(docda_qc)
                    logging.info(db.session.commit())
            elif rm_da_doc_id != 0 and rm_da_user_id != 0:
                print("I am here 66")
                Docda.query.filter(Docda.project_id==project_id, Docda.user_id==rm_da_user_id, Docda.doc_id==rm_da_doc_id).delete()
                logging.info(db.session.commit())
        except Exception as e:
            print(e)
            print("updating project in database is failed")

        try:
            edit_permission = request.get_json(force=True)["edit_permission"]
            print("edit_permission:", edit_permission)
            edit_permission_member_id = int(request.get_json(force=True)["edit_permission_member_id"])
            print("edit_permission_member_id", edit_permission_member_id)
            projectuser = Projectuser.query.filter(Projectuser.user_id == edit_permission_member_id,
                                                   Projectuser.project_id == project_id).first()
            projectuser.permission = edit_permission
            flag_modified(projectuser, 'permission')
            logging.info(f"project {projectuser.id} permission changed to {projectuser.permission}")
            logging.info(db.session.commit())
            db.session.commit()
        except Exception as e:
            print(e)
            print("permission change failed")
        return redirect(url_for('users.project', project_id=project_id))
    elif request.method == 'GET':
        form.projectname.data = project_name


    project_members = Projectuser.query.filter(Projectuser.project_id == project_id).all()
    members = []
    permissions = []
    member_ids = []
    for row in project_members:
        members.append(User.query.filter(User.id==row.user_id).first())
        permissions.append(row.permission)
        member_ids.append(row.user_id)

    current_permission = Projectuser.query.filter(Projectuser.user_id == current_user.id,
                                                  Projectuser.project_id == project_id).first().permission
    daDocs = Docda.query.filter(Docda.project_id == project_id).all()
    daUploaders = []
    daFilenames = []
    for daDoc in daDocs:
        daUploaders.append(User.query.filter(User.id == daDoc.user_id).first().username)
        daFilenames.append(Doc.query.filter(Doc.id == daDoc.doc_id).first().filename)

    projectDocs = Doc.query.filter(Doc.project_id == project_id).all()
    checked_out_by = []
    qcAnnotations = Annotation.query.filter(Annotation.user_id == Project.query.get(int(project_id)).qc_user_id, Annotation.sent_id == 1).all() #when add to my annotation, anntation row of sent1 got added in Annotation table, therefore check if there is annotation for sent1
    qcDocs = []
    qcUploaders = []
    qcUploaderIds = []
    for qca in qcAnnotations:
        qcDocs.append(Doc.query.filter(Doc.id==qca.doc_id).first())
        uploader_id = Docqc.query.filter(Docqc.doc_id==qca.doc_id, Docqc.project_id==project_id).first().upload_member_id
        qcUploaderIds.append(uploader_id)
        qcUploaders.append(User.query.filter(User.id==uploader_id).first().username)
    annotatedDocs = []
    for projectDoc in projectDocs:
        if Annotation.query.filter(Annotation.doc_id == projectDoc.id, Annotation.user_id==current_user.id).all():
            annotatedDocs.append(projectDoc)
        checked_out_docs = Annotation.query.filter(Annotation.doc_id == projectDoc.id).all()
        current_checked_out_by = set()
        if checked_out_docs:
            for d in checked_out_docs:
                user_name = User.query.filter(User.id==d.user_id).first().username
                if not user_name.endswith('_qc') and user_name != 'dummy_user':
                    current_checked_out_by.add(user_name)
        checked_out_by.append(list(current_checked_out_by))
    dummy_user_id = User.query.filter(User.username=='dummy_user').first().id

    return render_template('project.html', title='project', project_name=project_name, project_id=project_id,
                            members=members, permissions=permissions, member_ids=member_ids, checked_out_by=list(checked_out_by),
                           projectDocs=projectDocs, qcDocs=qcDocs, qcUploaders=qcUploaders, qcUploaderIds=qcUploaderIds, annotatedDocs=annotatedDocs,
                           daDocs=daDocs, daUploaders=daUploaders,  daFilenames=daFilenames, permission=current_permission,
                           form=form, dummy_user_id=dummy_user_id)

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
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    member_id = request.args.get('member_id', 0)
    search_umr_form = SearchUmrForm()
    umr_results = []
    sent_results = []

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
                umr_dict = dict(annot.sent_umr)
                for value in umr_dict.values():
                    if (concept and concept in str(value)) or (word and getLemma(word, upos="VERB")[0] in str(value)):
                        # todo: bug: sent didn't got returned
                        sent = Sent.query.filter(Sent.id == annot.sent_id).first()
                        umr_results.append(annot.sent_annot)
                        sent_results.append(sent)
                    elif triple:
                        if c and (c in str(value) or getLemma(c, upos="VERB")[0] in str(value)):
                            k = list(umr_dict.keys())[list(umr_dict.values()).index(value)]
                            if umr_dict.get(k.replace(".c", '.r'),"") == r and (h=="*" or umr_dict.get(k[:-4] + k[-2:], "")):
                                sent = Sent.query.filter(Sent.id == annot.sent_id).first()
                                umr_results.append(annot.sent_annot)
                                sent_results.append(sent)

    return render_template('search.html', title='search', search_umr_form=search_umr_form, umr_results=umr_results, sent_results = sent_results)



# annotation lattices
@users.route('/discourse/<int:project_id>', methods=['GET', 'POST'])
def discourse(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    if request.method == 'POST':
        try:
            discourse_setting = request.get_json(force=True)['lattice_setting']
            lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
            lattice_setting.discourse = discourse_setting
            print("discourse_setting: ", discourse_setting)
            flag_modified(lattice_setting, 'discourse')
            db.session.commit()
            flash('Discourse setting applied successfully', 'success')
        except Exception as e:
            print(e)
            print("get modal setting error")
            flash('get modal setting error', 'danger')
    return render_template('discourse.html', project_id=project_id, current_setting=Lattice.query.filter(Lattice.project_id == project_id).first().discourse)

@users.route('/aspect/<int:project_id>', methods=['GET', 'POST'])
def aspect(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    if request.method == 'POST':
        try:
            aspect_setting = request.get_json(force=True)['lattice_setting']
            lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
            lattice_setting.aspect = aspect_setting
            print("aspect_setting: ", aspect_setting)
            flag_modified(lattice_setting, 'aspect')
            db.session.commit()
            flash('Aspect setting applied successfully', 'success')
        except Exception as e:
            print(e)
            print("get aspect setting error")
            flash('get aspect setting error', 'danger')
    return render_template('aspect.html', project_id=project_id, current_setting=Lattice.query.filter(Lattice.project_id == project_id).first().aspect)

@users.route('/person/<int:project_id>', methods=['GET', 'POST'])
def person(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    if request.method == 'POST':
        try:
            person_setting = request.get_json(force=True)['lattice_setting']
            lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
            lattice_setting.person = person_setting
            print("person_setting: ", person_setting)
            flag_modified(lattice_setting, 'person')
            db.session.commit()
            flash('Person setting applied successfully', 'success')
        except Exception as e:
            print(e)
            print("get person setting error")
            flash('get person setting error', 'danger')
    return render_template('person.html', project_id=project_id, current_setting=Lattice.query.filter(Lattice.project_id == project_id).first().person)

@users.route('/number/<int:project_id>', methods=['GET', 'POST'])
def number(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    if request.method == 'POST':
        try:
            number_setting = request.get_json(force=True)['lattice_setting']
            lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
            lattice_setting.number = number_setting
            print("number_setting: ", number_setting)
            flag_modified(lattice_setting, 'number')
            db.session.commit()
            flash('Number setting applied successfully', 'success')
        except Exception as e:
            print(e)
            print("get number setting error")
            flash('get number setting error', 'danger')
    return render_template('number.html', project_id=project_id, current_setting=Lattice.query.filter(Lattice.project_id == project_id).first().number)

@users.route('/modal/<int:project_id>', methods=['GET', 'POST'])
def modal(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    if request.method == 'POST':
        try:
            modal_setting = request.get_json(force=True)['lattice_setting']
            lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
            lattice_setting.modal = modal_setting
            flag_modified(lattice_setting, 'modal')
            db.session.commit()
            print("modal_setting: ", modal_setting)
            flash('Modal setting applied successfully', 'success')
            return redirect(url_for('users.modal', project_id=project_id))
        except Exception as e:
            print(e)
            print("get modal setting error")
            flash("get modal setting error", 'danger')
    return render_template('modal.html', project_id=project_id, current_setting=Lattice.query.filter(Lattice.project_id == project_id).first().modal)

@users.route('/modification/<int:project_id>', methods=['GET', 'POST'])
def modification(project_id): #there is no post here like the previous ones, because users are not allowed to toggle off any modification items in the dropdown menu
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    return render_template('modification.html', project_id=project_id)