import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, StickyNote, MoreVertical, Pencil, Trash2, Search } from "lucide-react";
import { formatDate, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Note } from "@/lib/types";

// Pastel color palette for note cards
const NOTE_COLORS = [
  "bg-yellow-50 border-yellow-200",
  "bg-blue-50 border-blue-200",
  "bg-green-50 border-green-200",
  "bg-purple-50 border-purple-200",
  "bg-pink-50 border-pink-200",
  "bg-orange-50 border-orange-200",
];

function getNoteColor(id: string) {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return NOTE_COLORS[hash % NOTE_COLORS.length];
}

export default function Notes() {
  const { notes, addNote, updateNote, deleteNote } = useStore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [content, setContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredNotes = notes.filter((n) =>
    n.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openNew = () => {
    setEditingNote(null);
    setContent("");
    setDialogOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    setContent(note.content);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    try {
      if (editingNote) {
        await updateNote(editingNote.id, content.trim());
        toast({ title: "Note updated" });
      } else {
        await addNote(content.trim());
        toast({ title: "Note added" });
      }
      setDialogOpen(false);
      setContent("");
      setEditingNote(null);
    } catch (err: any) {
      toast({ title: "Error saving note", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote(id);
      setDeleteConfirm(null);
      toast({ title: "Note deleted", variant: "default" });
    } catch (err: any) {
      toast({ title: "Error deleting note", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="px-4 md:px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Notes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {notes.length} note{notes.length !== 1 ? "s" : ""} · personal workspace
            </p>
          </div>
          <Button className="gap-2 shadow-sm" onClick={openNew}>
            <Plus className="w-4 h-4" />
            New Note
          </Button>
        </div>
      </div>

      {/* Search */}
      {notes.length > 3 && (
        <div className="px-4 md:px-6 mb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search notes..."
              className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card"
            />
          </div>
        </div>
      )}

      {/* Notes Grid */}
      <div className="px-4 md:px-6 pb-8">
        {filteredNotes.length === 0 && notes.length === 0 ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-2xl bg-yellow-50 border-2 border-yellow-200 flex items-center justify-center mb-4">
              <StickyNote className="w-8 h-8 text-yellow-400" />
            </div>
            <p className="text-foreground font-semibold text-lg">No notes yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Use notes to jot down quick thoughts, reminders, or anything work-related.
            </p>
            <Button className="mt-6 gap-2" onClick={openNew}>
              <Plus className="w-4 h-4" /> Write your first note
            </Button>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="empty-state">
            <p className="text-muted-foreground">No notes match "{searchTerm}"</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "break-inside-avoid rounded-xl border p-4 group relative cursor-pointer transition-all duration-150",
                  "hover:shadow-md hover:-translate-y-0.5",
                  getNoteColor(note.id)
                )}
                onClick={() => openEdit(note)}
              >
                {/* 3-dot menu */}
                <div
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-lg bg-white/70 hover:bg-white transition-colors">
                        <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(note)}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteConfirm(note.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Content */}
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap pr-6">
                  {note.content}
                </p>

                {/* Timestamp */}
                <p className="text-[10px] text-muted-foreground/60 mt-3">
                  {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Note Editor Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingNote ? "Edit Note" : "New Note"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note here..."
              rows={8}
              autoFocus
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring transition-colors leading-relaxed"
            />
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={!content.trim()}>
                {editingNote ? "Save Changes" : "Add Note"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Note?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This note will be permanently deleted. This action cannot be undone.</p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
