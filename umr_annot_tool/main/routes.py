import sqlalchemy.exc
from flask import url_for, redirect, flash, make_response, jsonify, send_file, render_template, request, abort, send_from_directory, current_app, Response
from werkzeug.utils import secure_filename
from typing import List, Tuple, Optional, Dict
import json
from umr_annot_tool.main.umr_parser import parse_umr_file
from flask_login import current_user, login_required
import os
import logging
from datetime import datetime
from bs4 import BeautifulSoup
from flask import Blueprint
from umr_annot_tool import db, bcrypt
from umr_annot_tool.models import Sent, Doc, Annotation, User, Post, Lexicon, Projectuser, Project, Lattice, Partialgraph, DocVersion
from umr_annot_tool.umr_validator import validate_and_fix_annotation, process_document_annotations
from umr_annot_tool.main.forms import UploadForm, CreateProjectForm
from umr_annot_tool.resources.rolesets import known_relations
from umr_annot_tool.resources.utility_modules import get_merged_rolesets
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
FRAME_FILE_UZBEK = 'umr_annot_tool/resources/frames_uzbek.json'
LEMMA_DICT_ARABIC = 'umr_annot_tool/resources/arabic_lemma_dict.json'
lemma_dict = json.load(open(LEMMA_DICT_ARABIC, "r"))

# from farasa.stemmer import FarasaStemmer
# stemmer = FarasaStemmer(interactive=True)

