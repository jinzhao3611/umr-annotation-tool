from flask import render_template, url_for, flash, redirect, request, abort, Blueprint
from flask_login import current_user, login_required
from umr_annot_tool import db
from umr_annot_tool.models import Post
from umr_annot_tool.posts.forms import PostForm

posts = Blueprint('posts', __name__)

@posts.route("/post/new", methods=['GET', 'POST'])
@login_required
def new_post():
    form = PostForm()
    if form.validate_on_submit():
        post = Post(title=form.title.data, content=form.content.data, author=current_user)
        # add the post to the database
        db.session.add(post)
        db.session.commit()
        flash('Your post has been created!', 'success') #success here is a bootstrap class for alert
        return redirect(url_for('main.display_post'))
    return render_template('create_post.html', title='New Post', form=form, legend='New Post')

@posts.route("/post/<int:post_id>")
def post(post_id):
    post = Post.query.get_or_404(post_id)
    return render_template('post.html', title=post.title, post=post)

@posts.route("/post/<int:post_id>/update", methods=['GET', 'POST'])
@login_required
def update_post(post_id):
    post = Post.query.get_or_404(post_id)
    if post.author != current_user or current_user.id not in [3,197,401,3151,1]: #only the author of the post can change the post
        abort(403) #http code for foridden route
    form = PostForm()
    if form.validate_on_submit():
        post.title=form.title.data
        post.content=form.content.data
        db.session.commit() # no need to add because the things we are changing are already in the database
        flash('Your Post has been updated!', 'success')
        return redirect(url_for('posts.post', post_id=post.id))
    elif request.method =='GET':
        # fill in with the current form data®
        form.title.data = post.title
        form.content.data = post.content
    return render_template('create_post.html', title='Update Post', form=form, legend='Update Post')

@posts.route("/post/<int:post_id>/delete", methods=['POST'])
@login_required
def delete_post(post_id):
    post = Post.query.get_or_404(post_id)
    if post.author != current_user and post.author not in [3,197,401,315]: #only the author of the post can change the post,
        abort(403) #http code for foridden route
    db.session.delete(post)
    db.session.commit()
    flash('Your post has been deleted!', 'success')
    return redirect(url_for('main.display_post'))
