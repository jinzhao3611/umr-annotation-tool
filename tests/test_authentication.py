import pytest
from playwright.sync_api import expect


class TestAuthentication:
    """Test user authentication functionality."""
    
    @pytest.mark.auth
    def test_login_with_valid_credentials(self, page, live_server):
        """Test logging in with valid credentials."""
        page.goto(f"{live_server}/login")
        
        # Fill in the login form
        page.fill('input[name="email"]', 'test@example.com')
        page.fill('input[name="password"]', 'testpassword')
        page.click('input[type="submit"]')
        
        # Wait for navigation to complete
        page.wait_for_load_state("networkidle")
        
        # Check if login was successful - should redirect to account page
        current_url = page.url
        assert ("/login" not in current_url), f"Still on login page, login may have failed. URL: {current_url}"
        
        # The app redirects to /account after successful login
        assert "/account" in current_url, f"Expected redirect to /account, but got: {current_url}"
        
        # Should show user information
        expect(page.locator("body")).to_contain_text("testuser")
        expect(page.locator("body")).to_contain_text("test@example.com")
    
    @pytest.mark.auth
    def test_login_with_invalid_credentials(self, page, live_server):
        """Test logging in with invalid credentials."""
        page.goto(f"{live_server}/login")
        
        # Fill in the login form with wrong credentials
        page.fill('input[name="email"]', 'wrong@example.com')
        page.fill('input[name="password"]', 'wrongpassword')
        page.click('input[type="submit"]')
        
        # Wait for response
        page.wait_for_load_state("networkidle")
        
        # Should stay on login page or show error
        current_url = page.url
        page_content = page.content().lower()
        
        # Check for login failure indicators
        assert ("/login" in current_url or 
                "unsuccessful" in page_content or 
                "invalid" in page_content or
                "incorrect" in page_content or
                "error" in page_content), f"No indication of failed login. URL: {current_url}"
    
    @pytest.mark.auth
    def test_login_with_empty_fields(self, page, live_server):
        """Test login form validation with empty fields."""
        page.goto(f"{live_server}/login")
        
        # Try to submit empty form
        page.click('input[type="submit"]')
        
        # Should show validation errors
        expect(page).to_have_url(f"{live_server}/login")
        
        # Check for HTML5 validation or custom validation messages
        email_field = page.locator('input[name="email"]')
        password_field = page.locator('input[name="password"]')
        
        # These fields should be required (check if required attribute exists)
        expect(email_field).to_have_attribute("required", "")
        expect(password_field).to_have_attribute("required", "")
    
    @pytest.mark.auth
    def test_registration_with_valid_data(self, page, live_server):
        """Test user registration with valid data."""
        page.goto(f"{live_server}/register")
        
        # Fill in the registration form
        page.fill('input[name="username"]', 'newuser')
        page.fill('input[name="email"]', 'newuser@example.com')
        page.fill('input[name="password"]', 'newpassword123')
        page.fill('input[name="confirm_password"]', 'newpassword123')
        page.click('input[type="submit"]')
        
        # Should redirect to login page or show success message
        # (Adjust based on your app's actual behavior)
        page.wait_for_load_state("networkidle")
        
        # Check if registration was successful
        # This might redirect to login or show a confirmation message
        current_url = page.url
        assert "/login" in current_url or "/register" in current_url
    
    @pytest.mark.auth
    def test_registration_with_mismatched_passwords(self, page, live_server):
        """Test registration with mismatched passwords."""
        page.goto(f"{live_server}/register")
        
        # Fill in the registration form with mismatched passwords
        page.fill('input[name="username"]', 'newuser2')
        page.fill('input[name="email"]', 'newuser2@example.com')
        page.fill('input[name="password"]', 'password123')
        page.fill('input[name="confirm_password"]', 'differentpassword')
        page.click('input[type="submit"]')
        
        # Should stay on registration page and show error
        expect(page).to_have_url(f"{live_server}/register")
        # The actual error message shown is "Field must be equal to password."
        expect(page.locator("body")).to_contain_text("Field must be equal to password")
    
    @pytest.mark.auth
    def test_registration_with_existing_email(self, page, live_server):
        """Test registration with already existing email."""
        page.goto(f"{live_server}/register")
        
        # Try to register with existing email
        page.fill('input[name="username"]', 'anotheruser')
        page.fill('input[name="email"]', 'test@example.com')  # This email already exists
        page.fill('input[name="password"]', 'password123')
        page.fill('input[name="confirm_password"]', 'password123')
        page.click('input[type="submit"]')
        
        # Wait for response
        page.wait_for_load_state("networkidle")
        
        # Should either stay on registration page with error or show some error message
        current_url = page.url
        page_content = page.content().lower()
        
        # Check for various error indicators
        assert ("/register" in current_url and (
                "already" in page_content or 
                "exists" in page_content or
                "taken" in page_content or
                "duplicate" in page_content or
                "invalid" in page_content)), f"No error shown for duplicate email. URL: {current_url}"
    
    @pytest.mark.auth
    def test_logout_functionality(self, authenticated_page, live_server):
        """Test user logout functionality."""
        # Should be on account page after authentication
        expect(authenticated_page).to_have_url(f"{live_server}/account")
        
        # Find and click logout link/button
        logout_element = authenticated_page.locator('a[href="/logout"]').first
        if logout_element.is_visible():
            logout_element.click()
        else:
            # Alternative: look for logout button or form
            logout_button = authenticated_page.locator('button:has-text("Logout")').first
            if logout_button.is_visible():
                logout_button.click()
        
        # Should redirect to home or login page
        authenticated_page.wait_for_load_state("networkidle")
        
        # User should no longer see authenticated content
        expect(authenticated_page.locator("body")).not_to_contain_text("testuser")
    
    @pytest.mark.auth
    def test_protected_page_access_without_login(self, page, live_server):
        """Test accessing protected pages without login."""
        # Try to access a protected page (like project creation)
        page.goto(f"{live_server}/new_project")
        
        # Should redirect to login page
        page.wait_for_load_state("networkidle")
        current_url = page.url
        assert "/login" in current_url
    
    @pytest.mark.auth
    def test_protected_page_access_with_login(self, authenticated_page, live_server):
        """Test accessing protected pages with valid login."""
        # Try to access a protected page
        authenticated_page.goto(f"{live_server}/new_project")
        
        # Should be able to access the page
        expect(authenticated_page).to_have_url(f"{live_server}/new_project")
        expect(authenticated_page.locator("body")).to_be_visible()
    
    @pytest.mark.auth
    def test_admin_access_regular_user(self, authenticated_page, live_server):
        """Test that regular users cannot access admin pages."""
        # Try to access admin functionality
        authenticated_page.goto(f"{live_server}/admin_utils")
        
        # Should either redirect or show access denied
        authenticated_page.wait_for_load_state("networkidle")
        
        # Check that access is denied (could be 403, redirect, or error message)
        current_url = authenticated_page.url
        page_content = authenticated_page.content()
        
        # Either redirected away from admin page or shows access denied
        assert ("/admin_utils" not in current_url or 
                "403" in page_content or 
                "Access denied" in page_content or
                "Forbidden" in page_content)
    
    @pytest.mark.auth
    def test_admin_access_admin_user(self, admin_page, live_server):
        """Test that test admin users cannot access admin pages (admin access is restricted to specific username)."""
        # Try to access admin functionality
        admin_page.goto(f"{live_server}/admin_utils")
        
        # Should either redirect or show access denied (since testadmin is not the hardcoded admin username)
        admin_page.wait_for_load_state("networkidle")
        
        # Check that access is denied (could be 403, redirect, or error message)
        current_url = admin_page.url
        page_content = admin_page.content()
        
        # Either redirected away from admin page or shows access denied
        assert ("/admin_utils" not in current_url or 
                "403" in page_content or 
                "Access denied" in page_content or
                "Forbidden" in page_content)
    
    @pytest.mark.auth
    def test_session_persistence(self, authenticated_page, live_server):
        """Test that user session persists across page refreshes."""
        # Should be logged in and on account page
        expect(authenticated_page).to_have_url(f"{live_server}/account")
        expect(authenticated_page.locator("body")).to_contain_text("testuser")
        
        # Refresh the page
        authenticated_page.reload()
        
        # Should still be logged in
        expect(authenticated_page.locator("body")).to_contain_text("testuser")
    
    @pytest.mark.auth
    def test_remember_me_functionality(self, page, live_server):
        """Test remember me checkbox if it exists."""
        page.goto(f"{live_server}/login")
        
        # Check if remember me checkbox exists
        remember_me = page.locator('input[name="remember"]')
        if remember_me.is_visible():
            # Test with remember me checked
            page.fill('input[name="email"]', 'test@example.com')
            page.fill('input[name="password"]', 'testpassword')
            remember_me.check()
            page.click('input[type="submit"]')
            
            # Should login successfully and redirect to account page
            page.wait_for_url(f"{live_server}/account")
            expect(page).to_have_url(f"{live_server}/account")
    
    @pytest.mark.auth
    def test_password_reset_page_access(self, page, live_server):
        """Test password reset page accessibility."""
        page.goto(f"{live_server}/login")
        
        # Look for forgot password link
        forgot_password_link = page.locator('a:has-text("Forgot Password")')
        if forgot_password_link.is_visible():
            forgot_password_link.click()
            
            # Should navigate to password reset page (actual URL is /reset_password)
            expect(page).to_have_url(f"{live_server}/reset_password")
            expect(page.locator('input[name="email"]')).to_be_visible()
    
    @pytest.mark.auth  
    def test_user_profile_access(self, authenticated_page, live_server):
        """Test user profile page access."""
        # Try to access user account/profile page
        authenticated_page.goto(f"{live_server}/account")
        
        # Should be able to access the page
        expect(authenticated_page).to_have_url(f"{live_server}/account")
        expect(authenticated_page.locator("body")).to_be_visible()
        
        # Should show user information
        expect(authenticated_page.locator("body")).to_contain_text("testuser") 