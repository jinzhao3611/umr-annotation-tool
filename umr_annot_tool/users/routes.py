from pathlib import Path
from flask import render_template, url_for, flash, redirect, request, Blueprint, Response, current_app, session, jsonify, make_response, abort
from flask_login import login_user, current_user, logout_user, login_required
from umr_annot_tool import db, bcrypt
from umr_annot_tool.users.forms import RegistrationForm, LoginForm, UpdateAccountForm, RequestResetForm, ResetPasswordForm, UpdateProjectForm
from umr_annot_tool.models import User, Post, Doc, Annotation, Sent, Projectuser, Project, Lattice, Lexicon, Partialgraph, DocVersion
from umr_annot_tool.users.utils import save_picture, send_reset_email
from sqlalchemy.orm.attributes import flag_modified
import logging
import json
from umr_annot_tool.main.forms import UploadFormSimpleVersion, OverrideDocumentForm
from werkzeug.utils import secure_filename
from lemminflect import getLemma
from sqlalchemy import or_, and_
from datetime import datetime, timedelta
import re
import os
from umr_annot_tool.main.umr_parser import parse_umr_file


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
    return redirect(url_for('users.login'))


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
    historyDocs = []
    belongToProject = []
    
    # Get all documents and their versions
    docs = Doc.query.filter(Doc.user_id == current_user.id).all()
    for doc in docs:
        # Get the initial version of the document
        initial_version = DocVersion.query.filter_by(
            doc_id=doc.id,
            stage='initial'
        ).first()
        
        if initial_version:
            historyDocs.append({
                'id': doc.id,
                'filename': doc.filename,
                'doc_version_id': initial_version.id
            })
            belongToProject.append(Project.query.get_or_404(doc.project_id).project_name)
    
    return render_template('account.html', title='Account',
                         image_file=image_file, form=form, historyDocs=historyDocs,
                         projects=projects, belongToProject=belongToProject)

