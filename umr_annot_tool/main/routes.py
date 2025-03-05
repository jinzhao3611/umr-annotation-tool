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
from umr_annot_tool.models import Sent, Doc, Annotation, User, Post, Lexicon, Projectuser, Project, Lattice, Partialgraph, DocVersion
from umr_annot_tool.main.forms import UploadForm, UploadLexiconForm, LexiconItemForm, LookUpLexiconItemForm, \
    InflectedForm, SenseForm, CreateProjectForm, LexiconAddForm

# Create logs directory if it doesn't exist
os.makedirs('logs', exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/umr_annotation.log'),
        logging.StreamHandler()  # This will also print to console
    ]
)
logger = logging.getLogger(__name__)

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
            db.session.commit()  # Commit the project first to get its ID

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
            db.session.rollback()  # Rollback any changes if there's an error
            flash(f'Name "{form.projectname.data}" already exists, choose another one')
            return redirect(url_for('main.new_project'))

        return redirect(url_for('users.account'))
    return render_template('new_project.html', form=form, title='create project')

def check_user_permission(current_project_id):
    """Check if the current user has permission to upload documents to the project."""
    # Get the project
    project = Projectuser.query.filter_by(project_id=current_project_id, user_id=current_user.id).first().permission
    if project == 'admin':
        return True
    else:
        return False

def file2db(filename:str, sents:List[str], current_project_id:int, current_user_id:int, sent_annots:List[str], doc_annots:List[str], aligns:List[Dict[str, List[str]]]):
    """Reads content from uploaded UMR file and commits the data to the database."""
    try:
        doc_entry = Doc(
            filename=filename,
            user_id = current_user_id,
            project_id = current_project_id
        )
        db.session.add(doc_entry)
        doc_version_entry = DocVersion(
            doc= doc_entry,
            user_id = current_user_id,
            stage = 'initial',
        )
        db.session.add(doc_version_entry)
        for sent_annot, doc_annot, align, sent in zip(sent_annots, doc_annots, aligns, sents):
            sent_entry = Sent(
                content = " ".join(sent),
                doc = doc_entry
            )
            db.session.add(sent_entry)
            # If align is None, treat it as empty
            if align is None:
                align = {}
            # If align is a string, decide how to parse
            elif isinstance(align, str):
                # Trim whitespace
                trimmed = align.strip()
                if trimmed:
                    # Attempt to parse JSON
                    try:
                        align = json.loads(trimmed)
                    except json.JSONDecodeError:
                        # align was not valid JSON, handle or fallback
                        logger.info("DEBUG: Invalid JSON, using empty dict")
                        logger.info(f"Alignment type: {type(align)}")
                        logger.info(f"Alignment content: {align}")
                        align = {}
                else:
                    logger.info("DEBUG: Empty alignment string")
                    logger.info(f"Alignment type: {type(align)}")
                    logger.info(f"Alignment content: {align}")
                    align = {}
            annotation_entry = Annotation(
                sent_annot=sent_annot,
                doc_annot=doc_annot,
                alignment=align,
                doc_version=doc_version_entry,
                sent=sent_entry
            )
            db.session.add(annotation_entry)
        db.session.commit()
        return doc_entry.id
    except Exception as e:
        logging.error(f"Error creating document in database: {str(e)}")
        import traceback
        logging.error("Full traceback:")
        logging.error(traceback.format_exc())
        flash('Error creating document in database', 'danger')
        return None

    

def handle_file_upload(form_file, current_project_id):
    """Reads content from uploaded UMR file and processes it."""
    logger.info("Starting handle_file_upload function")
    logger.info(f"Uploaded file: {form_file.filename}")
    
    try:
        # Read and decode file content
        content = form_file.read().decode('utf-8')
        logger.info(f"Successfully read file content, length: {len(content)}")
        
        # Parse file content
        try:
            sents, sent_annots, doc_annots, aligns = parse_umr_file(content)
            logger.info(f"File parsed successfully:")
            logger.info(f"Number of sentences: {len(sents)}")
            logger.info(f"Number of sent_annots: {len(sent_annots) if sent_annots else 0}")
            logger.info(f"Number of doc_annots: {len(doc_annots) if doc_annots else 0}")
            logger.info(f"Number of alignments: {len(aligns) if aligns else 0}")
            logger.info(f"type of alignment: {type(aligns[0])}")
            logger.info(f"alignments: {aligns}")
            
        except Exception as e:
            logger.error(f"Error parsing file content: {str(e)}")
            import traceback
            logger.error("Full traceback:")
            logger.error(traceback.format_exc())
            flash('Error parsing file content', 'danger')
            return redirect(request.url)
        
        # Create document in database
        logger.info("Starting to create document in database")
        doc_id = file2db(
            filename=form_file.filename,
            sents=sents,
            current_project_id=current_project_id,
            current_user_id=current_user.id,
            sent_annots=sent_annots,
            doc_annots=doc_annots,
            aligns=aligns
        )
        if doc_id:
            logger.info(f"Document created successfully with ID: {doc_id}")
            return sent_annots, doc_annots, doc_id
    except Exception as e:
        logger.error(f"Error reading file: {str(e)}")
        flash('Error reading file', 'danger')
        return redirect(request.url)


