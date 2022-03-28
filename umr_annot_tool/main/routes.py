from flask import url_for, redirect, flash, send_from_directory, make_response, jsonify
from flask_principal import Permission, RoleNeed
from werkzeug.utils import secure_filename
from typing import List
import json
from parse_input_xml import html, process_exported_file, parse_lexicon_xml, process_exported_file_isi_editor
from flask_login import current_user
import os
import logging

from flask import render_template, request, Blueprint
from umr_annot_tool import db
from umr_annot_tool.models import Sent, Doc, Annotation, User, Post, Lexicon, Projectuser
from umr_annot_tool.main.forms import UploadForm, UploadLexiconForm, LexiconItemForm, LookUpLexiconItemForm, \
    InflectedForm, SenseForm
from sqlalchemy.orm.attributes import flag_modified
from suggest_sim_words import generate_candidate_list, find_suggested_words

main = Blueprint('main', __name__)
FRAME_FILE_ENGLISH = "umr_annot_tool/resources/frames_english.json"
FRAME_FILE_CHINESE = 'umr_annot_tool/resources/frames_chinese.json'
FRAME_FILE_ARABIC = 'umr_annot_tool/resources/frames_arabic.json'

def lexicon2db(lang: str, lexicon_dict: dict):
    existing_lexicon = Lexicon.query.filter_by(lang=lang).first()
    if existing_lexicon:
        existing_lexicon.lexi = lexicon_dict
        db.session.commit()
        flash('your lexicon has been saved to db, your old lexicon for the language is overridden', 'success')
    else:
        lexicon_row = Lexicon(lang=lang, lexi=lexicon_dict)
        db.session.add(lexicon_row)
        db.session.commit()
        flash('your lexicon has been saved to db', 'success')


def file2db(filename: str, file_format: str, content_string: str, lang: str, sents: List[List[str]], has_annot: bool,
            sent_annots=None, doc_annots=None, aligns=None) -> int:
    existing_doc = Doc.query.filter_by(filename=filename, user_id=current_user.id).first()
    if existing_doc:
        doc_id = existing_doc.id
        existing_doc.content = content_string
        existing_doc.file_format = file_format
        existing_doc.lang = lang
        db.session.commit()
        flash('Your doc and sents already created.', 'success')
    else:
        doc = Doc(lang=lang, filename=filename, content=content_string, user_id=current_user.id,
                  file_format=file_format, project_id=0)
        db.session.add(doc)
        db.session.commit()
        doc_id = doc.id
        flash('Your doc has been created!', 'success')
        for sent_of_tokens in sents:
            sent = Sent(content=" ".join(sent_of_tokens), doc_id=doc.id)
            db.session.add(sent)
            db.session.commit()
        flash('Your sents has been created.', 'success')

    if has_annot:
        for i in range(len(sents)):
            existing = Annotation.query.filter(Annotation.sent_id == i + 1, Annotation.doc_id == doc_id,
                                               Annotation.user_id == current_user.id).first()
            if existing:  # update the existing Annotation object
                existing.annot_str = sent_annots[i]
                existing.doc_annot = doc_annots[i]
                existing.alignment = aligns[i]
                db.session.commit()
            else:
                dummy_user_id = User.query.filter(User.username=="dummy_user").first().id
                annotation = Annotation(annot_str=sent_annots[i], doc_annot=doc_annots[i], alignment=aligns[i],
                                        user_id=dummy_user_id, #uploaded documents are unassigned document first, the annotation of unassigned documents has user_id of dummy_user, unassigned document has user_id of the uploader/admin
                                        sent_id=i + 1, #sentence id counts from 1
                                        doc_id=doc_id,
                                        umr={}, doc_umr={})
                db.session.add(annotation)
                db.session.commit()
        flash('Your annotations has been created.', 'success')
    return doc_id


