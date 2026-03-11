import React, { useState, useRef } from 'react';
import { Upload, FileText, Trash2, Download, Loader2, File, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface ProjectDocumentsProps {
  projectId: string;
}

interface ProjectDocument {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  document_type: string;
  notes: string;
  uploaded_by: string | null;
  created_at: string;
}

const DOC_TYPES = [
  { value: 'budget', label: 'Budget' },
  { value: 'change-order', label: 'Change Order' },
  { value: 'contract', label: 'Contract' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'other', label: 'Other' },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectDocuments({ projectId }: ProjectDocumentsProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('budget');
  const [notes, setNotes] = useState('');

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['project_documents', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProjectDocument[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: ProjectDocument) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-documents')
        .remove([doc.file_path]);
      if (storageError) console.error('Storage delete error:', storageError);

      // Delete from table
      const { error } = await supabase
        .from('project_documents')
        .delete()
        .eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project_documents', projectId] });
      toast({ title: 'Document deleted' });
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      for (const file of Array.from(files)) {
        const timestamp = Date.now();
        const filePath = `${projectId}/${timestamp}-${file.name}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('project-documents')
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        // Insert record
        const { error: insertError } = await supabase
          .from('project_documents')
          .insert({
            project_id: projectId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            document_type: docType,
            notes: notes,
            uploaded_by: user?.id || null,
          });
        if (insertError) throw insertError;
      }

      toast({ title: 'Documents uploaded', description: `${files.length} file(s) uploaded successfully.` });
      setNotes('');
      qc.invalidateQueries({ queryKey: ['project_documents', projectId] });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (doc: ProjectDocument) => {
    const { data, error } = await supabase.storage
      .from('project-documents')
      .createSignedUrl(doc.file_path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: 'Error', description: 'Could not generate download link', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const typeLabel = (type: string) => DOC_TYPES.find(d => d.value === type)?.label || type;

  const typeBadgeClass = (type: string) => {
    switch (type) {
      case 'budget': return 'bg-primary/10 text-primary';
      case 'change-order': return 'bg-amber-500/10 text-amber-600';
      case 'contract': return 'bg-blue-500/10 text-blue-600';
      case 'receipt': return 'bg-green-500/10 text-green-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="card-elevated p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-muted-foreground" />
          Documents
        </h3>
      </div>

      {/* Upload area */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <p className="text-sm font-display font-semibold">Upload Documents</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-body">Document Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-body">Notes (optional)</Label>
            <Input
              className="mt-1"
              placeholder="e.g. CO #3 — added kitchen fixtures"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg"
            onChange={handleUpload}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
            disabled={uploading}
          />
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
            {uploading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm font-body">Uploading...</span>
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-sm font-body text-muted-foreground">
                  Drop files here or click to upload
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, Excel, CSV, Word, or images — multiple files supported
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground font-body text-sm">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <File className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-medium text-sm truncate">{doc.file_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${typeBadgeClass(doc.document_type)}`}>
                    {typeLabel(doc.document_type)}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
                {doc.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(doc)}
                  className="h-8 w-8 p-0"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(doc)}
                  disabled={deleteMutation.isPending}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
