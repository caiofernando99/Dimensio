import React from 'react';

/**
 * Classificação e padronização dos tipos de interação do app Dimensio.
 * Este modelo serve como referência central para implementação de novos módulos,
 * garantindo consistência de comportamento, feedback, nomenclatura e visual.
 */

export type AppInteractionCategory =
  | 'navigation'   // Navegação entre módulos, abas, sub-visualizações e paginação
  | 'filter'       // Filtragem de listas (busca textual, seletores únicos, multisseleção, datas)
  | 'selection'    // Seleção de entidades (clique simples, multisseleção com checkbox/shift, pool)
  | 'mutation'     // Criação, alteração, exclusão, troca de status e alocação de dados
  | 'modal_dialog' // Diálogos modais, wizards de configuração e confirmações de ações críticas
  | 'feedback'     // Toasts de aviso, alertas inline, validações de formulário e logs de auditoria
  | 'shortcut'     // Atalhos rápidos de teclado e teclas de escape/confirmação
  | 'drag_drop';   // Arrastar e soltar cards de colaboradores, tarefas ou reordenação

/**
 * Tipos de interação de filtro
 */
export type FilterInteractionType =
  | 'text_search'       // Input de busca com debounce e botão de limpar
  | 'single_select'     // Seletor único com popover padronizado e busca interna se > 5 itens
  | 'multi_select'      // Seletor múltiplo com checkboxes, contadores e botão "todos/limpar"
  | 'date_picker'       // Seletor de data única ou intervalo
  | 'quick_toggle'      // Toggle / switch de filtro rápido (ex: apenas hoje, inativos)
  | 'tab_group'         // Grupo de abas ou segmented control para filtros categóricos
  | 'reset_all';        // Ação de redefinir todos os filtros aplicados

/**
 * Tipos de interação de seleção
 */
export type SelectionInteractionType =
  | 'single_click'      // Seleciona um único item substituindo o anterior
  | 'toggle_checkbox'   // Alterna a inclusão/remoção do item no array de selecionados
  | 'select_all'        // Seleciona todos os itens visíveis ou da categoria
  | 'clear_selection'   // Desmarca todos os itens selecionados
  | 'context_menu'      // Clique com botão direito para menu de ações rápidas
  | 'pool_selection';   // Seleção a partir do pool de não alocados ou disponíveis

/**
 * Tipos de mutação de dados
 */
export type MutationInteractionType =
  | 'create'            // Criação de nova entidade
  | 'update_inline'     // Edição rápida diretamente na tabela ou card
  | 'update_modal'      // Edição detalhada via formulário modal
  | 'delete'            // Exclusão com feedback e confirmação
  | 'toggle_status'     // Alternância rápida de status (ex: a fazer -> concluída, presente -> atraso)
  | 'batch_assign'      // Alocação em lote de múltiplos colaboradores/tarefas
  | 'reorder';          // Reordenação de prioridade ou posição

/**
 * Tipos de feedback e comunicação ao usuário
 */
export type FeedbackInteractionType =
  | 'toast_notice'      // Mensagem flutuante temporária (sucesso/aviso/erro)
  | 'confirm_dialog'    // Modal modal de confirmação para ações destrutivas ou irreversíveis
  | 'inline_alert'      // Bloco de aviso/alerta persistente em um card ou formulário
  | 'audit_log';        // Registro rastreável no histórico de auditoria do sistema

/**
 * Interface padronizada para opções de qualquer seletor do app (único ou múltiplo)
 */
export interface StandardSelectorOption {
  label: string;
  value: string;
  badge?: string | number;
  icon?: React.ReactNode;
  hint?: string;
  disabled?: boolean;
}

/**
 * Definição padronizada de um controle de filtro
 */
export interface StandardFilterDefinition {
  id: string;
  label: string;
  type: FilterInteractionType;
  placeholder?: string;
  allLabel?: string;
  icon?: React.ReactNode;
  options?: StandardSelectorOption[];
  required?: boolean;
}

/**
 * Especificação de atalhos de teclado padronizados
 */
export interface AppShortcutSpec {
  key: string;
  label: string;
  description: string;
  category: AppInteractionCategory;
}
