export interface ResultadoTurno {
  message_id: string;
  answered_messages: { message_id: string }[];
  tenant_id: string;
  telefone: string;
  texto: string;
  timestamp: string;
}
