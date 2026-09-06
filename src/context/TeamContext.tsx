import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Collaborator, ShiftGroup, ScheduledAbsence, AbsenceType, ProcessKnowledge, BriefingConfig, DeletedCollaborator, Task, BreakSlot } from '../types';
import { generateId, formatPersonName, getCollaboratorStatus, isScaleOff } from '../utils/helpers';
import { initialAppState } from '../utils/initialData';

const STORAGE_KEY = 'people-scheduler-v3';

interface TeamContextType {
  state: {
    teamName: string;
    manager: string;
    sector: string;
    teamShift: string;
    defaultTeamLeader?: string;
    teamLeaders: string[];
    roles: string[];
    categories: string[];
    skills: string[];
    collaborators: Collaborator[];
    deletedCollaborators: DeletedCollaborator[];
    processKnowledgeList: ProcessKnowledge[];
    briefingConfig?: BriefingConfig;
  };
  setTeamInfo: (info: { teamName?: string; sector?: string; manager?: string; teamShift?: string }) => void;
  addCollaborator: (col?: Partial<Collaborator>) => void;
  updateCollaborator: (id: string, updates: Partial<Collaborator>) => void;
  deleteCollaborator: (id: string) => void;
  restoreCollaborator: (deletedId: string) => void;
  permanentlyDeleteCollaborator: (deletedId: string) => void;
  clearTrashBin: () => void;
  addScheduledAbsence: (collaboratorId: string, absence: Omit<ScheduledAbsence, 'id'>) => void;
  removeScheduledAbsence: (collaboratorId: string, absenceId: string) => void;
  addCatalogItem: (key: 'roles' | 'categories' | 'skills', item: string) => void;
  removeCatalogItem: (key: 'roles' | 'categories' | 'skills', item: string) => void;
  editCatalogItem: (key: 'roles' | 'categories' | 'skills', oldItem: string, newItem: string) => void;
  addTeamLeader: (name: string) => void;
  removeTeamLeader: (name: string) => void;
  editTeamLeader: (oldName: string, newName: string) => void;
  addProcessKnowledge: (item: Omit<ProcessKnowledge, 'id'>) => void;
  updateProcessKnowledge: (id: string, updates: Partial<ProcessKnowledge>) => void;
  deleteProcessKnowledge: (id: string) => void;
  updateBriefingConfig: (updates: Partial<BriefingConfig>) => void;
  setSkillLevel: (collaboratorId: string, skill: string, level: number) => void;
  importRosterRows: (rows: any[]) => number;
  clearSampleData: () => void;
  resetAllData: () => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const formattedCols = (parsed.collaborators || initialAppState.collaborators).map((c: Collaborator) => ({
          ...c,
          name: formatPersonName(c.name),
        }));
        return {
          ...initialAppState,
          ...parsed,
          collaborators: formattedCols,
        };
      }
    } catch {
      // Fallback
    }
    const formattedInitialCols = initialAppState.collaborators.map((c) => ({
      ...c,
      name: formatPersonName(c.name),
    }));
    return {
      ...initialAppState,
      collaborators: formattedInitialCols,
    };
  });

  const updateState = (updater: (prev: typeof state) => typeof state) => {
    setState(updater);
  };

  const setTeamInfo = (info: { teamName?: string; sector?: string; manager?: string; teamShift?: string }) => {
    updateState((prev) => {
      const nextShift = info.teamShift !== undefined ? info.teamShift : prev.teamShift;
      const updatedCols = prev.collaborators.map((c) => ({
        ...c,
        shift: nextShift || c.shift,
      }));
      return {
        ...prev,
        ...info,
        collaborators: updatedCols,
      };
    });
  };

  const addCollaborator = (customProps?: Partial<Collaborator>) => {
    const newCol: Collaborator = {
      id: generateId(),
      name: formatPersonName(customProps?.name || 'Novo Colaborador'),
      login: customProps?.login || '',
      registration: customProps?.registration || '',
      shift: customProps?.shift || state.teamShift || 'Geral',
      scale: (customProps?.scale || 'A') as ShiftGroup,
      teamLeader: customProps?.teamLeader || state.defaultTeamLeader || (state.teamLeaders?.[0] || 'Time 1'),
      role: customProps?.role || (state.roles[0] || 'Operador de Processo'),
      category: customProps?.category || (state.categories[0] || 'Inbound'),
      skills: customProps?.skills || {},
      notes: customProps?.notes || '',
      absences: customProps?.absences || [],
    };
    updateState((prev) => ({ ...prev, collaborators: [...prev.collaborators, newCol] }));
  };

  const updateCollaborator = (id: string, updates: Partial<Collaborator>) => {
    updateState((prev) => ({
      ...prev,
      collaborators: prev.collaborators.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  };

  const deleteCollaborator = (id: string) => {
    const target = state.collaborators.find((c) => c.id === id);
    if (!target) return;

    const now = new Date();
    const expires = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const deletedEntry: DeletedCollaborator = {
      id: generateId(),
      collaborator: target,
      deletedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    };

    updateState((prev) => ({
      ...prev,
      collaborators: prev.collaborators.filter((c) => c.id !== id),
      deletedCollaborators: [...(prev.deletedCollaborators || []), deletedEntry],
      tasks: prev.tasks.map((t) => ({ ...t, members: t.members.filter((m) => m !== id) })),
      intervals: Object.fromEntries(
        Object.entries(prev.intervals).map(([dateKey, dayIntervals]) => [
          dateKey,
          Object.fromEntries(
            Object.entries(dayIntervals).map(([breakId, memberIds]) => [
              breakId,
              memberIds.filter((m) => m !== id),
            ])
          ),
        ])
      ),
    }));
  };

  const restoreCollaborator = (deletedId: string) => {
    const entry = state.deletedCollaborators?.find((d) => d.id === deletedId);
    if (!entry) return;

    updateState((prev) => ({
      ...prev,
      collaborators: [...prev.collaborators, entry.collaborator],
      deletedCollaborators: (prev.deletedCollaborators || []).filter((d) => d.id !== deletedId),
    }));
  };

  const permanentlyDeleteCollaborator = (deletedId: string) => {
    const entry = state.deletedCollaborators?.find((d) => d.id === deletedId);
    updateState((prev) => ({
      ...prev,
      deletedCollaborators: (prev.deletedCollaborators || []).filter((d) => d.id !== deletedId),
    }));
  };

  const clearTrashBin = () => {
    updateState((prev) => ({ ...prev, deletedCollaborators: [] }));
  };

  const addScheduledAbsence = (collaboratorId: string, absence: Omit<ScheduledAbsence, 'id'>) => {
    const newAbsence: ScheduledAbsence = { ...absence, id: generateId() };
    updateState((prev) => ({
      ...prev,
      collaborators: prev.collaborators.map((c) => {
        if (c.id === collaboratorId) {
          return { ...c, absences: [...(c.absences || []), newAbsence] };
        }
        return c;
      }),
    }));
  };

  const removeScheduledAbsence = (collaboratorId: string, absenceId: string) => {
    updateState((prev) => ({
      ...prev,
      collaborators: prev.collaborators.map((c) => {
        if (c.id === collaboratorId) {
          return { ...c, absences: (c.absences || []).filter((a) => a.id !== absenceId) };
        }
        return c;
      }),
    }));
  };

  const addCatalogItem = (key: 'roles' | 'categories' | 'skills', item: string) => {
    const trimmed = item.trim();
    if (!trimmed) return;
    updateState((prev) => {
      if (prev[key].includes(trimmed)) return prev;
      return { ...prev, [key]: [...prev[key], trimmed] };
    });
  };

  const removeCatalogItem = (key: 'roles' | 'categories' | 'skills', item: string) => {
    updateState((prev) => ({ ...prev, [key]: prev[key].filter((i) => i !== item) }));
  };

  const editCatalogItem = (key: 'roles' | 'categories' | 'skills', oldItem: string, newItem: string) => {
    const trimmed = newItem.trim();
    if (!trimmed || trimmed === oldItem) return;
    updateState((prev) => {
      const updatedList = prev[key].map((item) => (item === oldItem ? trimmed : item));
      let updatedCollaborators = prev.collaborators;
      let updatedTasks = prev.tasks;

      if (key === 'roles') {
        updatedCollaborators = prev.collaborators.map((c) =>
          c.role === oldItem ? { ...c, role: trimmed } : c
        );
        updatedTasks = prev.tasks.map((t) => ({
          ...t,
          allowedRoles: (t.allowedRoles || []).map((r) => (r === oldItem ? trimmed : r)),
        }));
      } else if (key === 'categories') {
        updatedCollaborators = prev.collaborators.map((c) =>
          c.category === oldItem ? { ...c, category: trimmed } : c
        );
        updatedTasks = prev.tasks.map((t) => ({
          ...t,
          allowedCategories: (t.allowedCategories || []).map((cat) => (cat === oldItem ? trimmed : cat)),
        }));
      } else if (key === 'skills') {
        updatedCollaborators = prev.collaborators.map((c) => {
          if (c.skills && oldItem in c.skills) {
            const newSkills = { ...c.skills, [trimmed]: c.skills[oldItem] };
            delete newSkills[oldItem];
            return { ...c, skills: newSkills };
          }
          return c;
        });
      }

      return {
        ...prev,
        [key]: updatedList,
        collaborators: updatedCollaborators,
        tasks: updatedTasks,
      };
    });
  };

  const addTeamLeader = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    updateState((prev) => {
      const current = prev.teamLeaders || [];
      if (current.includes(clean)) return prev;
      return {
        ...prev,
        teamLeaders: [...current, clean],
        defaultTeamLeader: prev.defaultTeamLeader || clean,
      };
    });
  };

  const removeTeamLeader = (name: string) => {
    updateState((prev) => {
      const current = prev.teamLeaders || [];
      const updated = current.filter((t) => t !== name);
      return {
        ...prev,
        teamLeaders: updated,
        defaultTeamLeader: prev.defaultTeamLeader === name ? updated[0] || '' : prev.defaultTeamLeader,
      };
    });
  };

  const editTeamLeader = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    updateState((prev) => {
      const updatedLeaders = (prev.teamLeaders || []).map((tl) => (tl === oldName ? trimmed : tl));
      const updatedDefault = prev.defaultTeamLeader === oldName ? trimmed : prev.defaultTeamLeader;
      const updatedCollaborators = prev.collaborators.map((c) =>
        c.teamLeader === oldName ? { ...c, teamLeader: trimmed } : c
      );
      return {
        ...prev,
        teamLeaders: updatedLeaders,
        defaultTeamLeader: updatedDefault,
        collaborators: updatedCollaborators,
      };
    });
  };

  const addProcessKnowledge = (item: Omit<ProcessKnowledge, 'id'>) => {
    const newItem: ProcessKnowledge = {
      ...item,
      id: generateId(),
      active: item.active !== undefined ? item.active : true,
    };
    updateState((prev) => ({
      ...prev,
      processKnowledgeList: [...(prev.processKnowledgeList || []), newItem],
    }));
  };

  const updateProcessKnowledge = (id: string, updates: Partial<ProcessKnowledge>) => {
    updateState((prev) => ({
      ...prev,
      processKnowledgeList: (prev.processKnowledgeList || []).map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
  };

  const deleteProcessKnowledge = (id: string) => {
    updateState((prev) => ({
      ...prev,
      processKnowledgeList: (prev.processKnowledgeList || []).filter((p) => p.id !== id),
    }));
  };

  const updateBriefingConfig = (updates: Partial<BriefingConfig>) => {
    updateState((prev) => ({
      ...prev,
      briefingConfig: {
        ...(prev.briefingConfig || {}),
        ...updates,
      },
    }));
  };

  const setSkillLevel = (collaboratorId: string, skill: string, level: number) => {
    updateState((prev) => ({
      ...prev,
      collaborators: prev.collaborators.map((c) => {
        if (c.id === collaboratorId) {
          return { ...c, skills: { ...(c.skills || {}), [skill]: level } };
        }
        return c;
      }),
    }));
  };

  const importRosterRows = (rows: any[], options?: { replaceAll?: boolean; formatNames?: boolean }) => {
    let count = 0;
    updateState((prev) => {
      const newCols = options?.replaceAll ? [] : [...prev.collaborators];
      const newRoles = new Set(prev.roles);
      const newCats = new Set(prev.categories);

      rows.forEach((row) => {
        let name = row.name ? String(row.name).trim() : '';
        let registration = row.registration ? String(row.registration).trim() : '';
        let login = row.login ? String(row.login).trim() : '';
        let shift = row.shift ? String(row.shift).trim() : '';
        let scale = row.scale ? String(row.scale).trim() : '';
        let role = row.role ? String(row.role).trim() : '';
        let category = row.category ? String(row.category).trim() : '';
        let teamLeader = row.teamLeader ? String(row.teamLeader).trim() : '';
        let notes = row.notes ? String(row.notes).trim() : '';

        if (!name) {
          const getVal = (...keys: string[]) => {
            const foundKey = Object.keys(row).find((k) => keys.includes(k.trim().toLowerCase()));
            return foundKey ? String(row[foundKey]).trim() : '';
          };
          name = getVal('nome', 'colaborador', 'name');
          if (!name) return;
          registration = getVal('re', 're (matrícula)', 're (matricula)', 'matrícula', 'matricula', 'id', 'reg');
          login = getVal('ldap', 'login', 'login amazon', 'user');
          shift = getVal('turno', 'shift');
          scale = getVal('escala', 'scale');
          role = getVal('cargo', 'função', 'funcao', 'role');
          category = getVal('categoria', 'category');
          teamLeader = getVal('team leader', 'tl', 'time');
          notes = getVal('observação', 'observacao', 'notes');
        }

        if (!name) return;

        if (options?.formatNames !== false) {
          name = formatPersonName(name);
        }

        role = role || 'Operador de Processo';
        category = category || 'Inbound';
        shift = shift || prev.teamShift || 'T2';
        scale = (scale || 'A').toUpperCase() as ShiftGroup;

        if (role) newRoles.add(role);
        if (category) newCats.add(category);

        const existingIdx = !options?.replaceAll
          ? newCols.findIndex(
              (c) =>
                (registration && c.registration && c.registration.toLowerCase() === registration.toLowerCase()) ||
                (login && c.login && c.login.toLowerCase() === login.toLowerCase())
            )
          : -1;

        if (existingIdx >= 0) {
          newCols[existingIdx] = {
            ...newCols[existingIdx],
            name,
            registration: registration || newCols[existingIdx].registration,
            login: login || newCols[existingIdx].login,
            shift: shift || newCols[existingIdx].shift,
            scale: scale || newCols[existingIdx].scale,
            role: role || newCols[existingIdx].role,
            category: category || newCols[existingIdx].category,
            teamLeader: teamLeader || newCols[existingIdx].teamLeader,
            notes: notes || newCols[existingIdx].notes,
          };
        } else {
          newCols.push({
            id: generateId(),
            name,
            login,
            registration,
            shift,
            scale,
            role,
            category,
            teamLeader,
            skills: {},
            notes,
            absences: [],
          });
        }
        count++;
      });

      return {
        ...prev,
        collaborators: newCols,
        roles: Array.from(newRoles),
        categories: Array.from(newCats),
      };
    });
    return count;
  };

  const clearSampleData = () => {
    updateState((prev) => ({
      ...prev,
      collaborators: [],
      deletedCollaborators: [],
      tasks: prev.tasks.map((t) => ({ ...t, members: [] })),
      attendance: {},
      intervals: {},
      history: [],
      dailyReports: {},
    }));
  };

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_KEY);
    updateState(() => ({
      ...initialAppState,
      selectedDate: new Date().toISOString().split('T')[0],
    }));
  };

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to save state', err);
    }
  }, [state]);

  return (
    <TeamContext.Provider
      value={{
        state,
        setTeamInfo,
        addCollaborator,
        updateCollaborator,
        deleteCollaborator,
        restoreCollaborator,
        permanentlyDeleteCollaborator,
        clearTrashBin,
        addScheduledAbsence,
        removeScheduledAbsence,
        addCatalogItem,
        removeCatalogItem,
        editCatalogItem,
        addTeamLeader,
        removeTeamLeader,
        editTeamLeader,
        addProcessKnowledge,
        updateProcessKnowledge,
        deleteProcessKnowledge,
        updateBriefingConfig,
        setSkillLevel,
        importRosterRows,
        clearSampleData,
        resetAllData,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
};

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) throw new Error('useTeam must be used within a TeamProvider');
  return context;
};