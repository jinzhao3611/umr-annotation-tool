from pathlib import Path
from flask import render_template, url_for, flash, redirect, request, Blueprint, Response, current_app, session, jsonify, make_response
from flask_login import login_user, current_user, logout_user, login_required
from umr_annot_tool import db, bcrypt
from umr_annot_tool.users.forms import RegistrationForm, LoginForm, UpdateAccountForm, RequestResetForm, ResetPasswordForm, UpdateProjectForm
from umr_annot_tool.models import User, Post, Doc, Annotation, Sent, Projectuser, Project, Lattice, Lexicon, Partialgraph, DocVersion
from umr_annot_tool.users.utils import save_picture, send_reset_email
from sqlalchemy.orm.attributes import flag_modified
import logging
import json
from umr_annot_tool.main.forms import UploadFormSimpleVersion
from werkzeug.utils import secure_filename
from lemminflect import getLemma
from sqlalchemy import or_
from datetime import datetime


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


        # filepath = Path(__file__).parent.parent.joinpath("static/sample_files/news-text-2-lorelei.txt")
        # with open(filepath, 'r', encoding='utf-8') as f:
        #     content_string = f.read()
        # filename = 'news-text-2-lorelei.txt'
        # file_format = 'plain_text'
        # lang = 'english'
        # info2display = html(content_string, file_format, lang)
        # doc = Doc(lang=lang, filename=filename, content=content_string, user_id=user.id,
        #           file_format=file_format)
        # db.session.add(doc)
        # db.session.commit()
        # flash('Your doc has been created!', 'success')
        # for sent_of_tokens in info2display.sents:
        #     sent = Sent(content=" ".join(sent_of_tokens), doc_id=doc.id)
        #     db.session.add(sent)
        #     db.session.commit()
        # flash('Your sents has been created.', 'success')

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
            if to_delete_project_id != 0:
                Partialgraph.query.filter(Partialgraph.project_id==to_delete_project_id).delete()
                print("Partialgraph removed")
                Lattice.query.filter(Lattice.project_id==to_delete_project_id).delete()
                print("Lattice removed")
                Lexicon.query.filter(Lexicon.project_id == to_delete_project_id).delete()
                print("Lexicon removed")
                # Remove project users
                Projectuser.query.filter(Projectuser.project_id == to_delete_project_id).delete()
                print("Projectuser removed")
                # Remove project
                Project.query.filter(Project.id==to_delete_project_id).delete()
                print("Project removed")
                # Remove associated documents and their contents
                to_delete_doc_ids = Doc.query.filter(Doc.project_id == to_delete_project_id).all()
                for to_delete_doc in to_delete_doc_ids:
                    Annotation.query.filter(Annotation.doc_id == to_delete_doc.id).delete()
                    Sent.query.filter(Sent.doc_id == to_delete_doc.id).delete()
                    Doc.query.filter(Doc.id == to_delete_doc.id).delete()
            db.session.commit()
        except Exception as e:
            flash("deleting doc from database failed", 'info')
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
    # print("belongToProject: ", belongToProject)
    return render_template('account.html', title='Account',
                           image_file=image_file, form=form, historyDocs=historyDocs,
                           projects=projects, belongToProject=belongToProject)

