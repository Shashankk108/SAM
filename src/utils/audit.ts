import { supabase } from '../lib/supabase';

export type ActionType =
  | 'stage_change'
  | 'salary_change'
  | 'promotion'
  | 'pool_change'
  | 'fx_rate_change'
  | 'fx_rate_add'
  | 'fx_rate_remove'
  | 'column_add'
  | 'column_remove'
  | 'slt_submit'
  | 'slt_unlock'
  | 'data_import'
  | 'data_export'
  | 'demo_load'
  | 'cycle_reset'
  | 'employee_update';

export interface AuditEntry {
  id: string;
  cycle_id: string;
  timestamp: string;
  actor_role: string;
  actor_name: string;
  action_type: ActionType;
  action_detail: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  old_value: string;
  new_value: string;
  metadata: Record<string, unknown>;
}

interface LogAuditParams {
  cycleId?: string | null;
  actorRole: string;
  actorName: string;
  actionType: ActionType;
  actionDetail: string;
  entityType: string;
  entityId: string;
  entityName: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await supabase.from('sam_audit_trail').insert({
      cycle_id: params.cycleId || null,
      actor_role: params.actorRole,
      actor_name: params.actorName,
      action_type: params.actionType,
      action_detail: params.actionDetail,
      entity_type: params.entityType,
      entity_id: params.entityId,
      entity_name: params.entityName,
      old_value: params.oldValue || '',
      new_value: params.newValue || '',
      metadata: params.metadata || {},
    });
  } catch {
    // never block main flow
  }
}

export async function fetchAuditTrail(cycleId: string): Promise<AuditEntry[]> {
  const { data } = await supabase
    .from('sam_audit_trail')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('timestamp', { ascending: false })
    .limit(500);
  return (data || []).map(d => ({
    id: d.id as string,
    cycle_id: d.cycle_id as string,
    timestamp: d.timestamp as string,
    actor_role: d.actor_role as string,
    actor_name: d.actor_name as string,
    action_type: d.action_type as ActionType,
    action_detail: d.action_detail as string,
    entity_type: d.entity_type as string,
    entity_id: d.entity_id as string,
    entity_name: d.entity_name as string,
    old_value: (d.old_value as string) || '',
    new_value: (d.new_value as string) || '',
    metadata: (d.metadata as Record<string, unknown>) || {},
  }));
}
