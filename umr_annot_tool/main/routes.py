import sqlalchemy.exc
from flask import url_for, redirect, flash, make_response, jsonify, send_file, render_template, request, abort, send_from_directory, current_app
from werkzeug.utils import secure_filename
from typing import List
import json
from one_time_scripts.parse_input_xml import html, parse_exported_file, process_exported_file_isi_editor, lexicon2db, file2db
from umr_annot_tool.resources.utility_modules.parse_lexicon_file import parse_lexicon_xml, FrameDict
from flask_login import current_user, login_required
import os
import logging
from datetime import datetime
from bs4 import BeautifulSoup
from flask import Blueprint
from umr_annot_tool import db, bcrypt
from umr_annot_tool.models import Sent, Doc, Annotation, User, Post, Lexicon, Projectuser, Project, Lattice, Partialgraph
from umr_annot_tool.main.forms import UploadForm, UploadLexiconForm, LexiconItemForm, LookUpLexiconItemForm, \
    InflectedForm, SenseForm, CreateProjectForm, LexiconAddForm
from sqlalchemy.orm.attributes import flag_modified
from umr_annot_tool.resources.utility_modules.suggest_sim_words import generate_candidate_list, find_suggested_words
from .umr_parser import parse_umr_file
import sys

main = Blueprint('main', __name__)
FRAME_FILE_ENGLISH = "umr_annot_tool/resources/frames_english.json"
FRAME_FILE_CHINESE = 'umr_annot_tool/resources/frames_chinese.json'
# FRAME_FILE_ARABIC = 'umr_annot_tool/resources/frames_arabic.json'
FRAME_FILE_ARABIC = 'umr_annot_tool/resources/arabic-propbank1.json'
LEMMA_DICT_ARABIC = 'umr_annot_tool/resources/arabic_lemma_dict.json'
lemma_dict = json.load(open(LEMMA_DICT_ARABIC, "r"))

# from farasa.stemmer import FarasaStemmer
# stemmer = FarasaStemmer(interactive=True)


@main.route("/new_project", methods=['GET', 'POST'])
def new_project():
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    form = CreateProjectForm()
    if form.validate_on_submit():
        try:
            hashed_password = bcrypt.generate_password_hash('qcisauser').decode('utf-8')
            qc_user = User(username=f"{form.projectname.data}_qc", email=f'{form.projectname.data}{datetime.now().strftime("%H%M%S")}{datetime.today().strftime("%d%m%Y")}@qc.com',
                           password=hashed_password) #the reason of using datetime is to make everybody's email different, this will cause an sqlalchemy error even before checking if there is same project name in this user's project
            db.session.add(qc_user)
            db.session.commit()

            project = Project(project_name=form.projectname.data, qc_user_id=qc_user.id)
            db.session.add(project)
            db.session.commit()

            user_project = Projectuser(project_name=form.projectname.data, user_id=current_user.id, permission="admin",
                                       project_id=project.id)
            db.session.add(user_project)
            db.session.commit()

            lattice = Lattice(project_id=project.id,
                              aspect={"Habitual": True, "Imperfective": True, "Process": True, "Atelic Process": True, "Perfective": True, "State": True, "Activity": True, "Endeavor": True, "Performance": True, "Reversible State": True, "Irreversible State": True, "Inherent State": True, "Point State": True, "Undirected Activity": True, "Directed Activity": True, "Semelfactive": True, "Undirected Endeavor": True, "Directed Endeavor": True, "Incremental Accomplishment": True, "Nonincremental Accomplishment": True, "Directed Achievement": True, "Reversible Directed Achievement": True, "Irreversible Directed Achievement": True},
                              person={"person": True, "non-3rd": True, "non-1st": True, "1st": True, "2nd": True, "3rd": True, "incl.": True, "excl.": True},
                              number={"Singular": True, "Non-singular": True, "Paucal": True, "Plural": True, "Dual": True, "Non-dual Paucal": True, "Greater Plural": True, "Trial": True, "Non-trial Paucal": True},
                              modal={"Non-NeutAff": True, "Non-FullAff": True, "Non-NeutNeg": True, "Non-FullNeg": True, "FullAff": True, "PrtAff": True, "NeutAff": True, "FullNeg": True, "PrtNeg": True, "NeutNeg": True, "Strong-PrtAff": True, "Weak-PrtAff": True, "Strong-NeutAff": True, "Weak-NeutAff": True, "Strong-PrtNeg": True, "Weak-PrtNeg": True, "Strong-NeutNeg": True, "Weak-NeutNeg": True},
                              discourse={"or": True, "and+but": True, "inclusive-disj": True, "exclusive-disj": True, "and+unexpected": True, "and+contrast": True, "but": True, "and": True, "consecutive": True, "additive": True, "unexpected-co-occurrence": True, "contrast-01": True, ":subtraction": True})
            db.session.add(lattice)
            pg = Partialgraph(project_id=project.id, partial_umr={})
            db.session.add(pg)
            lexi = Lexicon(project_id=project.id, lexi={})
            db.session.add(lexi)
            db.session.commit()

            flash(f'{form.projectname.data} has been created.', 'success')
        except sqlalchemy.exc.IntegrityError:
            flash(f'Name "{form.projectname.data}" already exists, choose another one')
            return redirect(url_for('main.new_project'))

        return redirect(url_for('users.account'))
    return render_template('new_project.html', form=form, title='create project')


