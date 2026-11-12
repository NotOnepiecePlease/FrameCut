# FrameCut v1.0.1

Corrige a atualização da prévia depois de reprocessar o lote.

## Correção desta versão

Ao mover as bolinhas de corte e clicar em **Reprocessar lote**, o aplicativo gerava os arquivos, mas permanecia no editor do original. Agora abre **Resultado automático** com a imagem atualizada ao terminar.

Reprocessar preserva os ajustes manuais e o histórico de desfazer. Os testes verificam que a prévia, o PNG individual e o PNG dentro do ZIP usam as mesmas posições ajustadas. Para procurar novos cortes do zero na imagem selecionada, use **Detectar divisões novamente**, nos ajustes manuais.

## Qual arquivo baixar?

**Recomendado: `FrameCut-portatil.zip`** — contém o aplicativo e o tutorial completo, ambos offline.

Também estão disponíveis:

- `FrameCut.html`: somente o aplicativo, pronto para abrir.
- `COMO-USAR.html`: tutorial de download, configuração, correções e exportação.
- `SHA256SUMS.txt`: hashes dos arquivos da release.

## Do download ao primeiro resultado

1. Em **Assets**, baixe `FrameCut-portatil.zip`.
2. Na pasta Downloads, clique com o botão direito no ZIP e escolha **Extrair tudo…**.
3. Na pasta extraída, abra **`FrameCut.html`** com Chrome ou Edge.
4. Deixe **Quadros por imagem → Automático** e ajuste as medidas, se desejar.
5. Se quiser manter os textos, desmarque **Esvaziar balões automaticamente**.
6. Clique em **Escolher imagens**, selecione uma ou várias e aguarde.
7. Confira cada resultado na fila. Use **Baixar este PNG** ou **Baixar lote em ZIP**.

Sem instalação, conta ou servidor local. Depois do download, o aplicativo funciona sem internet e não envia as imagens para um servidor.

## O que esta versão inclui

- Contagem automática de quadros, inclusive em páginas de formatos diferentes no mesmo lote.
- Detecção de quadros empilhados, lado a lado e com molduras sobre margens brancas.
- Quadros proporcionais e centralizados, empilhados na ordem de leitura.
- Ajuste dos espaços por altura final ou por intervalo fixo.
- Limpeza de balões opacos e identificação dos traços de letras em transparentes.
- Edição dos recortes, movimentação das bolinhas verdes existentes, seleções, pincel e desfazer.
- Exportação individual em PNG ou do lote em ZIP, com avisos de revisão.

## Antes de publicar suas imagens

Confira os recortes e a limpeza. A detecção pode precisar de ajustes em desenhos diferentes; o preenchimento sob letras transparentes é aproximado. Salve os resultados antes de fechar a aba ou trocar o lote.

O tutorial completo, com exemplos de antes e depois, está no [README](https://github.com/NotOnepiecePlease/FrameCut#readme).
