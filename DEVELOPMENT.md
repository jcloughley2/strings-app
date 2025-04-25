# Strings Development Guide

## Project Structure

The project is split into two main parts:
- `frontend/`: Next.js application with TypeScript
- `backend/`: Django REST Framework API

## Key Concepts

### String Variables
- Strings can contain variables using the `{{variable}}` syntax
- Variables are managed globally at the project level
- Variables can have different values for different traits

### Traits
- Traits represent different contexts for variable values
- Each trait can define custom values for any variable
- Traits are used to preview strings with different variable values

### Project Layout
- Main content shows all strings with their current values
- Right sidebar contains two tabs:
  - Variables: Manage project variables and their values
  - Traits: Manage traits and their variable assignments

## State Management
- Project data is fetched at the page level and passed down to components
- Changes to variables/traits trigger a project refresh to ensure consistency
- Variable updates can affect both variable values and string content

## API Integration
- All data is persisted through the Django REST API
- Authentication is required for all API endpoints
- CSRF protection is enabled for all POST/PUT/DELETE requests

## Development Setup

1. Backend Setup:
```bash
cd backend
python -m venv env
source env/bin/activate  # or `env\Scripts\activate` on Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

2. Frontend Setup:
```bash
cd frontend
npm install
npm run dev
```

## Common Development Tasks

### Adding a New Variable
1. Create variable through the UI or API
2. If adding through API: POST to `/api/variables/`
3. Variable values can be set globally or per trait

### Updating String Content
1. String content can be edited through the UI
2. Variables in strings must use `{{variable}}` syntax
3. The system automatically tracks variable usage

### Managing Traits
1. Create traits to define different contexts
2. Assign variable values specific to each trait
3. Use trait selector to preview strings with different values 