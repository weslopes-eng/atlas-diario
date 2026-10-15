# Atlas Diário 🌎

O desafio diário de países em 1 minuto: 5 rodadas ("Qual tem mais?" e "Ache no mapa"), igual para todo mundo, com placar de emojis para compartilhar.

Jogue: https://weslopes-eng.github.io/atlas-diario/ · Feito pelo [Atlas Curioso](https://www.instagram.com/oatlas.curioso/)

## Dados
- **Banco Mundial – World Development Indicators** (API v2, valor mais recente por país; licença CC BY 4.0): população (SP.POP.TOTL), território (AG.SRF.TOTL.K2), PIB per capita (NY.GDP.PCAP.CD), expectativa de vida (SP.DYN.LE00.IN), florestas (AG.LND.FRST.ZS), internet (IT.NET.USER.ZS), população urbana (SP.URB.TOTL.IN.ZS), filhos por mulher (SP.DYN.TFRT.IN), turistas estrangeiros 2019 (ST.INT.ARVL), densidade (EN.POP.DNST), CO₂ por pessoa (EN.GHG.CO2.PC.CE.AR5), acesso à eletricidade (EG.ELC.ACCS.ZS). Cada valor guarda o ano de referência.
- **Mapa:** Natural Earth 1:110m (domínio público) via [world-atlas](https://github.com/topojson/world-atlas), pré-projetado em SVG.
- Nomes em português: Unicode CLDR (Intl.DisplayNames).

## Como atualizar
```
cd tools && npm i d3-geo topojson-client world-atlas i18n-iso-countries playwright
node fetch_data.mjs && node fetch_fix.mjs   # baixa dados do Banco Mundial
OUT=../data node build.mjs                   # gera data/*.json e 809 desafios (15/10/2026 a 31/12/2028)
```

Sem login, sem anúncios, sem rastreadores. Histórico salvo só no aparelho (localStorage).
