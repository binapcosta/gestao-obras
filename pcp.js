/* PCP: complemento da interface existente. Salvamento remoto explícito por obra. */
function pcpState(o) {
  if (!o.pcp) o.pcp = {passagem:{}, tarefas:[], comprometido:0, restante:0};
  return o.pcp;
}
function pcpElement(tag, text, parent) {
  const el=document.createElement(tag);
  if(text!==undefined) el.textContent=text;
  if(parent) parent.appendChild(el);
  return el;
}
function pcpInput(parent,label,value,type,change,disabled=false) {
  const wrap=pcpElement('label',undefined,parent); wrap.className='form-field';
  pcpElement('span',label,wrap).className='form-label';
  const input=pcpElement(type==='textarea'?'textarea':'input',undefined,wrap);
  if(type!=='textarea') input.type=type==='emails'?'email':type;
  if(type==='emails') input.multiple=true;
  input.className='form-input'; input.value=value??''; input.disabled=disabled;
  if(type==='number'){input.min='0';input.step='0.01';}
  input.addEventListener('change',()=>{
    if(!input.checkValidity()){input.reportValidity();return;}
    change(type==='number'?Number(input.value):input.value);
    saveAll(); renderPCP();
  });
}
function pcpDate(d){return /^\d{4}-\d{2}-\d{2}$/.test(d||'')?Date.parse(d+'T12:00:00Z'):NaN;}
function pcpErrors(p){
  const errors=[], map=new Map(p.tarefas.map(t=>[t.id,t]));
  p.tarefas.forEach(t=>{
    [['inicio','fim'],['inicioReal','fimReal']].forEach(([a,b])=>{
      if(t[a]&&t[b]&&pcpDate(t[b])<pcpDate(t[a])) errors.push(t.nome+': término anterior ao início.');
    });
    if(t.qtdReal>t.qtd) errors.push(t.nome+': quantidade concluída maior que a prevista.');
    if(t.predecessora&&!map.has(t.predecessora)) errors.push(t.nome+': predecessora inexistente.');
    const seen=new Set([t.id]); let prev=t.predecessora;
    while(prev&&map.has(prev)){
      if(seen.has(prev)){errors.push(t.nome+': ciclo de dependência.');break;}
      seen.add(prev);prev=map.get(prev).predecessora;
    }
    const pred=map.get(t.predecessora);
    if(pred&&t.inicio&&(pred.fimReal||pred.previsao||pred.fim)&&pcpDate(t.inicio)<=pcpDate(pred.fimReal||pred.previsao||pred.fim))
      errors.push(t.nome+': início deve ser posterior ao término da predecessora (dias corridos).');
  });
  return [...new Set(errors)];
}
function pcpMetrics(o){
  const p=pcpState(o), hours=p.tarefas.reduce((s,t)=>s+(t.horas||0),0);
  const weighted=p.tarefas.every(t=>t.horas>0&&t.qtd>0)&&p.tarefas.length>0;
  const advance=weighted?p.tarefas.reduce((s,t)=>s+t.horas*Math.min(1,(t.qtdReal||0)/t.qtd),0)/hours*100:null;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const parts=Object.fromEntries(today.map(x=>[x.type,x.value]));
  const iso=parts.year+'-'+parts.month+'-'+parts.day;
  return {advance, hours, realHours:p.tarefas.reduce((s,t)=>s+(t.horasReal||0),0),
    late:p.tarefas.filter(t=>!t.fimReal&&(t.previsao||t.fim)&&(t.previsao||t.fim)<iso).length,
    final:obraTotal(o)+(p.comprometido||0)+(p.restante||0)};
}
function renderPCP(){
  const panel=document.getElementById('pcpPanel');
  const openTasks = panel.dataset.obraId === currentObraId
    ? new Set(Array.from(panel.querySelectorAll('details[open]')).map(el => el.dataset.taskId))
    : new Set();
  panel.dataset.obraId = currentObraId || '';
  panel.replaceChildren();
  const o=obras[currentObraId]; if(!o)return;
  const p=pcpState(o), m=pcpMetrics(o);
  pcpElement('h2','PCP — prazo e custo para concluir',panel);
  const summary=pcpElement('p',undefined,panel);
  summary.textContent='Atividades atrasadas: '+m.late+' | Avanço físico: '+(m.advance===null?'não definido':m.advance.toFixed(1)+'%')+
    ' | Horas: '+m.realHours+' / '+m.hours+' | Custo final estimado: '+fmtP(m.final);
  pcpElement('p','Avanço ponderado pelas horas previstas. Preencha horas e quantidades de todas as atividades. Horas realizadas são informativas; os custos continuam no financeiro.',panel);
  const grid=pcpElement('div',undefined,panel);grid.className='fin-grid';
  pcpInput(grid,'Comprometido ainda não realizado (R$)',p.comprometido,'number',v=>p.comprometido=v);
  pcpInput(grid,'Restante ainda não contratado (R$)',p.restante,'number',v=>p.restante=v);
  pcpElement('h3','Passagem da proposta',panel);
  const handoff=pcpElement('div',undefined,panel);handoff.className='fin-grid';
  [['proposta','Proposta e revisão'],['gestor','Gestor da implantação'],['escopo','Escopo contratado'],
   ['premissas','Premissas e exclusões'],['pendencias','Pendências / responsável / prazo']].forEach(([key,label])=>{
    pcpInput(handoff,label,p.passagem[key],'textarea',v=>p.passagem[key]=v);
  });
  pcpElement('h3','Responsáveis e destinatários dos alertas',panel);
  const contacts=pcpElement('div',undefined,panel);contacts.className='fin-grid';
  pcpInput(contacts,'E-mail do gestor',p.passagem.emailGestor,'email',v=>p.passagem.emailGestor=v);
  pcpInput(contacts,'E-mails para resumo do PCP (separados por vírgula)',p.passagem.emailsPCP,'emails',v=>p.passagem.emailsPCP=v);
  pcpElement('p','Cadastre o responsável e o e-mail em cada atividade. Os contatos são salvos com a obra; o envio automático ainda não está ativado.',panel);
  pcpImportUI(panel,o);
  pcpElement('h3','Cronograma — dias corridos',panel);
  scheduleImportUI(panel,o);
  pcpElement('p','Dependências geram alertas; as datas não são deslocadas automaticamente. A linha de base preserva o primeiro planejamento; o cronograma atual continua editável.',panel);
  const actions=pcpElement('div',undefined,panel);actions.className='actions-row';
  const print=pcpElement('button','Imprimir cronograma para cliente',actions);print.className='btn';
  print.onclick=printClientSchedule;
  const add=pcpElement('button','Adicionar atividade',actions);add.className='btn';add.disabled=false;
  add.onclick=()=>{p.tarefas.push({id:crypto.randomUUID(),nome:'Nova atividade',responsavel:'',qtd:1,qtdReal:0,horas:0,horasReal:0});saveAll();renderPCP();};
  const base=pcpElement('button',p.baseline?'Linha de base registrada':'Registrar linha de base',actions);base.className='btn';base.disabled=!!p.baseline;
  base.onclick=()=>{
    if(!p.tarefas.length||p.tarefas.some(t=>!t.inicio||!t.fim)||pcpErrors(p).length){alert('Preencha datas válidas e resolva os alertas antes de registrar.');return;}
    p.baseline={data:new Date().toISOString(),tarefas:JSON.parse(JSON.stringify(p.tarefas)),
      orcamento:CATS.reduce((s,c)=>s+(o.cats[c]||[]).reduce((n,r)=>n+(Number(r.bud)||0),0),0)};
    saveAll();renderPCP();
  };
  const errors=pcpErrors(p);
  if(errors.length)pcpElement('p',errors.join(' '),panel).style.color='var(--red)';
  p.tarefas.forEach(t=>{
    const card=pcpElement('details',undefined,panel);card.className='card';card.style.marginBottom='10px';
    card.dataset.taskId=t.id;
    card.open=openTasks.has(t.id);
    pcpElement('summary',t.nome+' — '+(t.responsavel||'Sem responsável'),card);
    const fields=pcpElement('div',undefined,card);fields.className='fin-grid';
    [['nome','Atividade','text'],['responsavel','Responsável','text'],['emailResponsavel','E-mail do responsável','email'],
      ['inicio','Início planejado','date'],['fim','Fim planejado','date'],['previsao','Previsão atual de término','date'],
      ['inicioReal','Início real','date'],['fimReal','Fim real','date'],
      ['qtd','Quantidade prevista','number'],['qtdReal','Quantidade concluída','number'],
      ['horas','Horas previstas','number'],['horasReal','Horas realizadas','number'],
      ['impedimento','Impedimento / ação / responsável','textarea']].forEach(([key,label,type])=>{
      pcpInput(fields,label,t[key],type,v=>{
        t[key]=v;
      },false);
    });
    const label=pcpElement('label','Predecessora (término → início)',fields);
    const select=pcpElement('select',undefined,label);select.className='form-input';
    [{id:'',nome:'Sem predecessora'},...p.tarefas.filter(x=>x.id!==t.id)].forEach(x=>{
      const opt=pcpElement('option',x.nome,select);opt.value=x.id;opt.selected=t.predecessora===x.id;
    });
    select.onchange=()=>{t.predecessora=select.value;saveAll();renderPCP();};
    const copy=pcpElement('button','Duplicar atividade',card);copy.className='btn';
    copy.onclick=()=>{const next=scheduleCopy(t);p.tarefas.splice(p.tarefas.indexOf(t)+1,0,next);saveAll();renderPCP();const el=Array.from(panel.querySelectorAll('details')).find(el=>el.dataset.taskId===next.id);if(el)el.open=true;};
    const del=pcpElement('button','Remover atividade',card);del.className='btn btn-danger';
    del.disabled=false;
    del.onclick=()=>{
      if(p.tarefas.some(x=>x.predecessora===t.id)){alert('Remova primeiro as dependências desta atividade.');return;}
      p.tarefas=p.tarefas.filter(x=>x.id!==t.id);saveAll();renderPCP();
    };
  });
  renderGantt(panel,p);
}
function renderGantt(panel,p){
  const tasks=p.tarefas.filter(t=>Number.isFinite(pcpDate(t.inicio))&&Number.isFinite(pcpDate(t.previsao||t.fim)));
  if(!tasks.length)return;
  const min=Math.min(...tasks.map(t=>pcpDate(t.inicio)));
  const max=Math.max(...tasks.map(t=>pcpDate(t.previsao||t.fim))),span=Math.max(86400000,max-min+86400000);
  pcpElement('h3','Visão do cronograma',panel);
  pcpElement('p',new Date(min).toLocaleDateString('pt-BR',{timeZone:'UTC'})+' a '+new Date(max).toLocaleDateString('pt-BR',{timeZone:'UTC'}),panel);
  tasks.forEach(t=>{
    pcpElement('p',t.nome+' | '+t.inicio+' → '+(t.previsao||t.fim),panel);
    const track=pcpElement('div',undefined,panel);track.style.cssText='height:12px;background:var(--bg);margin-bottom:12px';
    const bar=pcpElement('div',undefined,track);
    bar.style.cssText='height:12px;background:var(--text-accent);margin-left:'+((pcpDate(t.inicio)-min)/span*100)+'%;width:'+Math.max(0,(pcpDate(t.previsao||t.fim)-pcpDate(t.inicio)+86400000)/span*100)+'%';
  });
}
function pcpBackup(){
  saveCurrent(); const a=document.createElement('a');
  const url=URL.createObjectURL(new Blob([JSON.stringify(obras,null,2)],{type:'application/json'}));
  a.href=url;a.download='obras-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function pcpLoad(){
  if(!scriptUrl){alert('Configure a URL do Apps Script.');return;}
  try {
    const d=window.pcpRpc?await window.pcpRpc('obras') : await (await fetch(scriptUrl+'?action=obras')).json();
    if(!d.ok||!Array.isArray(d.obras))throw new Error(d.erro||'Atualize o Apps Script para a versão PCP.');
    if(!confirm('Carregar a versão compartilhada substituirá as obras locais com o mesmo ID. Faça backup antes. Continuar?'))return;
    saveCurrent();d.obras.forEach(o=>obras[o.id]=o);saveAll();goHome();
    if(d.sheetUrl)localStorage.setItem('obra_sheet_url',d.sheetUrl);
    setSyncStatus('ok','obras carregadas');
  }catch(e){setSyncStatus('err',e.message);}
}
async function pcpSave(){
  if(!scriptUrl){alert('Configure a URL do Apps Script.');return;}
  saveCurrent();const o=obras[currentObraId];if(!o)return;
  const errors=pcpErrors(pcpState(o));if(errors.length){alert(errors.join('\n'));return;}
  if(window.pcpSaving)return;
  window.pcpSaving=true;setSyncStatus('load','salvando obra...');
  const sent=JSON.parse(JSON.stringify(o));
  const fd=new FormData();fd.append('payload',JSON.stringify({action:'salvarObra',obra:sent,requestId:crypto.randomUUID()}));
  try{
    const payload=JSON.parse(fd.get('payload'));
    const d=window.pcpRpc?await window.pcpRpc('salvarObra',payload) : await (await fetch(scriptUrl,{method:'POST',body:fd})).json();
    if(!d.ok)throw new Error(d.erro||'Falha no salvamento.');
    o._revision=d.revision;saveAll();
    if(d.sheetUrl){localStorage.setItem('obra_sheet_url',d.sheetUrl);document.getElementById('sheetsLink').href=d.sheetUrl;}
    setSyncStatus('ok','obra salva no Sheets');
  }catch(e){setSyncStatus('err',e.message);}finally{window.pcpSaving=false;}
}
const originalOpenDash=openDash;
openDash=function(id){originalOpenDash(id);renderPCP();};
saveToSheets=pcpSave;
const panel=document.createElement('section');panel.id='pcpPanel';panel.className='fin-section';
document.getElementById('dashScreen').appendChild(panel);
const shared=document.createElement('div');shared.className='actions-row';
[['Backup das obras',pcpBackup],['Carregar obras do Sheets',pcpLoad]].forEach(([text,fn])=>{
  const b=pcpElement('button',text,shared);b.className='btn';b.onclick=fn;
});
document.getElementById('homeScreen').prepend(shared);