def handle_file_upload(form_file, current_project_id):
    """Reads content from uploaded UMR file and processes it."""
    current_app.logger.info("Starting handle_file_upload function")
    content_string = form_file.read().decode(encoding="utf-8", errors="ignore")
    filename = secure_filename(form_file.filename)
    
    # Extract language from filename (e.g., english_umr-0001.umr -> english)
    lang = filename.split('_')[0] if '_' in filename else 'unknown'
    current_app.logger.info(f"Processing file: {filename} with language: {lang}")
    
    try:
        new_content_string, sents, sent_annots, doc_annots, alignments = parse_umr_file(content_string)
        
        # Convert alignment strings to dictionaries
        aligns = []
        for alignment_str in alignments:
            align_dict = {}
            if alignment_str:
                # Parse lines like "s1p: 0-0" or "s1p: 0-0, 3-4" into a dictionary
                for line in alignment_str.split('\n'):
                    if line.strip():
                        var, spans = line.split(':')
                        # Handle multiple spans separated by commas
                        align_dict[var.strip()] = spans.strip()
            aligns.append(align_dict)
            
        file2db(filename=filename,
                file_format='umr',  # Hardcoded to 'umr' since it's the only format we handle
                content_string=new_content_string,
                lang=lang,
                sents=sents,
                sent_annots=sent_annots,
                doc_annots=doc_annots,
                aligns=aligns,
                current_project_id=current_project_id,
                current_user_id=current_user.id)
    except Exception as e:
        current_app.logger.error(f"Error in handle_file_upload: {str(e)}")
        current_app.logger.exception("Full traceback:")
        flash(f'Error parsing UMR file: {str(e)}', 'danger')
        return False
        
    current_app.logger.info("File upload completed successfully")
    return True


@main.route("/upload_document/<int:current_project_id>", methods=['GET', 'POST'])
@login_required
def upload_document(current_project_id):
    current_app.logger.info(f"Processing upload request for project {current_project_id}")
    form = UploadForm()
    sent_annots = []
    doc_annots = []
    doc_id = 0
    if form.validate_on_submit():
        if form.files.data and form.files.data[0].filename:
            for form_file in form.files.data:
                if not form_file.filename.endswith('.umr'):
                    current_app.logger.warning(f"Skipping non-UMR file: {form_file.filename}")
                    flash('Only .umr files are allowed.', 'danger')
                    continue
                    
                if handle_file_upload(form_file, current_project_id):
                    flash('File uploaded successfully!', 'success')
                else:
                    current_app.logger.error(f"Failed to upload file: {form_file.filename}")
                
            return redirect(url_for('users.project', project_id=current_project_id))
        else:
            flash('Please upload a file.', 'danger')

    return render_template('upload_document.html', title='upload', form=form,
                         sent_annots=json.dumps(sent_annots),
                         doc_annots=json.dumps(doc_annots),
                         doc_id=doc_id)

@main.route("/upload_lexicon/<int:current_project_id>", methods=['GET', 'POST'])
def upload_lexicon(current_project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    lexicon_form = UploadLexiconForm()
    if lexicon_form.validate_on_submit():
        if lexicon_form.file.data:
            content_string = lexicon_form.file.data.read().decode("utf-8")
            file_format = lexicon_form.format.data
            frames_dict = parse_lexicon_xml(content_string, file_format)
            fd = FrameDict.from_dict(frames_dict)
            lexicon2db(project_id=current_project_id, lexicon_dict=fd.flatten)
            return redirect(url_for('users.project', project_id=current_project_id))
        else:
            flash("please upload a lexicon file", "danger")

    return render_template('upload_lexicon.html', title='upload', lexicon_form=lexicon_form, project_id=current_project_id)

@main.route("/sentlevel_typing/<string:doc_sent_id>", methods=['GET', 'POST'])
def sentlevel_typing(doc_sent_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))

    doc_id = int(doc_sent_id.split("_")[0])
    default_sent_id = int(doc_sent_id.split("_")[1])
    owner_user_id = current_user.id if int(doc_sent_id.split("_")[2])==0 else int(doc_sent_id.split("_")[2])
    owner = User.query.get_or_404(owner_user_id)

    if request.method == 'POST':
        try:
            amr_html = request.get_json(force=True)["amr"]
            amr_html = amr_html.replace('<span class="text-success">', '')
            amr_html = amr_html.replace('</span>', '')
            align_info = request.get_json(force=True)["align"]
            snt_id_info = request.get_json(force=True)["snt_id"]
            umr_dict = request.get_json(force=True)["umr"]

            existing = Annotation.query.filter(Annotation.sent_id == snt_id_info, Annotation.doc_id == doc_id,
                                               Annotation.user_id == owner.id).first()
            if existing:
                existing.sent_annot = amr_html
                existing.alignment = align_info
                existing.sent_umr = umr_dict
                flag_modified(existing, 'alignment')
                flag_modified(existing, 'sent_umr')
                current_app.logger.info(f"Updated annotation for user {owner.id}")
                db.session.commit()
            else:
                annotation = Annotation(sent_annot=amr_html, doc_annot='', alignment=align_info, author=owner,
                                        sent_id=snt_id_info,
                                        doc_id=doc_id,
                                        sent_umr=umr_dict, doc_umr={}, actions=[])
                flag_modified(annotation, 'umr')
                current_app.logger.info(f"Created new annotation for user {owner.id}")
                db.session.add(annotation)
                db.session.commit()
            return make_response(jsonify({"msg": "Success: annotation saved", "msg_category": "success"}), 200)
        except Exception as e:
            current_app.logger.error(f"Error saving annotation: {str(e)}")
            return make_response(jsonify({"msg": "Error saving annotation", "msg_category": "danger"}), 500)

        try:
            partial_graphs = request.get_json(force=True)["partial_graphs"]
            pg = Partialgraph.query.filter(Partialgraph.project_id == project_id).first()
            pg.partial_umr = partial_graphs
            flag_modified(pg, 'partial_umr')
            db.session.commit()
            return make_response(jsonify({"msg": "Success: partial graphs saved", "msg_category": "success"}), 200)
        except Exception as e:
            current_app.logger.error(f"Error saving partial graphs: {str(e)}")
            return make_response(jsonify({"msg": "Error saving partial graphs", "msg_category": "danger"}), 500)

    try:
        curr_annotation = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.sent_id == snt_id,
                                                         Annotation.user_id == owner_user_id).first()
        curr_annotation_string = curr_annotation.sent_annot.strip()
        curr_sent_umr = curr_annotation.sent_umr
        curr_alignment = curr_annotation.alignment
        actions_list = curr_annotation.actions if curr_annotation.actions else []
    except Exception as e:
        print(e)
        curr_annotation_string = ""
        curr_sent_umr = {}
        curr_alignment = {}
        actions_list = []

    # load all annotations for current document used for export_annot()
    annotations = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.user_id == owner_user_id).order_by(
        Annotation.sent_id).all()
    filtered_sentences = Sent.query.filter(Sent.doc_id == doc.id).order_by(Sent.id).all()
    annotated_sent_ids = [annot.sent_id for annot in annotations if (annot.sent_umr != {} or annot.sent_annot)] #this is used to color annotated sentences
    all_annots = [annot.sent_annot for annot in annotations]
    all_aligns = [annot.alignment for annot in annotations]
    all_doc_annots = [annot.doc_annot for annot in annotations]
    all_sents = [sent2.content for sent2 in filtered_sentences]

    #this is a bandit solution: At early stages, I only created annotation entry in annotation table when an annotation
    # is created, then I changed to create an annotation entry for every sentence uploaded with or without annotation created,
    # however, when people export files from early stages, annotations were misaligned with the text lines - some lines
    # had no annotations, in which case the annotations for all following lines were moved up one slot.
    # Therefore, here I manually fill in empty strings in place for sentences that has no annotation. But annotations created
    # in later stages don't need this.
    sent_with_annot_ids = [annot.sent_id for annot in annotations]
    all_annots_no_skipping = [""] * len(all_sents)
    all_aligns_no_skipping = [""] * len(all_sents)
    all_doc_annots_no_skipping = [""] * len(all_sents)
    for i, annot in enumerate(annotations):
        try:
            sent_idx = next((idx for idx, s in enumerate(all_sents) if s.id == annot.sent_id), None)
            if sent_idx is not None:
                all_annots_no_skipping[sent_idx] = all_annots[i]
                all_aligns_no_skipping[sent_idx] = all_aligns[i]
                all_doc_annots_no_skipping[sent_idx] = all_doc_annots[i]
        except Exception as e:
            current_app.logger.error(f"Error processing annotation {i}: {str(e)}")
            continue

    exported_items = [list(p) for p in zip(all_sents, all_annots_no_skipping, all_aligns_no_skipping, all_doc_annots_no_skipping)]

    lattice = Lattice.query.filter(Lattice.project_id == project_id).first()
    aspectSettingsJSON = lattice.aspect
    personSettingsJSON = lattice.person
    numberSettingsJSON = lattice.number
    modalSettingsJSON = lattice.modal
    discourseSettingsJSON = lattice.discourse

    pg = Partialgraph.query.filter(Partialgraph.project_id == project_id).first()
    partial_graphs_json = pg.partial_umr
    print("partial_graphs_json:", partial_graphs_json)

    return render_template('sentlevel_typing.html', lang=doc.lang, filename=doc.filename, snt_id=snt_id, doc_id=doc_id,
                           info2display=info2display,
                           frame_dict=json.dumps(frame_dict),
                           curr_sent_umr=curr_sent_umr, curr_annotation_string=curr_annotation_string, curr_alignment=curr_alignment,
                           exported_items=exported_items,
                           file_format=doc.file_format,
                           content_string=doc.content.replace('\\', '\\\\'), #this is for toolbox4 format that has a lot of unescaped backslashes
                           annotated_sent_ids= annotated_sent_ids,
                           project_name=project_name,
                           project_id=project_id,
                           admin=admin, owner=owner,
                           permission=permission,
                           aspectSettingsJSON=aspectSettingsJSON, personSettingsJSON=personSettingsJSON,
                           numberSettingsJSON=numberSettingsJSON, modalSettingsJSON=modalSettingsJSON, discourseSettingsJSON=discourseSettingsJSON,
                           partial_graphs_json=partial_graphs_json)

