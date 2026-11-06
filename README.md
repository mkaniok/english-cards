# Kartičky – anglická slovíčka

Webová aplikace na procvičování anglických slovíček (britská angličtina) pro 6. třídu.
Zdarma na Vercelu (hosting), Supabase (databáze, přihlášení, funkce) a GitHubu.

## Co umí

- Přihlášení **kódem třídy + přezdívkou + PINem**, bez e-mailu a osobních údajů.
- Role: **žák** (procvičuje, navrhuje kartičky), **editor** (spravuje kartičky a lekce, vidí svou třídu), **admin** = učitel (navíc role, PINy, odebírání).
- **Více tříd**: třída je ročník + písmeno + školní rok (např. 6. D 2026/2027). Admin zakládá třídy, vidí kódy a statistiky všech tříd
  a na konci roku může třídu posunout do dalšího ročníku (kód zůstává, žáci se přihlašují dál). Kartičky a lekce jsou společné.
- Procvičování po lekcích, směr EN→CZ / CZ→EN / mix, tlačítka **Nevěděl / Napůl / Věděl**, výslovnost en-GB.
  Kartička je naučená po 3× „Věděl“ za sebou; „Napůl“ úroveň nemění, „Nevěděl“ ji vrátí na nulu.
- Přidávání kartiček s **kontrolou gramatiky** (LanguageTool, en-GB), upozornění na duplicity, hromadný import.
- Statistiky žáka a přehled třídy (aktivita, nejtěžší slovíčka).
- **Nahlásit chybu** (🐞 v horní liště): krátký formulář, automaticky přidá stránku, zařízení a poslední chybu z prohlížeče.
  Hlášení vidí super admin v menu **Chyby** (označí jako vyřešené, smaže); autor vidí svá hlášení a jestli jsou vyřešená.
- Světlý a tmavý motiv, funguje na mobilu i počítači, jde přidat na plochu telefonu.

## Struktura

| Cesta | Obsah |
| --- | --- |
| `src/` | React + TypeScript + Tailwind (Vite) |
| `supabase/migrations/` | schéma databáze a pravidla přístupu (RLS) |
| `supabase/seed.sql` | učebnice, lekce a 210 kartiček z první verze |
| `supabase/functions/pupil-auth` | registrace žáků, reset PINu, odebrání (admin) |
| `supabase/functions/grammar` | kontrola gramatiky přes LanguageTool |
| `.github/workflows/keep-alive.yml` | denní „ťuknutí“, aby se Supabase o prázdninách neuspalo |

## Lokální vývoj

```bash
npm install
npm run dev
```

Adresa Supabase a publishable klíč jsou výchozí v `src/lib/supabase.ts` (jsou veřejné, přístup hlídá RLS);
přepsat je jde proměnnými `VITE_SUPABASE_URL` a `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Nasazení

Vercel: Import projektu z GitHubu, framework Vite, nic dalšího se nastavovat nemusí.
Každý push do `main` se nasadí automaticky.
