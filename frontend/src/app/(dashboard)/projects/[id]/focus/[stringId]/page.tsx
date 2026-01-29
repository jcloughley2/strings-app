"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useHeader } from "@/lib/HeaderContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { StringTile } from "@/components/StringTile";
import { VariableHashBadge } from "@/components/VariableHashBadge";
import { Settings, ArrowLeft, Lock } from "lucide-react";

export default function StringFocusPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const stringId = params.stringId as string;
  const { setFocusInfo } = useHeader();

  const [project, setProject] = useState<any>(null);
  const [focusedString, setFocusedString] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Canvas settings
  const [isCanvasSettingsOpen, setIsCanvasSettingsOpen] = useState(false);
  const [showVariableHashes, setShowVariableHashes] = useState(false);
  const [hideControlledVariables, setHideControlledVariables] = useState(true);

  // Conditional spawn selection state
  const [selectedConditionalSpawns, setSelectedConditionalSpawns] = useState<{
    [conditionalVariableName: string]: string | null;
  }>({});

  // Fetch project data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const projectData = await apiFetch(`/api/projects/${projectId}/`);
        setProject(projectData);

        const string = projectData.strings?.find(
          (s: any) => s.id === parseInt(stringId)
        );
        if (!string) {
          setError("String not found");
          return;
        }
        setFocusedString(string);
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [projectId, stringId]);

  // Set header breadcrumb
  useEffect(() => {
    if (project && focusedString) {
      setFocusInfo({
        parentName: project.name,
        parentPath: `/projects/${projectId}`,
        stringName: focusedString.display_name || focusedString.effective_variable_name || focusedString.variable_hash,
      });
    }

    return () => {
      setFocusInfo(null);
    };
  }, [project, focusedString, projectId, setFocusInfo]);

  // Extract variables referenced in the string content
  const referencedVariableNames = useMemo(() => {
    if (!focusedString?.content) return new Set<string>();
    const matches = focusedString.content.match(/\{\{([^}]+)\}\}/g) || [];
    return new Set(matches.map((m: string) => m.slice(2, -2)));
  }, [focusedString?.content]);

  // Helper to check if a variable name matches any of the string's name fields
  const variableMatchesName = (str: any, variableName: string) => {
    return (
      str.effective_variable_name === variableName ||
      str.variable_name === variableName ||
      str.variable_hash === variableName
    );
  };

  // Find all conditional variables that this string depends on (directly or indirectly)
  const relevantConditionals = useMemo(() => {
    if (!project?.strings || !focusedString) return [];

    const conditionals = project.strings.filter(
      (s: any) => s.is_conditional_container
    );

    // Find conditionals that are directly or indirectly referenced
    const relevant = conditionals.filter((cond: any) => {
      // Check if this conditional is directly referenced by any of its identifiers
      for (const refName of referencedVariableNames) {
        if (variableMatchesName(cond, refName)) {
          return true;
        }
      }

      // Check if any of its spawns are referenced
      const condName = cond.effective_variable_name || cond.variable_hash;
      const dimension = project.dimensions?.find((d: any) => d.name === condName);
      if (!dimension) return false;

      const spawns = project.strings?.filter(
        (s: any) =>
          !s.is_conditional_container &&
          s.dimension_values?.some((dv: any) => {
            const dvDetail = dv.dimension_value_detail || dv;
            return dvDetail.dimension === dimension.id;
          })
      ) || [];

      return spawns.some((spawn: any) => {
        for (const refName of referencedVariableNames) {
          if (variableMatchesName(spawn, refName)) {
            return true;
          }
        }
        return false;
      });
    });

    return relevant;
  }, [project, focusedString, referencedVariableNames]);

  // Get spawns for a conditional
  const getSpawnsForConditional = (conditionalVar: any) => {
    const conditionalName = conditionalVar.effective_variable_name || conditionalVar.variable_hash;
    const dimension = project?.dimensions?.find((d: any) => d.name === conditionalName);

    if (!dimension) return [];

    const spawns = project?.strings?.filter(
      (s: any) =>
        !s.is_conditional_container &&
        s.dimension_values?.some((dv: any) => {
          // Handle both nested dimension_value_detail structure and flat structure
          const dvDetail = dv.dimension_value_detail || dv;
          return dvDetail.dimension === dimension.id;
        })
    ) || [];

    return spawns;
  };

  // Check if a spawn is controlled by another spawn
  const isSpawnControlled = (spawn: any, conditionalVar: any) => {
    if (!spawn.controlled_by_spawn_id) return false;
    // It's controlled if the controller is from a DIFFERENT conditional
    return spawn.controlled_by_spawn_id !== conditionalVar.id;
  };

  // Check if a spawn is auto-selected (its controller is currently selected)
  const isSpawnAutoSelected = (spawn: any) => {
    if (!spawn.controlled_by_spawn_id) return false;
    
    // Find the controller spawn
    const controller = project?.strings?.find(
      (s: any) => s.id === spawn.controlled_by_spawn_id
    );
    if (!controller) return false;

    // Find which conditional the controller belongs to
    const controllerName = controller.effective_variable_name || controller.variable_hash;
    
    // Check if controller is currently selected in any conditional
    return Object.values(selectedConditionalSpawns).includes(controllerName);
  };

  // Handle spawn selection
  const handleSpawnSelect = (conditionalName: string, spawnName: string) => {
    setSelectedConditionalSpawns((prev) => ({
      ...prev,
      [conditionalName]: spawnName,
    }));
  };

  // Resolve content to plaintext based on selected conditional spawns
  const resolveContentToPlaintext = useCallback((content: string, excludeStringId?: string | number): string => {
    if (!content) return '';
    
    const visited = new Set<string>();
    
    const resolveRecursively = (text: string, depth: number = 0): string => {
      if (depth > 10) return text; // Prevent infinite recursion
      
      let result = text;
      const matches = text.match(/{{([^}]+)}}/g) || [];
      
      for (const match of matches) {
        const variableName = match.slice(2, -2);
        if (visited.has(variableName)) continue;
        visited.add(variableName);
        
        // Check if this is a conditional variable
        const conditionalVariable = project?.strings?.find((str: any) => 
          str.is_conditional_container && 
          (str.effective_variable_name === variableName || 
           str.variable_name === variableName || 
           str.variable_hash === variableName)
        );
        
        if (conditionalVariable) {
          const conditionalName = conditionalVariable.effective_variable_name || conditionalVariable.variable_hash;
          const selectedSpawnName = selectedConditionalSpawns[conditionalName];
          
          if (selectedSpawnName === "Hidden") {
            result = result.replace(new RegExp(`\\{\\{${variableName}\\}\\}`, 'g'), '');
          } else if (selectedSpawnName) {
            const spawnVariable = project?.strings?.find((str: any) =>
              str.effective_variable_name === selectedSpawnName ||
              str.variable_name === selectedSpawnName ||
              str.variable_hash === selectedSpawnName
            );
            if (spawnVariable) {
              const spawnContent = resolveRecursively(spawnVariable.content || '', depth + 1);
              result = result.replace(new RegExp(`\\{\\{${variableName}\\}\\}`, 'g'), spawnContent);
            }
          }
        } else {
          // Regular embedded variable - resolve it too
          const embeddedVar = project?.strings?.find((str: any) =>
            !str.is_conditional_container &&
            (str.effective_variable_name === variableName ||
             str.variable_name === variableName ||
             str.variable_hash === variableName) &&
            str.id !== excludeStringId
          );
          
          if (embeddedVar && embeddedVar.content) {
            const embeddedContent = resolveRecursively(embeddedVar.content, depth + 1);
            result = result.replace(new RegExp(`\\{\\{${variableName}\\}\\}`, 'g'), embeddedContent);
          }
        }
      }
      
      return result;
    };
    
    return resolveRecursively(content);
  }, [project?.strings, selectedConditionalSpawns]);

  // Compute the resolved content for the focused string
  const resolvedContent = useMemo(() => {
    if (!focusedString?.content) return '';
    return resolveContentToPlaintext(focusedString.content, focusedString.id);
  }, [focusedString?.content, focusedString?.id, resolveContentToPlaintext]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] gap-4">
        <div className="text-red-500">{error}</div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="flex flex-1 overflow-hidden">
        {/* Conditions Sidebar (left) - Only relevant conditions */}
        <aside className="w-80 border-r bg-muted/40 flex flex-col">
          <div className="flex items-center justify-between gap-4 border-b px-6 py-4 bg-background min-h-[65px]">
            <h2 className="text-lg font-semibold">Conditions</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {relevantConditionals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This string doesn't use any conditional variables.
              </p>
            ) : (
              <div className="space-y-4">
                {relevantConditionals.map((conditionalVar: any) => {
                  const conditionalName =
                    conditionalVar.effective_variable_name || conditionalVar.variable_hash;
                  const conditionalDisplayName =
                    conditionalVar.display_name || conditionalName;
                  const spawns = getSpawnsForConditional(conditionalVar);

                  // Filter spawns based on hideControlledVariables setting
                  const visibleSpawns = hideControlledVariables
                    ? spawns.filter(
                        (spawn: any) => !isSpawnControlled(spawn, conditionalVar)
                      )
                    : spawns;

                  // If all spawns are hidden, hide the conditional too
                  if (visibleSpawns.length === 0 && hideControlledVariables) {
                    return null;
                  }

                  const currentSelection = selectedConditionalSpawns[conditionalName];

                  // Auto-select first spawn if none selected
                  if (visibleSpawns.length > 0 && !currentSelection) {
                    const firstSpawn = visibleSpawns[0];
                    const firstName =
                      firstSpawn.effective_variable_name || firstSpawn.variable_hash;
                    setTimeout(() => {
                      handleSpawnSelect(conditionalName, firstName);
                    }, 0);
                  }

                  return (
                    <div key={conditionalVar.id} className="space-y-3">
                      {/* Conditional Header */}
                      <h3 className="font-medium text-sm">{conditionalDisplayName}</h3>

                      {/* Spawn Cards - matching project page styling */}
                      <div className="space-y-2">
                        {visibleSpawns.map((spawn: any) => {
                          const spawnHash =
                            spawn.effective_variable_name || spawn.variable_name || spawn.variable_hash;
                          const spawnDisplayName = spawn.display_name || spawnHash;
                          const isSelected = currentSelection === spawnHash;
                          const isControlled = isSpawnControlled(spawn, conditionalVar);
                          
                          // Get resolved content preview
                          const contentPreview = spawn.content 
                            ? resolveContentToPlaintext(spawn.content, spawn.id)
                            : '';
                          const truncatedContent = contentPreview.length > 60 
                            ? contentPreview.slice(0, 60) + '...' 
                            : contentPreview;

                          if (isSelected) {
                            // Selected spawn card - matches project page styling
                            return (
                              <div
                                key={spawn.id}
                                className={`rounded-md border px-2 py-1.5 transition-all ${
                                  isControlled ? 'opacity-60' : 'cursor-pointer'
                                }`}
                                style={{
                                  backgroundColor: 'var(--conditional-var-100)',
                                  borderColor: 'var(--conditional-var-200)',
                                  color: 'rgb(55 65 81)'
                                }}
                              >
                                {/* Content preview (primary) */}
                                <div className="flex items-start gap-1">
                                  {isControlled && <Lock className="h-3 w-3 flex-shrink-0 mt-0.5" />}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-muted-foreground">
                                      {truncatedContent || <span className="text-muted-foreground italic">No content</span>}
                                    </div>
                                  </div>
                                </div>
                                {/* Display name / Hash (secondary) */}
                                <div className="text-sm text-muted-foreground mt-1">
                                  {spawnDisplayName}
                                </div>
                              </div>
                            );
                          } else {
                            // Unselected spawn card
                            return (
                              <div
                                key={spawn.id}
                                className={`rounded-md border px-2 py-1.5 transition-all ${
                                  isControlled
                                    ? 'opacity-60'
                                    : 'cursor-pointer hover:bg-gray-100'
                                }`}
                                style={{
                                  backgroundColor: 'rgb(249 250 251)',
                                  borderColor: 'rgb(229 231 235)',
                                  color: 'rgb(55 65 81)'
                                }}
                                onClick={() => {
                                  if (!isControlled) {
                                    handleSpawnSelect(conditionalName, spawnHash);
                                  }
                                }}
                              >
                                {/* Content preview (primary) */}
                                <div className="flex items-start gap-1">
                                  {isControlled && <Lock className="h-3 w-3 flex-shrink-0 mt-0.5" />}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-muted-foreground">
                                      {truncatedContent || <span className="text-muted-foreground italic">No content</span>}
                                    </div>
                                  </div>
                                </div>
                                {/* Display name / Hash (secondary) */}
                                <div className="text-sm text-muted-foreground mt-1">
                                  {spawnDisplayName}
                                </div>
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4 bg-background min-h-[65px]">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/projects/${projectId}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCanvasSettingsOpen(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Canvas settings
            </Button>
          </div>

          {/* Focused String Card */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              <Card className="p-6">
                {/* Content - resolved based on selected conditions */}
                <div className="text-base leading-relaxed whitespace-pre-wrap">
                  {resolvedContent || (
                    <span className="text-muted-foreground italic">No content</span>
                  )}
                </div>

                {/* Variable Hash Badge */}
                {showVariableHashes && (
                  <div className="mt-4">
                    <VariableHashBadge
                      hash={
                        focusedString.effective_variable_name ||
                        focusedString.variable_hash
                      }
                      type={
                        focusedString.is_conditional_container
                          ? "conditional"
                          : "string"
                      }
                    />
                  </div>
                )}
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Canvas Settings Sheet */}
      <Sheet open={isCanvasSettingsOpen} onOpenChange={setIsCanvasSettingsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Canvas Settings</SheetTitle>
          </SheetHeader>
          <div className="py-6 space-y-6">
            {/* Display Mode */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Display Mode
              </h3>

              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="show-hashes">Show Variable Hashes</Label>
                  <p className="text-sm text-muted-foreground">
                    Display the copiable variable hash badge
                  </p>
                </div>
                <Switch
                  id="show-hashes"
                  checked={showVariableHashes}
                  onCheckedChange={setShowVariableHashes}
                />
              </div>
            </div>

            {/* Conditions Sidebar */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Conditions Sidebar
              </h3>

              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="hide-controlled">Hide Controlled Variables</Label>
                  <p className="text-sm text-muted-foreground">
                    Hide spawn variables that have a controlling condition set
                  </p>
                </div>
                <Switch
                  id="hide-controlled"
                  checked={hideControlledVariables}
                  onCheckedChange={setHideControlledVariables}
                />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
