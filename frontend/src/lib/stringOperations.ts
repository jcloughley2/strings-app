import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export interface StringData {
  id?: string | number;
  content: string;
  variable_name?: string | null;
  variable_hash?: string;
  display_name?: string | null;
  effective_variable_name?: string;
  is_conditional?: boolean;
  is_conditional_container?: boolean;
  project?: string | number;
  _isTemporary?: boolean;
  dimension_values?: any[];
}

export interface SaveStringOptions {
  // Core data
  stringData?: StringData | null; // null for new strings
  content: string;
  variableName?: string;
  displayName?: string;
  isConditional: boolean;
  projectId: string | number;
  
  // Conditional-specific
  conditionalSpawns?: any[];
  includeHiddenOption?: boolean;
  
  // Controlling condition
  controlledBySpawnId?: number | null;
  
  // Context
  project?: any;
  onProjectUpdate?: (project: any) => void;
  
  // Validation
  detectCircularReferences?: (content: string, stringId?: string | number) => string | null;
}

/**
 * Unified save function that handles all string/conditional operations
 * Replaces: handleStringSubmit, saveCascadingDrawer, handleNestedStringSubmit
 */
export async function saveString(options: SaveStringOptions): Promise<any> {
  const {
    stringData,
    content,
    variableName,
    displayName,
    isConditional,
    projectId,
    conditionalSpawns = [],
    includeHiddenOption = false,
    controlledBySpawnId,
    project,
    onProjectUpdate,
    detectCircularReferences,
  } = options;
  
  try {
    // 1. Validation
    if (detectCircularReferences) {
      const circularError = detectCircularReferences(content, stringData?.id);
      if (circularError) {
        throw new Error(circularError);
      }
    }
    
    // Provide default content for non-conditional strings if empty
    // Conditional containers don't need content, their spawns have content
    let processedContent = content;
    if (!isConditional && !content.trim()) {
      // Use display name or variable name as default content
      processedContent = displayName || variableName || 'New string content';
    }
    
    // 2. Determine if this is a new string
    const isNewString = !stringData || 
                       stringData._isTemporary || 
                       String(stringData.id).startsWith('temp-') || 
                       (typeof stringData.id === 'number' && stringData.id > 1000000000000);
    
    // 3. Handle Conditional vs String logic
    if (isConditional) {
      return await saveConditionalVariable({
        stringData,
        content: processedContent,
        variableName,
        displayName,
        projectId,
        conditionalSpawns,
        includeHiddenOption,
        project,
        onProjectUpdate,
        isNewString,
      });
    } else {
      return await saveStringVariable({
        stringData,
        content: processedContent,
        variableName,
        displayName,
        projectId,
        controlledBySpawnId,
        isNewString,
      });
    }
  } catch (error: any) {
    console.error('Save failed:', error);
    throw error;
  }
}

/**
 * Save a regular string variable
 */
