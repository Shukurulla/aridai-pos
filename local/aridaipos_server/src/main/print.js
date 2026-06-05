// Chek chop etish — testprinter loyihasidagi oqim:
//   HTML (jadval ko'rinish) → PDF → printer.
// HTML→PDF: Electron'ning O'Z Chromium'i (webContents.printToPDF) — puppeteer
//   o'rniga (Electron'da Chromium allaqachon bor; ikkinchisini bundle qilmaymiz).
// PDF→printer: Windows → pdf-to-printer (SumatraPDF); macOS/Linux → lp -d (CUPS).
import { BrowserWindow, app } from "electron";
import { tmpdir } from "os";
import { join } from "path";
import { writeFile, unlink } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const esc = (s) =>
  String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

// ===== HTML → PDF =====
// ASOSIY: puppeteer (testprinter loyihasidagidek — termal printer CUPS filtri
// puppeteer PDF'ini qabul qiladi; Electron printToPDF'ni rad etardi "Сбой фильтра").
// puppeteer dev'da bor (devDependency). Packaged EXE'da yo'q → printToPDF fallback.
async function htmlToPdfPuppeteer(html) {
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    return await page.pdf({ width: "72mm", printBackground: true }); // reference bilan bir xil
  } finally {
    await browser.close();
  }
}

// FALLBACK: Electron'ning o'z Chromium'i (packaged EXE — puppeteer yo'q).
async function htmlToPdfElectron(html) {
  const win = new BrowserWindow({ show: false, width: 320, height: 900, webPreferences: { sandbox: true } });
  try {
    await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    const heightPx = await win.webContents.executeJavaScript("document.body.scrollHeight").catch(() => 600);
    const heightMicron = Math.max(Math.round((Number(heightPx) || 600) * 264.5833) + 24000, 80000);
    return await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: "none" },
      pageSize: { width: 72000, height: heightMicron },
    });
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

async function htmlToPdf(html) {
  try {
    return await htmlToPdfPuppeteer(html);
  } catch (e) {
    // puppeteer topilmasa/ishlamasa (packaged) — Electron printToPDF
    console.warn("[print] puppeteer mavjud emas, Electron printToPDF fallback:", e?.message);
    return await htmlToPdfElectron(html);
  }
}
void app; // app — kelajakda packaged Chromium yo'li uchun

// PDF buffer'ni printerga yuborish (OS bo'yicha)
async function sendPdfToPrinter(pdfBuffer, deviceName) {
  const pdfPath = join(tmpdir(), `aridai-receipt-${Date.now()}.pdf`);
  await writeFile(pdfPath, pdfBuffer);
  try {
    if (process.platform === "win32") {
      const ptp = await import("pdf-to-printer");
      const printFn = ptp.print || ptp.default?.print;
      await printFn(pdfPath, { printer: deviceName });
    } else {
      // macOS / Linux — CUPS (testprinter loyihasidagi `lp -d` kabi)
      await execAsync(`lp -d ${JSON.stringify(deviceName)} ${JSON.stringify(pdfPath)}`);
    }
  } finally {
    unlink(pdfPath).catch(() => {});
  }
}

// Asosiy: HTML → PDF → printer
export async function printHtml(html, deviceName) {
  if (!deviceName) return { success: false, error: "Принтер не выбран" };
  try {
    const pdf = await htmlToPdf(html);
    await sendPdfToPrinter(pdf, deviceName);
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || "Ошибка печати" };
  }
}

// Son formati: 200000 → "200 000"
const fmt = (n) => Number(n || 0).toLocaleString("ru-RU").replace(/,/g, " ");
const CUR = "сум";

// Nuqtali leader qatori (label ······· value) — flexbox, toza (ASCII chiziq emas)
function leaderRow(label, value, opts = {}) {
  const big = opts.big ? "font-size:15px;font-weight:900;" : "";
  const italic = opts.italic ? "font-style:italic;" : "";
  const lw = opts.bold ? "font-weight:800;" : "";
  const vstyle = `white-space:nowrap;font-weight:800;${big}${italic}`;
  return `<div style="display:flex;align-items:flex-end;margin:4px 0;${big}${italic}">
    <span style="white-space:nowrap;padding-bottom:1px;${lw}">${esc(label)}</span>
    <span style="flex:1 1 auto;border-bottom:2px dotted #000;margin:0 6px 4px;min-width:14px;"></span>
    <span style="${vstyle}">${esc(value)}</span>
  </div>`;
}

