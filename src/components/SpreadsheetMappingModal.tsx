import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Table,
  Sparkles,
  Users,
  X,
  Check,
  HelpCircle,
  Info,
  RefreshCw,
  SlidersHorizontal,
  UserCheck,
  BadgeAlert,
  ListFilter,
  Plus
} from 'lucide-react';
import { formatPersonName } from '../utils/helpers';

export interface MappedCollaboratorRow {
  name: string;
  registration?: string;
  login?: string;
  shift?: string;
  scale?: string;
  teamLeader?: string;
  role?: string;
  category?: string;
  notes?: string;
  skills?: string;
  rawRowIndex: number;
  isValid: boolean;
  validationError?: string;
}

export interface SpreadsheetMappingModalProps {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onConfirmImport: (
    rows: MappedCollaboratorRow[],
    options: { replaceAll: boolean; formatNames: boolean }
  ) => void;
  defaultShift?: string;
  defaultTeamLeader?: string;
  availableShifts?: string[];
  availableRoles?: string[];
  availableCategories?: string[];
}

// Synonyms for auto-matching columns
const SYNONYMS: Record<string, string[]> = {
  name: ['nome', 'colaborador', 'colaboradores', 'nome completo', 'funcionario', 'funcionário', 'operador', 'name', 'employee', 'pessoa'],
  registration: ['re', 'matricula', 'matrícula', 're (matrícula)', 're (matricula)', 'id', 'registro', 'reg', 'chapa'],
  login: ['ldap', 'login', 'user', 'usuario', 'usuário', 'login amazon', 'alias', 'username'],
  shift: ['turno', 'shift', 'periodo', 'período', 'horario', 'horário'],
  scale: ['escala', 'scale', 'turma', 'grupo', 'turma 6x2', 'turma 6x1', 'folga'],
  teamLeader: ['team leader', 'tl', 'time', 'equipe', 'supervisor', 'lider', 'líder', 'gestor', 'liderança', 'coordenador'],
  role: ['cargo', 'funcao', 'função', 'role', 'papeis', 'papel', 'ocupacao', 'ocupação', 'posicao', 'posição'],
  category: ['categoria', 'category', 'setor', 'processo', 'area', 'área', 'departamento'],
  notes: ['observacao', 'observação', 'observacoes', 'observações', 'notes', 'obs', 'comentario', 'comentários', 'nota'],
  skills: ['skills', 'habilidades', 'competencias', 'competências', 'habilidade'],
};

