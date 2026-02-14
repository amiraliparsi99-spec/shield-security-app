import { SupabaseClient } from '@supabase/supabase-js';
import type { 
  Database, 
  Document, 
  DocumentInsert, 
  DocumentType,
  DocumentStatus 
} from '../database.types';

type TypedSupabaseClient = SupabaseClient<Database>;

export async function getPersonnelDocuments(
  supabase: TypedSupabaseClient,
  personnelId: string,
  options?: {
    type?: DocumentType;
    status?: DocumentStatus;
  }
): Promise<Document[]> {
  let query = supabase
    .from('documents')
    .select('*')
    .eq('personnel_id', personnelId)
    .order('created_at', { ascending: false });

  if (options?.type) {
    query = query.eq('type', options.type);
  }

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching documents:', error);
    return [];
  }

  return data || [];
}

export async function getDocumentById(
  supabase: TypedSupabaseClient,
  documentId: string
): Promise<Document | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) {
    console.error('Error fetching document:', error);
    return null;
  }

  return data;
}

export async function createDocument(
  supabase: TypedSupabaseClient,
  document: DocumentInsert
): Promise<Document | null> {
  const { data, error } = await supabase
    .from('documents')
    .insert(document)
    .select()
    .single();

  if (error) {
    console.error('Error creating document:', error);
    return null;
  }

  return data;
}

export async function updateDocumentStatus(
  supabase: TypedSupabaseClient,
  documentId: string,
  status: DocumentStatus,
  verifiedBy?: string,
  rejectionReason?: string
): Promise<Document | null> {
  const updates: Partial<Document> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'verified' && verifiedBy) {
    updates.verified_at = new Date().toISOString();
    updates.verified_by = verifiedBy;
  }

  if (status === 'rejected' && rejectionReason) {
    updates.rejection_reason = rejectionReason;
  }

  const { data, error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', documentId)
    .select()
    .single();

  if (error) {
    console.error('Error updating document:', error);
    return null;
  }

  return data;
}

export async function deleteDocument(
  supabase: TypedSupabaseClient,
  documentId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId);

  if (error) {
    console.error('Error deleting document:', error);
    return false;
  }

  return true;
}

export async function getExpiringDocuments(
  supabase: TypedSupabaseClient,
  personnelId: string,
  daysAhead: number = 30
): Promise<Document[]> {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('personnel_id', personnelId)
    .eq('status', 'verified')
    .not('expiry_date', 'is', null)
    .lte('expiry_date', futureDate.toISOString().split('T')[0])
    .gte('expiry_date', new Date().toISOString().split('T')[0]);

  if (error) {
    console.error('Error fetching expiring documents:', error);
    return [];
  }

  return data || [];
}

export async function getExpiredDocuments(
  supabase: TypedSupabaseClient,
  personnelId: string
): Promise<Document[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('personnel_id', personnelId)
    .not('expiry_date', 'is', null)
    .lt('expiry_date', today);

  if (error) {
    console.error('Error fetching expired documents:', error);
    return [];
  }

  // Update status to expired
  if (data && data.length > 0) {
    await supabase
      .from('documents')
      .update({ status: 'expired' })
      .in('id', data.map(d => d.id));
  }

  return data || [];
}

// Upload document file to storage
export async function uploadDocumentFile(
  supabase: TypedSupabaseClient,
  personnelId: string,
  file: File
): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${personnelId}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('documents')
    .upload(fileName, file);

  if (error) {
    console.error('Error uploading file:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
