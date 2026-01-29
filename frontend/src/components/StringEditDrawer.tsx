"use client";
import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Search, X, Sparkles, Folder, Plus, Spool, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { VariableHashBadge } from "@/components/VariableHashBadge";
import { DrawerNavigation } from "@/components/DrawerNavigation";

// Reusable Variable Search/Select Component
export interface VariableSearchSelectProps {
  label: string;
  helperText: string;
  placeholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  showResults: boolean;
  onShowResultsChange: (show: boolean) => void;
  availableVariables: {
    id: string | number;
    name: string;
    content: string;
    type: string;
    isConditional: boolean;
    isSpawn?: boolean; // Spawn variables are visible but not selectable
    parentConditionalName?: string; // Name of parent conditional if this is a spawn
    isCurrent?: boolean; // Mark as current variable (not selectable)
    isSelected?: boolean; // Mark as currently selected
  }[];
  onSelect: (variable: any) => void;
  maxResults?: number;
  noBorder?: boolean; // Don't show border-t styling (for embedded use)
  showNoResultsOnEmpty?: boolean; // Show "no results" even when search is empty
}

export function VariableSearchSelect({
  label,
  helperText,
  placeholder = "Type to search for existing variables...",
  searchValue,
  onSearchChange,
  showResults,
  onShowResultsChange,
  availableVariables,
  onSelect,
  maxResults = 8,
  noBorder = false,
  showNoResultsOnEmpty = false,
}: VariableSearchSelectProps) {
  return (
    <div className={`space-y-3 ${noBorder ? '' : 'border-t pt-4'}`}>
      <Label className="text-sm font-medium flex items-center gap-2">
        <Search className="h-4 w-4" />
        {label}
      </Label>
      <div className="space-y-2">
        <div className="relative">
          <Input
            value={searchValue}
            onChange={(e) => {
              onSearchChange(e.target.value);
              onShowResultsChange(true); // Always show results when typing
            }}
            placeholder={placeholder}
            className="w-full"
            onFocus={() => onShowResultsChange(true)} // Show results on focus (even without typing)
            onBlur={() => {
              // Delay hiding to allow clicks on results
              setTimeout(() => onShowResultsChange(false), 200);
            }}
          />
          
          {/* Search Results Dropdown */}
          {showResults && availableVariables.length > 0 && (
            <div className="absolute top-full left-0 w-full mt-1 bg-background border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
              {availableVariables.slice(0, maxResults).map((variable) => {
                const isSpawn = variable.isSpawn;
                const isCurrent = variable.isCurrent;
                const isSelected = variable.isSelected;
                const isDisabled = isSpawn || isCurrent;
                
                return (
                  <div
                    key={variable.id}
                    className={`p-3 border-b last:border-b-0 ${
                      isDisabled 
                        ? 'opacity-50 cursor-not-allowed' 
                        : isSelected
                        ? 'bg-blue-50 cursor-pointer'
                        : 'hover:bg-muted cursor-pointer'
                    }`}
                    onClick={() => !isDisabled && onSelect(variable)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {variable.isConditional ? (
                        <div className="flex items-center gap-1 text-conditional-600 bg-conditional-50 p-1 rounded border border-conditional-200">
                          <Folder className="h-3 w-3" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-string-600 bg-string-50 p-1 rounded border border-string-200">
                          <Spool className="h-3 w-3" />
                        </div>
                      )}
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          variable.isConditional 
                            ? 'bg-conditional-50 text-conditional-700 border-conditional-200'
                            : 'bg-string-50 text-string-700 border-string-200'
                        }`}
                      >
                        {`{{${variable.name}}}`}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {variable.type}
                      </Badge>
                      {isSpawn && (
                        <Badge variant="outline" className="text-sm text-muted-foreground">
                          spawn
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="outline" className="text-sm text-muted-foreground">
                          current
                        </Badge>
                      )}
                      {isSelected && (
                        <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                          ✓ selected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {isSpawn && variable.parentConditionalName 
                        ? `Spawn of ${variable.parentConditionalName}` 
                        : (variable.content || "No content")}
                    </p>
                  </div>
                );
              })}
              {availableVariables.length > maxResults && (
                <div className="p-2 text-sm text-muted-foreground text-center border-t">
                  Showing first {maxResults} results. Type more to filter further.
                </div>
              )}
            </div>
          )}
          
          {/* No Results Message */}
          {showResults && (searchValue.length > 0 || showNoResultsOnEmpty) && availableVariables.length === 0 && (
            <div className="absolute top-full left-0 w-full mt-1 bg-background border rounded-md shadow-lg z-50 p-3">
              <p className="text-sm text-muted-foreground text-center">
                {searchValue.length > 0 
                  ? `No variables found matching "${searchValue}"`
                  : "No spawn variables available"
                }
              </p>
            </div>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground">
          {helperText}
        </p>
      </div>
    </div>
  );
}

// Simple slugify function for preview
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
    .replace(/\-\-+/g, '-')      // Replace multiple - with single -
    .replace(/^-+/, '')          // Trim - from start of text
    .replace(/-+$/, '')          // Trim - from end of text
    .substring(0, 50);           // Limit length
}

export interface StringEditDrawerProps {
  // Core state
  isOpen: boolean;
  onClose: () => void;
  
  // String data
  stringData?: any; // The string being edited (null for new strings)
  
  // Content and form state
  content: string;
  onContentChange: (content: string) => void;
  
  variableName: string;
  onVariableNameChange: (name: string) => void;
  
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  
  // Type and conditional state
  isConditional: boolean;
  onTypeChange: (isConditional: boolean) => void;
  
  conditionalSpawns: any[];
  onConditionalSpawnsChange: (spawns: any[]) => void;
  
  includeHiddenOption: boolean;
  onHiddenOptionChange: (include: boolean) => void;
  
  // Controlling condition state
  controlledBySpawnId: number | null;
  onControlledBySpawnIdChange: (spawnId: number | null) => void;
  
  // Embedded variable edits (local state)
  embeddedVariableEdits: {[variableId: string]: {display_name?: string; content?: string}};
  onEmbeddedVariableEditsChange: (edits: {[variableId: string]: {display_name?: string; content?: string}}) => void;
  
  // Pending variable content (for new variables detected in content)
  pendingVariableContent: {[variableName: string]: string};
  onPendingVariableContentChange: (content: {[variableName: string]: string}) => void;
  
  // Tab state
  activeTab: string;
  onTabChange: (tab: string) => void;
  
  // Context and project data
  project: any;
  selectedDimensionValues: {[dimensionId: number]: string | null};
  pendingStringVariables: {[name: string]: {content: string, is_conditional: boolean}};
  
  // Actions
  onSave: () => Promise<void>;
  onCancel?: () => void;
  
  // Variable detection (optional - for nested editing)
  onVariableClick?: (variableName: string, isExisting: boolean) => void;
  onAddSpawn?: () => void;
  onEditSpawn?: (spawn: any) => void;
  onUpdateSpawn?: (index: number, updatedSpawn: any) => void;
  onRemoveSpawn?: (spawn: any, index: number) => void;
  onEditVariable?: (variableName: string) => void;
  onAddExistingVariableAsSpawn?: (variableId: string) => void;
  onNavigateToVariable?: (variableId: string) => void;
  
  // Display options
  title?: string;
  level?: number; // For cascading drawers (0 = main, 1+ = nested)
  showBackButton?: boolean;
  onBack?: () => void;
  
  // Loading states
  isSaving?: boolean;
  
  // Session state
  dirtyVariableIds?: Set<string>; // IDs of variables with unsaved changes
  sessionEdits?: Map<string, any>; // All variables in the current editing session
  activeVariableId?: string; // The ID of the currently active variable in the session
  
  // Content resolution
  resolveContentToPlaintext?: (content: string, excludeStringId?: string | number) => string; // Resolve variables to plaintext based on selected conditional spawns
  
  // Delete handler
  onDelete?: (variable: any) => void; // Called when user wants to delete the variable
  
  // Publishing state
  isPublished?: boolean;
  onIsPublishedChange?: (isPublished: boolean) => void;
}

export function StringEditDrawer({
  isOpen,
  onClose,
  stringData,
  content,
  onContentChange,
  variableName,
  onVariableNameChange,
  displayName,
  onDisplayNameChange,
  isConditional,
  onTypeChange,
  conditionalSpawns,
  onConditionalSpawnsChange,
  includeHiddenOption,
  onHiddenOptionChange,
  controlledBySpawnId,
  onControlledBySpawnIdChange,
  embeddedVariableEdits,
  onEmbeddedVariableEditsChange,
  pendingVariableContent,
  onPendingVariableContentChange,
  activeTab,
  onTabChange,
  project,
  selectedDimensionValues,
  pendingStringVariables,
  onSave,
  onCancel,
  onAddSpawn,
  onEditSpawn,
  onUpdateSpawn,
  onRemoveSpawn,
  onEditVariable,
  onAddExistingVariableAsSpawn,
  onNavigateToVariable,
  title,
  level = 0,
  showBackButton = false,
  onBack,
  isSaving = false,
  dirtyVariableIds,
  sessionEdits,
  activeVariableId,
  resolveContentToPlaintext,
  onDelete,
  isPublished = false,
  onIsPublishedChange,
}: StringEditDrawerProps) {
  
  // Ref for content textarea to enable auto-focus
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // State for adding existing variables as spawns
  const [existingVariableSearch, setExistingVariableSearch] = useState("");
  const [showExistingVariableResults, setShowExistingVariableResults] = useState(false);
  
  // State for embedding existing variables in string content
  const [embedVariableSearch, setEmbedVariableSearch] = useState("");
  const [showEmbedVariableResults, setShowEmbedVariableResults] = useState(false);
  
  // State for controlling spawn selector
  const [controllingSpawnSearch, setControllingSpawnSearch] = useState("");
  const [showControllingSpawnResults, setShowControllingSpawnResults] = useState(false);
  const [isControllingConditionEnabled, setIsControllingConditionEnabled] = useState(false);
  
  // Auto-focus content textarea when creating a new string (no existing stringData.id)
  useEffect(() => {
    if (isOpen && !stringData?.id && !isConditional && activeTab === 'content') {
      // Small delay to ensure the sheet animation completes and textarea is rendered
      const timer = setTimeout(() => {
        contentTextareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, stringData?.id, isConditional, activeTab]);
  
  // Detect variables in content for display
  const detectVariables = (content: string) => {
    const variableMatches = content.match(/{{([^}]+)}}/g) || [];
    const variableNames = variableMatches.map(match => match.slice(2, -2));
    return [...new Set(variableNames)];
  };
  
  // Categorize detected variables as new or existing
  const categorizeVariables = (detectedVariables: string[]) => {
    const existingVariables: string[] = [];
    const newVariables: string[] = [];
    
    detectedVariables.forEach(varName => {
      // Check if variable exists in project strings
      const existsInProject = project?.strings?.some((str: any) => {
        const effectiveName = str.effective_variable_name || str.variable_hash;
        return effectiveName === varName;
      });
      
      // Check if variable is in pending variables
      const existsInPending = pendingStringVariables[varName];
      
      if (existsInProject || existsInPending) {
        existingVariables.push(varName);
      } else {
        newVariables.push(varName);
      }
    });
    
    return { existingVariables, newVariables };
  };
  
  // Get current detected variables
  const detectedVars = detectVariables(content);
  const { existingVariables, newVariables } = categorizeVariables(detectedVars);

  // Find existing string variables
  const usedStringVariables = project?.strings?.filter((str: any) => {
    const effectiveName = str.effective_variable_name || str.variable_name || str.variable_hash;
    return effectiveName && existingVariables.includes(effectiveName);
  }) || [];

  // Get new variables that don't exist yet
  const pendingVariablesInContent = newVariables;

  // Build navigation nodes for drawer sidebar
  const buildNavigationNodes = () => {
    const nodes: any[] = [];
    
    const currentVarName = stringData?.effective_variable_name || stringData?.variable_hash || displayName || 'new';
    // Use activeVariableId from session if available, otherwise fall back to stringData.id
    const currentId = activeVariableId || stringData?.id?.toString() || 'new';
    
    // Find parent variables (variables that embed or spawn this one)
    const parents: any[] = [];
    
    // Check for embedded parents in saved variables (variables that embed this one in their content)
    // Only check if we have an existing variable
    if (stringData) {
      project?.strings?.forEach((str: any) => {
        if (str.id === stringData.id) return;
        if (str.content) {
          const variableMatches = str.content.match(/{{([^}]+)}}/g) || [];
          const embeddedVars = variableMatches.map((match: string) => match.slice(2, -2));
          if (embeddedVars.includes(currentVarName)) {
            parents.push({ ...str, relationship: 'parent-embeds' });
          }
        }
      });
    }
    
    // ALSO check for embedded parents in the session (pending variables that embed this one)
    if (sessionEdits) {
      sessionEdits.forEach((edit, editId) => {
        // Skip the current variable itself
        if (editId === currentId) return;
        
        // Check if this session variable embeds the current one
        if (edit.content) {
          const variableMatches = edit.content.match(/{{([^}]+)}}/g) || [];
          const embeddedVars = variableMatches.map((match: string) => match.slice(2, -2));
          
          // For pending variables, check against the display name
          const targetName = currentId.startsWith('pending-') ? currentId.replace('pending-', '') : currentVarName;
          
          if (embeddedVars.includes(targetName)) {
            // Create a pseudo-variable object for the parent
            parents.push({
              id: editId,
              display_name: edit.displayName || '',
              effective_variable_name: edit.displayName || editId,
              variable_hash: editId,
              is_conditional_container: edit.isConditional,
              relationship: 'parent-embeds',
              _isPending: true,
            });
          }
        }
      });
    }
    
    // Check for spawn parents (conditional variables that have this as a spawn)
    // First check saved variables in dimensions
    if (stringData && !stringData.is_conditional_container) {
      project?.dimensions?.forEach((dim: any) => {
        const hasCurrentAsSpawn = dim.values?.some((dv: any) => dv.value === currentVarName);
        if (hasCurrentAsSpawn) {
          // Find the conditional variable for this dimension
          const conditionalVar = project?.strings?.find((s: any) => 
            s.is_conditional_container && 
            (s.effective_variable_name || s.variable_hash) === dim.name
          );
          if (conditionalVar && conditionalVar.id !== stringData.id) {
            parents.push({ ...conditionalVar, relationship: 'parent-spawns' });
          }
        }
      });
    }
    
    // ALSO check for spawn parents in the session (pending conditionals that have this as a spawn)
    if (sessionEdits) {
      sessionEdits.forEach((edit, editId) => {
        // Skip the current variable itself
        if (editId === currentId) return;
        
        // Check if this is a conditional variable with spawns
        if (edit.isConditional && edit.conditionalSpawns && edit.conditionalSpawns.length > 0) {
          // Check if the current variable is in this conditional's spawns
          const isSpawnOfThis = edit.conditionalSpawns.some((spawn: any) => {
            // For temp spawns, check the temp ID
            if (currentId.startsWith('temp-')) {
              return spawn.id === currentId || spawn.id?.toString() === currentId;
            }
            // For pending spawns, check the display name
            if (currentId.startsWith('pending-')) {
              const targetName = currentId.replace('pending-', '');
              return spawn.display_name === targetName || spawn.variable_name === targetName;
            }
            // For existing spawns, check the ID
            return spawn.id?.toString() === currentId;
          });
          
          if (isSpawnOfThis) {
            // Create a pseudo-variable object for the parent
            parents.push({
              id: editId,
              display_name: edit.displayName || '',
              effective_variable_name: edit.displayName || editId,
              variable_hash: editId,
              is_conditional_container: true,
              relationship: 'parent-spawns',
              _isPending: true,
            });
          }
        }
      });
    }
    
    // Add parent nodes first (at the top) - deduplicate by ID
    const addedParentIds = new Set<string>();
    parents.forEach((parent: any) => {
      const parentId = parent.id.toString();
      if (addedParentIds.has(parentId)) return; // Skip duplicates
      addedParentIds.add(parentId);
      
      nodes.push({
        id: parentId,
        name: parent.display_name || '',
        hash: parent.effective_variable_name || parent.variable_hash,
        type: parent.is_conditional_container ? 'conditional' : 'string',
        isActive: false,
        relationship: parent.relationship,
      });
    });
    
    // Current variable (in the middle)
    // Use currentId (which includes activeVariableId) for consistency with deduplication
    // For the name, try multiple sources: display_name, then effective_variable_name/hash
    // This handles spawns that have no display_name but do have a variable hash
    const currentNodeName = stringData?.display_name || displayName || 
                            stringData?.effective_variable_name || stringData?.variable_hash || 
                            'New Variable';
    nodes.push({
      id: currentId,
      name: currentNodeName,
      hash: stringData?.effective_variable_name || stringData?.variable_hash || 'new',
      type: stringData?.is_conditional_container || isConditional ? 'conditional' : 'string',
      isActive: true,
    });
    
    // Get IDs of nodes already added (parents + current)
    const existingNodeIds = new Set(nodes.map(n => n.id));
    
    // Add spawn children (if this is a conditional)
    if ((stringData?.is_conditional_container || isConditional) && conditionalSpawns.length > 0) {
      conditionalSpawns.forEach((spawn: any) => {
        const spawnId = spawn.id ? spawn.id.toString() : `temp-${spawn.variable_name || spawn.display_name}`;
        
        // Check if there's an edit state for this spawn in the session
        let spawnDisplayName = spawn.display_name || '';
        let spawnVariableName = spawn.variable_name || spawn.effective_variable_name || spawn.variable_hash || 'new';
        
        if (sessionEdits) {
          const spawnEdit = sessionEdits.get(spawnId);
          if (spawnEdit) {
            // Use the edited values from the session
            spawnDisplayName = spawnEdit.displayName || spawnDisplayName;
            // For new spawns, variable_name hasn't been generated yet, so keep using display_name
          }
        }
        
        // Skip if already in nodes (e.g., as parent or current)
        if (!existingNodeIds.has(spawnId)) {
          nodes.push({
            id: spawnId,
            name: spawnDisplayName,
            hash: spawnVariableName,
            type: spawn.is_conditional_container ? 'conditional' : 'string',
            isActive: false,
            relationship: 'spawn',
          });
          existingNodeIds.add(spawnId);
        }
      });
    }
    
    // Add embedded children (only for string variables, not conditionals)
    if (!isConditional && !(stringData?.is_conditional_container)) {
      usedStringVariables.forEach((embeddedVar: any) => {
        const embeddedId = embeddedVar.id.toString();
        // Skip if already in nodes (e.g., as parent or current)
        if (!existingNodeIds.has(embeddedId)) {
          nodes.push({
            id: embeddedId,
            name: embeddedVar.display_name || '',
            hash: embeddedVar.effective_variable_name || embeddedVar.variable_hash,
            type: embeddedVar.is_conditional_container ? 'conditional' : 'string',
            isActive: false,
            relationship: 'embedded',
          });
          existingNodeIds.add(embeddedId);
        }
      });
      
      // Add pending/new embedded children
      pendingVariablesInContent.forEach((varName: string) => {
        const pendingId = `pending-${varName}`;
        // Skip if already in nodes
        if (!existingNodeIds.has(pendingId)) {
          nodes.push({
            id: pendingId,
            name: '',
            hash: varName,
            type: 'string', // Assume string for new variables
            isActive: false,
            relationship: 'embedded',
          });
          existingNodeIds.add(pendingId);
        }
      });
    }
    
    return nodes;
  };
  
  const navigationNodes = buildNavigationNodes();

  // Filter available variables for spawn selection (exclude current string and already selected spawns)
  const currentSpawnNames = conditionalSpawns.map(spawn => {
    return spawn.effective_variable_name || spawn.variable_name || spawn.variable_hash;
  });
  
  // Helper to get parent conditional name for a spawn variable
  const getParentConditionalName = (str: any): string | undefined => {
    if (!str.controlled_by_spawn_id) return undefined;
    const parent = project?.strings?.find((s: any) => s.id === str.controlled_by_spawn_id);
    return parent?.effective_variable_name || parent?.variable_name || parent?.variable_hash;
  };

  // Sort strings by most recently created (using id as proxy, higher id = more recent)
  const sortedStrings = [...(project?.strings || [])].sort((a: any, b: any) => b.id - a.id);
  
  const availableVariablesForSpawn = sortedStrings.filter((str: any) => {
    const effectiveName = str.effective_variable_name || str.variable_name || str.variable_hash;
    const matchesSearch = !existingVariableSearch || 
      effectiveName.toLowerCase().includes(existingVariableSearch.toLowerCase()) ||
      (str.content || "").toLowerCase().includes(existingVariableSearch.toLowerCase());
    return effectiveName && 
           str.id !== stringData?.id && // Exclude current string being edited
           !currentSpawnNames.includes(effectiveName) && // Exclude already selected spawns
           matchesSearch; // Filter by search (or show all if no search)
  }).map((str: any) => ({
    id: str.id,
    name: str.effective_variable_name || str.variable_name || str.variable_hash,
    content: str.content || "",
    type: str.is_conditional_container ? 'conditional' : 'string',
    isConditional: str.is_conditional_container || false,
    isSpawn: !!str.controlled_by_spawn_id,
    parentConditionalName: getParentConditionalName(str),
  }));

  // Filter available variables for embedding in string content
  // Includes spawn variables (visible but not selectable)
  const availableVariablesForEmbed = sortedStrings.filter((str: any) => {
    const effectiveName = str.effective_variable_name || str.variable_name || str.variable_hash;
    const matchesSearch = !embedVariableSearch || 
      effectiveName.toLowerCase().includes(embedVariableSearch.toLowerCase()) ||
      (str.content || "").toLowerCase().includes(embedVariableSearch.toLowerCase());
    return effectiveName && 
           str.id !== stringData?.id && // Exclude current string being edited
           matchesSearch; // Filter by search (or show all if no search)
  }).map((str: any) => ({
    id: str.id,
    name: str.effective_variable_name || str.variable_name || str.variable_hash,
    content: str.content || "",
    type: str.is_conditional_container ? 'conditional' : 'string',
    isConditional: str.is_conditional_container || false,
    isSpawn: !!str.controlled_by_spawn_id,
    parentConditionalName: getParentConditionalName(str),
  }));

  const handleSave = async () => {
    try {
      await onSave();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    }
  };

  const handleAddExistingVariable = (variableId: string) => {
    if (onAddExistingVariableAsSpawn) {
      onAddExistingVariableAsSpawn(variableId);
      setExistingVariableSearch("");
      setShowExistingVariableResults(false);
    }
  };

  // Handle embedding a variable into string content
  const handleEmbedVariable = (variableName: string) => {
    // Insert {{variableName}} at the end of content (or cursor position if we had a ref)
    const variableRef = `{{${variableName}}}`;
    const newContent = content ? `${content}${variableRef}` : variableRef;
    onContentChange(newContent);
    setEmbedVariableSearch("");
    setShowEmbedVariableResults(false);
    toast.success(`Added ${variableRef} to content`);
    
    // Return focus to content textarea so user can continue typing
    setTimeout(() => {
      if (contentTextareaRef.current) {
        contentTextareaRef.current.focus();
        // Move cursor to end of content
        const length = newContent.length;
        contentTextareaRef.current.setSelectionRange(length, length);
      }
    }, 50);
  };

  const effectiveTitle = title || (stringData ? 'Edit Variable' : 'Create Variable');
  const zIndexStyle = { zIndex: 50 + level * 10 }; // Ensure proper stacking for cascading

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side="right" 
        className="w-[1100px] max-w-[95vw] flex flex-row p-0 h-screen overflow-hidden"
        style={zIndexStyle}
      >
        {/* Navigation Sidebar */}
        <DrawerNavigation 
          nodes={navigationNodes}
          onNodeClick={(nodeId) => {
            if (onNavigateToVariable) {
              onNavigateToVariable(nodeId);
            }
          }}
          dirtyVariableIds={dirtyVariableIds}
        />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b bg-background">
            <div className="flex items-center gap-2">
              {showBackButton && onBack && (
                <Button variant="ghost" size="sm" onClick={onBack} className="mr-2">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
            <div className="flex flex-col gap-2">
                <SheetTitle className="text-lg font-semibold">
                  {effectiveTitle}
                  {level > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Level {level + 1}
                    </Badge>
                  )}
                </SheetTitle>
            
              {/* Variable Name Badge - beneath title */}
            {variableName && (
                <VariableHashBadge 
                  hash={variableName} 
                  type={stringData?.is_conditional_container ? 'conditional' : 'string'}
                />
              )}
            </div>
          </div>
          
          {/* Tabs */}
          <div className="mt-4">
            <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="dimensions">Conditions</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
                <TabsTrigger 
                  value="publishing" 
                  disabled={isConditional}
                  className={isConditional ? "opacity-50 cursor-not-allowed" : ""}
                >
                  Publishing
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </SheetHeader>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <Tabs value={activeTab} onValueChange={onTabChange} className="w-full h-full">
            
            {/* Content Tab */}
            <TabsContent value="content" className="space-y-4 h-full">
              
              {/* Variable Type Selection */}
              <div className="space-y-2">
                <Label>Variable Type</Label>
                <Select 
                  value={isConditional ? "conditional" : "string"} 
                  onValueChange={(value: string) => onTypeChange(value === "conditional")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select variable type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="conditional">Conditional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isConditional ? (
                /* Conditional Mode Content */
                <div className="space-y-4">
                  {/* Conditional Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Conditional</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage spawn string variables for this conditional
                      </p>
                    </div>
                    {onAddSpawn && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onAddSpawn}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add New Spawn
                      </Button>
                    )}
                  </div>

                  {/* Add Existing Variable as Spawn */}
                  <VariableSearchSelect
                    label="Add Existing Variable as Spawn"
                    helperText="Search and select an existing variable to add it as a spawn for this conditional"
                    searchValue={existingVariableSearch}
                    onSearchChange={setExistingVariableSearch}
                    showResults={showExistingVariableResults}
                    onShowResultsChange={setShowExistingVariableResults}
                    availableVariables={availableVariablesForSpawn}
                    onSelect={(variable) => handleAddExistingVariable(variable.id)}
                  />

                  {/* Include Hidden Option Switch */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <Label htmlFor={`includeHiddenOption-${level}`}>Include option to hide</Label>
                      <p className="text-sm text-muted-foreground">
                        Adds a "Hidden" option that makes this conditional invisible when selected
                                </p>
                              </div>
                    <Switch
                      id={`includeHiddenOption-${level}`}
                      checked={includeHiddenOption}
                      onCheckedChange={onHiddenOptionChange}
                    />
                              </div>
                          </div>
              ) : (
                /* String Mode Content */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      ref={contentTextareaRef}
                      id="content"
                      value={content}
                      onChange={(e) => onContentChange(e.target.value)}
                      placeholder="Enter string content"
                      rows={4}
                    />
                  </div>

                  {/* Embed Existing Variable */}
                  <VariableSearchSelect
                    label="Embed Existing Variable"
                    helperText="Search and select an existing variable to embed it as {{variableName}} in your content"
                    searchValue={embedVariableSearch}
                    onSearchChange={setEmbedVariableSearch}
                    showResults={showEmbedVariableResults}
                    onShowResultsChange={setShowEmbedVariableResults}
                    availableVariables={availableVariablesForEmbed}
                    onSelect={(variable) => handleEmbedVariable(variable.name)}
                  />
                          </div>
                        )}
            </TabsContent>

            {/* Conditions Tab */}
            <TabsContent value="dimensions" className="space-y-6">
              <div className="space-y-6">
                {/* Controlling Condition Section */}
                {(() => {
                  const currentVarName = stringData?.effective_variable_name || stringData?.variable_name || stringData?.variable_hash;
                  const currentStringId = stringData?.id;
                  
                  // Check if this variable is a spawn for any conditional
                  const isSpawn = currentVarName && project?.strings?.some((str: any) => {
                    if (!str.is_conditional_container) return false;
                    const conditionalName = str.effective_variable_name || str.variable_hash;
                    const dimension = project.dimensions?.find((d: any) => d.name === conditionalName);
                    return dimension?.values?.some((dv: any) => dv.value === currentVarName);
                  });

                  if (!isSpawn) return null;

                  // Build grouped spawn list for dropdown
                  const groupedSpawns: {conditionalName: string; conditionalDisplayName: string; spawns: any[]}[] = [];
                  
                  project?.strings?.forEach((str: any) => {
                    if (!str.is_conditional_container) return;
                    
                    const conditionalName = str.effective_variable_name || str.variable_hash;
                    const conditionalDisplayName = str.display_name || conditionalName;
                    const dimension = project.dimensions?.find((d: any) => d.name === conditionalName);
                    
                    if (!dimension) return;
                    
                    // Find spawns for this conditional
                    const spawns = project.strings.filter((spawnStr: any) => {
                      if (spawnStr.is_conditional_container) return false;
                      const spawnName = spawnStr.effective_variable_name || spawnStr.variable_hash;
                      return dimension.values?.some((dv: any) => dv.value === spawnName && dv.value !== "Hidden");
                    });
                    
                    if (spawns.length > 0) {
                      groupedSpawns.push({
                        conditionalName,
                        conditionalDisplayName,
                        spawns
                      });
                    }
                  });
                        
                        return (
                    <div className="space-y-4 p-4 rounded-lg border bg-card">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold">Controlling Condition</h3>
                      <p className="text-sm text-muted-foreground">
                            Link this spawn to another spawn variable. When the controlling spawn is selected, this spawn will also show.
                      </p>
                    </div>
                              <Button
                          variant={isControllingConditionEnabled ? "default" : "outline"}
                                size="sm"
                          onClick={() => {
                            setIsControllingConditionEnabled(!isControllingConditionEnabled);
                            if (isControllingConditionEnabled) {
                              // Disable - clear the selection
                              onControlledBySpawnIdChange(null);
                            }
                          }}
                        >
                          {isControllingConditionEnabled ? 'Enabled' : 'Enable'}
                              </Button>
                  </div>

                      {/* Controlling Spawn Selector */}
                      {isControllingConditionEnabled && (() => {
                        // Build flat list of spawns with parent conditional info
                        const availableControllingSpawns: any[] = [];
                        
                        groupedSpawns.forEach(group => {
                          // Add conditional as a non-selectable header
                          availableControllingSpawns.push({
                            id: `conditional-${group.conditionalName}`,
                            name: group.conditionalName,
                            content: '',
                            type: 'conditional',
                            isConditional: true,
                            isSpawn: true, // Mark as non-selectable (it's a header)
                            parentConditionalName: undefined,
                            isCurrent: false,
                            isSelected: false,
                          });
                          
                          // Add spawns under this conditional
                          group.spawns.forEach(spawn => {
                            const spawnName = spawn.effective_variable_name || spawn.variable_name || spawn.variable_hash;
                            const spawnContent = spawn.content || '';
                            // Use resolveContentToPlaintext if available
                            const resolvedContent = resolveContentToPlaintext 
                              ? resolveContentToPlaintext(spawnContent, spawn.id)
                              : spawnContent;
                            const truncatedContent = resolvedContent.length > 60 
                              ? resolvedContent.substring(0, 60) + '...' 
                              : resolvedContent;
                            
                            availableControllingSpawns.push({
                              id: spawn.id,
                              name: spawnName,
                              content: truncatedContent,
                              type: 'spawn',
                              isConditional: false,
                              isSpawn: false, // Spawns ARE selectable in this context
                              parentConditionalName: group.conditionalDisplayName,
                              isCurrent: spawn.id === currentStringId,
                              isSelected: controlledBySpawnId === spawn.id,
                            });
                          });
                        });
                        
                        // Filter by search
                        const filteredControllingSpawns = controllingSpawnSearch
                          ? availableControllingSpawns.filter(v => {
                              // Always include conditional headers if any of their spawns match
                              if (v.isConditional) {
                                // Check if any spawn in this group matches
                                const groupSpawns = availableControllingSpawns.filter(
                                  s => s.parentConditionalName === v.name && !s.isConditional
                                );
                                return groupSpawns.some(s => 
                                  s.name.toLowerCase().includes(controllingSpawnSearch.toLowerCase()) ||
                                  s.content.toLowerCase().includes(controllingSpawnSearch.toLowerCase())
                                );
                              }
                              // Filter spawns by name or content
                              return v.name.toLowerCase().includes(controllingSpawnSearch.toLowerCase()) ||
                                     v.content.toLowerCase().includes(controllingSpawnSearch.toLowerCase());
                            })
                          : availableControllingSpawns;
                        
                        return (
                          <VariableSearchSelect
                            label="Select Controlling Spawn"
                            helperText="When the selected spawn is chosen, this spawn will also be automatically selected"
                            placeholder="Search for a spawn variable..."
                            searchValue={controllingSpawnSearch}
                            onSearchChange={setControllingSpawnSearch}
                            showResults={showControllingSpawnResults}
                            onShowResultsChange={setShowControllingSpawnResults}
                            availableVariables={filteredControllingSpawns}
                            onSelect={(variable) => {
                              onControlledBySpawnIdChange(variable.id);
                              setShowControllingSpawnResults(false);
                            }}
                            maxResults={20}
                            noBorder={true}
                            showNoResultsOnEmpty={true}
                          />
                        );
                      })()}
                          </div>
                        );
                })()}

                {/* Helper Text */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    Below you will find all the conditional variables that this variable serves as a spawn for.
                  </p>
                    </div>
                    
                {/* Parent Conditional Variables List */}
                {(() => {
                  // Find all conditional variables where this string is a spawn
                  const currentVarName = stringData?.effective_variable_name || stringData?.variable_name || stringData?.variable_hash;
                  
                  if (!currentVarName || !project?.strings) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No parent conditional variables found</p>
                      </div>
                          );
                  }

                  // Find parent conditionals by checking dimension values
                  const parentConditionals = project.strings.filter((str: any) => {
                    if (!str.is_conditional_container) return false;
                    
                    // Check if this string is listed as a spawn for this conditional
                    const conditionalName = str.effective_variable_name || str.variable_hash;
                    const dimension = project.dimensions?.find((d: any) => d.name === conditionalName);
                    
                    if (!dimension) return false;
                    
                    // Check if current variable is in this dimension's values
                    return dimension.values?.some((dv: any) => dv.value === currentVarName);
                  });

                  if (parentConditionals.length === 0) {
                    return (
              <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">This variable is not currently used as a spawn for any conditional variables</p>
                  </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        Parent Conditional Variables ({parentConditionals.length})
                      </h3>
                      <div className="space-y-2">
                        {parentConditionals.map((conditional: any) => {
                          const conditionalDisplayName = conditional.display_name || conditional.effective_variable_name || conditional.variable_hash;
                          const conditionalHash = conditional.effective_variable_name || conditional.variable_hash;
                          
                          return (
                            <div 
                              key={conditional.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Folder className="h-4 w-4 text-conditional-600" />
                                <div>
                                  <p className="font-medium text-sm">{conditionalDisplayName}</p>
                                  <VariableHashBadge hash={conditionalHash} type="conditional" className="mt-1" />
                                  </div>
                                  </div>
                              <Badge variant="outline" className="bg-conditional-50 text-conditional-700 border-conditional-200">
                                Conditional
                                </Badge>
                            </div>
                          );
                        })}
                              </div>
                            </div>
                  );
                })()}
              </div>
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Variable Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => onDisplayNameChange(e.target.value)}
                    placeholder="Enter a descriptive name (e.g., Welcome Message)"
                  />
                  <p className="text-sm text-muted-foreground">
                    {displayName ? 
                      `Will create hash: {{${slugify(displayName)}}}` : 
                      "Leave empty to use random hash"
                    }
                  </p>
                </div>
                
                {stringData && (
                  <>
                  <div className="space-y-2">
                      <Label>Variable Hash (Identifier)</Label>
                      <div>
                        <VariableHashBadge 
                          hash={stringData.effective_variable_name || stringData.variable_hash} 
                          type={stringData.is_conditional_container ? 'conditional' : 'string'}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Use this identifier to reference this variable in other strings
                      </p>
                    </div>
                    
                  <div className="space-y-2">
                      <Label>Fallback Hash</Label>
                    <div className="text-sm text-muted-foreground font-mono">
                      {stringData.variable_hash}
                    </div>
                      <p className="text-sm text-muted-foreground">
                        Auto-generated 6-character backup identifier
                      </p>
                  </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* Publishing Tab - Only for non-conditional strings */}
            <TabsContent value="publishing" className="space-y-4">
              {!isConditional ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Publish to Organization Registry</Label>
                    <p className="text-sm text-muted-foreground">
                      Publishing this string will make it visible in your organization's registry. 
                      Published strings help maintain consistency across your organization by providing 
                      a reference for tone, vocabulary, and terminology.
                    </p>
                  </div>

                  <div className="p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">
                          {isPublished ? "This string is published" : "This string is not published"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {isPublished 
                            ? "This string is visible in the organization registry." 
                            : "Publish this string to add it to the organization registry."}
                        </p>
                      </div>
                      <Switch
                        checked={isPublished}
                        onCheckedChange={(checked) => onIsPublishedChange?.(checked)}
                      />
                    </div>
                  </div>

                  {isPublished && (
                    <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                      <div className="flex items-start gap-3">
                        <div className="h-5 w-5 text-green-600 mt-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-800">Published to Registry</p>
                          <p className="text-sm text-green-700 mt-1">
                            This string will appear in the organization registry with its content displayed 
                            as plaintext, including any variable placeholders.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!stringData && (
                    <div className="p-4 border border-amber-200 rounded-lg bg-amber-50">
                      <p className="text-sm text-amber-800">
                        <strong>Note:</strong> You can publish this string after saving it for the first time.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 border rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Conditional variables cannot be published to the registry. 
                    Only regular string variables can be published.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <SheetFooter className="px-6 py-4 border-t bg-background">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {/* Delete button - only show when editing an existing variable */}
              {stringData?.id && onDelete && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onDelete(stringData)}
                  disabled={isSaving}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onCancel && (
                <Button variant="outline" onClick={onCancel} disabled={isSaving}>
                  Cancel
                </Button>
              )}
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            </div>
          </div>
        </SheetFooter>
        </div> {/* Close Main Content */}
      </SheetContent>
    </Sheet>
  );
}
