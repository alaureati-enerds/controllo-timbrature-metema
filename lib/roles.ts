// Utility pura per i ruoli, senza dipendenze: usabile sia lato client sia lato
// server. `user.role` può contenere più ruoli separati da virgola.
export function hasRole(
  role: string | null | undefined,
  target: string
): boolean {
  return (role ?? "")
    .split(",")
    .map((r) => r.trim())
    .includes(target)
}
