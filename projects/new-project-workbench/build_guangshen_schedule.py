from __future__ import annotations

import csv
import re
import shutil
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import pandas as pd


TARGET_ROOT = Path(r"D:\5月\产品\广审图")
PACK_ROOT = TARGET_ROOT / "广审统一编码命名"
MASTER_XLSX = Path(r"C:\Users\ho\Documents\New project\tmp-guangshen\master_names.xlsx")
OUTPUT_ROOT = TARGET_ROOT / "广审排期_仅正面图_按20日提交_20260520起"
DETAIL_CSV = OUTPUT_ROOT / "广审排期明细_20260520起.csv"
BATCH_CSV = OUTPUT_ROOT / "广审批次汇总_20260520起.csv"

START_YEAR = 2026
START_MONTH = 5
BATCH_SIZE = 10
DATE_CAPACITY = 20

HIGH_RISK_WORDS = ["玻尿酸", "高潮", "女生", "延时"]
MEDIUM_RISK_WORDS = ["快感因子", "单手打开", "英文", "持久", "动感", "旋转"]
SIDE_MARKERS = ["侧面", "背面", "-侧", "_侧", "-背", "_背", "朝右", "朝左"]
FRONT_MARKERS = ["正面", "-正--", "_正--", "-正-", "_正-"]
VIEW_TOKENS = [
    "_正面",
    "-正面",
    "_侧面",
    "-侧面",
    "_背面",
    "-背面",
    "_正",
    "-正",
    "_侧",
    "-侧",
    "_背",
    "-背",
]
CHANNEL_PREFIXES = ["天猫U先", "京东平台", "分销平台", "拼多多", "O2O"]
TRAILING_SPEC_RE = re.compile(r"(\d+(?:只|支|盒|片)|无规格|主图)$")


@dataclass
class RowAssignment:
    submit_date: str
    date_slot: int
    batch_index: int
    wave: int
    overall_order: int
    folder: str
    source_order: int
    original_name: str
    new_name: str
    product_key: str
    risk_level: str
    risk_words: str
    earliest_finish: str
    latest_finish: str
    latest_if_rework: str
    date_folder: str
    wave_folder: str
    package_path: str
    image_path: str
    image_exists: str


def monthly_submit_date(slot_idx: int) -> date:
    month_total = (START_MONTH - 1) + slot_idx
    year = START_YEAR + month_total // 12
    month = month_total % 12 + 1
    submit = date(year, month, 20)
    while submit.weekday() >= 5:
        submit += timedelta(days=1)
    return submit


def add_workdays(start: date, days: int) -> date:
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


def get_risk_words(text: str) -> str:
    hits: list[str] = []
    for word in HIGH_RISK_WORDS + MEDIUM_RISK_WORDS:
        if word in text:
            hits.append(word)
    return "、".join(hits)


def get_risk_level(text: str) -> str:
    if any(word in text for word in HIGH_RISK_WORDS):
        return "高风险"
    if any(word in text for word in MEDIUM_RISK_WORDS):
        return "中风险"
    return "常规"


def to_int(value) -> int:
    if pd.isna(value):
        return 0
    return int(value)


def is_front_image(name: str) -> bool:
    stem = Path(str(name)).stem
    if "正面" in stem:
        return True
    if any(marker in stem for marker in SIDE_MARKERS):
        return False
    return any(marker in stem for marker in FRONT_MARKERS)


def normalize_base_name(base: str, folder: str) -> str:
    text = base.strip(" _-")
    for prefix in CHANNEL_PREFIXES:
        if text.startswith(prefix):
            text = text[len(prefix) :].strip(" _-")
    text = TRAILING_SPEC_RE.sub("", text).strip(" _-")
    return text or folder


def derive_product_key(folder: str, new_name: str) -> str:
    stem = Path(str(new_name)).stem
    for token in VIEW_TOKENS:
        idx = stem.find(token)
        if idx > 0:
            base = normalize_base_name(stem[:idx], folder)
            return f"{folder}||{base}"
    return f"{folder}||{folder}"


