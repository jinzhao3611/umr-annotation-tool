# UMR Annotation Tool - Testing Guide

This directory contains comprehensive Playwright tests for the UMR (Uniform Meaning Representation) annotation tool. The tests cover all major functionality including authentication, file upload, and UMR annotation workflows.

## Test Structure

```
tests/
├── conftest.py                 # Pytest configuration and fixtures
├── fixtures/                   # Test data and sample files
│   ├── __init__.py
│   └── sample_files.py        # Sample UMR files and test data
├── test_basic_navigation.py    # Basic page load and navigation tests
├── test_authentication.py     # Login, registration, and access control tests
├── test_file_upload.py        # UMR file upload functionality tests
├── test_annotation.py         # Core UMR annotation functionality tests
└── README.md                  # This file
```

## Prerequisites

1. **Python 3.9+** with your conda environment activated:
   ```bash
   conda activate web-app
   ```

2. **Required packages installed**:
   ```bash
   pip install pytest pytest-playwright
   playwright install
   ```

3. **Database setup**: Ensure your test database is configured properly.

4. **Flask application**: The tests expect the Flask app to be running on `http://localhost:5000`.

## Running Tests

### Quick Start

Run all tests with default settings:
```bash
pytest tests/ -v
```

### Browser-Specific Tests

Run tests on specific browsers:
```bash
# Chromium only
pytest tests/ --browser chromium

# Firefox only  
pytest tests/ --browser firefox

# WebKit (Safari) only
pytest tests/ --browser webkit

# All browsers
pytest tests/ --browser chromium --browser firefox --browser webkit
```

### Test Categories

Run specific test categories using markers:

```bash
# Authentication tests only
pytest tests/ -m auth

# File upload tests only
pytest tests/ -m upload

# Annotation functionality tests only
pytest tests/ -m annotation

# Integration tests only
pytest tests/ -m integration

# Exclude slow tests
pytest tests/ -m "not slow"

# Run only slow tests
pytest tests/ -m slow
```

### Specific Test Files

Run individual test files:
```bash
# Basic navigation tests
pytest tests/test_basic_navigation.py -v

# Authentication tests
pytest tests/test_authentication.py -v

# File upload tests
pytest tests/test_file_upload.py -v

# Annotation tests
pytest tests/test_annotation.py -v
```

### Parallel Execution

Run tests in parallel for faster execution:
```bash
# Install pytest-xdist first
pip install pytest-xdist

# Run with 4 workers
pytest tests/ -n 4
```

## Test Configuration

### Environment Variables

Set these environment variables for testing:

```bash
export FLASK_ENV=testing
export DATABASE_URL=sqlite:///test.db
export SECRET_KEY=test-secret-key
```

### pytest.ini Settings

The tests use these configurations from `pytest.ini`:
- Verbose output
- Colored output
- Strict marker enforcement
- Multiple browser support
- Warning filters

## Test Fixtures

### Key Fixtures Available

- `app`: Flask application instance with test configuration
- `client`: Flask test client for API testing
- `live_server`: Running Flask server for Playwright tests
- `page`: Playwright page instance
- `authenticated_page`: Pre-logged-in page for authenticated tests
- `admin_page`: Pre-logged-in admin user page
- `sample_umr_content`: Sample UMR annotation content
- `sample_umr_file`: Temporary UMR file for upload tests

### Sample Data

The `fixtures/sample_files.py` module provides:
- Simple English UMR annotations
- Multi-sentence UMR files
- Chinese and Arabic UMR examples
- Complex UMR with multiple relations
- Malformed UMR for error testing
- Large UMR files for performance testing

## Test Descriptions

### Basic Navigation Tests (`test_basic_navigation.py`)
- Home page loading
- Login/register page access
- Navigation links functionality
- Responsive design testing
- Page load performance
- Error page handling

### Authentication Tests (`test_authentication.py`)
- Valid/invalid login attempts
- User registration workflow
- Password validation
- Session management
- Access control for protected pages
- Admin vs regular user permissions

### File Upload Tests (`test_file_upload.py`)
- Valid UMR file upload
- Invalid file type handling
- Empty file validation
- Multiple file upload
- Large file processing
- Unicode content support
- Upload form validation

### Annotation Tests (`test_annotation.py`)
- Sentence-level annotation interface
- Document-level annotation interface
- UMR graph display and editing
- Concept addition and modification
- Relation editing
- Word-to-node alignment
- Save/export functionality
- Undo/redo operations
- Keyboard shortcuts
- Auto-save features

## Debugging Tests

### Headed Mode (Visual Debugging)

Run tests with browser visible:
```bash
pytest tests/ --headed
```

### Slow Motion

