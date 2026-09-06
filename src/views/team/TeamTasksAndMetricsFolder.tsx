import React from 'react';
import {
  FolderTree,
  Plus,
  ListChecks,
  GitBranch,
  Sparkles,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  Button,
  StatCard,
} from '../../components/ui';
import { TaskTreeList } from '../../components/TaskTreeList';
import { MetricManager } from '../../components/MetricManager';
import { useApp } from '../../context/AppContext';
import { Task } from '../../types';

interface TeamTasksAndMetricsFolderProps {
  onOpenCreateRootTask: () => void;
  onOpenCreateSubtask: (parentTaskId: string) => void;
  onOpenEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

export const TeamTasksAndMetricsFolder: React.FC<TeamTasksAndMetricsFolderProps> = ({
  onOpenCreateRootTask,
  onOpenCreateSubtask,
  onOpenEditTask,
  onDeleteTask,
}) => {
  const { state } = useApp();

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Gestão de Tarefas & Estrutura Hierárquica */}
      <Card id="tasks" className="h-full flex flex-col scroll-mt-28">
        <CardHeader
          icon={<FolderTree className="w-4.5 h-4.5" />}
          title="Gestão de Tarefas & Postos de Trabalho"
          subtitle="Crie tarefas e ramificações hierárquicas (ex: Recebimento ➔ Conferência, Separação), associe skills necessárias, cargos e metas operacionais."
          actions={
            <Button size="sm" icon={Plus} onClick={onOpenCreateRootTask}>
              Nova Tarefa Principal
            </Button>
          }
        />

        {/* Task Stats Bar */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total de Tarefas" value={state.tasks.length} icon={ListChecks} tone="primary" />
          <StatCard
            label="Principais (Raiz)"
            value={state.tasks.filter((t) => !t.parentId).length}
            icon={FolderTree}
            tone="success"
          />
          <StatCard
            label="Subtarefas"
            value={state.tasks.filter((t) => !!t.parentId).length}
            icon={GitBranch}
            tone="purple"
          />
          <StatCard
            label="Com Skills"
            value={state.tasks.filter((t) => (t.requiredSkills || []).length > 0).length}
            icon={Sparkles}
            tone="warning"
          />
        </div>

        {/* Hierarchical Task Tree Component */}
        <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1 pb-1">
          <TaskTreeList
            tasks={state.tasks}
            onEditTask={onOpenEditTask}
            onDeleteTask={onDeleteTask}
            onAddSubtask={onOpenCreateSubtask}
          />
        </div>
      </Card>

      {/* 2. Métricas do Setor (Indicadores, Metas e Telemetria) */}
      <div id="metrics" className="scroll-mt-28">
        <MetricManager />
      </div>
    </div>
  );
};
