import { useCallback, useState } from 'react';
import { useEditSession } from './useEditSession';

/**
 * Adapter hook that bridges useEditSession with StringEditDrawer's expected interface
 * This allows the drawer to work with the session-based editing system
 */
export function useSessionDrawer(options: {
  project: any;
  selectedDimensionValues: any;
  pendingStringVariables: any;
  onSuccess: () => void;
}) {
  const { project, pendingStringVariables, onSuccess } = options;

  const editSession = useEditSession({
    project,
    pendingStringVariables,
    onSuccess,
  });

  const { session, activeEdit, isDirty } = editSession;
  
  // Local state for active tab (not part of session)
  const [activeTab, setActiveTab] = useState('content');

  // Adapter functions to match StringEditDrawer's expected interface
  const openCreateDrawer = useCallback(() => {
    editSession.openCreateSession();
  }, [editSession]);

  const openEditDrawer = useCallback((variableData: any, drawerOptions?: any) => {
    editSession.openEditSession(variableData);
  }, [editSession]);

  const closeDrawer = useCallback(() => {
    editSession.closeSession();
  }, [editSession]);

  const updateContent = useCallback((content: string) => {
    editSession.updateActiveVariable({ content });
  }, [editSession]);

  const updateDisplayName = useCallback((displayName: string) => {
    editSession.updateActiveVariable({ displayName });
  }, [editSession]);

  const updateType = useCallback((isConditional: boolean) => {
    editSession.updateActiveVariable({ isConditional });
  }, [editSession]);

  const updateConditionalSpawns = useCallback((spawns: any[]) => {
    editSession.updateActiveVariable({ conditionalSpawns: spawns });
  }, [editSession]);

  const updateHiddenOption = useCallback((includeHiddenOption: boolean) => {
    editSession.updateActiveVariable({ includeHiddenOption });
  }, [editSession]);

  const updateControlledBySpawnId = useCallback((controlledBySpawnId: number | null) => {
    editSession.updateActiveVariable({ controlledBySpawnId });
  }, [editSession]);

  const updateEmbeddedVariableEdits = useCallback((edits: any) => {
    editSession.updateActiveVariable({ embeddedVariableEdits: edits });
  }, [editSession]);

  const updateIsPublished = useCallback((isPublished: boolean) => {
    editSession.updateActiveVariable({ isPublished });
  }, [editSession]);

  const updateTab = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const save = useCallback(async () => {
    await editSession.saveAll();
  }, [editSession]);

  const addSpawn = useCallback(() => {
    if (!activeEdit) return;
    
    const newSpawn = {
      id: `temp-${Date.now()}`,
      display_name: '',
      content: '',
      is_conditional: false,
      is_conditional_container: false,
      _isTemporary: true,
    };

    editSession.updateActiveVariable({
      conditionalSpawns: [...activeEdit.conditionalSpawns, newSpawn],
    });
    
    return newSpawn.id; // Return the new spawn's ID so caller can navigate to it
  }, [activeEdit, editSession]);

  // Open a create drawer for a new spawn variable under a specific conditional
  const openCreateSpawnDrawer = useCallback((conditionalVariable: any) => {
    // First, open the parent conditional for editing
    editSession.openEditSession(conditionalVariable);
    
    // Create the new spawn
    const spawnId = `temp-${Date.now()}`;
    const newSpawn = {
      id: spawnId,
      display_name: '',
      content: '',
      is_conditional: false,
      is_conditional_container: false,
      _isTemporary: true,
    };
    
    // We need to get the edit state for the conditional after opening
    // Since openEditSession creates the edit state, we need to update it after
    // Use a microtask to ensure the state update from openEditSession is processed
    setTimeout(() => {
      // Get the conditional's edit state and add the spawn
      const conditionalId = conditionalVariable.id.toString();
      const conditionalEdit = editSession.session.edits.get(conditionalId);
      
      if (conditionalEdit) {
        // Update the conditional with the new spawn
        editSession.updateActiveVariable({
          conditionalSpawns: [...conditionalEdit.conditionalSpawns, newSpawn],
        });
        
        // Navigate to the new spawn
        setTimeout(() => {
          editSession.navigateToVariable(spawnId);
        }, 10);
      }
    }, 0);
  }, [editSession]);

  const updateSpawn = useCallback((index: number, updatedSpawn: any) => {
    if (!activeEdit) return;

    const newSpawns = [...activeEdit.conditionalSpawns];
    newSpawns[index] = updatedSpawn;

    editSession.updateActiveVariable({
      conditionalSpawns: newSpawns,
    });
  }, [activeEdit, editSession]);

  const removeSpawn = useCallback((spawn: any, index: number) => {
    if (!activeEdit) return;

    const newSpawns = activeEdit.conditionalSpawns.filter((_, i) => i !== index);

    editSession.updateActiveVariable({
      conditionalSpawns: newSpawns,
    });
  }, [activeEdit, editSession]);

  const addExistingVariableAsSpawn = useCallback((variableId: string) => {
    if (!activeEdit) return;

    const variable = project?.strings?.find((s: any) => s.id.toString() === variableId);
    if (!variable) return;

    const newSpawn = {
      ...variable,
      _isExisting: true,
    };

    editSession.updateActiveVariable({
      conditionalSpawns: [...activeEdit.conditionalSpawns, newSpawn],
    });
  }, [activeEdit, project, editSession]);

  // Return interface compatible with StringEditDrawer
  return {
    // State
    isOpen: session.isOpen,
    stringData: activeEdit?.originalData || null,
    content: activeEdit?.content || '',
    variableName: activeEdit?.originalData?.effective_variable_name || activeEdit?.originalData?.variable_hash || '',
    displayName: activeEdit?.displayName || '',
    isConditional: activeEdit?.isConditional || false,
    conditionalSpawns: activeEdit?.conditionalSpawns || [],
    includeHiddenOption: activeEdit?.includeHiddenOption || false,
    controlledBySpawnId: activeEdit?.controlledBySpawnId || null,
    embeddedVariableEdits: activeEdit?.embeddedVariableEdits || {},
    isPublished: activeEdit?.isPublished || false,
    pendingVariableContent: {}, // Not used in session mode
    activeTab,
    isSaving: session.isSaving,
    isDirty,

    // Actions
    openCreateDrawer,
    openEditDrawer,
    closeDrawer,
    updateContent,
    updateDisplayName,
    updateType,
    updateConditionalSpawns,
    updateHiddenOption,
    updateControlledBySpawnId,
    updateEmbeddedVariableEdits,
    updateIsPublished,
    updatePendingVariableContent: () => {}, // Not used in session mode
    updateTab,
    save,
    addSpawn,
    updateSpawn,
    removeSpawn,
    addExistingVariableAsSpawn,

    // Session-specific
    navigateToVariable: editSession.navigateToVariable,
    sessionEdits: session.edits,
    openCreateSpawnDrawer,
    activeVariableId: session.activeVariableId,
  };
}