@main.route("/sentlevel/<string:doc_sent_id>", methods=['GET', 'POST'])
def sentlevel(doc_sent_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))

    doc_id = int(doc_sent_id.split("_")[0])
    default_sent_id = int(doc_sent_id.split("_")[1])
    owner_user_id = current_user.id if int(doc_sent_id.split("_")[2])==0 else int(doc_sent_id.split("_")[2])# html post 0 here, it means it's my own annotation
    owner = User.query.get_or_404(owner_user_id)

    #check who is the admin of the project containing this file:
    project_id = Doc.query.filter(Doc.id == doc_id).first().project_id
    project_name = Project.query.filter(Project.id==project_id).first().project_name
    admin_id = Projectuser.query.filter(Projectuser.project_id == project_id, Projectuser.permission=="admin").first().user_id
    admin = User.query.filter(User.id == admin_id).first()
    permission = Projectuser.query.filter(Projectuser.project_id==project_id, Projectuser.user_id==current_user.id).first().permission

    doc = Doc.query.get_or_404(doc_id)
    info2display = html(doc.content, doc.file_format, lang=doc.lang)
    # find the correct frame_dict for current annotation
    if doc.lang == "chinese":
        frame_dict = json.load(open(FRAME_FILE_CHINESE, "r"))
    elif doc.lang == "english":
        frame_dict = json.load(open(FRAME_FILE_ENGLISH, "r"))
    elif doc.lang == "arabic":
        frame_dict = json.load(open(FRAME_FILE_ARABIC, "r"))
    else:
        try: #this is to find if there is user defined frame_dict: keys are lemmas, values are lemma information including inflected forms of the lemma
            frame_dict = Lexicon.query.filter_by(project_id=project_id).first().lexi
        except AttributeError: #there is no frame_dict for this language at all
            frame_dict = {}

    snt_id = int(request.args.get('snt_id', default_sent_id))
    if "set_sentence" in request.form:
        snt_id = int(request.form["sentence_id"])

    if request.method == 'POST':
        # add umr to db
        logging.info("post request received")
        try:
            amr_html = request.get_json(force=True)["amr"]
            amr_html = amr_html.replace('<span class="text-success">', '')  # get rid of the head highlight tag
            amr_html = amr_html.replace('</span>', '')
            print("amr_html: ", amr_html)
            align_info = request.get_json(force=True)["align"]
            print("align_info: ", align_info)
            snt_id_info = request.get_json(force=True)["snt_id"]
            print("snt_id_info: ", snt_id_info)
            umr_dict = request.get_json(force=True)["umr"]
            print("umr_dict: ", umr_dict)

            existing = Annotation.query.filter(Annotation.sent_id == snt_id_info, Annotation.doc_id == doc_id,
                                               Annotation.user_id == owner.id).first()
            if existing:  # update the existing Annotation object
                existing.sent_annot = amr_html
                existing.alignment = align_info
                existing.sent_umr = umr_dict
                flag_modified(existing, 'alignment')
                flag_modified(existing, 'sent_umr')
                logging.info(f"User {owner.id} committed: {amr_html}")
                logging.info(db.session.commit())
            else:
                annotation = Annotation(sent_annot=amr_html, doc_annot='', alignment=align_info, author=owner,
                                        sent_id=snt_id_info,
                                        doc_id=doc_id,
                                        sent_umr=umr_dict, doc_umr={}, actions=[])
                flag_modified(annotation, 'umr')
                logging.info(f"User {owner.id} committed: {amr_html}")
                db.session.add(annotation)
                logging.info(db.session.commit())
            msg = 'Success: current doc-level annotation is added to database.'
            msg_category = 'success'
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(e)
            print('Failure: Add current annotation and alignments to database failed.')
        # add partial graph to db
        try:
            partial_graphs = request.get_json(force=True)["partial_graphs"]
            print("partial_graphs: ", partial_graphs)
            pg = Partialgraph.query.filter(Partialgraph.project_id == project_id).first()
            pg.partial_umr = partial_graphs
            flag_modified(pg, 'partial_umr')
            db.session.commit()
            msg = 'Success: partial graphs are added to database.'
            msg_category = 'success'
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(e)
            print('Failure: Add partial graphs to database failed.')

    try:
        curr_annotation = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.sent_id == snt_id,
                                                         Annotation.user_id == owner_user_id).first()
        curr_annotation_string = curr_annotation.sent_annot.strip()
        curr_sent_umr = curr_annotation.sent_umr
        curr_alignment = curr_annotation.alignment
        actions_list = curr_annotation.actions if curr_annotation.actions else []
    except Exception as e:
        print(e)
        curr_annotation_string = ""
        curr_sent_umr = {}
        curr_alignment = {}
        actions_list = []

    # load all annotations for current document used for export_annot()
    annotations = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.user_id == owner_user_id).order_by(
        Annotation.sent_id).all()
    filtered_sentences = Sent.query.filter(Sent.doc_id == doc.id).order_by(Sent.id).all()
    annotated_sent_ids = [annot.sent_id for annot in annotations if (annot.sent_umr != {} or annot.sent_annot)] #this is used to color annotated sentences
    all_annots = [annot.sent_annot for annot in annotations]
    all_aligns = [annot.alignment for annot in annotations]
    all_doc_annots = [annot.doc_annot for annot in annotations]
    all_sents = [sent2.content for sent2 in filtered_sentences]

    #this is a bandit solution: At early stages, I only created annotation entry in annotation table when an annotation
    # is created, then I changed to create an annotation entry for every sentence uploaded with or without annotation created,
    # however, when people export files from early stages, annotations were misaligned with the text lines - some lines
    # had no annotations, in which case the annotations for all following lines were moved up one slot.
    # Therefore, here I manually fill in empty strings in place for sentences that has no annotation. But annotations created
    # in later stages don't need this.
    sent_with_annot_ids = [annot.sent_id for annot in annotations]
    all_annots_no_skipping = [""] * len(all_sents)
    all_aligns_no_skipping = [""] * len(all_sents)
    all_doc_annots_no_skipping = [""] * len(all_sents)
    for i, annot in enumerate(annotations):
        try:
            sent_idx = next((idx for idx, s in enumerate(all_sents) if s.id == annot.sent_id), None)
            if sent_idx is not None:
                all_annots_no_skipping[sent_idx] = all_annots[i]
                all_aligns_no_skipping[sent_idx] = all_aligns[i]
                all_doc_annots_no_skipping[sent_idx] = all_doc_annots[i]
        except Exception as e:
            current_app.logger.error(f"Error processing annotation {i}: {str(e)}")
            continue

    exported_items = [list(p) for p in zip(all_sents, all_annots_no_skipping, all_aligns_no_skipping, all_doc_annots_no_skipping)]

    lattice = Lattice.query.filter(Lattice.project_id == project_id).first()
    aspectSettingsJSON = lattice.aspect
    personSettingsJSON = lattice.person
    numberSettingsJSON = lattice.number
    modalSettingsJSON = lattice.modal
    discourseSettingsJSON = lattice.discourse

    pg = Partialgraph.query.filter(Partialgraph.project_id == project_id).first()
    partial_graphs_json = pg.partial_umr
    print("partial_graphs_json:", partial_graphs_json)

    return render_template('sentlevel.html', lang=doc.lang, filename=doc.filename, snt_id=snt_id, doc_id=doc_id,
                           info2display=info2display,
                           frame_dict=json.dumps(frame_dict),
                           curr_sent_umr=curr_sent_umr, curr_annotation_string=curr_annotation_string, curr_alignment=curr_alignment,
                           exported_items=exported_items,
                           file_format=doc.file_format,
                           content_string=doc.content.replace('\\', '\\\\'), #this is for toolbox4 format that has a lot of unescaped backslashes
                           annotated_sent_ids= annotated_sent_ids,
                           project_name=project_name,
                           project_id=project_id,
                           admin=admin, owner=owner,
                           permission=permission,
                           aspectSettingsJSON=aspectSettingsJSON, personSettingsJSON=personSettingsJSON,
                           numberSettingsJSON=numberSettingsJSON, modalSettingsJSON=modalSettingsJSON, discourseSettingsJSON=discourseSettingsJSON,
                           partial_graphs_json=partial_graphs_json,
                           actions_list=actions_list)

