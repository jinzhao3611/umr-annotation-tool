from umr_annot_tool import db, create_app
from umr_annot_tool.models import Annotation, Doc, Sent
from sqlalchemy import or_, func

def fill_real_sent_ids():
    annotations = Annotation.query.all()
    
    for annotation in annotations:
        doc = Doc.query.get(annotation.doc_id)
        annotation.real_sent_id = None  # default

        if doc and doc.file_format == 'plain_text':
            splitted_sentences = doc.content.split('\n')
            try:
                target_line = splitted_sentences[annotation.sent_id - 1]
                target_line_nospace = target_line.replace(' ', '')

                found_sent = (
                    db.session.query(Sent)
                    .filter(
                        Sent.doc_id == doc.id,
                        or_(
                            func.replace(Sent.content, ' ', '') == target_line_nospace,
                            func.replace(Sent.content, ' ', '').ilike(f'%{target_line_nospace}%')
                        )
                    )
                    .first()
                )

                if found_sent:
                    annotation.real_sent_id = found_sent.id
                else:
                    print(f"[DEBUG] No exact match for annotation.id={annotation.id} with text: '{target_line}'")
            
            except IndexError:
                print(f"[DEBUG] annotation.id={annotation.id} => sent_id={annotation.sent_id} out of range.")

    db.session.commit()

    # Now count how many `real_sent_id` were set (i.e., not None)
    count_filled = Annotation.query.filter(Annotation.real_sent_id.isnot(None)).count()
    print(f"[INFO] Populated real_sent_id for {count_filled} annotations.")

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        fill_real_sent_ids()
        print("Done updating 'real_sent_id'.")
