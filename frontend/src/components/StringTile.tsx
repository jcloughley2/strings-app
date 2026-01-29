"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy, MoreHorizontal, Trash2, Plus, Folder, Focus } from "lucide-react";
import { FEATURES } from "@/lib/featureFlags";

export interface StringTileData {
  id: number;
  content: string;
  variable_hash: string;
  effective_variable_name: string;
  is_conditional_container?: boolean;
  project_id?: number;
  project_name?: string;
}

export interface StringTileProps {
  /** The string data to display */
  string: StringTileData;
  
  /** @deprecated No longer used - display names removed */
  showDisplayName?: boolean;
  
  /** Whether to show the variable hash badge */
  showVariableHash?: boolean;
  
  /** Custom content renderer (for styled content with variable highlighting) */
  renderContent?: (content: string) => ReactNode;
  
  /** Whether the tile is clickable */
  onClick?: () => void;
  
  /** Whether to show the checkbox for selection */
  showCheckbox?: boolean;
  
  /** Whether this tile is selected (for checkbox) */
  isSelected?: boolean;
  
  /** Callback when checkbox is toggled */
  onSelect?: (selected: boolean) => void;
  
  /** Whether to show the quick-add button (for embedding or adding as spawn) */
  showAddButton?: boolean;
  
  /** Tooltip text for add button */
  addButtonTooltip?: string;
  
  /** @deprecated No longer used - add button now uses default styling */
  isAddingToConditional?: boolean;
  
  /** ID of the string currently being edited (to prevent self-embedding) */
  editingStringId?: number | null;
  
  /** Callback when add button is clicked */
  onAdd?: () => void;
  
  /** Whether to show the copy reference button */
  showCopyButton?: boolean;
  
  /** Callback when copy is clicked */
  onCopy?: () => void;
  
  /** Whether to show the actions menu (duplicate, delete, etc.) */
  showActionsMenu?: boolean;
  
  /** Callback when duplicate is clicked */
  onDuplicate?: () => void;
  
  /** Callback when delete is clicked */
  onDelete?: () => void;
  
  /** Callback when focus mode is clicked */
  onFocus?: () => void;
  
  /** Whether to show the source project link (for registry) */
  showProjectSource?: boolean;
  
  /** Additional class names for the card */
  className?: string;
}

export function StringTile({
  string,
  showDisplayName = true,
  showVariableHash = false,
  renderContent,
  onClick,
  showCheckbox = false,
  isSelected = false,
  onSelect,
  showAddButton = false,
  addButtonTooltip = "Add",
  isAddingToConditional = false,
  editingStringId = null,
  onAdd,
  showCopyButton = true,
  onCopy,
  showActionsMenu = false,
  onDuplicate,
  onDelete,
  onFocus,
  showProjectSource = false,
  className = "",
}: StringTileProps) {
  const isClickable = !!onClick;
  const isConditional = string.is_conditional_container;

  return (
    <Card
      className={`p-4 ${isClickable ? "cursor-pointer hover:bg-muted/30" : ""} transition-colors ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {showCheckbox && (
          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onSelect?.(e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              className="rounded border-gray-300"
            />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex items-start justify-between gap-2 flex-1">
          <div className="flex-1 min-w-0">
            {/* Content */}
            <div className="font-medium text-base leading-relaxed">
              {isConditional ? (
                <div className="flex items-center gap-2 text-muted-foreground italic">
                  <Folder className="h-4 w-4" />
                  <span>Conditional variable</span>
                </div>
              ) : renderContent ? (
                renderContent(string.content)
              ) : (
                <p className="whitespace-pre-wrap break-words">
                  {string.content || (
                    <span className="text-muted-foreground italic">No content</span>
                  )}
                </p>
              )}
            </div>

            {/* Variable Hash */}
            {showVariableHash && (
              <div className="mt-1 text-xs text-muted-foreground/70">
                {string.effective_variable_name || string.variable_hash}
              </div>
            )}

            {/* Project Source (for registry) */}
            {showProjectSource && string.project_id && string.project_name && (
              <div className="mt-3 text-sm text-muted-foreground">
                From project:{" "}
                <Link
                  href={`/projects/${string.project_id}`}
                  className="hover:underline text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  {string.project_name}
                </Link>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1 shrink-0">
            {/* Actions Menu */}
            {showActionsMenu && (onDuplicate || onDelete || onFocus || onCopy) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onCopy && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopy();
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy reference
                    </DropdownMenuItem>
                  )}
                  {FEATURES.REGISTRY && onFocus && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onFocus();
                      }}
                    >
                      <Focus className="h-4 w-4 mr-2" />
                      Focus mode
                    </DropdownMenuItem>
                  )}
                  {(onCopy || (FEATURES.REGISTRY && onFocus)) && (onDuplicate || onDelete) && <DropdownMenuSeparator />}
                  {onDuplicate && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate();
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate string
                    </DropdownMenuItem>
                  )}
                  {onDuplicate && onDelete && <DropdownMenuSeparator />}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete string
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Add Button - for embedding or adding as spawn (hidden if editing self) - placed last (far right) */}
            {showAddButton && onAdd && editingStringId !== string.id && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdd();
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{addButtonTooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
