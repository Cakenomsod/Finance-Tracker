'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  COUNTRY_TAX_CONFIGS,
  suggestExchangeRate,
  type TripCountryCode,
  type TripCurrencyCode,
} from '@/lib/tax/countries'
import { useLocale } from '@/components/locale-provider'

export interface TripSettingsValue {
  countryCode: TripCountryCode
  tripCurrency: TripCurrencyCode
  homeCurrency: TripCurrencyCode
  exchangeRate: string
}

export const defaultTripSettings = (): TripSettingsValue => ({
  countryCode: 'TH',
  tripCurrency: 'THB',
  homeCurrency: 'THB',
  exchangeRate: '1',
})

export function tripSettingsToFirestore(value: TripSettingsValue) {
  const rate = parseFloat(value.exchangeRate) || 1
  return {
    countryCode: value.countryCode,
    tripCurrency: value.tripCurrency,
    homeCurrency: value.homeCurrency,
    exchangeRate: value.tripCurrency === value.homeCurrency ? 1 : rate,
  }
}

export function tripSettingsFromTrip(trip?: {
  countryCode?: TripCountryCode
  tripCurrency?: TripCurrencyCode
  homeCurrency?: TripCurrencyCode
  exchangeRate?: number
} | null): TripSettingsValue {
  const countryCode = trip?.countryCode || 'TH'
  const tripCurrency = trip?.tripCurrency || COUNTRY_TAX_CONFIGS[countryCode].defaultCurrency
  const homeCurrency = trip?.homeCurrency || 'THB'
  const rate =
    trip?.exchangeRate ??
    suggestExchangeRate(tripCurrency, homeCurrency)

  return {
    countryCode,
    tripCurrency,
    homeCurrency,
    exchangeRate: String(rate),
  }
}

interface TripSettingsFieldsProps {
  value: TripSettingsValue
  onChange: (value: TripSettingsValue) => void
}

const COUNTRY_NAME_ZH: Record<TripCountryCode, string> = {
  TH: '泰国',
  JP: '日本',
}

export function TripSettingsFields({ value, onChange }: TripSettingsFieldsProps) {
  const { p, locale } = useLocale()
  const countryName = (code: TripCountryCode) => {
    const config = COUNTRY_TAX_CONFIGS[code]
    if (locale === 'th') return `${config.nameTh} (${config.name})`
    if (locale === 'zh') return `${COUNTRY_NAME_ZH[code] ?? config.name} (${config.name})`
    return config.name
  }
  const currencyLabel = (code: TripCurrencyCode) =>
    code === 'JPY'
      ? `¥ ${p({ th: 'เยน', en: 'Yen', zh: '日元' })} (JPY)`
      : `฿ ${p({ th: 'บาท', en: 'Baht', zh: '泰铢' })} (THB)`
  const needsRate = value.tripCurrency !== value.homeCurrency

  const patch = (partial: Partial<TripSettingsValue>) => {
    const next = { ...value, ...partial }

    if (partial.countryCode) {
      const config = COUNTRY_TAX_CONFIGS[partial.countryCode]
      next.tripCurrency = config.defaultCurrency
      next.exchangeRate = String(
        suggestExchangeRate(next.tripCurrency, next.homeCurrency)
      )
    }

    if (partial.tripCurrency || partial.homeCurrency) {
      const tripCur = partial.tripCurrency ?? next.tripCurrency
      const homeCur = partial.homeCurrency ?? next.homeCurrency
      if (tripCur === homeCur) {
        next.exchangeRate = '1'
      } else if (
        partial.tripCurrency ||
        partial.homeCurrency ||
        partial.countryCode
      ) {
        next.exchangeRate = String(suggestExchangeRate(tripCur, homeCur))
      }
    }

    onChange(next)
  }

  return (
    <fieldset className="space-y-4 border-t border-border/80 pt-4">
      <legend className="text-sm font-medium">
        {p({ th: 'ประเทศและสกุลเงิน', en: 'Country & currency', zh: '国家和货币' })}
      </legend>
      <p className="text-xs text-muted-foreground">
        {p({
          th: 'ตั้งค่าประเทศและสกุลเงินสำหรับทริปนี้ ใช้คำนวณภาษีในใบเสร็จและยอดรวม',
          en: 'Country and currency for this trip — used for receipt tax and totals',
          zh: '此行程的国家和货币——用于计算收据税费和总额',
        })}
      </p>

      <div className="grid gap-2">
        <Label>{p({ th: 'ประเทศ (ภาษีในใบเสร็จ)', en: 'Country (receipt tax)', zh: '国家（收据税费）' })}</Label>
        <Select
          value={value.countryCode}
          onValueChange={(v) => patch({ countryCode: v as TripCountryCode })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(COUNTRY_TAX_CONFIGS) as TripCountryCode[]).map((code) => (
              <SelectItem key={code} value={code}>
                {countryName(code)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {value.countryCode === 'JP'
            ? p({
                th: 'ญี่ปุ่น: ภาษี 8% (อาหาร) / 10% (สินค้า) — ราคาบนใบเสร็จมักรวมภาษีแล้ว',
                en: 'Japan: 8% tax (food) / 10% (goods) — receipt prices usually include tax',
                zh: '日本：税率 8%（食品）/ 10%（商品）——收据价格通常已含税',
              })
            : p({
                th: 'ไทย: VAT 7% — ราคามักยังไม่รวมภาษี',
                en: 'Thailand: 7% VAT — prices usually exclude tax',
                zh: '泰国：增值税 7%——价格通常不含税',
              })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{p({ th: 'สกุลเงินของทริป', en: 'Trip currency', zh: '行程货币' })}</Label>
          <Select
            value={value.tripCurrency}
            onValueChange={(v) => patch({ tripCurrency: v as TripCurrencyCode })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="THB">{currencyLabel('THB')}</SelectItem>
              <SelectItem value="JPY">{currencyLabel('JPY')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{p({ th: 'สกุลเงินที่ใช้แสดงผล', en: 'Home display currency', zh: '显示货币' })}</Label>
          <Select
            value={value.homeCurrency}
            onValueChange={(v) => patch({ homeCurrency: v as TripCurrencyCode })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="THB">{currencyLabel('THB')}</SelectItem>
              <SelectItem value="JPY">{currencyLabel('JPY')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {needsRate && (
        <div className="grid gap-2">
          <Label>
            {p({ th: 'อัตราแลกเปลี่ยน', en: 'Exchange rate', zh: '汇率' })} (1 {value.tripCurrency} = ?{' '}
            {value.homeCurrency})
          </Label>
          <Input
            type="number"
            step="0.0001"
            min="0"
            value={value.exchangeRate}
            onChange={(e) => onChange({ ...value, exchangeRate: e.target.value })}
            placeholder={value.countryCode === 'JP' ? '0.22' : '1'}
          />
          <p className="text-xs text-muted-foreground">
            {p({
              th: `แปลงยอดรวมและยอดเคลียร์เงินเป็น ${value.homeCurrency}`,
              en: `Converts totals and settlements to ${value.homeCurrency}`,
              zh: `将总额和结算金额换算为 ${value.homeCurrency}`,
            })}
          </p>
        </div>
      )}
    </fieldset>
  )
}
