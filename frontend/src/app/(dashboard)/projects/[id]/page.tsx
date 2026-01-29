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
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


import { Edit2, Trash2, Type, Plus, X, MoreHorizontal, Download, Upload, Copy, Folder, Spool, Signpost, ArrowLeft, Settings, EyeOff, Hash, Lock, PanelBottom, Search, Sparkles } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Textarea } from "@/components/ui/textarea";
import { StringEditDrawer, VariableSearchSelect } from "@/components/StringEditDrawer";
import { ImageToTextModal } from "@/components/ImageToTextModal";
import { StringTile } from "@/components/StringTile";
import { useSessionDrawer } from "@/hooks/useSessionDrawer";
import { useHeader } from "@/lib/HeaderContext";
import { toast } from "sonner";
import { ImageIcon } from "lucide-react";
import { FEATURES } from "@/lib/featureFlags";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPlaintextMode, setIsPlaintextMode] = useState(false);
  const [showVariableBadges, setShowVariableBadges] = useState(false);
  const [hideEmbeddedStrings, setHideEmbeddedStrings] = useState(false);
  // showVariableNames removed - no longer using display names, only hashes
  const [showVariableHashes, setShowVariableHashes] = useState(false); // Hide copiable hashes by default
  const [isStringDrawerOpen, setIsStringDrawerOpen] = useState(false);
  const [isCanvasSettingsOpen, setIsCanvasSettingsOpen] = useState(false);
  
  // Conditions sidebar state - migrated from dimensions to direct conditional variable selection
  const [selectedConditionalSpawns, setSelectedConditionalSpawns] = useState<{[conditionalVariableName: string]: string | null}>({});
  
  // Hide controlled variables in conditions sidebar (enabled by default)
  const [hideControlledVariables, setHideControlledVariables] = useState(true);
  
  // Bottom drawer state
  const [isBottomDrawerOpen, setIsBottomDrawerOpen] = useState(false);
  
  // Controlling spawn selector state (for conditions tab)
  const [controllingSpawnSearch, setControllingSpawnSearch] = useState("");
  const [showControllingSpawnResults, setShowControllingSpawnResults] = useState(false);
  const [isControllingConditionEnabled, setIsControllingConditionEnabled] = useState(false);
  
  // Image to text modal state
  const [isImageToTextModalOpen, setIsImageToTextModalOpen] = useState(false);
  
  // Global search state - filters conditions sidebar and strings canvas
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  
  // Legacy dimension state for backward compatibility during migration
  const [selectedDimensionValues, setSelectedDimensionValues] = useState<{[dimensionId: number]: string | null}>({});
  
  // Project edit/delete state
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deleteProjectDialog, setDeleteProjectDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [createDialog, setCreateDialog] = useState<null | "Variable" | "Conditional" | "String">(null);
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

  // Function to refresh project data from the backend
  const refreshProject = useCallback(async () => {
    try {
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(updatedProject));
    } catch (err) {
      console.error('Failed to refresh project:', err);
    }
  }, [id]);

  // UNIFIED DRAWER SYSTEM - Replaces multiple old drawer systems
  const mainDrawer = useSessionDrawer({
    project,
    selectedDimensionValues,
    pendingStringVariables,
    onSuccess: async () => {
      console.log('Main drawer saved successfully');
      await refreshProject(); // Refresh project data after save
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

  // Header context - for project breadcrumb in app header
  const { setProjectInfo } = useHeader();

  // Set project info in header when project loads
  useEffect(() => {
    if (project) {
      setProjectInfo({
        name: project.name,
        onEdit: () => {
          setEditingProject(project);
          setProjectName(project.name);
          setProjectDescription(project.description || "");
        },
        onImport: () => setImportDialog(true),
        onDownload: () => setDownloadDialog(true),
        onDuplicate: handleDuplicateProject,
        onDelete: () => setDeleteProjectDialog(true),
      });
    }
    
    // Clear header when leaving the page
    return () => {
      setProjectInfo(null);
    };
  }, [project, setProjectInfo]);

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

  // Helper function to resolve content to plaintext (always resolves, regardless of showVariableBadges)
  // Used for content previews in conditions sidebar and controlling spawn selector
  const resolveContentToPlaintext = useCallback((content: string, excludeStringId?: string | number): string => {
    if (!content) return '';
    
    let processedContent = content;
    const variableMatches = content.match(/{{([^}]+)}}/g) || [];
    const visited = new Set<string>();
    
    const resolveRecursively = (text: string, depth: number = 0): string => {
      if (depth > 10) return text; // Prevent infinite recursion
      
      let result = text;
      const matches = text.match(/{{([^}]+)}}/g) || [];
      
      for (const match of matches) {
        const variableName = match.slice(2, -2);
        if (visited.has(variableName)) continue;
        visited.add(variableName);
        
        // Check if this is a conditional variable
        const conditionalVariable = project?.strings?.find((str: any) => 
          str.is_conditional_container && 
          (str.effective_variable_name === variableName || 
           str.variable_name === variableName || 
           str.variable_hash === variableName)
        );
        
        if (conditionalVariable) {
          const conditionalName = conditionalVariable.effective_variable_name || conditionalVariable.variable_hash;
          const selectedSpawnName = selectedConditionalSpawns[conditionalName];
          
          if (selectedSpawnName === "Hidden") {
            result = result.replace(new RegExp(`{{${variableName}}}`, 'g'), '');
          } else if (selectedSpawnName) {
            const spawnVariable = project?.strings?.find((str: any) =>
              str.effective_variable_name === selectedSpawnName ||
              str.variable_name === selectedSpawnName ||
              str.variable_hash === selectedSpawnName
            );
            if (spawnVariable) {
              const spawnContent = resolveRecursively(spawnVariable.content || '', depth + 1);
              result = result.replace(new RegExp(`{{${variableName}}}`, 'g'), spawnContent);
            }
          }
        } else {
          // Regular embedded variable - resolve it too
          const embeddedVar = project?.strings?.find((str: any) =>
            !str.is_conditional_container &&
            (str.effective_variable_name === variableName ||
             str.variable_name === variableName ||
             str.variable_hash === variableName) &&
            str.id !== excludeStringId
          );
          if (embeddedVar) {
            const embeddedContent = resolveRecursively(embeddedVar.content || '', depth + 1);
            result = result.replace(new RegExp(`{{${variableName}}}`, 'g'), embeddedContent);
          }
        }
        
        visited.delete(variableName);
      }
      
      return result;
    };
    
    return resolveRecursively(processedContent);
  }, [project?.strings, selectedConditionalSpawns]);

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

  
  // Helper function to copy variable reference to clipboard
  const copyVariableToClipboard = useCallback((hash: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const copyText = `{{${hash}}}`;
    navigator.clipboard.writeText(copyText);
    toast.success(`Copied "${copyText}" to clipboard`);
  }, []);
  
  // Helper function to check if a variable is in use (embedded or spawn)
  // Returns { isInUse: boolean, usageType: 'embedded' | 'spawn' | 'both' | null, usedBy: string[] }
  const checkVariableUsage = useCallback((variableId: number | string): { 
    isInUse: boolean; 
    usageType: 'embedded' | 'spawn' | 'both' | null;
    embeddedIn: string[];
    spawnOf: string[];
  } => {
    if (!project?.strings) return { isInUse: false, usageType: null, embeddedIn: [], spawnOf: [] };
    
    const variable = project.strings.find((s: any) => s.id === variableId || s.id === Number(variableId));
    if (!variable) return { isInUse: false, usageType: null, embeddedIn: [], spawnOf: [] };
    
    const variableName = variable.effective_variable_name || variable.variable_name || variable.variable_hash;
    const variableHash = variable.variable_hash;
    
    // Check if embedded in other variables
    const embeddedIn: string[] = [];
    project.strings.forEach((str: any) => {
      if (str.id === variable.id) return; // Skip self
      if (!str.content) return;
      
      // Check if this variable is referenced in the content
      const patterns = [
        `{{${variableName}}}`,
        `{{${variableHash}}}`,
      ];
      if (variable.variable_name && variable.variable_name !== variableName) {
        patterns.push(`{{${variable.variable_name}}}`);
      }
      
      for (const pattern of patterns) {
        if (str.content.includes(pattern)) {
          const parentName = str.effective_variable_name || str.variable_hash;
          if (!embeddedIn.includes(parentName)) {
            embeddedIn.push(parentName);
          }
          break;
        }
      }
    });
    
    // Check if acting as a spawn variable (controlled by another variable or part of a conditional)
    const spawnOf: string[] = [];
    
    // Method 1: Check controlled_by_spawn relationship
    if (variable.controlled_by_spawn_id) {
      const controller = project.strings.find((s: any) => s.id === variable.controlled_by_spawn_id);
      if (controller) {
        const controllerName = controller.effective_variable_name || controller.variable_hash;
        spawnOf.push(`Controlled by: ${controllerName}`);
      }
    }
    
    // Method 2: Check if this variable is a spawn of a conditional (via dimension values)
    project.strings.forEach((str: any) => {
      if (!str.is_conditional_container) return;
      
      const conditionalName = str.effective_variable_name || str.variable_hash;
      const dimension = project?.dimensions?.find((d: any) => d.name === conditionalName);
      
      if (dimension) {
        // Check if this variable's name appears in dimension values
        const isSpawn = dimension.values?.some((dv: any) => 
          dv.value === variableName || dv.value === variableHash
        );
        if (isSpawn) {
          const parentName = str.effective_variable_name || str.variable_hash;
          if (!spawnOf.some(s => s.includes(parentName))) {
            spawnOf.push(`Spawn of: ${parentName}`);
          }
        }
      }
    });
    
    const isEmbedded = embeddedIn.length > 0;
    const isSpawn = spawnOf.length > 0;
    
    let usageType: 'embedded' | 'spawn' | 'both' | null = null;
    if (isEmbedded && isSpawn) usageType = 'both';
    else if (isEmbedded) usageType = 'embedded';
    else if (isSpawn) usageType = 'spawn';
    
    return {
      isInUse: isEmbedded || isSpawn,
      usageType,
      embeddedIn,
      spawnOf,
    };
  }, [project?.strings, project?.dimensions]);
  
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

  // Auto-select controlled spawns when their controller is selected
  useEffect(() => {
    if (!project?.strings) return;
    
    const controllingMap = getControllingSpawnMap();
    const { controllerToControlled } = controllingMap;
    
    // Build a map of what should be selected based on controllers
    const autoSelections: {[conditionalName: string]: string} = {};
    
    // For each currently selected spawn, check if it controls other spawns
    Object.entries(selectedConditionalSpawns).forEach(([conditionalName, selectedSpawnName]) => {
      if (!selectedSpawnName) return;
      
      // Find the selected spawn's ID
      const selectedSpawn = project.strings.find((s: any) => 
        (s.effective_variable_name === selectedSpawnName || s.variable_hash === selectedSpawnName)
      );
      
      if (!selectedSpawn) return;
      
      // Check if this spawn controls other spawns
      const controlledSpawnIds = controllerToControlled.get(selectedSpawn.id);
      if (!controlledSpawnIds) return;
      
      // For each controlled spawn, find its conditional and auto-select it
      controlledSpawnIds.forEach((controlledId: number) => {
        const controlledSpawn = project.strings.find((s: any) => s.id === controlledId);
        if (!controlledSpawn) return;
        
        const controlledSpawnName = controlledSpawn.effective_variable_name || controlledSpawn.variable_hash;
        
        // Find which conditional this controlled spawn belongs to
        project.dimensions?.forEach((dimension: any) => {
          const isSpawnOfThisDimension = dimension.values?.some((dv: any) => 
            dv.value === controlledSpawnName && dv.value !== "Hidden"
          );
          
          if (isSpawnOfThisDimension) {
            autoSelections[dimension.name] = controlledSpawnName;
          }
        });
      });
    });
    
    // Only apply auto-selections if they differ from current selections
    if (Object.keys(autoSelections).length > 0) {
      const hasChanges = Object.entries(autoSelections).some(
        ([conditionalName, spawnName]) => selectedConditionalSpawns[conditionalName] !== spawnName
      );
      
      if (hasChanges) {
        setSelectedConditionalSpawns(prev => ({
          ...prev,
          ...autoSelections
        }));
      }
    }
  }, [selectedConditionalSpawns, project?.strings]);

  // Reset controlling condition state when drawer opens or active variable changes
  useEffect(() => {
    // Initialize based on whether the current variable has a controlledBySpawnId
    setIsControllingConditionEnabled(false);
    setControllingSpawnSearch("");
    setShowControllingSpawnResults(false);
  }, [mainDrawer.stringData?.id]);

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

  // Detect embedded variables in session drawer content and update pending variables
  useEffect(() => {
    // Only run when drawer is open and we have content
    if (!mainDrawer.isOpen) {
      return;
    }
    
    const content = mainDrawer.content || '';
    if (!content.trim()) {
      setPendingStringVariables({});
      return;
    }

    const variableMatches = content.match(/{{([^}]+)}}/g) || [];
    const variableNames = variableMatches.map((match: string) => match.slice(2, -2));
    const uniqueVariableNames = [...new Set(variableNames)];

    // Find existing string variables
    const existingStringVariableNames = project?.strings?.map((str: any) => 
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
          content: "",
          is_conditional: false
        };
      });
      
      return newPending;
    });
  }, [mainDrawer.isOpen, mainDrawer.content, project?.strings]);

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

  // Helper function to build controlling spawn relationships
  const getControllingSpawnMap = () => {
    if (!project?.strings) return { controllerToControlled: new Map(), controlledToController: new Map() };
    
    const controllerToControlled = new Map<number, number[]>(); // controller spawn ID -> array of controlled spawn IDs
    const controlledToController = new Map<number, number>(); // controlled spawn ID -> controller spawn ID
    
    project.strings.forEach((str: any) => {
      if (str.controlled_by_spawn_id) {
        // This spawn is controlled by another spawn
        controlledToController.set(str.id, str.controlled_by_spawn_id);
        
        // Add to controller's list of controlled spawns
        if (!controllerToControlled.has(str.controlled_by_spawn_id)) {
          controllerToControlled.set(str.controlled_by_spawn_id, []);
        }
        controllerToControlled.get(str.controlled_by_spawn_id)!.push(str.id);
      }
    });
    
    return { controllerToControlled, controlledToController };
  };

  // Helper function to check if a spawn should be auto-selected due to controller
  const shouldAutoSelectSpawn = (spawnId: number, controllingMap: ReturnType<typeof getControllingSpawnMap>) => {
    const { controlledToController } = controllingMap;
    const controllerId = controlledToController.get(spawnId);
    
    if (!controllerId) return false;
    
    // Check if the controller spawn is currently selected
    const controllerSpawn = project?.strings?.find((s: any) => s.id === controllerId);
    if (!controllerSpawn) return false;
    
    const controllerName = controllerSpawn.effective_variable_name || controllerSpawn.variable_hash;
    
    // Find which conditional the controller belongs to
    for (const [conditionalName, selectedSpawnName] of Object.entries(selectedConditionalSpawns)) {
      if (selectedSpawnName === controllerName) {
        return true; // Controller is selected, so this spawn should be auto-selected
      }
    }
    
    return false;
  };

  // Helper function to check if a spawn should be disabled (sibling of controlled spawn)
  const shouldDisableSpawn = (spawnId: number, conditionalName: string, controllingMap: ReturnType<typeof getControllingSpawnMap>) => {
    const { controlledToController } = controllingMap;
    
    // Find all spawns for this conditional
    const dimension = project?.dimensions?.find((d: any) => d.name === conditionalName);
    if (!dimension) return false;
    
    const spawnsForConditional = project?.strings?.filter((str: any) => {
      if (str.is_conditional_container) return false;
      const spawnName = str.effective_variable_name || str.variable_hash;
      return dimension.values?.some((dv: any) => dv.value === spawnName && dv.value !== "Hidden");
    }) || [];
    
    // Check if any sibling spawn is controlled and its controller is active
    for (const siblingSpawn of spawnsForConditional) {
      if (siblingSpawn.id === spawnId) continue; // Skip self
      
      const siblingControllerId = controlledToController.get(siblingSpawn.id);
      if (siblingControllerId) {
        // This sibling is controlled - check if its controller is active
        const controllerSpawn = project?.strings?.find((s: any) => s.id === siblingControllerId);
        if (controllerSpawn) {
          const controllerName = controllerSpawn.effective_variable_name || controllerSpawn.variable_hash;
          
          // Check if controller is selected in any conditional
          for (const selectedSpawnName of Object.values(selectedConditionalSpawns)) {
            if (selectedSpawnName === controllerName) {
              // Controller is active, so this spawn should be disabled
              return true;
            }
          }
        }
      }
    }
    
    return false;
  };

  // Show all strings with optional filtering for embedded strings and string type
  const allStrings = project?.strings || [];
  const embeddedStringIds = hideEmbeddedStrings ? getEmbeddedStringIds() : new Set<number>();
  
  let filteredStrings = allStrings;
  
  // Apply embedded strings filter
  if (hideEmbeddedStrings) {
    filteredStrings = filteredStrings.filter((str: any) => !embeddedStringIds.has(str.id));
  }
  
  // Always exclude conditional variables from canvas (they're managed in the Conditions sidebar)
  filteredStrings = filteredStrings.filter((str: any) => !str.is_conditional_container);
  
  // Apply global search filter
  if (globalSearchQuery.trim()) {
    const query = globalSearchQuery.toLowerCase().trim();
    filteredStrings = filteredStrings.filter((str: any) => {
      const content = (str.content || '').toLowerCase();
      const variableName = (str.effective_variable_name || str.variable_name || '').toLowerCase();
      const variableHash = (str.variable_hash || '').toLowerCase();
      return content.includes(query) || 
             variableName.includes(query) || 
             variableHash.includes(query);
    });
  }

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

  // Helper function to get CSS class based on variable type and same-type nesting depth
  // colorDepth tracks how many times we've nested the SAME type consecutively
  const getEmbeddedVarClass = (type: 'string' | 'conditional', colorDepth: number): string => {
    // Cap at 5 levels of tinting (0-4)
    const cappedDepth = Math.min(colorDepth, 4);
    return `embedded-var embedded-var-${type}-${cappedDepth}`;
  };

  // Function to resolve conditional content based on conditional spawn selection
  // colorContext: tracks the type of the parent variable ('string', 'conditional', or null for root)
  // colorDepth: tracks how many times we've nested the SAME type consecutively
  const resolveConditionalContent = (
    conditionalVariable: any, 
    variableName: string, 
    depth: number = 0,
    colorContext: 'string' | 'conditional' | null = null,
    colorDepth: number = 0
  ): (string | React.ReactNode)[] => {
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
            // If spawn is also a conditional, render it as nested conditional
            // Conditional on conditional: increment colorDepth
            const newColorDepth = colorContext === 'conditional' ? colorDepth + 1 : 0;
            const nestedSpawnContent = resolveConditionalContent(activeSpawn, spawnName, depth + 1, 'conditional', newColorDepth);
            const conditionalClass = getEmbeddedVarClass('conditional', newColorDepth);
            
            return [
              <span
                key={`fallback-spawn-${conditionalName}-${spawnName}`}
                className={conditionalClass}
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
            // For string variable spawns, render as styled string variable with its content
            // String on conditional: reset colorDepth to 0
            const newColorDepth = colorContext === 'string' ? colorDepth + 1 : 0;
            const stringClass = getEmbeddedVarClass('string', newColorDepth);
            
            // If the spawn has content, render it recursively; otherwise show the variable name
            let spawnDisplayContent;
            if (activeSpawn.content && activeSpawn.content.trim() !== '') {
              // Recursively render the spawn's content to handle any nested variables
              const renderedContent = renderContentRecursively(activeSpawn.content, depth + 1, `fallback-spawn-${conditionalName}-`, 'string', newColorDepth);
              spawnDisplayContent = renderedContent;
            } else {
              // If no content, show the variable name as fallback
              spawnDisplayContent = [spawnName];
            }
            
            return [
              <span
                key={`fallback-spawn-${conditionalName}-${spawnName}`}
                className={stringClass}
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
      // If spawn is also a conditional, render it as nested conditional
      // Conditional on conditional: increment colorDepth
      const newColorDepth = colorContext === 'conditional' ? colorDepth + 1 : 0;
      const nestedSpawnContent = resolveConditionalContent(activeSpawn, spawnName, depth + 1, 'conditional', newColorDepth);
      const conditionalClass = getEmbeddedVarClass('conditional', newColorDepth);
      
      return [
        <span
          key={`spawn-${conditionalName}-${spawnName}`}
          className={conditionalClass}
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
      // For string variable spawns, render as styled string variable with its content
      // String on conditional: reset colorDepth to 0
      const newColorDepth = colorContext === 'string' ? colorDepth + 1 : 0;
      const stringClass = getEmbeddedVarClass('string', newColorDepth);
      
      // If the spawn has content, render it recursively; otherwise show the variable name
      let spawnDisplayContent;
      if (activeSpawn.content && activeSpawn.content.trim() !== '') {
        // Recursively render the spawn's content to handle any nested variables
        const renderedContent = renderContentRecursively(activeSpawn.content, depth + 1, `spawn-${conditionalName}-`, 'string', newColorDepth);
        spawnDisplayContent = renderedContent;
      } else {
        // If no content, show the variable name as fallback
        spawnDisplayContent = [spawnName];
      }
      
      return [
        <span
          key={`spawn-${conditionalName}-${spawnName}`}
          className={stringClass}
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
  // colorContext: tracks the type of the parent variable ('string', 'conditional', or null for root)
  // colorDepth: tracks how many times we've nested the SAME type consecutively
  const renderContentRecursively = (
    content: string, 
    depth: number = 0, 
    keyPrefix: string = "",
    colorContext: 'string' | 'conditional' | null = null,
    colorDepth: number = 0
  ): (string | React.ReactNode)[] => {
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
            
            // Find spawns for this conditional using the same method as conditions sidebar
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
              // In plaintext mode, we don't track color context
              const spawnContent = renderContentRecursively(activeSpawn.content, depth + 1, `${keyPrefix}${variableName}-`, null, 0);
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
              const expandedContent = renderContentRecursively(stringVariable.content, depth + 1, `${keyPrefix}${variableName}-`, null, 0);
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
            // Conditional variable badge with gradient
            const displayName = stringVariable.effective_variable_name || stringVariable.variable_hash;
            return (
              <Badge
                key={`${keyPrefix}${depth}-${index}-${variableName}`}
                variant="outline"
                className="variable-hash-badge variable-hash-badge-conditional mx-1"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditInCascadingDrawer(stringVariable);
                }}
                title={`Click to edit conditional "${displayName}"`}
              >
                {displayName}
              </Badge>
            );
          } else if (stringVariable) {
            // String variable badge with gradient
            const displayName = stringVariable.effective_variable_name || stringVariable.variable_hash;
            return (
              <Badge
                key={`${keyPrefix}${depth}-${index}-${variableName}`}
                variant="outline"
                className="variable-hash-badge variable-hash-badge-string mx-1"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditInCascadingDrawer(stringVariable);
                }}
                title={`Click to edit string variable "${displayName}"`}
              >
                {displayName}
              </Badge>
            );
          } else {
            // Variable not found, show as neutral badge
            return (
              <Badge
                key={`${keyPrefix}${depth}-${index}-${variableName}`}
                variant="outline"
                className="variable-hash-badge mx-1"
                title={`Variable "${variableName}" not found`}
              >
                {variableName}
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
              // Conditional variables: Show with conditional styling containing spawn content
              // Conditional on conditional: increment colorDepth, otherwise reset to 0
              const newColorDepth = colorContext === 'conditional' ? colorDepth + 1 : 0;
              const spawnContent = resolveConditionalContent(stringVariable, variableName, depth, 'conditional', newColorDepth);
              const conditionalClass = getEmbeddedVarClass('conditional', newColorDepth);
              
              result.push(
                <span
                  key={`${keyPrefix}${depth}-${index}-${variableName}`}
                  className={conditionalClass}
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
                // For string variables with content, render with string styling
                // String on string: increment colorDepth, otherwise reset to 0
                const newColorDepth = colorContext === 'string' ? colorDepth + 1 : 0;
                const nestedParts = renderContentRecursively(stringVariable.content, depth + 1, `${keyPrefix}${variableName}-`, 'string', newColorDepth);
                const stringClass = getEmbeddedVarClass('string', newColorDepth);
                
                result.push(
                  <span
                    key={`${keyPrefix}${depth}-${index}-${variableName}`}
                    className={stringClass}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditInCascadingDrawer(stringVariable);
                    }}
                    title={`Click to edit string variable "${variableName}" (color depth ${newColorDepth})`}
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

  // Project management functions (moved from legacy block)
  const openEditProject = () => {
    setProjectName(project.name);
    setProjectDescription(project.description || "");
    setEditingProject(project);
  };

  const openImportDialog = () => {
    setImportDialog(true);
  };

  const handleDuplicateProject = async () => {
    console.warn('Project duplication feature temporarily disabled');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Conditions Sidebar (left) */}
        <aside className="w-90 border-r bg-muted/40 flex flex-col">
          {/* Conditions Header - Sticky */}
          <div className="flex items-center justify-between gap-4 border-b px-6 bg-background h-[65px] sticky top-0 z-10">
            <h2 className="text-lg font-semibold">Conditions</h2>
          </div>
          {/* Conditions Content - Scrollable */}
          <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${mainDrawer.isOpen ? 'pb-[360px]' : ''}`}>
          {/* Conditions Section */}
          <div className="space-y-3">
            {/* Conditional Variable Filters - NEW: Direct conditional variable display */}
            {(() => {
              // Get all conditional variables from the project
              let conditionalVariables = project?.strings?.filter((str: any) => str.is_conditional_container) || [];
              
              // Apply global search filter to conditionals
              if (globalSearchQuery.trim()) {
                const query = globalSearchQuery.toLowerCase().trim();
                conditionalVariables = conditionalVariables.filter((str: any) => {
                  const conditionalName = (str.effective_variable_name || str.variable_name || '').toLowerCase();
                  const conditionalHash = (str.variable_hash || '').toLowerCase();
                  
                  // Check if conditional itself matches
                  const conditionalMatches = conditionalName.includes(query) || 
                                             conditionalHash.includes(query);
                  
                  // Also check if any of its spawns match
                  const dimension = project?.dimensions?.find((d: any) => d.name === conditionalName);
                  const spawns = dimension ? project?.strings?.filter((s: any) => 
                    !s.is_conditional_container && 
                    s.dimension_values?.some((dv: any) => dv.dimension === dimension.id)
                  ) || [] : [];
                  
                  const spawnMatches = spawns.some((spawn: any) => {
                    const spawnContent = (spawn.content || '').toLowerCase();
                    const spawnName = (spawn.effective_variable_name || spawn.variable_name || '').toLowerCase();
                    const spawnHash = (spawn.variable_hash || '').toLowerCase();
                    return spawnContent.includes(query) || 
                           spawnName.includes(query) || 
                           spawnHash.includes(query);
                  });
                  
                  return conditionalMatches || spawnMatches;
                });
              }
              
              return conditionalVariables.length > 0 ? (
              <div className="space-y-4">
                  {conditionalVariables.map((conditionalVar: any) => {
                    const conditionalName = conditionalVar.effective_variable_name || conditionalVar.variable_hash;
                    const conditionalDisplayName = conditionalName;
                    
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
                    
                    // Check if all real spawns (excluding Hidden) have controlling conditions
                    const realSpawns = spawnOptions.filter((s: any) => s.id !== 'hidden');
                    const allSpawnsControlled = realSpawns.length > 0 && realSpawns.every((spawn: any) => 
                      spawn.controlled_by_spawn_id && spawn.controlled_by_spawn_id !== conditionalVar.id
                    );
                    
                    // If hideControlledVariables is enabled and all spawns are controlled, hide this entire conditional
                    if (hideControlledVariables && allSpawnsControlled) {
                      return null;
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
                  className="flex items-center justify-between w-full cursor-pointer"
                            onClick={() => mainDrawer.openEditDrawer(conditionalVar)}
                >
                            <h3 className="font-medium text-sm flex-1">{conditionalDisplayName}</h3>
                  <div className={`flex items-center gap-1 transition-opacity ${mainDrawer.isOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                                  mainDrawer.openEditDrawer(conditionalVar);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            const hash = conditionalVar.effective_variable_name || conditionalVar.variable_hash;
                            copyVariableToClipboard(hash);
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy reference
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            // Use the dedicated function to open create drawer for a spawn
                            mainDrawer.openCreateSpawnDrawer?.(conditionalVar);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add New Spawn
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateString(conditionalVar);
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteStringDialog(conditionalVar);
                          }}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {/* Add Button - only shown when drawer is open and not editing self - placed last (far right) */}
                    {mainDrawer.isOpen && mainDrawer.stringData?.id !== conditionalVar.id && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                const hash = conditionalVar.effective_variable_name || conditionalVar.variable_hash;
                                if (mainDrawer.isConditional) {
                                  if (mainDrawer.addExistingVariableAsSpawn) {
                                    mainDrawer.addExistingVariableAsSpawn(conditionalVar.id.toString());
                                    toast.success(`Added ${hash} as spawn`);
                                  }
                                } else {
                                  const variableRef = `{{${hash}}}`;
                                  const newContent = mainDrawer.content ? `${mainDrawer.content}${variableRef}` : variableRef;
                                  mainDrawer.updateContent(newContent);
                                  toast.success(`Added ${variableRef} to content`);
                                }
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{mainDrawer.isConditional ? 'Add as spawn' : 'Embed in content'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </div>
                        
                        {/* Spawn Variables (Children) */}
                        {(() => {
                          const controllingMap = getControllingSpawnMap();
                          
                          // Filter spawns based on hideControlledVariables setting
                          const visibleSpawnOptions = hideControlledVariables 
                            ? spawnOptions.filter((spawn: any) => {
                                // Always show Hidden option
                                if (spawn.id === 'hidden') return true;
                                // Hide spawns that have a controlling condition set to a different conditional
                                return !spawn.controlled_by_spawn_id || spawn.controlled_by_spawn_id === conditionalVar.id;
                              })
                            : spawnOptions; // Show all spawns when setting is disabled
                          
                          // Helper to render a spawn card with radio button
                          const renderSpawnCard = (spawn: any) => {
                            const spawnHash = spawn.effective_variable_name || spawn.variable_name || spawn.variable_hash;
                            const spawnDisplayName = spawnHash;
                            const isSelected = selectedConditionalSpawns[conditionalName] === spawnHash;
                            
                            // Check if this spawn should be disabled due to controlling logic
                            const isControlled = shouldAutoSelectSpawn(spawn.id, controllingMap);
                            const isDisabled = shouldDisableSpawn(spawn.id, conditionalName, controllingMap);
                            
                            // Check if this spawn has a controlling condition (for visual indicator)
                            const hasControllingCondition = spawn.controlled_by_spawn_id && spawn.controlled_by_spawn_id !== conditionalVar.id;
                            
                            // Get resolved content preview (skip for "Hidden" option)
                            const contentPreview = spawn.id !== 'hidden' && spawn.content 
                              ? resolveContentToPlaintext(spawn.content, spawn.id)
                              : '';
                            const truncatedContent = contentPreview.length > 60 
                              ? contentPreview.slice(0, 60) + '...' 
                              : contentPreview;
                  
                            // Unified spawn card with radio button
                            return (
                              <div
                                key={spawn.id}
                                className={`group rounded-md border px-2 py-1.5 transition-all ${
                                  (isDisabled || hasControllingCondition)
                                    ? 'opacity-60'
                                    : 'cursor-pointer hover:bg-gray-50'
                                }`}
                                style={{
                                  backgroundColor: 'white',
                                  borderColor: 'rgb(229 231 235)', // border-gray-200
                                  color: 'rgb(55 65 81)' // text-gray-700
                                }}
                                onClick={() => {
                                  if (!isDisabled && !hasControllingCondition && !isControlled) {
                                    setSelectedConditionalSpawns(prev => ({
                                      ...prev,
                                      [conditionalName]: spawnHash
                                    }));
                                  }
                                }}
                              >
                                {/* Main content row with radio button */}
                                <div className="flex items-center gap-2">
                                  {/* Radio button on left, vertically centered */}
                                  <RadioGroupItem 
                                    value={spawnHash} 
                                    id={`spawn-${spawn.id}`}
                                    disabled={isDisabled || hasControllingCondition || isControlled}
                                    className="flex-shrink-0"
                                    checked={isSelected}
                                  />
                                  
                                  {/* Lock icon if controlled */}
                                  {(isControlled || hasControllingCondition) && <Lock className="h-3 w-3 flex-shrink-0" />}
                                  
                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-foreground">
                                      {spawn.id === 'hidden' 
                                        ? <span className="italic text-muted-foreground">Hidden</span>
                                        : truncatedContent || <span className="italic text-muted-foreground">No content</span>}
                                    </div>
                                    {/* Hash/ID - only show if showVariableHashes is enabled */}
                                    {showVariableHashes && spawn.id !== 'hidden' && (
                                      <div className="text-xs text-muted-foreground/70 mt-0.5">
                                        {spawnDisplayName}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Action buttons */}
                                  {spawn.id !== 'hidden' && (
                                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          mainDrawer.openEditDrawer(spawn);
                                        }}
                                        className="rounded p-0.5 hover:bg-gray-200 cursor-pointer"
                                        aria-label="Edit spawn variable"
                                        title="Edit"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button
                                            onClick={(e) => e.stopPropagation()}
                                            className="rounded p-0.5 hover:bg-gray-200 cursor-pointer"
                                            aria-label="More options"
                                          >
                                            <MoreHorizontal className="h-3 w-3" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              copyVariableToClipboard(spawnHash);
                                            }}
                                          >
                                            <Copy className="h-4 w-4 mr-2" />
                                            Copy reference
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDuplicateString(spawn);
                                            }}
                                          >
                                            <Copy className="h-4 w-4 mr-2" />
                                            Duplicate
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openDeleteStringDialog(spawn);
                                            }}
                                            className="text-red-600 focus:text-red-600"
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          };
                          
                          // Get current selection for RadioGroup
                          const currentSelection = selectedConditionalSpawns[conditionalName] || '';
                          
                          return (
                            <RadioGroup 
                              value={currentSelection}
                              onValueChange={(value) => {
                                setSelectedConditionalSpawns(prev => ({
                                  ...prev,
                                  [conditionalName]: value
                                }));
                              }}
                              className="flex flex-col gap-2"
                            >
                              {visibleSpawnOptions.map(renderSpawnCard)}
                            </RadioGroup>
                          );
                        })()}
                    </div>
                    );
                  })}
              </div>
                          ) : (
                <div className="text-muted-foreground text-center text-sm">
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
          <div className="flex items-center justify-between gap-4 border-b px-6 bg-background h-[65px] sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">Project Strings</h2>
              {/* Global Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  placeholder="Search strings..."
                  className="pl-9 w-64 h-9"
                />
                {globalSearchQuery && (
                  <button
                    onClick={() => setGlobalSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
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
          <div className={`flex-1 overflow-y-auto p-6 ${mainDrawer.isOpen ? 'pb-[360px]' : ''}`}>
          {filteredStrings.length === 0 ? (
            <div className="text-muted-foreground text-center text-sm">
              {(project?.strings || []).length === 0 
                ? "No strings found in this project." 
                : "No strings match the current filters."
              }
            </div>
          ) : (
            <ul className="space-y-4">
              {filteredStrings.map((str: any) => (
                <StringTile
                  key={str.id}
                  string={{
                    id: str.id,
                    content: str.content,
                    variable_hash: str.variable_hash,
                    effective_variable_name: str.effective_variable_name,
                    is_conditional_container: str.is_conditional_container,
                  }}
                  showDisplayName={false}
                  showVariableHash={showVariableHashes}
                  renderContent={(content) => renderStyledContent(content, str.variables || [], str.id)}
                  onClick={() => openEditInCascadingDrawer(str)}
                  showCheckbox={true}
                  isSelected={selectedStringIds.has(str.id)}
                  onSelect={(selected) => handleSelectString(str.id, selected)}
                  showAddButton={mainDrawer.isOpen}
                  addButtonTooltip={mainDrawer.isConditional ? 'Add as spawn' : 'Embed in content'}
                  isAddingToConditional={mainDrawer.isConditional}
                  editingStringId={mainDrawer.stringData?.id || null}
                  onAdd={() => {
                    const hash = str.effective_variable_name || str.variable_hash;
                    if (mainDrawer.isConditional) {
                      if (mainDrawer.addExistingVariableAsSpawn) {
                        mainDrawer.addExistingVariableAsSpawn(str.id.toString());
                        toast.success(`Added ${hash} as spawn`);
                      }
                    } else {
                      const variableRef = `{{${hash}}}`;
                      const newContent = mainDrawer.content ? `${mainDrawer.content}${variableRef}` : variableRef;
                      mainDrawer.updateContent(newContent);
                      toast.success(`Added ${variableRef} to content`);
                    }
                  }}
                  showCopyButton={true}
                  onCopy={() => {
                    const hash = str.effective_variable_name || str.variable_hash;
                    copyVariableToClipboard(hash);
                  }}
                  showActionsMenu={true}
                  onDuplicate={() => handleDuplicateString(str)}
                  onDelete={() => openDeleteStringDialog(str)}
                  onFocus={() => router.push(`/projects/${id}/focus/${str.id}`)}
                />
              ))}
            </ul>
          )}
        </div>
        </main>
      </div>

      {/* Bottom Drawer - Edit Drawer (fixed to viewport bottom) */}
      {mainDrawer.isOpen && (
        <div className="fixed bottom-0 left-0 right-0 h-[340px] border-t bg-background flex flex-col z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          {/* Row 1: Header - Title, Mini-nav, Close */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            {/* Left: Title + Type Button Group */}
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold">
                {mainDrawer.stringData?.id ? 'Edit string' : 'New string'}
              </h3>
              
              {/* Type Button Group */}
              <div className="flex rounded-md border overflow-hidden">
                <button
                  onClick={() => mainDrawer.updateType(false)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    !mainDrawer.isConditional
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  String
                </button>
                <button
                  onClick={() => mainDrawer.updateType(true)}
                  className={`px-3 py-1 text-xs font-medium transition-colors border-l ${
                    mainDrawer.isConditional
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Conditional
                </button>
              </div>
            </div>
            
            {/* Center: Mini Navigation - Three Sections */}
            <div className="flex items-center gap-4 overflow-x-auto">
              {(() => {
                const activeId = mainDrawer.activeVariableId;
                const activeEdit = mainDrawer.sessionEdits?.get(activeId || '');
                
                // Get active variable info
                let activeData: any = null;
                let activeName = 'New Variable';
                let activeIsConditional = mainDrawer.isConditional;
                let isPendingVariable = false;
                
                if (activeId?.startsWith('new-')) {
                  // New variable being created
                  activeName = activeEdit?.variableHash || mainDrawer.variableHash || 'New Variable';
                  activeIsConditional = activeEdit?.isConditional ?? mainDrawer.isConditional;
                } else if (activeId?.startsWith('pending-')) {
                  // Pending embedded variable - extract name from ID
                  isPendingVariable = true;
                  const pendingVarName = activeId.replace('pending-', '');
                  activeName = activeEdit?.variableHash || pendingVarName;
                  activeIsConditional = activeEdit?.isConditional ?? false;
                } else if (activeId?.startsWith('temp-')) {
                  // Temp spawn - find it in parent's spawns
                  const rootId = mainDrawer.stringData?.id ? String(mainDrawer.stringData.id) : 'new';
                  const rootEdit = mainDrawer.sessionEdits?.get(rootId);
                  const spawn = rootEdit?.conditionalSpawns?.find((s: any) => String(s.id) === activeId);
                  if (spawn) {
                    activeData = spawn;
                    activeName = spawn.effective_variable_name || spawn.variable_hash || 'Spawn';
                    activeIsConditional = spawn.is_conditional_container || false;
                  }
                } else if (activeId) {
                  // Existing variable
                  activeData = project?.strings?.find((s: any) => String(s.id) === activeId);
                  if (activeData) {
                    activeName = activeEdit?.variableHash || activeData.effective_variable_name || activeData.variable_hash || 'Variable';
                    activeIsConditional = activeEdit?.isConditional ?? activeData.is_conditional_container ?? false;
                  }
                }
                
                const activeVarName = isPendingVariable ? activeName : (activeData?.effective_variable_name || activeData?.variable_hash || '');
                
                // Build parent nodes
                const parents: {id: string; name: string; type: 'string' | 'conditional'; parentType: 'embeds' | 'spawns'}[] = [];
                
                if (activeVarName) {
                  // Check saved project strings for parents
                  if (project?.strings) {
                    project.strings.forEach((str: any) => {
                      if (String(str.id) === activeId) return;
                      
                      // Check if this string embeds the active variable
                      if (str.content?.includes(`{{${activeVarName}}}`)) {
                        parents.push({
                          id: String(str.id),
                          name: str.effective_variable_name || str.variable_hash,
                          type: str.is_conditional_container ? 'conditional' : 'string',
                          parentType: 'embeds'
                        });
                      }
                    });
                  }
                  
                  // Also check session edits for parents (for pending variables)
                  if (mainDrawer.sessionEdits) {
                    mainDrawer.sessionEdits.forEach((edit: any, editId: string) => {
                      if (editId === activeId) return;
                      // Skip if we already found this parent in project strings
                      if (parents.some(p => p.id === editId)) return;
                      
                      // Check if this edit's content embeds the active variable
                      if (edit.content?.includes(`{{${activeVarName}}}`)) {
                        // Get the variable data for display
                        const varData = project?.strings?.find((s: any) => String(s.id) === editId);
                        parents.push({
                          id: editId,
                          name: edit.variableHash || varData?.effective_variable_name || varData?.variable_hash || 'Variable',
                          type: edit.isConditional ? 'conditional' : 'string',
                          parentType: 'embeds'
                        });
                      }
                    });
                  }
                  
                  // Check if active is a spawn of a conditional
                  // Method 1: Check dimension_values (legacy system)
                  if (activeData?.dimension_values?.length > 0) {
                    const dimValue = activeData.dimension_values[0];
                    const dimName = dimValue?.dimension_value_detail?.dimension?.name || dimValue?.dimension?.name;
                    if (dimName) {
                      const parentConditional = project.strings.find((s: any) => 
                        s.is_conditional_container && 
                        (s.effective_variable_name === dimName || s.variable_hash === dimName)
                      );
                      if (parentConditional && String(parentConditional.id) !== activeId) {
                        if (!parents.some(p => p.id === String(parentConditional.id))) {
                          parents.push({
                            id: String(parentConditional.id),
                            name: parentConditional.effective_variable_name || parentConditional.variable_hash,
                            type: 'conditional',
                            parentType: 'spawns'
                          });
                        }
                      }
                    }
                  }
                  
                  // Method 2: Search all conditionals to find if active is in their spawns
                  // This works for the new system where spawns are linked via dimension values
                  project.strings.forEach((conditionalVar: any) => {
                    if (!conditionalVar.is_conditional_container) return;
                    if (String(conditionalVar.id) === activeId) return;
                    
                    const conditionalName = conditionalVar.effective_variable_name || conditionalVar.variable_hash;
                    
                    // Find dimension for this conditional
                    const dimension = project?.dimensions?.find((d: any) => d.name === conditionalName);
                    if (dimension?.values) {
                      // Check if active variable's name matches any spawn in this conditional
                      const isSpawnOfThis = dimension.values.some((dv: any) => 
                        dv.value === activeVarName && dv.value !== "Hidden"
                      );
                      
                      if (isSpawnOfThis && !parents.some(p => p.id === String(conditionalVar.id))) {
                        parents.push({
                          id: String(conditionalVar.id),
                          name: conditionalVar.effective_variable_name || conditionalVar.variable_hash,
                          type: 'conditional',
                          parentType: 'spawns'
                        });
                      }
                    }
                  });
                }
                
                // Also check if editing a temp spawn - the root is the parent
                if (activeId?.startsWith('temp-') && mainDrawer.stringData) {
                  const rootData = mainDrawer.stringData;
                  if (!parents.some(p => p.id === String(rootData.id))) {
                    parents.push({
                      id: String(rootData.id),
                      name: rootData.effective_variable_name || rootData.variable_hash,
                      type: 'conditional',
                      parentType: 'spawns'
                    });
                  }
                }
                
                // Build children nodes (spawns if conditional, or embedded variables)
                const children: {id: string; name: string; type: 'string' | 'conditional'}[] = [];
                
                // If active is conditional, show its spawns
                if (activeIsConditional) {
                  const spawns = activeEdit?.conditionalSpawns || [];
                  spawns.forEach((spawn: any, index: number) => {
                    const spawnId = String(spawn.id || `temp-${index}`);
                    if (spawnId !== activeId) {
                      children.push({
                        id: spawnId,
                        name: spawn.effective_variable_name || spawn.variable_hash || `Spawn ${index + 1}`,
                        type: spawn.is_conditional_container ? 'conditional' : 'string'
                      });
                    }
                  });
                }
                
                // Find embedded variables in content
                const activeContent = activeEdit?.content || activeData?.content || mainDrawer.content || '';
                const embeddedMatches = activeContent.match(/{{([^}]+)}}/g) || [];
                const embeddedNamesSet = new Set<string>(embeddedMatches.map((m: string) => m.slice(2, -2)));
                const embeddedNames = Array.from(embeddedNamesSet);
                
                embeddedNames.forEach((varName) => {
                  const embeddedVar = project?.strings?.find((s: any) => 
                    s.effective_variable_name === varName || 
                    s.variable_name === varName || 
                    s.variable_hash === varName
                  );
                  if (embeddedVar && String(embeddedVar.id) !== activeId) {
                    // Avoid duplicates
                    if (!children.some(c => c.id === String(embeddedVar.id))) {
                      children.push({
                        id: String(embeddedVar.id),
                        name: embeddedVar.effective_variable_name || embeddedVar.variable_hash,
                        type: embeddedVar.is_conditional_container ? 'conditional' : 'string'
                      });
                    }
                  } else if (!embeddedVar) {
                    // Variable doesn't exist yet - it's a pending/new variable
                    const pendingId = `pending-${varName}`;
                    // Avoid duplicates
                    if (!children.some(c => c.id === pendingId)) {
                      children.push({
                        id: pendingId,
                        name: varName,
                        type: 'string' // Assume string for new variables
                      });
                    }
                  }
                });
                
                // Render helper
                const renderTile = (node: {id: string; name: string; type: 'string' | 'conditional'}, size: number = 28, isActive: boolean = false) => {
                  const isPending = node.id.startsWith('pending-');
                  const bgColor = isPending ? 'var(--pending-var-100, #f3e8ff)' : (node.type === 'conditional' ? 'var(--conditional-var-100)' : 'var(--string-var-100)');
                  const borderColor = isPending ? 'var(--pending-var-color, mediumpurple)' : (node.type === 'conditional' ? 'var(--conditional-var-color)' : 'var(--string-var-color)');
                  const activeBg = isPending ? 'var(--pending-var-200, #e9d5ff)' : (node.type === 'conditional' ? 'var(--conditional-var-200)' : 'var(--string-var-200)');
                  
                  return (
                    <button
                      key={node.id}
                      onClick={() => !isActive && !node.id.startsWith('new') && mainDrawer.navigateToVariable?.(node.id)}
                      className={`flex-shrink-0 rounded-md flex items-center justify-center transition-all ${isActive ? '' : 'cursor-pointer hover:opacity-80'}`}
                      style={{
                        width: `${size}px`,
                        height: `${size}px`,
                        backgroundColor: isActive ? activeBg : bgColor,
                        border: `2px solid ${borderColor}`,
                      }}
                      title={isPending ? `${node.name} (new - click to edit)` : node.name}
                      disabled={isActive}
                    >
                      {isPending ? (
                        <Sparkles className="h-3 w-3" style={{ color: 'var(--pending-var-color, mediumpurple)' }} />
                      ) : (
                        <span 
                          className="font-semibold"
                          style={{ 
                            color: node.type === 'conditional' ? 'var(--conditional-var-700)' : 'var(--string-var-700)',
                            fontSize: isActive ? '12px' : '10px'
                          }}
                        >
                          {node.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </button>
                  );
                };
                
                return (
                  <>
                    {/* Parents Section */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Used in</span>
                      <div className="flex items-center gap-1 min-h-[32px]">
                        {parents.length > 0 ? parents.map(p => renderTile(p, 28)) : (
                          <span className="text-sm text-muted-foreground/50">—</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Separator */}
                    <div className="w-px h-8 bg-border" />
                    
                    {/* Active Section */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Active</span>
                      <div className="flex items-center gap-1 min-h-[32px]">
                        {renderTile({
                          id: activeId || 'new',
                          name: activeName,
                          type: activeIsConditional ? 'conditional' : 'string'
                        }, 32, true)}
                      </div>
                    </div>
                    
                    {/* Separator */}
                    <div className="w-px h-8 bg-border" />
                    
                    {/* Children Section */}
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {activeIsConditional ? 'Spawn variables' : 'Embedded variables'}
                      </span>
                      <div className="flex items-center justify-start gap-1 min-h-[32px]">
                        {children.length > 0 ? children.map(c => renderTile(c, 28)) : (
                          <span className="text-sm text-muted-foreground/50">—</span>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            
            {/* Right: Copy + Close buttons */}
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const hash = mainDrawer.stringData?.effective_variable_name || 
                                     mainDrawer.stringData?.variable_hash || 
                                     mainDrawer.variableName;
                        if (hash) {
                          copyVariableToClipboard(hash);
                        } else {
                          toast.error('No variable reference available yet');
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy reference</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={mainDrawer.closeDrawer}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Row 2: Sidebar + Content */}
          <div className="flex flex-1 min-h-0">
            {/* Vertical Sidebar Tabs */}
            <div className="w-36 border-r bg-muted/20 flex flex-col py-2">
              <button
                onClick={() => mainDrawer.updateTab('content')}
                className={`px-4 py-2 text-left text-sm font-medium transition-colors ${
                  mainDrawer.activeTab === 'content' 
                    ? 'bg-background border-r-2 border-primary text-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                Content
              </button>
              <button
                onClick={() => mainDrawer.updateTab('conditions')}
                className={`px-4 py-2 text-left text-sm font-medium transition-colors ${
                  mainDrawer.activeTab === 'conditions' 
                    ? 'bg-background border-r-2 border-primary text-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                Conditions
              </button>
              <button
                onClick={() => mainDrawer.updateTab('advanced')}
                className={`px-4 py-2 text-left text-sm font-medium transition-colors ${
                  mainDrawer.activeTab === 'advanced' 
                    ? 'bg-background border-r-2 border-primary text-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                Advanced
              </button>
              {FEATURES.REGISTRY && (
                <button
                  onClick={() => !mainDrawer.isConditional && mainDrawer.updateTab('publishing')}
                  disabled={mainDrawer.isConditional}
                  className={`px-4 py-2 text-left text-sm font-medium transition-colors ${
                    mainDrawer.isConditional 
                      ? 'text-muted-foreground/50 cursor-not-allowed'
                      : mainDrawer.activeTab === 'publishing' 
                        ? 'bg-background border-r-2 border-primary text-foreground' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  Publishing
                </button>
              )}
            </div>
            
            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Content Tab */}
              {mainDrawer.activeTab === 'content' && (
                <div className="space-y-4">
                  {/* String Content */}
                  {!mainDrawer.isConditional && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Content</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsImageToTextModalOpen(true)}
                            className="h-7 text-xs gap-1.5"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            Extract from image
                          </Button>
                        </div>
                        <Textarea
                          value={mainDrawer.content}
                          onChange={(e) => mainDrawer.updateContent(e.target.value)}
                          placeholder="Enter string content..."
                          rows={4}
                          autoFocus={!mainDrawer.stringData?.id}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Conditional Spawns */}
                  {mainDrawer.isConditional && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Spawn Variables</Label>
                        <div className="flex items-center gap-3">
                          {/* Include option to hide toggle */}
                          <div className="flex items-center gap-2">
                            <Switch
                              id="include-hidden-option"
                              checked={mainDrawer.includeHiddenOption}
                              onCheckedChange={(checked) => mainDrawer.updateHiddenOption?.(checked)}
                            />
                            <Label htmlFor="include-hidden-option" className="text-sm font-normal cursor-pointer">
                              Include hide option
                            </Label>
                          </div>
                          <Button size="sm" variant="outline" onClick={mainDrawer.addSpawn}>
                            <Plus className="h-3 w-3 mr-1" /> Add Spawn
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {mainDrawer.conditionalSpawns.map((spawn: any, index: number) => {
                          const spawnId = String(spawn.id || `temp-spawn-${index}`);
                          const spawnName = spawn.effective_variable_name || spawn.variable_hash || `Spawn ${index + 1}`;
                          const contentPreview = spawn.content ? spawn.content.substring(0, 60) + (spawn.content.length > 60 ? '...' : '') : 'No content';
                          const isNew = spawn._isTemporary;
                          
                          return (
                            <div 
                              key={spawnId} 
                              className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-muted/50 transition-colors"
                              style={{
                                backgroundColor: 'var(--string-var-50)',
                                borderColor: 'var(--string-var-200)',
                              }}
                              onClick={() => mainDrawer.navigateToVariable?.(spawnId)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">{spawnName}</span>
                                  {isNew && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">New</span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate mt-0.5">{contentPreview}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  mainDrawer.removeSpawn?.(spawn, index);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                        {mainDrawer.conditionalSpawns.length === 0 && (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            No spawn variables yet. Click "Add Spawn" to create one.
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Click a spawn to edit its name and content. Changes are saved when you click Save.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Conditions Tab */}
              {mainDrawer.activeTab === 'conditions' && (
                <div className="space-y-6">
                  {/* Controlling Condition Section - Only for spawn variables */}
                  {(() => {
                    const currentVarHash = mainDrawer.variableHash || mainDrawer.stringData?.variable_hash;
                    const currentStringId = mainDrawer.stringData?.id;
                    
                    // Check if this variable is a spawn for any conditional
                    const isSpawn = currentVarHash && project?.strings?.some((str: any) => {
                      if (!str.is_conditional_container) return false;
                      const conditionalName = str.effective_variable_name || str.variable_hash;
                      const dimension = project.dimensions?.find((d: any) => d.name === conditionalName);
                      return dimension?.values?.some((dv: any) => dv.value === currentVarHash);
                    });

                    if (!isSpawn) {
                      return (
                        <div className="rounded-lg bg-muted/50 p-4">
                          <p className="text-sm text-muted-foreground">
                            This variable is not a spawn of any conditional. Controlling conditions can only be set for spawn variables.
                          </p>
                        </div>
                      );
                    }

                    // Build grouped spawn list for dropdown
                    const groupedSpawns: {conditionalName: string; conditionalDisplayName: string; spawns: any[]}[] = [];
                    
                    project?.strings?.forEach((str: any) => {
                      if (!str.is_conditional_container) return;
                      
                      const conditionalName = str.effective_variable_name || str.variable_hash;
                      const conditionalDisplayName = conditionalName;
                      const dimension = project.dimensions?.find((d: any) => d.name === conditionalName);
                      
                      if (!dimension) return;
                      
                      // Find spawns for this conditional (excluding the current variable)
                      const spawns = project.strings.filter((spawnStr: any) => {
                        if (spawnStr.is_conditional_container) return false;
                        if (spawnStr.id === currentStringId) return false; // Exclude self
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
                        const spawnName = spawn.effective_variable_name || spawn.variable_hash;
                        const spawnContent = spawn.content || '';
                        const resolvedContent = resolveContentToPlaintext(spawnContent, spawn.id);
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
                          isSelected: mainDrawer.controlledBySpawnId === spawn.id,
                        });
                      });
                    });
                    
                    // Filter by search
                    const filteredControllingSpawns = controllingSpawnSearch
                      ? availableControllingSpawns.filter(v => {
                          // Always include conditional headers if any of their spawns match
                          if (v.isConditional) {
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
                    
                    // Check if controlling condition is enabled (has a value set)
                    const hasControllingCondition = !!mainDrawer.controlledBySpawnId;
                    
                    // Find the currently selected controlling spawn for display
                    const selectedController = mainDrawer.controlledBySpawnId 
                      ? project?.strings?.find((s: any) => s.id === mainDrawer.controlledBySpawnId)
                      : null;
                    const selectedControllerName = selectedController 
                      ? (selectedController.effective_variable_name || selectedController.variable_hash)
                      : null;
                          
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
                            variant={(isControllingConditionEnabled || hasControllingCondition) ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              if (isControllingConditionEnabled || hasControllingCondition) {
                                // Disable - clear the selection
                                setIsControllingConditionEnabled(false);
                                mainDrawer.updateControlledBySpawnId(null);
                              } else {
                                setIsControllingConditionEnabled(true);
                              }
                            }}
                          >
                            {(isControllingConditionEnabled || hasControllingCondition) ? 'Enabled' : 'Enable'}
                          </Button>
                        </div>

                        {/* Show current selection if set */}
                        {hasControllingCondition && !isControllingConditionEnabled && selectedControllerName && (
                          <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
                            <p className="text-sm">
                              <span className="text-muted-foreground">Controlled by: </span>
                              <span className="font-medium">{selectedControllerName}</span>
                            </p>
                          </div>
                        )}

                        {/* Controlling Spawn Selector */}
                        {(isControllingConditionEnabled || hasControllingCondition) && (
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
                              mainDrawer.updateControlledBySpawnId(variable.id);
                              setShowControllingSpawnResults(false);
                              setControllingSpawnSearch("");
                            }}
                            maxResults={20}
                            noBorder={true}
                            showNoResultsOnEmpty={true}
                          />
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
                    const currentVarHash = mainDrawer.variableHash || mainDrawer.stringData?.variable_hash;
                    
                    if (!currentVarHash || !project?.strings) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          <p className="text-sm">No parent conditional variables found</p>
                        </div>
                      );
                    }

                    // Find parent conditionals by checking dimension values
                    const parentConditionals = project.strings.filter((str: any) => {
                      if (!str.is_conditional_container) return false;
                      
                      const conditionalName = str.effective_variable_name || str.variable_hash;
                      const dimension = project.dimensions?.find((d: any) => d.name === conditionalName);
                      
                      return dimension?.values?.some((dv: any) => dv.value === currentVarHash);
                    });

                    if (parentConditionals.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          <p className="text-sm">This variable is not a spawn of any conditional</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {parentConditionals.map((conditional: any) => {
                          const conditionalName = conditional.effective_variable_name || conditional.variable_hash;
                          return (
                            <div 
                              key={conditional.id}
                              className="p-3 rounded-md border bg-card hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                                  <Signpost className="h-3 w-3 mr-1" />
                                  Conditional
                                </Badge>
                                <span className="font-medium">{conditionalName}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
              
              {/* Advanced Tab */}
              {mainDrawer.activeTab === 'advanced' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Variable Hash (Identifier)</Label>
                    <Input
                      value={mainDrawer.variableHash}
                      onChange={(e) => {
                        // Remove spaces and validate format
                        const value = e.target.value.replace(/\s/g, '');
                        mainDrawer.updateVariableHash(value);
                      }}
                      placeholder="Leave empty for auto-generated hash"
                      className={mainDrawer.variableHash && !/^[A-Za-z0-9][A-Za-z0-9\-]*$/.test(mainDrawer.variableHash) ? 'border-red-500' : ''}
                    />
                    {mainDrawer.variableHash && !/^[A-Za-z0-9][A-Za-z0-9\-]*$/.test(mainDrawer.variableHash) ? (
                      <p className="text-sm text-red-500">
                        Hash must start with a letter or number and contain only letters, numbers, and hyphens (no spaces).
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {mainDrawer.variableHash ? 
                          `Reference as: {{${mainDrawer.variableHash}}}` : 
                          "Leave empty to auto-generate a 6-character hash"
                        }
                      </p>
                    )}
                  </div>
                  
                  {/* Delete Option - only for existing variables */}
                  {mainDrawer.stringData?.id && (
                    <div className="pt-4 border-t">
                      <Label className="text-sm font-medium text-red-600">Danger Zone</Label>
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                          onClick={() => {
                            // Close drawer and open delete dialog
                            mainDrawer.closeDrawer();
                            openDeleteStringDialog(mainDrawer.stringData);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete this variable
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Publishing Tab - Only for non-conditional strings (Feature flagged) */}
              {FEATURES.REGISTRY && mainDrawer.activeTab === 'publishing' && (
                <div className="space-y-4">
                  {!mainDrawer.isConditional ? (
                    <>
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Publish to Organization Registry</Label>
                        <p className="text-sm text-muted-foreground">
                          Publishing this string will make it visible in your organization's registry.
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="font-medium text-sm">
                              {mainDrawer.isPublished ? "Published" : "Not published"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {mainDrawer.isPublished 
                                ? "This string is visible in the registry." 
                                : "Toggle to add to the registry."}
                            </p>
                          </div>
                          <Switch
                            checked={mainDrawer.isPublished}
                            onCheckedChange={(checked) => mainDrawer.updateIsPublished(checked)}
                          />
                        </div>
                      </div>

                      {mainDrawer.isPublished && (
                        <div className="p-3 border border-green-200 rounded-lg bg-green-50">
                          <p className="text-sm text-green-800">
                            ✓ This string will appear in the organization registry.
                          </p>
                        </div>
                      )}

                      {!mainDrawer.stringData?.id && (
                        <div className="p-3 border border-amber-200 rounded-lg bg-amber-50">
                          <p className="text-sm text-amber-800">
                            Save this string first to publish it.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <p className="text-sm text-muted-foreground">
                        Conditional variables cannot be published. Only regular strings can be published to the registry.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Row 3: Footer - Cancel/Save on right */}
          <div className="flex items-center justify-end px-4 py-2 border-t bg-muted/20">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={mainDrawer.closeDrawer}>
                Cancel
              </Button>
              <Button size="sm" onClick={mainDrawer.save}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* UNIFIED DRAWER SYSTEM - Old Sheet drawer (disabled, using bottom drawer now) */}
      
      {/* Main String Edit Drawer - DISABLED: Now using bottom drawer layout above */}
      <StringEditDrawer
        isOpen={false /* mainDrawer.isOpen - disabled */}
        onClose={mainDrawer.closeDrawer}
        stringData={mainDrawer.stringData}
        content={mainDrawer.content}
        onContentChange={mainDrawer.updateContent}
        variableName={mainDrawer.variableName}
        onVariableNameChange={() => {}} // Deprecated - no longer used
        variableHash={mainDrawer.variableHash}
        onVariableHashChange={mainDrawer.updateVariableHash}
        isConditional={mainDrawer.isConditional}
        onTypeChange={mainDrawer.updateType}
        conditionalSpawns={mainDrawer.conditionalSpawns}
        onConditionalSpawnsChange={mainDrawer.updateConditionalSpawns}
        includeHiddenOption={mainDrawer.includeHiddenOption}
        onHiddenOptionChange={mainDrawer.updateHiddenOption}
        controlledBySpawnId={mainDrawer.controlledBySpawnId}
        onControlledBySpawnIdChange={mainDrawer.updateControlledBySpawnId}
        embeddedVariableEdits={mainDrawer.embeddedVariableEdits}
        onEmbeddedVariableEditsChange={mainDrawer.updateEmbeddedVariableEdits}
        pendingVariableContent={mainDrawer.pendingVariableContent}
        onPendingVariableContentChange={mainDrawer.updatePendingVariableContent}
        activeTab={mainDrawer.activeTab}
        onTabChange={mainDrawer.updateTab}
        project={project}
        selectedDimensionValues={selectedDimensionValues}
        pendingStringVariables={pendingStringVariables}
        onSave={mainDrawer.save}
        onCancel={mainDrawer.closeDrawer}
        onAddSpawn={mainDrawer.addSpawn}
        onUpdateSpawn={mainDrawer.updateSpawn}
        onNavigateToVariable={(variableId) => {
          mainDrawer.navigateToVariable(variableId);
        }}
        dirtyVariableIds={mainDrawer.dirtyVariableIds}
        sessionEdits={mainDrawer.sessionEdits}
        activeVariableId={mainDrawer.activeVariableId}
        onRemoveSpawn={mainDrawer.removeSpawn}
        onAddExistingVariableAsSpawn={mainDrawer.addExistingVariableAsSpawn}
        onEditSpawn={handleEditSpawn}
        onEditVariable={handleEditVariable}
        title={mainDrawer.title}
        level={mainDrawer.level}
        showBackButton={mainDrawer.showBackButton}
        isSaving={mainDrawer.isSaving}
        resolveContentToPlaintext={resolveContentToPlaintext}
        onDelete={(variable) => {
          // Close the drawer first, then open the delete dialog
          mainDrawer.closeDrawer();
          openDeleteStringDialog(variable);
        }}
        isPublished={mainDrawer.isPublished}
        onIsPublishedChange={mainDrawer.updateIsPublished}
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
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
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
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                  <TabsTrigger 
                    value="publishing" 
                    disabled={mainDrawer.isConditional}
                    className={mainDrawer.isConditional ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    Publishing
                  </TabsTrigger>
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
                                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
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
                                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
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
                          <p className="text-sm text-muted-foreground ml-2">
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
                                    <Badge variant="outline" className={`text-xs ${
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
                            <p className="text-sm text-muted-foreground ml-2">
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
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
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
                                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
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
                                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
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
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
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
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
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
                    <p className="text-sm text-muted-foreground">
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
                    <p className="text-sm text-muted-foreground">
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
                    <p className="text-sm text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">
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

              {/* Root Level Publishing Tab - Only for non-conditional strings */}
              {currentDrawerLevel === 0 && stringDialogTab === "publishing" && !mainDrawer.isConditional && (
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
                          {mainDrawer.isPublished ? "This string is published" : "This string is not published"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {mainDrawer.isPublished 
                            ? "This string is visible in the organization registry." 
                            : "Publish this string to add it to the organization registry."}
                        </p>
                      </div>
                      <Switch
                        checked={mainDrawer.isPublished}
                        onCheckedChange={(checked) => mainDrawer.updateIsPublished(checked)}
                      />
                    </div>
                  </div>

                  {mainDrawer.isPublished && (
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

                  {!mainDrawer.stringData && (
                    <div className="p-4 border border-amber-200 rounded-lg bg-amber-50">
                      <p className="text-sm text-amber-800">
                        <strong>Note:</strong> You can publish this string after saving it for the first time.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Publishing tab disabled message for conditionals */}
              {currentDrawerLevel === 0 && stringDialogTab === "publishing" && mainDrawer.isConditional && (
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      Conditional variables cannot be published to the registry. 
                      Only regular string variables can be published.
                    </p>
                  </div>
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
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
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
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                    <TabsTrigger value="publishing" disabled>Publishing</TabsTrigger>
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
                              <p className="text-sm text-muted-foreground ml-2">
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
                                      <Badge variant="outline" className={`text-xs ${
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
                                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
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
                                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
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
        <DialogContent className="max-w-lg">
          {(() => {
            // Check which selected variables are in use
            const inUseVariables: { id: string; name: string; usage: ReturnType<typeof checkVariableUsage> }[] = [];
            const deletableVariables: string[] = [];
            
            Array.from(selectedStringIds).forEach(id => {
              const usage = checkVariableUsage(id);
              const variable = project?.strings?.find((s: any) => s.id === Number(id));
              const name = variable?.effective_variable_name || variable?.variable_hash || id;
              
              if (usage.isInUse) {
                inUseVariables.push({ id, name, usage });
              } else {
                deletableVariables.push(name);
              }
            });
            
            const hasInUseVariables = inUseVariables.length > 0;
            const allInUse = inUseVariables.length === selectedStringIds.size;
            
            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {allInUse ? 'Cannot Delete Selected Variables' : `Delete ${selectedStringIds.size} Variables`}
                  </DialogTitle>
                  <DialogDescription>
                    {allInUse 
                      ? 'All selected variables are currently in use and cannot be deleted.'
                      : hasInUseVariables
                      ? `${inUseVariables.length} of ${selectedStringIds.size} selected variables are in use and will be skipped.`
                      : `Are you sure you want to delete ${selectedStringIds.size} selected variables? This action cannot be undone.`
                    }
                  </DialogDescription>
                </DialogHeader>
          <div className="space-y-4">
                  {hasInUseVariables && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md max-h-40 overflow-y-auto">
                      <p className="text-sm font-medium text-amber-800 mb-2">
                        ⚠️ Variables in use (will be skipped):
                      </p>
                      <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
                        {inUseVariables.slice(0, 10).map(({ name, usage }) => (
                          <li key={name}>
                            <span className="font-medium">{name}</span>
                            <span className="text-amber-600 ml-1">
                              ({usage.usageType === 'both' ? 'embedded & spawn' : usage.usageType})
                            </span>
                          </li>
                        ))}
                        {inUseVariables.length > 10 && (
                          <li className="text-amber-600">...and {inUseVariables.length - 10} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  
                  {deletableVariables.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm font-medium text-red-800">
                        {deletableVariables.length} variable{deletableVariables.length > 1 ? 's' : ''} will be permanently deleted
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
              <Button variant="outline" onClick={closeBulkDeleteDialog}>
                    {allInUse ? 'Close' : 'Cancel'}
              </Button>
                  {!allInUse && (
                    <Button 
                      variant="destructive" 
                      onClick={() => {
                        // Only delete variables that are not in use
                        const inUseIds = new Set(inUseVariables.map(v => v.id));
                        const toDelete = Array.from(selectedStringIds).filter(id => !inUseIds.has(id));
                        
                        // Update selection to only include deletable items
                        setSelectedStringIds(new Set(toDelete));
                        
                        // Then trigger the delete
                        setTimeout(() => handleBulkDelete(), 0);
                      }}
                    >
                      Delete {deletableVariables.length} variable{deletableVariables.length > 1 ? 's' : ''}
              </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
                <TabsTrigger 
                  value="publishing" 
                  disabled={editingString?.is_conditional_container}
                  className={editingString?.is_conditional_container ? "opacity-50 cursor-not-allowed" : ""}
                >
                  Publishing
                </TabsTrigger>
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
              <p className="text-sm text-muted-foreground mb-3">
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
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
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
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
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
                    <p className="text-sm text-muted-foreground mb-3">
                      Optional: Assign values for each dimension to categorize this string.
                    </p>
                    <div className="mb-4 p-3 bg-muted/50 rounded-md">
                      <p className="text-sm text-muted-foreground mb-2">
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
                    <p className="text-sm mt-2">Create dimensions in the conditions sidebar to categorize your strings.</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="advanced" className="mt-0">
                <div>
                  <h3 className="font-medium mb-2">Variable Name</h3>
                  <p className="text-sm text-muted-foreground mb-3">
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
                      <p className="text-sm text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground mt-1">
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
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="plaintext-mode">Plaintext Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Show resolved content without styling or conditional variables
                    </p>
                  </div>
                  <Switch
                    id="plaintext-mode"
                    checked={isPlaintextMode}
                    onCheckedChange={setIsPlaintextMode}
                  />
            </div>

                {/* Show Variables Toggle */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="show-variables">Show Variables</Label>
                    <p className="text-sm text-muted-foreground">
                      Display variable names as badges instead of resolved content
                    </p>
                  </div>
                  <Switch
                    id="show-variables"
                    checked={showVariableBadges}
                    onCheckedChange={setShowVariableBadges}
                  />
              </div>

                {/* Hide Embedded Strings Toggle */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="hide-embedded">Hide Embedded Strings</Label>
                    <p className="text-sm text-muted-foreground">
                      Hide strings that are used as variables or spawn variables in other strings
                    </p>
                  </div>
                  <Switch
                    id="hide-embedded"
                    checked={hideEmbeddedStrings}
                    onCheckedChange={setHideEmbeddedStrings}
                  />
                    </div>

                {/* Show Variable Hashes Toggle */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="show-hashes">Show Variable Hashes</Label>
                    <p className="text-sm text-muted-foreground">
                      Display the copiable variable hash badge on each string card
                    </p>
                  </div>
                  <Switch
                    id="show-hashes"
                    checked={showVariableHashes}
                    onCheckedChange={setShowVariableHashes}
                  />
                </div>
          </div>
          
              {/* Conditions Sidebar Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Conditions Sidebar</h3>
                
                {/* Hide Controlled Variables Toggle */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="hide-controlled">Hide Controlled Variables</Label>
                    <p className="text-sm text-muted-foreground">
                      Hide spawn variables that have a controlling condition set. If all spawns of a conditional are hidden, the conditional itself is also hidden.
                    </p>
                  </div>
                  <Switch
                    id="hide-controlled"
                    checked={hideControlledVariables}
                    onCheckedChange={setHideControlledVariables}
                  />
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
                          <Badge variant="outline" className="text-xs">
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
                      
                      <div className="text-sm text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground">
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
          {(() => {
            const usage = deleteStringDialog?.id ? checkVariableUsage(deleteStringDialog.id) : { isInUse: false, usageType: null, embeddedIn: [], spawnOf: [] };
            const variableName = deleteStringDialog?.effective_variable_name || deleteStringDialog?.variable_hash;
            
            return (
              <>
          <DialogHeader>
                  <DialogTitle>
                    {usage.isInUse ? 'Cannot Delete Variable' : 'Delete Variable'}
                  </DialogTitle>
            <DialogDescription>
                    {usage.isInUse 
                      ? `The variable "${variableName}" is currently in use and cannot be deleted.`
                      : `Are you sure you want to delete the variable "${variableName}"?`
                    }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
                  {usage.isInUse ? (
                    <>
                      {usage.embeddedIn.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                          <p className="text-sm font-medium text-amber-800 mb-2">
                            📎 Embedded in {usage.embeddedIn.length} variable{usage.embeddedIn.length > 1 ? 's' : ''}:
                          </p>
                          <ul className="text-sm text-amber-700 list-disc list-inside">
                            {usage.embeddedIn.slice(0, 5).map((name, i) => (
                              <li key={i}>{name}</li>
                            ))}
                            {usage.embeddedIn.length > 5 && (
                              <li className="text-amber-600">...and {usage.embeddedIn.length - 5} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                      {usage.spawnOf.length > 0 && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-sm font-medium text-blue-800 mb-2">
                            🔗 Used as a spawn variable:
                          </p>
                          <ul className="text-sm text-blue-700 list-disc list-inside">
                            {usage.spawnOf.slice(0, 5).map((name, i) => (
                              <li key={i}>{name}</li>
                            ))}
                            {usage.spawnOf.length > 5 && (
                              <li className="text-blue-600">...and {usage.spawnOf.length - 5} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                        <p className="text-sm text-gray-700">
                          To delete this variable, first remove it from the variables listed above.
                        </p>
                      </div>
                    </>
                  ) : (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm font-medium text-red-800">
                ⚠️ Warning: This action cannot be undone
              </p>
            </div>
                  )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteStringDialog(null)}
            >
                    {usage.isInUse ? 'Close' : 'Cancel'}
            </Button>
                  {!usage.isInUse && (
            <Button 
              variant="destructive" 
              onClick={handleDeleteString}
            >
                      Delete Variable
            </Button>
                  )}
          </DialogFooter>
              </>
            );
          })()}
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

      {/* Image to Text Modal */}
      <ImageToTextModal
        isOpen={isImageToTextModalOpen}
        onClose={() => setIsImageToTextModalOpen(false)}
        onAccept={(text) => {
          mainDrawer.updateContent(text);
          toast.success("Text extracted and added to content");
        }}
      />
    </div>
  );
} 