function printClientSchedule(){
  saveCurrent();
  const o=obras[currentObraId]; if(!o)return;
  const p=pcpState(o);
  if(!p.tarefas.length){alert('Cadastre atividades antes de imprimir o cronograma.');return;}
  const errors=pcpErrors(p);
  if(errors.length){alert('Resolva os alertas antes de emitir o cronograma:\n'+errors.join('\n'));return;}
  const win=window.open('','_blank');
  if(!win){alert('Permita pop-ups para visualizar o cronograma.');return;}
  const doc=win.document;
  doc.title='Cronograma — '+o.nome;
  const style=doc.createElement('style');
  style.textContent='@page{size:A4 landscape;margin:12mm}body{font:12px Open Sans,Arial,sans-serif;color:#202020;--bg:#eee;--text-accent:#406E2A;margin:24px}h1{font-size:22px;color:#406E2A}h2,h3{font-size:15px;margin-top:24px}header{border-bottom:2px solid #406E2A;padding-bottom:12px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;overflow-wrap:anywhere}th{background:#E9F4E6}thead{display:table-header-group}tr{break-inside:avoid}button{padding:10px 18px;background:#406E2A;color:white;border:0;margin-bottom:18px;cursor:pointer}.meta{line-height:1.7}.gantt{break-before:page}.gantt p{margin:8px 0 4px}footer{margin-top:24px;color:#666;font-size:11px}@media print{body{margin:0}button{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
  doc.head.appendChild(style);
  const fonts=doc.createElement('link');fonts.rel='stylesheet';fonts.href='https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Open+Sans:wght@400;600&display=swap';doc.head.appendChild(fonts);
  const titles=doc.createElement('style');titles.textContent='h1,h2,h3,th{font-family:Montserrat,Arial,sans-serif}th{background:#406E2A;color:#FFFFFF}tbody tr:nth-child(even){background:#F8FAFC}';doc.head.appendChild(titles);
  const root=doc.body;
  const button=pcpElement('button','Imprimir / Salvar PDF',root);button.onclick=()=>win.print();
  const head=pcpElement('header',undefined,root);
  const logo=doc.createElement('img');logo.src=document.getElementById('companyLogo').src;logo.alt='CompaSSS Tecnologia';logo.style.cssText='width:210px;height:auto;margin-bottom:12px';head.appendChild(logo);
  pcpElement('h1','CompaSSS | Cronograma de implantação',head);
  pcpElement('h2',o.nome,head);
  const date=new Date().toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
  pcpElement('p','Proposta: '+(p.passagem.proposta||'Não informada')+' | Emitido em: '+date,head).className='meta';
  pcpElement('p','Datas em dias corridos. Previsão atual de término apresentada quando cadastrada.',root);
  const table=pcpElement('table',undefined,root),thead=pcpElement('thead',undefined,table),tr=pcpElement('tr',undefined,thead);
  ['Atividade','Responsável','Início planejado','Fim planejado','Previsão atual','Início real','Fim real'].forEach(label=>pcpElement('th',label,tr));
  const tbody=pcpElement('tbody',undefined,table);
  function dateBR(v){return Number.isFinite(pcpDate(v))?v.split('-').reverse().join('/'):'—';}
  p.tarefas.forEach(t=>{
    const row=pcpElement('tr',undefined,tbody);
    [t.nome,t.responsavel||'—',dateBR(t.inicio),dateBR(t.fim),dateBR(t.previsao),dateBR(t.inicioReal),dateBR(t.fimReal)].forEach(v=>pcpElement('td',v,row));
  });
  const gantt=pcpElement('section',undefined,root);gantt.className='gantt';
  renderGantt(gantt,p);
  pcpElement('footer','CompaSSS Tecnologia · '+o.nome+' · '+date,root);
  win.focus();
}

