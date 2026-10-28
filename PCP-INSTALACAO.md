# Instalação do PCP com acesso Google
Esta versão usa o painel hospedado no Apps Script. O GitHub mantém o código; o GitHub Pages não conecta à nova API autenticada. O envio de e-mails ainda não foi ativado.

1. Faça backup das obras no site atual e da planilha. Os dados locais não aparecem automaticamente no novo endereço. Salve as obras na base compartilhada antes da troca; se a nova API já estiver ativada, mantenha o backup e importe os dados somente após preparar uma rotina de importação.
2. No projeto Apps Script, substitua Code.gs e crie um arquivo HTML chamado Painel, com o conteúdo de apps-script/Painel.html.
3. Configure nas Propriedades do script:
   - SHEET_ID: ID da planilha existente, sem URL.
   - ADMIN_EMAIL: binapcosta@gmail.com
   - ALLOWED_EMAILS: binapcosta@gmail.com,aleksanderlotto@gmail.com,instalacaocpsrj@gmail.com,manutencaocpsrj@gmail.com,projetocps15@gmail.com
   A lista pode ser alterada aqui, sem editar o código. Não use e-mail recebido do navegador para autorizar.
4. Compartilhe a planilha como editor com as quatro contas da equipe. Como a implantação executa pelo usuário, ele precisa de acesso à base. Esses usuários também poderão editar diretamente a planilha, fora do controle de revisão do painel. Quem precisa apenas de consulta não deve receber esse acesso nesta versão.
5. Crie uma nova implantação Web: Executar como **Usuário que acessa o aplicativo**; acesso para usuários com conta Google (conforme opções da interface). Não use Executar como eu. Cada usuário deverá autorizar os serviços solicitados. Pode haver aviso de aplicativo não verificado, conforme configuração do projeto.
6. Abra a URL /exec com uma conta da lista e teste salvar e carregar. Depois teste uma conta fora da lista: não deve acessar o painel nem os dados.
7. Após confirmar a nova implantação, arquive as implantações antigas em Gerenciar implantações. Publicar uma versão nova não desativa URLs antigas que ainda usam código sem proteção.
8. Na conta administradora, execute instalarBackupDiario no editor e confira a cópia no Drive. Apenas a administradora pode instalar/executar o backup; o gatilho continua nessa conta até a futura migração.

## Atualização do painel
Altere index.html, pcp.js e compasss.css; execute `node build-apps-script.cjs` na raiz para gerar Painel.html. Copie o painel gerado ao Apps Script e atualize a implantação.

## Operação
Salvamento por obra e carregamento manual. Faça backup antes de carregar: registros locais com mesmo ID serão substituídos. Em conflito de revisão, carregue a versão compartilhada e reaplique a mudança. Exclusão de obra permanece local. Histórico antigo fica em Historico; estados novos ficam em Obras_PCP e Versoes_PCP. Dados locais continuam no navegador; use perfis separados em computadores compartilhados. A mudança para a conta corporativa exigirá conferir base, propriedades, permissões, gatilhos e implantação.

O cronograma usa dias corridos e uma predecessora por atividade, sem caminho crítico ou reprogramação automática. Custo final = realizado + comprometido ainda não realizado + restante ainda não contratado. Horas não geram custo automaticamente. Limite de 45.000 caracteres por obra.

## Verificação
`node check.cjs` e `node auth-check.cjs` verificam lógica e bloqueios com serviços simulados. Login OAuth, permissão real, armazenamento no navegador, impressão e gatilhos precisam de teste na implantação Google. Não há validação de produção concluída.
