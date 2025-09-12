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
import { Plus, Spool, Folder, ArrowLeft, Search, X } from "lucide-react";
import { toast } from "sonner";

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
  
  // Type and conditional state
  isConditional: boolean;
  onTypeChange: (isConditional: boolean) => void;
  
  conditionalSpawns: any[];
  onConditionalSpawnsChange: (spawns: any[]) => void;
  
  includeHiddenOption: boolean;
  onHiddenOptionChange: (include: boolean) => void;
  
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
  onRemoveSpawn?: (spawn: any, index: number) => void;
  onEditVariable?: (variableName: string) => void;
  onAddExistingVariableAsSpawn?: (variableId: string) => void;
  
  // Display options
  title?: string;
  level?: number; // For cascading drawers (0 = main, 1+ = nested)
  showBackButton?: boolean;
  onBack?: () => void;
  
  // Loading states
  isSaving?: boolean;
}

export function StringEditDrawer({
  isOpen,
  onClose,
  stringData,
  content,
  onContentChange,
  variableName,
  onVariableNameChange,
  isConditional,
  onTypeChange,
  conditionalSpawns,
  onConditionalSpawnsChange,
  includeHiddenOption,
  onHiddenOptionChange,
  activeTab,
  onTabChange,
  project,
  selectedDimensionValues,
  pendingStringVariables,
  onSave,
  onCancel,
  onAddSpawn,
  onEditSpawn,
  onRemoveSpawn,
  onEditVariable,
  onAddExistingVariableAsSpawn,
  title,
  level = 0,
  showBackButton = false,
  onBack,
  isSaving = false,
}: StringEditDrawerProps) {
  
  // State for adding existing variables as spawns
  const [existingVariableSearch, setExistingVariableSearch] = useState("");
  const [showExistingVariableResults, setShowExistingVariableResults] = useState(false);
  
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
        className="w-[800px] max-w-[90vw] flex flex-col p-0 max-h-screen overflow-hidden"
        style={zIndexStyle}
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b bg-background">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {showBackButton && onBack && (
                <Button variant="ghost" size="sm" onClick={onBack} className="mr-2">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="flex items-center gap-2">
                {isConditional ? (
                  <Folder className="h-5 w-5 text-orange-600" />
                ) : (
                  <Spool className="h-5 w-5 text-purple-600" />
                )}
                <SheetTitle className="text-lg font-semibold">
                  {effectiveTitle}
                  {level > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Level {level + 1}
                    </Badge>
                  )}
                </SheetTitle>
              </div>
            </div>
            
            {/* Variable Name Badge */}
            {variableName && (
              <Badge 
                variant="outline" 
                className={`text-xs font-mono ${
                  isConditional 
                    ? 'bg-orange-50 text-orange-700 border-orange-200' 
                    : 'bg-purple-50 text-purple-700 border-purple-200'
                }`}
              >
                {`{{${variableName}}}`}
              </Badge>
            )}
          </div>
          
          {/* Tabs */}
          <div className="mt-4">
            <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
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
                            {availableVariablesForSpawn.slice(0, 8).map((variable) => (
                              <div
                                key={variable.id}
                                className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                                onClick={() => handleAddExistingVariable(variable.id)}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  {variable.isConditional ? (
                                    <div className="flex items-center gap-1 text-orange-600 bg-orange-50 p-1 rounded border border-orange-200">
                                      <Folder className="h-3 w-3" />
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-purple-600 bg-purple-50 p-1 rounded border border-purple-200">
                                      <Spool className="h-3 w-3" />
                                    </div>
                                  )}
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs font-mono ${
                                      variable.isConditional 
                                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                                        : 'bg-purple-50 text-purple-700 border-purple-200'
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

                  {/* Include Hidden Option Checkbox */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`includeHiddenOption-${level}`}
                      checked={includeHiddenOption}
                      onChange={(e) => onHiddenOptionChange(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={`includeHiddenOption-${level}`} className="text-sm font-medium">
                      Include option to hide
                    </Label>
                    <p className="text-xs text-muted-foreground ml-2">
                      Adds a "Hidden" option that makes this conditional invisible when selected
                    </p>
                  </div>

                  {/* Spawn Variables */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Spawn Variables</Label>
                      <Badge variant="outline" className="text-xs">
                        {conditionalSpawns.length} spawn{conditionalSpawns.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    <div className="grid gap-3">
                      {conditionalSpawns.map((spawn: any, index: number) => {
                        const isTemporary = spawn._isTemporary || 
                                           spawn.id.toString().startsWith('temp-') || 
                                           (typeof spawn.id === 'number' && spawn.id > 1000000000000);
                        const isExisting = spawn._isExisting;
                        const isConditionalSpawn = spawn.is_conditional_container;
                        const spawnVariableName = spawn.effective_variable_name || spawn.variable_hash || (isTemporary ? 'new_variable' : 'unknown');
                        
                        // Determine styling based on spawn type
                        let bgClass, borderClass, iconBgClass, badgeClass, IconComponent;
                        
                        if (isTemporary) {
                          bgClass = 'bg-yellow-50/50 border-yellow-200';
                          iconBgClass = 'text-yellow-600 bg-yellow-50 border border-yellow-200';
                          badgeClass = 'bg-yellow-50 text-yellow-700 border-yellow-200';
                          IconComponent = Plus;
                        } else if (isExisting && isConditionalSpawn) {
                          bgClass = 'bg-orange-50/50 border-orange-200';
                          iconBgClass = 'text-orange-600 bg-orange-50 border border-orange-200';
                          badgeClass = 'bg-orange-50 text-orange-700 border-orange-200';
                          IconComponent = Folder;
                        } else {
                          bgClass = 'bg-purple-50/50 border-purple-200';
                          iconBgClass = 'text-purple-600 bg-purple-50 border border-purple-200';
                          badgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
                          IconComponent = Spool;
                        }
                        
                        return (
                          <div 
                            key={spawn.id || `spawn-${index}`} 
                            className={`border rounded-lg p-4 hover:bg-muted/30 transition-colors group relative ${bgClass}`}
                          >
                            {/* Main content area - clickable for editing */}
                            <div 
                              className="cursor-pointer"
                              onClick={() => onEditSpawn?.(spawn)}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`flex items-center gap-1 p-1 rounded ${iconBgClass}`}>
                                  <IconComponent className="h-3 w-3" />
                                </div>
                                <Badge variant="outline" className={`text-xs font-mono ${badgeClass}`}>
                                  {`{{${spawnVariableName}}}`}
                                </Badge>
                                {isTemporary && (
                                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                                    New variable!
                                  </Badge>
                                )}
                                {isExisting && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                                    Existing variable
                                  </Badge>
                                )}
                              </div>
                              {!isTemporary && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {spawn.content || "Empty content"}
                                </p>
                              )}
                            </div>
                            
                            {/* Remove button - visible on hover */}
                            {onRemoveSpawn && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveSpawn(spawn, index);
                                }}
                                title={`Remove spawn variable ${spawnVariableName}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {conditionalSpawns.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No spawn variables yet</p>
                        <p className="text-xs">Click "Add Spawn" to create the first spawn</p>
                      </div>
                    )}
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

                  {/* Variable Detection and Display */}
                  {(usedStringVariables.length > 0 || pendingVariablesInContent.length > 0) && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                        <span>Variables Used</span>
                        <Badge variant="secondary" className="text-xs">
                          {usedStringVariables.length + pendingVariablesInContent.length}
                        </Badge>
                      </h4>
                      
                      <div className="grid gap-3">
                        {/* Existing Variables */}
                        {usedStringVariables.map((stringVar: any) => {
                          const variableName = stringVar.effective_variable_name || stringVar.variable_hash;
                          return (
                            <div 
                              key={stringVar.id} 
                              className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => onEditVariable?.(variableName)}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                {stringVar.is_conditional_container ? (
                                  <div className="flex items-center gap-1 text-orange-600 bg-orange-50 p-1 rounded border border-orange-200">
                                    <Folder className="h-3 w-3" />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-purple-600 bg-purple-50 p-1 rounded border border-purple-200">
                                    <Spool className="h-3 w-3" />
                                  </div>
                                )}
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs font-mono ${
                                    stringVar.is_conditional_container 
                                      ? 'bg-orange-50 text-orange-700 border-orange-200'
                                      : 'bg-purple-50 text-purple-700 border-purple-200'
                                  }`}
                                >
                                  {`{{${variableName}}}`}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {stringVar.content || "Empty content"}
                              </p>
                            </div>
                          );
                        })}

                        {/* Pending Variables */}
                        {pendingVariablesInContent.map((variableName) => (
                          <div 
                            key={variableName} 
                            className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer bg-yellow-50/50 border-yellow-200"
                            onClick={() => onEditVariable?.(variableName)}
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-yellow-600 bg-yellow-50 p-1 rounded border border-yellow-200">
                                <Plus className="h-3 w-3" />
                              </div>
                              <Badge variant="outline" className="text-xs font-mono bg-yellow-50 text-yellow-700 border-yellow-200">
                                {`{{${variableName}}}`}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                                New variable!
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Dimensions Tab */}
            <TabsContent value="dimensions" className="space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Dimension management coming soon</p>
                <p className="text-xs">This will show dimension assignments and filtering options</p>
              </div>
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="variableName">Variable Name</Label>
                  <Input
                    id="variableName"
                    value={variableName}
                    onChange={(e) => onVariableNameChange(e.target.value)}
                    placeholder="Enter custom variable name (optional)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use auto-generated hash
                  </p>
                </div>
                
                {stringData && (
                  <div className="space-y-2">
                    <Label>Variable Hash</Label>
                    <div className="text-sm text-muted-foreground font-mono">
                      {stringData.variable_hash}
                    </div>
                  </div>
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
      </SheetContent>
    </Sheet>
  );
}
