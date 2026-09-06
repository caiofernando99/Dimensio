export interface CommPeerInfo {
  id: string;
  name: string;
  role: string;
  lastSeen: number;
}

export type SignalMessageKind =
  | 'presence'
  | 'offer'
  | 'answer'
  | 'ice'
  | 'candidate'
  | 'bye'
  | 'voice_start'
  | 'voice_stop'
  | 'audio_chunk'
  | 'state_ping';

export interface SignalMessage {
  mid: string;
  kind: SignalMessageKind;
  sender: string;
  senderName?: string;
  senderRole?: string;
  to?: string;
  channel?: string;
  payload?: unknown;
  ts: number;
  /** Marcado pela presença enviada ao abrir explicitamente um canal direto
   * (distingue de presenças de heartbeat de canais já encerrados). */
  directOpen?: boolean;
}

export interface CommChannel {
  id: string;
  label: string;
  kind: 'geral' | 'task' | 'direct';
  taskId?: string;
  collabId?: string;
}

export type AudioMode = 'ptt' | 'open';

export interface RemotePeerState {
  id: string;
  name: string;
  role: string;
  status: 'connecting' | 'connected' | 'disconnected';
  speaking: boolean;
}