@login_required
@users.route("/project/<int:project_id>", methods=['GET', 'POST'])
def project(project_id):
    """
    Handle the main project page. This includes:
      - Displaying project documents, annotated documents, QC documents, double annotated files, etc.
      - Handling modifications to project name, membership, or document sets
    """

    # 1. Fetch the project object from the database or 404 if not found
    project = Project.query.get_or_404(project_id)
    form = UpdateProjectForm()
    # 2. Confirm the current_user has access to this project
    #    This part will depend on your own permission logic. For example:
    membership = Projectuser.query.filter_by(
        project_id=project_id, user_id=current_user.id
    ).first()
    if not membership:
        # No membership found, user has no permission
        abort(403)  # or redirect somewhere

    # We’ll store any messages to flash to the user
    msg_list = []



    # 3. Process POST requests. Your forms use hidden fields like 'delete_project',
    #    'update_doc_id', 'annotated_doc_id', etc. We read them and decide what to do.
    if request.method == 'POST':
        # For clarity, let's read all hidden inputs that might appear:
        delete_project       = request.form.get('delete_project', '0')
        update_doc_id        = request.form.get('update_doc_id', '0')
        remove_member_id     = request.form.get('remove_member_id', '0')
        new_member_name      = request.form.get('new_member_name', '').strip()
        annotated_doc_id     = request.form.get('annotated_doc_id', '0')
        delete_annot_doc_id  = request.form.get('delete_annot_doc_id', '0')
        add_qc_doc_id        = request.form.get('add_qc_doc_id', '0')
        rm_qc_doc_id         = request.form.get('rm_qc_doc_id', '0')
        rm_qc_user_id        = request.form.get('rm_qc_user_id', '0')
        add_da_doc_id        = request.form.get('add_da_doc_id', '0')
        rm_da_doc_id         = request.form.get('rm_da_doc_id', '0')
        rm_da_user_id        = request.form.get('rm_da_user_id', '0')

        # 3.1. Changing the project name (via WTForms or a direct form field)
        #      If using WTForms, you'll handle validation differently. Example:
        if form.validate_on_submit():
            project_name = form.project_name.data
            if project_name:
                project.project_name = project_name
                Projectuser.query.filter_by(project_id=project_id).update({'project_name': project_name})
                db.session.commit()
                msg_list.append(f"Project name updated to: {project.project_name}")

        # 3.2. Deleting the entire project
        if delete_project == '1':
            if membership.permission == 'admin':  # or however you store permissions
                # Actually delete project from DB
                # This typically means removing documents, membership, etc.
                Annotation.query.filter(Annotation.doc_id.in_(DocVersion.doc_id.in_(Doc.query.filter(Doc.project_id == project_id).all()))).delete()
                DocVersion.query.filter(DocVersion.doc_id.in_(Doc.query.filter(Doc.project_id == project_id).all())).delete()
                Sent.query.filter(Sent.doc_id.in_(Doc.query.filter(Doc.project_id == project_id).all())).delete()
                Projectuser.query.filter(Projectuser.project_id == project_id).delete()
                Partialgraph.query.filter(Partialgraph.project_id == project_id).delete()
                Lattice.query.filter(Lattice.project_id == project_id).delete()
                Lexicon.query.filter(Lexicon.project_id == project_id).delete()
                Doc.query.filter(Doc.project_id == project_id).delete()
                Project.query.filter(Project.id == project_id).delete()
                db.session.commit()
                flash("Project deleted successfully", "info")
                return redirect(url_for('users.dashboard'))  # or anywhere you want
            else:
                msg_list.append("You do not have permission to delete this project.")

        # 3.3. Removing a project member
        if remove_member_id.isdigit() and int(remove_member_id) != 0:
            if membership.permission == 'admin':
                member_to_remove = Projectuser.query.filter_by(
                    project_id=project_id, user_id=int(remove_member_id)
                ).first()
                if member_to_remove:
                    # remove annotations that belong to the docversions that are produced by the member
                    Annotation.query.filter(Annotation.doc_id.in_(DocVersion.query.filter(DocVersion.user_id == int(remove_member_id)).all())).delete()
                    # remove docversions that are produced by the member
                    DocVersion.query.filter(DocVersion.user_id == int(remove_member_id)).delete()
                    # remove the member
                    db.session.delete(member_to_remove)
                    db.session.commit()
                    msg_list.append("Removed member from project.")
            else:
                msg_list.append("You do not have permission to remove members.")

        # 3.4. Adding a new member
        if new_member_name:
            if membership.permission == 'admin':
                # find user by username
                user_to_add = User.query.filter_by(username=new_member_name).first()
                if user_to_add:
                    # check if already in project
                    existing = Projectuser.query.filter_by(
                        project_id=project_id, user_id=user_to_add.id
                    ).first()
                    if not existing:
                        # Add new membership
                        new_membership = Projectuser(
                            project_id=project_id,
                            project_name=project.name,
                            user_id=user_to_add.id,
                            permission='annotate'  # or whatever default
                        )
                        db.session.add(new_membership)
                        db.session.commit()
                        msg_list.append(f"Added {new_member_name} to project.")
                    else:
                        msg_list.append(f"{new_member_name} is already in project.")
                else:
                    msg_list.append("No user found by that name.")
            else:
                msg_list.append("You do not have permission to add members.")

        # 3.5. Updating doc states: add to My Annotations, delete doc, etc.
        #     Example of "add to My Annotations"
        if annotated_doc_id.isdigit() and int(annotated_doc_id) != 0:
            # Your logic to mark that doc as annotated by the current user
            doc_id = int(annotated_doc_id)
            doc_version = DocVersion(
                doc_id=doc_id,
                user_id=current_user.id,
                stage = 'checkout',
            )
            db.session.add(doc_version)
            db.session.commit()
            msg_list.append(f"Document (id={doc_id}) added to My Annotations.")

        # 3.6. Deleting an annotation from My Annotations
        if delete_annot_doc_id.isdigit() and int(delete_annot_doc_id) != 0:
            doc_id = int(delete_annot_doc_id)
            # remove the annotation of the docversion
            Annotation.query.filter(Annotation.doc_version_id == DocVersion.query.filter(DocVersion.doc_id == doc_id, DocVersion.user_id == current_user.id, DocVersion.stage == 'checkout').first().id).delete()
            # remove the docversion
            DocVersion.query.filter(DocVersion.doc_id == doc_id, DocVersion.user_id == current_user.id, DocVersion.stage == 'checkout').delete()
            db.session.commit()
            msg_list.append(f"Deleted annotation for doc id={doc_id}.")

        # 3.7. Add/remove documents from QC
        if add_qc_doc_id.isdigit() and int(add_qc_doc_id) != 0:
            doc_id = int(add_qc_doc_id)
            doc_version = DocVersion(
                doc_id=doc_id,
                user_id=current_user.id,
                stage = 'qc',
            )
            db.session.add(doc_version)
            db.session.commit()
            msg_list.append(f"Document (id={doc_id}) added to Quality Control.")

        if rm_qc_doc_id.isdigit() and int(rm_qc_doc_id) != 0:
            doc_id = int(rm_qc_doc_id)
            Annotation.query.filter(Annotation.doc_version_id == DocVersion.query.filter(DocVersion.doc_id == doc_id, DocVersion.user_id == current_user.id, DocVersion.stage == 'qc').first().id).delete()
            DocVersion.query.filter(DocVersion.doc_id == doc_id, DocVersion.user_id == current_user.id, DocVersion.stage == 'qc').delete()
            db.session.commit()
            msg_list.append(f"Document (id={doc_id}) removed from Quality Control.")

        # 3.8. Add/remove documents from Double Annotated
        if add_da_doc_id.isdigit() and int(add_da_doc_id) != 0:
            doc_id = int(add_da_doc_id)
            doc_version = DocVersion(
                doc_id=doc_id,
                user_id=current_user.id,
                stage = 'double_annot',
            )
            db.session.add(doc_version)
            db.session.commit()
            msg_list.append(f"Document (id={doc_id}) added to Double Annotated Files.")

        if rm_da_doc_id.isdigit() and int(rm_da_doc_id) != 0:
            doc_id = int(rm_da_doc_id)
            user_id = int(rm_da_user_id) if rm_da_user_id.isdigit() else None
            Annotation.query.filter(Annotation.doc_version_id == DocVersion.query.filter(DocVersion.doc_id == doc_id, DocVersion.user_id == current_user.id, DocVersion.stage == 'double_annot').first().id).delete()
            DocVersion.query.filter(DocVersion.doc_id == doc_id, DocVersion.user_id == current_user.id, DocVersion.stage == 'double_annot').delete()
            db.session.commit()
            msg_list.append(
                f"Document (id={doc_id}) removed from Double Annotated for user {user_id}."
            )

        # 3.9. Actually commit changes to the database if any
        db.session.commit()
        # Display messages to the user
        for m in msg_list:
            flash(m, "info")
        # Refresh the page to show changes
        return redirect(url_for('users.project', project_id=project_id))

    # 4. For GET requests, or after processing POST, gather data to display in template

    # Example: Documents in the project
    projectDocs = Doc.query.filter_by(project_id=project_id).all()

    # Example: My Annotations
    annotatedDocs = []  # fetch from your user-specific annotation records

    # Example: QC docs
    qcDocs = []
    qcUploaders = []
    qcUploaderIds = []

    # Example: Double annotated docs
    daDocs = []
    daFilenames = []
    daUploaders = []

    try:
        # for all the entries in doc_version, get the user_id of the lines that have stage == 'checkout' and the doc_id = id in doc table that has project_id == project_id
        checked_out_by = [DocVersion.query.filter(DocVersion.stage == 'checkout', DocVersion.doc_id == doc.id).first().user_id for doc in projectDocs]
    except AttributeError:
        checked_out_by = []

    # Members & their user info
    memberships = Projectuser.query.filter_by(project_id=project_id).all()
    members = memberships  # Each membership row
    member_names = [User.query.get(m.user_id).username for m in memberships]

    # Example: Additional variables for the second content block
    # (Slightly different from the first because your template references
    #  `project_docs` differently than `projectDocs`. You may unify them.)
    project_docs = projectDocs  
    current_year = datetime.today().date().strftime("%Y-%m-%d")  # or datetime.now().year, etc.

    # 5. Determine the user’s permission for the template
    permission = membership.permission  # 'admin', 'edit', 'annotate', 'read', etc.
    zipped_pairs = list(zip(members, member_names))


    # 6. Render the template with the data
    return render_template(
        "project.html",  
        form=form,            
        project_id=project.id,
        project_name=project.project_name,
        permission=permission,
        projectDocs=projectDocs,
        annotatedDocs=annotatedDocs,
        qcDocs=qcDocs,
        qcUploaders=qcUploaders,
        qcUploaderIds=qcUploaderIds,
        daDocs=daDocs,
        daFilenames=daFilenames,
        daUploaders=daUploaders,
        checked_out_by=checked_out_by,
        members=members,
        member_names=member_names,
        zipped_pairs=zipped_pairs,
        project_docs=project_docs,
        current_user=current_user,
        current_year=current_year
    )


