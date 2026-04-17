import pytest
from urllib.parse import quote

from umr_annot_tool import db
from umr_annot_tool.models import Lexicon, Project


@pytest.mark.integration
class TestLexiconIntegration:
    def test_lexicon_page_preserves_annotation_return_target(self, admin_client, app):
        return_to = "/sentlevel/437?reopen_add_branch=1&parent_variable=s1a1"

        response = admin_client.get(
            f"/alllexicon/1?lemma=ontem&return_to={quote(return_to, safe='/')}"
        )

        assert response.status_code == 200
        page = response.get_data(as_text=True)
        assert "Back to Annotation" in page
        assert 'href="/sentlevel/437?reopen_add_branch=1&amp;parent_variable=s1a1"' in page
        assert 'id="lexicon-search-results"' in page
        assert "Lexicon Entries" not in page

    def test_add_lexicon_entry_is_searchable_and_merged_into_frames(self, admin_client, app):
        with app.app_context():
            project = Project.query.get(1)
            project.language = "Portuguese"
            db.session.commit()

        return_to = "/sentlevel/437?reopen_add_branch=1&parent_variable=s1a1"
        response = admin_client.post(
            "/alllexicon/1",
            data={
                "lemma": "governador",
                "name": "test roleset name",
                "framnet": "rescue.01",
                "vncls": "10.05",
                "args": "ARG0: test\nARG1: test2",
                "return_to": return_to,
                "submit": "Add Entry",
            },
            follow_redirects=False,
        )

        assert response.status_code == 302
        assert "/alllexicon/1" in response.headers["Location"]
        assert "lemma=governador" in response.headers["Location"]
        assert "return_to=" in response.headers["Location"]

        with app.app_context():
            lexicon = Lexicon.query.filter_by(project_id=1).first()
            assert lexicon is not None
            assert lexicon.data["governador"] == {
                "args": {"ARG0": "test", "ARG1": "test2"},
                "examples": [],
                "framnet": "rescue.01",
                "name": "test roleset name",
                "vncls": "10.05",
            }

        lexicon_page = admin_client.get("/alllexicon/1?lemma=governador")
        assert lexicon_page.status_code == 200
        page = lexicon_page.get_data(as_text=True)
        assert '"governador"' in page
        assert "Search for a lemma to verify that an entry was added." in page

        frames_response = admin_client.get("/download_frames?project_id=1")
        assert frames_response.status_code == 200
        frames = frames_response.get_json()
        assert "governador" in frames
        assert frames["governador"]["args"] == {"ARG0": "test", "ARG1": "test2"}

    def test_save_lexicon_frame_persists_project_frame_for_future_lookup(self, admin_client, app):
        response = admin_client.post(
            "/save_lexicon_frame",
            json={
                "project_id": 1,
                "sense": "ontem-01",
                "lemma": "ontem",
                "surface_form": "ontem",
            },
        )

        assert response.status_code == 200
        payload = response.get_json()
        assert payload["success"] is True
        assert payload["sense"] == "ontem-01"

        with app.app_context():
            lexicon = Lexicon.query.filter_by(project_id=1).first()
            assert lexicon is not None
            assert "ontem-01" in lexicon.data
            assert lexicon.data["ontem-01"]["_manual"]["lemma"] == "ontem"

        frames_response = admin_client.get("/download_frames?project_id=1")
        assert frames_response.status_code == 200
        frames = frames_response.get_json()
        assert "ontem-01" in frames

    def test_download_lexicon_returns_json_attachment(self, admin_client, app):
        with app.app_context():
            project = Project.query.get(1)
            project.language = "Portuguese"
            lexicon = Lexicon.query.filter_by(project_id=1).first()
            if lexicon is None:
                lexicon = Lexicon(project_id=1, data={})
                db.session.add(lexicon)
            lexicon.data = {
                "governador": {
                    "args": {"ARG0": "test", "ARG1": "test2"},
                    "examples": [],
                    "framnet": "rescue.01",
                    "name": "test roleset name",
                    "vncls": "10.05",
                }
            }
            db.session.commit()

        response = admin_client.get("/download_lexicon/1")
        assert response.status_code == 200
        assert response.headers["Content-Type"].startswith("application/json")
        assert "attachment;" in response.headers["Content-Disposition"]
        assert "_lexicon.json" in response.headers["Content-Disposition"]

        payload = response.get_json()
        assert payload["project_id"] == 1
        assert payload["language"] == "Portuguese"
        assert "exported_at" in payload
        assert payload["entries"]["governador"]["args"] == {"ARG0": "test", "ARG1": "test2"}
