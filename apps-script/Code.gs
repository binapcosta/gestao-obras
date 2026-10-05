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
function doGet(e){
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
function doPost(e){
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
    data.obra._revision=revision+1;
    sh.getRange(index<0?sh.getLastRow()+1:index+1,1,1,5).setValues([[
      data.obra.id,revision+1,data.requestId,JSON.stringify(data.obra),new Date().toISOString()
    ]]);
    SpreadsheetApp.flush();
    return json_({ok:true,revision:revision+1,sheetUrl:ss.getUrl()});
  }catch(err){return json_({ok:false,erro:err.message});}
  finally{if(lock.hasLock())lock.releaseLock();}
}