@login_required
@users.route("/upload_by_annotator/<int:current_project_id>", methods=['GET', 'POST'])
def upload_document(current_project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    form = UploadFormSimpleVersion()
    sent_annots = []
    doc_annots = []
    doc_id = 0
    if form.validate_on_submit():
        if form.files.data and form.files.data[0].filename:
            for form_file in form.files.data:
                content_string = form_file.read().decode(encoding="utf-8", errors="ignore")
                is_legit, data = parse_file_info(content_string)
                if is_legit:
                    filename = secure_filename(form_file.filename)
                    # user_name = data["user_name"]
                    # user_id = data["user_id"]
                    lang = data["file_language"]
                    file_format = data["file_format"]

                    try:
                        doc_id = int(data["doc_id"])
                    except ValueError:
                        print("The string is not a valid integer.")

                else:
                    flash("Error: Uploaded file is not in the correct format or missing required information.", "error")
                    return redirect(url_for('users.project', project_id=current_project_id))

                if file_format == 'isi_editor':
                    new_content_string, sents, sent_annots, doc_annots = process_exported_file_isi_editor(content_string)
                    file2db_override(doc_id=doc_id,filename=filename, file_format=file_format, content_string=new_content_string, lang=lang,
                            sents=sents, has_annot=True, sent_annots=sent_annots, doc_annots=doc_annots, current_project_id=current_project_id, current_user_id=current_user.id)
                else:
                    new_content_string, sents, sent_annots, doc_annots, aligns = parse_exported_file(
                        content_string)
                    file2db_override(doc_id=doc_id,filename=filename, file_format=file_format, content_string=new_content_string, lang=lang,
                            sents=sents, has_annot=True, sent_annots=sent_annots, doc_annots=doc_annots, aligns=aligns, current_project_id=current_project_id, current_user_id=current_user.id)

            try:  # when uploaded file already come with annotation, convert strings to umr and save to database
                doc_id = request.get_json(force=True)["doc_id"]
                sentUmrDicts = json.loads(request.get_json(force=True)["sentUmrDicts"])
                docUmrDicts = json.loads(request.get_json(force=True)["docUmrDicts"])
                annotations = Annotation.query.filter(Annotation.doc_id == doc_id,
                                                      Annotation.user_id == current_user.id).order_by(
                    Annotation.sent_id).all()
                for i, annot in enumerate(annotations):
                    annot.sent_umr = sentUmrDicts[i]
                    annot.doc_umr = docUmrDicts[i]
                    flag_modified(annot, 'sent_umr')
                    flag_modified(annot, 'doc_umr')
                    db.session.add(annot)
                logging.info(db.session.commit())
            except:
                print("convert strings to umr to database failed")

            return redirect(url_for('users.project', project_id=current_project_id))
        else:
            flash('Please upload a file.', 'danger')

    return render_template('upload_by_annotator.html', title='upload_by_annotator', form=form, sent_annots=json.dumps(sent_annots), doc_annots=json.dumps(doc_annots), doc_id=doc_id)

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

@users.route('/partialgraph/<int:project_id>', methods=['GET', 'POST'])
def partialgraph(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    project_name = Project.query.filter(Project.id == project_id).first().project_name
    partialGraphs = Partialgraph.query.filter(Partialgraph.project_id == project_id).first().partial_umr
    print("partialGraphs: ", type(partialGraphs))
    if request.method == "POST":
        try:
            partialGraphKey = request.get_json(force=True)['partialGraphKey']
            del partialGraphs[partialGraphKey]
            partial_graph_to_change = Partialgraph.query.filter(Partialgraph.project_id == project_id).first()
            partial_graph_to_change.partial_umr = partialGraphs
            flag_modified(partial_graph_to_change, "partial_umr")
            db.session.commit()
        except Exception as e:
            print(e)
            print("delete partial graph error")
    return render_template('partial_graph.html', title='partial graphs', partialGraphs=partialGraphs, project_name=project_name, project_id=project_id)

@users.route('/alllexicon/<int:project_id>', methods=['GET', 'POST'])
def alllexicon(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    project_name = Project.query.filter(Project.id == project_id).first().project_name
    lexi = Lexicon.query.filter(Lexicon.project_id == project_id).first().lexi
    lexi = dict(lexi)
    if request.method == "POST":
        print("request.get_json(force=True): ", request.get_json(force=True))
        deleteLemmaKey = request.get_json(force=True)['deleteLemmaKey']
        changeLemmaKey = request.get_json(force=True)['changeLemmaKey']
        entry = request.get_json(force=True)['entry']
        share2projectName = request.get_json(force=True)['share2projectName']
        deleteLexicon = request.get_json(force=True)['deleteLexicon']
        if deleteLemmaKey:
            try:
                del lexi[deleteLemmaKey]
                lexi_to_change = Lexicon.query.filter(Lexicon.project_id == project_id).first()
                lexi_to_change.lexi = lexi
                flag_modified(lexi_to_change, "lexi")
                db.session.commit()
                return make_response(jsonify({"msg": "delete entry: success", "msg_category": "success"}), 200)
            except Exception as e:
                print(e)
                print("delete lexicon error")
        elif changeLemmaKey:
            try:
                lexi_to_change = Lexicon.query.filter(Lexicon.project_id == project_id).first()
                original_lexi = dict(lexi_to_change.lexi)
                original_lexi[changeLemmaKey] = json.loads(entry)
                lexi_to_change.lexi = original_lexi
                flag_modified(lexi_to_change, "lexi")
                db.session.commit()
                return make_response(jsonify({"msg": "change entry: success", "msg_category": "success"}), 200)
            except Exception as e:
                print(e)
                print("edit lexicon error")

        elif share2projectName:
            try:
                share2projectId = Projectuser.query.filter(Projectuser.project_name == share2projectName, Projectuser.user_id == current_user.id).first().project_id
                lexi2change = Lexicon.query.filter(Lexicon.project_id == share2projectId).first()
                lexi2change.lexi = Lexicon.query.filter(Lexicon.project_id == project_id).first().lexi
                flag_modified(lexi2change, "lexi")
                db.session.commit()
                return make_response(jsonify({"msg": "share lexicon: success", "msg_category": "success"}), 200)
            except Exception as e:
                print(e)
                print("share lexicon with your other project error")
        elif deleteLexicon:
            try:
                lexi_to_change = Lexicon.query.filter(Lexicon.project_id == project_id).first()
                lexi_to_change.lexi = {}
                flag_modified(lexi_to_change, "lexi")
                db.session.commit()
                return make_response(jsonify({"msg": "delete whole lexicon successfully, refresh to see changes", "msg_category": "success"}), 200) #need refresh to see is because, redirect to current page, under post somehow doesn't work, therefore I will have to ask the user to refresh manually
            except Exception as e:
                print(e)
                print("delete lexicon error")

    all_projects = Projectuser.query.filter(Projectuser.user_id == current_user.id, Projectuser.permission=="admin").all()
    all_project_names = [p.project_name for p in all_projects]
    return render_template('alllexicon.html', title='all lexicon', lexi=json.dumps(lexi), project_name=project_name, project_id=project_id, all_projects=json.dumps(all_project_names))

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
            msg = 'Discourse settings are applied successfully.'
            msg_category = 'success'
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(e)
            print("get modal setting error")
    return render_template('discourse.html', project_id=project_id, current_setting=json.dumps(Lattice.query.filter(Lattice.project_id == project_id).first().discourse))

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
            msg = 'Aspect settings are applied successfully.'
            msg_category = 'success'
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(e)
            print("get aspect setting error")
    return render_template('aspect.html', project_id=project_id, current_setting=json.dumps(Lattice.query.filter(Lattice.project_id == project_id).first().aspect))

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
            msg = 'Person settings are applied successfully.'
            msg_category = 'success'
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(e)
            print("get person setting error")
    return render_template('person.html', project_id=project_id, current_setting=json.dumps(Lattice.query.filter(Lattice.project_id == project_id).first().person))

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
            msg = 'Number settings are applied successfully.'
            msg_category = 'success'
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(e)
            print("get number setting error")
    return render_template('number.html', project_id=project_id, current_setting=json.dumps(Lattice.query.filter(Lattice.project_id == project_id).first().number))

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
            msg = 'Modal settings are applied successfully.'
            msg_category = 'success'
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(e)
            print("get modal setting error")
    return render_template('modal.html', project_id=project_id, current_setting=json.dumps(Lattice.query.filter(Lattice.project_id == project_id).first().modal))

@users.route('/modification/<int:project_id>', methods=['GET', 'POST'])
def modification(project_id): #there is no post here like the previous ones, because users are not allowed to toggle off any modification items in the dropdown menu
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    return render_template('modification.html', project_id=project_id)

@users.route('/statistics/<int:project_id>', methods=['GET', 'POST'])
def statistics(project_id):
    project_name = Project.query.filter(Project.id == project_id).first().project_name
    docs = Doc.query.filter(Doc.project_id==project_id).all()
    uploaded_document_count = len(docs)
    uploaded_sentence_count = 0
    uploaded_token_count = 0
    total_annotated_docs = set()
    total_annotated_sentence_count = 0
    total_annotated_concept_count = 0
    for doc in docs:
        sents_of_doc = Sent.query.filter(Sent.doc_id==doc.id).all()
        uploaded_sentence_count += len(sents_of_doc)
        for sent in sents_of_doc:
            uploaded_token_count += len(sent.content.split())
        annotations_of_doc = Annotation.query.filter(Annotation.doc_id==doc.id).all()
        for annot in annotations_of_doc:
            if len(annot.sent_annot) > len('<div id="amr"></div>'):
                total_annotated_sentence_count += 1
                total_annotated_docs.add(doc.id)
                umr = annot.sent_umr
                for k in umr:
                    if k.endswith(".c"):
                        total_annotated_concept_count +=1
    total_annotated_document_count = len(total_annotated_docs)
    project_users = Projectuser.query.filter(Projectuser.project_id==project_id).all()
    annotator_ids = [project_user.user_id for project_user in project_users]
    annotator_names = [User.query.filter(User.id==annotator_id).first().username for annotator_id in annotator_ids]
    checked_out_document_counts = []
    checked_out_sentence_counts = []
    annotated_document_counts = []
    annotated_sentence_counts = []
    annotated_concept_counts = []
    for annotator_id in annotator_ids:
        checked_out_documents_this_annotator = set()
        checked_out_sentence_count_this_annotator = 0
        annotated_documents_this_annotator = set()
        annotated_sentence_count_this_annotator = 0
        annotated_concept_count_this_annotator = 0
        for doc in docs:
            print("annotator_id: ", annotator_id)
            print("doc_id: ", doc.id)
            annots = Annotation.query.filter(Annotation.user_id==annotator_id, Annotation.doc_id==doc.id).all()
            for annot in annots:
                if annot:
                    checked_out_documents_this_annotator.add(annot.doc_id)
                    checked_out_sentence_count_this_annotator += 1
                    if len(annot.sent_annot) > len('<div id="amr"></div>'):
                        annotated_sentence_count_this_annotator += 1
                        annotated_documents_this_annotator.add(annot.doc_id)
                        umr = annot.sent_umr
                        for k in umr:
                            if k.endswith(".c"):
                                annotated_concept_count_this_annotator += 1
        checked_out_document_counts.append(len(checked_out_documents_this_annotator))
        checked_out_sentence_counts.append(checked_out_sentence_count_this_annotator)
        annotated_document_counts.append(len(annotated_documents_this_annotator))
        annotated_sentence_counts.append(annotated_sentence_count_this_annotator)
        annotated_concept_counts.append(annotated_concept_count_this_annotator)


    return render_template('statistics.html', project_id=project_id, project_name=project_name,
                           uploaded_document_count=uploaded_document_count,
                           uploaded_sentence_count=uploaded_sentence_count,
                           uploaded_token_count=uploaded_token_count,
                           total_annotated_document_count=total_annotated_document_count,
                           total_annotated_sentence_count=total_annotated_sentence_count,
                           total_annotated_concept_count=total_annotated_concept_count,
                           annotator_ids=annotator_ids,
                           annotator_names=annotator_names,
                           checked_out_document_counts=checked_out_document_counts,
                           checked_out_sentence_counts=checked_out_sentence_counts,
                           annotated_document_counts=annotated_document_counts,
                           annotated_sentence_counts=annotated_sentence_counts,
                           annotated_concept_counts=annotated_concept_counts,
                           )

@users.route('/statistics_all', methods=['GET', 'POST'])
def statistics_all():
    stats_all = []
    for lang in ["arapahoe","arabic","chinese","english","navajo","sanapana","secoya","kukama","default"]:
    # for lang in ["arapahoe", "sanapana"]:
        docs = Doc.query.filter(Doc.lang==lang).all()
        uploaded_document_count = len(docs)
        uploaded_sentence_count = 0
        uploaded_token_count = 0
        total_annotated_docs = set()
        total_annotated_sentence_count = 0
        total_annotated_concept_count = 0
        for doc in docs:
            sents_of_doc = Sent.query.filter(Sent.doc_id==doc.id).all()
            uploaded_sentence_count += len(sents_of_doc)
            for sent in sents_of_doc:
                uploaded_token_count += len(sent.content.split())
            annotations_of_doc = Annotation.query.filter(Annotation.doc_id==doc.id).all()
            for annot in annotations_of_doc:
                if len(annot.sent_annot) > len('<div id="amr"></div>'):
                    total_annotated_sentence_count += 1
                    total_annotated_docs.add(doc.id)
                    umr = annot.sent_umr
                    for k in umr:
                        if k.endswith(".c"):
                            total_annotated_concept_count +=1
        total_annotated_document_count = len(total_annotated_docs)
        curr_lang_stat= [uploaded_document_count, uploaded_sentence_count, uploaded_token_count, total_annotated_document_count, total_annotated_sentence_count, total_annotated_concept_count]
        stats_all.append(curr_lang_stat)


    return render_template('statistics_all.html',
                           arapahoe_stats=stats_all[0],
                           arabic_stats=stats_all[1],
                           chinese_stats=stats_all[2],
                           english_stats=stats_all[3],
                           navajo_stats=stats_all[4],
                           sanapana_stats=stats_all[5],
                           secoya_stats=stats_all[6],
                           kukama_stats=stats_all[7],
                           default_stats=stats_all[8]
                           )

@users.route('/settings/<int:project_id>', methods=['GET', 'POST'])
def settings(project_id):
    return render_template('settings.html', project_id=project_id)

@users.route("/search", methods=['GET'])
@login_required
def search():
    query = request.args.get('query', '')
    scope = request.args.get('scope', 'all')
    doc_id = request.args.get('doc_id')
    project_id = request.args.get('project_id')
    search_type = request.args.get('search_type', 'both')  # Options: 'sentence', 'annotation', 'both'
    
    if not query:
        return render_template('search.html', 
                             title='Search Annotations',
                             doc_id=doc_id,
                             project_id=project_id)
        
    try:
        # Get dummy user id
        dummy_user_id = User.query.filter_by(username='dummy_user').first().id if User.query.filter_by(username='dummy_user').first() else None
        
        results = []
        
        # Search in sentences if requested
        if search_type in ['sentence', 'both']:
            # Base query for sentences
            sentence_query = Sent.query.filter(Sent.content.ilike(f'%{query}%'))
            
            # Apply scope constraints for sentences
            if scope == 'document' and doc_id:
                sentence_query = sentence_query.filter(Sent.doc_id == doc_id)
            elif scope == 'project' and project_id:
                project_docs = Doc.query.filter_by(project_id=project_id).with_entities(Doc.id).all()
                doc_ids = [doc.id for doc in project_docs]
                sentence_query = sentence_query.filter(Sent.doc_id.in_(doc_ids))
            
            # Process sentence matches
            for sent in sentence_query.all():
                doc = Doc.query.get(sent.doc_id)
                if not doc:
                    continue
                    
                # Get all annotations for this sentence
                annotations = Annotation.query.join(
                    Doc, Doc.id == Annotation.doc_id
                ).filter(
                    Annotation.doc_id == sent.doc_id,
                    Annotation.real_sent_id == sent.id,
                    Annotation.sent_annot != '',
                    Doc.project_id == doc.project_id
                )
                
                if dummy_user_id:
                    annotations = annotations.filter(Annotation.user_id != dummy_user_id)
                    
                for annotation in annotations.all():
                    project = Project.query.get(doc.project_id)
                    if not project:
                        continue
                        
                    user = User.query.get(annotation.user_id)
                    if not user or user.username == 'dummy_user':
                        continue
                    
                    results.append({
                        'project_name': project.project_name,
                        'username': user.username,
                        'sentence': sent.content,
                        'sent_annot': annotation.sent_annot,
                        'doc_annot': annotation.doc_annot,
                        'doc_id': annotation.doc_id,
                        'sent_id': sent.id,
                        'user_id': annotation.user_id,
                        'match_type': 'sentence'
                    })
        
        # Search in annotations if requested
        if search_type in ['annotation', 'both']:
            # Base query for annotations
            annotation_query = Annotation.query.filter(
                or_(
                    Annotation.sent_annot.ilike(f'%{query}%'),
                    Annotation.doc_annot.ilike(f'%{query}%')
                )
            ).filter(Annotation.sent_annot != '')
            
            if dummy_user_id:
                annotation_query = annotation_query.filter(Annotation.user_id != dummy_user_id)
            
            # Apply scope constraints for annotations
            if scope == 'document' and doc_id:
                annotation_query = annotation_query.filter(Annotation.doc_id == doc_id)
            elif scope == 'project' and project_id:
                project_docs = Doc.query.filter_by(project_id=project_id).with_entities(Doc.id).all()
                doc_ids = [doc.id for doc in project_docs]
                annotation_query = annotation_query.filter(Annotation.doc_id.in_(doc_ids))
            
            # Process annotation matches
            for annotation in annotation_query.all():
                # Skip if we already found this annotation through sentence search
                if any(r['doc_id'] == annotation.doc_id and 
                       r['sent_id'] == annotation.real_sent_id and 
                       r['user_id'] == annotation.user_id for r in results):
                    continue
                    
                sent = Sent.query.get(annotation.real_sent_id)
                if not sent:
                    continue
                    
                doc = Doc.query.get(annotation.doc_id)
                if not doc:
                    continue
                    
                project = Project.query.get(doc.project_id)
                if not project:
                    continue
                    
                user = User.query.get(annotation.user_id)
                if not user or user.username == 'dummy_user':
                    continue
                
                results.append({
                    'project_name': project.project_name,
                    'username': user.username,
                    'sentence': sent.content,
                    'sent_annot': annotation.sent_annot,
                    'doc_annot': annotation.doc_annot,
                    'doc_id': annotation.doc_id,
                    'sent_id': sent.id,
                    'user_id': annotation.user_id,
                    'match_type': 'annotation'
                })
        
        return render_template('search.html', 
                             title='Search Results',
                             results=results,
                             query=query,
                             doc_id=doc_id,
                             project_id=project_id,
                             search_type=search_type)
                             
    except Exception as e:
        current_app.logger.error(f"Search error: {str(e)}")
        flash('An error occurred while searching. Please try again.', 'danger')
        return render_template('search.html', 
                             title='Search Annotations',
                             doc_id=doc_id,
                             project_id=project_id)