# Embedded Variables Styling Guide

This directory contains SCSS files for customizing the appearance of embedded variables in the Strings app.

## File: `embedded-variables.scss`

This file controls how embedded variables appear in the string canvas when they're rendered inline.

### What You Can Customize

#### 🟣 Purple String Variables (3 depth levels)

Edit these classes to change how regular string variables look at different nesting depths:

- `.embedded-var-purple-0` - Shallowest level (lightest purple)
- `.embedded-var-purple-1` - Medium level (medium purple)
- `.embedded-var-purple-2` - Deepest level (darkest purple)

**Properties you can customize:**
- `background-color` - Background color
- `color` - Text color
- `border-color` - Border color
- `&:hover background-color` - Hover state background

#### 🟠 Orange Conditional Variables

Edit this class to change how conditional variables look:

- `.embedded-var-orange` - All conditional variables

**Properties you can customize:**
- `background-color` - Background color
- `color` - Text color
- `border-color` - Border color
- `&:hover background-color` - Hover state background

#### 📦 Shared Base Styles

Edit `.embedded-var` to change properties shared by all embedded variables:

- `padding` - Internal spacing
- `margin-left` - Left margin
- `border-width`, `border-style`, `border-radius` - Border styling
- `cursor` - Mouse cursor style
- `transition-*` - Animation properties

#### 🏷️ Badge Mode Styles

When "Show Variables" mode is enabled, variables appear as badges. Edit these classes:

- `.embedded-var-badge-purple` - Purple badges for string variables
- `.embedded-var-badge-orange` - Orange badges for conditional variables

## How to Make Changes

1. **Open** `embedded-variables.scss`
2. **Find** the class you want to customize
3. **Edit** the CSS properties (colors, spacing, borders, etc.)
4. **Save** the file
5. **Refresh** your browser - Next.js will hot-reload the styles

## Example Customizations

### Change Purple Variable Colors to Blue
```scss
.embedded-var-purple-0 {
  background-color: rgb(239 246 255); // bg-blue-50
  color: rgb(30 64 175); // text-blue-800
  border-color: rgb(191 219 254); // border-blue-200
  
  &:hover {
    background-color: rgb(219 234 254); // hover:bg-blue-100
  }
}
```

### Make Conditional Variables Red Instead of Orange
```scss
.embedded-var-orange {
  background-color: rgb(254 242 242); // bg-red-50
  color: rgb(153 27 27); // text-red-800
  border-color: rgb(254 202 202); // border-red-200
  
  &:hover {
    background-color: rgb(254 226 226); // hover:bg-red-100
  }
}
```

### Add More Padding
```scss
.embedded-var {
  padding: 0.25rem 0.5rem; // Increased from 0.125rem 0.25rem
}
```

### Remove Borders
```scss
.embedded-var {
  border-width: 0; // Changed from 1px
}
```

### Add Shadow on Hover
```scss
.embedded-var-purple-0 {
  // ... existing styles ...
  
  &:hover {
    background-color: rgb(243 232 255);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
}
```

## Color Reference

Use Tailwind's color palette or any CSS color format:
- RGB: `rgb(255 247 237)`
- Hex: `#fff7ed`
- HSL: `hsl(33, 100%, 97%)`
- Named: `lightblue`

## Need Help?

- The SCSS file has detailed comments explaining each section
- All changes are automatically compiled by Next.js
- Your customizations won't be overwritten by updates