@main.route("/upload", methods=['GET', 'POST'])
def upload():
    print("called again")
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    form = UploadForm()
    lexicon_form = UploadLexiconForm()
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
                        new_content_string, sents, sent_annots, doc_annots, aligns = process_exported_file_isi_editor(
                            content_string)
                    else:
                        new_content_string, sents, sent_annots, doc_annots, aligns = process_exported_file(
                            content_string)
                    print('sents:', sents[0])
                    print(len(sents))
                    print('sent_annots:', sent_annots[0])
                    print(len(sent_annots))
                    doc_id = file2db(filename=filename, file_format=file_format, content_string=new_content_string, lang=lang,
                            sents=sents, has_annot=True, sent_annots=sent_annots, doc_annots=doc_annots, aligns=aligns)
                else:  # doesn't have annotation
                    info2display = html(content_string, file_format, lang=lang)
                    doc_id = file2db(filename=filename, file_format=file_format, content_string=content_string, lang=lang,
                            sents=info2display.sents, has_annot=False)
        else:
            flash('Please upload a file and choose a language.', 'danger')
    if lexicon_form.validate_on_submit():
        if lexicon_form.file.data:
            content_string = form.file.data.read().decode("utf-8")
            frames_dict = parse_lexicon_xml(content_string)
            lexicon2db(lang=lexicon_form.language_mode.data, lexicon_dict=frames_dict)
            return redirect(url_for('users.account'))
        else:
            flash("please upload a lexicon file, if you have one", "danger")

    try:
        dummy_user_id = User.query.filter(User.username == "dummy_user").first().id
        print(dummy_user_id)
        doc_id = request.get_json(force=True)["doc_id"]
        print(doc_id)
        sentUmrDicts = json.loads(request.get_json(force=True)["sentUmrDicts"])
        docUmrDicts = json.loads(request.get_json(force=True)["docUmrDicts"])

        print("sentUmrDicts: ", sentUmrDicts[0])
        print("docUmrDicts: ", docUmrDicts)
        annotations = Annotation.query.filter(Annotation.doc_id == doc_id, Annotation.user_id == dummy_user_id).order_by(Annotation.sent_id).all()
        print(annotations)
        for i, annot in enumerate(annotations):
            annot.umr = sentUmrDicts[i]
            annot.doc_umr = docUmrDicts[i]
            flag_modified(annot, 'umr')
            flag_modified(annot, 'doc_umr')
            db.session.add(annot)
        logging.info(db.session.commit())
    except:
        print("convert strings to umr to database failed")

    return render_template('upload.html', title='upload', form=form, lexicon_form=lexicon_form, sent_annots=json.dumps(sent_annots), doc_annots=json.dumps(doc_annots), doc_id=doc_id)