@main.route("/")
def home():
    """Handle requests to the root URL."""
    logger.info("Root URL accessed, rendering user guide")
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
        for idx, (sent_annot, doc_annot, align, sent) in enumerate(zip(sent_annots, doc_annots, aligns, sents)):
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
            # Validate and fix the annotation before saving
            if sent_annot:
                fixed_sent_annot, is_valid, messages = validate_and_fix_annotation(sent_annot, auto_fix=False)
                if not is_valid:
                    logger.warning(f"Sentence {idx} had validation issues: {messages}")
                if fixed_sent_annot != sent_annot:
                    logger.info(f"Auto-fixed annotation for sentence {idx}")
                    sent_annot = fixed_sent_annot

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
            _, sents, sent_annots, doc_annots, aligns = parse_umr_file(content)
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
            return None, None, None  # Return None values instead of redirect
        
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
        return None, None, None  # Return None values instead of redirect


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
            uploaded_files = form.files.data
            logger.info(f"Got {len(uploaded_files)} files")
            
            # Track the IDs of successfully uploaded documents
            uploaded_doc_ids = []
            
            for form_file in uploaded_files:
                logger.info(f"Processing file: {form_file.filename}")
                
                if form_file.filename == '':
                    logger.error("Empty filename")
                    continue
                    
                if not form_file.filename.endswith('.umr'):
                    logger.error("Invalid file extension")
                    flash(f'Skipped {form_file.filename}: Only .umr files are allowed', 'warning')
                    continue
                    
                logger.info(f"Handling file upload for {form_file.filename}")
                sent_annots, doc_annots, doc_id = handle_file_upload(form_file, current_project_id)
                
                # Check if handle_file_upload failed
                if sent_annots is None or doc_id is None:
                    logger.error(f"File upload processing failed for {form_file.filename}")
                    flash(f'Failed to upload {form_file.filename}', 'danger')
                    continue
                
                logger.info(f"Succeeded uploading {form_file.filename}")
                flash(f'File {form_file.filename} has been uploaded!', 'success')
                uploaded_doc_ids.append(doc_id)
            
            if uploaded_doc_ids:
                # If at least one file was uploaded successfully, redirect to the project page
                return redirect(url_for('users.project', project_id=current_project_id))
            else:
                # If no files were uploaded successfully, stay on the upload page
                return redirect(request.url)

        else:
            logger.error("No files in form.files.data")
            flash('No files selected', 'danger')
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
                    raw_annotation = curr_annotation.sent_annot if curr_annotation.sent_annot else ''

                    # Validate and fix the annotation before displaying
                    if raw_annotation:
                        fixed_annotation, is_valid, messages = validate_and_fix_annotation(raw_annotation, auto_fix=False)
                        if not is_valid or fixed_annotation != raw_annotation:
                            logger.info(f"Fixed annotation display for sentence {sent_id}: {messages}")
                            curr_annotation_string = fixed_annotation
                            curr_sent_umr = fixed_annotation
                        else:
                            curr_annotation_string = raw_annotation
                            curr_sent_umr = raw_annotation
                    else:
                        curr_sent_umr = {}
                        curr_annotation_string = ''

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
                        f'<span class="token" data-index="{i+1}"><sup class="token-index">{i+1}</sup>{token}</span>'
                        for i, token in enumerate(sent.content.split())
                    ])
                    for sent in sentences
                ],
                'sents_html': '<br>'.join([
                    f'<span id="sentid-{sent.id}">{i+1}. {sent.content}</span>' 
                    for i, sent in enumerate(sentences)
                # Donde esta este variable utilizado? En el nivel del document?
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
            lang = project.language.lower()
            frame_files = {
                'english': FRAME_FILE_ENGLISH,
                'chinese': FRAME_FILE_CHINESE,
                'arabic': FRAME_FILE_ARABIC,
                'uzbek': FRAME_FILE_UZBEK,
            }
            frame_file = frame_files.get(lang)
            if frame_file:
                with open(frame_file, 'r') as f:
                    frame_dict = json.load(f)
                logger.info(f"Successfully loaded frame dictionary from {frame_file}")
            else:
                logger.info(f"No frame file available for language: {project.language}")
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
        
        # Get the merged rolesets (default + temporary) for this project
        merged_rolesets = get_merged_rolesets(project.id)
        
        # Get the list of relations for the relation editor
        relations_list = list(merged_rolesets.keys())
        
        # Also pass the full relations data for value editing
        relations_data = {k: v for k, v in merged_rolesets.items() if 'values' in v}
        
        logger.info("Rendering sentlevel template")
        return render_template('sentlevel.html',
                            doc_id=doc.id,
                            doc_version_id=doc_version_id,
                            snt_id=sent_id,
                            owner=User.query.get_or_404(doc_version.user_id),
                            filename=doc.filename,
                            lang=project.language,
                            project_id=project.id,
                            project_name=project.project_name,
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

@main.route("/update_sentence", methods=["POST"])
def update_sentence():
    data = request.get_json()

    try:
        doc_id = int(data.get("doc_id"))
        snt_id = int(data.get("snt_id"))  # Sentence position in document (1-based)
        new_content = data.get("new_content", "").strip()

        if not new_content:
            return jsonify(success=False, error="Sentence content cannot be empty")

        # Get all sentences for the document, ordered by ID
        sentences = Sent.query.filter_by(doc_id=doc_id).order_by(Sent.id).all()

        # Validate sentence position
        if snt_id < 1 or snt_id > len(sentences):
            return jsonify(success=False, error=f"Invalid sentence position: {snt_id}. Valid range is 1-{len(sentences)}")

        # Get the target sentence by position (convert 1-based to 0-based index)
        target_sentence = sentences[snt_id - 1]

        if not target_sentence:
            return jsonify(success=False, error="Sentence not found")

        # Update the sentence content
        target_sentence.content = new_content

        db.session.commit()

        # Generate HTML with token spans for display (matching the original format)
        tokens = new_content.split()
        token_spans = []
        for i, token in enumerate(tokens):
            token_spans.append(f'<span class="token-item"><sup class="token-index">{i+1}</sup><span class="token-text">{token}</span></span>')
        html_content = ' '.join(token_spans)

        return jsonify(success=True, sent=new_content, html_content=html_content)
    except Exception as e:
        return jsonify(success=False, error=str(e))

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
            # Validate before saving
            fixed_annotation, is_valid, messages = validate_and_fix_annotation(data['annotation'], auto_fix=False)
            if not is_valid:
                current_app.logger.warning(f"Annotation validation issues: {messages}")

            annotation = Annotation(
                doc_version_id=doc_version_id,
                sent_id=current_sent.id,
                sent_annot=fixed_annotation,
                doc_annot="",
                actions={},
                alignment={}
            )
            db.session.add(annotation)
            current_app.logger.info(f"Created new annotation for doc_version_id={doc_version_id}, sent_id={current_sent.id}")
        else:
            # Update the annotation
            # Validate before saving
            fixed_annotation, is_valid, messages = validate_and_fix_annotation(data['annotation'], auto_fix=False)
            if not is_valid:
                current_app.logger.warning(f"Annotation validation issues: {messages}")
            annotation.sent_annot = fixed_annotation
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
        elif 'alignments' in data and isinstance(data['alignments'], dict):
            # Support for undo/redo which sends 'alignments' instead of 'alignment'
            annotation.alignment = data['alignments']
            current_app.logger.info(f"Set alignment data from undo/redo: {annotation.alignment}")
        
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

            elif data['operation'] == 'undo_redo':
                # Log undo/redo operation
                current_app.logger.info(f"Undo/Redo: User {current_user.username} performed undo/redo operation in sentence {sent_id} in document version {doc_version_id}")
        
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
                        f'<span class="token" data-index="{i+1}"><sup class="token-index">{i+1}</sup>{token}</span>'
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
        
        # Get the merged rolesets (default + temporary) for this project
        merged_rolesets = get_merged_rolesets(project.id)
        
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
                            all_sent_annotations=all_sent_annotations,
                            relations_list=list(merged_rolesets.keys()),
                            relations_data={k: v for k, v in merged_rolesets.items() if 'values' in v})
                            
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

    # Check user permission - any project member can view
    membership = Projectuser.query.filter_by(project_id=doc.project_id, user_id=current_user.id).first()
    if not membership:
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

    # Check user permission - any project member can view
    membership = Projectuser.query.filter_by(project_id=doc.project_id, user_id=current_user.id).first()
    if not membership:
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

    # Check user permission - any project member can view
    membership = Projectuser.query.filter_by(project_id=doc.project_id, user_id=current_user.id).first()
    if not membership:
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

    # Check user permission - any project member can view
    membership = Projectuser.query.filter_by(project_id=doc.project_id, user_id=current_user.id).first()
    if not membership:
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

    # Check user permission - any project member can view annotations
    membership = Projectuser.query.filter_by(project_id=doc.project_id, user_id=current_user.id).first()
    if not membership:
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
    
    # Get the merged rolesets (default + temporary) for this project
    merged_rolesets = get_merged_rolesets(project.id)
    
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
                          max_sent_id=max_sent_id,
                          relations_list=list(merged_rolesets.keys()),
                          relations_data={k: v for k, v in merged_rolesets.items() if 'values' in v})

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
        
        
        # Get the merged rolesets (default + temporary) for this project
        merged_rolesets = get_merged_rolesets(doc1.project_id)
        
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
                              lang=project.language,
                              relations_list=list(merged_rolesets.keys()),
                              relations_data={k: v for k, v in merged_rolesets.items() if 'values' in v})
    
    except Exception as e:
        logger.error(f"Error in adjudication: {str(e)}")
        flash('An error occurred while preparing the adjudication view.', 'danger')
        return redirect(url_for('users.projects'))


