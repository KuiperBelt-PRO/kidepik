from __future__ import annotations

from pathlib import Path

import pytest

from app.services.dictation_tts import (
    FEMALE_VOICES,
    MALE_VOICES,
    cached_audio_url,
    pcm16_to_wav,
    pick_dictation_voice,
    write_cached_wav,
)


@pytest.mark.unit
def test_pcm16_to_wav_has_riff_header() -> None:
    pcm = b"\x00\x00" * 24
    wav = pcm16_to_wav(pcm, sample_rate=24000)
    assert wav[:4] == b"RIFF"
    assert wav[8:12] == b"WAVE"
    assert len(wav) > len(pcm)


@pytest.mark.unit
def test_cache_write_and_hit(tmp_path: Path) -> None:
    wav = pcm16_to_wav(b"\x01\x00" * 16)
    url = write_cached_wav(
        tmp_path,
        user_id="user-1",
        dictation_id="dict-1",
        wav_bytes=wav,
        public_base="/media",
    )
    assert url == "/media/audio/user-1/dict-1.wav"
    assert (tmp_path / "audio" / "user-1" / "dict-1.wav").is_file()
    assert cached_audio_url(tmp_path, "user-1", "dict-1") == url


@pytest.mark.unit
def test_cache_miss() -> None:
    assert cached_audio_url(Path("/no/such"), "u", "d") is None


@pytest.mark.unit
def test_pick_voice_is_stable_and_gendered() -> None:
    a1, g1 = pick_dictation_voice("dict-aaa")
    a2, g2 = pick_dictation_voice("dict-aaa")
    assert a1 == a2
    assert g1 == g2
    assert a1 in FEMALE_VOICES or a1 in MALE_VOICES
    if g1 == "female":
        assert a1 in FEMALE_VOICES
    else:
        assert a1 in MALE_VOICES
    genders = {pick_dictation_voice(f"id-{i}")[1] for i in range(40)}
    assert genders == {"female", "male"}
