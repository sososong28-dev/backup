import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputRoot = String.raw`D:\5月\产品\广审图\广审排期_仅正面图_按20日提交_20260520起`;
const detailCsvPath = path.join(outputRoot, "广审排期明细_20260520起.csv");
const outputXlsxPath = path.join(outputRoot, "广审排期总表_20260520起.xlsx");

const csvText = await fs.readFile(detailCsvPath, "utf8");
const workbook = await Workbook.fromCSV(csvText, { sheetName: "广审排期" });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputXlsxPath);

console.log(`Created xlsx: ${outputXlsxPath}`);