@login_required
@users.route("/project/<int:project_id>", methods=['GET', 'POST'])
def project(project_id):
    """
    Handle the main project page with sections for:
    - Project management (name change, member management)
    - Document listing with initial versions
    - Checked out documents for current user
    - Quality control documents
    """
    # 1. Basic setup and permission check
    project = Project.query.get_or_404(project_id)
    form = UpdateProjectForm()
    
    # Check user's project membership
    membership = Projectuser.query.filter_by(
        project_id=project_id, 
        user_id=current_user.id
    ).first()
    if not membership:
        abort(403)
    
    # Get all documents for this project
    docs = Doc.query.filter(Doc.project_id == project_id).all()
    
    # Get lattice settings
    person_setting = {}
    aspect_setting = {}
    discourse_setting = {}
    modal_setting = {}
    modification_setting = {}
    number_setting = {}
    
    lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
    if lattice_setting:
        if lattice_setting.data and 'person' in lattice_setting.data:
            person_setting = lattice_setting.data['person']
        if lattice_setting.data and 'aspect' in lattice_setting.data:
            aspect_setting = lattice_setting.data['aspect']
        if lattice_setting.data and 'discourse' in lattice_setting.data:
            discourse_setting = lattice_setting.data['discourse']
        if lattice_setting.data and 'modal' in lattice_setting.data:
            modal_setting = lattice_setting.data['modal']
        if lattice_setting.data and 'modification' in lattice_setting.data:
            modification_setting = lattice_setting.data['modification']
        if lattice_setting.data and 'number' in lattice_setting.data:
            number_setting = lattice_setting.data['number']
    
    # 2. Handle POST requests
    if request.method == 'POST':
        msg_list = []
        
        # 2.1 Project name update
        if form.validate_on_submit() and form.project_name.data:
            project.project_name = form.project_name.data
            Projectuser.query.filter_by(project_id=project_id).update({'project_name': form.project_name.data})
            msg_list.append(f"Project name updated to: {form.project_name.data}")
        
        # 2.2 Member management
        new_member_name = request.form.get('new_member_name', '').strip()
        remove_member_id = request.form.get('remove_member_id', '0')
        
        if new_member_name and membership.permission == 'admin':
            user_to_add = User.query.filter_by(username=new_member_name).first()
            if user_to_add:
                existing = Projectuser.query.filter_by(
                    project_id=project_id, 
                    user_id=user_to_add.id
                ).first()
                if not existing:
                    new_membership = Projectuser(
                        project_id=project_id,
                        project_name=project.project_name,
                        user_id=user_to_add.id,
                        permission='annotate'
                    )
                    db.session.add(new_membership)
                    msg_list.append(f"Added {new_member_name} to project.")
                else:
                    msg_list.append(f"{new_member_name} is already in project.")
            else:
                msg_list.append("No user found by that name.")
        
        if remove_member_id.isdigit() and int(remove_member_id) != 0 and membership.permission == 'admin':
            member_to_remove = Projectuser.query.filter_by(
                project_id=project_id, 
                user_id=int(remove_member_id)
            ).first()
            if member_to_remove:
                # Clean up member's data
                Annotation.query.filter(
                    Annotation.doc_id.in_(
                        DocVersion.query.filter(DocVersion.user_id == int(remove_member_id)).all()
                    )
                ).delete()
                DocVersion.query.filter(DocVersion.user_id == int(remove_member_id)).delete()
                db.session.delete(member_to_remove)
                msg_list.append("Removed member from project.")
        
        # 2.3 Document management
        delete_doc = request.form.get('delete_doc', '0')
        annotated_doc_id = request.form.get('annotated_doc_id', '0')
        delete_annot_doc_id = request.form.get('delete_annot_doc_id', '0')
        
        if delete_doc.isdigit() and int(delete_doc) != 0 and membership.permission == 'admin':
            doc_id = int(delete_doc)
            try:
                # First delete all annotations from all doc versions
                doc_versions = DocVersion.query.filter_by(doc_id=doc_id).all()
                for doc_version in doc_versions:
                    # Delete annotations for this version
                    Annotation.query.filter_by(doc_version_id=doc_version.id).delete(synchronize_session='fetch')
                
                # Delete all doc versions
                DocVersion.query.filter_by(doc_id=doc_id).delete(synchronize_session='fetch')
                
                # Delete all sentences
                Sent.query.filter_by(doc_id=doc_id).delete(synchronize_session='fetch')
                
                # Finally delete the document itself
                Doc.query.filter_by(id=doc_id).delete(synchronize_session='fetch')
                
                db.session.commit()
                msg_list.append(f"Document and all related data successfully deleted.")
            except Exception as e:
                db.session.rollback()
                msg_list.append(f"Error deleting document: {str(e)}")
                print(f"Error deleting document: {str(e)}")
        
        if annotated_doc_id.isdigit() and int(annotated_doc_id) != 0:
            doc_id = int(annotated_doc_id)
            try:
                # Check if user already has a checkout version of this document
                existing_checkout = DocVersion.query.filter_by(
                    doc_id=doc_id,
                    user_id=current_user.id,
                    stage='checkout'
                ).first()
                
                if existing_checkout:
                    msg_list.append(f"Document (id={doc_id}) is already checked out by you.")
                else:
                    # Get the initial version to copy annotations from
                    initial_version = DocVersion.query.filter_by(
                        doc_id=doc_id,
                        stage='initial'
                    ).first()
                    
                    if not initial_version:
                        msg_list.append(f"Error: Could not find initial version of document.")
                        raise Exception("No initial version found")
                    
                    # Create new checkout version
                    checkout_version = DocVersion(
                        doc_id=doc_id,
                        user_id=current_user.id,
                        stage='checkout'
                    )
                    db.session.add(checkout_version)
                    db.session.flush()  # Get the new version's ID
                    
                    # Copy annotations from initial version to checkout version
                    initial_annotations = Annotation.query.filter_by(
                        doc_version_id=initial_version.id
                    ).all()
                    
                    for annotation in initial_annotations:
                        new_annotation = Annotation(
                            doc_version_id=checkout_version.id,
                            sent_id=annotation.sent_id,
                            sent_annot=annotation.sent_annot,
                            doc_annot=annotation.doc_annot,
                            actions=annotation.actions,
                            alignment=annotation.alignment,
                        )
                        db.session.add(new_annotation)
                    
                    db.session.commit()
                    msg_list.append(f"Document checked out successfully with copied annotations.")
            except Exception as e:
                db.session.rollback()
                msg_list.append(f"Error checking out document: {str(e)}")
                print(f"Error checking out document: {str(e)}")
        
        if delete_annot_doc_id.isdigit() and int(delete_annot_doc_id) != 0:
            doc_id = int(delete_annot_doc_id)
            checkout_version = DocVersion.query.filter_by(
                doc_id=doc_id,
                user_id=current_user.id,
                stage='checkout'
            ).first()
            if checkout_version:
                Annotation.query.filter(Annotation.doc_version_id == checkout_version.id).delete()
                db.session.delete(checkout_version)
                msg_list.append(f"Deleted annotation for doc id={doc_id}.")
        
        # 2.4 Quality Control management
        add_qc_doc_id = request.form.get('add_qc_doc_id', '0')
        rm_qc_doc_id = request.form.get('rm_qc_doc_id', '0')
        rm_qc_user_id = request.form.get('rm_qc_user_id', '0')
        
        if add_qc_doc_id.isdigit() and int(add_qc_doc_id) != 0:
            doc_id = int(add_qc_doc_id)
            # Get the checkout version
            checkout_version = DocVersion.query.filter_by(
                doc_id=doc_id,
                user_id=current_user.id,
                stage='checkout'
            ).first()
            
            if checkout_version:
                # Check if this document already has a QC version
                existing_qc = DocVersion.query.filter_by(
                    doc_id=doc_id,
                    stage='qc',
                    user_id=current_user.id
                ).first()
                
                if existing_qc:
                    msg_list.append(f"Document (id={doc_id}) has already been submitted for Quality Control.")
                else:
                    # Create new QC version
                    qc_version = DocVersion(
                        doc_id=doc_id,
                        user_id=current_user.id,
                        stage='qc'
                    )
                    db.session.add(qc_version)
                    db.session.flush()  # Get the new version's ID
                    
                    # Copy annotations from checkout version to QC version
                    checkout_annotations = Annotation.query.filter_by(
                        doc_version_id=checkout_version.id
                    ).all()
                    
                    for annotation in checkout_annotations:
                        new_annotation = Annotation(
                            doc_version_id=qc_version.id,
                            sent_id=annotation.sent_id,
                            sent_annot=annotation.sent_annot,
                            doc_annot=annotation.doc_annot,
                            alignment=annotation.alignment,
                            actions=annotation.actions,
                        )
                        db.session.add(new_annotation)
                    
                    msg_list.append(f"Document (id={doc_id}) submitted for Quality Control.")
            else:
                msg_list.append(f"Document (id={doc_id}) not found in your checked out documents.")

        if rm_qc_doc_id.isdigit() and int(rm_qc_doc_id) != 0 and rm_qc_user_id.isdigit() and int(rm_qc_user_id) != 0:
            doc_id = int(rm_qc_doc_id)
            user_id = int(rm_qc_user_id)
            qc_version = DocVersion.query.filter_by(
                doc_id=doc_id,
                user_id=user_id,
                stage='qc'
            ).first()
            if qc_version:
                Annotation.query.filter(Annotation.doc_version_id == qc_version.id).delete()
                db.session.delete(qc_version)
                msg_list.append(f"Document (id={doc_id}) removed from Quality Control.")
        
        # Commit changes and show messages
        db.session.commit()
        for msg in msg_list:
            flash(msg, "info")
        return redirect(url_for('users.project', project_id=project_id))
    
    # 3. Prepare data for template
    # 3.1 Project documents
    project_docs = []
    docversion_users = []
    checked_out_by = []
    for doc in docs:
        initial_version = DocVersion.query.filter_by(
            doc_id=doc.id,
            stage='initial'
        ).first()
        
        # Find if anyone has checked out this document
        checkout_versions = DocVersion.query.filter_by(
            doc_id=doc.id,
            stage='checkout'
        ).all()
        
        if initial_version:
            project_docs.append({
                'id': doc.id,
                'filename': doc.filename,
                'doc_version_id': initial_version.id
            })
            # Store all users who have checked out this document
            if checkout_versions:
                users = [User.query.get(version.user_id).username for version in checkout_versions]
                checked_out_by.append(users)
            else:
                checked_out_by.append(None)
    
    # 3.2 Checked out documents
    checked_out_docs = []
    for doc in docs:
        checked_out_version = DocVersion.query.filter_by(
            doc_id=doc.id,
            stage='checkout',
            user_id=current_user.id
        ).first()
        if checked_out_version:
            checked_out_docs.append({
                'id': doc.id,
                'filename': doc.filename,
                'user_id': current_user.id,
                'initial_user_id': initial_version.user_id if initial_version else None,
                'doc_version_id': checked_out_version.id
            })
    
    # 3.3 Quality control documents
    qc_docs = []
    for doc in docs:
        # Change from first() to all() to get all QC versions for this document
        qc_versions = DocVersion.query.filter_by(
            doc_id=doc.id,
            stage='qc'
        ).all()
        for qc_version in qc_versions:
            qc_docs.append({
                'id': doc.id,
                'filename': doc.filename,
                'user_id': qc_version.user_id,
                'username': User.query.get(qc_version.user_id).username,
                'doc_version_id': qc_version.id
            })
    
    # 3.4 Project members
    memberships = Projectuser.query.filter_by(project_id=project_id).all()
    member_names = [User.query.get(m.user_id).username for m in memberships]
    zipped_pairs = list(zip(memberships, member_names))
    
    # 4. Render template
    return render_template(
        "project.html",
        form=form,
        project_id=project.id,
        project_name=project.project_name,
        permission=membership.permission,
        projectDocs=project_docs,
        docversion_users=docversion_users,
        checked_out_by=checked_out_by,
        checked_out_docs=checked_out_docs,
        qc_docs=qc_docs,
        members=memberships,
        member_names=member_names,
        zipped_pairs=zipped_pairs,
        current_user=current_user,
        current_year=datetime.today().date().strftime("%Y-%m-%d"),
        person_setting=json.dumps(person_setting),
        aspect_setting=json.dumps(aspect_setting),
        discourse_setting=json.dumps(discourse_setting),
        modal_setting=json.dumps(modal_setting),
        modification_setting=json.dumps(modification_setting),
        number_setting=json.dumps(number_setting)
    )


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
    print("=============================================")
    print(f"ROUTE DEBUG: Discourse route accessed with project_id={project_id}")
    print(f"Request method: {request.method}")
    print(f"User: {current_user.username if current_user.is_authenticated else 'Not authenticated'}")
    print("=============================================")
    
    if not current_user.is_authenticated:
        print("ROUTE DEBUG: User not authenticated, redirecting to login")
        return redirect(url_for('users.login'))
    if request.method == 'POST':
        try:
            print("ROUTE DEBUG: Processing POST request")
            discourse_setting = request.get_json(force=True)['lattice_setting']
            lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
            if not lattice_setting:
                print("ROUTE DEBUG: Lattice settings not found")
                return make_response(jsonify({"msg": "Lattice settings not found", "msg_category": "error"}), 404)
            lattice_setting.data['discourse'] = discourse_setting
            flag_modified(lattice_setting, 'data')
            db.session.commit()
            
            msg = 'Discourse settings are applied successfully.'
            msg_category = 'success'
            print("ROUTE DEBUG: Settings saved successfully")
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(f"ROUTE DEBUG: Error in POST request: {str(e)}")
            print(e)
            print("get discourse setting error")
            return make_response(jsonify({"msg": "Error saving settings", "msg_category": "error"}), 500)
    
    # For GET request, get the current settings from database
    print("ROUTE DEBUG: Processing GET request")
    lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
    current_setting = lattice_setting.data.get('discourse', {}) if lattice_setting else {}
    print(f"ROUTE DEBUG: Rendering template with current_setting={current_setting}")
    
    from datetime import datetime
    now = datetime.now()
    print(f"ROUTE DEBUG: Current time: {now}")
    
    response = render_template('discourse.html', project_id=project_id, current_setting=json.dumps(current_setting), now=now)
    print("ROUTE DEBUG: Template rendered, sending response")
    return response

