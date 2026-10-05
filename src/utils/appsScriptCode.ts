/**
 * Helper module containing the canonical Google Apps Script Web App code for Dimensio
 */

export function getAppsScriptCode(customSpreadsheetUrl?: string): string {
  const defaultUrlComment = customSpreadsheetUrl && customSpreadsheetUrl.startsWith('http')
    ? `"${customSpreadsheetUrl.replace(/"/g, '')}"`
    : `""`;

  return `/**
 * ====================================================================
 * DIMENSIO — GOOGLE APPS SCRIPT WEBHOOK v4.6 (CANÔNICO & UNIVERSAL)
 * ====================================================================
 * Funcionalidades Integradas:
 *  1) Banco de dados primário na aba oculta __DB_STATE__ (chunked JSON);
 *  2) Backups automáticos por sincronização na aba __BACKUP__ (15 snapshots);
 *  3) Backups diários automáticos na aba __BACKUP_DAILY__ (30 dias);
 *  4) Endpoints de diagnóstico rápido (doGet/doPost mode="test" e "ping");
 *  5) Sinalização WebRTC / VoIP para rádio PTT na aba __SIGNAL__;
 *  6) Geração visual das abas: Painel, Equipe_HC, Colaboradores,
 *     Escala_Diaria, Tarefas, Intervalos, Calendario_Escala,
 *     Relatorios_Diarios, Config.
 * ====================================================================
 */

var DB_SHEET = "__DB_STATE__";
var BACKUP_SHEET = "__BACKUP__";
var BACKUP_KEEP = 15;
var DAILY_BACKUP_SHEET = "__BACKUP_DAILY__";
var DAILY_BACKUP_KEEP = 30;
var SIGNAL_SHEET = "__SIGNAL__";
var SIGNAL_ROWS_KEEP = 300;

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};

    // 0. Modo Test / Ping de Conexão Rápida
    if (params.mode === "ping" || params.mode === "test") {
      var ssTest = getTargetSpreadsheet(params);
      return responseJSON({
        status: "ok",
        message: "Webhook Dimensio online e responsivo." + (ssTest ? " Conectado à planilha: \\"" + ssTest.getName() + "\\"" : ""),
        spreadsheetTitle: ssTest ? ssTest.getName() : null,
        timestamp: new Date().toISOString(),
        version: "4.6.0"
      });
    }

    // 1. Modo Sinalização WebRTC / PTT (leitura de mensagens de presença/áudio)
    if (params.mode === "signal") {
      var sigSs = getSignalSpreadsheet(params);
      if (sigSs) {
        try {
          var msgs = readSignalLog(sigSs);
          if (msgs.length > 0) {
            return ContentService.createTextOutput(JSON.stringify(msgs))
              .setMimeType(ContentService.MimeType.JSON);
          }
        } catch (errSig) {}
      }
      return responseJSON({ status: "empty", mode: "signal" });
    }

    // 2. Modo Listagem de Backups
    if (params.mode === "backups") {
      var ssL = getTargetSpreadsheet(params);
      if (ssL) {
        return responseJSON({ ok: true, status: "success", backups: listBackups(ssL) });
      }
      return responseJSON({ ok: true, status: "empty", backups: [] });
    }

    // 3. Modo Restauração de Backup Específico
    if (params.mode === "backup") {
      var bakId = params.id || (params.i ? ("SYNC:" + params.i) : "");
      var ssB = getTargetSpreadsheet(params);
      if (ssB && bakId) {
        var bk = getBackup(ssB, bakId);
        if (bk && bk.state) {
          var parsedBk = null;
          try { parsedBk = JSON.parse(bk.state); } catch (errBk) {}
          var cleanBk = parsedBk && typeof parsedBk === "object" && parsedBk.rawState ? parsedBk.rawState : parsedBk;
          if (cleanBk) {
            return responseJSON({ ok: true, state: cleanBk, timestamp: bk.timestamp || "", id: bk.id });
          }
          return responseJSON({ ok: true, stateRaw: bk.state, timestamp: bk.timestamp || "", id: bk.id });
        }
      }
      return responseJSON({ ok: false, status: "empty", message: "Backup não encontrado" });
    }

    // 4. Modo Padrão: Retorna o estado bruto do banco de dados para o App
    var rawState = null;
    var ss = getTargetSpreadsheet(params);
    if (ss) {
      var sheetDb = ss.getSheetByName(DB_SHEET);
      if (sheetDb && sheetDb.getLastRow() >= 1) {
        var lastR = sheetDb.getLastRow();
        if (lastR === 1) {
          rawState = sheetDb.getRange("A1").getValue();
        } else {
          var chunkVals = sheetDb.getRange(1, 1, lastR, 1).getValues();
          var chunkArr = [];
          for (var cr = 0; cr < chunkVals.length; cr++) {
            if (chunkVals[cr][0]) chunkArr.push(chunkVals[cr][0]);
          }
          rawState = chunkArr.join("");
        }
      }

      // Fallback 1: Reconstruir a partir do último backup gravado
      if (!rawState) {
        try {
          var backups = listBackups(ss);
          if (backups && backups.length > 0) {
            var newest = backups[0];
            for (var bi = 0; bi < backups.length; bi++) {
              if (String(backups[bi].timestamp) >= String(newest.timestamp)) {
                newest = backups[bi];
              }
            }
            var bkState = getBackup(ss, newest.id);
            if (bkState && bkState.state) {
              rawState = bkState.state;
            }
          }
        } catch (errBk) {}
      }

      // Fallback 2: Reconstruir a partir de abas visíveis ("Colaboradores" / "Cadastros")
      if (!rawState) {
        try {
          rawState = reconstructFromVisibleSheets(ss);
        } catch (errRec) {}
      }
    }

    if (rawState) {
      return ContentService.createTextOutput(String(rawState))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheetHasVisibleData = false;
    try {
      if (ss) {
        var allSheets = ss.getSheets();
        for (var si = 0; si < allSheets.length; si++) {
          var sNameDiag = String(allSheets[si].getName() || "");
          if (sNameDiag.indexOf("__") === 0) continue;
          if (allSheets[si].getLastRow() > 1) { sheetHasVisibleData = true; break; }
        }
      }
    } catch (errDiag) {}

    return responseJSON({
      status: "empty",
      spreadsheetHasData: sheetHasVisibleData,
      service: "Dimensio Google Apps Script Webhook v4.6",
      message: "Webhook ativo e pronto para sincronizar!",
      timestamp: new Date().toLocaleString("pt-BR")
    });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ status: "error", message: "Conteúdo do POST vazio" });
    }

    var contentsStr = e.postData.contents;
    var payload = null;
    try {
      payload = JSON.parse(contentsStr);
    } catch (errParse) {
      return responseJSON({ status: "error", message: "JSON inválido enviado no corpo da requisição." });
    }

    // 0. Modo Sinalização VoIP / PTT
    if (payload.mode === "signal" && payload.signal && Array.isArray(payload.signal)) {
      var sigSs = getSignalSpreadsheet(payload);
      if (sigSs) {
        writeSignalLog(sigSs, payload.signal);
      }
      try { PropertiesService.getScriptProperties().setProperty("SIGNAL_LAST", contentsStr); } catch (err) {}
      return responseJSON({ status: "success", message: "Sinal recebido", timestamp: new Date().getTime().toString() });
    }

    if (payload.mode === "signal") {
      try { PropertiesService.getScriptProperties().setProperty("SIGNAL_LAST", contentsStr); } catch (err) {}
      return responseJSON({ status: "success", message: "Sinal recebido", timestamp: new Date().getTime().toString() });
    }

    // 1. Armazena metadados de conexão nas propriedades do script para uso posterior
    try {
      var props = PropertiesService.getScriptProperties();
      if (payload.spreadsheetUrl) props.setProperty("DIMENSIO_SPREADSHEET_URL", String(payload.spreadsheetUrl));
      if (payload.sheetUrl) props.setProperty("DIMENSIO_SPREADSHEET_URL", String(payload.sheetUrl));
      if (payload.spreadsheetId) props.setProperty("DIMENSIO_SPREADSHEET_ID", String(payload.spreadsheetId));
      if (payload.sheetId) props.setProperty("DIMENSIO_SPREADSHEET_ID", String(payload.sheetId));
      props.deleteProperty("APP_STATE");
      props.deleteProperty("LAST_UPDATED_AT");
    } catch (errProps) {}

    // 2. Modo Teste de Conexão Rápida
    if (payload.mode === "test" || payload.mode === "ping") {
      var testSs = getTargetSpreadsheet(payload);
      if (!testSs) {
        return responseJSON({
          status: "warning",
          message: "Webhook ativo, mas a Planilha Google não pôde ser aberta. Verifique se o link/ID da planilha está correto nas configurações e se o usuário possui permissão de Editor.",
          timestamp: new Date().toISOString()
        });
      }
      return responseJSON({
        status: "ok",
        message: "Conexão com Webhook e Planilha Google estabelecida com sucesso! Planilha: \\"" + testSs.getName() + "\\".",
        spreadsheetTitle: testSs.getName(),
        timestamp: new Date().toISOString()
      });
    }

    // 3. Localiza a planilha de destino
    var ss = getTargetSpreadsheet(payload);
    if (!ss) {
      return responseJSON({
        status: "error",
        message: "Não foi possível abrir a Planilha Google. Verifique se a URL informada nas configurações está correta e se o Google Apps Script possui permissão de Editor na planilha."
      });
    }

    var timestamp = new Date().toLocaleString("pt-BR");
    var isQuickSync = payload.quickSync === true;

    // 4. Lê o estado atual para criar snapshot de segurança
    var currentRaw = null;
    try {
      var prevSheet = ss.getSheetByName(DB_SHEET);
      if (prevSheet && prevSheet.getLastRow() >= 1) {
        var prevLastR = prevSheet.getLastRow();
        if (prevLastR === 1) {
          currentRaw = prevSheet.getRange("A1").getValue();
        } else {
          var prevVals = prevSheet.getRange(1, 1, prevLastR, 1).getValues();
          var prevArr = [];
          for (var pci = 0; pci < prevVals.length; pci++) {
            if (prevVals[pci][0]) prevArr.push(prevVals[pci][0]);
          }
          currentRaw = prevArr.join("");
        }
      }
    } catch (errPrev) {}

    // 5. Backups de Segurança
    if (!isQuickSync && currentRaw) {
      backupDbState(ss, currentRaw, "Backup pré-sincronização completa");
    }

    try {
      ensureDailyBackup(ss, currentRaw, contentsStr);
    } catch (errDaily) {}

    // 6. Salva o estado bruto na aba oculta __DB_STATE__
    saveDbState(ss, contentsStr, timestamp);

    // 7. Auto-sync em tempo real (Quick Sync)
    if (isQuickSync) {
      return responseJSON({
        status: "success",
        message: "Estado sincronizado em tempo real! (banco de dados atualizado)",
        timestamp: timestamp
      });
    }

    // 8. Reconstrução completa das abas visíveis da planilha (com isolamento de erro)
    try { buildPainel(ss, payload, timestamp); } catch (e1) { console.error("buildPainel:", e1); }
    try { buildEquipeHc(ss, payload, timestamp); } catch (e2) { console.error("buildEquipeHc:", e2); }
    try { buildColaboradores(ss, payload, timestamp); } catch (e3) { console.error("buildColaboradores:", e3); }
    try { buildEscalaDiaria(ss, payload, timestamp); } catch (e4) { console.error("buildEscalaDiaria:", e4); }
    try { buildTarefas(ss, payload, timestamp); } catch (e5) { console.error("buildTarefas:", e5); }
    try { buildIntervalos(ss, payload, timestamp); } catch (e6) { console.error("buildIntervalos:", e6); }
    try { buildCalendarioEscala(ss, payload, timestamp); } catch (e7) { console.error("buildCalendarioEscala:", e7); }
    try { buildRelatorios(ss, payload, timestamp); } catch (e8) { console.error("buildRelatorios:", e8); }
    try { buildConfig(ss, payload, timestamp); } catch (e9) { console.error("buildConfig:", e9); }

    return responseJSON({
      status: "success",
      message: "Planilha e estado atualizados com sucesso!",
      timestamp: timestamp
    });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

/* ====================================================================
 * RESOLUÇÃO ROBUSTA DA PLANILHA GOOGLE
 * ==================================================================== */

function openSpreadsheetUrlOrId(url) {
  if (!url) return null;
  var str = String(url).trim();
  if (!str) return null;
  var ss = null;

  // 1. Tenta por ID direto se tiver formato alfanumérico padrão de ID
  if (/^[a-zA-Z0-9-_]{20,}$/.test(str)) {
    try { ss = SpreadsheetApp.openById(str); if (ss) return ss; } catch (e) {}
  }

  // 2. Extrai ID contido na URL (/d/ID ou ?id=ID)
  var idMatch = str.match(/\\/d\\/([a-zA-Z0-9-_]+)/i) || str.match(/[?&]id=([a-zA-Z0-9-_]+)/i);
  if (idMatch && idMatch[1]) {
    try { ss = SpreadsheetApp.openById(idMatch[1]); if (ss) return ss; } catch (e) {}
  }

  // 3. Tenta abertura direta por URL completa
  try { ss = SpreadsheetApp.openByUrl(str); if (ss) return ss; } catch (e) {}

  return ss;
}

function getTargetSpreadsheet(payload) {
  var ss = null;

  if (payload && payload.spreadsheetUrl) ss = openSpreadsheetUrlOrId(payload.spreadsheetUrl);
  if (!ss && payload && payload.sheetUrl) ss = openSpreadsheetUrlOrId(payload.sheetUrl);
  if (!ss && payload && payload.spreadsheetId) {
    try { ss = SpreadsheetApp.openById(String(payload.spreadsheetId).trim()); } catch (e) {}
  }
  if (!ss && payload && payload.sheetId) {
    try { ss = SpreadsheetApp.openById(String(payload.sheetId).trim()); } catch (e) {}
  }
  if (!ss) {
    try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  }
  if (!ss) {
    try {
      var storedUrl = PropertiesService.getScriptProperties().getProperty("DIMENSIO_SPREADSHEET_URL");
      if (storedUrl) ss = openSpreadsheetUrlOrId(storedUrl);
    } catch (e) {}
  }
  if (!ss) {
    try {
      var storedId = PropertiesService.getScriptProperties().getProperty("DIMENSIO_SPREADSHEET_ID");
      if (storedId) ss = SpreadsheetApp.openById(String(storedId).trim());
    } catch (e) {}
  }
  var embeddedUrl = ${defaultUrlComment};
  if (!ss && embeddedUrl) {
    ss = openSpreadsheetUrlOrId(embeddedUrl);
  }

  return ss;
}

function getSignalSpreadsheet(payload) {
  return getTargetSpreadsheet(payload);
}

/* ====================================================================
 * ABAS VISÍVEIS DA PLANILHA
 * ==================================================================== */

function buildPainel(ss, payload, timestamp) {
  var sheet = getOrCreateSheet(ss, "Painel");
  sheet.clear();

  var title = (payload.teamName || "OPERAÇÃO") + (payload.location ? " - " + payload.location : "");
  sheet.getRange("A1").setValue("PAINEL DA OPERAÇÃO — " + title.toUpperCase());
  sheet.getRange("A1").setFontWeight("bold").setFontSize(14).setBackground("#1e293b").setFontColor("#ffffff");

  sheet.getRange("A3").setValue("Parâmetro");
  sheet.getRange("B3").setValue("Valor");
  sheet.getRange("A3:B3").setFontWeight("bold").setBackground("#f3f4f6");

  var teamLeaders = (payload.tables && payload.tables.teamLeaders) || [];
  var totalHc = sumHc(teamLeaders);
  if (totalHc === 0 && (payload.collaboratorsMaster || payload.data)) {
    var cols = payload.collaboratorsMaster || payload.data || [];
    for (var i = 0; i < cols.length; i++) {
      var role = String(cols[i].role || "");
      if (role.indexOf("Líder") < 0 && role.indexOf("Leader") < 0) totalHc++;
    }
  }

  var rows = [
    ["Local / Unidade / CD", payload.location || ""],
    ["Setor", payload.sector || ""],
    ["Nome do Time", payload.teamName || ""],
    ["Gestor Responsável", payload.manager || ""],
    ["Tipo de Escala", payload.scaleType === "custom" ? "Personalizada" : "Por turmas"],
    ["Turmas / Grupos de Escala", listToText(payload.scaleGroups)],
    ["Turnos Cadastrados", listToText(payload.shifts)],
    ["Turno Geral", payload.shift || (payload.settings && payload.settings.teamShift) || ""],
    ["Total de Colaboradores", payload.collaboratorsCount || (payload.collaboratorsMaster || []).length || 0],
    ["Times / Team Leaders", listToText(teamLeaders.length > 0 ? teamLeaders.map(function(t) { return t.teamLeader; }) : (payload.settings && payload.settings.teamLeaders))],
    ["Total HC (exclui TL)", totalHc],
    ["Data da Escala", payload.date || ""],
    ["Última Atualização", timestamp]
  ];

  if (rows.length > 0) {
    sheet.getRange(4, 1, rows.length, 2).setValues(rows);
    sheet.getRange(4, 1, rows.length, 1).setFontWeight("bold");
  }
  try { sheet.setFrozenRows(3); } catch (err) {}
  try { sheet.autoResizeColumns(1, 2); } catch (err) {}
}

function buildEquipeHc(ss, payload, timestamp) {
  var teamLeaders = (payload.tables && payload.tables.teamLeaders) || [];
  if (teamLeaders.length === 0) {
    var cols = payload.collaboratorsMaster || payload.data || [];
    var map = {};
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      var tl = c.teamLeader || "Sem Time";
      if (!map[tl]) { map[tl] = { teamLeader: tl, totalCollaborators: 0, teamLeadersInTime: 0, hcCount: 0 }; }
      map[tl].totalCollaborators++;
      var isTl = (c.role && (c.role.indexOf("Líder") >= 0 || c.role.indexOf("Leader") >= 0));
      if (isTl) {
        map[tl].teamLeadersInTime++;
      } else {
        map[tl].hcCount++;
      }
    }
    teamLeaders = Object.keys(map).map(function(k) { return map[k]; });
  }

  var headers = [
    "Time / Team Leader",
    "Colaboradores no Time",
    "Qtd Team Leaders (TL)",
    "HC (exclui TL)",
    "Participação no Total"
  ];

  var totalHc = sumHc(teamLeaders);
  var rows = teamLeaders.map(function(t) {
    var hc = t.hcCount || 0;
    var pct = totalHc > 0 ? ((hc / totalHc) * 100).toFixed(1) + "%" : "0%";
    return [
      t.teamLeader || "",
      t.totalCollaborators || 0,
      t.teamLeadersInTime || 0,
      hc,
      pct
    ];
  });

  if (rows.length === 0) {
    rows = [["—", 0, 0, 0, "0%"]];
  }

  var sheet = writeTable(ss, "Equipe_HC", headers, rows, "#065f46");
  try { sheet.getRange(2, 4, rows.length, 1).setFontWeight("bold"); } catch (err) {}
}

function buildColaboradores(ss, payload, timestamp) {
  var masterList = payload.collaboratorsMaster || payload.data || (payload.rawState && payload.rawState.collaborators) || [];
  var headers = [
    "RE (Matrícula)", "Nome Completo", "LDAP / Login", "Local", "Setor", "Gestor",
    "Turno", "Team Leader / Time", "Escala", "Cargo", "Categoria",
    "Skills & Proficiências", "Status", "Última Atualização"
  ];

  var rows = masterList.map(function(col) {
    return [
      col.registration || "",
      col.name || "",
      col.login || "",
      col.location || payload.location || "",
      col.sector || payload.sector || "",
      col.manager || payload.manager || "",
      col.shift || payload.shift || "",
      col.teamLeader || "",
      col.scale || "",
      col.role || "",
      col.category || "",
      col.skills || "Nenhuma",
      col.status || "Ativo",
      timestamp
    ];
  });

  writeTable(ss, "Colaboradores", headers, rows, "#0f766e");
}

function buildEscalaDiaria(ss, payload, timestamp) {
  var daily = payload.data || [];
  var headers = [
    "Data da Escala", "RE (Matrícula)", "Nome do Colaborador", "LDAP / Login", "Local", "Setor", "Gestor",
    "Turno", "Team Leader", "Escala", "Cargo", "Categoria",
    "Status no Dia", "Tarefa Alocada", "Horário de Intervalo", "Última Atualização"
  ];

  var rows = daily.map(function(item) {
    return [
      item.date || payload.date || "",
      item.registration || "",
      item.name || "",
      item.login || "",
      item.location || payload.location || "",
      item.sector || payload.sector || "",
      item.manager || payload.manager || "",
      item.shift || payload.shift || "",
      item.teamLeader || "",
      item.scale || "",
      item.role || "",
      item.category || "",
      item.status || "",
      item.task || "",
      item.interval || "",
      timestamp
    ];
  });

  var sheet = writeTable(ss, "Escala_Diaria", headers, rows, "#0284c7");

  var rep = payload.reports || {};
  if (rep.totalCollaborators) {
    var startRow = sheet.getLastRow() + 2;
    sheet.getRange(startRow, 1).setValue("RESUMO DO DIA");
    sheet.getRange(startRow, 1).setFontWeight("bold").setFontSize(11);
    var summary = [
      ["Presentes", rep.presentCount || 0],
      ["Ausentes", rep.absentCount || 0],
      ["Férias", rep.vacationCount || 0],
      ["Licença / Treinamento", rep.leaveTrainingCount || 0],
      ["Folgas de Escala", rep.offCount || 0],
      ["Taxa de Absenteísmo", rep.absenteeismRate || "0%"]
    ];
    sheet.getRange(startRow + 1, 1, summary.length, 2).setValues(summary);
  }
}

function buildTarefas(ss, payload, timestamp) {
  var tasks = (payload.tables && payload.tables.tasks) || (payload.settings && payload.settings.tasks) || (payload.rawState && payload.rawState.tasks) || [];
  var headers = ["Tarefa / Posto", "Cargos Permitidos", "Categorias Permitidas", "Colaboradores Alocados", "Ativa", "Última Atualização"];

  var rows = tasks.map(function(t) {
    return [
      t.name || "",
      listToText(t.allowedRoles || "Todos"),
      listToText(t.allowedCategories || "Todas"),
      t.membersCount || (t.members ? t.members.length : 0),
      t.active === false ? "Não" : "Sim",
      timestamp
    ];
  });

  writeTable(ss, "Tarefas", headers, rows, "#0d9488");
}

function buildIntervalos(ss, payload, timestamp) {
  var breaks = (payload.tables && payload.tables.breaks) || (payload.settings && payload.settings.breaks) || (payload.rawState && payload.rawState.breaks) || [];
  var headers = ["Horário", "Turno / Escala", "Capacidade", "Última Atualização"];

  var rows = breaks.map(function(b) {
    return [
      b.time || "",
      b.shift || "Geral",
      b.capacity || "Sem limite",
      timestamp
    ];
  });

  writeTable(ss, "Intervalos", headers, rows, "#c2410c");
}

function buildCalendarioEscala(ss, payload, timestamp) {
  var cal = (payload.tables && payload.tables.calendar) || (payload.rawState && payload.rawState.calendar) || [];
  var headers = ["Data (Folga)", "Turma / Grupo em Folga"];

  var calRows = cal.map(function(c) {
    if (Array.isArray(c)) return [c[0] || "", c[1] || ""];
    return [c.date || "", c.scaleGroup || ""];
  });

  var sheet = writeTable(ss, "Calendario_Escala", headers, calRows, "#4f46e5");

  var counts = {};
  var groups = (payload.scaleGroups || []);
  for (var i = 0; i < groups.length; i++) { counts[groups[i]] = 0; }
  for (var j = 0; j < cal.length; j++) {
    var g = Array.isArray(cal[j]) ? (cal[j][1] || "") : (cal[j].scaleGroup || "");
    counts[g] = (counts[g] || 0) + 1;
  }
  var startRow = sheet.getLastRow() + 2;
  sheet.getRange(startRow, 1).setValue("TOTAL DE FOLGAS POR TURMA NO CALENDÁRIO");
  sheet.getRange(startRow, 1).setFontWeight("bold").setFontSize(11);
  var summaryRows = groups.map(function(grp) {
    return [grp, counts[grp] || 0];
  });
  if (summaryRows.length > 0) {
    sheet.getRange(startRow + 1, 1, summaryRows.length, 2).setValues(summaryRows);
    sheet.getRange(startRow + 1, 1, summaryRows.length, 2).setFontWeight("bold");
  }
}

function buildRelatorios(ss, payload, timestamp) {
  var rep = payload.reports;
  if (!rep) return;

  var sheet = getOrCreateSheet(ss, "Relatorios_Diarios");
  var headers = [
    "Data", "Local", "Equipe / Setor", "Gestor", "Total Equipe", "Presentes", "Ausentes",
    "Férias", "Licença/Treinamento", "Folgas", "Taxa Absenteísmo %", "Observações", "Gerado Em"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight("bold").setFontColor("#ffffff").setBackground("#0f172a");
    try { sheet.setFrozenRows(1); } catch (err) {}
  }

  sheet.appendRow([
    rep.date || "",
    rep.location || "",
    (rep.teamName || "") + " - " + (rep.sector || ""),
    rep.manager || "",
    rep.totalCollaborators || 0,
    rep.presentCount || 0,
    rep.absentCount || 0,
    rep.vacationCount || 0,
    rep.leaveTrainingCount || 0,
    rep.offCount || 0,
    rep.absenteeismRate || "0%",
    rep.generalNotes || "",
    rep.generatedAt || timestamp
  ]);

  var details = rep.absencesAndOccurrences || [];
  if (details.length > 0) {
    var detSheet = getOrCreateSheet(ss, "Ausencias_Ocorrencias");
    var detHeaders = ["Data", "RE", "Nome", "Cargo", "Categoria", "Time / TL", "Status", "Tarefa", "Motivo da Ausência", "Ocorrência"];
    if (detSheet.getLastRow() === 0) {
      detSheet.getRange(1, 1, 1, detHeaders.length).setValues([detHeaders])
        .setFontWeight("bold").setFontColor("#ffffff").setBackground("#9d174d");
      try { detSheet.setFrozenRows(1); } catch (err) {}
    }
    var detRows = details.map(function(d) {
      return [d.date || "", d.registration || "", d.name || "", d.role || "", d.category || "", d.teamLeader || "", d.status || "", d.task || "", d.absenceReason || "", d.occurrence || ""];
    });
    detSheet.getRange(detSheet.getLastRow() + 1, 1, detRows.length, detHeaders.length).setValues(detRows);
  }
}

function buildConfig(ss, payload, timestamp) {
  var sheet = getOrCreateSheet(ss, "Config");
  sheet.clear();

  sheet.getRange("A1").setValue("CONFIGURAÇÕES E PARÂMETROS DA OPERAÇÃO");
  sheet.getRange("A1").setFontWeight("bold").setFontSize(13).setBackground("#1e293b").setFontColor("#ffffff");

  sheet.getRange("A3").setValue("Parâmetro");
  sheet.getRange("B3").setValue("Valor Configurado");
  sheet.getRange("A3:B3").setFontWeight("bold").setBackground("#f3f4f6");

  var settings = payload.settings || {};
  var rows = [
    ["Local / Unidade", settings.location || payload.location || ""],
    ["Nome da Equipe", settings.teamName || payload.teamName || ""],
    ["Setor / Operação", settings.sector || payload.sector || ""],
    ["Gestor Responsável", settings.manager || payload.manager || ""],
    ["Tipo de Escala", settings.scaleType === "custom" ? "Personalizada" : "Por turmas"],
    ["Turmas / Grupos de Escala", listToText(settings.scaleGroups || payload.scaleGroups)],
    ["Turnos Cadastrados", listToText(settings.shifts || payload.shifts)],
    ["Turno Geral", settings.teamShift || payload.shift || ""],
    ["Líder de Equipe Padrão", settings.defaultTeamLeader || ""],
    ["Times / Team Leaders", listToText(settings.teamLeaders)],
    ["Cargos", listToText(settings.roles)],
    ["Categorias", listToText(settings.categories)],
    ["Skills / Habilidades", listToText(settings.skills)],
    ["Total de Tarefas", (settings.tasks || []).length],
    ["Planilha Conectada", settings.onlineSpreadsheetName || ""],
    ["Auto-Sync em Tempo Real", settings.autoSyncEnabled || "Sim"],
    ["Total de Colaboradores", payload.collaboratorsCount || 0],
    ["Última Sincronização", timestamp]
  ];

  if (rows.length > 0) {
    sheet.getRange(4, 1, rows.length, 2).setValues(rows);
    sheet.getRange(4, 1, rows.length, 1).setFontWeight("bold");
  }
  try { sheet.autoResizeColumns(1, 2); } catch (err) {}
}

/* ====================================================================
 * PERSISTÊNCIA & BACKUPS
 * ==================================================================== */

function saveDbState(ss, contentsStr, timestamp) {
  var sheetDb = getOrCreateSheet(ss, DB_SHEET);
  sheetDb.clear();
  var chunkSize = 40000;
  if (contentsStr.length <= chunkSize) {
    sheetDb.getRange("A1").setValue(contentsStr);
    if (timestamp) {
      sheetDb.getRange("B1").setValue(timestamp);
    }
  } else {
    var row = 1;
    for (var i = 0; i < contentsStr.length; i += chunkSize) {
      var chunk = contentsStr.substring(i, i + chunkSize);
      sheetDb.getRange(row, 1).setValue(chunk);
      row++;
    }
    if (timestamp) {
      sheetDb.getRange(1, 2).setValue(timestamp);
    }
  }
  try { sheetDb.hideSheet(); } catch (err) {}
}

function writeChunkedBackupRow(sheet, row, isoDate, stateStr, reasonLabel) {
  if (!sheet || !stateStr) return;
  var chunkSize = 40000;
  var chunks = [];
  for (var c = 0; c < stateStr.length; c += chunkSize) {
    chunks.push(stateStr.substring(c, c + chunkSize));
  }

  var rowValues = [isoDate || new Date().toISOString(), reasonLabel || ""];
  for (var k = 0; k < chunks.length; k++) {
    rowValues.push(chunks[k]);
  }

  sheet.getRange(row, 1, 1, rowValues.length).setValues([rowValues]);
}

function parseBackupRow(row) {
  if (!row || row.length === 0) return null;
  var ts = row[0];
  if (!ts) return null;

  var col1 = String(row[1] || "");
  var stateRaw = "";
  var reason = "";

  var isCol1Json = col1.charAt(0) === "{" || col1.charAt(0) === "[" || col1.indexOf("rawState") >= 0;
  if (isCol1Json) {
    stateRaw = col1;
    reason = String(row[2] || "");
  } else {
    reason = col1;
    var chunks = [];
    for (var c = 2; c < row.length; c++) {
      if (row[c] !== undefined && row[c] !== null && String(row[c]).length > 0) {
        chunks.push(String(row[c]));
      }
    }
    stateRaw = chunks.join("");
  }

  if (!stateRaw) return null;
  return { ts: ts, stateRaw: stateRaw, reason: reason };
}

function backupDbState(ss, rawState, reason) {
  if (!rawState) return;
  try {
    var sheet = getOrCreateSheet(ss, BACKUP_SHEET);
    var lastRow = sheet.getLastRow();
    if (lastRow >= 1) {
      var lastCol = Math.max(3, sheet.getLastColumn());
      var prevRowVals = sheet.getRange(lastRow, 1, 1, lastCol).getValues()[0];
      var prevParsed = parseBackupRow(prevRowVals);
      if (prevParsed && prevParsed.stateRaw === rawState) return;
    }
    var row = lastRow >= 1 ? lastRow + 1 : 1;
    writeChunkedBackupRow(sheet, row, new Date().toISOString(), rawState, reason || "Backup de sincronização");

    var total = sheet.getLastRow();
    if (total > BACKUP_KEEP) {
      sheet.deleteRows(1, total - BACKUP_KEEP);
    }
    try { sheet.hideSheet(); } catch (err) {}
  } catch (errBk) {}
}

function normalizeBackupDate(val) {
  try {
    if (val instanceof Date && !isNaN(val.getTime())) {
      return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    var s = String(val || "");
    if (!s) return "";
    var d = new Date(s);
    if (isNaN(d.getTime())) return s.slice(0, 10);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
  } catch (err) {
    return String(val || "").slice(0, 10);
  }
}

function ensureDailyBackup(ss, currentRaw, incomingRaw, reasonLabel) {
  if (!ss) return;
  try {
    var todayKey = normalizeBackupDate(new Date());
    if (!todayKey) return;
    var sheet = getOrCreateSheet(ss, DAILY_BACKUP_SHEET);
    var n = sheet.getLastRow();
    if (n >= 1) {
      var dates = sheet.getRange(1, 1, n, 1).getValues();
      for (var i = 0; i < n; i++) {
        if (normalizeBackupDate(dates[i][0]) === todayKey) return;
      }
    }
    var snapshotRaw = (currentRaw && String(currentRaw).length > 0) ? currentRaw : (incomingRaw || "");
    if (!snapshotRaw) return;

    var row = n >= 1 ? n + 1 : 1;
    writeChunkedBackupRow(sheet, row, new Date().toISOString(), snapshotRaw, reasonLabel || "Backup Diário automático");

    var total = sheet.getLastRow();
    if (total > DAILY_BACKUP_KEEP) {
      sheet.deleteRows(1, total - DAILY_BACKUP_KEEP);
    }
    try { sheet.hideSheet(); } catch (err2) {}
  } catch (errDaily) {}
}

function formatBackupDate(ts) {
  try {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts || "");
    return d.toLocaleString("pt-BR");
  } catch (err) {
    return String(ts || "");
  }
}

function listBackupRows(ss, sheetName, type) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  var lastCol = Math.max(3, sheet.getLastColumn());
  var rows = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var parsed = parseBackupRow(rows[i]);
    if (!parsed) continue;
    var count = 0;
    var team = "";
    try {
      var st = JSON.parse(parsed.stateRaw);
      var core = (st && st.rawState) || st || {};
      count = (core.collaborators || []).length;
      team = core.teamName || "";
    } catch (e) {}
    out.push({
      id: type + ":" + (i + 1),
      type: type,
      index: i + 1,
      timestamp: parsed.ts || "",
      formattedDate: formatBackupDate(parsed.ts),
      reason: (type === "DAILY" ? "☀️ " : "") + (parsed.reason || (type === "DAILY" ? "Backup Diário automático" : "Backup de sincronização")),
      collaboratorCount: count,
      teamName: team
    });
  }
  return out;
}

function listBackups(ss) {
  var out = listBackupRows(ss, BACKUP_SHEET, "SYNC");
  out = out.concat(listBackupRows(ss, DAILY_BACKUP_SHEET, "DAILY"));
  return out;
}

function getBackup(ss, id) {
  var parts = String(id || "").split(":");
  var type = (parts[0] || "").toUpperCase();
  var index = parseInt(parts[1] || parts[0], 10);
  if (isNaN(index)) return null;
  var sheetName = type === "DAILY" ? DAILY_BACKUP_SHEET : BACKUP_SHEET;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return null;
  var lastRow = sheet.getLastRow();
  if (index < 1 || index > lastRow) return null;
  var lastCol = Math.max(3, sheet.getLastColumn());
  var rowVals = sheet.getRange(index, 1, 1, lastCol).getValues()[0];
  var parsed = parseBackupRow(rowVals);
  if (!parsed) return null;
  return { id: type + ":" + index, timestamp: parsed.ts || "", state: parsed.stateRaw };
}

/* ====================================================================
 * SINALIZAÇÃO VoIP & PTT
 * ==================================================================== */

function writeSignalLog(ss, messages) {
  if (!ss || !messages || messages.length === 0) return;
  var sheet = getOrCreateSheet(ss, SIGNAL_SHEET);
  var rows = messages.map(function(m) {
    return [
      m.mid || "",
      m.sender || "",
      m.to || "",
      m.kind || "",
      m.channel || "",
      m.ts || 0,
      JSON.stringify({
        payload: m.payload || {},
        senderName: m.senderName || "",
        senderRole: m.senderRole || ""
      })
    ];
  });
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
  }
  var total = sheet.getLastRow();
  if (total > SIGNAL_ROWS_KEEP) {
    sheet.deleteRows(1, total - SIGNAL_ROWS_KEEP);
  }
  try { sheet.hideSheet(); } catch (err) {}
}

function readSignalLog(ss) {
  if (!ss) return [];
  var sheet = ss.getSheetByName(SIGNAL_SHEET);
  if (!sheet || sheet.getLastRow() <= 0) return [];
  var lastRow = sheet.getLastRow();
  var start = Math.max(1, lastRow - SIGNAL_ROWS_KEEP + 1);
  var values = sheet.getRange(start, 1, lastRow - start + 1, 7).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    if (!v[0]) continue;
    var parsedPayload = {};
    var sName = "";
    var sRole = "";
    if (v[6]) {
      try {
        var rawObj = JSON.parse("" + v[6]);
        if (rawObj && typeof rawObj === "object" && rawObj.payload !== undefined) {
          parsedPayload = rawObj.payload;
          sName = rawObj.senderName || "";
          sRole = rawObj.senderRole || "";
        } else {
          parsedPayload = rawObj;
        }
      } catch (e) {}
    }
    out.push({
      mid: v[0],
      sender: v[1],
      to: v[2],
      kind: v[3],
      channel: v[4],
      ts: Number(v[5]) || 0,
      senderName: sName,
      senderRole: sRole,
      payload: parsedPayload
    });
  }
  return out;
}

/* ====================================================================
 * UTILITÁRIOS GERAIS
 * ==================================================================== */

function reconstructFromVisibleSheets(ss) {
  if (!ss) return null;
  var colSheet = ss.getSheetByName("Colaboradores") || ss.getSheetByName("Cadastros") || ss.getSheetByName("Equipe & HC");
  if (!colSheet || colSheet.getLastRow() <= 1) return null;

  var lastR = colSheet.getLastRow();
  var lastC = colSheet.getLastColumn();
  var headers = colSheet.getRange(1, 1, 1, lastC).getValues()[0].map(function(h) { return String(h || "").trim().toLowerCase(); });
  var rows = colSheet.getRange(2, 1, lastR - 1, lastC).getValues();

  var regIdx = -1, nameIdx = -1, loginIdx = -1, roleIdx = -1, catIdx = -1, leaderIdx = -1, shiftIdx = -1, scaleIdx = -1;
  for (var c = 0; c < headers.length; c++) {
    var h = headers[c];
    if (h.indexOf("matr") >= 0 || h.indexOf("re") >= 0) regIdx = c;
    else if (h.indexOf("nome") >= 0) nameIdx = c;
    else if (h.indexOf("login") >= 0) loginIdx = c;
    else if (h.indexOf("cargo") >= 0 || h.indexOf("funç") >= 0) roleIdx = c;
    else if (h.indexOf("categ") >= 0) catIdx = c;
    else if (h.indexOf("líd") >= 0 || h.indexOf("time") >= 0) leaderIdx = c;
    else if (h.indexOf("turno") >= 0) shiftIdx = c;
    else if (h.indexOf("escala") >= 0) scaleIdx = c;
  }

  var collaborators = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var name = nameIdx >= 0 ? String(r[nameIdx] || "").trim() : "";
    if (!name || name.toUpperCase() === "NOME" || name.toUpperCase() === "TOTAL") continue;
    collaborators.push({
      id: "collab_rec_" + (i + 1) + "_" + Math.random().toString(36).substr(2, 5),
      registration: regIdx >= 0 ? String(r[regIdx] || "").trim() : "",
      name: name,
      login: loginIdx >= 0 ? String(r[loginIdx] || "").trim() : "",
      role: roleIdx >= 0 ? String(r[roleIdx] || "").trim() : "",
      category: catIdx >= 0 ? String(r[catIdx] || "").trim() : "",
      teamLeader: leaderIdx >= 0 ? String(r[leaderIdx] || "").trim() : "Sem Time",
      shift: shiftIdx >= 0 ? String(r[shiftIdx] || "").trim() : "",
      scale: scaleIdx >= 0 ? String(r[scaleIdx] || "").trim() : "",
    });
  }

  if (collaborators.length === 0) return null;

  var reconstructedState = {
    updatedAtMs: Date.now(),
    updatedAt: new Date().toLocaleString("pt-BR"),
    collaborators: collaborators,
    setupCompleted: true
  };

  var jsonOut = JSON.stringify({ rawState: reconstructedState });
  try {
    saveDbState(ss, jsonOut, new Date().toLocaleString("pt-BR"));
  } catch (e) {}

  return jsonOut;
}

function writeTable(ss, sheetName, headers, rows, headerColor) {
  var sheet = getOrCreateSheet(ss, sheetName);
  sheet.clear();

  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight("bold")
    .setFontColor("#ffffff")
    .setBackground(headerColor || "#1e293b");

  if (rows && rows.length > 0) {
    var safeRows = rows.map(function(row) {
      return row.map(function(cell) {
        if (typeof cell === "string" && cell.length > 40000) {
          return cell.substring(0, 40000) + "... (truncado)";
        }
        return cell;
      });
    });
    var rng = sheet.getRange(2, 1, safeRows.length, headers.length);
    rng.setValues(safeRows);
    rng.setFontSize(10);
  }

  try { sheet.setFrozenRows(1); } catch (err) {}
  try { sheet.autoResizeColumns(1, headers.length); } catch (err) {}

  return sheet;
}

function listToText(list) {
  if (!list) return "";
  if (typeof list === "string") return list;
  if (!Array.isArray(list)) return "";
  return list.join(", ");
}

function sumHc(teamLeaders) {
  if (!teamLeaders || !Array.isArray(teamLeaders)) return 0;
  var total = 0;
  for (var i = 0; i < teamLeaders.length; i++) {
    total += (Number(teamLeaders[i].hcCount) || 0);
  }
  return total;
}

function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
}
