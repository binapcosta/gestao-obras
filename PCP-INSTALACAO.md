# Gestão de Obras — PCP

Esta versão mantém a interface financeira e acrescenta passagem da proposta, atividades, dependências, datas reais, horas, quantidades e previsão do custo final. O cronograma considera dias corridos, uma predecessora por atividade e alertas; não faz reprogramação automática nem cálculo de caminho crítico.

## Atualização

1. Faça backup dos dados antes de atualizar. A nova interface oferece Backup das obras.
2. No Apps Script existente, substitua o código por apps-script/Code.gs. Em Configurações do projeto → Propriedades do script, configure SHEET_ID com o ID da planilha existente. Não execute o antigo resetPlanilha.
3. Atualize a implantação do aplicativo da Web. Esta versão usa as permissões da implantação; não inclui autenticação própria na página GitHub Pages. Não publique a API de custos para acesso anônimo.
4. Publique index.html e pcp.js juntos, na mesma pasta. Utilize a URL /exec na configuração existente.
5. Abra no mesmo navegador e endereço em que as obras estavam cadastradas. Abra cada obra e clique em Salvar no Sheets para transferir o cadastro completo.
6. Em outro dispositivo, configure a URL e use Carregar obras do Sheets.

## Operação e limites

- O salvamento completo usa a aba Obras_PCP. O carregamento é manual e substitui registros locais com o mesmo ID após confirmação.
- Edições simultâneas são detectadas por revisão. Em conflito, faça backup, carregue a versão compartilhada e reaplique a alteração.
- A exclusão de obra permanece apenas local; não exclui o registro compartilhado.
- O histórico financeiro antigo é preservado; novos salvamentos não acrescentam fotografias à aba Historico. Obras_PCP mantém a versão atual.
- A linha de base preserva o planejamento inicial. A previsão de término e os apontamentos reais continuam editáveis.
- Custo final = realizado + comprometido ainda não realizado + restante ainda não contratado. Não repita despesas entre parcelas.
- Horas apontadas não geram custo automaticamente. Informe o custo na área financeira.
- O avanço físico depende de horas e quantidades positivas em todas as atividades.
- Limite de armazenamento: 45.000 caracteres por obra.

## Validação em produção

Teste com uma obra de exemplo: salvar, carregar em outro navegador, registrar linha de base, informar atraso e editar simultaneamente. Autenticação, permissões, CORS e gravação real dependem da implantação do Apps Script e precisam ser verificados no ambiente da equipe.
