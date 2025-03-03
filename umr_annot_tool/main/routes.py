import sqlalchemy.exc
from flask import url_for, redirect, flash, make_response, jsonify, send_file, render_template, request, abort, send_from_directory, current_app
from werkzeug.utils import secure_filename
from typing import List, Tuple, Optional, Dict
import json
from umr_annot_tool.main.umr_parser import parse_umr_file
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
            # Get the language value
            language = form.language.data
            if language == 'other' and form.custom_language.data:
                language = form.custom_language.data.strip()
            elif language == 'other' and not form.custom_language.data:
                flash('Please enter a custom language name', 'danger')
                return redirect(url_for('main.new_project'))
                
            project = Project(
                project_name=form.projectname.data,
                language=language,
                created_by_user_id=current_user.id
            )
            db.session.add(project)

            user_project = Projectuser(
                project_name=form.projectname.data,
                user_id=current_user.id,
                permission="admin",
                project_id=project.id
            )
            db.session.add(user_project)

            lattice = Lattice(project_id=project.id,
                            data = {
                              "aspect":{"Habitual": True, "Imperfective": True, "Process": True, "Atelic Process": True, "Perfective": True, "State": True, "Activity": True, "Endeavor": True, "Performance": True, "Reversible State": True, "Irreversible State": True, "Inherent State": True, "Point State": True, "Undirected Activity": True, "Directed Activity": True, "Semelfactive": True, "Undirected Endeavor": True, "Directed Endeavor": True, "Incremental Accomplishment": True, "Nonincremental Accomplishment": True, "Directed Achievement": True, "Reversible Directed Achievement": True, "Irreversible Directed Achievement": True},
                              "person":{"person": True, "non-3rd": True, "non-1st": True, "1st": True, "2nd": True, "3rd": True, "incl.": True, "excl.": True},
                              "number":{"Singular": True, "Non-singular": True, "Paucal": True, "Plural": True, "Dual": True, "Non-dual Paucal": True, "Greater Plural": True, "Trial": True, "Non-trial Paucal": True},
                              "modal":{"Non-NeutAff": True, "Non-FullAff": True, "Non-NeutNeg": True, "Non-FullNeg": True, "FullAff": True, "PrtAff": True, "NeutAff": True, "FullNeg": True, "PrtNeg": True, "NeutNeg": True, "Strong-PrtAff": True, "Weak-PrtAff": True, "Strong-NeutAff": True, "Weak-NeutAff": True, "Strong-PrtNeg": True, "Weak-PrtNeg": True, "Strong-NeutNeg": True, "Weak-NeutNeg": True},
                              "discourse":{"or": True, "and+but": True, "inclusive-disj": True, "exclusive-disj": True, "and+unexpected": True, "and+contrast": True, "but": True, "and": True, "consecutive": True, "additive": True, "unexpected-co-occurrence": True, "contrast-01": True, ":subtraction": True}
                            }
                        )
            db.session.add(lattice)
            pg = Partialgraph(project_id=project.id, partial_umr={})
            db.session.add(pg)
            lexi = Lexicon(project_id=project.id, data={})
            db.session.add(lexi)
            db.session.commit()

            flash(f'Project "{form.projectname.data}" has been created with language "{language}".', 'success')
        except sqlalchemy.exc.IntegrityError:
            flash(f'Name "{form.projectname.data}" already exists, choose another one')
            return redirect(url_for('main.new_project'))

        return redirect(url_for('users.account'))
    return render_template('new_project.html', form=form, title='create project')


def handle_file_upload(form_file, current_project_id):
    """Reads content from uploaded UMR file and processes it."""
    print("Starting handle_file_upload function")
    print(f"Uploaded file: {form_file.filename}")
    
    # Validate project access
    valid, project = validate_project_access(current_project_id)
    if not valid:
        return False
    
    try:
        # Read and decode file content
        content = form_file.read().decode('utf-8')
        print(f"Successfully read file content, length: {len(content)}")
        
        # Parse file content
        try:
            doc_content_string, sents, sent_annots, doc_annots, aligns = parse_umr_file(content)
            print(f"File parsed successfully:")
            print(f"Number of sentences: {len(sents)}")
            print(f"Number of sent_annots: {len(sent_annots) if sent_annots else 0}")
            print(f"Number of doc_annots: {len(doc_annots) if doc_annots else 0}")
            print(f"Number of alignments: {len(aligns) if aligns else 0}")
            
        except Exception as e:
            print(f"Error parsing file content: {str(e)}")
            import traceback
            print("Full traceback:")
            print(traceback.format_exc())
            flash('Error parsing file content', 'danger')
            return False
        
        # Create document in database
        try:
            print("Starting to create document in database")
            doc_id = file2db(
                filename=form_file.filename,
                content_string=content,
                lang='english',
                sents=sents,
                file_format='umr',
                current_project_id=current_project_id,
                current_user_id=current_user.id,
                sent_annots=sent_annots,
                doc_annots=doc_annots,
                aligns=aligns
            )
            print(f"Document created successfully with ID: {doc_id}")
            return True
            
        except Exception as e:
            print(f"Error creating document in database: {str(e)}")
            import traceback
            print("Full traceback:")
            print(traceback.format_exc())
            flash('Error creating document in database', 'danger')
            return False
            
    except Exception as e:
        print(f"Error reading file: {str(e)}")
        flash('Error reading file', 'danger')
        return False