@main.route("/sentlevelview/<string:doc_sent_id>", methods=['GET', 'POST'])
def sentlevelview(doc_sent_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    doc_id = int(doc_sent_id.split("_")[0])
    default_sent_id = int(doc_sent_id.split("_")[1])
    owner_user_id = current_user.id if int(doc_sent_id.split("_")[2])==0 else int(doc_sent_id.split("_")[2])# html post 0 here, it means it's my own annotation
    owner = User.query.get_or_404(owner_user_id)

    # check who is the admin of the project containing this file:
    project_id = Doc.query.filter(Doc.id == doc_id).first().project_id
    project_name = Projectuser.query.filter(Projectuser.project_id == project_id,
                                            Projectuser.permission == "admin").first().project_name
    admin_id = Projectuser.query.filter(Projectuser.project_id == project_id,
                                        Projectuser.permission == "admin").first().user_id
    admin = User.query.filter(User.id == admin_id).first()
    if owner.id == current_user.id:
        permission = 'edit'  # this means got into the sentlevel page through My Annotations
    else:
        permission = Projectuser.query.filter(Projectuser.project_id == project_id,
                                              Projectuser.user_id == current_user.id).first().permission

    doc = Doc.query.get_or_404(doc_id)
    info2display = html(doc.content, doc.file_format, lang=doc.lang)
    # find the correct frame_dict for current annotation
    if doc.lang == "chinese":
        frame_dict = json.load(open(FRAME_FILE_CHINESE, "r"))
    elif doc.lang == "english":
        frame_dict = json.load(open(FRAME_FILE_ENGLISH, "r"))
    elif doc.lang == "arabic":
        frame_dict = json.load(open(FRAME_FILE_ARABIC, "r"))
    else:
        try: #this is to find if there is user defined frame_dict: keys are lemmas, values are lemma information including inflected forms of the lemma
            frame_dict = Lexicon.query.filter_by(project_id=project_id).first().lexi
        except AttributeError: #there is no frame_dict for this language at all
            frame_dict = {}

    snt_id = int(request.args.get('snt_id', default_sent_id))
    if "set_sentence" in request.form:
        snt_id = int(request.form["sentence_id"])

    try:
        curr_annotation = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.sent_id == snt_id,
                                                         Annotation.user_id == owner_user_id).first()
        curr_annotation_string = curr_annotation.sent_annot.strip()
        curr_sent_umr = curr_annotation.sent_umr
        curr_alignment = curr_annotation.alignment
        actions_list = curr_annotation.actions if curr_annotation.actions else []
    except Exception as e:
        print(e)
        curr_annotation_string = ""
        curr_sent_umr = {}
        curr_alignment = {}
        actions_list = []

    # load all annotations for current document used for export_annot()
    annotations = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.user_id == owner_user_id).order_by(
        Annotation.sent_id).all()
    filtered_sentences = Sent.query.filter(Sent.doc_id == doc.id).order_by(Sent.id).all()
    annotated_sent_ids = [annot.sent_id for annot in annotations if (annot.sent_umr != {} or annot.sent_annot)] #this is used to color annotated sentences
    all_annots = [annot.sent_annot for annot in annotations]
    all_aligns = [annot.alignment for annot in annotations]
    all_doc_annots = [annot.doc_annot for annot in annotations]
    all_sents = [sent2.content for sent2 in filtered_sentences]

    #this is a bandit solution: At early stages, I only created annotation entry in annotation table when an annotation
    # is created, then I changed to create an annotation entry for every sentence uploaded with or without annotation created,
    # however, when people export files from early stages, annotations were misaligned with the text lines - some lines
    # had no annotations, in which case the annotations for all following lines were moved up one slot.
    # Therefore, here I manually fill in empty strings in place for sentences that has no annotation. But annotations created
    # in later stages don't need this.
    sent_with_annot_ids = [annot.sent_id for annot in annotations]
    all_annots_no_skipping = [""] * len(all_sents)
    all_aligns_no_skipping = [""] * len(all_sents)
    all_doc_annots_no_skipping = [""] * len(all_sents)
    for i, annot in enumerate(annotations):
        try:
            sent_idx = next((idx for idx, s in enumerate(all_sents) if s.id == annot.sent_id), None)
            if sent_idx is not None:
                all_annots_no_skipping[sent_idx] = all_annots[i]
                all_aligns_no_skipping[sent_idx] = all_aligns[i]
                all_doc_annots_no_skipping[sent_idx] = all_doc_annots[i]
        except Exception as e:
            current_app.logger.error(f"Error processing annotation {i}: {str(e)}")
            continue

    exported_items = [list(p) for p in zip(all_sents, all_annots_no_skipping, all_aligns_no_skipping, all_doc_annots_no_skipping)]


    return render_template('sentlevelview.html', lang=doc.lang, filename=doc.filename, snt_id=snt_id, doc_id=doc_id,
                           info2display=info2display,
                           frame_dict=json.dumps(frame_dict),
                           curr_sent_umr=curr_sent_umr, curr_annotation_string=curr_annotation_string, curr_alignment=curr_alignment,
                           exported_items=exported_items,
                           file_format=doc.file_format,
                           content_string=doc.content.replace('\\', '\\\\'), # this is for toolbox4 format that has a lot of unescaped backslashes
                           annotated_sent_ids= annotated_sent_ids,
                           project_name=project_name,
                           project_id=project_id,
                           admin=admin, owner=owner,
                           permission=permission)

