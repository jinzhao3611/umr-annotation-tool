# This is used when updating heroku postgres database in March 2022 (because the schema of the database changed)
import pandas as pd
import re, json, math
import numpy as np

from flask_bcrypt import Bcrypt
from umr_annot_tool import db, bcrypt
from umr_annot_tool.models import Sent, Doc, Annotation, User, Post, Lexicon, Projectuser, Project, Lattice, Partialgraph

bcrypt = Bcrypt()


def update_user():
    csv_file = "/Users/jinzhao/Downloads/user.csv"
    df = pd.read_csv(csv_file)
    hashed_password = bcrypt.generate_password_hash('qcisauser').decode('utf-8')
    qc_users = []
    existing_ids = set(df.id)
    print(existing_ids)
    for i in df.id:
        assert i + 100 not in existing_ids
        qc_user = {"id": i + 100,
                   "username": f"{i}_default_project_qc",
                   "email": f"{i}_default_project@qc.com",
                   'image_file': "default.jpg",
                   "password": hashed_password,
                   }
        qc_users.append(qc_user)
    df = df.append(qc_users, ignore_index=True)

    assert 1 not in existing_ids
    dummy_user_row = {"id": 1,
                      'username': "dummy_user",
                      'email': "dummy_user@unassigneddocs.com",
                      'image_file': "default.jpg",
                      "password": hashed_password}
    df = df.append(dummy_user_row, ignore_index=True)
    df.to_csv("/Users/jinzhao/Downloads/user_new.csv", index=False)


def update_annotation():
    csv_file = "/Users/jinzhao/Downloads/annotation.csv"
    df = pd.read_csv(csv_file)
    alignment_list = []
    for value in df.alignment:
        alignment_dict = {}
        try:
            aligns = value.split()
            for i in range(0, len(aligns), 2):
                variable = re.search(r"\((.*?)\)", aligns[i]).group(1).strip()
                concept = re.search(r"(.*?)\(.*?\)", aligns[i]).group(1).strip()
                # print("variable: ", variable)
                # print("concept: ", concept)
                # print("align: ", aligns[i+1].strip())
                if variable:
                    alignment_dict[variable] = aligns[i + 1]
                else:
                    alignment_dict[concept] = aligns[i + 1]
            alignment_list.append(json.dumps(alignment_dict))

        except Exception as e:
            # print(e)
            # print(value)
            alignment_list.append(json.dumps({}))

    df.drop("alignment", axis=1, inplace=True)
    df["alignment"] = alignment_list

    doc_annot_list = []
    for s in df.doc_annot:
        if isinstance(s, float) and math.isnan(s):
            doc_annot_list.append('<div id="amr"></div>')
        else:
            doc_annot_list.append(s)
    print(doc_annot_list)
    df.drop("doc_annot", axis=1, inplace=True)
    df["doc_annot"] = doc_annot_list

    df.rename(columns={'umr': 'sent_umr', 'annot_str': 'sent_annot'}, inplace=True)
    df.to_csv("/Users/jinzhao/Downloads/annotation_new.csv", index=False)


def update_project():
    csv_file = "/Users/jinzhao/Downloads/user_new.csv"
    df = pd.read_csv(csv_file)
    project_list = []
    i = 1
    for user_id, user_name in dict(zip(df.id, df.username)).items():
        if user_name[-3:] == "_qc":
            print(user_id, user_name)
            project_list.append({"id": i, "project_name": "default_project", "qc_user_id": user_id})
            i += 1
    print(project_list)
    project_df = pd.DataFrame(project_list, index=None)
    project_df.to_csv("/Users/jinzhao/Downloads/project_new.csv", index=False)


def update_projectuser():
    csv_file = "/Users/jinzhao/Downloads/user_new.csv"
    df = pd.read_csv(csv_file)
    projectuser_list = []
    i = 1
    for user_id, user_name in dict(zip(df.id, df.username)).items():
        if user_name[-3:] != "_qc" and user_name != "dummy_user":
            print(user_id, user_name)
            projectuser_list.append({"id": i, "project_name": "default_project", "user_id": user_id, "project_id": i,
                                     "permission": "admin"})
            i += 1
    print(projectuser_list)
    project_df = pd.DataFrame(projectuser_list, index=None)
    project_df.to_csv("/Users/jinzhao/Downloads/projectuser_new.csv", index=False)


