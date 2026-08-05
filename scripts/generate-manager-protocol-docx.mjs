/**
 * Generates branded Shield HQ Word documents for manager hiring protocol.
 * Run: node scripts/generate-manager-protocol-docx.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  HeightRule,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TableLayoutType,
  VerticalAlign,
  WidthType,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LOGO_PATH = path.join(ROOT, "public/shield-hq-logo.png");
const LOGO_SM_PATH = path.join(ROOT, "public/shield-hq-logo-sm.png");
const OUT_DIR = path.join(ROOT, "docs");

const LOGO_COVER = { width: 200, height: 200 };
const LOGO_HEADER = { width: 52, height: 52 };

const BRAND = {
  teal: "0D9488",
  tealLight: "CCFBF1",
  tealAccent: "00D4AA",
  ink: "1E293B",
  muted: "64748B",
  border: "CBD5E1",
  white: "FFFFFF",
  warn: "FEF3C7",
  warnBorder: "F59E0B",
};

function readImage(p) {
  return fs.readFileSync(p);
}

function text(content, opts = {}) {
  return new TextRun({
    text: content,
    font: "Calibri",
    size: opts.size ?? 22,
    bold: opts.bold,
    italics: opts.italics,
    color: opts.color ?? BRAND.ink,
    underline: opts.underline ? {} : undefined,
  });
}

function para(children, opts = {}) {
  const runs = typeof children === "string" ? [text(children, opts)] : children;
  return new Paragraph({
    children: runs,
    spacing: { after: opts.after ?? 160, before: opts.before ?? 0 },
    alignment: opts.alignment,
    shading: opts.shading,
    border: opts.border,
    indent: opts.indent,
  });
}

function heading(content, level = HeadingLevel.HEADING_1) {
  const size = level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 26 : 24;
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 360 : 280, after: 160 },
    children: [
      new TextRun({
        text: content,
        font: "Calibri",
        size,
        bold: true,
        color: BRAND.teal,
      }),
    ],
  });
}

function bullet(content, boldPrefix) {
  const runs = [];
  if (boldPrefix) {
    runs.push(text(boldPrefix, { bold: true }));
    runs.push(text(content));
  } else {
    runs.push(text(content));
  }
  return new Paragraph({
    children: runs,
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

function checkboxItem(content) {
  return para([text("☐ ", { size: 22 }), text(content)]);
}

function callout(title, body, variant = "info") {
  const fill = variant === "warn" ? BRAND.warn : BRAND.tealLight;
  const borderColor = variant === "warn" ? BRAND.warnBorder : BRAND.teal;
  return [
    new Paragraph({
      spacing: { before: 200, after: 80 },
      shading: { fill, type: ShadingType.CLEAR },
      border: {
        left: { color: borderColor, size: 12, style: BorderStyle.SINGLE },
      },
      indent: { left: 200 },
      children: [text(title, { bold: true, color: BRAND.ink })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      shading: { fill, type: ShadingType.CLEAR },
      border: {
        left: { color: borderColor, size: 12, style: BorderStyle.SINGLE },
      },
      indent: { left: 200 },
      children: typeof body === "string" ? [text(body, { size: 20 })] : body,
    }),
  ];
}

const TABLE_WIDTH = 9360; // Full content width in DXA (twips) — Pages/Word compatible

/** Convert ratio array (e.g. [34,33,33]) to fixed column widths in twips */
function columnWidthsFromRatios(ratios) {
  const total = ratios.reduce((sum, n) => sum + n, 0);
  const widths = ratios.map((r) => Math.floor((r / total) * TABLE_WIDTH));
  widths[widths.length - 1] += TABLE_WIDTH - widths.reduce((sum, n) => sum + n, 0);
  return widths;
}

function cellParagraph(content, opts = {}) {
  return new Paragraph({
    children: [text(content, { size: opts.size ?? 20, bold: opts.bold, color: opts.color })],
    spacing: { after: 60, before: 0 },
    alignment: opts.alignment,
  });
}

function tableCell(content, opts = {}) {
  const children =
    typeof content === "string"
      ? [cellParagraph(content, opts)]
      : content;
  return new TableCell({
    children,
    shading: opts.header ? { fill: BRAND.teal, type: ShadingType.CLEAR } : opts.shading,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
  });
}

