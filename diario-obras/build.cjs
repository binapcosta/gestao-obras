const fs=require('fs'),path=require('path');
const root=__dirname;
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
// Preserva templates de impressão no HtmlService, que pode reinterpretar strings com HTML.
html=html.replace(/<script>([\s\S]*?)<\/script>/g,(_,source)=>{
  const encoded=Buffer.from(source,'utf8').toString('base64');
  return '<script>(function(){var source=new TextDecoder().decode(Uint8Array.from(atob("'+encoded+'"),function(c){return c.charCodeAt(0);}));var script=document.createElement("script");script.textContent=source;document.head.appendChild(script);})();</script>';
});
fs.writeFileSync(path.join(root,'apps-script','Index.html'),html);
console.log('apps-script/Index.html gerado.');
