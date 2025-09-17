import pytest
from playwright.sync_api import expect


class TestAccountPage:
    """Test account page functionality."""

    @pytest.mark.account
    def test_account_page_displays_user_info(self, authenticated_page, live_server):
        """Test that account page displays user information correctly."""
        authenticated_page.goto(f"{live_server}/account")

        # Should show username and email
        expect(authenticated_page.locator("body")).to_contain_text("testuser")
        expect(authenticated_page.locator("body")).to_contain_text("test@example.com")

        # Check that username and email are in read-only fields
        username_field = authenticated_page.locator('input[value="testuser"]')
        email_field = authenticated_page.locator('input[value="test@example.com"]')

        expect(username_field).to_be_visible()
        expect(email_field).to_be_visible()

        # Check that fields are disabled/readonly
        expect(username_field).to_be_disabled()
        expect(email_field).to_be_disabled()

    @pytest.mark.account
    def test_username_email_fields_are_readonly(self, authenticated_page, live_server):
        """Test that username and email fields cannot be edited."""
        authenticated_page.goto(f"{live_server}/account")

        # Find the username and email input fields
        username_field = authenticated_page.locator('input[value="testuser"]')
        email_field = authenticated_page.locator('input[value="test@example.com"]')

        # Verify they have readonly and disabled attributes
        expect(username_field).to_have_attribute("readonly", "")
        expect(username_field).to_have_attribute("disabled", "")

        expect(email_field).to_have_attribute("readonly", "")
        expect(email_field).to_have_attribute("disabled", "")

        # Verify fields are not editable by checking they're disabled
        expect(username_field).to_be_disabled()
        expect(email_field).to_be_disabled()

        # Values should remain unchanged
        expect(username_field).to_have_value("testuser")
        expect(email_field).to_have_value("test@example.com")

    @pytest.mark.account
    def test_profile_picture_update_form_exists(self, authenticated_page, live_server):
        """Test that profile picture update form is present and functional."""
        authenticated_page.goto(f"{live_server}/account")

        # Check that the profile picture upload field exists
        picture_field = authenticated_page.locator('input[type="file"]')
        expect(picture_field).to_be_visible()

        # Check that the Update button exists
        update_button = authenticated_page.locator('input[type="submit"][value="Update"], button:has-text("Update")')
        expect(update_button).to_be_visible()

        # The form should only have the picture field, not username or email fields
        form = authenticated_page.locator('form[enctype="multipart/form-data"]')
        expect(form).to_be_visible()

        # Username and email should NOT be inside the form
        form_inputs = form.locator('input[type="text"], input[type="email"]')
        expect(form_inputs).to_have_count(0)

    @pytest.mark.account
    def test_profile_picture_upload_field_exists(self, authenticated_page, live_server):
        """Test that profile picture upload field exists and is functional."""
        authenticated_page.goto(f"{live_server}/account")

        # Check that the file input exists and can accept files
        file_input = authenticated_page.locator('input[type="file"]')
        expect(file_input).to_be_visible()

        # Check that it accepts image files
        accept_attr = file_input.get_attribute('accept')
        if accept_attr:
            # Should accept images
            assert 'image' in accept_attr or '.jpg' in accept_attr or '.png' in accept_attr

        # Check that the Update button exists
        update_button = authenticated_page.locator('input[type="submit"][value="Update"], button:has-text("Update")')
        expect(update_button).to_be_visible()

    @pytest.mark.account
    def test_projects_section_visible(self, authenticated_page, live_server):
        """Test that projects section is visible on account page."""
        authenticated_page.goto(f"{live_server}/account")

        # Check for Projects heading
        expect(authenticated_page.locator("h5:has-text('Projects')")).to_be_visible()

        # Check that Test Project (from conftest.py) is visible if it exists
        # or at least the projects section is there
        projects_section = authenticated_page.locator('.card:has(h5:text("Projects"))')
        expect(projects_section).to_be_visible()

    @pytest.mark.account
    def test_documents_section_visible(self, authenticated_page, live_server):
        """Test that documents section is visible on account page."""
        authenticated_page.goto(f"{live_server}/account")

        # Check for All Documents heading
        expect(authenticated_page.locator("h5:has-text('All Documents')")).to_be_visible()

    @pytest.mark.account
    def test_admin_can_delete_project(self, admin_page, live_server):
        """Test that admin users can see delete button for their projects."""
        # First create a project as admin
        admin_page.goto(f"{live_server}/new_project")
        admin_page.fill('input[name="projectname"]', 'Admin Test Project')
        admin_page.select_option('select[name="language"]', 'English')

        # Find and click the Create button
        create_btn = admin_page.locator('input[type="submit"][value="Create"], button:has-text("Create")').first
        if not create_btn.is_visible():
            create_btn = admin_page.get_by_text("Create Project")
        create_btn.click()

        # Wait for redirect to account page
        admin_page.wait_for_url(f"{live_server}/account", timeout=10000)

        # Check that delete button is visible for admin's own project
        project_element = admin_page.locator('div:has-text("Admin Test Project")')
        delete_button = project_element.locator('button[type="submit"]:has(i.fa-trash-alt), button[title="Delete Project"]').first

        # Admin should see delete button for their own project
        expect(delete_button).to_be_visible()

        # Clean up: delete the project to avoid affecting other tests
        delete_button.click()
        admin_page.wait_for_load_state("networkidle")

    @pytest.mark.account
    def test_non_admin_cannot_delete_project(self, authenticated_page, live_server):
        """Test that non-admin users cannot delete projects they don't own."""
        authenticated_page.goto(f"{live_server}/account")

        # Look for the specific project row for "Test Project"
        # Use the project ID to ensure we're checking the right project
        test_project_row = authenticated_page.locator('#project-1')  # Test Project has ID 1 in fixtures

        if test_project_row.count() > 0:
            # Check permission badge shows "member" not "admin"
            permission_badge = test_project_row.locator('.badge')
            expect(permission_badge).to_contain_text("member")

            # Check that there's no delete button in this specific row
            delete_button = test_project_row.locator('button[type="submit"]:has(i.fa-trash-alt), button[title="Delete Project"]')
            expect(delete_button).to_have_count(0)

    @pytest.mark.account
    def test_account_page_layout(self, authenticated_page, live_server):
        """Test the overall layout of the account page."""
        authenticated_page.goto(f"{live_server}/account")

        # Check for two-column layout
        left_column = authenticated_page.locator('.col-md-8')
        right_column = authenticated_page.locator('.col-md-4')

        expect(left_column).to_be_visible()
        expect(right_column).to_be_visible()

        # Left column should have Projects and Documents
        expect(left_column.locator('h5:has-text("Projects")')).to_be_visible()
        expect(left_column.locator('h5:has-text("All Documents")')).to_be_visible()

        # Right column should have user info and update form
        expect(right_column.locator('img.rounded-circle')).to_be_visible()  # Profile picture
        expect(right_column.locator('form')).to_be_visible()  # Update form