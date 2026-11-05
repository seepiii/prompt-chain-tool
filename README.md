# Prompt Chain Tool

Week 8 of the Earth Observatory project: a superadmin-only tool for building and running prompt chains.

- Create, edit and delete prompt chains
- Add, edit, delete and reorder each chain's steps (↑/↓, or insert at a position)
- Generate media: upload an image and/or text, and every step runs in order on the previous step's output. Text steps use Gemini; image steps paint with Pollinations.
- See every result per chain (`/media?chain=…`) and each run step by step (`/runs/[id]`)
- Light, dark or system theme

Shares the Supabase project with the main app and the admin area. Apply
`supabase/migrations/20261105000000_prompt_chain_tool.sql` once; it only adds tables and a function.

```sh
npm ci
npm run dev   # http://localhost:3002
```

Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`.
