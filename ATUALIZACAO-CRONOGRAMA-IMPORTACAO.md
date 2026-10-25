# Cronograma editável e importação do orçamento

## Ativar
No mesmo projeto Apps Script da Gestão de Obras, substitua o conteúdo de `Painel.html` pelo arquivo `apps-script/Painel.html` desta branch. Mantenha Code.gs e as propriedades atuais. Atualize a implantação existente com uma nova versão; o endereço /exec pode ser mantido. Nenhuma alteração é aplicada ao aplicativo publicado apenas por atualizar o GitHub.

## Cronograma
Datas, horas e quantidades planejadas continuam editáveis após registrar a linha de base. É possível adicionar e remover atividades, respeitando dependências. A primeira linha de base permanece guardada em `pcp.baseline`; a tela e a impressão usam o cronograma atual. Abra a atividade para editar e clique em Salvar no Sheets para compartilhar.

## Importar custos
Dentro da obra, abra “Importar materiais e serviços orçados”. Escolha `.xlsx`, `.xlsm` ou `.csv` (até 5 MB), selecione a aba correta e confira a prévia. A aba DETALHES não é somada automaticamente. São aceitos até 300 itens por importação, respeitando o limite de 45.000 caracteres da obra no servidor.

O modelo CompaSSS é reconhecido por DESCRIÇÃO e CUSTO (R$) COMPRA TOTAL. Também são aceitas as colunas Descrição e Custo total, ou Descrição, Quantidade e Custo unitário. Preços de venda não são utilizados. Quando existe coluna de custo total, resultado vazio ou inválido exige correção na prévia, sem substituição automática por outro preço. Fórmulas não são recalculadas pelo importador: abra, recalcule e salve no Excel antes de enviar se necessário.

Revise as categorias de cada linha. Categorias explícitas na coluna Categoria têm prioridade. Descrição e Tipo sugerem equipamentos, cabeamento, infraestrutura, terceiros ou M.O. Compass; serviço sem outra identificação é sugerido como M.O. Compass. Essas sugestões precisam de conferência, especialmente mão de obra terceirizada e faturamento direto.

Clique em Adicionar itens à obra. A operação acrescenta descrição e custo ORÇADO, mantendo realizado, itens existentes, venda, impostos e linha de base. Linhas reconhecidas como totais não entram. Reimportar o mesmo nome de arquivo, aba, linha e descrição ignora os itens já importados; não atualiza automaticamente valores existentes. Arquivo renomeado ou linhas reordenadas podem ser novos itens: confira antes de importar.

Depois clique em Salvar no Sheets. Os demais usuários devem usar Carregar obras do Sheets. Não foi incluída sincronização automática nesta alteração.

## Verificação
`node check-import-cronograma.cjs` verifica edição após linha de base, preservação do original, custos de compra, valores zero, categorias obrigatórias, duplicidade, valores inválidos, limite da obra e sintaxe dos scripts codificados no Painel. A implantação e a leitura de arquivo no navegador ainda devem ser conferidas no ambiente Google. A leitura de Excel usa SheetJS 0.20.3 carregado por HTTPS; o conteúdo da planilha é processado no navegador e só os itens confirmados são enviados ao Sheets ao salvar.