@main.route("/doclevel/<string:doc_sent_id>", methods=['GET', 'POST'])
def doclevel(doc_sent_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    doc_id = int(doc_sent_id.split("_")[0])
    default_sent_id = int(doc_sent_id.split("_")[1])
    owner_user_id = current_user.id if int(doc_sent_id.split("_")[2])==0 else int(doc_sent_id.split("_")[2])
    owner = User.query.get_or_404(owner_user_id)

    current_snt_id = default_sent_id
    if "set_sentence" in request.form:
        current_snt_id = int(request.form["sentence_id"])

    if request.method == 'POST':
        try:
            snt_id_info = request.get_json(force=True)["snt_id"]
            umr_dict = request.get_json(force=True)["umr_dict"]
            doc_annot_str = request.get_json(force=True)["doc_annot_str"]
            
            existing = Annotation.query.filter(Annotation.sent_id == snt_id_info, Annotation.doc_id == doc_id,
                                               Annotation.user_id == owner_user_id).first()
            if existing:
                existing.doc_umr = umr_dict
                existing.doc_annot = doc_annot_str
                flag_modified(existing, 'doc_umr')
                flag_modified(existing, 'doc_annot')
                db.session.commit()
                return make_response(jsonify({"msg": "Success: document-level annotation saved", "msg_category": "success"}), 200)
            else:
                current_app.logger.warning("No sentence-level annotation exists for the current sentence")
                return make_response(jsonify({"msg": "No sentence-level annotation exists", "msg_category": "warning"}), 200)
        except Exception as e:
            current_app.logger.error(f"Error saving document-level annotation: {str(e)}")
            return make_response(jsonify({"msg": "Error saving document-level annotation", "msg_category": "danger"}), 500)

    doc = Doc.query.get_or_404(doc_id)
    sents = Sent.query.filter(Sent.doc_id == doc.id).order_by(Sent.id).all()
    annotations = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.user_id == owner.id).order_by(
        Annotation.sent_id).all()

    # Debug logging
    current_app.logger.info(f"Current sentence ID: {current_snt_id}")
    current_app.logger.info(f"All sentence IDs: {[sent.id for sent in sents]}")
    current_app.logger.info(f"All annotation sent_ids: {[annot.sent_id for annot in annotations]}")
    current_app.logger.info(f"All annotation contents: {[bool(annot.sent_annot) for annot in annotations]}")
    current_app.logger.info(f"Number of sentences: {len(sents)}")
    current_app.logger.info(f"Number of annotations: {len(annotations)}")

    # Create pairs based on position rather than ID
    sent_annot_pairs = list(zip(sents, annotations))

    try:
        current_sent_pair = sent_annot_pairs[current_snt_id - 1]
        if not current_sent_pair[1] or not current_sent_pair[1].sent_annot:
            # If there's no sentence-level annotation, redirect to sentence-level page
            current_app.logger.warning(f"No annotation found for sentence at position {current_snt_id}")
            flash('Please create a sentence-level annotation first', 'warning')
            return redirect(url_for('main.sentlevel', doc_sent_id=str(doc_id)+'_'+str(current_snt_id)+'_'+str(owner.id)))
    except IndexError:
        flash('Invalid sentence ID', 'danger')
        return redirect(url_for('main.sentlevel', doc_sent_id=str(doc_id)+'_1_'+str(owner.id)))

    # load all annotations for current document used for export_annot()
    all_annots = [annot.sent_annot for annot in annotations]
    all_aligns = [annot.alignment for annot in annotations]
    all_doc_annots = [annot.doc_annot for annot in annotations]
    all_sents = [sent2.content for sent2 in sents]
    all_sent_umrs = [annot.sent_umr for annot in annotations]

    # Handle empty annotations the same way as sentence level route
    sent_with_annot_ids = [annot.sent_id for annot in annotations]
    all_annots_no_skipping = [""] * len(all_sents)
    all_aligns_no_skipping = [""] * len(all_sents)
    all_doc_annots_no_skipping = [""] * len(all_sents)

    # Fill in the annotations where they exist
    for i, annot in enumerate(annotations):
        try:
            sent_idx = next((idx for idx, s in enumerate(all_sents) if s.id == annot.sent_id), None)
            if sent_idx is not None:
                all_annots_no_skipping[sent_idx] = all_annots[i]
                all_aligns_no_skipping[sent_idx] = all_aligns[i]
                all_doc_annots_no_skipping[sent_idx] = all_doc_annots[i]
        except Exception as e:
            current_app.logger.error(f"Error processing annotation {i}: {str(e)}")
            continue

    # Create exported items with properly aligned annotations
    exported_items = [list(p) for p in zip(all_sents, all_annots_no_skipping, all_aligns_no_skipping, all_doc_annots_no_skipping)]

    #check who is the admin of the project containing this file:
    try:
        project_id = Doc.query.filter(Doc.id == doc_id).first().project_id
        project_name = Projectuser.query.filter(Projectuser.project_id == project_id, Projectuser.permission=="admin").first().project_name
        admin_id = Projectuser.query.filter(Projectuser.project_id == project_id,
                                            Projectuser.permission == "admin").first().user_id
        admin = User.query.filter(User.id == admin_id).first()
        if owner.id == current_user.id:
            permission = 'edit' #this means got into the sentlevel page through My Annotations
        else:
            permission = Projectuser.query.filter(Projectuser.project_id==project_id, Projectuser.user_id==current_user.id).first().permission
    except AttributeError:
        project_name = ""
        admin=current_user
        permission = ""

    return render_template('doclevel.html', doc_id=doc_id, sent_annot_pairs=sent_annot_pairs, sentAnnotUmrs=json.dumps(all_sent_umrs),
                           filename=doc.filename,
                           title='Doc Level Annotation', current_snt_id=current_snt_id,
                           current_sent_pair=current_sent_pair, exported_items=exported_items, lang=doc.lang,
                           file_format=doc.file_format,
                           content_string=doc.content.replace('\\', '\\\\'), # this is for toolbox4 format that has a lot of unescaped backslashes
                           all_sent_umrs=all_sent_umrs,
                           project_name=project_name,
                           project_id=project_id,
                           admin=admin,
                           owner=owner,
                           permission=permission)

