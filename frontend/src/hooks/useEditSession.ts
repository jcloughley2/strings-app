import { useState, useCallback } from 'react';
import { saveString } from '@/lib/stringOperations';
import { apiFetch } from '@/lib/api';

// Represents the edits for a single variable in the session
export interface VariableEditState {
  // Original data (null for new variables)
  originalData: any | null;
  
  // Current edited values
  content: string;
  displayName: string;
  isConditional: boolean;
  conditionalSpawns: any[];
  includeHiddenOption: boolean;
  controlledBySpawnId: number | null;
  embeddedVariableEdits: {[variableId: string]: {display_name?: string}};
  isPublished: boolean;
  
  // Metadata
  isNew: boolean;
  isDirty: boolean;
}

export interface EditSessionState {
  // All variables being edited in this session
  edits: Map<string, VariableEditState>;
  
  // Currently active variable ID
  activeVariableId: string | null;
  
  // Session metadata
  isOpen: boolean;
  isSaving: boolean;
  error: string | null;
}

export interface UseEditSessionOptions {
  project: any;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function useEditSession({ project, onSuccess, onCancel }: UseEditSessionOptions) {
  const [session, setSession] = useState<EditSessionState>({
    edits: new Map(),
    activeVariableId: null,
    isOpen: false,
    isSaving: false,
    error: null,
  });

  // Helper to create initial edit state from variable data
  const createEditState = useCallback((variableData: any | null, isNew: boolean = false): VariableEditState => {
    if (isNew) {
      // New variable - empty state
      return {
        originalData: null,
        content: '',
        displayName: '',
        isConditional: false,
        conditionalSpawns: [],
        includeHiddenOption: false,
        controlledBySpawnId: null,
        embeddedVariableEdits: {},
        isPublished: false,
        isNew: true,
        isDirty: false,
      };
    }

    // Existing variable - populate from data
    const conditionalName = variableData?.effective_variable_name || variableData?.variable_hash;
    const dimension = project?.dimensions?.find((d: any) => d.name === conditionalName);
    
    // Find spawns using dimension values (matching the working findSpawnsForConditional logic)
    let spawns: any[] = [];
    if (variableData?.is_conditional_container && dimension && dimension.values) {
      // Get all spawn variable names from dimension values (excluding "Hidden")
      const spawnVariableNames = dimension.values
        .filter((dv: any) => dv.value !== "Hidden")
        .map((dv: any) => dv.value);
      
      // Find all strings that match these spawn variable names
      spawns = (project?.strings || []).filter((s: any) => {
        const effectiveName = s.effective_variable_name || s.variable_hash;
        return spawnVariableNames.includes(effectiveName);
      });
    }

    const hasHiddenOption = dimension?.values?.some((dv: any) => dv.value === "Hidden") || false;

    return {
      originalData: variableData,
      content: variableData?.content || '',
      displayName: variableData?.display_name || '',
      isConditional: variableData?.is_conditional_container || false,
      conditionalSpawns: spawns,
      includeHiddenOption: hasHiddenOption,
      controlledBySpawnId: variableData?.controlled_by_spawn_id || null,
      embeddedVariableEdits: {},
      isPublished: variableData?.is_published || false,
      isNew: false,
      isDirty: false,
    };
  }, [project]);

  // Open session for creating a new variable
  const openCreateSession = useCallback(() => {
    const tempId = `new-${Date.now()}`;
    const newEdits = new Map<string, VariableEditState>();
    newEdits.set(tempId, createEditState(null, true));

    setSession({
      edits: newEdits,
      activeVariableId: tempId,
      isOpen: true,
      isSaving: false,
      error: null,
    });
  }, [createEditState]);

  // Open session for editing an existing variable
  const openEditSession = useCallback((variableData: any) => {
    const variableId = variableData.id.toString();
    const newEdits = new Map<string, VariableEditState>();
    newEdits.set(variableId, createEditState(variableData, false));

    setSession({
      edits: newEdits,
      activeVariableId: variableId,
      isOpen: true,
      isSaving: false,
      error: null,
    });
  }, [createEditState]);

  // Navigate to a different variable (load if not in session yet)
  const navigateToVariable = useCallback((variableId: string) => {
    setSession(prev => {
      const newEdits = new Map(prev.edits);

      // If variable not in session, add it
      if (!newEdits.has(variableId)) {
        // Check if this is a pending embedded variable
        if (variableId.startsWith('pending-')) {
          // Extract the variable name from the ID
          const varName = variableId.replace('pending-', '');
          
          // Create a new pending variable
          const pendingVariable = createEditState(null, true);
          pendingVariable.displayName = varName;
          
          newEdits.set(variableId, pendingVariable);
        } 
        // Check if this is a temporary spawn variable
        else if (variableId.startsWith('temp-')) {
          // Find the spawn in any parent's conditionalSpawns array
          let spawnData: any = null;
          
          // Search through all variables in the session for this spawn
          prev.edits.forEach((edit) => {
            if (edit.conditionalSpawns && edit.conditionalSpawns.length > 0) {
              const spawn = edit.conditionalSpawns.find((s: any) => 
                (s.id && s.id.toString() === variableId) || 
                (s.id === variableId)
              );
              if (spawn) {
                spawnData = spawn;
              }
            }
          });
          
          if (spawnData) {
            // Create an edit state for this spawn
            const spawnEdit = createEditState(null, true);
            spawnEdit.content = spawnData.content || '';
            spawnEdit.displayName = spawnData.display_name || '';
            spawnEdit.isConditional = spawnData.is_conditional_container || false;
            
            newEdits.set(variableId, spawnEdit);
          } else {
            console.error('Spawn variable not found:', variableId);
            return prev;
          }
        } 
        else {
          // Find the variable in project
          const variableData = project?.strings?.find((s: any) => s.id.toString() === variableId);
          if (variableData) {
            newEdits.set(variableId, createEditState(variableData, false));
          } else {
            console.error('Variable not found:', variableId);
            return prev;
          }
        }
      }

      // Ensure all variables in the session are also in newEdits
      // This keeps parent variables visible when navigating to children
      prev.edits.forEach((edit, id) => {
        if (!newEdits.has(id)) {
          newEdits.set(id, edit);
        }
      });

      return {
        ...prev,
        edits: newEdits,
        activeVariableId: variableId,
      };
    });
  }, [project, createEditState]);

  // Update the active variable's edit state
  const updateActiveVariable = useCallback((updates: Partial<VariableEditState>) => {
    setSession(prev => {
      if (!prev.activeVariableId) return prev;

      const currentEdit = prev.edits.get(prev.activeVariableId);
      if (!currentEdit) return prev;

      const newEdits = new Map(prev.edits);
      newEdits.set(prev.activeVariableId, {
        ...currentEdit,
        ...updates,
        isDirty: true,
      });

      return {
        ...prev,
        edits: newEdits,
      };
    });
  }, []);

  // Get the current active variable's edit state
  const getActiveEdit = useCallback((): VariableEditState | null => {
    if (!session.activeVariableId) return null;
    return session.edits.get(session.activeVariableId) || null;
  }, [session.activeVariableId, session.edits]);

  // Check if session has any unsaved changes
  const isDirty = useCallback((): boolean => {
    for (const edit of session.edits.values()) {
      if (edit.isDirty) return true;
    }
    return false;
  }, [session.edits]);

  // Helper to sync spawn edits back to their parent's conditionalSpawns array
  const syncSpawnEditsToParent = useCallback((edits: Map<string, VariableEditState>) => {
    const updatedEdits = new Map(edits);
    
    // For each variable in the session
    updatedEdits.forEach((edit, parentId) => {
      if (edit.conditionalSpawns && edit.conditionalSpawns.length > 0) {
        // For each spawn, check if there's a separate edit for it
        const updatedSpawns = edit.conditionalSpawns.map((spawn: any) => {
          const spawnId = spawn.id ? spawn.id.toString() : `temp-${spawn.variable_name || spawn.display_name}`;
          const spawnEdit = updatedEdits.get(spawnId);
          
          // If we have edits for this spawn, merge them
          if (spawnEdit) {
            return {
              ...spawn,
              content: spawnEdit.content,
              display_name: spawnEdit.displayName,
              is_conditional_container: spawnEdit.isConditional,
            };
          }
          
          return spawn;
        });
        
        // Update the parent's conditionalSpawns with the merged data
        updatedEdits.set(parentId, {
          ...edit,
          conditionalSpawns: updatedSpawns,
        });
      }
    });
    
    return updatedEdits;
  }, []);

  // Save all changes in the session
  const saveAll = useCallback(async () => {
    setSession(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      // Sync spawn edits back to parent conditionalSpawns arrays
      const syncedEdits = syncSpawnEditsToParent(session.edits);
      
      // Convert Map to array for iteration
      const editsArray = Array.from(syncedEdits.entries());

      // Build a set of spawn IDs that are part of a parent's conditionalSpawns
      // These should NOT be saved independently - they'll be saved with their parent
      const spawnIdsInParents = new Set<string>();
      editsArray.forEach(([id, edit]) => {
        if (edit.conditionalSpawns && edit.conditionalSpawns.length > 0) {
          edit.conditionalSpawns.forEach((spawn: any) => {
            const spawnId = spawn.id ? spawn.id.toString() : `temp-${spawn.variable_name || spawn.display_name}`;
            spawnIdsInParents.add(spawnId);
          });
        }
      });

      // Separate new variables from existing ones
      // New variables need to be created first so they can be referenced
      // EXCLUDE spawns that are part of a parent's conditionalSpawns - they'll be saved with the parent
      const newVariables = editsArray.filter(([id, edit]) => 
        edit.isNew && edit.isDirty && !spawnIdsInParents.has(id)
      );
      const existingVariables = editsArray.filter(([id, edit]) => 
        !edit.isNew && edit.isDirty && !spawnIdsInParents.has(id)
      );

      // Save new variables first
      for (const [variableId, edit] of newVariables) {
        // Ensure all spawns have content (provide default if empty)
        const spawnsWithContent = edit.conditionalSpawns.map((spawn: any) => ({
          ...spawn,
          content: spawn.content?.trim() || `Content for ${spawn.display_name || spawn.variable_name || 'spawn'}`,
        }));
        
        const saveOptions = {
          projectId: project.id,
          stringId: undefined,
          content: edit.content || `Content for ${edit.displayName || 'new variable'}`,
          displayName: edit.displayName,
          isConditional: edit.isConditional,
          isConditionalContainer: edit.isConditional,
          conditionalSpawns: spawnsWithContent,
          includeHiddenOption: edit.includeHiddenOption,
          controlledBySpawnId: edit.controlledBySpawnId,
          isPublished: edit.isPublished,
          embeddedVariableEdits: {},
          pendingVariableContent: {},
        };

        await saveString(saveOptions);
      }

      // Then save existing variables
      for (const [variableId, edit] of existingVariables) {
        // Ensure all spawns have content (provide default if empty)
        const spawnsWithContent = edit.conditionalSpawns.map((spawn: any) => ({
          ...spawn,
          content: spawn.content?.trim() || `Content for ${spawn.display_name || spawn.variable_name || 'spawn'}`,
        }));
        
        const saveOptions = {
          projectId: project.id,
          stringData: edit.originalData, // Pass the full original data object
          content: edit.content,
          displayName: edit.displayName,
          isConditional: edit.isConditional,
          isConditionalContainer: edit.isConditional,
          conditionalSpawns: spawnsWithContent,
          includeHiddenOption: edit.includeHiddenOption,
          controlledBySpawnId: edit.controlledBySpawnId,
          isPublished: edit.isPublished,
          embeddedVariableEdits: edit.embeddedVariableEdits,
          pendingVariableContent: {},
        };

        await saveString(saveOptions);
      }

      // Success - close session and refresh
      setSession({
        edits: new Map(),
        activeVariableId: null,
        isOpen: false,
        isSaving: false,
        error: null,
      });

      onSuccess();
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to save changes';
      setSession(prev => ({
        ...prev,
        isSaving: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, [session.edits, project, onSuccess, syncSpawnEditsToParent]);

  // Discard all changes and close session
  const discardAll = useCallback(() => {
    setSession({
      edits: new Map(),
      activeVariableId: null,
      isOpen: false,
      isSaving: false,
      error: null,
    });

    onCancel?.();
  }, [onCancel]);

  // Close session (discard all changes)
  const closeSession = useCallback(() => {
    // No confirmation needed - just discard all changes
    discardAll();
  }, [discardAll]);

  return {
    // State
    session,
    activeEdit: getActiveEdit(),
    isDirty: isDirty(),

    // Actions
    openCreateSession,
    openEditSession,
    navigateToVariable,
    updateActiveVariable,
    saveAll,
    discardAll,
    closeSession,
  };
}