@main.route("/upload_document/<int:current_project_id>", methods=['GET', 'POST'])
@login_required
def upload_document(current_project_id):
    print("Entering upload_document route")
    print(f"Method: {request.method}")
    
    form = UploadForm()
    
    if form.validate_on_submit():
        print("Form validated")
        if form.files.data:
            form_file = form.files.data[0]  # Get the first file
            print(f"Got file: {form_file.filename}")
            
            if form_file.filename == '':
                print("Empty filename")
                flash('No file selected', 'danger')
                return redirect(request.url)
                
            if not form_file.filename.endswith('.umr'):
                print("Invalid file extension")
                flash('Only .umr files are allowed', 'danger')
                return redirect(request.url)
                
            print("About to call handle_file_upload")
            if handle_file_upload(form_file, current_project_id):
                print("handle_file_upload succeeded")
                flash('Your file has been uploaded!', 'success')
                return redirect(url_for('users.account'))

        else:
            print("No file in form.files.data")
            flash('No file selected', 'danger')
            return redirect(request.url)
            
    elif request.method == 'POST':
        print("Form validation failed")
        for field, errors in form.errors.items():
            for error in errors:
                flash(f'Error in {field}: {error}', 'danger')
                print(f'Error in {field}: {error}')
            
    print("Rendering upload form")
    return render_template('upload_document.html', title='Upload Document', form=form)

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

@main.route("/sentlevel/<string:doc_sent_id>", methods=['GET', 'POST'])
def sentlevel(doc_sent_id):
    """Handle sentence-level annotation view and updates."""
    pass


@main.route("/doclevel/<string:doc_sent_id>", methods=['GET', 'POST'])
def doclevel(doc_sent_id):
    """Handle document-level annotation view and updates."""
    pass

@main.route("/sentlevelview/<string:doc_sent_id>", methods=['GET', 'POST'])
def sentlevelview(doc_sent_id):
    pass
@main.route("/doclevelview/<string:doc_sent_id>", methods=['GET', 'POST'])
def doclevelview(doc_sent_id):
    pass

@main.route("/about")
def about():
    return render_template('about.html', title='About')

@main.route("/guide")
def guidelines():
    return render_template('user_guide.html')



def validate_project_access(project_id: int, required_permission: str = None) -> Tuple[bool, Optional[Project]]:
    """Validate user's access to a project."""
    if not current_user.is_authenticated:
        flash('Please log in to access this page', 'warning')
        return False, None
        
    project = Project.query.get_or_404(project_id)
    if not project:
        flash('Project not found', 'danger')
        return False, None
        
    project_user = Projectuser.query.filter_by(
        user_id=current_user.id,
        project_id=project_id
    ).first()
    
    if not project_user:
        flash('You do not have access to this project', 'danger')
        return False, None
        
    if required_permission and project_user.permission != required_permission:
        flash(f'You need {required_permission} permission for this action', 'warning')
        return False, None
        
    return True, project

def get_document_info(doc_id: int) -> Tuple[Optional[Doc], List[Sent], List[Annotation]]:
    """Get document and its related data."""
    doc = Doc.query.get_or_404(doc_id)
    if not doc:
        return None, [], []
        
    sentences = Sent.query.filter_by(doc_id=doc_id).order_by(Sent.id).all()
    annotations = Annotation.query.filter_by(doc_id=doc_id).order_by(Annotation.sent_id).all()
    
    return doc, sentences, annotations

def handle_annotation_update(annotation: Annotation, data: Dict) -> bool:
    """Update annotation with new data."""
    pass

def get_project_stats(project_id: int) -> Dict:
    """Get statistics for a project."""
    docs = Doc.query.filter_by(project_id=project_id).all()
    stats = {
        'doc_count': len(docs),
        'sent_count': 0,
        'token_count': 0,
        'annotated_docs': set(),
        'annotated_sent_count': 0,
        'annotated_concept_count': 0
    }
    
    for doc in docs:
        sents = Sent.query.filter_by(doc_id=doc.id).all()
        stats['sent_count'] += len(sents)
        stats['token_count'] += sum(len(sent.content.split()) for sent in sents)
        
        annotations = Annotation.query.filter_by(doc_id=doc.id).all()
        for annot in annotations:
            if len(annot.sent_annot) > len('<div id="amr"></div>'):
                stats['annotated_sent_count'] += 1
                stats['annotated_docs'].add(doc.id)
                stats['annotated_concept_count'] += sum(1 for k in annot.sent_umr if k.endswith(".c"))
                
    stats['annotated_doc_count'] = len(stats['annotated_docs'])
    del stats['annotated_docs']  # Remove set before returning
    
    return stats

@main.route("/annotate/<int:doc_id>/<int:current_snt_id>/<int:owner_id>", methods=['GET', 'POST'])
def annotate(doc_id, current_snt_id, owner_id):
    # ... existing code ...
    
    # Replace html() call with get_display_info()
    info2display = get_display_info(doc.content, doc.file_format, lang=doc.lang)
    
    # ... rest of the function ...