@main.route("/doclevelview/<string:doc_sent_id>", methods=['GET', 'POST'])
def doclevelview(doc_sent_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    doc_id = int(doc_sent_id.split("_")[0])
    default_sent_id = int(doc_sent_id.split("_")[1])
    owner_user_id = current_user.id if int(doc_sent_id.split("_")[2])==0 else int(doc_sent_id.split("_")[2])# html post 0 here, it means it's my own annotation
    owner = User.query.get_or_404(owner_user_id)

    current_snt_id = default_sent_id
    if "set_sentence" in request.form:
        current_snt_id = int(request.form["sentence_id"])

    doc = Doc.query.get_or_404(doc_id)
    sents = Sent.query.filter(Sent.doc_id == doc.id).order_by(Sent.id).all()
    annotations = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.user_id == owner.id).order_by(
        Annotation.sent_id).all()
    sentAnnotUmrs = [annot.sent_umr for annot in annotations]

    # Create a dictionary mapping sentence_id to annotation
    annot_dict = {annot.sent_id: annot for annot in annotations}
    
    # Create pairs with None for missing annotations
    sent_annot_pairs = [(sent, annot_dict.get(sent.id)) for sent in sents]

    try:
        current_sent_pair = sent_annot_pairs[current_snt_id - 1]
        if current_sent_pair[1] is None:
            # If there's no sentence-level annotation, redirect to sentence-level page
            flash('Please create a sentence-level annotation first', 'warning')
            return redirect(url_for('main.sentlevelview', doc_sent_id=str(doc_id)+'_'+str(current_snt_id)+'_'+str(owner.id)))
    except IndexError:
        flash('Invalid sentence ID', 'danger')
        return redirect(url_for('main.sentlevelview', doc_sent_id=str(doc_id)+'_1_'+str(owner.id)))

    # load all annotations for current document used for export_annot()
    all_annots = [annot.sent_annot for annot in annotations]
    all_aligns = [annot.alignment for annot in annotations]
    all_doc_annots = [annot.doc_annot for annot in annotations]
    all_sents = [sent2.content for sent2 in sents]
    all_sent_umrs = [annot.sent_umr for annot in annotations]

    # Handle empty annotations the same way as sentence level route
    sent_with_annot_ids = [annot.sent_id for annot in annotations]
    all_annots_no_skipping = [""] * len(all_sents)
    all_aligns_no_skipping = [""] * len(all_sents)
    all_doc_annots_no_skipping = [""] * len(all_sents)

    # Fill in the annotations where they exist
    for i, annot in enumerate(annotations):
        try:
            sent_idx = next((idx for idx, s in enumerate(all_sents) if s.id == annot.sent_id), None)
            if sent_idx is not None:
                all_annots_no_skipping[sent_idx] = all_annots[i]
                all_aligns_no_skipping[sent_idx] = all_aligns[i]
                all_doc_annots_no_skipping[sent_idx] = all_doc_annots[i]
        except Exception as e:
            current_app.logger.error(f"Error processing annotation {i}: {str(e)}")
            continue

    # Create exported items with properly aligned annotations
    exported_items = [list(p) for p in zip(all_sents, all_annots_no_skipping, all_aligns_no_skipping, all_doc_annots_no_skipping)]

    #check who is the admin of the project containing this file:
    try:
        project_id = Doc.query.filter(Doc.id == doc_id).first().project_id
        project_name = Projectuser.query.filter(Projectuser.project_id == project_id, Projectuser.permission=="admin").first().project_name
        admin_id = Projectuser.query.filter(Projectuser.project_id == project_id,
                                            Projectuser.permission == "admin").first().user_id
        admin = User.query.filter(User.id == admin_id).first()
        if owner.id == current_user.id:
            permission = 'edit' #this means got into the sentlevel page through My Annotations, a hack to make sure the person can annotate, this person could be either admin or edit or annotate
        else:
            permission = Projectuser.query.filter(Projectuser.project_id==project_id, Projectuser.user_id==current_user.id).first().permission
    except AttributeError:
        project_name = ""
        admin=current_user
        permission = ""

    return render_template('doclevelview.html', doc_id=doc_id, sent_annot_pairs=sent_annot_pairs, sentAnnotUmrs=json.dumps(sentAnnotUmrs),
                           filename=doc.filename,
                           title='Doc Level Annotation', current_snt_id=current_snt_id,
                           current_sent_pair=current_sent_pair, exported_items=exported_items, lang=doc.lang,
                           file_format=doc.file_format,
                           content_string=doc.content.replace('\\', '\\\\'),
                           # this is for toolbox4 format that has a lot of unescaped backslashes
                           all_sent_umrs=all_sent_umrs,
                           project_name=project_name,
                           admin=admin,
                           owner=owner,
                           permission=permission)