@main.route("/upload_document/<int:current_project_id>", methods=['GET', 'POST'])
@login_required
def upload_document(current_project_id):
    logger.info("Entering upload_document route")
    logger.info(f"Method: {request.method}")
    # check current user's permission
    permission = check_user_permission(current_project_id)
    if not permission:
        return False
    
    
    form = UploadForm()
    sent_annots = []
    doc_annots  = []
    doc_id      = None
    
    if form.validate_on_submit():
        logger.info("Form validated")
        if form.files.data:
            form_file = form.files.data[0]  # Get the first file
            logger.info(f"Got file: {form_file.filename}")
            
            if form_file.filename == '':
                logger.error("Empty filename")
                flash('No file selected', 'danger')
                return redirect(request.url)
                
            if not form_file.filename.endswith('.umr'):
                logger.error("Invalid file extension")
                flash('Only .umr files are allowed', 'danger')
                return redirect(request.url)
                
            logger.info("About to call handle_file_upload")
            sent_annots, doc_annots, doc_id = handle_file_upload(form_file, current_project_id)
            logger.info("handle_file_upload succeeded")
            flash('Your file has been uploaded!', 'success')
            return redirect(url_for('users.project', project_id=current_project_id))

        else:
            logger.error("No file in form.files.data")
            flash('No file selected', 'danger')
            return redirect(request.url)
            
    elif request.method == 'POST':
        logger.error("Form validation failed")
        for field, errors in form.errors.items():
            for error in errors:
                flash(f'Error in {field}: {error}', 'danger')
                logger.error(f'Error in {field}: {error}')
            
    logger.info("Rendering upload form")
    return render_template('upload_document.html', title='Upload Document', form=form, sent_annots=sent_annots, doc_annots=doc_annots, doc_id=doc_id)

@main.route("/upload_lexicon/<int:current_project_id>", methods=['GET', 'POST'])
def upload_lexicon(current_project_id):
    pass

@main.route("/lexiconlookup/<int:project_id>/<int:doc_id>/<int:snt_id>", methods=['GET', 'POST'])
@login_required
def lexiconlookup(project_id, doc_id, snt_id):
    """Handle lexicon lookup and editing."""
    try:
        # Get the project
        project = Project.query.get_or_404(project_id)
        
        # Get the lexicon for this project
        lexicon = Lexicon.query.filter_by(project_id=project_id).first()
        if not lexicon:
            flash('No lexicon found for this project', 'warning')
            return redirect(url_for('main.sentlevelview', doc_sent_id=f"{doc_id}_{snt_id}_{current_user.id}"))
        
        # Get the document and sentence
        doc = Doc.query.get_or_404(doc_id)
        sent = Sent.query.filter_by(doc_id=doc_id).order_by(Sent.id).all()[snt_id - 1]
        
        return render_template('lexicon_lookup.html',
                            title='Lexicon Lookup',
                            project=project,
                            lexicon=lexicon.data,
                            doc=doc,
                            sent=sent,
                            snt_id=snt_id)
                            
    except Exception as e:
        logger.error(f"Error in lexicon lookup: {str(e)}", exc_info=True)
        flash('Error accessing lexicon', 'danger')
        return redirect(url_for('main.sentlevelview', doc_sent_id=f"{doc_id}_{snt_id}_{current_user.id}"))

@main.route("/sentlevel/<string:doc_sent_id>", methods=['GET', 'POST'])
def sentlevel(doc_sent_id):
    """Handle sentence-level annotation view and updates."""
    pass


@main.route("/doclevel/<string:doc_sent_id>", methods=['GET', 'POST'])
def doclevel(doc_sent_id):
    """Handle document-level annotation view and updates."""
    pass

