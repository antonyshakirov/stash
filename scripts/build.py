#!/usr/bin/env python3
"""Сборка пакетов Stash для Chrome и Firefox.

Манифест один — `manifest.json`, он же лежит распакованным для Chrome.
Firefox-вариант не хранится вторым файлом, а получается из основного вот этой
правкой: два манифеста неизбежно разъехались бы на первом же новом разрешении.

    python3 scripts/build.py

Кладёт в `dist/`:
    stash-chrome-<версия>.zip     — грузится распакованным или в Web Store
    stash-firefox-<версия>.zip    — уходит в Mozilla на подпись
    updates.json                  — карта обновлений для самостоятельной раздачи
"""

import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

# Куда лягут подписанный XPI и эта же карта обновлений. Firefox ходит за
# картой по адресу из манифеста и ставит версию выше установленной.
SITE = "https://antonshakirov.com/stash"
GECKO_ID = "stash@antonshakirov.com"

# Порог задан тремя ограничениями, из которых берём самое высокое.
# Firefox 127 первым стал спрашивать host_permissions прямо в окне установки:
# ниже этой границы человек ставил бы расширение, которое молча ничего не
# делает. Firefox 128 — первая версия с `world: "MAIN"`, без которого
# перехватчик не попадёт в контекст страницы. Firefox 140 — первая, которая
# понимает `data_collection_permissions`; на версиях ниже ключ игнорируется,
# и заявление «ничего не собираем» до человека просто не доедет.
FIREFOX_MIN = "140.0"

# Что попадает в пакет. Тесты, спеки и скрипты сборки — не попадают.
INCLUDE = ["manifest.json", "LICENSE", "icons", "src", "options"]


def firefox_manifest(manifest: dict) -> dict:
    """Основной манифест, приведённый к тому, что понимает Firefox."""
    patched = json.loads(json.dumps(manifest))

    # Firefox не поддерживает background.service_worker (баг 1573659) и ждёт
    # обычный фоновый скрипт.
    patched["background"] = {"scripts": [manifest["background"]["service_worker"]]}

    # Без явного идентификатора расширение нельзя ни подписать, ни обновлять
    # со своего сайта: Firefox узнаёт установленное именно по нему.
    patched["browser_specific_settings"] = {
        "gecko": {
            "id": GECKO_ID,
            "strict_min_version": FIREFOX_MIN,
            # Обязательно для новых расширений: Firefox спрашивает у автора,
            # какие данные тот собирает, и показывает ответ человеку. Stash не
            # собирает никаких, отсюда "none".
            "data_collection_permissions": {"required": ["none"]},
            # Раздача идёт со своего сайта, поэтому за обновлениями Firefox
            # ходит к нам. Для расширения, размещённого у Mozilla, этот ключ
            # запрещён, и подавать пакет нужно как unlisted.
            "update_url": f"{SITE}/updates.json",
        },
        # На Android раздача со своего сайта не работает вовсе, а сам Stash —
        # инструмент настольный. Порог указан только затем, чтобы заявление о
        # сборе данных было честным и там: его понимает Firefox 142 и выше.
        "gecko_android": {"strict_min_version": "142.0"},
    }
    return patched


def stage(target: str, manifest: dict) -> Path:
    """Раскладывает дерево пакета в dist/<target>/ с подсунутым манифестом.

    Дерево остаётся на диске не только ради архива: `web-ext lint` проверяет
    именно папку, и без неё пакет пришлось бы распаковывать руками.
    """
    root = DIST / target
    root.mkdir(parents=True)

    for entry in INCLUDE:
        source = ROOT / entry
        if entry == "manifest.json":
            continue
        if source.is_file():
            shutil.copy2(source, root / entry)
            continue
        for path in sorted(source.rglob("*")):
            if path.is_file() and not path.name.startswith("."):
                destination = root / path.relative_to(ROOT)
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, destination)

    (root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return root


def pack(name: str, tree: Path) -> Path:
    """Складывает разложенное дерево в архив."""
    target = DIST / name
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as package:
        for path in sorted(tree.rglob("*")):
            if path.is_file():
                package.write(path, str(path.relative_to(tree)))
    return target


def main() -> None:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    version = manifest["version"]

    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()

    chrome = pack(f"stash-chrome-{version}.zip", stage("chrome", manifest))
    firefox = pack(f"stash-firefox-{version}.zip", stage("firefox", firefox_manifest(manifest)))

    # Карта обновлений ссылается на подписанный XPI, который Mozilla вернёт
    # после проверки пакета. Имя файла задаём мы, так что знать его заранее
    # можно.
    updates = {
        "addons": {
            GECKO_ID: {
                "updates": [
                    {
                        "version": version,
                        "update_link": f"{SITE}/stash-{version}.xpi",
                    }
                ]
            }
        }
    }
    (DIST / "updates.json").write_text(
        json.dumps(updates, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    for path in (chrome, firefox):
        print(f"{path.relative_to(ROOT)}  {path.stat().st_size // 1024} КБ")
    print("dist/updates.json")


if __name__ == "__main__":
    main()
