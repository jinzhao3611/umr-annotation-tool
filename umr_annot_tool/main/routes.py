import sqlalchemy.exc
from flask import url_for, redirect, flash, send_from_directory, make_response, jsonify
from werkzeug.utils import secure_filename
from typing import List
import json
from one_time_scripts.parse_input_xml import html, parse_exported_file, process_exported_file_isi_editor
from umr_annot_tool.resources.utility_modules.parse_lexicon_file import parse_lexicon_xml, FrameDict
from umr_annot_tool.resources.utility_modules.penmanString2umrDict import string2umr
from flask_login import current_user
import os
import logging
from datetime import datetime
from bs4 import BeautifulSoup
import jpype

from flask import render_template, request, Blueprint
from umr_annot_tool import db, bcrypt
from umr_annot_tool.models import Sent, Doc, Annotation, User, Post, Lexicon, Projectuser, Project, Lattice, \
    Partialgraph
from umr_annot_tool.main.forms import UploadForm, UploadLexiconForm, LexiconItemForm, LookUpLexiconItemForm, \
    InflectedForm, SenseForm, CreateProjectForm, LexiconAddForm
from sqlalchemy.orm.attributes import flag_modified
from umr_annot_tool.resources.utility_modules.suggest_sim_words import generate_candidate_list, find_suggested_words

main = Blueprint('main', __name__)
FRAME_FILE_ENGLISH = "umr_annot_tool/resources/frames_english.json"
FRAME_FILE_CHINESE = 'umr_annot_tool/resources/frames_chinese.json'
FRAME_FILE_ARABIC = 'umr_annot_tool/resources/frames_arabic.json'

from farasa.stemmer import FarasaStemmer

stemmer = FarasaStemmer(interactive=True)



# instance1=jclass().lemmatizeLine('ﺍﻷﻤﻴﺭ')
# print(instance1)
def lexicon2db(project_id: int, lexicon_dict: dict):
    existing_lexicon = Lexicon.query.filter(Lexicon.project_id == project_id).first()
    existing_lexicon.lexi = lexicon_dict
    flag_modified(existing_lexicon, 'lexi')
    db.session.commit()
    flash('your lexicon has been saved to db', 'success')


def file2db(filename: str, file_format: str, content_string: str, lang: str, sents: List[List[str]], has_annot: bool,
            current_project_id: int,
            sent_annots=None, doc_annots=None, aligns=None) -> int:
    existing_doc = Doc.query.filter_by(filename=filename, user_id=current_user.id,
                                       project_id=current_project_id).first()
    if existing_doc:
        doc_id = existing_doc.id
        flash('Upload failed: A document with the same name is already in current project.', 'success')
    else:
        doc = Doc(lang=lang, filename=filename, content=content_string, user_id=current_user.id,
                  file_format=file_format, project_id=current_project_id)
        db.session.add(doc)
        db.session.commit()
        doc_id = doc.id
        flash('Your doc has been created!', 'success')
        for sent_of_tokens in sents:
            sent = Sent(content=" ".join(sent_of_tokens), doc_id=doc.id)
            db.session.add(sent)
            db.session.commit()
        flash('Your sents has been created.', 'success')

    print("file_format:", file_format)
    if file_format == 'isi_editor':
        for i in range(len(sents)):
            dummy_user_id = User.query.filter(User.username == "dummy_user").first().id
            annotation = Annotation(sent_annot=sent_annots[i], doc_annot="", alignment={},
                                    user_id=dummy_user_id,
                                    # pre-existing annotations are assigned to dummy user, waiting for annotators to check out
                                    sent_id=i + 1,  # sentence id counts from 1
                                    doc_id=doc_id,
                                    sent_umr={}, doc_umr={})
            db.session.add(annotation)
        db.session.commit()
        flash('Your annotations has been created.', 'success')
    elif has_annot:
        for i in range(len(sents)):
            dummy_user_id = User.query.filter(User.username == "dummy_user").first().id
            dehtml_sent_annot = BeautifulSoup(sent_annots[i]).get_text()
            dehtml_doc_annot = BeautifulSoup(doc_annots[i]).get_text()
            sent_umr = string2umr(dehtml_sent_annot)
            annotation = Annotation(sent_annot=dehtml_sent_annot, doc_annot=dehtml_doc_annot, alignment=aligns[i],
                                    user_id=dummy_user_id,
                                    # pre-existing annotations are assigned to dummy user, waiting for annotators to check out
                                    sent_id=i + 1,  # sentence id counts from 1
                                    doc_id=doc_id,
                                    sent_umr=sent_umr, doc_umr={})
            db.session.add(annotation)
        db.session.commit()
        flash('Your annotations has been created.', 'success')
    return doc_id


