"""Create compact review sheets for the effect library without editing assets."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
EFFECTS = ROOT / "public" / "assets" / "effects"
OUT = ROOT / "test-results"
OUT.mkdir(exist_ok=True)
folders = [p for p in EFFECTS.rglob("*") if p.is_dir() and list(p.glob("*.png"))]
for page in range((len(folders) + 8) // 9):
    sheet = Image.new("RGB", (1500, 1500), "#0a0d10")
    draw = ImageDraw.Draw(sheet)
    for index, folder in enumerate(folders[page * 9:(page + 1) * 9]):
        x, y = (index % 3) * 500, (index // 3) * 500
        files = sorted(folder.glob("*.png"), key=lambda p: tuple(int(v) for v in p.stem.split("_")[::2]))
        choices = [files[0], files[len(files) // 2], files[-1]]
        draw.text((x + 12, y + 10), str(folder.relative_to(EFFECTS)), fill="#e7cb8c")
        draw.text((x + 12, y + 32), f"{len(files)} frames · {Image.open(files[0]).size}", fill="#89959c")
        for frame_index, file in enumerate(choices):
            image = Image.open(file).convert("RGBA")
            image.thumbnail((145, 380), Image.Resampling.LANCZOS)
            px = x + 12 + frame_index * 160 + (145 - image.width) // 2
            py = y + 70 + (380 - image.height) // 2
            sheet.paste(image, (px, py), image)
            draw.text((x + 12 + frame_index * 160, y + 455), file.stem, fill="#bcc4c8")
    sheet.save(OUT / f"effect-library-{page + 1}.jpg", quality=90)