function headerCell(content) {
  return tableCell(content, { header: true, bold: true, color: BRAND.white, size: 20 });
}

function dataRow(cells) {
  return new TableRow({
    children: cells.map((c) => tableCell(c)),
  });
}

function headerRow(cells) {
  return new TableRow({
    children: cells.map((c) => headerCell(c)),
  });
}

function makeTable(headers, rows, ratios) {
  const columnWidths = columnWidthsFromRatios(ratios ?? headers.map(() => 1));
  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    rows: [headerRow(headers), ...rows.map((r) => dataRow(r))],
  });
}

function tableBlock(headers, rows, ratios) {
  return [makeTable(headers, rows, ratios), spacer(160)];
}

function spacer(after = 120) {
  return para("", { after });
}

function logoHeader() {
  const logo = readImage(LOGO_SM_PATH);
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new ImageRun({
            data: logo,
            transformation: { width: LOGO_HEADER.width, height: LOGO_HEADER.height },
            type: "png",
          }),
        ],
      }),
    ],
  });
}

function standardFooter(label) {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          text(label, { size: 16, color: BRAND.muted }),
          text("  |  Page ", { size: 16, color: BRAND.muted }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: "Calibri",
            size: 16,
            color: BRAND.muted,
          }),
        ],
      }),
    ],
  });
}

