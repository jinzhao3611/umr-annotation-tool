from flask import Flask, render_template, request
from werkzeug.utils import secure_filename


import attr
from typing import List


@attr.s()
class Sentence:
    words: List[str] = attr.ib()
    id: int = attr.ib()
    length: int = attr.ib()


app = Flask(__name__)
snts = []


@app.route("/", methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        if 'file' in request.files:
            f = request.files['file']
            secure_filename(f.filename)
            snts.clear()
            for i, line in enumerate(f, 1):
                snts.append(Sentence(line.strip().decode('UTF-8').split(), i, len(line.strip().decode('UTF-8').split())))
        else:
            pass
        total_snts = len(snts)
        if "set_sentence" in request.form:
            snt_id = request.form["sentence_id"]
            return render_template('index.html', sentence=snts[int(snt_id)-1], total_snts=total_snts)
        else:
            return render_template('index.html', sentence=snts[0], total_snts=total_snts)

    else:
        return render_template('index.html', sentence=Sentence([], 0, 0), total_snts=0)



def main():
    app.run(debug=True, port=5001)


if __name__ == "__main__":
    main()