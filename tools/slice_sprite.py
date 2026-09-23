from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
INPUT_FILE = ROOT / "assets" / "jinshi.png"
OUTPUT_DIR = ROOT / "assets" / "frames"

MIN_AREA = 800
PADDING = 16

# Batas setiap baris berdasarkan sprite sheet milikmu
ROWS = [
    ("idle-blink", 0, 126),
    ("walk-right", 128, 268),
    ("run-right", 268, 401),
    ("sleep", 401, 523),
    ("greeting", 523, 660),
    ("celebrate", 660, 789),
    ("look-around", 789, 921),
    ("cute-gesture", 921, 1054),
    ("hug-plushie", 1054, 1184),
    ("directions-1", 1184, 1314),
    ("directions-2", 1314, 1470),
]

def extract_row_frames(image, alpha, folder_name, top, bottom):
    output_folder = OUTPUT_DIR / folder_name
    output_folder.mkdir(parents=True, exist_ok=True)

    # Hanya memproses satu baris
    row_alpha = alpha[top:bottom, :]

    mask = np.where(row_alpha > 10, 255, 0).astype(np.uint8)

    total_labels, _, stats, _ = cv2.connectedComponentsWithStats(
        mask,
        connectivity=8,
    )

    frames = []

    for label in range(1, total_labels):
        x, local_y, width, height, area = stats[label]

        if area < MIN_AREA:
            continue

        frames.append({
            "x": x,
            "y": top + local_y,
            "width": width,
            "height": height,
            "area": area,
        })

    # Karena sudah satu baris, cukup urutkan dari kiri ke kanan
    frames.sort(key=lambda frame: frame["x"])

    for index, frame in enumerate(frames, start=1):
        left = max(0, frame["x"] - PADDING)
        crop_top = max(top, frame["y"] - PADDING)

        right = min(
            image.width,
            frame["x"] + frame["width"] + PADDING,
        )

        crop_bottom = min(
            bottom,
            frame["y"] + frame["height"] + PADDING,
        )

        cropped = image.crop((
            left,
            crop_top,
            right,
            crop_bottom,
        ))

        output_file = output_folder / f"{index:02}.png"
        cropped.save(output_file)

        print(f"Saved: {folder_name}/{output_file.name}")

    print(f"{folder_name}: {len(frames)} frames\n")


def main():
    image = Image.open(INPUT_FILE).convert("RGBA")
    image_array = np.array(image)
    alpha = image_array[:, :, 3]

    for folder_name, top, bottom in ROWS:
        extract_row_frames(
            image=image,
            alpha=alpha,
            folder_name=folder_name,
            top=top,
            bottom=bottom,
        )


if __name__ == "__main__":
    main()