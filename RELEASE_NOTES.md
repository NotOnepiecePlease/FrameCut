# FrameCut v1.0.0

Primeira versão portátil do cortador de quadros, com processamento local e em lote.

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
