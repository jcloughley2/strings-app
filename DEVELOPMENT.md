# Strings Development Guide

## Project Structure

The project is split into two main parts:
- `frontend/`: Next.js application with TypeScript
- `backend/`: Django REST Framework API

## Key Concepts

### String Variables
- Every string automatically becomes a variable with a unique hash or custom name
- Strings can embed other variables using the `{{variableName}}` syntax
- Variables support recursive embedding with circular reference protection

### Conditionals
- Convert any string into a conditional container with multiple variations (spawns)
- Each conditional creates a dimension with corresponding dimension values
- Spawns inherit dimension values and can be filtered independently

### Dimensions & Filtering
- Dimensions categorize strings and provide filtering capabilities
- Dimension values are automatically inherited from embedded variables
- Conditions sidebar allows selection of specific spawn variables

### Project Layout
- Main canvas shows all strings including conditionals and embedded strings
- Left sidebar: Conditions sidebar for spawn selection (360px)
- Right sidebar: Variable management (collapsible)
- Color-coded badges: Orange for conditionals, purple for strings

## State Management
- Project data is fetched at the page level and passed down to components
- Changes to dimensions/strings trigger a project refresh to ensure consistency
- Variable embedding updates affect content processing and dimension inheritance

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

### Adding a New String Variable
1. Every string automatically becomes a variable with a unique hash
2. Use the "New String" button or API: POST to `/api/strings/`
3. Strings can be converted to conditionals with multiple spawns

### Updating String Content
1. String content can be edited through the unified drawer interface
2. Variables in strings use `{{variableName}}` syntax for embedding
3. The system automatically tracks variable usage and inheritance

### Managing Conditionals
1. Convert any string to a conditional container using the Variable Type dropdown
2. Add multiple spawns (variations) to the conditional
3. Each spawn automatically gets dimension values for filtering

### Working with Dimensions
1. Dimensions are created automatically when conditionals are made
2. Use the conditions sidebar to select spawn variables for each conditional
3. Dimension inheritance happens automatically through variable embedding