"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from "@/components/ui/select";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { Edit2, Trash2, Type, Bookmark, Spool, Signpost, Plus, X, Globe, SwatchBook, MoreHorizontal, Download, Upload, Copy, ArrowLeft, Split } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConditionalVariables, setSelectedConditionalVariables] = useState<string[]>([]);
  const [isPlaintextMode, setIsPlaintextMode] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showStringVariables, setShowStringVariables] = useState(false);
  
  // Filter sidebar state
  const [selectedDimensionValues, setSelectedDimensionValues] = useState<{[dimensionId: number]: string | null}>({});
  const [traitId, setTraitId] = useState<string>("blank");
  
  // Project edit/delete state
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deleteProjectDialog, setDeleteProjectDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [createDialog, setCreateDialog] = useState<null | "Variable" | "Conditional" | "String" | "Dimension">(null);
  const [editingString, setEditingString] = useState<any>(null);
  
  // String form state
  const [stringContent, setStringContent] = useState("");
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  
  // String variable name state (all strings are now variables)
  const [stringVariableName, setStringVariableName] = useState("");
  const [stringIsConditional, setStringIsConditional] = useState(false);

  // String dimension values state - now supports multiple values per dimension
  const [stringDimensionValues, setStringDimensionValues] = useState<{[dimensionId: number]: string[]}>({});
  
  // Dimension value selector state
  const [openDimensionPopover, setOpenDimensionPopover] = useState<number | null>(null);
  const [dimensionFilterText, setDimensionFilterText] = useState<{[dimensionId: number]: string}>({});
  



  // String deletion state
  const [deleteStringDialog, setDeleteStringDialog] = useState<any>(null);

  // Dimension form state
  const [dimensionName, setDimensionName] = useState("");
  const [dimensionValues, setDimensionValues] = useState<string[]>([]);
  const [newDimensionValue, setNewDimensionValue] = useState("");
  const [editingDimension, setEditingDimension] = useState<any>(null);

  // Download dialog state
  const [downloadDialog, setDownloadDialog] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);



  // String dialog tab state
  const [stringDialogTab, setStringDialogTab] = useState("content");

  // Variable dialog tab state
  const [variableDialogTab, setVariableDialogTab] = useState("overview");

  // Variable dimension values state
  const [variableDimensionValues, setVariableDimensionValues] = useState<{[dimensionValueId: number]: string}>({});

  // Bulk selection state
  const [selectedStringIds, setSelectedStringIds] = useState<Set<number>>(new Set());
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);

  // Import strings state
  const [importDialog, setImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // Nested string editing state
  const [editingNestedString, setEditingNestedString] = useState<any>(null);
  const [nestedStringContent, setNestedStringContent] = useState("");
  const [nestedStringVariableName, setNestedStringVariableName] = useState("");
  const [nestedStringIsConditional, setNestedStringIsConditional] = useState(false);
  
  // Split mode state for nested editing
  const [nestedStringSplitMode, setNestedStringSplitMode] = useState(false);
  const [nestedStringSpawns, setNestedStringSpawns] = useState<{id: string, content: string, variableName: string, isConditional: boolean}[]>([]);
  
  // Split variable editing state
  const [editingSplitVariable, setEditingSplitVariable] = useState(false);
  const [splitVariableSpawns, setSplitVariableSpawns] = useState<any[]>([]);
  
  // Pending string variables state - for variables detected in content but not yet created
  const [pendingStringVariables, setPendingStringVariables] = useState<{[name: string]: {content: string, is_conditional: boolean}}>({});

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/projects/${id}/`)
      .then((data) => {
        setProject(sortProjectStrings(data));
        // Keep traitId as "blank" by default, don't auto-select first trait
      })
      .catch((err) => setError(err.message || "Failed to load project"))
      .finally(() => setLoading(false));
  }, [id]);

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
        // Keep existing pending variable data if it exists, otherwise create default
        newPending[variableName] = prev[variableName] || {
          content: `Content for ${variableName}`,  // Default placeholder content
          is_conditional: false
        };
      });
      
      return newPending;
    });
  }, [stringContent, project?.strings]);

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

  // Function to process conditional variables - removes conditional variables that are not selected
  const processConditionalVariables = (content: string) => {
    // Find all variables in content
    const variableMatches = content.match(/{{([^}]+)}}/g) || [];
    let processedContent = content;
    
    variableMatches.forEach((match) => {
      const variableName = match.slice(2, -2);
      
      // Check string variables only (trait variables no longer exist)
      const stringVariable = project.strings?.find((str: any) => 
        str.effective_variable_name === variableName || 
        str.variable_name === variableName || 
        str.variable_hash === variableName
      );
      
      if (stringVariable?.is_conditional) {
        const stringVarId = `s${stringVariable.id}`;
        if (!selectedConditionalVariables.includes(stringVarId)) {
          const regex = new RegExp(`{{${variableName}}}`, 'g');
          processedContent = processedContent.replace(regex, '');
        }
      }
    });
    
    return processedContent;
  };

  // String dialog handlers
  const openCreateString = () => {
    setStringContent("");
    setStringVariableName("");
    setStringIsConditional(false);
    setPendingStringVariables({});
    setCreateDialog("String");
  };

  const openEditString = (str: any) => {
    setStringContent(str.content);
    setEditingString(str);
    setStringVariableName(str.variable_name || "");
    setStringIsConditional(str.is_conditional || false);
    setPendingStringVariables({});
    
    // Populate dimension values - now supporting multiple values per dimension
    const dimensionValues: {[dimensionId: number]: string[]} = {};
    if (str.dimension_values) {
      str.dimension_values.forEach((dv: any) => {
        const dimensionId = dv.dimension_value.dimension;
        if (!dimensionValues[dimensionId]) {
          dimensionValues[dimensionId] = [];
        }
        dimensionValues[dimensionId].push(dv.dimension_value.value);
      });
    }
    setStringDimensionValues(dimensionValues);
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
            console.error(`Failed to create pending string variable ${variableName}:`, err);
          }
        }
        
        // Refresh project data to include new string variables
        const updatedProject = await apiFetch(`/api/projects/${id}/`);
        setProject(sortProjectStrings(updatedProject));
      }
    } catch (err) {
      console.error('Failed to create pending variables:', err);
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
    setPendingStringVariables({});
  };

  // Nested string editing handlers
  const openEditNestedString = (str: any) => {
    const isSplitVariable = str.is_split_variable;
    
    if (isSplitVariable) {
      // This is a split variable - load all its spawns
      const splitVariableName = str.effective_variable_name || str.variable_hash;
      const spawns = project.strings?.filter((s: any) => {
        const effectiveName = s.effective_variable_name || s.variable_hash;
        return effectiveName.startsWith(`${splitVariableName}_`) && 
               /^.+_\d+$/.test(effectiveName); // Matches pattern like "name_1", "name_2", etc.
      }) || [];
      
      // Sort spawns by their number
      spawns.sort((a: any, b: any) => {
        const aName = a.effective_variable_name || a.variable_hash;
        const bName = b.effective_variable_name || b.variable_hash;
        const aMatch = aName.match(/_(\d+)$/);
        const bMatch = bName.match(/_(\d+)$/);
        const aNum = aMatch ? parseInt(aMatch[1]) : 0;
        const bNum = bMatch ? parseInt(bMatch[1]) : 0;
        return aNum - bNum;
      });
      
      setSplitVariableSpawns(spawns);
      setEditingSplitVariable(true);
      setEditingNestedString(str);
    } else {
      // Regular string variable
      setNestedStringContent(str.content);
      setNestedStringVariableName(str.variable_name || "");
      setNestedStringIsConditional(str.is_conditional || false);
      setEditingNestedString(str);
      setNestedStringSplitMode(false);
      setNestedStringSpawns([]);
      setEditingSplitVariable(false);
      setSplitVariableSpawns([]);
    }
  };

  const closeNestedStringDialog = () => {
    setNestedStringContent("");
    setNestedStringVariableName("");
    setNestedStringIsConditional(false);
    setEditingNestedString(null);
    setNestedStringSplitMode(false);
    setNestedStringSpawns([]);
    setEditingSplitVariable(false);
    setSplitVariableSpawns([]);
  };

  // Function to create and edit a pending string variable
  const createAndEditPendingVariable = async (variableName: string) => {
    const pendingVar = pendingStringVariables[variableName];
    if (!pendingVar) return;

    try {
      // Create the string variable
      const response = await apiFetch('/api/strings/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: pendingVar.content,
          variable_name: variableName,
          is_conditional: pendingVar.is_conditional,
          project: id,
        }),
      });

      // Remove from pending variables
      setPendingStringVariables(prev => {
        const newPending = { ...prev };
        delete newPending[variableName];
        return newPending;
      });

      // Refresh project data to include the new string variable
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(updatedProject));

      // Open the newly created string variable for editing
      openEditNestedString(response);

    } catch (err) {
      console.error(`Failed to create string variable ${variableName}:`, err);
      toast.error(`Failed to create string variable "${variableName}"`);
    }
  };

  const handleNestedStringSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (nestedStringSplitMode) {
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
    const splitVariableName = editingNestedString.effective_variable_name || editingNestedString.variable_hash;
    
    // Debug logging
    console.log('=== SPLIT VARIABLE SUBMIT DEBUG ===');
    console.log('splitVariableName:', splitVariableName);
    console.log('editingNestedString:', editingNestedString);
    console.log('nestedStringSpawns length:', nestedStringSpawns.length);
    console.log('Current nestedStringSpawns state:', nestedStringSpawns);
    
    // Log each spawn's content in detail
    nestedStringSpawns.forEach((spawn, index) => {
      console.log(`Spawn ${index + 1}:`, {
        id: spawn.id,
        content: spawn.content,
        contentType: typeof spawn.content,
        contentLength: spawn.content?.length,
        trimmedContent: spawn.content?.trim(),
        trimmedLength: spawn.content?.trim()?.length,
        variableName: spawn.variableName,
        isConditional: spawn.isConditional
      });
    });
    
    // Validate that all spawns have content
    const emptySpawns = nestedStringSpawns.filter(spawn => {
      const content = spawn.content;
      return !content || typeof content !== 'string' || content.trim() === '';
    });
    
    if (emptySpawns.length > 0) {
      console.error('Empty spawns found:', emptySpawns);
      toast.error(`All spawns must have content before splitting. Found ${emptySpawns.length} empty spawn(s).`);
      return;
    }
    
    // Additional validation: ensure all spawns have valid content before API call
    const invalidSpawns = nestedStringSpawns.filter(spawn => {
      const trimmedContent = spawn.content?.trim();
      return !trimmedContent || trimmedContent.length === 0;
    });
    
    if (invalidSpawns.length > 0) {
      console.error('Invalid spawns found:', invalidSpawns);
      toast.error(`Some spawns have invalid content. Please check all spawn content.`);
      return;
    }
    
    // FINAL CHECK: Re-validate spawns right before API calls
    console.log('=== FINAL VALIDATION BEFORE API CALLS ===');
    const finalEmptySpawns = nestedStringSpawns.filter(spawn => {
      const content = spawn.content;
      const isEmpty = !content || typeof content !== 'string' || content.trim() === '';
      if (isEmpty) {
        console.error('FINAL CHECK: Found empty spawn:', spawn);
      }
      return isEmpty;
    });
    
    if (finalEmptySpawns.length > 0) {
      console.error('FINAL CHECK: Still have empty spawns after validation!', finalEmptySpawns);
      toast.error(`FINAL CHECK: Found ${finalEmptySpawns.length} empty spawn(s) right before API call!`);
      return;
    }
    
    try {
      // Step 1: Check if dimension already exists, create if not
      let newDimension = project.dimensions?.find((dim: any) => dim.name === splitVariableName);
      
      if (!newDimension) {
        // Create new dimension
        console.log('Creating new dimension:', splitVariableName);
        newDimension = await apiFetch('/api/dimensions/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: splitVariableName,
            project: parseInt(id as string),
          }),
        });
      } else {
        console.log('Using existing dimension:', splitVariableName);
      }

      // Step 2: Create string variables for each spawn (check if they exist first)
      console.log('=== CREATING STRING VARIABLES ===');
      const stringPromises = nestedStringSpawns.map(async (spawn, index) => {
        const spawnName = `${splitVariableName}_${index + 1}`;
        const safeContent = spawn.content?.trim() || `Default content for ${spawnName}`;
        
        console.log(`Processing spawn ${index + 1}:`, {
          originalContent: spawn.content,
          safeContent: safeContent,
          spawnName: spawnName,
          isConditional: spawn.isConditional
        });
        
        // Check if string with this variable name already exists
        const existingString = project.strings?.find((str: any) => {
          const effectiveName = str.effective_variable_name || str.variable_hash;
          return effectiveName === spawnName || str.variable_name === spawnName;
        });
        
        if (existingString) {
          console.log(`String spawn already exists: ${spawnName}`);
          return Promise.resolve(existingString);
        }
        
        // Final safety check before API call
        if (!safeContent || safeContent.length === 0) {
          console.error(`ERROR: Spawn ${spawnName} has no content!`);
          throw new Error(`Spawn ${spawnName} has no content`);
        }
        
        const requestBody = {
          content: safeContent,
          variable_name: spawnName,
          is_conditional: spawn.isConditional,
          project: parseInt(id as string),
        };
        
        console.log(`API request for spawn ${index + 1}:`, requestBody);
        
        return apiFetch('/api/strings/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
      });

      console.log('=== EXECUTING API CALLS ===');
      let stringResponses;
      try {
        stringResponses = await Promise.all(stringPromises);
        console.log('All string creation API calls succeeded:', stringResponses);
      } catch (error) {
        console.error('ERROR in string creation API calls:', error);
        throw error;
      }

      // Step 3: Create dimension values for each spawn (check if they exist first)
      const dimValuePromises = nestedStringSpawns.map(async (spawn, index) => {
        const spawnName = `${splitVariableName}_${index + 1}`;
        
        // Check if dimension value already exists
        const existingDimValue = newDimension.values?.find((dv: any) => dv.value === spawnName);
        
        if (!existingDimValue) {
          console.log('Creating dimension value:', spawnName);
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

      // Step 4: Convert the original string to a split variable (if not already)
      if (!editingNestedString.is_split_variable) {
        console.log('Converting original string to split variable');
        const splitVariableContent = `[Split Variable: ${splitVariableName}]`;
        await apiFetch(`/api/strings/${editingNestedString.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: splitVariableContent, // Provide descriptive content for split variable
            variable_name: editingNestedString.variable_name || splitVariableName,
            is_conditional: editingNestedString.is_conditional,
            is_split_variable: true, // Mark as split variable
          }),
        });
      } else {
        console.log('Original string is already a split variable');
      }

      // Refresh project data
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(updatedProject));
      
      // Close nested dialog
      closeNestedStringDialog();
      
      toast.success(`Split variable "${splitVariableName}" created with ${nestedStringSpawns.length} spawns!`);
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
    
    setNestedStringSplitMode(true);
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
  const updateSplitVariableSpawn = (spawnId: number, field: string, value: string | boolean) => {
    setSplitVariableSpawns(prev => prev.map(spawn => 
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
      
      toast.success(`Updated spawn "${spawn.effective_variable_name || spawn.variable_hash}"`);
    } catch (err) {
      console.error('Failed to update spawn:', err);
      toast.error('Failed to update spawn. Please try again.');
    }
  };

  const handleSplitVariableSubmit = async () => {
    try {
      // Update all spawns
      const updatePromises = splitVariableSpawns.map(spawn => 
        apiFetch(`/api/strings/${spawn.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: spawn.content,
            variable_name: spawn.variable_name,
            is_conditional: spawn.is_conditional,
          }),
        })
      );

      await Promise.all(updatePromises);

      // Refresh project data
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(updatedProject));
      
      // Close dialog
      closeNestedStringDialog();
      
      toast.success('Split variable spawns updated successfully!');
    } catch (err) {
      console.error('Failed to update split variable spawns:', err);
      toast.error('Failed to update spawns. Please try again.');
    }
  };

  const addSplitVariableSpawn = async () => {
    const splitVariableName = editingNestedString.effective_variable_name || editingNestedString.variable_hash;
    
    try {
      // Find the existing dimension for this split variable
      const existingDimension = project.dimensions?.find((dim: any) => dim.name === splitVariableName);
      if (!existingDimension) {
        throw new Error('Cannot find dimension for split variable');
      }

      // Determine the next spawn number
      let nextSpawnNumber = 1;
      if (splitVariableSpawns.length > 0) {
        const spawnNumbers = splitVariableSpawns.map((spawn: any) => {
          const effectiveName = spawn.effective_variable_name || spawn.variable_hash;
          const match = effectiveName.match(/_(\d+)$/);
          return match ? parseInt(match[1]) : 0;
        });
        nextSpawnNumber = Math.max(...spawnNumbers) + 1;
      }

      // Create the new spawn name
      const newSpawnName = `${splitVariableName}_${nextSpawnNumber}`;
      
      // Get content from the first existing spawn (they should all have the same content)
      const firstSpawnContent = splitVariableSpawns.length > 0 ? splitVariableSpawns[0].content : '';
      const safeCopyContent = firstSpawnContent && firstSpawnContent.trim() ? firstSpawnContent.trim() : '';
      const contentToCopy = safeCopyContent || `Content for ${newSpawnName}`;
      
      // Additional safety check
      if (!contentToCopy || contentToCopy.trim() === '') {
        throw new Error('Cannot create spawn with empty content');
      }
      
      const newSpawn = await apiFetch('/api/strings/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentToCopy,
          variable_name: newSpawnName,
          is_conditional: editingNestedString.is_conditional,
          project: parseInt(id as string),
        }),
      });

      // Create dimension value for the new spawn
      await apiFetch('/api/dimension-values/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimension: existingDimension.id,
          value: newSpawnName,
        }),
      });

      // Add to local state
      setSplitVariableSpawns(prev => [...prev, newSpawn]);
      
      toast.success(`Added new spawn "${newSpawnName}"`);
    } catch (err) {
      console.error('Failed to add spawn:', err);
      toast.error('Failed to add spawn. Please try again.');
    }
  };

  const removeSplitVariableSpawn = async (spawnId: number) => {
    if (splitVariableSpawns.length <= 1) {
      toast.error('Cannot remove the last spawn. A split variable must have at least one spawn.');
      return;
    }

    try {
      await apiFetch(`/api/strings/${spawnId}/`, {
        method: 'DELETE',
      });

      // Remove from local state
      setSplitVariableSpawns(prev => prev.filter(spawn => spawn.id !== spawnId));
      
      toast.success('Spawn removed successfully');
    } catch (err) {
      console.error('Failed to remove spawn:', err);
      toast.error('Failed to remove spawn. Please try again.');
    }
  };

  const handleSplitString = async (str: any) => {
    const splitVariableName = str.effective_variable_name || str.variable_hash;
    const isSplitVariable = str.is_split_variable;

    try {
      if (isSplitVariable) {
        // This is already a split variable - add one more spawn
        
        // Step 1: Find the existing dimension for this split variable
        const existingDimension = project.dimensions?.find((dim: any) => dim.name === splitVariableName);
        if (!existingDimension) {
          throw new Error('Cannot find dimension for split variable');
        }

        // Step 2: Find all existing spawns for this split variable
        const existingSpawns = project.strings?.filter((s: any) => {
          const effectiveName = s.effective_variable_name || s.variable_hash;
          return effectiveName.startsWith(`${splitVariableName}_`) && 
                 /^.+_\d+$/.test(effectiveName); // Matches pattern like "name_1", "name_2", etc.
        }) || [];

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
        const newSpawnName = `${splitVariableName}_${nextSpawnNumber}`;
        
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
        
        toast.success(`Added new spawn "${newSpawnName}" to split variable "${splitVariableName}"`);

      } else {
        // This is a regular string - perform initial split
        
        if (!str.content.trim()) {
          toast.error("Cannot split an empty string");
          return;
        }

        const originalContent = str.content;

        // Step 1: Check if dimension already exists, create if not
        let newDimension = project.dimensions?.find((dim: any) => dim.name === splitVariableName);
        
        if (!newDimension) {
          console.log('Creating new dimension:', splitVariableName);
          const dimensionResponse = await apiFetch('/api/dimensions/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: splitVariableName,
              project: parseInt(id as string),
            }),
          });

          if (!dimensionResponse.ok) {
            throw new Error('Failed to create dimension');
          }

          newDimension = await dimensionResponse.json();
        } else {
          console.log('Using existing dimension:', splitVariableName);
        }

        // Step 2: Create two new string variables with the original content (check if they exist first)
        const stringVar1Name = `${splitVariableName}_1`;
        const stringVar2Name = `${splitVariableName}_2`;

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

        // Step 4: Convert the original string to a split variable (if not already)
        if (!str.is_split_variable) {
          console.log('Converting original string to split variable');
          const splitVariableContent = `[Split Variable: ${splitVariableName}]`;
          const updateResponse = await apiFetch(`/api/strings/${str.id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: splitVariableContent, // Provide descriptive content for split variable
              variable_name: str.variable_name || splitVariableName,
              is_conditional: str.is_conditional,
              is_split_variable: true, // Mark as split variable
            }),
          });

          if (!updateResponse.ok) {
            throw new Error('Failed to update original string');
          }
        } else {
          console.log('Original string is already a split variable');
        }

        // Refresh the project data
        const updatedProject = await apiFetch(`/api/projects/${id}/`);
        setProject(sortProjectStrings(updatedProject));
        
        toast.success(`Split "${splitVariableName}" into ${stringVar1Name} and ${stringVar2Name}`);
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

  // Wrap selected text with conditional
  const wrapWithConditional = (conditionalName: string) => {
    if (!textareaRef || !selectedText) return;
    
    const wrappedText = `[[${conditionalName}]]${selectedText}[[/]]`;
    const newContent = 
      stringContent.substring(0, selectionStart) + 
      wrappedText + 
      stringContent.substring(selectionEnd);
    
    setStringContent(newContent);
    setSelectedText("");
    
    // Focus back to textarea and set cursor after wrapped text
    setTimeout(() => {
      if (textareaRef) {
        textareaRef.focus();
        textareaRef.setSelectionRange(
          selectionStart + wrappedText.length,
          selectionStart + wrappedText.length
        );
      }
         }, 0);
   };

  // String deletion handlers
  const openDeleteStringDialog = (str: any) => {
    setDeleteStringDialog(str);
  };

  const closeDeleteStringDialog = () => {
    setDeleteStringDialog(null);
  };



  const checkStringUsage = (stringId: number) => {
    // Check if string is referenced by any string variables
    return (project.variables || []).some((variable: any) => {
      return variable.variable_type === 'string' && 
             variable.referenced_string && 
             variable.referenced_string.toString() === stringId.toString();
    });
  };

  const handleDeleteString = async () => {
    if (!deleteStringDialog) return;

    // Check if string is being referenced by any string variables
    const isReferenced = checkStringUsage(deleteStringDialog.id);
    
    if (isReferenced) {
      const referencingVariables = (project.variables || []).filter((variable: any) => 
        variable.variable_type === 'string' && 
        variable.referenced_string && 
        variable.referenced_string.toString() === deleteStringDialog.id.toString()
      );
      
      const variableNames = referencingVariables.map((v: any) => v.name).join(', ');
      toast.error(`Cannot delete this string because it's referenced by string variable${referencingVariables.length > 1 ? 's' : ''}: ${variableNames}. Please update or delete the variable${referencingVariables.length > 1 ? 's' : ''} first.`);
      return;
    }

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



   // Trait dialog handlers


   // Dimension dialog handlers
   const openCreateDimension = () => {
     setDimensionName("");
     setDimensionValues([]);
     setNewDimensionValue("");
     setCreateDialog("Dimension");
   };

   const openEditDimension = (dimension: any) => {
     setDimensionName(dimension.name);
     setDimensionValues(dimension.values ? dimension.values.map((dv: any) => dv.value) : []);
     setNewDimensionValue("");
     setEditingDimension(dimension);
     setCreateDialog("Dimension");
   };

   const closeDimensionDialog = () => {
     setCreateDialog(null);
     setEditingDimension(null);
     setDimensionName("");
     setDimensionValues([]);
     setNewDimensionValue("");
   };

   // Dimension value management functions
   const addDimensionValue = () => {
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
         await apiFetch('/api/dimension-values/', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             dimension: dimensionId,
             value: value,
           }),
         });
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
      
      // Find all variables that match the content
      const detectedVariables = (project.variables || []).filter((variable: any) => 
        uniqueVariableNames.includes(variable.name)
      );
      
      const stringData = {
        content: stringContent,
        project: id,
        variable_name: stringVariableName || null,
        is_conditional: stringIsConditional,
        variables: detectedVariables.map((v: any) => v.id),
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

  // Helper function to get variable value with dimension precedence over trait values and blank
  const getVariableValueWithDimensionPrecedence = (variable: any) => {
    // Check for dimension values only (traits are removed)
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
        const replacement = processVariableContent(stringVariable.content, depth + 1);
        const regex = new RegExp(`{{${variableName}}}`, 'g');
        processedContent = processedContent.replace(regex, replacement);
      }
    }
    
    return processedContent;
  };



  // Helper function to check if a variable has any value (dimension only)
  const variableHasAnyValue = (variable: any) => {
    // Check dimension values only (traits removed)
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

  // Function to process string content based on selected trait and plaintext mode
  const processStringContent = (content: string, stringVariables: any[]) => {
    // First process conditionals
    let processedContent = processConditionalVariables(content);
    
    if (isPlaintextMode) {
      // In plaintext mode (default), behavior depends on showStringVariables toggle and trait selection
      if (traitId === "blank" && showStringVariables) {
        // When blank is selected and showStringVariables is ON, show variables as {{variable}} format
        return processedContent;
      }
      
      if (traitId === "blank" && !showStringVariables) {
        // When blank is selected and showStringVariables is OFF, expand string variables
        // but leave trait variables as {{variable}}
        const variableMatches = processedContent.match(/{{([^}]+)}}/g) || [];
        let result = processedContent;
        
        variableMatches.forEach((match) => {
          const variableName = match.slice(2, -2);
          const projectVariable = (project.variables || []).find((v: any) => v.name === variableName);
          const stringVariable = project.strings?.find((str: any) => 
            str.effective_variable_name === variableName || 
            str.variable_name === variableName || 
            str.variable_hash === variableName
          );
          
          if (stringVariable) {
            const regex = new RegExp(`{{${variableName}}}`, 'g');
            result = result.replace(regex, stringVariable.content);
          }
        });
        
        return result;
      }
      
      // Replace variables with their values (dimension values take precedence over trait values and blank)
      const selectedTrait = (project.traits || []).find((t: any) => t.id.toString() === traitId);
      const hasActiveDimensions = Object.values(selectedDimensionValues).some(val => val);
      
      if (selectedTrait || hasActiveDimensions) {
        // Auto-detect all variables from content, not just the ones in stringVariables
        const variableMatches = processedContent.match(/{{([^}]+)}}/g) || [];
        const variableNames = variableMatches.map(match => match.slice(2, -2));
        
        // Process variables recursively to handle nested string variables
        const processVariablesRecursively = (content: string, depth: number = 0): string => {
          if (depth > 10) return content; // Prevent infinite recursion
          
          const matches = content.match(/{{([^}]+)}}/g) || [];
          let processedContent = content;
          
          matches.forEach((match) => {
            const variableName = match.slice(2, -2);
            const projectVariable = (project.variables || []).find((v: any) => v.name === variableName);
            
            const stringVariable = project.strings?.find((str: any) => 
              str.effective_variable_name === variableName || 
              str.variable_name === variableName || 
              str.variable_hash === variableName
            );
            
            if (stringVariable) {
              // String variable found - behavior depends on showStringVariables toggle
              let value = null;
              if (showStringVariables) {
                // Show as variable badge - don't replace, leave as {{variableName}}
                value = null; // Skip replacement
              } else {
                // Show string content - get the variable content and process it recursively
                value = processVariablesRecursively(stringVariable.content, depth + 1);
              }
              
              // Only replace if we have a value (not when showing string variables)
              if (value !== null) {
                const regex = new RegExp(`{{${variableName}}}`, 'g');
                processedContent = processedContent.replace(regex, value);
              }
            } else if (projectVariable) {
              // Trait variable - use dimension values with precedence over trait values
              const value = getVariableValueWithDimensionPrecedence(projectVariable) || projectVariable.name;
              
              // Only replace if we have a value (not when showing string variables)
              if (value !== null) {
                const regex = new RegExp(`{{${variableName}}}`, 'g');
                processedContent = processedContent.replace(regex, value);
              }
            }
          });
          
          return processedContent;
        };
        
        processedContent = processVariablesRecursively(processedContent);
      }
      
      return processedContent;
    }
    
    // In highlighter mode, return JSX with badges
    return null; // We'll handle this in the JSX
  };

  // Recursive function to render content with proper variable substitution and styling
  const renderContentRecursively = (content: string, depth: number = 0, keyPrefix: string = ""): (string | React.ReactNode)[] => {
    // Prevent infinite recursion
    if (depth > 10) {
      return [content];
    }
    
    // First process conditionals
    const conditionalProcessedContent = processConditionalVariables(content);
    
    // Check if we have dimension selections that should override blank behavior
    const hasDimensionFilters = Object.values(selectedDimensionValues).some(val => val);
    
    if (traitId === "blank" && !hasDimensionFilters) {
      // Behavior depends on showStringVariables toggle
      if (showStringVariables) {
        // Show all variables as grey badges in {{variable}} format
        const parts = conditionalProcessedContent.split(/({{[^}]+}})/);
        return parts.map((part: string, index: number) => {
          if (part.match(/{{[^}]+}}/)) {
            const variableName = part.slice(2, -2); // Remove {{ and }}
            const variable = (project.variables || []).find((v: any) => v.name === variableName);
            const stringVariable = project.strings?.find((str: any) => 
              str.effective_variable_name === variableName || 
              str.variable_name === variableName || 
              str.variable_hash === variableName
            );
            return (
              <Badge 
                key={`${keyPrefix}${depth}-${index}-${variableName}`} 
                variant="secondary" 
                className={`mx-1 transition-colors ${
                  stringVariable 
                    ? "cursor-default" 
                    : "cursor-pointer hover:bg-secondary/80"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  // Trait variables are no longer editable
                }}
                title={
                  stringVariable 
                    ? `String variable \"${variableName}\" - tied to a string` 
                    : variable
                    ? `Click to edit variable \"${variableName}\"`
                    : `Variable \"${variableName}\" not found`
                }
              >
                {part}
              </Badge>
            );
          }
          return part;
        });
      } else {
        // Show string variables expanded (recursively), trait variables as badges
        const parts = conditionalProcessedContent.split(/({{[^}]+}})/);
        const result: (string | React.ReactNode)[] = [];
        parts.forEach((part: string, index: number) => {
          if (part.match(/{{[^}]+}}/)) {
            const variableName = part.slice(2, -2); // Remove {{ and }}
            const variable = (project.variables || []).find((v: any) => v.name === variableName);
            const stringVariable = project.strings?.find((str: any) => 
              str.effective_variable_name === variableName || 
              str.variable_name === variableName || 
              str.variable_hash === variableName
            );
            if (stringVariable) {
              // For string variables, expand recursively to their content (as plain text and badges for trait vars)
              const nestedParts = renderContentRecursively(stringVariable.content, depth + 1, `${keyPrefix}${variableName}-`);
              result.push(...nestedParts);
            } else if (variable) {
              // For trait variables, show as grey badges
              result.push(
                <Badge 
                  key={`${keyPrefix}${depth}-${index}-${variableName}`} 
                  variant="secondary" 
                  className="mx-1 transition-colors cursor-pointer hover:bg-secondary/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Trait variables are no longer editable
                  }}
                  title={`Click to edit variable \"${variable.name}\"`}
                >
                  {part}
                </Badge>
              );
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
    }

    // When a trait is selected OR dimension values are selected, process variables recursively
    const selectedTrait = (project.traits || []).find((t: any) => t.id.toString() === traitId);
    const hasDimensionSelection = Object.values(selectedDimensionValues).some(val => val);
    
    if (!selectedTrait && !hasDimensionSelection) {
      return [conditionalProcessedContent];
    }

    // Find all variables in the content
    const variableMatches = conditionalProcessedContent.match(/{{([^}]+)}}/g) || [];
    if (variableMatches.length === 0) {
      return [conditionalProcessedContent];
    }

    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;

    variableMatches.forEach((match: string, matchIndex: number) => {
      const variableName = match.slice(2, -2); // Remove {{ and }}
      const variable = (project.variables || []).find((v: any) => v.name === variableName);
      const currentIndex = conditionalProcessedContent.indexOf(match, lastIndex);
      
      // Add text before the variable
      if (currentIndex > lastIndex) {
        parts.push(conditionalProcessedContent.substring(lastIndex, currentIndex));
      }

      const stringVariable = project.strings?.find((str: any) => 
        str.effective_variable_name === variableName || 
        str.variable_name === variableName || 
        str.variable_hash === variableName
      );
      
      if (stringVariable) {
        // Always expand string variables recursively to their content (as plain text and badges for trait vars)
        const nestedParts = renderContentRecursively(stringVariable.content, depth + 1, `${keyPrefix}${variableName}-`);
        parts.push(...nestedParts);
      } else if (variable) {
        // For trait variables, use dimension values with precedence over trait values
        const variableValue = getVariableValueWithDimensionPrecedence(variable);
        const hasValue = variableHasAnyValue(variable);
        
        if (hasValue && variableValue) {
          // If the variable has a value, render it as mixed content (may contain embedded variables)
          const nestedParts = renderContentRecursively(variableValue, depth + 1, `${keyPrefix}${variableName}-val-`);
          parts.push(...nestedParts);
        } else {
          // If no value, show variable name as a red badge
          parts.push(
            <Badge 
              key={`${keyPrefix}${depth}-trait-${matchIndex}-${variableName}`} 
              variant="outline" 
              className="mx-1 bg-red-100 text-red-800 border-red-200 hover:bg-red-200 cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                // Trait variables are no longer editable
              }}
              title={`Click to edit variable "${variable.name}"`}
            >
              {variable.name}
            </Badge>
          );
        }
      } else {
        // Variable not found, show as-is
        parts.push(match);
      }

      lastIndex = currentIndex + match.length;
    });

    // Add any remaining text
    if (lastIndex < conditionalProcessedContent.length) {
      parts.push(conditionalProcessedContent.substring(lastIndex));
    }

    return parts;
  };

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
          trait_id: traitId,
          selected_conditional_variables: selectedConditionalVariables,
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

  const filterStringsByDimensions = (strings: any[]) => {
    // First, filter out split variables
    const nonSplitStrings = strings.filter((str: any) => {
      return !str.is_split_variable; // Hide split variables from main list
    });
    
    // Filter out embedded strings (strings that are referenced by other strings)
    const embeddedStringIds = getEmbeddedStringIds(strings);
    const rootLevelStrings = nonSplitStrings.filter((str: any) => {
      return !embeddedStringIds.has(str.id); // Only show root-level strings
    });
    
    const selectedDimensions = Object.entries(selectedDimensionValues).filter(([_, value]) => value !== null);
    
    if (selectedDimensions.length === 0) {
      return rootLevelStrings; // No filters applied, show all root-level strings
    }
    
    return rootLevelStrings.filter((str: any) => {
      // Check if string has dimension values
      if (!str.dimension_values || str.dimension_values.length === 0) {
        return false; // String has no dimension values, so it doesn't match any filter
      }
      
      // Check if string matches ALL selected dimension filters
      return selectedDimensions.every(([dimensionId, selectedValue]) => {
        return str.dimension_values.some((dv: any) => {
          return dv.dimension_value.dimension.toString() === dimensionId && 
                 dv.dimension_value.value === selectedValue;
        });
      });
    });
  };

  // Apply dimension filtering to strings
  const filteredStrings = project?.strings ? filterStringsByDimensions(project.strings) : [];

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
      const allFilteredIds = new Set(filteredStrings.map((str: any) => str.id));
      setSelectedStringIds(allFilteredIds);
    } else {
      setSelectedStringIds(new Set());
    }
  };

  const clearSelection = () => {
    setSelectedStringIds(new Set());
  };



  const isAllSelected = filteredStrings.length > 0 && filteredStrings.every((str: any) => selectedStringIds.has(str.id));
  const isIndeterminate = selectedStringIds.size > 0 && !isAllSelected;

  const openBulkDeleteDialog = () => {
    setBulkDeleteDialog(true);
  };

  const closeBulkDeleteDialog = () => {
    setBulkDeleteDialog(false);
  };

  const handleBulkDelete = async () => {
    if (selectedStringIds.size === 0) return;

    try {
      // Delete all selected strings
      const deletePromises = Array.from(selectedStringIds).map(async (stringId) => {
        const response = await fetch(`/api/projects/${id}/strings/${stringId}/`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to delete string ${stringId}`);
        }
      });

      await Promise.all(deletePromises);

      // Refresh project data
      const response = await fetch(`/api/projects/${id}/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        const projectData = await response.json();
        setProject(sortProjectStrings(projectData));
        clearSelection();
        closeBulkDeleteDialog();
        toast.success(`Successfully deleted ${selectedStringIds.size} strings`);
      }
    } catch (error) {
      console.error('Error deleting strings:', error);
      toast.error('Failed to delete some strings');
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

      // Get existing variable names
      const existingVariableNames = new Set((project.variables || []).map((v: any) => v.name));
      const newVariables = Array.from(allVariables).filter(name => !existingVariableNames.has(name));

      // Create new variables first
      let createdVariablesCount = 0;
      if (newVariables.length > 0) {
        const variablePromises = newVariables.map(async (variableName) => {
          try {
            await apiFetch('/api/variables/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: variableName,
                project: id,
                variable_type: 'trait',
              }),
            });
            createdVariablesCount++;
          } catch (err) {
            console.error(`Failed to create variable ${variableName}:`, err);
          }
        });
        
        await Promise.all(variablePromises);
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
      const message = `Import complete! Created ${createdStringsCount} strings${newVariables.length > 0 ? ` and ${createdVariablesCount} variables` : ''}`;
      toast.success(message);

      closeImportDialog();
    } catch (error) {
      console.error('Error importing strings:', error);
      toast.error('Failed to import strings. Please try again.');
    } finally {
      setImportLoading(false);
    }
  };

  // Helper function to get variable value for current trait
  const getVariableValueForCurrentTrait = (variable: any) => {
    // Don't show values when "blank" trait is selected
    if (traitId === "blank") {
      return null;
    }

    // For trait variables, get the value for the current trait
    if (traitId && traitId !== "blank") {
      const variableValue = variable.values?.find((value: any) => value.trait.toString() === traitId);
      return variableValue ? variableValue.value : null;
    }

    return null;
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
      // Check trait variables
      const traitVariable = project.variables?.find((v: any) => v.name === variableName);
      if (traitVariable && traitVariable.dimension_values) {
        // Find the dimension value object for this dimension and value
        const dimension = project.dimensions?.find((d: any) => d.id === dimensionId);
        const dimensionValueObj = dimension?.values?.find((dv: any) => dv.value === dimensionValue);
        
        if (dimensionValueObj) {
          // Check if this variable has a value for this dimension value
          const hasValue = traitVariable.dimension_values.some((vdv: any) => 
            vdv.dimension_value === dimensionValueObj.id
          );
          if (hasValue) {
            return true;
          }
        }
      }
      
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
      <div className="flex flex-1 overflow-hidden">
        {/* Filter Sidebar (left) */}
        <aside className="w-90 border-r bg-muted/40 flex flex-col">
          {/* Filter Header - Sticky */}
          <div className="flex items-center justify-between gap-4 border-b px-6 py-4 bg-background min-h-[65px] sticky top-0 z-10">
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>
          {/* Filter Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Dimensions Section */}
          <div className="space-y-3">
            <div className="group">
              <div className="flex items-center justify-between w-full hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">Dimensions</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                  onClick={() => openCreateDimension()}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {/* Dimension Filters */}
            {project.dimensions && project.dimensions.length > 0 ? (
              <div className="space-y-4 ml-6">
                {(project.dimensions || []).map((dimension: any) => (
            <div key={dimension.id} className="space-y-3">
              <div className="flex items-center justify-between group">
                <div 
                  className="flex items-center justify-between w-full hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 cursor-pointer"
                  onClick={() => openEditDimension(dimension)}
                >
                  <h3 className="font-medium text-sm">{dimension.name}</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDimension(dimension);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {dimension.values && dimension.values.map((dimensionValue: any) => {
                  const isSelected = selectedDimensionValues[dimension.id] === dimensionValue.value;
                  
                  if (isSelected) {
                    // Selected badge with close button
                    return (
                      <div
                        key={dimensionValue.id}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200"
                      >
                        <span>{dimensionValue.value}</span>
                        <button
                          onClick={() => setSelectedDimensionValues(prev => ({
                            ...prev,
                            [dimension.id]: null
                          }))}
                          className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-300 transition-colors"
                          aria-label={`Remove ${dimensionValue.value} filter`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  } else {
                    // Unselected badge
                    return (
                      <Badge
                        key={dimensionValue.id}
                        variant="outline"
                        className="text-xs transition-colors hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 active:bg-blue-100 cursor-pointer"
                        onClick={() => setSelectedDimensionValues(prev => ({
                          ...prev,
                          [dimension.id]: dimensionValue.value
                        }))}
                      >
                        {dimensionValue.value}
                      </Badge>
                    );
                  }
                })}
              </div>
            </div>
                ))}
              </div>
                          ) : (
                <div className="text-muted-foreground text-center text-sm ml-6">
                  No dimensions found in this project.
                </div>
              )}
          </div>
          
          {/* Traits Section */}
          <div className="space-y-3">
            <div className="group">
              <div className="flex items-center justify-between w-full hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1">
                <div className="flex items-center gap-2">
                  <SwatchBook className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">Traits</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                  onClick={() => {
                    // Trait creation is no longer available
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="space-y-2 ml-6">
              <div className="group">
                <div className="flex items-center justify-between w-full hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="trait-blank"
                      name="trait"
                      checked={traitId === "blank"}
                      onChange={() => setTraitId("blank")}
                      className="rounded-full"
                    />
                    <Label htmlFor="trait-blank" className="text-sm cursor-pointer">
                      Blank (Variables)
                    </Label>
                  </div>
                </div>
              </div>
              {(project.traits || []).map((trait: any) => (
                <div key={trait.id} className="group">
                  <div className="flex items-center justify-between w-full hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id={`trait-${trait.id}`}
                        name="trait"
                        checked={traitId === trait.id.toString()}
                        onChange={() => setTraitId(trait.id.toString())}
                        className="rounded-full"
                      />
                      <Label htmlFor={`trait-${trait.id}`} className="text-sm cursor-pointer">
                        {trait.name}
                      </Label>
                    </div>
                                          <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                        onClick={() => {
                          // Trait editing is no longer available
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
                    {/* Conditionals Section */}
          {(() => {
            const conditionalTraitVariables = (project.variables || []).filter((variable: any) => variable.is_conditional);
            const conditionalStringVariables = project.strings?.filter((str: any) => str.is_conditional) || [];
            const hasConditionals = conditionalTraitVariables.length > 0 || conditionalStringVariables.length > 0;
            
            if (!hasConditionals) return null;
            
            return (
              <div className="space-y-3">
                <div className="group">
                  <div className="flex items-center justify-between w-full hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1">
                    <div className="flex items-center gap-2">
                      <Signpost className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium text-sm">Conditionals</h3>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 ml-6">
                  {/* Trait Variables */}
                  {conditionalTraitVariables.map((variable: any) => (
                    <div key={`trait-${variable.id}`} className="group">
                      <div className="flex items-center justify-between w-full hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`conditional-${variable.id}`}
                            checked={selectedConditionalVariables.includes(variable.id.toString())}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedConditionalVariables(prev => [...prev, variable.id.toString()]);
                              } else {
                                setSelectedConditionalVariables(prev => prev.filter(id => id !== variable.id.toString()));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor={`conditional-${variable.id}`} className="text-sm cursor-pointer">
                            {variable.name}
                          </Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                          onClick={() => {
                            // Trait variables are no longer editable
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {/* String Variables */}
                  {conditionalStringVariables.map((stringVar: any) => (
                    <div key={`string-${stringVar.id}`} className="group">
                      <div className="flex items-center justify-between w-full hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`conditional-s${stringVar.id}`}
                            checked={selectedConditionalVariables.includes(`s${stringVar.id}`)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedConditionalVariables(prev => [...prev, `s${stringVar.id}`]);
                              } else {
                                setSelectedConditionalVariables(prev => prev.filter(id => id !== `s${stringVar.id}`));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor={`conditional-s${stringVar.id}`} className="text-sm cursor-pointer">
                            {stringVar.effective_variable_name || stringVar.variable_hash}
                          </Label>
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 p-1">
                            <Spool className="h-3 w-3" />
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                          onClick={() => openEditString(stringVar)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </aside>

        {/* Main Canvas */}
        <main className="flex-1 flex flex-col items-stretch min-w-0">
          {/* Canvas Header - Sticky */}
          <div className="flex items-center justify-between gap-4 border-b px-6 py-4 bg-background sticky top-0 z-10">
            <h2 className="text-lg font-semibold">Project Strings</h2>
            <div className="flex items-center gap-2">
              {/* Display Mode Controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowStringVariables(!showStringVariables)}
                className={`flex items-center gap-2 transition-colors ${
                  showStringVariables 
                    ? 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100' 
                    : 'hover:bg-muted'
                }`}
              >
                <Spool className="h-4 w-4" />
                String Variables
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPlaintextMode(!isPlaintextMode)}
                className={`flex items-center gap-2 transition-colors ${
                  isPlaintextMode 
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100' 
                    : 'hover:bg-muted'
                }`}
              >
                <Type className="h-4 w-4" />
                Plaintext
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDimensions(!showDimensions)}
                className={`flex items-center gap-2 transition-colors ${
                  showDimensions 
                    ? 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100' 
                    : 'hover:bg-muted'
                }`}
              >
                <Globe className="h-4 w-4" />
                Dimensions
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
              {(project?.strings || []).filter((str: any) => !str.is_split_variable).length === 0 
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
                      onClick={() => openEditString(str)}
                    >
                      <div className="flex-1">
                        <div className={`font-medium text-base ${isPlaintextMode ? 'leading-normal' : 'leading-loose'}`}>
                        {str.is_split_variable ? (
                          <div className="flex items-center gap-2 text-muted-foreground italic">
                            <Split className="h-4 w-4" />
                            <span>Split variable - click split to add more spawns</span>
                          </div>
                        ) : isPlaintextMode 
                          ? processStringContent(str.content, str.variables || [])
                          : renderStyledContent(str.content, str.variables || [], str.id)
                        }
                        </div>
                        {/* Variable hash/name display */}
                        <div className="mt-2 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="cursor-pointer hover:bg-muted text-xs font-mono bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1"
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
                                openDeleteStringDialog(str);
                              }}
                              className="text-red-600 focus:text-red-600"
                            >
                              Delete string
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                  
                  {/* Dimension Values */}
                  {showDimensions && str.dimension_values && str.dimension_values.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      {(() => {
                        // Group only non-inherited dimension values by dimension
                        const groupedDimensions: {[dimensionId: number]: {name: string, values: string[]}} = {};
                        str.dimension_values.forEach((dv: any) => {
                          const dimension = project.dimensions?.find((d: any) => d.id === dv.dimension_value.dimension);
                          const dimensionId = dv.dimension_value.dimension;
                          const value = dv.dimension_value.value;
                          // Only include if NOT inherited
                          if (!isDimensionValueInheritedFromVariables(dimensionId, value, str.content)) {
                            if (!groupedDimensions[dimensionId]) {
                              groupedDimensions[dimensionId] = {
                                name: dimension?.name || 'Unknown',
                                values: []
                              };
                            }
                            groupedDimensions[dimensionId].values.push(value);
                          }
                        });
                        // Render grouped dimension values
                        return Object.entries(groupedDimensions).map(([dimensionId, group]) => (
                          <Badge
                            key={dimensionId}
                            variant="outline"
                            className="text-xs bg-gray-50 text-gray-700 border-gray-200"
                          >
                            <span className="font-medium">{group.name}</span>
                            <span className="mx-1">:</span>
                            <span>{group.values.join(', ')}</span>
                          </Badge>
                        ));
                      })()}
                    </div>
                  )}
                </Card>
              ))}
            </ul>
          )}
        </div>
      </main>

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

      {/* Delete String Confirmation Dialog */}
      <Dialog open={!!deleteStringDialog} onOpenChange={v => !v && closeDeleteStringDialog()}>
        <DialogContent className="max-w-md">
          <DialogTitle>Delete String</DialogTitle>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this string?
            </p>
            {deleteStringDialog && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">String to delete:</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {deleteStringDialog.content.length > 100 
                    ? `${deleteStringDialog.content.substring(0, 100)}...` 
                    : deleteStringDialog.content
                  }
                </p>
              </div>
            )}
            
            {deleteStringDialog && (() => {
              const referencingVariables = (project.variables || []).filter((variable: any) => 
                variable.variable_type === 'string' && 
                variable.referenced_string && 
                variable.referenced_string.toString() === deleteStringDialog.id.toString()
              );
              
              if (referencingVariables.length > 0) {
                return (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">
                      <strong>Cannot delete:</strong> This string is referenced by the following string variable{referencingVariables.length > 1 ? 's' : ''}:
                    </p>
                    <ul className="mt-2 text-sm text-red-700">
                      {referencingVariables.map((variable: any) => (
                        <li key={variable.id} className="ml-4">• {variable.name}</li>
                      ))}
                    </ul>
                    <p className="text-sm text-red-800 mt-2">
                      Please update or delete the variable{referencingVariables.length > 1 ? 's' : ''} first.
                    </p>
                  </div>
                );
              } else {
                return (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Deleting this string will not affect any existing variables. 
                      No string variables currently reference this string.
                    </p>
                  </div>
                );
              }
            })()}
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="secondary" onClick={closeDeleteStringDialog}>
                Cancel
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                onClick={handleDeleteString}
                disabled={deleteStringDialog && checkStringUsage(deleteStringDialog.id)}
              >
                Delete String
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



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
            <p>This will download a CSV file containing all strings that match your current filters.</p>
            
            {/* Show current filter state */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <h4 className="font-medium text-sm">Current Filters:</h4>
              
              {/* Trait filter */}
              <div className="text-sm">
                <span className="font-medium">Trait: </span>
                <span className="text-muted-foreground">
                  {traitId === "blank" ? "Blank (Variables)" : 
                   (project.traits || []).find((t: any) => t.id.toString() === traitId)?.name || "None"}
                </span>
              </div>
              
              {/* Dimension filters */}
              {Object.entries(selectedDimensionValues).filter(([_, value]) => value !== null).length > 0 && (
                <div className="text-sm">
                  <span className="font-medium">Dimensions: </span>
                  <div className="ml-2 space-y-1">
                    {Object.entries(selectedDimensionValues)
                      .filter(([_, value]) => value !== null)
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
              
              {/* Conditional filters */}
              {selectedConditionalVariables.length > 0 && (
                <div className="text-sm">
                  <span className="font-medium">Conditionals: </span>
                  <span className="text-muted-foreground">
                    {selectedConditionalVariables.map(varId => {
                      const variable = (project.variables || []).find((v: any) => v.id.toString() === varId);
                      return variable?.name;
                    }).join(', ')}
                  </span>
                </div>
              )}
              
              {/* Show filtered count */}
              <div className="text-sm">
                <span className="font-medium">Strings to export: </span>
                <span className="text-muted-foreground">{filteredStrings.length}</span>
              </div>
              
              {/* Show message if no filters */}
              {Object.entries(selectedDimensionValues).filter(([_, value]) => value !== null).length === 0 &&
               selectedConditionalVariables.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No dimension or conditional filters applied. All {(project.strings || []).filter((str: any) => !str.is_split_variable).length} strings will be exported.
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

      {/* Create/Edit String Sheet */}
      <Sheet open={createDialog === "String" || !!editingString} onOpenChange={v => !v && closeStringDialog()}>
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
                  placeholder="Enter string content. Click variables below to insert them."
                  rows={4}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Click variable badges below to insert them.
                </p>
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
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => openEditNestedString(stringVar)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-xs bg-purple-50 text-purple-700 border-purple-200"
                            >
                              <Spool className="h-3 w-3 mr-1" />
                              {`{{${stringVar.effective_variable_name || stringVar.variable_hash}}}`}
                            </Badge>
                            {stringVar.is_conditional && (
                              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 p-1">
                                <Signpost className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {stringVar.is_split_variable ? (
                              <span className="italic flex items-center gap-1">
                                <Split className="h-3 w-3" />
                                Split variable - click split to add more spawns
                              </span>
                            ) : stringVar.content.length > 60 
                              ? `${stringVar.content.substring(0, 60)}...` 
                              : stringVar.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Edit2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}

                    {/* Pending string variables */}
                    {pendingVariablesInContent.map((variableName: string) => (
                      <div
                        key={`pending-${variableName}`}
                        className="flex items-center justify-between p-3 border-2 border-dashed border-blue-200 rounded-lg hover:bg-blue-50/50 transition-colors cursor-pointer bg-blue-50/30"
                        onClick={() => createAndEditPendingVariable(variableName)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-xs bg-blue-100 text-blue-700 border-blue-300"
                            >
                              <Spool className="h-3 w-3 mr-1" />
                              {`{{${variableName}}}`}
                            </Badge>
                            <Badge
                              variant="outline" 
                              className="text-xs bg-blue-100 text-blue-600 border-blue-300"
                            >
                              New
                            </Badge>
                          </div>
                          <p className="text-sm text-blue-600 mt-1 italic">
                            Click to create and edit this string variable
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4 text-blue-600" />
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



      {/* Trait functionality has been removed */}

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
              {!nestedStringSplitMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNestedStringSplit}
                  className="flex items-center gap-2"
                >
                  <Split className="h-4 w-4" />
                  Split Variable
                </Button>
              )}
            </div>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {editingSplitVariable ? (
              // Split variable editing UI
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Split Variable Spawns</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSplitVariableSpawn}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Spawn
                  </Button>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Edit the spawned string variables below. Each spawn represents a different version of this split variable.
                </p>

                <div className="space-y-4">
                  {splitVariableSpawns.map((spawn, index) => (
                    <div key={spawn.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono">
                            {`{{${spawn.effective_variable_name || spawn.variable_hash}}}`}
                          </Badge>
                        </h4>
                        {splitVariableSpawns.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSplitVariableSpawn(spawn.id)}
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
                          onChange={(e) => updateSplitVariableSpawn(spawn.id, 'content', e.target.value)}
                          placeholder="Enter spawn content"
                          rows={3}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Variable Name</Label>
                        <Input
                          value={spawn.variable_name || ''}
                          onChange={(e) => updateSplitVariableSpawn(spawn.id, 'variable_name', e.target.value)}
                          placeholder="Custom variable name (optional)"
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`spawn-${spawn.id}-conditional`}
                          checked={spawn.is_conditional}
                          onChange={(e) => updateSplitVariableSpawn(spawn.id, 'is_conditional', e.target.checked)}
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
            ) : nestedStringSplitMode ? (
              // Split mode UI (for creating new splits)
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Split Variable Spawns</h3>
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
            {editingSplitVariable ? (
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
            ) : nestedStringSplitMode ? (
              <>
                <Button type="button" variant="secondary" onClick={() => setNestedStringSplitMode(false)}>
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
    </div>
  );
} 