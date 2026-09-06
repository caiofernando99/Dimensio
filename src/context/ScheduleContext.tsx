import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import type { AppState, ShiftGroup, BreakSlot, Task, ScheduledAbsence, Collaborator, DailyReport, AutoAssignOptions } from '../types';
import { generateId, isScaleOff, getCollaboratorStatus, formatDateBR, getActiveAbsence, shuffleArray } from '../utils/helpers';
import { initialAppState } from '../utils/initialData';
import { executeAutoAssign } from '../utils/autoAssignEngine';
import { getRootTask } from '../utils/taskTreeHelpers';

interface ScheduleContextType {
  state: {
    year: number;
    selectedDate: string;
    calendar: Record<string, string>;
    tasks: Task[];
    breaks: BreakSlot[];
    attendance: Record<string, Record<string, boolean | { absent: true; reason: string }>>;
    intervals: Record<string, Record<string, string[]>>;
    dailyReports: Record<string, DailyReport>;
    history: AppState['history'];
    selectedShiftFilter?: string;
    selectedTLFilter?: string;
  };
  setDate: (date: string) => void;
  setYear: (year: number) => void;
  markDayScale: (dateStr: string, scale: string) => void;
  toggleAttendance: (collaboratorId: string, present: boolean) => void;
  setAttendanceStatus: (collaboratorId: string, status: 'presente' | 'ausente' | 'atestado' | 'banco_horas' | 'falta_injustificada' | 'atraso') => void;
  resetAttendance: () => void;
  assignTask: (collaboratorId: string, taskId: string) => void;
  unassignTask: (collaboratorId: string) => void;
  clearAssignments: () => void;
  clearTaskAssignments: (taskId: string) => void;
  autoAssign: (options?: AutoAssignOptions) => void;
  addTask: (taskDataOrName: string | (Partial<Task> & { name: string }), allowedRoles?: string[], allowedCategories?: string[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addBreakSlot: (time: string, capacity?: number, shift?: string) => void;
  updateBreakSlot: (id: string, updates: Partial<BreakSlot>) => void;
  deleteBreakSlot: (id: string) => void;
  moveBreakInterval: (collaboratorId: string, fromBreakId: string | null, toBreakId: string | null) => void;
  generateBreaks: (mode?: 'parent' | 'subtasks') => void;
  clearBreaks: () => void;
  setAbsenceReason: (collaboratorId: string, reason: string) => void;
  setOccurrence: (collaboratorId: string, text: string) => void;
  setGeneralNotes: (notes: string) => void;
  saveDailyReport: () => void;
  saveHistory: () => void;
  setSelectedGlobalFilters: (filters: { shift?: string; teamLeader?: string }) => void;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export const ScheduleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem('people-scheduler-v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...initialAppState,
          ...parsed,
        };
      }
    } catch {
      // Fallback
    }
    return initialAppState;
  });

  const updateState = (updater: (prev: typeof state) => typeof state) => {
    setState((prev) => {
      const next = updater(prev);
      return { ...next, updatedAtMs: Date.now() };
    });
  };

  const setDate = (selectedDate: string) => {
    updateState((prev) => ({ ...prev, selectedDate }));
  };

  const setYear = (year: number) => {
    updateState((prev) => ({ ...prev, year }));
  };

  const markDayScale = (dateStr: string, scale: string) => {
    updateState((prev) => {
      const newCal = { ...prev.calendar };
      if (scale) {
        newCal[dateStr] = scale;
      } else {
        delete newCal[dateStr];
      }
      return { ...prev, calendar: newCal };
    });
  };

  const toggleAttendance = (collaboratorId: string, present: boolean) => {
    updateState((prev) => {
      const dateKey = prev.selectedDate;
      const dayAtt = { ...(prev.attendance[dateKey] || {}) };
      dayAtt[collaboratorId] = present;
      return {
        ...prev,
        attendance: { ...prev.attendance, [dateKey]: dayAtt },
      };
    });
  };

  const setAttendanceStatus = (collaboratorId: string, status: 'presente' | 'ausente' | 'atestado' | 'banco_horas' | 'falta_injustificada' | 'atraso') => {
    updateState((prev) => {
      const dateKey = prev.selectedDate;
      const dayAtt = { ...(prev.attendance[dateKey] || {}) };

      if (status === 'presente') {
        const collab = prev.collaborators.find((c) => c.id === collaboratorId);
        const offScale = collab ? isScaleOff(prev.calendar, dateKey, collab.scale) : false;
        const scheduledAbsence = collab ? getActiveAbsence(collab, dateKey) : null;
        if (!offScale && !scheduledAbsence) {
          delete dayAtt[collaboratorId];
        } else {
          dayAtt[collaboratorId] = true;
        }
      } else {
        dayAtt[collaboratorId] = { absent: true, reason: status };
      }

      const dayReport = prev.dailyReports[dateKey] || {};
      const absenceReasons = { ...(dayReport.absenceReasons || {}) };

      if (status === 'presente') {
        delete absenceReasons[collaboratorId];
      } else {
        const reasonLabels: Record<string, string> = {
          atraso: 'Atraso (Início de Turno)',
          atestado: 'Atestado Médico',
          banco_horas: 'Banco de Horas',
          falta_injustificada: 'Falta Injustificada',
          ausente: 'Ausente',
        };
        absenceReasons[collaboratorId] = reasonLabels[status] || status;
      }

      return {
        ...prev,
        attendance: { ...prev.attendance, [dateKey]: dayAtt },
        dailyReports: {
          ...prev.dailyReports,
          [dateKey]: { ...dayReport, absenceReasons },
        },
      };
    });
  };

  const resetAttendance = () => {
    updateState((prev) => {
      const dateKey = prev.selectedDate;
      const newAtt = { ...prev.attendance };
      delete newAtt[dateKey];
      return { ...prev, attendance: newAtt };
    });
  };

  const assignTask = (collaboratorId: string, taskId: string) => {
    updateState((prev) => {
      const updatedTasks = prev.tasks.map((t) => {
        const filtered = t.members.filter((m) => m !== collaboratorId);
        if (t.id === taskId) {
          return { ...t, members: [...filtered, collaboratorId] };
        }
        return { ...t, members: filtered };
      });
      return { ...prev, tasks: updatedTasks };
    });
  };

  const unassignTask = (collaboratorId: string) => {
    updateState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => ({ ...t, members: t.members.filter((m) => m !== collaboratorId) })),
    }));
  };

  const clearAssignments = () => {
    updateState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => ({ ...t, members: [] })),
    }));
  };

  const clearTaskAssignments = (taskId: string) => {
    updateState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, members: [] } : t)),
    }));
  };

  const autoAssign = (options: AutoAssignOptions = {}) => {
    updateState((prev) => {
      if (!prev.tasks.length) return prev;
      const activeShift = prev.selectedShiftFilter || 'ALL';
      const activeTL = prev.selectedTLFilter || 'ALL';

      const activePeople = prev.collaborators.filter((c) => {
        const colShift = c.shift || 'Geral';
        const matchesShift = activeShift === 'ALL' || activeShift === 'todos' || colShift === activeShift;
        const colTL = c.teamLeader || prev.defaultTeamLeader || 'Sem Time';
        const matchesTL = activeTL === 'ALL' || activeTL === 'todos' || colTL === activeTL;
        if (!matchesShift || !matchesTL) return false;

        const statusInfo = getCollaboratorStatus(c, prev.selectedDate, prev as any);
        return statusInfo.status === 'presente' || statusInfo.status === 'atraso';
      });

      const result = executeAutoAssign(activePeople, prev.tasks, options);
      return { ...prev, tasks: result.tasks };
    });
  };

  const addTask = (
    taskDataOrName: string | (Partial<Task> & { name: string }),
    allowedRoles: string[] = [],
    allowedCategories: string[] = []
  ) => {
    let newTask: Task;
    if (typeof taskDataOrName === 'object') {
      if (!taskDataOrName.name?.trim()) return;
      newTask = {
        id: taskDataOrName.id || generateId(),
        name: taskDataOrName.name.trim(),
        members: Array.isArray(taskDataOrName.members) ? taskDataOrName.members : [],
        allowedRoles: taskDataOrName.allowedRoles,
        allowedCategories: taskDataOrName.allowedCategories,
        requiredSkills: taskDataOrName.requiredSkills,
        parentId: taskDataOrName.parentId,
        priority: taskDataOrName.priority,
        minHeadcount: taskDataOrName.minHeadcount,
        maxHeadcount: taskDataOrName.maxHeadcount,
        description: taskDataOrName.description,
        active: taskDataOrName.active !== false,
        externalUrl: taskDataOrName.externalUrl?.trim() || undefined,
        shift: taskDataOrName.shift,
        allowedShifts: taskDataOrName.allowedShifts,
      };
    } else {
      if (!taskDataOrName.trim()) return;
      newTask = {
        id: generateId(),
        name: taskDataOrName.trim(),
        members: [],
        allowedRoles,
        allowedCategories,
        active: true,
      };
    }
    updateState((prev) => ({ ...prev, tasks: [...prev.tasks, newTask] }));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    updateState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  };

  const deleteTask = (id: string) => {
    updateState((prev) => ({
      ...prev,
      tasks: prev.tasks
        .filter((t) => t.id !== id)
        .map((t) => (t.parentId === id ? { ...t, parentId: undefined } : t)),
    }));
  };

  const addBreakSlot = (time: string, capacity?: number, shift?: string) => {
    const newSlot: BreakSlot = {
      id: generateId(),
      time: time || '20:00',
      shift: shift || state.teamShift || 'T2',
      capacity: capacity || undefined,
    };
    updateState((prev) => ({ ...prev, breaks: [...prev.breaks, newSlot] }));
  };

  const updateBreakSlot = (id: string, updates: Partial<BreakSlot>) => {
    updateState((prev) => ({
      ...prev,
      breaks: prev.breaks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
  };

  const deleteBreakSlot = (id: string) => {
    updateState((prev) => ({ ...prev, breaks: prev.breaks.filter((b) => b.id !== id) }));
  };

  const moveBreakInterval = (collaboratorId: string, fromBreakId: string | null, toBreakId: string | null) => {
    updateState((prev) => {
      const dateKey = prev.selectedDate;
      const dayIntervals = { ...(prev.intervals[dateKey] || {}) };

      if (fromBreakId && dayIntervals[fromBreakId]) {
        dayIntervals[fromBreakId] = dayIntervals[fromBreakId].filter((m) => m !== collaboratorId);
      }

      if (toBreakId) {
        dayIntervals[toBreakId] = [...(dayIntervals[toBreakId] || []).filter((m) => m !== collaboratorId), collaboratorId];
      }

      return {
        ...prev,
        intervals: { ...prev.intervals, [dateKey]: dayIntervals },
      };
    });
  };

  const generateBreaks = (mode: 'parent' | 'subtasks' = 'parent') => {
    updateState((prev) => {
      if (!prev.breaks.length) return prev;
      const dateKey = prev.selectedDate;
      const result: Record<string, string[]> = Object.fromEntries(prev.breaks.map((b) => [b.id, []]));

      const activePeople = prev.collaborators.filter((c) => {
        const hasAbsence = (c.absences || []).some((a) => dateKey >= a.startDate && dateKey <= a.endDate);
        const off = isScaleOff(prev.calendar, dateKey, c.scale);
        const manual = prev.attendance[dateKey]?.[c.id];
        if (hasAbsence) return false;
        if (manual !== undefined) {
          if (typeof manual === 'boolean') return manual;
          if (typeof manual === 'object' && manual.absent) return false;
          return true;
        }
        return !off;
      });

      if (activePeople.length === 0) {
        return {
          ...prev,
          intervals: { ...prev.intervals, [dateKey]: result },
        };
      }

      const taskFor: Record<string, string> = {};
      prev.tasks.forEach((t) => {
        const effectiveGroupId = mode === 'parent' ? (getRootTask(prev.tasks, t.id)?.id || t.id) : t.id;
        (t.members || []).forEach((m) => {
          taskFor[m] = effectiveGroupId;
        });
      });

      const groupsMap = new Map<string, Collaborator[]>();
      for (const person of activePeople) {
        const groupKey = `${person.shift || 'Geral'}__${taskFor[person.id] || 'unassigned'}`;
        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, []);
        }
        groupsMap.get(groupKey)!.push(person);
      }

      const shuffledGroups: Array<{ groupKey: string; members: Collaborator[] }> = [];
      groupsMap.forEach((members, groupKey) => {
        shuffledGroups.push({
          groupKey,
          members: shuffleArray(members),
        });
      });

      const groupsList = shuffleArray(shuffledGroups);
      const loadCount: Record<string, number> = {};

      for (const group of groupsList) {
        for (const person of group.members) {
          const eligible = prev.breaks.filter(
            (b) => !b.shift || b.shift === 'Geral' || b.shift === person.shift
          );
          const pool = eligible.length ? eligible : prev.breaks;
          const personTaskGroup = taskFor[person.id] || 'none';

          let minTaskLoad = Infinity;
          let minTotalLoad = Infinity;

          for (const slot of pool) {
            const taskKey = `${personTaskGroup}-${slot.id}`;
            const tLoad = loadCount[taskKey] || 0;
            const totLoad = result[slot.id]?.length || 0;

            if (tLoad < minTaskLoad) {
              minTaskLoad = tLoad;
              minTotalLoad = totLoad;
            } else if (tLoad === minTaskLoad && totLoad < minTotalLoad) {
              minTotalLoad = totLoad;
            }
          }

          let candidateSlots = pool.filter((slot) => {
            const taskKey = `${personTaskGroup}-${slot.id}`;
            const tLoad = loadCount[taskKey] || 0;
            const totLoad = result[slot.id]?.length || 0;
            return tLoad === minTaskLoad && totLoad === minTotalLoad;
          });

          if (candidateSlots.length === 0) {
            candidateSlots = pool.filter((slot) => {
              const taskKey = `${personTaskGroup}-${slot.id}`;
              return (loadCount[taskKey] || 0) === minTaskLoad;
            });
          }

          const chosen = candidateSlots.length > 0
            ? candidateSlots[Math.floor(Math.random() * candidateSlots.length)]
            : pool[0];

          if (chosen) {
            result[chosen.id].push(person.id);
            const key = `${personTaskGroup}-${chosen.id}`;
            loadCount[key] = (loadCount[key] || 0) + 1;
          }
        }
      }

      return {
        ...prev,
        intervals: { ...prev.intervals, [dateKey]: result },
      };
    });
  };

  const clearBreaks = () => {
    updateState((prev) => {
      const dateKey = prev.selectedDate;
      const newIntervals = { ...prev.intervals };
      delete newIntervals[dateKey];
      return { ...prev, intervals: newIntervals };
    });
  };

  const setAbsenceReason = (collaboratorId: string, reason: string) => {
    updateState((prev) => {
      const dateKey = prev.selectedDate;
      const dayReport = prev.dailyReports[dateKey] || {};
      return {
        ...prev,
        dailyReports: {
          ...prev.dailyReports,
          [dateKey]: {
            ...dayReport,
            absenceReasons: { ...(dayReport.absenceReasons || {}), [collaboratorId]: reason },
          },
        },
      };
    });
  };

  const setOccurrence = (collaboratorId: string, text: string) => {
    updateState((prev) => {
      const dateKey = prev.selectedDate;
      const dayReport = prev.dailyReports[dateKey] || {};
      return {
        ...prev,
        dailyReports: {
          ...prev.dailyReports,
          [dateKey]: {
            ...dayReport,
            occurrences: { ...(dayReport.occurrences || {}), [collaboratorId]: text },
          },
        },
      };
    });
  };

  const setGeneralNotes = (notes: string) => {
    updateState((prev) => {
      const dateKey = prev.selectedDate;
      const dayReport = prev.dailyReports[dateKey] || {};
      return {
        ...prev,
        dailyReports: {
          ...prev.dailyReports,
          [dateKey]: { ...dayReport, generalNotes: notes },
        },
      };
    });
  };

  const saveDailyReport = () => {
    updateState((prev) => {
      const dateKey = prev.selectedDate;
      const dayReport = prev.dailyReports[dateKey] || {};
      const snapshot = prev.collaborators.map((c) => {
        const hasAbsence = (c.absences || []).find((a) => dateKey >= a.startDate && dateKey <= a.endDate);
        const off = isScaleOff(prev.calendar, dateKey, c.scale);
        const manual = prev.attendance[dateKey]?.[c.id];

        let status: 'presente' | 'ausente' | 'folga' | 'ferias' | 'licenca' | 'treinamento' | 'atestado' | 'banco_horas' | 'falta_injustificada' = 'presente';
        if (hasAbsence) {
          status = hasAbsence.type;
        } else if (off) {
          status = 'folga';
        } else if (manual === false) {
          status = 'ausente';
        }

        const task = prev.tasks.find((t) => t.members.includes(c.id))?.name || 'Não direcionado';
        const dayInt = prev.intervals[dateKey] || {};
        const breakSlot = prev.breaks.find((b) => (dayInt[b.id] || []).includes(c.id))?.time || 'Sem intervalo';

        return {
          id: c.id,
          name: c.name,
          status,
          task,
          interval: breakSlot,
          absenceReason: dayReport.absenceReasons?.[c.id] || '',
          occurrence: dayReport.occurrences?.[c.id] || '',
        };
      });

      return {
        ...prev,
        dailyReports: {
          ...prev.dailyReports,
          [dateKey]: {
            ...dayReport,
            generatedAt: new Date().toLocaleString('pt-BR'),
            snapshot,
          },
        },
      };
    });
  };

  const saveHistory = () => {
    updateState((prev) => {
      const dateKey = prev.selectedDate;
      const presentCount = prev.collaborators.filter((c) => {
        const hasAbsence = (c.absences || []).some((a) => dateKey >= a.startDate && dateKey <= a.endDate);
        const off = isScaleOff(prev.calendar, dateKey, c.scale);
        const manual = prev.attendance[dateKey]?.[c.id];
        if (hasAbsence || off) return false;
        return manual !== false;
      }).length;

      const vacationCount = prev.collaborators.filter((c) =>
        (c.absences || []).some((a) => dateKey >= a.startDate && dateKey <= a.endDate && a.type === 'ferias')
      ).length;

      const leaveCount = prev.collaborators.filter((c) =>
        (c.absences || []).some((a) => dateKey >= a.startDate && dateKey <= a.endDate && a.type === 'licenca')
      ).length;

      const trainingCount = prev.collaborators.filter((c) =>
        (c.absences || []).some((a) => dateKey >= a.startDate && dateKey <= a.endDate && a.type === 'treinamento')
      ).length;

      const newItem = {
        id: generateId(),
        date: dateKey,
        peoplePresent: presentCount,
        peopleVacation: vacationCount,
        peopleLeave: leaveCount,
        peopleTraining: trainingCount,
        timestamp: new Date().toLocaleString('pt-BR'),
      };

      return { ...prev, history: [...prev.history, newItem] };
    });
  };

  const setSelectedGlobalFilters = (filters: { shift?: string; teamLeader?: string }) => {
    updateState((prev) => ({
      ...prev,
      selectedShiftFilter: filters.shift !== undefined ? filters.shift : prev.selectedShiftFilter,
      selectedTLFilter: filters.teamLeader !== undefined ? filters.teamLeader : prev.selectedTLFilter,
    }));
  };

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem('people-scheduler-v3', JSON.stringify(state));
    } catch (err) {
      console.error('Failed to save state', err);
    }
  }, [state]);

  return (
    <ScheduleContext.Provider
      value={{
        state,
        setDate,
        setYear,
        markDayScale,
        toggleAttendance,
        setAttendanceStatus,
        resetAttendance,
        assignTask,
        unassignTask,
        clearAssignments,
        clearTaskAssignments,
        autoAssign,
        addTask,
        updateTask,
        deleteTask,
        addBreakSlot,
        updateBreakSlot,
        deleteBreakSlot,
        moveBreakInterval,
        generateBreaks,
        clearBreaks,
        setAbsenceReason,
        setOccurrence,
        setGeneralNotes,
        saveDailyReport,
        saveHistory,
        setSelectedGlobalFilters,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error('useSchedule must be used within a ScheduleProvider');
  return context;
};