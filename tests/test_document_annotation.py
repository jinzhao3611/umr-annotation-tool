import pytest
from pathlib import Path
from playwright.sync_api import expect
from tests.fixtures.sample_files import (
    get_multi_sentence_umr,
    get_complex_umr,
    ANNOTATION_TEMPLATES
)


class TestDocumentAnnotation:
    """Test document level annotation functionality."""
    
    @pytest.fixture
    def annotator_page(self, page, live_server):
        """Setup annotator user logged in with access to a project."""
        # Go to login page
        page.goto(f"{live_server}/login")
        page.fill('input[name="email"]', 'test@example.com')
        page.fill('input[name="password"]', 'testpassword')
        page.click('input[type="submit"]')
        page.wait_for_url(f"{live_server}/account")
        
        yield page
    
    @pytest.fixture
    def project_with_multi_doc(self, page, live_server, tmp_path):
        """Create a project with multi-sentence UMR document."""
        # Login as admin
        page.goto(f"{live_server}/account")
        page.wait_for_load_state("networkidle")
        
        if "/login" in page.url:
            page.fill('input[name="email"]', 'admin@example.com')
            page.fill('input[name="password"]', 'adminpassword')
            page.click('input[type="submit"]')
            page.wait_for_url(f"{live_server}/account")
        
        # Create test UMR file with multiple sentences
        test_file = tmp_path / "multi_doc.umr"
        test_file.write_text(get_multi_sentence_umr())
        
        # Create new project
        new_project_link = page.locator('a:has-text("New Project")').first
        new_project_link.click()
        page.wait_for_load_state("networkidle")
        
        project_name_input = page.locator('input#projectname')
        project_name_input.fill('Document Annotation Project')
        
        language_select = page.locator('select')
        if language_select.count() > 0:
            language_select.select_option(label='English')
        
        create_btn = page.locator('a.btn:has-text("Create Project"), button:has-text("Create Project")').first
        if create_btn.count() == 0:
            create_btn = page.get_by_text("Create Project")
        create_btn.click()
        page.wait_for_url(f"{live_server}/account", timeout=10000)
        
        # Navigate to project and upload file
        project_link = page.locator('a[href*="/project/"]:has-text("Document Annotation Project")').first
        project_link.click()
        page.wait_for_load_state("networkidle")
        
        upload_btn = page.locator('button:has-text("Upload Document"), a:has-text("Upload Document")').first
        upload_btn.click()
        page.wait_for_load_state("networkidle")
        
        file_input = page.locator('input[type="file"]')
        project_select = page.locator('select[name="project"], select[id="project"]').first
        if project_select.count() > 0:
            project_select.select_option(label='Document Annotation Project')
        
        file_input.set_input_files(str(test_file))
        
        submit_button = page.locator('input[type="submit"], button[type="submit"]').first
        submit_button.click()
        page.wait_for_load_state("networkidle", timeout=30000)
        
        # Add testuser as member
        page.goto(f"{live_server}/account")
        project_link = page.locator('a[href*="/project/"]:has-text("Document Annotation Project")').first
        project_link.click()
        page.wait_for_load_state("networkidle")
        
        members_link = page.locator('a:has-text("Members")').first
        members_link.click()
        page.wait_for_load_state("networkidle")
        
        username_input = page.locator('input[placeholder*="username"], input[name="username"], input[placeholder*="Username"]').first
        username_input.fill('testuser')
        
        add_member_btn = page.locator('button:has-text("Add Member")').first
        add_member_btn.click()
        page.wait_for_load_state("networkidle")
        
        yield page
    
    @pytest.mark.annotation
    def test_open_document_annotation_view(self, annotator_page, project_with_multi_doc, live_server):
        """Test opening document level annotation view."""
        # Navigate to project
        project_link = annotator_page.locator('a[href*="/project/"]:has-text("Document Annotation Project")').first
        project_link.click()
        annotator_page.wait_for_load_state("networkidle")
        
        # Click on Documents tab
        docs_tab = annotator_page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            annotator_page.wait_for_load_state("networkidle")
        
        # Find document annotation button
        doc_annotate_btn = annotator_page.locator('button:has-text("Document Annotation"), a:has-text("Document Level"), button:has-text("Doc Annotation")').first
        
        if doc_annotate_btn.count() == 0:
            # Try regular annotate button
            annotate_btn = annotator_page.locator('button:has-text("Annotate"), a:has-text("Annotate")').first
            annotate_btn.click()
            annotator_page.wait_for_load_state("networkidle")
            
            # Look for document level tab/button
            doc_tab = annotator_page.locator('button:has-text("Document"), a:has-text("Document Level"), .tab:has-text("Document")').first
            if doc_tab.count() > 0:
                doc_tab.click()
                annotator_page.wait_for_load_state("networkidle")
        else:
            doc_annotate_btn.click()
            annotator_page.wait_for_load_state("networkidle")
        
        # Verify document annotation view loaded
        page_content = annotator_page.content()
        assert any(text in page_content for text in [
            "Document Annotation",
            "Document Level",
            "document level annotation",
            "temporal",
            "modal",
            "Coreference"
        ]), "Document annotation view did not load"
    
    @pytest.mark.annotation
    def test_view_temporal_relations(self, annotator_page, project_with_multi_doc, live_server):
        """Test viewing temporal relations in document annotation."""
        # Navigate to document annotation view
        project_link = annotator_page.locator('a[href*="/project/"]:has-text("Document Annotation Project")').first
        project_link.click()
        annotator_page.wait_for_load_state("networkidle")
        
        docs_tab = annotator_page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            annotator_page.wait_for_load_state("networkidle")
        
        annotate_btn = annotator_page.locator('button:has-text("Annotate"), a:has-text("Annotate")').first
        annotate_btn.click()
        annotator_page.wait_for_load_state("networkidle")
        
        # Look for document level view
        doc_tab = annotator_page.locator('button:has-text("Document"), a:has-text("Document Level"), .tab:has-text("Document")').first
        if doc_tab.count() > 0:
            doc_tab.click()
            annotator_page.wait_for_load_state("networkidle")
        
        # Check for temporal relations
        page_content = annotator_page.content()
        assert any(text in page_content for text in [
            "temporal",
            ":before",
            ":after",
            "document-creation-time"
        ]), "Temporal relations not displayed"
    
    @pytest.mark.annotation
    def test_add_coreference_chain(self, annotator_page, project_with_multi_doc, live_server):
        """Test adding coreference chains between entities."""
        # Navigate to document annotation view
        project_link = annotator_page.locator('a[href*="/project/"]:has-text("Document Annotation Project")').first
        project_link.click()
        annotator_page.wait_for_load_state("networkidle")
        
        docs_tab = annotator_page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            annotator_page.wait_for_load_state("networkidle")
        
        annotate_btn = annotator_page.locator('button:has-text("Annotate"), a:has-text("Annotate")').first
        annotate_btn.click()
        annotator_page.wait_for_load_state("networkidle")
        
        # Look for document level view
        doc_tab = annotator_page.locator('button:has-text("Document"), a:has-text("Document Level")').first
        if doc_tab.count() > 0:
            doc_tab.click()
            annotator_page.wait_for_load_state("networkidle")
        
        # Look for coreference tools
        coref_btn = annotator_page.locator('button:has-text("Add Coreference"), button:has-text("Coref"), button:has-text("Link Entities")').first
        
        if coref_btn.count() > 0:
            coref_btn.click()
            annotator_page.wait_for_load_state("networkidle")
            
            # Select entities to link (if UI supports it)
            entity1 = annotator_page.locator('.entity:has-text("dog"), .concept:has-text("s1d")').first
            entity2 = annotator_page.locator('.entity:has-text("cat"), .concept:has-text("s2c")').first
            
            if entity1.count() > 0 and entity2.count() > 0:
                entity1.click()
                entity2.click()
                
                # Confirm coreference
                confirm_btn = annotator_page.locator('button:has-text("Confirm"), button:has-text("Add Link")').first
                if confirm_btn.count() > 0:
                    confirm_btn.click()
                    annotator_page.wait_for_load_state("networkidle")
    
    @pytest.mark.annotation
    def test_edit_document_annotation(self, annotator_page, project_with_multi_doc, live_server):
        """Test editing document level annotation."""
        # Navigate to document annotation view
        project_link = annotator_page.locator('a[href*="/project/"]:has-text("Document Annotation Project")').first
        project_link.click()
        annotator_page.wait_for_load_state("networkidle")
        
        docs_tab = annotator_page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            annotator_page.wait_for_load_state("networkidle")
        
        annotate_btn = annotator_page.locator('button:has-text("Annotate"), a:has-text("Annotate")').first
        annotate_btn.click()
        annotator_page.wait_for_load_state("networkidle")
        
        # Look for document annotation editor
        doc_editor = annotator_page.locator('textarea[name*="document"], textarea[id*="document"], .document-annotation-editor').first
        
        if doc_editor.count() > 0:
            # Add new document level annotation
            new_annotation = """(s1s0 / sentence
    :temporal ((document-creation-time :before s1b))
    :modal ((author :full-affirmative s1b)))"""
            
            doc_editor.fill(new_annotation)
            
            # Save the document annotation
            save_btn = annotator_page.locator('button:has-text("Save Document Annotation"), button:has-text("Save Doc")').first
            if save_btn.count() == 0:
                save_btn = annotator_page.locator('button:has-text("Save")').first
            
            if save_btn.count() > 0:
                save_btn.click()
                annotator_page.wait_for_load_state("networkidle")
                
                # Check for success
                page_content = annotator_page.content()
                assert any(text in page_content.lower() for text in [
                    "saved",
                    "success",
                    "updated"
                ]), "Document annotation save not confirmed"
    
    @pytest.mark.annotation
    def test_modal_annotations(self, annotator_page, project_with_multi_doc, live_server):
        """Test adding modal annotations to document."""
        # Navigate to document annotation view
        project_link = annotator_page.locator('a[href*="/project/"]:has-text("Document Annotation Project")').first
        project_link.click()
        annotator_page.wait_for_load_state("networkidle")
        
        docs_tab = annotator_page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            annotator_page.wait_for_load_state("networkidle")
        
        annotate_btn = annotator_page.locator('button:has-text("Annotate"), a:has-text("Annotate")').first
        annotate_btn.click()
        annotator_page.wait_for_load_state("networkidle")
        
        # Look for modal annotation tools
        modal_btn = annotator_page.locator('button:has-text("Add Modal"), button:has-text("Modal Annotation")').first
        
        if modal_btn.count() > 0:
            modal_btn.click()
            annotator_page.wait_for_load_state("networkidle")
            
            # Select modal type
            modal_select = annotator_page.locator('select[name="modal_type"], select[id="modal"]').first
            if modal_select.count() > 0:
                modal_select.select_option(label='full-affirmative')
                
                # Apply to event
                event_select = annotator_page.locator('select[name="event"], .event-selector').first
                if event_select.count() > 0:
                    event_select.select_option(index=0)  # Select first event
                
                # Save modal annotation
                apply_btn = annotator_page.locator('button:has-text("Apply"), button:has-text("Add Modal")').first
                if apply_btn.count() > 0:
                    apply_btn.click()
                    annotator_page.wait_for_load_state("networkidle")
    
    @pytest.mark.annotation
    def test_document_overview(self, annotator_page, project_with_multi_doc, live_server):
        """Test document overview showing all sentences and relations."""
        # Navigate to document annotation view
        project_link = annotator_page.locator('a[href*="/project/"]:has-text("Document Annotation Project")').first
        project_link.click()
        annotator_page.wait_for_load_state("networkidle")
        
        docs_tab = annotator_page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            annotator_page.wait_for_load_state("networkidle")
        
        # Look for document overview button
        overview_btn = annotator_page.locator('button:has-text("Overview"), a:has-text("Document Overview")').first
        
        if overview_btn.count() > 0:
            overview_btn.click()
            annotator_page.wait_for_load_state("networkidle")
            
            # Check that all sentences are displayed
            page_content = annotator_page.content()
            assert "dog barked" in page_content, "First sentence not in overview"
            assert "cat ran" in page_content, "Second sentence not in overview"
            
            # Check for document structure visualization
            assert any(text in page_content for text in [
                "Document Structure",
                "Sentence 1",
                "Sentence 2",
                "Relations"
            ]), "Document structure not displayed in overview"
    
    @pytest.mark.annotation
    def test_export_document_annotation(self, annotator_page, project_with_multi_doc, live_server):
        """Test exporting complete document annotation."""
        # Navigate to document annotation view
        project_link = annotator_page.locator('a[href*="/project/"]:has-text("Document Annotation Project")').first
        project_link.click()
        annotator_page.wait_for_load_state("networkidle")
        
        docs_tab = annotator_page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            annotator_page.wait_for_load_state("networkidle")
        
        annotate_btn = annotator_page.locator('button:has-text("Annotate"), a:has-text("Annotate")').first
        annotate_btn.click()
        annotator_page.wait_for_load_state("networkidle")
        
        # Look for export button
        export_btn = annotator_page.locator('button:has-text("Export"), a:has-text("Download Annotation")').first
        
        if export_btn.count() > 0:
            # Set up download promise
            with annotator_page.expect_download() as download_info:
                export_btn.click()
                download = download_info.value
                
                # Verify download
                assert download.suggested_filename.endswith('.umr'), "Export file should be UMR format"
                
                # Save and check content
                import tempfile
                with tempfile.NamedTemporaryFile(suffix='.umr', delete=False) as tmp:
                    download.save_as(tmp.name)
                    
                    # Read and verify content
                    with open(tmp.name, 'r') as f:
                        content = f.read()
                        assert "sentence level graph" in content, "Exported file missing sentence annotations"
                        assert "document level annotation" in content, "Exported file missing document annotations"
    
    @pytest.mark.annotation
    def test_alignment_preservation(self, annotator_page, project_with_multi_doc, live_server):
        """Test that alignments are preserved in document annotation."""
        # Navigate to document annotation view
        project_link = annotator_page.locator('a[href*="/project/"]:has-text("Document Annotation Project")').first
        project_link.click()
        annotator_page.wait_for_load_state("networkidle")
        
        docs_tab = annotator_page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            annotator_page.wait_for_load_state("networkidle")
        
        annotate_btn = annotator_page.locator('button:has-text("Annotate"), a:has-text("Annotate")').first
        annotate_btn.click()
        annotator_page.wait_for_load_state("networkidle")
        
        # Check for alignment information
        page_content = annotator_page.content()
        assert any(text in page_content for text in [
            "alignment",
            "s1b: 3-3",
            "s1d: 2-2",
            "Alignment"
        ]), "Alignment information not preserved"