// Chek chop etish (Electron) — HTML → PDF → printer.
// HTML→PDF: puppeteer (asosiy, dev) | Electron printToPDF (fallback, packaged).
// PDF→printer: Windows → pdf-to-printer (SumatraPDF); macOS/Linux → lp -d (CUPS).
// Chek HTML shabloni — receipt-template.js (toza, bu yerda re-export).
import { BrowserWindow } from "electron";
import { tmpdir } from "os";
import { join } from "path";
import { writeFile, unlink } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

export { buildReceiptHtml, buildTestReceiptHtml, buildKitchenTicketHtml, currencyLabel } from "./receipt-template.js";

const execAsync = promisify(exec);

// ASOSIY: puppeteer (testprinter loyihasidagidek — termal printer CUPS filtri
// puppeteer PDF'ini qabul qiladi; Electron printToPDF'ni rad etardi "Сбой фильтра").
async function htmlToPdfPuppeteer(html) {
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    return await page.pdf({ width: "72mm", printBackground: true });
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
    console.warn("[print] puppeteer mavjud emas, Electron printToPDF fallback:", e?.message);
    return await htmlToPdfElectron(html);
  }
}

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
