// @ts-nocheck
import { Router } from "express";

const router = Router();

const banksByCountry: Record<string, Array<{ name: string; code: string; logo: string }>> = {
  US: [
    { name: "Chase Bank", code: "chase", logo: "https://logo.clearbit.com/chase.com" },
    { name: "Bank of America", code: "bofa", logo: "https://logo.clearbit.com/bankofamerica.com" },
    { name: "Wells Fargo", code: "wells", logo: "https://logo.clearbit.com/wellsfargo.com" },
    { name: "Citibank", code: "citi", logo: "https://logo.clearbit.com/citibank.com" },
    { name: "US Bank", code: "usbank", logo: "https://logo.clearbit.com/usbank.com" },
  ],
  GB: [
    { name: "Barclays", code: "barclays", logo: "https://logo.clearbit.com/barclays.com" },
    { name: "HSBC", code: "hsbc", logo: "https://logo.clearbit.com/hsbc.com" },
    { name: "Lloyds Bank", code: "lloyds", logo: "https://logo.clearbit.com/lloyds.com" },
    { name: "NatWest", code: "natwest", logo: "https://logo.clearbit.com/natwest.com" },
    { name: "Santander", code: "santander", logo: "https://logo.clearbit.com/santander.com" },
  ],
  CA: [
    { name: "TD Bank", code: "td", logo: "https://logo.clearbit.com/td.com" },
    { name: "RBC", code: "rbc", logo: "https://logo.clearbit.com/rbc.com" },
    { name: "Scotiabank", code: "scotia", logo: "https://logo.clearbit.com/scotiabank.com" },
    { name: "BMO", code: "bmo", logo: "https://logo.clearbit.com/bmo.com" },
    { name: "CIBC", code: "cibc", logo: "https://logo.clearbit.com/cibc.com" },
  ],
  AU: [
    { name: "Commonwealth Bank", code: "cba", logo: "https://logo.clearbit.com/commbank.com.au" },
    { name: "Westpac", code: "westpac", logo: "https://logo.clearbit.com/westpac.com.au" },
    { name: "ANZ", code: "anz", logo: "https://logo.clearbit.com/anz.com" },
    { name: "NAB", code: "nab", logo: "https://logo.clearbit.com/nab.com.au" },
  ],
  NG: [
    { name: "First Bank Nigeria", code: "firstbank", logo: "https://logo.clearbit.com/firstbanknigeria.com" },
    { name: "Guaranty Trust Bank", code: "gtb", logo: "https://logo.clearbit.com/gtbank.com" },
    { name: "Zenith Bank", code: "zenith", logo: "https://logo.clearbit.com/zenithbank.com" },
    { name: "Access Bank", code: "access", logo: "https://logo.clearbit.com/accessbankplc.com" },
    { name: "UBA", code: "uba", logo: "https://logo.clearbit.com/ubagroup.com" },
  ],
  GH: [
    { name: "GCB Bank", code: "gcb", logo: "https://logo.clearbit.com/gcbbank.com.gh" },
    { name: "Ecobank Ghana", code: "ecobank", logo: "https://logo.clearbit.com/ecobank.com" },
    { name: "Absa Bank Ghana", code: "absa", logo: "https://logo.clearbit.com/absa.africa" },
    { name: "Standard Chartered Ghana", code: "sc", logo: "https://logo.clearbit.com/sc.com" },
  ],
  DE: [
    { name: "Deutsche Bank", code: "deutsche", logo: "https://logo.clearbit.com/deutsche-bank.de" },
    { name: "Commerzbank", code: "commerzbank", logo: "https://logo.clearbit.com/commerzbank.com" },
    { name: "DKB", code: "dkb", logo: "https://logo.clearbit.com/dkb.de" },
    { name: "N26", code: "n26", logo: "https://logo.clearbit.com/n26.com" },
  ],
  FR: [
    { name: "BNP Paribas", code: "bnp", logo: "https://logo.clearbit.com/bnpparibas.com" },
    { name: "Societe Generale", code: "sg", logo: "https://logo.clearbit.com/societegenerale.com" },
    { name: "Credit Agricole", code: "ca", logo: "https://logo.clearbit.com/credit-agricole.com" },
    { name: "LCL", code: "lcl", logo: "https://logo.clearbit.com/lcl.fr" },
  ],
  IN: [
    { name: "State Bank of India", code: "sbi", logo: "https://logo.clearbit.com/sbi.co.in" },
    { name: "HDFC Bank", code: "hdfc", logo: "https://logo.clearbit.com/hdfcbank.com" },
    { name: "ICICI Bank", code: "icici", logo: "https://logo.clearbit.com/icicibank.com" },
    { name: "Axis Bank", code: "axis", logo: "https://logo.clearbit.com/axisbank.com" },
  ],
  ZA: [
    { name: "Standard Bank", code: "standard", logo: "https://logo.clearbit.com/standardbank.co.za" },
    { name: "FNB", code: "fnb", logo: "https://logo.clearbit.com/fnb.co.za" },
    { name: "Nedbank", code: "nedbank", logo: "https://logo.clearbit.com/nedbank.co.za" },
    { name: "Absa", code: "absa", logo: "https://logo.clearbit.com/absa.co.za" },
  ],
};

