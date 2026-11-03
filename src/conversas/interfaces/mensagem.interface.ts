export type Autor = 'lead' | 'humano' | 'ia';
export type StatusMensagem = 'pendente' | 'processada';

export interface Mensagem {
  message_id: string;
  tenant_id: string;
  telefone: string;
  texto: string;
  timestamp: string;
  autor: Autor;
  status: StatusMensagem;
  respondida_por: string | null;
  simulacao: boolean;
}