def process_umr_block(block_text, default_sent_num=1):
    """Process a UMR block to ensure it contains all required sections in the correct format."""
    if not block_text or not block_text.strip():
        return None
        
    # Extract sentence number using regex
    sent_match = re.search(r'# :: snt(\d+)', block_text)
    sent_num = int(sent_match.group(1)) if sent_match else default_sent_num
    
    # Generate standard variable prefix
    var_prefix = f"s{sent_num}"
    
    # Extract sentence text
    sent_text = ""
    sent_line = re.search(r'# :: snt\d+\t(.+)', block_text)
    if sent_line:
        sent_text = sent_line.group(1)
    
    # Split block into sections
    sections = {
        'graph': '',
        'alignment': '',
        'doc_annot': ''
    }
    
    current_section = None
    lines = block_text.split('\n')
    
    for line in lines:
        if '# sentence level graph:' in line:
            current_section = 'graph'
        elif '# alignment:' in line:
            current_section = 'alignment'
        elif '# document level annotation:' in line:
            current_section = 'doc_annot'
        elif current_section and line.strip():
            sections[current_section] += line + '\n'
    
    # Check if we have content in each section
    if not sections['graph'].strip():
        sections['graph'] = f"({var_prefix}x0 / thing)\n"
    
    if not sections['alignment'].strip():
        sections['alignment'] = f"{var_prefix}x0: 0-0\n"
    
    if not sections['doc_annot'].strip():
        sections['doc_annot'] = f"""({var_prefix}s0 / sentence
    :modal ((author :full-affirmative {var_prefix}x0))
    :temporal ((document-creation-time :before {var_prefix}x0)))\n"""
    
    # Reconstruct block with all sections
    result = f"""# :: snt{sent_num}\t{sent_text}

# sentence level graph:
{sections['graph'].strip()}

# alignment:
{sections['alignment'].strip()}

# document level annotation:
{sections['doc_annot'].strip()}
"""
    
    return result

