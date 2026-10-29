# Cronograma a partir da proposta aprovada

## Ativar
Substitua somente o conteúdo de Painel.html no projeto existente pelo arquivo apps-script/Painel.html desta branch. O Code.gs atual pode ser mantido. Salve e atualize a implantação existente para uma nova versão. Preserve SHEET_ID, acessos e a planilha. Faça backup das obras e salve alterações pendentes antes de atualizar.

## Utilizar
Abra a obra e, na área Cronograma, abra “Gerar cronograma pela proposta aprovada”. Envie PDF com texto selecionável, DOCX ou TXT, até 5 MB. PDFs têm limite de 80 páginas. A extração preenche uma área de texto para conferência; se necessário, cole ou corrija o escopo. Arquivos Word antigos .doc precisam ser convertidos para DOCX. PDFs digitalizados precisam de OCR prévio ou texto colado.

Escolha detectar disciplinas pelo texto, ou selecione Controle de acesso, CFTV, SDAI ou Automação. Informe a data de início em dd/mm/aaaa e clique em “Analisar e sugerir etapas”. Revise etapas, trechos de referência e exclusões. Ajuste seleção, nome, duração em dias corridos, quantidade, horas e responsável. A primeira quantidade explícita junto ao equipamento em um trecho de instalação pode ser sugerida; ela não consolida quantitativos de tabelas ou de múltiplos sistemas. Nas demais etapas a quantidade começa em 1. Horas começam em 0 e precisam de preenchimento para cálculo de avanço ponderado.

Marque que revisou escopo e durações e clique em Adicionar etapas ao cronograma. As novas etapas são encadeadas em sequência na ordem da prévia. São acrescentadas ao cronograma existente, sem substituir tarefas, linha de base ou custos. Revise as datas e dependências e clique em Salvar no Sheets para compartilhar. Uma proposta idêntica (mesmo nome de origem e mesmo texto) não pode ser adicionada duas vezes na mesma obra.

## Como esta versão analisa a proposta
A análise usa regras de texto e modelos por disciplina, sem API de inteligência artificial ou chave adicional. Etapas com referência encontrada são sugeridas para seleção; etapas sem evidência ficam disponíveis para confirmação. O reconhecimento de exclusões é conservador e pode falhar em frases complexas, tabelas, imagens, colunas ou descrições contraditórias. Todo o texto e todas as seleções devem ser revisados antes da inclusão.

As durações são valores de referência do modelo, não prazos contratuais extraídos do documento. Não há cálculo automático por produtividade, equipe, calendário de dias úteis, feriados ou prazo de fornecimento real. Concilie o cronograma com o prazo contratado e as condições de execução. Textos extensos podem ser reduzidos à parte do escopo aprovado. A leitura da proposta não importa preços para o financeiro: continue usando a importação de orçamento para custos.

## Arquivos e permissões
PDF e DOCX são lidos no navegador; o arquivo original não é enviado ao Apps Script nem armazenado no Drive por esta função. São carregados PDF.js 4.10.38 e Mammoth 1.8.0 de CDNs por HTTPS; não há envio do documento para uma API externa de análise. As etapas, responsáveis e a referência do arquivo/texto passam a integrar a obra salva no Sheets. O texto completo não é salvo com a obra. Nenhum novo acionador, e-mail ou permissão de envio é instalado por esta melhoria.

## Verificação
check-proposta-cronograma.cjs verifica extração com leitores simulados, disciplinas, exclusões, quantidade explícita, datas, dependências, revisão obrigatória, dados existentes, linha de base, repetição, limites e sintaxe dos scripts incorporados ao Painel. Execute node check-proposta-cronograma.cjs em um ambiente Node. Nesta sessão o ambiente local estava indisponível; as verificações de lógica e sintaxe foram executadas no ambiente JavaScript de ferramentas. Não foi possível executar a suíte completa do repositório, ler os anexos reais ou validar a interface e os downloads de bibliotecas no navegador Google. Teste um PDF com texto e um DOCX na implantação antes do uso da equipe.
