import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  CreditCard,
  Droplet,
  Flame,
  House,
  Moon,
  Receipt,
  Smartphone,
  Sun,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { PaymentKind } from '../lib/store'
import { wxInfo } from '../lib/weather'

export function WxIcon({ code, isDay, size = 22 }: { code: number; isDay: boolean; size?: number }) {
  const kind = wxInfo(code).kind
  let Icon: LucideIcon = Cloud
  if (kind === 'clear') Icon = isDay ? Sun : Moon
  else if (kind === 'partly') Icon = isDay ? CloudSun : CloudMoon
  else if (kind === 'fog') Icon = CloudFog
  else if (kind === 'drizzle') Icon = CloudDrizzle
  else if (kind === 'rain') Icon = CloudRain
  else if (kind === 'snow') Icon = CloudSnow
  else if (kind === 'storm') Icon = CloudLightning
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />
}

export const PAY_KINDS: { value: PaymentKind; label: string; icon: LucideIcon }[] = [
  { value: 'elektrik', label: 'Elektrik', icon: Zap },
  { value: 'su', label: 'Su', icon: Droplet },
  { value: 'dogalgaz', label: 'Doğalgaz', icon: Flame },
  { value: 'internet', label: 'İnternet', icon: Wifi },
  { value: 'telefon', label: 'Telefon', icon: Smartphone },
  { value: 'kira', label: 'Kira', icon: House },
  { value: 'kredi', label: 'Kredi / Kart', icon: CreditCard },
  { value: 'diger', label: 'Diğer', icon: Receipt },
]

export function PayIcon({ kind, size = 20 }: { kind: PaymentKind; size?: number }) {
  const Icon = PAY_KINDS.find((k) => k.value === kind)?.icon ?? Receipt
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />
}
