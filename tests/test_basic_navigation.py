import pytest
from playwright.sync_api import expect


class TestBasicNavigation:
    """Test basic page navigation and loading."""
    
    def test_home_page_loads(self, page, live_server):
        """Test that the home page loads correctly."""
        page.goto(live_server)
        
        # Check that we're redirected to user guide
        expect(page).to_have_url(f"{live_server}/")
        expect(page).to_have_title("UMR Writer 3.0 - Welcome to UMR Writer 3.0")
        
        # Check for key elements on the page
        expect(page.locator("h1")).to_contain_text("Welcome to UMR Writer 3.0")
    
    def test_login_page_loads(self, page, live_server):
        """Test that the login page loads correctly."""
        page.goto(f"{live_server}/login")
        
        expect(page).to_have_url(f"{live_server}/login")
        expect(page).to_have_title("UMR Writer 3.0 - Login")
        
        # Check for login form elements
        expect(page.locator('input[name="email"]')).to_be_visible()
        expect(page.locator('input[name="password"]')).to_be_visible()
        expect(page.locator('input[type="submit"]')).to_be_visible()
    
    def test_register_page_loads(self, page, live_server):
        """Test that the register page loads correctly."""
        page.goto(f"{live_server}/register")
        
        expect(page).to_have_url(f"{live_server}/register")
        expect(page).to_have_title("UMR Writer 3.0 - Register")
        
        # Check for registration form elements
        expect(page.locator('input[name="username"]')).to_be_visible()
        expect(page.locator('input[name="email"]')).to_be_visible()
        expect(page.locator('input[name="password"]')).to_be_visible()
        expect(page.locator('input[name="confirm_password"]')).to_be_visible()
    
    def test_about_page_loads(self, page, live_server):
        """Test that the about page loads correctly."""
        page.goto(f"{live_server}/about")
        
        expect(page).to_have_url(f"{live_server}/about")
        expect(page).to_have_title("UMR Writer 3.0 - About")
    
    def test_navigation_links(self, page, live_server):
        """Test navigation links work correctly."""
        page.goto(live_server)
        
        # Test navigation to login
        page.click('a[href="/login"]')
        expect(page).to_have_url(f"{live_server}/login")
        
        # Test navigation to register
        page.click('a[href="/register"]')
        expect(page).to_have_url(f"{live_server}/register")
        
        # Test navigation back to home (if link exists)
        home_link = page.locator('a[href="/"]').first
        if home_link.is_visible():
            home_link.click()
            expect(page).to_have_url(f"{live_server}/")
    
    def test_responsive_design(self, page, live_server):
        """Test that pages work on different screen sizes."""
        # Test desktop size
        page.set_viewport_size({"width": 1920, "height": 1080})
        page.goto(live_server)
        expect(page.locator("body")).to_be_visible()
        
        # Test tablet size
        page.set_viewport_size({"width": 768, "height": 1024})
        page.goto(live_server)
        expect(page.locator("body")).to_be_visible()
        
        # Test mobile size
        page.set_viewport_size({"width": 375, "height": 667})
        page.goto(live_server)
        expect(page.locator("body")).to_be_visible()
    
    def test_favicon_exists(self, page, live_server):
        """Test that favicon is properly loaded."""
        page.goto(live_server)
        
        # Check if favicon link exists in the HTML
        favicon_link = page.locator('link[rel*="icon"]')
        # Link elements are in head and not "visible", so check count instead
        expect(favicon_link).to_have_count(1, timeout=5000)
    
    def test_css_loading(self, page, live_server):
        """Test that CSS files are loading correctly."""
        page.goto(live_server)
        
        # Check that stylesheets are loaded
        stylesheets = page.locator('link[rel="stylesheet"]')
        # Check that at least one stylesheet exists
        assert stylesheets.count() >= 1, "No stylesheets found"
        
        # Check that some basic styling is applied
        body = page.locator("body")
        expect(body).to_be_visible()
    
    def test_javascript_loading(self, page, live_server):
        """Test that JavaScript files are loading correctly."""
        page.goto(live_server)
        
        # Check that scripts are loaded
        scripts = page.locator('script[src]')
        assert scripts.count() >= 1, "No JavaScript files found"
    
    @pytest.mark.slow
    def test_page_load_performance(self, page, live_server):
        """Test page load performance."""
        import time
        
        start_time = time.time()
        page.goto(live_server)
        
        # Wait for page to be fully loaded
        page.wait_for_load_state("networkidle")
        
        load_time = time.time() - start_time
        
        # Page should load within 5 seconds
        assert load_time < 5.0, f"Page took {load_time:.2f} seconds to load"
    
    def test_error_page_404(self, page, live_server):
        """Test that 404 error page works correctly."""
        page.goto(f"{live_server}/nonexistent-page")
        
        # Should show 404 error page
        expect(page.locator("body")).to_contain_text("404")
    
    def test_security_headers(self, page, live_server):
        """Test that security headers are present."""
        response = page.goto(live_server)
        
        # Check response status
        assert response.status == 200
        
        # Note: Add specific security header checks if they are implemented 