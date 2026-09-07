"""Convert generated checker-preview atlases into real transparent PNG assets.

Image generation occasionally bakes its transparency preview into RGB pixels.
Only neutral, bright pixels connected to the canvas edge are removed here, so
white spell cores enclosed by coloured artwork remain intact.
"""

from collections import deque
from pathlib import Path
from PIL import Image


def make_transparent(path: Path) -> None:
    source = Image.open(path).convert("RGB")
    width, height = source.size
    pixels = source.load()
    outside = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def background(x: int, y: int) -> bool:
        red, green, blue = pixels[x, y]
        return min(red, green, blue) >= 222 and max(red, green, blue) - min(red, green, blue) <= 10

    for x in range(width):
        for y in (0, height - 1):
            if background(x, y):
                queue.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if background(x, y):
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if outside[index] or not background(x, y):
            continue
        outside[index] = 1
        if x:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    output = source.convert("RGBA")
    rgba = output.load()
    for y in range(height):
        for x in range(width):
            # Remove enclosed preview cells as well (for example the empty
            # centre of a ring effect). Coloured near-white spell cores retain
            # enough channel separation to survive this neutral-only key.
            if outside[y * width + x] or background(x, y):
                rgba[x, y] = (0, 0, 0, 0)
    output.save(path, optimize=True)


if __name__ == "__main__":
    for atlas in Path("public/assets/effects/v14").glob("*.png"):
        make_transparent(atlas)
        print(f"prepared {atlas}")