@users.route('/aspect/<int:project_id>', methods=['GET', 'POST'])
def aspect(project_id):
    print("=============================================")
    print(f"ROUTE DEBUG: Aspect route accessed with project_id={project_id}")
    print(f"Request method: {request.method}")
    print(f"User: {current_user.username if current_user.is_authenticated else 'Not authenticated'}")
    print("=============================================")
    
    if not current_user.is_authenticated:
        print("ROUTE DEBUG: User not authenticated, redirecting to login")
        return redirect(url_for('users.login'))
    if request.method == 'POST':
        try:
            print("ROUTE DEBUG: Processing POST request")
            aspect_setting = request.get_json(force=True)['lattice_setting']
            lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
            if not lattice_setting:
                print("ROUTE DEBUG: Lattice settings not found")
                return make_response(jsonify({"msg": "Lattice settings not found", "msg_category": "error"}), 404)
            lattice_setting.data['aspect'] = aspect_setting
            flag_modified(lattice_setting, 'data')
            db.session.commit()
            msg = 'Aspect settings are applied successfully.'
            msg_category = 'success'
            print("ROUTE DEBUG: Settings saved successfully")
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(f"ROUTE DEBUG: Error in POST request: {str(e)}")
            print(e)
            print("get aspect setting error")
            return make_response(jsonify({"msg": "Error saving settings", "msg_category": "error"}), 500)
    
    # For GET request, get the current settings from database
    print("ROUTE DEBUG: Processing GET request")
    lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
    current_setting = lattice_setting.data.get('aspect', {}) if lattice_setting else {}
    print(f"ROUTE DEBUG: Rendering template with current_setting={current_setting}")
    
    from datetime import datetime
    now = datetime.now()
    print(f"ROUTE DEBUG: Current time: {now}")
    
    response = render_template('aspect.html', project_id=project_id, current_setting=json.dumps(current_setting), now=now)
    print("ROUTE DEBUG: Template rendered, sending response")
    return response

