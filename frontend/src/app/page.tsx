"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { OverflowMenu } from "@/components/ui/menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Home() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editProject, setEditProject] = useState<any | null>(null);
  const [deleteProject, setDeleteProject] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  useEffect(() => {
    if (authLoading || !isLoggedIn) return;
    setLoading(true);
    apiFetch("/api/projects/")
      .then(setProjects)
      .catch((err) => setError(err.message || "Failed to load projects"))
      .finally(() => setLoading(false));
  }, [isLoggedIn, authLoading]);

  function handleEdit(project: any) {
    setEditProject(project);
    setEditName(project.name);
    setEditDescription(project.description);
  }

  function handleDelete(project: any) {
    setDeleteProject(project);
  }

  async function handleDuplicate(project: any) {
    try {
      toast.loading("Duplicating project...");
      const duplicatedProject = await apiFetch(`/api/projects/${project.id}/duplicate/`, {
        method: "POST",
      });
      
      // Add the new project to the projects list
      setProjects((prev) => [duplicatedProject, ...prev]);
      
      toast.dismiss();
      toast.success(`Project duplicated successfully!`);
      
      // Navigate to the new project
      router.push(`/projects/${duplicatedProject.id}`);
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || "Failed to duplicate project");
    }
  }

  async function saveEdit() {
    if (!editProject) return;
    setSaving(true);
    try {
      const updated = await apiFetch(`/api/projects/${editProject.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName, description: editDescription }),
      });
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditProject(null);
    } catch (err: any) {
      alert(err.message || "Failed to update project");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteProject) return;
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${deleteProject.id}/`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== deleteProject.id));
      setDeleteProject(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete project");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!createName.trim()) return;
    setCreateSaving(true);
    try {
      const project = await apiFetch("/api/projects/", {
        method: "POST",
        body: JSON.stringify({ name: createName, description: createDescription }),
      });
      setCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      window.location.href = `/projects/${project.id}`;
    } catch (err: any) {
      alert(err.message || "Failed to create project");
    } finally {
      setCreateSaving(false);
    }
  }

  return (
    <main className="flex flex-col items-center min-h-[calc(100vh-64px)] gap-8 bg-background pt-16 pb-8">
      <h1 className="text-4xl font-bold text-center">Welcome to Strings</h1>
      <p className="text-lg text-muted-foreground text-center max-w-xl">
        Effortlessly manage, localize, and export your app strings with variables, conditionals, and dimensions. Built for teams who care about content and flexibility.
      </p>
      <Button size="lg" className="mt-2" onClick={() => setCreateOpen(true)} disabled={authLoading || !isLoggedIn}>
        Create project
      </Button>
      {!authLoading && isLoggedIn && (
        <section className="w-full max-w-4xl mt-12">
          <h2 className="text-2xl font-semibold mb-4">Your Projects</h2>
          {loading ? (
            <div className="text-center text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="text-center text-red-500">{error}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {projects.length === 0 ? (
                <div className="col-span-full text-center text-muted-foreground">No projects found.</div>
              ) : (
                projects.map((project) => (
                  <div key={project.id} className="relative group">
                    <Link
                      href={`/projects/${project.id}`}
                      className="block"
                    >
                      <Card className="min-h-[180px] flex flex-col justify-between">
                        <div>
                          <div className="font-semibold text-lg mb-2">{project.name}</div>
                          <div className="text-muted-foreground text-sm min-h-[32px]">{project.description || <span>&nbsp;</span>}</div>
                        </div>
                        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                          <span>Strings: <span className="font-semibold">{project.strings?.length ?? 0}</span></span>
                          <span>Variables: <span className="font-semibold">{project.variables?.length ?? 0}</span></span>
                        </div>
                      </Card>
                    </Link>
                    <div className="absolute top-2 right-2 z-10">
                      <OverflowMenu>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-accent rounded"
                          onClick={(e) => { e.preventDefault(); handleEdit(project); }}
                        >
                          Edit project
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-accent rounded"
                          onClick={(e) => { e.preventDefault(); handleDuplicate(project); }}
                        >
                          Duplicate project
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 hover:bg-accent rounded text-red-600"
                          onClick={(e) => { e.preventDefault(); handleDelete(project); }}
                        >
                          Delete project
                        </button>
                      </OverflowMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      )}
      {/* Edit Project Dialog */}
      <Dialog open={!!editProject} onOpenChange={v => !v && setEditProject(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>Edit Project</DialogTitle>
          <form
            onSubmit={e => { e.preventDefault(); saveEdit(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input 
                id="edit-name"
                value={editName} 
                onChange={e => setEditName(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input 
                id="edit-description"
                value={editDescription} 
                onChange={e => setEditDescription(e.target.value)} 
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="secondary" onClick={() => setEditProject(null)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* Delete Project Dialog */}
      <Dialog open={!!deleteProject} onOpenChange={v => !v && setDeleteProject(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Project</DialogTitle>
          <div className="mb-4">Are you sure you want to delete <span className="font-semibold">{deleteProject?.name}</span>? This action cannot be undone.</div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteProject(null)} disabled={saving}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={saving}>{saving ? "Deleting..." : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) { setCreateName(""); setCreateDescription(""); } }}>
        <DialogContent className="max-w-md">
          <DialogTitle>New Project</DialogTitle>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name</Label>
              <Input 
                id="create-name"
                value={createName} 
                onChange={e => setCreateName(e.target.value)} 
                required 
                autoFocus 
                maxLength={200} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Input 
                id="create-description"
                value={createDescription} 
                onChange={e => setCreateDescription(e.target.value)} 
                maxLength={500} 
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={createSaving}>Cancel</Button>
              <Button type="submit" disabled={createSaving || !createName.trim()}>{createSaving ? "Creating..." : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
