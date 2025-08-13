# Contributing to UMR Annotation Tool

Thank you for considering contributing to the UMR Annotation Tool! This document provides guidelines and instructions for contributing to the project.

## Development Setup

### Prerequisites
- Python 3.8+
- Node.js 14+ (for frontend assets)
- PostgreSQL or SQLite (for database)
- Playwright (for testing)

### Setting Up Your Development Environment

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/umr-annotation-tool.git
   cd umr-annotation-tool
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   ```

4. **Install Playwright browsers**
   ```bash
   playwright install chromium
   ```

5. **Set up the database**
   ```bash
   python manage.py db init
   python manage.py db migrate
   python manage.py db upgrade
   ```

6. **Run the development server**
   ```bash
   python app.py
   ```

## Testing

### Running Tests

All code changes must include appropriate tests. We use pytest with Playwright for end-to-end testing.

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_file_upload.py -v

# Run tests visually (with browser)
pytest tests/ -v --headed --slowmo 500

# Run tests with specific markers
pytest tests/ -v -m upload
pytest tests/ -v -m annotation
```

### Writing Tests

- Place tests in the `tests/` directory
- Use descriptive test names that explain what is being tested
- Follow existing patterns for fixtures and page objects
- Ensure tests are isolated and don't depend on each other
- Clean up test data after each test

### Test Guidelines

1. **Always test both happy and error paths**
2. **Use data-testid attributes** for reliable element selection
3. **Avoid hardcoding values** - use fixtures and test data
4. **Keep tests focused** - one test should verify one behavior
5. **Use appropriate waits** - prefer `wait_for_load_state()` over arbitrary sleeps

## Code Style

### Python Code Style
- Follow PEP 8 guidelines
- Use type hints where appropriate
- Maximum line length: 120 characters
- Use docstrings for all public functions and classes

### JavaScript/TypeScript Code Style
- Use ESLint configuration provided
- Prefer const/let over var
- Use arrow functions for callbacks
- Document complex logic with comments

### Commit Messages
- Use clear, descriptive commit messages
- Start with a verb in present tense (e.g., "Add", "Fix", "Update")
- Reference issue numbers when applicable (e.g., "Fix #123: Resolve upload bug")

Example:
```
Add user authentication for document upload

- Implement JWT-based authentication
- Add login/logout endpoints
- Update tests for authenticated routes

Fixes #45
```

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Add or update tests as needed
   - Ensure all tests pass locally

3. **Run tests and checks**
   ```bash
   # Run tests
   pytest tests/ -v
   
   # Run linting (if configured)
   flake8 .
   
   # Run type checking (if configured)
   mypy .
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add feature: description of your changes"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**
   - Use the PR template provided
   - Include screenshots for UI changes
   - Reference any related issues
   - Ensure CI checks pass

## Pull Request Requirements

Before your PR can be merged:

- [ ] All tests must pass
- [ ] Code must follow project style guidelines
- [ ] New features must include tests
- [ ] Documentation must be updated if needed
- [ ] PR must be reviewed and approved
- [ ] CI checks must be green

## Areas Requiring Extra Care

The following areas are particularly sensitive and require careful testing:

- **Authentication & Authorization**: Changes to login, user roles, or permissions
- **File Upload**: Changes to document upload and parsing logic
- **Database Migrations**: Any schema changes or data migrations
- **Annotation Core**: Changes to UMR annotation parsing or storage

## Bug Reports

When reporting bugs, please include:

1. **Environment details** (OS, Python version, browser)
2. **Steps to reproduce** the issue
3. **Expected behavior** vs actual behavior
4. **Error messages** or logs if available
5. **Screenshots** for UI issues

## Feature Requests

For new features:

1. **Check existing issues** first to avoid duplicates
2. **Describe the use case** and why the feature is needed
3. **Provide examples** of how it would work
4. **Consider backwards compatibility**

## Questions or Need Help?

- Check the [README](README.md) for basic setup
- Look through [existing issues](https://github.com/jinzhao3611/umr-annotation-tool/issues)
- Ask questions in issues with the "question" label

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

## Thank You!

Your contributions help make this tool better for the entire UMR annotation community. We appreciate your time and effort!