"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { Edit2, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const SIDEBAR_TABS = ["Variables", "Traits"];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState("Variables");
  const [traitId, setTraitId] = useState<string | null>("blank");
  const [selectedConditionalVariables, setSelectedConditionalVariables] = useState<string[]>([]);
  const [isPlaintext, setIsPlaintext] = useState(false);
  const [showStringVariables, setShowStringVariables] = useState(false);
  const [createDialog, setCreateDialog] = useState<null | "Variable" | "Trait" | "Conditional" | "String">(null);
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

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/projects/${id}/`)
      .then((data) => {
        setProject(data);
        // Keep traitId as "blank" by default, don't auto-select first trait
      })
      .catch((err) => setError(err.message || "Failed to load project"))
      .finally(() => setLoading(false));
  }, [id]);

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

  // Insert variable at cursor position
  const insertVariable = (variableName: string) => {
    if (!textareaRef) return;
    
    const cursorPosition = textareaRef.selectionStart;
    const variableText = `{{${variableName}}}`;
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
      setProject(updatedProject);
      
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
        setProject(updatedProject);
        
        closeVariableDialog();
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

   const handleVariableSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
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
       setProject(updatedProject);
       
       // Show success toast
       const action = editingVariable ? 'updated' : 'created';
       toast.success(`Variable "${variableName}" ${action} successfully!`);
       
       closeVariableDialog();
     } catch (err) {
       console.error('Failed to save variable:', err);
       const action = editingVariable ? 'update' : 'create';
       toast.error(`Failed to ${action} variable. Please try again.`);
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
       setProject(updatedProject);

       closeTraitDialog();
     } catch (err) {
       console.error('Failed to save trait:', err);
       toast.error('Failed to save trait');
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

      // Handle conversion to string variable if checkbox is checked (only in edit mode)
      if (editingString && createStringVariable && stringVariableName.trim()) {
        try {
          // Create the string variable with the content directly
          await apiFetch('/api/variables/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: stringVariableName.trim(),
              project: id,
              variable_type: 'string',
              content: stringContent, // Store content directly in the variable
            }),
          });
          
          // Delete the original string since it's now a variable
          await apiFetch(`/api/strings/${editingString.id}/`, {
            method: 'DELETE',
          });
          
          toast.success(`String converted to variable "${stringVariableName}" successfully!`);
        } catch (err) {
          console.error('Failed to convert to string variable:', err);
          toast.error('String updated but failed to convert to variable. Please try again.');
        }
      }

      // Refresh project data
      const updatedProject = await apiFetch(`/api/projects/${id}/`);
      setProject(updatedProject);
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
    
    if (isPlaintext) {
      // In plaintext mode, behavior depends on showStringVariables toggle and trait selection
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
      
      // Replace variables with their trait-specific values (plaintext)
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
              let value;
              
              if (projectVariable.variable_type === 'string') {
                // For string variables, behavior depends on showStringVariables toggle
                if (showStringVariables) {
                  // Show as variable badge - don't replace, leave as {{variableName}}
                  return; // Skip replacement
                } else {
                  // Show string content - get the variable content and process it recursively
                  if (projectVariable.content) {
                    value = processVariablesRecursively(projectVariable.content, depth + 1);
                  } else {
                    value = projectVariable.name;
                  }
                }
              } else {
                // For trait variables, use the trait-specific value
                const variableValue = projectVariable.values?.find(
                  (vv: any) => vv.trait === parseInt(traitId || "0")
                );
                value = variableValue?.value || projectVariable.name;
              }
              
              const regex = new RegExp(`{{${variableName}}}`, 'g');
              processedContent = processedContent.replace(regex, value);
            }
          });
          
          return processedContent;
        };
        
        processedContent = processVariablesRecursively(processedContent);
      }
      
      return processedContent;
    }
    
    // In styled mode, return JSX with badges
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
                onClick={() => {
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
                  onClick={() => {
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
          // For trait variables, show as colored badges
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
              onClick={() => openEditVariable(variable)}
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

  // Sidebar content
  let sidebarList = [];
  if (sidebarTab === "Variables") sidebarList = project.variables;
  if (sidebarTab === "Traits") sidebarList = project.traits;
  if (sidebarTab === "Conditionals") sidebarList = project.conditionals;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main Canvas */}
      <main className="flex-1 flex flex-col items-stretch min-w-0">
        <div className="flex items-center gap-4 border-b px-8 py-4 bg-background">
          <h1 className="text-2xl font-bold flex-1 truncate">{project.name}</h1>
          <Button onClick={openCreateString} size="sm">
            + New String
          </Button>
          {/* Trait Selector, Conditionals Selector, and Plaintext Switch */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Trait:</span>
              <Select value={traitId || "blank"} onValueChange={setTraitId}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select trait" />
                </SelectTrigger>
                <SelectContent>
                  {project.traits.map((trait: any) => (
                    <SelectItem key={trait.id} value={trait.id.toString()}>{trait.name}</SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value="blank">Blank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Conditionals:</span>
              <MultiSelect
                options={project.variables.filter((variable: any) => variable.is_conditional).map((variable: any) => ({
                  label: variable.name,
                  value: variable.id.toString(),
                }))}
                selected={selectedConditionalVariables}
                onChange={setSelectedConditionalVariables}
                placeholder="Select conditional variables..."
                className="w-48"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-string-variables"
                checked={showStringVariables}
                onCheckedChange={setShowStringVariables}
              />
              <Label htmlFor="show-string-variables" className="text-sm text-muted-foreground">
                Show String Variables
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="plaintext-mode"
                checked={isPlaintext}
                onCheckedChange={setIsPlaintext}
              />
              <Label htmlFor="plaintext-mode" className="text-sm text-muted-foreground">
                Plaintext
              </Label>
            </div>
          </div>
        </div>
        {/* Strings List */}
        <div className="flex-1 overflow-y-auto p-8">
          {project.strings.length === 0 ? (
            <div className="text-muted-foreground text-center">No strings found in this project.</div>
          ) : (
            <ul className="space-y-4">
              {project.strings.map((str: any) => (
                <Card key={str.id} className="p-4 flex flex-col gap-2 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-base flex-1">
                      {isPlaintext 
                        ? processStringContent(str.content, str.variables || [])
                        : renderStyledContent(str.content, str.variables || [], str.id)
                      }
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditString(str)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteStringDialog(str)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </ul>
          )}
        </div>
      </main>
      {/* Sidebar (now on the right) */}
      <aside className="w-72 border-l bg-muted/40 flex flex-col">
        <div className="flex gap-2 p-4 border-b">
          {SIDEBAR_TABS.map((tab) => (
            <Button
              key={tab}
              variant={sidebarTab === tab ? "secondary" : "ghost"}
              size="sm"
              className={`font-medium text-sm ${sidebarTab === tab ? "shadow" : ""}`}
              onClick={() => setSidebarTab(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {sidebarList.length === 0 ? (
            <div className="text-muted-foreground text-sm">No {sidebarTab.toLowerCase()} found.</div>
          ) : (
            <ul className="space-y-2">
              {sidebarList.map((item: any) => (
                <Card 
                  key={item.id} 
                  className="p-3 text-sm transition-colors cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    if (sidebarTab === "Variables") {
                      openEditVariable(item);
                    } else if (sidebarTab === "Traits") {
                      openEditTrait(item);
                    }
                    // Add other tab handlers here later
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span>{item.name || item.id}</span>
                    <div className="flex gap-1">
                      {sidebarTab === "Variables" && item.variable_type === 'string' && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                          String Ref
                        </Badge>
                      )}
                      {sidebarTab === "Variables" && item.is_conditional && (
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                          Conditional
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </ul>
          )}
        </div>
        <div className="p-4 border-t">
          <Button
            className="w-full"
            onClick={() => {
              if (sidebarTab === "Variables") {
                openCreateVariable();
              } else if (sidebarTab === "Traits") {
                openCreateTrait();
              } else {
                const typeMap = { Conditionals: "Conditional" } as const;
                setCreateDialog(typeMap[sidebarTab as keyof typeof typeMap]);
              }
            }}
          >
            + New {sidebarTab.slice(0, -1)}
          </Button>
        </div>
      </aside>
      {/* Create/Edit String Dialog */}
      <Dialog open={createDialog === "String" || !!editingString} onOpenChange={v => !v && closeStringDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>{editingString ? "Edit String" : "New String"}</DialogTitle>
          <form onSubmit={handleStringSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 font-medium">Content</label>
              <Textarea
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
              <p className="text-xs text-muted-foreground mt-1">
                Click variable badges below to insert them.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Variables</h3>
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

            
            {/* Convert to String Variable Section - Only in Edit Mode */}
            {editingString && (
              <div className="border-t pt-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="convertToStringVariable"
                    checked={createStringVariable}
                    onChange={(e) => setCreateStringVariable(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="convertToStringVariable" className="text-sm font-medium">
                    Convert this string to a string variable
                  </Label>
                </div>
                {createStringVariable && (
                  <div className="mt-3">
                    <Label htmlFor="stringVariableName" className="block text-sm font-medium mb-1">
                      Variable Name
                    </Label>
                    <Input
                      id="stringVariableName"
                      value={stringVariableName}
                      onChange={(e) => setStringVariableName(e.target.value)}
                      placeholder="Enter variable name (e.g., 'greeting', 'footer')"
                      required={createStringVariable}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This will be used as {`{{${stringVariableName || 'variableName'}}}`} in other strings.
                    </p>
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-xs text-yellow-800">
                        <strong>Note:</strong> Converting will remove this string from the strings list and create a new string variable. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="secondary" onClick={closeStringDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingString ? "Update" : "Create"} String
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Variable Dialog */}
      <Dialog open={createDialog === "Variable" || !!editingVariable} onOpenChange={v => !v && closeVariableDialog()}>
        <DialogContent className="max-w-lg">
          <DialogTitle>{editingVariable ? "Edit Variable" : "New Variable"}</DialogTitle>
          <form onSubmit={handleVariableSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 font-medium">Variable Name</label>
              <Input
                value={variableName}
                onChange={(e) => setVariableName(e.target.value)}
                placeholder="Enter variable name (e.g., 'animal', 'color')"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                This will be used as {`{{${variableName || 'variableName'}}}`} in strings.
              </p>
            </div>
            
            <div>
              <label className="block mb-2 font-medium">Variable Type</label>
              <Select value={variableType} onValueChange={(value: 'trait' | 'string') => setVariableType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select variable type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trait">Trait Variable</SelectItem>
                  <SelectItem value="string">String Variable</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {variableType === 'trait' 
                  ? 'Different values for each trait (default)'
                  : 'Contains its own string content with variables'
                }
              </p>
            </div>
            
            {variableType === 'string' && (
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 font-medium">Content</label>
                  <Textarea
                    ref={setVariableTextareaRef}
                    value={variableContent}
                    onChange={(e) => setVariableContent(e.target.value)}
                    placeholder="Enter string variable content. Click variables below to insert them."
                    rows={4}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
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

            <div className="flex justify-between items-center mt-6">
              {editingVariable ? (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDeleteVariable}
                  className="mr-auto"
                >
                  Delete Variable
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={closeVariableDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!variableName.trim()}>
                  {editingVariable ? "Update" : "Create"} Variable
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Trait Dialog */}
      <Dialog open={createDialog === "Trait" || !!editingTrait} onOpenChange={v => !v && closeTraitDialog()}>
        <DialogContent className="max-w-lg">
          <DialogTitle>{editingTrait ? "Edit Trait" : "New Trait"}</DialogTitle>
          <form onSubmit={handleTraitSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 font-medium">Trait Name</label>
              <Input
                value={traitName}
                onChange={(e) => setTraitName(e.target.value)}
                placeholder="Enter trait name (e.g., 'Formal', 'Casual', 'Technical')"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
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

      {/* Create Other Items Dialog */}
      <Dialog open={!!createDialog && createDialog !== "String" && createDialog !== "Variable" && createDialog !== "Trait"} onOpenChange={v => !v && setCreateDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>New {createDialog}</DialogTitle>
          <form className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">Name</label>
              <Input placeholder={`Enter ${createDialog?.toLowerCase()} name`} required />
            </div>
            {/* Add more fields as needed for each type */}
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="secondary" onClick={() => setCreateDialog(null)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
    </div>
  );
} 