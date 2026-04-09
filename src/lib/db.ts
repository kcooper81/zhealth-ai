import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Conversation,
  ChatMessage,
  Workspace,
  FileAttachment,
  PendingAction,
  ActionResult,
  ReportData,
  QuickAction,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a Supabase conversation row + its messages into our Conversation type */
function mapConversation(row: any, messageRows?: any[]): Conversation {
  const messages: ChatMessage[] = (messageRows || []).map(mapMessage);
  return {
    id: row.id,
    title: row.title,
    messages,
    pageContextId: row.page_context_id ?? undefined,
    workspace: (row.workspace || 'all') as Workspace,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: any): ChatMessage {
  return {
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    timestamp: row.created_at,
    files: row.files as FileAttachment[] | undefined,
    pendingAction: row.pending_action as PendingAction | null | undefined,
    actionResult: row.action_result as ActionResult | null | undefined,
    reportData: row.report_data as ReportData | null | undefined,
  };
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function listConversations(
  userId: string,
  workspace?: string,
  limit = 50
): Promise<Conversation[]> {
  if (!isSupabaseConfigured) return [];
  try {
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (workspace && workspace !== 'all') {
      query = query.eq('workspace', workspace);
    }
    const { data, error } = await query;
    if (error) { console.error('listConversations error:', error); return []; }
    return (data || []).map((row: any) => mapConversation(row, []));
  } catch (e) { console.error('listConversations exception:', e); return []; }
}

export async function getConversation(id: string): Promise<Conversation | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data: convRow, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();
    if (convError || !convRow) return null;

    const { data: msgRows, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    if (msgError) { console.error('getConversation messages error:', msgError); }

    return mapConversation(convRow, msgRows || []);
  } catch (e) { console.error('getConversation exception:', e); return null; }
}

export async function createConversation(
  userId: string,
  title: string,
  workspace: string,
  pageContextId?: number,
  userEmail?: string
): Promise<Conversation | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        user_email: userEmail || null,
        title,
        workspace: workspace || 'all',
        page_context_id: pageContextId || null,
      })
      .select()
      .single();
    if (error) { console.error('createConversation error:', error); return null; }
    return mapConversation(data, []);
  } catch (e) { console.error('createConversation exception:', e); return null; }
}

export async function updateConversation(
  id: string,
  data: { title?: string }
): Promise<Conversation | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) updatePayload.title = data.title;

    const { data: row, error } = await supabase
      .from('conversations')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('updateConversation error:', error); return null; }
    return mapConversation(row, []);
  } catch (e) { console.error('updateConversation exception:', e); return null; }
}

export async function deleteConversation(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);
    if (error) { console.error('deleteConversation error:', error); return false; }
    return true;
  } catch (e) { console.error('deleteConversation exception:', e); return false; }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function addMessage(
  conversationId: string,
  message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    files?: FileAttachment[] | null;
    pendingAction?: PendingAction | null;
    actionResult?: ActionResult | null;
    reportData?: ReportData | null;
  }
): Promise<ChatMessage | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: message.role,
        content: message.content,
        files: message.files || null,
        pending_action: message.pendingAction || null,
        action_result: message.actionResult || null,
        report_data: message.reportData || null,
      })
      .select()
      .single();
    if (error) { console.error('addMessage error:', error); return null; }

    // Also touch the conversation's updated_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return mapMessage(data);
  } catch (e) { console.error('addMessage exception:', e); return null; }
}

export async function updateMessage(
  id: string,
  data: {
    content?: string;
    actionResult?: ActionResult | null;
    reportData?: ReportData | null;
  }
): Promise<ChatMessage | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const updatePayload: Record<string, any> = {};
    if (data.content !== undefined) updatePayload.content = data.content;
    if (data.actionResult !== undefined) updatePayload.action_result = data.actionResult;
    if (data.reportData !== undefined) updatePayload.report_data = data.reportData;

    const { data: row, error } = await supabase
      .from('messages')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('updateMessage error:', error); return null; }
    return mapMessage(row);
  } catch (e) { console.error('updateMessage exception:', e); return null; }
}

export async function getLastMessages(
  conversationId: string,
  limit: number
): Promise<ChatMessage[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { console.error('getLastMessages error:', error); return []; }
    // Reverse so they are in chronological order
    return (data || []).reverse().map(mapMessage);
  } catch (e) { console.error('getLastMessages exception:', e); return []; }
}

// ---------------------------------------------------------------------------
// User Preferences
// ---------------------------------------------------------------------------

