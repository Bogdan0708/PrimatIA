import type { Locale } from "@/lib/constants";
import type { NotificationEvent } from "../index";

interface NotificationTemplate {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  color: #333;
`;

const headerStyle = `
  background-color: #1e40af;
  color: white;
  padding: 20px;
  text-align: center;
  border-radius: 8px 8px 0 0;
`;

const bodyStyle = `
  background-color: #f9fafb;
  padding: 24px;
  border: 1px solid #e5e7eb;
`;

const footerStyle = `
  background-color: #f3f4f6;
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: #6b7280;
  border-radius: 0 0 8px 8px;
`;

function wrap(header: string, body: string, footer: string): string {
  return `
    <div style="${baseStyle}">
      <div style="${headerStyle}">
        <h2 style="margin:0;">${header}</h2>
      </div>
      <div style="${bodyStyle}">
        ${body}
      </div>
      <div style="${footerStyle}">
        ${footer}
      </div>
    </div>
  `;
}

const templates: Record<NotificationEvent, Record<Locale, NotificationTemplate>> = {
  payment_reminder_before: {
    ro: {
      subject: "Reamintire: termen de plată impozite - {{deadline}}",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Stimate/Stimată <strong>{{name}}</strong>,</p>
         <p>Vă reamintim că termenul de plată pentru impozitele și taxele locale este <strong>{{deadline}}</strong>.</p>
         <p>Suma totală de plată: <strong>{{amount}} lei</strong></p>
         <p>Puteți efectua plata online accesând <a href="{{portalUrl}}">portalul cetățean</a>.</p>
         <p>Cu stimă,<br>{{tenantName}}</p>`,
        "Acest email a fost trimis automat. Nu răspundeți la acest mesaj."
      ),
      bodyText: "Stimate/Stimată {{name}}, termenul de plată pentru impozite este {{deadline}}. Suma: {{amount}} lei. Plătiți online la {{portalUrl}}.",
    },
    en: {
      subject: "Reminder: tax payment deadline - {{deadline}}",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Dear <strong>{{name}}</strong>,</p>
         <p>This is a reminder that the deadline for local tax payments is <strong>{{deadline}}</strong>.</p>
         <p>Total amount due: <strong>{{amount}} lei</strong></p>
         <p>You can pay online via the <a href="{{portalUrl}}">citizen portal</a>.</p>
         <p>Best regards,<br>{{tenantName}}</p>`,
        "This email was sent automatically. Please do not reply."
      ),
      bodyText: "Dear {{name}}, the tax payment deadline is {{deadline}}. Amount: {{amount}} lei. Pay online at {{portalUrl}}.",
    },
    hu: {
      subject: "Emlékeztető: adófizetési határidő - {{deadline}}",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Tisztelt <strong>{{name}}</strong>,</p>
         <p>Emlékeztetjük, hogy a helyi adók fizetési határideje <strong>{{deadline}}</strong>.</p>
         <p>Fizetendő összeg: <strong>{{amount}} lej</strong></p>
         <p>Online fizethet a <a href="{{portalUrl}}">polgári portálon</a>.</p>
         <p>Üdvözlettel,<br>{{tenantName}}</p>`,
        "Ez az e-mail automatikusan került elküldésre. Kérjük, ne válaszoljon."
      ),
      bodyText: "Tisztelt {{name}}, az adófizetési határidő: {{deadline}}. Összeg: {{amount}} lej. Fizessen online: {{portalUrl}}.",
    },
  },

  payment_reminder_due: {
    ro: {
      subject: "ASTĂZI: termen de plată impozite locale",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Stimate/Stimată <strong>{{name}}</strong>,</p>
         <p><strong>Astăzi, {{deadline}}</strong>, este termenul de plată pentru impozitele și taxele locale.</p>
         <p>Suma totală de plată: <strong>{{amount}} lei</strong></p>
         <p>Evitați penalitățile efectuând plata astăzi: <a href="{{portalUrl}}">portalul cetățean</a>.</p>
         <p>Cu stimă,<br>{{tenantName}}</p>`,
        "Acest email a fost trimis automat. Nu răspundeți la acest mesaj."
      ),
      bodyText: "Stimate/Stimată {{name}}, ASTĂZI {{deadline}} este termenul de plată. Suma: {{amount}} lei. Plătiți online la {{portalUrl}}.",
    },
    en: {
      subject: "TODAY: local tax payment deadline",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Dear <strong>{{name}}</strong>,</p>
         <p><strong>Today, {{deadline}}</strong>, is the deadline for local tax payments.</p>
         <p>Total amount due: <strong>{{amount}} lei</strong></p>
         <p>Avoid penalties by paying today: <a href="{{portalUrl}}">citizen portal</a>.</p>
         <p>Best regards,<br>{{tenantName}}</p>`,
        "This email was sent automatically. Please do not reply."
      ),
      bodyText: "Dear {{name}}, TODAY {{deadline}} is the payment deadline. Amount: {{amount}} lei. Pay online at {{portalUrl}}.",
    },
    hu: {
      subject: "MA: helyi adó fizetési határidő",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Tisztelt <strong>{{name}}</strong>,</p>
         <p><strong>Ma, {{deadline}}</strong>, a helyi adók fizetési határideje.</p>
         <p>Fizetendő összeg: <strong>{{amount}} lej</strong></p>
         <p>Kerülje a büntetéseket, fizessen ma: <a href="{{portalUrl}}">polgári portál</a>.</p>
         <p>Üdvözlettel,<br>{{tenantName}}</p>`,
        "Ez az e-mail automatikusan került elküldésre. Kérjük, ne válaszoljon."
      ),
      bodyText: "Tisztelt {{name}}, MA {{deadline}} a fizetési határidő. Összeg: {{amount}} lej. Fizessen online: {{portalUrl}}.",
    },
  },

  payment_reminder_after: {
    ro: {
      subject: "URGENT: restanțe la plata impozitelor locale",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Stimate/Stimată <strong>{{name}}</strong>,</p>
         <p>Termenul de plată pentru impozitele locale a fost depășit. Vă rugăm să efectuați plata cât mai curând.</p>
         <p>Suma restantă: <strong>{{amount}} lei</strong></p>
         <p><strong>Atenție:</strong> Se calculează penalități de întârziere conform Codului de Procedură Fiscală.</p>
         <p>Efectuați plata online: <a href="{{portalUrl}}">portalul cetățean</a>.</p>
         <p>Cu stimă,<br>{{tenantName}}</p>`,
        "Acest email a fost trimis automat. Nu răspundeți la acest mesaj."
      ),
      bodyText: "Stimate/Stimată {{name}}, aveți restanțe la impozite: {{amount}} lei. Se calculează penalități. Plătiți la {{portalUrl}}.",
    },
    en: {
      subject: "URGENT: overdue local tax payment",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Dear <strong>{{name}}</strong>,</p>
         <p>The payment deadline for local taxes has passed. Please make your payment as soon as possible.</p>
         <p>Outstanding amount: <strong>{{amount}} lei</strong></p>
         <p><strong>Warning:</strong> Late penalties are accruing per the Fiscal Procedure Code.</p>
         <p>Pay online: <a href="{{portalUrl}}">citizen portal</a>.</p>
         <p>Best regards,<br>{{tenantName}}</p>`,
        "This email was sent automatically. Please do not reply."
      ),
      bodyText: "Dear {{name}}, you have overdue taxes: {{amount}} lei. Penalties are accruing. Pay at {{portalUrl}}.",
    },
    hu: {
      subject: "SÜRGŐS: helyi adó késedelmes fizetése",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Tisztelt <strong>{{name}}</strong>,</p>
         <p>A helyi adók fizetési határideje lejárt. Kérjük, mielőbb fizesse ki a tartozást.</p>
         <p>Fennálló összeg: <strong>{{amount}} lej</strong></p>
         <p><strong>Figyelem:</strong> Késedelmi pótlék kerül felszámításra az Adóeljárási törvény alapján.</p>
         <p>Fizessen online: <a href="{{portalUrl}}">polgári portál</a>.</p>
         <p>Üdvözlettel,<br>{{tenantName}}</p>`,
        "Ez az e-mail automatikusan került elküldésre. Kérjük, ne válaszoljon."
      ),
      bodyText: "Tisztelt {{name}}, adóhátraléka van: {{amount}} lej. Késedelmi pótlék kerül felszámításra. Fizessen: {{portalUrl}}.",
    },
  },

  somatie_generated: {
    ro: {
      subject: "Somație de plată - Nr. {{somatieNr}}",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Stimate/Stimată <strong>{{name}}</strong>,</p>
         <p>A fost emisă o somație de plată (Nr. <strong>{{somatieNr}}</strong>) pentru restanțele dumneavoastră.</p>
         <p>Suma totală: <strong>{{amount}} lei</strong></p>
         <p>Termen de plată: <strong>{{deadline}}</strong></p>
         <p>Puteți vizualiza documentul în <a href="{{portalUrl}}">portalul cetățean</a>.</p>
         <p>Cu stimă,<br>{{tenantName}}</p>`,
        "Acest email a fost trimis automat. Nu răspundeți la acest mesaj."
      ),
      bodyText: "Stimate/Stimată {{name}}, a fost emisă somația nr. {{somatieNr}}. Suma: {{amount}} lei. Termen: {{deadline}}.",
    },
    en: {
      subject: "Payment Notice - No. {{somatieNr}}",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Dear <strong>{{name}}</strong>,</p>
         <p>A payment notice (No. <strong>{{somatieNr}}</strong>) has been issued for your outstanding debts.</p>
         <p>Total amount: <strong>{{amount}} lei</strong></p>
         <p>Payment deadline: <strong>{{deadline}}</strong></p>
         <p>View the document in the <a href="{{portalUrl}}">citizen portal</a>.</p>
         <p>Best regards,<br>{{tenantName}}</p>`,
        "This email was sent automatically. Please do not reply."
      ),
      bodyText: "Dear {{name}}, payment notice no. {{somatieNr}} issued. Amount: {{amount}} lei. Deadline: {{deadline}}.",
    },
    hu: {
      subject: "Fizetési felszólítás - Sz. {{somatieNr}}",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Tisztelt <strong>{{name}}</strong>,</p>
         <p>Fizetési felszólítás (Sz. <strong>{{somatieNr}}</strong>) került kibocsátásra a fennálló tartozásaiért.</p>
         <p>Teljes összeg: <strong>{{amount}} lej</strong></p>
         <p>Fizetési határidő: <strong>{{deadline}}</strong></p>
         <p>Tekintse meg a dokumentumot a <a href="{{portalUrl}}">polgári portálon</a>.</p>
         <p>Üdvözlettel,<br>{{tenantName}}</p>`,
        "Ez az e-mail automatikusan került elküldésre. Kérjük, ne válaszoljon."
      ),
      bodyText: "Tisztelt {{name}}, fizetési felszólítás sz. {{somatieNr}}. Összeg: {{amount}} lej. Határidő: {{deadline}}.",
    },
  },

  decizie_ready: {
    ro: {
      subject: "Decizia de impunere este disponibilă",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Stimate/Stimată <strong>{{name}}</strong>,</p>
         <p>Decizia de impunere pentru anul fiscal <strong>{{fiscalYear}}</strong> este disponibilă pentru vizualizare și descărcare.</p>
         <p>Accesați <a href="{{portalUrl}}">portalul cetățean</a> pentru a vizualiza decizia.</p>
         <p>Cu stimă,<br>{{tenantName}}</p>`,
        "Acest email a fost trimis automat. Nu răspundeți la acest mesaj."
      ),
      bodyText: "Stimate/Stimată {{name}}, decizia de impunere pentru {{fiscalYear}} este disponibilă. Vizualizați la {{portalUrl}}.",
    },
    en: {
      subject: "Tax assessment decision is available",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Dear <strong>{{name}}</strong>,</p>
         <p>The tax assessment decision for fiscal year <strong>{{fiscalYear}}</strong> is available for viewing and download.</p>
         <p>Visit the <a href="{{portalUrl}}">citizen portal</a> to view the decision.</p>
         <p>Best regards,<br>{{tenantName}}</p>`,
        "This email was sent automatically. Please do not reply."
      ),
      bodyText: "Dear {{name}}, the tax assessment for {{fiscalYear}} is available. View at {{portalUrl}}.",
    },
    hu: {
      subject: "Az adómegállapítási határozat elérhető",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Tisztelt <strong>{{name}}</strong>,</p>
         <p>A(z) <strong>{{fiscalYear}}</strong> adóévre vonatkozó adómegállapítási határozat megtekinthető és letölthető.</p>
         <p>Látogasson el a <a href="{{portalUrl}}">polgári portálra</a> a határozat megtekintéséhez.</p>
         <p>Üdvözlettel,<br>{{tenantName}}</p>`,
        "Ez az e-mail automatikusan került elküldésre. Kérjük, ne válaszoljon."
      ),
      bodyText: "Tisztelt {{name}}, a(z) {{fiscalYear}} évi adómegállapítás elérhető. Megtekintés: {{portalUrl}}.",
    },
  },

  certificat_ready: {
    ro: {
      subject: "Certificatul fiscal este gata",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Stimate/Stimată <strong>{{name}}</strong>,</p>
         <p>Certificatul fiscal solicitat a fost generat și este disponibil pentru descărcare.</p>
         <p>Accesați <a href="{{portalUrl}}">portalul cetățean</a> pentru a descărca certificatul.</p>
         <p>Cu stimă,<br>{{tenantName}}</p>`,
        "Acest email a fost trimis automat. Nu răspundeți la acest mesaj."
      ),
      bodyText: "Stimate/Stimată {{name}}, certificatul fiscal este gata. Descărcați de la {{portalUrl}}.",
    },
    en: {
      subject: "Fiscal certificate is ready",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Dear <strong>{{name}}</strong>,</p>
         <p>Your requested fiscal certificate has been generated and is available for download.</p>
         <p>Visit the <a href="{{portalUrl}}">citizen portal</a> to download your certificate.</p>
         <p>Best regards,<br>{{tenantName}}</p>`,
        "This email was sent automatically. Please do not reply."
      ),
      bodyText: "Dear {{name}}, your fiscal certificate is ready. Download at {{portalUrl}}.",
    },
    hu: {
      subject: "Az adóigazolás elkészült",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Tisztelt <strong>{{name}}</strong>,</p>
         <p>Az igényelt adóigazolás elkészült és letölthető.</p>
         <p>Látogasson el a <a href="{{portalUrl}}">polgári portálra</a> az igazolás letöltéséhez.</p>
         <p>Üdvözlettel,<br>{{tenantName}}</p>`,
        "Ez az e-mail automatikusan került elküldésre. Kérjük, ne válaszoljon."
      ),
      bodyText: "Tisztelt {{name}}, az adóigazolás elkészült. Letöltés: {{portalUrl}}.",
    },
  },

  account_verification: {
    ro: {
      subject: "Verificare cont — PrimărIA Portal Cetățean",
      bodyHtml: wrap(
        "{{tenantName}} — Portal Cetățean",
        `<p>Bună ziua, <strong>{{name}}</strong>,</p>
         <p>Contul dumneavoastră a fost creat cu succes. Pentru a-l activa, vă rugăm să confirmați adresa de email:</p>
         <p style="text-align:center; margin: 24px 0;">
           <a href="{{verifyUrl}}" style="background-color:#1e40af; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">Verifică adresa de email</a>
         </p>
         <p>Dacă nu ați solicitat crearea acestui cont, ignorați acest mesaj.</p>
         <p>Link-ul este valabil 24 de ore.</p>
         <p>Cu stimă,<br>{{tenantName}}</p>`,
        "Acest email a fost trimis automat. Nu răspundeți la acest mesaj."
      ),
      bodyText: "Bună ziua {{name}}, verificați contul accesând: {{verifyUrl}}. Valabil 24 ore.",
    },
    en: {
      subject: "Account Verification — PrimărIA Citizen Portal",
      bodyHtml: wrap(
        "{{tenantName}} — Citizen Portal",
        `<p>Hello, <strong>{{name}}</strong>,</p>
         <p>Your account has been created successfully. Please verify your email address to activate it:</p>
         <p style="text-align:center; margin: 24px 0;">
           <a href="{{verifyUrl}}" style="background-color:#1e40af; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">Verify Email Address</a>
         </p>
         <p>If you did not request this account, please ignore this email.</p>
         <p>This link is valid for 24 hours.</p>
         <p>Best regards,<br>{{tenantName}}</p>`,
        "This email was sent automatically. Please do not reply."
      ),
      bodyText: "Hello {{name}}, verify your account at: {{verifyUrl}}. Valid for 24 hours.",
    },
    hu: {
      subject: "Fiók hitelesítés — PrimărIA Polgári Portál",
      bodyHtml: wrap(
        "{{tenantName}} — Polgári Portál",
        `<p>Üdvözöljük, <strong>{{name}}</strong>,</p>
         <p>Fiókja sikeresen létrejött. Az aktiváláshoz kérjük, erősítse meg e-mail címét:</p>
         <p style="text-align:center; margin: 24px 0;">
           <a href="{{verifyUrl}}" style="background-color:#1e40af; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">E-mail cím megerősítése</a>
         </p>
         <p>Ha nem Ön kérte ezt a fiókot, hagyja figyelmen kívül ezt az üzenetet.</p>
         <p>A hivatkozás 24 órán át érvényes.</p>
         <p>Üdvözlettel,<br>{{tenantName}}</p>`,
        "Ez az e-mail automatikusan került elküldésre. Kérjük, ne válaszoljon."
      ),
      bodyText: "Üdvözöljük {{name}}, erősítse meg fiókját: {{verifyUrl}}. 24 órán át érvényes.",
    },
  },

  payment_confirmation: {
    ro: {
      subject: "Confirmare plată — {{amount}} lei",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Stimate/Stimată <strong>{{name}}</strong>,</p>
         <p>Plata dumneavoastră a fost înregistrată cu succes.</p>
         <p>Detalii:</p>
         <ul>
           <li>Sumă: <strong>{{amount}} lei</strong></li>
           <li>Data: <strong>{{paymentDate}}</strong></li>
           <li>Referință: <strong>{{reference}}</strong></li>
         </ul>
         <p>Puteți vizualiza chitanța în <a href="{{portalUrl}}">portalul cetățean</a>.</p>
         <p>Cu stimă,<br>{{tenantName}}</p>`,
        "Acest email a fost trimis automat. Nu răspundeți la acest mesaj."
      ),
      bodyText: "Stimate/Stimată {{name}}, plata de {{amount}} lei din {{paymentDate}} a fost înregistrată. Ref: {{reference}}.",
    },
    en: {
      subject: "Payment Confirmation — {{amount}} lei",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Dear <strong>{{name}}</strong>,</p>
         <p>Your payment has been recorded successfully.</p>
         <p>Details:</p>
         <ul>
           <li>Amount: <strong>{{amount}} lei</strong></li>
           <li>Date: <strong>{{paymentDate}}</strong></li>
           <li>Reference: <strong>{{reference}}</strong></li>
         </ul>
         <p>You can view your receipt in the <a href="{{portalUrl}}">citizen portal</a>.</p>
         <p>Best regards,<br>{{tenantName}}</p>`,
        "This email was sent automatically. Please do not reply."
      ),
      bodyText: "Dear {{name}}, your payment of {{amount}} lei on {{paymentDate}} has been recorded. Ref: {{reference}}.",
    },
    hu: {
      subject: "Fizetési visszaigazolás — {{amount}} lej",
      bodyHtml: wrap(
        "{{tenantName}}",
        `<p>Tisztelt <strong>{{name}}</strong>,</p>
         <p>Fizetése sikeresen rögzítésre került.</p>
         <p>Részletek:</p>
         <ul>
           <li>Összeg: <strong>{{amount}} lej</strong></li>
           <li>Dátum: <strong>{{paymentDate}}</strong></li>
           <li>Hivatkozás: <strong>{{reference}}</strong></li>
         </ul>
         <p>A nyugtát megtekintheti a <a href="{{portalUrl}}">polgári portálon</a>.</p>
         <p>Üdvözlettel,<br>{{tenantName}}</p>`,
        "Ez az e-mail automatikusan került elküldésre. Kérjük, ne válaszoljon."
      ),
      bodyText: "Tisztelt {{name}}, fizetése ({{amount}} lej, {{paymentDate}}) rögzítésre került. Ref: {{reference}}.",
    },
  },
};

export function getTemplate(event: NotificationEvent, limba: Locale): NotificationTemplate {
  return templates[event][limba] || templates[event].ro;
}