const defaultBanks = [
  { name: "Chase Bank", code: "chase", logo: "https://logo.clearbit.com/chase.com" },
  { name: "Bank of America", code: "bofa", logo: "https://logo.clearbit.com/bankofamerica.com" },
  { name: "Citibank", code: "citi", logo: "https://logo.clearbit.com/citibank.com" },
  { name: "HSBC", code: "hsbc", logo: "https://logo.clearbit.com/hsbc.com" },
  { name: "Barclays", code: "barclays", logo: "https://logo.clearbit.com/barclays.com" },
];

router.get("/withdraw-methods", async (req, res) => {
  try {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress || "unknown";

    let countryCode = "US";
    let country = "United States";

    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode`);
      if (geoRes.ok) {
        const geo = await geoRes.json() as { country?: string; countryCode?: string };
        if (geo.countryCode) { countryCode = geo.countryCode; country = geo.country || country; }
      }
    } catch {}

    type Method = { id: string; name: string; fields: Array<{ key: string; label: string; placeholder: string }> };
    const baseDigital: Method[] = [
      { id: "cashapp", name: "Cash App", fields: [{ key: "cashappId", label: "Cash App $Cashtag", placeholder: "$username" }] },
      { id: "paypal", name: "PayPal", fields: [{ key: "paypalEmail", label: "PayPal Email", placeholder: "paypal@example.com" }] },
      { id: "revolut", name: "Revolut", fields: [{ key: "revolutTag", label: "Revolut @Tag", placeholder: "@username" }] },
    ];
    const wireMethod: Method = {
      id: "wire", name: "Wire Transfer",
      fields: [
        { key: "bankName", label: "Bank Name", placeholder: "e.g. Chase Bank" },
        { key: "accountNumber", label: "Account Number", placeholder: "Account number" },
        { key: "routingNumber", label: "Routing/Sort Code", placeholder: "Routing number" },
      ],
    };
    const methods: Method[] = [...baseDigital, wireMethod];
    res.json({ country, methods });
  } catch {
    res.json({ country: "United States", methods: [
      { id: "cashapp", name: "Cash App", fields: [{ key: "cashappId", label: "Cash App $Cashtag", placeholder: "$username" }] },
      { id: "paypal", name: "PayPal", fields: [{ key: "paypalEmail", label: "PayPal Email", placeholder: "paypal@example.com" }] },
      { id: "wire", name: "Wire Transfer", fields: [{ key: "bankName", label: "Bank Name", placeholder: "Chase Bank" }, { key: "accountNumber", label: "Account Number", placeholder: "••••0000" }] },
    ]});
  }
});

router.get("/", async (req, res) => {
  try {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress || "unknown";

    let countryCode = "US";
    let country = "United States";
    let region = "";
    let city = "";

    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode,regionName,city`);
      if (geoRes.ok) {
        const geo = await geoRes.json() as { country?: string; countryCode?: string; regionName?: string; city?: string };
        if (geo.countryCode) {
          countryCode = geo.countryCode;
          country = geo.country || country;
          region = geo.regionName || "";
          city = geo.city || "";
        }
      }
    } catch {
      // fallback to US
    }

    const banks = banksByCountry[countryCode] || defaultBanks;

    res.json({ country, countryCode, region, city, banks });
  } catch (e) {
    res.json({ country: "United States", countryCode: "US", region: "", city: "", banks: defaultBanks });
  }
});

export default router;
