# ElseTasks — SKUs marketplace (ML / TikTok Shop)

Entrega = **código digital**. O comprador ativa em `/setup` (Local) ou você provisiona o stack (Cloud).

| SKU | Prefixo da chave | O que recebe | Preço sugerido (base) |
|-----|------------------|--------------|------------------------|
| ElseTasks Local | `ET-LOCAL-` | Pacote Docker + onboarding + 12 meses | Licença software |
| ElseTasks Cloud Mensal | `ET-CLOUD-M-` | Stack isolado na sua cloud + URL | Software + hospedagem |
| ElseTasks Cloud Anual | `ET-CLOUD-Y-` | Idem, 12 meses | Software + hospedagem (desconto) |
| Suporte N1 (add-on) | `ET-SUP-` | Canal e-mail/Slack | Extra |

## Fluxo pós-venda (MVP semi-manual)

1. Cliente compra no Mercado Livre / TikTok Shop.
2. Você gera chave: `./scripts/generate-license-keys.sh local 1`
3. Envia por mensagem do canal: chave + link do zip/docs (Local) **ou** confirma que a URL cloud será enviada em até X horas.
4. Local: cliente sobe compose e cola a chave em `/setup`.
5. Cloud: `./scripts/provision-customer.sh <slug>` e envia `https://<slug>.elsetasks.com/setup`.

## Portal mínimo

- Gerar chaves: script acima ou `POST /api/license/generate` (autenticado).
- Status: `GET /api/license/status`
- Ativar: `POST /api/license/activate` `{ "key": "ET-LOCAL-..." }`

Automação total da API do ML fica para fase posterior.