function coverPage(logo, title, subtitle, meta, banner = "CONFIDENTIAL — DIRECTORS' USE ONLY") {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 800, after: 400 },
      children: [
        new ImageRun({
          data: logo,
          transformation: { width: LOGO_COVER.width, height: LOGO_COVER.height },
          type: "png",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [text(title, { size: 44, bold: true, color: BRAND.ink })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [text(subtitle, { size: 26, color: BRAND.muted })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: BRAND.tealAccent },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND.tealAccent },
      },
      shading: { fill: BRAND.tealLight, type: ShadingType.CLEAR },
      children: [text(banner, { bold: true, size: 22, color: BRAND.teal })],
    }),
    spacer(400),
    ...meta.map(([k, v]) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          text(`${k}: `, { bold: true, size: 22, color: BRAND.muted }),
          text(v, { size: 22 }),
        ],
      })
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildProtocolDocument() {
  const logo = readImage(LOGO_PATH);

  const sections = [
    ...coverPage(logo, "Manager Recruitment & Vetting Protocol", "Shield HQ Security Agency", [
      ["Document owner", "Director(s)"],
      ["Version", "1.0"],
      ["Effective date", "July 2026"],
      ["Next review", "January 2027"],
      ["Classification", "Internal — Directors"],
    ]),

    heading("1. Purpose"),
    para(
      "This protocol is the single reference document for directors when hiring anyone into a management or supervisory role. It ensures every candidate is:"
    ),
    bullet("Legally entitled to work in the UK"),
    bullet("Properly licensed by the Security Industry Authority (SIA) where required"),
    bullet("Suitably vetted before they hold authority over staff, clients, or operational decisions"),
    ...callout(
      "Why this exists",
      "We previously accepted a manager who supplied an incorrect SIA licence number. If we had deployed them without catching the error, the company could have been fined or prosecuted for allowing unlicensed security work, and our insurance and ACS standing would have been at risk. This protocol prevents that.",
      "warn"
    ),
    ...callout(
      "Legal reminder",
      "Under the Private Security Industry Act 2001, you must check that anyone doing licensable security work holds a valid SIA licence. You can be fined or imprisoned if you pay someone to work in security without the correct licence.\n\nOfficial register: services.sia.homeoffice.gov.uk/rolh\nGOV.UK guidance: gov.uk/check-a-private-security-licence"
    ),

    heading("2. Scope — Who This Covers"),
    makeTable(
      ["Role", "SIA required?", "This protocol applies?"],
      [
        [
          "Operations / site manager supervising door or guarding staff",
          "Yes — valid Front Line licence (usually Door Supervision)",
          "Yes — full protocol",
        ],
        [
          "Area / regional manager with operational oversight",
          "Yes — Non-Front Line or Front Line depending on duties",
          "Yes — full protocol",
        ],
        [
          "Office-only admin with no security operational authority",
          "Usually no SIA licence",
          "Partial — skip Section 5 (SIA)",
        ],
        [
          "Director / company officer",
          "Depends on duties",
          "Yes — full protocol",
        ],
      ],
      [34, 33, 33]
    ),
    spacer(),
    para("When in doubt: treat the role as requiring SIA verification until a director confirms otherwise in writing.", {
      bold: true,
    }),

    heading("3. Roles and Responsibilities"),
    makeTable(
      ["Person", "Responsibility"],
      [
        [
          "Director (Accountable)",
          "Approves final hire; signs the Vetting Record; ensures no manager starts without 100% completion",
        ],
        [
          "Director or designated verifier",
          "Performs SIA register checks (dual verification); captures evidence",
        ],
        ["HR / admin (if applicable)", "Collects documents, chases references, files records"],
        ["Candidate", "Provides true documents; attends in-person ID check"],
      ],
      [30, 70]
    ),
    spacer(),
    ...callout(
      "Golden rule",
      "No manager may supervise licensed staff, represent the company on site, or make deployment decisions until the Director has signed the completed Manager Vetting Record (Appendix A)."
    ),

    heading("4. Process Overview"),
    para("Follow these steps in order for every manager hire:"),
    bullet("Role approved by Director"),
    bullet("Job description and advert published"),
    bullet("Application received and initial screen"),
    bullet("Document pack requested from candidate"),
    bullet("Dual SIA register verification (Section 5)"),
    bullet("Right to work check (Section 6)"),
    bullet("DBS check (Section 7)"),
    bullet("References and 5-year employment history (Section 8)"),
    bullet("Director sign-off on completed Vetting Record"),
    bullet("Offer letter and contract issued"),
    bullet("Induction completed before first operational day"),
    bullet("Ongoing licence monitoring (Section 12)"),
    para("Typical timeline: 2–4 weeks. Do not compress SIA or DBS steps under pressure to fill a rota.", {
      bold: true,
    }),

    heading("5. SIA Licence Verification (Critical Section)"),
    para(
      "This is the most important part of the protocol. Never rely on a photocopy, WhatsApp image, or badge photo alone.",
      { bold: true }
    ),

    heading("5.1 The Two-Source Verification Rule", HeadingLevel.HEADING_2),
    para(
      "Every candidate with an SIA licence must be verified using two independent register searches that must agree with each other and with the candidate's identity."
    ),
    makeTable(
      ["Step", "Action", "Evidence to retain"],
      [
        [
          "A",
          "Candidate provides: full legal name, DOB, 16-digit licence number, sector, expiry, clear photo of physical SIA card",
          "Copy of card (both sides if applicable)",
        ],
        [
          "B — Search 1",
          "SIA Register → Find by licence number → enter 16 digits with no spaces",
          "Dated screenshot: number, name, status, sector, expiry",
        ],
        [
          "C — Search 2",
          "Same register → Find by name → surname, first name, DOB, role, sector",
          "Dated screenshot showing licence number returned",
        ],
        [
          "D — Cross-match",
          "Compare Search 1 and Search 2: licence numbers must be identical. Status must be Valid.",
          "Written note on Vetting Record with verifier name and date",
        ],
        [
          "E — Identity match",
          "In person or live video: compare card photo to candidate's face and photo ID",
          "Signed director statement confirming identity match",
        ],
        ["F — Sector match", "Confirm licence sector matches the role", "Noted on Vetting Record"],
      ],
      [12, 48, 40]
    ),

    heading("5.2 Stop Conditions — Do Not Proceed If", HeadingLevel.HEADING_2),
    bullet("Licence number on the card does not match the number returned by the register"),
    bullet("Search by licence number returns a different name to the candidate"),
    bullet("Search by name/DOB returns a different licence number to the one provided"),
    bullet("Register shows Expired, Suspended, or Revoked"),
    bullet("Candidate refuses in-person or live ID comparison"),
    bullet('Candidate asks you to "check later" or "use a mate\'s number temporarily"'),
    bullet("Card appears tampered, or photo does not match the person"),
    para("Action: Stop the process. Do not offer the role. Log the discrepancy on the Vetting Record. Retain evidence.", {
      bold: true,
    }),

    heading("5.3 Lesson Learned From Our Incident", HeadingLevel.HEADING_2),
    para(
      "A candidate sent a licence number that belonged to someone else (or was mistyped). The card image looked plausible. We would only have caught this at the register cross-check stage."
    ),
    para(
      "Prevention: Always perform both Search 1 (by number) and Search 2 (by name/DOB). If we had only typed in the number they gave us without the reverse lookup, we might have verified the wrong person.",
      { bold: true }
    ),

    heading("5.4 Re-verification Triggers", HeadingLevel.HEADING_2),
    bullet("Licence is renewed (new card issued)"),
    bullet("More than 12 months since last verification"),
    bullet("Any doubt raised by a client, guard, or audit"),
    bullet("Register status changes to suspended/expired"),

    heading("6. Right to Work (UK)"),
    para("Complete before offer letter is sent."),
    makeTable(
      ["Step", "Requirement", "Evidence"],
      [
        ["1", "Obtain original ID documents (passport, BRP, or acceptable combination)", "Copies stored securely"],
        [
          "2",
          "Non-British/Irish nationals: share code + online employer check at gov.uk/view-right-to-work",
          "PDF/printout with date",
        ],
        ["3", "Record check type: List A (continuous) or List B (time-limited)", "Noted on Vetting Record"],
        ["4", "If time-limited: diary reminder before follow-up check due date", "Calendar entry"],
      ],
      [10, 55, 35]
    ),

    heading("7. DBS Check"),
    makeTable(
      ["Role risk level", "DBS level"],
      [
        ["Standard manager / supervisor", "Standard DBS minimum"],
        [
          "Manager at licensed venues, cash handling, vulnerable persons, or key-holder duties",
          "Enhanced DBS preferred",
        ],
      ],
      [50, 50]
    ),
    spacer(),
    bullet("Use registered umbrella body or direct DBS route"),
    bullet("Verify certificate belongs to candidate (name, DOB match ID)"),
    bullet("Review disclosures — unspent relevant convictions assessed by Director before offer"),
    bullet("Re-check every 3 years or on role change"),

    heading("8. Employment History and References"),
    bullet("5-year employment history — written, signed by candidate"),
    bullet("Explain any gap longer than 31 days"),
    bullet("Minimum 2 references — at least one from a previous employer in security or management"),
    bullet("Reference must confirm: job title, dates, reason for leaving, suitability, disciplinary issues"),
    bullet("Log date sent, date received, referee name, organisation, contact method"),
    bullet("Follow up verbal reference if written is vague or delayed"),
    para("Red flags: Refusal to provide employer reference, inconsistent dates, undisclosed gaps, negative feedback on integrity or licensing.", {
      italics: true,
    }),

    heading("9. Identity and Address Verification"),
    makeTable(
      ["Document", "Purpose"],
      [
        ["Photo ID (passport or driving licence)", "Identity — must match SIA register name"],
        ["Proof of address (utility bill / bank statement, <3 months)", "Residency"],
        ["NI number", "Payroll / HMRC"],
        ["Bank details", "Payment (verify independently of CV)"],
        ["Emergency contact", "Operations"],
      ],
      [40, 60]
    ),

    heading("10. Offer, Contract, and Role Clarity"),
    para("Only after Appendix A is 100% complete and signed by a Director:"),
    makeTable(
      ["Item", "Detail"],
      [
        ["Written offer letter", "Role title, reporting line, pay, start date, probation (3–6 months)"],
        ["Contract", "Employment or contractor agreement — reviewed for IR35 if applicable"],
        ["Job description", "Signed acknowledgement — includes SIA compliance duties"],
        ["Confidentiality & data protection", "Signed — managers access personnel and client data"],
        ["Conflict of interest declaration", "Signed — secondary employment, competing agencies"],
        ["Uniform / ID issue record", "If applicable"],
      ],
      [35, 65]
    ),

    heading("11. Induction Before First Operational Day"),
    checkboxItem("Company policies acknowledged (H&S, incident reporting, lone working, GDPR)"),
    checkboxItem("Safeguarding / VAWG awareness (for NTE venues)"),
    checkboxItem("ACT Awareness (free via NaCTSO) — certificate on file"),
    checkboxItem("Client site inductions for venues they will oversee"),
    checkboxItem("Introduction to escalation path (director contact, emergency procedures)"),
    checkboxItem("Shield HQ / ops systems access (if used) — separate from vetting completion"),

    heading("12. Ongoing Compliance (After Hire)"),
    makeTable(
      ["Frequency", "Action"],
      [
        ["Monthly", "Spot-check: re-query SIA register for all managers"],
        ["90 / 60 / 30 days before SIA expiry", "Remind manager; block operational authority if expired"],
        ["Annually", "Review Vetting Record; refresh reference if concerns arise"],
        ["On incident", "Re-verify licence if fraud or misrepresentation suspected"],
      ],
      [35, 65]
    ),

    heading("13. Record Keeping"),
    makeTable(
      ["Record", "Retention", "Storage"],
      [
        ["Completed Manager Vetting Record", "Employment + 6 years", "Secure folder — physical or encrypted cloud"],
        ["SIA register screenshots", "Same", "Linked to Vetting Record"],
        ["Right-to-work check", "Same", "Same"],
        ["DBS certificate copy / reference number", "Same", "Restricted access"],
        ["References", "Same", "Same"],
        ["Signed contracts", "Same", "Same"],
      ],
      [40, 25, 35]
    ),
    spacer(),
    para("Folder structure per manager: Personnel / Managers / [Surname, First name] / Vetting Pack /"),

    heading("14. Quick Reference — Director Checklist"),
    para("Use this before signing off any manager hire:"),
    checkboxItem("Dual SIA register verification completed (number search AND name/DOB search match)"),
    checkboxItem("Physical licence card matches register and candidate's face"),
    checkboxItem("Licence valid, correct sector, not suspended"),
    checkboxItem("Right to work verified and documented"),
    checkboxItem("DBS received and assessed"),
    checkboxItem("5-year history + gaps explained"),
    checkboxItem("2 references received (1 employer)"),
    checkboxItem("Photo ID + proof of address on file"),
    checkboxItem("Contract and declarations signed"),
    checkboxItem("Induction scheduled before operational authority granted"),
    spacer(),
    para("Director sign-off: _________________________    Date: _____________"),

    new Paragraph({ children: [new PageBreak()] }),

    heading("Appendix A — Manager Vetting Record"),
    para("Copy one per candidate. Store in their personnel folder.", { italics: true }),

    heading("A1. Candidate Details", HeadingLevel.HEADING_2),
    makeTable(
      ["Field", "Value"],
      [
        ["Full legal name", ""],
        ["Date of birth", ""],
        ["Address", ""],
        ["Role applied for", ""],
        ["Date applied", ""],
        ["Director responsible", ""],
      ],
      [35, 65]
    ),

    heading("A2. SIA Licence Verification", HeadingLevel.HEADING_2),
    makeTable(
      ["Check", "Result", "Verified by", "Date"],
      [
        ["16-digit licence number (as stated by candidate)", "", "", ""],
        ["Search 1 — by licence number — Register name", "", "", ""],
        ["Search 1 — Status (Valid / Expired / Suspended)", "", "", ""],
        ["Search 1 — Sector", "", "", ""],
        ["Search 1 — Expiry date", "", "", ""],
        ["Search 2 — by name + DOB — Register licence number", "", "", ""],
        ["Cross-match: Search 1 number = Search 2 number? (Y/N)", "", "", ""],
        ["Cross-match: Register name = ID document name? (Y/N)", "", "", ""],
        ["In-person / live ID: Card photo = candidate face? (Y/N)", "", "", ""],
        ["Screenshot file refs (Search 1 & 2)", "", "", ""],
      ],
      [45, 20, 18, 17]
    ),
    spacer(),
    para("SIA verification outcome: ☐ PASS   ☐ FAIL"),
    para("If FAIL — reason: _______________________________________________"),

    heading("A3. Right to Work", HeadingLevel.HEADING_2),
    makeTable(
      ["Check", "Result", "Date"],
      [
        ["Document type", "", ""],
        ["Check type (List A / List B)", "", ""],
        ["Share code check (if applicable)", "", ""],
        ["Follow-up due date (if List B)", "", ""],
      ],
      [45, 30, 25]
    ),
    para("Outcome: ☐ PASS   ☐ FAIL"),

    heading("A4. DBS", HeadingLevel.HEADING_2),
    makeTable(
      ["Field", "Value"],
      [
        ["Level (Basic / Standard / Enhanced)", ""],
        ["Certificate number", ""],
        ["Issue date", ""],
        ["Workforce (if Enhanced)", ""],
        ["Director review of disclosures", ""],
        ["Outcome", "☐ PASS   ☐ FAIL"],
      ],
      [40, 60]
    ),

    heading("A5. Employment History & References", HeadingLevel.HEADING_2),
    makeTable(
      ["Ref", "Organisation", "Contact", "Requested", "Received", "OK?"],
      [
        ["1 (employer)", "", "", "", "", ""],
        ["2", "", "", "", "", ""],
      ],
      [12, 22, 18, 16, 16, 16]
    ),
    spacer(),
    para("Gaps >31 days explained? ☐ Yes   ☐ N/A"),
    para("Outcome: ☐ PASS   ☐ FAIL"),

    heading("A6. Identity Documents", HeadingLevel.HEADING_2),
    makeTable(
      ["Document", "Ref / file", "Verified Y/N"],
      [
        ["Photo ID", "", ""],
        ["Proof of address", "", ""],
      ],
      [35, 40, 25]
    ),

    heading("A7. Final Decision", HeadingLevel.HEADING_2),
    makeTable(
      ["", ""],
      [
        ["All sections PASS?", "☐ Yes   ☐ No"],
        ["Director approval to hire", "Name: _________________  Signature: _________________  Date: _______"],
        ["Start date authorised", ""],
        ["Operational authority from", ""],
      ],
      [40, 60]
    ),
    para("Notes:"),

    heading("Appendix B — SIA Register Step-by-Step"),
    bullet("Open services.sia.homeoffice.gov.uk/rolh/"),
    bullet("Search by licence number: enter 16 digits, no spaces → screenshot full result page"),
    bullet("Search by name: surname, first name, DOB (DD/MM/YYYY), role, sector → screenshot result"),
    bullet("Compare both results side by side"),
    bullet("Save screenshots as: [Surname]_SIA_Search1_[YYYYMMDD].png and [Surname]_SIA_Search2_[YYYYMMDD].png"),
    bullet("Complete Appendix A cross-match fields"),

    heading("Document Control"),
    makeTable(
      ["Version", "Date", "Author", "Changes"],
      [["1.0", "Jul 2026", "Directors", "Initial protocol — post incorrect-licence incident"]],
      [15, 20, 25, 40]
    ),
    spacer(),
    para("Approved by: _________________________    Date: _____________"),
  ];

  return new Document({
    creator: "Shield HQ",
    title: "Manager Recruitment & Vetting Protocol",
    description: "Director protocol for manager hiring and SIA verification",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: BRAND.ink },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 },
          },
        },
        headers: { default: logoHeader() },
        footers: { default: standardFooter("Shield HQ — Manager Recruitment & Vetting Protocol — Confidential") },
        children: sections,
      },
    ],
  });
}