@users.route('/person/<int:project_id>', methods=['GET', 'POST'])
def person(project_id):
    print("=============================================")
    print(f"ROUTE DEBUG: Person route accessed with project_id={project_id}")
    print(f"Request method: {request.method}")
    print(f"User: {current_user.username if current_user.is_authenticated else 'Not authenticated'}")
    print("=============================================")
    
    if not current_user.is_authenticated:
        print("ROUTE DEBUG: User not authenticated, redirecting to login")
        return redirect(url_for('users.login'))
    if request.method == 'POST':
        try:
            print("ROUTE DEBUG: Processing POST request")
            person_setting = request.get_json(force=True)['lattice_setting']
            lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
            if not lattice_setting:
                print("ROUTE DEBUG: Lattice settings not found")
                return make_response(jsonify({"msg": "Lattice settings not found", "msg_category": "error"}), 404)
            lattice_setting.data['person'] = person_setting
            flag_modified(lattice_setting, 'data')
            db.session.commit()
            msg = 'Person settings are applied successfully.'
            msg_category = 'success'
            print("ROUTE DEBUG: Settings saved successfully")
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(f"ROUTE DEBUG: Error in POST request: {str(e)}")
            print(e)
            print("get person setting error")
            return make_response(jsonify({"msg": "Error saving settings", "msg_category": "error"}), 500)
    
    # For GET request, get the current settings from database
    print("ROUTE DEBUG: Processing GET request")
    lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
    current_setting = lattice_setting.data.get('person', {}) if lattice_setting else {}
    print(f"ROUTE DEBUG: Rendering template with current_setting={current_setting}")
    
    from datetime import datetime
    now = datetime.now()
    print(f"ROUTE DEBUG: Current time: {now}")
    
    response = render_template('person.html', project_id=project_id, current_setting=json.dumps(current_setting), now=now)
    print("ROUTE DEBUG: Template rendered, sending response")
    return response