def select_front_unique_rows(df: pd.DataFrame, folder_col: str, new_name_col: str) -> pd.DataFrame:
    front_df = df[df[new_name_col].astype(str).map(is_front_image)].copy()
    front_df["product_key"] = [
        derive_product_key(str(folder), str(name))
        for folder, name in zip(front_df[folder_col], front_df[new_name_col])
    ]
    front_df = front_df.drop_duplicates("product_key", keep="first").copy()
    return front_df


def build_schedule() -> tuple[list[RowAssignment], pd.DataFrame]:
    df = pd.read_excel(MASTER_XLSX, sheet_name=0).copy()
    folder_col = df.columns[0]
    source_order_col = df.columns[2]
    original_name_col = df.columns[3]
    new_name_col = df.columns[4]

    df["table_row_order"] = range(1, len(df) + 1)
    df["risk_words"] = df[new_name_col].astype(str).map(get_risk_words)
    df["risk_level"] = df[new_name_col].astype(str).map(get_risk_level)
    df["package_path"] = df[folder_col].astype(str).map(lambda name: str(PACK_ROOT / name))
    df["image_path"] = df.apply(
        lambda row: str(PACK_ROOT / str(row[folder_col]) / str(row[new_name_col])),
        axis=1,
    )
    df["image_exists"] = df["image_path"].map(lambda p: "Y" if Path(p).exists() else "N")

    selected = select_front_unique_rows(df, folder_col, new_name_col)
    selected = selected.sort_values("table_row_order").reset_index(drop=True)

    folder_summary = (
        selected.groupby(folder_col, sort=False)
        .agg(
            selected_image_count=(new_name_col, "count"),
            high_risk_count=("risk_level", lambda s: int((s == "高风险").sum())),
            medium_risk_count=("risk_level", lambda s: int((s == "中风险").sum())),
            first_table_row=("table_row_order", "min"),
        )
        .reset_index()
        .sort_values("first_table_row")
    )

    assignments: list[RowAssignment] = []
    for idx, (_, row) in enumerate(selected.iterrows(), start=1):
        date_slot = (idx - 1) // DATE_CAPACITY + 1
        batch_index = (idx - 1) // BATCH_SIZE + 1
        wave = ((idx - 1) % DATE_CAPACITY) // BATCH_SIZE + 1
        submit = monthly_submit_date(date_slot - 1)
        earliest = add_workdays(submit, 15)
        latest = add_workdays(submit, 25)
        rework_latest = add_workdays(submit, 32)
        date_folder = submit.isoformat()
        wave_folder = f"{wave:02d}_{'第一波' if wave == 1 else '第二波'}"

        assignments.append(
            RowAssignment(
                submit_date=submit.isoformat(),
                date_slot=date_slot,
                batch_index=batch_index,
                wave=wave,
                overall_order=idx,
                folder=str(row[folder_col]),
                source_order=to_int(row[source_order_col]),
                original_name=str(row[original_name_col]),
                new_name=str(row[new_name_col]),
                product_key=str(row["product_key"]),
                risk_level=str(row["risk_level"]),
                risk_words=str(row["risk_words"]),
                earliest_finish=earliest.isoformat(),
                latest_finish=latest.isoformat(),
                latest_if_rework=rework_latest.isoformat(),
                date_folder=date_folder,
                wave_folder=wave_folder,
                package_path=str(row["package_path"]),
                image_path=str(row["image_path"]),
                image_exists=str(row["image_exists"]),
            )
        )

    return assignments, folder_summary


def reset_output_root() -> None:
    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)