@main.route("/new_project", methods=['GET', 'POST'])
def new_project():
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    form = CreateProjectForm()
    if form.validate_on_submit():
        try:
            hashed_password = bcrypt.generate_password_hash('qcisauser').decode('utf-8')
            qc_user = User(username=f"{form.projectname.data}_qc",
                           email=f'{form.projectname.data}{datetime.now().strftime("%H%M%S")}{datetime.today().strftime("%d%m%Y")}@qc.com',
                           password=hashed_password)  # the reason of using datetime is to make everybody's email different, this will cause an sqlalchemy error even before checking if there is same project name in this user's project
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
                              aspect={"Habitual": True, "Imperfective": True, "Process": True, "Atelic Process": True,
                                      "Perfective": True, "State": True, "Activity": True, "Endeavor": True,
                                      "Performance": True, "Reversible State": True, "Irreversible State": True,
                                      "Inherent State": True, "Point State": True, "Undirected Activity": True,
                                      "Directed Activity": True, "Semelfactive": True, "Undirected Endeavor": True,
                                      "Directed Endeavor": True, "Incremental Accomplishment": True,
                                      "Nonincremental Accomplishment": True, "Directed Achievement": True,
                                      "Reversible Directed Achievement": True,
                                      "Irreversible Directed Achievement": True},
                              person={"person": True, "non-3rd": True, "non-1st": True, "1st": True, "2nd": True,
                                      "3rd": True, "incl.": True, "excl.": True},
                              number={"Singular": True, "Non-singular": True, "Paucal": True, "Plural": True,
                                      "Dual": True, "Non-dual Paucal": True, "Greater Plural": True, "Trial": True,
                                      "Non-trial Paucal": True},
                              modal={"Non-NeutAff": True, "Non-FullAff": True, "Non-NeutNeg": True, "Non-FullNeg": True,
                                     "FullAff": True, "PrtAff": True, "NeutAff": True, "FullNeg": True, "PrtNeg": True,
                                     "NeutNeg": True, "Strong-PrtAff": True, "Weak-PrtAff": True,
                                     "Strong-NeutAff": True, "Weak-NeutAff": True, "Strong-PrtNeg": True,
                                     "Weak-PrtNeg": True, "Strong-NeutNeg": True, "Weak-NeutNeg": True},
                              discourse={"or": True, "and+but": True, "inclusive-disj": True, "exclusive-disj": True,
                                         "and+unexpected": True, "and+contrast": True, "but": True, "and": True,
                                         "consecutive": True, "additive": True, "unexpected-co-occurrence": True,
                                         "contrast-01": True, ":subtraction": True})
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


