from flask import url_for, redirect, flash, send_from_directory, make_response, jsonify
from werkzeug.utils import secure_filename
from typing import List, Tuple
import json
from parse_input_xml import html, process_exported_file, parse_lexicon_xml
from flask_login import current_user
import os

from flask import render_template, request, Blueprint
from umr_annot_tool import db
from umr_annot_tool.models import Sent, Doc, Annotation, User, Post, Lexicon
from umr_annot_tool.main.forms import UploadForm, UploadLexiconForm, LexiconItemForm, LookUpLexiconItemForm, \
    InflectedForm, SenseForm
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.ext.mutable import MutableDict

import time
from suggest_sim_words import generate_candidate_list, find_suggested_words

main = Blueprint('main', __name__)
FRAME_FILE_ENGLISH = "umr_annot_tool/resources/frames-arg_descriptions.json"
FRAME_FILE_CHINESE = 'umr_annot_tool/resources/frames_chinese.json'

add_num_inflected = 0
add_num_sense = 0

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
            sent_annots=None, doc_annots=None, aligns=None) -> None:
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
                  file_format=file_format)
        db.session.add(doc)
        db.session.commit()
        doc_id = doc.id
        flash('Your doc has been created!', 'success')
        for sent_of_tokens in sents:
            sent = Sent(content=" ".join(sent_of_tokens), doc_id=doc.id, user_id=current_user.id)
            db.session.add(sent)
            db.session.commit()
        flash('Your sents has been created.', 'success')

    if has_annot:
        print("sents from annot: ", sents)
        for i in range(len(sents)):
            existing = Annotation.query.filter(Annotation.sent_id == i + 1, Annotation.doc_id == doc_id,
                                               Annotation.user_id == current_user.id).first()
            if existing:  # update the existing Annotation object
                print("updating existing annotation")
                existing.annot_str = sent_annots[i]
                existing.doc_annot = doc_annots[i]
                existing.alignment = aligns[i]
                db.session.commit()
            else:
                print('sent_annots from sent level: ', sent_annots)
                print('doc_annots from sent level: ', doc_annots)
                print('aligns from sent level: ', aligns)
                annotation = Annotation(annot_str=sent_annots[i], doc_annot=doc_annots[i], alignment=aligns[i],
                                        author=current_user,
                                        sent_id=i + 1,
                                        doc_id=doc_id,
                                        umr={}, doc_umr={})
                db.session.add(annotation)
                db.session.commit()
        flash('Your annotations has been created.', 'success')


@main.route("/upload", methods=['GET', 'POST'])
def upload():
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))

    form = UploadForm()
    lexicon_form = UploadLexiconForm()
    if form.validate_on_submit():
        if form.file.data and form.file.data.filename:
            content_string = form.file.data.read().decode("utf-8")  # print("content_string: ", content_string)
            filename = secure_filename(form.file.data.filename)  # print('filename: ', filename)
            file_format = form.file_format.data  # print('file_format: ', file_format)
            lang = form.language_mode.data  # print('lang: ', lang)
            is_exported = form.if_exported.data
            if is_exported:  # has annotation
                new_content_string, sents, sent_annots, doc_annots, aligns, new_user_id, new_lang = process_exported_file(
                    content_string)
                file2db(filename=filename, file_format=file_format, content_string=new_content_string, lang=lang,
                        sents=sents, has_annot=True, sent_annots=sent_annots, doc_annots=doc_annots, aligns=aligns)
            else:  # doesn't have annotation
                info2display = html(content_string, file_format)  # print('sents from upload:', sents)
                file2db(filename=filename, file_format=file_format, content_string=content_string, lang=lang,
                        sents=info2display.sents, has_annot=False)
            return redirect(url_for('main.annotate',
                                    doc_id=Doc.query.filter_by(filename=filename, user_id=current_user.id).first().id))
        else:
            flash('Please upload a file and/or choose a language.', 'danger')
    if lexicon_form.validate_on_submit():
        if lexicon_form.file.data:
            content_string = form.file.data.read().decode("utf-8")  # print("content_string: ", content_string)
            frames_dict = parse_lexicon_xml(content_string)
            print("frames_dict:", frames_dict)
            lexicon2db(lang=lexicon_form.language_mode.data, lexicon_dict=frames_dict)
            return redirect(url_for('users.account'))
        else:
            flash("please upload a lexicon file.", "danger")

    return render_template('upload.html', title='upload', form=form, lexicon_form=lexicon_form)


