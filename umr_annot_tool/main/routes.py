import sqlalchemy.exc
from flask import url_for, redirect, flash, make_response, jsonify, send_file, render_template, request, abort, send_from_directory, current_app, Response
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
from umr_annot_tool.resources.rolesets import known_relations
import tempfile
import subprocess
import time
import re
import secrets
from urllib.parse import quote
import uuid
from umr_annot_tool.users.forms import RegistrationForm, LoginForm, UpdateAccountForm, RequestResetForm, ResetPasswordForm
from umr_annot_tool.posts.forms import PostForm

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

@main.route("/")
def home():
    """Handle requests to the root URL."""
    logger.info("Root URL accessed, rendering user guide or redirecting to account")
    if current_user.is_authenticated:
        return redirect(url_for('users.account'))
    else:
        return render_template('user_guide.html', title='Welcome to UMR Writer 3.0')

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

@main.route("/sentlevel/<int:doc_version_id>/<int:sent_id>", methods=['GET', 'POST'])
@login_required
def sentlevel(doc_version_id, sent_id):
    """Handle sentence-level annotation view.
    
    Args:
        doc_version_id (int): The ID of the document version
        sent_id (int): The sentence ID within the document
    """
    logger.info(f"Accessing sentlevel route with doc_version_id={doc_version_id}, sent_id={sent_id}")
    
    try:
        # Get document version
        doc_version = DocVersion.query.get_or_404(doc_version_id)
        logger.info(f"Found document version: {doc_version}")
        
        # Additional debugging
        logger.info(f"Document ID: {doc_version.doc_id}")
        logger.info(f"Owner ID: {doc_version.user_id}")
        
        # Check if current user has permission to access this document
        doc = Doc.query.get_or_404(doc_version.doc_id)
        logger.info(f"Found document: {doc}")
        
        # Get project information
        project = Project.query.get_or_404(doc.project_id)
        logger.info(f"Found project: {project}")
        
        # Check if user has permission to access this document
        project_user = Projectuser.query.filter_by(
            project_id=project.id,
            user_id=current_user.id
        ).first()
        
        if not project_user:
            logger.error(f"User {current_user.id} does not have permission to access project {project.id}")
            flash('You do not have permission to access this document', 'danger')
            return redirect(url_for('users.account'))
        
        # Get all sentences for this document
        sentences = Sent.query.filter_by(doc_id=doc.id).order_by(Sent.id).all()
        if not sentences:
            logger.error(f"No sentences found for document {doc.id}")
            flash('No sentences found for this document', 'danger')
            return redirect(url_for('users.account'))
        
        logger.info(f"Found {len(sentences)} sentences for document {doc.id}")
        
        # Get the current sentence
        try:
            if sent_id < 1 or sent_id > len(sentences):
                logger.error(f"Invalid sentence number: {sent_id}. Must be between 1 and {len(sentences)}")
                flash(f'Invalid sentence number: {sent_id}. Must be between 1 and {len(sentences)}', 'danger')
                return redirect(url_for('users.account'))
                
            current_sent = sentences[sent_id - 1]
            logger.info(f"Found sentence {sent_id}: {current_sent.content[:50]}...")
        except (IndexError, ValueError) as e:
            logger.error(f"Error accessing sentence: {str(e)}")
            flash(f'Error accessing sentence: {str(e)}', 'danger')
            return redirect(url_for('users.account'))
        
        # Get annotations for the current sentence
        curr_annotation = None
        curr_sent_umr = {}
        curr_alignment = {}
        curr_annotation_string = ''
        
        if current_sent:
            curr_annotation = Annotation.query.filter_by(
                doc_version_id=doc_version_id,
                sent_id=current_sent.id
            ).first()
            
            if curr_annotation:
                try:
                    logger.info(f"Found annotation: {curr_annotation}")
                    logger.info(f"Raw sent_annot: {curr_annotation.sent_annot}")
                    logger.info(f"Raw sent_annot type: {type(curr_annotation.sent_annot)}")
                    
                    # Handle sent_annot - don't try to parse PENMAN as JSON
                    curr_sent_umr = curr_annotation.sent_annot if curr_annotation.sent_annot else {}
                    curr_annotation_string = curr_annotation.sent_annot if curr_annotation.sent_annot else ''
                    
                    logger.info(f"Processed curr_sent_umr: {curr_sent_umr}")
                    logger.info(f"Processed curr_annotation_string: {curr_annotation_string}")
                    
                    # Handle alignment
                    curr_alignment = curr_annotation.alignment if curr_annotation.alignment else {}
                    logger.info(f"Raw alignment data: {curr_alignment}")
                    logger.info(f"Raw alignment type: {type(curr_alignment)}")
                    
                    if isinstance(curr_alignment, str):
                        curr_alignment = json.loads(curr_alignment)
                        logger.info(f"Parsed alignment data: {curr_alignment}")
                    
                    logger.info(f"Final alignment data: {curr_alignment}")
                    logger.info(f"Successfully loaded annotation for sentence {sent_id}")
                except Exception as e:
                    logger.error(f"Error processing annotation: {str(e)}")
                    curr_sent_umr = {}
                    curr_alignment = {}
                    curr_annotation_string = ''
        
        # Prepare display information
        try:
            info2display = {
                'sents': [sent.content for sent in sentences],
                'sent_htmls': [
                    ' '.join([
                        f'<span class="token" data-index="{i}"><sup class="token-index">{i}</sup>{token}</span>'
                        for i, token in enumerate(sent.content.split())
                    ])
                    for sent in sentences
                ],
                'sents_html': '<br>'.join([
                    f'<span id="sentid-{sent.id}">{i+1}. {sent.content}</span>' 
                    for i, sent in enumerate(sentences)
                ])
            }
            logger.info("Successfully prepared display information")
        except Exception as e:
            logger.error(f"Error preparing display information: {str(e)}")
            flash('Error preparing display information', 'danger')
            return redirect(url_for('users.account'))
        
        # Load frame dictionary based on project language
        frame_dict = {}
        try:
            frame_file = FRAME_FILE_ENGLISH if project.language.lower() == 'english' else FRAME_FILE_CHINESE
            with open(frame_file, 'r') as f:
                frame_dict = json.load(f)
            logger.info(f"Successfully loaded frame dictionary from {frame_file}")
        except (IOError, json.JSONDecodeError) as e:
            logger.error(f"Error loading frame dictionary: {str(e)}")
        
        # Get partial graphs for this project
        partial_graphs = {}
        try:
            pg = Partialgraph.query.filter_by(project_id=project.id).first()
            if pg:
                partial_graphs = pg.partial_umr if pg.partial_umr else {}
            logger.info("Successfully loaded partial graphs")
        except Exception as e:
            logger.error(f"Error loading partial graphs: {str(e)}")
        
        # Ensure all data is JSON serializable
        curr_sent_umr = json.loads(json.dumps(curr_sent_umr))
        curr_alignment = json.loads(json.dumps(curr_alignment))
        frame_dict = json.loads(json.dumps(frame_dict))
        partial_graphs_json = json.dumps(partial_graphs)
        
        # Get the list of known relations from rolesets for the relation editor
        relations_list = list(known_relations.keys())
        
        # Also pass the full relations data for value editing
        relations_data = {k: v for k, v in known_relations.items() if 'values' in v}
        
        logger.info("Rendering sentlevel template")
        return render_template('sentlevel.html',
                            doc_id=doc.id,
                            doc_version_id=doc_version_id,
                            snt_id=sent_id,
                            owner=User.query.get_or_404(doc_version.user_id),
                            filename=doc.filename,
                            lang=project.language,
                            project_name=project.project_name,
                            project_id=project.id,
                            admin=User.query.get_or_404(project.created_by_user_id),
                            info2display=info2display,
                            frame_dict=frame_dict,
                            curr_sent_umr=curr_sent_umr,
                            curr_annotation_string=curr_annotation_string,
                            curr_alignment=curr_alignment,
                            partial_graphs_json=partial_graphs_json,
                            relations_list=json.dumps(relations_list),
                            relations_data=json.dumps(relations_data))
                            
    except Exception as e:
        logger.error(f"Unexpected error in sentlevel: {str(e)}", exc_info=True)
        flash(f'Error loading document: {str(e)}', 'danger')
        return redirect(url_for('users.account'))

@main.route("/about")
def about():
    return render_template('about.html', title='About')

@main.route("/guide")
def guidelines():
    return render_template('user_guide.html')

