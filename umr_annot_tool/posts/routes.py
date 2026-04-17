from flask import Blueprint, flash, redirect, url_for
from flask_login import login_required

posts = Blueprint('posts', __name__)


def redirect_posts_feature_removed():
    flash('The posts feature is no longer available.', 'info')
    return redirect(url_for('users.account'))


@posts.route("/post/new", methods=['GET', 'POST'])
@login_required
def new_post():
    return redirect_posts_feature_removed()


@posts.route("/post/<int:post_id>")
def post(post_id):
    return redirect_posts_feature_removed()


@posts.route("/post/<int:post_id>/update", methods=['GET', 'POST'])
@login_required
def update_post(post_id):
    return redirect_posts_feature_removed()


@posts.route("/post/<int:post_id>/delete", methods=['POST'])
@login_required
def delete_post(post_id):
    return redirect_posts_feature_removed()
