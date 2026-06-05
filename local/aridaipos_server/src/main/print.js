// Chek chop etish — testprinter loyihasidagi oqim:
//   HTML (jadval ko'rinish) → PDF → printer.
// HTML→PDF: Electron'ning O'Z Chromium'i (webContents.printToPDF) — puppeteer
//   o'rniga (Electron'da Chromium allaqachon bor; ikkinchisini bundle qilmaymiz).
// PDF→printer: Windows → pdf-to-printer (SumatraPDF); macOS/Linux → lp -d (CUPS).
import { BrowserWindow } from "electron";
import { tmpdir } from "os";
import { join } from "path";
import { writeFile, unlink } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const esc = (s) =>
  String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

// 72mm termal chek uchun HTML → PDF (kenglik 72mm, balandlik kontentga moslanadi)
async function htmlToPdf(html) {
  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 900,
    webPreferences: { sandbox: true },
  });
  try {
    await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    // Kontent balandligi (px) → micron (1px@96dpi = 264.5833µm). puppeteer'dagi auto-height kabi.
    const heightPx = await win.webContents
      .executeJavaScript("document.body.scrollHeight")
      .catch(() => 600);
    const heightMicron = Math.max(Math.round((Number(heightPx) || 600) * 264.5833) + 24000, 80000);
    return await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: "none" },
      pageSize: { width: 72000, height: heightMicron }, // 72mm × auto
    });
  } finally {
    if (!win.isDestroyed()) win.destroy();
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

// Test chek — jadval ko'rinishida (testprinter loyihasi uslubida)
export function buildTestReceiptHtml({ name, branchName } = {}) {
  const date = new Date().toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" });
  return `<!doctype html><html><head><meta charset="utf-8"></head>
  <body style="width:72mm;margin:0;padding:6px 8px;font-family:Arial,sans-serif;color:#000;">
    <h2 style="text-align:center;font-weight:900;margin:4px 0;font-size:18px;">AridaiPOS</h2>
    ${branchName ? `<p style="text-align:center;margin:2px 0;font-size:13px;">${esc(branchName)}</p>` : ""}
    <p style="text-align:center;margin:2px 0;font-weight:700;">ТЕСТ ПЕЧАТИ</p>
    <p style="text-align:center;margin:2px 0;font-size:12px;">${date}</p>
    <hr style="border:none;border-top:1px dashed #000;margin:6px 0;"/>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:3px 2px;">Принтер</td><td style="padding:3px 2px;text-align:right;font-weight:700;">${esc(name || "—")}</td></tr>
      <tr><td style="padding:3px 2px;">Связь</td><td style="padding:3px 2px;text-align:right;font-weight:700;">OK</td></tr>
    </table>
    <hr style="border:none;border-top:1px dashed #000;margin:6px 0;"/>
    <p style="text-align:center;margin:4px 0;">Спасибо!</p>
  </body></html>`;
}
