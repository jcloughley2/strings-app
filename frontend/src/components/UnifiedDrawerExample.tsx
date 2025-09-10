/**
 * Example of how to replace all existing drawer systems with the unified StringEditDrawer
 * This shows the integration pattern that should be applied to the main page
 */

import { useState } from 'react';
import { StringEditDrawer } from '@/components/StringEditDrawer';
import { useStringEditDrawer } from '@/hooks/useStringEditDrawer';

interface UnifiedDrawerExampleProps {
  project: any;
  selectedDimensionValues: {[dimensionId: number]: string | null};
  pendingStringVariables: {[name: string]: {content: string, is_conditional: boolean}};
  onProjectUpdate: (project: any) => void;
}

export function UnifiedDrawerExample({
  project,
  selectedDimensionValues,
  pendingStringVariables,
  onProjectUpdate,
}: UnifiedDrawerExampleProps) {
  
  // Stack of drawers for cascading functionality
  const [drawerStack, setDrawerStack] = useState<any[]>([]);
  
  // Main drawer hook
  const mainDrawer = useStringEditDrawer({
    project,
    selectedDimensionValues,
    pendingStringVariables,
    onProjectUpdate,
    onSuccess: () => {
      console.log('Main drawer saved successfully');
    },
    onCancel: () => {
      console.log('Main drawer cancelled');
    },
  });
  
  // Example usage functions (replace existing openCreateString, openEditString, etc.)
  
  const openCreateString = () => {
    mainDrawer.openCreateDrawer({
      title: 'Create String Variable',
      isConditional: false,
    });
  };
  
  const openCreateConditional = () => {
    mainDrawer.openCreateDrawer({
      title: 'Create Conditional Variable',
      isConditional: true,
    });
  };
  
  const openEditString = (stringData: any) => {
    mainDrawer.openEditDrawer(stringData, {
      title: 'Edit Variable',
    });
  };
  
  // Cascading drawer functionality
  const openCascadingDrawer = (stringData: any, level: number = 1) => {
    const newDrawer = {
      id: `cascade-${stringData.id}-${Date.now()}`,
      level,
      hook: useStringEditDrawer({
        project,
        selectedDimensionValues,
        pendingStringVariables,
        onProjectUpdate,
        onSuccess: () => {
          // Remove this drawer from stack on success
          setDrawerStack(prev => prev.filter(d => d.id !== newDrawer.id));
        },
        onCancel: () => {
          // Remove this drawer from stack on cancel
          setDrawerStack(prev => prev.filter(d => d.id !== newDrawer.id));
        },
      }),
    };
    
    // Open the drawer and add to stack
    newDrawer.hook.openEditDrawer(stringData, {
      title: `Edit Variable (Level ${level + 1})`,
      level,
      showBackButton: true,
    });
    
    setDrawerStack(prev => [...prev, newDrawer]);
  };
  
  const handleEditVariable = (variableName: string) => {
    // Find the variable and open in cascading drawer
    const stringVar = project?.strings?.find((str: any) => {
      const effectiveName = str.effective_variable_name || str.variable_name || str.variable_hash;
      return effectiveName === variableName;
    });
    
    if (stringVar) {
      openCascadingDrawer(stringVar, drawerStack.length + 1);
    } else {
      // Handle new variable creation
      const pendingVar = pendingStringVariables[variableName];
      if (pendingVar) {
        // Create temporary string data for editing
        const tempStringData = {
          id: `temp-${Date.now()}`,
          content: pendingVar.content || '',
          variable_name: null,
          variable_hash: variableName,
          effective_variable_name: variableName,
          is_conditional: pendingVar.is_conditional,
          is_conditional_container: false,
          _isTemporary: true,
        };
        
        openCascadingDrawer(tempStringData, drawerStack.length + 1);
      }
    }
  };
  
  const handleEditSpawn = (spawn: any) => {
    openCascadingDrawer(spawn, drawerStack.length + 1);
  };
  
  const handleBackButton = (drawerId: string) => {
    // Remove this drawer and all subsequent ones
    setDrawerStack(prev => {
      const index = prev.findIndex(d => d.id === drawerId);
      return index >= 0 ? prev.slice(0, index) : prev;
    });
  };

  return (
    <div>
      {/* Example UI that would trigger drawer opening */}
      <div className="space-x-4 p-4">
        <button onClick={openCreateString} className="px-4 py-2 bg-blue-500 text-white rounded">
          Create String
        </button>
        <button onClick={openCreateConditional} className="px-4 py-2 bg-orange-500 text-white rounded">
          Create Conditional
        </button>
      </div>
      
      {/* Main Drawer */}
      <StringEditDrawer
        isOpen={mainDrawer.isOpen}
        onClose={mainDrawer.closeDrawer}
        stringData={mainDrawer.stringData}
        content={mainDrawer.content}
        onContentChange={mainDrawer.updateContent}
        variableName={mainDrawer.variableName}
        onVariableNameChange={mainDrawer.updateVariableName}
        isConditional={mainDrawer.isConditional}
        onTypeChange={mainDrawer.updateType}
        conditionalSpawns={mainDrawer.conditionalSpawns}
        onConditionalSpawnsChange={mainDrawer.updateConditionalSpawns}
        includeHiddenOption={mainDrawer.includeHiddenOption}
        onHiddenOptionChange={mainDrawer.updateHiddenOption}
        activeTab={mainDrawer.activeTab}
        onTabChange={mainDrawer.updateTab}
        project={project}
        selectedDimensionValues={selectedDimensionValues}
        pendingStringVariables={pendingStringVariables}
        onSave={mainDrawer.save}
        onCancel={mainDrawer.closeDrawer}
        onAddSpawn={mainDrawer.addSpawn}
        onEditSpawn={handleEditSpawn}
        onEditVariable={handleEditVariable}
        title={mainDrawer.title}
        level={mainDrawer.level}
        showBackButton={mainDrawer.showBackButton}
        isSaving={mainDrawer.isSaving}
      />
      
      {/* Cascading Drawers */}
      {drawerStack.map((drawer) => (
        <StringEditDrawer
          key={drawer.id}
          isOpen={drawer.hook.isOpen}
          onClose={drawer.hook.closeDrawer}
          stringData={drawer.hook.stringData}
          content={drawer.hook.content}
          onContentChange={drawer.hook.updateContent}
          variableName={drawer.hook.variableName}
          onVariableNameChange={drawer.hook.updateVariableName}
          isConditional={drawer.hook.isConditional}
          onTypeChange={drawer.hook.updateType}
          conditionalSpawns={drawer.hook.conditionalSpawns}
          onConditionalSpawnsChange={drawer.hook.updateConditionalSpawns}
          includeHiddenOption={drawer.hook.includeHiddenOption}
          onHiddenOptionChange={drawer.hook.updateHiddenOption}
          activeTab={drawer.hook.activeTab}
          onTabChange={drawer.hook.updateTab}
          project={project}
          selectedDimensionValues={selectedDimensionValues}
          pendingStringVariables={pendingStringVariables}
          onSave={drawer.hook.save}
          onCancel={drawer.hook.closeDrawer}
          onAddSpawn={drawer.hook.addSpawn}
          onEditSpawn={handleEditSpawn}
          onEditVariable={handleEditVariable}
          title={drawer.hook.title}
          level={drawer.hook.level}
          showBackButton={drawer.hook.showBackButton}
          onBack={() => handleBackButton(drawer.id)}
          isSaving={drawer.hook.isSaving}
        />
      ))}
    </div>
  );
}

