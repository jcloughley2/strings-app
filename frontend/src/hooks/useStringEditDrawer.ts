import { useState, useCallback } from 'react';
import { saveString, SaveStringOptions, detectCircularReferences } from '@/lib/stringOperations';
import { apiFetch } from '@/lib/api';

export interface DrawerState {
  // Core drawer state
  isOpen: boolean;
  stringData: any | null;
  
  // Form state
  content: string;
  variableName: string;
  displayName: string;
  isConditional: boolean;
  conditionalSpawns: any[];
  includeHiddenOption: boolean;
  activeTab: string;
  
  // UI state
  title?: string;
  level?: number;
  showBackButton?: boolean;
  isSaving: boolean;
}

export interface UseStringEditDrawerOptions {
  project?: any;
  selectedDimensionValues?: {[dimensionId: number]: string | null};
  pendingStringVariables?: {[name: string]: {content: string, is_conditional: boolean}};
  onProjectUpdate?: (project: any) => void;
  onSuccess?: () => void;
  onCancel?: () => void;
  findSpawnsForConditional?: (conditionalName: string) => any[];
}

export function useStringEditDrawer(options: UseStringEditDrawerOptions = {}) {
  const {
    project,
    selectedDimensionValues = {},
    pendingStringVariables = {},
    onProjectUpdate,
    onSuccess,
    onCancel,
    findSpawnsForConditional,
  } = options;

  const [state, setState] = useState<DrawerState>({
    isOpen: false,
    stringData: null,
    content: '',
    variableName: '',
    displayName: '',
    isConditional: false,
    conditionalSpawns: [],
    includeHiddenOption: false,
    activeTab: 'content',
    isSaving: false,
  });

  // Open drawer for creating new string
  const openCreateDrawer = useCallback((options: {
    isConditional?: boolean;
    content?: string;
    title?: string;
    level?: number;
  } = {}) => {
    setState({
      isOpen: true,
      stringData: null,
      content: options.content || '',
      variableName: '',
      displayName: '',
      isConditional: options.isConditional || false,
      conditionalSpawns: options.isConditional ? [{
        id: `temp-${Date.now()}`,
        content: 'Default spawn content',
        variable_name: null,
        variable_hash: null,
        effective_variable_name: null,
        is_conditional: false,
        is_conditional_container: false,
        _isTemporary: true
      }] : [],
      includeHiddenOption: false,
      activeTab: 'content',
      title: options.title,
      level: options.level || 0,
      showBackButton: (options.level || 0) > 0,
      isSaving: false,
    });
  }, []);

  // Open drawer for editing existing string
  const openEditDrawer = useCallback((stringData: any, options: {
    title?: string;
    level?: number;
    showBackButton?: boolean;
  } = {}) => {
    // Determine if this is a conditional and load spawns
    let spawns: any[] = [];
    let hasHiddenOption = false;
    
    if (stringData.is_conditional_container) {
      const conditionalName = stringData.effective_variable_name || stringData.variable_hash;
      
      // Find spawns for this conditional using the provided function
      if (findSpawnsForConditional) {
        spawns = findSpawnsForConditional(conditionalName);
      } else {
        // Fallback to the old approach if function not provided
        spawns = project?.strings?.filter((str: any) => {
          return str.dimension_values?.some((sdv: any) => {
            const dimension = project.dimensions?.find((d: any) => d.name === conditionalName);
            return dimension && sdv.dimension_value?.dimension?.id === dimension.id;
          });
        }) || [];
      }
      
      // Sort spawns by spawn number
      spawns.sort((a: any, b: any) => {
        const aName = a.effective_variable_name || a.variable_hash;
        const bName = b.effective_variable_name || b.variable_hash;
        const aMatch = aName.match(/_(\d+)$/);
        const bMatch = bName.match(/_(\d+)$/);
        const aNum = aMatch ? parseInt(aMatch[1]) : 0;
        const bNum = bMatch ? parseInt(bMatch[1]) : 0;
        return aNum - bNum;
      });
      
      // Check if this conditional has a "Hidden" dimension value
      const dimension = project?.dimensions?.find((d: any) => d.name === conditionalName);
      hasHiddenOption = dimension?.values?.some((v: any) => v.value === "Hidden") || false;
    }

    setState({
      isOpen: true,
      stringData,
      content: stringData.content || '',
      variableName: stringData.effective_variable_name || stringData.variable_hash || stringData.variable_name || '',
      displayName: stringData.display_name || '',
      isConditional: stringData.is_conditional_container || false,
      conditionalSpawns: spawns,
      includeHiddenOption: hasHiddenOption,
      activeTab: 'content',
      title: options.title,
      level: options.level || 0,
      showBackButton: options.showBackButton || false,
      isSaving: false,
    });
  }, [project]);

  // Close drawer
  const closeDrawer = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
    onCancel?.();
  }, [onCancel]);

  // Update state functions
  const updateContent = useCallback((content: string) => {
    setState(prev => ({ ...prev, content }));
  }, []);

  const updateVariableName = useCallback((variableName: string) => {
    setState(prev => ({ ...prev, variableName }));
  }, []);

  const updateDisplayName = useCallback((displayName: string) => {
    setState(prev => ({ ...prev, displayName }));
  }, []);

  const updateType = useCallback((isConditional: boolean) => {
    setState(prev => {
      const newState = { ...prev, isConditional };
      
      // When switching to conditional, initialize with default spawn if empty
      if (isConditional && prev.conditionalSpawns.length === 0) {
        newState.conditionalSpawns = [{
          id: `temp-${Date.now()}`,
          content: prev.content || 'Default spawn content',
          variable_name: null,
          variable_hash: null,
          effective_variable_name: null,
          is_conditional: false,
          is_conditional_container: false,
          _isTemporary: true
        }];
      }
      
      // When switching to string, clear conditional state
      if (!isConditional) {
        newState.conditionalSpawns = [];
        newState.includeHiddenOption = false;
      }
      
      return newState;
    });
  }, []);

  const updateConditionalSpawns = useCallback((spawns: any[]) => {
    setState(prev => ({ ...prev, conditionalSpawns: spawns }));
  }, []);

  const updateHiddenOption = useCallback((includeHiddenOption: boolean) => {
    setState(prev => ({ ...prev, includeHiddenOption }));
  }, []);

  const updateTab = useCallback((activeTab: string) => {
    setState(prev => ({ ...prev, activeTab }));
  }, []);

  // Add spawn to conditional
  const addSpawn = useCallback(() => {
    const newSpawn = {
      id: `temp-spawn-${Date.now()}`,
      content: 'New spawn content',
      variable_name: null,
      variable_hash: null,
      effective_variable_name: null,
      is_conditional: false,
      is_conditional_container: false,
      _isTemporary: true
    };
    
    setState(prev => ({
      ...prev,
      conditionalSpawns: [...prev.conditionalSpawns, newSpawn]
    }));
  }, []);

  // Remove spawn from conditional
  const removeSpawn = useCallback((spawn: any, index: number) => {
    setState(prev => ({
      ...prev,
      conditionalSpawns: prev.conditionalSpawns.filter((_, i) => i !== index)
    }));
  }, []);

  // Add existing variable as spawn to conditional
  const addExistingVariableAsSpawn = useCallback((variableId: string) => {
    if (!project?.strings) return;
    
    // Find the existing variable
    const existingVariable = project.strings.find((str: any) => str.id === variableId);
    if (!existingVariable) {
      console.error('Variable not found:', variableId);
      return;
    }
    
    // Check if it's already in the spawns list
    const alreadyExists = state.conditionalSpawns.some(spawn => spawn.id === variableId);
    if (alreadyExists) {
      console.warn('Variable already exists in spawns:', existingVariable.effective_variable_name);
      return;
    }
    
    // Add the existing variable to spawns (mark it as existing, not temporary)
    const existingSpawn = {
      ...existingVariable,
      _isExisting: true, // Flag to indicate this is an existing variable
      _isTemporary: false
    };
    
    setState(prev => ({
      ...prev,
      conditionalSpawns: [...prev.conditionalSpawns, existingSpawn]
    }));
    
    console.log('Added existing variable as spawn:', existingVariable.effective_variable_name || existingVariable.variable_hash);
  }, [project, state.conditionalSpawns]);

  // Helper function to create new variables found in content
  const createNewVariablesFromContent = useCallback(async (content: string) => {
    if (!project?.id) return;
    
    // Extract variables from content
    const variableMatches = content.match(/{{([^}]+)}}/g) || [];
    const variableNames = variableMatches.map(match => match.slice(2, -2));
    const uniqueVariableNames = [...new Set(variableNames)];
    
    // Find which variables don't exist yet
    const newVariables = uniqueVariableNames.filter(varName => {
      // Check if variable exists in project strings
      const existsInProject = project.strings?.some((str: any) => {
        const effectiveName = str.effective_variable_name || str.variable_hash;
        return effectiveName === varName;
      });
      
      // Check if variable is in pending variables
      const existsInPending = pendingStringVariables && pendingStringVariables[varName];
      
      return !existsInProject && !existsInPending;
    });
    
    // Create new variables
    for (const varName of newVariables) {
      try {
        console.log(`Creating new variable: ${varName}`);
        await apiFetch('/api/strings/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `Content for ${varName}`, // Default content
            display_name: varName, // Use display_name so backend can slugify it to create variable_name
            is_conditional: false,
            is_conditional_container: false,
            project: project.id,
          }),
        });
      } catch (error) {
        console.error(`Failed to create variable ${varName}:`, error);
        // Continue creating other variables even if one fails
      }
    }
  }, [project, pendingStringVariables]);

  // Save function
  const save = useCallback(async () => {
    setState(prev => ({ ...prev, isSaving: true }));
    
    try {
      const saveOptions: SaveStringOptions = {
        stringData: state.stringData,
        content: state.content,
        variableName: state.variableName,
        displayName: state.displayName,
        isConditional: state.isConditional,
        projectId: project?.id,
        conditionalSpawns: state.conditionalSpawns,
        includeHiddenOption: state.includeHiddenOption,
        project,
        onProjectUpdate,
        detectCircularReferences: (content: string, stringId?: string | number) => 
          detectCircularReferences(content, stringId, project?.strings),
      };
      
      // 1. First, create any new variables found in the content
      await createNewVariablesFromContent(state.content);
      
      // 2. Then save the main string
      await saveString(saveOptions);
      
      // 3. Refresh project data
      if (onProjectUpdate && project?.id) {
        try {
          const updatedProject = await apiFetch(`/api/projects/${project.id}/`);
          onProjectUpdate(updatedProject);
        } catch (refreshError) {
          console.error('Failed to refresh project data after save:', refreshError);
          // Don't throw here - the save was successful, just the refresh failed
        }
      }
      
      setState(prev => ({ ...prev, isOpen: false, isSaving: false }));
      onSuccess?.();
      
    } catch (error) {
      setState(prev => ({ ...prev, isSaving: false }));
      throw error; // Let the drawer handle the error display
    }
  }, [state, project, onProjectUpdate, onSuccess]);

  return {
    // State
    ...state,
    
    // Data
    project,
    selectedDimensionValues,
    pendingStringVariables,
    
    // Actions
    openCreateDrawer,
    openEditDrawer,
    closeDrawer,
    updateContent,
    updateVariableName,
    updateDisplayName,
    updateType,
    updateConditionalSpawns,
    updateHiddenOption,
    updateTab,
    addSpawn,
    removeSpawn,
    addExistingVariableAsSpawn,
    save,
  };
}
