"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";


import { Edit2, Trash2, Type, Plus, X, MoreHorizontal, Download, Upload, Copy, Folder, Spool, Signpost, ArrowLeft, Globe, Settings, EyeOff, FileText, Filter, Hash } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { StringEditDrawer } from "@/components/StringEditDrawer";
import { useStringEditDrawer } from "@/hooks/useStringEditDrawer";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPlaintextMode, setIsPlaintextMode] = useState(false);
  const [showVariableBadges, setShowVariableBadges] = useState(false);
  const [hideEmbeddedStrings, setHideEmbeddedStrings] = useState(false);
  const [stringTypeFilter, setStringTypeFilter] = useState<'all' | 'strings' | 'conditionals'>('all');
  const [showVariableNames, setShowVariableNames] = useState(true); // Show display names by default
  const [showVariableHashes, setShowVariableHashes] = useState(false); // Hide copiable hashes by default
  const [isStringDrawerOpen, setIsStringDrawerOpen] = useState(false);
  const [isCanvasSettingsOpen, setIsCanvasSettingsOpen] = useState(false);
  
  // Filter sidebar state - migrated from dimensions to direct conditional variable selection
  const [selectedConditionalSpawns, setSelectedConditionalSpawns] = useState<{[conditionalVariableName: string]: string | null}>({});
  
  // Legacy dimension state for backward compatibility during migration
  const [selectedDimensionValues, setSelectedDimensionValues] = useState<{[dimensionId: number]: string | null}>({});
  
  // Project edit/delete state
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deleteProjectDialog, setDeleteProjectDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [createDialog, setCreateDialog] = useState<null | "Variable" | "Conditional" | "String" | "Dimension">(null);
  // LEGACY: Moved to stubs section
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [stringIsConditional, setStringIsConditional] = useState(false);

  // String dimension values state - now supports multiple values per dimension
  const [stringDimensionValues, setStringDimensionValues] = useState<{[dimensionId: number]: string[]}>({});
  
  // Dimension value selector state
  const [openDimensionPopover, setOpenDimensionPopover] = useState<number | null>(null);
  const [dimensionFilterText, setDimensionFilterText] = useState<{[dimensionId: number]: string}>({});
  



  // String deletion state
  const [deleteStringDialog, setDeleteStringDialog] = useState<any>(null);

  // Legacy dimension form state - keeping for backward compatibility with existing dimension sheet
  const [dimensionName, setDimensionName] = useState("");
  const [dimensionValues, setDimensionValues] = useState<string[]>([]);
  const [newDimensionValue, setNewDimensionValue] = useState("");
  const [editingDimension, setEditingDimension] = useState<any>(null);

  // Download dialog state
  const [downloadDialog, setDownloadDialog] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);



  // String dialog tab state
  const [stringDialogTab, setStringDialogTab] = useState("content");
  const [contentSubTab, setContentSubTab] = useState<"string" | "conditional">("string");

  // Variable dialog tab state
  const [variableDialogTab, setVariableDialogTab] = useState("overview");

  // Variable dimension values state
  const [variableDimensionValues, setVariableDimensionValues] = useState<{[dimensionValueId: number]: string}>({});

  // Bulk selection state
  const [selectedStringIds, setSelectedStringIds] = useState<Set<number>>(new Set());
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);

  // Bulk selection functions
  const openBulkDeleteDialog = () => {
    setBulkDeleteDialog(true);
  };

  const closeBulkDeleteDialog = () => {
    setBulkDeleteDialog(false);
  };

  // Import strings state
  const [importDialog, setImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // LEGACY: Moved to stubs section
  const [editingConditional, setEditingConditional] = useState(false);

  // Pending string variables state - for variables detected in content but not yet created
  const [pendingStringVariables, setPendingStringVariables] = useState<{[name: string]: {content: string, is_conditional: boolean}}>({});

  // Helper function to find spawns for a conditional using dimension relationships
  const findSpawnsForConditional = (conditionalName: string) => {
    // Find the dimension for this conditional
    const dimension = project?.dimensions?.find((d: any) => d.name === conditionalName);
    
    if (dimension && dimension.values) {
      // Get all spawn variable names from dimension values
      const spawnVariableNames = dimension.values.map((dv: any) => dv.value);
      
      // Find all strings that match these spawn variable names
      // NOTE: A string can be both a spawn AND a conditional container (nested conditionals)
      return project.strings?.filter((s: any) => {
        const effectiveName = s.effective_variable_name || s.variable_hash;
        return spawnVariableNames.includes(effectiveName);
      }) || [];
    }
    
    return [];
  };

  // UNIFIED DRAWER SYSTEM - Replaces multiple old drawer systems
  const mainDrawer = useStringEditDrawer({
    project,
    selectedDimensionValues,
    pendingStringVariables,
    findSpawnsForConditional,
    onProjectUpdate: (updatedProject) => {
      setProject(sortProjectStrings(updatedProject));
    },
    onSuccess: () => {
      console.log('Main drawer saved successfully');
    },
    onCancel: () => {
      console.log('Main drawer cancelled');
    },
  });
  
  // TODO: Implement proper cascading drawer stack when needed
  // For now, using single main drawer for all editing
  
  // LEGACY STUBS: Temporary compatibility layer for legacy code
  const setCascadingDrawers = (updater: any) => {
    console.warn('Legacy setCascadingDrawers called - temporarily disabled');
  };
  
  // Legacy variables used throughout the codebase - stubbed for compatibility
  const editingString = null;
  const stringContent = "";
  const stringVariableName = "";
  const conditionalSpawns: any[] = [];
  const nestedStringContent = "";
  const nestedStringVariableName = "";
  const nestedStringIsConditional = false;
  const nestedStringConditionalMode = false;
  const nestedStringSpawns: any[] = [];
  const editingNestedString = null;
  const includeHiddenOption = false;
  
  // Missing variables from legacy code
  const drawer: any = null;
  const drawerId = "";
  const conditionalContainer: any = null;
  const isTemporary = false;
  const updatedProject: any = null;
  
  // Legacy setters - stubbed
  const setNestedStringContent = (val: string) => console.warn('Legacy setNestedStringContent called');
  const setNestedStringVariableName = (val: string) => console.warn('Legacy setNestedStringVariableName called');
  const setNestedStringIsConditional = (val: boolean) => console.warn('Legacy setNestedStringIsConditional called');
  const setEditingNestedString = (val: any) => console.warn('Legacy setEditingNestedString called');
  const setNestedStringConditionalMode = (val: boolean) => console.warn('Legacy setNestedStringConditionalMode called');
  const setNestedStringSpawns = (val: any) => console.warn('Legacy setNestedStringSpawns called');
  const setConditionalSpawns = (val: any) => console.warn('Legacy setConditionalSpawns called');
  const setStringContent = (val: string) => console.warn('Legacy setStringContent called');
  const setStringVariableName = (val: string) => console.warn('Legacy setStringVariableName called');
  const setEditingString = (val: any) => console.warn('Legacy setEditingString called');
  // Note: setPendingStringVariables and setProject are real functions, not stubbed

  // Migration and initialization - run once when project loads
  useEffect(() => {
    if (!project?.dimensions || !project?.strings) return;
    
    // Step 1: Migrate dimension selections to conditional spawn selections
    const migratedSelections: {[conditionalVariableName: string]: string | null} = {};
    
    Object.entries(selectedDimensionValues).forEach(([dimensionId, selectedValue]) => {
      if (!selectedValue) return;
      
      const dimension = project.dimensions.find((d: any) => d.id === parseInt(dimensionId));
      if (!dimension) return;
      
      // Find the conditional variable that corresponds to this dimension
      const conditionalVariable = project.strings.find((str: any) => 
        str.is_conditional_container && 
        (str.effective_variable_name === dimension.name || 
         str.variable_name === dimension.name || 
         str.variable_hash === dimension.name)
      );
      
      if (conditionalVariable) {
        const conditionalName = conditionalVariable.effective_variable_name || conditionalVariable.variable_hash;
        migratedSelections[conditionalName] = selectedValue;
      }
    });
    
    // Step 2: Initialize default selections for conditionals without selections
    const conditionalVariables = project.strings.filter((str: any) => str.is_conditional_container);
    
    conditionalVariables.forEach((conditionalVar: any) => {
      const conditionalName = conditionalVar.effective_variable_name || conditionalVar.variable_hash;
      
      // Skip if already has a migrated selection
      if (migratedSelections[conditionalName]) return;
      
      // Find spawns for this conditional
      const spawns = project.strings.filter((str: any) => 
        !str.is_conditional_container && 
        str.dimension_values?.some((dv: any) => {
          const dimension = project.dimensions?.find((d: any) => d.name === conditionalName);
          return dimension && dv.dimension === dimension.id;
        })
      );
      
      // Select the first spawn as default
      if (spawns.length > 0) {
        const firstSpawn = spawns[0];
        const spawnName = firstSpawn.effective_variable_name || firstSpawn.variable_hash;
        migratedSelections[conditionalName] = spawnName;
      }
    });
    
    // Step 3: Set all selections at once (only if we have selections to set)
    if (Object.keys(migratedSelections).length > 0) {
      setSelectedConditionalSpawns(migratedSelections);
    }
  }, [project?.id]); // Only depend on project ID to run once per project load

  // Function to process conditional variables based on selected conditional spawns
  const processConditionalVariables = (content: string): string => {
    if (!content || showVariableBadges) {
      return content;
    }

    let processedContent = content;
    const variableMatches = content.match(/{{([^}]+)}}/g) || [];

    for (const match of variableMatches) {
      const variableName = match.slice(2, -2);
      
      // Find the conditional variable
      const conditionalVariable = project?.strings?.find((str: any) => 
        str.is_conditional_container && 
        (str.effective_variable_name === variableName || 
         str.variable_name === variableName || 
         str.variable_hash === variableName)
      );

      if (conditionalVariable) {
        const conditionalName = conditionalVariable.effective_variable_name || conditionalVariable.variable_hash;
        
        // NEW: Use direct conditional spawn selection instead of dimension lookup
        const selectedSpawnName = selectedConditionalSpawns[conditionalName];
        
        if (selectedSpawnName === "Hidden") {
          // Replace with empty string if "Hidden" is selected
          const regex = new RegExp(`{{${variableName}}}`, 'g');
          processedContent = processedContent.replace(regex, '');
        } else if (selectedSpawnName) {
          // Find the spawn variable by name directly
          const spawnVariable = project?.strings?.find((str: any) =>
            str.effective_variable_name === selectedSpawnName ||
            str.variable_name === selectedSpawnName ||
            str.variable_hash === selectedSpawnName
          );
          
          if (spawnVariable) {
            const regex = new RegExp(`{{${variableName}}}`, 'g');
            // Recursively process the spawn content in case it contains other conditionals
            const spawnContent = processConditionalVariables(spawnVariable.content || '');
            processedContent = processedContent.replace(regex, spawnContent);
          }
        } else {
          // FALLBACK: Use old dimension-based logic for backward compatibility
          const dimension = project?.dimensions?.find((d: any) => d.name === variableName);
        if (dimension) {
          const selectedValue = selectedDimensionValues[dimension.id];
          
          if (selectedValue === "Hidden") {
            const regex = new RegExp(`{{${variableName}}}`, 'g');
            processedContent = processedContent.replace(regex, '');
          } else if (selectedValue) {
            const spawnVariable = project?.strings?.find((str: any) =>
              str.effective_variable_name === selectedValue ||
              str.variable_name === selectedValue ||
              str.variable_hash === selectedValue
            );
            
            if (spawnVariable) {
              const regex = new RegExp(`{{${variableName}}}`, 'g');
              const spawnContent = processConditionalVariables(spawnVariable.content || '');
              processedContent = processedContent.replace(regex, spawnContent);
              }
            }
          }
        }
      }
    }

    return processedContent;
  };

  
  // Legacy functions - stubbed (removed duplicates that are now active)
  const setIncludeHiddenOption = (val: boolean) => console.warn('Legacy setIncludeHiddenOption called');
  
  // Additional legacy state setters needed for UI functions (only stubs for missing ones)
  // All remaining functions have real useState hooks - no stubs needed
  
  // Legacy drawer system (keeping for spawn editing)
  const [drawerStack, setDrawerStack] = useState<Array<{
    id: string;
    title: string;
    component: 'string-edit' | 'spawn-edit';
    data?: any;
  }>>([]);
  const [currentDrawerLevel, setCurrentDrawerLevel] = useState(0);
  const [editingSpawn, setEditingSpawn] = useState<any>(null);

  // Conversion confirmation modal state
  const [conversionConfirmDialog, setConversionConfirmDialog] = useState(false);
  const [pendingConversionType, setPendingConversionType] = useState<'string' | 'conditional' | null>(null);

  // Handle content sub-tab changes
  useEffect(() => {
    if (contentSubTab === "conditional" && !editingConditional) {
      // Switching to variable tab - initialize conditional mode
      setEditingConditional(true);
      if (editingString && !editingString.is_conditional_container) {
        // If editing a regular string, initialize with one default spawn for conditional creation
        const defaultSpawn = {
          id: Date.now(), // Temporary ID for new spawn
          content: stringContent || "Default content",
          effective_variable_name: null, // Let backend generate hash
          variable_hash: null, // Let backend generate hash
          is_conditional_container: false
        };
        setConditionalSpawns([defaultSpawn]);
      } else if (!editingString) {
        // Creating a new conditional - start with one default spawn
        const defaultSpawn = {
          id: Date.now(), // Temporary ID for new spawn
          content: "Default content",
          effective_variable_name: null, // Let backend generate hash
          variable_hash: null, // Let backend generate hash
          is_conditional_container: false
        };
        setConditionalSpawns([defaultSpawn]);
      }
    } else if (contentSubTab === "string" && editingConditional) {
      // Switching to string tab - disable conditional mode
      setEditingConditional(false);
      setConditionalSpawns([]);
    }
  }, [contentSubTab, editingConditional, editingString, stringContent, stringVariableName]);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/projects/${id}/`)
      .then((data) => {
        setProject(sortProjectStrings(data));

      })
      .catch((err) => setError(err.message || "Failed to load project"))
      .finally(() => setLoading(false));
  }, [id]);

  // Initialize default dimension values when project loads
  useEffect(() => {
    if (project && project.dimensions) {
      const initialDimensionValues: {[dimensionId: number]: string | null} = {};
      
      project.dimensions.forEach((dimension: any) => {
        // Only set default if not already set and dimension has values
        if (selectedDimensionValues[dimension.id] === undefined && dimension.values && dimension.values.length > 0) {
          // Select the first dimension value as default
          initialDimensionValues[dimension.id] = dimension.values[0].value;
        }
      });
      
      // Only update if we have new defaults to set
      if (Object.keys(initialDimensionValues).length > 0) {
        setSelectedDimensionValues(prev => ({
          ...prev,
          ...initialDimensionValues
        }));
      }
    }
  }, [project]);

  // Auto-focus content textarea when string dialog opens
  useEffect(() => {
    if ((createDialog === "String" || editingString) && textareaRef) {
      // Small delay to ensure dialog is fully rendered
      setTimeout(() => {
        textareaRef.focus();
      }, 100);
    }
  }, [createDialog, editingString, textareaRef]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedStringIds(new Set());
  }, [selectedDimensionValues]);

  // Detect new variables in string content and add them as pending variables
  useEffect(() => {
    if (!stringContent.trim()) {
      setPendingStringVariables({});
      return;
    }

    const variableMatches = stringContent.match(/{{([^}]+)}}/g) || [];
    const variableNames = variableMatches.map(match => match.slice(2, -2));
    const uniqueVariableNames = [...new Set(variableNames)];

    // Find existing string variables
    const existingStringVariableNames = project.strings?.map((str: any) => 
      str.effective_variable_name || str.variable_name || str.variable_hash
    ).filter(Boolean) || [];

    // Find new variables that don't exist yet
    const newVariableNames = uniqueVariableNames.filter(name => 
      !existingStringVariableNames.includes(name) && name.trim() !== ''
    );

    // Update pending variables - add new ones, remove ones no longer referenced
    setPendingStringVariables(prev => {
      const newPending: {[name: string]: {content: string, is_conditional: boolean}} = {};
      
      // Add new variables as pending
      newVariableNames.forEach(variableName => {
        // Keep existing pending variable data if it exists, otherwise create empty
        newPending[variableName] = prev[variableName] || {
          content: "",  // Start with empty content
          is_conditional: false
        };
      });
      
      return newPending;
    });
  }, [stringContent, project?.strings]);

  // TODO: Re-implement cascading drawer variable detection with new hook structure

  // Helper function to sort strings by creation date (newest first)
  const sortProjectStrings = (projectData: any) => {
    if (projectData && projectData.strings) {
      projectData.strings.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || a.id);
        const dateB = new Date(b.created_at || b.id);
        return dateB.getTime() - dateA.getTime();
      });
    }
    return projectData;
  };



  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!project) return <div className="p-8 text-center">Project not found.</div>;


  // String dialog handlers
  // UNIFIED: Replace openCreateString with mainDrawer
  const openCreateString = () => {
    setPendingStringVariables({});
    setCreateDialog("String");
    mainDrawer.openCreateDrawer({
      title: 'Create String Variable',
      isConditional: false,
    });
  };

  // UNIFIED: Replace openEditString with mainDrawer
  const openEditString = (str: any) => {
    setPendingStringVariables({});
    mainDrawer.openEditDrawer(str, {
      title: 'Edit Variable',
    });
  };

  // UNIFIED: Cascading drawer functions - simplified approach
  const openCascadingDrawer = (stringData: any, level: number = 1) => {
    // For now, use the main drawer for cascading editing
    // TODO: Implement proper cascading with multiple hook instances
    mainDrawer.openEditDrawer(stringData, {
      title: `Edit Variable`,
      level,
      showBackButton: level > 0,
    });
  };
  
  const handleEditVariable = (variableName: string) => {
    // Find the variable and open in main drawer
    const stringVar = project?.strings?.find((str: any) => {
      const effectiveName = str.effective_variable_name || str.variable_name || str.variable_hash;
      return effectiveName === variableName;
    });
    
    if (stringVar) {
      openCascadingDrawer(stringVar, 1);
    } else {
      // Handle new variable creation
      const pendingVar = pendingStringVariables[variableName];
      if (pendingVar) {
        // Create temporary string data for editing
        const tempStringData = {
          id: `temp-${Date.now()}`,
          content: pendingVar.content || '',
          variable_name: null,
          variable_hash: variableName,
          effective_variable_name: variableName,
          is_conditional: pendingVar.is_conditional,
          is_conditional_container: false,
          _isTemporary: true,
        };
        
        openCascadingDrawer(tempStringData, 1);
      }
    }
  };
  
  const handleEditSpawn = (spawn: any) => {
    openCascadingDrawer(spawn, 1);
  };
  
  const handleBackButton = (drawerId: string) => {
    // For simplified approach, just close the main drawer
    mainDrawer.closeDrawer();
  };

  const closeStringDialog = async () => {
    // Create any remaining pending string variables that weren't created by clicking
    try {
      const remainingPendingVariables = Object.entries(pendingStringVariables);
      if (remainingPendingVariables.length > 0) {
        for (const [variableName, variableData] of remainingPendingVariables) {
          try {
            await apiFetch('/api/strings/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: variableData.content,
                variable_name: variableName,
                is_conditional: variableData.is_conditional,
                project: id,
              }),
            });
          } catch (err) {

          }
        }
        
        // Refresh project data to include new string variables
        const updatedProject = await apiFetch(`/api/projects/${id}/`);
        setProject(sortProjectStrings(updatedProject));
      }
    } catch (err) {

    }
    
    // Clear dialog state
    setCreateDialog(null);
    setEditingString(null);
    setStringContent("");
    setSelectedText("");
    setSelectionStart(0);
    setSelectionEnd(0);
    setStringVariableName("");
    setStringIsConditional(false);
    setStringDimensionValues({});
    setOpenDimensionPopover(null);
    setDimensionFilterText({});
    setStringDialogTab("content");
    setContentSubTab("string");
    setPendingStringVariables({});
    setIncludeHiddenOption(false); // Reset hidden option checkbox
    setEditingConditional(false);
    setConditionalSpawns([]);
    setIsStringDrawerOpen(false);
    
    // Reset drawer stack
    setDrawerStack([]);
    setCurrentDrawerLevel(0);
    setEditingSpawn(null);
  };

  // Conversion handler
  const handleConversion = async () => {
    if (!editingString || !pendingConversionType) return;

    try {
      if (pendingConversionType === 'string') {
        // Converting conditional to normal string
        // Use the content of the first spawn or a default message
        let newContent = stringContent;
        if (conditionalSpawns.length > 0) {
          newContent = conditionalSpawns[0].content || stringContent;
        }
        
        // Update the main string to be a normal string
        await apiFetch(`/api/strings/${editingString.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: newContent,
            variable_name: stringVariableName,
            is_conditional: stringIsConditional,
            is_conditional_container: false,
          }),
        });

        // Delete all spawn strings
        for (const spawn of conditionalSpawns) {
          if (spawn.id !== editingString.id) { // Don't delete the main string
            try {
              await apiFetch(`/api/strings/${spawn.id}/`, {
                method: 'DELETE',
              });
            } catch (err) {

            }
          }
        }

        // Update local state
        setStringContent(newContent);
        setEditingConditional(false);
        setConditionalSpawns([]);
        
        toast.success('Converted to normal string successfully');
      } else {
        // Converting normal string to conditional
        // Create a default spawn with the current content
        const conditionalName = stringVariableName || editingString.effective_variable_name || editingString.variable_hash;
        const firstSpawnName = `${conditionalName}_1`;
        
        // Create the first spawn
        const spawnResponse = await apiFetch('/api/strings/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: stringContent,
            variable_name: firstSpawnName,
            is_conditional: stringIsConditional,
            project: id,
            is_conditional_container: false,
          }),
        });

        // Update the main string to be a conditional
        await apiFetch(`/api/strings/${editingString.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `[Conditional: ${conditionalName}]`,
            variable_name: stringVariableName,
            is_conditional: false, // Split variables themselves are not conditional
            is_conditional_container: true,
          }),
        });

        // Update local state
        setEditingConditional(true);
        setConditionalSpawns([spawnResponse]);
        
        toast.success('Converted to conditional successfully');
      }

      // Refresh project data
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(updatedProject));

      // Close confirmation dialog
      setConversionConfirmDialog(false);
      setPendingConversionType(null);

    } catch (error) {

      toast.error('Failed to convert string. Please try again.');
    }
  };

  // Nested drawer management functions
  const pushDrawer = (id: string, title: string, component: 'string-edit' | 'spawn-edit', data?: any) => {
    setDrawerStack(prev => [...prev, { id, title, component, data }]);
    setCurrentDrawerLevel(prev => prev + 1);
  };

  const popDrawer = () => {
    if (currentDrawerLevel > 0) {
      setDrawerStack(prev => prev.slice(0, -1));
      setCurrentDrawerLevel(prev => prev - 1);
      if (currentDrawerLevel === 1) {
        setEditingSpawn(null);
      }
    }
  };

  const getCurrentDrawer = () => {
    if (drawerStack.length === 0) return null;
    return drawerStack[drawerStack.length - 1];
  };

  // Spawn editing handlers
  const openEditSpawn = (spawn: any) => {
    // Set up spawn as if it's a regular string being edited
    setEditingSpawn(spawn);
    
    // Set up all string editing state for the spawn
    setStringContent(spawn.content || '');
    setStringVariableName(spawn.effective_variable_name || spawn.variable_hash || spawn.variable_name || '');
    setStringIsConditional(spawn.is_conditional || false);
    setStringDialogTab("content");
    setContentSubTab("string");
    setPendingStringVariables({});
    
    // Populate dimension values for the spawn
    const dimensionValues: {[dimensionId: number]: string[]} = {};
    if (spawn.dimension_values) {
      spawn.dimension_values.forEach((dv: any) => {
        // Safety check for dimension_value structure
        if (!dv.dimension_value || !dv.dimension_value.dimension) {
          return;
        }
        const dimensionId = dv.dimension_value.dimension;
        if (!dimensionValues[dimensionId]) {
          dimensionValues[dimensionId] = [];
        }
        dimensionValues[dimensionId].push(dv.dimension_value.value);
      });
    }
    setStringDimensionValues(dimensionValues);
    
    pushDrawer(
      `spawn-${spawn.id}`,
      `Edit Spawn: ${spawn.effective_variable_name || spawn.variable_hash || 'New Spawn'}`,
      'spawn-edit',
      spawn
    );
  };

  // Cascading drawer functions
  const openEditInCascadingDrawer = (str: any) => {
        // Check if this should be a conditional container but isn't marked as one
    if (!str.is_conditional_container && str.is_conditional) {
      const conditionalName = str.effective_variable_name || str.variable_hash;
      const potentialSpawns = findSpawnsForConditional(conditionalName);
      
      if (potentialSpawns.length > 0) {
        // Auto-repair: mark as conditional container since it has spawns
        str.is_conditional_container = true;
        
        // Save the fix to the database
        apiFetch(`/api/strings/${str.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            is_conditional_container: true
          }),
        }).catch(err => {});
      }
    }
    
    // Open the unified drawer for editing
    mainDrawer.openEditDrawer(str);
  };

  // LEGACY: Temporarily commented out - causing compilation errors
  const closeCascadingDrawer = async (drawerId: string, skipAutoSave = false) => {
    console.warn('Legacy closeCascadingDrawer called - temporarily disabled');
  };

  // LEGACY: Temporarily commented out - causing compilation errors
  const updateCascadingDrawer = (drawerId: string, updates: any) => {
    console.warn('Legacy updateCascadingDrawer called - temporarily disabled');
  };

  // OLD: Legacy saveCascadingDrawer function - replaced by unified system
  const saveCascadingDrawer = async (drawerId: string) => {
    // This function is no longer used with the unified drawer system
    console.warn('Legacy saveCascadingDrawer called - should use unified system');
    return;
  };

  // Legacy nested string editing handlers (keeping for backward compatibility)
  const openEditNestedString = (str: any) => {
    // Now redirect to cascading drawer system
    openEditInCascadingDrawer(str);
  };

  const closeNestedStringDialog = () => {
    // Legacy function - now using unified drawer system
    console.warn('Legacy closeNestedStringDialog called');
  };

  /* LEGACY CODE COMMENTED OUT - CAUSING COMPILATION ERRORS
  
  // Large section of legacy drawer code temporarily commented out
  // This section contains functions with undefined variables like 'drawer', 'conditionalContainer', etc.
  // Will be cleaned up after unified system is confirmed working
  
  */

  // Additional legacy functions that need to be cleaned up later
  const createAndEditPendingVariable = (variableName: string) => {
    console.warn('Legacy createAndEditPendingVariable called');
  };

  const handleNestedStringSubmit = async (e: React.FormEvent) => {
    console.warn('Legacy handleNestedStringSubmit called');
  };

  // Main render section
  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!project) return <div className="p-8 text-center">Project not found.</div>;

  // Helper function to detect which strings are embedded in other strings
  const getEmbeddedStringIds = () => {
    if (!project?.strings) return new Set<number>();
    
    const embeddedIds = new Set<number>();
    
    // Method 1: Check each string's content for variable references {{variableName}}
    project.strings.forEach((str: any) => {
      if (str.content) {
        // Find all variable references in the format {{variableName}}
        const variableMatches = str.content.match(/{{([^}]+)}}/g) || [];
        
        variableMatches.forEach((match: string) => {
          const variableName = match.slice(2, -2); // Remove {{ and }}
          
          // Find the string that matches this variable name
          const referencedString = project.strings.find((s: any) => 
            s.effective_variable_name === variableName ||
            s.variable_name === variableName ||
            s.variable_hash === variableName
          );
          
          if (referencedString) {
            embeddedIds.add(referencedString.id);
          }
        });
      }
    });
    
    // Method 2: Check for spawn variables (strings used as spawns for conditional variables)
    if (project?.dimensions) {
      project.dimensions.forEach((dimension: any) => {
        if (dimension.values) {
          dimension.values.forEach((dimensionValue: any) => {
            // Find strings that match this dimension value (spawn variables)
            const spawnString = project.strings.find((s: any) => 
              s.effective_variable_name === dimensionValue.value ||
              s.variable_name === dimensionValue.value ||
              s.variable_hash === dimensionValue.value
            );
            
            if (spawnString && !spawnString.is_conditional_container) {
              embeddedIds.add(spawnString.id);
            }
          });
        }
      });
    }
    
    return embeddedIds;
  };

  // Show all strings with optional filtering for embedded strings and string type
  const allStrings = project?.strings || [];
  const embeddedStringIds = hideEmbeddedStrings ? getEmbeddedStringIds() : new Set<number>();
  
  let filteredStrings = allStrings;
  
  // Apply embedded strings filter
  if (hideEmbeddedStrings) {
    filteredStrings = filteredStrings.filter((str: any) => !embeddedStringIds.has(str.id));
  }
  
  // Apply string type filter
  if (stringTypeFilter === 'strings') {
    filteredStrings = filteredStrings.filter((str: any) => !str.is_conditional_container);
  } else if (stringTypeFilter === 'conditionals') {
    filteredStrings = filteredStrings.filter((str: any) => str.is_conditional_container);
  }
  // 'all' shows both types, so no additional filtering needed

  // Bulk selection helper functions
  const handleSelectString = (stringId: number, checked: boolean) => {
    setSelectedStringIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(stringId);
      } else {
        newSet.delete(stringId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allFilteredIds = new Set<number>(filteredStrings.map((str: any) => str.id));
      setSelectedStringIds(allFilteredIds);
    } else {
      setSelectedStringIds(new Set());
    }
  };

  const handleDeselectAll = () => {
    setSelectedStringIds(new Set());
  };

  const isAllSelected = filteredStrings.length > 0 && filteredStrings.every((str: any) => selectedStringIds.has(str.id));
  const isIndeterminate = selectedStringIds.size > 0 && !isAllSelected;

  // Helper function to get alternating purple shades based on nesting depth
  const getPurpleShadeForDepth = (depth: number) => {
    // Use modulo to cycle through 3 distinct purple shades for better visual distinction
    const shadeIndex = depth % 3;
    
    switch (shadeIndex) {
      case 0:
        return {
          background: 'bg-purple-50',
          text: 'text-purple-800',
          hover: 'hover:bg-purple-100',
          border: 'border-purple-200'
        };
      case 1:
        return {
          background: 'bg-purple-100', 
          text: 'text-purple-900',
          hover: 'hover:bg-purple-200',
          border: 'border-purple-300'
        };
      case 2:
        return {
          background: 'bg-purple-200',
          text: 'text-purple-950',
          hover: 'hover:bg-purple-300', 
          border: 'border-purple-400'
        };
      default:
        return {
          background: 'bg-purple-50',
          text: 'text-purple-800', 
          hover: 'hover:bg-purple-100',
          border: 'border-purple-200'
        };
    }
  };

  // Function to resolve conditional content based on conditional spawn selection
  const resolveConditionalContent = (conditionalVariable: any, variableName: string, depth: number = 0): (string | React.ReactNode)[] => {
    const conditionalName = conditionalVariable.effective_variable_name || conditionalVariable.variable_hash;
    
    // Simple throttling to prevent excessive logging
    const now = Date.now();
    const lastLogKey = `resolve-${conditionalName}`;
    if (!window.lastResolveLog) window.lastResolveLog = {};
    const shouldLog = !window.lastResolveLog[lastLogKey] || (now - window.lastResolveLog[lastLogKey]) > 1000;
    if (shouldLog) window.lastResolveLog[lastLogKey] = now;
    
    // NEW: Get selected spawn directly from conditional spawn selection
    let selectedValue = selectedConditionalSpawns[conditionalName];
    
    // Find the dimension for this conditional (needed for spawn lookup)
    const dimension = project?.dimensions?.find((d: any) => d.name === conditionalName);
    
    // FALLBACK: If no direct selection, try dimension-based approach for backward compatibility
    if (!selectedValue && dimension) {
      selectedValue = selectedDimensionValues[dimension.id];
    }
    
    if (!selectedValue) {
      return ["empty"];
    }
    
    // Check for "Hidden" option
    if (selectedValue === "Hidden") {
      return ["hidden"];
    }
    
    // Find available spawns for this conditional using dimension_values relationship
    const spawns = dimension ? project?.strings?.filter((str: any) => 
      !str.is_conditional_container && 
      str.dimension_values?.some((dv: any) => dv.dimension === dimension.id)
    ) || [] : [];
    
    if (shouldLog) {
      console.log(`🔍 Spawn detection for ${conditionalName}:`);
      console.log('  - Dimension ID:', dimension?.id);
      console.log('  - Spawns found via dimension_values:', spawns.length);
      console.log('  - All project strings:', project?.strings?.length);
      console.log('  - Non-conditional strings:', project?.strings?.filter((s: any) => !s.is_conditional_container).length);
    }
    
    if (spawns.length > 0) {
      if (shouldLog) {
        console.log('  - Found spawns:', spawns.map(s => ({
          name: s.effective_variable_name || s.variable_hash,
          id: s.id,
          hasDimensionValues: !!s.dimension_values,
          dimensionValuesCount: s.dimension_values?.length || 0
        })));
      }
    } else {
      // If no spawns found via dimension_values, try fallback method for debugging
      const dimensionValueNames = dimension.values?.map((dv: any) => dv.value) || [];
      const fallbackSpawns = project?.strings?.filter((str: any) => 
        !str.is_conditional_container && 
        dimensionValueNames.includes(str.effective_variable_name || str.variable_hash)
      ) || [];
      
      if (shouldLog) {
        console.log('  - Dimension value names:', dimensionValueNames);
        console.log('  - Fallback spawns found:', fallbackSpawns.length);
        if (fallbackSpawns.length > 0) {
          console.log('  - Fallback spawn names:', fallbackSpawns.map(s => s.effective_variable_name || s.variable_hash));
          console.log('  - Sample fallback spawn dimension_values:', fallbackSpawns[0]?.dimension_values);
        }
      }
      
      // For now, use the fallback method if it finds spawns
      if (fallbackSpawns.length > 0) {
        if (shouldLog) console.log('  - Using fallback spawns since main method found none');
        
        // Temporarily use fallback spawns with the same logic as the main path
        let activeSpawn = null;
        if (selectedValue) {
          activeSpawn = fallbackSpawns.find((spawn: any) => {
            const spawnName = spawn.effective_variable_name || spawn.variable_hash;
            return spawnName === selectedValue;
          });
        }
        
        if (!activeSpawn && fallbackSpawns.length > 0) {
          activeSpawn = fallbackSpawns[0];
        }
        
        if (activeSpawn) {
          // Render the active spawn as a styled variable (same logic as main path)
          const spawnName = activeSpawn.effective_variable_name || activeSpawn.variable_hash;
          
          if (activeSpawn.is_conditional_container) {
            // If spawn is also a conditional, render it as orange nested conditional
            const nestedSpawnContent = resolveConditionalContent(activeSpawn, spawnName, depth + 1);
            return [
              <span
                key={`fallback-spawn-${conditionalName}-${spawnName}`}
                className="cursor-pointer transition-colors bg-orange-50 text-orange-800 px-1 py-0.5 rounded inline-block hover:bg-orange-100 border border-orange-200 ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditInCascadingDrawer(activeSpawn);
                }}
                title={`Click to edit nested conditional "${spawnName}"`}
              >
                {nestedSpawnContent}
              </span>
            ];
          } else {
            // For string variable spawns, render as purple styled variable with its content
            const purpleShade = getPurpleShadeForDepth(depth + 1);
            
            // If the spawn has content, render it recursively; otherwise show the variable name
            let spawnDisplayContent;
            if (activeSpawn.content && activeSpawn.content.trim() !== '') {
              // Recursively render the spawn's content to handle any nested variables
              const renderedContent = renderContentRecursively(activeSpawn.content, depth + 1, `fallback-spawn-${conditionalName}-`);
              spawnDisplayContent = renderedContent;
            } else {
              // If no content, show the variable name as fallback
              spawnDisplayContent = [spawnName];
            }
            
            return [
              <span
                key={`fallback-spawn-${conditionalName}-${spawnName}`}
                className={`cursor-pointer transition-colors ${purpleShade.background} ${purpleShade.text} px-1 py-0.5 rounded inline-block ${purpleShade.hover} ${purpleShade.border} border ml-1`}
                onClick={(e) => {
                  e.stopPropagation();
                  openEditInCascadingDrawer(activeSpawn);
                }}
                title={`Click to edit string variable "${spawnName}" (spawn of ${conditionalName})`}
              >
                {spawnDisplayContent}
              </span>
            ];
          }
        }
      }
      
      return ["empty"];
    }
    
    // Find the active spawn based on selected dimension value
    let activeSpawn = null;
    if (selectedValue) {
      activeSpawn = spawns.find((spawn: any) => {
        const spawnName = spawn.effective_variable_name || spawn.variable_hash;
        return spawnName === selectedValue;
      });
    }
    
    // If no specific selection, use the first spawn as default
    if (!activeSpawn && spawns.length > 0) {
      activeSpawn = spawns[0];
    }
    
    if (!activeSpawn) {
      return ["empty"];
    }

    // Render the active spawn as a styled variable (not its content)
    const spawnName = activeSpawn.effective_variable_name || activeSpawn.variable_hash;
    
    if (activeSpawn.is_conditional_container) {
      // If spawn is also a conditional, render it as orange nested conditional
      const nestedSpawnContent = resolveConditionalContent(activeSpawn, spawnName, depth + 1);
      return [
        <span
          key={`spawn-${conditionalName}-${spawnName}`}
          className="cursor-pointer transition-colors bg-orange-50 text-orange-800 px-1 py-0.5 rounded inline-block hover:bg-orange-100 border border-orange-200 ml-1"
          onClick={(e) => {
            e.stopPropagation();
            // Find the openEditInCascadingDrawer function from the parent scope
            const openEdit = (window as any).openEditInCascadingDrawer;
            if (openEdit) openEdit(activeSpawn);
          }}
          title={`Click to edit nested conditional "${spawnName}"`}
        >
          {nestedSpawnContent}
        </span>
      ];
    } else {
      // For string variable spawns, render as purple styled variable with its content
      const purpleShade = getPurpleShadeForDepth(depth + 1);
      
      // If the spawn has content, render it recursively; otherwise show the variable name
      let spawnDisplayContent;
      if (activeSpawn.content && activeSpawn.content.trim() !== '') {
        // Recursively render the spawn's content to handle any nested variables
        const renderedContent = renderContentRecursively(activeSpawn.content, depth + 1, `spawn-${conditionalName}-`);
        spawnDisplayContent = renderedContent;
      } else {
        // If no content, show the variable name as fallback
        spawnDisplayContent = [spawnName];
      }
      
      return [
        <span
          key={`spawn-${conditionalName}-${spawnName}`}
          className={`cursor-pointer transition-colors ${purpleShade.background} ${purpleShade.text} px-1 py-0.5 rounded inline-block ${purpleShade.hover} ${purpleShade.border} border ml-1`}
          onClick={(e) => {
            e.stopPropagation();
            openEditInCascadingDrawer(activeSpawn);
          }}
          title={`Click to edit string variable "${spawnName}" (spawn of ${conditionalName})`}
        >
          {spawnDisplayContent}
        </span>
      ];
    }
  };

  // Recursive function to render content with proper variable substitution and styling
  const renderContentRecursively = (content: string, depth: number = 0, keyPrefix: string = ""): (string | React.ReactNode)[] => {
    // Prevent infinite recursion
    if (depth > 10) {
      return [content];
    }
    
    if (isPlaintextMode) {
      // Plaintext Mode: Show variable content without any styling, hide conditionals with "hidden" or no spawns
      console.log(`🔄 PLAINTEXT MODE: Processing content: "${content}"`);
      const variablePattern = /\{\{([^}]+)\}\}/g;
      let finalContent = content;
      
      // Process all variables (both string and conditional)
      const variableMatches = finalContent.match(variablePattern) || [];
      
      variableMatches.forEach((match) => {
        const variableName = match.slice(2, -2);
        
        const stringVariable = project?.strings?.find((str: any) => 
          str.variable_name === variableName || 
          str.variable_hash === variableName || 
          str.effective_variable_name === variableName
        );
        
        console.log(`🔍 Plaintext processing variable: ${variableName}`, {
          match,
          stringVariable: stringVariable ? {
            id: stringVariable.id,
            is_conditional_container: stringVariable.is_conditional_container,
            effective_variable_name: stringVariable.effective_variable_name,
            variable_hash: stringVariable.variable_hash
          } : null
        });
        
        if (stringVariable) {
          if (stringVariable.is_conditional_container) {
            // Handle conditional variables in plaintext mode
            const conditionalName = stringVariable.effective_variable_name || stringVariable.variable_hash;
            
            // NEW: Use selectedConditionalSpawns instead of selectedDimensionValues
            const selectedSpawnName = selectedConditionalSpawns[conditionalName];
            
            console.log(`🎯 Processing conditional: ${conditionalName}`, {
              selectedSpawnName,
              selectedConditionalSpawns
            });
            
            // If "Hidden" is selected, remove completely in plaintext mode
            if (selectedSpawnName === "Hidden") {
              console.log(`❌ Hidden selected for ${conditionalName}, removing`);
              finalContent = finalContent.replace(match, '');
              return;
            }
            
            // Find spawns for this conditional using the same method as filter sidebar
            const dimension = project?.dimensions?.find((d: any) => d.name === conditionalName);
            
            // Method 1: Use dimension_values relationship (existing spawns)
            const spawnsViaDimension = dimension ? project?.strings?.filter((str: any) => 
              !str.is_conditional_container && 
              str.dimension_values?.some((dv: any) => dv.dimension === dimension.id)
            ) || [] : [];
            
            // Method 2: Find spawns by naming pattern (fallback for newly created spawns)
            const spawnsByPattern = project?.strings?.filter((str: any) => {
              if (str.is_conditional_container) return false;
              const strName = str.effective_variable_name || str.variable_hash;
              // Check if this string name appears as a dimension value for this conditional
              return dimension?.values?.some((dv: any) => dv.value === strName);
            }) || [];
            
            // Combine both methods and remove duplicates
            const allSpawns = [...spawnsViaDimension, ...spawnsByPattern];
            const spawns = allSpawns.filter((spawn, index, self) => 
              index === self.findIndex(s => s.id === spawn.id)
            );
            
            console.log(`🔍 Found spawns for ${conditionalName}:`, {
              dimension: dimension ? { id: dimension.id, name: dimension.name } : null,
              spawnsCount: spawns.length,
              spawns: spawns.map(s => ({
                id: s.id,
                effective_variable_name: s.effective_variable_name,
                variable_hash: s.variable_hash,
                content: s.content?.substring(0, 50) + '...'
              }))
            });
            
            if (spawns.length === 0) {
              // No spawns, remove completely
              console.log(`❌ No spawns found for ${conditionalName}, removing`);
              finalContent = finalContent.replace(match, '');
              return;
            }
            
            // Find active spawn using selectedConditionalSpawns
            let activeSpawn = null;
            if (selectedSpawnName) {
              activeSpawn = spawns.find((spawn: any) => {
                const spawnName = spawn.effective_variable_name || spawn.variable_name || spawn.variable_hash;
                return spawnName === selectedSpawnName;
              });
            }
            
            if (!activeSpawn && spawns.length > 0) {
              activeSpawn = spawns[0];
            }
            
            console.log(`🎯 Active spawn for ${conditionalName}:`, {
              selectedSpawnName,
              activeSpawn: activeSpawn ? {
                id: activeSpawn.id,
                effective_variable_name: activeSpawn.effective_variable_name,
                variable_hash: activeSpawn.variable_hash,
                content: activeSpawn.content
              } : null
            });
            
            if (activeSpawn && activeSpawn.content) {
              // Replace with spawn content (recursively processed)
              const spawnContent = renderContentRecursively(activeSpawn.content, depth + 1, `${keyPrefix}${variableName}-`);
              const contentString = spawnContent.map(part => typeof part === 'string' ? part : '').join('');
              console.log(`✅ Replacing ${match} with: "${contentString}"`);
              finalContent = finalContent.replace(match, contentString);
            } else {
              // Empty spawn content, remove completely
              console.log(`❌ No active spawn content for ${conditionalName}, removing`);
              finalContent = finalContent.replace(match, '');
            }
          } else {
            // Handle string variables
            if (stringVariable.content && stringVariable.content.trim() !== '') {
              // Recursively process the string variable's content (plaintext)
              const expandedContent = renderContentRecursively(stringVariable.content, depth + 1, `${keyPrefix}${variableName}-`);
              // Convert React nodes back to string for text replacement
              const contentString = expandedContent.map(part => typeof part === 'string' ? part : `{{${variableName}}}`).join('');
              finalContent = finalContent.replace(match, contentString);
            }
          }
        }
      });
      
      return [finalContent];
    } else if (showVariableBadges) {
      // Show Variables Mode: Display all variables as styled badges with identifiers
      const parts = content.split(/({{[^}]+}})/);
      return parts.map((part: string, index: number) => {
        if (part.match(/{{[^}]+}}/)) {
          const variableName = part.slice(2, -2); // Remove {{ and }}
          const stringVariable = project?.strings?.find((str: any) => 
            str.effective_variable_name === variableName || 
            str.variable_name === variableName || 
            str.variable_hash === variableName
          );
          
          if (stringVariable?.is_conditional_container) {
            // Orange badge for conditional variables
            return (
              <Badge
                key={`${keyPrefix}${depth}-${index}-${variableName}`}
                variant="outline"
                className="mx-1 cursor-pointer transition-colors bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 inline-flex items-center gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditInCascadingDrawer(stringVariable);
                }}
                title={`Click to edit conditional "${variableName}"`}
              >
                <Folder className="h-3 w-3" />
                {part}
              </Badge>
            );
          } else if (stringVariable) {
            // Purple badge for string variables with alternating shades
            const purpleShade = getPurpleShadeForDepth(depth);
            return (
              <Badge
                key={`${keyPrefix}${depth}-${index}-${variableName}`}
                variant="outline"
                className={`mx-1 cursor-pointer transition-colors ${purpleShade.background} ${purpleShade.text} ${purpleShade.border} ${purpleShade.hover} inline-flex items-center gap-1`}
                onClick={(e) => {
                  e.stopPropagation();
                  openEditInCascadingDrawer(stringVariable);
                }}
                title={`Click to edit string variable "${variableName}" (nesting level ${depth})`}
              >
                <Spool className="h-3 w-3" />
                {part}
              </Badge>
            );
          } else {
            // Variable not found, show as gray badge
            return (
              <Badge
                key={`${keyPrefix}${depth}-${index}-${variableName}`}
                variant="outline"
                className="mx-1 bg-gray-50 text-gray-700 border-gray-200"
                title={`Variable "${variableName}" not found`}
              >
                {part}
              </Badge>
            );
          }
        }
        return part;
      });
    } else {
      // Normal Mode: Show variable content with styled backgrounds
      const parts = content.split(/({{[^}]+}})/);
      const result: (string | React.ReactNode)[] = [];
      
      parts.forEach((part: string, index: number) => {
        if (part.match(/{{[^}]+}}/)) {
          const variableName = part.slice(2, -2); // Remove {{ and }}
          const stringVariable = project?.strings?.find((str: any) => 
            str.effective_variable_name === variableName || 
            str.variable_name === variableName || 
            str.variable_hash === variableName
          );
          
          if (stringVariable) {
            if (stringVariable.is_conditional_container) {
              // Conditional variables: Show with orange background containing spawn content
              const spawnContent = resolveConditionalContent(stringVariable, variableName, depth);
              
              result.push(
                <span
                  key={`${keyPrefix}${depth}-${index}-${variableName}`}
                  className="cursor-pointer transition-colors bg-orange-50 text-orange-800 px-1 py-0.5 rounded inline-block hover:bg-orange-100 border border-orange-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditInCascadingDrawer(stringVariable);
                  }}
                  title={`Click to edit conditional variable "${variableName}"`}
                >
                  {spawnContent}
                </span>
              );
            } else {
              // For regular string variables, show their content with purple background styling
              if (!stringVariable.content || stringVariable.content.trim() === '') {
                // For empty string variables, show as plain text
                result.push(part);
              } else {
                // For string variables with content, render with alternating purple background based on depth
                const nestedParts = renderContentRecursively(stringVariable.content, depth + 1, `${keyPrefix}${variableName}-`);
                const purpleShade = getPurpleShadeForDepth(depth);
                result.push(
                  <span
                    key={`${keyPrefix}${depth}-${index}-${variableName}`}
                    className={`cursor-pointer transition-colors ${purpleShade.background} ${purpleShade.text} px-1 py-0.5 rounded inline-block ${purpleShade.hover} border ${purpleShade.border}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditInCascadingDrawer(stringVariable);
                    }}
                    title={`Click to edit string variable "${variableName}" (nesting level ${depth})`}
                  >
                    {nestedParts}
                  </span>
                );
              }
            }
          } else {
            // Variable not found, show as-is
            result.push(part);
          }
        } else {
          result.push(part);
        }
      });
      
      return result;
    }
  };

  // Function to render content with badge styling for variables
  const renderStyledContent = (content: string, stringVariables: any[], stringId?: string) => {
    return renderContentRecursively(content, 0, stringId ? `str-${stringId}-` : "");
  };

  // Handle text selection in textarea
  const handleTextSelection = () => {
    if (!textareaRef) return;
    
    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    const selected = textareaRef.value ? textareaRef.value.substring(start, end) : "";
    
    setSelectedText(selected);
    // Note: setSelectionStart and setSelectionEnd might be legacy - stubbing for now
    console.log('Text selected:', selected, 'from', start, 'to', end);
  };

  // Legacy string submit handler - replaced by unified drawer system
  const handleStringSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.warn('Legacy handleStringSubmit called - this should use the unified drawer system instead');
    // The unified drawer system has its own save logic in stringOperations.ts
    // This stub prevents runtime errors for any remaining legacy UI elements
  };



  // Clear selection
  const clearSelection = () => {
    setSelectedStringIds(new Set());
  };

  // Handle bulk deletion of selected strings
  const handleBulkDelete = async () => {
    if (selectedStringIds.size === 0) return;

    const totalCount = selectedStringIds.size;
    let successCount = 0;
    let failureCount = 0;
    const failedStrings: { id: string; error: string }[] = [];

    try {
      // Process deletions sequentially to avoid dependency conflicts
      for (const stringId of Array.from(selectedStringIds)) {
        try {
          await apiFetch(`/api/strings/${stringId}/`, {
            method: 'DELETE',
          });
          
          successCount++;
        } catch (fetchError) {
          failedStrings.push({ 
            id: String(stringId), 
            error: fetchError instanceof Error ? fetchError.message : 'Network error'
          });
          failureCount++;
        }
      }

      // Refresh project data
      const projectData = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(projectData));
      clearSelection();
      closeBulkDeleteDialog();
      
      // Provide detailed feedback
      if (failureCount === 0) {
        toast.success(`Successfully deleted all ${successCount} strings`);
      } else if (successCount > 0) {
        toast.success(`Deleted ${successCount} strings. ${failureCount} failed.`);
        console.warn('Failed to delete strings:', failedStrings);
      } else {
        toast.error(`Failed to delete all ${failureCount} strings`);
        console.error('All deletions failed:', failedStrings);
      }
    } catch (error) {
      console.error('Error during bulk delete:', error);
      toast.error('Bulk delete operation failed');
    }
  };

  // Handle file selection for CSV import
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setImportFile(file);
    } else {
      toast.error('Please select a valid CSV file');
      event.target.value = '';
    }
  };

  // Close import dialog and reset state
  const closeImportDialog = () => {
    setImportDialog(false);
    setImportFile(null);
    setImportLoading(false);
  };

  // Extract variables from string content
  const extractVariablesFromContent = (content: string): string[] => {
    const variableMatches = content.match(/{{([^}]+)}}/g) || [];
    return variableMatches.map(match => match.slice(2, -2).trim()).filter(name => name.length > 0);
  };

  // Handle CSV import of strings
  const handleImportStrings = async () => {
    if (!importFile) return;

    setImportLoading(true);
    try {
      // Read CSV file
      const csvText = await importFile.text();
      const lines = csvText.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        toast.error('CSV file appears to be empty');
        return;
      }

      // Process each line as a string (treating each cell as a separate string)
      const allStrings: string[] = [];
      const allVariables = new Set<string>();
      
      lines.forEach(line => {
        // Simple CSV parsing - split by comma and handle quoted values
        const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          .map(cell => cell.trim().replace(/^"|"$/g, ''));
        
        cells.forEach(cell => {
          if (cell.trim()) {
            allStrings.push(cell.trim());
            // Extract variables from this string
            const variables = extractVariablesFromContent(cell.trim());
            variables.forEach(variable => allVariables.add(variable));
          }
        });
      });

      if (allStrings.length === 0) {
        toast.error('No valid strings found in CSV file');
        return;
      }

      // Create strings
      let createdStringsCount = 0;
      const stringPromises = allStrings.map(async (stringContent) => {
        try {
        await apiFetch('/api/strings/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              content: stringContent,
            project: id,
          }),
        });
          createdStringsCount++;
        } catch (err) {
          console.error(`Failed to create string: ${stringContent}`, err);
        }
      });

      await Promise.all(stringPromises);

      // Refresh project data
        const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(updatedProject));

      // Show success message
      toast.success(`Import complete! Created ${createdStringsCount} strings`);

      closeImportDialog();
    } catch (error) {
      console.error('Error importing strings:', error);
      toast.error('Failed to import strings. Please try again.');
    } finally {
      setImportLoading(false);
    }
  };

  // Close project edit dialog and reset state
  const closeProjectDialog = () => {
    setEditingProject(null);
    setProjectName("");
    setProjectDescription("");
  };

  // Handle project form submission
  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedProject = await apiFetch(`/api/projects/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
          name: projectName,
          description: projectDescription,
            }),
          });
      setProject(updatedProject);
      closeProjectDialog();
      toast.success('Project updated successfully');
      } catch (err) {
      console.error('Failed to update project:', err);
      toast.error('Failed to update project');
    }
  };

  // Handle CSV download
  const handleDownloadCSV = async () => {
    setDownloadLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${project.id}/download-csv/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': document.cookie.split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1] || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          selected_dimension_values: selectedDimensionValues,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to download CSV');
      }

      // Get the filename from the response headers
      const disposition = response.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] || `${project.name}_filtered_strings.csv`;
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('CSV downloaded successfully');
      setDownloadDialog(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to download CSV');
    } finally {
      setDownloadLoading(false);
    }
  };

  // Get filter text for dimension
  const getFilterText = (dimensionId: number) => dimensionFilterText[dimensionId] || '';

  // Get available dimension values filtered by text
  const getAvailableDimensionValues = (dimension: any, filterText: string = '') => {
    const allValues = dimension.values ? dimension.values.map((dv: any) => dv.value) : [];
    const selectedValues = stringDimensionValues[dimension.id] || [];
    const availableValues = allValues.filter((value: string) => !selectedValues.includes(value));
    
    if (!filterText) return availableValues;
    
    return availableValues.filter((value: string) => 
      value.toLowerCase().includes(filterText.toLowerCase())
    );
  };

  // Check if should show create option for dimension
  const shouldShowCreateOption = (dimensionId: number) => {
    const filterText = getFilterText(dimensionId);
    if (!filterText.trim()) return false;
    
    const dimension = project.dimensions?.find((d: any) => d.id === dimensionId);
    if (!dimension) return false;
    
    const allValues = dimension.values ? dimension.values.map((dv: any) => dv.value) : [];
    const selectedValues = stringDimensionValues[dimensionId] || [];
    
    return !allValues.includes(filterText.trim()) && !selectedValues.includes(filterText.trim());
  };

  // Legacy duplicate handleDimensionSubmit removed

  // Legacy duplicate dimension functions removed

  // Handle nested string split into conditional
  const handleNestedStringSplit = () => {
    // Initialize split mode with two spawns
    const baseName = editingNestedString.effective_variable_name || editingNestedString.variable_hash;
    const baseContent = nestedStringContent && nestedStringContent.trim() ? nestedStringContent.trim() : '';
    const defaultContent = baseContent || `Content for ${baseName}`;
    
    // Ensure we have valid content for spawns
    const safeDefaultContent = defaultContent.trim() || `Default content for ${baseName}`;
    
    console.log('Initializing split mode with content:', safeDefaultContent);
    
    setNestedStringConditionalMode(true);
    setNestedStringSpawns([
      {
        id: '1',
        content: safeDefaultContent,
        variableName: `${baseName}_1`,
        isConditional: nestedStringIsConditional
      },
      {
        id: '2',
        content: safeDefaultContent,
        variableName: `${baseName}_2`,
        isConditional: nestedStringIsConditional
      }
    ]);
  };

  // Checkbox state helpers

  // String deletion handlers
  const openDeleteStringDialog = (str: any) => {
    setDeleteStringDialog(str);
  };

  const closeDeleteStringDialog = () => {
    setDeleteStringDialog(null);
  };

  const handleDeleteString = async () => {
    if (!deleteStringDialog || !deleteStringDialog.id) return;

    // Prevent multiple deletion attempts by capturing the data and closing dialog immediately
    const stringToDelete = deleteStringDialog;
    setDeleteStringDialog(null);

    try {
      await apiFetch(`/api/strings/${stringToDelete.id}/`, {
        method: 'DELETE',
      });

      // Refresh project data from API to get the latest state including dimension cleanup
      if (project?.id) {
        try {
          const updatedProject = await apiFetch(`/api/projects/${project.id}/`);
          setProject(updatedProject);
        } catch (refreshError) {
          console.error('Failed to refresh project data after deletion:', refreshError);
          // Fallback to local state update if refresh fails
          setProject(prev => ({
            ...prev,
            strings: prev.strings?.filter((s: any) => s.id !== stringToDelete.id) || []
          }));
        }
      }

      toast.success('String deleted successfully');
    } catch (error) {
      console.error('Failed to delete string:', error);
      toast.error('Failed to delete string');
    }
  };

  // String duplication handler
  const handleDuplicateString = async (str: any) => {
    if (!str || !str.id) return;

    try {
      toast.loading('Duplicating string...');
      
      // Call the duplicate endpoint
      const duplicatedString = await apiFetch(`/api/strings/${str.id}/duplicate/`, {
        method: 'POST',
      });

      // Refresh project data to show the new string
      if (project?.id) {
        const updatedProject = await apiFetch(`/api/projects/${project.id}/`);
        setProject(updatedProject);
      }

      toast.dismiss();
      toast.success('String duplicated successfully!');
    } catch (err: any) {
      console.error('Failed to duplicate string:', err);
      toast.dismiss();
      toast.error(err.message || 'Failed to duplicate string');
    }
  };

  /* LEGACY BLOCK START - TEMPORARILY COMMENTED OUT DUE TO SYNTAX ERRORS
  
  // Everything between here and the main return statement is temporarily commented out
  // This includes thousands of lines of legacy functions with undefined variables
  // causing compilation errors. Once the unified drawer is confirmed working,
  // we can gradually restore needed functions.
  
  LEGACY BLOCK END */

  // The actual return statement is further down in the file - removing duplicate

