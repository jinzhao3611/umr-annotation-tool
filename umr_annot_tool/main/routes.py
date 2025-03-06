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
    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        data = request.get_json()
        updated_annotation = data.get('annotation')
        old_relation = data.get('old_relation')
        new_relation = data.get('new_relation')
        
        # Validate inputs
        if not updated_annotation or not old_relation or not new_relation:
            return jsonify({"error": "Missing required fields"}), 400
        
        if not new_relation.startswith(':'):
            return jsonify({"error": "Invalid relation format"}), 400
        
        # Get the document version
        doc_version = DocVersion.query.get_or_404(doc_version_id)
        
        # Check if the user has permission to modify this document
        if not has_permission_for_doc(current_user, doc_version.doc_id):
            return jsonify({"error": "Not authorized to modify this document"}), 403
        
        # Get sentence annotation
        sent = Sent.query.filter_by(doc_version_id=doc_version_id, sent_id=sent_id).first()
        if not sent:
            return jsonify({"error": "Sentence not found"}), 404
        
        # Save the updated annotation
        sent.umr = updated_annotation
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

@main.route("/update_value/<int:doc_version_id>/<int:sent_id>", methods=['POST'])
def update_value(doc_version_id, sent_id):
    """Update a relation's value in an annotation and save it."""
    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401
    
    try:
        data = request.get_json()
        updated_annotation = data.get('annotation')
        relation = data.get('relation')
        old_value = data.get('old_value')
        new_value = data.get('new_value')
        
        # Validate inputs
        if not updated_annotation or not relation or not old_value or not new_value:
            return jsonify({"error": "Missing required fields"}), 400
        
        # Get the document version
        doc_version = DocVersion.query.get_or_404(doc_version_id)
        
        # Check if the user has permission to modify this document
        if not has_permission_for_doc(current_user, doc_version.doc_id):
            return jsonify({"error": "Not authorized to modify this document"}), 403
        
        # Get sentence annotation
        sent = Sent.query.filter_by(doc_version_id=doc_version_id, sent_id=sent_id).first()
        if not sent:
            return jsonify({"error": "Sentence not found"}), 404
        
        # Save the updated annotation
        sent.umr = updated_annotation
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
        current_app.logger.error(f"Error updating value: {str(e)}")
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
    
    # Check if the required fields are present
    if not all(k in data for k in ['annotation']):
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400
    
    try:
        # Get the document version
        doc_version = DocVersion.query.get_or_404(doc_version_id)
        
        # Check if the user has permission to modify the document
        if not has_permission_for_doc(current_user, doc_version.doc_id):
            return jsonify({'success': False, 'message': 'User does not have permission to modify this document'}), 403
        
        # Get the annotation object
        annotation = Annotation.query.filter_by(doc_version_id=doc_version_id, sent_id=sent_id).first()
        
        if not annotation:
            return jsonify({'success': False, 'message': 'Annotation not found'}), 404
        
        # Update the annotation
        annotation.annotation = data['annotation']
        
        # Handle specific operations
        if 'operation' in data:
            if data['operation'] == 'delete_branch':
                if 'deleted_relation' in data:
                    deleted_relation = data['deleted_relation']
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
        current_app.logger.error(f"Error updating annotation: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@main.route("/get_concepts", methods=['GET'])
@login_required
def get_concepts():
    """Provide predefined concepts for use in the branch addition feature"""
    from umr_annot_tool.resources.rolesets import discourse_concepts, non_event_rolesets
    from umr_annot_tool.resources.ne_types import ne_types
    
    try:
        return jsonify({
            'discourse_concepts': discourse_concepts,
            'ne_types': ne_types,
            'non_event_rolesets': non_event_rolesets
        })
    except Exception as e:
        current_app.logger.error(f"Error fetching concepts: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500