@main.route("/sentlevel/<string:doc_sent_id>", methods=['GET', 'POST'])
def sentlevel(doc_sent_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    doc_id = int(doc_sent_id.split("_")[0])
    default_sent_id = int(doc_sent_id.split("_")[1])
    owner_user_id = current_user.id if int(doc_sent_id.split("_")[2])==0 else int(doc_sent_id.split("_")[2])# html post 0 here, it means it's my own annotation
    owner = User.query.get_or_404(owner_user_id)

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
            frame_dict = Lexicon.query.filter_by(lang=doc.lang).first().lexi
        except AttributeError: #there is no frame_dict for this language at all
            frame_dict = {}

    snt_id = int(request.args.get('snt_id', default_sent_id))
    if "set_sentence" in request.form:
        snt_id = int(request.form["sentence_id"])

    if request.method == 'POST':
        # add to db
        logging.info("post request received")
        try:
            amr_html = request.get_json(force=True)["amr"]
            amr_html = amr_html.replace('<span class="text-success">', '')  # get rid of the head highlight tag
            amr_html = amr_html.replace('</span>', '')
            align_info = request.get_json(force=True)["align"]
            snt_id_info = request.get_json(force=True)["snt_id"]
            umr_dict = request.get_json(force=True)["umr"]

            existing = Annotation.query.filter(Annotation.sent_id == snt_id_info, Annotation.doc_id == doc_id,
                                               Annotation.user_id == owner.id).first()
            if existing:  # update the existing Annotation object
                existing.annot_str = amr_html
                existing.alignment = align_info
                existing.umr = umr_dict
                flag_modified(existing, 'umr')
                logging.info(f"User {owner.id} committed: {amr_html}")
                logging.info(db.session.commit())
            else:
                annotation = Annotation(annot_str=amr_html, doc_annot='', alignment=align_info, author=owner,
                                        sent_id=snt_id_info,
                                        doc_id=doc_id,
                                        umr=umr_dict, doc_umr={})
                flag_modified(annotation, 'umr')
                logging.info(f"User {owner.id} committed: {amr_html}")
                db.session.add(annotation)
                logging.info(db.session.commit())
            msg = 'Success: current annotation and alignments are added to database.'
            msg_category = 'success'
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)
        except Exception as e:
            print(e)
            print('Failure: Add current annotation and alignments to database failed.')

    try:
        curr_annotation = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.sent_id == snt_id,
                                                         Annotation.user_id == owner_user_id).first()
        curr_annotation_string = curr_annotation.annot_str.strip()
        curr_sent_umr = curr_annotation.umr
    except Exception as e:
        print(e)
        curr_annotation_string= ""
        curr_sent_umr = {}

    # load all annotations for current document used for export_annot()
    annotations = Annotation.query.filter(Annotation.doc_id == doc_id).order_by(
        Annotation.sent_id).all()
    filtered_sentences = Sent.query.filter(Sent.doc_id == doc_id).all()
    annotated_sent_ids = [annot.sent_id for annot in annotations if (annot.umr!={} or annot.annot_str)] #this is used to color annotated sentences
    all_annots = [annot.annot_str for annot in annotations]
    all_aligns = [annot.alignment for annot in annotations]
    all_doc_annots = [annot.doc_annot for annot in annotations]
    all_sents = [sent2.content for sent2 in filtered_sentences]
    exported_items = [list(p) for p in zip(all_sents, all_annots, all_aligns, all_doc_annots)]

    #check who is the admin of the project containing this file:
    try:
        project_id = Doc.query.filter(Doc.id == doc_id).first().project_id
        project_name = Projectuser.query.filter(Projectuser.project_id == project_id, Projectuser.permission=="admin").first().project_name
        admin_id = Projectuser.query.filter(Projectuser.project_id == project_id, Projectuser.permission=="admin").first().user_id
        admin = User.query.filter(User.id == admin_id).first()
        if owner.id == current_user.id:
            permission = 'edit' #this means got into the sentlevel page through My Annotations
        else:
            permission = Projectuser.query.filter(Projectuser.project_id==project_id, Projectuser.user_id==current_user.id).first().permission
    except:
        project_name=""
        admin=current_user
        permission = ""


    return render_template('sentlevel.html', lang=doc.lang, filename=doc.filename, snt_id=snt_id, doc_id=doc_id,
                           info2display=info2display,
                           frame_dict=json.dumps(frame_dict),
                           curr_sent_umr=curr_sent_umr,
                           exported_items=exported_items,
                           file_format=doc.file_format,
                           content_string=doc.content.replace('\n', '<br>'),
                           annotated_sent_ids= annotated_sent_ids,
                           project_name=project_name,
                           admin=admin,
                           curr_annotation_string=curr_annotation_string,
                           owner=owner,
                           permission=permission)

