from flask import Blueprint, render_template, request
from datetime import datetime

errors = Blueprint('errors', __name__)

@errors.app_errorhandler(404)
def error_404(error):
    print("=============================================")
    print(f"ERROR DEBUG: 404 error handler triggered")
    print(f"Request path: {request.path}")
    print(f"Request method: {request.method}")
    print("=============================================")
    return render_template('errors/404.html', now=datetime.now()), 404

@errors.app_errorhandler(403)
def error_403(error):
    print("=============================================")
    print(f"ERROR DEBUG: 403 error handler triggered")
    print(f"Request path: {request.path}")
    print(f"Request method: {request.method}")
    print("=============================================")
    return render_template('errors/403.html', now=datetime.now()), 403

@errors.app_errorhandler(500)
def error_500(error):
    print("=============================================")
    print(f"ERROR DEBUG: 500 error handler triggered")
    print(f"Request path: {request.path}")
    print(f"Request method: {request.method}")
    print(f"Error: {str(error)}")
    print("=============================================")
    return render_template('errors/500.html', now=datetime.now(), error=str(error)), 500

@errors.app_errorhandler(Exception)
def handle_exception(error):
    print("=============================================")
    print(f"ERROR DEBUG: Unhandled exception caught")
    print(f"Request path: {request.path}")
    print(f"Request method: {request.method}")
    print(f"Error: {str(error)}")
    import traceback
    print(f"Traceback: {traceback.format_exc()}")
    print("=============================================")
    return render_template('errors/500.html', now=datetime.now(), error=str(error)), 500
