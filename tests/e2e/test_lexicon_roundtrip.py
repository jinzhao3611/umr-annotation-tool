import pytest
import uuid

from playwright.sync_api import expect

from umr_annot_tool import db
from umr_annot_tool.models import (
    Annotation,
    Doc,
    DocVersion,
    Lattice,
    Lexicon,
    Partialgraph,
    Project,
    Projectuser,
    Sent,
    User,
)


def seed_portuguese_annotation(app):
    with app.app_context():
        admin_user = User.query.filter_by(email="admin@example.com").first()
        assert admin_user is not None

        project_name = f"Lexicon Roundtrip {uuid.uuid4().hex[:8]}"
        project = Project(
            project_name=project_name,
            language="Portuguese",
            created_by_user_id=admin_user.id,
        )
        db.session.add(project)
        db.session.flush()

        db.session.add(
            Projectuser(
                project_name=project_name,
                user_id=admin_user.id,
                project_id=project.id,
                permission="admin",
            )
        )
        db.session.add(Lattice(project_id=project.id, data={}))
        db.session.add(Partialgraph(project_id=project.id, partial_umr={}))
        db.session.add(Lexicon(project_id=project.id, data={}))

        doc = Doc(
            filename="lexicon_roundtrip.umr",
            user_id=admin_user.id,
            project_id=project.id,
        )
        db.session.add(doc)
        db.session.flush()

        doc_version = DocVersion(
            doc_id=doc.id,
            user_id=admin_user.id,
            stage="checkout",
            version_number=1,
        )
        db.session.add(doc_version)
        db.session.flush()

        sent = Sent(
            content="O governador abandonou a candidatura ontem .",
            doc_id=doc.id,
        )
        db.session.add(sent)
        db.session.flush()

        db.session.add(
            Annotation(
                sent_annot="(s1a1 / abandonar-01)",
                doc_annot="",
                actions={},
                alignment={},
                doc_version_id=doc_version.id,
                sent_id=sent.id,
            )
        )
        db.session.commit()

        return {
            "project_id": project.id,
            "doc_version_id": doc_version.id,
        }


@pytest.mark.annotation
@pytest.mark.e2e
def test_back_to_annotation_reopens_add_branch_dialog(admin_page, live_server, app):
    seeded = seed_portuguese_annotation(app)
    page = admin_page

    page.goto(f"{live_server}/sentlevel/{seeded['doc_version_id']}/1")
    page.wait_for_load_state("networkidle")

    variable_span = page.locator("#amr pre .variable-span", has_text="s1a1").first
    expect(variable_span).to_be_visible()

    variable_span.click(button="right")
    page.get_by_text("Add Branch").click()

    heading = page.locator(".add-branch-dialog h3")
    expect(heading).to_have_text("Add Branch to s1a1 / abandonar-01")

    page.locator("#relation").select_option(value=":actor")
    expect(page.locator("#child-node-type")).to_be_visible()
    page.locator("#child-node-type").select_option(value="token")
    expect(page.locator("#token-selection-container")).to_be_visible()

    page.locator('#token-selection-container .token-item[data-token="governador"]').click()
    open_lexicon_link = page.get_by_role("link", name='Open Lexicon For "governador"')
    expect(open_lexicon_link).to_be_visible()
    open_lexicon_link.click()

    page.wait_for_url(lambda url: "/alllexicon/" in url)
    expect(page.get_by_role("link", name="Back to Annotation")).to_be_visible()
    expect(page.locator("#lemma-input")).to_have_value("governador")

    page.fill('input[name="name"]', "test roleset name")
    page.fill('input[name="framnet"]', "rescue.01")
    page.fill('input[name="vncls"]', "10.05")
    page.fill('textarea[name="args"]', "ARG0: test\nARG1: test2")
    page.get_by_role("button", name="Add Entry").click()

    page.wait_for_load_state("networkidle")
    search_results = page.locator("#lexicon-search-results")
    expect(search_results).to_contain_text("governador")
    expect(search_results).to_contain_text("test roleset name")

    page.get_by_role("link", name="Back to Annotation").click()
    page.wait_for_url(lambda url: "/sentlevel/" in url)
    page.wait_for_load_state("networkidle")

    restored_heading = page.locator(".add-branch-dialog h3")
    expect(restored_heading).to_be_visible()
    expect(restored_heading).to_have_text("Add Branch to s1a1 / abandonar-01")
    expect(page.locator('#relation-search')).to_be_visible()
