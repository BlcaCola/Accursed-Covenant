"""Normalize the user-authored effect library to stable deploy-safe paths.

The operation is idempotent: existing English destinations are left untouched,
and every move is validated to stay below public/assets/effects.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "assets" / "effects"
TOP_LEVEL = {
    "爆炸（场景通用）": "explosion",
    "冲击波（角色）": "character-shockwave",
    "出土特效（场景通用）": "emerge",
    "地刺钻出地面（场景通用）": "ground-spikes",
    "地面火焰持续燃烧（场景通用）": "burning-ground",
    "毒气（场景通用）": "poison-cloud",
    "毒气扩散（场景通用）": "poison-spread",
    "骨刺射出（场景通用）": "bone-projectile",
    "横向劈砍（角色）": "character-horizontal-slash",
    "红色光轮（场景通用）": "red-aura-wheel",
    "红色光圈特效": "red-ground-ring",
    "红色能量球（场景通用）": "red-energy-orb",
    "回复药用特效（角色）": "character-heal",
    "火龙落地爆炸（场景通用）": "dragon-impact",
    "火焰（场景通用）": "flame-column",
    "火焰2（场景通用）": "flame-column-alt",
    "火焰射出（角色）": "character-fire-cast",
    "经验球专用": "experience-orb",
    "巨大闪光（场景通用）": "great-flash",
    "巨石落地（场景通用）": "boulder-impact",
    "蓝色发光特效（场景通用）": "blue-glow",
    "蓝色光轮（场景通用）": "blue-aura-wheel",
    "蓝色能量球（场景通用）": "blue-energy-orb",
    "蓝色施法（角色）": "character-blue-cast",
    "雷电大招专用（场景通用）": "lightning-ultimate",
    "雷电扩散特效（场景通用）": "lightning-spread",
    "利爪抓挠（角色）": "character-claw",
    "绿色光圈特效": "green-ground-ring",
    "落地火焰爆炸（场景通用）": "fire-impact",
    "落雷（场景通用）": "lightning-strike",
    "魔法大招专用（场景通用）": "arcane-ultimate",
    "喷火（角色）": "character-flamethrower",
    "闪电（场景通用）": "lightning-bolt",
    "闪电射出（角色）": "character-lightning-cast",
    "闪烁": "sparkle",
    "手里剑射出（角色）": "character-shuriken",
    "竖向劈砍（角色）": "character-vertical-slash",
    "斜向劈砍（角色）": "character-diagonal-slash",
    "陨石落地特效（场景通用）": "meteor-impact",
    "npc提示感叹号": "npc-alert",
    "npc提示问号": "npc-question",
    "传送门": "portal",
    "各种框特效": "frame-effects",
}
NESTED = {
    "portal": {"传送门地面": "ground", "传送门内部": "interior", "金色传送门本体": "gold-body"},
    "frame-effects": {"0": "frame-01", **{f"0 ({i})": f"frame-{i:02d}" for i in range(2, 11)}},
}
ROOT_FILES = {"商人地摊.png": "merchant-stall.png"}


def move_children(parent: Path, mapping: dict[str, str]) -> None:
    root = ROOT.resolve()
    for source_name, target_name in mapping.items():
        source, target = parent / source_name, parent / target_name
        if target.exists() or not source.exists():
            continue
        if root not in source.resolve().parents or root not in target.resolve().parents:
            raise RuntimeError(f"Refusing path outside effect root: {source}")
        source.rename(target)


if __name__ == "__main__":
    move_children(ROOT, TOP_LEVEL)
    move_children(ROOT, ROOT_FILES)
    for folder, mapping in NESTED.items():
        move_children(ROOT / folder, mapping)
    print("Effect asset paths normalized.")