@main.route("/doclevel/<string:doc_sent_id>", methods=['GET', 'POST'])
def doclevel(doc_sent_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    doc_id = int(doc_sent_id.split("_")[0])
    default_sent_id = int(doc_sent_id.split("_")[1])
    owner_user_id = current_user.id if int(doc_sent_id.split("_")[2])==0 else int(doc_sent_id.split("_")[2])# html post 0 here, it means it's my own annotation
    owner = User.query.get_or_404(owner_user_id)

    current_snt_id = default_sent_id
    if "set_sentence" in request.form:
        current_snt_id = int(request.form["sentence_id"])

    # add to db
    if request.method == 'POST':
        try:
            umr_html = request.get_json(force=True)["umr"]
            snt_id_info = request.get_json(force=True)["snt_id"]
            umr_dict = request.get_json(force=True)["umr_dict"]
            existing = Annotation.query.filter(Annotation.sent_id == snt_id_info, Annotation.doc_id == doc_id,
                                               Annotation.user_id == current_user.id).first()
            if existing:  # update the existing Annotation object
                existing.doc_annot = umr_html
                existing.doc_umr = umr_dict
                db.session.commit()
            else:
                print("the sent level annotation of the current sent doesn't exist")
            return {"umr": umr_html}
        except:
            print("add doc level annotation to database failed")

    doc = Doc.query.get_or_404(doc_id)
    sents = Sent.query.filter(Sent.doc_id == doc.id).order_by(Sent.id).all()
    print('sents: ', sents)
    annotations = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.user_id == owner.id).order_by(
        Annotation.sent_id).all()
    sentAnnotUmrs = [annot.umr for annot in annotations]

    if doc.file_format == 'plain_text' or 'isi_editor':
        sent_annot_pairs = list(zip(sents, annotations))
        print('sents in doclevel: ', sents)
        print('annotations in doclevel: ', annotations)
    else:
        _, sents_html, sent_htmls, df_html, gls, notes = html(doc.content, doc.file_format, lang=doc.lang)
        sent_annot_pairs = list(zip(df_html, annotations))


    try:
        current_sent_pair = sent_annot_pairs[current_snt_id - 1]
    except IndexError:
        flash('You have not created sentence level annotation yet', 'danger')
        return redirect(url_for('main.sentlevel', doc_sent_id=str(doc_id)+'_'+str(current_snt_id) +'_'+str(owner.id)))

    # load all annotations for current document used for export_annot()
    all_annots = [annot.annot_str for annot in annotations]
    all_aligns = [annot.alignment for annot in annotations]
    all_doc_annots = [annot.doc_annot for annot in annotations]
    all_sents = [sent2.content for sent2 in sents]
    all_sent_umrs = [annot.umr for annot in annotations]
    exported_items = [list(p) for p in zip(all_sents, all_annots, all_aligns, all_doc_annots)]

    #check who is the admin of the project containing this file:
    project_id = Doc.query.filter(Doc.id == doc_id).first().project_id
    try:
        project_name = Projectuser.query.filter(Projectuser.project_id == project_id, Projectuser.permission=="admin").first().project_name
        admin_id = Projectuser.query.filter(Projectuser.project_id == project_id,
                                            Projectuser.permission == "admin").first().user_id
        admin = User.query.filter(User.id == admin_id).first()
    except AttributeError:
        project_id=0
        project_name = ""
        admin=current_user

    return render_template('doclevel.html', doc_id=doc_id, sent_annot_pairs=sent_annot_pairs, sentAnnotUmrs=json.dumps(sentAnnotUmrs),
                           filename=doc.filename,
                           title='Doc Level Annotation', current_snt_id=current_snt_id,
                           current_sent_pair=current_sent_pair, exported_items=exported_items, lang=doc.lang,
                           file_format=doc.file_format,
                           content_string=doc.content.replace('\n', '<br>'),
                           all_sent_umrs=all_sent_umrs,
                           project_name=project_name,
                           admin=admin,
                           owner=owner)

@main.route("/doclevelview/<string:doc_sent_id>", methods=['GET', 'POST'])
def doclevelview(doc_sent_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    doc_id = int(doc_sent_id.split("_")[0])
    default_sent_id = int(doc_sent_id.split("_")[1])
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    current_snt_id = default_sent_id
    if "set_sentence" in request.form:
        current_snt_id = int(request.form["sentence_id"])

    doc = Doc.query.get_or_404(doc_id)
    sents = Sent.query.filter(Sent.doc_id == doc.id).order_by(Sent.id).all()
    print('sents: ', sents)
    dummy_user_id = User.query.filter(User.username == "dummy_user").first().id
    annotations = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.user_id == dummy_user_id).order_by(
        Annotation.sent_id).all()
    sentAnnotUmrs = [annot.umr for annot in annotations]

    if doc.file_format == 'plain_text' or 'isi_editor':
        sent_annot_pairs = list(zip(sents, annotations))
        print('sents in doclevel: ', sents)
        print('annotations in doclevel: ', annotations)
    else:
        _, sents_html, sent_htmls, df_html, gls, notes = html(doc.content, doc.file_format, lang=doc.lang)
        sent_annot_pairs = list(zip(df_html, annotations))


    try:
        current_sent_pair = sent_annot_pairs[current_snt_id - 1]
    except IndexError:
        flash('You have not created sentence level annotation yet', 'danger')
        return redirect(url_for('main.sentlevel', doc_sent_id=str(doc_id)+'_'+str(current_snt_id) + '_' + str(current_user.id)))

    # load all annotations for current document used for export_annot()
    all_annots = [annot.annot_str for annot in annotations]
    all_aligns = [annot.alignment for annot in annotations]
    all_doc_annots = [annot.doc_annot for annot in annotations]
    all_sents = [sent2.content for sent2 in sents]
    all_sent_umrs = [annot.umr for annot in annotations]
    exported_items = [list(p) for p in zip(all_sents, all_annots, all_aligns, all_doc_annots)]

    #check who is the admin of the project containing this file:
    project_id = Doc.query.filter(Doc.id == doc_id).first().project_id
    try:
        project_name = Projectuser.query.filter(Projectuser.project_id == project_id, Projectuser.permission=="admin").first().project_name
        admin_id = Projectuser.query.filter(Projectuser.project_id == project_id,
                                            Projectuser.permission == "admin").first().user_id
        admin = User.query.filter(User.id == admin_id).first()
    except AttributeError:
        project_name = ""
        admin=current_user

    return render_template('doclevelview.html', doc_id=doc_id, sent_annot_pairs=sent_annot_pairs, sentAnnotUmrs=json.dumps(sentAnnotUmrs),
                           filename=doc.filename,
                           title='Doc Level Annotation', current_snt_id=current_snt_id,
                           current_sent_pair=current_sent_pair, exported_items=exported_items, lang=doc.lang,
                           file_format=doc.file_format,
                           content_string=doc.content.replace('\n', '<br>'),
                           all_sent_umrs=all_sent_umrs,
                           project_name=project_name,
                           admin=admin)


