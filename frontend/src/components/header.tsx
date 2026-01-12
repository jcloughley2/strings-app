"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";
import { useHeader } from "@/lib/HeaderContext";
import { Edit2, MoreHorizontal, Upload, Download, Copy, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { isLoggedIn, username, logout, loading } = useAuth();
  const { projectInfo } = useHeader();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left side: Logo + Project Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/" className="text-3xl font-grand-hotel tracking-wide text-primary">
          Strings
        </Link>
        
        {/* Project Breadcrumb (when on a project page) */}
        {projectInfo && (
          <>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-lg font-medium truncate max-w-[300px]">
              {projectInfo.name}
            </span>
            
            {/* Edit button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 ml-1"
              onClick={projectInfo.onEdit}
              title="Edit project"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            
            {/* Overflow menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={projectInfo.onImport}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Strings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={projectInfo.onDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={projectInfo.onDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={projectInfo.onDelete}
                  className="text-red-600 focus:text-red-600"
                >
                  Delete Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Right side: User info */}
      <div className="flex items-center gap-4">
        {loading ? (
          <div className="w-20 h-9" />
        ) : isLoggedIn ? (
          <>
            <span className="text-base font-medium text-muted-foreground mr-2">{username}</span>
            <Button variant="secondary" onClick={logout}>Logout</Button>
          </>
        ) : (
          <Button asChild variant="default">
            <Link href="/login">Login</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
