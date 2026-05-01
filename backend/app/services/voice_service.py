import os
import subprocess
import sys
import tempfile
import importlib.util
import json
from typing import Optional


class VoiceTranscriptionError(RuntimeError):
    pass


class VoiceDependencyError(VoiceTranscriptionError):
    pass


class VoiceModelError(VoiceTranscriptionError):
    pass


class VoiceTimeoutError(VoiceTranscriptionError):
    pass


def get_voice_status() -> dict:
    installed = importlib.util.find_spec("moonshine_voice") is not None
    model_path = os.getenv("MOONSHINE_MODEL_PATH")
    model_arch = os.getenv("MOONSHINE_MODEL_ARCH")

    return {
        "installed": installed,
        "model_path_configured": bool(model_path),
        "model_arch_configured": bool(model_arch),
        "language": os.getenv("MOONSHINE_LANGUAGE", "en"),
        "model_arch": model_arch or "TINY",
        "timeout_seconds": int(os.getenv("MOONSHINE_TRANSCRIBE_TIMEOUT", "120")),
        "ready": installed,
    }


def transcribe_wav_bytes(audio_bytes: bytes) -> str:
    if not audio_bytes:
        raise VoiceTranscriptionError("No audio data was received.")

    if importlib.util.find_spec("moonshine_voice") is None:
        raise VoiceDependencyError(
            "Moonshine Voice is not installed. Install backend requirements with "
            "`pip install -r backend/requirements.txt`."
        )

    wav_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            temp_file.write(audio_bytes)
            wav_path = temp_file.name

        timeout_seconds = int(os.getenv("MOONSHINE_TRANSCRIBE_TIMEOUT", "120"))
        command = [
            sys.executable,
            "-m",
            "app.services.moonshine_transcribe_worker",
            "--wav-path",
            wav_path,
            "--language",
            os.getenv("MOONSHINE_LANGUAGE", "en"),
        ]

        model_path = os.getenv("MOONSHINE_MODEL_PATH")
        model_arch = os.getenv("MOONSHINE_MODEL_ARCH")
        if model_path:
            command.extend(["--model-path", model_path])
        if model_arch:
            command.extend(["--model-arch", model_arch])

        result = subprocess.run(
            command,
            cwd=os.getcwd(),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )

        if result.returncode != 0:
            stderr = result.stderr.strip()
            try:
                error = json.loads(stderr).get("error", stderr)
            except json.JSONDecodeError:
                error = stderr or result.stdout.strip()
            raise VoiceModelError(error or "Moonshine worker failed.")

        try:
            return json.loads(result.stdout.strip()).get("text", "").strip()
        except json.JSONDecodeError as exc:
            raise VoiceTranscriptionError(
                f"Moonshine worker returned invalid output: {result.stdout[-500:]}"
            ) from exc
    except subprocess.TimeoutExpired as exc:
        raise VoiceTimeoutError(
            "Moonshine transcription timed out while loading or running the model. "
            "Try restarting the backend, using MOONSHINE_MODEL_ARCH=0, or checking "
            "the Moonshine Windows runtime installation."
        ) from exc
    except VoiceTranscriptionError:
        raise
    except Exception as exc:
        raise VoiceTranscriptionError(f"Moonshine transcription failed: {exc}") from exc
    finally:
        if wav_path:
            try:
                os.remove(wav_path)
            except OSError:
                pass