def write_detail_csv(assignments: list[RowAssignment]) -> None:
    fieldnames = [
        "提交日期",
        "提交序号",
        "批次序号",
        "波次",
        "工作顺序",
        "来源文件夹",
        "图包内序号",
        "原名称(表格)",
        "新图片名",
        "产品判定键",
        "风险级别",
        "敏感词命中",
        "预计最早完成",
        "预计最晚完成",
        "驳回补改最晚参考",
        "日期文件夹",
        "波次文件夹",
        "图包路径",
        "图片路径",
        "图片存在",
    ]
    with DETAIL_CSV.open("w", newline="", encoding="utf-8-sig") as fp:
        writer = csv.DictWriter(fp, fieldnames=fieldnames)
        writer.writeheader()
        for item in assignments:
            writer.writerow(
                {
                    "提交日期": item.submit_date,
                    "提交序号": item.date_slot,
                    "批次序号": item.batch_index,
                    "波次": item.wave,
                    "工作顺序": item.overall_order,
                    "来源文件夹": item.folder,
                    "图包内序号": item.source_order,
                    "原名称(表格)": item.original_name,
                    "新图片名": item.new_name,
                    "产品判定键": item.product_key,
                    "风险级别": item.risk_level,
                    "敏感词命中": item.risk_words,
                    "预计最早完成": item.earliest_finish,
                    "预计最晚完成": item.latest_finish,
                    "驳回补改最晚参考": item.latest_if_rework,
                    "日期文件夹": item.date_folder,
                    "波次文件夹": item.wave_folder,
                    "图包路径": item.package_path,
                    "图片路径": item.image_path,
                    "图片存在": item.image_exists,
                }
            )


def write_batch_csv(assignments: list[RowAssignment]) -> None:
    grouped: dict[tuple[str, int], list[RowAssignment]] = defaultdict(list)
    for item in assignments:
        grouped[(item.submit_date, item.wave)].append(item)

    fieldnames = [
        "提交日期",
        "波次",
        "图片数",
        "涉及图包数",
        "风险图片数",
        "涉及图包",
        "预计最早完成",
        "预计最晚完成",
        "驳回补改最晚参考",
    ]
    with BATCH_CSV.open("w", newline="", encoding="utf-8-sig") as fp:
        writer = csv.DictWriter(fp, fieldnames=fieldnames)
        writer.writeheader()
        for (submit_date, wave), items in sorted(grouped.items()):
            folders = list(dict.fromkeys(item.folder for item in items))
            writer.writerow(
                {
                    "提交日期": submit_date,
                    "波次": wave,
                    "图片数": len(items),
                    "涉及图包数": len(folders),
                    "风险图片数": sum(1 for item in items if item.risk_level != "常规"),
                    "涉及图包": "；".join(folders),
                    "预计最早完成": items[0].earliest_finish,
                    "预计最晚完成": items[0].latest_finish,
                    "驳回补改最晚参考": items[0].latest_if_rework,
                }
            )


def write_schedule_notes(assignments: list[RowAssignment], folder_summary: pd.DataFrame) -> None:
    notes = OUTPUT_ROOT / "00_排期说明.txt"
    total_images = len(assignments)
    total_batches = max(item.batch_index for item in assignments)
    total_dates = max(item.date_slot for item in assignments)
    risk_images = sum(1 for item in assignments if item.risk_level != "常规")
    lines = [
        "广审排期说明",
        "",
        "排期口径：",
        "1. 仅保留正面图。",
        "2. 同一产品仅保留一张正面图，按主汇总表中首次出现顺序保留。",
        "3. 同一产品判定规则：按新图片名去掉角度信息后，再去掉明显规格尾巴（如 10只、3只、18只、无规格、主图）。",
        "4. 每批 10 张，每个提交日最多 2 波，共 20 张。",
        "5. 按每月 20 号提交，遇周末顺延到下一个工作日生成日期文件夹。",
        "6. 本次已覆盖删除旧的排期目录后重建。",
        "",
        f"筛选后图片数：{total_images}",
        f"总批次数：{total_batches}",
        f"总提交日数量：{total_dates}",
        f"命中敏感词的图片数：{risk_images}",
        "",
        "高风险关键词：玻尿酸、高潮、女生、延时",
        "中风险关键词：快感因子、单手打开、英文、持久、动感、旋转",
        "",
        "排期前 15 个产品：",
    ]
    preview = assignments[:15]
    for item in preview:
        lines.append(f"- {item.overall_order:02d}. {item.folder} | {item.new_name}")

    lines.extend(["", "各图包保留数量："])
    for row in folder_summary.itertuples(index=False):
        lines.append(
            f"- {row[0]}：保留 {row.selected_image_count} 张，高风险 {row.high_risk_count} 张，中风险 {row.medium_risk_count} 张，表内首次出现顺序 {row.first_table_row}"
        )
    notes.write_text("\n".join(lines), encoding="utf-8")