@main.route("/upload_document/<int:current_project_id>", methods=['GET', 'POST'])
def upload_document(current_project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    form = UploadForm()
    sent_annots = []
    doc_annots = []
    doc_id = 0
    if form.validate_on_submit():
        if form.files.data and form.files.data[0].filename:
            for form_file in form.files.data:
                content_string = form_file.read().decode(encoding="utf-8", errors="ignore")
                filename = secure_filename(form_file.filename)
                file_format = form.file_format.data
                lang = form.language_mode.data
                is_exported = form.if_exported.data
                if is_exported:  # has annotation
                    if file_format == 'isi_editor':
                        new_content_string, sents, sent_annots = process_exported_file_isi_editor(content_string)
                        file2db(filename=filename, file_format=file_format, content_string=new_content_string,
                                lang=lang,
                                sents=sents, has_annot=True, sent_annots=sent_annots,
                                current_project_id=current_project_id)
                    else:
                        new_content_string, sents, sent_annots, doc_annots, aligns = parse_exported_file(
                            content_string)
                        file2db(filename=filename, file_format=file_format, content_string=new_content_string,
                                lang=lang,
                                sents=sents, has_annot=True, sent_annots=sent_annots, doc_annots=doc_annots,
                                aligns=aligns, current_project_id=current_project_id)
                else:  # doesn't have annotation
                    info2display = html(content_string, file_format, lang=lang)
                    file2db(filename=filename, file_format=file_format, content_string=content_string, lang=lang,
                            sents=info2display.sents, has_annot=False, current_project_id=current_project_id)
            try:  # when uploaded file already come with annotation, convert strings to umr and save to database
                dummy_user_id = User.query.filter(User.username == "dummy_user").first().id
                doc_id = request.get_json(force=True)["doc_id"]
                sentUmrDicts = json.loads(request.get_json(force=True)["sentUmrDicts"])
                docUmrDicts = json.loads(request.get_json(force=True)["docUmrDicts"])
                annotations = Annotation.query.filter(Annotation.doc_id == doc_id,
                                                      Annotation.user_id == dummy_user_id).order_by(
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

    return render_template('upload_document.html', title='upload', form=form, sent_annots=json.dumps(sent_annots),
                           doc_annots=json.dumps(doc_annots), doc_id=doc_id)


@main.route("/upload_lexicon/<int:current_project_id>", methods=['GET', 'POST'])
def upload_lexicon(current_project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    lexicon_form = UploadLexiconForm()
    if lexicon_form.validate_on_submit():
        if lexicon_form.file.data:
            content_string = lexicon_form.file.data.read().decode("utf-8")
            frames_dict = parse_lexicon_xml(content_string)
            fd = FrameDict.from_dict(frames_dict)
            lexicon2db(project_id=current_project_id, lexicon_dict=fd.flatten)
            return redirect(url_for('users.project', project_id=current_project_id))
        else:
            flash("please upload a lexicon file", "danger")

    return render_template('upload_lexicon.html', title='upload', lexicon_form=lexicon_form,
                           project_id=current_project_id)


@main.route("/sentlevel/<string:doc_sent_id>", methods=['GET', 'POST'])
def sentlevel(doc_sent_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))

    doc_id = int(doc_sent_id.split("_")[0])
    default_sent_id = int(doc_sent_id.split("_")[1])
    owner_user_id = current_user.id if int(doc_sent_id.split("_")[2]) == 0 else int(
        doc_sent_id.split("_")[2])  # html post 0 here, it means it's my own annotation
    owner = User.query.get_or_404(owner_user_id)

    # check who is the admin of the project containing this file:
    project_id = Doc.query.filter(Doc.id == doc_id).first().project_id
    project_name = Project.query.filter(Project.id == project_id).first().project_name
    admin_id = Projectuser.query.filter(Projectuser.project_id == project_id,
                                        Projectuser.permission == "admin").first().user_id
    admin = User.query.filter(User.id == admin_id).first()
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
        try:  # this is to find if there is user defined frame_dict: keys are lemmas, values are lemma information including inflected forms of the lemma
            frame_dict = Lexicon.query.filter_by(project_id=project_id).first().lexi
        except AttributeError:  # there is no frame_dict for this language at all
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
                                        sent_umr=umr_dict, doc_umr={})
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
    except Exception as e:
        print(e)
        curr_annotation_string = ""
        curr_sent_umr = {}
        curr_alignment = {}

    # load all annotations for current document used for export_annot()
    annotations = Annotation.query.filter(Annotation.doc_id == doc_id, Annotation.user_id == owner_user_id).order_by(
        Annotation.sent_id).all()
    filtered_sentences = Sent.query.filter(Sent.doc_id == doc_id).order_by(Sent.id).all()
    annotated_sent_ids = [annot.sent_id for annot in annotations if
                          (annot.sent_umr != {} or annot.sent_annot)]  # this is used to color annotated sentences
    all_annots = [annot.sent_annot for annot in annotations]
    all_aligns = [annot.alignment for annot in annotations]
    all_doc_annots = [annot.doc_annot for annot in annotations]
    all_sents = [sent2.content for sent2 in filtered_sentences]

    # this is a bandit solution: At early stages, I only created annotation entry in annotation table when an annotation
    # is created, then I changed to create an annotation entry for every sentence uploaded with or without annotation created,
    # however, when people export files from early stages, annotations were misaligned with the text lines - some lines
    # had no annotations, in which case the annotations for all following lines were moved up one slot.
    # Therefore, here I manually fill in empty strings in place for sentences that has no annotation. But annotations created
    # in later stages don't need this.
    sent_with_annot_ids = [annot.sent_id for annot in annotations]
    all_annots_no_skipping = [""] * len(all_sents)
    all_aligns_no_skipping = [""] * len(all_sents)
    all_doc_annots_no_skipping = [""] * len(all_sents)
    for i, sa, a, da in zip(sent_with_annot_ids, all_annots, all_aligns, all_doc_annots):
        print('bug finding',i)
        all_annots_no_skipping[i - 1] = sa
        all_aligns_no_skipping[i - 1] = a
        all_doc_annots_no_skipping[i - 1] = da

    exported_items = [list(p) for p in
                      zip(all_sents, all_annots_no_skipping, all_aligns_no_skipping, all_doc_annots_no_skipping)]

    lattice = Lattice.query.filter(Lattice.project_id == project_id).first()
    aspectSettingsJSON = lattice.aspect
    personSettingsJSON = lattice.person
    numberSettingsJSON = lattice.number
    modalSettingsJSON = lattice.modal
    discourseSettingsJSON = lattice.discourse

    pg = Partialgraph.query.filter(Partialgraph.project_id == project_id).first()
    partial_graphs_json = pg.partial_umr
    print("partial_graphs_json: ", partial_graphs_json)

    return render_template('sentlevel.html', lang=doc.lang, filename=doc.filename, snt_id=snt_id, doc_id=doc_id,
                           info2display=info2display,
                           frame_dict=json.dumps(frame_dict),
                           curr_sent_umr=curr_sent_umr, curr_annotation_string=curr_annotation_string,
                           curr_alignment=curr_alignment,
                           exported_items=exported_items,
                           file_format=doc.file_format,
                           content_string=doc.content.replace('\\', '\\\\'),
                           # this is for toolbox4 format that has a lot of unescaped backslashes
                           annotated_sent_ids=annotated_sent_ids,
                           project_name=project_name,
                           project_id=project_id,
                           admin=admin, owner=owner,
                           permission=permission,
                           aspectSettingsJSON=aspectSettingsJSON, personSettingsJSON=personSettingsJSON,
                           numberSettingsJSON=numberSettingsJSON, modalSettingsJSON=modalSettingsJSON,
                           discourseSettingsJSON=discourseSettingsJSON,
                           partial_graphs_json=partial_graphs_json)


@main.route("/sentlevelview/<string:doc_sent_id>", methods=['GET', 'POST'])
def sentlevelview(doc_sent_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    doc_id = int(doc_sent_id.split("_")[0])
    default_sent_id = int(doc_sent_id.split("_")[1])
    owner_user_id = current_user.id if int(doc_sent_id.split("_")[2]) == 0 else int(
        doc_sent_id.split("_")[2])  # html post 0 here, it means it's my own annotation
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
        try:  # this is to find if there is user defined frame_dict: keys are lemmas, values are lemma information including inflected forms of the lemma
            frame_dict = Lexicon.query.filter_by(project_id=project_id).first().lexi
        except AttributeError:  # there is no frame_dict for this language at all
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
    except Exception as e:
        print(e)
        curr_annotation_string = ""
        curr_sent_umr = {}
        curr_alignment = {}

    # load all annotations for current document used for export_annot()
    annotations = Annotation.query.filter(Annotation.doc_id == doc_id, Annotation.user_id == owner_user_id).order_by(
        Annotation.sent_id).all()
    filtered_sentences = Sent.query.filter(Sent.doc_id == doc_id).order_by(Sent.id).all()
    annotated_sent_ids = [annot.sent_id for annot in annotations if
                          (annot.sent_umr != {} or annot.sent_annot)]  # this is used to color annotated sentences
    all_annots = [annot.sent_annot for annot in annotations]
    all_aligns = [annot.alignment for annot in annotations]
    all_doc_annots = [annot.doc_annot for annot in annotations]
    all_sents = [sent2.content for sent2 in filtered_sentences]

    # this is a bandit solution: At early stages, I only created annotation entry in annotation table when an annotation
    # is created, then I changed to create an annotation entry for every sentence uploaded with or without annotation created,
    # however, when people export files from early stages, annotations were misaligned with the text lines - some lines
    # had no annotations, in which case the annotations for all following lines were moved up one slot.
    # Therefore, here I manually fill in empty strings in place for sentences that has no annotation. But annotations created
    # in later stages don't need this.
    sent_with_annot_ids = [annot.sent_id for annot in annotations]
    all_annots_no_skipping = [""] * len(all_sents)
    all_aligns_no_skipping = [""] * len(all_sents)
    all_doc_annots_no_skipping = [""] * len(all_sents)
    for i, sa, a, da in zip(sent_with_annot_ids, all_annots, all_aligns, all_doc_annots):
        all_annots_no_skipping[i - 1] = sa
        all_aligns_no_skipping[i - 1] = a
        all_doc_annots_no_skipping[i - 1] = da

    exported_items = [list(p) for p in
                      zip(all_sents, all_annots_no_skipping, all_aligns_no_skipping, all_doc_annots_no_skipping)]

    return render_template('sentlevelview.html', lang=doc.lang, filename=doc.filename, snt_id=snt_id, doc_id=doc_id,
                           info2display=info2display,
                           frame_dict=json.dumps(frame_dict),
                           curr_sent_umr=curr_sent_umr, curr_annotation_string=curr_annotation_string,
                           curr_alignment=curr_alignment,
                           exported_items=exported_items,
                           file_format=doc.file_format,
                           content_string=doc.content.replace('\\', '\\\\'),
                           # this is for toolbox4 format that has a lot of unescaped backslashes
                           annotated_sent_ids=annotated_sent_ids,
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
    owner_user_id = current_user.id if int(doc_sent_id.split("_")[2]) == 0 else int(
        doc_sent_id.split("_")[2])  # html post 0 here, it means it's my own annotation
    owner = User.query.get_or_404(owner_user_id)

    current_snt_id = default_sent_id
    if "set_sentence" in request.form:
        current_snt_id = int(request.form["sentence_id"])

    # add to db
    if request.method == 'POST':
        try:
            snt_id_info = request.get_json(force=True)["snt_id"]
            umr_dict = request.get_json(force=True)["umr_dict"]
            print("umr_dict: ", umr_dict)
            doc_annot_str = request.get_json(force=True)["doc_annot_str"]
            print("doc_annot_str: ", doc_annot_str)
            existing = Annotation.query.filter(Annotation.sent_id == snt_id_info, Annotation.doc_id == doc_id,
                                               Annotation.user_id == owner_user_id).first()
            if existing:  # update the existing Annotation object
                existing.doc_umr = umr_dict
                existing.doc_annot = doc_annot_str
                flag_modified(existing, 'doc_umr')
                flag_modified(existing, 'doc_annot')
                db.session.commit()
                msg = 'Success: current annotation and alignments are added to database.'
                msg_category = 'success'
                return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
            else:
                print("the sent level annotation of the current sent doesn't exist")
                msg = "the sent level annotation of the current sent doesn't exist."
                msg_category = 'success'
                return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(e)
            print("add doc level annotation to database failed")

    doc = Doc.query.get_or_404(doc_id)
    sents = Sent.query.filter(Sent.doc_id == doc.id).order_by(Sent.id).all()
    annotations = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.user_id == owner.id).order_by(
        Annotation.sent_id).all()
    sentAnnotUmrs = [annot.sent_umr for annot in annotations]
    print(type(sentAnnotUmrs))

    if doc.file_format == 'plain_text' or doc.file_format == 'isi_editor':
        sent_annot_pairs = list(zip(sents, annotations))
    else:
        _, sents_html, sent_htmls, df_html, gls, notes = html(doc.content, doc.file_format, lang=doc.lang)
        sent_annot_pairs = list(zip(df_html, annotations))

    try:
        current_sent_pair = sent_annot_pairs[current_snt_id - 1]
    except IndexError:
        flash('You have not created sentence level annotation yet', 'danger')
        return redirect(
            url_for('main.sentlevel', doc_sent_id=str(doc_id) + '_' + str(current_snt_id) + '_' + str(owner.id)))

    # load all annotations for current document used for export_annot()
    all_annots = [annot.sent_annot for annot in annotations]
    all_aligns = [annot.alignment for annot in annotations]
    all_doc_annots = [annot.doc_annot for annot in annotations]
    all_sents = [sent2.content for sent2 in sents]
    all_sent_umrs = [annot.sent_umr for annot in annotations]

    # this is a bandit solution: At early stages, I only created annotation entry in annotation table when an annotation
    # is created, then I changed to create an annotation entry for every sentence uploaded with or without annotation created,
    # however, when people export files from early stages, annotations were misaligned with the text lines - some lines
    # had no annotations, in which case the annotations for all following lines were moved up one slot.
    # Therefore, here I manually fill in empty strings in place for sentences that has no annotation. But annotations created
    # in later stages don't need this.
    sent_with_annot_ids = [annot.sent_id for annot in annotations]
    all_annots_no_skipping = [""] * len(all_sents)
    all_aligns_no_skipping = [""] * len(all_sents)
    all_doc_annots_no_skipping = [""] * len(all_sents)
    for i, sa, a, da in zip(sent_with_annot_ids, all_annots, all_aligns, all_doc_annots):
        all_annots_no_skipping[i - 1] = sa
        all_aligns_no_skipping[i - 1] = a
        all_doc_annots_no_skipping[i - 1] = da

    exported_items = [list(p) for p in
                      zip(all_sents, all_annots_no_skipping, all_aligns_no_skipping, all_doc_annots_no_skipping)]

    # check who is the admin of the project containing this file:
    try:
        project_id = Doc.query.filter(Doc.id == doc_id).first().project_id
        project_name = Projectuser.query.filter(Projectuser.project_id == project_id,
                                                Projectuser.permission == "admin").first().project_name
        admin_id = Projectuser.query.filter(Projectuser.project_id == project_id,
                                            Projectuser.permission == "admin").first().user_id
        admin = User.query.filter(User.id == admin_id).first()
        if owner.id == current_user.id:
            permission = 'edit'  # this means got into the sentlevel page through My Annotations, a hack to make sure the person can annotate, this person could be either admin or edit or annotate
        else:
            permission = Projectuser.query.filter(Projectuser.project_id == project_id,
                                                  Projectuser.user_id == current_user.id).first().permission
    except AttributeError:
        project_name = ""
        admin = current_user
        permission = ""

    return render_template('doclevel.html', doc_id=doc_id, sent_annot_pairs=sent_annot_pairs,
                           sentAnnotUmrs=json.dumps(sentAnnotUmrs),
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


@main.route("/doclevelview/<string:doc_sent_id>", methods=['GET', 'POST'])
def doclevelview(doc_sent_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    doc_id = int(doc_sent_id.split("_")[0])
    default_sent_id = int(doc_sent_id.split("_")[1])
    owner_user_id = current_user.id if int(doc_sent_id.split("_")[2]) == 0 else int(
        doc_sent_id.split("_")[2])  # html post 0 here, it means it's my own annotation
    owner = User.query.get_or_404(owner_user_id)

    current_snt_id = default_sent_id
    if "set_sentence" in request.form:
        current_snt_id = int(request.form["sentence_id"])

    doc = Doc.query.get_or_404(doc_id)
    sents = Sent.query.filter(Sent.doc_id == doc.id).order_by(Sent.id).all()
    annotations = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.user_id == owner.id).order_by(
        Annotation.sent_id).all()
    sentAnnotUmrs = [annot.sent_umr for annot in annotations]

    if doc.file_format == 'plain_text' or 'isi_editor':
        sent_annot_pairs = list(zip(sents, annotations))
    else:
        _, sents_html, sent_htmls, df_html, gls, notes = html(doc.content, doc.file_format, lang=doc.lang)
        sent_annot_pairs = list(zip(df_html, annotations))

    try:
        current_sent_pair = sent_annot_pairs[current_snt_id - 1]
    except IndexError:
        flash('You have not created sentence level annotation yet', 'danger')
        return redirect(
            url_for('main.sentlevelview', doc_sent_id=str(doc_id) + '_' + str(current_snt_id) + '_' + str(owner.id)))

    # load all annotations for current document used for export_annot()
    all_annots = [annot.sent_annot for annot in annotations]
    all_aligns = [annot.alignment for annot in annotations]
    all_doc_annots = [annot.doc_annot for annot in annotations]
    all_sents = [sent2.content for sent2 in sents]
    all_sent_umrs = [annot.sent_umr for annot in annotations]

    # this is a bandit solution: At early stages, I only created annotation entry in annotation table when an annotation
    # is created, then I changed to create an annotation entry for every sentence uploaded with or without annotation created,
    # however, when people export files from early stages, annotations were misaligned with the text lines - some lines
    # had no annotations, in which case the annotations for all following lines were moved up one slot.
    # Therefore, here I manually fill in empty strings in place for sentences that has no annotation. But annotations created
    # in later stages don't need this.
    sent_with_annot_ids = [annot.sent_id for annot in annotations]
    all_annots_no_skipping = [""] * len(all_sents)
    all_aligns_no_skipping = [""] * len(all_sents)
    all_doc_annots_no_skipping = [""] * len(all_sents)
    for i, sa, a, da in zip(sent_with_annot_ids, all_annots, all_aligns, all_doc_annots):
        all_annots_no_skipping[i - 1] = sa
        all_aligns_no_skipping[i - 1] = a
        all_doc_annots_no_skipping[i - 1] = da

    exported_items = [list(p) for p in
                      zip(all_sents, all_annots_no_skipping, all_aligns_no_skipping, all_doc_annots_no_skipping)]

    # check who is the admin of the project containing this file:
    try:
        project_id = Doc.query.filter(Doc.id == doc_id).first().project_id
        project_name = Projectuser.query.filter(Projectuser.project_id == project_id,
                                                Projectuser.permission == "admin").first().project_name
        admin_id = Projectuser.query.filter(Projectuser.project_id == project_id,
                                            Projectuser.permission == "admin").first().user_id
        admin = User.query.filter(User.id == admin_id).first()
        if owner.id == current_user.id:
            permission = 'edit'  # this means got into the sentlevel page through My Annotations, a hack to make sure the person can annotate, this person could be either admin or edit or annotate
        else:
            permission = Projectuser.query.filter(Projectuser.project_id == project_id,
                                                  Projectuser.user_id == current_user.id).first().permission
    except AttributeError:
        project_name = ""
        admin = current_user
        permission = ""

    return render_template('doclevelview.html', doc_id=doc_id, sent_annot_pairs=sent_annot_pairs,
                           sentAnnotUmrs=json.dumps(sentAnnotUmrs),
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


def get_lexicon_dicts(project_id: int):
    try:
        frames_dict = Lexicon.query.filter(Lexicon.project_id == project_id).first().lexi
    except AttributeError:
        frames_dict = {}
        flash(f'there is no existing lexicon for current project, you can start to add now', 'success')

    citation_dict = {inflected_form: lemma for lemma in frames_dict for inflected_form in
                     frames_dict[lemma]["inflected_forms"]}

    return frames_dict, citation_dict


def populate_lexicon_item_form_by_lookup(fd, citation_dict, look_up_inflected, look_up_lemma):
    lexicon_item_form = LexiconItemForm()
    lexicon_item = {}  # this is the value of a key(lemma) look up in frame dict

    if look_up_inflected:
        if look_up_inflected in citation_dict:
            look_up_lemma = citation_dict[look_up_inflected]
            lexicon_item = fd.flatten[look_up_lemma]
        else:
            flash(f'inflected form {look_up_inflected} is not in current lexicon', 'danger')
    elif look_up_lemma:
        if look_up_lemma in fd.flatten.keys():
            lexicon_item = fd.flatten[look_up_lemma]
        else:
            flash(f'lemma {look_up_lemma} is not in current lexicon', 'danger')

    print("lexicon_item: ", lexicon_item)

    # following is to populate lexicon_item_form by lookup inflected_form or lemma
    lexicon_item_form.lemma.data = look_up_lemma  # assigned ehl to ehl-00 here
    lexicon_item_form.root.data = lexicon_item.get('root', "")
    lexicon_item_form.pos.data = lexicon_item.get('pos', "")
    for surface_form in lexicon_item.get('inflected_forms', []):
        print("surface form:", surface_form)
        entry = InflectedForm()
        entry.inflected_form = surface_form
        lexicon_item_form.inflected_forms.append_entry(entry)
    for sense in lexicon_item.get('sense', []):
        print("sense:", sense)
        entry = SenseForm()
        entry.gloss = sense.get('gloss')
        entry.args = sense.get('args')
        entry.coding_frames = sense.get('coding_frames')
        lexicon_item_form.senses.append_entry(entry)
    return lexicon_item_form, lexicon_item


# see https://stackoverflow.com/questions/49066046/append-entry-to-fieldlist-with-flask-wtforms-using-ajax
# and https://stackoverflow.com/questions/51817148/dynamically-add-new-wtforms-fieldlist-entries-from-user-interface
@main.route("/lexiconlookup/<project_id>", methods=['GET', 'POST'])
def lexiconlookup(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    project_name = Project.query.filter(Project.id == project_id).first().project_name
    doc_id = int(request.args.get('doc_id'))  # used to suggest words with similar lemma
    snt_id = int(request.args.get('snt_id',
                                  1))  # used to go back to the original sentence number when click on sent-level-annot button
    doc = Doc.query.get_or_404(doc_id)
    frames_dict, citation_dict = get_lexicon_dicts(project_id=project_id)  # this is lexi from database
    fd = FrameDict.from_dict(frames_dict)

    autocomplete_lemmas = list(fd.flatten.keys())
    autocomplete_inflected = list(citation_dict.keys())

    # handle the suggested inflected and lemma list
    if request.method == 'POST':
        try:
            selected_word = request.get_json(force=True)['selected_word']
            print("selected_word: ", selected_word)
            word_candidates = generate_candidate_list(doc.content, doc.file_format)
            similar_word_list = find_suggested_words(word=selected_word, word_candidates=word_candidates)
            res = make_response(jsonify({"similar_word_list": similar_word_list}), 200)
            return res
        except:
            print("no word selected")

    look_up_form = LookUpLexiconItemForm()

    if look_up_form.validate_on_submit() and (
            look_up_form.inflected_form.data or look_up_form.lemma_form.data):  # if click on look up button
        look_up_inflected = look_up_form.inflected_form.data
        look_up_lemma = look_up_form.lemma_form.data
        return redirect(
            url_for('main.lexiconresult_get', project_id=project_id, look_up_inflected=look_up_inflected,
                    look_up_lemma=look_up_lemma,
                    doc_id=doc_id, snt_id=snt_id))

    return render_template('lexicon_lookup.html', project_id=project_id, project_name=project_name,
                           look_up_form=look_up_form,
                           frames_dict=json.dumps(frames_dict), citation_dict=json.dumps(citation_dict),
                           doc_id=doc_id, snt_id=snt_id,
                           autocomplete_lemmas=json.dumps(autocomplete_lemmas),
                           autocomplete_inflected=json.dumps(autocomplete_inflected))


@main.route("/lexiconadd/<project_id>", methods=['GET', 'POST'])
def lexiconadd(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    project_name = Project.query.filter(Project.id == project_id).first().project_name
    doc_id = int(request.args.get('doc_id'))  # used to suggest words with similar lemma
    snt_id = int(request.args.get('snt_id',
                                  1))  # used to go back to the original sentence number when click on sent-level-annot button
    doc = Doc.query.get_or_404(doc_id)
    frames_dict, citation_dict = get_lexicon_dicts(project_id=project_id)  # this is lexi from database
    fd = FrameDict.from_dict(frames_dict)
    lexicon_add_form = LexiconAddForm()

    if request.method == 'POST':
        # handle the suggested inflected and lemma list
        try:
            selected_word = request.get_json(force=True)['selected_word']
            print("selected_word: ", selected_word)
            word_candidates = generate_candidate_list(doc.content, doc.file_format)
            similar_word_list = find_suggested_words(word=selected_word, word_candidates=word_candidates)
            res = make_response(jsonify({"similar_word_list": similar_word_list}), 200)
            return res
        except:
            print("no word selected")

        if lexicon_add_form.add_inflected.data:  # clicked on Add New Inflected Form Field button
            getattr(lexicon_add_form, 'inflected_forms').append_entry()

        if lexicon_add_form.add_sense.data:  # clicked on Add New Inflected Form Field button
            getattr(lexicon_add_form, 'senses').append_entry()

        for ndx, this_entry in enumerate(lexicon_add_form.inflected_forms.entries):
            if this_entry.data['remove']:  # This was the entry on which the person hit the delete button
                # TODO: WTForms seems to say you shouldn't do the following, but it seems to work.
                del lexicon_add_form.inflected_forms.entries[ndx]
                break
        for ndx, this_entry in enumerate(lexicon_add_form.senses.entries):
            if this_entry.data['remove']:  # This was the entry on which the person hit the delete button
                # TODO: WTForms seems to say you shouldn't do the following, but it seems to work.
                del lexicon_add_form.senses.entries[ndx]
                break
        print("form error", lexicon_add_form.errors)
        if lexicon_add_form.data['save'] and lexicon_add_form.lemma.data:  # if click on Save button
            new_lexicon_entry = {lexicon_add_form.lemma.data: {"root": lexicon_add_form.root.data,
                                                               "pos": lexicon_add_form.pos.data,
                                                               "inflected_forms": [element['inflected_form'] for element
                                                                                   in
                                                                                   lexicon_add_form.inflected_forms.data
                                                                                   if element['inflected_form'] != ""],
                                                               "sense": lexicon_add_form.senses.data
                                                               }
                                 }
            look_up_lemma = lexicon_add_form.lemma.data
            print("new_lexicon_entry: ", new_lexicon_entry)

            fd.add_frame(look_up_lemma, new_lexicon_entry[
                look_up_lemma])  # deal with homonym case: automatically number those hymonym lemmas
            # add to database
            existing_lexicon = Lexicon.query.filter_by(project_id=project_id).first()
            existing_lexicon.lexi = fd.flatten
            flag_modified(existing_lexicon, 'lexi')
            db.session.commit()
            flash('This entry is added and saved successfully', 'success')
        print("form error", lexicon_add_form.errors)

    return render_template('lexicon_add.html', project_id=project_id, project_name=project_name,
                           lexicon_add_form=lexicon_add_form,
                           frames_dict=json.dumps(fd.flatten), citation_dict=json.dumps(citation_dict),
                           doc_id=doc_id, snt_id=snt_id)


# https://stackoverflow.com/questions/30121763/how-to-use-a-wtforms-fieldlist-of-formfields
# https://stackoverflow.com/questions/62776469/how-do-i-edit-a-wtforms-fieldlist-to-remove-a-value-in-the-middle-of-the-list
@main.route("/lexiconresult/<project_id>", methods=['GET'])
def lexiconresult_get(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    project_name = Project.query.filter(Project.id == project_id).first().project_name
    doc_id = int(request.args.get('doc_id'))  # used to suggest words with similar lemma
    snt_id = int(request.args.get('snt_id',
                                  1))  # used to go back to the original sentence number when click on sent-level-annot button
    frames_dict, citation_dict = get_lexicon_dicts(project_id=project_id)  # this is lexi from database
    fd = FrameDict.from_dict(frames_dict)

    look_up_inflected = request.args.get('look_up_inflected', None)
    look_up_lemma = request.args.get('look_up_lemma', None)
    print("look_up_inflected: ", look_up_inflected)
    print("look_up_lemma: ", look_up_lemma)
    print("frames_dict: ", frames_dict)
    print("citation_dict: ", citation_dict)

    lexicon_item_form, lexicon_item = populate_lexicon_item_form_by_lookup(fd, citation_dict, look_up_inflected,
                                                                           look_up_lemma)

    return render_template('lexicon_result.html', project_id=project_id, project_name=project_name,
                           lexicon_item_form=lexicon_item_form,
                           frames_dict=json.dumps(frames_dict), citation_dict=json.dumps(citation_dict),
                           doc_id=doc_id, snt_id=snt_id, look_up_lemma=look_up_lemma)


@main.route("/lexiconresult/<project_id>", methods=['POST'])
def lexiconresult_post(project_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    project_name = Project.query.filter(Project.id == project_id).first().project_name
    doc_id = int(request.args.get('doc_id'))  # used to suggest words with similar lemma
    snt_id = int(request.args.get('snt_id',
                                  1))  # used to go back to the original sentence number when click on sent-level-annot button
    doc = Doc.query.get_or_404(doc_id)
    frames_dict, citation_dict = get_lexicon_dicts(project_id=project_id)  # this is lexi from database
    fd = FrameDict.from_dict(frames_dict)
    # handle the suggested inflected and lemma list
    try:
        selected_word = request.get_json(force=True)['selected_word']
        print("selected_word: ", selected_word)
        word_candidates = generate_candidate_list(doc.content, doc.file_format)
        similar_word_list = find_suggested_words(word=selected_word, word_candidates=word_candidates)
        res = make_response(jsonify({"similar_word_list": similar_word_list}), 200)
        return res
    except:
        print("no word selected")

    lexicon_item_form = LexiconItemForm()

    if lexicon_item_form.add_inflected.data:  # clicked on Add New Inflected Form Field button
        getattr(lexicon_item_form, 'inflected_forms').append_entry()

    if lexicon_item_form.add_sense.data:  # clicked on Add New Inflected Form Field button
        getattr(lexicon_item_form, 'senses').append_entry()

    for ndx, this_entry in enumerate(lexicon_item_form.inflected_forms.entries):
        if this_entry.data['remove']:  # This was the entry on which the person hit the delete button
            # TODO: WTForms seems to say you shouldn't do the following, but it seems to work.
            del lexicon_item_form.inflected_forms.entries[ndx]
            break
    for ndx, this_entry in enumerate(lexicon_item_form.senses.entries):
        if this_entry.data['remove']:  # This was the entry on which the person hit the delete button
            # TODO: WTForms seems to say you shouldn't do the following, but it seems to work.
            del lexicon_item_form.senses.entries[ndx]
            break

    if lexicon_item_form.validate_on_submit() and lexicon_item_form.lemma.data:  # if click on save and lemma in form is not empty
        # this is entry to be added in frame_dict
        new_lexicon_entry = {lexicon_item_form.lemma.data: {"root": lexicon_item_form.root.data,
                                                            "pos": lexicon_item_form.pos.data,
                                                            "inflected_forms": [element['inflected_form'] for element in
                                                                                lexicon_item_form.inflected_forms.data
                                                                                if element['inflected_form'] != ""],
                                                            "sense": lexicon_item_form.senses.data
                                                            }
                             }
        look_up_lemma = lexicon_item_form.lemma.data
        if lexicon_item_form.update_mode.data == 'edit':
            try:
                fd.edit_frame(look_up_lemma, new_lexicon_entry[look_up_lemma])
                flash('This entry is edited and saved successfully', 'success')
                # add to database
                existing_lexicon = Lexicon.query.filter_by(project_id=project_id).first()
                existing_lexicon.lexi = fd.flatten
                flag_modified(existing_lexicon, 'lexi')
                db.session.commit()
            except KeyError:
                flash('This entry is not in lexicon yet, use "add new entry" mode instead of "edit current entry" mode',
                      'danger')
        elif lexicon_item_form.update_mode.data == 'delete':
            try:
                fd.delete_frame(lexicon_item_form.lemma.data)
                flash('This entry is deleted and saved successfully', 'success')
            except Exception:
                flash('This entry is not in lexicon yet, delete failed', 'danger')
                # update citation_dict as well
            # add to database
            existing_lexicon = Lexicon.query.filter_by(project_id=project_id).first()
            existing_lexicon.lexi = fd.flatten
            flag_modified(existing_lexicon, 'lexi')
            db.session.commit()
            return redirect(
                url_for('main.lexiconresult_get', project_id=project_id, look_up_inflected='', look_up_lemma='',
                        doc_id=doc_id, snt_id=snt_id))

    citation_dict = {inflected_form: lemma for lemma in fd.flatten for inflected_form in
                     fd.flatten[lemma]["inflected_forms"]}
    print("citation_dict: ", citation_dict)

    return render_template('lexicon_result.html', project_id=project_id, project_name=project_name,
                           lexicon_item_form=lexicon_item_form,
                           frames_dict=json.dumps(frames_dict), citation_dict=json.dumps(citation_dict),
                           doc_id=doc_id, snt_id=snt_id)


@main.route("/")
@main.route("/display_post")
def display_post():
    # posts = Post.query.all()
    page = request.args.get('page', default=1, type=int)
    # posts = Post.query.paginate(page=page, per_page=2)
    posts = Post.query.order_by(Post.date_posted.desc()).paginate(page=page,
                                                                  per_page=2)  # if we want to order the posts from the lastest to the oldest
    return render_template('display_post.html', posts=posts)


@main.route("/guide")
def guidelines():
    return render_template('user_guide.html')


@main.route('/guide/<path:filename>', methods=['GET', 'POST'])
def download(filename):
    # Appending app path to upload folder path within app root folder
    uploads = os.path.join(main.root_path, 'resources')
    # Returning file from appended path
    return send_from_directory(directory=uploads, filename=filename, as_attachment=True)


# farasapy
@main.route('/getfarasalemma', methods=['GET', 'POST'])
def getfarasalemma():
    import time
    token = request.get_json(force=True)["token"]
    t0 = time.time()
    # instance = jclass()
    # print(token)
    stemmed = stemmer.stem(token)
    # stemmed = instance.lemmtizeLine(token)
    # print(stemmed)
    t1 = time.time()

    return make_response(jsonify({"text": stemmed}), 200)
# @main.route('/getfarasalemma', methods=['GET', 'POST'])
# def getfarasalemma():
#     import time
#     token = request.get_json(force=True)["token"]
#     print("inflected_form: ", token)
#     t0 = time.time()
#     jvmpath = jpype.getDefaultJVMPath()
#     print(jvmpath)
#     jpype.startJVM(jvmpath, '-ea', "-Djava.class.path=%s" % (r'.\umr_annot_tool\main\FarasaSegmenterJar.jar'))
#     print(jpype.isJVMStarted())
#     jclass = jpype.JClass('com.qcri.farasa.segmenter.Farasa')
#     print(jclass)
#     if not jpype.attachThreadToJVM():
#         jpype.attachThreadToJVM()
#     stemmed = jclass().lemmtizeLine(token)
#     # stemmed = stemmer.stem(token)
#
#     # stemmed = instance.lemmtizeLine(token)
#
#     t1 = time.time()
#     print("elapsed time: ", t1 - t0)
#     print("lemma_form: ", stemmed)
#     jpype.shutdownJVM()
#     return make_response(jsonify({"text": stemmed}), 200)


@main.route('/getframe/', methods=['POST'])
def getframe():
    if request.method == 'POST':
        token = request.get_json(force=True)['token']
        print(token, 'this is token')
        scroll_pos = request.get_json(force=True)['scroll_pos']

        res = make_response(jsonify({"token": token + ' get', "scroll_pos": scroll_pos}), 200)
        return res

# jpype.shutdownJVM()
