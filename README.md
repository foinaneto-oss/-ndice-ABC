# Índice ABC

## 1. Rodar o segundo script SQL
No Supabase, SQL Editor: rode o arquivo `indice-abc-schema-parte2.sql` (a função de contagem de cotas). O primeiro script você já rodou.

## 2. Subir este código no GitHub
1. Acesse github.com e crie um repositório novo (ex.: `indice-abc`), público ou privado.
2. Na página do repositório, clique em "Add file" → "Upload files".
3. Arraste TODOS os arquivos e pastas desta pasta (`indice-abc-app`) para lá e confirme o commit.

## 3. Conectar no Vercel
1. Acesse vercel.com, faça login com sua conta do GitHub.
2. "Add New" → "Project" → selecione o repositório `indice-abc`.
3. Em "Environment Variables", adicione:
   - `VITE_SUPABASE_URL` → a Project URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` → a anon public key do Supabase
4. Clique em "Deploy".

Em poucos minutos o Vercel te dá um link (tipo `indice-abc.vercel.app`) — esse já é o site funcionando.

## 4. Domínio próprio (opcional, depois)
Em "Settings" → "Domains" no Vercel, dá pra apontar um domínio comprado (ex.: `indiceabc.org.br`) para o projeto.

## 5. Como usar
- Acesse o link do site → faça login com o e-mail/senha que você cadastrou no Supabase Authentication.
- Crie a pesquisa, copie o link público (botão "Copiar link") e distribua (QR code, WhatsApp, etc).
- Quem recebe o link responde sem precisar de login.
- Você acompanha as cotas e exporta o CSV quando quiser.
