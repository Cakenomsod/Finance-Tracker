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

export function TripSettingsFields({ value, onChange }: TripSettingsFieldsProps) {
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
    <div className="space-y-4 rounded-lg border p-3 bg-muted/20">
      <p className="text-xs font-medium text-muted-foreground">ตั้งค่าประเทศ & สกุลเงิน</p>

      <div className="grid gap-2">
        <Label>ประเทศ (สำหรับคำนวณภาษีใบเสร็จ)</Label>
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
                {COUNTRY_TAX_CONFIGS[code].nameTh} ({COUNTRY_TAX_CONFIGS[code].name})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {value.countryCode === 'JP'
            ? 'ญี่ปุ่น: ภาษี 8% (อาหาร) / 10% (สินค้า) — ราคาบนใบเสร็จมักรวมภาษีแล้ว'
            : 'ไทย: VAT 7% — ราคามักยังไม่รวมภาษี'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>สกุลเงินทริป</Label>
          <Select
            value={value.tripCurrency}
            onValueChange={(v) => patch({ tripCurrency: v as TripCurrencyCode })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="THB">฿ บาท (THB)</SelectItem>
              <SelectItem value="JPY">¥ เยน (JPY)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>สกุลเงินแสดงผล (บ้าน)</Label>
          <Select
            value={value.homeCurrency}
            onValueChange={(v) => patch({ homeCurrency: v as TripCurrencyCode })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="THB">฿ บาท (THB)</SelectItem>
              <SelectItem value="JPY">¥ เยน (JPY)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {needsRate && (
        <div className="grid gap-2">
          <Label>
            อัตราแลกเปลี่ยน (1 {value.tripCurrency} = ? {value.homeCurrency})
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
            ใช้แปลงยอดรวมและการชำระเงินเป็นสกุล {value.homeCurrency}
          </p>
        </div>
      )}
    </div>
  )
}
