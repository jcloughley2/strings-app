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
  includeHiddenOption?: boolean; // Deprecated - kept for interface compatibility
  
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
 * Note: Dimensions are now deprecated - we just save the conditional container and spawns,
 * and link spawns to the conditional via controlled_by_spawn_id
 */
async function saveConditionalVariable({
  stringData,
  content,
  variableName,
  displayName,
  projectId,
  conditionalSpawns,
  isNewString,
}: {
  stringData?: StringData | null;
  content: string;
  variableName?: string;
  displayName?: string;
  projectId: string | number;
  conditionalSpawns: any[];
  includeHiddenOption: boolean; // kept for interface compatibility but no longer used
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
  
  // 3. Save all spawns and link them to the conditional container
  const spawnPromises = conditionalSpawns.map(async (spawn) => {
    try {
      // If this is an existing variable being added as a spawn, just update its controlled_by_spawn_id
      if (spawn._isExisting) {
        console.log(`Using existing variable as spawn: ${spawn.effective_variable_name || spawn.variable_hash}`);
        // Update the spawn to be controlled by this conditional
        return await apiFetch(`/api/strings/${spawn.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            controlled_by_spawn_id: conditionalContainer.id,
          }),
        });
      }
      
      const spawnPayload = {
        content: spawn.content?.trim() || 'Default spawn content',
        display_name: spawn.display_name?.trim() || null,
        is_conditional: false,
        is_conditional_container: false,
        controlled_by_spawn_id: conditionalContainer.id, // Link spawn to conditional
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
        return spawn;
      } else {
        throw spawnError;
      }
    }
  });
  
  await Promise.all(spawnPromises);
  
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
