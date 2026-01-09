"use client";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Search, X, Sparkles, Folder, Plus, Spool } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { VariableHashBadge } from "@/components/VariableHashBadge";
import { DrawerNavigation } from "@/components/DrawerNavigation";

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
}: StringEditDrawerProps) {
  
  // State for adding existing variables as spawns
  const [existingVariableSearch, setExistingVariableSearch] = useState("");
  const [showExistingVariableResults, setShowExistingVariableResults] = useState(false);
  
  // State for controlling spawn selector
  const [controllingSpawnSearch, setControllingSpawnSearch] = useState("");
  const [isControllingConditionEnabled, setIsControllingConditionEnabled] = useState(false);
  
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
  
  const availableVariablesForSpawn = project?.strings?.filter((str: any) => {
    const effectiveName = str.effective_variable_name || str.variable_name || str.variable_hash;
    return effectiveName && 
           str.id !== stringData?.id && // Exclude current string being edited
           !currentSpawnNames.includes(effectiveName) && // Exclude already selected spawns
           effectiveName.toLowerCase().includes(existingVariableSearch.toLowerCase()); // Filter by search
  }).map((str: any) => ({
    id: str.id,
    name: str.effective_variable_name || str.variable_name || str.variable_hash,
    content: str.content || "",
    type: str.is_conditional_container ? 'conditional' : 'string',
    isConditional: str.is_conditional_container || false
  })) || [];

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
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="dimensions">Conditions</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
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
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Add Existing Variable as Spawn
                    </Label>
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          value={existingVariableSearch}
                          onChange={(e) => {
                            setExistingVariableSearch(e.target.value);
                            setShowExistingVariableResults(e.target.value.length > 0);
                          }}
                          placeholder="Type to search for existing variables..."
                          className="w-full"
                          onFocus={() => setShowExistingVariableResults(existingVariableSearch.length > 0)}
                          onBlur={() => {
                            // Delay hiding to allow clicks on results
                            setTimeout(() => setShowExistingVariableResults(false), 200);
                          }}
                        />
                        
                        {/* Search Results Dropdown */}
                        {showExistingVariableResults && availableVariablesForSpawn.length > 0 && (
                          <div className="absolute top-full left-0 w-full mt-1 bg-background border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                            {availableVariablesForSpawn.slice(0, 8).map((variable: any) => (
                              <div
                                key={variable.id}
                                className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                                onClick={() => handleAddExistingVariable(variable.id)}
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
                                    className={`text-xs font-mono ${
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
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {variable.content || "No content"}
                                </p>
                              </div>
                            ))}
                            {availableVariablesForSpawn.length > 8 && (
                              <div className="p-2 text-xs text-muted-foreground text-center border-t">
                                Showing first 8 results. Type more to filter further.
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* No Results Message */}
                        {showExistingVariableResults && existingVariableSearch.length > 0 && availableVariablesForSpawn.length === 0 && (
                          <div className="absolute top-full left-0 w-full mt-1 bg-background border rounded-md shadow-lg z-50 p-3">
                            <p className="text-sm text-muted-foreground text-center">
                              No variables found matching "{existingVariableSearch}"
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        Search and select an existing variable to add it as a spawn for this conditional
                      </p>
                    </div>
                  </div>

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
                      id="content"
                      value={content}
                      onChange={(e) => onContentChange(e.target.value)}
                      placeholder="Enter string content"
                      rows={4}
                    />
                  </div>
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
                  
                  // Filter by search
                  const filteredGroups = groupedSpawns.map(group => ({
                    ...group,
                    spawns: group.spawns.filter(spawn => {
                      const spawnDisplayName = spawn.display_name || spawn.effective_variable_name || spawn.variable_hash;
                      return spawnDisplayName.toLowerCase().includes(controllingSpawnSearch.toLowerCase());
                    })
                  })).filter(group => group.spawns.length > 0);

                  return (
                    <div className="space-y-4 p-4 rounded-lg border bg-card">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold">Controlling Condition</h3>
                          <p className="text-xs text-muted-foreground">
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
                      {isControllingConditionEnabled && (
                        <div className="space-y-2">
                          <Label>Select Controlling Spawn</Label>
                          <div className="relative">
                            <Input
                              type="text"
                              placeholder="Search for a spawn variable..."
                              className="pr-10"
                              value={controllingSpawnSearch}
                              onChange={(e) => setControllingSpawnSearch(e.target.value)}
                            />
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          </div>
                          
                          {/* Grouped spawn list */}
                          <div className="max-h-[300px] overflow-y-auto border rounded-md bg-background">
                            {filteredGroups.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                No spawn variables found
                              </div>
                            ) : (
                              <div className="py-1">
                                {filteredGroups.map((group) => (
                                  <div key={group.conditionalName}>
                                    {/* Conditional Header */}
                                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0 flex items-center gap-2">
                                      <Folder className="h-3 w-3 text-conditional-600" />
                                      {group.conditionalDisplayName}
                                    </div>
                                    
                                    {/* Spawns */}
                                    {group.spawns.map((spawn) => {
                                      const spawnDisplayName = spawn.display_name || spawn.effective_variable_name || spawn.variable_hash;
                                      const isCurrentSpawn = spawn.id === currentStringId;
                                      const isSelected = controlledBySpawnId === spawn.id;
                                      
                                      return (
                                        <button
                                          key={spawn.id}
                                          disabled={isCurrentSpawn}
                                          onClick={() => {
                                            if (!isCurrentSpawn) {
                                              onControlledBySpawnIdChange(spawn.id);
                                            }
                                          }}
                                          className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors ${
                                            isCurrentSpawn
                                              ? 'text-muted-foreground bg-muted/30 cursor-not-allowed'
                                              : isSelected
                                              ? 'bg-blue-50 text-blue-900 font-medium'
                                              : 'hover:bg-muted/50'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <Spool className="h-3 w-3" />
                                            <span>{spawnDisplayName}</span>
                                          </div>
                                          {isCurrentSpawn && (
                                            <span className="text-xs text-muted-foreground">(current)</span>
                                          )}
                                          {isSelected && !isCurrentSpawn && (
                                            <span className="text-xs text-blue-600">✓ Selected</span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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
                  <p className="text-xs text-muted-foreground">
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
                      <p className="text-xs text-muted-foreground">
                        Use this identifier to reference this variable in other strings
                      </p>
                    </div>
                    
                  <div className="space-y-2">
                      <Label>Fallback Hash</Label>
                    <div className="text-sm text-muted-foreground font-mono">
                      {stringData.variable_hash}
                    </div>
                      <p className="text-xs text-muted-foreground">
                        Auto-generated 6-character backup identifier
                      </p>
                  </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <SheetFooter className="px-6 py-4 border-t bg-background">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {onCancel && (
                <Button variant="outline" onClick={onCancel} disabled={isSaving}>
                  Cancel
                </Button>
              )}
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </SheetFooter>
        </div> {/* Close Main Content */}
      </SheetContent>
    </Sheet>
  );
}
