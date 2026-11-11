# 홈페이지 가까움 단계 음성 메시지 만들기 (영어)
# 메시지가 아니라, 각자 일하다 디바이스가 우연히 녹음해 보낸 일상의 한 토막
# 실행: C:\Crack\tts\Scripts\python make_voice.py [캐릭터 ...]
# 1) Kokoro 합성 목소리로 캐릭터별 "목소리 견본"을 만들고(실존 인물 목소리 아님), 필요하면 음을 낮춰 굵게 한 뒤
# 2) Chatterbox가 그 견본 목소리로 감정을 실어 한 문장씩 말하게 하고
# 3) 문장 사이에 쉬는 틈을 넣어 이어 붙여 mp3로 저장한다 (out_shift가 있으면 완성본 음도 낮춘다)
import os, sys, numpy as np, torch, lameenc, librosa, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "_ref"); os.makedirs(REF, exist_ok=True)

# 이름은 발음대로 적는다 (Jenis→Jennis, Maquia→Makia)
# id: dict(v=Kokoro 견본, sp=견본 속도, ref=견본 음 낮추기(반음), out=완성본 음 낮추기(반음),
#          ex=감정 세기 0.25~1.0, cfg=낮을수록 느긋하게, t=온도, lines=[(문장, 뒤에 쉬는 초)])
CAST = {
    # 혼잣말 — 시동 안 걸리는 바이크
    "ruan": dict(v="am_puck", sp=1.0, ref=0, out=0, ex=0.65, cfg=0.35, t=0.85, lines=[
        ("Come on. Start.", 0.9), ("...Piece of junk.", 1.0), ("Fine. Fine.", 0.5), ("I'll walk you home, then.", 0.3)]),
    # 취재원과 통화 — 굵고 거칠게
    "anzi": dict(v="am_fenrir", sp=0.95, ref=-4, out=-1, ex=0.6, cfg=0.35, t=0.85, lines=[
        ("No, no. I don't need his name.", 0.4), ("I need where he was at three in the morning.", 0.9), ("...Yeah. Call me when you have it.", 1.1), ("Hm. This is gonna be good.", 0.3)]),
    # 비서에게 — 부드러운 미성, 남자답게
    "jenis": dict(v="am_liam", sp=0.95, ref=-1, out=0, ex=0.5, cfg=0.4, t=0.8, lines=[
        ("Move the nine o'clock to tomorrow.", 0.9), ("...No, I'm fine. I just haven't slept.", 0.8), ("And coffee. Black.", 0.5), ("Thank you.", 0.3)]),
    # 무전 — 목소리 그대로
    "minos": dict(v="am_onyx", sp=0.9, ref=0, out=0, ex=0.45, cfg=0.3, t=0.7, lines=[
        ("Dispatch, unit four. Scene's clear.", 0.9), ("...No. No witnesses.", 0.8), ("Copy. Heading back.", 1.0), ("...Coffee first.", 0.3)]),
    # 마감 뒤 들어온 단골에게 — 상냥한 미성, 살짝 굵게
    "rainer": dict(v="am_michael", sp=0.92, ref=-1, out=0, ex=0.6, cfg=0.3, t=0.8, lines=[
        ("We're closed, sorry.", 0.8), ("...Oh. It's you.", 0.6), ("Come in, come in.", 0.4), ("Sit wherever you like.", 0.6), ("I'll make you something warm.", 0.3)]),
    # 늦은 보고서를 낸 부하에게 — 아주 느리고 낮은 영국식, 말끝을 끈다
    "jin": dict(v="bm_george", sp=0.85, ref=-3, out=0, ex=0.4, cfg=0.25, t=0.7, lines=[
        ("Again.", 1.2), ("You filed this report... three hours late.", 0.7), ("Again.", 1.2), ("I don't want excuses.", 0.6), ("On my desk. Before sunrise.", 0.3)]),
    # 누군가를 맞이하는 — 가장 굵고 어둡고 낮게, 느리게
    "maquia": dict(v="am_onyx", sp=0.8, ref=-4, out=-2, ex=0.35, cfg=0.2, t=0.65, lines=[
        ("You came alone.", 1.4), ("...Good.", 1.2), ("Sit with me.", 1.0), ("The night is long.", 0.3)]),
}
SEED_TEXT = ("I don't usually leave messages. But it's late, the city's quiet, "
             "and I kept thinking about what you said earlier. So, here I am.")

def make_ref(kid, c):
    path = os.path.join(REF, f"{kid}_{c['v']}_{c['sp']}_{c['ref']}.wav")
    if os.path.exists(path): return path
    from kokoro import KPipeline
    pipe = KPipeline(lang_code="b" if c["v"].startswith("b") else "a")
    audio = np.concatenate([a.numpy() if hasattr(a, "numpy") else a for _, _, a in pipe(SEED_TEXT, voice=c["v"], speed=c["sp"])])
    if c["ref"]: audio = librosa.effects.pitch_shift(audio.astype(np.float32), sr=24000, n_steps=c["ref"])
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
        c = CAST[kid]; ref = make_ref(kid, c)
        torch.manual_seed(7)
        parts = [np.zeros(int(sr * 0.3), dtype=np.float32)]
        for text, gap in c["lines"]:
            w = model.generate(text.replace("Jenis", "Jennis").replace("Maquia", "Makia"), audio_prompt_path=ref,
                               exaggeration=c["ex"], cfg_weight=c["cfg"], temperature=c["t"])
            parts += [w.squeeze().cpu().numpy().astype(np.float32), np.zeros(int(sr * gap), dtype=np.float32)]
        out = np.concatenate(parts)
        if c["out"]: out = librosa.effects.pitch_shift(out, sr=sr, n_steps=c["out"])
        out = out / max(1e-6, np.abs(out).max()) * 0.89
        to_mp3(out, sr, os.path.join(HERE, f"{kid}.mp3"))
        print(kid, round(len(out) / sr, 1), "s", flush=True)

if __name__ == "__main__":
    main(sys.argv[1:] or list(CAST))
