export interface ThaiBank {
  code: string;
  nameTh: string;
  nameEn: string;
  color: string;
}

/** Static catalog of major Thai banks for search / selection. */
export const THAI_BANKS: ThaiBank[] = [
  { code: 'KBANK', nameTh: 'ธนาคารกสิกรไทย', nameEn: 'Kasikornbank', color: '#138f2d' },
  { code: 'SCB', nameTh: 'ธนาคารไทยพาณิชย์', nameEn: 'Siam Commercial Bank', color: '#4e2a84' },
  { code: 'BBL', nameTh: 'ธนาคารกรุงเทพ', nameEn: 'Bangkok Bank', color: '#1e4598' },
  { code: 'KTB', nameTh: 'ธนาคารกรุงไทย', nameEn: 'Krungthai Bank', color: '#1ba5e0' },
  { code: 'BAY', nameTh: 'ธนาคารกรุงศรีอยุธยา', nameEn: 'Bank of Ayudhya (Krungsri)', color: '#fec43d' },
  { code: 'TTB', nameTh: 'ธนาคารทหารไทยธนชาต', nameEn: 'TMBThanachart Bank', color: '#1279be' },
  { code: 'GSB', nameTh: 'ธนาคารออมสิน', nameEn: 'Government Savings Bank', color: '#eb198d' },
  { code: 'GHB', nameTh: 'ธนาคารอาคารสงเคราะห์', nameEn: 'Government Housing Bank', color: '#f57b20' },
  { code: 'BAAC', nameTh: 'ธ.ก.ส.', nameEn: 'Bank for Agriculture and Agricultural Cooperatives', color: '#4b9b40' },
  { code: 'CIMB', nameTh: 'ธนาคารซีไอเอ็มบี ไทย', nameEn: 'CIMB Thai Bank', color: '#790008' },
  { code: 'UOB', nameTh: 'ธนาคารยูโอบี', nameEn: 'United Overseas Bank (Thai)', color: '#0b3979' },
  { code: 'TISCO', nameTh: 'ธนาคารทิสโก้', nameEn: 'TISCO Bank', color: '#125ba8' },
  { code: 'LHFG', nameTh: 'ธนาคารแลนด์ แอนด์ เฮ้าส์', nameEn: 'Land and Houses Bank', color: '#6d6e71' },
  { code: 'ICBC', nameTh: 'ธนาคารไอซีบีซี (ไทย)', nameEn: 'ICBC (Thai)', color: '#c8102e' },
  { code: 'KKP', nameTh: 'ธนาคารเกียรตินาคินภัทร', nameEn: 'Kiatnakin Phatra Bank', color: '#199a44' },
  { code: 'ISBT', nameTh: 'ธนาคารอิสลามแห่งประเทศไทย', nameEn: 'Islamic Bank of Thailand', color: '#006747' },
  { code: 'SME', nameTh: 'ธนาคารพัฒนาวิสาหกิจขนาดกลางและขนาดย่อม', nameEn: 'SME Development Bank', color: '#0054a6' },
  { code: 'EXIM', nameTh: 'ธนาคารเพื่อการส่งออกและนำเข้าแห่งประเทศไทย', nameEn: 'Export-Import Bank of Thailand', color: '#003da5' },
];

export function getBankByCode(code: string | undefined | null): ThaiBank | undefined {
  if (!code) return undefined;
  return THAI_BANKS.find((b) => b.code === code);
}

export function searchThaiBanks(query: string): ThaiBank[] {
  const q = query.trim().toLowerCase();
  if (!q) return THAI_BANKS;
  return THAI_BANKS.filter(
    (b) =>
      b.nameTh.toLowerCase().includes(q) ||
      b.nameEn.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q)
  );
}

export function formatAccountNumberDisplay(num: string | undefined | null): string | null {
  if (!num?.trim()) return null;
  const digits = num.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}