@main.route("/about")
def about():
    return render_template('about.html', title='About')

@main.route("/guide")
def guidelines():
    return render_template('user_guide.html')

def get_lexicon_dicts(project_id:int):
    try:
        frames_dict = Lexicon.query.filter(Lexicon.project_id==project_id).first().lexi
    except AttributeError:
        frames_dict = {}
        flash(f'No existing lexicon found for current project', 'success')

    citation_dict = {inflected_form: lemma for lemma in frames_dict for inflected_form in
                     frames_dict[lemma]["inflected_forms"]}

    return frames_dict, citation_dict

def populate_lexicon_item_form_by_lookup(fd, citation_dict, look_up_inflected, look_up_lemma):
    lexicon_item_form = LexiconItemForm()
    lexicon_item = {}

    if look_up_inflected:
        if look_up_inflected in citation_dict:
            look_up_lemma = citation_dict[look_up_inflected]
            lexicon_item = fd.flatten[look_up_lemma]
        else:
            flash(f'Inflected form {look_up_inflected} not found in lexicon', 'danger')
    elif look_up_lemma:
        if look_up_lemma in fd.flatten.keys():
            lexicon_item = fd.flatten[look_up_lemma]
        else:
            flash(f'Lemma {look_up_lemma} not found in lexicon', 'danger')

    lexicon_item_form.lemma.data = look_up_lemma
    lexicon_item_form.root.data = lexicon_item.get('root', "")
    lexicon_item_form.pos.data = lexicon_item.get('pos', "")
    
    for surface_form in lexicon_item.get('inflected_forms', []):
        entry = InflectedForm()
        entry.inflected_form = surface_form
        lexicon_item_form.inflected_forms.append_entry(entry)
        
    for sense in lexicon_item.get('sense', []):
        entry = SenseForm()
        entry.gloss = sense.get('gloss')
        entry.args = sense.get('args')
        entry.coding_frames = sense.get('coding_frames')
        lexicon_item_form.senses.append_entry(entry)
        
    return lexicon_item_form, lexicon_item