@main.route("/ancast_evaluation", methods=['POST'])
@login_required
def ancast_evaluation():
    """Run Ancast evaluation for the specified annotations and return scores."""
    try:
        # Get request data
        data = request.get_json()
        current_app.logger.info(f"Ancast evaluation request data: {data}")
        
        # Check if required parameters are present
        if not all(k in data for k in ['doc_version_1_id', 'doc_version_2_id', 'sent_id']):
            return jsonify({'success': False, 'error': 'Missing required parameters'}), 400
        
        doc_version_1_id = data['doc_version_1_id']
        doc_version_2_id = data['doc_version_2_id']
        sent_id = int(data['sent_id'])  # Ensure sent_id is an integer
        
        # Get document versions
        doc_version_1 = DocVersion.query.get_or_404(doc_version_1_id)
        doc_version_2 = DocVersion.query.get_or_404(doc_version_2_id)
        
        # Get the documents
        doc1 = Doc.query.get_or_404(doc_version_1.doc_id)
        doc2 = Doc.query.get_or_404(doc_version_2.doc_id)
        
        current_app.logger.info(f"Found documents: {doc1.filename} and {doc2.filename}")
        
        # Check if the user has permission to view these documents
        membership = Projectuser.query.filter_by(
            project_id=doc1.project_id, 
            user_id=current_user.id
        ).first()
        
        if not membership:
            return jsonify({'success': False, 'error': 'User does not have permission to view these documents'}), 403
        
        # Get all sentences from the first document
        sents = Sent.query.filter_by(doc_id=doc1.id).all()
        current_app.logger.info(f"Found {len(sents)} sentences for document {doc1.id}")
        
        # Validate the sentence ID
        if sent_id < 1 or sent_id > len(sents):
            return jsonify({'success': False, 'error': f'Invalid sentence ID: {sent_id}. Valid range is 1-{len(sents)}'}), 400
        
        # Get the current sentence
        current_sent = sents[sent_id - 1]
        current_app.logger.info(f"Current sentence (ID={current_sent.id}): {current_sent.content}")
        
        # Get annotations for the current sentence in both documents
        annotation1 = Annotation.query.filter_by(
            doc_version_id=doc_version_1_id, 
            sent_id=current_sent.id
        ).first()
        
        annotation2 = Annotation.query.filter_by(
            doc_version_id=doc_version_2_id, 
            sent_id=current_sent.id
        ).first()
        
        if not annotation1 or not annotation2:
            return jsonify({'success': False, 'error': 'One or both annotations not found'}), 404
        
        current_app.logger.info(f"Found annotations: {annotation1.id} and {annotation2.id}")
        
        # Import ancast library
        try:
            from ancast import evaluate, evaluate_doc, io_utils
            current_app.logger.info("Successfully imported ancast library")
        except ImportError as e:
            current_app.logger.error(f"Failed to import ancast: {str(e)}")
            return jsonify({'success': False, 'error': 'Ancast library not available. Please make sure it is installed.'}), 500
            
        # Construct UMR string for both annotations
        sent_text = current_sent.content
        
        # Get alignment information
        alignment1 = annotation1.alignment if hasattr(annotation1, 'alignment') and annotation1.alignment else {}
        alignment2 = annotation2.alignment if hasattr(annotation2, 'alignment') and annotation2.alignment else {}
        
        # Convert alignment data to UMR alignment format
        alignment_str1 = "\n# alignment:\n"
        alignment_str2 = "\n# alignment:\n"
        
        if alignment1:
            for node_id, spans in alignment1.items():
                if isinstance(spans, list) and spans:
                    indices = [f"{span}" for span in spans if span is not None]
                    if indices:
                        alignment_str1 += f"{node_id}: {'-'.join(indices)}\n"
        
        if alignment2:
            for node_id, spans in alignment2.items():
                if isinstance(spans, list) and spans:
                    indices = [f"{span}" for span in spans if span is not None]
                    if indices:
                        alignment_str2 += f"{node_id}: {'-'.join(indices)}\n"
        
        # If no alignments, add a dummy alignment to prevent errors
        if alignment_str1 == "\n# alignment:\n":
            alignment_str1 += "dummy: 0-0\n"
        
        if alignment_str2 == "\n# alignment:\n":
            alignment_str2 += "dummy: 0-0\n"
            
        # Format UMR strings following the expected format
        doc1_umr = f"# :: snt1  {sent_text}\n\n# sentence level graph:\n{annotation1.sent_annot}\n{alignment_str1}\n# document level annotation:\n{annotation1.doc_annot}"
        doc2_umr = f"# :: snt1  {sent_text}\n\n# sentence level graph:\n{annotation2.sent_annot}\n{alignment_str2}\n# document level annotation:\n{annotation2.doc_annot}"
        
        # Log a sample of the UMR strings to debug
        current_app.logger.info(f"Doc1 UMR first 200 chars: {doc1_umr[:200]}")
        current_app.logger.info(f"Doc2 UMR first 200 chars: {doc2_umr[:200]}")
        
        # Run Ancast evaluation
        try:
            current_app.logger.info("Starting Ancast evaluation")
            # For the main evaluation block
            # Update to unpack both scores and message
            fscores, message = evaluate(
                pred_inputs=doc1_umr,
                gold_inputs=doc2_umr,
                data_format="umr",
                output_csv_as_string=True
            )
            
            current_app.logger.info(f"Ancast evaluation succeeded: {fscores}")
            current_app.logger.info(f"Full evaluation message: {message}")
            
            # Extract only the last 11 characters of the first message element
            processed_message = message[0][-11:] if isinstance(message, list) and len(message) > 0 else "No message"
            current_app.logger.info(f"Processed message: {processed_message}")
            
            # Format the scores for response
            formatted_scores = {
                'sent': round(fscores.get('sent', 0) * 100, 2),
                'modal': round(fscores.get('modal', 0) * 100, 2),
                'temporal': round(fscores.get('temporal', 0) * 100, 2),
                'coref': round(fscores.get('coref', 0) * 100, 2),
                'comp': round(fscores.get('comp', 0) * 100, 2)
            }
            
            return jsonify({
                'success': True, 
                'scores': formatted_scores,
                'message': processed_message  # Send the processed message
            })
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            current_app.logger.error(f"Error running Ancast evaluation: {str(e)}")
            current_app.logger.error(f"Traceback: {error_trace}")
            
            # Try a simpler evaluation if full evaluation fails
            try:
                current_app.logger.info("Attempting simplified evaluation")
                simplified_scores = {
                    'sent': 0.0, 
                    'modal': 0.0,
                    'temporal': 0.0,
                    'coref': 0.0,
                    'comp': 0.0
                }
                
                # Try sentence level only
                if annotation1.sent_annot and annotation2.sent_annot:
                    try:
                        # Update to unpack both scores and message for simplified evaluation
                        sent_score, sent_message = evaluate(
                            pred_inputs=annotation1.sent_annot,
                            gold_inputs=annotation2.sent_annot,
                            data_format="umr",
                            output_csv_as_string=True
                        )
                        simplified_scores['sent'] = sent_score
                        simplified_scores['comp'] = sent_score * 0.5  # Give half weight to the overall score
                        current_app.logger.info(f"Full simplified evaluation message: {sent_message}")
                        
                        # Extract only the last 11 characters of the first message element
                        processed_sent_message = sent_message[0][-11:] if isinstance(sent_message, list) and len(sent_message) > 0 else "No message"
                        current_app.logger.info(f"Processed simplified message: {processed_sent_message}")
                    except Exception as sent_err:
                        current_app.logger.error(f"Error in simplified sentence evaluation: {str(sent_err)}")
                        processed_sent_message = f"Error: {str(sent_err)[-30:]}"
                else:
                    processed_sent_message = "Missing sentence annotations"
                
                # Format the simplified scores
                formatted_scores = {
                    'sent': round(simplified_scores.get('sent', 0) * 100, 2),
                    'modal': round(simplified_scores.get('modal', 0) * 100, 2),
                    'temporal': round(simplified_scores.get('temporal', 0) * 100, 2),
                    'coref': round(simplified_scores.get('coref', 0) * 100, 2),
                    'comp': round(simplified_scores.get('comp', 0) * 100, 2)
                }
                
                current_app.logger.info(f"Returning simplified scores: {formatted_scores}")
                
                return jsonify({
                    'success': True, 
                    'scores': formatted_scores,
                    'message': processed_sent_message,  # Send the processed message
                    'note': 'Used simplified evaluation due to error in full evaluation'
                })
                
            except Exception as simple_err:
                current_app.logger.error(f"Error in simplified evaluation: {str(simple_err)}")
                return jsonify({'success': False, 'error': f'Error running Ancast evaluation: {str(e)}'}), 500
            
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        current_app.logger.error(f"Error in Ancast evaluation: {str(e)}")
        current_app.logger.error(f"Traceback: {error_trace}")
        return jsonify({'success': False, 'error': f'Internal server error: {str(e)}'}), 500

