from flask import Flask, render_template, request
from werkzeug.utils import secure_filename

import attr
from typing import List, Dict
import json

FRAME_DESC_FILE = "resources/frames-arg_descriptions.json"


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
app = Flask(__name__)
snts = []


@app.route("/", methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        try:
            token = request.get_json(force=True)["selected"]
            print(token)
            return frame_parser.parse(token)
        except:
            pass
        if 'file' in request.files:
            f = request.files['file']
            secure_filename(f.filename)
            snts.clear()
            for i, line in enumerate(f, 1):
                snts.append(
                    Sentence(line.strip().decode('UTF-8').split(), i, len(line.strip().decode('UTF-8').split())))
        else:
            pass
        total_snts = len(snts)
        if "set_sentence" in request.form:
            snt_id = request.form["sentence_id"]
            return render_template('index.html', sentence=snts[int(snt_id) - 1], total_snts=total_snts, all_snts=snts)
        else:
            print("hahaha")
            print(snts)
            return render_template('index.html', sentence=snts[0], total_snts=total_snts, all_snts=snts)
    else:
        print("xixixix")
        print(snts)
        return render_template('index.html', sentence=Sentence([], 0, 0), total_snts=0, all_snts=[])


def main():
    app.run(debug=True)


if __name__ == "__main__":
    main()