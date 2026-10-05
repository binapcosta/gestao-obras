const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('compasss.css', 'utf8');
const pcp = fs.readFileSync('pcp.js', 'utf8');
const bridge = `<script>
window.pcpRpc=function(action,payload){return new Promise(function(resolve,reject){
 google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).pcpApi(action,payload);
});};
// Compatibilidade das leituras legadas, limitada à URL configurada.
const originalFetch=window.fetch.bind(window);
window.fetch=function(url,options){
 if(typeof url==='string'&&url.startsWith('apps-script-rpc:')){
  const action=url.includes('action=obras')?'obras':'historico';
  if(options&&options.method==='POST')return Promise.reject(new Error('Use Salvar no Sheets no painel PCP.'));
  return window.pcpRpc(action).then(function(data){return {json:async function(){return data;}};});
 }
 return originalFetch(url,options);
};
</script>`;
html=html.replace('<head>','<head><base target="_blank">'+bridge);
html=html.replace('<link rel="stylesheet" href="compasss.css">','<style>'+css+'</style>');
html=html.replace('<script src="pcp.js"></script>','<script>'+pcp.replace(/<\/script/gi,'<\\/script')+'</script>');
html=html.replace('loadAll();\nmigrateOldData();','scriptUrl="apps-script-rpc:";\nloadAll();\nmigrateOldData();');
html=html.replace('if(scriptUrl) activateSheets();','if(scriptUrl) activateSheets();');
const endBody=html.lastIndexOf('</body>');
html=html.slice(0,endBody)+`<script>
document.getElementById('setupCard').textContent='Conexão pelo login Google. Use Carregar obras do Sheets para obter a versão compartilhada.';
</script>`+html.slice(endBody);
fs.writeFileSync('apps-script/Painel.html',html);
console.log('Painel.html gerado.');
