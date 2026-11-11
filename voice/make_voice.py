import asyncio, os, edge_tts
OUT = r"C:\Crack\NotVamp\.images\voice"
os.makedirs(OUT, exist_ok=True)
# id: (voice, rate, pitch, text)
V = {
    "ruan":   ("en-US-BrianNeural",       "-8%",  "-6Hz",  "...Yeah. It's me. Got nothing to say. Just... called. ...I'm hanging up."),
    "jenis":  ("en-GB-RyanNeural",        "-4%",  "+0Hz",  "Hi, it's Jenis. I'm recording this in the hallway after the meeting. ...It feels a little strange, doing this out loud. Sleep well."),
    "minos":  ("en-US-ChristopherNeural", "-10%", "-8Hz",  "...It's Minos. I'm in the patrol car. Nothing happened. ...Lock your door, and get some sleep."),
    "rainer": ("en-US-AndrewNeural",      "-10%", "-2Hz",  "It's Rainer. I've closed up. I'm sitting at the piano... but tonight, just my voice. ...Good night."),
    "anzi":   ("en-US-EricNeural",        "+0%",  "+2Hz",  "Hm. Anzi. I hit record, so I'll just say whatever. ...Nah. I just wanted to leave you my voice. Text me back."),
    "jin":    ("en-GB-ThomasNeural",      "-6%",  "-2Hz",  "...This is Jin. It's not a work report. ...I'm off now. That's all I wanted to say."),
    "maquia": ("en-US-SteffanNeural",     "-18%", "-10Hz", "...It's Maquia. ... ... If you heard this, that's enough."),
}
async def main():
    for k, (voice, rate, pitch, text) in V.items():
        await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(os.path.join(OUT, k + ".mp3"))
        print(k, os.path.getsize(os.path.join(OUT, k + ".mp3")))
asyncio.run(main())