async function saveStringVariable({
  stringData,
  content,
  variableName,
  displayName,
  projectId,
  controlledBySpawnId,
  isNewString,
}: {
  stringData?: StringData | null;
  content: string;
  variableName?: string;
  displayName?: string;
  projectId: string | number;
  controlledBySpawnId?: number | null;
  isNewString: boolean;
}): Promise<any> {
  
  const payload = {
    content: content.trim(),
    display_name: displayName?.trim() || null,
    is_conditional: false,
    is_conditional_container: false,
    controlled_by_spawn_id: controlledBySpawnId || null,
    project: projectId,
  };
  
  let response;
  
  if (isNewString) {
    // Create new string
    response = await apiFetch('/api/strings/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    toast.success('String created successfully!');
  } else {
    // Update existing string
    response = await apiFetch(`/api/strings/${stringData!.id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    toast.success('String updated successfully!');
  }
  
  return response;
}

/**
 * Save a conditional variable with spawns
 */
async function saveConditionalVariable({
  stringData,
  content,
  variableName,
  displayName,
  projectId,
  conditionalSpawns,
  includeHiddenOption,
  project,
  onProjectUpdate,
  isNewString,
}: {
  stringData?: StringData | null;
  content: string;
  variableName?: string;
  displayName?: string;
  projectId: string | number;
  conditionalSpawns: any[];
  includeHiddenOption: boolean;
  project?: any;
  onProjectUpdate?: (project: any) => void;
  isNewString: boolean;
}): Promise<any> {
  
  // 1. Validate spawns (allow empty conditionals)
  
  const emptySpawns = conditionalSpawns.filter(spawn => !spawn.content?.trim());
  if (emptySpawns.length > 0) {
    throw new Error(`All spawns must have content. ${emptySpawns.length} spawn(s) are empty.`);
  }
  
  // 2. Create/update the conditional container
  const containerPayload = {
    content: content.trim(),
    display_name: displayName?.trim() || null,
    is_conditional: true,
    is_conditional_container: true,
    project: projectId,
  };
  
  let conditionalContainer;
  
  if (isNewString) {
    conditionalContainer = await apiFetch('/api/strings/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerPayload),
    });
  } else {
    conditionalContainer = await apiFetch(`/api/strings/${stringData!.id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerPayload),
    });
  }
  
  const conditionalName = conditionalContainer.effective_variable_name || conditionalContainer.variable_hash;
  
  // 3. Ensure dimension exists
  let conditionalDimension = project?.dimensions?.find((d: any) => d.name === conditionalName);
  
  if (!conditionalDimension) {
    try {
      await apiFetch('/api/dimensions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: conditionalName,
          project: projectId,
        }),
      });
      
      // Refresh project to get the dimension
      const updatedProject = await apiFetch(`/api/projects/${projectId}/`);
      conditionalDimension = updatedProject.dimensions?.find((d: any) => d.name === conditionalName);
      if (onProjectUpdate) onProjectUpdate(updatedProject);
    } catch (error: any) {
      
      // If dimension already exists, try to get updated project data
      const errorStr = error.message || JSON.stringify(error) || String(error);
      if (errorStr.includes('unique set') || errorStr.includes('must make a unique set')) {
        console.log('Dimension already exists, refreshing project data...');
        try {
          const updatedProject = await apiFetch(`/api/projects/${projectId}/`);
          conditionalDimension = updatedProject.dimensions?.find((d: any) => d.name === conditionalName);
          if (onProjectUpdate) onProjectUpdate(updatedProject);
        } catch (refreshError) {
          console.error('Failed to refresh project after dimension error:', refreshError);
        }
      } else {
        // Re-throw other errors
        throw error;
      }
    }
  }
  
  // 4. Save all spawns
  const spawnPromises = conditionalSpawns.map(async (spawn) => {
    try {
      // If this is an existing variable being added as a spawn, don't modify the variable itself
      // Just return it as-is since we only need to create the dimension value
      if (spawn._isExisting) {
        console.log(`Using existing variable as spawn: ${spawn.effective_variable_name || spawn.variable_hash}`);
        return spawn; // Return the existing variable unchanged
      }
      
      const spawnPayload = {
        content: spawn.content?.trim() || 'Default spawn content',
        display_name: spawn.display_name?.trim() || null,
        is_conditional: false,
        is_conditional_container: false,
        project: projectId,
      };
      
      const isNewSpawn = spawn._isTemporary || 
                        String(spawn.id).startsWith('temp-') || 
                        (typeof spawn.id === 'number' && spawn.id > 1000000000000);
      
      if (isNewSpawn) {
        return await apiFetch('/api/strings/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(spawnPayload),
        });
      } else {
        return await apiFetch(`/api/strings/${spawn.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(spawnPayload),
        });
      }
    } catch (spawnError: any) {
      const errorStr = spawnError.message || JSON.stringify(spawnError) || String(spawnError);
      if (errorStr.includes('unique set') || errorStr.includes('must make a unique set')) {
        console.log(`Spawn with variable name "${spawn.variable_name}" may already exist, continuing...`);
        // Try to find existing spawn and return it
        return spawn;
      } else {
        throw spawnError;
      }
    }
  });
  
  const savedSpawns = await Promise.all(spawnPromises);
  
  // 5. Handle hidden option
  if (conditionalDimension) {
    await handleHiddenOption(conditionalDimension, includeHiddenOption);
  }
  
  // 6. Sync dimension values for spawns (create new ones, remove orphaned ones)
  if (conditionalDimension) {
    await syncDimensionValuesForSpawns(conditionalDimension, savedSpawns, conditionalName);
  }
  
  toast.success(isNewString ? 'Conditional variable created successfully!' : 'Conditional variable updated successfully!');
  
  return conditionalContainer;
}

/**
 * Handle the "Hidden" dimension value creation/removal
 */
async function handleHiddenOption(dimension: any, includeHiddenOption: boolean): Promise<void> {
  try {
    const existingHiddenValue = dimension.values?.find((v: any) => v.value === "Hidden");
    
    if (includeHiddenOption) {
      // Create "Hidden" dimension value if checkbox is checked
      if (!existingHiddenValue) {
        try {
          await apiFetch('/api/dimension-values/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dimension: dimension.id,
              value: "Hidden",
            }),
          });
          console.log('Created "Hidden" dimension value');
        } catch (hiddenError: any) {
          // If "Hidden" value already exists, just continue - it's not critical
          const errorStr = hiddenError.message || JSON.stringify(hiddenError) || String(hiddenError);
          if (errorStr.includes('unique set') || errorStr.includes('must make a unique set')) {
            console.log('"Hidden" dimension value already exists, continuing...');
          } else {
            console.error('Failed to create "Hidden" dimension value:', hiddenError);
          }
        }
      }
    } else {
      // Remove "Hidden" dimension value if checkbox is unchecked
      if (existingHiddenValue) {
        try {
          await apiFetch(`/api/dimension-values/${existingHiddenValue.id}/`, {
            method: 'DELETE',
          });
          console.log('Removed "Hidden" dimension value');
        } catch (deleteError: any) {
          // Handle "Not found" errors gracefully - backend may have already removed it
          const errorStr = deleteError.message || String(deleteError);
          if (errorStr.includes('Not found') || errorStr.includes('404')) {
            console.log('"Hidden" dimension value already removed, continuing...');
          } else {
            console.error('Failed to delete "Hidden" dimension value:', deleteError);
            throw deleteError;
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to handle "Hidden" dimension value:', error);
    // Don't fail the whole operation for this
  }
}

/**
 * Sync dimension values for spawn strings - create new ones and remove orphaned ones
 */
async function syncDimensionValuesForSpawns(dimension: any, spawns: any[], conditionalName: string): Promise<void> {
  // Get current spawn names
  const currentSpawnNames = spawns.map(spawn => spawn.effective_variable_name || spawn.variable_hash);
  
  // Get existing dimension values for this dimension (excluding "Hidden")
  const existingDimensionValues = dimension.values?.filter((dv: any) => dv.value !== "Hidden") || [];
  
  console.log(`Syncing dimension values for ${conditionalName}:`, {
    currentSpawns: currentSpawnNames,
    existingValues: existingDimensionValues.map((dv: any) => dv.value)
  });
  
  // 1. Remove dimension values that are no longer in the spawn list
  for (const existingValue of existingDimensionValues) {
    if (!currentSpawnNames.includes(existingValue.value)) {
      try {
        console.log(`Removing orphaned dimension value: ${existingValue.value}`);
        await apiFetch(`/api/dimension-values/${existingValue.id}/`, {
          method: 'DELETE',
        });
      } catch (deleteError: any) {
        const errorStr = deleteError.message || JSON.stringify(deleteError) || String(deleteError);
        // If "Not found", it means backend already updated/removed it (e.g., via signal handler)
        if (errorStr.includes('Not found') || errorStr.includes('not found') || errorStr.includes('404')) {
          console.log(`Dimension value ${existingValue.value} already removed by backend, continuing...`);
        } else {
          console.error(`Failed to delete dimension value ${existingValue.value}:`, deleteError);
        }
        // Don't fail the whole operation for cleanup errors
      }
    }
  }
  
  // 2. Create dimension values for new spawns
  for (const spawn of spawns) {
    const spawnName = spawn.effective_variable_name || spawn.variable_hash;
    
    if (!spawnName) {
      console.error('Spawn has no effective_variable_name or variable_hash, skipping:', spawn);
      continue;
    }
    
    try {
      // Check if dimension value already exists
      let dimensionValue = existingDimensionValues.find((dv: any) => dv.value === spawnName);
      
      if (!dimensionValue) {
        // Create new dimension value
        try {
          console.log(`Creating new dimension value: ${spawnName}`);
          dimensionValue = await apiFetch('/api/dimension-values/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dimension: dimension.id,
              value: spawnName,
            }),
          });
        } catch (dvError: any) {
          // If dimension value already exists, just continue
          const errorStr = dvError.message || JSON.stringify(dvError) || String(dvError);
          if (errorStr.includes('unique set') || errorStr.includes('must make a unique set')) {
            console.log(`Dimension value "${spawnName}" already exists, continuing...`);
            continue;
          } else {
            console.error(`Failed to create dimension value for ${spawnName}:`, dvError);
            continue; // Don't fail the whole operation
          }
        }
      }
      
      // Link spawn to dimension value
      try {
        await apiFetch('/api/string-dimension-values/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            string: spawn.id,
            dimension_value: dimensionValue.id,
          }),
        });
      } catch (linkError: any) {
        // If it's a unique constraint error, the relationship already exists
        const errorStr = linkError.message || JSON.stringify(linkError) || String(linkError);
        if (errorStr.includes('unique set') || errorStr.includes('must make a unique set')) {
          console.log(`StringDimensionValue relationship already exists for spawn ${spawnName}`);
        } else {
          console.error(`Failed to link spawn ${spawnName}:`, linkError);
        }
      }
      
    } catch (error: any) {
      console.error('Failed to process spawn:', spawnName, error);
      // Continue with other spawns even if one fails
    }
  }
}

/**
 * Helper function to detect circular references
 */
export function detectCircularReferences(
  content: string, 
  currentStringId?: string | number, 
  strings?: any[], 
  visited = new Set<string | number>()
): string | null {
  if (!strings || !currentStringId) return null;
  
  // Add current string to visited set
  if (currentStringId) visited.add(currentStringId);
  
  // Extract variable names from content
  const variableMatches = content.match(/{{([^}]+)}}/g) || [];
  const variableNames = variableMatches.map(match => match.slice(2, -2));
  
  for (const variableName of variableNames) {
    // Find the referenced string
    const referencedString = strings.find((str: any) => {
      const effectiveName = str.effective_variable_name || str.variable_name || str.variable_hash;
      return effectiveName === variableName;
    });
    
    if (referencedString) {
      // Check if this would create a circular reference
      if (visited.has(referencedString.id)) {
        return `Circular reference detected: {{${variableName}}}`;
      }
      
      // Recursively check the referenced string's content
      const nestedError = detectCircularReferences(
        referencedString.content || '', 
        referencedString.id, 
        strings, 
        new Set(visited)
      );
      
      if (nestedError) return nestedError;
    }
  }
  
  return null;
}