export interface UserPreferences {
  userId: string;
  userEmail?: string;
  selectedModel: string;
  workspace: string;
  theme: string;
  sidebarCollapsed: boolean;
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Row not found — create default
      const { data: newRow, error: insertError } = await supabase
        .from('user_preferences')
        .insert({ user_id: userId })
        .select()
        .single();
      if (insertError) { console.error('getUserPreferences insert error:', insertError); return null; }
      return mapPreferences(newRow);
    }
    if (error) { console.error('getUserPreferences error:', error); return null; }
    return mapPreferences(data);
  } catch (e) { console.error('getUserPreferences exception:', e); return null; }
}

export async function updateUserPreferences(
  userId: string,
  data: Partial<Omit<UserPreferences, 'userId'>>
): Promise<UserPreferences | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.userEmail !== undefined) updatePayload.user_email = data.userEmail;
    if (data.selectedModel !== undefined) updatePayload.selected_model = data.selectedModel;
    if (data.workspace !== undefined) updatePayload.workspace = data.workspace;
    if (data.theme !== undefined) updatePayload.theme = data.theme;
    if (data.sidebarCollapsed !== undefined) updatePayload.sidebar_collapsed = data.sidebarCollapsed;

    const { data: row, error } = await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, ...updatePayload },
        { onConflict: 'user_id' }
      )
      .select()
      .single();
    if (error) { console.error('updateUserPreferences error:', error); return null; }
    return mapPreferences(row);
  } catch (e) { console.error('updateUserPreferences exception:', e); return null; }
}

function mapPreferences(row: any): UserPreferences {
  return {
    userId: row.user_id,
    userEmail: row.user_email || undefined,
    selectedModel: row.selected_model || 'gemini-2.0-flash',
    workspace: row.workspace || 'all',
    theme: row.theme || 'light',
    sidebarCollapsed: row.sidebar_collapsed ?? false,
  };
}

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

export async function logActivity(
  userId: string,
  actionType: string,
  details?: {
    userEmail?: string;
    workspace?: string;
    targetType?: string;
    targetId?: string;
    extra?: Record<string, any>;
  }
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('activity_log').insert({
      user_id: userId,
      user_email: details?.userEmail || null,
      action_type: actionType,
      workspace: details?.workspace || null,
      target_type: details?.targetType || null,
      target_id: details?.targetId || null,
      details: details?.extra || null,
    });
  } catch (e) { console.error('logActivity exception:', e); }
}

export async function getActivityLog(params: {
  userId?: string;
  workspace?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  try {
    let query = supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(params.limit || 50);

    if (params.userId) query = query.eq('user_id', params.userId);
    if (params.workspace) query = query.eq('workspace', params.workspace);
    if (params.offset) query = query.range(params.offset, params.offset + (params.limit || 50) - 1);

    const { data, error } = await query;
    if (error) { console.error('getActivityLog error:', error); return []; }
    return data || [];
  } catch (e) { console.error('getActivityLog exception:', e); return []; }
}

// ---------------------------------------------------------------------------
// Saved Reports
// ---------------------------------------------------------------------------

export async function saveReport(
  userId: string,
  title: string,
  reportType: string,
  reportData: any,
  workspace?: string
): Promise<any | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('saved_reports')
      .insert({
        user_id: userId,
        title,
        report_type: reportType,
        report_data: reportData,
        workspace: workspace || null,
      })
      .select()
      .single();
    if (error) { console.error('saveReport error:', error); return null; }
    return data;
  } catch (e) { console.error('saveReport exception:', e); return null; }
}

export async function listSavedReports(userId: string): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('saved_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) { console.error('listSavedReports error:', error); return []; }
    return data || [];
  } catch (e) { console.error('listSavedReports exception:', e); return []; }
}

export async function deleteSavedReport(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('saved_reports')
      .delete()
      .eq('id', id);
    if (error) { console.error('deleteSavedReport error:', error); return false; }
    return true;
  } catch (e) { console.error('deleteSavedReport exception:', e); return false; }
}

// ---------------------------------------------------------------------------
// Quick Actions
// ---------------------------------------------------------------------------

function mapQuickAction(row: any): QuickAction {
  return {
    id: row.id,
    label: row.label,
    prompt: row.prompt,
    isDefault: row.is_default ?? false,
    isHidden: row.is_hidden ?? false,
    sortOrder: row.sort_order ?? 0,
    workspace: row.workspace,
  };
}

/**
 * Ensure the quick_actions table exists. Runs once on first call.
 * If the table already exists, Supabase returns an error we can safely ignore.
 */
let quickActionsTableChecked = false;
async function ensureQuickActionsTable(): Promise<void> {
  if (quickActionsTableChecked || !isSupabaseConfigured) return;
  quickActionsTableChecked = true;
  try {
    // Try a lightweight query — if it fails the table doesn't exist
    const { error } = await supabase
      .from('quick_actions')
      .select('id')
      .limit(1);
    if (error && error.code === '42P01') {
      // Table doesn't exist — create it via rpc if available, otherwise log
      console.warn('quick_actions table does not exist. Please run the migration SQL.');
    }
  } catch {
    // Ignore — table may or may not exist
  }
}

