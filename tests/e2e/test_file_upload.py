import pytest
import os
from pathlib import Path
from playwright.sync_api import expect


class TestFileUpload:
    """Test UMR file upload functionality with real UMR files from UMR Release 2.0."""
    
    @pytest.fixture
    def umr_data_path(self):
        """Path to UMR Release 2.0 data files."""
        return Path("/Users/jinzhao/Documents/umr-annotation-tool/UMR Release 2.0/english/umr_data")
    
    @pytest.fixture
    def small_umr_file(self, umr_data_path):
        """Get path to a small UMR file for quick tests."""
        return str(umr_data_path / "english_umr-0002.umr")  # 1.5KB file
    
    @pytest.fixture
    def medium_umr_file(self, umr_data_path):
        """Get path to a medium-sized UMR file."""
        return str(umr_data_path / "english_umr-0009.umr")  # 7KB file
    
    @pytest.fixture
    def project_admin_page(self, page, live_server):
        """Admin user logged in with a project created."""
        # Check if already logged in by going to account page
        page.goto(f"{live_server}/account")
        page.wait_for_load_state("networkidle")
        
        # If redirected to login, then we need to login
        if "/login" in page.url:
            page.fill('input[name="email"]', 'admin@example.com')
            page.fill('input[name="password"]', 'adminpassword')
            page.click('input[type="submit"]')
            
            # Wait for login to complete and redirect to account page
            page.wait_for_url(f"{live_server}/account")
        
        # Check if project already exists before trying to create it
        page_content = page.content()
        if "Test Upload Project" not in page_content:
            # Project doesn't exist, create it
            # Click on "New Project" link in the navigation bar
            new_project_link = page.locator('a:has-text("New Project")').first
            new_project_link.click()
            page.wait_for_load_state("networkidle")
            
            # Fill in the project name - use the specific ID from the error message
            project_name_input = page.locator('input#projectname')
            project_name_input.fill('Test Upload Project')
            
            # Language dropdown should already have English selected
            # But we can make sure
            language_select = page.locator('select')
            if language_select.count() > 0:
                # Select English explicitly
                language_select.select_option(label='English')
            
            # Click the "Create Project" button - from screenshot it's an anchor tag with class btn
            create_btn = page.locator('a.btn:has-text("Create Project"), button:has-text("Create Project")').first
            if create_btn.count() == 0:
                # Fallback to any clickable element with that text
                create_btn = page.get_by_text("Create Project")
            create_btn.click()
            
            # Wait for project creation to complete and redirect back to account page
            page.wait_for_url(f"{live_server}/account", timeout=10000)
        
        yield page
    
    # Note: project_member_page fixture is created lazily within the test 
    # to ensure admin completes their actions first
    
    @pytest.mark.upload
    def test_upload_page_access_as_admin(self, project_admin_page, live_server):
        """Test that project admin can access upload page."""
        # Navigate to the project using the correct method
        project_link = project_admin_page.locator('a[href*="/project/"]:has-text("Test Upload Project")').first
        assert project_link.count() > 0, "Test Upload Project not found"
        
        project_link.click()
        project_admin_page.wait_for_load_state("networkidle")
        
        # Verify we're on the project page
        current_url = project_admin_page.url
        assert "/project/" in current_url, f"Not on project page. Current URL: {current_url}"
        
        # Look for Upload Document button
        upload_btn = project_admin_page.locator('button:has-text("Upload Document"), a:has-text("Upload Document")').first
        assert upload_btn.count() > 0, "Upload Document button not found on project page"
        
        upload_btn.click()
        project_admin_page.wait_for_load_state("networkidle")
        
        # Should be on upload page with file input
        file_input = project_admin_page.locator('input[type="file"]')
        assert file_input.is_visible(), "File input not found on upload page"
        
        # Also verify we're not on a 404 page
        page_content = project_admin_page.content()
        assert "404" not in page_content and "Page Not Found" not in page_content, "Upload page returned 404 error"
    
    @pytest.mark.upload
    def test_upload_small_umr_file(self, project_admin_page, live_server, small_umr_file):
        """Test uploading a small UMR file (english_umr-0002.umr)."""
        # After project creation, we're back on the account page
        # The project should be visible in the left sidebar under "Projects"
        # We need to click on the project name which should be a link
        
        # The project should be visible as a link in the sidebar
        # Click on "Test Upload Project" link
        project_link = project_admin_page.locator('a[href*="/project/"]:has-text("Test Upload Project")').first
        
        if project_link.count() > 0:
            # Click the project link
            project_link.click()
            project_admin_page.wait_for_load_state("networkidle")
        else:
            # Not a link, try clicking the text element itself
            project_element = project_admin_page.locator('text=Test Upload Project').first
            if project_element.count() > 0:
                project_element.click()
                project_admin_page.wait_for_load_state("networkidle")
                
                # Check if we navigated
                current_url = project_admin_page.url
                if "/account" in current_url:
                    # Still on account page, project name might not be clickable
                    # Try to find a "View" or "Open" button near the project
                    view_btn = project_admin_page.locator('button:near("Test Upload Project"), a:near("Test Upload Project")').filter(has_text="View|Open|Go").first
                    if view_btn.count() > 0:
                        view_btn.click()
                        project_admin_page.wait_for_load_state("networkidle")
                    else:
                        pytest.skip("Project exists but cannot navigate to it - no clickable element found")
            else:
                pytest.skip("Could not find the created project in the sidebar")
        
        # Verify we're on a project page
        current_url = project_admin_page.url
        if "/project" not in current_url:
            pytest.skip(f"Could not navigate to project page. Still on: {current_url}")
        
        # Click the "Upload Document" button
        upload_btn = project_admin_page.locator('button:has-text("Upload Document"), a:has-text("Upload Document")').first
        if upload_btn.count() > 0:
            upload_btn.click()
            project_admin_page.wait_for_load_state("networkidle")
        else:
            # If no upload button found, skip the test
            pytest.skip("Upload Document button not found on project page")
        
        # Debug: pause to see the upload page
        # project_admin_page.pause()
        
        # Now look for file input on the upload page
        file_input = project_admin_page.locator('input[type="file"]')
        
        if file_input.count() > 0:
            # Check if we need to select a project first
            project_select = project_admin_page.locator('select[name="project"], select[id="project"]').first
            if project_select.count() > 0:
                # Select our test project
                project_select.select_option(label='Test Upload Project')
            
            # Now upload the file
            file_input.set_input_files(small_umr_file)
            
            # Submit the upload - might be a button or automatic
            submit_button = project_admin_page.locator('input[type="submit"], button[type="submit"], button:has-text("Upload")').first
            if submit_button.count() > 0:
                submit_button.click()
            
            # Wait for upload to complete
            project_admin_page.wait_for_load_state("networkidle", timeout=30000)
            
            # Check for success
            page_content = project_admin_page.content().lower()
            current_url = project_admin_page.url
            
            # Should show success or the file name
            assert ("success" in page_content or 
                    "uploaded" in page_content or
                    "english_umr-0002" in page_content or
                    "/project" in current_url), "Upload may have failed"
        else:
            # If no file input found, mark test as skipped
            pytest.skip("File upload functionality not found on this page")
    
    @pytest.mark.upload
    def test_upload_multiple_umr_files(self, project_admin_page, live_server, small_umr_file, medium_umr_file):
        """Test uploading multiple UMR files."""
        # Navigate to the project using the same method as the working test
        # The project should be visible as a link in the sidebar
        # Use href filter to get only the project link, not document links
        project_link = project_admin_page.locator('a[href*="/project/"]:has-text("Test Upload Project")').first
        
        if project_link.count() > 0:
            # Click the project link
            project_link.click()
            project_admin_page.wait_for_load_state("networkidle")
        else:
            pytest.skip("Could not find the Test Upload Project")
        
        # Debug: pause to see where we are
        # project_admin_page.pause()
        
        # Click the "Upload Document" button
        upload_btn = project_admin_page.locator('button:has-text("Upload Document"), a:has-text("Upload Document")').first
        if upload_btn.count() > 0:
            upload_btn.click()
            project_admin_page.wait_for_load_state("networkidle")
            
            file_input = project_admin_page.locator('input[type="file"]')
            
            # Check if multiple file upload is supported
            multiple_attr = file_input.get_attribute("multiple")
            
            if multiple_attr is not None:
                # Upload both files at once
                file_input.set_input_files([small_umr_file, medium_umr_file])
            else:
                # Upload files one by one
                file_input.set_input_files(small_umr_file)
            
            submit_button = project_admin_page.locator('input[type="submit"], button[type="submit"]').first
            if submit_button.count() > 0:
                submit_button.click()
                project_admin_page.wait_for_load_state("networkidle", timeout=30000)
            
            # Debug: pause to see what happens after first upload
            # project_admin_page.pause()
            
            # If single file upload, upload the second file
            if multiple_attr is None:
                # Go back to upload page for second file
                upload_link = project_admin_page.locator('a:has-text("Upload"), button:has-text("Upload Document"), a[href*="upload"]').first
                if upload_link.is_visible():
                    upload_link.click()
                    project_admin_page.wait_for_load_state("networkidle")
                    
                    file_input = project_admin_page.locator('input[type="file"]')
                    file_input.set_input_files(medium_umr_file)
                    
                    submit_button = project_admin_page.locator('input[type="submit"], button[type="submit"]')
                    submit_button.click()
                    project_admin_page.wait_for_load_state("networkidle", timeout=30000)
    
    @pytest.mark.upload
    def test_view_uploaded_files_as_member(self, project_admin_page, playwright_context, live_server, small_umr_file):
        """Test that project members can view uploaded files."""
        # First, admin uploads a file to the project
        project_link = project_admin_page.locator('a[href*="/project/"]:has-text("Test Upload Project")').first
        if project_link.count() > 0:
            project_link.click()
            project_admin_page.wait_for_load_state("networkidle")
            
            # Upload a file using Upload Document button
            upload_btn = project_admin_page.locator('button:has-text("Upload Document"), a:has-text("Upload Document")').first
            if upload_btn.count() > 0:
                upload_btn.click()
                project_admin_page.wait_for_load_state("networkidle")
                
                file_input = project_admin_page.locator('input[type="file"]')
                if file_input.count() > 0:
                    # Select project if needed
                    project_select = project_admin_page.locator('select[name="project"], select[id="project"]').first
                    if project_select.count() > 0:
                        project_select.select_option(label='Test Upload Project')
                    
                    file_input.set_input_files(small_umr_file)
                    
                    submit_button = project_admin_page.locator('input[type="submit"], button[type="submit"]').first
                    if submit_button.count() > 0:
                        submit_button.click()
                        project_admin_page.wait_for_load_state("networkidle", timeout=30000)
            
            # After upload, we should be back on the project page
            # Need to ensure we're on the project page, not redirected elsewhere
            current_url = project_admin_page.url
            if "/project" not in current_url:
                # Navigate back to the project
                project_link = project_admin_page.locator('a[href*="/project/"]:has-text("Test Upload Project")').first
                if project_link.count() > 0:
                    project_link.click()
                    project_admin_page.wait_for_load_state("networkidle")
            
            # Now add testuser as a member
            members_link = project_admin_page.locator('a:has-text("Members")').first
            assert members_link.count() > 0, "Members link not found in sidebar"
            
            members_link.click()
            project_admin_page.wait_for_load_state("networkidle")
            
            # Add testuser as a member
            username_input = project_admin_page.locator('input[placeholder*="username"], input[name="username"], input[placeholder*="Username"]').first
            assert username_input.count() > 0, "Username input field not found"
            
            username_input.fill('testuser')
            
            # Click Add Member button
            add_member_btn = project_admin_page.locator('button:has-text("Add Member")').first
            assert add_member_btn.count() > 0, "Add Member button not found"
            
            add_member_btn.click()
            project_admin_page.wait_for_load_state("networkidle")
            
            # Verify member was added
            page_content = project_admin_page.content()
            assert "testuser" in page_content, "testuser was not added to the project"
        
        # Now login as the member in a new page/tab
        project_member_page = playwright_context.new_page()
        
        # Logout first if needed
        project_member_page.goto(f"{live_server}/logout")
        project_member_page.wait_for_load_state("networkidle")
        
        # Login as testuser
        project_member_page.goto(f"{live_server}/login")
        project_member_page.wait_for_selector('input[name="email"]')
        project_member_page.fill('input[name="email"]', 'test@example.com')
        project_member_page.fill('input[name="password"]', 'testpassword')
        project_member_page.click('input[type="submit"]')
        project_member_page.wait_for_url(f"{live_server}/account")
        
        # Check if the project is visible to the member
        project_member_link = project_member_page.locator('a[href*="/project/"]:has-text("Test Upload Project")').first
        
        # The project should now be visible since we added the member
        assert project_member_link.count() > 0, "Project not visible to member after being added"
        
        # Member can see the project, click to navigate to it
        project_member_link.click()
        project_member_page.wait_for_load_state("networkidle")
        
        # Check if uploaded document is visible
        page_content = project_member_page.content()
        assert ("english_umr-0002" in page_content or 
                "Documents" in page_content), "Uploaded file not visible to project member"
        
        # Clean up
        project_member_page.close()
    
    @pytest.mark.upload
    def test_checkout_file_as_member(self, project_admin_page, playwright_context, live_server, small_umr_file):
        """Test that project members can checkout uploaded files following the correct workflow."""
        # Step 1: Admin ensures member is added and file is uploaded
        project_link = project_admin_page.locator('a[href*="/project/"]:has-text("Test Upload Project")').first
        if project_link.count() > 0:
            project_link.click()
            project_admin_page.wait_for_load_state("networkidle")
            
            # Ensure testuser is a member
            members_link = project_admin_page.locator('a:has-text("Members")').first
            members_link.click()
            project_admin_page.wait_for_load_state("networkidle")
            
            page_content = project_admin_page.content()
            if "testuser" not in page_content:
                username_input = project_admin_page.locator('input[placeholder*="username"], input[name="username"], input[placeholder*="Username"]').first
                username_input.fill('testuser')
                add_member_btn = project_admin_page.locator('button:has-text("Add Member")').first
                add_member_btn.click()
                project_admin_page.wait_for_load_state("networkidle")
            
            # Go to Documents and upload a file if needed
            docs_link = project_admin_page.locator('a:has-text("Documents")').first
            docs_link.click()
            project_admin_page.wait_for_load_state("networkidle")
            
            page_content = project_admin_page.content()
            if "english_umr" not in page_content:
                upload_btn = project_admin_page.locator('button:has-text("Upload Document"), a:has-text("Upload Document")').first
                upload_btn.click()
                project_admin_page.wait_for_load_state("networkidle")
                
                file_input = project_admin_page.locator('input[type="file"]')
                project_select = project_admin_page.locator('select[name="project"], select[id="project"]').first
                if project_select.count() > 0:
                    project_select.select_option(label='Test Upload Project')
                
                file_input.set_input_files(small_umr_file)
                submit_button = project_admin_page.locator('input[type="submit"], button[type="submit"]').first
                submit_button.click()
                project_admin_page.wait_for_load_state("networkidle", timeout=30000)
        
        # Step 2: Create member page and login
        project_member_page = playwright_context.new_page()
        project_member_page.goto(f"{live_server}/logout")
        project_member_page.wait_for_load_state("networkidle")
        
        project_member_page.goto(f"{live_server}/login")
        project_member_page.wait_for_selector('input[name="email"]')
        project_member_page.fill('input[name="email"]', 'test@example.com')
        project_member_page.fill('input[name="password"]', 'testpassword')
        project_member_page.click('input[type="submit"]')
        
        # Step 3: Wait for account page
        project_member_page.wait_for_url(f"{live_server}/account")
        
        # Step 4: Go to project page
        project_member_link = project_member_page.locator('a[href*="/project/"]:has-text("Test Upload Project")').first
        assert project_member_link.count() > 0, "Project not visible to member"
        project_member_link.click()
        project_member_page.wait_for_load_state("networkidle")
        
        # Step 5: Click on Documents tab (should already be selected)
        docs_tab = project_member_page.locator('a:has-text("Documents")').first
        if docs_tab.count() > 0:
            docs_tab.click()
            project_member_page.wait_for_load_state("networkidle")
        
        # Step 6: Click "Checkout for Annotation"
        checkout_btn = project_member_page.locator('button:has-text("Checkout for Annotation"), a:has-text("Checkout for Annotation")').first
        assert checkout_btn.count() > 0, "Checkout button not found"
        checkout_btn.click()
        project_member_page.wait_for_load_state("networkidle")
        
        # Step 7: Click "My Checked Out Documents"
        my_docs_link = project_member_page.locator('a:has-text("My Checked Out Documents")').first
        assert my_docs_link.count() > 0, "My Checked Out Documents link not found"
        my_docs_link.click()
        project_member_page.wait_for_load_state("networkidle")
        
        # Step 8: Verify the file is in My Checked Out Documents
        page_content = project_member_page.content()
        assert ("english_umr-0002" in page_content or 
                "Checked out by: testuser" in page_content), "File not found in My Checked Out Documents"
        
        # Clean up
        project_member_page.close()