function buildVettingRecordDocument() {
  const logo = readImage(LOGO_PATH);

  const sections = [
    ...coverPage(logo, "Manager Vetting Record", "Per-Candidate Checklist — Shield HQ", [
      ["Use", "One copy per manager candidate"],
      ["Store in", "Personnel / Managers / [Name] / Vetting Pack /"],
      ["Version", "1.0"],
      ["Effective date", "July 2026"],
    ]),

    heading("Candidate Details"),
    makeTable(
      ["Field", "Value"],
      [
        ["Full legal name", ""],
        ["Date of birth", ""],
        ["Address", ""],
        ["Role applied for", ""],
        ["Date applied", ""],
        ["Director responsible", ""],
      ],
      [35, 65]
    ),

    heading("SIA Licence Verification (Mandatory)"),
    ...callout(
      "Two-Source Verification Rule",
      "Complete BOTH register searches. Numbers must match. Never rely on a photo of the card alone.",
      "warn"
    ),
    makeTable(
      ["Check", "Result", "By", "Date"],
      [
        ["Licence number provided by candidate (16 digits)", "", "", ""],
        ["Search 1 — by number — name on register", "", "", ""],
        ["Search 1 — status", "", "", ""],
        ["Search 1 — sector", "", "", ""],
        ["Search 1 — expiry", "", "", ""],
        ["Search 2 — by name/DOB — number on register", "", "", ""],
        ["Numbers match (Search 1 = Search 2)?", "☐ Y  ☐ N", "", ""],
        ["Name matches photo ID?", "☐ Y  ☐ N", "", ""],
        ["Face matches licence card (in person/live)?", "☐ Y  ☐ N", "", ""],
        ["Screenshot refs", "", "", ""],
      ],
      [42, 22, 18, 18]
    ),
    spacer(),
    para("SIA outcome: ☐ PASS   ☐ FAIL"),
    para("Reason if fail: _________________________________________________"),
    para("Register: services.sia.homeoffice.gov.uk/rolh", { size: 20, color: BRAND.muted }),

    heading("Right to Work"),
    makeTable(
      ["", ""],
      [
        ["Document / share code", ""],
        ["List A or List B", ""],
        ["Check date", ""],
        ["Follow-up due (if List B)", ""],
        ["Outcome", "☐ PASS   ☐ FAIL"],
      ],
      [40, 60]
    ),

    heading("DBS"),
    makeTable(
      ["", ""],
      [
        ["Level (Basic / Standard / Enhanced)", ""],
        ["Certificate no.", ""],
        ["Issue date", ""],
        ["Director review notes", ""],
        ["Outcome", "☐ PASS   ☐ FAIL"],
      ],
      [40, 60]
    ),

    heading("Employment History & References"),
    makeTable(
      ["Ref", "Organisation", "Requested", "Received", "OK?"],
      [
        ["1 (employer)", "", "", "", "☐"],
        ["2", "", "", "", "☐"],
      ],
      [15, 35, 20, 20, 10]
    ),
    spacer(),
    para("Gaps >31 days explained? ☐ Yes   ☐ N/A"),
    para("Outcome: ☐ PASS   ☐ FAIL"),

    heading("Identity"),
    makeTable(
      ["Document", "File ref", "OK?"],
      [
        ["Photo ID", "", "☐"],
        ["Proof of address", "", "☐"],
      ],
      [35, 45, 20]
    ),

    heading("Final Sign-Off"),
    makeTable(
      ["", ""],
      [
        ["All sections PASS?", "☐ Yes   ☐ No"],
        ["Director name", ""],
        ["Signature", ""],
        ["Date", ""],
        ["Authorised start date", ""],
        ["Operational authority from", ""],
      ],
      [40, 60]
    ),
    spacer(),
    para("Full protocol: docs/Manager-Recruitment-and-Vetting-Protocol.docx", {
      size: 18,
      color: BRAND.muted,
      italics: true,
    }),
  ];

  return new Document({
    creator: "Shield HQ",
    title: "Manager Vetting Record",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: BRAND.ink },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 },
          },
        },
        headers: { default: logoHeader() },
        footers: { default: standardFooter("Shield HQ — Manager Vetting Record — Confidential") },
        children: sections,
      },
    ],
  });
}

