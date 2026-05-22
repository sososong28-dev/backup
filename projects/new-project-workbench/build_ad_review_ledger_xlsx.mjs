import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = String.raw`D:\5月\产品\广审图\广审机制_未来执行规范`;
const csvPath = path.join(outputDir, "广审新增需求台账模板.csv");
const xlsxPath = path.join(outputDir, "广审新增需求台账模板.xlsx");

const csvText = await fs.readFile(csvPath, "utf8");
const workbook = await Workbook.fromCSV(csvText, { sheetName: "新增需求台账" });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(xlsxPath);

console.log(`XLSX: ${xlsxPath}`);