@main.route("/about")
def about():
    return render_template('about.html', title='About')

def get_lexicon_dicts(doc):
    try:
        frames_dict = Lexicon.query.filter_by(lang=doc.lang).first().lexi
    except AttributeError:
        frames_dict = {}
        flash(f'there is no existing lexicon for {doc.lang}, you can start to add now', 'success')

    citation_dict = {inflected_form: lemma for lemma in frames_dict for inflected_form in
                     frames_dict[lemma]["inflected_forms"]}

    return frames_dict, citation_dict

def polulate_lexicon_item_form_by_lookup(frames_dict, citation_dict, look_up_inflected, look_up_lemma):
    lexicon_item_form = LexiconItemForm() #this is not always empty
    if not lexicon_item_form.lemma.data: # the following only happens when trying to lookup the first time
        lexicon_item = {} #this is the value of a key(lemma) look up in frame dict
        if look_up_inflected:
            if look_up_inflected in citation_dict:
                look_up_lemma = citation_dict[look_up_inflected]
                lexicon_item = frames_dict[look_up_lemma]
            else:
                flash(f'inflected form {look_up_inflected} is not in current lexicon', 'danger')
                return lexicon_item_form
        elif look_up_lemma:
            if look_up_lemma in frames_dict:
                lexicon_item = frames_dict[look_up_lemma]
            else:
                flash(f'lemma {look_up_lemma} is not in current lexicon', 'danger')
                return lexicon_item_form

        # following is to populate lexicon_item_form by lookup inflected_form or lemma
        lexicon_item_form.lemma.data = look_up_lemma #assigned ehl to ehl-00 here
        lexicon_item_form.root.data = lexicon_item.get('root', None)
        lexicon_item_form.pos.data = lexicon_item.get('pos', None)
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
    return lexicon_item_form

# see https://stackoverflow.com/questions/49066046/append-entry-to-fieldlist-with-flask-wtforms-using-ajax
# and https://stackoverflow.com/questions/51817148/dynamically-add-new-wtforms-fieldlist-entries-from-user-interface
@main.route("/lexicon_modify_inflected", methods=['GET', 'POST'])
def lexicon_modify_inflected():
    lexicon_item_form = LexiconItemForm()
    getattr(lexicon_item_form, 'inflected_forms').append_entry()
    return render_template('forms_and_senses.html', lexicon_item_form=lexicon_item_form)

@main.route("/lexicon_modify_sense", methods=['GET', 'POST'])
def lexicon_modify_sense():
    lexicon_item_form = LexiconItemForm()
    getattr(lexicon_item_form, 'senses').append_entry()
    return render_template('forms_and_senses.html', lexicon_item_form=lexicon_item_form)


