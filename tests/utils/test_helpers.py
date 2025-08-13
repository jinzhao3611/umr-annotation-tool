"""
Test utility functions for database reset, seeding, and common test operations.
"""

import os
import json
from pathlib import Path
from umr_annot_tool import db, bcrypt
from umr_annot_tool.models import User, Project, Doc, DocVersion


class TestDatabaseHelper:
    """Helper class for test database operations."""
    
    @staticmethod
    def reset_database(app):
        """
        Completely reset the database to a clean state.
        
        Args:
            app: Flask application instance
        """
        with app.app_context():
            # Drop all tables
            db.drop_all()
            
            # Recreate all tables
            db.create_all()
            
            print("Database reset completed")
    
    @staticmethod
    def seed_basic_users(app):
        """
        Seed database with basic test users.
        
        Args:
            app: Flask application instance
            
        Returns:
            dict: Dictionary of created user IDs
        """
        with app.app_context():
            users = {
                'test_user': User(
                    username='testuser',
                    email='test@example.com',
                    password=bcrypt.generate_password_hash('testpassword').decode('utf-8')
                ),
                'admin_user': User(
                    username='testadmin',
                    email='admin@example.com',
                    password=bcrypt.generate_password_hash('adminpassword').decode('utf-8')
                ),
                'annotator1': User(
                    username='annotator1',
                    email='annotator1@example.com',
                    password=bcrypt.generate_password_hash('password123').decode('utf-8')
                ),
                'annotator2': User(
                    username='annotator2',
                    email='annotator2@example.com',
                    password=bcrypt.generate_password_hash('password123').decode('utf-8')
                )
            }
            
            user_ids = {}
            for key, user in users.items():
                db.session.add(user)
                db.session.flush()  # Get the ID before commit
                user_ids[key] = user.id
            
            db.session.commit()
            print(f"Created {len(users)} test users")
            
            return user_ids
    
    @staticmethod
    def seed_test_projects(app, user_ids):
        """
        Seed database with test projects.
        
        Args:
            app: Flask application instance
            user_ids: Dictionary of user IDs from seed_basic_users
            
        Returns:
            dict: Dictionary of created project IDs
        """
        with app.app_context():
            projects = {
                'english_project': Project(
                    project_name='English UMR Project',
                    language='en',
                    created_by_user_id=user_ids['admin_user']
                ),
                'chinese_project': Project(
                    project_name='Chinese UMR Project',
                    language='zh',
                    created_by_user_id=user_ids['admin_user']
                ),
                'arabic_project': Project(
                    project_name='Arabic UMR Project',
                    language='ar',
                    created_by_user_id=user_ids['admin_user']
                ),
                'test_project': Project(
                    project_name='Test Annotation Project',
                    language='en',
                    created_by_user_id=user_ids['test_user']
                )
            }
            
            project_ids = {}
            for key, project in projects.items():
                db.session.add(project)
                db.session.flush()
                project_ids[key] = project.id
            
            db.session.commit()
            print(f"Created {len(projects)} test projects")
            
            return project_ids
    
    @staticmethod
    def seed_test_documents(app, project_ids, user_ids):
        """
        Seed database with test UMR documents.
        
        Args:
            app: Flask application instance
            project_ids: Dictionary of project IDs
            user_ids: Dictionary of user IDs
            
        Returns:
            dict: Dictionary of created document IDs
        """
        with app.app_context():
            # Sample UMR content
            umr_content = """################################################################################
# meta-info :: sent_id = test-s1
# :: snt1	The cat sat on the mat.
Index: 1   2   3   4  5   6
Words: The cat sat on the mat .

# sentence level graph:
(s1s / sit-01
    :ARG0 (s1c / cat)
    :ARG1 (s1m / mat))

# alignment:
s1s: 3-3
s1c: 2-2
s1m: 6-6

# document level annotation:
(s1s0 / sentence
    :temporal ((document-creation-time :before s1s)))
################################################################################"""
            
            documents = {
                'english_doc1': Doc(
                    filename='english_test_001.umr',
                    project_id=project_ids['english_project'],
                    doc_id='eng_001',
                    latest_version=1,
                    status='available'
                ),
                'english_doc2': Doc(
                    filename='english_test_002.umr',
                    project_id=project_ids['english_project'],
                    doc_id='eng_002',
                    latest_version=1,
                    status='checked_out',
                    checked_out_by=user_ids['annotator1']
                ),
                'chinese_doc1': Doc(
                    filename='chinese_test_001.umr',
                    project_id=project_ids['chinese_project'],
                    doc_id='chi_001',
                    latest_version=1,
                    status='available'
                )
            }
            
            doc_ids = {}
            for key, doc in documents.items():
                db.session.add(doc)
                db.session.flush()
                doc_ids[key] = doc.id
                
                # Create initial version for each document
                version = DocVersion(
                    doc_id=doc.id,
                    content=umr_content,
                    version_number=1,
                    modified_by=user_ids['admin_user']
                )
                db.session.add(version)
            
            db.session.commit()
            print(f"Created {len(documents)} test documents with versions")
            
            return doc_ids
    
    @staticmethod
    def seed_complete_test_data(app):
        """
        Seed database with complete test dataset.
        
        Args:
            app: Flask application instance
            
        Returns:
            dict: Dictionary containing all created IDs
        """
        # Reset database first
        TestDatabaseHelper.reset_database(app)
        
        # Seed data in order
        user_ids = TestDatabaseHelper.seed_basic_users(app)
        project_ids = TestDatabaseHelper.seed_test_projects(app, user_ids)
        doc_ids = TestDatabaseHelper.seed_test_documents(app, project_ids, user_ids)
        
        return {
            'users': user_ids,
            'projects': project_ids,
            'documents': doc_ids
        }
    
    @staticmethod
    def cleanup_test_uploads(upload_dir='uploads/test'):
        """
        Clean up test upload directory.
        
        Args:
            upload_dir: Directory path for test uploads
        """
        upload_path = Path(upload_dir)
        if upload_path.exists():
            import shutil
            shutil.rmtree(upload_path)
            print(f"Cleaned up test uploads at {upload_dir}")


