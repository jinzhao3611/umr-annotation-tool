from umr_annot_tool import create_app
from flask_principal import identity_loaded, UserNeed
from flask_login import current_user
from umr_annot_tool.models import Projectuser
from umr_annot_tool.permission import EditProjectNeed, RoleNeed

app = create_app()

@identity_loaded.connect_via(app)
def on_identity_loaded(sender, identity):
    # Set the identity user object
    identity.user = current_user
    # Add the UserNeed to the identity
    if hasattr(current_user, 'id'):
        identity.provides.add(UserNeed(current_user.id))
        project_rows = Projectuser.query.filter(Projectuser.user_id == current_user.id).all()
        if project_rows: #current user doesn't have any projects
            for row in project_rows:
                if row.permission == "admin":
                    identity.provides.add(RoleNeed("admin"))
                    identity.provides.add(EditProjectNeed(row.project_id))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