@main.route("/lexiconupdate/<doc_id>", methods=['GET', 'POST'])
def lexiconupdate(doc_id):
    doc = Doc.query.get_or_404(doc_id) # used for get the language
    if request.method == 'POST': # handle the suggested inflected and lemma list
        try:
            selected_word = request.get_json(force=True)['selected_word']
            word_candidates = generate_candidate_list(doc.content, doc.file_format)
            similar_word_list = find_suggested_words(word=selected_word, word_candidates=word_candidates)
            res = make_response(jsonify({"similar_word_list": similar_word_list}), 200)
            return res
        except:
            print("no word selected")

    snt_id = int(request.args.get('snt_id', 1)) #used to go back to the original sentence number when click on sent-level-annot button

    look_up_inflected = request.args.get('look_up_inflected', None)
    look_up_lemma = request.args.get('look_up_lemma', None)

    frames_dict, citation_dict = get_lexicon_dicts(doc)

    look_up_form = LookUpLexiconItemForm()
    lexicon_item_form = polulate_lexicon_item_form_by_lookup(frames_dict, citation_dict, look_up_inflected, look_up_lemma)

    if look_up_form.validate_on_submit() and (look_up_form.inflected_form.data or look_up_form.lemma_form.data): # if click on look up button
        look_up_inflected = look_up_form.inflected_form.data
        look_up_lemma = look_up_form.lemma_form.data
        return redirect(
            url_for('main.lexiconupdate', doc_id=doc_id, look_up_inflected=look_up_inflected, look_up_lemma=look_up_lemma, snt_id=snt_id))

    if lexicon_item_form.add_inflected.data: #clicked on Add New Inflected Form Field button
        getattr(lexicon_item_form, 'inflected_forms').append_entry()
        return render_template('lexicon.html', doc_id=doc_id, filename=doc.filename, lang=doc.lang,
                               file_format=doc.file_format, lexicon_item_form=lexicon_item_form,
                               look_up_form=look_up_form,
                               frames_dict=json.dumps(frames_dict), citation_dict=json.dumps(citation_dict),
                               snt_id=snt_id, look_up_lemma=look_up_lemma)

    if lexicon_item_form.add_sense.data:#clicked on Add New Inflected Form Field button
        getattr(lexicon_item_form, 'senses').append_entry()
        return render_template('lexicon.html', doc_id=doc_id, filename=doc.filename, lang=doc.lang,
                               file_format=doc.file_format, lexicon_item_form=lexicon_item_form,
                               look_up_form=look_up_form,
                               frames_dict=json.dumps(frames_dict), citation_dict=json.dumps(citation_dict),
                               snt_id=snt_id, look_up_lemma=look_up_lemma)

    if not look_up_form.inflected_form.data and not look_up_form.lemma_form.data: #if lookup form is empty
        if lexicon_item_form.validate_on_submit() and lexicon_item_form.lemma.data: # if click on save and lemma in form is not empty
            # this is entry to be added in frame_dict
            new_lexicon_entry = {lexicon_item_form.lemma.data: {"root": lexicon_item_form.root.data,
                                                                "pos": lexicon_item_form.pos.data,
                                                                "inflected_forms": [element['inflected_form'] for element in lexicon_item_form.inflected_forms.data if element['inflected_form'] != ""],
                                                                "sense": lexicon_item_form.senses.data
                                                                }
                                 }
            if lexicon_item_form.update_mode.data == 'edit':
                try:
                    del frames_dict[look_up_lemma]
                    frames_dict.update(new_lexicon_entry)
                    flash('This entry is edited and saved successfully', 'success')
                except KeyError:
                    flash('This entry is not in lexicon yet, use "add new entry" mode instead of "edit current entry" mode', 'danger')
            elif lexicon_item_form.update_mode.data == 'add':
                frames_dict.update(new_lexicon_entry) # todo deal with homonym case: automatically number those hymonym lemmas
                flash('This entry is added and saved successfully', 'success')
            elif lexicon_item_form.update_mode.data == 'delete':
                del frames_dict[lexicon_item_form.lemma.data]
                flash('This entry is deleted and saved successfully', 'success')

            # update citation_dict as well
            citation_dict = {inflected_form: lemma for lemma in frames_dict for inflected_form in frames_dict[lemma]["inflected_forms"]}

            #add to database
            existing_lexicon = Lexicon.query.filter_by(lang=doc.lang).first()
            if existing_lexicon:
                existing_lexicon.lexi = frames_dict
                db.session.commit()
            else:
                lexicon_row = Lexicon(lang=doc.lang, lexi=new_lexicon_entry)
                db.session.add(lexicon_row)
                db.session.commit()

    autocomplete_lemmas = list(citation_dict.values())
    return render_template('lexicon.html', doc_id=doc_id, filename=doc.filename, lang=doc.lang,
                           file_format=doc.file_format, lexicon_item_form=lexicon_item_form,
                           look_up_form=look_up_form,
                           frames_dict=json.dumps(frames_dict), citation_dict=json.dumps(citation_dict),
                           snt_id=snt_id, look_up_lemma=look_up_lemma, autocomplete_lemmas=json.dumps(autocomplete_lemmas))

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
