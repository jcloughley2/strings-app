import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface VariableHashBadgeProps {
  hash: string;
  type?: 'string' | 'conditional' | 'default'; // Type determines gradient styling
  className?: string;
}

/**
 * Unified hash badge component used throughout the app.
 * Displays a variable hash with copy-to-clipboard functionality.
 * Styled via SCSS: .variable-hash-badge in embedded-variables.scss
 * 
 * @param type - 'string' for string variables (blue/teal gradient), 
 *               'conditional' for conditional variables (gold/salmon gradient),
 *               'default' for neutral gray (no gradient)
 */
export function VariableHashBadge({ hash, type = 'default', className = "" }: VariableHashBadgeProps) {
  const copyText = `{{${hash}}}`;
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent click handlers
    navigator.clipboard.writeText(copyText);
    toast.success(`Copied "${copyText}" to clipboard`);
  };

  // Determine variant class based on type
  const variantClass = type === 'string' 
    ? 'variable-hash-badge-string' 
    : type === 'conditional' 
    ? 'variable-hash-badge-conditional' 
    : '';

  return (
    <Badge
      variant="outline"
      className={`variable-hash-badge ${variantClass} ${className}`}
      onClick={handleCopy}
      title={`Click to copy: ${copyText}`}
    >
      <Copy className="variable-hash-badge-icon" />
      {copyText}
    </Badge>
  );
}

