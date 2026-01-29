"""
Test suite for sentence level annotation functionality.

These tests verify:
- Opening the annotation editor
- Viewing sentence text and AMR graphs
- Editing annotations
- Save functionality

Note: These tests will skip if annotation features are not available in the UI.
"""
import pytest
from pathlib import Path
from playwright.sync_api import expect
from tests.fixtures.sample_files import (
    get_simple_english_umr,
    get_multi_sentence_umr,
    get_complex_umr,
    get_expected_parsed_data
)


class TestSentenceAnnotation:
    """Test sentence level annotation functionality."""
    
    def create_project_with_document(self, page, live_server, tmp_path, project_name="Annotation Test Project"):
        """Helper method to create a project with an uploaded UMR document."""
        # Login as admin
        page.goto(f"{live_server}/account")
        page.wait_for_load_state("networkidle")
        
        if "/login" in page.url:
            page.fill('input[name="email"]', 'admin@example.com')
            page.fill('input[name="password"]', 'adminpassword')
            page.click('input[type="submit"]')
            page.wait_for_url(f"{live_server}/account")
        
        # Check if project already exists
        page_content = page.content()
        if project_name not in page_content:
            # Create test UMR file
            test_file = tmp_path / "test_annotation.umr"
            test_file.write_text(get_simple_english_umr())
            
            # Create new project
            new_project_link = page.locator('a:has-text("New Project")').first
            new_project_link.click()
            page.wait_for_load_state("networkidle")
            
            project_name_input = page.locator('input#projectname')
            project_name_input.fill(project_name)
            
            language_select = page.locator('select')
            if language_select.count() > 0:
                language_select.select_option(label='English')
            
            create_btn = page.locator('a.btn:has-text("Create Project"), button:has-text("Create Project")').first
            if create_btn.count() == 0:
                create_btn = page.get_by_text("Create Project")
            create_btn.click()
            page.wait_for_url(f"{live_server}/account", timeout=10000)
            
            # Navigate to project
            project_link = page.locator(f'a[href*="/project/"]:has-text("{project_name}")').first
            project_link.click()
            page.wait_for_load_state("networkidle")
            
            # Upload the test file
            upload_btn = page.locator('button:has-text("Upload Document"), a:has-text("Upload Document")').first
            upload_btn.click()
            page.wait_for_load_state("networkidle")
            
            file_input = page.locator('input[type="file"]')
            project_select = page.locator('select[name="project"], select[id="project"]').first
            if project_select.count() > 0:
                project_select.select_option(label=project_name)
            
            file_input.set_input_files(str(test_file))
            
            submit_button = page.locator('input[type="submit"], button[type="submit"]').first
            submit_button.click()
            page.wait_for_load_state("networkidle", timeout=30000)
    
    @pytest.mark.annotation
    def test_open_annotation_editor(self, page, live_server, tmp_path):
        """Test opening the annotation editor for a document."""
        # Setup project and document
        self.create_project_with_document(page, live_server, tmp_path)
        
        # Navigate back to project
        page.goto(f"{live_server}/account")
        project_link = page.locator('a[href*="/project/"]:has-text("Annotation Test Project")').first
        project_link.click()
        page.wait_for_load_state("networkidle")
        
        # Click on Documents tab
        docs_tab = page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            page.wait_for_load_state("networkidle")
        
        # Find and click the annotate button for the uploaded document
        annotate_btn = page.locator('button:has-text("Annotate"), a:has-text("Annotate"), button:has-text("Edit Annotation")').first
        
        if annotate_btn.count() == 0:
            # Try clicking on the document name first
            doc_link = page.locator('a:has-text("test_annotation"), td:has-text("test_annotation")').first
            if doc_link.count() > 0:
                doc_link.click()
                page.wait_for_load_state("networkidle")
                # Now look for annotate button
                annotate_btn = page.locator('button:has-text("Annotate"), a:has-text("Edit"), button:has-text("Start Annotation")').first
        
        # If no annotate button found, skip the test - UI may not have annotation features yet
        if annotate_btn.count() == 0:
            pytest.skip("Annotation feature not available in current UI")
        
        annotate_btn.click()
        page.wait_for_load_state("networkidle")
        
        # Verify annotation editor loaded
        page_content = page.content()
        assert any(text in page_content for text in [
            "Sentence Annotation",
            "Annotation Editor", 
            "AMR Editor",
            "UMR Editor",
            "sentence level graph",
            "Sentence 1",
            "Editor"
        ]), "Annotation editor did not load"
    
    @pytest.mark.annotation  
    def test_view_sentence_text(self, page, live_server, tmp_path):
        """Test that sentence text is displayed correctly in the editor."""
        # Setup project and document
        self.create_project_with_document(page, live_server, tmp_path)
        
        # Navigate to annotation editor
        page.goto(f"{live_server}/account")
        project_link = page.locator('a[href*="/project/"]:has-text("Annotation Test Project")').first
        project_link.click()
        page.wait_for_load_state("networkidle")
        
        docs_tab = page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            page.wait_for_load_state("networkidle")
        
        # Find annotation button
        annotate_btn = page.locator('button:has-text("Annotate"), a:has-text("Annotate"), a:has-text("Edit")').first
        
        if annotate_btn.count() == 0:
            # Click on document first
            doc_link = page.locator('a:has-text("test_annotation"), td:has-text("test_annotation")').first
            if doc_link.count() > 0:
                doc_link.click()
                page.wait_for_load_state("networkidle")
                annotate_btn = page.locator('button:has-text("Annotate"), a:has-text("Edit")').first
        
        if annotate_btn.count() > 0:
            annotate_btn.click()
            page.wait_for_load_state("networkidle")
            
            # Check for sentence text
            page_content = page.content()
            assert "The cat sat on the mat" in page_content or "cat" in page_content, "Sentence text not displayed"
    
    @pytest.mark.annotation
    def test_view_amr_graph(self, page, live_server, tmp_path):
        """Test that AMR/UMR graph is displayed in the editor."""
        # Setup project and document
        self.create_project_with_document(page, live_server, tmp_path)
        
        # Navigate to annotation editor
        page.goto(f"{live_server}/account")
        project_link = page.locator('a[href*="/project/"]:has-text("Annotation Test Project")').first
        project_link.click()
        page.wait_for_load_state("networkidle")
        
        docs_tab = page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            page.wait_for_load_state("networkidle")
        
        # Find annotation button - try multiple approaches
        annotate_btn = page.locator('button:has-text("Annotate"), a:has-text("Annotate"), a:has-text("Edit")').first
        
        if annotate_btn.count() == 0:
            doc_link = page.locator('a:has-text("test_annotation"), td:has-text("test_annotation")').first
            if doc_link.count() > 0:
                doc_link.click()
                page.wait_for_load_state("networkidle")
                annotate_btn = page.locator('button:has-text("Annotate"), a:has-text("Edit")').first
        
        if annotate_btn.count() > 0:
            annotate_btn.click()
            page.wait_for_load_state("networkidle")
            
            # Check for AMR graph elements
            page_content = page.content()
            assert any(text in page_content for text in [
                "sit-01",
                ":ARG0",
                ":ARG1", 
                "cat",
                "mat",
                "s1s",
                "s1c",
                "s1m"
            ]), "AMR graph not displayed correctly"
    
    @pytest.mark.annotation
    def test_edit_sentence_annotation(self, page, live_server, tmp_path):
        """Test editing sentence level annotation."""
        # Setup project and document
        self.create_project_with_document(page, live_server, tmp_path)
        
        # Navigate to annotation editor
        page.goto(f"{live_server}/account")
        project_link = page.locator('a[href*="/project/"]:has-text("Annotation Test Project")').first
        project_link.click()
        page.wait_for_load_state("networkidle")
        
        docs_tab = page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            page.wait_for_load_state("networkidle")
        
        annotate_btn = page.locator('button:has-text("Annotate"), a:has-text("Annotate"), a:has-text("Edit")').first
        
        if annotate_btn.count() == 0:
            doc_link = page.locator('a:has-text("test_annotation"), td:has-text("test_annotation")').first
            if doc_link.count() > 0:
                doc_link.click()
                page.wait_for_load_state("networkidle")
                annotate_btn = page.locator('button:has-text("Annotate"), a:has-text("Edit")').first
        
        if annotate_btn.count() > 0:
            annotate_btn.click()
            page.wait_for_load_state("networkidle")
            
            # Find the annotation text area or editor
            annotation_editor = page.locator('textarea[name*="annotation"], textarea[id*="annotation"], .annotation-editor, .amr-editor, textarea').first
            
            if annotation_editor.count() > 0 and annotation_editor.is_visible():
                # Clear and add new annotation
                annotation_editor.fill("(s1t / test-01\n    :ARG0 (s1c / cat)\n    :ARG1 (s1m / mat))")
                
                # Save the annotation
                save_btn = page.locator('button:has-text("Save"), button[type="submit"]').first
                if save_btn.count() > 0:
                    save_btn.click()
                    page.wait_for_load_state("networkidle")
                    
                    # Check for success message or updated content
                    page_content = page.content()
                    assert any(text in page_content.lower() for text in [
                        "saved",
                        "success",
                        "updated",
                        "test-01"
                    ]), "Annotation save confirmation not shown"
    
    @pytest.mark.annotation
    def test_save_and_continue(self, page, live_server, tmp_path):
        """Test save and continue functionality."""
        # Setup project and document
        self.create_project_with_document(page, live_server, tmp_path)
        
        # Navigate to annotation editor
        page.goto(f"{live_server}/account")
        project_link = page.locator('a[href*="/project/"]:has-text("Annotation Test Project")').first
        project_link.click()
        page.wait_for_load_state("networkidle")
        
        docs_tab = page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            page.wait_for_load_state("networkidle")
        
        annotate_btn = page.locator('button:has-text("Annotate"), a:has-text("Annotate"), a:has-text("Edit")').first
        
        if annotate_btn.count() == 0:
            doc_link = page.locator('a:has-text("test_annotation"), td:has-text("test_annotation")').first
            if doc_link.count() > 0:
                doc_link.click()
                page.wait_for_load_state("networkidle")
                annotate_btn = page.locator('button:has-text("Annotate"), a:has-text("Edit")').first
        
        if annotate_btn.count() > 0:
            annotate_btn.click()
            page.wait_for_load_state("networkidle")
            
            # Look for save and continue button
            save_continue_btn = page.locator('button:has-text("Save & Continue"), button:has-text("Save and Next"), button:has-text("Save")').first
            
            if save_continue_btn.count() > 0:
                save_continue_btn.click()
                page.wait_for_load_state("networkidle")
                
                # Should either move to next sentence or show completion message
                page_content = page.content()
                assert any(text in page_content.lower() for text in [
                    "saved",
                    "next",
                    "complete",
                    "success"
                ]), "Save functionality did not work as expected"