const fs=require('fs'),vm=require('vm'),assert=require('assert');
const backend=fs.readFileSync(__dirname+'/apps-script/Code.gs','utf8');new vm.Script(backend);
class Sheet{
 constructor(name){this.name=name;this.data=[];}
 getLastRow(){return this.data.length;}
 appendRow(row){this.data.push(row);}
 setFrozenRows(){}
 getDataRange(){return {getValues:()=>this.data.map(r=>r.slice())};}
 getRange(row,col,nr,nc){return {setValues:values=>{for(let i=0;i<values.length;i++){this.data[row-1+i]||=[];values[i].forEach((v,j)=>this.data[row-1+i][col-1+j]=v);}},setValue:v=>{this.data[row-1]||=[];this.data[row-1][col-1]=v;}};}
}
const sheets={Obras_PCP:new Sheet('Obras_PCP')};sheets.Obras_PCP.appendRow(['ID','Revisão','Request ID','JSON','Atualizado']);
const emails=[],triggers=[],ss={getSheetByName:n=>sheets[n]||null,insertSheet:n=>sheets[n]=new Sheet(n),getUrl:()=> 'https://sheet.test'};
const obj={id:'obra1',nome:'Obra <A>',status:'andamento',cats:{eq:[{id:'e1',name:'Câmera',bud:1000},{id:'e2',name:'Sensor',bud:250}],ter:[],inf:[],cab:[],cmp:[]},pcp:{alertasAtivos:true,passagem:{proposta:'I123R0',emailGestor:'gestor@example.com',emailsPCP:'pcp@example.com'},tarefas:[{id:'t1',nome:'Instalação',fim:'2026-10-10',responsavel:'Leo',emailResponsavel:'leo@example.com'},{id:'t2',nome:'Finalizada',fim:'2026-10-10',fimReal:'2026-10-11',emailResponsavel:'leo@example.com'},{id:'t3',nome:'Futura',fim:'2026-11-11',emailResponsavel:'leo@example.com'}]}};
sheets.Obras_PCP.appendRow(['obra1',3,'',JSON.stringify(obj),'']);
const props={SHEET_ID:'sheet',ALLOWED_EMAILS:'admin@example.com',ADMIN_EMAIL:'admin@example.com'};
const ctx=vm.createContext({console,Date,Number,JSON,Math,Session:{getActiveUser:()=>({getEmail:()=> 'admin@example.com'})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v})},DriveApp:{getFileById:()=>({isTrashed:()=>false})},SpreadsheetApp:{openById:()=>ss,flush:()=>{}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){},hasLock:()=>true})},Utilities:{formatDate:()=> '2026-10-27'},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:(...args)=>emails.push(args)},HtmlService:{createHtmlOutput:html=>({getAs:()=>({setName:()=>({html})})})},MimeType:{PDF:'application/pdf'},ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:name=>({timeBased(){return this},everyDays(){return this},atHour(){return this},inTimezone(){return this},create(){triggers.push({getHandlerFunction:()=>name});}})}});
vm.runInContext(backend,ctx);
const req={obraId:'obra1',revision:3,date:'2026-11-01',email:'compras@example.com',proposal:'Obra <A>',requestId:'abcd1234-5678-9123-aaaa',items:[{id:'e1',qty:2,name:'Câmera',budget:1000},{id:'e2',qty:3,name:'Sensor',budget:250}]};
const order=ctx.buildOrder_(ctx.readSharedWork_('obra1'),req);assert.equal(order.total,1250);assert.equal(order.lines[0].qty,2);assert.ok(ctx.orderHtml_(order).includes('Obra &lt;A&gt;'));assert.ok(ctx.orderHtml_(order).includes('1.250,00'));
assert.throws(()=>ctx.buildOrder_(ctx.readSharedWork_('obra1'),{...req,revision:2}));assert.throws(()=>ctx.buildOrder_(ctx.readSharedWork_('obra1'),{...req,proposal:'outro'}));assert.throws(()=>ctx.buildOrder_(ctx.readSharedWork_('obra1'),{...req,items:[{id:'e1',qty:2,name:'Câmera',budget:1}]}));
ctx.sendOrder_(req);assert.equal(emails.length,1);assert.equal(emails[0][0].name,'CompaSSS — Gestão de Obras');assert.equal(sheets.Envios_Compra.data[1][5],'ENVIADO');assert.throws(()=>ctx.sendOrder_(req));assert.equal(emails.length,1);
ctx.installDelayAlerts_();ctx.installDelayAlerts_();assert.equal(triggers.length,1);assert.equal(triggers[0].getHandlerFunction(),'delayAlertsDaily_');
ctx.delayAlertsDaily_();assert.equal(emails.length,4);let messages=emails.slice(1);assert.equal(messages.find(x=>x[0]==='leo@example.com')[2].includes('Instalação'),true);assert.equal(messages.find(x=>x[0]==='leo@example.com')[2].includes('Finalizada'),false);assert.equal(messages.find(x=>x[0]==='leo@example.com')[2].includes('Futura'),false);ctx.delayAlertsDaily_();assert.equal(emails.length,4);
props.ALLOWED_EMAILS='other@example.com';assert.throws(()=>ctx.installDelayAlerts_());assert.equal(triggers.length,1);
console.log('OK: PDF da compra, orçamento e revisão validados, envio sem repetição, acionador restrito ao administrador, destinatários de atrasos e deduplicação diária.');
const withUnit=JSON.parse(JSON.stringify(obj));withUnit._revision=3;withUnit.cats.eq[0].unitOrcado=500;const reqUnit={...req,items:[{id:'e1',qty:1,name:'Câmera',budget:1000,unitCost:500}]};const enriched=ctx.buildOrder_(withUnit,reqUnit);assert.equal(enriched.lines[0].unitCost,500);assert.ok(ctx.orderHtml_(enriched).includes('500,00'));assert.throws(()=>ctx.buildOrder_(withUnit,{...reqUnit,items:[{...reqUnit.items[0],unitCost:499}]}));
console.log('OK: custo unitário correto no PDF e conferido com a planilha.');
props.ALLOWED_EMAILS='admin@example.com';
const quoteReq={...req,requestId:'quote123-5678-9123-aaaa',items:[{id:'e1',name:'Câmera',qty:2}],billing:{direct:false,razaoSocial:'Não usar'}};
const quoteOrder=ctx.buildQuotation_(ctx.readSharedWork_('obra1'),quoteReq);const quoteHtml=ctx.quotationHtml_(quoteOrder);assert.equal(quoteOrder.billing.razaoSocial,'Compasss Tecnologia');assert.ok(quoteHtml.includes('28.781.740/0002-02'));assert.ok(quoteHtml.includes('11.356.281'));assert.ok(quoteHtml.includes('1.437.030-7'));assert.ok(!quoteHtml.includes('1.000,00'));assert.ok(!quoteHtml.includes('orçado'));assert.equal(quoteOrder.lines[0].budget,undefined);
ctx.sendOrder_(quoteReq,true);assert.equal(sheets.Envios_Cotacao.data[1][5],'ENVIADO');const quoteMail=emails.at(-1)[0];assert.ok(quoteMail.subject.startsWith('Solicitação de cotação'));assert.ok(quoteMail.attachments[0].html.includes('Compasss Tecnologia'));assert.throws(()=>ctx.sendOrder_(quoteReq,true));
const directRequest={...quoteReq,billing:{direct:true,razaoSocial:'Cliente <Teste>',cnpj:'12.345.678/0001-90',ie:'ISENTO',im:''}};const directHtml=ctx.quotationHtml_(ctx.buildQuotation_(ctx.readSharedWork_('obra1'),directRequest));assert.ok(directHtml.includes('Cliente &lt;Teste&gt;'));assert.ok(!directHtml.includes('28.781.740/0002-02'));assert.ok(directHtml.includes('Faturamento direto'));assert.throws(()=>ctx.buildQuotation_(ctx.readSharedWork_('obra1'),{...quoteReq,billing:{direct:true}}));assert.throws(()=>ctx.buildQuotation_(ctx.readSharedWork_('obra1'),{...quoteReq,items:[quoteReq.items[0],quoteReq.items[0]]}));
console.log('OK: PDF de cotação sem custos internos, faturamento direto e padrão, envio e histórico próprios.');