@main.route("/lexiconlookup/<project_id>", methods=['GET', 'POST'])
def lexiconlookup(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    project_name = Project.query.filter(Project.id==project_id).first().project_name
    doc_id = int(request.args.get('doc_id'))
    snt_id = int(request.args.get('snt_id', 1))
    doc = Doc.query.get_or_404(doc_id)
    frames_dict, citation_dict = get_lexicon_dicts(project_id=project_id)
    fd = FrameDict.from_dict(frames_dict)

    autocomplete_lemmas = list(fd.flatten.keys())
    autocomplete_inflected = list(citation_dict.keys())

    if request.method == 'POST':
        try:
            selected_word = request.get_json(force=True)['selected_word']
            current_app.logger.info(f"Finding similar words for: {selected_word}")
            word_candidates = generate_candidate_list(doc.content, doc.file_format)
            similar_word_list = find_suggested_words(word=selected_word, word_candidates=word_candidates)
            return make_response(jsonify({"similar_word_list": similar_word_list}), 200)
        except Exception as e:
            current_app.logger.error(f"Error finding similar words: {str(e)}")
            return make_response(jsonify({"error": "Failed to find similar words"}), 500)

    look_up_form = LookUpLexiconItemForm()

    if look_up_form.validate_on_submit() and (look_up_form.inflected_form.data or look_up_form.lemma_form.data):
        look_up_inflected = look_up_form.inflected_form.data
        look_up_lemma = look_up_form.lemma_form.data
        return redirect(
            url_for('main.lexiconresult_get', project_id=project_id, look_up_inflected=look_up_inflected, look_up_lemma=look_up_lemma,
                    doc_id=doc_id, snt_id=snt_id))

    return render_template('lexicon_lookup.html', project_id=project_id, project_name=project_name,
                           look_up_form=look_up_form,
                           frames_dict=json.dumps(frames_dict), citation_dict=json.dumps(citation_dict),
                           doc_id=doc_id, snt_id=snt_id,
                           autocomplete_lemmas=json.dumps(autocomplete_lemmas), autocomplete_inflected=json.dumps(autocomplete_inflected))

@main.route("/lexiconresult/<project_id>", methods=['GET'])
def lexiconresult_get(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    project_name = Project.query.filter(Project.id==project_id).first().project_name
    doc_id = int(request.args.get('doc_id')) #used to suggest words with similar lemma
    snt_id = int(request.args.get('snt_id', 1)) #used to go back to the original sentence number when click on sent-level-annot button
    frames_dict, citation_dict = get_lexicon_dicts(project_id=project_id)
    fd = FrameDict.from_dict(frames_dict)

    look_up_inflected = request.args.get('look_up_inflected', None)
    look_up_lemma = request.args.get('look_up_lemma', None)

    lexicon_item_form, lexicon_item = populate_lexicon_item_form_by_lookup(fd, citation_dict, look_up_inflected, look_up_lemma)

    return render_template('lexicon_result.html', project_id=project_id, project_name=project_name,
                           lexicon_item_form=lexicon_item_form,
                           frames_dict=json.dumps(frames_dict), citation_dict=json.dumps(citation_dict),
                           doc_id=doc_id, snt_id=snt_id, look_up_lemma=look_up_lemma)

@main.route("/lexiconresult/<project_id>", methods=['POST'])
def lexiconresult_post(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    project_name = Project.query.filter(Project.id==project_id).first().project_name
    doc_id = int(request.args.get('doc_id'))
    snt_id = int(request.args.get('snt_id', 1))
    doc = Doc.query.get_or_404(doc_id)
    frames_dict, citation_dict = get_lexicon_dicts(project_id=project_id)
    fd = FrameDict.from_dict(frames_dict)
    
    try:
        selected_word = request.get_json(force=True)['selected_word']
        current_app.logger.info(f"Finding similar words for: {selected_word}")
        word_candidates = generate_candidate_list(doc.content, doc.file_format)
        similar_word_list = find_suggested_words(word=selected_word, word_candidates=word_candidates)
        return make_response(jsonify({"similar_word_list": similar_word_list}), 200)
    except Exception as e:
        current_app.logger.error(f"Error finding similar words: {str(e)}")
        return make_response(jsonify({"error": "Failed to find similar words"}), 500)

    lexicon_item_form = LexiconItemForm()

    if lexicon_item_form.add_inflected.data:
        getattr(lexicon_item_form, 'inflected_forms').append_entry()

    if lexicon_item_form.add_sense.data:
        getattr(lexicon_item_form, 'senses').append_entry()

    for ndx, this_entry in enumerate(lexicon_item_form.inflected_forms.entries):
        if this_entry.data['remove']:
            del lexicon_item_form.inflected_forms.entries[ndx]
            break
    for ndx, this_entry in enumerate(lexicon_item_form.senses.entries):
        if this_entry.data['remove']:
            del lexicon_item_form.senses.entries[ndx]
            break

    if lexicon_item_form.validate_on_submit() and lexicon_item_form.lemma.data:
        new_lexicon_entry = {
            lexicon_item_form.lemma.data: {
                "root": lexicon_item_form.root.data,
                "pos": lexicon_item_form.pos.data,
                "inflected_forms": [element['inflected_form'] for element in lexicon_item_form.inflected_forms.data if element['inflected_form'] != ""],
                "sense": lexicon_item_form.senses.data
            }
        }
        look_up_lemma = lexicon_item_form.lemma.data
        
        try:
            if lexicon_item_form.update_mode.data == 'edit':
                fd.edit_frame(look_up_lemma, new_lexicon_entry[look_up_lemma])
                current_app.logger.info(f"Edited lexicon entry for lemma: {look_up_lemma}")
                flash('Entry edited successfully', 'success')
                
                existing_lexicon = Lexicon.query.filter_by(project_id=project_id).first()
                existing_lexicon.lexi = fd.flatten
                flag_modified(existing_lexicon, 'lexi')
                db.session.commit()
                
            elif lexicon_item_form.update_mode.data == 'delete':
                fd.delete_frame(lexicon_item_form.lemma.data)
                current_app.logger.info(f"Deleted lexicon entry for lemma: {look_up_lemma}")
                flash('Entry deleted successfully', 'success')
                
                existing_lexicon = Lexicon.query.filter_by(project_id=project_id).first()
                existing_lexicon.lexi = fd.flatten
                flag_modified(existing_lexicon, 'lexi')
                db.session.commit()
                
                return redirect(
                    url_for('main.lexiconresult_get', project_id=project_id, look_up_inflected='', look_up_lemma='',
                            doc_id=doc_id, snt_id=snt_id))
                            
        except KeyError:
            current_app.logger.error(f"Failed to edit lexicon entry - lemma not found: {look_up_lemma}")
            flash('Entry not found in lexicon. Use "add new entry" mode instead.', 'danger')
        except Exception as e:
            current_app.logger.error(f"Error updating lexicon: {str(e)}")
            flash('Failed to update lexicon entry', 'danger')

    citation_dict = {inflected_form: lemma for lemma in fd.flatten for inflected_form in
                             fd.flatten[lemma]["inflected_forms"]}

    return render_template('lexicon_result.html', project_id=project_id, project_name=project_name,
                           lexicon_item_form=lexicon_item_form,
                           frames_dict=json.dumps(frames_dict), citation_dict=json.dumps(citation_dict),
                           doc_id=doc_id, snt_id=snt_id)