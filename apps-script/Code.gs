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
  if(action==='enviarCompra')return sendOrder_(payload);
  if(action==='instalarAlertas')return installDelayAlerts_();
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
  if(!sh.getLastRow()){sh.getRange(1,1,1,5).setValues([['ID','Revisão','Request ID','JSON','Atualizado']]);sh.setFrozenRows(1);}
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


/* Compras e alertas: arquivo auxiliar do projeto Apps Script. */
function emailValid_(value){return /^[A-Za-z0-9][A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]*@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(String(value||''));}
function isoValid_(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;
  var d=new Date(value+'T12:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function htmlEscape_(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function brMoneyServer_(n){return 'R$ '+Number(n).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
function readSharedWork_(id){
  if(!/^[a-zA-Z0-9_-]{1,150}$/.test(String(id||'')))throw new Error('Obra inválida.');
  var rows=tab_(database_()).getDataRange().getValues();
  for(var i=1;i<rows.length;i++)if(String(rows[i][0])===id){var o=JSON.parse(rows[i][3]);o._revision=Number(rows[i][1]);return o;}
  throw new Error('Obra não encontrada no Sheets. Salve antes de enviar.');
}
function buildOrder_(o,request){
  if(Number(request.revision)!==o._revision)throw new Error('A obra compartilhada foi alterada. Carregue a versão atual.');
  if(!isoValid_(request.date))throw new Error('Informe uma data necessária válida.');
  var proposal=String(o.pcp&&o.pcp.passagem&&o.pcp.passagem.proposta||'').trim();
  if(request.proposal!==proposal)throw new Error('A proposta local difere da planilha. Salve a obra antes de enviar.');
  if(!proposal||proposal.length>300)throw new Error('Cadastre e salve o número da proposta na passagem da proposta.');
  if(!Array.isArray(request.items)||!request.items.length||request.items.length>100)throw new Error('Selecione de 1 a 100 equipamentos.');
  var byId={},seen={},lines=[],total=0;
  (o.cats&&o.cats.eq||[]).forEach(function(r){byId[r.id]=r;});
  request.items.forEach(function(i){
    var item=byId[i.id],qty=Number(i.qty);
    if(!item||seen[i.id]||!Number.isFinite(qty)||qty<=0||qty>1000000)throw new Error('Equipamento ou quantidade inválida.');
    var budget=Number(item.bud);
    if(String(i.name||'')!==String(item.name||'')||Number(i.budget)!==budget)throw new Error('O item local difere da planilha. Salve a obra antes de enviar.');
    if(item.bud===''||item.bud==null||!Number.isFinite(budget)||budget<0)throw new Error('Informe o valor orçado do equipamento '+String(item.name||'')+' e salve a obra.');
    seen[i.id]=true;total+=budget;lines.push({name:String(item.name||''),qty:qty,budget:budget});
  });
  return {project:String(o.nome||''),proposal:proposal,date:request.date,lines:lines,total:total};
}
function orderHtml_(order){
  var h='<html><head><meta charset="utf-8"><style>body{font:12px Arial;color:#222}h1{color:#406e2a}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}th{background:#e9f4e6}.num{text-align:right}</style></head><body>';
  h+='<h1>Solicitação de compra</h1><p><b>Obra:</b> '+htmlEscape_(order.project)+'<br><b>Proposta:</b> '+htmlEscape_(order.proposal)+'<br><b>Data necessária:</b> '+htmlEscape_(order.date.split('-').reverse().join('/'))+'</p>';
  h+='<table><thead><tr><th>Equipamento</th><th>Quantidade solicitada</th><th class="num">Valor orçado total do item</th></tr></thead><tbody>';
  order.lines.forEach(function(l){h+='<tr><td>'+htmlEscape_(l.name)+'</td><td>'+htmlEscape_(l.qty)+'</td><td class="num">'+brMoneyServer_(l.budget)+'</td></tr>';});
  return h+'</tbody></table><p><b>Orçado dos itens selecionados: '+brMoneyServer_(order.total)+'</b></p><p>O valor indicado é o orçamento total registrado para cada item; não é um preço unitário nem uma autorização para pagamento.</p></body></html>';
}
function sendOrder_(request){
  requireUser_();if(!request||!emailValid_(request.email))throw new Error('Informe um e-mail de destinatário válido.');
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(String(request.requestId||'')))throw new Error('Identificador de envio inválido.');
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    var ss=database_(),log=ss.getSheetByName('Envios_Compra')||ss.insertSheet('Envios_Compra');
    if(!log.getLastRow())log.appendRow(['Data UTC','Solicitação ID','Obra ID','Destinatário','Usuário','Estado']);
    var existing=log.getDataRange().getValues();
    for(var i=1;i<existing.length;i++)if(existing[i][1]===request.requestId)throw new Error('Esta solicitação já foi processada ou aguarda verificação. Confira o histórico antes de reenviar.');
    var o=readSharedWork_(request.obraId),order=buildOrder_(o,request),pdf=HtmlService.createHtmlOutput(orderHtml_(order)).getAs(MimeType.PDF).setName('Solicitacao_de_compra.pdf');
    var row=log.getLastRow()+1;log.getRange(row,1,1,6).setValues([[new Date().toISOString(),request.requestId,request.obraId,request.email,Session.getActiveUser().getEmail()||'', 'PREPARADO']]);SpreadsheetApp.flush();
    try{
      MailApp.sendEmail({to:request.email,subject:'Solicitação de compra — '+order.proposal,body:'Segue em anexo a solicitação de compra da obra '+order.project+'.\nData necessária: '+order.date.split('-').reverse().join('/')+'.',attachments:[pdf]});
      log.getRange(row,6).setValue('ENVIADO');SpreadsheetApp.flush();return {ok:true};
    }catch(e){try{log.getRange(row,6).setValue('VERIFICAR');SpreadsheetApp.flush();}catch(ignore){}throw new Error('Envio não confirmado. Consulte Envios_Compra antes de tentar novamente.');}
  }finally{lock.releaseLock();}
}
function installDelayAlerts_(){
  requireAdmin_();var name='delayAlertsDaily_',existing=ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()===name;});
  if(!existing)ScriptApp.newTrigger(name).timeBased().everyDays(1).atHour(8).inTimezone('America/Sao_Paulo').create();
  return {ok:true,info:'Acionador diário instalado na conta administradora. Ative os alertas nas obras e salve no Sheets.'};
}
function delayAlertsDaily_(){
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    var ss=database_(),sh=tab_(ss),rows=sh.getDataRange().getValues(),today=Utilities.formatDate(new Date(),'America/Sao_Paulo','yyyy-MM-dd');
    var log=ss.getSheetByName('Alertas_Atraso')||ss.insertSheet('Alertas_Atraso');
    if(!log.getLastRow())log.appendRow(['Data','Obra ID','Destinatário','Estado','Atividades']);
    var history=log.getDataRange().getValues(),seen={};
    history.slice(1).forEach(function(r){var date=r[0] instanceof Date?Utilities.formatDate(r[0],'America/Sao_Paulo','yyyy-MM-dd'):String(r[0]);seen[date+'|'+r[1]+'|'+r[2]]=true;});
    rows.slice(1).forEach(function(r){
      if(!r[0])return;var o;try{o=JSON.parse(r[3]);}catch(e){console.error('Obra inválida: '+r[0]);return;}
      if(o.status==='concluida'||!o.pcp||!o.pcp.alertasAtivos)return;
      var late=(o.pcp.tarefas||[]).filter(function(t){var due=t.previsao||t.fim;return !t.fimReal&&isoValid_(due)&&due<today;});if(!late.length)return;
      var recipients={},pass=o.pcp.passagem||{};
      function add(value,allTasks){String(value||'').split(/[;,]/).forEach(function(v){v=v.trim().toLowerCase();if(emailValid_(v)){if(!recipients[v])recipients[v]=[];if(allTasks)recipients[v]=late.slice();}});}
      add(pass.emailGestor,true);add(pass.emailsPCP,true);
      late.forEach(function(t){var email=String(t.emailResponsavel||'').trim().toLowerCase();if(emailValid_(email)){if(!recipients[email])recipients[email]=[];if(recipients[email].indexOf(t)<0)recipients[email].push(t);}});
      Object.keys(recipients).forEach(function(email){
        var key=today+'|'+r[0]+'|'+email;if(seen[key])return;
        if(MailApp.getRemainingDailyQuota()<1){console.error('Cota de e-mails esgotada para '+email);return;}
        var tasks=recipients[email],body='Obra: '+String(o.nome||'')+'\nProposta: '+String(pass.proposta||'não informada')+'\n\nAtividades com término em atraso:\n'+tasks.map(function(t){return '- '+String(t.nome||'')+' | responsável: '+String(t.responsavel||'não informado')+' | término: '+String(t.previsao||t.fim).split('-').reverse().join('/');}).join('\n')+'\n\nConsulte o painel para atualizar o cronograma.';
        var row=log.getLastRow()+1;log.getRange(row,1,1,5).setValues([[today,String(r[0]),email,'PREPARADO',tasks.length]]);SpreadsheetApp.flush();seen[key]=true;
        try{MailApp.sendEmail(email,'Alerta de atraso — '+String(o.nome||''),body);log.getRange(row,4).setValue('ENVIADO');SpreadsheetApp.flush();}catch(e){log.getRange(row,4).setValue('VERIFICAR');SpreadsheetApp.flush();console.error('Envio não confirmado: '+email+' / '+r[0]);}
      });
    });
  }finally{lock.releaseLock();}
}

// Execute no editor com a conta administradora para conceder as novas permissões.
function autorizarComprasEAlertas(){requireAdmin_();console.log('Cota diária restante: '+MailApp.getRemainingDailyQuota());}
