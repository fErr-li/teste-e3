import { CAMPOS_FICHA } from '../leads/interfaces/lead.interface';
import { LlmFerramenta } from '../llm/interfaces/llm-provider.interface';

// Definições (JSON Schema) das ações que o LLM pode chamar. Ver PDF, item 4.
export const FERRAMENTAS: LlmFerramenta[] = [
  {
    nome: 'adicionar_tag',
    descricao: 'Marca o lead com uma tag (ex.: qualificado, desqualificado, cliente-antigo).',
    parametros: {
      type: 'object',
      properties: { tag: { type: 'string' } },
      required: ['tag'],
    },
  },
  {
    nome: 'mover_estagio',
    descricao: 'Move o lead para um estágio do funil.',
    parametros: {
      type: 'object',
      properties: { estagio: { type: 'string' } },
      required: ['estagio'],
    },
  },
  {
    nome: 'atualizar_ficha',
    descricao:
      'Grava um dado que o lead DISSE explicitamente. Nunca deduza nem invente. ' +
      'Em "evidencia", copie o trecho exato da mensagem do lead que comprova o valor.',
    parametros: {
      type: 'object',
      properties: {
        campo: { type: 'string', enum: [...CAMPOS_FICHA] },
        valor: { type: ['string', 'number'] },
        evidencia: { type: 'string' },
      },
      required: ['campo', 'valor', 'evidencia'],
    },
  },
  {
    nome: 'notificar_equipe',
    descricao: 'Avisa a equipe de vendas com um resumo do lead.',
    parametros: {
      type: 'object',
      properties: { resumo: { type: 'string' } },
      required: ['resumo'],
    },
  },
  {
    nome: 'transferir_humano',
    descricao: 'Para a IA e passa a conversa para um atendente humano.',
    parametros: {
      type: 'object',
      properties: { motivo: { type: 'string' } },
      required: ['motivo'],
    },
  },
  {
    nome: 'consultar_agenda',
    descricao: 'Retorna os horários livres para visita técnica.',
    parametros: { type: 'object', properties: {} },
  },
  {
    nome: 'marcar_agenda',
    descricao: 'Agenda a visita técnica em um dos horários retornados por consultar_agenda.',
    parametros: {
      type: 'object',
      properties: {
        horario: { type: 'string', description: 'O campo "horario" exatamente como veio de consultar_agenda' },
      },
      required: ['horario'],
    },
  },
];