def write_date_folders_and_copy(assignments: list[RowAssignment]) -> None:
    grouped: dict[tuple[str, int], list[RowAssignment]] = defaultdict(list)
    for item in assignments:
        grouped[(item.submit_date, item.wave)].append(item)

    date_grouped: dict[str, list[tuple[int, list[RowAssignment]]]] = defaultdict(list)
    for (submit_date, wave), items in grouped.items():
        date_grouped[submit_date].append((wave, items))

    for submit_date, waves in sorted(date_grouped.items()):
        date_dir = OUTPUT_ROOT / submit_date
        date_dir.mkdir(parents=True, exist_ok=True)

        daily_summary: list[str] = [
            f"提交日期：{submit_date}",
            f"预计最早完成：{waves[0][1][0].earliest_finish}",
            f"预计最晚完成：{waves[0][1][0].latest_finish}",
            f"驳回补改最晚参考：{waves[0][1][0].latest_if_rework}",
            "",
        ]

        for wave, items in sorted(waves, key=lambda pair: pair[0]):
            wave_label = "第一波" if wave == 1 else "第二波"
            wave_dir = date_dir / f"{wave:02d}_{wave_label}_{len(items)}张"
            wave_dir.mkdir(parents=True, exist_ok=True)

            folders = list(dict.fromkeys(item.folder for item in items))
            daily_summary.extend(
                [
                    f"{wave_label}：{len(items)} 张",
                    f"涉及图包：{'；'.join(folders)}",
                    "",
                ]
            )

            detail_lines = [
                f"提交日期：{submit_date}",
                f"波次：{wave_label}",
                f"图片数：{len(items)}",
                f"预计最早完成：{items[0].earliest_finish}",
                f"预计最晚完成：{items[0].latest_finish}",
                f"驳回补改最晚参考：{items[0].latest_if_rework}",
                "",
                "清单：",
            ]

            for item in items:
                source_path = Path(item.image_path)
                folder_dir = wave_dir / item.folder
                folder_dir.mkdir(parents=True, exist_ok=True)
                target_path = folder_dir / item.new_name
                if source_path.exists():
                    shutil.copy2(source_path, target_path)
                risk = f" [{item.risk_level}:{item.risk_words}]" if item.risk_words else ""
                detail_lines.append(f"{item.overall_order:03d}. {item.folder} | {item.new_name}{risk}")
                detail_lines.append(f"    图包路径：{item.package_path}")
                detail_lines.append(f"    图片路径：{item.image_path}")

            (wave_dir / "本批次清单.txt").write_text("\n".join(detail_lines), encoding="utf-8")

        (date_dir / "00_当日汇总.txt").write_text("\n".join(daily_summary), encoding="utf-8")


def main() -> None:
    reset_output_root()
    assignments, folder_summary = build_schedule()
    write_detail_csv(assignments)
    write_batch_csv(assignments)
    write_schedule_notes(assignments, folder_summary)
    write_date_folders_and_copy(assignments)

    print(f"Created output root: {OUTPUT_ROOT}")
    print(f"Created detail csv: {DETAIL_CSV}")
    print(f"Created batch csv: {BATCH_CSV}")
    print(f"Filtered images: {len(assignments)}")
    print(f"Total submit dates: {max(item.date_slot for item in assignments)}")


if __name__ == "__main__":
    main()
