import logging
import os
from umr_annot_tool import create_app, db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db():
    """Initialize the database with all tables."""
    # Set the database URL with username
    os.environ['DATABASE_URL'] = 'postgresql://jinzhao@localhost/umr_230523'
    logger.info(f"Setting database path to: {os.environ['DATABASE_URL']}")
    
    # Create the Flask app and push an application context
    app = create_app()
    app.app_context().push()
    
    # Log the app's database URI configuration
    logger.info(f"App config: {app.config['SQLALCHEMY_DATABASE_URI']}")
    
    # Create all database tables
    db.create_all()
    logger.info("Database tables created successfully!")
    
    # Test the database connection
    try:
        db.session.execute("SELECT 1")
        logger.info("Successfully connected to PostgreSQL database!")
    except Exception as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        raise
    finally:
        db.session.rollback()

if __name__ == "__main__":
    init_db() 