Run tests in slow motion to see actions:
```bash
pytest tests/ --slowmo 1000  # 1 second delay between actions
```

### Screenshots on Failure

Automatically capture screenshots on test failures:
```bash
pytest tests/ --screenshot on-failure
```

### Video Recording

Record videos of test runs:
```bash
pytest tests/ --video on-failure
```

### Debug Mode

Run specific test with debugging:
```bash
pytest tests/test_authentication.py::TestAuthentication::test_login_with_valid_credentials -v -s
```

## Writing New Tests

### Test Structure

Follow this structure for new tests:

```python
import pytest
from playwright.sync_api import expect

class TestNewFeature:
    """Test description for the new feature."""
    
    @pytest.mark.feature_name
    def test_specific_functionality(self, authenticated_page, live_server):
        """Test specific functionality description."""
        # Navigate to page
        authenticated_page.goto(f"{live_server}/feature-page")
        
        # Perform actions
        authenticated_page.click('button:text("Action")')
        
        # Assertions
        expect(authenticated_page.locator('.result')).to_be_visible()
```

### Best Practices

1. **Use descriptive test names** that explain what is being tested
2. **Add appropriate markers** for test categorization
3. **Use proper fixtures** for setup and teardown
4. **Write independent tests** that don't depend on other tests
5. **Handle dynamic content** with proper waits
6. **Use Page Object Model** for complex pages
7. **Add error handling** for flaky elements
8. **Document test purpose** in docstrings

### Custom Fixtures

Create custom fixtures in `conftest.py`:

```python
@pytest.fixture
def custom_test_data():
    """Provide custom test data."""
    return {
        'test_value': 'example',
        'test_list': [1, 2, 3]
    }
```

## Troubleshooting

### Common Issues

1. **Browser not found**: Run `playwright install`
2. **Server not running**: Check Flask app startup
3. **Database issues**: Verify test database configuration
4. **Port conflicts**: Ensure port 5000 is available
5. **Timeout errors**: Increase wait times for slow operations

### Performance Issues

1. **Slow tests**: Use `--browser chromium` for faster execution
2. **Memory usage**: Run fewer parallel workers
3. **Network delays**: Mock external API calls

### Element Selection

Use robust selectors:
```python
# Good: Multiple selector strategies
page.locator('button:text("Save"), .save-btn, #saveBtn')

# Bad: Fragile selector
page.locator('#button-123456')
```

## Coverage Reports

Generate test coverage reports:

```bash
# Install coverage
pip install pytest-cov

# Run tests with coverage
pytest tests/ --cov=umr_annot_tool --cov-report=html

# View HTML report
open htmlcov/index.html
```

## Example Test Run

Here's what a typical test run looks like:

```bash
# Start your Flask application first
python run.py &

# Run tests in another terminal
pytest tests/ -v --browser chromium

# Output will show:
# ============ test session starts ============
# tests/test_basic_navigation.py::TestBasicNavigation::test_home_page_loads PASSED
# tests/test_authentication.py::TestAuthentication::test_login_with_valid_credentials PASSED
# tests/test_file_upload.py::TestFileUpload::test_valid_umr_file_upload PASSED
# tests/test_annotation.py::TestAnnotation::test_sentence_level_annotation_page_access PASSED
# ============ 57 passed in 45.23s ============
```

## Sample Test Data

The test suite includes comprehensive sample data:

### Simple UMR Example
```
# :: snt1	The cat sat on the mat.
(s1s / sit-01
    :ARG0 (s1c / cat)
    :ARG1 (s1m / mat))
```

### Complex UMR Example
```
# :: snt1	John told Mary that he would visit her tomorrow.
(s1t / tell-01
    :ARG0 (s1j / person :name (s1n / name :op1 "John"))
    :ARG1 (s1m / person :name (s1n2 / name :op1 "Mary"))
    :ARG2 (s1v / visit-01
        :ARG0 s1j
        :ARG1 s1m
        :time (s1to / tomorrow)))
```

## Resources

- [Playwright Documentation](https://playwright.dev/python/)
- [Pytest Documentation](https://docs.pytest.org/)
- [Flask Testing](https://flask.palletsprojects.com/en/2.0.x/testing/)
- [UMR Specification](https://github.com/umr4nlp/umr-guidelines)

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Add appropriate markers
3. Update this README if needed
4. Ensure tests pass locally
5. Add test data to fixtures if required

## Test Metrics

Current test coverage:
- **57 total tests** across 4 test files
- **4 test categories** with proper markers
- **3 browser support** (Chromium, Firefox, WebKit)
- **Multilingual support** (English, Chinese, Arabic)
- **Performance testing** for large files and slow operations
- **Error handling** for edge cases and malformed data

---

Happy testing! 🧪✨ 