export async function getQuickActions(userId: string, workspace: string): Promise<QuickAction[]> {
  if (!isSupabaseConfigured) return [];
  await ensureQuickActionsTable();
  try {
    const { data, error } = await supabase
      .from('quick_actions')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace', workspace)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      // Table might not exist — fail gracefully
      if (error.code === '42P01') return [];
      console.error('getQuickActions error:', error);
      return [];
    }
    return (data || []).map(mapQuickAction);
  } catch (e) { console.error('getQuickActions exception:', e); return []; }
}

export async function saveQuickAction(
  userId: string,
  workspace: string,
  label: string,
  prompt: string
): Promise<QuickAction | null> {
  if (!isSupabaseConfigured) return null;
  await ensureQuickActionsTable();
  try {
    // Get max sort_order for this user+workspace
    const { data: existing } = await supabase
      .from('quick_actions')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('workspace', workspace)
      .order('sort_order', { ascending: false })
      .limit(1);
    const maxOrder = existing && existing.length > 0 ? (existing[0].sort_order || 0) : 0;

    const { data, error } = await supabase
      .from('quick_actions')
      .insert({
        user_id: userId,
        workspace,
        label,
        prompt,
        sort_order: maxOrder + 1,
        is_default: false,
        is_hidden: false,
      })
      .select()
      .single();
    if (error) { console.error('saveQuickAction error:', error); return null; }
    return mapQuickAction(data);
  } catch (e) { console.error('saveQuickAction exception:', e); return null; }
}

export async function updateQuickAction(
  id: string,
  data: { label?: string; prompt?: string; sort_order?: number }
): Promise<QuickAction | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const updatePayload: Record<string, any> = {};
    if (data.label !== undefined) updatePayload.label = data.label;
    if (data.prompt !== undefined) updatePayload.prompt = data.prompt;
    if (data.sort_order !== undefined) updatePayload.sort_order = data.sort_order;

    const { data: row, error } = await supabase
      .from('quick_actions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('updateQuickAction error:', error); return null; }
    return mapQuickAction(row);
  } catch (e) { console.error('updateQuickAction exception:', e); return null; }
}

export async function deleteQuickAction(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('quick_actions')
      .delete()
      .eq('id', id);
    if (error) { console.error('deleteQuickAction error:', error); return false; }
    return true;
  } catch (e) { console.error('deleteQuickAction exception:', e); return false; }
}

export async function hideDefaultAction(
  userId: string,
  workspace: string,
  prompt: string
): Promise<QuickAction | null> {
  if (!isSupabaseConfigured) return null;
  await ensureQuickActionsTable();
  try {
    // Check if there's already a record for this default action
    const { data: existing } = await supabase
      .from('quick_actions')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace', workspace)
      .eq('prompt', prompt)
      .eq('is_default', true)
      .limit(1);

    if (existing && existing.length > 0) {
      // Toggle hidden state
      const { data: row, error } = await supabase
        .from('quick_actions')
        .update({ is_hidden: !existing[0].is_hidden })
        .eq('id', existing[0].id)
        .select()
        .single();
      if (error) { console.error('hideDefaultAction update error:', error); return null; }
      return mapQuickAction(row);
    }

    // Create a new row marking this default as hidden
    const { data, error } = await supabase
      .from('quick_actions')
      .insert({
        user_id: userId,
        workspace,
        label: prompt.slice(0, 40),
        prompt,
        is_default: true,
        is_hidden: true,
        sort_order: 0,
      })
      .select()
      .single();
    if (error) { console.error('hideDefaultAction insert error:', error); return null; }
    return mapQuickAction(data);
  } catch (e) { console.error('hideDefaultAction exception:', e); return null; }
}

export async function reorderQuickActions(
  userId: string,
  workspace: string,
  orderedIds: string[]
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    // Update sort_order for each ID
    const updates = orderedIds.map((id, index) =>
      supabase
        .from('quick_actions')
        .update({ sort_order: index })
        .eq('id', id)
        .eq('user_id', userId)
    );
    await Promise.all(updates);
    return true;
  } catch (e) { console.error('reorderQuickActions exception:', e); return false; }
}

export async function resetQuickActions(userId: string, workspace: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('quick_actions')
      .delete()
      .eq('user_id', userId)
      .eq('workspace', workspace);
    if (error) { console.error('resetQuickActions error:', error); return false; }
    return true;
  } catch (e) { console.error('resetQuickActions exception:', e); return false; }
}
