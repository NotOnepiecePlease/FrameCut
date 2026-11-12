# Entrequadros

Ferramenta local para recortar várias tirinhas e esvaziar seus balões automaticamente. Gratuita, sem instalação, sem internet e sem tradução.

## Abrir e usar

1. Dê dois cliques em **`Entrequadros.html`**, usando Chrome ou Edge. Pode compartilhar somente esse arquivo.
2. Clique em **Escolher imagens** e selecione uma ou várias imagens PNG, JPG ou WebP. Também pode arrastar os arquivos para a área de prévia.
3. O processamento começa automaticamente. A **quantidade de quadros é automática**, com saída padrão de **608 × 1600 pixels**, ajustável nos campos de largura e altura. A ferramenta reconhece faixas empilhadas, quadros lado a lado separados por faixas pretas e quadros com molduras pretas sobre margens brancas. A opção **Esvaziar balões automaticamente** vem ligada. Margens e créditos são preservados.
4. Clique em um item da fila para conferir o resultado e os textos removidos. Use **Conferir cortes** para ver as divisões sobre o original, que continua com texto.
5. Clique em **Baixar lote em ZIP** para baixar os PNGs prontos juntos. **Baixar este PNG** exporta somente a imagem selecionada.

Os intervalos brancos são calculados para preencher a altura final. Com três quadros, o primeiro intervalo fica ligeiramente menor que o segundo, na proporção da referência. Ao desmarcar o ajuste de altura final, o campo **Espaço fixo entre quadros** define intervalos iguais, em pixels da saída. Os contornos dos balões podem avançar sobre esses espaços.

Quadros lado a lado são extraídos individualmente e empilhados na ordem de leitura: de cima para baixo, da esquerda para a direita. Cada quadro mantém sua proporção em relação à largura da página; quadros estreitos ficam centralizados, sem serem ampliados até preencher toda a largura. Nas páginas com quadros empilhados dentro de molduras, as margens laterais, o topo e o rodapé com créditos são mantidos, substituindo os intervalos originais por espaços maiores.

Os exemplos fornecidos têm larguras finais diferentes. Para reproduzir essas dimensões, use **426 × 1600** no exemplo com dois quadros superiores lado a lado, ou **378 × 1600** no exemplo com quatro quadros e margens brancas. A detecção e a ordem de leitura são automáticas; a largura e a altura são o padrão de saída escolhido para o lote.

Se mudar o padrão ou ajustar as bolinhas de corte, use **Reprocessar lote**. Ele gera os arquivos com os cortes e medidas atuais, preserva as correções manuais e abre **Resultado automático** ao terminar. Baixar o ZIP também aplica automaticamente o padrão alterado antes de gerar o arquivo. Para procurar cortes do zero na imagem selecionada, use **Detectar divisões novamente** nos ajustes manuais; essa ação substitui os cortes ajustados.

## Imagens para revisar

A detecção reconhece divisões pretas compridas, faixas pretas verticais e horizontais e molduras retangulares pretas separadas por margens brancas. A quantidade automática permite processar páginas com números de quadros diferentes no mesmo lote. Para uma correção opcional, escolha uma quantidade específica em **Quadros por imagem**; se a contagem encontrada for diferente, a página é sinalizada para revisão.

Páginas com quadros diagonais, sem bordas, sobrepostos ou com separações interrompidas podem exigir ajuste. Uma área escura do desenho não deve ser tratada como divisão apenas para completar a quantidade: a análise exige continuidade suficiente na borda e sinaliza os casos incertos.

Quando não encontra uma divisão com confiança suficiente, a imagem fica marcada como **Revisar** e é excluída do ZIP. O arquivo `REVISAR.txt`, dentro do ZIP, lista as pendências. Erros e formatos que não cabem nas medidas escolhidas também são sinalizados na fila.

Para corrigir uma imagem:

1. Selecione-a na fila, abra **Ajustes manuais e limpeza dos balões** e escolha **Ajustar divisões**.
2. Clique para inserir uma divisão; arraste para ajustar; clique direito para removê-la. Arraste uma bolinha verde existente para mover esse ponto, sem criar outro, usando **Ajustar divisões** ou **Criar ou mover ponto**. Entre as bolinhas, **Shift + clique** perto da linha acrescenta um ponto; **Criar ou mover ponto** faz isso sem teclado. O ponto mais próximo do clique é selecionado, inclusive em contornos densos. Os pontos internos podem se mover na horizontal e na vertical, respeitando a ordem dos vizinhos e evitando cruzar outros cortes. Os pontos nas bordas permanecem presos às laterais da imagem.
3. Confira que a quantidade de quadros corresponde ao padrão escolhido e reprocese o lote.

Em layouts com quadros retangulares, **Ajustar divisões** permite arrastar as bordas dos recortes detectados. Clique direito dentro de um quadro para removê-lo. **Selecionar quadro** permite desenhar um novo recorte retangular. As alterações podem ser desfeitas. Os recortes são mantidos ao trocar de imagem na fila.

Mesmo imagens aceitas automaticamente devem ser conferidas quando o desenho fugir do padrão. A detecção por linhas pode confundir outros traços longos e escuros com bordas.

## Balões vazios

