/** Diário de Obras CompaSSS. Uma base compartilhada com vários cadastros de obra. */
const REPORT_HEADERS = ['id', 'date', 'cliente', 'tecnico', 'obra', 'atividade', 'fotos', 'createdAt', 'obraId', 'revision'];
const PROJECT_HEADERS = ['id', 'nome', 'cliente', 'local', 'status', 'createdAt'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('CompaSSS — Diário de Obras')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function lock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function database_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) {
    if (DriveApp.getFileById(id).isTrashed()) throw new Error('A base está na lixeira. Restaure a planilha.');
    return SpreadsheetApp.openById(id);
  }
  const ss = SpreadsheetApp.create('Diario de Obra - Dados');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}
function tab_(ss, name, headers) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (!sh.getLastRow()) { sh.getRange(1, 1, 1, headers.length).setValues([headers]); sh.setFrozenRows(1); }
  const current = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  for (let i = 0; i < headers.length; i++) {
    if (!current[i]) sh.getRange(1, i + 1).setValue(headers[i]);
    else if (current[i] !== headers[i]) throw new Error('Cabeçalho incompatível na aba ' + name + ', coluna ' + (i + 1));
  }
  return sh;
}
function text_(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error('Informe ' + label + ' (até ' + max + ' caracteres).');
  return value.trim();
}
function id_(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('Identificador inválido.');
  return id;
}
function norm_(s) { return String(s || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLowerCase(); }
function key_(nome, cliente) { return JSON.stringify([norm_(nome), norm_(cliente)]); }
function projects_(sh) {
  return sh.getDataRange().getValues().slice(1).filter(r => r[0]).map(r => ({
    id: String(r[0]), nome: String(r[1]), cliente: String(r[2]), local: String(r[3] || ''),
    status: String(r[4] || 'Ativa'), createdAt: timestamp_(r[5])
  }));
}
function timestamp_(v) { return v instanceof Date ? v.getTime() : Number(v) || 0; }
function date_(v) {
  return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(v || '');
}
function cell_(v) { return typeof v === 'string' && /^[=+@-]/.test(v) ? "'" + v : v; }
function writeRow_(sh, row, values) { sh.getRange(row, 1, 1, values.length).setValues([values.map(cell_)]); }

/** Preserva as oito colunas antigas e acrescenta obraId/revision. Não altera as fotos. */
function prepare_() {
  const ss = database_();
  const reports = tab_(ss, 'reports', REPORT_HEADERS);
  const projects = tab_(ss, 'obras', PROJECT_HEADERS);
  const existing = projects_(projects);
  const byKey = {};
  existing.forEach(p => { byKey[key_(p.nome, p.cliente)] = p; });
  const rows = reports.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || r[8]) continue;
    const nome = String(r[4] || '').trim() || 'Obra sem nome';
    const cliente = String(r[2] || '').trim() || 'Cliente não informado';
    const key = key_(nome, cliente);
    let p = byKey[key];
    if (!p) {
      p = {id: Utilities.getUuid(), nome: nome, cliente: cliente, local: '', status: 'Ativa', createdAt: Date.now()};
      writeRow_(projects, projects.getLastRow() + 1, [p.id,p.nome,p.cliente,p.local,p.status,p.createdAt]);
      byKey[key] = p;
    }
    reports.getRange(i + 1, 9, 1, 2).setValues([[p.id, Number(r[9]) || 1]]);
  }
  return {ss: ss, reports: reports, projects: projects};
}
function getProjects() { return lock_(() => projects_(prepare_().projects)); }
function saveProject(project) {
  return lock_(() => {
    const db = prepare_();
    const nome = text_(project && project.nome, 'o nome da obra', 180);
    const cliente = text_(project && project.cliente, 'o cliente', 180);
    const local = String(project.local || '').trim();
    if (local.length > 300) throw new Error('Local excede 300 caracteres.');
    const all = projects_(db.projects);
    if (all.some(p => key_(p.nome,p.cliente) === key_(nome,cliente))) throw new Error('Já existe uma obra com esse nome e cliente. Selecione o cadastro existente.');
    const p = {id: Utilities.getUuid(), nome: nome, cliente: cliente, local: local, status: 'Ativa', createdAt: Date.now()};
    writeRow_(db.projects, db.projects.getLastRow() + 1, [p.id,p.nome,p.cliente,p.local,p.status,p.createdAt]);
    return p;
  });
}
function getReports() {
  return lock_(() => prepare_().reports.getDataRange().getValues().slice(1).filter(r => r[0]).map(r => {
    let fotos = [];
    try { fotos = JSON.parse(r[6] || '[]'); } catch (e) { /* Mantém registro legível. */ }
    return {id: String(r[0]), date: date_(r[1]), cliente: String(r[2] || ''), tecnico: String(r[3] || ''),
      obra: String(r[4] || ''), atividade: String(r[5] || ''), fotos: fotos, createdAt: timestamp_(r[7]),
      obraId: String(r[8] || ''), revision: Number(r[9]) || 1};
  }));
}
function photosFolder_() {
  const props = PropertiesService.getScriptProperties(), id = props.getProperty('FOLDER_ID');
  if (id) {
    const folder = DriveApp.getFolderById(id);
    if (folder.isTrashed()) throw new Error('A pasta de fotos está na lixeira. Restaure a pasta.');
    return folder;
  }
  const folder = DriveApp.createFolder('DiarioObra_Fotos');
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}
function validatePhoto_(photo) {
  if (!photo || typeof photo.src !== 'string') throw new Error('Foto inválida.');
  if (photo.src.startsWith('data:')) {
    if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(photo.src) || photo.src.length > 7000000) throw new Error('Imagem inválida ou maior que 5 MB.');
  } else if (!/^https:\/\/drive\.google\.com\/thumbnail\?id=[a-zA-Z0-9_-]+&sz=w1600$/.test(photo.src)) throw new Error('Endereço de foto inválido.');
}
function uploadPhoto_(dataUrl, name) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/);
  if (!match) throw new Error('Imagem inválida.');
  const file = photosFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], name));
  // Compatibilidade com a visualização e impressão da versão existente.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1600';
}
function saveReport(report) {
  return lock_(() => {
    if (!report) throw new Error('Registro inválido.');
    id_(report.id); id_(report.obraId);
    const date = text_(report.date, 'a data', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T12:00:00Z')) || new Date(date+'T12:00:00Z').toISOString().slice(0,10) !== date) throw new Error('Data inválida.');
    const tecnico = text_(report.tecnico, 'o técnico', 180), atividade = text_(report.atividade, 'a atividade', 15000);
    const inputPhotos = report.fotos || [];
    if (!Array.isArray(inputPhotos) || inputPhotos.length > 20) throw new Error('Use até 20 fotos por registro.');
    inputPhotos.forEach(validatePhoto_);
    const db = prepare_(), project = projects_(db.projects).find(p => p.id === report.obraId);
    if (!project) throw new Error('Selecione uma obra cadastrada.');
    const rows = db.reports.getDataRange().getValues();
    const idx = rows.findIndex((r,i) => i > 0 && String(r[0]) === report.id);
    const revision = idx > 0 ? Number(rows[idx][9]) || 1 : 0;
    if (Number(report.revision || 0) !== revision) throw new Error('Outro usuário alterou este registro. Recarregue e revise sua edição.');
    const photos = inputPhotos.map((f,i) => ({id: String(f.id || i), src: f.src.startsWith('data:') ? uploadPhoto_(f.src, report.id+'_'+i) : f.src}));
    const serialized = JSON.stringify(photos);
    if (serialized.length > 45000) throw new Error('Fotos excedem o limite de armazenamento do registro.');
    const createdAt = idx > 0 ? timestamp_(rows[idx][7]) : Date.now();
    writeRow_(db.reports, idx > 0 ? idx+1 : db.reports.getLastRow()+1,
      [report.id,date,project.cliente,tecnico,project.nome,atividade,serialized,createdAt,project.id,revision+1]);
    return {id: report.id, fotos: photos, revision: revision+1};
  });
}
function deleteReport(id, expectedRevision) {
  return lock_(() => {
    id_(id);
    const sh = prepare_().reports, rows = sh.getDataRange().getValues();
    const idx = rows.findIndex((r,i) => i > 0 && String(r[0]) === id);
    if (idx > 0) {
      if (Number(expectedRevision) !== (Number(rows[idx][9]) || 1)) throw new Error('Outro usuário alterou este registro. Recarregue antes de excluir.');
      sh.deleteRow(idx+1);
    }
    return true;
  });
}
function getSettings() {
  return lock_(() => {
    const sh = tab_(database_(), 'settings', ['key','value']), obj = {};
    sh.getDataRange().getValues().slice(1).forEach(r => { if (r[0]) obj[r[0]] = String(r[1] || ''); });
    return obj;
  });
}
function saveSettings(settings) {
  return lock_(() => {
    const copy = {};
    ['nome','revisao','confidencial'].forEach(k => {copy[k] = String(settings && settings[k] || '').trim(); if(copy[k].length>300)throw new Error('Configuração muito longa.');});
    copy.logo = String(settings && settings.logo || '');
    if (copy.logo) { validatePhoto_({src:copy.logo}); if(copy.logo.startsWith('data:'))copy.logo=uploadPhoto_(copy.logo,'logo'); }
    const sh = tab_(database_(), 'settings', ['key','value']), rows = sh.getDataRange().getValues();
    ['nome','logo','revisao','confidencial'].forEach(k => {
      const idx = rows.findIndex((r,i) => i>0 && r[0] === k);
      writeRow_(sh, idx>0?idx+1:sh.getLastRow()+1, [k,copy[k]]);
    });
    return copy;
  });
}
