# Projetos CompaSSS

## Gestão de Obras e PCP

Código da gestão financeira, passagem da proposta e cronograma: [alterações do PCP](https://github.com/binapcosta/gestao-obras/pull/1), na branch `codex/pcp-cronograma-custos`. A versão autenticada usa `apps-script/Code.gs` e `apps-script/Painel.html` dessa branch. A implantação no Google precisa ser atualizada manualmente, conforme `PCP-INSTALACAO.md`.

## Diário de Obras

Projeto independente na pasta [`diario-obras`](diario-obras/README.md), com cadastro de múltiplas obras, atividades, fotos e impressão. Usa outro projeto Apps Script, com seus próprios `Code.gs`, `Index.html`, `SHEET_ID` e `FOLDER_ID`. Todas as obras do diário usam a mesma planilha do diário.

O diário não envia automaticamente os apontamentos ao PCP nesta versão. O técnico registra a execução, a supervisão revisa as informações e o PCP utiliza o histórico para atualizar o planejamento.

## Publicação

O GitHub guarda e versiona o código. Subir arquivos ao repositório não substitui a implantação dos aplicativos no Google. Os dados e as fotos das obras ficam no Sheets/Drive e não devem ser adicionados ao repositório.
