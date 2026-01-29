"use client";

export default function StyleGuidePage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="border-b pb-6">
          <h1 className="text-4xl font-bold mb-2">Style Guide</h1>
          <p className="text-muted-foreground">
            Text styles and typography used throughout the Strings app.
          </p>
        </div>

        {/* Headings */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">Headings</h2>
          
          <div className="space-y-4">
            <StyleExample
              name="Page Title (H1)"
              className="text-4xl font-bold"
              example="Page Title"
              code="text-4xl font-bold"
            />
            
            <StyleExample
              name="Section Title (H2)"
              className="text-2xl font-semibold"
              example="Section Title"
              code="text-2xl font-semibold"
            />
            
            <StyleExample
              name="Subsection Title (H3)"
              className="text-xl font-semibold"
              example="Subsection Title"
              code="text-xl font-semibold"
            />
            
            <StyleExample
              name="Card/Panel Title"
              className="text-lg font-semibold"
              example="Card Title"
              code="text-lg font-semibold"
            />
            
            <StyleExample
              name="Sidebar Section Header"
              className="text-lg font-semibold"
              example="Conditions"
              code="text-lg font-semibold"
            />
            
            <StyleExample
              name="Conditional Variable Name"
              className="font-medium text-sm"
              example="conditional"
              code="font-medium text-sm"
            />
          </div>
        </section>

        {/* Body Text */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">Body Text</h2>
          
          <div className="space-y-4">
            <StyleExample
              name="Base Body Text"
              className="text-base"
              example="This is the default body text used throughout the application."
              code="text-base"
            />
            
            <StyleExample
              name="String Content"
              className="font-medium text-base leading-relaxed"
              example="Hello {{userName}}, welcome to our app!"
              code="font-medium text-base leading-relaxed"
            />
            
            <StyleExample
              name="Description Text"
              className="text-sm text-muted-foreground"
              example="This is a description or helper text that provides additional context."
              code="text-sm text-muted-foreground"
            />
            
{/* Small Muted Text, Spawn Content Preview, Variable Hash/ID, and Spawn Display Name 
                have been consolidated to use Description Text (text-sm text-muted-foreground) */}
          </div>
        </section>

        {/* Labels & Form Text */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">Labels & Form Text</h2>
          
          <div className="space-y-4">
            <StyleExample
              name="Form Label"
              className="text-sm font-medium"
              example="Display Name"
              code="text-sm font-medium"
            />
            
            <StyleExample
              name="Large Form Label"
              className="text-base font-semibold"
              example="Publish to Organization Registry"
              code="text-base font-semibold"
            />
            
            <StyleExample
              name="Section Label (Uppercase)"
              className="text-[10px] text-muted-foreground uppercase tracking-wide"
              example="USED IN"
              code="text-[10px] text-muted-foreground uppercase tracking-wide"
            />
            
            <StyleExample
              name="Input Placeholder Style"
              className="text-muted-foreground"
              example="Enter string content..."
              code="text-muted-foreground (placeholder)"
            />
          </div>
        </section>

        {/* Variable Identifiers */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">Variable Identifiers</h2>
          
          <div className="space-y-4">
            <StyleExample
              name="Variable Hash"
              className="text-sm text-muted-foreground"
              example="JGRRDC"
              code="text-sm text-muted-foreground"
            />
            
            <StyleExample
              name="Custom Variable Hash"
              className="text-sm text-muted-foreground"
              example="welcome-message"
              code="text-sm text-muted-foreground"
            />
            
            <StyleExample
              name="Badge Text (Variable Reference)"
              className="text-xs"
              example="{{variableHash}}"
              code="text-xs"
            />
          </div>
        </section>

        {/* UI Elements */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">UI Elements</h2>
          
          <div className="space-y-4">
            <StyleExample
              name="Button Text (Default)"
              className="text-sm font-medium"
              example="Save Changes"
              code="text-sm font-medium"
            />
            
            <StyleExample
              name="Button Text (Small)"
              className="text-xs"
              example="Add Spawn"
              code="text-xs (size='sm')"
            />
            
            <StyleExample
              name="Menu Item Text"
              className="text-sm"
              example="Copy reference"
              code="text-sm"
            />
            
            <StyleExample
              name="Tab Text"
              className="text-sm font-medium"
              example="Content"
              code="text-sm font-medium"
            />
            
            <StyleExample
              name="Tooltip Text"
              className="text-xs"
              example="Click to edit"
              code="text-xs"
            />
          </div>
        </section>

        {/* Status & Feedback */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">Status & Feedback</h2>
          
          <div className="space-y-4">
            <StyleExample
              name="Success Message"
              className="text-sm text-green-800"
              example="✓ This string will appear in the organization registry."
              code="text-sm text-green-800"
            />
            
            <StyleExample
              name="Warning Message"
              className="text-sm text-amber-800"
              example="Save this string first to publish it."
              code="text-sm text-amber-800"
            />
            
            <StyleExample
              name="Error/Delete Text"
              className="text-sm text-red-600"
              example="Delete string"
              code="text-sm text-red-600"
            />
            
            <StyleExample
              name="Empty State Text"
              className="text-sm text-muted-foreground"
              example="No strings found in this project."
              code="text-sm text-muted-foreground"
            />
            
            <StyleExample
              name="Italic Empty State"
              className="text-muted-foreground italic"
              example="No content"
              code="text-muted-foreground italic"
            />
          </div>
        </section>

        {/* Special Styles */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">Special Styles</h2>
          
          <div className="space-y-4">
            <StyleExample
              name="Logo Text"
              className="text-3xl font-courgette tracking-wide text-primary"
              example="Strings"
              code="text-3xl font-courgette tracking-wide text-primary"
            />
            
            <StyleExample
              name="New Badge"
              className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
              example="New"
              code="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
            />
            
            <StyleExample
              name="Conditional Label"
              className="flex items-center gap-2 text-muted-foreground italic"
              example="📁 Conditional variable"
              code="text-muted-foreground italic (with icon)"
            />
          </div>
        </section>

        {/* Font Sizes Reference */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">Font Size Scale</h2>
          
          <div className="space-y-2">
            <div className="flex items-baseline gap-4 py-2 border-b border-dashed">
              <span className="w-24 text-xs text-muted-foreground font-mono">text-xs</span>
              <span className="text-xs">12px - The quick brown fox</span>
            </div>
            <div className="flex items-baseline gap-4 py-2 border-b border-dashed">
              <span className="w-24 text-xs text-muted-foreground font-mono">text-sm</span>
              <span className="text-sm">14px - The quick brown fox</span>
            </div>
            <div className="flex items-baseline gap-4 py-2 border-b border-dashed">
              <span className="w-24 text-xs text-muted-foreground font-mono">text-base</span>
              <span className="text-base">16px - The quick brown fox</span>
            </div>
            <div className="flex items-baseline gap-4 py-2 border-b border-dashed">
              <span className="w-24 text-xs text-muted-foreground font-mono">text-lg</span>
              <span className="text-lg">18px - The quick brown fox</span>
            </div>
            <div className="flex items-baseline gap-4 py-2 border-b border-dashed">
              <span className="w-24 text-xs text-muted-foreground font-mono">text-xl</span>
              <span className="text-xl">20px - The quick brown fox</span>
            </div>
            <div className="flex items-baseline gap-4 py-2 border-b border-dashed">
              <span className="w-24 text-xs text-muted-foreground font-mono">text-2xl</span>
              <span className="text-2xl">24px - The quick brown fox</span>
            </div>
            <div className="flex items-baseline gap-4 py-2 border-b border-dashed">
              <span className="w-24 text-xs text-muted-foreground font-mono">text-3xl</span>
              <span className="text-3xl">30px - The quick brown fox</span>
            </div>
            <div className="flex items-baseline gap-4 py-2 border-b border-dashed">
              <span className="w-24 text-xs text-muted-foreground font-mono">text-4xl</span>
              <span className="text-4xl">36px - The quick brown fox</span>
            </div>
          </div>
        </section>

        {/* Font Weights Reference */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold border-b pb-2">Font Weight Scale</h2>
          
          <div className="space-y-2">
            <div className="flex items-baseline gap-4 py-2 border-b border-dashed">
              <span className="w-28 text-xs text-muted-foreground font-mono">font-normal</span>
              <span className="font-normal text-lg">400 - The quick brown fox</span>
            </div>
            <div className="flex items-baseline gap-4 py-2 border-b border-dashed">
              <span className="w-28 text-xs text-muted-foreground font-mono">font-medium</span>
              <span className="font-medium text-lg">500 - The quick brown fox</span>
            </div>
            <div className="flex items-baseline gap-4 py-2 border-b border-dashed">
              <span className="w-28 text-xs text-muted-foreground font-mono">font-semibold</span>
              <span className="font-semibold text-lg">600 - The quick brown fox</span>
            </div>
            <div className="flex items-baseline gap-4 py-2 border-b border-dashed">
              <span className="w-28 text-xs text-muted-foreground font-mono">font-bold</span>
              <span className="font-bold text-lg">700 - The quick brown fox</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// Helper component to display style examples
function StyleExample({
  name,
  className,
  example,
  code,
}: {
  name: string;
  className: string;
  example: string;
  code: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-4 p-4 border rounded-lg bg-card">
      <div className="sm:w-48 shrink-0">
        <div className="font-medium text-sm">{name}</div>
        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1 inline-block">
          {code}
        </code>
      </div>
      <div className="flex-1 flex items-center min-h-[32px]">
        <span className={className}>{example}</span>
      </div>
    </div>
  );
}
