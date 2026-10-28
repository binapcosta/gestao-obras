# Solicitações de compra e alertas de atraso

## Atualização do aplicativo
1. Faça backup no painel e salve as obras pendentes no Sheets.
2. No projeto existente de Gestão de Obras, substitua `Code.gs` por `apps-script/Code.gs` e `Painel.html` por `apps-script/Painel.html` desta branch. O código auxiliar já está incluído no Code.gs; não crie um segundo arquivo com o mesmo código.
3. Preserve as propriedades existentes `SHEET_ID`, `ALLOWED_EMAILS` e `ADMIN_EMAIL`. A conta configurada como ADMIN_EMAIL precisa estar em ALLOWED_EMAILS e ter acesso de edição à planilha. Atualize a implantação existente escolhendo uma nova versão, preservando o endereço /exec.
4. No editor, selecione e execute `autorizarComprasEAlertas` com a conta administradora e conceda as permissões solicitadas. Outros usuários que enviarão solicitações pela implantação podem precisar autorizar os novos escopos. Se a implantação executar como usuário, cada pessoa que enviar e-mails deve ter acesso à planilha e às permissões Google necessárias.

## Solicitação de compra
Em uma obra, use o nome da obra como referência da proposta, cadastre equipamentos na categoria Equipamentos com valores orçados e clique em Salvar no Sheets. Abra “Selecionar equipamentos e gerar solicitação de compra”, marque os itens, informe a quantidade e a data necessária. Clique em “Gerar / imprimir solicitação” para visualizar e salvar como PDF. Para enviar, preencha o destinatário e clique em “Enviar solicitação em PDF”; revise a confirmação antes do envio.

O valor apresentado é o valor orçado TOTAL armazenado no item, não preço unitário. A quantidade solicitada não recalcula ou rateia o valor orçado. Uma compra parcial exige conferência manual e, se necessário, ajuste do orçamento antes de salvar a obra. Essa é uma solicitação interna, não aprovação formal nem autorização de pagamento. O PDF usa o nome da obra como referência da proposta e os custos efetivamente salvos no Sheets. O nome de exibição do remetente é CompaSSS — Gestão de Obras; o endereço real continua sendo o da conta Google que executa o envio. Se a versão, proposta ou os itens divergem da tela, o envio é bloqueado para evitar dados incorretos. O histórico de tentativas é registrado na aba `Envios_Compra`; em caso de erro ou estado PREPARADO/VERIFICAR, confira o histórico e a caixa de saída antes de repetir.

## Alertas de atraso
1. Cadastre e-mail do gestor e/ou destinatários do resumo no painel e cadastre o e-mail em cada atividade. Marque “Ativar alertas diários de atraso para esta obra” e salve no Sheets. Os alertas começam desativados em cada obra até serem marcados e salvos.
2. Com a conta administradora, clique em “Instalar alertas automáticos (administração)” e conceda as permissões. O acionador diário é instalado uma única vez para essa conta e está previsto para cerca de 8h, no fuso de São Paulo; o horário exato é definido pelo Google.
3. A rotina lê somente a versão salva no Sheets. Atividade sem término real é considerada atrasada se a previsão atual ou, na ausência dela, o fim planejado for anterior ao dia atual. Obras com status Concluída são ignoradas. Gestor e destinatários do resumo recebem as atividades atrasadas da obra; cada responsável recebe suas próprias atividades. Se uma pessoa acumular papéis, recebe uma única mensagem por obra naquele dia.
4. A aba `Alertas_Atraso` registra o envio por obra, destinatário e dia. A mensagem é repetida em dias seguintes enquanto houver atraso. Para interromper uma obra, desmarque a opção e salve no Sheets; para desligar o acionador, no editor Apps Script acesse Acionadores e exclua o acionador `delayAlertsDaily_` da conta que o criou. Consulte estados PREPARADO/VERIFICAR antes de reenviar manualmente.

O acionador executa na conta que o instalou e usa sua cota de e-mail. A função de compra também usa as permissões e a cota da conta sob a qual a implantação executa; confira essa configuração antes do uso. Não há envio automático para fornecedores; o envio da solicitação requer endereço e clique explícitos. Todos os valores, nomes e destinatários devem ser revisados antes de enviar.

## Verificação
Execute `node check-import-cronograma.cjs` e `node check-compras-alertas.cjs`. Os testes simulam Sheets, permissões, disparo e MailApp; nenhuma mensagem real é enviada durante eles. Antes do uso em produção, teste a implantação com duas contas autorizadas, confirme o PDF e confira as abas de histórico e os e-mails recebidos. A conta Google pode pedir novas autorizações de envio e acionadores.

## Quantidades e custos unitários
A importação lê as colunas QTD, CUSTO (R$) COMPRA UNITÁRIO e CUSTO (R$) COMPRA TOTAL, quando presentes. As quantidades e os valores unitários também podem ser editados diretamente nos itens. A prévia e a solicitação de compra mostram quantidade orçada, quantidade solicitada, custo unitário e valor total orçado. Valores são independentes: alterar um não recalcula os demais. Para uma solicitação parcial, o valor total mostrado permanece o orçamento total do item, e não o custo proporcional da compra parcial.

Para itens previamente importados, reimporte o mesmo arquivo e a mesma aba, com o mesmo nome de arquivo, linha e descrição. Se a quantidade ou o custo unitário ainda não estavam registrados, apenas os campos vazios são preenchidos. Custo total, realizado, quantidades e unitários já registrados são preservados. Itens modificados, movidos ou renomeados podem ser entendidos como novos: faça backup e revise a prévia. Salve a obra no Sheets depois.

## Cotação de equipamentos com fornecedor
Abra “Selecionar equipamentos — compra e cotação”, marque os equipamentos, informe as quantidades e a data necessária. Na seção “Cotação junto ao fornecedor”, clique em “Gerar cotação para fornecedor” para imprimir/salvar PDF, ou preencha o e-mail do fornecedor e clique em “Enviar cotação em PDF”. Revise o destinatário antes de confirmar. O documento apresenta equipamentos e quantidades, com campos em branco para o fornecedor informar preços. Os custos internos não são incluídos na cotação. Não é necessário ter um orçamento interno preenchido para cotar.

Sem marcar “Faturamento direto ao cliente”, o documento usa exatamente:
- Razão social: Compasss Tecnologia
- CNPJ: 28.781.740/0002-02
- Inscrição Estadual: 11.356.281
- Inscrição Municipal: 1.437.030-7

Ao marcar a opção, aparecem os campos de razão social e CNPJ do cliente (obrigatórios), Inscrição Estadual e Inscrição Municipal (opcionais; é possível escrever ISENTO). Os dados permanecem com a obra no navegador e são compartilhados ao salvar a obra no Sheets. Ao desmarcar a opção, o documento retorna aos dados da CompaSSS. O servidor valida os dados do cliente e aplica o padrão corporativo se o faturamento direto estiver desmarcado.

O nome da obra identifica a proposta na cotação. O envio usa descrições dos equipamentos salvos no Sheets e registra tentativas em `Envios_Cotacao`, separadamente de `Envios_Compra`. Não foi realizado envio real durante os testes locais. Para ativar esta melhoria, substitua os conteúdos de Painel.html e Code.gs e atualize a implantação existente, mantendo as propriedades e a mesma planilha.
