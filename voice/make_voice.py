# 홈페이지 가까움 단계 음성 메시지 만들기 (영어)
# 실행: C:\Crack\tts\Scripts\python make_voice.py [캐릭터 ...]
# 1) Kokoro 합성 목소리로 캐릭터별 "목소리 견본"(실존 인물 목소리 아님)을 만들고
# 2) Chatterbox가 그 견본 목소리로 감정을 실어 한 문장씩 말하게 한 뒤
# 3) 문장 사이에 숨 고르는 틈을 넣어 이어 붙여 mp3로 저장한다
import os, sys, numpy as np, torch, lameenc
HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "_ref"); os.makedirs(REF, exist_ok=True)

# 이름은 발음대로 적는다 (Jenis→Jennis, Maquia→Makia)
# id: (Kokoro 견본 목소리, 견본 속도, 감정 세기 0.25~1.0, cfg(낮을수록 느긋하고 여유), 온도, [(문장, 뒤에 쉬는 초)])
CAST = {
    "ruan": ("am_fenrir", 0.95, 0.55, 0.30, 0.8, [
        ("...Hey. It's me.", 0.7), ("Don't really have anything to say.", 0.6), ("Just... wanted to call.", 1.1), ("Hanging up.", 0.3)]),
    "jenis": ("bm_george", 1.0, 0.55, 0.40, 0.8, [
        ("Hi. It's Jennis.", 0.5), ("I'm in the hallway. The meeting just ended.", 0.8), ("...It's strange, hearing myself say this out loud.", 0.9), ("Sleep well. Really.", 0.3)]),
    "minos": ("am_onyx", 0.9, 0.45, 0.30, 0.7, [
        ("...Minos.", 0.8), ("I'm in the car. Nothing happened tonight.", 0.9), ("...Lock your door.", 0.6), ("Get some sleep.", 0.3)]),
    "rainer": ("am_michael", 0.92, 0.6, 0.30, 0.8, [
        ("It's me. Rainer.", 0.6), ("Closed up for the night... I'm sitting at the piano.", 0.8), ("But tonight, just my voice.", 1.0), ("...Good night.", 0.3)]),
    "anzi": ("am_puck", 1.0, 0.7, 0.40, 0.85, [
        ("Hm. Anzi here.", 0.4), ("I already hit record, so... I'll just say whatever.", 0.8), ("...No. Never mind.", 0.7), ("I just wanted you to hear my voice. Text me back.", 0.3)]),
    "jin": ("bm_daniel", 0.95, 0.45, 0.40, 0.7, [
        ("...This is Jin.", 0.5), ("This isn't a work report.", 0.8), ("...I'm off the clock now.", 0.9), ("That's all. I just wanted to tell you that.", 0.3)]),
    "maquia": ("bm_fable", 0.85, 0.4, 0.25, 0.7, [
        ("It's Makia.", 2.0), ("If you heard this...", 0.6), ("that's enough.", 0.3)]),
}
SEED_TEXT = ("I don't usually leave messages. But it's late, the city's quiet, "
             "and I kept thinking about what you said earlier. So, here I am.")

def make_ref(kid, voice, speed):
    path = os.path.join(REF, f"{kid}.wav")
    if os.path.exists(path): return path
    from kokoro import KPipeline
    import soundfile as sf
    pipe = KPipeline(lang_code="b" if voice.startswith("b") else "a")
    audio = np.concatenate([a.numpy() if hasattr(a, "numpy") else a for _, _, a in pipe(SEED_TEXT, voice=voice, speed=speed)])
    sf.write(path, audio, 24000)
    return path

def to_mp3(wav, sr, path):
    enc = lameenc.Encoder(); enc.set_bit_rate(96); enc.set_in_sample_rate(sr); enc.set_channels(1); enc.set_quality(2)
    pcm = (np.clip(wav, -1, 1) * 32767).astype(np.int16).tobytes()
    open(path, "wb").write(enc.encode(pcm) + enc.flush())

def main(ids):
    import perth
    if perth.PerthImplicitWatermarker is None: perth.PerthImplicitWatermarker = perth.DummyWatermarker  # 윈도우에서 워터마커가 안 불러와짐
    from chatterbox.tts import ChatterboxTTS
    model = ChatterboxTTS.from_pretrained(device="cuda" if torch.cuda.is_available() else "cpu")
    sr = model.sr
    for kid in ids:
        voice, speed, exag, cfg, temp, lines = CAST[kid]
        ref = make_ref(kid, voice, speed)
        torch.manual_seed(7)
        parts = [np.zeros(int(sr * 0.25), dtype=np.float32)]
        for text, gap in lines:
            w = model.generate(text, audio_prompt_path=ref, exaggeration=exag, cfg_weight=cfg, temperature=temp)
            w = w.squeeze().cpu().numpy().astype(np.float32)
            parts += [w, np.zeros(int(sr * gap), dtype=np.float32)]
        out = np.concatenate(parts)
        out = out / max(1e-6, np.abs(out).max()) * 0.89  # 크기 맞추기
        to_mp3(out, sr, os.path.join(HERE, f"{kid}.mp3"))
        print(kid, round(len(out) / sr, 1), "s")

if __name__ == "__main__":
    main(sys.argv[1:] or list(CAST))