function buildCandidateApplicationDocument() {
  const logo = readImage(LOGO_PATH);

  const sections = [
    ...coverPage(
      logo,
      "Application Form",
      "Shield HQ — Manager / Supervisor",
      [
        ["Return to", "Shield HQ"],
        ["Email", "support@shieldhq.co.uk"],
      ],
      "PLEASE COMPLETE AND RETURN"
    ),

    para("Please complete all sections below and return to Shield HQ."),

    heading("About You"),
    makeTable(
      ["", ""],
      [
        ["Full name", ""],
        ["Date of birth (DD/MM/YYYY)", ""],
        ["National Insurance (NI) number", ""],
        ["Mobile number", ""],
        ["Email address", ""],
        ["Home address", ""],
        ["Postcode", ""],
      ],
      [35, 65]
    ),
    spacer(),

    heading("Right to Work & Visa"),
    para("Everyone must complete this section. We are required by law to keep proof that you can work in the UK.", { size: 20 }),
    makeTable(
      ["", ""],
      [
        ["Nationality", ""],
        [
          "Are you a British or Irish citizen?",
          "☐ Yes — skip visa fields below   ☐ No — complete visa section",
        ],
        [
          "Visa / immigration status (if not British/Irish)",
          "☐ Skilled Worker   ☐ Health & Care Worker   ☐ Graduate   ☐ Student   ☐ EU Settled/Pre-settled   ☐ Other: ________",
        ],
        ["Passport number", ""],
        ["Passport expiry date (DD/MM/YYYY)", ""],
        ["Visa / BRP expiry date (DD/MM/YYYY)", ""],
        [
          "Right-to-work share code",
          "Get this free at gov.uk/prove-right-to-work — required for non-British/Irish applicants",
        ],
        ["Share code expiry date (DD/MM/YYYY)", ""],
      ],
      [35, 65]
    ),
    spacer(),

    heading("SIA Licence"),
    ...callout(
      "Important",
      "Enter your 16-digit licence number exactly as printed on your card. We check every number on the official SIA register.",
      "warn"
    ),
    makeTable(
      ["", ""],
      [
        ["16-digit SIA licence number", ""],
        ["Licence type (e.g. Door Supervision)", ""],
        ["Date licence was issued (DD/MM/YYYY)", ""],
        ["Expiry date (DD/MM/YYYY)", ""],
      ],
      [35, 65]
    ),
    spacer(),

    heading("Bank Details"),
    para("So we can pay you. Must be a UK bank account in your name.", { size: 20 }),
    makeTable(
      ["", ""],
      [
        ["Account holder name (as on bank account)", ""],
        ["Bank / building society name", ""],
        ["Sort code", ""],
        ["Account number", ""],
      ],
      [35, 65]
    ),
    spacer(),

    heading("References"),
    para("Two people who can vouch for you — at least one should be a previous employer.", { size: 20 }),
    makeTable(
      ["", "Reference 1", "Reference 2"],
      [
        ["Name", "", ""],
        ["Company / organisation", "", ""],
        ["Phone number", "", ""],
      ],
      [28, 36, 36]
    ),
    spacer(),

    heading("Documents to Provide"),
    para("Please attach or send the following with this completed form:"),
    bullet("Clear photo of your SIA licence card (front — all 16 digits visible)"),
    bullet("Photo ID — passport or driving licence"),
    bullet("If not British/Irish: copy of visa/BRP and screenshot of your right-to-work share code"),
    spacer(),

    heading("Declaration"),
    checkboxItem("I confirm the information above is correct and my SIA licence number is genuine."),
    checkboxItem("I am legally entitled to work in the UK and have provided accurate visa/right-to-work details."),
    checkboxItem("I consent to Shield HQ using my bank details to pay me for work undertaken."),
    spacer(),
    makeTable(
      ["", ""],
      [
        ["Signature", ""],
        ["Print name", ""],
        ["Date", ""],
      ],
      [35, 65]
    ),
  ];

  return new Document({
    creator: "Shield HQ",
    title: "Manager Application Form",
    description: "Short candidate application form",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: BRAND.ink },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 },
          },
        },
        headers: {
          first: new Header({ children: [] }),
          default: logoHeader(),
        },
        footers: { default: standardFooter("Shield HQ — Application Form") },
        children: sections,
      },
    ],
  });
}

async function main() {
  if (!fs.existsSync(LOGO_PATH)) {
    console.error("Logo not found:", LOGO_PATH);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, "templates"), { recursive: true });

  const protocolPath = path.join(OUT_DIR, "Manager-Recruitment-and-Vetting-Protocol.docx");
  const recordPath = path.join(OUT_DIR, "templates/Manager-Vetting-Record.docx");
  const applicationPath = path.join(OUT_DIR, "templates/Manager-Candidate-Application-Form.docx");

  const protocolBuffer = await Packer.toBuffer(buildProtocolDocument());
  fs.writeFileSync(protocolPath, protocolBuffer);
  console.log("Created:", protocolPath);

  const recordBuffer = await Packer.toBuffer(buildVettingRecordDocument());
  fs.writeFileSync(recordPath, recordBuffer);
  console.log("Created:", recordPath);

  const applicationBuffer = await Packer.toBuffer(buildCandidateApplicationDocument());
  fs.writeFileSync(applicationPath, applicationBuffer);
  console.log("Created:", applicationPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
