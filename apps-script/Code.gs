function requireUser_(){
  var email=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  var configured=PropertiesService.getScriptProperties().getProperty('ALLOWED_EMAILS');
  if(!configured)throw new Error('Configure ALLOWED_EMAILS no servidor.');
  var allowed=configured.split(',').map(function(v){return v.trim().toLowerCase();}).filter(Boolean);
  if(!email||allowed.indexOf(email)<0)throw new Error('Acesso não autorizado. Entre com uma conta liberada.');
  return email;
}
function requireAdmin_(){
  var email=requireUser_();
  var admin=String(PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL')||'').trim().toLowerCase();
  if(!admin||email!==admin)throw new Error('Operação exclusiva da administração.');
}
function doGet(){
  try{
    requireUser_();
    return HtmlService.createHtmlOutputFromFile('Painel').setTitle('CompaSSS — Gestão de Obras');
  }catch(err){
    return HtmlService.createHtmlOutput('<h2>Acesso indisponível</h2><p>Entre com uma conta autorizada. A administração deve conferir a configuração de acesso.</p>');
  }
}
function doPost(){return json_({ok:false,erro:'Use o painel autenticado.'});}
function pcpApi(action,payload){
  requireUser_();
  var response;
  if(action==='obras'||action==='historico')response=readData_({parameter:{action:action}});
  else if(action==='salvarObra'){
    if(!payload||payload.action!=='salvarObra')throw new Error('Solicitação inválida.');
    response=writeData_({parameter:{payload:JSON.stringify(payload)}});
  }else throw new Error('Operação inválida.');
  return JSON.parse(response.getContent());
}
function database_() {
  var id=PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if(!id)throw new Error('Configure SHEET_ID nas Propriedades do script.');
  if(DriveApp.getFileById(id).isTrashed())throw new Error('A planilha está na lixeira.');
  return SpreadsheetApp.openById(id);
}
function tab_(ss){
  var sh=ss.getSheetByName('Obras_PCP')||ss.insertSheet('Obras_PCP');
  if(!sh.getLastRow()){sh.appendRow(['ID','Revisão','Request ID','JSON','Atualizado']);sh.setFrozenRows(1);}
  return sh;
}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function readData_(e){
  try{
    var ss=database_();
    if(e&&e.parameter&&e.parameter.action==='obras'){
      var rows=tab_(ss).getDataRange().getValues().slice(1);
      return json_({ok:true,obras:rows.filter(function(r){return r[0];}).map(function(r){
        var o=JSON.parse(r[3]);o._revision=Number(r[1]);return o;
      }),sheetUrl:ss.getUrl()});
    }
    var history=ss.getSheetByName('Historico');
    return json_({ok:true,rows:history?history.getDataRange().getValues():[],sheetUrl:ss.getUrl()});
  }catch(err){return json_({ok:false,erro:err.message});}
}
function validate_(o){
  if(!o||typeof o.id!=='string'||!/^[a-zA-Z0-9_-]{1,150}$/.test(o.id)||typeof o.nome!=='string'||!o.nome.trim())throw new Error('Obra inválida.');
  if(!o.cats||typeof o.cats!=='object')throw new Error('Categorias inválidas.');
  ['eq','ter','inf','cab','cmp'].forEach(function(cat){
    if(!Array.isArray(o.cats[cat]))throw new Error('Categoria inválida: '+cat);
    o.cats[cat].forEach(function(r){
      ['val','bud'].forEach(function(k){
        if(r[k]!==''&&r[k]!=null&&(!isFinite(Number(r[k]))||Number(r[k])<0))throw new Error('Custo inválido.');
      });
    });
  });
  ['venda','impostoPct'].forEach(function(k){if(!isFinite(Number(o[k]||0))||Number(o[k]||0)<0)throw new Error('Valor financeiro inválido.');});
  if(Number(o.impostoPct)>100)throw new Error('Percentual de imposto inválido.');
  if(o.pcp){
    ['comprometido','restante'].forEach(function(k){if(!isFinite(Number(o.pcp[k]||0))||Number(o.pcp[k]||0)<0)throw new Error('Previsão de custo inválida.');});
    if(!Array.isArray(o.pcp.tarefas))throw new Error('Atividades inválidas.');
  }
  if(JSON.stringify(o).length>45000)throw new Error('Obra excede o limite desta versão (45.000 caracteres).');
}
function writeData_(e){
  var lock=LockService.getScriptLock();
  try{
    var raw=e&&e.parameter&&e.parameter.payload?e.parameter.payload:e&&e.postData?e.postData.contents:null;
    if(!raw)throw new Error('Payload vazio.');
    var data=JSON.parse(raw);
    if(data.action!=='salvarObra')throw new Error('Utilize a interface PCP atualizada.');
    validate_(data.obra);
    if(typeof data.requestId!=='string'||!data.requestId)throw new Error('Request ID obrigatório.');
    lock.waitLock(30000);
    var ss=database_(),sh=tab_(ss),rows=sh.getDataRange().getValues(),index=-1;
    for(var i=1;i<rows.length;i++)if(rows[i][0]===data.obra.id){index=i;break;}
    var revision=index<0?0:Number(rows[index][1]);
    if(index>=0&&rows[index][2]===data.requestId)return json_({ok:true,revision:revision,sheetUrl:ss.getUrl()});
    if(Number(data.obra._revision||0)!==revision)throw new Error('Conflito: outra pessoa atualizou a obra. Faça backup e carregue a versão do Sheets.');
    var previous=index<0?null:JSON.parse(rows[index][3]);
    var audit=ss.getSheetByName('Versoes_PCP')||ss.insertSheet('Versoes_PCP');
    if(!audit.getLastRow()){audit.appendRow(['Data UTC','Obra ID','Revisão','Request ID','Usuário identificado','Estado anterior JSON','Estado novo JSON','Campos alterados','Estado']);audit.setFrozenRows(1);}
    var auditRow=audit.getLastRow()+1;
    data.obra._revision=revision+1;
    audit.getRange(auditRow,1,1,9).setValues([[new Date().toISOString(),data.obra.id,revision+1,data.requestId,Session.getActiveUser().getEmail()||'Não identificado pela implantação',previous?JSON.stringify(previous):'',JSON.stringify(data.obra),changedFields_(previous,data.obra).join(', '),'PREPARADO']]);
    SpreadsheetApp.flush();
    sh.getRange(index<0?sh.getLastRow()+1:index+1,1,1,5).setValues([[
      data.obra.id,revision+1,data.requestId,JSON.stringify(data.obra),new Date().toISOString()
    ]]);
    SpreadsheetApp.flush();
    var auditWarning='';
    try{audit.getRange(auditRow,9).setValue('GRAVADO');SpreadsheetApp.flush();}catch(logErr){auditWarning='Obra salva; confirmação do histórico pendente.';}
    return json_({ok:true,revision:revision+1,sheetUrl:ss.getUrl(),aviso:auditWarning});
  }catch(err){return json_({ok:false,erro:err.message});}
  finally{if(lock.hasLock())lock.releaseLock();}
}

function changedFields_(before,after){
  var fields=Object.keys(after).filter(function(k){return k!=='_revision';});
  if(before)fields=fields.concat(Object.keys(before).filter(function(k){return k!=='_revision';}));
  return fields.filter(function(k,i,a){return a.indexOf(k)===i&&JSON.stringify(before&&before[k])!==JSON.stringify(after[k]);});
}
// Executar no editor para ativar. Não é chamada pela API pública.
function instalarBackupDiario(){
  requireAdmin_();
  var props=PropertiesService.getScriptProperties();
  if(!props.getProperty('BACKUP_FOLDER_ID')){
    var folder=DriveApp.createFolder('CompaSSS — Backups PCP');
    props.setProperty('BACKUP_FOLDER_ID',folder.getId());
  }
  var exists=ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='backupDiarioPCP';});
  if(!exists)ScriptApp.newTrigger('backupDiarioPCP').timeBased().everyDays(1).atHour(2).inTimezone('America/Sao_Paulo').create();
  return backupDiarioPCP();
}
function backupDiarioPCP(){
  requireAdmin_();
  var lock=LockService.getScriptLock();
  try{
    lock.waitLock(30000);
    var props=PropertiesService.getScriptProperties(),folderId=props.getProperty('BACKUP_FOLDER_ID');
    if(!folderId)throw new Error('Execute instalarBackupDiario no editor.');
    var ss=database_(),date=Utilities.formatDate(new Date(),'America/Sao_Paulo','yyyy-MM-dd');
    var key=ss.getId()+':'+date;
    if(props.getProperty('LAST_BACKUP_KEY')===key)return;
    var copy=DriveApp.getFileById(ss.getId()).makeCopy('PCP_'+date,DriveApp.getFolderById(folderId));
    props.setProperty('LAST_BACKUP_KEY',key);
    props.setProperty('LAST_BACKUP_URL',copy.getUrl());
    console.log('Backup criado: '+copy.getUrl());
    return copy.getUrl();
  }finally{if(lock.hasLock())lock.releaseLock();}
}