@main.route("/export_annotation/<int:doc_version_id>", methods=['GET'])
@login_required
def export_annotation(doc_version_id):
    """Export annotations for a document version in UMR format."""
    try:
        # Get the document version
        doc_version = DocVersion.query.get_or_404(doc_version_id)
        doc = Doc.query.get_or_404(doc_version.doc_id)
        
        # Check if the user has permission to view the document
        if not has_permission_for_doc(current_user, doc.id):
            return jsonify({'success': False, 'error': 'User does not have permission to view this document'}), 403
        
        # Get all sentences and annotations for this document version
        sentences = Sent.query.filter_by(doc_id=doc.id).order_by(Sent.id).all()
        annotations = Annotation.query.filter_by(doc_version_id=doc_version_id).all()
        
        # Create a dictionary to map sentence IDs to annotations
        annotation_map = {ann.sent_id: ann for ann in annotations}
        
        # Format the UMR content
        umr_content = []
        
        # Start with the separator
        umr_content.append("#" * 80)
        
        for i, sentence in enumerate(sentences, 1):
            # Add meta-info (no empty line before meta-info)
            umr_content.append("# meta-info")
            # Remove empty line between meta-info and snt line
            umr_content.append(f"# :: snt{i}")
            
            # Add sentence content with index and words
            words = sentence.content.split()
            umr_content.append("Index: " + " ".join(str(j+1) for j in range(len(words))))
            umr_content.append("Words: " + sentence.content)
            umr_content.append("")
            
            # Add sentence-level annotation
            umr_content.append("# sentence level graph:")
            if annotation := annotation_map.get(sentence.id):
                if annotation.sent_annot:
                    umr_content.append(annotation.sent_annot.strip())
            else:
                umr_content.append("()")
            umr_content.append("")
            
            # Add alignment information
            umr_content.append("# alignment:")
            if annotation and annotation.alignment:
                # Sort alignment entries for consistent output
                sorted_alignments = sorted(annotation.alignment.items())
                for var, align in sorted_alignments:
                    # Handle both list and string formats
                    if isinstance(align, list):
                        # Join the list elements with '-'
                        indices = [str(x) for x in align if x is not None]
                        if indices:
                            umr_content.append(f"{var}: {'-'.join(indices)}")
                    else:
                        # If it's already a string, use it directly
                        umr_content.append(f"{var}: {align}")
            else:
                # Default alignment if none exists
                umr_content.append(f"s{i}a: 0-0")
            umr_content.append("")
            
            # Add document-level annotation
            umr_content.append("# document level annotation:")
            if annotation and annotation.doc_annot:
                umr_content.append(annotation.doc_annot.strip())
            else:
                umr_content.append("()")
            umr_content.append("")
            
            # Add section separator (no empty line after separator)
            umr_content.append("#" * 80)
        
        # Join all lines with newlines and remove any double newlines
        content = "\n".join(umr_content)
        content = content.replace("\n\n\n", "\n\n")  # Replace triple newlines with double
        content = content.replace("\n\n#" * 80, "\n" + "#" * 80)  # Remove empty line before separators
        
        # Create response with the file
        response = make_response(content)
        response.headers['Content-Type'] = 'text/plain; charset=utf-8'
        response.headers['Content-Disposition'] = f'attachment; filename={doc.filename}'
        return response
        
    except Exception as e:
        current_app.logger.error(f"Error exporting annotation: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@main.route("/download_frames", methods=['GET'])
@login_required
def download_frames():
    """Route to download frames data based on project language."""
    try:
        # Get project ID from query parameters
        project_id = request.args.get('project_id')
        
        if not project_id:
            return jsonify({'error': 'Missing project_id parameter'}), 400
            
        # Get the project to determine language
        project = Project.query.get_or_404(project_id)
        
        # Select frame file based on project language
        lang = project.language.lower()
        frame_files = {
            'english': FRAME_FILE_ENGLISH,
            'chinese': FRAME_FILE_CHINESE,
            'arabic': FRAME_FILE_ARABIC,
            'uzbek': FRAME_FILE_UZBEK,
        }
        frame_file = frame_files.get(lang)
        if not frame_file:
            return jsonify({'error': f'No frame file available for language: {project.language}'}), 400
            
        # Load and return frame data
        try:
            with open(frame_file, 'r') as f:
                frame_dict = json.load(f)
            return jsonify(frame_dict)
        except (IOError, json.JSONDecodeError) as e:
            logger.error(f"Error loading frame dictionary: {str(e)}")
            return jsonify({'error': f'Error loading frames: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"Error in download_frames: {str(e)}")
        return jsonify({'error': str(e)}), 500

@main.route("/lemmatize", methods=['GET'])
@login_required
def lemmatize():
    """Route to lemmatize a word based on project language."""
    try:
        word = request.args.get('word')
        project_id = request.args.get('project_id')

        if not word:
            return jsonify({'success': False, 'error': 'Missing word parameter'}), 400

        if not project_id:
            return jsonify({'success': False, 'error': 'Missing project_id parameter'}), 400

        # Get project language
        project = Project.query.get_or_404(project_id)
        language = project.language.lower()

        lemma = word.lower()  # Default fallback

        if language == 'uzbek':
            try:
                import UzbekLemmatizer as uzb_ltr
                result = uzb_ltr.Lemma(word)
                if result:
                    lemma = result
                else:
                    lemma = word.lower()
                logger.info(f"Uzbek lemmatization: '{word}' -> '{lemma}'")
            except ImportError:
                logger.warning("UzbekLemmatizer not installed, using original word")
                lemma = word.lower()
            except Exception as e:
                logger.warning(f"Error lemmatizing Uzbek word '{word}': {e}, using lowercase")
                lemma = word.lower()
        elif language == 'english':
            try:
                import lemminflect
                all_lemmas = lemminflect.getAllLemmas(word)
                if all_lemmas:
                    lemma = list(all_lemmas.values())[0][0]
                else:
                    lemma = word.lower()
            except ImportError:
                logger.warning("lemminflect not installed, using original word")
            except Exception as e:
                logger.error(f"Error lemmatizing English word: {e}")
        # For other languages, just return lowercase

        return jsonify({'success': True, 'lemma': lemma, 'original': word, 'language': language})

    except Exception as e:
        logger.error(f"Error in lemmatize: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