// ===== To'lov cheki — VECTOR STYLE ko'rinishida =====
// "Logikasi to'g'ri kelmaydigan" maydonlar (rabochee vremya, balans, barcode)
// — data bo'lmasa CHIQARILMAYDI.
export function buildReceiptHtml(data = {}) {
  const {
    brand = "AridaiPOS",
    branchName,
    receiptNumber,
    date = new Date().toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" }),
    sellerName,
    clientName,
    clientPhone,
    items = [],
    subtotal = 0,
    discountTotal = 0,
    discountPercent = 0,
    serviceAmount = 0,
    total = 0,
    paymentLabel,
    footer = "Спасибо за покупку!",
  } = data;

  const sep = `<div style="border-top:2px dotted #000;margin:8px 0;"></div>`;
  const metaLine = (l, v) =>
    `<div style="margin:3px 0;"><b style="font-weight:800;">${esc(l)}:</b> ${esc(v)}</div>`;

  // Mahsulotlar
  const itemsHtml = items
    .map((it, i) => {
      const meta = [it.meta, it.variant].filter(Boolean).map(esc).join(" / ");
      const head = `<div style="font-weight:800;margin:8px 0 2px;">${i + 1}. ${esc(it.name)}${meta ? " / " + meta : ""}</div>`;
      const qtyRow = leaderRow(`${fmt(it.qty)} шт x ${fmt(it.price)}`, `${fmt(it.lineTotal ?? it.qty * it.price)} ${CUR}`);
      const discRow =
        it.discountPercent > 0
          ? leaderRow(`Скидка ${fmt(it.discountPercent)}%`, `${fmt(it.discountedTotal ?? 0)} ${CUR}`)
          : "";
      return head + qtyRow + discRow;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;}
    body{width:72mm;margin:0;padding:8px 10px;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:13px;line-height:1.35;}
  </style></head><body>
    <div style="text-align:center;font-weight:900;font-size:22px;letter-spacing:1px;margin:2px 0 4px;">${esc(brand)}</div>
    ${branchName ? `<div style="text-align:center;font-size:12px;margin-bottom:4px;">${esc(branchName)}</div>` : ""}
    ${sep}
    ${receiptNumber ? metaLine("Продажа", "#" + receiptNumber) : ""}
    ${metaLine("Дата", date)}
    ${sellerName ? metaLine("Продавец", sellerName) : ""}
    ${clientName ? metaLine("Клиент", clientName) : ""}
    ${clientPhone ? metaLine("Контакты", clientPhone) : ""}
    ${sep}
    ${itemsHtml}
    ${sep}
    ${leaderRow("Подытог", `${fmt(subtotal)} ${CUR}`)}
    ${discountTotal > 0 ? leaderRow("Скидка", `${fmt(discountTotal)} ${CUR}`) : ""}
    ${discountPercent > 0 ? leaderRow("Скидка %", `${fmt(discountPercent)} %`) : ""}
    ${serviceAmount > 0 ? leaderRow("Обслуживание", `${fmt(serviceAmount)} ${CUR}`) : ""}
    ${leaderRow("ИТОГО", `${fmt(total)} ${CUR}`, { big: true })}
    ${paymentLabel ? leaderRow(paymentLabel, `${fmt(total)} ${CUR}`, { italic: true }) : ""}
    ${sep}
    <div style="text-align:center;font-weight:800;margin-top:10px;">${esc(footer)}</div>
  </body></html>`;
}

// Test chek — yuqoridagi dizaynda namuna ma'lumot bilan (chegirma ham ko'rinadi)
export function buildTestReceiptHtml(ctx = {}) {
  return buildReceiptHtml({
    brand: ctx.restaurantName || "AridaiPOS",
    branchName: ctx.branchName,
    receiptNumber: "TEST-0001",
    sellerName: ctx.sellerName || "Кассир",
    clientName: ctx.printerName ? `Принтер: ${ctx.printerName}` : undefined,
    items: [
      { name: "Плов", meta: "Горячее", qty: 1, price: 30000, lineTotal: 30000, discountPercent: 50, discountedTotal: 15000 },
      { name: "Кола 0.5", qty: 2, price: 12000, lineTotal: 24000 },
    ],
    subtotal: 54000,
    discountTotal: 15000,
    discountPercent: 28,
    total: 39000,
    paymentLabel: "Наличные",
    footer: "ТЕСТ ПЕЧАТИ · Спасибо!",
  });
}
