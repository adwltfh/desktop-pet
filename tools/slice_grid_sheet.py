"""Potong sprite sheet bergrid seragam jadi frame PNG.

Beda dengan `slice_sprite.py` yang menebak batas frame lewat proyeksi alpha,
sheet di sini sudah rapi: tiap sel berukuran sama. Peta grid-nya dibaca dari
file JSON di `assets/` yang namanya diberikan lewat argumen, misal:

    python tools/slice_grid_sheet.py assets/jinshi-activities.json

Tanpa argumen, semua peta di DEFAULT_MAPS diproses.

Yang penting di sini bukan cara memotongnya, tapi hasilnya harus satu skala
dengan frame lama di `assets/frames/`. Kalau tidak, pet berubah besar-kecil
tiap ganti animasi. Jadi:

- ukuran kanvas keluaran disamakan dengan frame lama (dibaca otomatis)
- sheet diperkecil dengan satu faktor tetap per sheet, lihat `sheetScale`
  di peta JSON-nya
- satu sel dipotong utuh (bukan pas di kotak isi) supaya gerakan karakter di
  dalam sel tetap terjaga dan tidak bergetar antar frame
- tiap baris diratakan pada garis lantai barisnya, sama seperti slicer lama
- gumpalan yang melayang di atas atau di bawah kepala dibuang. Itu sisa baris
  tetangganya yang ikut terbawa waktu sheet dibuat, bukan bagian gambarnya.

Sheet yang frame-nya tidak duduk di grid ditangani `slice_packed_sheet.py`.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from sheet_common import (
    ASSETS_DIR,
    OUTPUT_DIR,
    FLOOR_PADDING,
    alpha_mask,
    clean_cell,
    clear_folder,
    content_box,
    read_reference,
)

DEFAULT_MAPS = [ASSETS_DIR / "jinshi-activities.json"]

# Sel yang tintanya di bawah ini dianggap kosong (sisa baris yang tidak penuh)
EMPTY_CELL_INK = 2000


def read_rows(sheet, sheet_map):
    """Sel yang sudah dibersihkan beserta kotak isinya, per baris."""
    cell_width = sheet_map["cellWidth"]
    cell_height = sheet_map["cellHeight"]

    rows = []

    for name, spec in sheet_map["animations"].items():
        top = spec["row"] * cell_height
        frames = []

        for column in range(sheet_map["columns"]):
            left = column * cell_width

            cell = sheet.crop((
                left,
                top,
                left + cell_width,
                top + cell_height,
            ))

            ink = alpha_mask(cell).sum()

            if ink < EMPTY_CELL_INK:
                continue

            cell = clean_cell(cell)

            frames.append({
                "cell": cell,
                "box": content_box(alpha_mask(cell)),
            })

        if len(frames) != spec["frames"]:
            raise SystemExit(
                f"{name}: peta menyebut {spec['frames']} frame, "
                f"terdeteksi {len(frames)}"
            )

        rows.append({
            "name": name,
            "folder": spec["folder"],
            "frames": frames,
        })

    return rows


def slice_sheet(map_file, canvas_size, reference_height):
    sheet_map = json.loads(map_file.read_text(encoding="utf-8"))

    sheet = Image.open(ASSETS_DIR / sheet_map["image"]).convert("RGBA")

    expected = (
        sheet_map["columns"] * sheet_map["cellWidth"],
        sheet_map["rows"] * sheet_map["cellHeight"],
    )

    if sheet.size != expected:
        raise SystemExit(f"Sheet {sheet.size}, peta mengharapkan {expected}")

    canvas_width, canvas_height = canvas_size

    rows = read_rows(sheet, sheet_map)
    scale = sheet_map["sheetScale"]

    cell_width = sheet_map["cellWidth"]
    cell_height = sheet_map["cellHeight"]

    scaled_width = max(1, round(cell_width * scale))
    scaled_height = max(1, round(cell_height * scale))

    floor_y = canvas_height - FLOOR_PADDING

    content_height = float(np.median([
        (frame["box"][3] - frame["box"][1]) * scale
        for row in rows
        for frame in row["frames"]
    ]))

    print(
        f"{map_file.name}: kanvas {canvas_width}x{canvas_height}, "
        f"skala {scale:.4f}\n"
        f"Tinggi isi {content_height:.0f}px, "
        f"frame lama {reference_height:.0f}px\n"
    )

    for row in rows:
        output_folder = OUTPUT_DIR / row["folder"]

        clear_folder(output_folder)

        # Garis lantai baris, bukan per frame, supaya pose melayang
        # (lompat, jatuh) tetap terlihat melayang.
        row_floor = max(frame["box"][3] for frame in row["frames"])
        widest = max(frame["box"][2] - frame["box"][0] for frame in row["frames"])

        if round(widest * scale) > canvas_width:
            print(
                f"  ! {row['folder']}: lebar {round(widest * scale)}px "
                f"melebihi kanvas {canvas_width}px"
            )

        for index, frame in enumerate(row["frames"], start=1):
            cell = frame["cell"].resize(
                (scaled_width, scaled_height),
                Image.LANCZOS,
            )

            canvas = Image.new(
                "RGBA",
                (canvas_width, canvas_height),
                (0, 0, 0, 0),
            )

            # Sel yang sudah diperkecil boleh lebih besar dari kanvas; yang
            # terpotong cuma margin kosongnya, karakternya ada di tengah.
            canvas.paste(
                cell,
                (
                    round((canvas_width - scaled_width) / 2),
                    round(floor_y - row_floor * scale),
                ),
            )

            canvas.save(output_folder / f"{index:02}.png")

        print(f"{row['folder']}: {len(row['frames'])} frame")


def main():
    map_files = (
        [Path(argument).resolve() for argument in sys.argv[1:]]
        or DEFAULT_MAPS
    )

    canvas_size, reference_height = read_reference()

    for map_file in map_files:
        slice_sheet(map_file, canvas_size, reference_height)


if __name__ == "__main__":
    main()
