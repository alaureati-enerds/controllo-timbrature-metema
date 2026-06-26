# Come creare un nuovo tema

Guida di riferimento per aggiungere un tema (palette) selezionabile dall'utente,
sul modello di quelli già presenti (Chiaro, Scuro, Catppuccin Latte/Mocha,
Solarized Light/Dark, Monokai, Dracula, Nord, Gruvbox).

## Come funziona il theming

Il tema è costruito su **token semantici** (variabili CSS) — non su colori
hardcoded nei componenti. I componenti shadcn usano utility come
`bg-background`, `text-foreground`, `border-border`: cambiando il valore dei
token, l'intera UI si adegua da sola.

Il flusso è:

1. **`next-themes`** ([components/theme-provider.tsx](../components/theme-provider.tsx))
   applica su `<html>` una **classe** col nome del tema selezionato
   (es. `catppuccin-mocha`). È configurato con `attribute="class"`.
2. **[app/globals.css](../app/globals.css)** definisce, per ogni tema, un blocco
   con i valori dei token:
   - `:root` → tema **Chiaro** (default, sempre attivo come fallback)
   - `.dark` → tema **Scuro**
   - `.catppuccin-latte`, `.catppuccin-mocha` → temi aggiuntivi
3. **`@theme inline`** (sempre in `globals.css`) mappa i token alle utility di
   Tailwind (es. `--color-primary: var(--primary)`). **Questo strato si tocca
   solo se aggiungi un token nuovo**, non per un nuovo tema.
4. **Il selettore** ([components/mode-toggle.tsx](../components/mode-toggle.tsx))
   elenca i temi e chiama `setTheme(...)`.

### I token disponibili

Ogni tema definisce questi token (vedi i blocchi esistenti per i valori):
`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`,
`--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`,
`--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`,
`--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`,
`--chart-1…5`, e la serie `--sidebar-*`. Il `--radius` è definito una sola volta
in `:root` ed è condiviso.

I colori sono in formato **`oklch()`** per coerenza. Tecnicamente funziona anche
HEX (`--primary: #8839ef`), ma conviene convertire (vedi sotto).

## Aggiungere un nuovo tema — passo per passo

Esempio: aggiungiamo un tema chiamato `tokyo-night` (scuro).

### 1. Definisci i token in `app/globals.css`

Aggiungi un blocco con la classe del tema, sotto quelli esistenti:

```css
/* Tokyo Night — tema scuro aggiuntivo. */
.tokyo-night {
    --background: oklch(...);
    --foreground: oklch(...);
    /* ...tutti gli altri token... */
}
```

Il modo più rapido è **copiare un blocco esistente** dello stesso tipo
(chiaro → copia `.catppuccin-latte`; scuro → copia `.catppuccin-mocha`) e
sostituire i valori.

### 2. Se il tema è SCURO, estendi il dark variant

Le utility `dark:` si attivano solo sotto le classi elencate in questa riga
in cima a `globals.css`. Aggiungi la nuova classe se il tema è scuro:

```css
@custom-variant dark (&:is(.dark *, .catppuccin-mocha *, /* ... */ .tokyo-night *));
```

Per i temi **chiari** questo passaggio non serve.

### 3. Registra il tema in `next-themes`

In [components/theme-provider.tsx](../components/theme-provider.tsx) aggiungi il
nome all'array `themes`:

```tsx
themes={["light", "dark", "catppuccin-latte", /* ... */ "tokyo-night"]}
```

Il nome **deve combaciare** esattamente con la classe CSS del passo 1.

### 4. Aggiungi la voce al selettore

In [components/mode-toggle.tsx](../components/mode-toggle.tsx) aggiungi un
`DropdownMenuRadioItem` con `value` uguale al nome del tema:

```tsx
<DropdownMenuRadioItem value="tokyo-night">Tokyo Night</DropdownMenuRadioItem>
```

### 5. Verifica

```bash
npm run build
```

## Convertire i colori in `oklch()`

Le palette pubbliche sono spesso in HEX. Per convertirle in `oklch()` con valori
accurati si può usare uno script Node (conversione sRGB → OKLCH secondo Björn
Ottosson). In alternativa esistono convertitori online HEX → OKLCH, oppure si
possono usare i valori HEX direttamente nel CSS.

## Note di design

- **Token semantici, non letterali**: scegli *a cosa serve* un colore
  (`--primary`, `--ring`, `--destructive`), non il colore in sé. È questo che
  rende un tema sostituibile in un punto solo.
- **Superfici elevate**: nei temi scuri conviene dare a `--card`/`--popover` un
  tono leggermente più chiaro di `--background` per dare profondità.
- **Contrasto**: verifica che ogni coppia `*` / `*-foreground` sia leggibile.