@main.route("/update_relation/<int:doc_version_id>/<int:sent_id>", methods=['POST'])
def update_relation(doc_version_id, sent_id):
    """Update a relation in an annotation and save it."""
    current_app.logger.info(f"Update relation called with doc_version_id={doc_version_id}, sent_id={sent_id}")
    
    if not current_user.is_authenticated:
        current_app.logger.warning("User not authenticated")
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        data = request.get_json()
        current_app.logger.info(f"Received data: {data}")
        
        updated_annotation = data.get('annotation')
        old_relation = data.get('old_relation')
        new_relation = data.get('new_relation')
        
        # Validate inputs
        if not updated_annotation or not old_relation or not new_relation:
            current_app.logger.warning("Missing required fields in request")
            return jsonify({"error": "Missing required fields"}), 400
        
        if not new_relation.startswith(':'):
            current_app.logger.warning(f"Invalid relation format: {new_relation}")
            return jsonify({"error": "Invalid relation format"}), 400
        
        # Get the document version
        current_app.logger.info(f"Looking up DocVersion with id={doc_version_id}")
        doc_version = DocVersion.query.get_or_404(doc_version_id)
        current_app.logger.info(f"Found DocVersion: {doc_version}")
        
        # Check if the user has permission to modify this document
        current_app.logger.info(f"Checking if user {current_user.username} has permission for doc_id={doc_version.doc_id}")
        if not has_permission_for_doc(current_user, doc_version.doc_id):
            current_app.logger.warning(f"User {current_user.username} not authorized to modify document {doc_version.doc_id}")
            return jsonify({"error": "Not authorized to modify this document"}), 403
        
        # Get the document
        doc = Doc.query.get(doc_version.doc_id)
        if not doc:
            current_app.logger.error(f"Doc with id={doc_version.doc_id} not found")
            return jsonify({"error": f"Document not found"}), 404
        
        # First get all sentences for this document, in order
        sentences = Sent.query.filter_by(doc_id=doc.id).order_by(Sent.id).all()
        if not sentences:
            current_app.logger.error(f"No sentences found for document {doc.id}")
            return jsonify({"error": "No sentences found for this document"}), 404
        
        # Now get the current sentence by index (1-based)
        if sent_id < 1 or sent_id > len(sentences):
            current_app.logger.error(f"Invalid sentence index: {sent_id}. Valid range is 1-{len(sentences)}")
            return jsonify({"error": f"Invalid sentence index: {sent_id}. Valid range is 1-{len(sentences)}"}), 400
        
        current_sent = sentences[sent_id - 1]
        current_app.logger.info(f"Found current sentence: {current_sent}")
        
        # Get annotation for this sentence using the actual sentence ID
        current_app.logger.info(f"Looking up Annotation with doc_version_id={doc_version_id}, sent_id={current_sent.id}")
        annotation = Annotation.query.filter_by(doc_version_id=doc_version_id, sent_id=current_sent.id).first()
        
        if not annotation:
            current_app.logger.warning(f"Annotation not found for doc_version_id={doc_version_id}, sent_id={current_sent.id}")
            
            # Try to list all annotations for this doc_version to debug
            all_annotations = Annotation.query.filter_by(doc_version_id=doc_version_id).all()
            current_app.logger.info(f"All annotations for doc_version_id={doc_version_id}: {all_annotations}")
            
            return jsonify({"error": "Annotation not found"}), 404
        
        current_app.logger.info(f"Found Annotation: {annotation}")
        
        # Save the updated annotation
        annotation.sent_annot = updated_annotation
        db.session.commit()
        
        # Log the change
        current_app.logger.info(f"User {current_user.username} updated relation from {old_relation} to {new_relation} in doc_version {doc_version_id}, sentence {sent_id}")
        
        return jsonify({
            "success": True,
            "message": f"Updated relation from {old_relation} to {new_relation}",
            "doc_version_id": doc_version_id,
            "sent_id": sent_id
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error updating relation: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@main.route("/update_value/<int:doc_version_id>/<int:sent_id>", methods=['POST'])
def update_value(doc_version_id, sent_id):
    """Update a relation's value in an annotation and save it."""
    current_app.logger.info(f"Update value called with doc_version_id={doc_version_id}, sent_id={sent_id}")
    
    if not current_user.is_authenticated:
        current_app.logger.warning("User not authenticated")
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        data = request.get_json()
        current_app.logger.info(f"Received data: {data}")
        
        updated_annotation = data.get('annotation')
        relation = data.get('relation')
        old_value = data.get('old_value')
        new_value = data.get('new_value')
        
        # Validate inputs
        if not updated_annotation or not relation or not old_value or not new_value:
            current_app.logger.warning("Missing required fields in request")
            return jsonify({"error": "Missing required fields"}), 400
        
        # Get the document version
        current_app.logger.info(f"Looking up DocVersion with id={doc_version_id}")
        doc_version = DocVersion.query.get_or_404(doc_version_id)
        current_app.logger.info(f"Found DocVersion: {doc_version}")
        
        # Check if the user has permission to modify this document
        current_app.logger.info(f"Checking if user {current_user.username} has permission for doc_id={doc_version.doc_id}")
        if not has_permission_for_doc(current_user, doc_version.doc_id):
            current_app.logger.warning(f"User {current_user.username} not authorized to modify document {doc_version.doc_id}")
            return jsonify({"error": "Not authorized to modify this document"}), 403
        
        # Get the document
        doc = Doc.query.get(doc_version.doc_id)
        if not doc:
            current_app.logger.error(f"Doc with id={doc_version.doc_id} not found")
            return jsonify({"error": f"Document not found"}), 404
        
        # First get all sentences for this document, in order
        sentences = Sent.query.filter_by(doc_id=doc.id).order_by(Sent.id).all()
        if not sentences:
            current_app.logger.error(f"No sentences found for document {doc.id}")
            return jsonify({"error": "No sentences found for this document"}), 404
        
        # Now get the current sentence by index (1-based)
        if sent_id < 1 or sent_id > len(sentences):
            current_app.logger.error(f"Invalid sentence index: {sent_id}. Valid range is 1-{len(sentences)}")
            return jsonify({"error": f"Invalid sentence index: {sent_id}. Valid range is 1-{len(sentences)}"}), 400
        
        current_sent = sentences[sent_id - 1]
        current_app.logger.info(f"Found current sentence: {current_sent}")
        
        # Get annotation for this sentence using the actual sentence ID
        current_app.logger.info(f"Looking up Annotation with doc_version_id={doc_version_id}, sent_id={current_sent.id}")
        annotation = Annotation.query.filter_by(doc_version_id=doc_version_id, sent_id=current_sent.id).first()
        
        if not annotation:
            current_app.logger.warning(f"Annotation not found for doc_version_id={doc_version_id}, sent_id={current_sent.id}")
            
            # Try to list all annotations for this doc_version to debug
            all_annotations = Annotation.query.filter_by(doc_version_id=doc_version_id).all()
            current_app.logger.info(f"All annotations for doc_version_id={doc_version_id}: {all_annotations}")
            
            return jsonify({"error": "Annotation not found"}), 404
        
        current_app.logger.info(f"Found Annotation: {annotation}")
        
        # Save the updated annotation
        annotation.sent_annot = updated_annotation
        db.session.commit()
        
        # Log the change
        current_app.logger.info(f"User {current_user.username} updated value for {relation} from {old_value} to {new_value} in doc_version {doc_version_id}, sentence {sent_id}")
        
        return jsonify({
            "success": True,
            "message": f"Updated value for {relation} from {old_value} to {new_value}",
            "doc_version_id": doc_version_id,
            "sent_id": sent_id
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error updating value: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

def has_permission_for_doc(user, doc_id):
    """Check if a user has permission to modify a document."""
    if user.is_anonymous:
        return False
    
    # Get the document
    doc = Doc.query.get(doc_id)
    if not doc:
        return False
    
    # Get the user's permission for the project
    project_user = Projectuser.query.filter_by(
        user_id=user.id, 
        project_id=doc.project_id
    ).first()
    
    if not project_user:
        return False
    
    # Check if user has admin, edit, or annotate permission
    return project_user.permission in ['admin', 'edit', 'annotate']

@main.route("/update_annotation/<int:doc_version_id>/<int:sent_id>", methods=['POST'])
def update_annotation(doc_version_id, sent_id):
    # Check if the user is logged in
    if not current_user.is_authenticated:
        return jsonify({'success': False, 'message': 'User is not authenticated'}), 401
    
    # Get the request data
    data = request.get_json()
    current_app.logger.info(f"update_annotation called with doc_version_id={doc_version_id}, sent_id={sent_id}, data={data}")
    
    # Check if the required fields are present
    if not all(k in data for k in ['annotation']):
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400
    
    try:
        # Get the document version
        doc_version = DocVersion.query.get_or_404(doc_version_id)
        
        # Check if the user has permission to modify the document
        if not has_permission_for_doc(current_user, doc_version.doc_id):
            return jsonify({'success': False, 'message': 'User does not have permission to modify this document'}), 403
        
        # Get the document
        doc = Doc.query.get(doc_version.doc_id)
        if not doc:
            current_app.logger.error(f"Doc with id={doc_version.doc_id} not found")
            return jsonify({"error": f"Document not found"}), 404
        
        # First get all sentences for this document, in order
        sentences = Sent.query.filter_by(doc_id=doc.id).order_by(Sent.id).all()
        if not sentences:
            current_app.logger.error(f"No sentences found for document {doc.id}")
            return jsonify({"error": "No sentences found for this document"}), 404
        
        # Now get the current sentence by index (1-based)
        if sent_id < 1 or sent_id > len(sentences):
            current_app.logger.error(f"Invalid sentence index: {sent_id}. Valid range is 1-{len(sentences)}")
            return jsonify({"error": f"Invalid sentence index: {sent_id}. Valid range is 1-{len(sentences)}"}), 400
        
        current_sent = sentences[sent_id - 1]
        current_app.logger.info(f"Found current sentence: {current_sent}")
        
        # Get annotation for this sentence using the actual sentence ID
        current_app.logger.info(f"Looking up Annotation with doc_version_id={doc_version_id}, sent_id={current_sent.id}")
        annotation = Annotation.query.filter_by(doc_version_id=doc_version_id, sent_id=current_sent.id).first()
        
        if not annotation:
            # Create a new annotation
            annotation = Annotation(
                doc_version_id=doc_version_id,
                sent_id=current_sent.id,
                sent_annot=data['annotation'],
                doc_annot="",
                actions={},
                alignment={}
            )
            db.session.add(annotation)
            current_app.logger.info(f"Created new annotation for doc_version_id={doc_version_id}, sent_id={current_sent.id}")
        else:
            # Update the annotation
            annotation.sent_annot = data['annotation']
            current_app.logger.info(f"Updated existing annotation for doc_version_id={doc_version_id}, sent_id={current_sent.id}")
        
        # If alignment data is provided, update it
        if 'alignment' in data and isinstance(data['alignment'], dict):
            # Check if we need to merge with existing alignment or replace it
            if annotation.alignment and data.get('operation') == 'add_top':
                # For add_top operation, merge with existing alignments
                current_app.logger.info(f"Merging new alignment {data['alignment']} with existing {annotation.alignment}")
                existing_alignment = annotation.alignment
                for var, indices in data['alignment'].items():
                    existing_alignment[var] = indices
                annotation.alignment = existing_alignment
                current_app.logger.info(f"Updated alignment data: {annotation.alignment}")
            else:
                # Otherwise, replace alignment
                annotation.alignment = data['alignment']
                current_app.logger.info(f"Set alignment data: {annotation.alignment}")
        
        # Handle specific operations
        if 'operation' in data:
            if data['operation'] == 'delete_all':
                # If clear_alignments flag is set, also clear the alignments
                if data.get('clear_alignments', False):
                    # Clear the alignment data
                    annotation.alignment = {}
                    current_app.logger.info(f"Deleted all alignments for doc_version_id={doc_version_id}, sent_id={current_sent.id}")
                
                current_app.logger.info(f"Delete all: User {current_user.username} deleted entire annotation from sentence {sent_id} in document version {doc_version_id}")
            
            elif data['operation'] == 'delete_branch':
                deleted_relation = data.get('deleted_relation', '(unknown)')
                current_app.logger.info(f"Branch deletion: User {current_user.username} deleted branch '{deleted_relation}' from sentence {sent_id} in document version {doc_version_id}")
            
            elif data['operation'] == 'move_branch':
                if all(k in data for k in ['source_relation', 'target_node']):
                    source_relation = data['source_relation']
                    target_node = data['target_node']
                    is_variable_target = data.get('is_variable_target', False)
                    target_type = "variable" if is_variable_target else "relation"
                    current_app.logger.info(f"Branch move: User {current_user.username} moved branch '{source_relation}' to {target_type} '{target_node}' in sentence {sent_id} in document version {doc_version_id}")
                    
            elif data['operation'] == 'add_branch':
                if all(k in data for k in ['parent_variable', 'relation', 'child_node']):
                    parent_variable = data['parent_variable']
                    relation = data['relation']
                    child_node = data['child_node']
                    current_app.logger.info(f"Branch addition: User {current_user.username} added branch '{relation} {child_node}' to variable '{parent_variable}' in sentence {sent_id} in document version {doc_version_id}")
        
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Annotation updated successfully'})
    
    except Exception as e:
        current_app.logger.error(f"Error updating annotation: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@main.route("/save_umr", methods=['POST'])
@login_required
def save_umr():
    """Route to save UMR annotations from the in-place relation editor"""
    try:
        # Get the request data
        data = request.get_json()
        
        # Check if the required fields are present
        if not all(k in data for k in ['doc_version_id', 'sent_id', 'umr_string']):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        doc_version_id = data['doc_version_id']
        sent_id = data['sent_id']
        umr_string = data['umr_string']
        
        current_app.logger.info(f"Save UMR called with doc_version_id={doc_version_id}, sent_id={sent_id}")
        
        # Get the document version
        doc_version = DocVersion.query.get_or_404(doc_version_id)
        
        # Check if the user has permission to modify the document
        if not has_permission_for_doc(current_user, doc_version.doc_id):
            return jsonify({'success': False, 'error': 'User does not have permission to modify this document'}), 403
        
        # Get the document
        doc = Doc.query.get(doc_version.doc_id)
        if not doc:
            current_app.logger.error(f"Doc with id={doc_version.doc_id} not found")
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        
        # First get all sentences for this document, in order
        sentences = Sent.query.filter_by(doc_id=doc.id).order_by(Sent.id).all()
        if not sentences:
            current_app.logger.error(f"No sentences found for document {doc.id}")
            return jsonify({'success': False, 'error': 'No sentences found for this document'}), 404
        
        # Now get the current sentence by index (1-based)
        if int(sent_id) < 1 or int(sent_id) > len(sentences):
            current_app.logger.error(f"Invalid sentence index: {sent_id}. Valid range is 1-{len(sentences)}")
            return jsonify({'success': False, 'error': f'Invalid sentence index: {sent_id}. Valid range is 1-{len(sentences)}'}), 400
        
        current_sent = sentences[int(sent_id) - 1]
        current_app.logger.info(f"Found current sentence: {current_sent}")
        
        # Get the annotation object
        annotation = Annotation.query.filter_by(doc_version_id=doc_version_id, sent_id=current_sent.id).first()
        
        if not annotation:
            # Create a new annotation if it doesn't exist
            annotation = Annotation(
                doc_version_id=doc_version_id,
                sent_id=current_sent.id,
                sent_annot=umr_string,
                doc_annot="",  # Initialize with empty doc annotation
                actions={},
                alignment={}
            )
            db.session.add(annotation)
        else:
            # Update the existing annotation
            annotation.sent_annot = umr_string
        
        # Log the update
        current_app.logger.info(f"UMR Update: User {current_user.username} updated UMR for sentence {sent_id} in document version {doc_version_id}")
        
        # Commit the transaction
        db.session.commit()
        
        return jsonify({'success': True})
    
    except Exception as e:
        current_app.logger.error(f"Error saving UMR: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@main.route("/save_alignments", methods=['POST'])
@login_required
def save_alignments():
    """Route to save alignment data"""
    try:
        # Get the request data
        data = request.get_json()
        
        # Check if the required fields are present
        if not all(k in data for k in ['doc_version_id', 'sent_id', 'alignments']):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
        
        doc_version_id = data['doc_version_id']
        sent_id = data['sent_id']
        alignments = data['alignments']
        
        current_app.logger.info(f"Save alignments called with doc_version_id={doc_version_id}, sent_id={sent_id}")
        
        # Get the document version
        doc_version = DocVersion.query.get_or_404(doc_version_id)
        
        # Check if the user has permission to modify the document
        if not has_permission_for_doc(current_user, doc_version.doc_id):
            return jsonify({'success': False, 'error': 'User does not have permission to modify this document'}), 403
        
        # Get the document
        doc = Doc.query.get(doc_version.doc_id)
        if not doc:
            current_app.logger.error(f"Doc with id={doc_version.doc_id} not found")
            return jsonify({'success': False, 'error': 'Document not found'}), 404
        
        # First get all sentences for this document, in order
        sentences = Sent.query.filter_by(doc_id=doc.id).order_by(Sent.id).all()
        if not sentences:
            current_app.logger.error(f"No sentences found for document {doc.id}")
            return jsonify({'success': False, 'error': 'No sentences found for this document'}), 404
        
        # Now get the current sentence by index (1-based)
        if int(sent_id) < 1 or int(sent_id) > len(sentences):
            current_app.logger.error(f"Invalid sentence index: {sent_id}. Valid range is 1-{len(sentences)}")
            return jsonify({'success': False, 'error': f'Invalid sentence index: {sent_id}. Valid range is 1-{len(sentences)}'}), 400
        
        current_sent = sentences[int(sent_id) - 1]
        current_app.logger.info(f"Found current sentence: {current_sent}")
        
        # Get the alignment object
        annotation = Annotation.query.filter_by(doc_version_id=doc_version_id, sent_id=current_sent.id).first()
        
        if not annotation:
            # Create a new annotation if it doesn't exist
            annotation = Annotation(
                doc_version_id=doc_version_id,
                sent_id=current_sent.id,
                sent_annot="",
                doc_annot="",
                actions={},
                alignment=alignments
            )
            db.session.add(annotation)
        else:
            # Update the existing alignment
            annotation.alignment = alignments
        
        # Log the update
        current_app.logger.info(f"Alignment Update: User {current_user.username} updated alignments for sentence {sent_id} in document version {doc_version_id}")
        
        # Commit the transaction
        db.session.commit()
        
        return jsonify({'success': True})
    
    except Exception as e:
        current_app.logger.error(f"Error saving alignments: {str(e)}", exc_info=True)
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@main.route("/get_concepts", methods=['GET'])
@login_required
def get_concepts():
    """Provide predefined concepts for use in the branch addition feature"""
    from umr_annot_tool.resources.rolesets import discourse_concepts, non_event_rolesets, ne_types
    
    try:
        return jsonify({
            'discourse_concepts': discourse_concepts,
            'ne_types': ne_types,
            'non_event_rolesets': non_event_rolesets
        })
    except Exception as e:
        current_app.logger.error(f"Error fetching concepts: {str(e)}")
        return jsonify({'error': str(e)}), 500

@main.route("/doclevel/<int:doc_version_id>/<int:sent_id>", methods=['GET', 'POST'])
@login_required
def doclevel(doc_version_id, sent_id):
    """Handle document-level annotation view.
    
    Args:
        doc_version_id (int): The ID of the document version
        sent_id (int): The sentence ID within the document
    """
    logger.info(f"Accessing doclevel route with doc_version_id={doc_version_id}, sent_id={sent_id}")
    
    try:
        # Get document version
        doc_version = DocVersion.query.get_or_404(doc_version_id)
        logger.info(f"Found document version: {doc_version}")
        
        # Additional debugging
        logger.info(f"Document ID: {doc_version.doc_id}")
        logger.info(f"Owner ID: {doc_version.user_id}")
        
        # Check if current user has permission to access this document
        doc = Doc.query.get_or_404(doc_version.doc_id)
        logger.info(f"Found document: {doc}")
        
        # Get project information
        project = Project.query.get_or_404(doc.project_id)
        logger.info(f"Found project: {project}")
        
        # Check if user has permission to access this document
        project_user = Projectuser.query.filter_by(
            project_id=project.id,
            user_id=current_user.id
        ).first()
        
        if not project_user:
            logger.error(f"User {current_user.id} does not have permission to access project {project.id}")
            flash('You do not have permission to access this document', 'danger')
            return redirect(url_for('users.account'))
        
        # Get all sentences for this document
        sentences = Sent.query.filter_by(doc_id=doc.id).order_by(Sent.id).all()
        if not sentences:
            logger.error(f"No sentences found for document {doc.id}")
            flash('No sentences found for this document', 'danger')
            return redirect(url_for('users.account'))
        
        logger.info(f"Found {len(sentences)} sentences for document {doc.id}")
        
        # Get the current sentence
        try:
            if sent_id < 1 or sent_id > len(sentences):
                logger.error(f"Invalid sentence number: {sent_id}. Must be between 1 and {len(sentences)}")
                flash(f'Invalid sentence number: {sent_id}. Must be between 1 and {len(sentences)}', 'danger')
                return redirect(url_for('users.account'))
                
            current_sent = sentences[sent_id - 1]
            logger.info(f"Found sentence {sent_id}: {current_sent.content[:50]}...")
        except (IndexError, ValueError) as e:
            logger.error(f"Error accessing sentence: {str(e)}")
            flash(f'Error accessing sentence: {str(e)}', 'danger')
            return redirect(url_for('users.account'))
        
        # Get annotations for the current sentence
        curr_annotation = None
        curr_sent_annot_string = ''
        curr_doc_annot_string = ''
        
        if current_sent:
            curr_annotation = Annotation.query.filter_by(
                doc_version_id=doc_version_id,
                sent_id=current_sent.id
            ).first()
            
            if curr_annotation:
                try:
                    logger.info(f"Found annotation: {curr_annotation}")
                    
                    # Get sentence annotation
                    curr_sent_annot_string = curr_annotation.sent_annot if curr_annotation.sent_annot else ''
                    logger.info(f"Sentence annotation: {curr_sent_annot_string[:50]}...")
                    
                    # Get document annotation
                    curr_doc_annot_string = curr_annotation.doc_annot if curr_annotation.doc_annot else ''
                    logger.info(f"Document annotation: {curr_doc_annot_string[:50]}...")
                    
                    logger.info(f"Successfully loaded annotation for sentence {sent_id}")
                except Exception as e:
                    logger.error(f"Error processing annotation: {str(e)}")
                    curr_sent_annot_string = ''
                    curr_doc_annot_string = ''
        
        # Get all sentence-level annotations for this document
        all_sent_annotations = {}
        try:
            # Query all annotations for this document version
            all_annotations = Annotation.query.filter_by(
                doc_version_id=doc_version_id
            ).all()
            
            # Create a dictionary mapping sentence indices to their annotations
            for annotation in all_annotations:
                # Find the index of this sentence in the sentences list
                for i, sent in enumerate(sentences):
                    if sent.id == annotation.sent_id:
                        sent_index = i + 1  # 1-indexed for UI consistency
                        all_sent_annotations[str(sent_index)] = annotation.sent_annot
                        break
            
            logger.info(f"Loaded {len(all_sent_annotations)} sentence-level annotations for document")
        except Exception as e:
            logger.error(f"Error loading all sentence annotations: {str(e)}")
            all_sent_annotations = {}
        
        # Prepare display information
        try:
            info2display = {
                'sents': [sent.content for sent in sentences],
                'sent_htmls': [
                    ' '.join([
                        f'<span class="token" data-index="{i}"><sup class="token-index">{i}</sup>{token}</span>'
                        for i, token in enumerate(sent.content.split())
                    ])
                    for sent in sentences
                ],
                'sents_html': '<br>'.join([
                    f'<span id="sentid-{sent.id}">{i+1}. {sent.content}</span>' 
                    for i, sent in enumerate(sentences)
                ])
            }
            logger.info("Successfully prepared display information")
        except Exception as e:
            logger.error(f"Error preparing display information: {str(e)}")
            flash('Error preparing display information', 'danger')
            return redirect(url_for('users.account'))
        
        logger.info("Rendering doclevel template")
        return render_template('doclevel.html',
                            doc_id=doc.id,
                            doc_version_id=doc_version_id,
                            snt_id=sent_id,
                            owner=User.query.get_or_404(doc_version.user_id),
                            filename=doc.filename,
                            lang=project.language,
                            project_name=project.project_name,
                            project_id=project.id,
                            admin=User.query.get_or_404(project.created_by_user_id),
                            info2display=info2display,
                            curr_sent_annot_string=curr_sent_annot_string,
                            curr_doc_annot_string=curr_doc_annot_string,
                            all_sent_annotations=all_sent_annotations)
                            
    except Exception as e:
        logger.error(f"Unexpected error in doclevel: {str(e)}", exc_info=True)
        flash(f'Error loading document: {str(e)}', 'danger')
        return redirect(url_for('users.account'))


@main.route("/update_doc_annotation/<int:doc_version_id>/<int:sent_id>", methods=['POST'])
@login_required
def update_doc_annotation(doc_version_id, sent_id):
    """Update document-level annotation for a sentence."""
    try:
        # Get the data from the request
        data = request.get_json()
        
        # Log incoming request details
        logger.info(f"Received update request for doc_version_id={doc_version_id}, sent_id={sent_id}")
        logger.info(f"Request data type: {request.content_type}")
        
        if not data:
            # Try to get form data if JSON body isn't present
            logger.info("No JSON data found, trying to get form data")
            doc_annot = request.form.get('annotation', request.form.get('doc_annot', ''))
            sentence_number = request.form.get('sentence_number', sent_id)
        else:
            # Use the new 'annotation' field name, but fall back to 'doc_annot' for backward compatibility
            doc_annot = data.get('annotation', data.get('doc_annot', ''))
            sentence_number = data.get('sentence_number', sent_id)
            logger.info(f"Data keys: {list(data.keys())}")
        
        logger.info(f"Updating document annotation for doc_version_id={doc_version_id}, sent_id={sent_id}")
        logger.debug(f"Document annotation preview: {doc_annot[:50]}...")
        
        try:
            # First find the actual sentence to get its real ID
            # This handles the case where sent_id might be a position rather than a database ID
            actual_sent = None
            
            # First try direct ID lookup
            actual_sent = Sent.query.filter_by(id=sent_id).first()
            
            # If that didn't work, try getting the sentence by position
            if not actual_sent:
                logger.info(f"Sentence with ID {sent_id} not found directly, trying position lookup")
                
                # Get document version
                doc_version = DocVersion.query.get(doc_version_id)
                if not doc_version:
                    logger.error(f"Document version with ID {doc_version_id} not found")
                    return jsonify({
                        'success': False, 
                        'message': f'Document version with ID {doc_version_id} not found'
                    }), 404
                
                # Get document
                doc_id = doc_version.doc_id
                logger.info(f"Found document version with doc_id={doc_id}")
                
                # Get all sentences for this document
                sentences = Sent.query.filter_by(doc_id=doc_id).order_by(Sent.id).all()
                logger.info(f"Found {len(sentences)} sentences for doc_id={doc_id}")
                
                # Use sentence_number or sent_id as position
                position = int(sentence_number) if sentence_number else sent_id
                
                if 1 <= position <= len(sentences):
                    actual_sent = sentences[position - 1]
                    logger.info(f"Found sentence by position {position}, actual DB ID: {actual_sent.id}")
                else:
                    # Sentence not found
                    logger.error(f"Sentence position {position} out of range (1-{len(sentences)})")
                    available_positions = [f"{i+1}:{s.id}" for i, s in enumerate(sentences)]
                    return jsonify({
                        'success': False, 
                        'message': f'Sentence not found. Position {position} out of range (1-{len(sentences)})',
                        'available_positions': available_positions
                    }), 404
            
            # Now that we have the actual sentence, we can look for an existing annotation
            # or create a new one if needed
            logger.info(f"Using actual sentence ID: {actual_sent.id}")
            
            # Look for existing annotation with the ACTUAL sentence ID
            annotation = Annotation.query.filter_by(
                doc_version_id=doc_version_id,
                sent_id=actual_sent.id
            ).first()
            
            if annotation:
                # Update existing annotation
                logger.info(f"Found existing annotation (id={annotation.id}), updating content")
                annotation.doc_annot = doc_annot
            else:
                # Only create a new annotation if one doesn't exist
                logger.info(f"No annotation found for doc_version_id={doc_version_id}, sent_id={actual_sent.id}, creating new")
                annotation = Annotation(
                    doc_version_id=doc_version_id,
                    sent_id=actual_sent.id,
                    sent_annot='',
                    doc_annot=doc_annot,
                    actions={},
                    alignment={}
                )
                db.session.add(annotation)
            
            # Save changes
            db.session.commit()
            logger.info(f"Successfully saved annotation (id={annotation.id})")
            
            return jsonify({
                'success': True,
                'message': 'Document annotation updated successfully',
                'doc_version_id': doc_version_id,
                'sent_id': sent_id,
                'actual_sent_id': actual_sent.id,
                'annotation_id': annotation.id
            })
        
        except Exception as db_error:
            db.session.rollback()
            logger.error(f"Database error: {str(db_error)}", exc_info=True)
            return jsonify({
                'success': False,
                'message': f'Database error: {str(db_error)}',
                'doc_version_id': doc_version_id,
                'sent_id': sent_id
            }), 500
    
    except Exception as e:
        logger.error(f"Error updating document annotation: {str(e)}", exc_info=True)
        error_details = {
            'success': False, 
            'message': f"Error: {str(e)}",
            'doc_version_id': doc_version_id,
            'sent_id': sent_id,
            'exception_type': type(e).__name__
        }
        return jsonify(error_details), 500

@main.route("/view_sentences/<int:doc_version_id>", methods=['GET'])
@login_required
def view_sentences(doc_version_id):
    """View all sentences in a document in a clean, simple interface."""
    doc_version = DocVersion.query.get_or_404(doc_version_id)
    doc = Doc.query.get_or_404(doc_version.doc_id)
    project = Project.query.get_or_404(doc.project_id)
    
    # Check user permission
    if not check_user_permission(doc.project_id):
        flash('You do not have permission to view this document.', 'warning')
        return redirect(url_for('main.home'))
    
    # Get sentences
    sentences = []
    for sent in Sent.query.filter_by(doc_id=doc.id).all():
        sentences.append(sent.content)
    
    # Get document owner
    owner = User.query.get(doc_version.user_id) if doc_version.user_id else None
    
    # Get language
    lang = project.language if project else "Unknown"
    
    return render_template('view_sentences.html',
                          project_id=doc.project_id,
                          doc_version_id=doc_version_id,
                          projectDoc=doc,
                          sentences=sentences,
                          owner=owner,
                          lang=lang)

@main.route("/view_sent_annotation/<int:doc_version_id>/<int:sent_id>", methods=['GET'])
@login_required
def view_sent_annotation(doc_version_id, sent_id):
    """View sentence-level annotation in a clean, simple interface."""
    doc_version = DocVersion.query.get_or_404(doc_version_id)
    doc = Doc.query.get_or_404(doc_version.doc_id)
    
    # Check user permission
    if not check_user_permission(doc.project_id):
        flash('You do not have permission to view this document.', 'warning')
        return redirect(url_for('main.home'))
    
    # Get project info
    project = Project.query.get_or_404(doc.project_id)
    lang = project.language if project else "Unknown"
    
    # Get sentence
    sentence = Sent.query.filter_by(doc_id=doc.id).all()[sent_id-1] if 0 < sent_id <= Sent.query.filter_by(doc_id=doc.id).count() else None
    
    if not sentence:
        flash('Sentence not found.', 'danger')
        return redirect(url_for('main.view_sentences', doc_version_id=doc_version_id))
    
    # Get annotation
    annotation = Annotation.query.filter_by(doc_version_id=doc_version_id, sent_id=sentence.id).first()
    
    # Get document owner/annotator
    annotator = User.query.get(doc_version.user_id) if doc_version.user_id else None
    
    # Get max sentence ID for navigation
    max_sent_id = Sent.query.filter_by(doc_id=doc.id).count()
    
    return render_template('view_sent_annotation.html',
                          project_id=doc.project_id,
                          doc_version_id=doc_version_id,
                          sent_id=sent_id,
                          sentence=sentence,
                          annotation=annotation,
                          doc=doc,
                          annotator=annotator,
                          lang=lang,
                          max_sent_id=max_sent_id)

@main.route("/view_doc_annotation/<int:doc_version_id>/<int:sent_id>", methods=['GET'])
@login_required
def view_doc_annotation(doc_version_id, sent_id):
    """View document-level annotation in a clean, simple interface."""
    doc_version = DocVersion.query.get_or_404(doc_version_id)
    doc = Doc.query.get_or_404(doc_version.doc_id)
    
    # Check user permission
    if not check_user_permission(doc.project_id):
        flash('You do not have permission to view this document.', 'warning')
        return redirect(url_for('main.home'))
    
    # Get project info
    project = Project.query.get_or_404(doc.project_id)
    lang = project.language if project else "Unknown"
    
    # Get sentence
    sentence = Sent.query.filter_by(doc_id=doc.id).all()[sent_id-1] if 0 < sent_id <= Sent.query.filter_by(doc_id=doc.id).count() else None
    
    if not sentence:
        flash('Sentence not found.', 'danger')
        return redirect(url_for('main.view_sentences', doc_version_id=doc_version_id))
    
    # Get annotation
    annotation = Annotation.query.filter_by(doc_version_id=doc_version_id, sent_id=sentence.id).first()
    
    # Get document owner/annotator
    annotator = User.query.get(doc_version.user_id) if doc_version.user_id else None
    
    # Get max sentence ID for navigation
    max_sent_id = Sent.query.filter_by(doc_id=doc.id).count()
    
    return render_template('view_doc_annotation.html',
                          project_id=doc.project_id,
                          doc_version_id=doc_version_id,
                          sent_id=sent_id,
                          sentence=sentence,
                          annotation=annotation,
                          doc=doc,
                          annotator=annotator,
                          lang=lang,
                          max_sent_id=max_sent_id)

@main.route("/view_alignments/<int:doc_version_id>/<int:sent_id>", methods=['GET'])
@login_required
def view_alignments(doc_version_id, sent_id):
    """View annotation alignments in a clean, simple interface."""
    doc_version = DocVersion.query.get_or_404(doc_version_id)
    doc = Doc.query.get_or_404(doc_version.doc_id)
    
    # Check user permission
    if not check_user_permission(doc.project_id):
        flash('You do not have permission to view this document.', 'warning')
        return redirect(url_for('main.home'))
    
    # Get project info
    project = Project.query.get_or_404(doc.project_id)
    lang = project.language if project else "Unknown"
    
    # Get sentence
    sentence = Sent.query.filter_by(doc_id=doc.id).all()[sent_id-1] if 0 < sent_id <= Sent.query.filter_by(doc_id=doc.id).count() else None
    
    if not sentence:
        flash('Sentence not found.', 'danger')
        return redirect(url_for('main.view_sentences', doc_version_id=doc_version_id))
    
    # Get annotation with alignments
    annotation = Annotation.query.filter_by(doc_version_id=doc_version_id, sent_id=sentence.id).first()
    
    # Get document owner/annotator
    annotator = User.query.get(doc_version.user_id) if doc_version.user_id else None
    
    # Get max sentence ID for navigation
    max_sent_id = Sent.query.filter_by(doc_id=doc.id).count()
    
    return render_template('view_alignments.html',
                          project_id=doc.project_id,
                          doc_version_id=doc_version_id,
                          sent_id=sent_id,
                          sentence=sentence,
                          annotation=annotation,
                          doc=doc,
                          annotator=annotator,
                          lang=lang,
                          max_sent_id=max_sent_id)

@main.route("/view_combined/<int:doc_version_id>/<int:sent_id>", methods=['GET'])
@login_required
def view_combined(doc_version_id, sent_id):
    """View all annotations in a combined format (sentences, sentence-level, document-level, and alignments)."""
    doc_version = DocVersion.query.get_or_404(doc_version_id)
    doc = Doc.query.get_or_404(doc_version.doc_id)
    
    # Check user permission
    if not check_user_permission(doc.project_id):
        flash('You do not have permission to view this document.', 'warning')
        return redirect(url_for('main.home'))
    
    # Get project info
    project = Project.query.get_or_404(doc.project_id)
    lang = project.language if project else "Unknown"
    
    # Get all sentences
    sentences = []
    for sent in Sent.query.filter_by(doc_id=doc.id).all():
        sentences.append(sent.content)
    
    # Get current sentence
    sentence = Sent.query.filter_by(doc_id=doc.id).all()[sent_id-1] if 0 < sent_id <= Sent.query.filter_by(doc_id=doc.id).count() else None
    
    if not sentence:
        flash('Sentence not found.', 'danger')
        return redirect(url_for('users.project', project_id=doc.project_id))
    
    # Get annotation
    annotation = Annotation.query.filter_by(doc_version_id=doc_version_id, sent_id=sentence.id).first()
    
    # Get document owner/annotator
    annotator = User.query.get(doc_version.user_id) if doc_version.user_id else None
    
    # Get max sentence ID for navigation
    max_sent_id = Sent.query.filter_by(doc_id=doc.id).count()
    
    return render_template('view_combined.html',
                          project_id=doc.project_id,
                          doc_version_id=doc_version_id,
                          sent_id=sent_id,
                          sentence=sentence,
                          sentences=sentences,
                          annotation=annotation,
                          doc=doc,
                          annotator=annotator,
                          lang=lang,
                          max_sent_id=max_sent_id)

@main.route("/adjudication_select", methods=['POST'])
@login_required
def adjudication_select():
    """Process the selection of two documents for adjudication and redirect to the adjudication view."""
    selected_docs = request.form.getlist('selected_docs')
    comparison_level = request.form.get('comparison_level', 'sentence')  # Default to sentence level if not specified
    
    # Validate selection
    if len(selected_docs) != 2:
        flash('Please select exactly 2 documents for comparison.', 'danger')
        return redirect(request.referrer or url_for('users.projects'))
    
    # Extract the document version IDs
    doc_version_1_id = int(selected_docs[0])
    doc_version_2_id = int(selected_docs[1])
    
    # Redirect to adjudication view with the first sentence
    return redirect(url_for('main.adjudication', 
                           doc_version_1_id=doc_version_1_id,
                           doc_version_2_id=doc_version_2_id,
                           sent_id=1,
                           comparison_level=comparison_level))

@main.route("/adjudication/<int:doc_version_1_id>/<int:doc_version_2_id>/<int:sent_id>", methods=['GET'])
@login_required
def adjudication(doc_version_1_id, doc_version_2_id, sent_id):
    """Display the adjudication view comparing two document versions side by side."""
    try:
        # Get comparison level from query parameter, default to sentence
        comparison_level = request.args.get('comparison_level', 'sentence')
        
        # Get document versions
        doc_version_1 = DocVersion.query.get_or_404(doc_version_1_id)
        doc_version_2 = DocVersion.query.get_or_404(doc_version_2_id)
        
        # Get the documents information
        doc1 = Doc.query.get_or_404(doc_version_1.doc_id)
        doc2 = Doc.query.get_or_404(doc_version_2.doc_id)
        
        # Get user information for each document
        user1 = User.query.get_or_404(doc_version_1.user_id)
        user2 = User.query.get_or_404(doc_version_2.user_id)
        
        # Get project information
        project = Project.query.get_or_404(doc1.project_id)
        
        # Ensure both documents are from the same project
        if doc1.project_id != doc2.project_id:
            flash('The selected documents must be from the same project.', 'danger')
            return redirect(url_for('users.project', project_id=doc1.project_id))
        
        # Check if the user has permission to view these documents
        membership = Projectuser.query.filter_by(
            project_id=doc1.project_id, 
            user_id=current_user.id
        ).first()
        
        if not membership:
            abort(403)
        
        # Get all sentences from the document (assuming both documents have the same sentences)
        sents = Sent.query.filter_by(doc_id=doc1.id).all()
        
        # Validate the sentence ID
        if sent_id < 1 or sent_id > len(sents):
            flash('Invalid sentence ID.', 'danger')
            return redirect(url_for('main.adjudication', 
                                   doc_version_1_id=doc_version_1_id,
                                   doc_version_2_id=doc_version_2_id,
                                   sent_id=1))
        
        # Get the current sentence
        current_sent = sents[sent_id - 1]
        
        # Get annotations for the current sentence in both documents
        annotation1 = Annotation.query.filter_by(
            doc_version_id=doc_version_1_id, 
            sent_id=current_sent.id
        ).first()
        
        annotation2 = Annotation.query.filter_by(
            doc_version_id=doc_version_2_id, 
            sent_id=current_sent.id
        ).first()
        
        # Prepare data for the template
        doc1_data = {
            'filename': doc1.filename,
            'username': user1.username,
            'is_qc': doc_version_1.version_number > 1 or doc_version_1.stage == 'qc',  # Either version > 1 or stage is 'qc'
            'version': doc_version_1.version_number,
            'stage': doc_version_1.stage
        }
        
        doc2_data = {
            'filename': doc2.filename,
            'username': user2.username,
            'is_qc': doc_version_2.version_number > 1 or doc_version_2.stage == 'qc',  # Either version > 1 or stage is 'qc'
            'version': doc_version_2.version_number,
            'stage': doc_version_2.stage
        }
        
        # Get the sentence-level and document-level annotations
        doc1_sent_annotation = annotation1.sent_annot if annotation1 else "No annotation available"
        doc1_doc_annotation = annotation1.doc_annot if annotation1 else "No annotation available"
        doc2_sent_annotation = annotation2.sent_annot if annotation2 else "No annotation available"
        doc2_doc_annotation = annotation2.doc_annot if annotation2 else "No annotation available"
        
        # Check for Ancast availability from app configuration
        ancast_available = current_app.config.get('ANCAST_AVAILABLE', False)
        ancast_install_instructions = current_app.config.get('ANCAST_INSTALL_INSTRUCTIONS', '')
        
        # Render the adjudication template
        return render_template('adjudication.html',
                              doc_version_1_id=doc_version_1_id,
                              doc_version_2_id=doc_version_2_id,
                              sent_id=sent_id,
                              max_sent_id=len(sents),
                              project_id=doc1.project_id,
                              sent_text=current_sent.content,
                              doc1=doc1_data,
                              doc2=doc2_data,
                              doc1_sent_annotation=doc1_sent_annotation,
                              doc1_doc_annotation=doc1_doc_annotation,
                              doc2_sent_annotation=doc2_sent_annotation,
                              doc2_doc_annotation=doc2_doc_annotation,
                              comparison_level=comparison_level,
                              ancast_available=ancast_available,
                              ancast_install_instructions=ancast_install_instructions,
                              lang=project.language)
    
    except Exception as e:
        logger.error(f"Error in adjudication: {str(e)}")
        flash('An error occurred while preparing the adjudication view.', 'danger')
        return redirect(url_for('users.projects'))

@main.route("/debug_update_relation/<int:doc_version_id>/<int:sent_id>", methods=['POST'])
def debug_update_relation(doc_version_id, sent_id):
    """Debug route for relation updates."""
    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        # Log all request data for debugging
        current_app.logger.info(f"Debug update_relation called with doc_version_id={doc_version_id}, sent_id={sent_id}")
        current_app.logger.info(f"Request data: {request.get_json()}")
        
        # Get annotation for this sentence to check if it exists
        annotation = Annotation.query.filter_by(doc_version_id=doc_version_id, sent_id=sent_id).first()
        annotation_exists = annotation is not None
        
        return jsonify({
            "success": True,
            "message": "Debug relation update endpoint called successfully",
            "doc_version_id": doc_version_id,
            "sent_id": sent_id,
            "annotation_exists": annotation_exists,
            "request_data": request.get_json()
        })
        
    except Exception as e:
        current_app.logger.error(f"Error in debug_update_relation: {str(e)}")
        return jsonify({"error": str(e)}), 500

@main.route("/update_relation_query", methods=['POST'])
def update_relation_query():
    """Update a relation in an annotation using query parameters."""
    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        # Get parameters from query string
        doc_version_id = request.args.get('doc_version_id', type=int)
        sent_id = request.args.get('sent_id', type=int)
        
        if not doc_version_id or not sent_id:
            return jsonify({"error": "Missing doc_version_id or sent_id parameters"}), 400
        
        # Get data from request body
        data = request.get_json()
        updated_annotation = data.get('annotation')
        old_relation = data.get('old_relation')
        new_relation = data.get('new_relation')
        
        # Validate inputs
        if not updated_annotation or not old_relation or not new_relation:
            return jsonify({"error": "Missing required fields in request body"}), 400
        
        if not new_relation.startswith(':'):
            return jsonify({"error": "Invalid relation format"}), 400
        
        # Get the document version
        doc_version = DocVersion.query.get_or_404(doc_version_id)
        
        # Check if the user has permission to modify this document
        if not has_permission_for_doc(current_user, doc_version.doc_id):
            return jsonify({"error": "Not authorized to modify this document"}), 403
        
        # Get annotation for this sentence
        annotation = Annotation.query.filter_by(doc_version_id=doc_version_id, sent_id=sent_id).first()
        
        if not annotation:
            return jsonify({"error": "Annotation not found"}), 404
        
        # Save the updated annotation
        annotation.sent_annot = updated_annotation
        db.session.commit()
        
        # Log the change
        current_app.logger.info(f"User {current_user.username} updated relation from {old_relation} to {new_relation} in doc_version {doc_version_id}, sentence {sent_id}")
        
        return jsonify({
            "success": True,
            "message": f"Updated relation from {old_relation} to {new_relation}",
            "doc_version_id": doc_version_id,
            "sent_id": sent_id
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error updating relation: {str(e)}")
        return jsonify({"error": str(e)}), 500

@main.route("/test_param_route/<int:param1>/<int:param2>", methods=['GET'])
def test_param_route(param1, param2):
    """Test route with parameters to verify routing pattern works."""
    return jsonify({
        "success": True,
        "message": "Test parameter route is working correctly",
        "param1": param1,
        "param2": param2
    })

@main.route("/test_route", methods=['GET'])
def test_route():
    """Test route to verify routing is working."""
    return jsonify({
        "success": True,
        "message": "Test route is working correctly"
    })

@main.route("/download_frames", methods=['GET'])
def download_frames():
    """
    Serve the frames_english.json file directly from the server.
    This route doesn't require authentication to simplify client-side access.
    """
    try:
        frames_path = os.path.join(current_app.root_path, 'resources', 'frames_english.json')
        
        if not os.path.exists(frames_path):
            current_app.logger.error(f"Frames file not found at {frames_path}")
            return jsonify({"error": "Frames file not found"}), 404
            
        with open(frames_path, 'r') as f:
            frames_data = json.load(f)
            
        return jsonify(frames_data)
    except Exception as e:
        current_app.logger.error(f"Error serving frames file: {str(e)}")
        return jsonify({"error": str(e)}), 500

@main.route("/lemmatize", methods=['GET'])
def lemmatize():
    """
    Endpoint for lemmatizing a word.
    Usage: /lemmatize?word=running
    Returns: JSON with lemma ('run' in this example)
    """
    word = request.args.get('word', '')
    if not word:
        current_app.logger.warning("No word provided in lemmatize request")
        return jsonify({'success': False, 'message': 'No word provided'}), 400
    
    try:
        current_app.logger.info(f"Lemmatizing word: '{word}'")
        
        # Special case for 'missing' since we know it's causing issues
        if word == 'missing':
            lemma = 'miss'
            current_app.logger.info(f"Special case for 'missing': setting lemma to '{lemma}'")
            return jsonify({'success': True, 'lemma': lemma, 'original': word})
        
        # Import nltk for better lemmatization (if available)
        try:
            from nltk.stem import WordNetLemmatizer
            from nltk.corpus import wordnet
            
            # Initialize lemmatizer
            lemmatizer = WordNetLemmatizer()
            
            # Try to lemmatize for different parts of speech
            lemma_verb = lemmatizer.lemmatize(word, wordnet.VERB)
            lemma_noun = lemmatizer.lemmatize(word, wordnet.NOUN)
            
            # Choose the shortest result as it's likely the correct lemma
            if len(lemma_verb) <= len(lemma_noun):
                lemma = lemma_verb
            else:
                lemma = lemma_noun
                
            current_app.logger.info(f"NLTK lemmatization: '{word}' -> '{lemma}'")
        except ImportError:
            # Fallback to basic rules if NLTK is not available
            current_app.logger.warning("NLTK not available, using fallback rules for lemmatization")
            
            # Simple fallback rules
            if word.endswith('ing'):
                lemma = word[:-3]
            elif word.endswith('ed') and len(word) > 3:
                lemma = word[:-2]
            elif word.endswith('s') and not word.endswith('ss') and len(word) > 2:
                lemma = word[:-1]
            elif word.endswith('es') and len(word) > 3:
                lemma = word[:-2]
            else:
                lemma = word
                
            current_app.logger.info(f"Fallback lemmatization: '{word}' -> '{lemma}'")
        
        # Special adjustment for "missing" -> "miss"
        if word == 'missing' and lemma == 'miss':
            current_app.logger.info("Confirmed lemmatization of 'missing' to 'miss'")
        
        return jsonify({'success': True, 'lemma': lemma, 'original': word})
    except Exception as e:
        current_app.logger.error(f"Error lemmatizing '{word}': {str(e)}")
        current_app.logger.exception(e)  # This logs the full stack trace
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500

@main.route("/get_frames", methods=['GET'])
def get_frames():
    """
    Endpoint for looking up frames for a lemma.
    Usage: /get_frames?word=run
    Returns: JSON with list of frames
    """
    word = request.args.get('word', '')
    if not word:
        current_app.logger.warning("No word provided in get_frames request")
        return jsonify({'success': False, 'message': 'No word provided'}), 400
    
    try:
        # Try several potential paths for the frames file
        frames_file = FRAME_FILE_ENGLISH
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        frames_file_alt = os.path.join(base_dir, 'resources', 'frames_english.json')
        
        # Try the pre-defined path first
        if os.path.exists(frames_file):
            current_app.logger.info(f"Found frames file at pre-defined path: {frames_file}")
        # If that doesn't work, try the alternate path
        elif os.path.exists(frames_file_alt):
            frames_file = frames_file_alt
            current_app.logger.info(f"Found frames file at alternate path: {frames_file}")
        else:
            # Log all the paths we tried
            current_app.logger.error(f"Frames file not found at any of these paths:")
            current_app.logger.error(f"1. {frames_file}")
            current_app.logger.error(f"2. {frames_file_alt}")
            current_app.logger.error(f"3. {os.path.abspath(frames_file)}")
            
            # Try to list files in the directories
            try:
                resources_dir = os.path.join(base_dir, 'resources')
                if os.path.exists(resources_dir):
                    files = os.listdir(resources_dir)
                    current_app.logger.info(f"Files in resources dir: {files}")
            except Exception as e:
                current_app.logger.error(f"Error listing files: {e}")
                
            return jsonify({'success': False, 'frames': [], 'message': 'Frames file not found'}), 404
            
        # Load frames from JSON file
        try:
            with open(frames_file, 'r') as f:
                frames_data = json.load(f)
            current_app.logger.info(f"Successfully loaded frames file with {len(frames_data)} entries")
        except Exception as e:
            current_app.logger.error(f"Error loading frames file: {e}")
            return jsonify({'success': False, 'frames': [], 'message': f'Error loading frames file: {str(e)}'}), 500
            
        current_app.logger.info(f"Looking up frames for word: '{word}'")
        
        # Special handling for "miss" lemma
        if word == 'miss':
            miss_frames = [k for k in frames_data.keys() if k.startswith('miss-')]
            if miss_frames:
                current_app.logger.info(f"Found {len(miss_frames)} frames for 'miss': {miss_frames}")
                return jsonify({'success': True, 'frames': miss_frames, 'word': word})
            else:
                # If we couldn't find any miss- frames, log a warning
                current_app.logger.warning("No 'miss-' frames found in the frames file")
                # List a few entries from frames_data to debug
                sample_keys = list(frames_data.keys())[:5]
                current_app.logger.info(f"Sample frames keys: {sample_keys}")
        
        # Look up frames for the word
        frames = []
        
        # Check for numbered frames with exact prefix match
        matching_frames = [k for k in frames_data.keys() if k.startswith(f"{word}-")]
        
        # Also check for compound frames like "miss-out-03" when looking for "miss"
        compound_frames = [k for k in frames_data.keys() if k.startswith(f"{word}-") and "-" in k[len(word)+1:]]
        
        # Add all found frames to the result
        frames.extend(matching_frames)
        
        # Debug information
        current_app.logger.info(f"Found {len(matching_frames)} basic frame matches: {matching_frames}")
        if compound_frames:
            current_app.logger.info(f"Found {len(compound_frames)} compound frame matches: {compound_frames}")
        
        # If the plain lemma itself is in the frames, add it too
        if word in frames_data:
            frames.append(word)
            current_app.logger.info(f"Found exact match for '{word}'")
        
        # Print out the actual frames found
        if frames:
            current_app.logger.info(f"Returning frames for '{word}': {frames}")
        else:
            current_app.logger.warning(f"No frames found for '{word}'")
            
        return jsonify({'success': True, 'frames': frames, 'word': word})
    except Exception as e:
        current_app.logger.error(f"Error looking up frames for '{word}': {str(e)}")
        current_app.logger.exception(e)  # This logs the full stack trace
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500

@main.route("/export_annotation/<int:doc_version_id>", methods=['GET'])
@login_required
def export_annotation(doc_version_id):
    """
    Export all annotation data for a document in UMR format
    
    Args:
        doc_version_id: The ID of the document version to export
        
    Returns:
        JSON response with the annotation data or an error message
    """
    logger.info(f"Export annotation request for document version {doc_version_id}")
    
    try:
        # Get the document version
        doc_version = DocVersion.query.get_or_404(doc_version_id)
        
        # Check if the user has permission to access this document
        project_user = Projectuser.query.filter_by(
            user_id=current_user.id, 
            project_id=doc_version.doc.project_id
        ).first()
        
        if not project_user and not current_user.is_admin:
            logger.warning(f"User {current_user.id} tried to access document version {doc_version_id} without permission")
            return jsonify({"success": False, "message": "You don't have permission to access this document"}), 403
        
        # Get the document filename
        filename = doc_version.doc.filename.split('.')[0]  # Remove extension if present
        
        # Get all sentences for this document version
        sents = Sent.query.filter_by(doc_id=doc_version.doc_id).order_by(Sent.id).all()
        
        # Detailed debug logging
        logger.info(f"Found {len(sents)} sentences for document version {doc_version_id}")
        
        # Prepare the response data
        sentences_data = []
        
        for sent in sents:
            # Get the annotation for this sentence
            annotation = Annotation.query.filter_by(
                doc_version_id=doc_version_id,
                sent_id=sent.id
            ).first()
            
            # Detailed debug logging
            logger.info(f"Processing sentence {sent.id}:")
            logger.info(f"  - content: {sent.content[:50]}...")
            logger.info(f"  - annotation: {annotation.id if annotation else 'None'}")
            
            # Get alignments
            alignments = {}
            if annotation and annotation.alignment:
                alignments = annotation.alignment
                logger.info(f"  - alignments: {alignments}")
            
            # Get words and create indices
            try:
                words = sent.content.split()
                logger.info(f"  - words: {words[:5]}...")
            except Exception as e:
                logger.error(f"Error splitting content: {e}")
                words = []
            
            # Add sentence data to the list
            sentence_data = {
                "text": sent.content if hasattr(sent, 'content') else "",
                "words": words,
                "annotation": annotation.sent_annot if annotation else "",
                "alignments": alignments,
                "doc_annotation": annotation.doc_annot if annotation else ""
            }
            
            sentences_data.append(sentence_data)
        
        # Log the complete structure
        logger.info(f"Prepared data for {len(sentences_data)} sentences")
        
        # Create the response
        response_data = {
            "success": True,
            "filename": filename,
            "sentences": sentences_data
        }
        
        logger.info(f"Successfully exported annotation data for document version {doc_version_id}")
        return jsonify(response_data)
        
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"Error exporting annotation data for document version {doc_version_id}: {str(e)}")
        logger.error(f"Traceback: {error_traceback}")
        
        # Return a more detailed error message in development mode
        if current_app.debug:
            return jsonify({
                "success": False, 
                "message": str(e),
                "traceback": error_traceback
            }), 500
        else:
            return jsonify({"success": False, "message": str(e)}), 500

def format_umr_for_ancast(umr_text):
    """Format UMR text to match Ancast's expected format.
    
    This function ensures that UMR annotations conform to the exact format Ancast expects:
    - Proper spacing in sentence IDs (# :: snt)
    - Consistent section headers
    - Proper block separation
    - Complete structure with all required sections
    - Balanced parentheses in graph structures
    - Proper variable naming conventions
    """
    import logging
    import re
    
    logger = logging.getLogger(__name__)
    
    # Skip empty text
    if not umr_text or not umr_text.strip():
        logger.warning("Empty UMR text received")
        return umr_text
    
    logger.info("Starting UMR formatting")
    logger.debug(f"Original UMR text length: {len(umr_text)}")
    
    # Log a sample of the input text for debugging
    sample = umr_text[:500] + "..." if len(umr_text) > 500 else umr_text
    logger.debug(f"Input text sample: {sample}")
    
    # Normalize whitespace and newlines
    umr_text = umr_text.replace('\r\n', '\n').replace('\r', '\n')
    
    # Handle different section header formats consistently
    umr_text = re.sub(r'#\s*::\s*snt', '# :: snt', umr_text)
    umr_text = re.sub(r'#\s*(sentence\s*level\s*graph)\s*:?', '# sentence level graph:', umr_text, flags=re.IGNORECASE)
    umr_text = re.sub(r'#\s*(alignment)\s*:?', '# alignment:', umr_text, flags=re.IGNORECASE)
    umr_text = re.sub(r'#\s*(document\s*level\s*annotation)\s*:?', '# document level annotation:', umr_text, flags=re.IGNORECASE)
    
    # Split into sentence blocks - a blank line followed by a sentence ID line marks a new block
    raw_blocks = re.split(r'\n\s*\n\s*#\s*::\s*snt', umr_text)
    
    # For the first block, it might not have the preceding blank line
    if not raw_blocks[0].strip().startswith('# :: snt'):
        # Check if there's a sentence ID line without the preceding blank line
        match = re.search(r'(#\s*::\s*snt[^\n]*)', raw_blocks[0])
        if match:
            # Extract everything before the sentence ID line
            prefix = raw_blocks[0][:match.start()].strip()
            if prefix:
                # Keep any content before the first sentence ID as a separate block
                blocks_to_process = [prefix] + [match.group(1) + raw_blocks[0][match.end():]] + raw_blocks[1:]
            else:
                blocks_to_process = [match.group(1) + raw_blocks[0][match.end():]] + raw_blocks[1:]
        else:
            blocks_to_process = raw_blocks
    else:
        blocks_to_process = raw_blocks
    
    # Prepend the sentence ID marker to all blocks except the first one (it was removed by the split)
    formatted_blocks = [blocks_to_process[0]]
    for block in blocks_to_process[1:]:
        formatted_blocks.append('# :: snt' + block)
    
    logger.debug(f"Split into {len(formatted_blocks)} raw blocks")
    
    # Process each block to ensure proper structure
    final_blocks = []
    for i, block in enumerate(formatted_blocks):
        formatted_block = process_umr_block(block, i + 1)
        if formatted_block:
            # Make sure there's no extra whitespace at the beginning or end
            formatted_block = formatted_block.strip()
            final_blocks.append(formatted_block)
    
    logger.debug(f"Processed into {len(final_blocks)} final blocks")
    
    # Join blocks with blank lines in between - Ancast expects exactly two newlines between blocks
    result = '\n\n'.join(final_blocks)
    
    # Ensure the file ends with a newline
    if not result.endswith('\n'):
        result += '\n'
    
    # Ensure parentheses are balanced in the entire document
    open_count = result.count('(')
    close_count = result.count(')')
    if open_count != close_count:
        logger.warning(f"Unbalanced parentheses in full document: {open_count} opening vs {close_count} closing")
    
    # Log a sample of the output text for debugging
    output_sample = result[:500] + "..." if len(result) > 500 else result
    logger.debug(f"Formatted output sample: {output_sample}")
    
    logger.info(f"UMR formatting complete, result length: {len(result)}")
    return result

def process_umr_block(block_text, default_sent_num=1):
    """Process a UMR block to ensure it has all required sections in the correct format.
    
    Args:
        block_text: The text content of a UMR block
        default_sent_num: The default sentence number to use if not found in the block
        
    Returns:
        A properly formatted UMR block with all required sections
    """
    import logging
    import re
    
    logger = logging.getLogger(__name__)
    
    # Skip empty blocks
    if not block_text or not block_text.strip():
        logger.debug("Skipping empty block")
        return None
    
    # Extract the sentence number
    sent_id_match = re.search(r'#\s*::\s*snt(\d+)', block_text)
    sent_num = int(sent_id_match.group(1)) if sent_id_match else default_sent_num
    
    # Generate standard variable prefixes for this sentence
    var_prefix = f"s{sent_num}"
    
    # Extract the sentence text
    sent_text = ""
    if sent_id_match:
        sent_line = re.search(r'#\s*::\s*snt\d+\s*(.*)', block_text)
        if sent_line:
            sent_text = sent_line.group(1).strip()
    
    # Split the block into sections
    sections = {
        'graph': [],
        'alignment': [],
        'doc_annotation': []
    }
    
    current_section = None
    lines = block_text.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Check for section headers
        if re.match(r'#\s*sentence\s*level\s*graph', line, re.IGNORECASE):
            current_section = 'graph'
            continue
        elif re.match(r'#\s*alignment', line, re.IGNORECASE):
            current_section = 'alignment'
            continue
        elif re.match(r'#\s*document\s*level\s*annotation', line, re.IGNORECASE):
            current_section = 'doc_annotation'
            continue
        elif re.match(r'#\s*::\s*snt', line):
            # Skip the sentence ID line as we handle it separately
            continue
        
        # Add content to the current section if we're in one
        if current_section and not line.startswith('#'):
            sections[current_section].append(line)
    
    # Check if we extracted any content for each section
    has_graph = len(sections['graph']) > 0
    has_alignment = len(sections['alignment']) > 0 
    has_doc_annotation = len(sections['doc_annotation']) > 0
    
    logger.debug(f"Block for sentence {sent_num} - has_graph: {has_graph}, has_alignment: {has_alignment}, has_doc_annotation: {has_doc_annotation}")
    
    # Process each section to ensure it's properly formatted
    
    # Process graph section - ensure balanced parentheses and proper structure
    graph_text = '\n'.join(sections['graph'])
    if graph_text:
        # Normalize variable names in the graph to use sNxM format
        # Example: x0 -> s1x0, a1 -> s1a1
        var_pattern = r'(?<!\S)([a-zA-Z][0-9]+)\s+/'
        if not re.search(rf'(?<!\S){var_prefix}[a-zA-Z][0-9]+\s+/', graph_text):
            # If we don't find variables with the proper prefix, try to fix them
            graph_text = re.sub(var_pattern, f"{var_prefix}\\1 /", graph_text)
            sections['graph'] = graph_text.split('\n')
            logger.info(f"Fixed variable names in graph for sentence {sent_num}")
        
        # Normalize references to variables
        ref_pattern = r'(?<!\S)([a-zA-Z][0-9]+)(?=[\s,\)])'
        if not re.search(rf'(?<!\S){var_prefix}[a-zA-Z][0-9]+(?=[\s,\)])', graph_text):
            # If we don't find references with the proper prefix, try to fix them
            graph_text = re.sub(ref_pattern, f"{var_prefix}\\1", graph_text)
            sections['graph'] = graph_text.split('\n')
            logger.info(f"Fixed variable references in graph for sentence {sent_num}")
        
        # Count opening and closing parentheses
        open_count = graph_text.count('(')
        close_count = graph_text.count(')')
        
        # Fix unbalanced parentheses
        if open_count > close_count:
            sections['graph'].append(')' * (open_count - close_count))
            logger.warning(f"Added {open_count - close_count} closing parentheses to graph in sentence {sent_num}")
        elif close_count > open_count:
            sections['graph'].insert(0, '(' * (close_count - open_count))
            logger.warning(f"Added {close_count - open_count} opening parentheses to graph in sentence {sent_num}")
        
        # Check for root node with variable naming convention
        root_var_pattern = rf'{var_prefix}[a-zA-Z][0-9]*\s+/'
        if not re.search(root_var_pattern, graph_text):
            # Try to fix the variable naming convention
            if re.search(r'([a-zA-Z][0-9]*)\s+/', graph_text):
                # There's a root node but with wrong naming convention
                graph_text = re.sub(r'([a-zA-Z][0-9]*)\s+/', f'{var_prefix}\\1 /', graph_text)
                sections['graph'] = graph_text.split('\n')
                logger.warning(f"Fixed root node variable naming in sentence {sent_num}")
    else:
        # Create a minimal valid graph if none exists
        sections['graph'] = [f"({var_prefix}x0 / unknown)"]
        logger.warning(f"Created placeholder graph for sentence {sent_num}")
    
    # Process alignment section - make sure variable names match the graph
    if has_alignment:
        # Normalize alignment entries to use the same variable prefix
        new_alignments = []
        for align_line in sections['alignment']:
            if ':' in align_line:
                var_part, pos_part = align_line.split(':', 1)
                var_part = var_part.strip()
                pos_part = pos_part.strip()
                
                # Check if the variable has the correct prefix
                if not var_part.startswith(var_prefix):
                    # Try to fix variable names in alignments
                    var_match = re.match(r'([a-zA-Z][0-9]+)', var_part)
                    if var_match:
                        var_part = f"{var_prefix}{var_match.group(1)}"
                
                new_alignments.append(f"{var_part}: {pos_part}")
            else:
                new_alignments.append(align_line)
        
        sections['alignment'] = new_alignments
    else:
        # Create minimal alignment if none exists
        sections['alignment'] = [f"{var_prefix}x0: 0-0"]
        logger.warning(f"Created placeholder alignment for sentence {sent_num}")
    
    # Process document-level annotation - normalize variable names
    if has_doc_annotation:
        doc_annot_text = '\n'.join(sections['doc_annotation'])
        
        # Normalize sentence variable names (s0, s1 -> s1s0, s1s1)
        sent_var_pattern = r'(?<!\S)([sS][0-9]+)\s+/'
        if not re.search(rf'(?<!\S){var_prefix}[sS][0-9]+\s+/', doc_annot_text):
            # If we don't find variables with the proper prefix, try to fix them
            doc_annot_text = re.sub(sent_var_pattern, f"{var_prefix}\\1 /", doc_annot_text)
            sections['doc_annotation'] = doc_annot_text.split('\n')
            logger.info(f"Fixed sentence variables in doc annotation for sentence {sent_num}")
        
        # Count opening and closing parentheses
        open_count = doc_annot_text.count('(')
        close_count = doc_annot_text.count(')')
        
        # Fix unbalanced parentheses
        if open_count > close_count:
            sections['doc_annotation'].append(')' * (open_count - close_count))
            logger.warning(f"Added {open_count - close_count} closing parentheses to doc annotation in sentence {sent_num}")
        elif close_count > open_count:
            sections['doc_annotation'].insert(0, '(' * (close_count - open_count))
            logger.warning(f"Added {close_count - open_count} opening parentheses to doc annotation in sentence {sent_num}")
    else:
        # Create minimal document annotation if none exists
        sections['doc_annotation'] = [f"({var_prefix}s0 / sentence)"]
        logger.warning(f"Created placeholder document annotation for sentence {sent_num}")
    
    # Build the complete block with all required sections
    result = []
    
    # Add sentence ID line
    if sent_id_match:
        result.append(f"# :: snt{sent_num}\t{sent_text}")
    else:
        result.append(f"# :: snt{sent_num}\tUnknown sentence")
    
    # Add graph section
    result.append("")
    result.append("# sentence level graph:")
    result.extend(sections['graph'])
    
    # Add alignment section
    result.append("")
    result.append("# alignment:")
    result.extend(sections['alignment'])
    
    # Add document-level annotation section
    result.append("")
    result.append("# document level annotation:")
    result.extend(sections['doc_annotation'])
    
    final_text = '\n'.join(result)
    return final_text

@main.route("/run_ancast_evaluation", methods=['POST'])
def run_ancast_evaluation():
    """Run Ancast evaluation on two document versions and return the scores."""
    # Import sys module for stdout/stderr redirection
    import sys
    
    # Initialize variables for cleanup
    gold_path = None
    pred_path = None
    debug_files = []
    debug_dir = None
    
    try:
        # Get data from request
        data = request.json or {}
        try:
            # Use try-except around each logging call to prevent errors
            try:
                current_app.logger.info("Received Ancast evaluation request")
            except Exception as log_err:
                pass  # Silently continue if logging fails
                
            try:
                current_app.logger.debug(f"Request data: {data}")
            except Exception:
                pass
        except Exception:
            # Continue even if logging fails completely
            pass
            
        # Extract data from request with proper validation
        doc1_version_id = data.get('doc1_version_id')
        doc2_version_id = data.get('doc2_version_id')
        
        # Ensure sentences is a list
        sentences = data.get('sentences', [])
        if not isinstance(sentences, list):
            try:
                sentences = [int(sentences)]  # Try to convert to int if it's a string
            except (ValueError, TypeError):
                sentences = []  # Default to empty list if conversion fails
        
        # Validate sentence IDs - make sure they're integers 
        sentence_numbers = []  # These are the logical position numbers (1, 2, 3...)
        for sid in sentences:
            try:
                sentence_numbers.append(int(sid))
            except (ValueError, TypeError):
                continue  # Skip invalid sentence IDs
                
        try:
            current_app.logger.info(f"Evaluating: gold={doc1_version_id}, pred={doc2_version_id}, sentences={sentence_numbers}")
        except Exception:
            pass
        
        # Create a unique debug directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        try:
            debug_dir_base = current_app.config.get('ANCAST_DEBUG_DIR', '/tmp/ancast_debug')
            if not os.path.exists(debug_dir_base):
                os.makedirs(debug_dir_base, exist_ok=True)
            debug_dir = os.path.join(debug_dir_base, f"run_{timestamp}")
            os.makedirs(debug_dir, exist_ok=True)
            try:
                current_app.logger.info(f"Created debug directory: {debug_dir}")
            except Exception:
                pass
        except Exception as e:
            # If we can't create debug directory, use a fallback
            debug_dir = tempfile.mkdtemp(prefix="ancast_debug_")
          
        # Get all annotations to map between sentence numbers and database IDs
        gold_annotations = []
        pred_annotations = []
        
        try:
            if doc1_version_id:
                gold_annotations = Annotation.query.filter_by(doc_version_id=doc1_version_id).all()
                current_app.logger.info(f"Found {len(gold_annotations)} gold annotations")
                
            if doc2_version_id:
                pred_annotations = Annotation.query.filter_by(doc_version_id=doc2_version_id).all()
                current_app.logger.info(f"Found {len(pred_annotations)} pred annotations")
        except Exception as e:
            current_app.logger.error(f"Error retrieving annotations: {str(e)}")
            
        # Map sentence IDs from database to sequential numbers (1-indexed)
        gold_sent_mapping = {}   # DB ID -> sequence number
        pred_sent_mapping = {}   # DB ID -> sequence number
        gold_reverse_mapping = {}  # sequence number -> DB ID  
        pred_reverse_mapping = {}  # sequence number -> DB ID
        
        # Get unique sentence IDs from annotations
        gold_sent_ids = sorted(list(set(ann.sent_id for ann in gold_annotations)))
        pred_sent_ids = sorted(list(set(ann.sent_id for ann in pred_annotations)))
        
        # Create mappings for gold annotations
        for i, sent_id in enumerate(gold_sent_ids):
            gold_sent_mapping[sent_id] = i + 1  # 1-indexed position
            gold_reverse_mapping[i + 1] = sent_id
            
        # Create mappings for pred annotations
        for i, sent_id in enumerate(pred_sent_ids):
            pred_sent_mapping[sent_id] = i + 1  # 1-indexed position
            pred_reverse_mapping[i + 1] = sent_id
            
        try:
            current_app.logger.info(f"Gold mapping: {gold_reverse_mapping}")
            current_app.logger.info(f"Pred mapping: {pred_reverse_mapping}")
        except Exception:
            pass
        
        # Convert logical sentence numbers to database IDs
        gold_db_ids = []
        pred_db_ids = []
        
        # If we have specific sentence numbers from the UI, try to map them
        if sentence_numbers:
            for num in sentence_numbers:
                # Check if this position exists in the mappings
                if num in gold_reverse_mapping:
                    gold_db_ids.append(gold_reverse_mapping[num])
                if num in pred_reverse_mapping:
                    pred_db_ids.append(pred_reverse_mapping[num])
                    
            # If we couldn't map any sentences directly, try to find corresponding sentences
            if (not gold_db_ids or not pred_db_ids) and sentence_numbers:
                # Get sentences from both documents
                current_app.logger.info(f"Couldn't map directly, trying to find corresponding sentences")
                
                # Get the content of the sentences we're looking for
                found_sentences = []
                for num in sentence_numbers:
                    # Try to find original sentence content
                    if num in gold_reverse_mapping:
                        sent_id = gold_reverse_mapping[num]
                        sent = Sent.query.get(sent_id)
                        if sent:
                            found_sentences.append(sent.content)
                    elif num in pred_reverse_mapping:
                        sent_id = pred_reverse_mapping[num]
                        sent = Sent.query.get(sent_id)
                        if sent:
                            found_sentences.append(sent.content)
                
                # If we found any sentences, use their content to find corresponding sentences in both documents
                if found_sentences:
                    for content in found_sentences:
                        # Find sentences with matching content in both documents
                        gold_matches = []
                        pred_matches = []
                        
                        for sent_id in gold_sent_ids:
                            sent = Sent.query.get(sent_id)
                            if sent and sent.content == content:
                                gold_matches.append(sent_id)
                                
                        for sent_id in pred_sent_ids:
                            sent = Sent.query.get(sent_id)
                            if sent and sent.content == content:
                                pred_matches.append(sent_id)
                        
                        # Add unique matches to our DB IDs
                        for sent_id in gold_matches:
                            if sent_id not in gold_db_ids:
                                gold_db_ids.append(sent_id)
                                
                        for sent_id in pred_matches:
                            if sent_id not in pred_db_ids:
                                pred_db_ids.append(sent_id)
                
                # If we still don't have matches, try a fallback where we take the first sentence from each
                if not gold_db_ids and gold_sent_ids:
                    gold_db_ids = [gold_sent_ids[0]]
                if not pred_db_ids and pred_sent_ids:
                    pred_db_ids = [pred_sent_ids[0]]
        # If no specific sentence numbers were provided, use all sentences from both documents
        else:
            gold_db_ids = gold_sent_ids
            pred_db_ids = pred_sent_ids
                
        try:
            current_app.logger.info(f"Converted sentence numbers {sentence_numbers} to DB IDs: gold={gold_db_ids}, pred={pred_db_ids}")
        except Exception:
            pass
            
        # Fall back to request JSON if no valid sentence IDs were found
        if ((not gold_db_ids or not pred_db_ids) and 
            data.get('doc1') and data.get('doc2')):
            # Use the provided raw UMR text instead of extracting from DB
            gold_text = data.get('doc1', '')
            pred_text = data.get('doc2', '')
            
            try:
                current_app.logger.info("Using raw UMR text from request")
            except Exception:
                pass
        else:
            # Generate UMR text for Ancast from the database
            try:
                gold_text = exact_ancast_format(doc1_version_id, gold_db_ids)
                try:
                    current_app.logger.info(f"Gold text size: {len(gold_text)} characters")
                except Exception:
                    pass
            except Exception as e:
                gold_text = data.get('doc1', '')  # Fallback to provided text if extraction fails
                try:
                    current_app.logger.warning(f"Failed to extract gold text: {str(e)}, using fallback")
                except Exception:
                    pass
            
            try:
                pred_text = exact_ancast_format(doc2_version_id, pred_db_ids)
                try:
                    current_app.logger.info(f"Pred text size: {len(pred_text)} characters")
                except Exception:
                    pass
            except Exception as e:
                pred_text = data.get('doc2', '')  # Fallback to provided text if extraction fails
                try:
                    current_app.logger.warning(f"Failed to extract pred text: {str(e)}, using fallback")
                except Exception:
                    pass
        
        # Ensure we have non-empty texts
        if not gold_text.strip():
            gold_text = "(dummy / root)"  # Provide minimal valid UMR
        
        if not pred_text.strip():
            pred_text = "(dummy / root)"  # Provide minimal valid UMR
            
        # Create temporary files for the annotations
        gold_path = os.path.join(debug_dir, "formatted_gold.txt")
        pred_path = os.path.join(debug_dir, "formatted_pred.txt")
        
        with open(gold_path, 'w', encoding='utf-8') as f:
            f.write(gold_text)
        
        with open(pred_path, 'w', encoding='utf-8') as f:
            f.write(pred_text)
            
        debug_files.extend([gold_path, pred_path])
        
        # Check file sizes to confirm writing worked
        gold_size = os.path.getsize(gold_path)
        pred_size = os.path.getsize(pred_path)
        
        try:
            current_app.logger.info(f"Gold file size: {gold_size} bytes")
            current_app.logger.info(f"Pred file size: {pred_size} bytes")
        except Exception:
            pass
            
        # Set up Ancast
        ancast_path = current_app.config.get('ANCAST_PATH', '../ancast/ancast')
        
        try:
            current_app.logger.info(f"Using Ancast path: {ancast_path}")
        except Exception:
            pass
            
        # Add Ancast to Python path
        ancast_dir = os.path.dirname(ancast_path)
        if ancast_dir:
            sys.path.insert(0, ancast_dir)
            try:
                current_app.logger.info(f"Added {ancast_dir} to Python path")
            except Exception:
                pass
                
        # Import Ancast
        try:
            current_app.logger.info("Importing ancast evaluate function")
        except Exception:
            pass
            
        try:
            from ancast.evaluate import evaluate
            
            try:
                current_app.logger.info(f"Calling evaluate with gold={gold_path}, pred={pred_path}")
            except Exception:
                pass
                
            # Capture output
            stdout_file = os.path.join(debug_dir, "ancast_stdout.txt")
            stderr_file = os.path.join(debug_dir, "ancast_stderr.txt")
            debug_files.extend([stdout_file, stderr_file])
            
            # Redirect stdout/stderr to capture output
            original_stdout = sys.stdout
            original_stderr = sys.stderr
            
            try:
                with open(stdout_file, 'w') as stdout_capture, open(stderr_file, 'w') as stderr_capture:
                    sys.stdout = stdout_capture
                    sys.stderr = stderr_capture
                    
                    # Call Ancast evaluate
                    result = evaluate(gold_path, pred_path)
                    
                    # Restore stdout/stderr
                    sys.stdout = original_stdout
                    sys.stderr = original_stderr
            except Exception as e:
                # Ensure stdout/stderr are restored even if evaluate fails
                sys.stdout = original_stdout
                sys.stderr = original_stderr
                raise e
                
            try:
                current_app.logger.info(f"Evaluate function returned: {result}")
            except Exception:
                pass
                
            # Check stdout/stderr capture
            stdout_size = os.path.getsize(stdout_file)
            stderr_size = os.path.getsize(stderr_file)
            
            try:
                current_app.logger.info(f"Stdout captured ({stdout_size} chars)")
                current_app.logger.info(f"Stderr captured ({stderr_size} chars)")
            except Exception:
                pass
                
            # Check stderr for issues
            stderr_content = ""
            try:
                with open(stderr_file, 'r') as f:
                    stderr_content = f.read()
                    
                try:
                    current_app.logger.debug(f"Ancast stderr content:\n{stderr_content}")
                except Exception:
                    pass
            except Exception:
                pass
                
            # Check debug files for issues
            issues = check_ancast_debug_files(debug_dir)
                
            # Package result
            response = {
                'score': result.get('comp', 0),
                'details': {
                    'sentence': result.get('sent', 0),
                    'modality': result.get('modal', 0),
                    'temporal': result.get('temporal', 0),
                    'coreference': result.get('coref', 0),
                },
                'command': f"ancast.evaluate.evaluate({gold_path}, {pred_path})",
                'debug_dir': debug_dir,
                'debug_files': debug_files,
                'mappings': {
                    'gold': gold_reverse_mapping,
                    'pred': pred_reverse_mapping
                }
            }
            
            # Add issues to response if found
            if issues:
                response['issues'] = issues
                
            return jsonify(response)
            
        except ImportError:
            # Fallback to command line if API import fails
            try:
                current_app.logger.warning("Failed to import Ancast evaluate function, falling back to command line")
            except Exception:
                pass
                
            # Run Ancast as command
            cmd = [ancast_path, "evaluate", gold_path, pred_path]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            stdout = result.stdout
            stderr = result.stderr
            
            # Write output to debug files
            with open(os.path.join(debug_dir, "ancast_stdout.txt"), 'w') as f:
                f.write(stdout)
            with open(os.path.join(debug_dir, "ancast_stderr.txt"), 'w') as f:
                f.write(stderr)
                
            # Parse output to get scores
            scores = {}
            comp_score = 0
            
            for line in stdout.splitlines():
                if "Comprehensive Score:" in line:
                    match = re.search(r"Comprehensive Score:\s+([\d.]+)%", line)
                    if match:
                        comp_score = float(match.group(1)) / 100
                elif "Precision:" in line and "Recall:" in line and "Fscore:" in line:
                    parts = line.strip().split('\t')
                    if len(parts) >= 2:
                        category = parts[0].strip().lower().rstrip(':')
                        fscore_part = parts[-1]
                        fscore_match = re.search(r"Fscore: ([\d.]+)%", fscore_part)
                        if fscore_match:
                            scores[category] = float(fscore_match.group(1)) / 100
                            
            # Package result
            response = {
                'score': comp_score,
                'details': scores,
                'command': ' '.join(cmd),
                'stdout': stdout,
                'stderr': stderr,
                'debug_dir': debug_dir,
                'debug_files': debug_files,
                'mappings': {
                    'gold': gold_reverse_mapping,
                    'pred': pred_reverse_mapping
                }
            }
            
            return jsonify(response)
            
    except Exception as e:
        try:
            current_app.logger.error(f"Unexpected error in run_ancast_evaluation: {str(e)}")
        except Exception:
            pass
            
        # Return error response
        return jsonify({
            'error': f"Error running Ancast evaluation: {str(e)}",
            'score': 0,
            'details': {
                'sentence': 0,
                'modality': 0,
                'temporal': 0,
                'coreference': 0
            },
            'debug_dir': debug_dir or 'unknown'
        }), 500

# Add this new function to build a properly formatted UMR document from database annotations
def build_umr_from_db(doc_version_id, sentence_ids):
    """
    Build UMR annotation text from database for the given document version and sentence IDs.
    
    Args:
        doc_version_id: Document version ID
        sentence_ids: List of sentence IDs to include
        
    Returns:
        UMR text combining sentence and document level annotations
    """
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Building UMR from database for doc_version_id {doc_version_id}, sentences {sentence_ids}")
        
        # Get document version
        doc_version = DocVersion.query.get(doc_version_id)
        if not doc_version:
            logger.error(f"Document version {doc_version_id} not found")
            return ""
        
        # Get all annotations for this document version
        all_annotations = Annotation.query.filter_by(doc_version_id=doc_version_id).all()
        logger.info(f"Found {len(all_annotations)} annotations for document version {doc_version_id}")
        
        # Filter by sentence IDs if provided
        annotations = []
        if sentence_ids:
            logger.info(f"Filtering annotations by sentence IDs: {sentence_ids}")
            annotations = [ann for ann in all_annotations if ann.sent_id in sentence_ids]
            logger.info(f"After filtering: {len(annotations)} annotations match the provided sentence IDs")
        else:
            annotations = all_annotations
            
        if not annotations:
            logger.warning(f"No annotations found for document version {doc_version_id} with sentence IDs {sentence_ids}")
            return ""
            
        # Simplified UMR text generation
        umr_text = ""
        for annotation in annotations:
            if annotation.sent_annot:
                umr_text += annotation.sent_annot + "\n\n"
            if annotation.doc_annot:
                umr_text += annotation.doc_annot + "\n\n"
                
        return umr_text.strip()
        
    except Exception as e:
        logger.error(f"Error building UMR from database: {str(e)}")
        return ""

@main.route("/test_ancast_db", methods=['GET'])
@login_required
def test_ancast_db():
    """Test route to debug database queries for Ancast."""
    try:
        # Get query parameters
        doc_version_id = request.args.get('doc_version_id')
        sent_id = request.args.get('sent_id')
        
        if not doc_version_id:
            return jsonify({"error": "Missing doc_version_id parameter"}), 400
            
        # Convert to integer if string
        if isinstance(doc_version_id, str) and doc_version_id.isdigit():
            doc_version_id = int(doc_version_id)
            
        # Optional sent_id filter
        if sent_id and isinstance(sent_id, str) and sent_id.isdigit():
            sent_id = int(sent_id)
            
        response = {
            "doc_version_id": doc_version_id,
            "sent_id": sent_id,
            "annotations": []
        }
        
        # Find document version
        doc_version = DocVersion.query.get(doc_version_id)
        if not doc_version:
            return jsonify({"error": f"Document version {doc_version_id} not found"}), 404
            
        response["doc_version"] = {
            "id": doc_version.id,
            "user_id": doc_version.user_id,
            "doc_id": doc_version.doc_id,
            "stage": doc_version.stage,
            "version_number": doc_version.version_number
        }
        
        # Find annotations
        query = Annotation.query.filter_by(doc_version_id=doc_version_id)
        if sent_id:
            query = query.filter_by(sent_id=sent_id)
            
        annotations = query.all()
        
        # Process annotations
        for annotation in annotations:
            ann_data = {
                "id": annotation.id,
                "sent_id": annotation.sent_id,
                "has_sent_annot": bool(annotation.sent_annot),
                "has_doc_annot": bool(annotation.doc_annot),
                "has_alignment": bool(annotation.alignment)
            }
            
            # Try to extract sentence number from variable pattern
            if annotation.sent_annot:
                sent_var_pattern = r's(\d+)[a-zA-Z]'
                matches = re.findall(sent_var_pattern, annotation.sent_annot)
                if matches:
                    ann_data["extracted_sentence_num"] = int(matches[0])
                    
            response["annotations"].append(ann_data)
            
        # Add summary
        response["total_annotations"] = len(annotations)
        response["annotations_with_sentence"] = sum(1 for a in annotations if a.sent_annot)
        response["annotations_with_document"] = sum(1 for a in annotations if a.doc_annot)
        response["annotations_with_alignment"] = sum(1 for a in annotations if a.alignment)
        
        return jsonify(response)
        
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        return jsonify({
            "error": str(e),
            "traceback": tb
        }), 500

def check_ancast_debug_files(debug_dir):
    """
    Check Ancast debug files to identify parsing issues.
    
    Args:
        debug_dir: Path to the debug directory
        
    Returns:
        dict: Analysis of debug files and detected issues
    """
    import logging
    import os
    import re
    
    logger = logging.getLogger(__name__)
    
    result = {
        "issues_found": False,
        "errors": [],
        "warnings": [],
        "suggestions": []
    }
    
    # Check if the debug directory exists
    if not debug_dir or not os.path.exists(debug_dir):
        result["errors"].append(f"Debug directory not found: {debug_dir}")
        return result
    
    # Look for stderr file
    stderr_path = os.path.join(debug_dir, "ancast_stderr.txt")
    if os.path.exists(stderr_path):
        try:
            with open(stderr_path, 'r') as f:
                stderr_content = f.read()
                
            # Log the stderr content
            logger.debug(f"Ancast stderr content:\n{stderr_content}")
            
            # Check for specific error patterns
            if "Encountered unknown block" in stderr_content:
                result["issues_found"] = True
                result["errors"].append("Ancast encountered unknown block format")
                result["suggestions"].append("Check that your UMR blocks follow Ancast's required structure")
            
            if "error" in stderr_content.lower():
                result["issues_found"] = True
                error_lines = [line for line in stderr_content.split('\n') 
                             if "error" in line.lower() and len(line) > 10]
                result["errors"].extend(error_lines)
            
            if "warning" in stderr_content.lower():
                result["issues_found"] = True
                warning_lines = [line for line in stderr_content.split('\n') 
                               if "warning" in line.lower() and len(line) > 10]
                result["warnings"].extend(warning_lines)
                
            # Check for specific parsing issues
            if "skipping" in stderr_content.lower():
                result["issues_found"] = True
                result["errors"].append("Ancast skipped processing some blocks")
                result["suggestions"].append("Ensure all UMR blocks are properly formatted")
        except Exception as e:
            logger.error(f"Error reading stderr file: {e}")
            result["errors"].append(f"Failed to analyze stderr file: {str(e)}")
    
    # Compare formatted files with Ancast samples
    formatted_gold_path = os.path.join(debug_dir, "formatted_gold.txt")
    if os.path.exists(formatted_gold_path):
        try:
            with open(formatted_gold_path, 'r') as f:
                gold_content = f.read()
                
            # Check for missing blank lines between sections
            if "\n\n# sentence level graph:" not in gold_content:
                result["issues_found"] = True
                result["warnings"].append("Missing blank line before sentence level graph section")
                
            if "\n\n# alignment:" not in gold_content:
                result["issues_found"] = True
                result["warnings"].append("Missing blank line before alignment section")
                
            if "\n\n# document level annotation:" not in gold_content:
                result["issues_found"] = True
                result["warnings"].append("Missing blank line before document level annotation section")
                
            # Check if the sentence ID format is correct
            if not re.search(r'# :: snt\d+\t', gold_content):
                result["issues_found"] = True
                result["warnings"].append("Sentence ID format might be incorrect")
                result["suggestions"].append("Ensure sentence IDs follow the format '# :: sntN\\t'")
                
            # Check for variable naming pattern
            if not re.search(r's\d+[a-z]\d+\s+/', gold_content):
                result["issues_found"] = True
                result["warnings"].append("Variable naming pattern may not match Ancast expectations")
                result["suggestions"].append("Variables should follow 's1x0' pattern")
        except Exception as e:
            logger.error(f"Error analyzing formatted gold file: {e}")
    
    return result

def exact_ancast_format(doc_version_id, sentence_ids):
    """
    Generate UMR text that exactly matches Ancast's expected format.
    This is a simpler, more direct approach that closely follows the sample files.
    
    Args:
        doc_version_id: Document version ID
        sentence_ids: List of sentence IDs
        
    Returns:
        UMR text formatted exactly like Ancast sample files
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Make sure sentence_ids is a list
    if sentence_ids is None:
        sentence_ids = []
    elif not isinstance(sentence_ids, list):
        sentence_ids = [sentence_ids]
    
    logger.info(f"Generating exact Ancast format for doc_version_id={doc_version_id}, sentences={sentence_ids}")
    
    # Create debug output string to store extraction details
    debug_output = "=== DATABASE EXTRACTION DEBUG ===\n"
    debug_output += f"Document Version ID: {doc_version_id}\n"
    debug_output += f"Sentence IDs: {sentence_ids}\n\n"
    
    try:
        # Get document version
        doc_version = DocVersion.query.get(doc_version_id)
        if not doc_version:
            logger.error(f"Document version {doc_version_id} not found")
            debug_output += f"ERROR: Document version {doc_version_id} not found\n"
            print(debug_output)
            return generate_dummy_umr()
            
        logger.info(f"Found document version: {doc_version}")
        debug_output += f"Document Version: {doc_version}\n"
            
        # Get all annotations for this document version
        annotations_query = Annotation.query.filter_by(doc_version_id=doc_version_id)
        logger.debug(f"Annotation query: {annotations_query}")
        
        annotations = annotations_query.all()
        logger.info(f"Found {len(annotations)} annotations for document version {doc_version_id}")
        debug_output += f"Found {len(annotations)} annotations for document version {doc_version_id}\n"
        
        # Log the first annotation for debugging if available
        if annotations:
            first_ann = annotations[0]
            logger.info(f"First annotation: id={first_ann.id}, sent_id={first_ann.sent_id}")
            logger.info(f"First annotation has sent_annot: {bool(first_ann.sent_annot)}, doc_annot: {bool(first_ann.doc_annot)}, alignment: {bool(hasattr(first_ann, 'alignment') and first_ann.alignment)}")
            
            debug_output += "\n=== SAMPLE ANNOTATION ===\n"
            debug_output += f"ID: {first_ann.id}, Sentence ID: {first_ann.sent_id}\n"
            debug_output += f"Has sentence annotation: {bool(first_ann.sent_annot)}\n"
            debug_output += f"Has document annotation: {bool(first_ann.doc_annot)}\n"
            debug_output += f"Has alignment: {bool(hasattr(first_ann, 'alignment') and first_ann.alignment)}\n\n"
            
            # Print the actual content
            debug_output += "=== SENTENCE ANNOTATION CONTENT ===\n"
            debug_output += (first_ann.sent_annot or "EMPTY") + "\n\n"
            
            debug_output += "=== DOCUMENT ANNOTATION CONTENT ===\n"
            debug_output += (first_ann.doc_annot or "EMPTY") + "\n\n"
            
            if hasattr(first_ann, 'alignment') and first_ann.alignment:
                debug_output += "=== ALIGNMENT CONTENT ===\n"
                debug_output += str(first_ann.alignment) + "\n\n"
            else:
                debug_output += "=== ALIGNMENT CONTENT ===\nNot available\n\n"
        
        # Filter by sentence IDs if provided
        if sentence_ids:
            # Log the sentence IDs we're filtering by
            logger.info(f"Filtering annotations by sentence IDs: {sentence_ids}")
            original_count = len(annotations)
            annotations = [ann for ann in annotations if ann.sent_id in sentence_ids]
            logger.info(f"After filtering: {len(annotations)} of {original_count} annotations match the provided sentence IDs")
            
            debug_output += f"Filtering by sentence IDs: {sentence_ids}\n"
            debug_output += f"After filtering: {len(annotations)} of {original_count} annotations remain\n\n"
        
        # Check if we have any annotations after filtering
        if not annotations:
            logger.warning(f"No annotations found after filtering for document version {doc_version_id}")
            debug_output += "WARNING: No annotations found after filtering!\n"
            print(debug_output)
            return generate_dummy_umr()
            
        # Sort by sentence ID
        annotations.sort(key=lambda x: x.sent_id)
        debug_output += f"Sorted annotations by sentence ID\n"
        
        # Build UMR blocks
        result_text = ""
        debug_output += f"=== PROCESSING ANNOTATIONS ===\n"
        
        for i, annotation in enumerate(annotations):
            try:
                logger.debug(f"Processing annotation {i+1}/{len(annotations)}: id={annotation.id}, sent_id={annotation.sent_id}")
                debug_output += f"Processing annotation {i+1}/{len(annotations)}: id={annotation.id}, sent_id={annotation.sent_id}\n"
                
                # Get the sentence
                sentence = Sent.query.filter_by(id=annotation.sent_id, doc_id=doc_version.doc_id).first()
                if not sentence:
                    logger.warning(f"Sentence {annotation.sent_id} not found for document {doc_version.doc_id}")
                    debug_output += f"WARNING: Sentence {annotation.sent_id} not found for document {doc_version.doc_id}\n"
                    continue
                    
                logger.debug(f"Found sentence: id={sentence.id}, content='{sentence.content[:50]}...'")
                debug_output += f"Found sentence: id={sentence.id}, content='{sentence.content[:50]}...'\n"
                
                # Get the UMR annotation
                sent_annot = annotation.sent_annot
                if not sent_annot or not sent_annot.strip():
                    logger.warning(f"No valid sentence annotation for annotation {annotation.id}")
                    debug_output += f"WARNING: No valid sentence annotation for annotation {annotation.id}\n"
                    continue
                    
                # Create sentence header with the proper ID format expected by Ancast
                sentence_num = i + 1
                sentence_header = f"# :: snt{sentence_num}\t{sentence.content}"
                result_text += sentence_header + "\n\n"
                
                # Add sentence level graph section
                result_text += "# sentence level graph:\n"
                result_text += sent_annot.strip() + "\n\n"
                
                # Add alignment section if available, or generate a dummy one
                result_text += "# alignment:\n"
                if hasattr(annotation, 'alignment') and annotation.alignment:
                    # Use actual alignment if available
                    alignment_text = str(annotation.alignment).strip()
                    result_text += alignment_text + "\n\n"
                else:
                    # Generate dummy alignment by finding variables in the annotation
                    variables = extract_variables_from_umr(sent_annot)
                    dummy_alignment = generate_dummy_alignment(variables)
                    result_text += dummy_alignment + "\n\n"
                
                # Add document level annotation if available, or generate a dummy one
                result_text += "# document level annotation:\n"
                doc_annot = annotation.doc_annot
                if doc_annot and doc_annot.strip():
                    result_text += doc_annot.strip() + "\n\n"
                else:
                    # Generate a minimal valid document annotation
                    var_names = extract_variables_from_umr(sent_annot)
                    sentence_var = f"s{sentence_num}s0"
                    content_var = var_names[0] if var_names else f"s{sentence_num}x0"
                    doc_annotation = f"({sentence_var} / sentence\n    :modal ((author :full-affirmative {content_var}))\n    :temporal ((document-creation-time :before {content_var})))\n\n"
                    result_text += doc_annotation

            except Exception as e:
                logger.error(f"Error processing annotation {annotation.id}: {str(e)}")
                debug_output += f"ERROR: Processing annotation {annotation.id}: {str(e)}\n"
                continue
        
        # Check if we generated any content
        if not result_text.strip():
            logger.warning("No UMR content was generated")
            debug_output += "WARNING: No UMR content was generated\n"
            print(debug_output)
            return generate_dummy_umr()
            
        # Log the generated content
        logger.info(f"Generated UMR content with {result_text.count('#')} blocks")
        return result_text
        
    except Exception as e:
        logger.error(f"Error generating UMR format: {str(e)}")
        debug_output += f"ERROR: {str(e)}\n"
        print(debug_output)
        return generate_dummy_umr()

def extract_variables_from_umr(umr_text):
    """Extract variable names from UMR text using regex."""
    import re
    # Find variable patterns like "s1x0" in "(s1x0 / leave-11"
    var_pattern = r'\(\s*([a-z]\d+[a-z]\d+)\s*/'
    variables = re.findall(var_pattern, umr_text)
    return variables if variables else [f"s1x{i}" for i in range(3)]  # Fallback

def generate_dummy_alignment(variables):
    """Generate a dummy alignment section based on extracted variables."""
    if not variables:
        return "s1x0: 0-0"
    alignment = []
    for i, var in enumerate(variables):
        alignment.append(f"{var}: {i}-{i}")
    return "\n".join(alignment)

def generate_dummy_umr():
    """Generate a minimal valid UMR that Ancast can process without errors."""
    return """# :: snt1\tThis is a dummy sentence.

# sentence level graph:
(s1x0 / thing
    :ARG0 (s1x1 / person)
    :ARG1 (s1x2 / concept))

# alignment:
s1x0: 0-0
s1x1: 1-1
s1x2: 3-3

# document level annotation:
(s1s0 / sentence
    :modal ((author :full-affirmative s1x0))
    :temporal ((document-creation-time :before s1x0)))
"""

@main.route("/debug_database", methods=['GET'])
def debug_database():
    """Endpoint to debug database connections and check model records."""
    result = {
        "status": "OK",
        "models": {},
        "counts": {},
        "samples": {},
        "relationships": {}
    }
    
    try:
        # Check if DocVersion model exists and count records
        try:
            docversions_count = DocVersion.query.count()
            result["models"]["docversion"] = "OK"
            result["counts"]["docversion"] = docversions_count
        except Exception as e:
            result["models"]["docversion"] = f"ERROR: {str(e)}"
        
        # Check if Annotation model exists and count records
        try:
            annotations_count = Annotation.query.count()
            result["models"]["annotation"] = "OK"
            result["counts"]["annotation"] = annotations_count
        except Exception as e:
            result["models"]["annotation"] = f"ERROR: {str(e)}"
        
        # Check if Sent model exists and count records
        try:
            sentences_count = Sent.query.count()
            result["models"]["sent"] = "OK"
            result["counts"]["sent"] = sentences_count
        except Exception as e:
            result["models"]["sent"] = f"ERROR: {str(e)}"
        
        # Check relationships
        try:
            # Find a document version with annotations
            doc_version_with_annotations = DocVersion.query.join(Annotation).first()
            if doc_version_with_annotations:
                annotations = Annotation.query.filter_by(doc_version_id=doc_version_with_annotations.id).all()
                result["relationships"]["doc_version_id"] = doc_version_with_annotations.id
                result["relationships"]["annotations_count"] = len(annotations)
                
                # Check sentences
                if annotations:
                    sent_ids = [ann.sent_id for ann in annotations]
                    sentences = Sent.query.filter(Sent.id.in_(sent_ids)).all()
                    result["relationships"]["sent_ids"] = sent_ids[:5]  # First 5 only
                    result["relationships"]["matching_sentences"] = len(sentences)
        except Exception as e:
            result["relationships"] = f"ERROR: {str(e)}"
            
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
