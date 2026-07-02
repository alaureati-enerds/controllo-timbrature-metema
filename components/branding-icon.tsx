import {
  AnchorIcon,
  ApertureIcon,
  AtomIcon,
  BoxIcon,
  BoxesIcon,
  CloudIcon,
  CommandIcon,
  CompassIcon,
  CpuIcon,
  DatabaseIcon,
  FeatherIcon,
  FlameIcon,
  GemIcon,
  GlobeIcon,
  HeartIcon,
  HexagonIcon,
  LayersIcon,
  LayoutDashboardIcon,
  PuzzleIcon,
  RocketIcon,
  ShieldIcon,
  SparklesIcon,
  StarIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"

import type { BrandingIconName } from "@/lib/settings/icons"

// Mappa nome -> componente icona. Il tipo `Record<BrandingIconName, ...>`
// garantisce a compile time che esista una coppia per ogni nome curato in
// lib/settings/icons.ts (e viceversa): niente icone "scelte ma non renderizzate".
export const BRANDING_ICONS: Record<BrandingIconName, LucideIcon> = {
  box: BoxIcon,
  boxes: BoxesIcon,
  "layout-dashboard": LayoutDashboardIcon,
  rocket: RocketIcon,
  zap: ZapIcon,
  star: StarIcon,
  heart: HeartIcon,
  globe: GlobeIcon,
  cloud: CloudIcon,
  command: CommandIcon,
  gem: GemIcon,
  hexagon: HexagonIcon,
  shield: ShieldIcon,
  flame: FlameIcon,
  sparkles: SparklesIcon,
  cpu: CpuIcon,
  database: DatabaseIcon,
  layers: LayersIcon,
  compass: CompassIcon,
  feather: FeatherIcon,
  anchor: AnchorIcon,
  atom: AtomIcon,
  aperture: ApertureIcon,
  puzzle: PuzzleIcon,
}

export function BrandingIcon({
  name,
  className,
}: {
  name: BrandingIconName
  className?: string
}) {
  const Icon = BRANDING_ICONS[name]
  return <Icon className={className} aria-hidden="true" />
}
