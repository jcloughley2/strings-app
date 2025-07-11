"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from "@/components/ui/select";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { Edit2, Trash2, Type, Bookmark, Spool, Signpost, Plus, X, Globe, SwatchBook, MoreHorizontal, Download } from "lucide-react";
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
  const [traitId, setTraitId] = useState<string | null>("blank");
  const [selectedConditionalVariables, setSelectedConditionalVariables] = useState<string[]>([]);
  const [isPlaintextMode, setIsPlaintextMode] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showStringVariables, setShowStringVariables] = useState(false);
  
  // Filter sidebar state
  const [selectedDimensionValues, setSelectedDimensionValues] = useState<{[dimensionId: number]: string | null}>({});
  const [isVariablesSidebarOpen, setIsVariablesSidebarOpen] = useState(false);
  
  // Project edit/delete state
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deleteProjectDialog, setDeleteProjectDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [createDialog, setCreateDialog] = useState<null | "Variable" | "Trait" | "Conditional" | "String" | "Dimension">(null);
  const [editingString, setEditingString] = useState<any>(null);
  
  // String form state
  const [stringContent, setStringContent] = useState("");
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  
  // String variable creation state
  const [createStringVariable, setCreateStringVariable] = useState(false);
  const [stringVariableName, setStringVariableName] = useState("");

  // String dimension values state - now supports multiple values per dimension
  const [stringDimensionValues, setStringDimensionValues] = useState<{[dimensionId: number]: string[]}>({});
  
  // Dimension value selector state
  const [openDimensionPopover, setOpenDimensionPopover] = useState<number | null>(null);
  const [dimensionFilterText, setDimensionFilterText] = useState<{[dimensionId: number]: string}>({});
  
  // Variable form state
  const [variableName, setVariableName] = useState("");
  const [variableType, setVariableType] = useState<'trait' | 'string'>('trait');
  const [referencedStringId, setReferencedStringId] = useState<string>("");
  const [variableContent, setVariableContent] = useState("");
  const [isConditional, setIsConditional] = useState(false);
  const [variableValues, setVariableValues] = useState<{[traitId: string]: string}>({});
  const [editingVariable, setEditingVariable] = useState<any>(null);
  
  // Variable content editing state (for string variables)
  const [variableTextareaRef, setVariableTextareaRef] = useState<HTMLTextAreaElement | null>(null);
  
  // Trait form state
  const [traitName, setTraitName] = useState("");
  const [traitVariableValues, setTraitVariableValues] = useState<{[variableId: string]: string}>({});
  const [editingTrait, setEditingTrait] = useState<any>(null);

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

  // String conversion state
  const [convertStringDialog, setConvertStringDialog] = useState<any>(null);
  const [convertVariableName, setConvertVariableName] = useState("");

  // String dialog tab state
  const [stringDialogTab, setStringDialogTab] = useState("content");

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
      const variable = project.variables.find((v: any) => v.name === variableName);
      
      // If this is a conditional variable and it's not selected, remove it from content
      if (variable?.is_conditional && !selectedConditionalVariables.includes(variable.id.toString())) {
        const regex = new RegExp(`{{${variableName}}}`, 'g');
        processedContent = processedContent.replace(regex, '');
      }
    });
    
    return processedContent;
  };

  // String dialog handlers
  const openCreateString = () => {
    setStringContent("");
    setCreateDialog("String");
  };

  const openEditString = (str: any) => {
    setStringContent(str.content);
    setEditingString(str);
    
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
    // Before closing, create any new variables that were detected
    if (stringContent.trim()) {
      const variableMatches = stringContent.match(/{{([^}]+)}}/g) || [];
      const variableNames = variableMatches.map(match => match.slice(2, -2));
      const uniqueVariableNames = [...new Set(variableNames)];
      
      // Find new variables that don't exist yet
      const existingVariableNames = project.variables.map((v: any) => v.name);
      const newVariableNames = uniqueVariableNames.filter(name => 
        !existingVariableNames.includes(name) && name.trim() !== ''
      );
      
      // Create new variables
      if (newVariableNames.length > 0) {
        try {
          const createdVariables = [];
          for (const variableName of newVariableNames) {
            try {
              const newVariable = await apiFetch('/api/variables/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: variableName,
                  project: id,
                }),
              });
              createdVariables.push(newVariable);
            } catch (err) {
              console.error(`Failed to create variable ${variableName}:`, err);
            }
          }
          
          if (createdVariables.length > 0) {
            // Show success message
            const variableList = createdVariables.map(v => v.name).join(', ');
            toast.success(`Created ${createdVariables.length} new variable${createdVariables.length > 1 ? 's' : ''}: ${variableList}`);
            
            // Refresh project data to include new variables
            const updatedProject = await apiFetch(`/api/projects/${id}/`);
            setProject(updatedProject);
          }
        } catch (err) {
          console.error('Failed to create new variables:', err);
        }
      }
    }
    
    // Clear dialog state
    setCreateDialog(null);
    setEditingString(null);
    setStringContent("");
    setSelectedText("");
    setSelectionStart(0);
    setSelectionEnd(0);
    setCreateStringVariable(false);
    setStringVariableName("");
    setStringDimensionValues({});
    setOpenDimensionPopover(null);
    setDimensionFilterText({});
    setStringDialogTab("content");
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

  // String conversion handlers
  const openConvertStringDialog = (str: any) => {
    setConvertStringDialog(str);
    setConvertVariableName("");
  };

  const closeConvertStringDialog = () => {
    setConvertStringDialog(null);
    setConvertVariableName("");
  };

  const handleConvertString = async () => {
    if (!convertStringDialog || !convertVariableName.trim()) return;

    try {
      // Create the string variable with the content directly
      await apiFetch('/api/variables/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: convertVariableName.trim(),
          project: id,
          variable_type: 'string',
          content: convertStringDialog.content,
        }),
      });
      
      // Delete the original string since it's now a variable
      await apiFetch(`/api/strings/${convertStringDialog.id}/`, {
        method: 'DELETE',
      });
      
      toast.success(`String converted to variable "${convertVariableName}" successfully!`);
      
      // Refresh project data to reflect the changes
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(updatedProject));
      
      closeConvertStringDialog();
    } catch (err) {
      console.error('Failed to convert string to variable:', err);
      toast.error('Failed to convert string. Please try again.');
    }
  };

  const checkStringUsage = (stringId: number) => {
    // Check if string is referenced by any string variables
    return project.variables.some((variable: any) => {
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
      const referencingVariables = project.variables.filter((variable: any) => 
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
      
      closeDeleteStringDialog();
    } catch (err) {
      console.error('Failed to delete string:', err);
      toast.error('Failed to delete string. Please try again.');
    }
  };

   // Variable dialog handlers
     const openCreateVariable = () => {
    setVariableName("");
    setVariableType('trait');
    setReferencedStringId("");
    setVariableContent("");
    setIsConditional(false);
    setVariableValues({});
    setCreateDialog("Variable");
  };

   const openEditVariable = (variable: any) => {
     setVariableName(variable.name);
     setVariableType(variable.variable_type || 'trait');
     setReferencedStringId(variable.referenced_string?.toString() || "");
     setVariableContent(variable.content || "");
     setIsConditional(variable.is_conditional || false);
     
     // Pre-populate existing values for each trait
     const existingValues: {[traitId: string]: string} = {};
     if (variable.values) {
       variable.values.forEach((vv: any) => {
         existingValues[vv.trait.toString()] = vv.value;
       });
     }
     setVariableValues(existingValues);
     setEditingVariable(variable);
   };

       const closeVariableDialog = () => {
      setCreateDialog(null);
      setEditingVariable(null);
      setVariableName("");
      setVariableType('trait');
      setReferencedStringId("");
      setVariableContent("");
      setIsConditional(false);
      setVariableValues({});
    };

    const checkVariableUsage = (variableName: string) => {
      // Check if variable is used in any string content
      return project.strings.some((str: any) => {
        const regex = new RegExp(`{{${variableName}}}`, 'g');
        return regex.test(str.content);
      });
    };

    const handleDeleteVariable = async () => {
      if (!editingVariable) return;

      // Check if variable is being used in any strings
      const isUsed = checkVariableUsage(editingVariable.name);
      
      if (isUsed) {
        toast.error(`Cannot delete variable "${editingVariable.name}" because it's being used in one or more strings. Please remove it from all strings first.`);
        return;
      }

      try {
        await apiFetch(`/api/variables/${editingVariable.id}/`, {
          method: 'DELETE',
        });
        
        toast.success(`Variable "${editingVariable.name}" deleted successfully!`);
        
        // Refresh project data to reflect the deletion
        const updatedProject = await apiFetch(`/api/projects/${id}/`);
        setProject(sortProjectStrings(updatedProject));
        
        closeVariableDialog();
      } catch (err) {
        console.error('Failed to delete variable:', err);
        toast.error('Failed to delete variable. Please try again.');
      }
    };

    const handleDeleteVariableFromCard = async (variable: any) => {
      // Check if variable is being used in any strings
      const isUsed = checkVariableUsage(variable.name);
      
      if (isUsed) {
        toast.error(`Cannot delete variable "${variable.name}" because it's being used in one or more strings. Please remove it from all strings first.`);
        return;
      }

      try {
        await apiFetch(`/api/variables/${variable.id}/`, {
          method: 'DELETE',
        });
        
        toast.success(`Variable "${variable.name}" deleted successfully!`);
        
        // Refresh project data to reflect the deletion
        const updatedProject = await apiFetch(`/api/projects/${id}/`);
        setProject(sortProjectStrings(updatedProject));
      } catch (err) {
        console.error('Failed to delete variable:', err);
        toast.error('Failed to delete variable. Please try again.');
      }
    };

   // Trait dialog handlers
   const openCreateTrait = () => {
     setTraitName("");
     setTraitVariableValues({});
     setCreateDialog("Trait");
   };

   const openEditTrait = (trait: any) => {
     setTraitName(trait.name);
     
     // Pre-populate existing values for each variable
     const existingValues: {[variableId: string]: string} = {};
     if (project.variables) {
       project.variables.forEach((variable: any) => {
         if (variable.values) {
           const variableValue = variable.values.find((vv: any) => vv.trait.toString() === trait.id.toString());
           if (variableValue) {
             existingValues[variable.id.toString()] = variableValue.value;
           }
         }
       });
     }
     setTraitVariableValues(existingValues);
     setEditingTrait(trait);
     setCreateDialog("Trait");
   };

   const closeTraitDialog = () => {
     setCreateDialog(null);
     setEditingTrait(null);
     setTraitName("");
     setTraitVariableValues({});
   };

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

   const handleVariableSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     // Frontend validation for duplicate variable names
     if (!editingVariable) {
       // For new variables, check if name already exists
       const existingVariable = project.variables.find(
         (v: any) => v.name.toLowerCase() === variableName.toLowerCase()
       );
       if (existingVariable) {
         toast.error(`A variable with the name "${variableName}" already exists in this project.`);
         return;
       }
     } else {
       // For editing variables, check if name conflicts with other variables
       const existingVariable = project.variables.find(
         (v: any) => v.name.toLowerCase() === variableName.toLowerCase() && v.id !== editingVariable.id
       );
       if (existingVariable) {
         toast.error(`A variable with the name "${variableName}" already exists in this project.`);
         return;
       }
     }
     
     try {
       let variableId: number;
       
       if (editingVariable) {
         // Update existing variable
         const variableData = {
           name: variableName,
           variable_type: variableType,
           referenced_string: variableType === 'string' && referencedStringId ? parseInt(referencedStringId) : null,
           content: variableType === 'string' ? variableContent : null,
           is_conditional: isConditional,
         };

         await apiFetch(`/api/variables/${editingVariable.id}/`, {
           method: 'PATCH',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(variableData),
         });
         
         variableId = editingVariable.id;
       } else {
         // Create new variable
         const variableData = {
           name: variableName,
           project: id,
           variable_type: variableType,
           referenced_string: variableType === 'string' && referencedStringId ? parseInt(referencedStringId) : null,
           content: variableType === 'string' ? variableContent : null,
           is_conditional: isConditional,
         };

         const newVariable = await apiFetch('/api/variables/', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(variableData),
         });
         
         variableId = newVariable.id;
       }

       // Auto-create variables detected in string variable content
       if (variableType === 'string' && variableContent.trim()) {
         const variableMatches = variableContent.match(/{{([^}]+)}}/g) || [];
         const detectedVariableNames = variableMatches.map(match => match.slice(2, -2));
         const uniqueVariableNames = [...new Set(detectedVariableNames)];
         
         // Find new variables that don't exist yet
         const existingVariableNames = project.variables.map((v: any) => v.name);
         const newVariableNames = uniqueVariableNames.filter(name => 
           !existingVariableNames.includes(name) && name.trim() !== ''
         );
         
         // Create new variables
         if (newVariableNames.length > 0) {
           try {
             const createdVariables = [];
             for (const newVariableName of newVariableNames) {
               try {
                 const newVar = await apiFetch('/api/variables/', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({
                     name: newVariableName,
                     project: id,
                     variable_type: 'trait', // Default to trait for auto-created variables
                   }),
                 });
                 createdVariables.push(newVar);
               } catch (err) {
                 console.error(`Failed to create variable ${newVariableName}:`, err);
               }
             }
             
             if (createdVariables.length > 0) {
               const variableList = createdVariables.map(v => v.name).join(', ');
               toast.success(`Created ${createdVariables.length} new variable${createdVariables.length > 1 ? 's' : ''}: ${variableList}`);
             }
           } catch (err) {
             console.error('Failed to create new variables:', err);
           }
         }
       }

       // Handle variable values (only for trait variables)
       if (variableType === 'trait' && editingVariable) {
         // For editing, we need to update/create/delete variable values
         const existingValues = editingVariable.values || [];
         
         // Process all traits (both with and without current values)
         const allTraits = project.traits || [];
         const valuePromises = allTraits.map(async (trait: any) => {
           const traitId = trait.id.toString();
           const newValue = variableValues[traitId] || '';
           const existingValue = existingValues.find((vv: any) => vv.trait.toString() === traitId);
           
           if (newValue.trim() === '') {
             // Delete existing value if new value is empty
             if (existingValue) {
               return apiFetch(`/api/variable-values/${existingValue.id}/`, {
                 method: 'DELETE',
               });
             }
             // If no existing value and new value is empty, do nothing
             return Promise.resolve();
           } else {
             // Update existing or create new value
             if (existingValue) {
               // Only update if value actually changed
               if (existingValue.value !== newValue) {
                 return apiFetch(`/api/variable-values/${existingValue.id}/`, {
                   method: 'PATCH',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ value: newValue }),
                 });
               }
               return Promise.resolve();
             } else {
               // Create new value
               return apiFetch('/api/variable-values/', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                   variable: variableId,
                   trait: parseInt(traitId),
                   value: newValue,
                 }),
               });
             }
           }
         });

         await Promise.all(valuePromises);
       } else if (variableType === 'trait' && !editingVariable) {
         // For creating trait variables, just create new values
         const valuePromises = Object.entries(variableValues)
           .filter(([_, value]) => value.trim() !== '')
           .map(([traitId, value]) => {
             return apiFetch('/api/variable-values/', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                 variable: variableId,
                 trait: parseInt(traitId),
                 value: value,
               }),
             });
           });

         await Promise.all(valuePromises);
       }

       // Refresh project data
       const updatedProject = await apiFetch(`/api/projects/${id}/`);
       setProject(sortProjectStrings(updatedProject));
       
       // Show success toast
       const action = editingVariable ? 'updated' : 'created';
       toast.success(`Variable "${variableName}" ${action} successfully!`);
       
       closeVariableDialog();
     } catch (err: any) {
       console.error('Failed to save variable:', err);
       const action = editingVariable ? 'update' : 'create';
       
       // Check if it's a validation error about duplicate names
       if (err.message && err.message.includes('already exists')) {
         toast.error(err.message);
       } else {
         toast.error(`Failed to ${action} variable. Please try again.`);
       }
     }
   };

   const handleTraitSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     try {
       let traitId: number;
       
       if (editingTrait) {
         // Update existing trait
         const traitData = {
           name: traitName,
         };

         await apiFetch(`/api/traits/${editingTrait.id}/`, {
           method: 'PATCH',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(traitData),
         });
         
         traitId = editingTrait.id;
       } else {
         // Create new trait
         const traitData = {
           name: traitName,
           project: id,
         };

         const newTrait = await apiFetch('/api/traits/', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(traitData),
         });
         
         traitId = newTrait.id;
       }

       // Handle variable values for this trait
       if (project.variables && project.variables.length > 0) {
         const valuePromises = project.variables.map(async (variable: any) => {
           const variableId = variable.id.toString();
           const newValue = traitVariableValues[variableId] || '';
           
           // Find existing value for this variable-trait combination
           const existingValue = variable.values ? variable.values.find((vv: any) => vv.trait.toString() === traitId.toString()) : null;
           
           if (newValue.trim() === '') {
             // Delete existing value if new value is empty
             if (existingValue) {
               return apiFetch(`/api/variable-values/${existingValue.id}/`, {
                 method: 'DELETE',
               });
             }
             return Promise.resolve();
           } else {
             // Update existing or create new value
             if (existingValue) {
               // Only update if value actually changed
               if (existingValue.value !== newValue) {
                 return apiFetch(`/api/variable-values/${existingValue.id}/`, {
                   method: 'PATCH',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ value: newValue }),
                 });
               }
               return Promise.resolve();
             } else {
               // Create new value
               return apiFetch('/api/variable-values/', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                   variable: variable.id,
                   trait: traitId,
                   value: newValue,
                 }),
               });
             }
           }
         });
         
         await Promise.all(valuePromises);
       }

       // Show success message
       toast.success(editingTrait ? `Updated trait "${traitName}"` : `Created trait "${traitName}"`);

       // Refresh project data
       const updatedProject = await apiFetch(`/api/projects/${id}/`);
       setProject(sortProjectStrings(updatedProject));

       closeTraitDialog();
     } catch (err) {
       console.error('Failed to save trait:', err);
       toast.error('Failed to save trait');
     }
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

   const handleStringSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Auto-detect variables from string content (they should already exist from closeStringDialog)
      const variableMatches = stringContent.match(/{{([^}]+)}}/g) || [];
      const variableNames = variableMatches.map(match => match.slice(2, -2)); // Remove {{ and }}
      const uniqueVariableNames = [...new Set(variableNames)];
      
      // Find all variables that match the content
      const detectedVariables = project.variables.filter((variable: any) => 
        uniqueVariableNames.includes(variable.name)
      );
      
      const stringData = {
        content: stringContent,
        project: id,
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

      // Handle dimension values
      const stringId = stringResponse.id || editingString?.id;
      if (stringId) {
        // Delete existing dimension values for this string
        const existingDimensionValues = await apiFetch(`/api/string-dimension-values/?string=${stringId}`);
        for (const dv of existingDimensionValues) {
          await apiFetch(`/api/string-dimension-values/${dv.id}/`, {
            method: 'DELETE',
          });
        }

        // Create new dimension values - now handling multiple values per dimension
        for (const [dimensionId, values] of Object.entries(stringDimensionValues)) {
          if (values && values.length > 0) {
            const dimension = project.dimensions?.find((d: any) => d.id.toString() === dimensionId);
            if (dimension) {
              for (const value of values) {
                if (value.trim()) {
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



      // Refresh project data
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(sortProjectStrings(updatedProject));
      await closeStringDialog();
    } catch (err) {
      console.error('Failed to save string:', err);
      toast.error('Failed to save string. Please try again.');
    }
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
          const projectVariable = project.variables.find((v: any) => v.name === variableName);
          
          if (projectVariable?.variable_type === 'string') {
            if (projectVariable.content) {
              const regex = new RegExp(`{{${variableName}}}`, 'g');
              result = result.replace(regex, projectVariable.content);
            }
          }
        });
        
        return result;
      }
      
      // Replace variables with their trait-specific values (plaintext mode)
      const selectedTrait = project.traits.find((t: any) => t.id.toString() === traitId);
      
      if (selectedTrait) {
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
            const projectVariable = project.variables.find((v: any) => v.name === variableName);
            
            if (projectVariable) {
              let value = null;
              
              if (projectVariable.variable_type === 'string') {
                // For string variables, behavior depends on showStringVariables toggle
                if (showStringVariables) {
                  // Show as variable badge - don't replace, leave as {{variableName}}
                  value = null; // Skip replacement
                } else {
                  // Show string content - get the variable content and process it recursively
                  if (projectVariable.content) {
                    value = processVariablesRecursively(projectVariable.content, depth + 1);
                  } else {
                    value = projectVariable.name;
                  }
                }
              } else {
                // For trait variables, always use the trait-specific value (not affected by showStringVariables)
                const variableValue = projectVariable.values?.find(
                  (vv: any) => vv.trait === parseInt(traitId || "0")
                );
                value = variableValue?.value || projectVariable.name;
              }
              
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
    
    if (traitId === "blank") {
      // Behavior depends on showStringVariables toggle
      if (showStringVariables) {
        // Show all variables as grey badges in {{variable}} format
        const parts = conditionalProcessedContent.split(/({{[^}]+}})/);
        return parts.map((part: string, index: number) => {
          if (part.match(/{{[^}]+}}/)) {
            const variableName = part.slice(2, -2); // Remove {{ and }}
            const variable = project.variables.find((v: any) => v.name === variableName);
            
            return (
              <Badge 
                key={`${keyPrefix}${depth}-${index}-${variableName}`} 
                variant="secondary" 
                className={`mx-1 transition-colors ${
                  variable?.variable_type === 'string' 
                    ? "cursor-default" 
                    : "cursor-pointer hover:bg-secondary/80"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (variable && variable.variable_type !== 'string') {
                    openEditVariable(variable);
                  }
                }}
                title={
                  variable 
                    ? variable.variable_type === 'string' 
                      ? `String variable "${variableName}" - references a string` 
                      : `Click to edit variable "${variableName}"`
                    : `Variable "${variableName}" not found`
                }
              >
                {part}
              </Badge>
            );
          }
          return part;
        });
      } else {
        // Show string variables expanded, trait variables as badges
        const parts = conditionalProcessedContent.split(/({{[^}]+}})/);
        const result: (string | React.ReactNode)[] = [];
        
        parts.forEach((part: string, index: number) => {
          if (part.match(/{{[^}]+}}/)) {
            const variableName = part.slice(2, -2); // Remove {{ and }}
            const variable = project.variables.find((v: any) => v.name === variableName);
            
            if (variable?.variable_type === 'string') {
              // For string variables, show their content
              if (variable.content) {
                const nestedParts = renderContentRecursively(variable.content, depth + 1, `${keyPrefix}${variableName}-`);
                result.push(...nestedParts);
              } else {
                result.push(variableName);
              }
            } else {
              // For trait variables, show as grey badges
              result.push(
                <Badge 
                  key={`${keyPrefix}${depth}-${index}-${variableName}`} 
                  variant="secondary" 
                  className="mx-1 transition-colors cursor-pointer hover:bg-secondary/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (variable) {
                      openEditVariable(variable);
                    }
                  }}
                  title={
                    variable 
                      ? `Click to edit variable "${variable.name}"`
                      : `Variable "${variableName}" not found`
                  }
                >
                  {part}
                </Badge>
              );
            }
          } else {
            result.push(part);
          }
        });
        
        return result;
      }
    }

    // When a trait is selected, process variables recursively
    const selectedTrait = project.traits.find((t: any) => t.id.toString() === traitId);
    if (!selectedTrait) {
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
      const variable = project.variables.find((v: any) => v.name === variableName);
      const currentIndex = conditionalProcessedContent.indexOf(match, lastIndex);
      
      // Add text before the variable
      if (currentIndex > lastIndex) {
        parts.push(conditionalProcessedContent.substring(lastIndex, currentIndex));
      }

      if (variable) {
        if (variable.variable_type === 'string') {
          // For string variables, behavior depends on showStringVariables toggle
          if (showStringVariables) {
            // Show as grey badge
            parts.push(
              <Badge 
                key={`${keyPrefix}${depth}-string-${matchIndex}-${variableName}`} 
                variant="secondary" 
                className="mx-1 cursor-default"
                                 title={`String variable "${variableName}" - references a string`}
               >
                 {`{{${variableName}}}`}
               </Badge>
            );
          } else {
            // Show string content - recursively process their content
            if (variable.content) {
              const nestedParts = renderContentRecursively(variable.content, depth + 1, `${keyPrefix}${variableName}-`);
              parts.push(...nestedParts);
            } else {
              parts.push(variableName);
            }
          }
        } else {
          // For trait variables, always show as colored badges with trait-specific values (not affected by showStringVariables)
          const variableValue = variable.values?.find(
            (vv: any) => vv.trait === parseInt(traitId || "0")
          );
          const hasValue = !!variableValue?.value;
          const value = variableValue?.value || variable.name;
          
          const badgeClassName = hasValue 
            ? "mx-1 bg-green-100 text-green-800 border-green-200 hover:bg-green-200 cursor-pointer transition-colors" 
            : "mx-1 bg-red-100 text-red-800 border-red-200 hover:bg-red-200 cursor-pointer transition-colors";

          parts.push(
            <Badge 
              key={`${keyPrefix}${depth}-trait-${matchIndex}-${variableName}`} 
              variant="outline" 
              className={badgeClassName}
              onClick={(e) => {
                e.stopPropagation();
                openEditVariable(variable);
              }}
              title={`Click to edit variable "${variable.name}"`}
            >
              {value}
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

  const filterStringsByDimensions = (strings: any[]) => {
    const selectedDimensions = Object.entries(selectedDimensionValues).filter(([_, value]) => value !== null);
    
    if (selectedDimensions.length === 0) {
      return strings; // No filters applied, show all strings
    }
    
    return strings.filter((str: any) => {
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
  const filteredStrings = filterStringsByDimensions(project.strings);

  // Helper function to get variable value for current trait
  const getVariableValueForCurrentTrait = (variable: any) => {
    // Don't show values when "blank" trait is selected
    if (traitId === "blank") {
      return null;
    }

    // For string variables, get the referenced string content
    if (variable.variable_type === 'string' && variable.referenced_string) {
      const referencedString = project.strings.find((str: any) => str.id.toString() === variable.referenced_string.toString());
      return referencedString ? referencedString.content : null;
    }

    // For trait variables, get the value for the current trait
    if (variable.variable_type === 'trait' && traitId && traitId !== "blank") {
      const variableValue = variable.values?.find((value: any) => value.trait.toString() === traitId);
      return variableValue ? variableValue.value : null;
    }

    return null;
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
            onClick={() => setDownloadDialog(true)}
          >
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsVariablesSidebarOpen(!isVariablesSidebarOpen)}
          >
            Manage Variables
          </Button>
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
                {project.dimensions.map((dimension: any) => (
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
                  onClick={() => openCreateTrait()}
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
              {project.traits.map((trait: any) => (
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
                      onClick={() => openEditTrait(trait)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Conditionals Section */}
          {project.variables.filter((variable: any) => variable.is_conditional).length > 0 && (
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
                {project.variables.filter((variable: any) => variable.is_conditional).map((variable: any) => (
                  <div key={variable.id} className="group">
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
                        onClick={() => openEditVariable(variable)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
                      )}
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
          {/* Strings List - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
          {filteredStrings.length === 0 ? (
            <div className="text-muted-foreground text-center">
              {project.strings.length === 0 
                ? "No strings found in this project." 
                : "No strings match the current filters."
              }
            </div>
          ) : (
            <ul className="space-y-4">
              {filteredStrings.map((str: any) => (
                <Card 
                  key={str.id} 
                  className="p-4 flex flex-col gap-3 group cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => openEditString(str)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`font-medium text-base flex-1 ${isPlaintextMode ? 'leading-normal' : 'leading-loose'}`}>
                      {isPlaintextMode 
                        ? processStringContent(str.content, str.variables || [])
                        : renderStyledContent(str.content, str.variables || [], str.id)
                      }
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
                              openConvertStringDialog(str);
                            }}
                          >
                            Convert to string variable
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
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
                  
                  {/* Dimension Values */}
                  {showDimensions && str.dimension_values && str.dimension_values.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      {(() => {
                        // Group dimension values by dimension
                        const groupedDimensions: {[dimensionId: number]: {name: string, values: string[]}} = {};
                        
                        str.dimension_values.forEach((dv: any) => {
                          const dimension = project.dimensions?.find((d: any) => d.id === dv.dimension_value.dimension);
                          const dimensionId = dv.dimension_value.dimension;
                          
                          if (!groupedDimensions[dimensionId]) {
                            groupedDimensions[dimensionId] = {
                              name: dimension?.name || 'Unknown',
                              values: []
                            };
                          }
                          
                          groupedDimensions[dimensionId].values.push(dv.dimension_value.value);
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
      {/* Variables Management Sidebar (right) */}
      {isVariablesSidebarOpen && (
        <aside className="w-90 border-l bg-muted/40 flex flex-col">
          {/* Variables Header - Sticky */}
          <div className="flex items-center justify-between gap-4 border-b px-6 py-4 bg-background sticky top-0 z-10">
            <h2 className="text-lg font-semibold">Variables</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openCreateVariable}
                className="flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                New
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVariablesSidebarOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Variables Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
          {project.variables.length === 0 ? (
            <div className="text-muted-foreground text-sm">No variables found.</div>
          ) : (
            <ul className="space-y-2">
              {project.variables.map((variable: any) => (
                <Card 
                  key={variable.id} 
                  className="p-3 text-sm transition-colors cursor-pointer hover:bg-muted/50 group"
                  onClick={() => openEditVariable(variable)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span>{variable.name}</span>
                        <div className="flex gap-1 items-center">
                          {variable.variable_type === 'string' && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200 p-1">
                              <Spool className="h-3 w-3" />
                            </Badge>
                          )}
                          {variable.is_conditional && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 p-1">
                              <Signpost className="h-3 w-3" />
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 ml-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVariableFromCard(variable);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {(() => {
                        const currentValue = getVariableValueForCurrentTrait(variable);
                        if (currentValue) {
                          return (
                            <div className="text-xs text-muted-foreground mt-1 truncate">
                              {currentValue.length > 50 ? `${currentValue.substring(0, 50)}...` : currentValue}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </Card>
              ))}
            </ul>
          )}
        </div>
              </aside>
        )}
      </div>

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
              const referencingVariables = project.variables.filter((variable: any) => 
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

      {/* Convert String to Variable Dialog */}
      <Dialog open={!!convertStringDialog} onOpenChange={v => !v && closeConvertStringDialog()}>
        <DialogContent className="max-w-md">
          <DialogTitle>Convert to String Variable</DialogTitle>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Convert this string to a reusable string variable.
            </p>
            {convertStringDialog && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">String to convert:</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {convertStringDialog.content.length > 100 
                    ? `${convertStringDialog.content.substring(0, 100)}...` 
                    : convertStringDialog.content
                  }
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="convert-variable-name">Variable Name</Label>
              <Input
                id="convert-variable-name"
                value={convertVariableName}
                onChange={(e) => setConvertVariableName(e.target.value)}
                placeholder="Enter variable name (e.g., 'greeting', 'footer')"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This will be used as {`{{${convertVariableName || 'variableName'}}}`} in other strings.
              </p>
            </div>
            
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-xs text-yellow-800">
                <strong>Note:</strong> Converting will remove this string from the strings list and create a new string variable. This action cannot be undone.
              </p>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="secondary" onClick={closeConvertStringDialog}>
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleConvertString}
                disabled={!convertVariableName.trim()}
              >
                Convert to Variable
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
                   project.traits.find((t: any) => t.id.toString() === traitId)?.name || "None"}
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
                        const dimension = project.dimensions.find((d: any) => d.id.toString() === dimensionId);
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
                      const variable = project.variables.find((v: any) => v.id.toString() === varId);
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
                  No dimension or conditional filters applied. All {project.strings.length} strings will be exported.
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

      {/* Create/Edit String Dialog */}
      <Dialog open={createDialog === "String" || !!editingString} onOpenChange={v => !v && closeStringDialog()}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
          {/* Fixed Header with Tabs */}
          <DialogHeader className="px-6 py-4 border-b bg-background">
            <DialogTitle>{editingString ? "Edit String" : "New String"}</DialogTitle>
            <Tabs value={stringDialogTab} onValueChange={setStringDialogTab} className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
              </TabsList>
            </Tabs>
          </DialogHeader>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Tabs value={stringDialogTab} onValueChange={setStringDialogTab} className="w-full">
              <TabsContent value="content" className="mt-0">
                <form id="string-form" onSubmit={handleStringSubmit} className="space-y-4">
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
              {(() => {
                // Detect variables from current string content
                const variableMatches = stringContent.match(/{{([^}]+)}}/g) || [];
                const variableNames = variableMatches.map(match => match.slice(2, -2));
                const uniqueVariableNames = [...new Set(variableNames)];
                
                // Split into existing and new variables
                const existingVariables = project.variables.filter((variable: any) => 
                  uniqueVariableNames.includes(variable.name)
                );
                const existingVariableNames = existingVariables.map((v: any) => v.name);
                const newVariableNames = uniqueVariableNames.filter(name => 
                  !existingVariableNames.includes(name) && name.trim() !== ''
                );
                

                
                // Show new variables section if there are any
                const hasNewVariables = newVariableNames.length > 0;
                const hasExistingVariables = project.variables.length > 0;
                
                return (
                  <div className="space-y-3">
                    {hasNewVariables && (
                      <div>
                        <h4 className="text-sm font-medium text-blue-600 mb-2">New variables</h4>
                        <div className="flex flex-wrap gap-2">
                          {newVariableNames.map((variableName: string) => (
                            <Badge
                              key={variableName}
                              variant="outline"
                              className="cursor-pointer hover:bg-muted border-blue-200 bg-blue-50 text-blue-700"
                              onClick={() => insertVariable(variableName)}
                            >
                              {variableName}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          These variables will be created when you close this dialog.
                        </p>
                      </div>
                    )}
                    
                    {hasExistingVariables && (
                      <div>
                        {hasNewVariables && (
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">Existing variables</h4>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {project.variables.map((variable: any) => (
                            <Badge
                              key={variable.id}
                              variant="outline"
                              className="cursor-pointer hover:bg-muted"
                              onClick={() => insertVariable(variable.name)}
                            >
                              {variable.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {!hasExistingVariables && !hasNewVariables && (
                      <p className="text-sm text-muted-foreground">No variables available. Create some in the sidebar.</p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Dimension Values Section */}
                </form>
              </TabsContent>
              
              <TabsContent value="dimensions" className="mt-0">
                {project.dimensions && project.dimensions.length > 0 ? (
                  <div>
                    <h3 className="font-medium mb-2">Dimension Values</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Optional: Assign values for each dimension to categorize this string.
                    </p>
                    <div className="space-y-4">
                      {project.dimensions.map((dimension: any) => (
                        <div key={dimension.id} className="space-y-2">
                          <label className="text-sm font-medium">
                            {dimension.name}:
                          </label>
                          
                          {/* Selected dimension values as removable tags and add button */}
                          <div className="flex flex-wrap gap-2 items-center">
                            {stringDimensionValues[dimension.id] && stringDimensionValues[dimension.id].length > 0 && 
                              stringDimensionValues[dimension.id].map((value: string, index: number) => (
                                <div
                                  key={`${dimension.id}-${value}-${index}`}
                                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                                >
                                  <span>{value}</span>
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
                                </div>
                              ))
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
            </Tabs>
          </div>
          
          {/* Fixed Footer */}
          <DialogFooter className="px-6 py-4 border-t bg-background">
            <Button type="button" variant="secondary" onClick={closeStringDialog}>
              Cancel
            </Button>
            <Button type="submit" form="string-form">
              {editingString ? "Update" : "Create"} String
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Variable Dialog */}
      <Dialog open={createDialog === "Variable" || !!editingVariable} onOpenChange={v => !v && closeVariableDialog()}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0">
          {/* Fixed Header */}
          <DialogHeader className="px-6 py-4 border-b bg-background">
            <DialogTitle>{editingVariable ? "Edit Variable" : "New Variable"}</DialogTitle>
          </DialogHeader>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <form id="variable-form" onSubmit={handleVariableSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="variable-name">Variable Name</Label>
              <Input
                id="variable-name"
                value={variableName}
                onChange={(e) => setVariableName(e.target.value)}
                placeholder="Enter variable name (e.g., 'animal', 'color')"
                required
              />
              <p className="text-xs text-muted-foreground">
                This will be used as {`{{${variableName || 'variableName'}}}`} in strings.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="variable-type">Variable Type</Label>
              <Select value={variableType} onValueChange={(value: 'trait' | 'string') => setVariableType(value)}>
                <SelectTrigger id="variable-type">
                  <SelectValue placeholder="Select variable type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trait">Trait Variable</SelectItem>
                  <SelectItem value="string">String Variable</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {variableType === 'trait' 
                  ? 'Different values for each trait (default)'
                  : 'Contains its own string content with variables'
                }
              </p>
            </div>
            
            {variableType === 'string' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="variable-content">Content</Label>
                  <Textarea
                    id="variable-content"
                    ref={setVariableTextareaRef}
                    value={variableContent}
                    onChange={(e) => setVariableContent(e.target.value)}
                    placeholder="Enter string variable content. Click variables below to insert them."
                    rows={4}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Click variable badges below to insert them.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">Variables</h3>
                  {(() => {
                    // Detect variables from current variable content
                    const variableMatches = variableContent.match(/{{([^}]+)}}/g) || [];
                    const variableNames = variableMatches.map(match => match.slice(2, -2));
                    const uniqueVariableNames = [...new Set(variableNames)];
                    
                    // Split into existing and new variables
                    const existingVariables = project.variables.filter((variable: any) => 
                      uniqueVariableNames.includes(variable.name)
                    );
                    const existingVariableNames = existingVariables.map((v: any) => v.name);
                    const newVariableNames = uniqueVariableNames.filter(name => 
                      !existingVariableNames.includes(name) && name.trim() !== ''
                    );
                    
                    // Show new variables section if there are any
                    const hasNewVariables = newVariableNames.length > 0;
                    const hasExistingVariables = project.variables.length > 0;
                    
                    return (
                      <div className="space-y-3">
                        {hasNewVariables && (
                          <div>
                            <h4 className="text-sm font-medium text-blue-600 mb-2">New variables</h4>
                            <div className="flex flex-wrap gap-2">
                              {newVariableNames.map((variableName: string) => (
                                <Badge
                                  key={variableName}
                                  variant="outline"
                                  className="cursor-pointer hover:bg-muted border-blue-200 bg-blue-50 text-blue-700"
                                  onClick={() => {
                                    if (!variableTextareaRef) return;
                                    
                                    const cursorPosition = variableTextareaRef.selectionStart;
                                    const variableText = `{{${variableName}}}`;
                                    const newContent = 
                                      variableContent.substring(0, cursorPosition) + 
                                      variableText + 
                                      variableContent.substring(cursorPosition);
                                    
                                    setVariableContent(newContent);
                                    
                                    // Focus back to textarea and set cursor after inserted variable
                                    setTimeout(() => {
                                      if (variableTextareaRef) {
                                        variableTextareaRef.focus();
                                        variableTextareaRef.setSelectionRange(
                                          cursorPosition + variableText.length,
                                          cursorPosition + variableText.length
                                        );
                                      }
                                    }, 0);
                                  }}
                                >
                                  {variableName}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-xs text-blue-600 mt-1">
                              These variables will be created when you save this variable.
                            </p>
                          </div>
                        )}
                        
                        {hasExistingVariables && (
                          <div>
                            {hasNewVariables && (
                              <h4 className="text-sm font-medium text-muted-foreground mb-2">Existing variables</h4>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {project.variables.map((variable: any) => (
                                <Badge
                                  key={variable.id}
                                  variant="outline"
                                  className="cursor-pointer hover:bg-muted"
                                  onClick={() => {
                                    if (!variableTextareaRef) return;
                                    
                                    const cursorPosition = variableTextareaRef.selectionStart;
                                    const variableText = `{{${variable.name}}}`;
                                    const newContent = 
                                      variableContent.substring(0, cursorPosition) + 
                                      variableText + 
                                      variableContent.substring(cursorPosition);
                                    
                                    setVariableContent(newContent);
                                    
                                    // Focus back to textarea and set cursor after inserted variable
                                    setTimeout(() => {
                                      if (variableTextareaRef) {
                                        variableTextareaRef.focus();
                                        variableTextareaRef.setSelectionRange(
                                          cursorPosition + variableText.length,
                                          cursorPosition + variableText.length
                                        );
                                      }
                                    }, 0);
                                  }}
                                >
                                  {variable.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {!hasExistingVariables && !hasNewVariables && (
                          <p className="text-sm text-muted-foreground">No variables available. Create some in the sidebar.</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
            
            {variableType === 'trait' && project.traits && project.traits.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Values for Each Trait</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Optional: Set values for this variable for each trait. You can also do this later.
                </p>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {project.traits.map((trait: any) => (
                    <div key={trait.id} className="flex items-center gap-3">
                      <label className="text-sm font-medium min-w-0 flex-1 truncate">
                        {trait.name}:
                      </label>
                      <Input
                        value={variableValues[trait.id] || ""}
                        onChange={(e) => setVariableValues(prev => ({
                          ...prev,
                          [trait.id]: e.target.value
                        }))}
                        placeholder={`Value for ${trait.name}`}
                        className="flex-2 min-w-0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conditional Variable Option - at the end */}
            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isConditional"
                  checked={isConditional}
                  onChange={(e) => setIsConditional(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isConditional" className="text-sm font-medium">
                  Make this a conditional variable
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Conditional variables can be toggled on/off when viewing strings
              </p>
            </div>

            </form>
          </div>
          
          {/* Fixed Footer */}
          <DialogFooter className="px-6 py-4 border-t bg-background flex justify-between">
            <div />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={closeVariableDialog}>
                Cancel
              </Button>
              <Button type="submit" form="variable-form" disabled={!variableName.trim()}>
                {editingVariable ? "Update" : "Create"} Variable
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Trait Dialog */}
      <Dialog open={createDialog === "Trait" || !!editingTrait} onOpenChange={v => !v && closeTraitDialog()}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogTitle>{editingTrait ? "Edit Trait" : "New Trait"}</DialogTitle>
          <form onSubmit={handleTraitSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trait-name">Trait Name</Label>
              <Input
                id="trait-name"
                value={traitName}
                onChange={(e) => setTraitName(e.target.value)}
                placeholder="Enter trait name (e.g., 'Formal', 'Casual', 'Technical')"
                required
              />
              <p className="text-xs text-muted-foreground">
                This trait will be available in the trait selector.
              </p>
            </div>
            
            {project.variables && project.variables.filter((variable: any) => variable.variable_type === 'trait').length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Variable Values for This Trait</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Optional: Set how each variable should appear when this trait is selected.
                </p>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {project.variables.filter((variable: any) => variable.variable_type === 'trait').map((variable: any) => (
                    <div key={variable.id} className="flex items-center gap-3">
                      <label className="text-sm font-medium min-w-0 flex-1 truncate">
                        {variable.name}:
                      </label>
                      <Input
                        value={traitVariableValues[variable.id] || ""}
                        onChange={(e) => setTraitVariableValues(prev => ({
                          ...prev,
                          [variable.id]: e.target.value
                        }))}
                        placeholder={`Value for ${variable.name}`}
                        className="flex-2 min-w-0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="secondary" onClick={closeTraitDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={!traitName.trim()}>
                {editingTrait ? "Update" : "Create"} Trait
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dimension Dialog */}
      <Dialog open={createDialog === "Dimension" || !!editingDimension} onOpenChange={v => !v && closeDimensionDialog()}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0">
          {/* Fixed Header */}
          <DialogHeader className="px-6 py-4 border-b bg-background">
            <DialogTitle>{editingDimension ? "Edit Dimension" : "New Dimension"}</DialogTitle>
          </DialogHeader>
          
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
          <DialogFooter className="px-6 py-4 border-t bg-background">
            <Button type="button" variant="secondary" onClick={closeDimensionDialog}>
              Cancel
            </Button>
            <Button type="submit" form="dimension-form" disabled={!dimensionName.trim()}>
              {editingDimension ? "Update" : "Create"} Dimension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Other Items Dialog */}
      <Dialog open={!!createDialog && createDialog !== "String" && createDialog !== "Variable" && createDialog !== "Trait" && createDialog !== "Dimension"} onOpenChange={v => !v && setCreateDialog(null)}>
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
    </div>
  );
} 