export const SpreadsheetMappingModal: React.FC<SpreadsheetMappingModalProps> = ({
  isOpen,
  file,
  onClose,
  onConfirmImport,
  defaultShift = 'T2',
  defaultTeamLeader = 'Sem Time',
  availableShifts = ['T1', 'T2', 'T3', 'T4', 'ADM'],
  availableRoles = ['Operador de Processo', 'Analista de Qualidade', 'Líder de Turno', 'Auxiliar'],
  availableCategories = ['Inbound', 'Outbound', 'ICQA', 'Suporte'],
}) => {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawMatrix, setRawMatrix] = useState<any[][]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Structural options
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [dataStartRowIdx, setDataStartRowIdx] = useState<number>(1);
  const [useHeaderRow, setUseHeaderRow] = useState<boolean>(true);

  // Target Column Mappings (Column index in sheet or 'FIXED:value')
  const [colMap, setColMap] = useState<Record<string, string>>({
    name: '',
    registration: '',
    login: '',
    shift: 'FIXED:T2',
    scale: 'FIXED:A',
    teamLeader: 'FIXED:Sem Time',
    role: 'FIXED:Operador de Processo',
    category: 'FIXED:Inbound',
    notes: '',
    skills: '',
  });

  // Custom fixed values
  const [fixedValues, setFixedValues] = useState<Record<string, string>>({
    shift: defaultShift,
    scale: 'A',
    teamLeader: defaultTeamLeader,
    role: 'Operador de Processo',
    category: 'Inbound',
  });

  // Import mode options
  const [replaceAll, setReplaceAll] = useState<boolean>(false);
  const [formatNames, setFormatNames] = useState<boolean>(true);

  // Read file on open/change
  useEffect(() => {
    if (!isOpen || !file) {
      setWorkbook(null);
      setRawMatrix([]);
      setErrorMsg(null);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        if (wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setSelectedSheet(firstSheet);
          processSheetData(wb, firstSheet);
        }
      } catch (err) {
        console.error('Erro ao ler arquivo excel:', err);
        setErrorMsg('Erro ao ler o arquivo. Certifique-se de que é uma planilha válida em formato .XLSX, .XLS ou .CSV.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [isOpen, file]);

  // Handle Sheet Switch
  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbook) {
      processSheetData(workbook, sheetName);
    }
  };

  // Convert Sheet to Matrix & Auto-Detect Structure & Mappings
  const processSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const worksheet = wb.Sheets[sheetName];
    if (!worksheet) return;

    // Convert to 2D matrix
    const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    setRawMatrix(matrix);

    if (!matrix || matrix.length === 0) {
      setErrorMsg('A aba selecionada está vazia.');
      return;
    }

    // Auto-detect header row
    let bestHeaderIdx = 0;
    let maxHeaderScore = -1;

    const maxCheckRows = Math.min(matrix.length, 15);
    for (let r = 0; r < maxCheckRows; r++) {
      const row = matrix[r];
      if (!Array.isArray(row)) continue;

      let score = 0;
      row.forEach((cell) => {
        const str = String(cell || '').trim().toLowerCase();
        if (!str) return;

        Object.values(SYNONYMS).forEach((synList) => {
          if (synList.some((s) => str.includes(s))) {
            score += 2;
          }
        });
        if (str.length > 2) score += 0.5;
      });

      if (score > maxHeaderScore) {
        maxHeaderScore = score;
        bestHeaderIdx = r;
      }
    }

    setHeaderRowIdx(bestHeaderIdx);
    setDataStartRowIdx(bestHeaderIdx + 1);
    setUseHeaderRow(true);

    // Auto match columns based on header row
    const headerRow = matrix[bestHeaderIdx] || [];
    autoMatchColumns(headerRow);
  };

  // Match columns to target fields
  const autoMatchColumns = (headerRow: any[]) => {
    const newMap: Record<string, string> = {
      name: '',
      registration: '',
      login: '',
      shift: colMap.shift.startsWith('FIXED:') ? colMap.shift : `FIXED:${defaultShift}`,
      scale: colMap.scale.startsWith('FIXED:') ? colMap.scale : 'FIXED:A',
      teamLeader: colMap.teamLeader.startsWith('FIXED:') ? colMap.teamLeader : `FIXED:${defaultTeamLeader}`,
      role: colMap.role.startsWith('FIXED:') ? colMap.role : 'FIXED:Operador de Processo',
      category: colMap.category.startsWith('FIXED:') ? colMap.category : 'FIXED:Inbound',
      notes: '',
      skills: '',
    };

    headerRow.forEach((cellVal, colIdx) => {
      const str = String(cellVal || '').trim().toLowerCase();
      if (!str) return;

      Object.entries(SYNONYMS).forEach(([fieldKey, synList]) => {
        if (!newMap[fieldKey] || newMap[fieldKey].startsWith('FIXED:')) {
          if (synList.some((s) => str === s || str.includes(s))) {
            newMap[fieldKey] = String(colIdx);
          }
        }
      });
    });

    setColMap(newMap);
  };

  // Re-run auto match when header row index changes
  const handleHeaderRowIdxChange = (newHeaderIdx: number) => {
    setHeaderRowIdx(newHeaderIdx);
    setDataStartRowIdx(newHeaderIdx + 1);
    if (rawMatrix[newHeaderIdx]) {
      autoMatchColumns(rawMatrix[newHeaderIdx]);
    }
  };

  // Get Column Name label (e.g. "Coluna A (Nome)", "Coluna B (Matrícula)")
  const getColumnLabel = (colIdx: number): string => {
    const letter = XLSX.utils.encode_col(colIdx);
    if (useHeaderRow && rawMatrix[headerRowIdx] && rawMatrix[headerRowIdx][colIdx] !== undefined) {
      const headerVal = String(rawMatrix[headerRowIdx][colIdx]).trim();
      if (headerVal) {
        return `Coluna ${letter}: "${headerVal}"`;
      }
    }
    // Fallback sample
    let sampleVal = '';
    for (let r = dataStartRowIdx; r < Math.min(rawMatrix.length, dataStartRowIdx + 3); r++) {
      if (rawMatrix[r] && rawMatrix[r][colIdx]) {
        sampleVal = String(rawMatrix[r][colIdx]).trim();
        break;
      }
    }
    return `Coluna ${letter}${sampleVal ? ` (Ex: "${sampleVal}")` : ''}`;
  };

  // Maximum columns in the matrix
  const maxCols = useMemo(() => {
    let max = 0;
    rawMatrix.forEach((r) => {
      if (Array.isArray(r) && r.length > max) max = r.length;
    });
    return max;
  }, [rawMatrix]);

  // Transform raw matrix rows into mapped collaborator objects
  const mappedRows: MappedCollaboratorRow[] = useMemo(() => {
    if (!rawMatrix || rawMatrix.length <= dataStartRowIdx) return [];

    const results: MappedCollaboratorRow[] = [];

    for (let r = dataStartRowIdx; r < rawMatrix.length; r++) {
      const rowData = rawMatrix[r];
      if (!Array.isArray(rowData) || rowData.every((cell) => cell === undefined || cell === null || String(cell).trim() === '')) {
        continue; // Skip empty lines
      }

      const getValue = (fieldKey: string): string => {
        const valSetting = colMap[fieldKey];
        if (!valSetting) return '';
        if (valSetting.startsWith('FIXED:')) {
          return valSetting.replace('FIXED:', '');
        }
        const colIdx = parseInt(valSetting, 10);
        if (!isNaN(colIdx) && rowData[colIdx] !== undefined && rowData[colIdx] !== null) {
          return String(rowData[colIdx]).trim();
        }
        return '';
      };

      let rawName = getValue('name');
      const registration = getValue('registration');
      const login = getValue('login');
      const shift = getValue('shift') || fixedValues.shift || defaultShift;
      const scale = (getValue('scale') || fixedValues.scale || 'A').toUpperCase();
      const teamLeader = getValue('teamLeader') || fixedValues.teamLeader || defaultTeamLeader;
      const role = getValue('role') || fixedValues.role || 'Operador de Processo';
      const category = getValue('category') || fixedValues.category || 'Inbound';
      const notes = getValue('notes');
      const skills = getValue('skills');

      if (formatNames && rawName) {
        rawName = formatPersonName(rawName);
      }

      const isValid = Boolean(rawName && rawName.trim().length > 1);
      const validationError = !isValid ? 'Linha sem nome do colaborador' : undefined;

      results.push({
        name: rawName,
        registration,
        login,
        shift,
        scale,
        teamLeader,
        role,
        category,
        notes,
        skills,
        rawRowIndex: r + 1,
        isValid,
        validationError,
      });
    }

    return results;
  }, [rawMatrix, dataStartRowIdx, colMap, fixedValues, formatNames, defaultShift, defaultTeamLeader]);

  const validRowsCount = useMemo(() => mappedRows.filter((r) => r.isValid).length, [mappedRows]);

  // Handle Field Mapping Change
  const handleMappingChange = (fieldKey: string, value: string) => {
    setColMap((prev) => ({ ...prev, [fieldKey]: value }));
  };

  // Handle Fixed Value Change
  const handleFixedValueChange = (fieldKey: string, val: string) => {
    setFixedValues((prev) => ({ ...prev, [fieldKey]: val }));
    setColMap((prev) => ({ ...prev, [fieldKey]: `FIXED:${val}` }));
  };

  // Submit Mapping & Import
  const handleConfirm = () => {
    if (validRowsCount === 0) return;
    const validRows = mappedRows.filter((r) => r.isValid);
    onConfirmImport(validRows, { replaceAll, formatNames });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-[var(--paper)] border border-[var(--line)] w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[var(--line)] bg-[var(--bg)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-[var(--ink)]">Importador Flexível de Planilhas</h2>
                <span className="px-2 py-0.5 rounded-md bg-[var(--primary-soft)] text-[var(--primary)] font-extrabold text-[10px] uppercase tracking-wider">
                  Tratamento de Dados
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] font-medium">
                Associe as colunas da sua planilha às informações do aplicativo.
                {file && <span className="ml-1 font-bold text-[var(--ink)]">({file.name})</span>}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {loading && (
            <div className="p-12 text-center text-xs text-[var(--muted)] font-bold space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto text-[var(--primary)] animate-spin" />
              <p>Processando e analisando dados da planilha...</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold">Não foi possível carregar a planilha</p>
                <p className="font-normal opacity-90 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {!loading && !errorMsg && rawMatrix.length > 0 && (
            <>
              {/* Sheet & Row Structure Controls */}
              <div className="bg-[var(--bg)] border border-[var(--line)] p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-[var(--ink)] uppercase tracking-wider border-b border-[var(--line)] pb-2">
                  <SlidersHorizontal className="w-4 h-4 text-[var(--primary)]" />
                  <span>1. Estrutura das Linhas e Abas</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Select Worksheet Sheet */}
                  {sheetNames.length > 1 && (
                    <div>
                      <label className="block text-[10px] font-black uppercase text-[var(--muted)] mb-1">
                        Aba da Planilha ({sheetNames.length})
                      </label>
                      <select
                        value={selectedSheet}
                        onChange={(e) => handleSheetChange(e.target.value)}
                        className="w-full bg-[var(--paper)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-1.5 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      >
                        {sheetNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Header Row Picker */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[var(--muted)] mb-1">
                      Linha de Cabeçalho / Títulos
                    </label>
                    <select
                      value={headerRowIdx}
                      onChange={(e) => handleHeaderRowIdxChange(Number(e.target.value))}
                      className="w-full bg-[var(--paper)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-1.5 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    >
                      {rawMatrix.slice(0, 15).map((row, idx) => {
                        const previewStr = Array.isArray(row)
                          ? row.filter(Boolean).slice(0, 3).join(' | ')
                          : '';
                        return (
                          <option key={idx} value={idx}>
                            Linha {idx + 1} {previewStr ? `(${previewStr.substring(0, 35)}...)` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Data Start Row Picker */}
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[var(--muted)] mb-1">
                      Primeira Linha de Dados
                    </label>
                    <select
                      value={dataStartRowIdx}
                      onChange={(e) => setDataStartRowIdx(Number(e.target.value))}
                      className="w-full bg-[var(--paper)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-1.5 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    >
                      {rawMatrix.slice(0, 20).map((row, idx) => {
                        const previewStr = Array.isArray(row)
                          ? row.filter(Boolean).slice(0, 2).join(' | ')
                          : '';
                        return (
                          <option key={idx} value={idx} disabled={idx <= headerRowIdx}>
                            Linha {idx + 1} {previewStr ? `(${previewStr.substring(0, 30)}...)` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Column Mapping Section */}
              <div className="bg-[var(--bg)] border border-[var(--line)] p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                  <div className="flex items-center gap-2 text-xs font-black text-[var(--ink)] uppercase tracking-wider">
                    <ListFilter className="w-4 h-4 text-emerald-600" />
                    <span>2. Mapeamento dos Campos das Colunas</span>
                  </div>
                  <span className="text-[11px] text-[var(--muted)] font-medium">
                    Se a planilha não contiver alguma coluna, você pode selecionar um <strong>valor fixo padrão</strong>.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Nome Completo (Required) */}
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-[var(--primary)]" />
                        <span>Nome do Colaborador</span>
                        <span className="text-rose-500 font-black">*</span>
                      </label>
                      <span className="text-[10px] text-[var(--muted)] font-mono">Obrigatório</span>
                    </div>
                    <select
                      value={colMap.name}
                      onChange={(e) => handleMappingChange('name', e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    >
                      <option value="">-- Selecionar Coluna da Planilha --</option>
                      {Array.from({ length: maxCols }).map((_, colIdx) => (
                        <option key={colIdx} value={colIdx}>
                          {getColumnLabel(colIdx)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Matrícula / RE */}
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                        <span>RE (Matrícula)</span>
                      </label>
                      <span className="text-[10px] text-[var(--muted)]">Opcional</span>
                    </div>
                    <select
                      value={colMap.registration}
                      onChange={(e) => handleMappingChange('registration', e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    >
                      <option value="">-- Não Importar --</option>
                      {Array.from({ length: maxCols }).map((_, colIdx) => (
                        <option key={colIdx} value={colIdx}>
                          {getColumnLabel(colIdx)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* LDAP / Login */}
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                        <span>LDAP / Login / Usuário</span>
                      </label>
                      <span className="text-[10px] text-[var(--muted)]">Opcional</span>
                    </div>
                    <select
                      value={colMap.login}
                      onChange={(e) => handleMappingChange('login', e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    >
                      <option value="">-- Não Importar --</option>
                      {Array.from({ length: maxCols }).map((_, colIdx) => (
                        <option key={colIdx} value={colIdx}>
                          {getColumnLabel(colIdx)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Turno */}
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-[var(--ink)]">Turno Operacional</label>
                      <span className="text-[10px] text-[var(--muted)]">Coluna ou Fixo</span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={colMap.shift.startsWith('FIXED:') ? 'FIXED' : colMap.shift}
                        onChange={(e) => {
                          if (e.target.value === 'FIXED') {
                            handleFixedValueChange('shift', fixedValues.shift || defaultShift);
                          } else {
                            handleMappingChange('shift', e.target.value);
                          }
                        }}
                        className="flex-1 bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      >
                        <option value="FIXED">-- Usar Valor Fixo para Todos --</option>
                        {Array.from({ length: maxCols }).map((_, colIdx) => (
                          <option key={colIdx} value={colIdx}>
                            {getColumnLabel(colIdx)}
                          </option>
                        ))}
                      </select>

                      {colMap.shift.startsWith('FIXED:') && (
                        <select
                          value={fixedValues.shift}
                          onChange={(e) => handleFixedValueChange('shift', e.target.value)}
                          className="w-28 bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-lg px-2 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        >
                          {availableShifts.map((s) => (
                            <option key={s} value={s}>
                              Turno {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Escala (6x2) */}
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-[var(--ink)]">Turma / Escala 6x2 (A, B, C, D)</label>
                      <span className="text-[10px] text-[var(--muted)]">Coluna ou Fixo</span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={colMap.scale.startsWith('FIXED:') ? 'FIXED' : colMap.scale}
                        onChange={(e) => {
                          if (e.target.value === 'FIXED') {
                            handleFixedValueChange('scale', fixedValues.scale || 'A');
                          } else {
                            handleMappingChange('scale', e.target.value);
                          }
                        }}
                        className="flex-1 bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      >
                        <option value="FIXED">-- Usar Valor Fixo para Todos --</option>
                        {Array.from({ length: maxCols }).map((_, colIdx) => (
                          <option key={colIdx} value={colIdx}>
                            {getColumnLabel(colIdx)}
                          </option>
                        ))}
                      </select>

                      {colMap.scale.startsWith('FIXED:') && (
                        <select
                          value={fixedValues.scale}
                          onChange={(e) => handleFixedValueChange('scale', e.target.value)}
                          className="w-24 bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-lg px-2 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        >
                          {['A', 'B', 'C', 'D'].map((grp) => (
                            <option key={grp} value={grp}>
                              Turma {grp}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Team Leader / Time */}
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-[var(--ink)]">Team Leader / Time</label>
                      <span className="text-[10px] text-[var(--muted)]">Coluna ou Fixo</span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={colMap.teamLeader.startsWith('FIXED:') ? 'FIXED' : colMap.teamLeader}
                        onChange={(e) => {
                          if (e.target.value === 'FIXED') {
                            handleFixedValueChange('teamLeader', fixedValues.teamLeader || defaultTeamLeader);
                          } else {
                            handleMappingChange('teamLeader', e.target.value);
                          }
                        }}
                        className="flex-1 bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      >
                        <option value="FIXED">-- Usar Valor Fixo para Todos --</option>
                        {Array.from({ length: maxCols }).map((_, colIdx) => (
                          <option key={colIdx} value={colIdx}>
                            {getColumnLabel(colIdx)}
                          </option>
                        ))}
                      </select>

                      {colMap.teamLeader.startsWith('FIXED:') && (
                        <input
                          type="text"
                          value={fixedValues.teamLeader}
                          onChange={(e) => handleFixedValueChange('teamLeader', e.target.value)}
                          placeholder="Ex: Time do TL Bruno"
                          className="w-36 bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-lg px-2 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                      )}
                    </div>
                  </div>

                  {/* Cargo */}
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-[var(--ink)]">Cargo / Função</label>
                      <span className="text-[10px] text-[var(--muted)]">Coluna ou Fixo</span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={colMap.role.startsWith('FIXED:') ? 'FIXED' : colMap.role}
                        onChange={(e) => {
                          if (e.target.value === 'FIXED') {
                            handleFixedValueChange('role', fixedValues.role || 'Operador de Processo');
                          } else {
                            handleMappingChange('role', e.target.value);
                          }
                        }}
                        className="flex-1 bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      >
                        <option value="FIXED">-- Usar Valor Fixo para Todos --</option>
                        {Array.from({ length: maxCols }).map((_, colIdx) => (
                          <option key={colIdx} value={colIdx}>
                            {getColumnLabel(colIdx)}
                          </option>
                        ))}
                      </select>

                      {colMap.role.startsWith('FIXED:') && (
                        <input
                          type="text"
                          value={fixedValues.role}
                          onChange={(e) => handleFixedValueChange('role', e.target.value)}
                          placeholder="Ex: Operador de Processo"
                          className="w-36 bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-lg px-2 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                      )}
                    </div>
                  </div>

                  {/* Categoria / Processo */}
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-[var(--ink)]">Categoria / Setor / Processo</label>
                      <span className="text-[10px] text-[var(--muted)]">Coluna ou Fixo</span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={colMap.category.startsWith('FIXED:') ? 'FIXED' : colMap.category}
                        onChange={(e) => {
                          if (e.target.value === 'FIXED') {
                            handleFixedValueChange('category', fixedValues.category || 'Inbound');
                          } else {
                            handleMappingChange('category', e.target.value);
                          }
                        }}
                        className="flex-1 bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      >
                        <option value="FIXED">-- Usar Valor Fixo para Todos --</option>
                        {Array.from({ length: maxCols }).map((_, colIdx) => (
                          <option key={colIdx} value={colIdx}>
                            {getColumnLabel(colIdx)}
                          </option>
                        ))}
                      </select>

                      {colMap.category.startsWith('FIXED:') && (
                        <input
                          type="text"
                          value={fixedValues.category}
                          onChange={(e) => handleFixedValueChange('category', e.target.value)}
                          placeholder="Ex: Inbound"
                          className="w-32 bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-lg px-2 py-2 text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Import Preview Table */}
              <div className="bg-[var(--bg)] border border-[var(--line)] p-4 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
                  <div className="flex items-center gap-2 text-xs font-black text-[var(--ink)] uppercase tracking-wider">
                    <Table className="w-4 h-4 text-sky-600" />
                    <span>3. Pré-Visualização dos Dados Tratados</span>
                  </div>
                  <div className="text-xs font-bold flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px]">
                      {validRowsCount} registro(s) válido(s)
                    </span>
                    {mappedRows.length - validRowsCount > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px]">
                        {mappedRows.length - validRowsCount} linha(s) ignorada(s)
                      </span>
                    )}
                  </div>
                </div>

                {!colMap.name ? (
                  <div className="p-8 text-center text-xs text-amber-600 dark:text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-xl font-bold space-y-1">
                    <BadgeAlert className="w-6 h-6 mx-auto mb-1" />
                    <p>Selecione qual coluna da planilha corresponde ao "Nome do Colaborador".</p>
                  </div>
                ) : mappedRows.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--muted)] font-medium">
                    Nenhuma linha encontrada a partir da linha de início selecionada.
                  </div>
                ) : (
                  <div className="border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--paper)]">
                    <div className="overflow-x-auto max-h-56">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] font-black uppercase text-[10px] sticky top-0 z-10">
                            <th className="p-2.5">Linha</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Nome Tratado</th>
                            <th className="p-2.5">RE</th>
                            <th className="p-2.5">LDAP</th>
                            <th className="p-2.5">Turno</th>
                            <th className="p-2.5">Escala</th>
                            <th className="p-2.5">Team Leader / Time</th>
                            <th className="p-2.5">Cargo / Categoria</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--line)] font-medium">
                          {mappedRows.slice(0, 8).map((row, i) => (
                            <tr
                              key={i}
                              className={row.isValid ? 'hover:bg-[var(--bg)]/50' : 'bg-rose-500/5 text-[var(--muted)]'}
                            >
                              <td className="p-2.5 font-mono text-[10px] text-[var(--muted)]">#{row.rawRowIndex}</td>
                              <td className="p-2.5 whitespace-nowrap">
                                {row.isValid ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">
                                    <Check className="w-3 h-3" /> Válido
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black">
                                    Ignorado
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 font-black text-[var(--ink)] whitespace-nowrap">
                                {row.name || <span className="italic text-rose-400">Sem nome</span>}
                              </td>
                              <td className="p-2.5 font-mono text-[11px] text-[var(--ink)]">{row.registration || '—'}</td>
                              <td className="p-2.5 font-mono text-[11px] text-[var(--ink)]">{row.login || '—'}</td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded bg-[var(--primary-soft)] text-[var(--primary)] font-bold text-[10px]">
                                  {row.shift}
                                </span>
                              </td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                                  {row.scale}
                                </span>
                              </td>
                              <td className="p-2.5 whitespace-nowrap text-[var(--ink)]">{row.teamLeader || 'Sem Time'}</td>
                              <td className="p-2.5 whitespace-nowrap text-[var(--muted)] text-[11px]">
                                {row.role} · <strong className="text-[var(--ink)]">{row.category}</strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {mappedRows.length > 8 && (
                      <div className="p-2 bg-[var(--bg)] border-t border-[var(--line)] text-center text-[10.5px] text-[var(--muted)] font-bold">
                        Exibindo as primeiras 8 linhas de um total de {mappedRows.length} linhas tratadas.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Import Mode Toggles */}
              <div className="p-4 bg-[var(--bg)] border border-[var(--line)] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-extrabold text-[var(--ink)] block">Opções de Importação</span>
                  <p className="text-[11px] text-[var(--muted)] font-medium">
                    Escolha como os dados devem ser mesclados com os colaboradores atuais.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-[var(--ink)]">
                    <input
                      type="checkbox"
                      checked={formatNames}
                      onChange={(e) => setFormatNames(e.target.checked)}
                      className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                    />
                    <span>Formatar Nomes ("JOAO SILVA" → "João Silva")</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-[var(--ink)]">
                    <input
                      type="checkbox"
                      checked={replaceAll}
                      onChange={(e) => setReplaceAll(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-0 cursor-pointer"
                    />
                    <span className={replaceAll ? 'text-rose-600 font-black' : ''}>
                      Substituir toda a equipe atual
                    </span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--bg)] flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[var(--line)] text-xs font-bold rounded-xl text-[var(--ink)] hover:bg-[var(--paper)] transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            onClick={handleConfirm}
            disabled={!colMap.name || validRowsCount === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmar Importação de {validRowsCount} Colaboradores</span>
          </button>
        </div>
      </div>
    </div>
  );
};