/* Importação local: custos orçados; nunca altera valores realizados. */
function budgetNorm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function budgetNumber(v){
  if(typeof v==='number')return Number.isFinite(v)&&v>=0?v:NaN;
  let s=String(v??'').trim().replace(/^R\$\s*/,'').replace(/\s/g,'');
  if(!s)return NaN;
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  if(!/^\d+(\.\d+)?$/.test(s))return NaN;
  return Number(s);
}
function budgetRows(rows){
  const aliases={name:['descricao','item','material servico'],total:['custo r compra total','custo total','orcado r','orcado','valor total'],qty:['qtd','quantidade'],unit:['custo r compra unitario','custo unitario','valor unitario'],cat:['categoria'],type:['tipo']};
  let header=-1,cols;
  for(let i=0;i<Math.min(rows.length,60);i++){
    const h=rows[i].map(budgetNorm),m={};
    Object.keys(aliases).forEach(k=>m[k]=h.findIndex(v=>aliases[k].includes(v)));
    if(m.name>=0&&(m.total>=0||(m.qty>=0&&m.unit>=0))){header=i;cols=m;break;}
  }
  if(header<0)throw new Error('Cabeçalhos não reconhecidos. Use Descrição e Custo total, ou Quantidade e Custo unitário.');
  const result=[];
  const categories={equipamentos:'eq',materiais:'eq',terceiros:'ter','servico terceiros':'ter','servicos terceiros':'ter','servico de terceiros':'ter','servicos de terceiros':'ter',infraestrutura:'inf',cabeamento:'cab','m o compass':'cmp','mao de obra compasss':'cmp',eq:'eq',ter:'ter',inf:'inf',cab:'cab',cmp:'cmp'};
  rows.slice(header+1).forEach((r,i)=>{
    const name=String(r[cols.name]??'').trim();if(!name)return;
    if(/^(sub ?total|total)(\s|$)/.test(budgetNorm(name)))return;
    let cost=budgetNumber(r[cols.total]);
    // Fórmulas sem resultado salvo exigem revisão: não utilizar preço de venda.
    if(cols.total<0)cost=budgetNumber(r[cols.qty])*budgetNumber(r[cols.unit]);
    const desc=budgetNorm(name),type=budgetNorm(r[cols.type]);
    const thirdParty=/\b(terceiros?|terceirizadas?|terceirizados?)\b/.test(desc+' '+type);
    const infrastructure=/\b(eletroduto|eletrocalha|condulete|infraestrutura|canaleta|seal\s*tub(?:e|o)|sealtub(?:e|o)|ferro galvanizado)\b/.test(desc);
    const suggested=thirdParty?'ter':infrastructure?'inf':/\b(cabo|cabeamento|cordao optico|patch cord)\b/.test(desc)?'cab':type==='servico'?'cmp':type==='produto'?'eq':'';
    const category=categories[budgetNorm(r[cols.cat])]||suggested;
    result.push({name,cost,category,row:header+i+2});
  });
  if(!result.length)throw new Error('A aba não contém itens com descrição.');
  if(result.length>300)throw new Error('Importe no máximo 300 itens por vez.');
  return result;
}
function budgetApply(o,items,source){
  const next=JSON.parse(JSON.stringify(o));let added=0,skipped=0;
  const keys=new Set(CATS.flatMap(c=>(next.cats[c]||[]).map(r=>r.importKey).filter(Boolean)));
  items.forEach(item=>{
    if(!CATS.includes(item.category)||!Number.isFinite(item.cost)||item.cost<0||!item.name.trim())throw new Error('Confira a categoria e o custo de todos os itens.');
    const key=JSON.stringify([source,item.row,item.name]);
    if(keys.has(key)){skipped++;return;}
    next.idCt=(Number(next.idCt)||0)+1;
    next.cats[item.category].push({id:'e'+next.idCt,name:item.name,bud:item.cost,val:'',importKey:key});keys.add(key);added++;
  });
  if(JSON.stringify(next).length>45000)throw new Error('Os itens excedem o limite da obra (45.000 caracteres). Reduza a importação.');
  return {obra:next,added,skipped};
}
let budgetLoader;
function budgetLibrary(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  if(!budgetLoader)budgetLoader=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Leitor de planilha indisponível.'));
    script.onerror=()=>{budgetLoader=null;script.remove();reject(new Error('Não foi possível carregar o leitor de planilhas. Verifique a conexão e tente novamente.'));};
    document.head.appendChild(script);
  });
  return budgetLoader;
}
function budgetBatch(o,groups){
  if(!groups.length||groups.some(g=>g.error||!g.items))throw new Error('Confira as abas de todos os arquivos antes de importar.');
  if(groups.reduce((n,g)=>n+g.items.length,0)>300)throw new Error('Selecione no máximo 300 itens no conjunto de arquivos.');
  let result={obra:o,added:0,skipped:0};
  groups.forEach(g=>{const next=budgetApply(result.obra,g.items,g.source);result={obra:next.obra,added:result.added+next.added,skipped:result.skipped+next.skipped};});
  return result;
}
function pcpImportUI(panel,o){
  const box=pcpElement('details',undefined,panel);box.className='card';
  pcpElement('summary','Importar materiais e serviços orçados',box);
  pcpElement('p','Selecione um ou vários arquivos Excel (.xlsx/.xlsm) ou CSV. Escolha uma aba por arquivo e revise custos e categorias. Serviços sem identificação de terceiros são sugeridos como M.O. Compass. Os itens serão adicionados juntos; realizado e linha de base são preservados. Depois clique em Salvar no Sheets.',box);
  const file=pcpElement('input',undefined,box);file.type='file';file.accept='.xlsx,.xlsm,.csv';file.multiple=true;
  const preview=pcpElement('div',undefined,box);preview.style.overflowX='auto';
  let generation=0;
  file.onchange=async()=>{
    const token=++generation;preview.replaceChildren();const files=Array.from(file.files||[]);if(!files.length)return;
    const selected=o.id;
    const active=()=>token===generation&&currentObraId===selected&&box.isConnected;
    try{
      if(files.length>10)throw new Error('Selecione até 10 arquivos por vez.');
      if(files.some(f=>f.size>5*1024*1024))throw new Error('Cada arquivo deve ter até 5 MB.');
      if(files.reduce((n,f)=>n+f.size,0)>20*1024*1024)throw new Error('O conjunto deve ter até 20 MB.');
      const X=await budgetLibrary();if(!active())return;
      const groups=[];
      for(const f of files){
        const group={items:null,error:true,source:''};groups.push(group);
        const section=pcpElement('section',undefined,preview);pcpElement('h4',f.name,section);
        try{
          const bytes=await f.arrayBuffer();if(!active())return;
          const wb=X.read(bytes,{type:'array',cellFormula:false,bookVBA:false});
          const label=pcpElement('label','Aba da planilha: ',section),select=pcpElement('select',undefined,label);select.className='form-input';
          wb.SheetNames.forEach(name=>{const opt=pcpElement('option',name,select);opt.value=name;});
          select.value=wb.SheetNames[0]||'';
          const content=pcpElement('div',undefined,section);
          function show(){
            content.replaceChildren();group.items=null;group.error=true;group.source=f.name+' / '+select.value;
            try{
              const sheet=wb.Sheets[select.value];if(!sheet)throw new Error('Selecione uma aba válida.');
              const range=X.utils.decode_range(sheet['!ref']||'A1');
              if(range.e.r>10000||range.e.c>200)throw new Error('Aba muito extensa; exporte apenas a tabela de itens.');
              const items=budgetRows(X.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true}));
              group.items=items;group.error=false;
              pcpElement('p',items.length+' itens. Confira a categoria e o custo de compra antes de adicionar.',content);
          const table=pcpElement('table',undefined,content);table.style.width='100%';
          const tr=pcpElement('tr',undefined,pcpElement('thead',undefined,table));
          ['Linha','Descrição','Categoria','Custo orçado (R$)'].forEach(t=>pcpElement('th',t,tr));
          const body=pcpElement('tbody',undefined,table);
          items.forEach(item=>{
            const row=pcpElement('tr',undefined,body);pcpElement('td',String(item.row),row);pcpElement('td',item.name,row);
            const cat=pcpElement('select',undefined,pcpElement('td',undefined,row));cat.className='form-input';
            [{id:'',label:'Selecione…'},...CATS.map(id=>({id,label:LABELS[id]}))].forEach(c=>{const opt=pcpElement('option',c.label,cat);opt.value=c.id;opt.selected=c.id===item.category;});
            cat.onchange=()=>item.category=cat.value;
            const cost=pcpElement('input',undefined,pcpElement('td',undefined,row));cost.type='number';cost.min='0';cost.step='0.01';cost.className='form-input';cost.value=Number.isFinite(item.cost)?item.cost:'';
            cost.oninput=()=>item.cost=budgetNumber(cost.value);
          });

            }catch(e){pcpElement('p',e.message,content);}
          }
          select.onchange=show;show();
        }catch(e){pcpElement('p',f.name+': '+e.message,section);}
      }
      if(!active())return;
      const status=pcpElement('p',files.length+' arquivos selecionados. Nenhum item foi adicionado ainda.',preview);
      const apply=pcpElement('button','Adicionar itens de todos os arquivos',preview);apply.type='button';apply.className='btn';
      apply.onclick=()=>{
        try{
          if(!active())throw new Error('Reabra a importação na obra desejada.');
          saveCurrent();const result=budgetBatch(obras[selected],groups);
          obras[selected]=result.obra;saveAll();renderAllLists();recalc();
          apply.disabled=true;alert(result.added+' itens adicionados; '+result.skipped+' já importados. Clique em Salvar no Sheets para compartilhar.');renderPCP();
          setSyncStatus('load','Orçamentos importados localmente; salve no Sheets.');
        }catch(e){status.textContent=e.message;}
      };
    }catch(e){if(active())pcpElement('p',e.message,preview);}
  };
}
function scheduleCopy(t){
  const copy={id:crypto.randomUUID(),nome:t.nome+' (cópia)',qtdReal:0,horasReal:0};
  ['responsavel','emailResponsavel','inicio','fim','qtd','horas','predecessora'].forEach(k=>{if(t[k]!==undefined)copy[k]=t[k];});
  return copy;
}
function scheduleDate(v,date1904=false){
  if(v===''||v==null)return '';
  let iso;
  if(typeof v==='number'){
    if(!Number.isFinite(v)||(date1904?v<0:v<1)||(!date1904&&Math.floor(v)===60))throw new Error('Data Excel inválida.');
    const base=date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,31);
    const days=Math.floor(v)-(date1904||v<60?0:1);
    iso=new Date(base+days*86400000).toISOString().slice(0,10);
  }else{
    const s=String(v).trim(),br=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    iso=br?br[3]+'-'+br[2].padStart(2,'0')+'-'+br[1].padStart(2,'0'):s;
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!Number.isFinite(Date.parse(iso+'T12:00:00Z'))||new Date(iso+'T12:00:00Z').toISOString().slice(0,10)!==iso)throw new Error('Use uma data válida: dd/mm/aaaa ou aaaa-mm-dd.');
  return iso;
}
function scheduleRows(rows,date1904=false){
  const aliases={nome:['atividade','descricao','tarefa','nome da atividade'],inicio:['inicio','inicio planejado','data inicio','data de inicio'],fim:['fim','termino','fim planejado','data fim','data de termino','termino planejado'],responsavel:['responsavel'],emailResponsavel:['email','e mail','email do responsavel','e mail do responsavel'],qtd:['quantidade','quantidade prevista','qtd'],horas:['horas','horas previstas'],key:['id','codigo','ordem'],pred:['predecessora','id predecessora']};
  let header=-1,cols;
  for(let i=0;i<Math.min(60,rows.length);i++){
    const normalized=rows[i].map(budgetNorm),m={};
    Object.keys(aliases).forEach(k=>m[k]=normalized.findIndex(v=>aliases[k].includes(v)));
    if(m.nome>=0&&m.inicio>=0&&m.fim>=0){header=i;cols=m;break;}
  }
  if(header<0)throw new Error('Cabeçalhos necessários: Atividade, Início planejado e Fim planejado. Datas não são calculadas a partir de duração.');
  const tasks=[];
  rows.slice(header+1).forEach((r,index)=>{
    const nome=String(r[cols.nome]??'').trim();if(!nome)return;
    if(/^(sub ?total|total)(\s|$)/.test(budgetNorm(nome)))return;
    const line=header+index+2;
    try{
      const inicio=scheduleDate(r[cols.inicio],date1904),fim=scheduleDate(r[cols.fim],date1904);
      if(!inicio||!fim)throw new Error('Preencha início e fim.');
      if(fim<inicio)throw new Error('Fim anterior ao início.');
      const number=(k,fallback)=>cols[k]<0||r[cols[k]]===''||r[cols[k]]==null?fallback:budgetNumber(r[cols[k]]);
      const qtd=number('qtd',1),horas=number('horas',0);
      if(!Number.isFinite(qtd)||!Number.isFinite(horas))throw new Error('Quantidade ou horas inválidas.');
      tasks.push({nome,inicio,fim,responsavel:String(r[cols.responsavel]??'').trim(),emailResponsavel:String(r[cols.emailResponsavel]??'').trim(),qtd,horas,row:line,key:String(cols.key<0?tasks.length+1:r[cols.key]??'').trim(),pred:String(r[cols.pred]??'').trim()});
    }catch(e){throw new Error('Linha '+line+': '+e.message);}
  });
  if(!tasks.length)throw new Error('Nenhuma atividade encontrada.');
  if(tasks.length>200)throw new Error('Importe até 200 atividades por vez.');
  const map=new Map();
  tasks.forEach(t=>{if(!t.key||map.has(t.key))throw new Error('IDs/ordens vazios ou repetidos.');map.set(t.key,t);});
  tasks.forEach(t=>{
    const seen=new Set([t.key]);let p=t.pred;
    while(p){if(!map.has(p))throw new Error('Linha '+t.row+': predecessora inexistente no arquivo ('+p+'). Use apenas um ID por atividade.');if(seen.has(p))throw new Error('Dependências em ciclo no arquivo.');seen.add(p);p=map.get(p).pred;}
    const pred=map.get(t.pred);if(pred&&t.inicio<=pred.fim)throw new Error('Linha '+t.row+': início deve ser posterior ao fim da predecessora.');
  });
  return tasks;
}
function scheduleApply(o,items,source){
  const next=JSON.parse(JSON.stringify(o)),p=pcpState(next),ids=new Map();let added=0,skipped=0;
  items.forEach(t=>{
    const key=JSON.stringify([source,t.key,t.nome]);
    const existing=p.tarefas.find(x=>x.scheduleImportKey===key);
    ids.set(t.key,existing?existing.id:crypto.randomUUID());
  });
  items.forEach(t=>{
    const key=JSON.stringify([source,t.key,t.nome]);
    if(p.tarefas.some(x=>x.scheduleImportKey===key)){skipped++;return;}
    p.tarefas.push({id:ids.get(t.key),nome:t.nome,responsavel:t.responsavel,emailResponsavel:t.emailResponsavel,inicio:t.inicio,fim:t.fim,qtd:t.qtd,horas:t.horas,qtdReal:0,horasReal:0,predecessora:t.pred?ids.get(t.pred):'',scheduleImportKey:key});added++;
  });
  const errors=pcpErrors(p);if(errors.length)throw new Error(errors.join(' '));
  if(JSON.stringify(next).length>45000)throw new Error('O cronograma excede o limite de 45.000 caracteres da obra.');
  return {obra:next,added,skipped};
}
function scheduleImportUI(panel,o){
  const box=pcpElement('details',undefined,panel);box.className='card';
  pcpElement('summary','Importar cronograma do Excel',box);
  pcpElement('p','Colunas obrigatórias: Atividade, Início planejado, Fim planejado. Opcionais: Responsável, E-mail, Quantidade prevista, Horas previstas, ID e Predecessora. Sem ID, a ordem das atividades é 1, 2, 3… A importação acrescenta atividades; preserva as existentes e a linha de base.',box);
  const file=pcpElement('input',undefined,box);file.type='file';file.accept='.xlsx,.xlsm,.csv';
  const preview=pcpElement('div',undefined,box);preview.style.overflowX='auto';let generation=0;
  file.onchange=async()=>{
    const token=++generation;preview.replaceChildren();const f=file.files[0];if(!f)return;
    const active=()=>token===generation&&currentObraId===o.id&&box.isConnected;
    try{
      if(f.size>5*1024*1024)throw new Error('Selecione arquivo de até 5 MB.');
      const X=await budgetLibrary(),bytes=await f.arrayBuffer();if(!active())return;
      const wb=X.read(bytes,{type:'array',cellFormula:false,bookVBA:false});
      const label=pcpElement('label','Aba: ',preview),select=pcpElement('select',undefined,label);select.className='form-input';
      wb.SheetNames.forEach(name=>{const opt=pcpElement('option',name,select);opt.value=name;});select.value=wb.SheetNames[0]||'';
      const content=pcpElement('div',undefined,preview);
      function show(){
        content.replaceChildren();
        try{
          const sheet=wb.Sheets[select.value];if(!sheet)throw new Error('Selecione uma aba.');
          const range=X.utils.decode_range(sheet['!ref']||'A1');if(range.e.r>10000||range.e.c>200)throw new Error('Aba muito extensa.');
          const items=scheduleRows(X.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true}),!!(wb.Workbook&&wb.Workbook.WBProps&&wb.Workbook.WBProps.date1904));
          pcpElement('p',items.length+' atividades encontradas. Revise antes de adicionar. Avanço, horas realizadas e datas reais começam em branco/zero.',content);
          const table=pcpElement('table',undefined,content);table.style.width='100%';const head=pcpElement('tr',undefined,pcpElement('thead',undefined,table));
          ['ID','Atividade','Responsável','Início','Fim','Quantidade','Horas','Predecessora'].forEach(t=>pcpElement('th',t,head));const body=pcpElement('tbody',undefined,table);
          items.forEach(t=>{const tr=pcpElement('tr',undefined,body);[t.key,t.nome,t.responsavel,t.inicio,t.fim,t.qtd,t.horas,t.pred||'—'].forEach(v=>pcpElement('td',String(v),tr));});
          const status=pcpElement('p','',content),apply=pcpElement('button','Adicionar atividades à obra',content);apply.type='button';apply.className='btn';
          apply.onclick=()=>{
            try{
              if(!active())throw new Error('Reabra a importação na obra desejada.');saveCurrent();
              const result=scheduleApply(obras[o.id],items,f.name+' / '+select.value);obras[o.id]=result.obra;saveAll();renderPCP();
              alert(result.added+' atividades adicionadas; '+result.skipped+' já importadas. Clique em Salvar no Sheets.');setSyncStatus('load','Cronograma importado localmente; salve no Sheets.');
            }catch(e){status.textContent=e.message;}
          };
        }catch(e){pcpElement('p',e.message,content);}
      }
      select.onchange=show;show();
    }catch(e){if(active())pcpElement('p',e.message,preview);}
  };
}
