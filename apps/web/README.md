# Interface web

A interface usa Material UI e Emotion, com a identidade do Branding Kit em
`src/theme.ts`. `ThemeProvider`, `CssBaseline` e a localização `ptBR` são
aplicados globalmente. Textos, validações, situações, permissões e datas
visíveis usam português do Brasil. Códigos internos da API permanecem estáveis;
`describeError` converte os erros em mensagens em português.

## Organização da tela

- O contêiner principal ocupa `100dvh`, com as abas Agendar e Agendamentos.
- O calendário é a tela principal. Profissional e serviço ficam no topo, com
  a primeira opção selecionada inicialmente. O clique em um dia abre o
  agendamento nessa data, onde o cliente e o horário são escolhidos.
- No reagendamento, o clique na data também abre os horários diretamente.
- A grade de horários ocupa a área livre do cartão. Um ResizeObserver ajusta
  colunas e quantidade de horários por página conforme a largura e a altura.
- Agendamentos têm filtro por data junto ao título, respeitando o fuso da
  empresa, e paginação. O filtro pode ser limpo sem alterar os registros.
- Confirmações e erros de operações têm uma visualização própria.
- Não há bloqueio global de rolagem nem recorte do conteúdo para simular que
  tudo cabe: o layout distribui o espaço disponível entre as etapas.
- Todos os dias do calendário são clicáveis. Roxo indica disponibilidade,
  laranja indica dias consultados sem vagas e roxo escuro indica seleção.
  Datas passadas, carregando ou com falha de consulta ficam neutras. Confirmar exige um horário válido retornado pela API.

Use componentes Material UI e os campos compartilhados em
`src/components/ui.tsx`. Tailwind auxilia no layout. Mantenha as cores e os
padrões globais em `src/theme.ts`, e os ajustes de tamanho em `src/index.css`.
O tema segue `Branding Kit Standalone.html`: roxo #6b21e8, roxo escuro
#68378d, superfície #f0eafa, texto #231c2b, fundo #f7f5fb e Helvetica/Arial.
Botões usam raio de 10px; cartões, 16–24px; o fundo usa o gradiente do kit.
O nome Hubday substitui o nome de exemplo Verda. A marca geométrica aparece
no login e no painel lateral em desktops. Em telas menores, a navegação
permanece compacta. Para contraste legível, textos auxiliares usam #655970
e botões com texto branco usam o roxo primário #6b21e8, com hover #68378d.
Os tons seguem a revisão roxa do kit, aproximada visualmente da referência
fornecida; os códigos originais da marca não foram disponibilizados.

## Validação

`pnpm --filter @hubday/web build` valida TypeScript e gera a versão de produção.
`pnpm test:e2e` executa os testes de navegador. A configuração padrão de E2E
recria os dados fictícios pelo seed: use um banco de testes.

Os testes cobrem login e validações em português, calendário por teclado,
dias com e sem vagas, datas passadas, paginação com 25 agendamentos, tradução
de erros da API e o fluxo de agendar, reagendar e cancelar. Verificam que a
página não excede a largura/altura da janela e que os controles estão dentro
da área visível em 320×568, 390×844, 1366×768 e 844×390.