@users.route('/number/<int:project_id>', methods=['GET', 'POST'])
def number(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    
    if request.method == 'POST':
        try:
            print("ROUTE DEBUG: Processing POST request for number")
            number_setting = request.get_json(force=True)['lattice_setting']
            lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
            
            if not lattice_setting:
                print("ROUTE DEBUG: Lattice settings not found")
                return make_response(jsonify({"msg": "Lattice settings not found", "msg_category": "error"}), 404)
            
            lattice_setting.data['number'] = number_setting
            flag_modified(lattice_setting, 'data')
            db.session.commit()
            msg = 'Number settings are applied successfully.'
            msg_category = 'success'
            print("ROUTE DEBUG: Number settings saved successfully")
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(f"ROUTE DEBUG: Error in POST request: {str(e)}")
            print(e)
            print("get number setting error")
            return make_response(jsonify({"msg": str(e), "msg_category": "error"}), 500)
            
    # For GET request, get the current settings from database
    print("ROUTE DEBUG: Processing GET request")
    lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
    current_setting = lattice_setting.data.get('number', {}) if lattice_setting else {}
    print(f"ROUTE DEBUG: Rendering template with current_setting={current_setting}")
    
    return render_template('number.html', project_id=project_id, current_setting=json.dumps(current_setting))

@users.route('/modal/<int:project_id>', methods=['GET', 'POST'])
def modal(project_id):
    print("=============================================")
    print(f"ROUTE DEBUG: Modal route accessed with project_id={project_id}")
    print(f"Request method: {request.method}")
    print(f"User: {current_user.username if current_user.is_authenticated else 'Not authenticated'}")
    print("=============================================")
    
    if not current_user.is_authenticated:
        print("ROUTE DEBUG: User not authenticated, redirecting to login")
        return redirect(url_for('users.login'))
    if request.method == 'POST':
        try:
            print("ROUTE DEBUG: Processing POST request")
            modal_setting = request.get_json(force=True)['lattice_setting']
            lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
            if not lattice_setting:
                print("ROUTE DEBUG: Lattice settings not found")
                return make_response(jsonify({"msg": "Lattice settings not found", "msg_category": "error"}), 404)
            lattice_setting.data['modal'] = modal_setting
            flag_modified(lattice_setting, 'data')
            db.session.commit()
            msg = 'Modal settings are applied successfully.'
            msg_category = 'success'
            print("ROUTE DEBUG: Settings saved successfully")
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(f"ROUTE DEBUG: Error in POST request: {str(e)}")
            print(e)
            print("get modal setting error")
            return make_response(jsonify({"msg": "Error saving settings", "msg_category": "error"}), 500)
    
    # For GET request, get the current settings from database
    print("ROUTE DEBUG: Processing GET request")
    lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
    current_setting = lattice_setting.data.get('modal', {}) if lattice_setting else {}
    print(f"ROUTE DEBUG: Rendering template with current_setting={current_setting}")
    
    from datetime import datetime
    now = datetime.now()
    print(f"ROUTE DEBUG: Current time: {now}")
    
    response = render_template('modal.html', project_id=project_id, current_setting=json.dumps(current_setting), now=now)
    print("ROUTE DEBUG: Template rendered, sending response")
    return response

@users.route('/modification/<int:project_id>', methods=['GET', 'POST'])
def modification(project_id): #there is no post here like the previous ones, because users are not allowed to toggle off any modification items in the dropdown menu
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    
    if request.method == 'POST':
        try:
            print("ROUTE DEBUG: Processing POST request for modification")
            modification_setting = request.get_json(force=True)['lattice_setting']
            lattice_setting = Lattice.query.filter(Lattice.project_id == project_id).first()
            
            if not lattice_setting:
                print("ROUTE DEBUG: Lattice settings not found")
                return make_response(jsonify({"msg": "Lattice settings not found", "msg_category": "error"}), 404)
            
            lattice_setting.data['modification'] = modification_setting
            flag_modified(lattice_setting, 'data')
            db.session.commit()
            msg = 'Modification settings are applied successfully.'
            msg_category = 'success'
            print("ROUTE DEBUG: Modification settings saved successfully")
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(f"ROUTE DEBUG: Error in POST request: {str(e)}")
            print(e)
            print("get modification setting error")
            return make_response(jsonify({"msg": str(e), "msg_category": "error"}), 500)
            
    return render_template('modification.html', project_id=project_id)




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
    stage_filter = request.args.get('stage_filter', 'all')  # Options: 'all', 'initial', 'checkout', 'qc'
    
    if not query:
        return render_template('search.html', 
                             title='Search Annotations',
                             doc_id=doc_id,
                             project_id=project_id,
                             stage_filter=stage_filter)
        
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
                    DocVersion, DocVersion.id == Annotation.doc_version_id
                ).filter(
                    DocVersion.doc_id == sent.doc_id,
                    Annotation.sent_id == sent.id,
                    Annotation.sent_annot != ''
                )
                
                # Apply stage filter if specified
                if stage_filter != 'all':
                    annotations = annotations.filter(DocVersion.stage == stage_filter)
                
                if dummy_user_id:
                    annotations = annotations.filter(DocVersion.user_id != dummy_user_id)
                    
                for annotation in annotations.all():
                    doc_version = DocVersion.query.get(annotation.doc_version_id)
                    if not doc_version:
                        continue
                        
                    project = Project.query.get(doc.project_id)
                    if not project:
                        continue
                        
                    user = User.query.get(doc_version.user_id)
                    if not user or (user.username == 'dummy_user'):
                        continue
                    
                    results.append({
                        'project_name': project.project_name,
                        'username': user.username,
                        'sentence': sent.content,
                        'sent_annot': annotation.sent_annot,
                        'doc_annot': annotation.doc_annot,
                        'doc_id': doc_version.doc_id,
                        'doc_version_id': annotation.doc_version_id,
                        'doc_version_stage': doc_version.stage,
                        'sent_id': sent.id,
                        'user_id': doc_version.user_id,
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
            
            # Join with DocVersion to get doc_id
            annotation_query = annotation_query.join(
                DocVersion, DocVersion.id == Annotation.doc_version_id
            )
            
            # Apply stage filter if specified
            if stage_filter != 'all':
                annotation_query = annotation_query.filter(DocVersion.stage == stage_filter)
            
            if dummy_user_id:
                annotation_query = annotation_query.filter(DocVersion.user_id != dummy_user_id)
            
            # Apply scope constraints for annotations
            if scope == 'document' and doc_id:
                annotation_query = annotation_query.filter(DocVersion.doc_id == doc_id)
            elif scope == 'project' and project_id:
                project_docs = Doc.query.filter_by(project_id=project_id).with_entities(Doc.id).all()
                doc_ids = [doc.id for doc in project_docs]
                annotation_query = annotation_query.filter(DocVersion.doc_id.in_(doc_ids))
            
            # Process annotation matches
            for annotation in annotation_query.all():
                doc_version = DocVersion.query.get(annotation.doc_version_id)
                if not doc_version:
                    continue
                
                # Skip if we already found this annotation through sentence search
                if any(r['doc_version_id'] == annotation.doc_version_id and 
                       r['sent_id'] == annotation.sent_id for r in results):
                    continue
                    
                sent = Sent.query.get(annotation.sent_id)
                if not sent:
                    continue
                    
                doc = Doc.query.get(doc_version.doc_id)
                if not doc:
                    continue
                    
                project = Project.query.get(doc.project_id)
                if not project:
                    continue
                    
                user = User.query.get(doc_version.user_id)
                if not user or user.username == 'dummy_user':
                    continue
                
                results.append({
                    'project_name': project.project_name,
                    'username': user.username,
                    'sentence': sent.content,
                    'sent_annot': annotation.sent_annot,
                    'doc_annot': annotation.doc_annot,
                    'doc_id': doc_version.doc_id,
                    'doc_version_id': annotation.doc_version_id,
                    'doc_version_stage': doc_version.stage,
                    'sent_id': sent.id,
                    'user_id': doc_version.user_id,
                    'match_type': 'annotation'
                })
        
        return render_template('search.html', 
                             title='Search Results',
                             results=results,
                             query=query,
                             doc_id=doc_id,
                             project_id=project_id,
                             search_type=search_type,
                             stage_filter=stage_filter)
                             
    except Exception as e:
        current_app.logger.error(f"Search error: {str(e)}")
        flash('An error occurred while searching. Please try again.', 'danger')
        return render_template('search.html', 
                             title='Search Annotations',
                             doc_id=doc_id,
                             project_id=project_id,
                             stage_filter='all')

@users.route('/statistics/<int:project_id>', methods=['GET'])
@login_required
def statistics(project_id):
    """Display statistics for a project."""
    # Verify the project exists and user has access
    project = Project.query.get_or_404(project_id)
    
    # Get project users
    project_users = Projectuser.query.filter_by(project_id=project_id).all()
    user_ids = [pu.user_id for pu in project_users]
    users = User.query.filter(User.id.in_(user_ids)).all()
    
    # Get all docs for this project
    docs = Doc.query.filter_by(project_id=project_id).all()
    doc_ids = [doc.id for doc in docs]
    
    # Count initial documents (docs with no versions or only initial versions)
    initial_docs_count = 0
    for doc in docs:
        versions = DocVersion.query.filter_by(doc_id=doc.id).all()
        if not versions or all(v.stage == 'initial' for v in versions):
            initial_docs_count += 1
    
    # Get all sentences
    sents = Sent.query.filter(Sent.doc_id.in_(doc_ids)).all()
    total_sentences = len(sents)
    
    # Get doc versions
    doc_versions = DocVersion.query.filter(DocVersion.doc_id.in_(doc_ids)).all()
    
    # Organize document versions by stage
    initial_versions = [dv for dv in doc_versions if dv.stage == 'initial']
    checkout_versions = [dv for dv in doc_versions if dv.stage == 'checkout']
    qc_versions = [dv for dv in doc_versions if dv.stage == 'qc']
    
    # Get unique documents that are checked out
    checked_out_docs = set(dv.doc_id for dv in checkout_versions)
    not_checked_out_docs = set(doc.id for doc in docs) - checked_out_docs
    
    # Get unique QC files
    qc_docs = set(dv.doc_id for dv in qc_versions)
    
    # Count annotations
    doc_version_ids = [dv.id for dv in doc_versions]
    annotations = Annotation.query.filter(Annotation.doc_version_id.in_(doc_version_ids)).all()
    
    # Count sentence-level and document-level annotations
    sentence_level_annotations = 0
    document_level_annotations = 0
    sentence_variables = 0
    document_relations = 0
    
    import re
    
    for annotation in annotations:
        if annotation.sent_annot and annotation.sent_annot.strip():
            sentence_level_annotations += 1
            # Count variables in sentence annotations (variables are typically in format like "p1, p2, x3, etc.")
            variables = re.findall(r'[a-z][0-9]+', annotation.sent_annot)
            sentence_variables += len(variables)
        
        if annotation.doc_annot and annotation.doc_annot.strip():
            document_level_annotations += 1
            # Count relations in document annotations (typically in format like "(rel arg1 arg2)")
            relations = re.findall(r'\([^\)]+\)', annotation.doc_annot)
            document_relations += len(relations)
    
    # Count files by user
    user_stats = {}
    for user in users:
        checkout_count = DocVersion.query.filter_by(user_id=user.id, stage='checkout').count()
        qc_count = DocVersion.query.filter_by(user_id=user.id, stage='qc').count()
        user_stats[user.username] = {
            'checkout_count': checkout_count,
            'qc_count': qc_count
        }
    
    # Create statistics object
    statistics = {
        'project_name': project.project_name,
        'initial_docs_count': initial_docs_count,
        'total_docs': len(docs),
        'total_sentences': total_sentences,
        'total_relations': document_relations,
        'sentence_level_annotations': sentence_level_annotations,
        'document_level_annotations': document_level_annotations,
        'total_variables': sentence_variables,
        'total_relations': document_relations,
        'checked_out_docs': len(checked_out_docs),
        'not_checked_out_docs': len(not_checked_out_docs),
        'qc_docs': len(qc_docs),
        'user_stats': user_stats
    }
    
    # For timestamp in template
    current_datetime = datetime.utcnow()
    
    return render_template('statistics.html', 
                          title='Project Statistics',
                          project_id=project_id,
                          statistics=statistics,
                          now=lambda: current_datetime)

@users.route('/override_document/<int:project_id>/<int:doc_id>', methods=['GET', 'POST'])
@login_required
def override_document(project_id, doc_id):
    """Show form and handle override for a checked-out document with a new file."""
    # Check if user is a member of the project
    membership = Projectuser.query.filter_by(
        project_id=project_id,
        user_id=current_user.id
    ).first()
    
    if not membership or membership.permission not in ['admin', 'edit', 'annotate']:
        flash('You do not have permission to perform this action.', 'danger')
        return redirect(url_for('users.project', project_id=project_id))
    
    # Check if the document exists and is checked out by the current user
    doc = Doc.query.filter_by(id=doc_id).first()
    checkout_version = DocVersion.query.filter_by(
        doc_id=doc_id,
        user_id=current_user.id,
        stage='checkout'
    ).first()
    
    if not doc or not checkout_version:
        flash('Document not found or not checked out by you.', 'danger')
        return redirect(url_for('users.project', project_id=project_id))
    
    # Check if the document belongs to the project
    if doc.project_id != project_id:
        flash('Document does not belong to this project.', 'danger')
        return redirect(url_for('users.project', project_id=project_id))
    
    # Create form
    form = OverrideDocumentForm()
    
    if form.validate_on_submit():
        # Check if a file was uploaded
        if not form.file.data:
            flash('No file selected.', 'danger')
            return redirect(request.url)
        
        file = form.file.data
        
        if file.filename == '':
            flash('No file selected.', 'danger')
            return redirect(request.url)
        
        # Check if the file is allowed
        if not file.filename.lower().endswith('.umr'):
            flash('Only .umr files are allowed.', 'danger')
            return redirect(request.url)
        
        # Check if the filename matches the original document name
        # Extract the base filename without the extension
        uploaded_filename = os.path.splitext(file.filename)[0]
        original_filename = os.path.splitext(doc.filename)[0]
        
        print(f"Uploaded filename: {uploaded_filename}")
        print(f"Original filename: {original_filename}")
        
        if uploaded_filename != original_filename:
            flash(f'Filename mismatch. The uploaded file must have the same name as the original document: "{original_filename}.umr"', 'danger')
            return redirect(request.url)
        
        try:
            # First, get the file content once
            file_content = file.read().decode('utf-8')
            print(f"File content length: {len(file_content)}")
            print(f"First 100 chars: {file_content[:100]}")
            
            # Check if file content is empty
            if not file_content or file_content.strip() == "":
                flash('Uploaded file is empty. Please upload a file with content.', 'danger')
                return redirect(request.url)
            
            # Then, parse the content
            try:
                _, sentences, sent_annots, doc_annot, alignment = parse_umr_file(file_content)
                
                print(f"Parsed data:")
                print(f"Number of sentences: {len(sentences)}")
                print(f"Number of sentence annotations: {len(sent_annots)}")
                print(f"Doc annotation length: {len(doc_annot) if doc_annot else 'None'}")
                print(f"Alignment type: {type(alignment)}")
                print(f"Alignment length: {len(alignment) if alignment else 'None'}")
                
                # Check if parsing returned empty results
                if not sentences or not sent_annots:
                    flash('Failed to parse file: No sentences or annotations found.', 'danger')
                    return redirect(request.url)
                
            except Exception as parse_error:
                print(f"Error parsing file: {str(parse_error)}")
                flash(f'Error parsing file: {str(parse_error)}', 'danger')
                return redirect(request.url)
            
            # Fetch all existing annotations for this document version
            existing_annotations = Annotation.query.filter_by(
                doc_version_id=checkout_version.id
            ).order_by(Annotation.sent_id).all()
            
            print(f"Found {len(existing_annotations)} existing annotations for document version {checkout_version.id}")
            
            # Get all existing sentences to maintain their mapping
            existing_sentences = Sent.query.filter_by(doc_id=doc_id).order_by(Sent.id).all()
            print(f"Found {len(existing_sentences)} existing sentences for document {doc_id}")
            
            # Check if we have enough sentences
            if len(sentences) > len(existing_sentences):
                flash(f'The uploaded file has {len(sentences)} sentences, but the document only has {len(existing_sentences)} sentences. Cannot override.', 'danger')
                return redirect(request.url)
            
            # Update content in existing annotations
            for i, sent_annot in enumerate(sent_annots):
                if i >= len(existing_annotations):
                    # Not enough existing annotations, break
                    print(f"Not enough existing annotations. Stopping at index {i}")
                    break
                
                ann = existing_annotations[i]
                
                # Get alignment for this sentence
                alignment_data = alignment[i] if isinstance(alignment, list) and i < len(alignment) else {}
                
                # Update the annotation
                print(f"Updating annotation {i+1} (sent_id={ann.sent_id}):")
                print(f"  sent_annot old length: {len(ann.sent_annot) if ann.sent_annot else 'Empty'}")
                print(f"  sent_annot new length: {len(sent_annot) if sent_annot else 'Empty'}")
                
                ann.sent_annot = sent_annot
                # Only update doc_annot for the first sentence
                if i == 0:
                    ann.doc_annot = doc_annot
                ann.alignment = alignment_data
                
                # Mark the annotation as modified
                flag_modified(ann, 'sent_annot')
                if i == 0:
                    flag_modified(ann, 'doc_annot')
                flag_modified(ann, 'alignment')
            
            db.session.commit()
            
            # Verify the data was updated correctly
            updated_annotations = Annotation.query.filter(Annotation.doc_version_id == checkout_version.id).all()
            print(f"Updated {len(updated_annotations)} annotations in the database")
            for i, ann in enumerate(updated_annotations, 1):
                print(f"Updated annotation {i}:")
                print(f"  sent_annot length: {len(ann.sent_annot) if ann.sent_annot else 'Empty'}")
                print(f"  doc_annot length: {len(ann.doc_annot) if ann.doc_annot else 'Empty'}")
                print(f"  alignment keys: {list(ann.alignment.keys()) if ann.alignment else 'None'}")
            
            flash(f'Document "{doc.filename}" has been successfully overridden.', 'success')
            return redirect(url_for('users.project', project_id=project_id))
        
        except Exception as e:
            db.session.rollback()
            flash(f'Error overriding document: {str(e)}', 'danger')
            print(f"Error overriding document: {str(e)}")
            return redirect(request.url)
    
    # Render form for GET request or failed validation
    return render_template('override_document.html', 
                          title='Override Document', 
                          form=form, 
                          project_id=project_id,
                          doc_id=doc_id,
                          filename=doc.filename)