A opção **Esvaziar balões automaticamente** combina duas análises. Nos balões brancos ou coloridos opacos, reconhece a região fechada e remove a fala inteira, incluindo textos menores em balões unidos, pontuação e contornos brancos das letras. Nos transparentes, agrupa letras pretas alinhadas em palavras e linhas e altera somente os traços das letras e sua suavização, preservando os espaços entre elas e o desenho ao redor. O preenchimento interpola cores próximas. Funciona localmente, sem OCR, modelos ou serviços externos, na prévia, no PNG individual e em todas as imagens do ZIP.

A identificação dos traços considera o contraste, a cor da tinta, as proporções e o alinhamento dos caracteres. Isso reduz confusões como a que fazia os desenhos cinza das latas serem apagados. Não há coordenadas específicas dos exemplos no algoritmo de limpeza.

A fila mostra quantos balões foram identificados. **Zero balões não significa que a imagem não tenha texto**: confira a prévia. Textos muito curtos, balões escuros ou abertos, letras coloridas e fundos com textura podem não ser identificados. A análise é conservadora para reduzir alterações no desenho, mas não garante a identificação de todos os balões nem a ausência de erros em artes diferentes.

Cada fala é preparada separadamente antes de ser aplicada. Se a máscara não cobrir os traços identificados por inteiro, a fala é preservada e sinalizada como **revisar texto**. O ZIP inclui `CONFERIR-LIMPEZA.txt` quando isso acontecer. Esse controle verifica a máscara das letras identificadas; não substitui a conferência visual nem reconhece o significado do texto.

Para manter os textos, desmarque a opção. A imagem de trabalho não é alterada pela limpeza automática, então é possível alternar e comparar. O original mostrado em **Conferir cortes** continua com texto; a limpeza aparece em **Resultado automático**.

Se um balão não for reconhecido, abra os ajustes manuais, escolha **Limpar um balão com um clique** e clique em uma parte clara do fundo dele, perto das letras. Essa ação também funciona em textos curtos e pode ser desfeita. Clique no fundo, não sobre a letra preta ou a borda.

Para retoques, use Retângulo, Elipse ou Pincel dentro dos ajustes manuais. O conta-gotas copia a cor de uma região limpa do balão. Com a captação de cor ligada, uma seleção usa a cor predominante ao redor dela.

Retângulo, Elipse e Pincel usam cor lisa. A limpeza automática continua variações suaves da cor do fundo, mas não recupera exatamente os pixels que as letras escondiam. Nos transparentes, detalhes finos de textura sob as letras podem ficar suavizados e exigir retoque. Desfazer e Ctrl+Z revertem as alterações manuais da imagem selecionada. A memória de desfazer tem limite aproximado de 100 MB e é reiniciada ao trocar de imagem; as edições feitas são preservadas na fila durante a sessão.

## Limites

- Até 250 imagens por lote e 300 MB de PNGs gerados. Divida trabalhos maiores em vários lotes.
- Entrada: até 24 megapixels e 16.000 pixels por lado. Saída: até 60 megapixels e 32.000 pixels de altura.
- Quantidade automática de até 12 quadros, com opção de fixar entre 2 e 12. Contornos de balões em faixas horizontais são procurados em uma faixa acima da divisão; invasões muito grandes podem exigir ajustes manuais. Em layouts mistos, o corte retangular passa dentro da faixa preta que separa os quadros.
- A altura final precisa comportar a imagem redimensionada. Se ela ficar pequena demais, aumente a altura ou diminua a largura.
- O botão de parar interrompe entre imagens. É possível baixar os resultados concluídos.
- Não há salvamento permanente de projeto. Baixe o resultado antes de fechar a aba ou substituir o lote.
- Nenhuma imagem é enviada para servidor. O processamento acontece no navegador.

## Desenvolvimento e validação

`index.html`, `style.css`, `automation.js`, `balloon-cleaner.js` e `app.js` são os fontes. O motor de automação faz a análise das linhas, acompanha os contornos, compõe a saída e escreve o ZIP sem bibliotecas externas. `balloon-cleaner.js` identifica os balões e interpola o fundo das letras removidas.

Depois de editar, execute `node build.cjs` para atualizar o HTML independente. Execute `node verify.cjs --portable` para verificar a versão independente em um Chrome ou Edge local. O teste usa a interface, verifica um lote, o contorno de um balão, as medidas da saída, a revisão de imagens sem divisões e a exportação. Não precisa instalar pacotes.

Para testar também uma imagem real com o mesmo padrão e posição das divisões do exemplo fornecido:

```powershell
node verify.cjs --portable --image 'C:/caminho/tirinha.png'
```

Esse teste adicional gera `exemplo-automatico.png` (com texto), `exemplo-sem-texto.png` (recortada e limpa) e `exemplo-sem-texto-original.png` (limpa nas dimensões originais). Os exemplos incluídos foram gerados automaticamente a partir da imagem fornecida na conversa. O teste também verifica a remoção nos cinco balões e a preservação dos rostos e olhos, pixel por pixel, nas áreas avaliadas.

Os parâmetros opcionais `--grid-image` e `--frames-image` testam os novos exemplos reais e geram `exemplo-layout-misto.png` e `exemplo-quatro-quadros.png`, com textos preservados para comparar com as referências. Também verificam leitura, centralização, ajuste manual, contagem automática e os dois layouts juntos no mesmo lote.

Esses testes também geram `exemplo-transparente-limpo.png` e `exemplo-brancos-limpo.png`, além das versões nas dimensões originais (`*-original.png`). Eles verificam a limpeza das três falas transparentes e das oito regiões brancas, incluindo a legenda pequena, e comparam os pixels das latas, logotipos, roupa e rostos com os originais nas áreas avaliadas.