@main.route("/sentlevelview/<string:doc_sent_id>", methods=['GET', 'POST'])
@login_required
def sentlevelview(doc_sent_id):
    """Handle sentence-level annotation view."""
    logger = logging.getLogger(__name__)
    try:
        # Log the current user information
        logger.info(f"Current user ID: {current_user.id if current_user else 'No current user'}")
        
        # Parse the doc_sent_id string to get doc_id, sent_id, and user_id
        parts = doc_sent_id.split('_')
        if len(parts) < 2:  # Need at least doc_id and sent_id
            flash('Invalid document ID format - need at least document ID and sentence ID', 'danger')
            return redirect(url_for('users.account'))
        
        doc_id = int(parts[0])
        snt_id = int(parts[1])
        
        # Always use current_user.id as the user_id since this is a view operation
        user_id = current_user.id
        
        logger.info(f"Processing request for doc_id={doc_id}, snt_id={snt_id}, user_id={user_id}")
        
        # Get the document and its owner
        doc = Doc.query.get_or_404(doc_id)
        owner = User.query.get_or_404(user_id)
        
        # Get the project information
        project = Project.query.get_or_404(doc.project_id)
        admin = User.query.get_or_404(project.created_by_user_id)
        
        # Get all sentences for this document
        sentences = Sent.query.filter_by(doc_id=doc_id).order_by(Sent.id).all()
        if not sentences:
            flash('No sentences found for this document', 'danger')
            return redirect(url_for('users.account'))
        
        # Get the current sentence and its annotations
        try:
            current_sent = sentences[int(snt_id) - 1] if 0 < int(snt_id) <= len(sentences) else sentences[0]
        except (IndexError, ValueError) as e:
            logger.error(f"Error accessing sentence {snt_id}: {str(e)}")
            flash(f'Invalid sentence number: {snt_id}', 'danger')
            return redirect(url_for('users.account'))
        
        # Get the document version for the owner
        doc_version = DocVersion.query.filter_by(
            doc_id=doc_id,
            user_id=user_id
        ).first()
        
        if not doc_version:
            logger.info(f"Creating new document version for user {user_id}")
            doc_version = DocVersion(
                doc_id=doc_id,
                user_id=user_id,
                stage='initial'
            )
            db.session.add(doc_version)
            db.session.commit()
        
        # Get annotations for the current sentence
        curr_annotation = None
        curr_sent_umr = {}
        curr_alignment = {}
        if doc_version and current_sent:
            curr_annotation = Annotation.query.filter_by(
                doc_version_id=doc_version.id,
                sent_id=current_sent.id
            ).first()
            if curr_annotation:
                try:
                    curr_sent_umr = curr_annotation.sent_annot if curr_annotation.sent_annot else {}
                    if isinstance(curr_sent_umr, str):
                        curr_sent_umr = json.loads(curr_sent_umr)
                    curr_alignment = curr_annotation.alignment if curr_annotation.alignment else {}
                    if isinstance(curr_alignment, str):
                        curr_alignment = json.loads(curr_alignment)
                except json.JSONDecodeError as e:
                    logger.error(f"Error decoding annotation JSON: {str(e)}")
                    curr_sent_umr = {}
                    curr_alignment = {}
        
        # Prepare info2display
        class Info2Display:
            def __init__(self):
                self.sents = []
                self.sent_htmls = []
                self.df_htmls = []
                self.gls = []
                self.notes = []
        
        info2display = Info2Display()
        info2display.sents = [sent.content for sent in sentences]
        info2display.sent_htmls = [sent.content for sent in sentences]
        
        # Get frame dictionary based on project language
        frame_dict = {}
        try:
            if project.language.lower() == 'english':
                with open(FRAME_FILE_ENGLISH, 'r') as f:
                    frame_dict = json.load(f)
            elif project.language.lower() == 'chinese':
                with open(FRAME_FILE_CHINESE, 'r') as f:
                    frame_dict = json.load(f)
        except (IOError, json.JSONDecodeError) as e:
            logger.error(f"Error loading frame dictionary: {str(e)}")
        
        # Mark which sentences have been annotated
        annotated_sent_ids = []
        if doc_version:
            annotations = Annotation.query.filter_by(doc_version_id=doc_version.id).all()
            annotated_sent_ids = [str(a.sent_id) for a in annotations if a.sent_annot]
        
        # Ensure all data is JSON serializable
        curr_sent_umr = json.loads(json.dumps(curr_sent_umr))
        curr_alignment = json.loads(json.dumps(curr_alignment))
        frame_dict = json.loads(json.dumps(frame_dict))
        
        return render_template('sentlevelview.html',
                            doc_id=doc_id,
                            snt_id=snt_id,
                            owner=owner,
                            filename=doc.filename,
                            lang=project.language,
                            file_format='plain_text',
                            project_name=project.project_name,
                            project_id=project.id,
                            admin=admin,
                            info2display=info2display,
                            frame_dict=frame_dict,
                            curr_sent_umr=curr_sent_umr,
                            curr_annotation_string=curr_annotation.sent_annot if curr_annotation else '',
                            curr_alignment=curr_alignment,
                            annotated_sent_ids=','.join(annotated_sent_ids))
                            
    except (ValueError, IndexError) as e:
        logger.error(f"Error processing document ID or sentence number: {str(e)}")
        flash(f'Invalid document ID or sentence number: {str(e)}', 'danger')
        return redirect(url_for('users.account'))
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        flash(f'Error loading document: {str(e)}', 'danger')
        return redirect(url_for('users.account'))

@main.route("/doclevelview/<string:doc_sent_id>", methods=['GET', 'POST'])
def doclevelview(doc_sent_id):
    pass

@main.route("/about")
def about():
    return render_template('about.html', title='About')

@main.route("/guide")
def guidelines():
    return render_template('user_guide.html')
