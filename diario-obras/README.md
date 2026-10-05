# CompaSSS — Diário de Obras

Aplicativo de registro diário com fotos e impressão de relatórios. Agora permite cadastrar várias obras, selecionar uma ao lançar a atividade e filtrar o histórico. Todas as obras usam uma planilha e a pasta de fotos já existentes, sem criar uma planilha por obra.

## Arquivos

- `index.html`: fonte da interface, com identidade visual CompaSSS.
- `apps-script/Code.gs`: backend Google Apps Script.
- `apps-script/Index.html`: interface gerada para copiar ao projeto Apps Script.
- `build.cjs`: gera o HTML para Apps Script, preservando templates de impressão.
- `check.cjs`: testes de migração, múltiplas obras, gravação, conflitos e sintaxe.

## Atualizar o diário existente

1. Faça uma cópia da planilha e confira as propriedades `SHEET_ID` e `FOLDER_ID` no **projeto do diário**. Não utilize as propriedades ou o projeto da Gestão de Obras/PCP por engano.
2. Copie `apps-script/Code.gs` para o arquivo Code.gs do diário e `apps-script/Index.html` para o arquivo HTML **Index**. O arquivo HTML deve se chamar Index no editor.
3. Mantenha os IDs existentes. Se o projeto não tiver base configurada, ele cria uma planilha única na primeira leitura. Se o ID configurado não abrir ou estiver na lixeira, mostra erro em vez de criar outra base silenciosamente.
4. Em **Implantar > Gerenciar implantações > Editar**, selecione **Nova versão** e implante. Não é necessário trocar a URL existente. O GitHub armazena o código e não atualiza automaticamente o Apps Script.
5. Abra o diário, confira os cadastros migrados e crie duas obras fictícias. Lance atividades em ambas e verifique filtro, edição, fotos e impressão. Confirme os dados em outro usuário conforme as permissões da implantação atual.

## Dados antigos

Na primeira consulta, o sistema acrescenta `obraId` e `revision` depois das oito colunas existentes da aba `reports`. Cada combinação de nome da obra e cliente gera um cadastro em `obras`. Diferenças apenas de acentuação, espaços ou letras maiúsculas usam o mesmo cadastro. Nomes ou clientes realmente diferentes permanecem separados. Fotos e registros antigos são preservados. A migração é repetível e não cria cadastros duplicados a cada leitura.

Não renomeie nem reorganize os cabeçalhos existentes. Se houver divergência, o backend interrompe a operação para conferência. Obras novas com o mesmo nome e cliente são rejeitadas. Obras com mesmo nome e clientes diferentes são permitidas.

## Uso

Use **Nova obra** para informar nome, cliente e local. No registro, selecione a obra cadastrada: o cliente vem do cadastro. Informe data, técnico, atividade e fotos. O filtro **Histórico por obra** mostra os registros da obra selecionada ou de todas as obras. Use **Atualizar dados** para trazer alterações de outro usuário. O relatório individual continua disponível em **Gerar PDF**.

O salvamento usa bloqueio e revisão por registro. Se outra pessoa editar ou excluir a versão carregada, o sistema impede sobrescrever sem recarregar. A exclusão permanece definitiva como na versão anterior. Esta versão não inclui exclusão/renomeação de obras nem integração automática com o PCP.

## Acesso e fotos

As permissões continuam dependendo da implantação e do compartilhamento Google existentes. Não foi implementado login por função nesta entrega. Confira quem pode acessar antes de liberar dados reais. Para uma única base compartilhada, configure os IDs da base e pasta existentes e as permissões correspondentes. Se optar por executar como usuário, todos precisam de acesso aos mesmos recursos.

As fotos continuam com visualização para qualquer pessoa que tenha o link, como no código original, para compatibilidade com impressão. Não são publicadas fotos ou registros de clientes no GitHub. O código limita a 20 fotos por registro e aproximadamente 5 MB por imagem após tratamento.

## Desenvolvimento e validação

Na pasta `diario-obras`, rode `node build.cjs` e `node check.cjs`. O arquivo `index.html` aberto fora do Apps Script serve apenas para revisar a interface: o acesso aos dados depende de `google.script.run`. A validação local simula os serviços Google. Autorizações, upload real no Drive e impressão devem ser conferidos na implantação Google antes do uso em produção.
