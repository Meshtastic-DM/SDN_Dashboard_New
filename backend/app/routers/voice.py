from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.voice_service import (
    VoiceDependencyError,
    VoiceModelError,
    VoiceTimeoutError,
    VoiceTranscriptionError,
    get_voice_status,
    transcribe_wav_bytes,
)

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.get("/status")
async def voice_status():
    return {"status": "success", **get_voice_status()}


@router.post("/transcribe")
async def transcribe_voice(audio: UploadFile = File(...)):
    if audio.content_type not in {"audio/wav", "audio/wave", "audio/x-wav"}:
        raise HTTPException(
            status_code=400,
            detail="Unsupported audio format. Please upload WAV audio.",
        )

    try:
        audio_bytes = await audio.read()
        text = transcribe_wav_bytes(audio_bytes)
        return {"status": "success", "text": text}
    except (VoiceDependencyError, VoiceModelError) as exc:
        print(f"Voice transcription is not ready: {exc}")
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except VoiceTimeoutError as exc:
        print(f"Voice transcription timed out: {exc}")
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except VoiceTranscriptionError as exc:
        print(f"Voice transcription failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