/**
 * MIGRATION GUIDE:
 * 
 * To migrate the existing page.tsx to use this unified system:
 * 
 * 1. REPLACE these existing state variables:
 *    - isStringDrawerOpen -> mainDrawer.isOpen
 *    - editingString -> mainDrawer.stringData  
 *    - stringContent -> mainDrawer.content
 *    - stringVariableName -> mainDrawer.variableName
 *    - stringIsConditional -> mainDrawer.isConditional
 *    - conditionalSpawns -> mainDrawer.conditionalSpawns
 *    - includeHiddenOption -> mainDrawer.includeHiddenOption
 *    - stringDialogTab -> mainDrawer.activeTab
 *    - cascadingDrawers -> drawerStack (with hook pattern)
 *    - drawerStack -> remove (legacy)
 * 
 * 2. REPLACE these functions:
 *    - handleStringSubmit -> mainDrawer.save
 *    - saveCascadingDrawer -> drawer.hook.save (for each cascading drawer)
 *    - handleNestedStringSubmit -> mainDrawer.save or drawer.hook.save
 *    - openCreateString -> mainDrawer.openCreateDrawer
 *    - openEditString -> mainDrawer.openEditDrawer
 *    - closeStringDialog -> mainDrawer.closeDrawer
 * 
 * 3. REPLACE these UI sections:
 *    - Main Sheet component (~lines 4080+) -> <StringEditDrawer> for main drawer
 *    - Cascading Sheet components (~lines 5080+) -> <StringEditDrawer> array for cascading
 *    - Legacy drawer components (~lines 5440+) -> remove entirely
 * 
 * 4. BENEFITS after migration:
 *    - ~2000 lines of duplicate code removed
 *    - Single source of truth for drawer logic
 *    - Consistent UI/UX across all editing contexts
 *    - Easier to maintain and extend
 *    - Better TypeScript support
 *    - Unified save logic with proper error handling
 */
