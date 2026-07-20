"use client";

import * as React from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteProject } from "@/app/projects/actions";

interface DeleteProjectButtonProps {
  projectId: string;
  projectTitle: string;
}

export function DeleteProjectButton({ projectId, projectTitle }: DeleteProjectButtonProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `Are you sure you want to delete "${projectTitle}"?\n\nThis will permanently delete the project row and all local files (source video, background music, and rendered export).`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await deleteProject(projectId);
      if (!res.success) {
        alert(res.error || "Failed to delete project.");
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred while deleting the project.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-1.5 rounded-md border border-zinc-900 bg-zinc-950/60 hover:bg-red-950/20 hover:border-red-900/50 text-zinc-500 hover:text-red-400 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center justify-center"
      title="Delete Project"
    >
      {isDeleting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