def update_lattice():
    lattices = []
    for i in range(1, 39):
        lattices.append({"id": i,
                         "project_id": i,
                         "aspect": json.dumps({"Habitual": True, "Imperfective": True, "Process": True, "Atelic Process": True,
                                    "Perfective": True,
                                    "State": True, "Activity": True, "Endeavor": True, "Performance": True,
                                    "Reversible State": True,
                                    "Irreversible State": True, "Inherent State": True, "Point State": True,
                                    "Undirected Activity": True,
                                    "Directed Activity": True, "Semelfactive": True, "Undirected Endeavor": True,
                                    "Directed Endeavor": True,
                                    "Incremental Accomplishment": True, "Nonincremental Accomplishment": True,
                                    "Directed Achievement": True,
                                    "Reversible Directed Achievement": True, "Irreversible Directed Achievement": True}),
                         "person": json.dumps({"person": True, "non-3rd": True, "non-1st": True, "1st": True, "2nd": True,
                                    "3rd": True, "incl.": True,
                                    "excl.": True}),
                         "number": json.dumps({"Singular": True, "Non-singular": True, "Paucal": True, "Plural": True,
                                    "Dual": True,
                                    "Non-dual Paucal": True, "Greater Plural": True, "Trial": True,
                                    "Non-trial Paucal": True}),
                         "modal": json.dumps({"Non-NeutAff": True, "Non-FullAff": True, "Non-NeutNeg": True, "Non-FullNeg": True,
                                   "FullAff": True,
                                   "PrtAff": True, "NeutAff": True, "FullNeg": True, "PrtNeg": True, "NeutNeg": True,
                                   "Strong-PrtAff": True,
                                   "Weak-PrtAff": True, "Strong-NeutAff": True, "Weak-NeutAff": True,
                                   "Strong-PrtNeg": True,
                                   "Weak-PrtNeg": True, "Strong-NeutNeg": True, "Weak-NeutNeg": True}),
                         "discourse": json.dumps({"or": True, "and+but": True, "inclusive-disj": True, "exclusive-disj": True,
                                       "and+unexpected": True,
                                       "and+contrast": True, "but": True, "and": True, "consecutive": True,
                                       "additive": True,
                                       "unexpected-co-occurrence": True, "contrast-01": True, ":subtraction": True})})
    lattice_df = pd.DataFrame(lattices, index=None)
    lattice_df.to_csv("/Users/jinzhao/Downloads/lattice_new.csv", index=False)


def update_partialgraph():
    partialgraphs = []
    for i in range(1, 39):
        partialgraphs.append({"id": i,
                              "project_id": i,
                              "partial_umr": {}})
    partialgraph_df = pd.DataFrame(partialgraphs, index=None)
    partialgraph_df.to_csv("/Users/jinzhao/Downloads/partialgraph_new.csv", index=False)


def update_doc():
    csv_file = "/Users/jinzhao/Downloads/projectuser_new.csv"
    projectuser_df = pd.read_csv(csv_file)
    user_project_dict = dict(zip(projectuser_df.user_id, projectuser_df.project_id))
    doc_df = pd.read_csv("/Users/jinzhao/Downloads/doc.csv") # change this
    user_id_list = doc_df.user_id.tolist()
    project_id_list = [user_project_dict[user_id] for user_id in user_id_list]
    doc_df["project_id"] = project_id_list
    doc_df.to_csv("/Users/jinzhao/Downloads/doc_new.csv", index=False)


def update_sent():
    csv_file = "/Users/jinzhao/Downloads/sent.csv"
    sent_df = pd.read_csv(csv_file)
    sent_df.drop(["user_id"], axis=1, inplace=True)
    sent_df.to_csv("/Users/jinzhao/Downloads/sent_new.csv", index=False)


def update_docda():
    pass


def update_docqc():
    pass


def update_lexicon():
    old_lexi_df = pd.read_csv("/Users/jinzhao/Downloads/lexicon.csv")
    project_df = pd.read_csv("/Users/jinzhao/Downloads/project.csv")
    new_lexi = []
    for i in project_df.id.tolist():
        try:
            lexi = old_lexi_df[old_lexi_df.project_id == i].lexi.values[0]
        except IndexError:
            lexi = "{}"
        new_lexi.append({"id": i,
                              "project_id": i,
                              "lexi": lexi})
    new_lexi_df = pd.DataFrame(new_lexi, index=None)
    new_lexi_df.to_csv("/Users/jinzhao/Downloads/lexicon_new.csv", index=False)





def update_post():
    pass


def copy_doc_csv_postgres():
    df = pd.read_csv("/Users/jinzhao/Downloads/doc_new.csv")
    for index, row in df.iterrows():
        doc_row = Doc(id=row["id"],filename=row["filename"],project_id=row["project_id"],user_id=row["user_id"],lang=row["lang"],content=row["content"],file_format=row["file_format"])
        db.session.add(doc_row)
    db.session.commit()

# split csv file into multiple csv files
def split_csv(csv_file, num_files):
    df = pd.read_csv(csv_file)
    df_list = np.array_split(df, num_files)
    for i in range(num_files):
        df_list[i].to_csv("/Users/jinzhao/Downloads/doc_0_1_" + str(i) + ".csv", index=False)

