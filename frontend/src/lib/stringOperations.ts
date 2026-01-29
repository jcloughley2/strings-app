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
  variableName?: string; // Deprecated - kept for interface compatibility
  variableHash?: string; // Editable hash identifier
  isConditional: boolean;
  projectId: string | number;
  
  // Conditional-specific
  conditionalSpawns?: any[];
  includeHiddenOption?: boolean; // Deprecated - kept for interface compatibility
  
  // Controlling condition
  controlledBySpawnId?: number | null;
  
  // Publishing
  isPublished?: boolean;
  
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
    variableHash,
    isConditional,
    projectId,
    conditionalSpawns = [],
    includeHiddenOption = false,
    controlledBySpawnId,
    isPublished = false,
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
      processedContent = 'New string content';
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
        variableHash,
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
        variableHash,
        projectId,
        controlledBySpawnId,
        isPublished,
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
  variableHash,
  projectId,
  controlledBySpawnId,
  isPublished,
  isNewString,
}: {
  stringData?: StringData | null;
  content: string;
  variableHash?: string;
  projectId: string | number;
  controlledBySpawnId?: number | null;
  isPublished?: boolean;
  isNewString: boolean;
}): Promise<any> {
  
  const payload: any = {
    content: content.trim(),
    is_conditional: false,
    is_conditional_container: false,
    controlled_by_spawn_id: controlledBySpawnId || null,
    is_published: isPublished || false,
    project: projectId,
  };
  
  // Only include variable_hash if explicitly provided (for editing)
  if (variableHash?.trim()) {
    payload.variable_hash = variableHash.trim();
  }
  
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
 * Creates/updates the dimension and dimension values to link spawns to the conditional
 */
async function saveConditionalVariable({
  stringData,
  content,
  variableHash,
  projectId,
  conditionalSpawns,
  includeHiddenOption,
  isNewString,
  project,
}: {
  stringData?: StringData | null;
  content: string;
  variableHash?: string;
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
  const containerPayload: any = {
    content: content.trim(),
    is_conditional: true,
    is_conditional_container: true,
    project: projectId,
  };
  
  // Only include variable_hash if explicitly provided (for editing)
  if (variableHash?.trim()) {
    containerPayload.variable_hash = variableHash.trim();
  }
  
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
  
  // 3. Get the effective variable name for the conditional (needed for dimension name)
  const conditionalName = conditionalContainer.effective_variable_name || conditionalContainer.variable_hash;
  
  // 4. Create or find the dimension for this conditional
  let dimension = project?.dimensions?.find((d: any) => d.name === conditionalName);
  
  if (!dimension) {
    try {
      // Create a new dimension
      dimension = await apiFetch('/api/dimensions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: conditionalName,
          project: projectId,
        }),
      });
    } catch (dimError: any) {
      // If dimension already exists (unique constraint), fetch it from the server
      const errorStr = dimError.message || String(dimError);
      if (errorStr.includes('unique') || errorStr.includes('already exists') || errorStr.includes('must make a unique set')) {
        console.log(`Dimension "${conditionalName}" already exists, fetching from server...`);
        // Fetch the project to get the existing dimension
        const updatedProject = await apiFetch(`/api/projects/${projectId}/`);
        dimension = updatedProject?.dimensions?.find((d: any) => d.name === conditionalName);
        if (!dimension) {
          throw new Error(`Could not find or create dimension "${conditionalName}"`);
        }
      } else {
        throw dimError;
      }
    }
  }
  
  // 5. Save all spawns sequentially to avoid race conditions with unique slug generation
  // (Using Promise.all would cause multiple spawns to check for the same slug simultaneously)
  const savedSpawns: any[] = [];
  for (const spawn of conditionalSpawns) {
    try {
      let savedSpawn;
      
      // If this is an existing variable being added as a spawn, just use it
      if (spawn._isExisting) {
        console.log(`Using existing variable as spawn: ${spawn.effective_variable_name || spawn.variable_hash}`);
        savedSpawn = spawn;
      } else {
        const spawnPayload: any = {
          content: spawn.content?.trim() || 'Default spawn content',
          is_conditional: false,
          is_conditional_container: false,
          project: projectId,
        };
        
        // Include variable_hash if spawn has one (for editing existing spawns)
        if (spawn.variable_hash?.trim()) {
          spawnPayload.variable_hash = spawn.variable_hash.trim();
        }
        
        const isNewSpawn = spawn._isTemporary || 
                          String(spawn.id).startsWith('temp-') || 
                          (typeof spawn.id === 'number' && spawn.id > 1000000000000);
        
        if (isNewSpawn) {
          savedSpawn = await apiFetch('/api/strings/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(spawnPayload),
          });
        } else {
          savedSpawn = await apiFetch(`/api/strings/${spawn.id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(spawnPayload),
          });
        }
      }
      
      savedSpawns.push(savedSpawn);
    } catch (spawnError: any) {
      const errorStr = spawnError.message || JSON.stringify(spawnError) || String(spawnError);
      if (errorStr.includes('unique set') || errorStr.includes('must make a unique set')) {
        console.log(`Spawn with variable name "${spawn.variable_name}" may already exist, continuing...`);
        savedSpawns.push(spawn);
      } else {
        throw spawnError;
      }
    }
  }
  
  // 6. Create dimension values and link spawns to them
  for (const savedSpawn of savedSpawns) {
    const spawnName = savedSpawn.effective_variable_name || savedSpawn.variable_name || savedSpawn.variable_hash;
    
    // Check if dimension value already exists
    let dimensionValue = dimension.values?.find((dv: any) => dv.value === spawnName);
    
    if (!dimensionValue) {
      // Create a new dimension value
      dimensionValue = await apiFetch('/api/dimension-values/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimension: dimension.id,
          value: spawnName,
        }),
      });
    }
    
    // Link the spawn to the dimension value via StringDimensionValue
    // First check if the link already exists
    const existingLinks = savedSpawn.dimension_values || [];
    const linkExists = existingLinks.some((dv: any) => 
      dv.dimension_value === dimensionValue.id || 
      dv.dimension_value_detail?.id === dimensionValue.id
    );
    
    if (!linkExists) {
      try {
        await apiFetch('/api/string-dimension-values/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            string: savedSpawn.id,
            dimension_value: dimensionValue.id,
          }),
        });
      } catch (linkError: any) {
        // Ignore duplicate link errors
        const errorStr = linkError.message || String(linkError);
        if (!errorStr.includes('unique') && !errorStr.includes('already exists')) {
          console.error('Failed to create string-dimension-value link:', linkError);
        }
      }
    }
  }
  
  // 7. Handle the "Hidden" option
  // Refetch the dimension to get the latest values (including any just created)
  const updatedProject = await apiFetch(`/api/projects/${projectId}/`);
  const updatedDimension = updatedProject?.dimensions?.find((d: any) => d.name === conditionalName);
  const hiddenDimensionValue = updatedDimension?.values?.find((dv: any) => dv.value === "Hidden");
  
  if (includeHiddenOption) {
    // Create "Hidden" dimension value if it doesn't exist
    if (!hiddenDimensionValue) {
      try {
        await apiFetch('/api/dimension-values/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dimension: updatedDimension?.id || dimension.id,
            value: "Hidden",
          }),
        });
        console.log('Created "Hidden" dimension value');
      } catch (hiddenError: any) {
        const errorStr = hiddenError.message || String(hiddenError);
        if (!errorStr.includes('unique') && !errorStr.includes('already exists')) {
          console.error('Failed to create Hidden dimension value:', hiddenError);
        }
      }
    }
  } else {
    // Remove "Hidden" dimension value if it exists
    if (hiddenDimensionValue) {
      try {
        await apiFetch(`/api/dimension-values/${hiddenDimensionValue.id}/`, {
          method: 'DELETE',
        });
        console.log('Removed "Hidden" dimension value');
      } catch (deleteError: any) {
        const errorStr = deleteError.message || String(deleteError);
        if (!errorStr.includes('Not found') && !errorStr.includes('404')) {
          console.error('Failed to delete Hidden dimension value:', deleteError);
        }
      }
    }
  }
  
  toast.success(isNewString ? 'Conditional variable created successfully!' : 'Conditional variable updated successfully!');
  
  return conditionalContainer;
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
