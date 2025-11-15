# Centralized Color System

## Overview

All colors for string and conditional variables throughout the application are controlled by **two base color variables** in the SCSS file. Change these two colors to update the entire app's color scheme.

## Source of Truth

**File:** `frontend/src/styles/embedded-variables.scss`

```scss
// ----------------------------------------------------------------------------
// BASE COLORS - Edit these to change the entire color scheme
// ----------------------------------------------------------------------------
$string-var-color: blue;        // Controls ALL string variable colors
$conditional-var-color: gold;   // Controls ALL conditional variable colors
```

## How It Works

### 1. SCSS Base Colors
The SCSS file defines two base colors and automatically generates all color variations using `tint()` and `shade()` functions:

```scss
// String variable colors (derived from $string-var-color)
--string-var-50: tint($string-var-color, 90%)   // Very light backgrounds
--string-var-100: tint($string-var-color, 80%)  // Light backgrounds
--string-var-200: tint($string-var-color, 70%)  // Borders
--string-var-600: shade($string-var-color, 20%) // Icons
--string-var-700: shade($string-var-color, 30%) // Text

// Conditional variable colors (derived from $conditional-var-color)
--conditional-var-50: tint($conditional-var-color, 90%)
--conditional-var-100: tint($conditional-var-color, 80%)
--conditional-var-200: tint($conditional-var-color, 70%)
--conditional-var-600: shade($conditional-var-color, 20%)
--conditional-var-700: shade($conditional-var-color, 30%)
```

### 2. CSS Custom Properties
These colors are exported as CSS custom properties (CSS variables) in the `:root` selector, making them available throughout the entire app.

### 3. Tailwind Integration
The colors are registered in Tailwind's theme via `globals.css`:

```css
@theme inline {
  /* String variable colors */
  --color-string-50: var(--string-var-50);
  --color-string-100: var(--string-var-100);
  --color-string-200: var(--string-var-200);
  --color-string-600: var(--string-var-600);
  --color-string-700: var(--string-var-700);
  
  /* Conditional variable colors */
  --color-conditional-50: var(--conditional-var-50);
  --color-conditional-100: var(--conditional-var-100);
  --color-conditional-200: var(--conditional-var-200);
  --color-conditional-600: var(--conditional-var-600);
  --color-conditional-700: var(--conditional-var-700);
}
```

## Usage in Components

### Tailwind Classes
Use semantic Tailwind classes throughout the app:

```tsx
// String variables
<div className="bg-string-50 text-string-700 border-string-200">
  <Icon className="text-string-600" />
</div>

// Conditional variables  
<div className="bg-conditional-50 text-conditional-700 border-conditional-200">
  <Icon className="text-conditional-600" />
</div>
```

### Where These Colors Are Used

**StringEditDrawer.tsx:**
- Variable type icons (Folder/Spool)
- Variable name badges
- Spawn variable tiles
- Embedded variable tiles
- Parent conditional badges

**Embedded variables (page.tsx):**
- Rendered embedded variables in canvas
- Progressive hover backgrounds based on nesting depth
- Border colors (always base color)

## Changing the Color Scheme

To change the entire app's color scheme, edit **just two variables**:

```scss
// Example: Blue strings, orange conditionals
$string-var-color: rgb(59 130 246);      // blue-500
$conditional-var-color: rgb(249 115 22); // orange-500

// Example: Purple strings, teal conditionals
$string-var-color: rgb(168 85 247);      // purple-500
$conditional-var-color: rgb(20 184 166); // teal-500

// Example: Any custom colors
$string-var-color: #6366f1;              // Custom indigo
$conditional-var-color: #10b981;         // Custom green
```

All derived colors (backgrounds, borders, icons, text) will automatically update throughout the entire application!

## Color Palette Structure

Each base color generates 5 shades:

| Shade | Usage | Tint/Shade % |
|-------|-------|--------------|
| 50    | Very light backgrounds, hover states | 90% white |
| 100   | Light backgrounds | 80% white |
| 200   | Borders | 70% white |
| 600   | Icons | 20% black |
| 700   | Text | 30% black |

## Benefits

✅ **Single source of truth** - Change 2 variables, update entire app  
✅ **Consistent design** - All components use same color system  
✅ **Semantic naming** - `string`/`conditional` instead of color names  
✅ **Easy theming** - Swap colors without touching component code  
✅ **Automatic variants** - SCSS functions generate all needed shades  
✅ **Type safety** - Tailwind classes provide autocomplete  

## Migration Notes

All hardcoded `purple-*` and `orange-*` Tailwind classes have been replaced with:
- `purple-*` → `string-*`
- `orange-*` → `conditional-*`

This semantic naming means the code describes **what** the element is, not **how** it looks, making it future-proof for theme changes.

