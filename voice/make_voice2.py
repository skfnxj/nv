# 홈페이지 가까움 단계 음성 메시지 (영어) — 2단계 방식
# 1) Orpheus TTS가 감정을 실어 대사를 "연기"한다 (<sigh>·<chuckle> 같은 소리 포함)
# 2) Chatterbox 음성 변환으로 그 연기에 캐릭터별 목소리 색깔을 입힌다 (Kokoro 합성 견본, 실존 인물 아님)
# 실행: C:\Crack\tts\Scripts\python make_voice2.py [캐릭터 ...]
import os, sys, numpy as np, torch, librosa, soundfile as sf, lameenc
HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "_ref"); PERF = os.path.join(HERE, "_perf")
os.makedirs(REF, exist_ok=True); os.makedirs(PERF, exist_ok=True)

# v=None이면 목소리 입히기 없이 Orpheus 연기 그대로
# o=Orpheus 연기자(leo·dan·zac), seed, v=Kokoro 목소리 견본, sp=견본 속도, ref=견본 음 낮추기(반음),
# pre=연기 음 낮추기(반음, 목소리 입히기 전에 해서 늘어짐 없음), text=연기 대본 ("|"로 나누면 따로 연기하고 gap초씩 쉰다)
CAST = {
    "ruan":   dict(o="zac", seed=3, v="am_puck", sp=1.0, ref=0,
                   text="Come on, start. Come on. <sigh> Piece of junk. Fine. Fine. <chuckle> I'll walk you home, then."),
    "anzi":   dict(o="leo", seed=1, v=None, sp=1.0, ref=0,
                   text="No, no, no. I don't need his name. I need where he was at three in the morning. ...Yeah. Call me when you have it. <chuckle> Oh, this is gonna be good."),
    "jenis":  dict(o="dan", seed=1, v="am_liam", sp=1.0, ref=-1,
                   text="Move the nine o'clock to tomorrow. ...No, no, I'm fine. <sigh> I just haven't slept. And coffee. Black. ...Thank you."),
    "minos":  dict(o="leo", seed=1, v="am_onyx", sp=0.9, ref=0,
                   text="Dispatch, unit four. Scene's clear. ...No. No witnesses. Copy. Heading back. <sigh> ...Coffee first."),
    "rainer": dict(o="dan", seed=1, v="am_michael", sp=0.95, ref=-1,
                   text="We're closed, sorry... oh. <chuckle> It's you. Come in, come in. Sit wherever you like. I'll make you something warm."),
    "jin":    dict(o="dan", seed=1, v="bm_george", sp=0.9, ref=-3,
                   text="Again. <sigh> You filed this report... three hours late. Again. I don't want excuses. On my desk. Before sunrise."),
    "maquia": dict(o="leo", seed=1, v="am_onyx", sp=0.85, ref=-4, pre=0, gap=1.1,
                   text="You came alone.|Good.|Sit with me.|The night is long."),
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

def perform(ids):
    from transformers import AutoTokenizer, AutoModelForCausalLM
    from snac import SNAC
    name = "unsloth/orpheus-3b-0.1-ft"
    tok = AutoTokenizer.from_pretrained(name)
    lm = AutoModelForCausalLM.from_pretrained(name, torch_dtype=torch.bfloat16).cuda().eval()
    snac = SNAC.from_pretrained("hubertsiuzdak/snac_24khz").cuda().eval()
    for kid in ids:
        c = CAST[kid]; torch.manual_seed(c["seed"]); out = []
        for seg in c["text"].split("|"):
          out += [say(tok, lm, snac, c["o"], seg), np.zeros(int(24000 * c.get("gap", 0)), np.float32)]
        wav = np.concatenate(out)
        if c.get("pre"): wav = librosa.effects.pitch_shift(wav.astype(np.float32), sr=24000, n_steps=c["pre"])
        sf.write(os.path.join(PERF, f"{kid}.wav"), wav, 24000)
        print("perf", kid, round(len(wav) / 24000, 1), "s", flush=True)
    del lm; torch.cuda.empty_cache()

def say(tok, lm, snac, who, text):
        ids_ = tok(f"{who}: {text}", return_tensors="pt").input_ids
        inp = torch.cat([torch.tensor([[128259]]), ids_, torch.tensor([[128009, 128260]])], 1).cuda()
        with torch.no_grad():
            g = lm.generate(inp, attention_mask=torch.ones_like(inp), max_new_tokens=2400, do_sample=True,
                            temperature=0.6, top_p=0.95, repetition_penalty=1.1, eos_token_id=128258)
        g = g[0].tolist(); s = max(i for i, t in enumerate(g) if t == 128257)
        codes = [t - 128266 for t in g[s + 1:] if t != 128258]
        codes = codes[: len(codes) // 7 * 7]
        l1, l2, l3 = [], [], []
        for i in range(len(codes) // 7):
            x = codes[7 * i: 7 * i + 7]
            l1.append(x[0]); l2.append(x[1] - 4096); l3 += [x[2] - 2 * 4096, x[3] - 3 * 4096]
            l2.append(x[4] - 4 * 4096); l3 += [x[5] - 5 * 4096, x[6] - 6 * 4096]
        layers = [torch.tensor(l, device="cuda").clamp(0, 4095)[None] for l in (l1, l2, l3)]
        with torch.no_grad(): return snac.decode(layers).squeeze().cpu().numpy().astype(np.float32)

def to_mp3(wav, sr, path):
    enc = lameenc.Encoder(); enc.set_bit_rate(96); enc.set_in_sample_rate(sr); enc.set_channels(1); enc.set_quality(2)
    open(path, "wb").write(enc.encode((np.clip(wav, -1, 1) * 32767).astype(np.int16).tobytes()) + enc.flush())

def convert(ids):
    import perth
    if perth.PerthImplicitWatermarker is None: perth.PerthImplicitWatermarker = perth.DummyWatermarker
    from chatterbox.vc import ChatterboxVC
    vc = ChatterboxVC.from_pretrained("cuda")
    for kid in ids:
        if not CAST[kid]["v"]:  # v=None: 연기한 목소리를 그대로 쓴다
            w, _ = librosa.load(os.path.join(PERF, f"{kid}.wav"), sr=vc.sr)
        else:
            w = vc.generate(os.path.join(PERF, f"{kid}.wav"), target_voice_path=make_ref(kid, CAST[kid])).squeeze().cpu().numpy()
        w = np.concatenate([np.zeros(int(vc.sr * .3), np.float32), w, np.zeros(int(vc.sr * .3), np.float32)])
        to_mp3(w / max(1e-6, np.abs(w).max()) * 0.89, vc.sr, os.path.join(HERE, f"{kid}.mp3"))
        print("voice", kid, flush=True)

if __name__ == "__main__":
    args = sys.argv[1:]
    only_vc = "--vc" in args; ids = [a for a in args if not a.startswith("--")] or list(CAST)
    if not only_vc: perform(ids)
    convert(ids)
