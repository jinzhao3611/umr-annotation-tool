import logging
import os
import sys
from umr_annot_tool import create_app, db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db():
    """Initialize the database with all tables."""
    # Check if DATABASE_URL environment variable is set
    database_url = os.environ.get('DATABASE_URL')

    if not database_url:
        logger.error("DATABASE_URL environment variable is not set!")
        logger.info("Please set DATABASE_URL before running this script:")
        logger.info("  export DATABASE_URL='postgresql://username@localhost/database_name'")
        sys.exit(1)

    logger.info(f"Using database: {database_url}")

    # Check if SECRET_KEY is set (required for Flask app)
    if not os.environ.get('SECRET_KEY'):
        logger.warning("SECRET_KEY environment variable is not set!")
        logger.info("Setting a temporary SECRET_KEY for database initialization...")
        os.environ['SECRET_KEY'] = 'temp-secret-key-for-db-init'

    # Create the Flask app and push an application context
    app = create_app()
    app.app_context().push()

    # Log the app's database URI configuration
    logger.info(f"App config: {app.config['SQLALCHEMY_DATABASE_URI']}")

    # Create all database tables
    logger.info("Creating database tables...")
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

    # List all created tables
    logger.info("\nCreated tables:")
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    for table_name in inspector.get_table_names():
        logger.info(f"  - {table_name}")

if __name__ == "__main__":
    init_db() 