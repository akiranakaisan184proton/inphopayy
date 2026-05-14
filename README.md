# InphoPay

Gateway de recebimento privado, focado em operacao confidencial com PIX.

## O que esta implementado

- Backend seguro (Express + SQLite) com:
  - autenticacao por JWT (registro/login);
  - carteira individual por usuario;
  - historico de transacoes por usuario;
  - endpoint privado para gerar PIX (`/pix/create`) com token TriboPay somente no servidor.
- Frontend moderno (React + Vite):
  - login/registro;
  - painel com saldo da carteira;
  - geracao de QR Code PIX e copia-e-cola;
  - tabela de transacoes recentes.

## Setup rapido

1. Backend:
   - copie `backend/.env.example` para `backend/.env`
   - preencha `TRIBOPAY_API_TOKEN` com seu token
2. Frontend:
   - copie `frontend/.env.example` para `frontend/.env`

## Rodar em desenvolvimento

Em um terminal:

```bash
npm run dev:backend
```

Em outro terminal:

```bash
npm run dev:frontend
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:4000`

## Notas de confidencialidade

- Nao expor token TriboPay no frontend.
- Restrinja acesso via VPN/allowlist IP e contas autorizadas.
- Use `JWT_SECRET` forte e diferente por ambiente.
