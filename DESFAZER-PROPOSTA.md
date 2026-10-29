# Limpar proposta ou desfazer suas etapas

Na área “Gerar cronograma pela proposta aprovada”, o botão “Limpar proposta carregada” limpa arquivo, texto, prévia, disciplina e início informado. Se a leitura ainda estiver em andamento, seu resultado será ignorado. Nenhuma atividade já adicionada é removida por esse botão.

Se a proposta já gerou atividades, aparece uma lista com suas origens e a quantidade de atividades de cada proposta. Escolha a proposta e clique em “Desfazer etapas da proposta selecionada”. A confirmação informa que as edições e apontamentos feitos nas atividades desse grupo também serão removidos. As outras atividades, os custos e a linha de base permanecem. Se uma atividade externa depender de alguma etapa a remover, ajuste a predecessora antes de desfazer.

Após desfazer, clique em Salvar no Sheets para compartilhar a correção. É possível gerar novamente as etapas da mesma proposta após sua remoção. A opção atua sobre etapas geradas pela proposta, não sobre itens financeiros ou cronogramas importados via Excel.

Para ativar, substitua somente o conteúdo de Painel.html pelo arquivo apps-script/Painel.html desta branch e atualize a versão da implantação existente. Mantenha Code.gs, propriedades e planilha.

Verificações: remoção por origem, preservação da linha de base e de outras atividades, bloqueio de dependências externas, limpeza dos campos, sintaxe e correspondência dos scripts incorporados. Ambiente local indisponível nesta sessão: as verificações foram executadas no ambiente JavaScript de ferramentas; falta conferir a interface na implantação Google.
