import pytest
import sys
from playwright.sync_api import sync_playwright


@pytest.fixture(scope="session")
def playwright_context():
    """Playwright context fixture for the entire test session."""
    with sync_playwright() as p:
        # Check command line arguments for --headed and --slowmo
        headless = "--headed" not in sys.argv
        slow_mo = 0

        # Look for --slowmo argument
        for i, arg in enumerate(sys.argv):
            if arg == "--slowmo" and i + 1 < len(sys.argv):
                try:
                    slow_mo = int(sys.argv[i + 1])
                except ValueError:
                    slow_mo = 0

        browser = p.chromium.launch(
            headless=headless,
            slow_mo=slow_mo
        )
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},
            ignore_https_errors=True
        )
        yield context
        context.close()
        browser.close()


@pytest.fixture
def page(playwright_context):
    """Create a new page for each test."""
    page = playwright_context.new_page()
    yield page
    page.close()


@pytest.fixture(scope="session")
def live_server(app):
    """Start live server for Playwright tests."""
    import threading
    import time
    import socket
    from werkzeug.serving import make_server

    # Find an available port (starting from 5100 to avoid conflicts with system services)
    port = 5100
    max_attempts = 20
    for attempt in range(max_attempts):
        try:
            # Test if port is available
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(('127.0.0.1', port))
            sock.close()
            break
        except OSError:
            port += 1
            if attempt == max_attempts - 1:
                raise RuntimeError(f"Could not find available port after {max_attempts} attempts")

    server = make_server('127.0.0.1', port, app, threaded=True)
    thread = threading.Thread(target=server.serve_forever)
    thread.daemon = True
    thread.start()

    # Wait for server to actually start and be ready
    import requests
    for _ in range(10):
        try:
            response = requests.get(f'http://127.0.0.1:{port}/')
            if response.status_code in [200, 302, 404]:  # Any response means server is up
                break
        except requests.exceptions.ConnectionError:
            time.sleep(0.5)
    else:
        raise RuntimeError("Server did not start within 5 seconds")

    yield f'http://127.0.0.1:{port}'

    server.shutdown()


@pytest.fixture
def authenticated_page(page, live_server):
    """Page fixture with logged-in user."""
    # Navigate to login page
    page.goto(f"{live_server}/login")

    # Check if we're redirected to account (already logged in)
    if "/account" in page.url:
        pass
    else:
        # Fill login form
        page.fill('input[name="email"]', 'test@example.com')
        page.fill('input[name="password"]', 'testpassword')
        page.click('input[type="submit"]')

        # Wait for redirect to account page (app redirects here after login)
        page.wait_for_url(f"{live_server}/account")

    yield page


@pytest.fixture
def admin_page(page, live_server):
    """Page fixture with logged-in admin user."""
    # Navigate to login page
    page.goto(f"{live_server}/login")

    # Check if we're redirected to account (already logged in)
    if "/account" in page.url:
        pass
    else:
        # Fill login form with admin credentials
        page.fill('input[name="email"]', 'admin@example.com')
        page.fill('input[name="password"]', 'adminpassword')
        page.click('input[type="submit"]')

        # Wait for redirect (admin redirects to account page)
        page.wait_for_load_state("networkidle")

    yield page
