from umr_annot_tool import create_app
from flask_principal import Permission, RoleNeed, identity_loaded, UserNeed, Principal, Identity, identity_changed
from flask_login import login_user, current_user, logout_user, login_required
from collections import namedtuple
from functools import partial

projectNeed = namedtuple('project', ['method', 'value'])
EditProjectNeed = partial(projectNeed, 'project_id')

class EditProjectPermission(Permission):
    def __init__(self, role):
        need = EditProjectNeed(role)
        super(EditProjectPermission, self).__init__(need)