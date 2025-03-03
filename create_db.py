import os
import logging

# Set the database URI for PostgreSQL before importing the app
os.environ['DATABASE_URL'] = 'postgresql://localhost/umr_230523'

from umr_annot_tool import create_app, db

def init_db():
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    logger.info(f"Using database: {os.environ['DATABASE_URL']}")
    
    app = create_app()
    logger.info(f"App config: {app.config['SQLALCHEMY_DATABASE_URI']}")
    
    with app.app_context():
        # Create all database tables
        db.create_all()
        logger.info("Database tables created successfully!")
        
        # Verify database connection
        try:
            db.session.execute('SELECT 1')
            logger.info("Successfully connected to PostgreSQL database!")
        except Exception as e:
            logger.error(f"Failed to connect to database: {str(e)}")

if __name__ == "__main__":
    init_db() 