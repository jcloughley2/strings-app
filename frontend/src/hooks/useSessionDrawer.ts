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
  const { project, onSuccess } = options;

  const editSession = useEditSession({
    project,
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
  }, [activeEdit, editSession]);

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
    activeVariableId: session.activeVariableId,
  };
}