class TestAPIHelper:
    """Helper class for API testing."""
    
    @staticmethod
    def login_user(client, email, password):
        """
        Perform API login and return authentication token.
        
        Args:
            client: Flask test client
            email: User email
            password: User password
            
        Returns:
            str: Authentication token or None
        """
        response = client.post('/api/login', json={
            'email': email,
            'password': password
        })
        
        if response.status_code == 200:
            data = response.get_json()
            return data.get('token')
        return None
    
    @staticmethod
    def create_project(client, token, project_name, language='en'):
        """
        Create a new project via API.
        
        Args:
            client: Flask test client
            token: Authentication token
            project_name: Name of the project
            language: Project language code
            
        Returns:
            dict: Created project data or None
        """
        headers = {'Authorization': f'Bearer {token}'} if token else {}
        
        response = client.post('/api/projects', 
            headers=headers,
            json={
                'project_name': project_name,
                'language': language
            }
        )
        
        if response.status_code == 201:
            return response.get_json()
        return None
    
    @staticmethod
    def upload_document(client, token, project_id, file_path):
        """
        Upload a document to a project via API.
        
        Args:
            client: Flask test client
            token: Authentication token
            project_id: Target project ID
            file_path: Path to the file to upload
            
        Returns:
            dict: Upload response data or None
        """
        headers = {'Authorization': f'Bearer {token}'} if token else {}
        
        with open(file_path, 'rb') as f:
            response = client.post(f'/api/projects/{project_id}/upload',
                headers=headers,
                data={
                    'file': (f, os.path.basename(file_path))
                }
            )
        
        if response.status_code in [200, 201]:
            return response.get_json()
        return None


def reset_test_database():
    """
    Command-line utility to reset test database.
    Can be called from manage.py or run directly.
    """
    from umr_annot_tool import create_app
    
    # Create app with test config
    class TestConfig:
        TESTING = True
        SQLALCHEMY_DATABASE_URI = 'sqlite:///test.db'
        SQLALCHEMY_TRACK_MODIFICATIONS = False
        WTF_CSRF_ENABLED = False
        SECRET_KEY = 'test-secret-key'
    
    app = create_app(TestConfig)
    
    # Reset and seed database
    helper = TestDatabaseHelper()
    data = helper.seed_complete_test_data(app)
    
    print("\nTest database reset complete!")
    print(f"Created {len(data['users'])} users")
    print(f"Created {len(data['projects'])} projects")
    print(f"Created {len(data['documents'])} documents")
    
    return data


if __name__ == '__main__':
    # Allow running as standalone script
    reset_test_database()