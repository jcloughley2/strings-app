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
import { Plus, Spool, Folder, ArrowLeft } from "lucide-react";
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
  onEditVariable?: (variableName: string) => void;
  
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
  onEditVariable,
  title,
  level = 0,
  showBackButton = false,
  onBack,
  isSaving = false,
}: StringEditDrawerProps) {
  
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

  const handleSave = async () => {
    try {
      await onSave();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
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
                        Add Spawn
                      </Button>
                    )}
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
                      {conditionalSpawns.map((spawn: any) => {
                        const isTemporary = spawn._isTemporary || 
                                           spawn.id.toString().startsWith('temp-') || 
                                           (typeof spawn.id === 'number' && spawn.id > 1000000000000);
                        const spawnVariableName = spawn.effective_variable_name || spawn.variable_hash || (isTemporary ? 'new_variable' : 'unknown');
                        
                        return (
                          <div 
                            key={spawn.id} 
                            className={`border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer ${
                              isTemporary 
                                ? 'bg-yellow-50/50 border-yellow-200' 
                                : 'bg-purple-50/50 border-purple-200'
                            }`}
                            onClick={() => onEditSpawn?.(spawn)}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              {isTemporary ? (
                                <div className="flex items-center gap-1 text-yellow-600 bg-yellow-50 p-1 rounded border border-yellow-200">
                                  <Plus className="h-3 w-3" />
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-purple-600 bg-purple-50 p-1 rounded border border-purple-200">
                                  <Spool className="h-3 w-3" />
                                </div>
                              )}
                              <Badge variant="outline" className={`text-xs font-mono ${
                                isTemporary 
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200' 
                                  : 'bg-purple-50 text-purple-700 border-purple-200'
                              }`}>
                                {`{{${spawnVariableName}}}`}
                              </Badge>
                              {isTemporary && (
                                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                                  New variable!
                                </Badge>
                              )}
                            </div>
                            {!isTemporary && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {spawn.content || "Empty content"}
                              </p>
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
