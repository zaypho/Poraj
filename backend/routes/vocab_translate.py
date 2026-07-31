"""Vocab translation layer.

Words are stored once with English source (`term` + `example`). At request
time, if the client asks for a non-English language, we ensure that language
is cached on every word in the topic — then return the localised copy. All
translation calls are batched (one LLM request per topic × language) and the
results are stored on the word document under the `translations` map:

    translations = {
        "ko": {"term": "...", "example": "..."},
        "zh": {"term": "...", "example": "..."},
        ...
    }

The English source is the default and treated as always cached.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any

from db import db

logger = logging.getLogger(__name__)

# ISO code → human name used in the LLM prompt.
SUPPORTED_LANGUAGES: dict[str, str] = {
    "en": "English",
    "ko": "Korean",
    "zh": "Chinese (Simplified)",
    "ja": "Japanese",
    "ar": "Arabic",
    "es": "Spanish",
    "pt": "Portuguese",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "ru": "Russian",
    "tr": "Turkish",
    "hi": "Hindi",
    "bn": "Bengali",
    "vi": "Vietnamese",
}

# Map fuzzy input (language names as stored in profiles) to ISO code so
# `learning_language: "Korean"` and `lang=ko` both resolve to `"ko"`.
_NAME_TO_CODE = {
    "en": "en", "english": "en",
    "ko": "ko", "korean": "ko",
    "zh": "zh", "chinese": "zh", "mandarin": "zh", "simplified chinese": "zh",
    "ja": "ja", "japanese": "ja",
    "ar": "ar", "arabic": "ar",
    "es": "es", "spanish": "es", "español": "es",
    "pt": "pt", "portuguese": "pt", "português": "pt",
    "fr": "fr", "french": "fr", "français": "fr",
    "de": "de", "german": "de", "deutsch": "de",
    "it": "it", "italian": "it", "italiano": "it",
    "ru": "ru", "russian": "ru", "русский": "ru",
    "tr": "tr", "turkish": "tr", "türkçe": "tr",
    "hi": "hi", "hindi": "hi", "हिन्दी": "hi",
    "bn": "bn", "bengali": "bn", "bangla": "bn", "বাংলা": "bn",
    "vi": "vi", "vietnamese": "vi", "tiếng việt": "vi",
}


def normalize_lang(value: str | None) -> str:
    """Return the canonical ISO code for a language hint (case-insensitive).

    Falls back to English if the input is missing / unsupported so callers can
    always render *something*.
    """
    if not value:
        return "en"
    key = value.strip().lower()
    return _NAME_TO_CODE.get(key, "en")


# Concurrency guard so simultaneous requests don't launch duplicate translation
# jobs for the same (topic, lang) pair.
_locks: dict[tuple[str, str], asyncio.Lock] = {}


def _lock(topic_id: str, lang: str) -> asyncio.Lock:
    key = (topic_id, lang)
    if key not in _locks:
        _locks[key] = asyncio.Lock()
    return _locks[key]


_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json(text: str) -> Any:
    """Attempt to parse a JSON object anywhere in the LLM's response.

    Gemini sometimes wraps output in fences / prose — this pulls out the first
    balanced `{ ... }` and json-loads it.  Returns `None` if nothing parseable.
    """
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    match = _JSON_BLOCK_RE.search(text)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except Exception:
        return None


async def _translate_batch(
    lang_code: str, items: list[dict[str, str]]
) -> dict[str, dict[str, str]]:
    """Translate every item's `term` + `example` into `lang_code`.

    Uses the free `deep-translator` Google backend so we don't depend on a
    paid LLM budget.  Failures fall back to the English source per item so we
    never render blanks.
    """
    if not items:
        return {}
    if lang_code == "en":
        return {i["id"]: {"term": i["term"], "example": i.get("example", "")} for i in items}

    def _run() -> dict[str, dict[str, str]]:
        try:
            from deep_translator import GoogleTranslator  # type: ignore
        except Exception as e:
            logger.warning("deep-translator import failed: %s", e)
            return {}
        # `deep-translator` uses `zh-CN`/`zh-TW` while our public ISO code is `zh`.
        # Map to a variant the underlying Google endpoint accepts. All other
        # ISO codes below match Google Translate directly.
        google_lang = {
            "zh": "zh-CN",
            "ja": "ja",
            "ko": "ko",
            "ar": "ar",
            "es": "es",
            "pt": "pt",
            "en": "en",
            "fr": "fr",
            "de": "de",
            "it": "it",
            "ru": "ru",
            "tr": "tr",
            "hi": "hi",
            "bn": "bn",
            "vi": "vi",
        }.get(lang_code, lang_code)
        try:
            translator = GoogleTranslator(source="en", target=google_lang)
        except Exception as e:
            logger.warning("GoogleTranslator init failed for %s: %s", google_lang, e)
            return {}
        out: dict[str, dict[str, str]] = {}
        for item in items:
            try:
                term = translator.translate(item["term"]) or item["term"]
            except Exception as e:
                logger.warning("term translate failed (%s → %s): %s", item["term"], lang_code, e)
                term = item["term"]
            example_src = item.get("example", "")
            example_tr = example_src
            if example_src:
                try:
                    example_tr = translator.translate(example_src) or example_src
                except Exception:
                    example_tr = example_src
            out[item["id"]] = {"term": term, "example": example_tr}
        return out

    try:
        results = await asyncio.to_thread(_run)
    except Exception as e:
        logger.exception("Threaded translate failed for %s: %s", lang_code, e)
        results = {}

    # Fill in fallbacks for any item the translator dropped.
    for i in items:
        if i["id"] not in results or not results[i["id"]].get("term"):
            results[i["id"]] = {"term": i["term"], "example": i.get("example", "")}
    return results


async def ensure_topic_translations(topic_id: str, lang: str) -> None:
    """Guarantee every word in `topic_id` has a `translations.<lang>` entry.

    Returns quickly (no LLM call) when all words are already cached, so it's
    safe to call on every request.
    """
    lang = normalize_lang(lang)
    if lang == "en":
        return  # English is always the source; nothing to cache.

    words_col = db["vocab_words"]
    needing = await words_col.find(
        {
            "topic_id": topic_id,
            "$or": [
                {"translations": {"$exists": False}},
                {f"translations.{lang}.term": {"$in": [None, ""]}},
                {f"translations.{lang}": {"$exists": False}},
            ],
        }
    ).to_list(500)
    if not needing:
        return

    async with _lock(topic_id, lang):
        # Re-check under lock in case another task already translated.
        needing = await words_col.find(
            {
                "topic_id": topic_id,
                "$or": [
                    {f"translations.{lang}.term": {"$in": [None, ""]}},
                    {f"translations.{lang}": {"$exists": False}},
                ],
            }
        ).to_list(500)
        if not needing:
            return
        items = [
            {"id": w["_id"], "term": w["term"], "example": w.get("example", "")}
            for w in needing
        ]
        results = await _translate_batch(lang, items)
        for wid, tr in results.items():
            await words_col.update_one(
                {"_id": wid},
                {"$set": {f"translations.{lang}": tr}},
            )
        logger.info(
            "Cached %d %s translations for topic %s", len(results), lang, topic_id
        )


def localize_word(word: dict, lang: str) -> dict:
    """Return a copy of the word with `term` / `example` swapped to `lang`.

    Also exposes `source_term` and `source_example` (always the English text)
    so the client can show the source next to the learner's language when
    useful (e.g. a flashcard where the back reveals both).
    """
    lang = normalize_lang(lang)
    if lang == "en":
        return {
            **word,
            "source_term": word.get("term", ""),
            "source_example": word.get("example", ""),
            "lang": "en",
        }
    tr = ((word.get("translations") or {}).get(lang) or {})
    return {
        **word,
        "term": tr.get("term") or word.get("term", ""),
        "example": tr.get("example") or word.get("example", ""),
        "source_term": word.get("term", ""),
        "source_example": word.get("example", ""),
        "lang": lang,
    }
