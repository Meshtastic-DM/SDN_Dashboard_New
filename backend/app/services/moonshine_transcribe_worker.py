import argparse
import json
import os
import sys
from typing import Any, Optional


def _coerce_model_arch(value: Optional[str]) -> Any:
    if value is None:
        return None
    try:
        from moonshine_voice import string_to_model_arch

        return string_to_model_arch(value)
    except Exception:
        pass
    try:
        return int(value)
    except ValueError:
        return value


def _default_model_arch() -> Any:
    try:
        from moonshine_voice import ModelArch

        return ModelArch.TINY
    except Exception:
        return 0


def _extract_text(transcript: Any) -> str:
    if transcript is None:
        return ""
    if isinstance(transcript, str):
        return transcript.strip()

    lines = getattr(transcript, "lines", None)
    if lines is None and isinstance(transcript, dict):
        lines = transcript.get("lines")

    if lines is not None:
        parts = []
        for line in lines:
            text = getattr(line, "text", None)
            if text is None and isinstance(line, dict):
                text = line.get("text")
            if text:
                parts.append(str(text).strip())
        return " ".join(part for part in parts if part).strip()

    text = getattr(transcript, "text", None)
    if text:
        return str(text).strip()

    return str(transcript).strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wav-path", required=True)
    parser.add_argument("--language", default=os.getenv("MOONSHINE_LANGUAGE", "en"))
    parser.add_argument("--model-path", default=os.getenv("MOONSHINE_MODEL_PATH"))
    parser.add_argument("--model-arch", default=os.getenv("MOONSHINE_MODEL_ARCH"))
    args = parser.parse_args()

    try:
        import moonshine_voice
        from moonshine_voice import Transcriber, load_wav_file

        model_arch = _coerce_model_arch(args.model_arch) or _default_model_arch()
        model_path = args.model_path
        if not model_path:
            model_path, model_arch = moonshine_voice.get_model_for_language(
                args.language,
                model_arch,
            )

        transcriber = Transcriber(model_path=model_path, model_arch=model_arch)
        audio_data, sample_rate = load_wav_file(args.wav_path)
        transcript = transcriber.transcribe_without_streaming(audio_data, sample_rate)

        print(json.dumps({"text": _extract_text(transcript)}))
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