/* LEGACY CODE THAT WAS COMMENTED OUT TO PREVENT COMPILATION ERRORS
          
          // Check if this was a spawn string by looking for it in dimension values
          // We need to maintain this relationship even when the name doesn't change
          let wasSpawnOfDimension = null;
          for (const dimension of project.dimensions || []) {
            const dimensionValue = dimension.values?.find((dv: any) => dv.value === oldVariableName);
            if (dimensionValue) {
              wasSpawnOfDimension = { dimension, dimensionValue };
              break;
            }
          }
          
          if (wasSpawnOfDimension) {
            try {
              if (oldVariableName && newVariableName && oldVariableName !== newVariableName) {
                // Case 1: Variable name changed - update the dimension value
                await apiFetch(`/api/dimension-values/${wasSpawnOfDimension.dimensionValue.id}/`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ value: newVariableName }),
                });
                console.log(`Updated dimension value from "${oldVariableName}" to "${newVariableName}" during conditional conversion`);
              } else {
                // Case 2: Variable name didn't change - ensure dimension value still exists
                // (Backend might have removed it due to is_conditional_container filter)
                const currentDimensionValue = wasSpawnOfDimension.dimension.values?.find((dv: any) => dv.value === oldVariableName);
                if (!currentDimensionValue) {
                  // Recreate the dimension value that the backend removed
                  await apiFetch('/api/dimension-values/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      dimension: wasSpawnOfDimension.dimension.id,
                      value: oldVariableName,
                    }),
                  });
                  console.log(`Recreated dimension value "${oldVariableName}" after conditional conversion`);
                }
              }
            } catch (err) {
              console.error('Failed to sync dimension value during conditional conversion:', err);
            }
          }
        } else {
          // Already a conditional container, potentially update its name
          const oldVariableName = drawer.stringData.effective_variable_name || drawer.stringData.variable_hash || drawer.stringData.variable_name;
          const newVariableName = drawer.variableName?.trim();
          
          // CRITICAL: Preserve spawn names BEFORE any backend operations if this is a rename
          let spawnNameMap = new Map();
          if (oldVariableName && newVariableName && oldVariableName !== newVariableName) {
            console.log('🔍 EARLY CASCADING DEBUG: Conditional rename detected, preserving spawn names...');
            console.log('🔍 EARLY CASCADING DEBUG: Renaming from', oldVariableName, 'to', newVariableName);
            
            // Find the old dimension to capture current spawn names
            const oldDimension = project.dimensions?.find((d: any) => d.name === oldVariableName);
            if (oldDimension) {
              console.log('🔍 EARLY CASCADING DEBUG: Found old dimension:', { id: oldDimension.id, name: oldDimension.name });
              
              // Capture current spawn names before ANY backend operations
              const currentSpawnStrings = project.strings?.filter((s: any) => {
                return s.dimension_values?.some((sdv: any) => 
                  sdv.dimension_value?.dimension?.id === oldDimension.id
                );
              }) || [];

              console.log(`🔍 EARLY CASCADING DEBUG: Found ${currentSpawnStrings.length} spawn strings to preserve:`, 
                currentSpawnStrings.map((s: any) => ({
                  id: s.id,
                  variable_name: s.variable_name,
                  variable_hash: s.variable_hash,
                  effective_name: s.effective_variable_name || s.variable_hash
                }))
              );
              
              currentSpawnStrings.forEach((spawn: any) => {
                if (spawn.variable_name) {
                  spawnNameMap.set(spawn.id, spawn.variable_name);
                  console.log(`🔍 EARLY CASCADING DEBUG: Storing spawn name mapping: ${spawn.id} -> ${spawn.variable_name}`);
                }
              });
            } else {
              console.log('🔍 EARLY CASCADING DEBUG: No old dimension found for', oldVariableName);
            }
          }
          
          if (oldVariableName && newVariableName && oldVariableName !== newVariableName) {
            // Update the conditional container's variable name
            conditionalContainer = await apiFetch(`/api/strings/${drawer.stringData.id}/`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: drawer.content || drawer.stringData.content,
                variable_name: newVariableName,
              }),
            });

            // After string update, wait for backend signals and then restore spawn names
            if (spawnNameMap.size > 0) {
              console.log('🔍 EARLY CASCADING DEBUG: Waiting for backend signals...');
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // Re-fetch project to see current state after backend operations
              const latestProjectAfterUpdate = await apiFetch(`/api/projects/${id}/`);
              console.log('🔍 EARLY CASCADING DEBUG: Re-fetched project after string update');
              
              // Check each spawn and restore name if it was changed
              for (const [spawnId, originalName] of spawnNameMap.entries()) {
                const currentSpawn = latestProjectAfterUpdate.strings?.find((s: any) => s.id === spawnId);
                if (currentSpawn) {
                  console.log(`🔍 EARLY CASCADING DEBUG: Checking spawn ${spawnId}:`, {
                    originalName,
                    currentVariableName: currentSpawn.variable_name,
                    currentHash: currentSpawn.variable_hash,
                    currentEffective: currentSpawn.effective_variable_name || currentSpawn.variable_hash
                  });
                  
                  if (currentSpawn.variable_name !== originalName) {
                    console.log(`🚨 EARLY CASCADING DEBUG: Spawn name changed! Restoring ${originalName} for spawn ${spawnId}`);
                    try {
                      await apiFetch(`/api/strings/${spawnId}/`, {
                        method: 'PATCH', 
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          variable_name: originalName
                        }),
                      });
                      console.log(`✅ EARLY CASCADING DEBUG: Successfully restored spawn name: ${originalName}`);
                    } catch (err) {
                      console.error(`❌ EARLY CASCADING DEBUG: Failed to restore spawn name for ${originalName}:`, err);
                    }
                  } else {
                    console.log(`✅ EARLY CASCADING DEBUG: Spawn name unchanged: ${originalName}`);
                  }
                }
              }
            }

            // Dimension renaming will be handled later in the dimension lookup section
          } else {
            // No name change, use existing data
            conditionalContainer = drawer.stringData;
          }
        }
        
        const conditionalName = conditionalContainer.effective_variable_name || conditionalContainer.variable_hash;

        
        // Find or create dimension for the conditional
        const latestProject = await apiFetch(`/api/projects/${id}/`);
        
        // Debug information
        console.log('DEBUG: Dimension lookup start');
        console.log('DEBUG: conditionalName:', conditionalName);
        console.log('DEBUG: drawer.stringData._isTemporary:', drawer.stringData._isTemporary);
        console.log('DEBUG: drawer.stringData:', {
          id: drawer.stringData.id,
          effective_variable_name: drawer.stringData.effective_variable_name,
          variable_hash: drawer.stringData.variable_hash,
          variable_name: drawer.stringData.variable_name,
          _isTemporary: drawer.stringData._isTemporary
        });
        console.log('DEBUG: available dimensions:', latestProject.dimensions?.map((d: any) => ({ id: d.id, name: d.name })));
        
        // For existing conditionals, check if we need to rename the variable's own dimension
        let conditionalDimension = null;
        
        if (!drawer.stringData._isTemporary) {
          const oldVariableName = drawer.stringData.effective_variable_name || drawer.stringData.variable_hash || drawer.stringData.variable_name;
          console.log('DEBUG: oldVariableName:', oldVariableName);
          console.log('DEBUG: conditionalName !== oldVariableName:', conditionalName !== oldVariableName);
          
          if (oldVariableName && oldVariableName !== conditionalName) {
            // Look for the dimension that belongs to this variable (with the old name)
            const oldDimension = latestProject.dimensions?.find((d: any) => d.name === oldVariableName);
            console.log('DEBUG: Found dimension with old name:', oldDimension ? { id: oldDimension.id, name: oldDimension.name } : 'null');
            
            if (oldDimension) {
              // Try to rename the existing dimension instead of creating a new one
              try {
                // Check if target dimension name already exists
                const existingDimensionWithNewName = latestProject.dimensions?.find((d: any) => 
                  d.name === conditionalName && d.id !== oldDimension.id
                );
                console.log('DEBUG: existingDimensionWithNewName:', existingDimensionWithNewName ? { id: existingDimensionWithNewName.id, name: existingDimensionWithNewName.name } : 'null');
                
                if (!existingDimensionWithNewName) {
                  console.log('DEBUG: Attempting to rename dimension from', oldVariableName, 'to', conditionalName);
                  await apiFetch(`/api/dimensions/${oldDimension.id}/`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: conditionalName }),
                  });
                  console.log(`Successfully renamed dimension from "${oldVariableName}" to "${conditionalName}" in conditional flow`);
                  
                  // CRITICAL: Preserve spawn string names when conditional is renamed in cascading drawer
                  console.log('🔍 CASCADING DEBUG: Starting spawn name preservation...');
                  
                  // Store spawn names from CURRENT project state (before backend signals mess with them)
                  const currentSpawnStrings = project.strings?.filter((s: any) => {
                    return s.dimension_values?.some((sdv: any) => 
                      sdv.dimension_value?.dimension?.id === oldDimension.id
                    );
                  }) || [];

                  console.log(`🔍 CASCADING DEBUG: Found ${currentSpawnStrings.length} spawn strings to preserve:`, 
                    currentSpawnStrings.map((s: any) => ({
                      id: s.id,
                      variable_name: s.variable_name,
                      variable_hash: s.variable_hash,
                      effective_name: s.effective_variable_name || s.variable_hash
                    }))
                  );
                  
                  // Store spawn names before any backend operations
                  const spawnNameMap = new Map();
                  currentSpawnStrings.forEach((spawn: any) => {
                    if (spawn.variable_name) {
                      spawnNameMap.set(spawn.id, spawn.variable_name);
                      console.log(`🔍 CASCADING DEBUG: Storing spawn name mapping: ${spawn.id} -> ${spawn.variable_name}`);
                    }
                  });
                  
                  // Fetch updated project to get the renamed dimension
                  const renamedProject = await apiFetch(`/api/projects/${id}/`);
                  conditionalDimension = renamedProject.dimensions?.find((d: any) => d.name === conditionalName);
                  console.log('DEBUG: After rename, found dimension:', conditionalDimension ? { id: conditionalDimension.id, name: conditionalDimension.name } : 'null');
                  
                  // Wait a bit for backend signals to complete
                  await new Promise(resolve => setTimeout(resolve, 200));
                  
                  // Re-fetch project to see current state after backend operations
                  const latestProjectAfterSignals = await apiFetch(`/api/projects/${id}/`);
                  console.log('🔍 CASCADING DEBUG: Re-fetched project after backend signals');
                  
                  // Check each spawn and restore name if it was changed
                  for (const [spawnId, originalName] of spawnNameMap.entries()) {
                    const currentSpawn = latestProjectAfterSignals.strings?.find((s: any) => s.id === spawnId);
                    if (currentSpawn) {
                      console.log(`🔍 CASCADING DEBUG: Checking spawn ${spawnId}:`, {
                        originalName,
                        currentVariableName: currentSpawn.variable_name,
                        currentHash: currentSpawn.variable_hash,
                        currentEffective: currentSpawn.effective_variable_name || currentSpawn.variable_hash
                      });
                      
                      if (currentSpawn.variable_name !== originalName) {
                        console.log(`🚨 CASCADING DEBUG: Spawn name changed! Restoring ${originalName} for spawn ${spawnId}`);
                        try {
                          await apiFetch(`/api/strings/${spawnId}/`, {
                            method: 'PATCH', 
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              variable_name: originalName
                            }),
                          });
                          console.log(`✅ CASCADING DEBUG: Successfully restored spawn name: ${originalName}`);
                        } catch (err) {
                          console.error(`❌ CASCADING DEBUG: Failed to restore spawn name for ${originalName}:`, err);
                        }
                      } else {
                        console.log(`✅ CASCADING DEBUG: Spawn name unchanged: ${originalName}`);
                      }
                    }
                  }
                } else {
                  console.warn(`Cannot rename dimension from "${oldVariableName}" to "${conditionalName}" - target name already exists`);
                  toast.error(`Cannot rename to "${conditionalName}" - a dimension with this name already exists`);
                  // Keep using the old dimension
                  conditionalDimension = oldDimension;
                }
              } catch (err) {
                console.error('Failed to rename dimension in conditional flow:', err);
                toast.error(`Failed to rename dimension: ${err instanceof Error ? err.message : 'Unknown error'}`);
                // Keep using the old dimension
                conditionalDimension = oldDimension;
              }
            } else {
              console.log('DEBUG: No dimension found with old name', oldVariableName);
              // Look for dimension with new name as fallback
              conditionalDimension = latestProject.dimensions?.find((d: any) => d.name === conditionalName);
              console.log('DEBUG: Fallback - found dimension with new name:', conditionalDimension ? { id: conditionalDimension.id, name: conditionalDimension.name } : 'null');
            }
          } else {
            console.log('DEBUG: No rename needed - names are the same or no old name');
            // Look for dimension with the current name
            conditionalDimension = latestProject.dimensions?.find((d: any) => d.name === conditionalName);
            console.log('DEBUG: Found dimension with current name:', conditionalDimension ? { id: conditionalDimension.id, name: conditionalDimension.name } : 'null');
          }
        } else {
          console.log('DEBUG: New conditional - looking for dimension with new name');
          // For new conditionals, just look for existing dimension with the new name
          conditionalDimension = latestProject.dimensions?.find((d: any) => d.name === conditionalName);
          console.log('DEBUG: Found dimension with new name:', conditionalDimension ? { id: conditionalDimension.id, name: conditionalDimension.name } : 'null');
        }
        
        console.log('DEBUG: Final conditionalDimension before creation check:', conditionalDimension ? { id: conditionalDimension.id, name: conditionalDimension.name } : 'null');
        
        if (!conditionalDimension) {
          try {
            await apiFetch('/api/dimensions/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: conditionalName,
                project: id,
              }),
            });
            
            // Fetch updated project to get the newly created dimension
            const updatedProject = await apiFetch(`/api/projects/${id}/`);
            conditionalDimension = updatedProject.dimensions?.find((d: any) => d.name === conditionalName);
          } catch (dimensionError) {
            // Continue anyway - the dimension might have been created by another process
            // Try to get it from the latest project data
            const retryProject = await apiFetch(`/api/projects/${id}/`);
            conditionalDimension = retryProject.dimensions?.find((d: any) => d.name === conditionalName);
          }
        }
        
        // Debug: Check spawns state

        
        if (drawer.conditionalSpawns.length === 0) {

          toast.error('No spawns found. Please switch to conditional mode first.');
          return;
        }
        
        // Validate spawns have content
        const emptySpawns = drawer.conditionalSpawns.filter(spawn => {
          const content = spawn.content?.trim() || "";
          return !content;
        });

        if (emptySpawns.length > 0) {
          toast.error(`All spawns must have content. ${emptySpawns.length} spawn(s) are empty.`);
          return;
        }

        // Save all spawns
        const stringPromises = drawer.conditionalSpawns.map(async (spawn) => {
          const spawnContent = spawn.content?.trim() || 'Default spawn content';
          
          if (spawn._isTemporary || 
              String(spawn.id).startsWith('temp-') || 
              (typeof spawn.id === 'number' && spawn.id > 1000000000000)) {
            // Create new spawn variable
            return await apiFetch('/api/strings/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: spawnContent,
                variable_name: null, // Explicitly set to null to let backend generate random hash
                is_conditional: spawn.is_conditional || false,
                is_conditional_container: false,
                project: id,
              }),
            });
          } else {
            // Update existing spawn variable
            return await apiFetch(`/api/strings/${spawn.id}/`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: spawnContent,
                variable_name: null, // Explicitly set to null to let backend generate random hash
                is_conditional: spawn.is_conditional || false,
              }),
            });
          }
        });

        const savedSpawns = await Promise.all(stringPromises);

        // Handle hidden option for cascading drawer conditional
        try {
          if (conditionalDimension) {
            const existingHiddenValue = conditionalDimension.values?.find((v: any) => v.value === "Hidden");
            
            if (drawer.includeHiddenOption) {
              // Create "Hidden" dimension value if checkbox is checked
              console.log('DEBUG: Creating "Hidden" dimension value for cascading drawer');
              if (!existingHiddenValue) {
                await apiFetch('/api/dimension-values/', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    dimension: conditionalDimension.id,
                    value: "Hidden",
                  }),
                });
                console.log('DEBUG: Successfully created "Hidden" dimension value for cascading drawer');
              } else {
                console.log('DEBUG: "Hidden" dimension value already exists for cascading drawer');
              }
            } else {
              // Remove "Hidden" dimension value if checkbox is unchecked
              console.log('DEBUG: Removing "Hidden" dimension value for cascading drawer');
              if (existingHiddenValue) {
                await apiFetch(`/api/dimension-values/${existingHiddenValue.id}/`, {
                  method: 'DELETE',
                });
                console.log('DEBUG: Successfully removed "Hidden" dimension value for cascading drawer');
              } else {
                console.log('DEBUG: "Hidden" dimension value does not exist for cascading drawer');
              }
            }
          }
        } catch (hiddenValueError) {
          console.error('DEBUG: Failed to handle "Hidden" dimension value for cascading drawer:', hiddenValueError);
          // Don't fail the whole operation for this
        }
        
        // Create dimension values for each spawn
        if (conditionalDimension) {
          for (let i = 0; i < savedSpawns.length; i++) {
            const savedSpawn = savedSpawns[i];
            const spawnName = savedSpawn.effective_variable_name || savedSpawn.variable_hash;
            
            try {
              // Check if dimension value already exists for this spawn
              let dimensionValue = conditionalDimension.values?.find((dv: any) => dv.value === spawnName);
              
              if (!dimensionValue) {
                // Create new dimension value if it doesn't exist
                try {
                  dimensionValue = await apiFetch('/api/dimension-values/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      dimension: conditionalDimension.id,
                      value: spawnName,
                    }),
                  });
                } catch (dimensionValueError: any) {
                  // If dimension value already exists (race condition), fetch it
                  if (dimensionValueError?.message?.includes('already exists') || 
                      dimensionValueError?.detail?.includes('already exists')) {
                    console.log(`Dimension value ${spawnName} already exists, fetching it`);
                    // Refetch the latest project data to get the existing dimension value
                    const latestProjectForDimValue = await apiFetch(`/api/projects/${id}/`);
                    const latestDimension = latestProjectForDimValue.dimensions?.find((d: any) => d.id === conditionalDimension.id);
                    dimensionValue = latestDimension?.values?.find((dv: any) => dv.value === spawnName);
                  } else {
                    throw dimensionValueError; // Re-throw if it's a different error
                  }
                }
              }
              
              // Check if StringDimensionValue link already exists
              const existingLink = savedSpawn.dimension_values?.find((dv: any) => 
                dv.dimension_value && 
                dv.dimension_value.dimension === conditionalDimension.id && 
                dv.dimension_value.value === spawnName
              );
              
              if (!existingLink) {
                try {
                  // Link the spawn to the dimension value
                  await apiFetch('/api/string-dimension-values/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      string: savedSpawn.id,
                      dimension_value: dimensionValue.id,
                    }),
                  });
                } catch (linkError: any) {
                  // If it's a unique constraint error, the relationship already exists (created by backend signals)
                  if (linkError?.non_field_errors?.some((err: string) => err.includes('unique set'))) {
                    console.log(`StringDimensionValue relationship already exists for spawn ${spawnName}, skipping`);
                  } else {
                    throw linkError; // Re-throw if it's a different error
                  }
                }
              }

            } catch (error: any) {
              // Check if it's a unique constraint error we can safely ignore
              if (error?.non_field_errors?.some((err: string) => err.includes('unique set')) ||
                  error?.message?.includes('unique set')) {
                console.log(`Dimension relationship already exists for spawn ${spawnName}, skipping`);
              } else {
                console.error('Failed to create dimension value for spawn:', spawnName, error);
                // Continue with other spawns even if one fails
              }
            }
          }
        }
        
        // Remove from pending variables if this was a new conditional
        if (isTemporary) {
          const variableName = conditionalContainer.effective_variable_name || conditionalContainer.variable_hash;
          setPendingStringVariables(prev => {
            const newPending = { ...prev };
            delete newPending[variableName];
            return newPending;
          });
        }
        
        // Refresh project data to show the new conditional and spawns
        const updatedProject = await apiFetch(`/api/projects/${id}/`);
        setProject(updatedProject);
        
        // Close this drawer (skip auto-save since we already saved)
        closeCascadingDrawer(drawerId, true);
        
        // Show appropriate success message based on whether this was a creation or update
        const wasTemporary = drawer.stringData._isTemporary || 
                           String(drawer.stringData.id).startsWith('temp-') || 
                           (typeof drawer.stringData.id === 'number' && drawer.stringData.id > 1000000000000);
        
        toast.success(wasTemporary ? 'Conditional variable created successfully!' : 'Conditional variable updated successfully!');
        return; // Exit early since we've handled the conditional case
      } else {
        // Regular string saving
        if (drawer.stringData._isTemporary || 
            String(drawer.stringData.id).startsWith('temp-') || 
            (typeof drawer.stringData.id === 'number' && drawer.stringData.id > 1000000000000)) {
          // This is a temporary string - create it in the database
          await apiFetch('/api/strings/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: drawer.content,
              variable_name: drawer.variableName?.trim() || null,
              is_conditional: drawer.isConditional,
              is_conditional_container: drawer.isConditional,
              project: id,
            }),
          });

          // Remove from pending variables now that it's saved
          const variableName = drawer.stringData.variable_name || drawer.stringData.variable_hash;
          setPendingStringVariables(prev => {
            const newPending = { ...prev };
            delete newPending[variableName];
            return newPending;
          });
        } else {
          // This is an existing string - update it
          await apiFetch(`/api/strings/${drawer.stringData.id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: drawer.content,
              variable_name: drawer.variableName?.trim() || null,
              is_conditional: drawer.isConditional,
              is_conditional_container: drawer.isConditional,
            }),
          });

          // Sync dimension/dimension value names when variables are renamed in cascading drawer
          const oldVariableName = drawer.stringData.effective_variable_name || drawer.stringData.variable_hash || drawer.stringData.variable_name;
          const newVariableName = drawer.variableName?.trim();
          
          if (oldVariableName && newVariableName && oldVariableName !== newVariableName) {
            if (drawer.stringData.is_conditional_container) {
              // This is a conditional variable being renamed - update the corresponding dimension
              const dimension = project.dimensions?.find((d: any) => d.name === oldVariableName);
              if (dimension) {
                // Check if target dimension name already exists
                const existingDimensionWithNewName = project.dimensions?.find((d: any) => 
                  d.name === newVariableName && d.id !== dimension.id
                );
                
                if (existingDimensionWithNewName) {
                  console.warn(`Cannot rename dimension from "${oldVariableName}" to "${newVariableName}" - dimension name already exists (cascading drawer)`);
                  toast.error(`Cannot rename to "${newVariableName}" - a dimension with this name already exists`);
                } else {
                  try {
                    await apiFetch(`/api/dimensions/${dimension.id}/`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: newVariableName }),
                    });
                    console.log(`Updated dimension name from "${oldVariableName}" to "${newVariableName}" (cascading drawer)`);
                  } catch (err) {
                    console.error('Failed to update dimension name in cascading drawer:', err);
                    toast.error(`Failed to update dimension name: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }
              }
            } else {
              // This might be a spawn string being renamed - update the corresponding dimension value
              for (const dimension of project.dimensions || []) {
                const dimensionValue = dimension.values?.find((dv: any) => dv.value === oldVariableName);
                if (dimensionValue) {
                  try {
                    await apiFetch(`/api/dimension-values/${dimensionValue.id}/`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ value: newVariableName }),
                    });
                    console.log(`Updated dimension value from "${oldVariableName}" to "${newVariableName}" in dimension "${dimension.name}" (cascading drawer)`);
                    break;
                  } catch (err) {
                    console.error('Failed to update dimension value in cascading drawer:', err);
                  }
                }
              }
            }
          }
        }
      }

      // Refresh project data
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(updatedProject);
      
      // Close this drawer (skip auto-save since we already saved)
      closeCascadingDrawer(drawerId, true);
      
      toast.success('String updated successfully!');
    } catch (err) {
      console.error('Failed to save string:', err);
      toast.error('Failed to save string. Please try again.');
    }
  };

  // Legacy nested string editing handlers (keeping for backward compatibility)
  const openEditNestedString = (str: any) => {
    // Now redirect to cascading drawer system
    openEditInCascadingDrawer(str);
  };

  const closeNestedStringDialog = () => {
    setNestedStringContent("");
    setNestedStringVariableName("");
    setNestedStringIsConditional(false);
    setEditingNestedString(null);
    setNestedStringConditionalMode(false);
    setNestedStringSpawns([]);
    setEditingConditional(false);
    setConditionalSpawns([]);
  };

  // Function to create and edit a pending string variable
  const createAndEditPendingVariable = (variableName: string) => {
    const pendingVar = pendingStringVariables[variableName];
    if (!pendingVar) return;

    // Create a temporary string object (not saved to database yet)
    const tempString = {
      id: `temp-${Date.now()}-${Math.random()}`, // Temporary ID
      content: pendingVar.content || "",
      variable_name: variableName,
      variable_hash: variableName, // Use variable name as hash for temp
      effective_variable_name: variableName,
      is_conditional: pendingVar.is_conditional || false,
      is_conditional_container: false,
      project: id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      dimension_values: [],
      _isTemporary: true // Flag to indicate this is a temporary string
    };

    // Open the temporary string for editing in cascading drawer
    openEditInCascadingDrawer(tempString);
  };

  const handleNestedStringSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (nestedStringConditionalMode) {
        // Handle split mode submission - create multiple spawns
        await handleNestedStringSplitSubmit();
      } else {
        // Handle regular update
        const response = await apiFetch(`/api/strings/${editingNestedString.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: nestedStringContent,
            variable_name: nestedStringVariableName.trim() || null,
            is_conditional: nestedStringIsConditional,
          }),
        });

        // Refresh project data
        const updatedProject = await apiFetch(`/api/projects/${id}/`);
        setProject(sortProjectStrings(updatedProject));
        
        // Close nested dialog
        closeNestedStringDialog();
        
        toast.success('String updated successfully!');
      }
    } catch (err) {
      console.error('Failed to update nested string:', err);
      toast.error('Failed to update string. Please try again.');
    }
  };

  const handleNestedStringSplitSubmit = async () => {
    const conditionalName = editingNestedString.effective_variable_name || editingNestedString.variable_hash;
    

    
    // Validate that all spawns have content
    const emptySpawns = nestedStringSpawns.filter(spawn => {
      const content = spawn.content;
      return !content || typeof content !== 'string' || content.trim() === '';
    });
    
    if (emptySpawns.length > 0) {
      toast.error(`All spawns must have content before splitting. Found ${emptySpawns.length} empty spawn(s).`);
      return;
    }
    
    // Additional validation: ensure all spawns have valid content before API call
    const invalidSpawns = nestedStringSpawns.filter(spawn => {
      const trimmedContent = spawn.content?.trim();
      return !trimmedContent || trimmedContent.length === 0;
    });
    
    if (invalidSpawns.length > 0) {
      toast.error(`Some spawns have invalid content. Please check all spawn content.`);
      return;
    }
    
    // Final validation before API calls
    const finalEmptySpawns = nestedStringSpawns.filter(spawn => {
      const content = spawn.content;
      return !content || typeof content !== 'string' || content.trim() === '';
    });
    
    if (finalEmptySpawns.length > 0) {
      toast.error(`Found ${finalEmptySpawns.length} empty spawn(s) before API call. Please check all spawn content.`);
      return;
    }
    
    try {
      // Step 1: Check if dimension already exists, create if not
      let newDimension = project.dimensions?.find((dim: any) => dim.name === conditionalName);
      
      if (!newDimension) {
        // Create new dimension
        newDimension = await apiFetch('/api/dimensions/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: conditionalName,
            project: parseInt(id as string),
          }),
        });
      }

      // Step 2: Create string variables for each spawn (check if they exist first)

      const stringPromises = nestedStringSpawns.map(async (spawn, index) => {
        const spawnName = `${conditionalName}_${index + 1}`;
        const safeContent = spawn.content?.trim() || `Default content for ${spawnName}`;
        

        
        // Check if string with this variable name already exists
        const existingString = project.strings?.find((str: any) => {
          const effectiveName = str.effective_variable_name || str.variable_hash;
          return effectiveName === spawnName || str.variable_name === spawnName;
        });
        
        if (existingString) {
          return Promise.resolve(existingString);
        }
        
        // Final safety check before API call
        if (!safeContent || safeContent.length === 0) {
          throw new Error(`Spawn ${spawnName} has no content`);
        }
        
        const requestBody = {
          content: safeContent,
          variable_name: spawnName,
          is_conditional: spawn.isConditional,
          project: parseInt(id as string),
        };
        

        
        return apiFetch('/api/strings/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
      });


      let stringResponses;
      try {
        stringResponses = await Promise.all(stringPromises);

      } catch (error) {

        throw error;
      }

      // Step 3: Create dimension values for each spawn (check if they exist first)
      const dimValuePromises = nestedStringSpawns.map(async (spawn, index) => {
        const spawnName = `${conditionalName}_${index + 1}`;
        
        // Check if dimension value already exists
        const existingDimValue = newDimension.values?.find((dv: any) => dv.value === spawnName);
        
        if (!existingDimValue) {
          return apiFetch('/api/dimension-values/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dimension: newDimension.id,
              value: spawnName,
            }),
          });
        } else {
          console.log('Dimension value already exists:', spawnName);
          return Promise.resolve(existingDimValue);
        }
      });

      await Promise.all(dimValuePromises);

      // Step 4: Convert the original string to a conditional (if not already)
      if (!editingNestedString.is_conditional_container) {
        console.log('Converting original string to conditional');
        const conditionalContent = `[Conditional: ${conditionalName}]`;
        await apiFetch(`/api/strings/${editingNestedString.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: conditionalContent, // Provide descriptive content for conditional
            variable_name: editingNestedString.variable_name || conditionalName,
            is_conditional: editingNestedString.is_conditional,
            is_conditional_container: true, // Mark as conditional
          }),
        });
      } else {
        console.log('Original string is already a conditional');
      }

      // Refresh project data
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(updatedProject));
      
      // Close nested dialog
      closeNestedStringDialog();
      
      toast.success(`Split variable "${conditionalName}" created with ${nestedStringSpawns.length} spawns!`);
    } catch (err) {
      console.error('Failed to split string:', err);
      toast.error('Failed to split string. Please try again.');
    }
  };

  const handleNestedStringSplit = () => {
    // Initialize split mode with two spawns
    const baseName = editingNestedString.effective_variable_name || editingNestedString.variable_hash;
    const baseContent = nestedStringContent && nestedStringContent.trim() ? nestedStringContent.trim() : '';
    const defaultContent = baseContent || `Content for ${baseName}`;
    
    // Ensure we have valid content for spawns
    const safeDefaultContent = defaultContent.trim() || `Default content for ${baseName}`;
    
    console.log('Initializing split mode with content:', safeDefaultContent);
    
    setNestedStringConditionalMode(true);
    setNestedStringSpawns([
      {
        id: '1',
        content: safeDefaultContent,
        variableName: `${baseName}_1`,
        isConditional: nestedStringIsConditional
      },
      {
        id: '2',
        content: safeDefaultContent,
        variableName: `${baseName}_2`,
        isConditional: nestedStringIsConditional
      }
    ]);
  };

  const addNestedStringSpawn = () => {
    const nextId = (nestedStringSpawns.length + 1).toString();
    const baseName = editingNestedString.effective_variable_name || editingNestedString.variable_hash;
    const baseContent = nestedStringContent && nestedStringContent.trim() ? nestedStringContent.trim() : '';
    const defaultContent = baseContent || `Content for ${baseName}_${nextId}`;
    
    // Ensure we always have valid content
    const safeContent = defaultContent.trim() || `Default content for ${baseName}_${nextId}`;
    
    console.log('Adding new spawn:', { nextId, baseName, safeContent });
    
    setNestedStringSpawns(prev => [...prev, {
      id: nextId,
      content: safeContent,
      variableName: `${baseName}_${nextId}`,
      isConditional: nestedStringIsConditional
    }]);
  };

  const removeNestedStringSpawn = (spawnId: string) => {
    setNestedStringSpawns(prev => prev.filter(spawn => spawn.id !== spawnId));
  };

  const updateNestedStringSpawn = (spawnId: string, field: string, value: string | boolean) => {
    console.log('=== UPDATE NESTED STRING SPAWN ===');
    console.log('spawnId:', spawnId, 'field:', field, 'value:', value, 'valueType:', typeof value);
    
    setNestedStringSpawns(prev => {
      const updated = prev.map(spawn => {
        if (spawn.id === spawnId) {
          // If updating content, ensure it's a valid string and not empty
          if (field === 'content') {
            if (typeof value === 'string') {
              // Ensure content is not empty after trimming
              const trimmedValue = value.trim();
              const finalValue = trimmedValue || `Content for ${spawn.variableName}`;
              console.log(`Updating spawn ${spawnId} content from "${spawn.content}" to "${finalValue}"`);
              return { ...spawn, [field]: finalValue };
            } else {
              // If not a string, provide default content
              const defaultContent = `Content for ${spawn.variableName}`;
              console.warn(`Attempted to update spawn ${spawnId} content with non-string value:`, value, 'Using default:', defaultContent);
              return { ...spawn, [field]: defaultContent };
            }
          } else {
            // Non-content fields
            console.log(`Updating spawn ${spawnId} ${field} from "${(spawn as any)[field]}" to "${value}"`);
            return { ...spawn, [field]: value };
          }
        }
        return spawn;
      });
      
      console.log('Updated nestedStringSpawns:', updated);
      return updated;
    });
  };

  // Split variable spawn editing functions
  const updateConditionalSpawn = (spawnId: number, field: string, value: string | boolean) => {
    setConditionalSpawns(prev => prev.map(spawn => 
      spawn.id === spawnId ? { ...spawn, [field]: value } : spawn
    ));
  };

  const handleSplitVariableSpawnSubmit = async (spawn: any) => {
    try {
      await apiFetch(`/api/strings/${spawn.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: spawn.content,
          variable_name: spawn.variable_name,
          is_conditional: spawn.is_conditional,
        }),
      });
      
      toast.success(`Updated spawn "${spawn.effective_variable_name || spawn.variable_hash || 'spawn'}"`);
    } catch (err) {
      console.error('Failed to update spawn:', err);
      toast.error('Failed to update spawn. Please try again.');
    }
  };

  const handleSplitVariableSubmit = async () => {
    console.log('DEBUG: handleSplitVariableSubmit called');
    console.log('DEBUG: conditionalSpawns length:', conditionalSpawns.length);
    console.log('DEBUG: conditionalSpawns:', conditionalSpawns);
    
    if (conditionalSpawns.length === 0) {
      console.log('DEBUG: No spawns to process, returning early');
      toast.info('No spawn variables to save');
      return;
    }
    
    try {
      // Step 1: Handle conditional container creation or conversion
      let conditionalContainer = null;
      
      if (editingString && !editingString.is_conditional_container) {
        // Converting existing string to conditional
        console.log('DEBUG: Converting existing string to conditional container');
        
        // Before conversion, check if this was a spawn of another conditional
        const oldVariableName = editingString.effective_variable_name || editingString.variable_hash || editingString.variable_name;
        const newVariableName = stringVariableName || editingString.variable_name;
        let wasSpawnOfDimension = null;
        
        for (const dimension of project.dimensions || []) {
          const dimensionValue = dimension.values?.find((dv: any) => dv.value === oldVariableName);
          if (dimensionValue) {
            wasSpawnOfDimension = { dimension, dimensionValue };
            break;
          }
        }
        
        try {
          conditionalContainer = await apiFetch(`/api/strings/${editingString.id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: stringContent || editingString.content,
              variable_name: newVariableName,
              is_conditional: true,
              is_conditional_container: true,
            }),
          });
          console.log('DEBUG: Converted string to conditional container:', conditionalContainer);
          
          // After conversion, ensure dimension value relationship is preserved
          if (wasSpawnOfDimension) {
            try {
              if (oldVariableName && newVariableName && oldVariableName !== newVariableName) {
                // Case 1: Variable name changed - update the dimension value
                await apiFetch(`/api/dimension-values/${wasSpawnOfDimension.dimensionValue.id}/`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ value: newVariableName }),
                });
                console.log(`Updated dimension value from "${oldVariableName}" to "${newVariableName}" during main conditional conversion`);
              } else {
                // Case 2: Variable name didn't change - ensure dimension value still exists
                // (Backend might have removed it due to is_conditional_container filter)
                const latestProject = await apiFetch(`/api/projects/${id}/`);
                const currentDimension = latestProject.dimensions?.find((d: any) => d.id === wasSpawnOfDimension.dimension.id);
                const currentDimensionValue = currentDimension?.values?.find((dv: any) => dv.value === oldVariableName);
                if (!currentDimensionValue) {
                  // Recreate the dimension value that the backend removed
                  await apiFetch('/api/dimension-values/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      dimension: wasSpawnOfDimension.dimension.id,
                      value: oldVariableName,
                    }),
                  });
                  console.log(`Recreated dimension value "${oldVariableName}" after main conditional conversion`);
                }
              }
            } catch (err) {
              console.error('Failed to sync dimension value during main conditional conversion:', err);
            }
          }
        } catch (conversionError) {
          console.error('DEBUG: Failed to convert string to conditional:', conversionError);
          throw conversionError;
        }
      } else if (!editingString) {
        // Creating new conditional from scratch
        console.log('DEBUG: Creating new conditional container');
        try {
          conditionalContainer = await apiFetch('/api/strings/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: stringContent || 'Conditional variable',
              variable_name: stringVariableName || null,
              is_conditional: true,
              is_conditional_container: true,
              project: id,
            }),
          });
          console.log('DEBUG: Created conditional container:', conditionalContainer);
        } catch (containerError) {
          console.error('DEBUG: Failed to create conditional container:', containerError);
          throw containerError;
        }
      } else if (editingString && editingString.is_conditional_container) {
        // Already a conditional, just use the existing one
        conditionalContainer = editingString;
        console.log('DEBUG: Using existing conditional container:', conditionalContainer);
      }
        
      // Step 2: Create dimension for the conditional (if it doesn't already exist)
      const conditionalName = conditionalContainer.effective_variable_name || conditionalContainer.variable_hash;
      console.log('DEBUG: Creating dimension for conditional:', conditionalName);
      
      // Fetch latest project data to check for existing dimensions
      const latestProject = await apiFetch(`/api/projects/${id}/`);
      const existingDimension = latestProject.dimensions?.find((d: any) => d.name === conditionalName);
      
      if (!existingDimension) {
        try {
          console.log('DEBUG: Attempting to create dimension with payload:', { name: conditionalName, project: id });
          await apiFetch('/api/dimensions/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: conditionalName,
              project: id,
            }),
          });
          console.log('DEBUG: Successfully created new dimension:', conditionalName);
        } catch (dimensionError) {
          console.error('DEBUG: Dimension creation failed:', dimensionError);
          // Continue anyway - the dimension might have been created by another process
        }
      } else {
        console.log('DEBUG: Dimension already exists:', conditionalName);
      }
      
      // Step 3: Create or update all spawns
              const updatePromises = conditionalSpawns.map(spawn => {
          // Detect temporary spawns: _isTemporary flag, temp- prefix, or timestamp-like IDs (> 1000000000000)
          const isTemporary = spawn._isTemporary || 
                             String(spawn.id).startsWith('temp-') || 
                             (typeof spawn.id === 'number' && spawn.id > 1000000000000);
          console.log(`DEBUG: spawn ${spawn.id} - isTemporary: ${isTemporary}, _isTemporary: ${spawn._isTemporary}, id: ${spawn.id}, typeof: ${typeof spawn.id}`);
        
        if (isTemporary) {
          // Create new spawn variable
          console.log('DEBUG: Creating new spawn variable with POST');
          const payload = {
            content: spawn.content,
            variable_name: null, // Explicitly set to null to let backend generate random hash
            is_conditional: spawn.is_conditional,
            is_conditional_container: false,
            project: id,
          };
          console.log('DEBUG: POST payload:', payload);
          return apiFetch('/api/strings/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(err => {
            console.error('DEBUG: POST request failed for spawn:', spawn, 'Error:', err);
            throw err;
          });
        } else {
          // Update existing spawn variable
          console.log('DEBUG: Updating existing spawn variable with PATCH');
          const payload = {
            content: spawn.content,
            variable_name: spawn.effective_variable_name || spawn.variable_hash || spawn.variable_name,
            is_conditional: spawn.is_conditional,
          };
          console.log('DEBUG: PATCH payload:', payload);
          return apiFetch(`/api/strings/${spawn.id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(err => {
            console.error('DEBUG: PATCH request failed for spawn:', spawn, 'Error:', err);
            throw err;
          });
        }
      });

      const createdSpawns = await Promise.all(updatePromises);
      
      // Step 4: Create dimension values for new spawns if we created a new conditional
      if (!editingString && conditionalContainer) {
        const conditionalName = conditionalContainer.effective_variable_name || conditionalContainer.variable_hash;
        console.log('DEBUG: Creating dimension values for spawns');
        
        // Find the dimension we just created
        const updatedProject = await apiFetch(`/api/projects/${id}/`);
        const dimension = updatedProject.dimensions?.find((d: any) => d.name === conditionalName);
        
        if (dimension) {
          // Create dimension values for each spawn
          const dimensionValuePromises = createdSpawns.map(async (spawn: any) => {
            const spawnName = spawn.effective_variable_name || spawn.variable_hash;
            return apiFetch('/api/dimension-values/', {
              method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
                dimension: dimension.id,
                value: spawnName,
          }),
        });
          });
          
          await Promise.all(dimensionValuePromises);
        }
      }

      // Step 4: Handle "Hidden" dimension value based on checkbox state
      try {
        // Get the latest dimension to ensure we have the correct ID
        const updatedProject = await apiFetch(`/api/projects/${id}/`);
        const dimension = updatedProject.dimensions?.find((d: any) => d.name === conditionalName);
        
        if (dimension) {
          const existingHiddenValue = dimension.values?.find((v: any) => v.value === "Hidden");
          
          if (includeHiddenOption) {
            // Create "Hidden" dimension value if checkbox is checked
            console.log('DEBUG: Creating "Hidden" dimension value');
            if (!existingHiddenValue) {
              await apiFetch('/api/dimension-values/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  dimension: dimension.id,
                  value: "Hidden",
                }),
              });
              console.log('DEBUG: Successfully created "Hidden" dimension value');
            } else {
              console.log('DEBUG: "Hidden" dimension value already exists');
            }
          } else {
            // Remove "Hidden" dimension value if checkbox is unchecked
            console.log('DEBUG: Removing "Hidden" dimension value');
            if (existingHiddenValue) {
              await apiFetch(`/api/dimension-values/${existingHiddenValue.id}/`, {
                method: 'DELETE',
              });
              console.log('DEBUG: Successfully removed "Hidden" dimension value');
            } else {
              console.log('DEBUG: "Hidden" dimension value does not exist');
            }
          }
        }
      } catch (hiddenValueError) {
        console.error('DEBUG: Failed to handle "Hidden" dimension value:', hiddenValueError);
        // Don't fail the whole operation for this
      }

      // Refresh project data
      const finalProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(finalProject));
      
      // Close dialog
      closeStringDialog();
      
      toast.success(editingString ? 'Split variable spawns updated successfully!' : 'Conditional variable created successfully!');
    } catch (err) {
      console.error('Failed to update conditional spawns:', err);
      toast.error('Failed to update spawns. Please try again.');
    }
  };

  const addConditionalSpawn = async () => {
    // Handle both new conditional creation and existing conditional editing
    let conditionalName;
    if (editingNestedString) {
      // Editing existing conditional
      conditionalName = editingNestedString.effective_variable_name || editingNestedString.variable_hash;
    } else if (editingString) {
      // Converting existing string to conditional
      conditionalName = editingString.effective_variable_name || editingString.variable_hash;
    } else {
      // Creating new conditional - use the variable name from the form or generate a temporary one
      conditionalName = stringVariableName || 'temp_conditional';
    }
    
    try {
      // For new conditionals, we don't have a dimension yet, so just add to local state
      if (!editingNestedString && !editingString) {
        // Creating new conditional - just add spawn to local state
        const newSpawnId = Date.now() + Math.random(); // Ensure unique ID
        const newSpawn = {
          id: newSpawnId,
          content: 'Default spawn content',
          effective_variable_name: null, // Will be generated by backend
          variable_hash: null, // Will be generated by backend
          is_conditional_container: false,
          _isTemporary: true
        };
        
        setConditionalSpawns(prev => [...prev, newSpawn]);
        toast.success('Added new spawn');
      return;
    }
    
      // For existing conditionals, find the existing dimension
      const existingDimension = project.dimensions?.find((dim: any) => dim.name === conditionalName);
      if (!existingDimension) {
        throw new Error('Cannot find dimension for conditional');
      }

      // Get content from the first existing spawn (they should all have the same content)
      const firstSpawnContent = conditionalSpawns.length > 0 ? conditionalSpawns[0].content : '';
      const safeCopyContent = firstSpawnContent && firstSpawnContent.trim() ? firstSpawnContent.trim() : '';
      const contentToCopy = safeCopyContent || 'Default spawn content';
      
      // Additional safety check
      if (!contentToCopy || contentToCopy.trim() === '') {
        throw new Error('Cannot create spawn with empty content');
      }
      
      const newSpawn = await apiFetch('/api/strings/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentToCopy,
          variable_name: null, // Explicitly set to null to let backend generate random hash
          is_conditional: editingNestedString.is_conditional,
          project: parseInt(id as string),
        }),
      });

      // Create dimension value for the new spawn using the generated hash
      const spawnVariableName = newSpawn.effective_variable_name || newSpawn.variable_hash;
      await apiFetch('/api/dimension-values/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimension: existingDimension.id,
          value: spawnVariableName,
        }),
      });

      // Add to local state
      setConditionalSpawns(prev => [...prev, newSpawn]);
      
      toast.success(`Added new spawn "${spawnVariableName}"`);
    } catch (err) {
      console.error('Failed to add spawn:', err);
      toast.error('Failed to add spawn. Please try again.');
    }
  };

  const removeConditionalSpawn = async (spawnId: number) => {
    if (conditionalSpawns.length <= 1) {
      toast.error('Cannot remove the last spawn. A conditional must have at least one spawn.');
      return;
    }

    try {
      await apiFetch(`/api/strings/${spawnId}/`, {
        method: 'DELETE',
      });

      // Remove from local state
      setConditionalSpawns(prev => prev.filter(spawn => spawn.id !== spawnId));
      
      toast.success('Spawn removed successfully');
    } catch (err) {
      console.error('Failed to remove spawn:', err);
      toast.error('Failed to remove spawn. Please try again.');
    }
  };

  const handleCreateConditional = async (str: any) => {
    const conditionalName = str.effective_variable_name || str.variable_hash;
    const isConditionalContainer = str.is_conditional_container;

    try {
      if (isConditionalContainer) {
        // This is already a conditional - add one more spawn
        
        // Step 1: Find the existing dimension for this conditional
        const existingDimension = project.dimensions?.find((dim: any) => dim.name === conditionalName);
        if (!existingDimension) {
          throw new Error('Cannot find dimension for conditional');
        }

        // Step 2: Find all existing spawns for this conditional
        const existingSpawns = findSpawnsForConditional(conditionalName);

        // Step 3: Determine the next spawn number
        let nextSpawnNumber = 1;
        if (existingSpawns.length > 0) {
          const spawnNumbers = existingSpawns.map((spawn: any) => {
            const effectiveName = spawn.effective_variable_name || spawn.variable_hash;
            const match = effectiveName.match(/_(\d+)$/);
            return match ? parseInt(match[1]) : 0;
          });
          nextSpawnNumber = Math.max(...spawnNumbers) + 1;
        }

        // Step 4: Create the new spawn name
        const newSpawnName = `${conditionalName}_${nextSpawnNumber}`;
        
        // Step 5: Get content from the first existing spawn (they should all have the same content)
        const firstSpawnContent = existingSpawns.length > 0 ? existingSpawns[0].content : '';
        const safeCopyContent = firstSpawnContent && firstSpawnContent.trim() ? firstSpawnContent.trim() : '';
        const contentToCopy = safeCopyContent || `Content for ${newSpawnName}`;
        
        // Additional safety check
        if (!contentToCopy || contentToCopy.trim() === '') {
          throw new Error('Cannot create spawn with empty content');
        }

        // Step 6: Create the new spawn
        const newSpawnResponse = await apiFetch('/api/strings/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: contentToCopy,
            variable_name: newSpawnName,
            is_conditional: str.is_conditional,
            project: parseInt(id as string),
          }),
        });

        if (!newSpawnResponse.ok) {
          throw new Error('Failed to create new spawn');
        }

        // Step 7: Create dimension value for the new spawn
        const newDimValueResponse = await apiFetch('/api/dimension-values/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dimension: existingDimension.id,
            value: newSpawnName,
          }),
        });

        if (!newDimValueResponse.ok) {
          throw new Error('Failed to create dimension value for new spawn');
        }

        // Refresh the project data
        const updatedProject = await apiFetch(`/api/projects/${id}/`);
        setProject(sortProjectStrings(updatedProject));
        
        toast.success(`Added new spawn "${newSpawnName}" to conditional "${conditionalName}"`);

      } else {
        // This is a regular string - perform initial split
        
        if (!str.content.trim()) {
          toast.error("Cannot split an empty string");
          return;
        }

        const originalContent = str.content;

        // Step 1: Check if dimension already exists, create if not
        let newDimension = project.dimensions?.find((dim: any) => dim.name === conditionalName);
        
        if (!newDimension) {
          console.log('Creating new dimension:', conditionalName);
          try {
            newDimension = await apiFetch('/api/dimensions/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: conditionalName,
              project: parseInt(id as string),
            }),
          });
          } catch (dimensionError: any) {
            const errorStr = dimensionError.message || JSON.stringify(dimensionError) || String(dimensionError);
            if (errorStr.includes('unique set') || errorStr.includes('must make a unique set')) {
              console.log(`Dimension "${conditionalName}" already exists, fetching existing one...`);
              // Refresh project data to get the existing dimension
              const updatedProject = await apiFetch(`/api/projects/${id}/`);
              setProject(sortProjectStrings(updatedProject));
              newDimension = updatedProject.dimensions?.find((dim: any) => dim.name === conditionalName);
              if (!newDimension) {
                throw new Error('Failed to find existing dimension after refresh');
              }
            } else {
              throw dimensionError;
            }
          }
        } else {
          console.log('Using existing dimension:', conditionalName);
        }

        // Step 2: Create two new string variables with the original content (check if they exist first)
        const stringVar1Name = `${conditionalName}_1`;
        const stringVar2Name = `${conditionalName}_2`;

        const stringPromises = [
          // Check and create first string variable
          (async () => {
            const existingString = project.strings?.find((s: any) => {
              const effectiveName = s.effective_variable_name || s.variable_hash;
              return effectiveName === stringVar1Name || s.variable_name === stringVar1Name;
            });
            
            if (!existingString) {
              console.log('Creating string variable:', stringVar1Name);
              return apiFetch('/api/strings/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content: originalContent,
                  variable_name: stringVar1Name,
                  is_conditional: str.is_conditional,
                  project: parseInt(id as string),
                }),
              });
            } else {
              console.log('String variable already exists:', stringVar1Name);
              return Promise.resolve(existingString);
            }
          })(),
          // Check and create second string variable
          (async () => {
            const existingString = project.strings?.find((s: any) => {
              const effectiveName = s.effective_variable_name || s.variable_hash;
              return effectiveName === stringVar2Name || s.variable_name === stringVar2Name;
            });
            
            if (!existingString) {
              console.log('Creating string variable:', stringVar2Name);
              return apiFetch('/api/strings/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content: originalContent,
                  variable_name: stringVar2Name,
                  is_conditional: str.is_conditional,
                  project: parseInt(id as string),
                }),
              });
            } else {
              console.log('String variable already exists:', stringVar2Name);
              return Promise.resolve(existingString);
            }
          })(),
        ];

        const [string1Response, string2Response] = await Promise.all(stringPromises);

        // Check if responses are API responses (have .ok property) and validate them
        if ((string1Response.ok !== undefined && !string1Response.ok) || 
            (string2Response.ok !== undefined && !string2Response.ok)) {
          throw new Error('Failed to create new string variables');
        }

        // Step 3: Create dimension values for the new string variables (check if they exist first)
        const dimValuePromises = [
          // Check and create first dimension value
          (async () => {
            const existingDimValue = newDimension.values?.find((dv: any) => dv.value === stringVar1Name);
            if (!existingDimValue) {
              console.log('Creating dimension value:', stringVar1Name);
              return apiFetch('/api/dimension-values/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  dimension: newDimension.id,
                  value: stringVar1Name,
                }),
              });
            } else {
              console.log('Dimension value already exists:', stringVar1Name);
              return Promise.resolve(existingDimValue);
            }
          })(),
          // Check and create second dimension value
          (async () => {
            const existingDimValue = newDimension.values?.find((dv: any) => dv.value === stringVar2Name);
            if (!existingDimValue) {
              console.log('Creating dimension value:', stringVar2Name);
              return apiFetch('/api/dimension-values/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  dimension: newDimension.id,
                  value: stringVar2Name,
                }),
              });
            } else {
              console.log('Dimension value already exists:', stringVar2Name);
              return Promise.resolve(existingDimValue);
            }
          })(),
        ];

        const [dimValue1Response, dimValue2Response] = await Promise.all(dimValuePromises);

        // Check if responses are API responses (have .ok property) and validate them
        if ((dimValue1Response.ok !== undefined && !dimValue1Response.ok) || 
            (dimValue2Response.ok !== undefined && !dimValue2Response.ok)) {
          throw new Error('Failed to create dimension values');
        }

        // Step 4: Convert the original string to a conditional (if not already)
        if (!str.is_conditional_container) {
          console.log('Converting original string to conditional');
          const conditionalContent = `[Conditional: ${conditionalName}]`;
          const updateResponse = await apiFetch(`/api/strings/${str.id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: conditionalContent, // Provide descriptive content for conditional
              variable_name: str.variable_name || conditionalName,
              is_conditional: str.is_conditional,
              is_conditional_container: true, // Mark as conditional
            }),
          });

          if (!updateResponse.ok) {
            throw new Error('Failed to update original string');
          }
        } else {
          console.log('Original string is already a conditional');
        }

        // Refresh the project data
        const updatedProject = await apiFetch(`/api/projects/${id}/`);
        setProject(sortProjectStrings(updatedProject));
        
        toast.success(`Split "${conditionalName}" into ${stringVar1Name} and ${stringVar2Name}`);
      }
      
    } catch (error) {
      console.error('Error splitting string:', error);
      toast.error("Failed to split string");
    }
  };

  // Handle text selection in textarea
  const handleTextSelection = () => {
    if (!textareaRef) return;
    
    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    const selected = stringContent.substring(start, end);
    
    setSelectedText(selected);
    setSelectionStart(start);
    setSelectionEnd(end);
  };

  // Helper functions for dimension value management
  const addDimensionValueToString = (dimensionId: number, value: string) => {
    setStringDimensionValues(prev => ({
      ...prev,
      [dimensionId]: [...(prev[dimensionId] || []), value]
    }));
    setOpenDimensionPopover(null);
    setDimensionFilterText(prev => ({ ...prev, [dimensionId]: '' }));
  };

  const getAvailableDimensionValues = (dimension: any, filterText: string = '') => {
    const allValues = dimension.values ? dimension.values.map((dv: any) => dv.value) : [];
    const selectedValues = stringDimensionValues[dimension.id] || [];
    const availableValues = allValues.filter((value: string) => !selectedValues.includes(value));
    
    if (!filterText) return availableValues;
    
    return availableValues.filter((value: string) => 
      value.toLowerCase().includes(filterText.toLowerCase())
    );
  };

  const getFilterText = (dimensionId: number) => dimensionFilterText[dimensionId] || '';

  const shouldShowCreateOption = (dimensionId: number) => {
    const filterText = getFilterText(dimensionId);
    if (!filterText.trim()) return false;
    
    const dimension = project.dimensions?.find((d: any) => d.id === dimensionId);
    if (!dimension) return false;
    
    const allValues = dimension.values ? dimension.values.map((dv: any) => dv.value) : [];
    const selectedValues = stringDimensionValues[dimensionId] || [];
    
    return !allValues.includes(filterText.trim()) && !selectedValues.includes(filterText.trim());
  };

  // Insert variable at cursor position or replace selected text
  const insertVariable = (variableName: string) => {
    if (!textareaRef) return;
    
    const variableText = `{{${variableName}}}`;
    
    if (selectedText && selectedText.length > 0) {
      // Replace selected text with variable
      const newContent = 
        stringContent.substring(0, selectionStart) + 
        variableText + 
        stringContent.substring(selectionEnd);
      
      setStringContent(newContent);
      
      // Clear selection state
      setSelectedText("");
      setSelectionStart(0);
      setSelectionEnd(0);
      
      // Focus back to textarea and set cursor after inserted variable
      setTimeout(() => {
        if (textareaRef) {
          textareaRef.focus();
          textareaRef.setSelectionRange(
            selectionStart + variableText.length,
            selectionStart + variableText.length
          );
        }
      }, 0);
    } else {
      // Insert at cursor position (existing behavior)
      const cursorPosition = textareaRef.selectionStart;
      const newContent = 
        stringContent.substring(0, cursorPosition) + 
        variableText + 
        stringContent.substring(cursorPosition);
      
      setStringContent(newContent);
      
      // Focus back to textarea and set cursor after inserted variable
      setTimeout(() => {
        if (textareaRef) {
          textareaRef.focus();
          textareaRef.setSelectionRange(
            cursorPosition + variableText.length,
            cursorPosition + variableText.length
          );
        }
      }, 0);
    }
  };



  // String deletion handlers
  const openDeleteStringDialog = (str: any) => {
    setDeleteStringDialog(str);
  };

  const closeDeleteStringDialog = () => {
    setDeleteStringDialog(null);
  };





  const handleDeleteString = async () => {
    if (!deleteStringDialog) return;

    try {
      await apiFetch(`/api/strings/${deleteStringDialog.id}/`, {
        method: 'DELETE',
      });
      
      toast.success(`String deleted successfully!`);
      
      // Refresh project data to reflect the deletion
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(updatedProject));
      
      // Remove deleted string from selection if it was selected
      setSelectedStringIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(deleteStringDialog.id);
        return newSet;
      });
      
      closeDeleteStringDialog();
    } catch (err) {
      console.error('Failed to delete string:', err);
      toast.error('Failed to delete string. Please try again.');
    }
  };






   // Legacy dimension dialog handlers - REMOVED (no longer needed)

   const openEditDimension = (dimension: any) => {
    // Find the conditional variable that corresponds to this dimension
    const conditionalVariable = project?.strings?.find((str: any) => 
      str.is_conditional_container && 
      (str.effective_variable_name === dimension.name || 
       str.variable_name === dimension.name || 
       str.variable_hash === dimension.name)
    );

    if (conditionalVariable) {
      // Open the unified drawer to edit the conditional variable
      mainDrawer.openDrawer(conditionalVariable);
    } else {
      console.warn(`No conditional variable found for dimension: ${dimension.name}`);
    }
   };

   const closeDimensionDialog = () => {
     setCreateDialog(null);
     setEditingDimension(null);
     setDimensionName("");
     setDimensionValues([]);
     setNewDimensionValue("");
   };

   // Legacy duplicate dimension functions removed - addDimensionValue
     const trimmedValue = newDimensionValue.trim();
     if (!trimmedValue) {
       toast.error('Dimension value cannot be empty');
       return;
     }
     
     // Check for duplicates (case-insensitive)
     if (dimensionValues.some(value => value.toLowerCase() === trimmedValue.toLowerCase())) {
       toast.error(`Dimension value "${trimmedValue}" already exists`);
       return;
     }
     
     setDimensionValues(prev => [...prev, trimmedValue]);
     setNewDimensionValue("");
   };

   const removeDimensionValue = (valueToRemove: string) => {
     setDimensionValues(prev => prev.filter(value => value !== valueToRemove));
   };

   const updateDimensionValue = (oldValue: string, newValue: string) => {
     const trimmedValue = newValue.trim();
     if (!trimmedValue) {
       toast.error('Dimension value cannot be empty');
       return;
     }
     
     // Check for duplicates (case-insensitive), excluding the current value being edited
     if (dimensionValues.some(value => value !== oldValue && value.toLowerCase() === trimmedValue.toLowerCase())) {
       toast.error(`Dimension value "${trimmedValue}" already exists`);
       return;
     }
     
     setDimensionValues(prev => prev.map(value => value === oldValue ? trimmedValue : value));
   };





   // handleDimensionSubmit moved to be with other dimension functions

  // Helper function to detect circular references in string variables
  const detectCircularReferences = (content: string, currentStringId?: number, visited: Set<number> = new Set()): string | null => {
    // Extract variable names from content
    const variableMatches = content.match(/{{([^}]+)}}/g) || [];
    const variableNames = variableMatches.map(match => match.slice(2, -2));
    
    for (const variableName of variableNames) {
      // Find the string variable that matches this variable name
      const stringVariable = project.strings?.find((str: any) => 
        str.effective_variable_name === variableName || 
        str.variable_name === variableName || 
        str.variable_hash === variableName
      );
      
      if (stringVariable) {
        // Check if this would create a self-reference
        if (currentStringId && stringVariable.id === currentStringId) {
          return `String cannot reference itself through variable "{{${variableName}}}"`;
        }
        
        // Check if we've already visited this string (circular reference)
        if (visited.has(stringVariable.id)) {
          const referencePath = Array.from(visited).map(id => {
            const str = project.strings?.find((s: any) => s.id === id);
            return str ? `{{${str.effective_variable_name || str.variable_hash}}}` : 'unknown';
          }).join(' → ');
          return `Circular reference detected: ${referencePath} → {{${variableName}}}`;
        }
        
        // Add current string to visited set and recursively check
        const newVisited = new Set(visited);
        if (currentStringId) newVisited.add(currentStringId);
        newVisited.add(stringVariable.id);
        
        const nestedError = detectCircularReferences(stringVariable.content, stringVariable.id, newVisited);
        if (nestedError) {
          return nestedError;
        }
      }
    }
    
    return null; // No circular reference found
  };

  const handleStringSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Check for circular references before proceeding
      const circularError = detectCircularReferences(stringContent, editingString?.id);
      if (circularError) {
        toast.error(circularError);
        return;
      }
      
      // Auto-detect variables from string content (they should already exist from closeStringDialog)
      const variableMatches = stringContent.match(/{{([^}]+)}}/g) || [];
      const variableNames = variableMatches.map(match => match.slice(2, -2)); // Remove {{ and }}
      const uniqueVariableNames = [...new Set(variableNames)];
      

      
      const stringData = {
        content: stringContent,
        project: id,
        variable_name: stringVariableName || null,
        is_conditional: stringIsConditional,
        is_conditional_container: stringIsConditional, // When marked as conditional, it should also be a conditional container

      };

      let stringResponse;
      if (editingString) {
        // Update existing string
        stringResponse = await apiFetch(`/api/strings/${editingString.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stringData),
        });
        toast.success('String updated successfully!');
      } else {
        // Create new string
        stringResponse = await apiFetch('/api/strings/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stringData),
        });
        toast.success('String created successfully!');
      }

      // Sync dimension/dimension value names when conditional variables or spawns are renamed
      if (editingString && stringVariableName && stringVariableName !== editingString.variable_name) {
        const oldVariableName = editingString.effective_variable_name || editingString.variable_hash || editingString.variable_name;
        const newVariableName = stringVariableName;
        
        if (oldVariableName && oldVariableName !== newVariableName) {
          if (editingString.is_conditional_container) {
            // This is a conditional variable being renamed - update the corresponding dimension
            const dimension = project.dimensions?.find((d: any) => d.name === oldVariableName);
            if (dimension) {
              // Check if target dimension name already exists
              const existingDimensionWithNewName = project.dimensions?.find((d: any) => 
                d.name === newVariableName && d.id !== dimension.id
              );
              
              if (existingDimensionWithNewName) {
                console.warn(`Cannot rename dimension from "${oldVariableName}" to "${newVariableName}" - dimension name already exists`);
                toast.error(`Cannot rename to "${newVariableName}" - a dimension with this name already exists`);
              } else {
                try {
                  await apiFetch(`/api/dimensions/${dimension.id}/`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newVariableName }),
                  });
                  console.log(`Updated dimension name from "${oldVariableName}" to "${newVariableName}"`);
                  
                  // Update local project state immediately for consistency
                  setProject((prev: any) => prev ? {
                    ...prev,
                    dimensions: prev.dimensions?.map((d: any) => 
                      d.id === dimension.id ? { ...d, name: newVariableName } : d
                    )
                  } : prev);

                  // CRITICAL: Preserve spawn string names when conditional is renamed
                  // The backend sync_conditional_dimension might reset spawn names to hashes
                  // So we need to ensure all spawn strings keep their variable_name set
                  console.log('🔍 DEBUG: Starting spawn name preservation...');
                  console.log('🔍 DEBUG: Dimension being renamed:', dimension);
                  
                  const spawnStrings = project.strings?.filter((s: any) => {
                    return s.dimension_values?.some((sdv: any) => 
                      sdv.dimension_value?.dimension?.id === dimension.id
                    );
                  }) || [];

                  console.log(`🔍 DEBUG: Found ${spawnStrings.length} spawn strings to preserve:`, spawnStrings.map((s: any) => ({
                    id: s.id,
                    variable_name: s.variable_name,
                    variable_hash: s.variable_hash,
                    effective_name: s.effective_variable_name || s.variable_hash
                  })));
                  
                  // Store spawn names before any backend operations
                  const spawnNameMap = new Map();
                  spawnStrings.forEach((spawn: any) => {
                    if (spawn.variable_name) {
                      spawnNameMap.set(spawn.id, spawn.variable_name);
                      console.log(`🔍 DEBUG: Storing spawn name mapping: ${spawn.id} -> ${spawn.variable_name}`);
                    }
                  });
                  
                  // Wait a bit for backend signals to complete
                  await new Promise(resolve => setTimeout(resolve, 100));
                  
                  // Re-fetch project to see current state after backend operations
                  const latestProject = await apiFetch(`/api/projects/${id}/`);
                  console.log('🔍 DEBUG: Re-fetched project after backend signals');
                  
                  // Check each spawn and restore name if it was changed
                  for (const [spawnId, originalName] of spawnNameMap.entries()) {
                    const currentSpawn = latestProject.strings?.find((s: any) => s.id === spawnId);
                    if (currentSpawn) {
                      console.log(`🔍 DEBUG: Checking spawn ${spawnId}:`, {
                        originalName,
                        currentVariableName: currentSpawn.variable_name,
                        currentHash: currentSpawn.variable_hash,
                        currentEffective: currentSpawn.effective_variable_name || currentSpawn.variable_hash
                      });
                      
                      if (currentSpawn.variable_name !== originalName) {
                        console.log(`🚨 DEBUG: Spawn name changed! Restoring ${originalName} for spawn ${spawnId}`);
                        try {
                          await apiFetch(`/api/strings/${spawnId}/`, {
                            method: 'PATCH', 
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              variable_name: originalName
                            }),
                          });
                          console.log(`✅ DEBUG: Successfully restored spawn name: ${originalName}`);
                        } catch (err) {
                          console.error(`❌ DEBUG: Failed to restore spawn name for ${originalName}:`, err);
                        }
                      } else {
                        console.log(`✅ DEBUG: Spawn name unchanged: ${originalName}`);
                      }
                    }
                  }
                } catch (err) {
                  console.error('Failed to update dimension name:', err);
                  toast.error(`Failed to update dimension name: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  // Don't fail the entire operation for this
                }
              }
            }
          } else {
            // This might be a spawn string being renamed - update the corresponding dimension value
            // Find if this string is a spawn for any conditional by checking dimension values
            for (const dimension of project.dimensions || []) {
              const dimensionValue = dimension.values?.find((dv: any) => dv.value === oldVariableName);
              if (dimensionValue) {
                try {
                  await apiFetch(`/api/dimension-values/${dimensionValue.id}/`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value: newVariableName }),
                  });
                  console.log(`Updated dimension value from "${oldVariableName}" to "${newVariableName}" in dimension "${dimension.name}"`);
                  break; // Only update the first match
                } catch (err) {
                  console.error('Failed to update dimension value:', err);
                  // Don't fail the entire operation for this
                }
              }
            }
          }
        }
      }

      // Handle dimension values - only manage manually added values
      // The backend will automatically handle inherited values from variables
      const stringId = stringResponse.id || editingString?.id;
      if (stringId) {
        // Get current dimension values and only delete ones that aren't in our new set
        const existingDimensionValues = await apiFetch(`/api/string-dimension-values/?string=${stringId}`);
        
        // Build a set of dimension values that should exist (from our form)
        const newDimensionValueSet = new Set();
        for (const [dimensionId, values] of Object.entries(stringDimensionValues)) {
          if (values && values.length > 0) {
            const dimension = project.dimensions?.find((d: any) => d.id.toString() === dimensionId);
            if (dimension) {
              for (const value of values) {
                if (value.trim()) {
                  newDimensionValueSet.add(`${dimensionId}:${value.trim()}`);
                }
              }
            }
          }
        }
        
        // Delete existing dimension values that are not in our new set and not inherited
        for (const dv of existingDimensionValues) {
          // Safety check for dimension_value structure
          if (!dv.dimension_value || !dv.dimension_value.dimension) {
            continue;
          }
          const dimensionId = dv.dimension_value.dimension;
          const dimensionValue = dv.dimension_value.value;
          const key = `${dimensionId}:${dimensionValue}`;
          
          // Only delete if this value is not in our new set AND it's not inherited
          if (!newDimensionValueSet.has(key)) {
            const isInherited = isDimensionValueInheritedFromVariables(dimensionId, dimensionValue);
            if (!isInherited) {
              await apiFetch(`/api/string-dimension-values/${dv.id}/`, {
                method: 'DELETE',
              });
            }
          }
        }

        // Create new manually added dimension values (skip inherited ones)
        for (const [dimensionId, values] of Object.entries(stringDimensionValues)) {
          if (values && values.length > 0) {
            const dimension = project.dimensions?.find((d: any) => d.id.toString() === dimensionId);
            if (dimension) {
              for (const value of values) {
                if (value.trim()) {
                  // Check if this dimension value already exists (either manually or inherited)
                  const existingAssignment = existingDimensionValues.find((dv: any) => 
                    dv.dimension_value && 
                    dv.dimension_value.dimension === parseInt(dimensionId) && 
                    dv.dimension_value.value === value.trim()
                  );
                  
                  if (!existingAssignment) {
                    let dimensionValue = dimension.values?.find((dv: any) => dv.value === value.trim());
                    
                    if (!dimensionValue) {
                      // Create new dimension value
                      dimensionValue = await apiFetch('/api/dimension-values/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          dimension: dimensionId,
                          value: value.trim(),
                        }),
                      });
                    }

                    // Create string-dimension-value relationship
                    await apiFetch('/api/string-dimension-values/', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        string: stringId,
                        dimension_value: dimensionValue.id,
                      }),
                    });
                  }
                }
              }
            }
          }
        }
      }



      // Refresh project data
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(updatedProject));
      await closeStringDialog();
    } catch (err) {
      console.error('Failed to save string:', err);
      toast.error('Failed to save string. Please try again.');
    }
  };

  // Helper function to find spawns for a conditional using dimension relationships
  const findSpawnsForConditional = (conditionalName: string) => {
    // Find the dimension for this conditional
    const dimension = project.dimensions?.find((d: any) => d.name === conditionalName);
    
    if (dimension && dimension.values) {
      // Get all spawn variable names from dimension values
      const spawnVariableNames = dimension.values.map((dv: any) => dv.value);
      
      // Find all strings that match these spawn variable names
      // NOTE: A string can be both a spawn AND a conditional container (nested conditionals)
      return project.strings?.filter((s: any) => {
        const effectiveName = s.effective_variable_name || s.variable_hash;
        return spawnVariableNames.includes(effectiveName);
      }) || [];
    }
    
    return [];
  };

  // Helper function to get variable value with dimension precedence
  const getVariableValueWithDimensionPrecedence = (variable: any) => {
    // Check for dimension values only
    for (const [dimensionId, selectedValue] of Object.entries(selectedDimensionValues)) {
      if (selectedValue) {
        // Find dimension value in this variable's dimension values
        const varDimValue = variable.dimension_values?.find((vdv: any) => {
          // Get the dimension value object to check its value and dimension
          const dimensionValueObj = project.dimensions
            ?.find((d: any) => d.id.toString() === dimensionId)
            ?.values?.find((dv: any) => dv.value === selectedValue);
          
          return dimensionValueObj && vdv.dimension_value === dimensionValueObj.id;
        });
        
        if (varDimValue) {
          // Process any embedded variables in the dimension value
          return processVariableContent(varDimValue.value);
        }
      }
    }
    
    // Return null (will show as {{variableName}})
    return null;
  };

  // Helper function to process content that may contain embedded variables
  const processVariableContent = (content: string, depth: number = 0): string => {
    // Prevent infinite recursion
    if (depth > 10 || !content) {
      return content || '';
    }
    
    // Find all variables in the content
    const variableMatches = content.match(/{{([^}]+)}}/g) || [];
    
    if (variableMatches.length === 0) {
      return content;
    }
    
    let processedContent = content;
    
    for (const match of variableMatches) {
      const variableName = match.slice(2, -2);
      
      // Try string variable
      const stringVariable = project.strings?.find((str: any) => 
        str.effective_variable_name === variableName || 
        str.variable_name === variableName || 
        str.variable_hash === variableName
      );
      
      if (stringVariable) {
        let replacement;
        
        // Handle conditional variables with dimension-based spawn selection
        if (stringVariable.is_conditional_container) {
          // Find the dimension that corresponds to this conditional variable
          const correspondingDimension = project.dimensions?.find((d: any) => 
            d.name === stringVariable.effective_variable_name
          );
          
          if (correspondingDimension) {
            // Check if user has selected a specific spawn for this dimension
            const selectedSpawn = selectedDimensionValues[correspondingDimension.id];
            
            if (selectedSpawn) {
              // Find the specific spawn variable
              const spawnVariable = project.strings?.find((str: any) => 
                str.effective_variable_name === selectedSpawn
              );
              
              if (spawnVariable) {
                replacement = processVariableContent(spawnVariable.content, depth + 1);
              } else {
                // Fallback to conditional variable name if spawn not found
                replacement = `{{${variableName}}}`;
              }
            } else {
              // No specific spawn selected, show the conditional variable name
              replacement = `{{${variableName}}}`;
            }
          } else {
            // No corresponding dimension found, show as variable name
            replacement = `{{${variableName}}}`;
          }
        } else {
          // Regular string variable, process normally
          replacement = processVariableContent(stringVariable.content, depth + 1);
        }
        
        const regex = new RegExp(`{{${variableName}}}`, 'g');
        processedContent = processedContent.replace(regex, replacement);
      }
    }
    
    return processedContent;
  };



  // Helper function to check if a variable has any value (dimension only)
  const variableHasAnyValue = (variable: any) => {
    // Check dimension values only
    for (const [dimensionId, selectedValue] of Object.entries(selectedDimensionValues)) {
      if (selectedValue) {
        const dimensionValueObj = project.dimensions
          ?.find((d: any) => d.id.toString() === dimensionId)
          ?.values?.find((dv: any) => dv.value === selectedValue);
        
        const varDimValue = variable.dimension_values?.find((vdv: any) => 
          dimensionValueObj && vdv.dimension_value === dimensionValueObj.id
        );
        
        if (varDimValue) {
          return true;
        }
      }
    }
    
    // Return false (no value to show, will display as {{variableName}})
    return false;
  };


  // Recursive function to render content with proper variable substitution and styling

  // Function to render content with badge styling for variables
  const renderStyledContent = (content: string, stringVariables: any[], stringId?: string) => {
    return renderContentRecursively(content, 0, stringId ? `str-${stringId}-` : "");
  };

  // Filter strings based on selected dimension values
  // Project edit/delete handlers
  const openEditProject = () => {
    setProjectName(project.name);
    setProjectDescription(project.description || "");
    setEditingProject(project);
  };

  const closeProjectDialog = () => {
    setEditingProject(null);
    setProjectName("");
    setProjectDescription("");
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedProject = await apiFetch(`/api/projects/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
        }),
      });
      setProject(updatedProject);
      closeProjectDialog();
      toast.success('Project updated successfully');
    } catch (err) {
      console.error('Failed to update project:', err);
      toast.error('Failed to update project');
    }
  };

  const handleDeleteProject = async () => {
    try {
      await apiFetch(`/api/projects/${id}/`, {
        method: 'DELETE',
      });
      toast.success('Project deleted successfully');
      // Redirect to homepage
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to delete project:', err);
      toast.error('Failed to delete project');
    }
  };

  const handleDuplicateProject = async () => {
    try {
      toast.loading("Duplicating project...");
      const duplicatedProject = await apiFetch(`/api/projects/${id}/duplicate/`, {
        method: "POST",
      });
      
      toast.dismiss();
      toast.success(`Project duplicated successfully!`);
      
      // Navigate to the new project
      router.push(`/projects/${duplicatedProject.id}`);
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || "Failed to duplicate project");
    }
  };

  const handleDownloadCSV = async () => {
    setDownloadLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/projects/${project.id}/download-csv/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': document.cookie.split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1] || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          selected_dimension_values: selectedDimensionValues,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to download CSV');
      }

      // Get the filename from the response headers
      const disposition = response.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] || `${project.name}_filtered_strings.csv`;
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('CSV downloaded successfully');
      setDownloadDialog(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to download CSV');
    } finally {
      setDownloadLoading(false);
    }
  };

  // Helper function to identify strings that are embedded in other strings
  const getEmbeddedStringIds = (strings: any[]): Set<number> => {
    const embeddedIds = new Set<number>();
    
    strings.forEach(str => {
      if (str.content) {
        // Find all {{variableName}} patterns in the string content
        const variableMatches = str.content.match(/{{([^}]+)}}/g) || [];
        
        variableMatches.forEach((match: string) => {
          const variableName = match.slice(2, -2).trim();
          
          // Find strings that match this variable name
          const referencedStrings = strings.filter(s => {
            const effectiveName = s.effective_variable_name || s.variable_hash;
            return effectiveName === variableName || 
                   s.variable_name === variableName || 
                   s.variable_hash === variableName;
          });
          
          // Add these strings to the embedded set
          referencedStrings.forEach(referencedStr => {
            embeddedIds.add(referencedStr.id);
        });
      });
      }
    });
    
    return embeddedIds;
  };



  // Show all strings (no dimension filtering - dimensions now control spawn selection instead)
  const filteredStrings = project?.strings || [];

  // Bulk selection helper functions
  const handleSelectString = (stringId: number, checked: boolean) => {
    setSelectedStringIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(stringId);
      } else {
        newSet.delete(stringId);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedStringIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedStringIds.size === 0) return;

    const totalCount = selectedStringIds.size;
    let successCount = 0;
    let failureCount = 0;
    const failedStrings: { id: string; error: string }[] = [];

    try {
      // Process deletions sequentially to avoid dependency conflicts
      for (const stringId of Array.from(selectedStringIds)) {
        try {
          await apiFetch(`/api/strings/${stringId}/`, {
            method: 'DELETE',
          });
          
          successCount++;
        } catch (fetchError) {
          failedStrings.push({ 
            id: String(stringId), 
            error: fetchError instanceof Error ? fetchError.message : 'Network error'
          });
          failureCount++;
        }
      }

      // Refresh project data
      const projectData = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(projectData));
      clearSelection();
      closeBulkDeleteDialog();
      
      // Provide detailed feedback
      if (failureCount === 0) {
        toast.success(`Successfully deleted all ${successCount} strings`);
      } else if (successCount > 0) {
        toast.success(`Deleted ${successCount} strings. ${failureCount} failed.`);
        console.warn('Failed to delete strings:', failedStrings);
      } else {
        toast.error(`Failed to delete all ${failureCount} strings`);
        console.error('All deletions failed:', failedStrings);
      }
    } catch (error) {
      console.error('Error during bulk delete:', error);
      toast.error('Bulk delete operation failed');
    }
  };

  // Import strings handlers
  const openImportDialog = () => {
    setImportDialog(true);
    setImportFile(null);
  };

  const closeImportDialog = () => {
    setImportDialog(false);
    setImportFile(null);
    setImportLoading(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setImportFile(file);
    } else {
      toast.error('Please select a valid CSV file');
      event.target.value = '';
    }
  };

  const extractVariablesFromContent = (content: string): string[] => {
    const variableMatches = content.match(/{{([^}]+)}}/g) || [];
    return variableMatches.map(match => match.slice(2, -2).trim()).filter(name => name.length > 0);
  };

  const handleImportStrings = async () => {
    if (!importFile) return;

    setImportLoading(true);
    try {
      // Read CSV file
      const csvText = await importFile.text();
      const lines = csvText.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        toast.error('CSV file appears to be empty');
        return;
      }

      // Process each line as a string (treating each cell as a separate string)
      const allStrings: string[] = [];
      const allVariables = new Set<string>();
      
      lines.forEach(line => {
        // Simple CSV parsing - split by comma and handle quoted values
        const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          .map(cell => cell.trim().replace(/^"|"$/g, ''));
        
        cells.forEach(cell => {
          if (cell.trim()) {
            allStrings.push(cell.trim());
            // Extract variables from this string
            const variables = extractVariablesFromContent(cell.trim());
            variables.forEach(variable => allVariables.add(variable));
          }
        });
      });

      if (allStrings.length === 0) {
        toast.error('No valid strings found in CSV file');
        return;
      }





      // Create strings
      let createdStringsCount = 0;
      const stringPromises = allStrings.map(async (stringContent) => {
        try {
          await apiFetch('/api/strings/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: stringContent,
              project: id,
            }),
          });
          createdStringsCount++;
        } catch (err) {
          console.error(`Failed to create string: ${stringContent}`, err);
        }
      });

      await Promise.all(stringPromises);

      // Refresh project data
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(updatedProject));

      // Show success message
      toast.success(`Import complete! Created ${createdStringsCount} strings`);

      closeImportDialog();
    } catch (error) {
      console.error('Error importing strings:', error);
      toast.error('Failed to import strings. Please try again.');
    } finally {
      setImportLoading(false);
    }
  };



  // Helper function to check if a dimension value is inherited from variables in the string content
  const isDimensionValueInheritedFromVariables = (dimensionId: number, dimensionValue: string, content?: string, visited = new Set<number>()): boolean => {
    // Return false if project is not loaded yet
    if (!project) return false;
    
    // Use provided content or current string content
    const checkContent = content || stringContent;
    
    // Extract variable names from content
    const variableMatches = checkContent.match(/{{([^}]+)}}/g) || [];
    const variableNames = variableMatches.map(match => match.slice(2, -2));
    
    for (const variableName of variableNames) {

      
      // Check string variables
      const stringVariable = project.strings?.find((str: any) => 
        str.effective_variable_name === variableName || 
        str.variable_name === variableName || 
        str.variable_hash === variableName
      );
      if (stringVariable) {
        // Prevent infinite recursion
        if (visited.has(stringVariable.id)) {
          continue;
        }
        
        // Check if the string variable has this dimension value directly
        if (stringVariable.dimension_values) {
          const hasValue = stringVariable.dimension_values.some((dv: any) => 
            dv.dimension_value && 
            dv.dimension_value.dimension === dimensionId && 
            dv.dimension_value.value === dimensionValue
          );
          if (hasValue) {
            return true;
          }
        }
        
        // Recursively check the string variable's content for inherited values
        const newVisited = new Set(visited);
        newVisited.add(stringVariable.id);
        const inheritedFromNested = isDimensionValueInheritedFromVariables(
          dimensionId, 
          dimensionValue, 
          stringVariable.content, 
          newVisited
        );
        if (inheritedFromNested) {
          return true;
        }
      }
    }
    
    return false;
  };

  LEGACY CODE BLOCK END */

  // Project management functions (moved from legacy block)
  const openEditProject = () => {
    setProjectName(project.name);
    setProjectDescription(project.description || "");
    setEditingProject(project);
  };

  const openImportDialog = () => {
    setImportDialog(true);
  };

  // Legacy dimension dialog functions - keeping for backward compatibility
  const openCreateDimension = () => {
    setDimensionName("");
    setDimensionValues([]);
    setNewDimensionValue("");
    setEditingDimension(null);
    setCreateDialog("Dimension");
  };

  const closeDimensionDialog = () => {
    setCreateDialog(null);
    setEditingDimension(null);
    setDimensionName("");
    setDimensionValues([]);
    setNewDimensionValue("");
  };

  const addDimensionValue = () => {
    const trimmedValue = newDimensionValue.trim();
    if (!trimmedValue) {
      toast.error('Please enter a dimension value');
      return;
    }
    
    // Check for duplicates (case-insensitive)
    if (dimensionValues.some(value => value.toLowerCase() === trimmedValue.toLowerCase())) {
      toast.error(`Dimension value "${trimmedValue}" already exists`);
      return;
    }
    
    setDimensionValues(prev => [...prev, trimmedValue]);
    setNewDimensionValue("");
  };

  const removeDimensionValue = (valueToRemove: string) => {
    setDimensionValues(prev => prev.filter(value => value !== valueToRemove));
  };

  const updateDimensionValue = (oldValue: string, newValue: string) => {
    const trimmedValue = newValue.trim();
    if (!trimmedValue) {
      toast.error('Dimension value cannot be empty');
      return;
    }
    
    // Check for duplicates (case-insensitive), excluding the current value being edited
    if (dimensionValues.some(value => value !== oldValue && value.toLowerCase() === trimmedValue.toLowerCase())) {
      toast.error(`Dimension value "${trimmedValue}" already exists`);
      return;
    }
    
    setDimensionValues(prev => prev.map(value => value === oldValue ? trimmedValue : value));
  };

  const handleDimensionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!dimensionName.trim()) {
      toast.error('Dimension name is required');
      return;
    }

    // Frontend validation for duplicate dimension names
    if (!editingDimension) {
      // For new dimensions, check if name already exists
      const existingDimension = project.dimensions?.find(
        (d: any) => d.name.toLowerCase() === dimensionName.trim().toLowerCase()
      );
      if (existingDimension) {
        toast.error(`A dimension with the name "${dimensionName.trim()}" already exists in this project.`);
        return;
      }
    } else {
      // For editing dimensions, check if name conflicts with other dimensions
      const existingDimension = project.dimensions?.find(
        (d: any) => d.name.toLowerCase() === dimensionName.trim().toLowerCase() && d.id !== editingDimension.id
      );
      if (existingDimension) {
        toast.error(`A dimension with the name "${dimensionName.trim()}" already exists in this project.`);
        return;
      }
    }

    try {
      let dimensionResponse;
      
      if (editingDimension) {
        // Update existing dimension
        dimensionResponse = await apiFetch(`/api/dimensions/${editingDimension.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: dimensionName.trim(),
          }),
        });
        toast.success(`Updated dimension "${dimensionName}"`);
      } else {
        // Create new dimension
        dimensionResponse = await apiFetch('/api/dimensions/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: dimensionName.trim(),
            project: id,
          }),
        });
        toast.success(`Created dimension "${dimensionName}"`);
      }

      const dimensionId = dimensionResponse.id || editingDimension?.id;

      // Handle dimension values - simplified approach: delete all existing and recreate
      if (editingDimension && editingDimension.values) {
        // Delete all existing dimension values for this dimension
        for (const dimensionValue of editingDimension.values) {
          await apiFetch(`/api/dimension-values/${dimensionValue.id}/`, {
            method: 'DELETE',
          });
        }
      }

      // Create all new dimension values
      for (const value of dimensionValues) {
        if (value.trim()) {
          await apiFetch('/api/dimension-values/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dimension: dimensionId,
              value: value.trim(),
            }),
          });
        }
      }

      // Refresh project data
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(updatedProject));

      closeDimensionDialog();
    } catch (err: any) {
      console.error('Failed to save dimension:', err);
      
      // Check if it's a validation error about duplicate names
      if (err.message && err.message.includes('already exists')) {
        toast.error(err.message);
      } else {
        toast.error('Failed to save dimension. Please try again.');
      }
    }
  };

  const handleDuplicateProject = async () => {
    console.warn('Project duplication feature temporarily disabled');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Project Header - Sticky */}
      <div className="flex items-center justify-between px-6 py-4 bg-background border-b sticky top-0 z-10">
        <h1 className="text-xl font-semibold flex-1 truncate">{project.name}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openEditProject}
          >
            Edit Project
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={openImportDialog}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Strings
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setDownloadDialog(true)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleDuplicateProject}
              >
                <Copy className="h-4 w-4 mr-2" />
                Duplicate Project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeleteProjectDialog(true)}
                className="text-red-600 focus:text-red-600"
              >
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Filter Sidebar (left) */}
        <aside className="w-90 border-r bg-muted/40 flex flex-col">
          {/* Filter Header - Sticky */}
          <div className="flex items-center justify-between gap-4 border-b px-6 py-4 bg-background min-h-[65px] sticky top-0 z-10">
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>
          {/* Filter Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Conditions Section */}
          <div className="space-y-3">
            <div className="group">
              <div className="flex items-center justify-between w-full hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">Conditions</h3>
                </div>
                {/* Plus button removed - conditions are created via conditional variables now */}
              </div>
            </div>
            {/* Conditional Variable Filters - NEW: Direct conditional variable display */}
            {(() => {
              // Get all conditional variables from the project
              const conditionalVariables = project?.strings?.filter((str: any) => str.is_conditional_container) || [];
              
              return conditionalVariables.length > 0 ? (
              <div className="space-y-4 ml-6">
                  {conditionalVariables.map((conditionalVar: any) => {
                    const conditionalName = conditionalVar.effective_variable_name || conditionalVar.variable_hash;
                    const conditionalDisplayName = conditionalVar.display_name || conditionalName;
                    
                    // Find spawns for this conditional variable using multiple methods
                    const dimension = project?.dimensions?.find((d: any) => d.name === conditionalName);
                    
                    // Method 1: Use dimension_values relationship (existing spawns)
                    const spawnsViaDimension = dimension ? project?.strings?.filter((str: any) => 
                      !str.is_conditional_container && 
                      str.dimension_values?.some((dv: any) => dv.dimension === dimension.id)
                    ) || [] : [];
                    
                    // Method 2: Find spawns by naming pattern (fallback for newly created spawns)
                    const spawnsByPattern = project?.strings?.filter((str: any) => {
                      if (str.is_conditional_container) return false;
                      const strName = str.effective_variable_name || str.variable_hash;
                      // Check if this string name appears as a dimension value for this conditional
                      return dimension?.values?.some((dv: any) => dv.value === strName);
                    }) || [];
                    
                    // Combine both methods and remove duplicates
                    const allSpawns = [...spawnsViaDimension, ...spawnsByPattern];
                    const spawns = allSpawns.filter((spawn, index, self) => 
                      index === self.findIndex(s => s.id === spawn.id)
                    );
                    
                    // Debug logging for spawn detection
                    console.log(`🔍 Spawn detection for "${conditionalName}":`, {
                      dimension: dimension,
                      dimensionValues: dimension?.values,
                      spawnsViaDimension: spawnsViaDimension.length,
                      spawnsByPattern: spawnsByPattern.length,
                      totalSpawns: spawns.length,
                      allNonConditionalStrings: project?.strings?.filter(s => !s.is_conditional_container)?.length
                    });
                    
                    // Check if this conditional has a "Hidden" option
                    const hasHiddenOption = dimension?.values?.some((v: any) => v.value === "Hidden") || false;
                    
                    // Get all available spawn options (including Hidden if it exists)
                    const spawnOptions = [...spawns];
                    if (hasHiddenOption) {
                      spawnOptions.push({ 
                        id: 'hidden', 
                        effective_variable_name: 'Hidden',
                        variable_name: 'Hidden',
                        variable_hash: 'Hidden'
                      });
                    }
                    
                    // Ensure there's always a default selection if spawns exist
                    const currentSelection = selectedConditionalSpawns[conditionalName];
                    if (spawnOptions.length > 0 && !currentSelection) {
                      // Set default selection to first spawn
                      const firstSpawn = spawnOptions[0];
                      const firstSpawnName = firstSpawn.effective_variable_name || firstSpawn.variable_name || firstSpawn.variable_hash;
                      
                      // Use setTimeout to avoid state update during render
                      setTimeout(() => {
                        setSelectedConditionalSpawns(prev => ({
                          ...prev,
                          [conditionalName]: firstSpawnName
                        }));
                      }, 0);
                    }
                    
                    return (
                      <div key={conditionalVar.id} className="space-y-3">
                        {/* Conditional Variable Header */}
              <div className="flex items-center justify-between group">
                <div 
                  className="flex items-center justify-between w-full hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 cursor-pointer"
                            onClick={() => mainDrawer.openEditDrawer(conditionalVar)}
                >
                            <h3 className="font-medium text-sm">{conditionalDisplayName}</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                                  mainDrawer.openEditDrawer(conditionalVar);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
                        
                        {/* Spawn Variables (Children) */}
              <div className="flex flex-wrap gap-2">
                          {spawnOptions.map((spawn: any) => {
                            const spawnHash = spawn.effective_variable_name || spawn.variable_name || spawn.variable_hash;
                            const spawnDisplayName = spawn.display_name || spawnHash;
                            const isSelected = selectedConditionalSpawns[conditionalName] === spawnHash;
                  
                  if (isSelected) {
                              // Selected spawn badge with edit icon
                    return (
                      <div
                                  key={spawn.id}
                        className="group inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors bg-blue-100 border-blue-300 text-blue-800"
                      >
                                  <span>{spawnDisplayName}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            mainDrawer.openEditDrawer(spawn);
                          }}
                          className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-200 rounded p-0.5"
                          aria-label="Edit spawn variable"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  } else {
                              // Unselected spawn badge with edit icon
                    return (
                      <div
                                  key={spawn.id}
                        className="group inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs transition-colors hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 cursor-pointer"
                        onClick={() => setSelectedConditionalSpawns(prev => ({
                          ...prev,
                          [conditionalName]: spawnHash
                        }))}
                      >
                                  <span>{spawnDisplayName}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            mainDrawer.openEditDrawer(spawn);
                          }}
                          className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-100 rounded p-0.5"
                          aria-label="Edit spawn variable"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
                    );
                  })}
              </div>
                          ) : (
                <div className="text-muted-foreground text-center text-sm ml-6">
                  No conditional variables found in this project.
                </div>
              );
            })()}
          </div>
          

        </div>
      </aside>

        {/* Main Canvas */}
        <main className="flex-1 flex flex-col items-stretch min-w-0">
          {/* Canvas Header - Sticky */}
          <div className="flex items-center justify-between gap-4 border-b px-6 py-4 bg-background sticky top-0 z-10">
            <h2 className="text-lg font-semibold">Project Strings</h2>
            <div className="flex items-center gap-2">
              {/* Canvas Settings Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCanvasSettingsOpen(true)}
                className="flex items-center gap-2 hover:bg-muted"
              >
                <Settings className="h-4 w-4" />
                Canvas settings
              </Button>
              <Button onClick={openCreateString} size="sm">
                + New String
              </Button>
            </div>
          </div>

          {/* Secondary Header - Bulk Selection */}
          {filteredStrings.length > 0 && (
            <div className="flex items-center gap-3 px-6 py-3 bg-muted/20 border-b">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-muted-foreground">
                  Select all ({filteredStrings.length})
                </span>
              </div>
            </div>
          )}

          {/* Strings List - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
          {filteredStrings.length === 0 ? (
            <div className="text-muted-foreground text-center">
              {(project?.strings || []).length === 0 
                ? "No strings found in this project." 
                : "No strings match the current filters."
              }
            </div>
          ) : (
            <ul className="space-y-4">
              {filteredStrings.map((str: any) => (
                <Card 
                  key={str.id} 
                  className="p-4 flex flex-col gap-3 group hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedStringIds.has(str.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectString(str.id, e.target.checked);
                        }}
                        className="rounded border-gray-300"
                      />
                    </div>
                    
                    {/* String Content - now clickable to edit */}
                    <div 
                      className="flex items-start justify-between gap-2 flex-1 cursor-pointer"
                      onClick={() => openEditInCascadingDrawer(str)}
                    >
                      <div className="flex-1">
                        {/* Variable Name (Display Name) - shown when enabled */}
                        {showVariableNames && str.display_name && (
                          <div className="text-sm font-semibold text-foreground mb-2">
                            {str.display_name}
                          </div>
                        )}
                        
                        <div className={`font-medium text-base ${isPlaintextMode ? 'leading-normal' : 'leading-loose'}`}>
                        {str.is_conditional_container ? (
                          <div className="flex items-center gap-2 text-muted-foreground italic">
                            <Folder className="h-4 w-4" />
                            <span>Split variable - click split to add more spawns</span>
                          </div>
                        ) : renderStyledContent(str.content, str.variables || [], str.id)
                        }
                        </div>
                        
                        {/* Variable hash badge - shown when enabled and not in plaintext mode */}
                        {!isPlaintextMode && showVariableHashes && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`cursor-pointer hover:bg-muted text-xs font-mono flex items-center gap-1 ${
                              str.is_conditional_container 
                                ? 'bg-orange-50 text-orange-700 border-orange-200' 
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const varName = str.effective_variable_name || str.variable_hash;
                              const copyText = `{{${varName}}}`;
                              navigator.clipboard.writeText(copyText);
                              toast.success(`Copied "${copyText}" to clipboard`);
                            }}
                            title={`Click to copy variable: {{${str.effective_variable_name || str.variable_hash}}}`}
                          >
                            <Copy className="h-3 w-3" />
                            {`{{${str.effective_variable_name || str.variable_hash}}}`}
                          </Badge>
                        </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
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
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateString(str);
                              }}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate string
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteStringDialog(str);
                              }}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete string
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                  

                </Card>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* UNIFIED DRAWER SYSTEM */}
      
      {/* Main String Edit Drawer */}
      <StringEditDrawer
        isOpen={mainDrawer.isOpen}
        onClose={mainDrawer.closeDrawer}
        stringData={mainDrawer.stringData}
        content={mainDrawer.content}
        onContentChange={mainDrawer.updateContent}
        variableName={mainDrawer.variableName}
        onVariableNameChange={mainDrawer.updateVariableName}
        displayName={mainDrawer.displayName}
        onDisplayNameChange={mainDrawer.updateDisplayName}
        isConditional={mainDrawer.isConditional}
        onTypeChange={mainDrawer.updateType}
        conditionalSpawns={mainDrawer.conditionalSpawns}
        onConditionalSpawnsChange={mainDrawer.updateConditionalSpawns}
        includeHiddenOption={mainDrawer.includeHiddenOption}
        onHiddenOptionChange={mainDrawer.updateHiddenOption}
        activeTab={mainDrawer.activeTab}
        onTabChange={mainDrawer.updateTab}
        project={project}
        selectedDimensionValues={selectedDimensionValues}
        pendingStringVariables={pendingStringVariables}
        onSave={mainDrawer.save}
        onCancel={mainDrawer.closeDrawer}
        onAddSpawn={mainDrawer.addSpawn}
        onRemoveSpawn={mainDrawer.removeSpawn}
        onAddExistingVariableAsSpawn={mainDrawer.addExistingVariableAsSpawn}
        onEditSpawn={handleEditSpawn}
        onEditVariable={handleEditVariable}
        title={mainDrawer.title}
        level={mainDrawer.level}
        showBackButton={mainDrawer.showBackButton}
        isSaving={mainDrawer.isSaving}
      />
      
      {/* OLD SYSTEM TO BE REMOVED - keeping placeholder for now */}
      <Sheet open={false} onOpenChange={() => {}}>
        <SheetContent side="right" className="w-[800px] max-w-[90vw] flex flex-col p-0 max-h-screen overflow-hidden">
          <SheetHeader className="px-6 py-4 border-b bg-background">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {currentDrawerLevel > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={popDrawer}
                    className="h-8 w-8 p-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <div className="flex flex-col">
                  <SheetTitle>
                    {getCurrentDrawer()?.title || (editingString ? "Edit String" : "New String")}
                  </SheetTitle>
                  {(editingString || (currentDrawerLevel > 0 && editingSpawn)) && (
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs font-mono bg-purple-50 text-purple-700 border-purple-200">
                        {currentDrawerLevel > 0 && editingSpawn
                          ? `{{${editingSpawn.effective_variable_name || editingSpawn.variable_hash}}}`
                          : `{{${editingString.effective_variable_name || editingString.variable_hash}}}`
                        }
                      </Badge>
                      {((currentDrawerLevel > 0 && editingSpawn?.is_conditional_container) || 
                        (editingString?.is_conditional_container)) && (
                        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                          Conditional
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>

          {/* Sidebar Content */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Main Tabs - show at all levels */}
            <div className="px-6 py-4 border-b">
              <Tabs value={stringDialogTab} onValueChange={setStringDialogTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {stringDialogTab === "content" && currentDrawerLevel === 0 && (
                <div className="space-y-4">
                  {!editingString ? (
                    // Show select dropdown for new string creation
                    <div>
                      {/* Variable Type Selection */}
                      <div className="space-y-4">
                      <div className="space-y-2">
                          <Label>Variable Type</Label>
                          <Select value={contentSubTab} onValueChange={(value: string) => {
                            setContentSubTab(value as "string" | "conditional");
                            if (value === "string") {
                              // Reset conditional state when switching to string mode
                              setIncludeHiddenOption(false);
                              setEditingConditional(false);
                              setConditionalSpawns([]);
                            }
                          }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select variable type" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="string">String</SelectItem>
                              <SelectItem value="conditional">Conditional</SelectItem>
                          </SelectContent>
                        </Select>
                        </div>
                      </div>
                    
                    {contentSubTab === "string" && (
                      <div className="mt-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="string-content">Content</Label>
                          <Textarea
                            id="string-content"
                            ref={setTextareaRef}
                            value={stringContent}
                            onChange={(e) => setStringContent(e.target.value)}
                            onSelect={handleTextSelection}
                            onMouseUp={handleTextSelection}
                            onKeyUp={handleTextSelection}
                            placeholder="Enter string content"
                            rows={4}
                            required
                          />
                        </div>
                        

                        

                        
                        {selectedText && selectedText.length > 0 && (
                          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <p className="text-sm text-blue-800">
                              <strong>Text selected:</strong> "{selectedText.length > 50 ? `${selectedText.substring(0, 50)}...` : selectedText}"
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                              Click a variable below to replace the selected text with that variable.
                            </p>
                          </div>
                        )}
                        
                        {(() => {
                          // Find string variables used in the current string content
                          const variableMatches = stringContent.match(/{{([^}]+)}}/g) || [];
                          const variableNames = variableMatches.map(match => match.slice(2, -2));
                          const uniqueVariableNames = [...new Set(variableNames)];
                          
                          // Find existing string variables from the variable names
                          const usedStringVariables = project.strings?.filter((str: any) => {
                            const effectiveName = str.effective_variable_name || str.variable_name || str.variable_hash;
                            return effectiveName && uniqueVariableNames.includes(effectiveName);
                          }) || [];

                          // Get pending variables that are referenced in content
                          const pendingVariablesInContent = Object.keys(pendingStringVariables).filter(name => 
                            uniqueVariableNames.includes(name)
                          );
                          
                          if (usedStringVariables.length === 0 && pendingVariablesInContent.length === 0) {
                            return (
                              <p className="text-sm text-muted-foreground">
                                No string variables are currently used in this string.
                              </p>
                            );
                          }
                          
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>String Variables Used</Label>
                                <Badge variant="outline" className="text-xs">
                                  {usedStringVariables.length + pendingVariablesInContent.length}
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                {usedStringVariables.map((stringVar: any) => (
                                  <div 
                                    key={stringVar.id} 
                                    className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                                    onClick={() => openEditInCascadingDrawer(stringVar)}
                                  >
                                    <div className="flex items-center gap-2 mb-3">
                                      {stringVar.is_conditional_container ? (
                                        <div className="flex items-center gap-1 text-orange-600 bg-orange-50 p-1 rounded border border-orange-200">
                                          <Folder className="h-3 w-3" />
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 text-purple-600 bg-purple-50 p-1 rounded border border-purple-200">
                                          <Spool className="h-3 w-3" />
                                        </div>
                                      )}
                                      <Badge variant="outline" className="text-xs font-mono bg-purple-50 text-purple-700 border-purple-200">
                                        {`{{${stringVar.effective_variable_name || stringVar.variable_hash}}}`}
                                      </Badge>
                                      {stringVar.is_conditional && (
                                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 p-1">
                                          <Signpost className="h-3 w-3" />
                                        </Badge>
                                      )}
                                      {stringVar.is_conditional_container && (
                                        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200 p-1">
                                          <Folder className="h-3 w-3" />
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {stringVar.is_conditional_container ? (
                                        <span className="italic">Conditional - click to manage spawns</span>
                                      ) : stringVar.content ? 
                                        (stringVar.content.length > 100 ? `${stringVar.content.substring(0, 100)}...` : stringVar.content) :
                                        "No content"
                                      }
                                    </p>
                                  </div>
                                ))}
                                {pendingVariablesInContent.map((pendingVar: string) => (
                                  <div 
                                    key={pendingVar} 
                                    className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer bg-yellow-50/50 border-yellow-200"
                                    onClick={() => createAndEditPendingVariable(pendingVar)}
                                  >
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="flex items-center gap-1 text-yellow-600 bg-yellow-50 p-1 rounded border border-yellow-200">
                                        <Plus className="h-3 w-3" />
                                      </div>
                                      <Badge variant="outline" className="text-xs font-mono bg-yellow-50 text-yellow-700 border-yellow-200">
                                        {`{{${pendingVar}}}`}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                                        New variable!
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        

                      </div>
                      </div>
                    )}
                    
                    {contentSubTab === "conditional" && (
                      <div className="mt-4">
                      <div className="space-y-4">
                        {/* Conditional Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">Conditional</h3>
                            <p className="text-sm text-muted-foreground">
                              Manage spawn string variables for this conditional
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addConditionalSpawn}
                            className="flex items-center gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Add Spawn
                          </Button>
                        </div>

                        {/* Include Hidden Option Checkbox */}
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="includeHiddenOption"
                            checked={includeHiddenOption}
                            onChange={(e) => setIncludeHiddenOption(e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor="includeHiddenOption" className="text-sm font-medium">
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
                              const variableName = spawn.effective_variable_name || spawn.variable_hash || (isTemporary ? 'new_variable' : 'unknown');
                              
                              return (
                                <div 
                                  key={spawn.id} 
                                  className={`border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer ${
                                    isTemporary 
                                      ? 'bg-yellow-50/50 border-yellow-200' 
                                      : 'bg-purple-50/50 border-purple-200'
                                  }`}
                                  onClick={() => openEditSpawn(spawn)}
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
                                      {`{{${variableName}}}`}
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
                      </div>
                    )}
                    </div>
                  ) : (
                    // Show content for editing existing strings with variable type selection
                    <div className="space-y-4">
                      {/* Variable Type Selection for existing strings */}
                      <div className="space-y-2">
                        <Label>Variable Type</Label>
                        <Select 
                          value={contentSubTab === "conditional" ? "conditional" : "string"} 
                          onValueChange={(value: string) => {
                            if (value === "conditional") {
                              // Converting to conditional - initialize conditional mode
                              setContentSubTab("conditional");
                              setEditingConditional(true);
                              setStringIsConditional(true);
                              // Initialize with a default spawn if none exist and we're converting from string
                              if (conditionalSpawns.length === 0 && !editingString.is_conditional_container) {
                                const defaultSpawn = {
                                  id: `temp-${Date.now()}`,
                                  content: stringContent || 'Default spawn content',
                                  project: project.id,
                                  variable_name: null,
                                  variable_hash: null,
                                  effective_variable_name: null,
                                  is_conditional: false,
                                  is_conditional_container: false,
                                  isTemporary: true
                                };
                                setConditionalSpawns([defaultSpawn]);
                              }
                            } else if (value === "string") {
                              // Converting back to string
                              setContentSubTab("string");
                              setEditingConditional(false);
                              setStringIsConditional(false);
                              setConditionalSpawns([]);
                              setIncludeHiddenOption(false); // Reset hidden option when converting to string
                            }
                          }}
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

                      {contentSubTab === "conditional" ? (
                        // Split variable editing content
                        <div className="space-y-4">
                          {/* Conditional Header */}
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-semibold">Conditional</h3>
                              <p className="text-sm text-muted-foreground">
                                Manage spawn string variables for this conditional
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={addConditionalSpawn}
                              className="flex items-center gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Add Spawn
                            </Button>
                          </div>

                          {/* Include Hidden Option Checkbox for Editing */}
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="includeHiddenOptionEdit"
                              checked={includeHiddenOption}
                              onChange={(e) => setIncludeHiddenOption(e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <Label htmlFor="includeHiddenOptionEdit" className="text-sm font-medium">
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
                            
                            {conditionalSpawns.map((spawn, index) => (
                              <div 
                                key={spawn.id} 
                                className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                                onClick={() => openEditSpawn(spawn)}
                              >
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="flex items-center gap-1 text-purple-600 bg-purple-50 p-1 rounded border border-purple-200">
                                    <Spool className="h-3 w-3" />
                                  </div>
                                  <Badge variant="outline" className="text-xs font-mono bg-purple-50 text-purple-700 border-purple-200">
                                    {`{{${spawn.effective_variable_name || spawn.variable_hash || 'new_variable'}}}`}
                                  </Badge>
                                  {spawn.is_conditional && (
                                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 p-1">
                                      <Signpost className="h-3 w-3" />
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {spawn.content ? 
                                    (spawn.content.length > 100 ? `${spawn.content.substring(0, 100)}...` : spawn.content) :
                                    "No content"
                                  }
                                </p>
                              </div>
                            ))}
                            
                            {conditionalSpawns.length === 0 && (
                              <div className="text-center py-8 text-muted-foreground">
                                <p>No spawn variables found for this conditional.</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={addConditionalSpawn}
                                  className="mt-2"
                                >
                                  Add First Spawn
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        // Normal string editing content
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="string-content">Content</Label>
                            <Textarea
                              id="string-content"
                              ref={setTextareaRef}
                              value={stringContent}
                              onChange={(e) => setStringContent(e.target.value)}
                              onSelect={handleTextSelection}
                              onMouseUp={handleTextSelection}
                              onKeyUp={handleTextSelection}
                              placeholder="Enter string content"
                              rows={4}
                              required
                            />
                          </div>

                          {selectedText && selectedText.length > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                              <p className="text-sm text-blue-800">
                                <strong>Text selected:</strong> "{selectedText.length > 50 ? `${selectedText.substring(0, 50)}...` : selectedText}"
                              </p>
                              <p className="text-xs text-blue-600 mt-1">
                                Click a variable below to replace the selected text with that variable.
                              </p>
                            </div>
                          )}

                          {(() => {
                            // Find string variables used in the current content
                            const variableMatches = stringContent.match(/{{([^}]+)}}/g) || [];
                            const variableNames = variableMatches.map(match => match.slice(2, -2));
                            const uniqueVariableNames = [...new Set(variableNames)];
                            
                            // Find existing string variables from the variable names
                            const usedStringVariables = project.strings?.filter((str: any) => {
                              const effectiveName = str.effective_variable_name || str.variable_name || str.variable_hash;
                              return effectiveName && uniqueVariableNames.includes(effectiveName);
                            }) || [];

                            // Get pending variables that are referenced in content
                            const pendingVariablesInContent = Object.keys(pendingStringVariables).filter(name => 
                              uniqueVariableNames.includes(name)
                            );
                            
                            if (usedStringVariables.length === 0 && pendingVariablesInContent.length === 0) {
                              return (
                                <div className="space-y-2">
                                  <Label>String Variables Used</Label>
                                  <p className="text-sm text-muted-foreground">
                                    No string variables are currently used in this string.
                                  </p>
                                </div>
                              );
                            }
                            
                            return (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label>String Variables Used</Label>
                                  <Badge variant="outline" className="text-xs">
                                    {usedStringVariables.length + pendingVariablesInContent.length}
                                  </Badge>
                                </div>
                                <div className="space-y-2">
                                  {usedStringVariables.map((stringVar: any) => (
                                    <div 
                                      key={stringVar.id} 
                                      className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                                      onClick={() => openEditInCascadingDrawer(stringVar)}
                                    >
                                      <div className="flex items-center gap-2 mb-3">
                                        {stringVar.is_conditional_container ? (
                                          <div className="flex items-center gap-1 text-orange-600 bg-orange-50 p-1 rounded border border-orange-200">
                                            <Folder className="h-3 w-3" />
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1 text-purple-600 bg-purple-50 p-1 rounded border border-purple-200">
                                            <Spool className="h-3 w-3" />
                                          </div>
                                        )}
                                        <Badge variant="outline" className="text-xs font-mono bg-purple-50 text-purple-700 border-purple-200">
                                          {`{{${stringVar.effective_variable_name || stringVar.variable_hash}}}`}
                                        </Badge>
                                        {stringVar.is_conditional && (
                                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 p-1">
                                            <Signpost className="h-3 w-3" />
                                          </Badge>
                                        )}
                                        {stringVar.is_conditional_container && (
                                          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200 p-1">
                                            <Folder className="h-3 w-3" />
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {stringVar.is_conditional_container ? (
                                          <span className="italic">Conditional - click to manage spawns</span>
                                        ) : stringVar.content ? 
                                          (stringVar.content.length > 100 ? `${stringVar.content.substring(0, 100)}...` : stringVar.content) :
                                          "No content"
                                        }
                                      </p>
                                    </div>
                                  ))}

                                  {pendingVariablesInContent.map((pendingVar: string) => (
                                    <div 
                                      key={pendingVar} 
                                      className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer bg-yellow-50/50 border-yellow-200"
                                      onClick={() => createAndEditPendingVariable(pendingVar)}
                                    >
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="flex items-center gap-1 text-yellow-600 bg-yellow-50 p-1 rounded border border-yellow-200">
                                          <Plus className="h-3 w-3" />
                                        </div>
                                        <Badge variant="outline" className="text-xs font-mono bg-yellow-50 text-yellow-700 border-yellow-200">
                                          {`{{${pendingVar}}}`}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                                          New variable!
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Spawn Editing Content - Simple Interface */}
              {stringDialogTab === "content" && currentDrawerLevel > 0 && getCurrentDrawer()?.component === 'spawn-edit' && editingSpawn && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="spawn-content">Content</Label>
                    <Textarea
                      id="spawn-content"
                      ref={setTextareaRef}
                      value={stringContent}
                      onChange={(e) => {
                        setStringContent(e.target.value);
                        updateConditionalSpawn(editingSpawn.id, 'content', e.target.value);
                      }}
                      onSelect={handleTextSelection}
                      onMouseUp={handleTextSelection}
                      onKeyUp={handleTextSelection}
                      placeholder="Enter spawn content"
                      rows={4}
                      required
                    />
                  </div>

                  {(() => {
                    // Find string variables used in the current spawn content
                    const variableMatches = stringContent.match(/{{([^}]+)}}/g) || [];
                    const variableNames = variableMatches.map(match => match.slice(2, -2));
                    const uniqueVariableNames = [...new Set(variableNames)];
                    
                    // Find existing string variables from the variable names
                    const usedStringVariables = project.strings?.filter((str: any) => {
                      const effectiveName = str.effective_variable_name || str.variable_name || str.variable_hash;
                      return effectiveName && uniqueVariableNames.includes(effectiveName);
                    }) || [];

                    // Get pending variables that are referenced in content
                    const pendingVariablesInContent = Object.keys(pendingStringVariables).filter(name => 
                      uniqueVariableNames.includes(name)
                    );
                    
                    if (usedStringVariables.length === 0 && pendingVariablesInContent.length === 0) {
                      return (
                        <div className="space-y-2">
                          <Label>String Variables Used</Label>
                          <p className="text-sm text-muted-foreground">
                            No string variables are currently used in this spawn.
                          </p>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>String Variables Used</Label>
                          <Badge variant="outline" className="text-xs">
                            {usedStringVariables.length + pendingVariablesInContent.length}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {usedStringVariables.map((stringVar: any) => (
                            <div 
                              key={stringVar.id} 
                              className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => openEditInCascadingDrawer(stringVar)}
                            >
                              <div className="flex items-center gap-2 mb-3">
                                {stringVar.is_conditional_container ? (
                                  <div className="flex items-center gap-1 text-orange-600 bg-orange-50 p-1 rounded border border-orange-200">
                                    <Folder className="h-3 w-3" />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-purple-600 bg-purple-50 p-1 rounded border border-purple-200">
                                    <Spool className="h-3 w-3" />
                                  </div>
                                )}
                                <Badge variant="outline" className="text-xs font-mono bg-purple-50 text-purple-700 border-purple-200">
                                  {`{{${stringVar.effective_variable_name || stringVar.variable_hash}}}`}
                                </Badge>
                                {stringVar.is_conditional && (
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 p-1">
                                    <Signpost className="h-3 w-3" />
                                  </Badge>
                                )}
                                {stringVar.is_conditional_container && (
                                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200 p-1">
                                    <Folder className="h-3 w-3" />
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {stringVar.is_conditional_container ? (
                                  <span className="italic">Conditional - click to manage spawns</span>
                                ) : stringVar.content ? 
                                  (stringVar.content.length > 100 ? `${stringVar.content.substring(0, 100)}...` : stringVar.content) :
                                  "No content"
                                }
                              </p>
                            </div>
                          ))}

                          {pendingVariablesInContent.map((variableName: string) => (
                            <div
                              key={`pending-${variableName}`}
                              className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer bg-blue-50/50 border-blue-200"
                              onClick={() => createAndEditPendingVariable(variableName)}
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <div className="flex items-center gap-1 text-blue-600 bg-blue-50 p-1 rounded border border-blue-200">
                                  <Plus className="h-3 w-3" />
                                </div>
                                <Badge variant="outline" className="text-xs font-mono bg-blue-50 text-blue-700 border-blue-200">
                                  {`{{${variableName}}}`}
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                                  New
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              {/* Spawn Editing Dimensions Tab */}
              {stringDialogTab === "dimensions" && currentDrawerLevel > 0 && getCurrentDrawer()?.component === 'spawn-edit' && editingSpawn && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Set dimension values for this spawn variable.
                  </p>
                  {/* Dimension controls for spawn would go here - same as string dimensions */}
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Dimension management for spawn variables coming soon.</p>
                  </div>
                </div>
              )}

              {/* Spawn Editing Advanced Tab */}
              {stringDialogTab === "advanced" && currentDrawerLevel > 0 && getCurrentDrawer()?.component === 'spawn-edit' && editingSpawn && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="spawn-variable-name-advanced">Variable Name</Label>
                    <Input
                      id="spawn-variable-name-advanced"
                      value={stringVariableName}
                      onChange={(e) => {
                        setStringVariableName(e.target.value);
                        updateConditionalSpawn(editingSpawn.id, 'variable_name', e.target.value);
                      }}
                      placeholder="Variable name (optional)"
                    />
                    <p className="text-xs text-muted-foreground">
                      {stringVariableName.trim() 
                        ? `This will be used as {{${stringVariableName.trim()}}} in other strings.`
                        : `Currently using: {{${editingSpawn.effective_variable_name || editingSpawn.variable_hash}}}`
                      }
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Spawn Settings</Label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="spawn-is-conditional-advanced"
                        checked={stringIsConditional}
                        onChange={(e) => {
                          setStringIsConditional(e.target.checked);
                          updateConditionalSpawn(editingSpawn.id, 'is_conditional', e.target.checked);
                        }}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="spawn-is-conditional-advanced" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Is Conditional
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Conditional spawns can be shown or hidden based on specific conditions
                    </p>
                  </div>

                  {conditionalSpawns.length > 1 && (
                    <div className="space-y-2">
                      <Label>Danger Zone</Label>
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-red-800">Delete this spawn</p>
                            <p className="text-sm text-red-600">This action cannot be undone.</p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              removeConditionalSpawn(editingSpawn.id);
                              popDrawer();
                            }}
                          >
                            Delete Spawn
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Root Level Dimensions Tab */}
              {currentDrawerLevel === 0 && stringDialogTab === "dimensions" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Set dimension values for this string.
                  </p>
                  {/* Add dimension controls here */}
                </div>
              )}
              
              {/* Root Level Advanced Tab */}
              {currentDrawerLevel === 0 && stringDialogTab === "advanced" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="string-variable-name-advanced">Variable Name</Label>
                    <Input
                      id="string-variable-name-advanced"
                      value={stringVariableName}
                      onChange={(e) => setStringVariableName(e.target.value)}
                      placeholder="Variable name (optional)"
                    />
                    <p className="text-xs text-muted-foreground">
                      {!editingString ? (
                                                      contentSubTab === "conditional" ? 
                          "This name will be used as the base for all spawn variables" : 
                          "Optional name for this string variable"
                      ) : (
                        editingString.is_conditional_container ?
                          "This name is used as the base for all spawn variables" :
                          "Optional name for this string variable"
                      )}
                    </p>
                  </div>
                  
                  {(!editingString ? contentSubTab === "string" : !editingString.is_conditional_container) && (
                    <div className="space-y-2">
                      <Label>String Settings</Label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="string-is-conditional-advanced"
                          checked={stringIsConditional}
                          onChange={(e) => setStringIsConditional(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="string-is-conditional-advanced" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Is Conditional
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Conditional strings can be shown or hidden based on specific conditions
                      </p>
                    </div>
                  )}

                  {editingString && (
                    <div className="space-y-2">
                      <Label>Conversion</Label>
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-orange-800">
                              {editingString.is_conditional_container ? "Convert to Normal String" : "Convert to Conditional"}
                            </p>
                            <p className="text-sm text-orange-600">
                              {editingString.is_conditional_container 
                                ? "This will merge all spawns into a single string and remove spawn management."
                                : "This will convert this string into a conditional with multiple spawns."
                              }
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-orange-300 text-orange-700 hover:bg-orange-100"
                            onClick={() => {
                              setPendingConversionType(editingString.is_conditional_container ? 'string' : 'conditional');
                              setConversionConfirmDialog(true);
                            }}
                          >
                            {editingString.is_conditional_container ? "Convert to String" : "Convert to Variable"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  

                  
                  {editingString && (
                    <div className="space-y-2">
                      <Label>Danger Zone</Label>
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-red-800">Delete this string</p>
                            <p className="text-sm text-red-600">This action cannot be undone.</p>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteStringDialog(editingString)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            </div>
            
            {/* Fixed Footer */}
            <div className="border-t p-6 bg-background">
              <div className="flex justify-end gap-2">
                {currentDrawerLevel > 0 ? (
                  <>
                    <Button type="button" variant="secondary" onClick={popDrawer}>
                      Back
                    </Button>
                    <Button type="button" onClick={async () => {
                      // Save spawn changes to backend
                      try {
                        await apiFetch(`/api/strings/${editingSpawn.id}/`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            content: stringContent,
                            variable_name: stringVariableName,
                            is_conditional: stringIsConditional,
                          }),
                        });
                        
                        // Update the spawn in conditionalSpawns state
                        setConditionalSpawns(prev => prev.map(spawn => 
                          spawn.id === editingSpawn.id 
                            ? { 
                                ...spawn, 
                                content: stringContent,
                                variable_name: stringVariableName,
                                is_conditional: stringIsConditional 
                              }
                            : spawn
                        ));
                        
                        // Refresh project data to get latest changes
                        const updatedProject = await apiFetch(`/api/projects/${id}/`);
                        setProject(sortProjectStrings(updatedProject));
                        
                        toast.success('Spawn updated successfully');
                        popDrawer();
                      } catch (error) {
                        console.error('Error saving spawn:', error);
                        toast.error('Failed to save spawn. Please try again.');
                      }
                    }}>
                      Save Spawn
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="secondary" onClick={closeStringDialog}>
                      Cancel
                    </Button>
                                    <Button type="submit" onClick={
                      (contentSubTab === "conditional" || (editingString && editingString.is_conditional_container)) 
                        ? handleSplitVariableSubmit 
                        : handleStringSubmit
                    }>
                      {(contentSubTab === "conditional" || (editingString && editingString.is_conditional_container)) 
                        ? "Save Conditional" 
                        : (editingString ? "Save Changes" : "Create String")
                      }
                    </Button>
                  </>
                )}
              </div>
            </div>
        </SheetContent>
      </Sheet>

      {/* TODO: Implement cascading drawers when needed */}
      
      {/* OLD CASCADING SYSTEM TO BE REMOVED - keeping placeholder */}
      {[].map((drawer, index) => (
        <Sheet key={drawer.id} open={true} onOpenChange={v => !v && closeCascadingDrawer(drawer.id)}>
          <SheetContent 
            side="right" 
            className="w-[800px] max-w-[90vw] flex flex-col p-0 max-h-screen overflow-hidden"
            style={{
              zIndex: 50 + index
            }}
          >
            <SheetHeader className="px-6 py-4 border-b bg-background">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  {index > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => closeCascadingDrawer(drawer.id)}
                      className="h-8 w-8 p-0"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="flex flex-col">
                    <SheetTitle>
                      Edit String
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs font-mono bg-purple-50 text-purple-700 border-purple-200">
                        {`{{${drawer.stringData.effective_variable_name || drawer.stringData.variable_hash}}}`}
                      </Badge>
                      {drawer.isConditionalContainer && (
                        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                          Conditional
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* Drawer Content */}
            <div className="flex flex-col flex-1 min-h-0">
              {/* Main Tabs */}
              <div className="px-6 py-4 border-b">
                <Tabs value={drawer.tab} onValueChange={(value) => updateCascadingDrawer(drawer.id, { tab: value })} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-6 min-h-0">
                {drawer.tab === "content" && (
                  <div className="space-y-4">
                    {/* Always use the new select dropdown interface */}
                    <div className="space-y-4">
                        {/* Variable Type Selection */}
                        <div className="space-y-2">
                          <Label>Variable Type</Label>
                          <Select 
                            value={drawer.isConditional ? "conditional" : "string"} 
                            onValueChange={(value: string) => {
                            const isConditional = value === "conditional";
                              const updates: any = { 
                                isConditional,
                                isEditingConditional: isConditional, // Set this flag for save logic
                                isConditionalContainer: isConditional // Also update the container flag
                              };
                            
                            // When switching TO conditional mode, initialize spawns if empty
                            if (isConditional && drawer.conditionalSpawns.length === 0 && !drawer.isConditionalContainer) {
                                console.log('DEBUG: Initializing default spawn for cascading drawer');
                                const defaultSpawn = {
                                id: `temp-spawn-${Date.now()}`,
                                  content: drawer.content || "Default spawn content",
                                  variable_name: null,
                                  variable_hash: null,
                                  effective_variable_name: null,
                                is_conditional: false,
                                is_conditional_container: false,
                                _isTemporary: true
                              };
                                updates.conditionalSpawns = [defaultSpawn];
                                console.log('DEBUG: Created default spawn:', defaultSpawn);
                            } else if (!isConditional) {
                              // When switching TO string mode, clear conditional-related state
                              updates.conditionalSpawns = [];
                              updates.includeHiddenOption = false;
                            }
                              console.log('DEBUG: Updating cascading drawer with:', updates);
                            updateCascadingDrawer(drawer.id, updates);
                          }} 
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
                          
                        {drawer.isConditional ? (
                          // Conditional mode content
                          <div className="space-y-4">
                            {/* Conditional Header */}
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-semibold">Conditional</h3>
                                <p className="text-sm text-muted-foreground">
                                  Manage spawn string variables for this conditional
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newSpawn = {
                                    id: `temp-spawn-${Date.now()}`,
                                    content: "New spawn content",
                                    variable_name: null,
                                    variable_hash: null,
                                    effective_variable_name: null,
                                    is_conditional: false,
                                    is_conditional_container: false,
                                    _isTemporary: true
                                  };
                                  updateCascadingDrawer(drawer.id, { 
                                    conditionalSpawns: [...drawer.conditionalSpawns, newSpawn] 
                                  });
                                }}
                                className="flex items-center gap-2"
                              >
                                <Plus className="h-4 w-4" />
                                Add Spawn
                              </Button>
                            </div>

                            {/* Include Hidden Option Checkbox for Cascading Drawer */}
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`includeHiddenOptionCascading-${drawer.id}`}
                                checked={drawer.includeHiddenOption || false}
                                onChange={(e) => updateCascadingDrawer(drawer.id, { includeHiddenOption: e.target.checked })}
                                className="rounded border-gray-300"
                              />
                              <Label htmlFor={`includeHiddenOptionCascading-${drawer.id}`} className="text-sm font-medium">
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
                                  {drawer.conditionalSpawns.length} spawn{drawer.conditionalSpawns.length !== 1 ? 's' : ''}
                                </Badge>
                              </div>

                              {drawer.conditionalSpawns.map((spawn: any, index: number) => {
                                const isTemporary = spawn._isTemporary || String(spawn.id).startsWith('temp-');
                                const variableName = spawn.effective_variable_name || spawn.variable_hash || (isTemporary ? 'new_variable' : 'unknown');
                                
                                return (
                                  <div key={spawn.id} className="border rounded-lg p-4 space-y-3">
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
                                        {`{{${variableName}}}`}
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
                          </div>
                        ) : (
                          // String mode content
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="content">Content</Label>
                          <Textarea
                            id="content"
                            value={drawer.content}
                            onChange={(e) => updateCascadingDrawer(drawer.id, { content: e.target.value })}
                            placeholder="Enter string content"
                            rows={4}
                          />
                        </div>

                        {/* Variable Detection and Display for Cascading Drawers */}
                        {(() => {
                          // Find string variables used in the current drawer content
                          const variableMatches = drawer.content.match(/{{([^}]+)}}/g) || [];
                          const variableNames = variableMatches.map(match => match.slice(2, -2));
                          const uniqueVariableNames = [...new Set(variableNames)];
                          
                          // Find existing string variables from the variable names
                          const usedStringVariables = project.strings?.filter((str: any) => {
                            const effectiveName = str.effective_variable_name || str.variable_name || str.variable_hash;
                            return effectiveName && uniqueVariableNames.includes(effectiveName);
                          }) || [];

                          // Get pending variables that are referenced in content
                          const pendingVariablesInContent = Object.keys(pendingStringVariables).filter(name => 
                            uniqueVariableNames.includes(name)
                          );
                          
                          if (usedStringVariables.length === 0 && pendingVariablesInContent.length === 0) {
                            return null;
                          }
                          
                          return (
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
                                      onClick={() => openEditInCascadingDrawer(stringVar)}
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
                                        <Badge variant="outline" className="text-xs font-mono bg-purple-50 text-purple-700 border-purple-200">
                                          {`{{${variableName}}}`}
                                        </Badge>
                                        {stringVar.is_conditional_container && (
                                          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                            Conditional
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {stringVar.content || "Empty content"}
                                      </p>
                                    </div>
                                  );
                                })}

                                {/* New Variables (Yellow Boxes) */}
                                {pendingVariablesInContent.map((pendingVar: string) => (
                                  <div 
                                    key={pendingVar} 
                                    className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer bg-yellow-50/50 border-yellow-200"
                                    onClick={() => createAndEditPendingVariable(pendingVar)}
                                  >
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="flex items-center gap-1 text-yellow-600 bg-yellow-50 p-1 rounded border border-yellow-200">
                                        <Plus className="h-3 w-3" />
                                      </div>
                                      <Badge variant="outline" className="text-xs font-mono bg-yellow-50 text-yellow-700 border-yellow-200">
                                        {`{{${pendingVar}}}`}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                                        New variable!
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                            </div>
                          )}
                              </div>
                  </div>
                )}

                {drawer.tab === "advanced" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="variable-name">Variable Name</Label>
                      <Input
                        id="variable-name"
                        value={drawer.variableName}
                        onChange={(e) => updateCascadingDrawer(drawer.id, { variableName: e.target.value })}
                        placeholder="Custom variable name (optional)"
                      />
                    </div>
                  </div>
                )}
            </div>
            </div>
            
            {/* Fixed Footer */}
            <div className="px-6 py-4 border-t bg-background">
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => closeCascadingDrawer(drawer.id)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => saveCascadingDrawer(drawer.id)}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      ))}

      {/* Legacy Nested Drawer Sheets - Keeping for spawn editing */}
      {drawerStack.map((drawer, index) => (
        <Sheet key={drawer.id} open={true} onOpenChange={v => !v && popDrawer()}>
          <SheetContent side="right" className="w-[800px] max-w-[90vw] flex flex-col p-0">
            <SheetHeader className="px-6 py-4 border-b bg-background">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={popDrawer}
                    className="h-8 w-8 p-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <SheetTitle>
                    {drawer.title}
                  </SheetTitle>
                </div>
              </div>
            </SheetHeader>
            
            <div className="flex-1 overflow-y-auto p-6">
              {drawer.component === 'spawn-edit' && editingSpawn && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Spawn Content</Label>
                    <Textarea
                      value={stringContent}
                      onChange={(e) => setStringContent(e.target.value)}
                      placeholder="Enter spawn content"
                      rows={6}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Variable Name (Optional)</Label>
                    <Input
                      value={stringVariableName}
                      onChange={(e) => setStringVariableName(e.target.value)}
                      placeholder="Optional custom name"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`spawn-conditional-${index}`}
                      checked={stringIsConditional}
                      onChange={(e) => setStringIsConditional(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={`spawn-conditional-${index}`} className="text-sm cursor-pointer">
                      Conditional (can be toggled on/off)
                    </Label>
                  </div>
                </div>
              )}
              
              {drawer.component === 'string-edit' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>String Content</Label>
                    <Textarea
                      value={stringContent}
                      onChange={(e) => setStringContent(e.target.value)}
                      placeholder="Enter string content"
                      rows={6}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Variable Name (Optional)</Label>
                    <Input
                      value={stringVariableName}
                      onChange={(e) => setStringVariableName(e.target.value)}
                      placeholder="Optional custom name"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`string-conditional-${index}`}
                      checked={stringIsConditional}
                      onChange={(e) => setStringIsConditional(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={`string-conditional-${index}`} className="text-sm cursor-pointer">
                      Conditional (can be toggled on/off)
                    </Label>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t bg-background">
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={popDrawer}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleStringSubmit}>
                  Save
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      ))}

      </div>

      {/* Floating Action Bar for Bulk Operations */}
      {selectedStringIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-background border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedStringIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
              >
                Clear
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={openBulkDeleteDialog}
              >
                Delete {selectedStringIds.size} strings
              </Button>
            </div>
          </div>
        </div>
      )}




      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialog} onOpenChange={v => !v && closeBulkDeleteDialog()}>
        <DialogContent className="max-w-md">
          <DialogTitle>Delete {selectedStringIds.size} Strings</DialogTitle>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete {selectedStringIds.size} selected strings? This action cannot be undone.
            </p>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeBulkDeleteDialog}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleBulkDelete}>
                Delete {selectedStringIds.size} strings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Strings Dialog */}
      <Dialog open={importDialog} onOpenChange={v => !v && closeImportDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>Import Strings from CSV</DialogTitle>
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file to import strings into your project. Each cell in the CSV will become a separate string in your project.
              </p>
              
              {/* CSV Format Instructions */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h4 className="font-medium text-sm">CSV Format Guidelines:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Each cell in your CSV will become a separate string</li>
                  <li>• Use <code className="bg-muted px-1 rounded">{"{{variableName}}"}</code> format for variables in your strings</li>
                  <li>• Variables found in strings will be automatically created if they don't exist</li>
                  <li>• Existing variables with the same name will be reused</li>
                  <li>• Empty cells will be ignored</li>
                </ul>
              </div>

              {/* Example */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-sm text-blue-800 mb-2">Example CSV content:</h4>
                <div className="text-sm text-blue-700 font-mono">
                  <div>Hello {"{{username}}"}, Welcome to our app!, Thank you for signing up</div>
                  <div>Your account is now active, Please verify your email at {"{{email}}"}</div>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  This would create 4 strings and 2 variables (username, email)
                </p>
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-3">
              <Label htmlFor="csv-file">Select CSV File</Label>
              <div className="flex items-center gap-3">
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>
              {importFile && (
                <p className="text-sm text-green-600">
                  ✓ Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeImportDialog}>
                Cancel
              </Button>
              <Button 
                onClick={handleImportStrings}
                disabled={!importFile || importLoading}
              >
                {importLoading ? 'Importing...' : 'Import Strings'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Edit Dialog */}
      <Dialog open={!!editingProject} onOpenChange={v => !v && closeProjectDialog()}>
        <DialogContent>
          <DialogTitle>Edit Project</DialogTitle>
          <form onSubmit={handleProjectSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description (Optional)</Label>
              <Textarea
                id="project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Enter project description"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={closeProjectDialog}>
                Cancel
              </Button>
              <Button type="submit">
                Update Project
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Download CSV Confirmation Dialog */}
      <Dialog open={downloadDialog} onOpenChange={setDownloadDialog}>
        <DialogContent>
          <DialogTitle>Download Filtered CSV</DialogTitle>
          <div className="space-y-4">
            <p>This will download a CSV file containing all strings with conditional variables resolved based on your dimension selections.</p>
            
            {/* Show current dimension selections */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <h4 className="font-medium text-sm">Dimension Selections:</h4>
              

              
              {/* Dimension selections */}
              {Object.entries(selectedDimensionValues).filter(([_, value]) => value !== null && value !== undefined).length > 0 && (
                <div className="text-sm">
                  <span className="font-medium">Selected spawns for conditionals: </span>
                  <div className="ml-2 space-y-1">
                    {Object.entries(selectedDimensionValues)
                      .filter(([_, value]) => value !== null && value !== undefined)
                      .map(([dimensionId, value]) => {
                        const dimension = (project.dimensions || []).find((d: any) => d.id.toString() === dimensionId);
                        return (
                          <div key={dimensionId} className="text-muted-foreground">
                            {dimension?.name}: {value}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              

              
              {/* Show total count */}
              <div className="text-sm">
                <span className="font-medium">Strings to export: </span>
                <span className="text-muted-foreground">{filteredStrings.length}</span>
              </div>
              
              {/* Show message about conditional behavior */}
              {project?.dimensions && project.dimensions.length > 0 ? (
                <div className="text-sm text-muted-foreground">
                  Conditional variables will be resolved using the selected dimension values above.
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No dimensions in this project. All strings will be exported as-is.
                </div>
              )}
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setDownloadDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleDownloadCSV}
                disabled={downloadLoading}
              >
                {downloadLoading ? 'Downloading...' : 'Download CSV'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <Dialog open={deleteProjectDialog} onOpenChange={setDeleteProjectDialog}>
        <DialogContent>
          <DialogTitle>Delete Project</DialogTitle>
          <div className="space-y-4">
            <p>Are you sure you want to delete this project? This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setDeleteProjectDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  handleDeleteProject();
                  setDeleteProjectDialog(false);
                }}
              >
                Delete Project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit String Sheet - Now using custom sidebar */}
      <Sheet open={false} onOpenChange={v => !v && closeStringDialog()}>
        <SheetContent side="right" className="w-[800px] max-w-[90vw] flex flex-col p-0">
          {/* Fixed Header with Tabs */}
          <SheetHeader className="px-6 py-4 border-b bg-background">
            <SheetTitle>{editingString ? "Edit String" : "New String"}</SheetTitle>
            <Tabs value={stringDialogTab} onValueChange={setStringDialogTab} className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>
            </Tabs>
          </SheetHeader>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <form id="string-form" onSubmit={handleStringSubmit} className="space-y-4">
              <Tabs value={stringDialogTab} onValueChange={setStringDialogTab} className="w-full">
                <TabsContent value="content" className="mt-0">
              <div className="space-y-2">
                <Label htmlFor="string-content">Content</Label>
                <Textarea
                  id="string-content"
                  ref={setTextareaRef}
                  value={stringContent}
                  onChange={(e) => setStringContent(e.target.value)}
                  onSelect={handleTextSelection}
                  onMouseUp={handleTextSelection}
                  onKeyUp={handleTextSelection}
                  placeholder="Enter string content"
                  rows={4}
                  required
                />
              </div>
            <div>
              <h3 className="font-medium mb-2">Variables</h3>
              {selectedText && selectedText.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
                  <p className="text-sm text-blue-800">
                    <strong>Text selected:</strong> "{selectedText.length > 50 ? `${selectedText.substring(0, 50)}...` : selectedText}"
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Click a variable below to replace the selected text with that variable.
                  </p>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Type {`{{variableName}}`} to reference string variables. New variables will appear below and can be created by clicking them.
              </p>
            </div>

            {/* String Variables Section */}
            <div>
              <h3 className="font-medium mb-2">String Variables Used</h3>
              <p className="text-xs text-muted-foreground mb-3">
                String variables referenced in this string content. Click to edit them.
              </p>
              {(() => {
                // Find string variables used in the current string content
                const variableMatches = stringContent.match(/{{([^}]+)}}/g) || [];
                const variableNames = variableMatches.map(match => match.slice(2, -2));
                const uniqueVariableNames = [...new Set(variableNames)];
                
                // Find existing string variables from the variable names
                const usedStringVariables = project.strings?.filter((str: any) => {
                  const effectiveName = str.effective_variable_name || str.variable_name || str.variable_hash;
                  return effectiveName && uniqueVariableNames.includes(effectiveName);
                }) || [];

                // Get pending variables that are referenced in content
                const pendingVariablesInContent = Object.keys(pendingStringVariables).filter(name => 
                  uniqueVariableNames.includes(name)
                );
                
                if (usedStringVariables.length === 0 && pendingVariablesInContent.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      No string variables are currently used in this string.
                    </p>
                  );
                }
                
                return (
                  <div className="space-y-2">
                    {/* Existing string variables */}
                    {usedStringVariables.map((stringVar: any) => (
                      <div
                        key={stringVar.id}
                        className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => openEditNestedString(stringVar)}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          {stringVar.is_conditional_container ? (
                            <div className="flex items-center gap-1 text-orange-600 bg-orange-50 p-1 rounded border border-orange-200">
                              <Folder className="h-3 w-3" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-purple-600 bg-purple-50 p-1 rounded border border-purple-200">
                              <Spool className="h-3 w-3" />
                            </div>
                          )}
                          <Badge variant="outline" className="text-xs font-mono bg-purple-50 text-purple-700 border-purple-200">
                            {`{{${stringVar.effective_variable_name || stringVar.variable_hash}}}`}
                          </Badge>
                          {stringVar.is_conditional && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 p-1">
                              <Signpost className="h-3 w-3" />
                            </Badge>
                          )}
                          {stringVar.is_conditional_container && (
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200 p-1">
                              <Folder className="h-3 w-3" />
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {stringVar.is_conditional_container ? (
                            <span className="italic">Conditional - click to manage spawns</span>
                          ) : stringVar.content ? 
                            (stringVar.content.length > 100 ? `${stringVar.content.substring(0, 100)}...` : stringVar.content) :
                            "No content"
                          }
                        </p>
                      </div>
                    ))}

                    {/* New variable! string variables */}
                    {pendingVariablesInContent.map((variableName: string) => (
                      <div
                        key={`pending-${variableName}`}
                        className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer bg-blue-50/50 border-blue-200"
                        onClick={() => createAndEditPendingVariable(variableName)}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex items-center gap-1 text-blue-600 bg-blue-50 p-1 rounded border border-blue-200">
                            <Plus className="h-3 w-3" />
                          </div>
                          <Badge variant="outline" className="text-xs font-mono bg-blue-50 text-blue-700 border-blue-200">
                            {`{{${variableName}}}`}
                          </Badge>
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                            New
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Dimension Values Section */}
                </TabsContent>
              
              <TabsContent value="dimensions" className="mt-0">
                {project.dimensions && project.dimensions.length > 0 ? (
                  <div>
                    <h3 className="font-medium mb-2">Dimension Values</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Optional: Assign values for each dimension to categorize this string.
                    </p>
                    <div className="mb-4 p-3 bg-muted/50 rounded-md">
                      <p className="text-xs text-muted-foreground mb-2">
                        <strong>Legend:</strong>
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="inline-flex items-center gap-1 rounded-md border px-2 py-1 bg-gray-50 text-gray-700 border-gray-200">
                            <span>Manual</span>
                            <X className="h-3 w-3" />
                          </div>
                          <span className="text-muted-foreground">Can be removed</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="inline-flex items-center gap-1 rounded-md border px-2 py-1 bg-blue-50 text-blue-700 border-blue-200 border-dashed">
                            <span>Auto</span>
                            <div className="w-2 h-2 rounded-full bg-blue-400" />
                          </div>
                          <span className="text-muted-foreground">From variables</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {(project.dimensions || []).map((dimension: any) => (
                        <div key={dimension.id} className="space-y-2">
                          <label className="text-sm font-medium">
                            {dimension.name}:
                          </label>
                          
                          {/* Selected dimension values as removable tags and add button */}
                          <div className="flex flex-wrap gap-2 items-center">
                            {stringDimensionValues[dimension.id] && stringDimensionValues[dimension.id].length > 0 && 
                              stringDimensionValues[dimension.id].map((value: string, index: number) => {
                                const isInherited = isDimensionValueInheritedFromVariables(dimension.id, value);
                                
                                return (
                                  <div
                                    key={`${dimension.id}-${value}-${index}`}
                                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${
                                      isInherited
                                        ? "bg-blue-50 text-blue-700 border-blue-200 border-dashed"
                                        : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                                    }`}
                                    title={isInherited ? "This dimension value is automatically assigned from variables in the string content" : "Click X to remove this dimension value"}
                                  >
                                    <span>{value}</span>
                                    {!isInherited && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStringDimensionValues(prev => ({
                                            ...prev,
                                            [dimension.id]: prev[dimension.id]?.filter((v: string) => v !== value) || []
                                          }));
                                        }}
                                        className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-gray-300 transition-colors"
                                        aria-label={`Remove ${value}`}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                    {isInherited && (
                                      <div className="inline-flex items-center justify-center w-4 h-4">
                                        <div className="w-2 h-2 rounded-full bg-blue-400" title="Inherited from variable" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            }
                            
                            {/* Plus button to add values */}
                            <Popover 
                              open={openDimensionPopover === dimension.id} 
                              onOpenChange={(open) => {
                                if (open) {
                                  setOpenDimensionPopover(dimension.id);
                                  setDimensionFilterText(prev => ({ ...prev, [dimension.id]: '' }));
                                } else {
                                  setOpenDimensionPopover(null);
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 w-6 p-0 rounded-md border-dashed"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-0" align="start">
                                <div className="flex flex-col">
                                  {/* Filter input */}
                                  <div className="p-3 border-b">
                                    <Input
                                      placeholder={`Search or add ${dimension.name.toLowerCase()} value...`}
                                      value={getFilterText(dimension.id)}
                                      onChange={(e) => setDimensionFilterText(prev => ({
                                        ...prev,
                                        [dimension.id]: e.target.value
                                      }))}
                                      autoFocus
                                      className="text-sm"
                                    />
                                  </div>
                                  
                                  {/* Available values list */}
                                  <div className="max-h-48 overflow-y-auto">
                                    {(() => {
                                      const availableValues = getAvailableDimensionValues(dimension, getFilterText(dimension.id));
                                      
                                      if (availableValues.length === 0 && !shouldShowCreateOption(dimension.id)) {
                                        return (
                                          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                            {getFilterText(dimension.id) ? 'No matching values found' : 'No available values'}
                                          </div>
                                        );
                                      }
                                      
                                      return availableValues.map((value: string) => (
                                        <button
                                          key={value}
                                          type="button"
                                          onClick={() => addDimensionValueToString(dimension.id, value)}
                                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                                        >
                                          {value}
                                        </button>
                                      ));
                                    })()}
                                  </div>
                                  
                                  {/* Create new value footer */}
                                  {shouldShowCreateOption(dimension.id) && (
                                    <div className="border-t">
                                      <button
                                        type="button"
                                        onClick={() => addDimensionValueToString(dimension.id, getFilterText(dimension.id).trim())}
                                        className="w-full px-3 py-2 text-left text-sm bg-muted/50 hover:bg-muted transition-colors flex items-center gap-2"
                                      >
                                        <Plus className="h-3 w-3" />
                                        Create "{getFilterText(dimension.id).trim()}"
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          
                          {/* Show a message when no values are selected */}
                          {(!stringDimensionValues[dimension.id] || stringDimensionValues[dimension.id].length === 0) && (
                            <div className="text-sm text-muted-foreground">
                              No values selected for {dimension.name}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p>No dimensions found in this project.</p>
                    <p className="text-sm mt-2">Create dimensions in the filter sidebar to categorize your strings.</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="advanced" className="mt-0">
                <div>
                  <h3 className="font-medium mb-2">Variable Name</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    All strings are automatically available as variables. You can provide a custom name or leave blank to use an auto-generated hash.
                  </p>
                  <div className="space-y-4">
                    
                    <div className="space-y-2">
                      <Label htmlFor="variable-name">Custom Variable Name</Label>
                      <Input
                        id="variable-name"
                        value={stringVariableName}
                        onChange={(e) => setStringVariableName(e.target.value)}
                        placeholder="Enter custom variable name (optional)"
                      />
                      <p className="text-xs text-muted-foreground">
                        Optional: Provide a custom name for this variable. If left blank, a random hash will be used (e.g., ABC123).
                      </p>
                    </div>

                    {/* Conditional Variable Option */}
                    <div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="stringIsConditional"
                          checked={stringIsConditional}
                          onChange={(e) => setStringIsConditional(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="stringIsConditional" className="text-sm font-medium">
                          Make this a conditional variable
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Conditional variables can be toggled on/off when viewing strings
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            </form>
          </div>
          
          {/* Fixed Footer */}
          <SheetFooter className="px-6 py-4 border-t bg-background">
            <Button type="button" variant="secondary" onClick={closeStringDialog}>
              Cancel
            </Button>
            <Button type="submit" form="string-form">
              {editingString ? "Update" : "Create"} String
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>





      {/* Create/Edit Dimension Sheet */}
      <Sheet open={createDialog === "Dimension" || !!editingDimension} onOpenChange={v => !v && closeDimensionDialog()}>
        <SheetContent side="right" className="w-[600px] max-w-[90vw] flex flex-col p-0">
          {/* Fixed Header */}
          <SheetHeader className="px-6 py-4 border-b bg-background">
            <SheetTitle>{editingDimension ? "Edit Dimension" : "New Dimension"}</SheetTitle>
          </SheetHeader>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <form id="dimension-form" onSubmit={handleDimensionSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dimension-name">Dimension Name</Label>
              <Input
                id="dimension-name"
                value={dimensionName}
                onChange={(e) => setDimensionName(e.target.value)}
                placeholder="Enter dimension name (e.g., 'kind', 'event', 'category')"
                required
              />
              <p className="text-xs text-muted-foreground">
                This dimension will be available when creating or editing strings.
              </p>
            </div>

            {/* Dimension Values Management */}
            <div>
              <label className="block mb-2 font-medium">Dimension Values</label>
              <p className="text-xs text-muted-foreground mb-3">
                Optional: Predefined values that users can select when assigning this dimension to strings.
              </p>
              
              {/* Add new value input */}
              <div className="flex gap-2 mb-3">
                <Input
                  value={newDimensionValue}
                  onChange={(e) => setNewDimensionValue(e.target.value)}
                  placeholder="Enter new dimension value"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDimensionValue();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={addDimensionValue}
                  disabled={!newDimensionValue.trim()}
                >
                  Add
                </Button>
              </div>

              {/* Existing values */}
              {dimensionValues.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {dimensionValues.map((value, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <Input
                        value={value}
                        onChange={(e) => updateDimensionValue(value, e.target.value)}
                        onBlur={(e) => {
                          if (e.target.value.trim() !== value) {
                            updateDimensionValue(value, e.target.value.trim());
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeDimensionValue(value)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {dimensionValues.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No values defined. Users will be able to enter custom values when using this dimension.
                </p>
              )}
            </div>
            
            </form>
          </div>
          
          {/* Fixed Footer */}
          <SheetFooter className="px-6 py-4 border-t bg-background">
            <Button type="button" variant="secondary" onClick={closeDimensionDialog}>
              Cancel
            </Button>
            <Button type="submit" form="dimension-form" disabled={!dimensionName.trim()}>
              {editingDimension ? "Update" : "Create"} Dimension
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Canvas Settings Drawer */}
      <Sheet open={isCanvasSettingsOpen} onOpenChange={setIsCanvasSettingsOpen}>
        <SheetContent side="right" className="w-[400px] max-w-[90vw] flex flex-col p-0">
          {/* Fixed Header */}
          <SheetHeader className="px-6 py-4 border-b bg-background">
            <SheetTitle>Canvas Settings</SheetTitle>
          </SheetHeader>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              {/* Display Mode Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Display Mode</h3>
                
                {/* Plaintext Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Type className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Plaintext Mode</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Show resolved content without styling or conditional variables
                    </p>
                  </div>
                  <Button
                    variant={isPlaintextMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsPlaintextMode(!isPlaintextMode)}
                    className={`ml-4 ${
                      isPlaintextMode 
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    {isPlaintextMode ? 'On' : 'Off'}
                  </Button>
                </div>

                {/* Show Variables Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Show Variables</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Display variable names as badges instead of resolved content
                    </p>
                  </div>
                  <Button
                    variant={showVariableBadges ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowVariableBadges(!showVariableBadges)}
                    className={`ml-4 ${
                      showVariableBadges 
                        ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    {showVariableBadges ? 'On' : 'Off'}
                  </Button>
                </div>

                {/* Hide Embedded Strings Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Hide Embedded Strings</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Hide strings that are used as variables or spawn variables in other strings
                    </p>
                  </div>
                  <Button
                    variant={hideEmbeddedStrings ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHideEmbeddedStrings(!hideEmbeddedStrings)}
                    className={`ml-4 ${
                      hideEmbeddedStrings 
                        ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    {hideEmbeddedStrings ? 'On' : 'Off'}
                  </Button>
                </div>

                {/* Show Variable Names Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Type className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Show Variable Names</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Display the variable name (title) on each string card
                    </p>
                  </div>
                  <Button
                    variant={showVariableNames ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowVariableNames(!showVariableNames)}
                    className={`ml-4 ${
                      showVariableNames 
                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    {showVariableNames ? 'On' : 'Off'}
                  </Button>
                </div>

                {/* Show Variable Hashes Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Show Variable Hashes</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Display the copiable variable hash badge on each string card
                    </p>
                  </div>
                  <Button
                    variant={showVariableHashes ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowVariableHashes(!showVariableHashes)}
                    className={`ml-4 ${
                      showVariableHashes 
                        ? 'bg-purple-500 hover:bg-purple-600 text-white' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    {showVariableHashes ? 'On' : 'Off'}
                  </Button>
                </div>
              </div>

              {/* String Type Filter Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">String Type Filter</h3>
                
                <div className="space-y-3">
                  {/* All Types Option */}
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id="filter-all"
                      name="stringTypeFilter"
                      checked={stringTypeFilter === 'all'}
                      onChange={() => setStringTypeFilter('all')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="filter-all" className="flex items-center gap-2 cursor-pointer">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Show All</span>
                    </label>
                  </div>
                  
                  {/* Strings Only Option */}
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id="filter-strings"
                      name="stringTypeFilter"
                      checked={stringTypeFilter === 'strings'}
                      onChange={() => setStringTypeFilter('strings')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="filter-strings" className="flex items-center gap-2 cursor-pointer">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">String Variables Only</span>
                    </label>
                  </div>
                  
                  {/* Conditionals Only Option */}
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id="filter-conditionals"
                      name="stringTypeFilter"
                      checked={stringTypeFilter === 'conditionals'}
                      onChange={() => setStringTypeFilter('conditionals')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="filter-conditionals" className="flex items-center gap-2 cursor-pointer">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Conditional Variables Only</span>
                    </label>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Filter which types of strings are displayed in the canvas
                </p>
              </div>

              {/* Future Settings Placeholder */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">More Settings</h3>
                <div className="text-sm text-muted-foreground italic">
                  Additional canvas settings will be added here in future updates.
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Other Items Dialog */}
      <Dialog open={!!createDialog && createDialog !== "String" && createDialog !== "Variable" && createDialog !== "Dimension"} onOpenChange={v => !v && setCreateDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>New {createDialog}</DialogTitle>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="generic-name">Name</Label>
              <Input 
                id="generic-name"
                placeholder={`Enter ${createDialog?.toLowerCase()} name`} 
                required 
              />
            </div>
            {/* Add more fields as needed for each type */}
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="secondary" onClick={() => setCreateDialog(null)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Nested String Edit Sheet */}
      <Sheet open={!!editingNestedString} onOpenChange={v => !v && closeNestedStringDialog()}>
        <SheetContent side="right" className="w-[700px] max-w-[90vw] flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b bg-background">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeNestedStringDialog}
                  className="h-8 w-8 p-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <SheetTitle>Edit String Variable</SheetTitle>
              </div>
              {!nestedStringConditionalMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNestedStringSplit}
                  className="flex items-center gap-2"
                >
                  <Folder className="h-4 w-4" />
                  Conditional
                </Button>
              )}
            </div>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {editingConditional ? (
              // Split variable editing UI
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Conditional Spawns</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addConditionalSpawn}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Spawn
                  </Button>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Edit the spawned string variables below. Each spawn represents a different version of this conditional.
                </p>

                <div className="space-y-4">
                  {conditionalSpawns.map((spawn, index) => (
                    <div key={spawn.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono">
                            {`{{${spawn.effective_variable_name || spawn.variable_hash}}}`}
                          </Badge>
                        </h4>
                        {conditionalSpawns.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeConditionalSpawn(spawn.id)}
                            className="h-8 w-8 p-0 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Content</Label>
                        <Textarea
                          value={spawn.content}
                          onChange={(e) => updateConditionalSpawn(spawn.id, 'content', e.target.value)}
                          placeholder="Enter spawn content"
                          rows={3}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Variable Name</Label>
                        <Input
                          value={spawn.variable_name || ''}
                          onChange={(e) => updateConditionalSpawn(spawn.id, 'variable_name', e.target.value)}
                          placeholder="Custom variable name (optional)"
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`spawn-${spawn.id}-conditional`}
                          checked={spawn.is_conditional}
                          onChange={(e) => updateConditionalSpawn(spawn.id, 'is_conditional', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`spawn-${spawn.id}-conditional`} className="text-sm">
                          Make this spawn conditional
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : nestedStringConditionalMode ? (
              // Split mode UI (for creating new splits)
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Conditional Spawns</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addNestedStringSpawn}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Spawn
                  </Button>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Each spawn will be a separate string variable. Configure the content for each spawn below.
                </p>

                <div className="space-y-4">
                  {nestedStringSpawns.map((spawn, index) => (
                    <div key={spawn.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Spawn {index + 1}</h4>
                        {nestedStringSpawns.length > 2 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeNestedStringSpawn(spawn.id)}
                            className="h-8 w-8 p-0 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Content</Label>
                        <Textarea
                          value={spawn.content}
                          onChange={(e) => updateNestedStringSpawn(spawn.id, 'content', e.target.value)}
                          placeholder="Enter spawn content"
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`spawn-${spawn.id}-conditional`}
                          checked={spawn.isConditional}
                          onChange={(e) => updateNestedStringSpawn(spawn.id, 'isConditional', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`spawn-${spawn.id}-conditional`} className="text-sm">
                          Make this spawn conditional
                        </Label>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        Variable name: <code>{`{{${spawn.variableName}}}`}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Regular edit mode UI
              <form id="nested-string-form" onSubmit={handleNestedStringSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nested-string-content">Content</Label>
                  <Textarea
                    id="nested-string-content"
                    value={nestedStringContent}
                    onChange={(e) => setNestedStringContent(e.target.value)}
                    placeholder="Enter string content"
                    rows={4}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nested-string-variable-name">Custom Variable Name (Optional)</Label>
                  <Input
                    id="nested-string-variable-name"
                    value={nestedStringVariableName}
                    onChange={(e) => setNestedStringVariableName(e.target.value)}
                    placeholder="Leave empty to use auto-generated hash"
                  />
                  <p className="text-xs text-muted-foreground">
                    {nestedStringVariableName.trim() 
                      ? `This will be used as {{${nestedStringVariableName.trim()}}} in other strings.`
                      : editingNestedString 
                      ? `Currently using: {{${editingNestedString.effective_variable_name || editingNestedString.variable_hash}}}`
                      : "A random hash will be generated automatically."
                    }
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="nested-string-conditional"
                    checked={nestedStringIsConditional}
                    onChange={(e) => setNestedStringIsConditional(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="nested-string-conditional" className="text-sm font-medium">
                    Make this a conditional string
                  </Label>
                </div>
              </form>
            )}
          </div>
          
          <SheetFooter className="px-6 py-4 border-t bg-background">
            {editingConditional ? (
              <>
                <Button type="button" variant="secondary" onClick={closeNestedStringDialog}>
                  Close
                </Button>
                <Button 
                  type="button" 
                  onClick={handleSplitVariableSubmit}
                >
                  Update All Spawns
                </Button>
              </>
            ) : nestedStringConditionalMode ? (
              <>
                <Button type="button" variant="secondary" onClick={() => setNestedStringConditionalMode(false)}>
                  Cancel Split
                </Button>
                <Button 
                  type="button" 
                  onClick={handleNestedStringSubmit}
                  disabled={nestedStringSpawns.length < 2}
                >
                  Create {nestedStringSpawns.length} Spawns
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={closeNestedStringDialog}>
                  Back to String
                </Button>
                <Button type="submit" form="nested-string-form">
                  Update String
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete String Confirmation Dialog */}
      <Dialog 
        key="delete-string-dialog" 
        open={!!deleteStringDialog && deleteStringDialog.id} 
        onOpenChange={(open) => {
          if (!open) setDeleteStringDialog(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete String</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the string "{deleteStringDialog?.effective_variable_name || deleteStringDialog?.variable_hash}"?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm font-medium text-red-800">
                ⚠️ Warning: This action cannot be undone
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteStringDialog(null)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteString}
            >
              Delete String
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conversion Confirmation Dialog */}
      <Dialog open={conversionConfirmDialog} onOpenChange={v => !v && setConversionConfirmDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingConversionType === 'string' ? 'Convert to Normal String' : 'Convert to Conditional'}
            </DialogTitle>
            <DialogDescription>
              {pendingConversionType === 'string' 
                ? 'This will convert your conditional back to a normal string. All spawn strings will be deleted and only the content from the first spawn will be preserved.'
                : 'This will convert your normal string into a conditional. The current content will become the first spawn, and you can add more spawns later.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
              <p className="text-sm font-medium text-orange-800">
                ⚠️ Warning: This action cannot be undone
              </p>
              <p className="text-sm text-orange-600 mt-1">
                {pendingConversionType === 'string' 
                  ? 'All spawn strings except the first one will be permanently deleted.'
                  : 'Your string will be restructured into a conditional format.'
                }
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setConversionConfirmDialog(false);
                setPendingConversionType(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConversion}
            >
              {pendingConversionType === 'string' ? 'Convert to String' : 'Convert to Variable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 