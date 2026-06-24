# Come creare una voce di menu della sidebar

Guida di riferimento per aggiungere voci alla sidebar della dashboard, sia
**semplici** (un link diretto) sia con **sotto-voci** (gruppo annidato), mantenendo
il corretto funzionamento anche quando la sidebar è collassata a sole icone.

## Come funziona la sidebar

La sidebar è composta da:

- **[components/ui/sidebar.tsx](../components/ui/sidebar.tsx)** — le primitive
  shadcn (`Sidebar`, `SidebarMenu`, `SidebarMenuButton`, `SidebarMenuSub`, …).
  Non si tocca: si compone.
- **[components/app-sidebar.tsx](../components/app-sidebar.tsx)** — la nostra
  sidebar concreta: header (logo), contenuto (le voci) e footer (utente).
- **[lib/navigation.ts](../lib/navigation.ts)** — l'elenco condiviso delle voci
  **semplici**. La leggono sia la sidebar sia il breadcrumb, così le voci restano
  allineate in un solo punto.

### Le tre modalità di collasso

La `<Sidebar>` accetta la prop `collapsible`:

- `offcanvas` — al collasso scorre fuori schermo e sparisce.
- **`icon`** (quella in uso) — al collasso si restringe a una barra di sole
  icone (`--sidebar-width-icon`, 3rem).
- `none` — non collassabile.

Conseguenza importante per le sotto-voci: in modalità `icon` il componente
`SidebarMenuSub` ha `group-data-[collapsible=icon]:hidden`, quindi **il
sotto-menu inline viene nascosto per design**. Per restare navigabile va
sostituito con un dropdown ancorato all'icona (vedi sotto).

## Caso A — Voce semplice (link diretto)

È il caso più comune. Basta aggiungere una riga a
[lib/navigation.ts](../lib/navigation.ts):

```ts
import { SettingsIcon } from "lucide-react"

export const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
  { title: "Note", url: "/notes", icon: NotebookPenIcon },
  { title: "Impostazioni", url: "/settings", icon: SettingsIcon }, // ← nuova voce
]
```

Non serve altro: la sidebar fa il `map` su `navItems` e si occupa di
evidenziazione attiva (`isActive`) e tooltip da collassata. Anche il breadcrumb
si aggiorna da solo.

> Usa sempre un'icona da `lucide-react`: da collassata resta **solo l'icona**,
> quindi è obbligatoria e dev'essere riconoscibile.

## Caso B — Voce con sotto-voci (gruppo annidato)

Quando una voce raccoglie più pagine correlate serve un sotto-menu. Il pattern
raccomandato è **ibrido**, perché deve funzionare in entrambi gli stati:

- **Sidebar espansa** → fisarmonica inline (`Collapsible` + `SidebarMenuSub`).
- **Sidebar collassata a icone** → dropdown ancorato all'icona (`DropdownMenu`),
  perché il sotto-menu inline sarebbe nascosto.

La scelta tra i due rami avviene a runtime con l'hook `useSidebar()`.

Vedi l'implementazione di riferimento nel componente `NavExample` dentro
[components/app-sidebar.tsx](../components/app-sidebar.tsx). I passi:

### 1. Definisci le sotto-voci

```tsx
const settingsSubItems = [
  { title: "Profilo", url: "/settings/profilo" },
  { title: "Fatturazione", url: "/settings/fatturazione" },
]
```

Definiscile **una volta sola**: entrambi i rami (fisarmonica e dropdown)
leggono dallo stesso array, così non si rischia di tenerli disallineati.

### 2. Crea il componente della voce

```tsx
function NavSettings() {
  const pathname = usePathname()
  const { state, isMobile } = useSidebar()

  // Apri la fisarmonica se la rotta corrente è una delle sotto-voci.
  const hasActiveChild = settingsSubItems.some((sub) => sub.url === pathname)

  // Sidebar collassata su desktop → dropdown ancorato all'icona.
  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip="Impostazioni">
              <SettingsIcon />
              <span>Impostazioni</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="min-w-48">
            <DropdownMenuLabel>Impostazioni</DropdownMenuLabel>
            <DropdownMenuGroup>
              {settingsSubItems.map((sub) => (
                <DropdownMenuItem key={sub.url} asChild>
                  <Link href={sub.url}>{sub.title}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    )
  }

  // Sidebar espansa (e mobile) → fisarmonica inline.
  return (
    <Collapsible asChild defaultOpen={hasActiveChild} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip="Impostazioni">
            <SettingsIcon />
            <span>Impostazioni</span>
            <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {settingsSubItems.map((sub) => (
              <SidebarMenuSubItem key={sub.url}>
                <SidebarMenuSubButton asChild isActive={pathname === sub.url}>
                  <Link href={sub.url}>{sub.title}</Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
```

### 3. Inseriscila nella sidebar

Aggiungi `<NavSettings />` dentro la `<SidebarMenu>` del `SidebarContent`, dopo
il `map` delle voci semplici:

```tsx
<SidebarMenu>
  {navItems.map((item) => (
    /* ...voci semplici... */
  ))}
  <NavSettings />
</SidebarMenu>
```

### 4. Verifica

```bash
npm run build
```

Poi prova manualmente i tre stati: **espansa** (fisarmonica con auto-apertura
sulla rotta attiva), **collassata su desktop** (dropdown a fianco dell'icona),
**mobile** (drawer a larghezza piena, sempre con la fisarmonica).

## Best practice

- **Icona obbligatoria e parlante**: da collassata è l'unico riferimento visivo.
- **`tooltip` sulla voce**: mostra l'etichetta al passaggio del mouse quando la
  sidebar è collassata. Le voci semplici lo passano già; aggiungilo anche ai
  gruppi.
- **Sorgente unica delle sotto-voci**: un solo array condiviso dai due rami.
- **Evidenziazione**: usa `isActive={pathname === url}` (voci e sotto-voci),
  così l'utente vede sempre dove si trova.
- **Auto-apertura**: `defaultOpen={hasActiveChild}` apre il gruppo solo quando
  contiene la pagina corrente; altrimenti parte chiuso.
- **Navigazione**: sempre con `<Link>` di Next (anche dentro `DropdownMenuItem`,
  via `asChild`), mai `<a>` grezzi, per la navigazione client.
- **Rotte distinte**: dai a ogni sotto-voce una rotta propria. Se due voci
  puntano alla stessa URL risulteranno entrambe attive insieme.

## Riferimenti

- Implementazione live: `NavExample` in
  [components/app-sidebar.tsx](../components/app-sidebar.tsx) (voce dimostrativa,
  rimuovibile).
- Documentazione shadcn: componente
  [Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar).