@main.route("/annotate/<int:doc_id>", methods=['GET', 'POST'])
def annotate(doc_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    doc = Doc.query.get_or_404(doc_id)
    info2display = html(doc.content, doc.file_format)
    frame_dict = {}
    if doc.lang == "chinese":
        frame_dict = json.load(open(FRAME_FILE_CHINESE, "r"))
    elif doc.lang == "english":
        frame_dict = json.load(open(FRAME_FILE_ENGLISH, "r"))
    else:
        try:
            frame_dict = Lexicon.query.filter_by(lang=doc.lang).first().lexi
        except AttributeError:
            frame_dict = {}

    snt_id = int(request.args.get('snt_id', 1))
    if "set_sentence" in request.form:
        snt_id = int(request.form["sentence_id"])

    if request.method == 'POST':
        # add to db
        try:
            amr_html = request.get_json(force=True)["amr"]
            amr_html = amr_html.replace('<span class="text-success">', '')  # get rid of the head highlight tag
            amr_html = amr_html.replace('</span>', '')
            align_info = request.get_json(force=True)["align"]
            snt_id_info = request.get_json(force=True)["snt_id"]
            umr_dict = request.get_json(force=True)["umr"]

            existing = Annotation.query.filter(Annotation.sent_id == snt_id_info, Annotation.doc_id == doc_id,
                                               Annotation.user_id == current_user.id).first()
            if existing:  # update the existing Annotation object
                existing.annot_str = amr_html
                existing.alignment = align_info
                existing.umr = umr_dict
                flag_modified(existing, 'umr')
                db.session.commit()
            else:
                annotation = Annotation(annot_str=amr_html, doc_annot='', alignment=align_info, author=current_user,
                                        sent_id=snt_id_info,
                                        doc_id=doc_id,
                                        umr=umr_dict, doc_umr={})
                flag_modified(annotation, 'umr')
                db.session.add(annotation)
                db.session.commit()
            msg = 'Success: current annotation and alignments are added to database.'
            msg_category = 'success'
            print(msg)
            return make_response(jsonify({"msg": msg, "msg_category": msg_category}), 200)

        except:
            msg = 'Failure: Add current annotation and alignments to database failed.'
            msg_category = 'danger'
            print(msg)

    # load single annotation for current sentence from db used for load_history()
    try:
        curr_sent_annot = Annotation.query.filter(Annotation.sent_id == snt_id, Annotation.doc_id == doc_id,
                                                  Annotation.user_id == current_user.id).first().annot_str.replace("\n",
                                                                                                                   "")
    except:
        curr_sent_annot = ""
    try:
        curr_sent_align = Annotation.query.filter(Annotation.sent_id == snt_id, Annotation.doc_id == doc_id,
                                                  Annotation.user_id == current_user.id).first().alignment.replace("\n",
                                                                                                                   "")
    except:
        curr_sent_align = ""

    try:
        curr_sent_umr = Annotation.query.filter(Annotation.sent_id == snt_id, Annotation.doc_id == doc_id,
                                                Annotation.user_id == current_user.id).first().umr
    except:
        curr_sent_umr = {}

    # load all annotations for current document used for export_annot()
    annotations = Annotation.query.filter(Annotation.doc_id == doc_id, Annotation.user_id == current_user.id).order_by(
        Annotation.sent_id).all()
    filtered_sentences = Sent.query.filter(Sent.doc_id == doc_id, Sent.user_id == current_user.id).all()
    all_annots = [annot.annot_str for annot in annotations]
    all_aligns = [annot.alignment for annot in annotations]
    all_doc_annots = [annot.doc_annot for annot in annotations]
    all_sents = [sent2.content for sent2 in filtered_sentences]
    exported_items = [list(p) for p in zip(all_sents, all_annots, all_aligns, all_doc_annots)]

    return render_template('sentlevel.html', lang=doc.lang, filename=doc.filename, snt_id=snt_id, doc_id=doc_id,
                           info2display=info2display,
                           frame_dict=json.dumps(frame_dict),
                           curr_sent_align=curr_sent_align, curr_sent_annot=curr_sent_annot,
                           curr_sent_umr=curr_sent_umr,
                           exported_items=exported_items,
                           file_format=doc.file_format,
                           content_string=doc.content.replace('\n', '<br>'), )


@main.route("/doclevel/<int:doc_id>", methods=['GET', 'POST'])
def doclevel(doc_id):
    if not current_user.is_authenticated:
        return redirect(url_for('users.login'))
    current_snt_id = 1
    if "set_sentence" in request.form:
        current_snt_id = int(request.form["sentence_id"])

    # add to db
    if request.method == 'POST':
        try:
            umr_html = request.get_json(force=True)["umr"]
            print("umr_html: ", umr_html)
            snt_id_info = request.get_json(force=True)["snt_id"]
            print("snt_id_info:", snt_id_info)
            umr_dict = request.get_json(force=True)["umr_dict"]
            existing = Annotation.query.filter(Annotation.sent_id == snt_id_info, Annotation.doc_id == doc_id,
                                               Annotation.user_id == current_user.id).first()
            if existing:  # update the existing Annotation object
                print("updating existing annotation")
                existing.doc_annot = umr_html
                existing.doc_umr = umr_dict
                db.session.commit()
            else:
                print("the sent level annotation of the current sent doesn't exist")
            return {"umr": umr_html}
        except:
            print("add doc level annotation to database failed")

    doc = Doc.query.get_or_404(doc_id)
    sents = Sent.query.filter(Sent.doc_id == doc.id, Sent.user_id == current_user.id).order_by(Sent.id).all()
    annotations = Annotation.query.filter(Annotation.doc_id == doc.id, Annotation.user_id == current_user.id).order_by(
        Annotation.sent_id).all()

    print('doc content from doc level: ', doc.content)

    if doc.file_format == 'plain_text':
        sent_annot_pairs = list(zip(sents, annotations))
        print('sents in doclevel: ', sents)
        print('annotations in doclevel: ', annotations)
    else:
        _, sents_html, sent_htmls, df_html, gls, notes = html(doc.content, doc.file_format)
        sent_annot_pairs = list(zip(df_html, annotations))

    print("sent_annot_pairs: ", sent_annot_pairs)

    # print(annotations[0].annot_str)
    # print(annotations[1].annot_str)
    #
    # sent, annot = sent_annot_pairs[0]
    # print("*********")
    # print('sent: ', sent.content)
    # print('annot: ', annot.annot_str)
    # sent2, annot2 = sent_annot_pairs[1]
    # print("*********")
    # print('sent: ', sent2.content)
    # print('annot: ', annot2.annot_str)

    try:
        current_sent_pair = sent_annot_pairs[current_snt_id - 1]
    except IndexError:
        flash('You have not created sentence level annotation yet', 'danger')
        return redirect(url_for('main.annotate', doc_id=doc_id))

    # print("doc_annot: ", sent_annot_pairs[current_snt_id - 1][1].doc_annot)
    # print("doc_umr: ", sent_annot_pairs[current_snt_id - 1][1].doc_umr)
    # print("current_sent_table: ", sent_annot_pairs[current_snt_id-1][0])
    # print("current_snt_id: ", current_snt_id)

    # load all annotations for current document used for export_annot()
    all_annots = [annot.annot_str for annot in annotations]
    print("all_annots: ", all_annots)
    all_aligns = [annot.alignment for annot in annotations]
    print("all_aligns: ", all_aligns)
    all_doc_annots = [annot.doc_annot for annot in annotations]
    print("all_doc_annots: ", all_doc_annots)
    all_sents = [sent2.content for sent2 in sents]
    print("all_sents: ", all_sents)
    all_sent_umrs = [annot.umr for annot in annotations]
    exported_items = [list(p) for p in zip(all_sents, all_annots, all_aligns, all_doc_annots)]
    print("exported_items: ", exported_items)

    return render_template('doclevel.html', doc_id=doc_id, sent_annot_pairs=sent_annot_pairs, filename=doc.filename,
                           title='Doc Level Annotation', current_snt_id=current_snt_id,
                           current_sent_pair=current_sent_pair, exported_items=exported_items, lang=doc.lang,
                           file_format=doc.file_format,
                           content_string=doc.content.replace('\n', '<br>'),
                           all_sent_umrs=all_sent_umrs)


@main.route("/about")
def about():
    return render_template('about.html', title='About')

def get_lexicon_dicts(doc):
    try:
        frames_dict = Lexicon.query.filter_by(lang=doc.lang).first().lexi
    except AttributeError:
        frames_dict = {}

    frames_dict["ehlhlakama"]["inflected_forms"] = ['madeupword1', 'madeupword2'] # todo: line to be deleted, just for testing purpose
    citation_dict = {inflected_form: lemma for lemma in frames_dict for inflected_form in
                     frames_dict[lemma]["inflected_forms"]}

    print("in routes.lexicon: ", frames_dict)
    print("in routes.lexicon: ", citation_dict)
    return frames_dict, citation_dict

def fill_lexicon_item_form(frames_dict, citation_dict, look_up_inflected, look_up_lemma):
    lexicon_item_form = LexiconItemForm() #this is not always empty
    if not lexicon_item_form.lemma.data: # the following only happens when trying to lookup the first time
        lexicon_item = {}
        if look_up_inflected:
            look_up_lemma = citation_dict.get(look_up_inflected, "")
            lexicon_item = frames_dict.get(look_up_lemma, json.loads("{}"))
        elif look_up_lemma:
            lexicon_item = frames_dict.get(look_up_lemma, json.loads("{}"))

        print("lexicon item: ", json.dumps(lexicon_item))

        lexicon_item_form.lemma.data = look_up_lemma #assigned ehl to ehl-00 here
        lexicon_item_form.root.data = lexicon_item.get('root', '')
        lexicon_item_form.pos.data = lexicon_item.get('pos', '')

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

        for i in range(add_num_inflected):
            entry = InflectedForm()
            entry.inflected_form = ""
            lexicon_item_form.inflected_forms.append_entry(entry)

        for i in range(add_num_sense):
            entry = SenseForm()
            entry.gloss = ""
            entry.args = ""
            entry.coding_frames = ""
            lexicon_item_form.senses.append_entry(entry)

    return lexicon_item_form


@main.route("/lexiconupdate/<doc_id>", methods=['GET', 'POST'])
def lexiconupdate(doc_id):
    doc = Doc.query.get_or_404(doc_id)
    snt_id = int(request.args.get('snt_id', 1))
    look_up_inflected = request.args.get('look_up_inflected', None)
    look_up_lemma = request.args.get('look_up_lemma', None)

    # generate the suggested inflected and lemma list
    if request.method == 'POST':
        try:
            selected_word = request.get_json(force=True)['selected_word']
            word_candidates = generate_candidate_list(doc.content, doc.file_format)
            similar_word_list = find_suggested_words(word=selected_word, word_candidates=word_candidates)
            res = make_response(jsonify({"similar_word_list": similar_word_list}), 200)

            print("selected_word:", selected_word)
            print("similar_word_list: ", similar_word_list)
            return res
        except:
            print("no word selected")

    frames_dict, citation_dict = get_lexicon_dicts(doc)
    lexicon_item_form = fill_lexicon_item_form(frames_dict, citation_dict, look_up_inflected, look_up_lemma)
    look_up_form = LookUpLexiconItemForm()

    if not look_up_form.inflected_form.data and not look_up_form.lemma_form.data: #if lookup form is empty
        if lexicon_item_form.validate_on_submit() and lexicon_item_form.lemma.data:
            print("lexicon_time_form from lexiconupdate: ", json.dumps(lexicon_item_form.data))
            new_lexicon_entry = {lexicon_item_form.lemma.data: {"root": lexicon_item_form.root.data,
                                                                "pos": lexicon_item_form.pos.data,
                                                                "inflected_forms": [element['inflected_form'] for element in lexicon_item_form.inflected_forms.data if element['inflected_form'] != ""],
                                                                "sense": lexicon_item_form.senses.data
                                                                }
                                 }
            if lexicon_item_form.update_mode.data == 'edit':
                del frames_dict[look_up_lemma]
                frames_dict.update(new_lexicon_entry)
            elif lexicon_item_form.update_mode.data == 'add':
                frames_dict.update(new_lexicon_entry) # todo deal with homonym case
            elif lexicon_item_form.update_mode.data == 'delete':
                del frames_dict[lexicon_item_form.lemma.data]

            citation_dict = {inflected_form: lemma for lemma in frames_dict for inflected_form in
                                 frames_dict[lemma]["inflected_forms"]}


            existing_lexicon = Lexicon.query.filter_by(lang=doc.lang).first()
            print(type(existing_lexicon.lexi))
            print("existing_lexicon.lexi: ", existing_lexicon.lexi)

            if existing_lexicon:
                print("here1: ", new_lexicon_entry)
                existing_lexicon.lexi = frames_dict
                db.session.commit()
            else:
                print("here2: ", new_lexicon_entry)
                lexicon_row = Lexicon(lang=doc.lang, lexi=new_lexicon_entry)
                db.session.add(lexicon_row)
                db.session.commit()

    if look_up_form.validate_on_submit() and (look_up_form.inflected_form.data or look_up_form.lemma_form.data):
        look_up_inflected = look_up_form.inflected_form.data
        look_up_lemma = look_up_form.lemma_form.data
        return redirect(
            url_for('main.lexiconupdate', doc_id=doc_id, look_up_inflected=look_up_inflected, look_up_lemma=look_up_lemma, snt_id=snt_id))

    return render_template('lexicon.html', doc_id=doc_id, filename=doc.filename, lang=doc.lang,
                           file_format=doc.file_format, lexicon_item_form=lexicon_item_form,
                           look_up_form=look_up_form,
                           frames_dict=json.dumps(frames_dict), citation_dict=json.dumps(citation_dict),
                           snt_id=snt_id, look_up_lemma=look_up_lemma)

@main.route("/lexiconmodify/<doc_id>", methods=['GET', 'POST'])
def lexiconmodify(doc_id):
    doc = Doc.query.get_or_404(doc_id)
    snt_id = int(request.args.get('snt_id', 1))
    look_up_inflected = request.args.get('look_up_inflected', None)
    look_up_lemma = request.args.get('look_up_lemma', None)
    print("snt_id from lexiconmodify: ", snt_id)
    print("look_up_lemma from lexiconmodify: ", look_up_lemma)
    print("look_up_inflected from lexiconmodify: ", look_up_inflected)

    frames_dict, citation_dict = get_lexicon_dicts(doc)
    lexicon_item_form = fill_lexicon_item_form(frames_dict, citation_dict, look_up_inflected, look_up_lemma)
    look_up_form = LookUpLexiconItemForm()

    if request.args.get('add_sense_box'):
        global add_num_sense
        # add_num_sense += 1
        print("I am here at lexiconmodify add sense: ", add_num_sense)
        return redirect(url_for('main.lexiconupdate', doc_id=doc_id, look_up_inflected=look_up_inflected, look_up_lemma=look_up_lemma, snt_id=snt_id))

    if request.args.get('add_inflected_box'):
        global add_num_inflected
        # add_num_inflected += 1
        print("I am here at lexiconmodify add inflected: ", add_num_inflected)
        return redirect(url_for('main.lexiconupdate', doc_id=doc_id, look_up_inflected=look_up_inflected, look_up_lemma=look_up_lemma, snt_id=snt_id))

    return render_template('lexicon.html', doc_id=doc_id, filename=doc.filename, lang=doc.lang,
                           file_format=doc.file_format, lexicon_item_form=lexicon_item_form,
                           look_up_form=look_up_form,
                           frames_dict=json.dumps(frames_dict), citation_dict=json.dumps(citation_dict),
                           snt_id=snt_id, look_up_lemma=look_up_lemma)

@main.route("/lexiconlookup/<doc_id>", methods=['GET', 'POST'])
def lexiconlookup(doc_id): # this route is kind of used to always clear out the look up form after redirect to lexiconupdate route, I know it's weird, but haven't found a workaround yet
    snt_id = int(request.args.get('snt_id', 1))
    doc = Doc.query.get_or_404(doc_id)
    if request.method == 'POST':
        try:
            selected_word = request.get_json(force=True)['selected_word']
            word_candidates = generate_candidate_list(doc.content, doc.file_format)
            similar_word_list = find_suggested_words(word=selected_word, word_candidates=word_candidates)
            res = make_response(jsonify({"similar_word_list": similar_word_list}), 200)
            print("selected_word:", selected_word)
            print("similar_word_list: ", similar_word_list)
            return res
        except:
            print("no word selected")

    lexicon_item_form = LexiconItemForm()
    look_up_form = LookUpLexiconItemForm()

    if look_up_form.validate_on_submit() and (look_up_form.inflected_form.data or look_up_form.lemma_form.data):
        look_up_inflected = look_up_form.inflected_form.data
        look_up_lemma = look_up_form.lemma_form.data
        return redirect(
            url_for('main.lexiconshow', doc_id=doc_id, look_up_inflected=look_up_inflected, look_up_lemma=look_up_lemma, snt_id=snt_id))

    return render_template('lexicon.html', doc_id=doc_id, filename=doc.filename, lang=doc.lang,
                           file_format=doc.file_format, lexicon_item_form=lexicon_item_form,
                           look_up_form=look_up_form,
                           frames_dict={}, citation_dict={},
                           snt_id=snt_id, look_up_lemma=look_up_form.lemma_form.data)




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
