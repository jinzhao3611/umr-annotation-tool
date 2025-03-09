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
from umr_annot_tool.resources.rolesets import known_relations

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
    logger.info("Root URL accessed, redirecting to home or login")
    if current_user.is_authenticated:
        return redirect(url_for('users.account'))
    else:
        return redirect(url_for('users.login'))

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
        
        # Handle specific operations
        if 'operation' in data:
            if data['operation'] == 'delete_branch':
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
                           sent_id=1))

@main.route("/adjudication/<int:doc_version_1_id>/<int:doc_version_2_id>/<int:sent_id>", methods=['GET'])
@login_required
def adjudication(doc_version_1_id, doc_version_2_id, sent_id):
    """Display the adjudication view comparing two document versions side by side."""
    try:
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
