from werkzeug.utils import secure_filename
from typing import List, Dict
import attr
import json

from flask import render_template, request, Blueprint
from umr_annot_tool.models import Post
from umr_annot_tool.models import Sent, Doc, Annotation
from umr_annot_tool.main.forms import UploadForm
from umr_annot_tool import db

main = Blueprint('main', __name__)
FRAME_DESC_FILE = "/Users/jinzhao/schoolwork/lab-work/umr-annotation-tool/umr_annot_tool/resources/frames-arg_descriptions.json"
# FRAME_DESC_FILE = "/umr_annot_tool/resources/frames_chinese.json"

@attr.s()
class Sentence:
    words: List[str] = attr.ib()
    id: int = attr.ib()
    length: int = attr.ib()


@attr.s()
class ArgTokenParser:
    frame_dict: Dict = attr.ib()

    @classmethod
    def from_json(cls, frame_file: str):
        frame_dict = json.load(open(frame_file, "r"))
        return cls(frame_dict)

    def parse(self, token: str) -> Dict:
        senses = []
        token_pattern = token + "-"
        for sense in self.frame_dict:
            if sense.startswith(token_pattern):
                senses.append({"name": sense, "desc": self._desc2str(sense)})
        if not senses:
            senses.append({"name": token, "desc": token + "\nThis is placeholder"})
        return {"res": senses}

    def _desc2str(self, name: str) -> str:
        temp = [name]
        desc: Dict = self.frame_dict[name]
        for pair in desc.items():
            temp.append(": ".join(pair))
        return "\n".join(temp)


frame_parser = ArgTokenParser.from_json(FRAME_DESC_FILE)
snts = []
target_language = ['Default']



@main.route("/annotate", methods=['GET', 'POST'])
def annotate():
    if request.method in ['GET', 'POST']:
        try:
            token = request.get_json(force=True)["selected"]
            print(token)
            return frame_parser.parse(token)
        except:
            pass
        total_snts = len(snts)
        print(f"total_snts: {total_snts}")
        print(target_language)

        if "set_sentence" in request.form:
            snt_id = request.form["sentence_id"]
            return render_template('index.html', sentence=snts[int(snt_id) - 1], total_snts=total_snts, all_snts=snts, lang=target_language[0])
        else:
            return render_template('index.html', sentence=snts[0], total_snts=total_snts, all_snts=snts, lang=target_language[0])
    else:
        return render_template('index.html', sentence=Sentence([], 0, 0), total_snts=0, all_snts=[], lang=target_language[0])


@main.route("/upload", methods=['GET', 'POST'])
def upload():
    form = UploadForm()
    if request.method == "POST":
        Doc.query.delete()
        Sent.query.delete()
        target_language[0] = form.autocomplete_input.data
        print(target_language)

        file = request.files['file']
        secure_filename(file.filename)
        snts.clear()
        for _, line in enumerate(file, 1):
            first_sent = line.strip().decode('UTF-8')
            break
        print(first_sent)
        snts.append(Sentence(first_sent.split(), 1, len(first_sent.split())))

        if not Sent.query.filter_by(content=first_sent).first():# this doc is not already added in
            doc = Doc(language=target_language[0])
            db.session.add(doc)
            db.session.commit()

            sent = Sent(content=first_sent, document=doc)
            db.session.add(sent)
            db.session.commit()
            for i, line in enumerate(file, 1):
                snts.append(Sentence(line.strip().decode('UTF-8').split(), i, len(line.strip().decode('UTF-8').split())))
                sent = Sent(content=line.strip().decode('UTF-8'), document=doc)
                db.session.add(sent)
                db.session.commit()
            print(snts)

        print("####################### docs")
        print(Doc.query.all())
        print("####################### sents")
        print(Sent.query.all())
        print("####################### first match")
        print(Sent.query.filter_by(content='He denied any wrongdoing .').first())

    return render_template('upload.html', title='upload', form=form)


@main.route("/doclevel", methods=['GET', 'POST'])
def doclevel():
    return render_template('doclevel.html', title='Doc Level Annotation')


@main.route("/about")
def about():
    return render_template('about.html', title='About')


# this is corresponded to corey's video home page, also thinking about making it doclevel annotation page

@main.route("/")
@main.route("/display_post")
def display_post():
    # posts = Post.query.all()
    page = request.args.get('page', default=1, type=int)
    # posts = Post.query.paginate(page=page, per_page=2)
    posts = Post.query.order_by(Post.date_posted.desc()).paginate(page=page,
                                                                  per_page=2)  # if we want to order the posts from the lastest to the oldest
    return render_template('display_post.html', posts=posts)
